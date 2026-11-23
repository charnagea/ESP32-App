// =====================================================================
// SmartPost_Hub.ino — hub firmware (LILYGO T-SIM7600E-H, ESP32-WROVER)
// Vineyard Smart Post · course capstone reference solution
//
// STATUS: UNTESTED on hardware. Implements the PROPOSED design (📐) in
// PROJECT-STATE.md revision 2, §5 "Hub" and "Trigger sequence".
// Compile-checked in GitHub Actions against esp32 core 3.3.8 only.
//
// Arduino IDE settings
//   Board: ESP32 Wrover Module · Port: COM4 · ESP32 core 3.3.8
//   Upload speed 115200 · Flash frequency 40 MHz · Flash mode QIO
//   Partition scheme: Default 4MB with spiffs (LittleFS uses that partition)
//   DIP switches 1–2 up, 3–4 down. Power switch ON for battery operation.
//
// Things YOU must decide or measure before this runs for real:
//   UPLOAD_URL (where photos go) · APN (Q11) · WAKE_PIN reaches a header (Q2)
//   PWRKEY polarity (check with AT replies) · BAT_DIVIDER/BAT_CAL (I-07)
//   CAP_EVENTS_FULL is the old one-panel figure, not a design basis (H-02)
// =====================================================================

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_sleep.h>
#include <driver/gpio.h>
#include <driver/rtc_io.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <sys/time.h>
#include "SmartPostProtocol.h"

// ---------- Pins (LILYGO T-SIM7600X, REFERENCE §1 and LILYGO utilities.h) ----------
#define MODEM_TX_PIN   27   // ESP32 TX -> modem RX
#define MODEM_RX_PIN   26   // ESP32 RX <- modem TX
#define MODEM_PWRKEY    4
#define MODEM_FLIGHT   25   // HIGH = allowed to register on the network
#define MODEM_DTR      32
#define MODEM_STATUS   34   // input-only; logged so you can learn its polarity (K-01)
#define BOARD_LED      12   // also a strapping pin: keep LOW
#define BAT_ADC_PIN    35   // battery through the board's divider
#define WAKE_PIN       39   // camera WAKE lines, diode-ORed, 100 kΩ to GND (Q2!)
#define TAMPER_PIN     13   // lid + tilt loop, 1 MΩ pull-up (L-2, only if adopted)

// ---------- Settings ----------
#ifndef DEBUG_SERIAL
#define DEBUG_SERIAL       1
#endif
#ifndef USE_TAMPER
#define USE_TAMPER         0        // 1 once the tamper loop is built (L-2)
#endif
#ifndef USE_FAST_BAUD
#define USE_FAST_BAUD      0        // 921600 is untested on this board (K-14)
#endif
#define PWRKEY_ON_LEVEL    HIGH     // LILYGO's example pulses the GPIO HIGH
#define PWRKEY_IDLE_LEVEL  LOW      // (an inverting transistor): verify on the bench
#define PWRKEY_ON_MS       500      // modem needs >= 100 ms, 500 typical [DS, HD]
#define PWRKEY_OFF_MS      2600     // modem needs >= 2.5 s [DS, HD]
#define MODEM_BOOT_MS      25000    // UART ready after 13–14 s [DS, HD]; margin added
#define COLD_BOOT_QUIET_S  90       // PIRs settle for ~1 min after power-on [DS]
#define HELLO_WAIT_MS      3000     // after an EXT1 wake, how long to wait for HELLO
#define SESSION_IDLE_MS    8000     // node silent this long = session over
#define SESSION_MAX_MS     200000UL
#define WAKE_LOW_WAIT_MS   5000
#define HEARTBEAT_S        43200    // one heartbeat every 12 h
#define MAX_PHOTO_BYTES    120000   // below the 153,600-byte AT+HTTPDATA limit [DS, AT]
#define MAX_STORED_FILES   50       // [E] about 1.4 MB partition / 25 KB photos — check
#define BAT_DIVIDER        2.0f     // [E] board divider — calibrate (I-07)
#define BAT_CAL            1.000f   // multimeter reading / firmware reading
#define FLOOR_SLEEP_MV     3400     // [E] below this: refuse everything, sleep
#define FLOOR_LTE_MV       3600     // [E] below this: no modem
#define CAP_EVENTS_FULL    7        // [E] §6 — recompute once harvest is known (H-02)
#define APN                ""       // your SIM's APN (Q11); "" = modem default
#define UPLOAD_URL         "http://example.invalid/upload"   // YOUR DECISION

#if DEBUG_SERIAL
  #define LOG(...) Serial.printf(__VA_ARGS__)
#else
  #define LOG(...)
#endif

// ---------- State that survives deep sleep (RTC slow memory) ----------
// Lost if the battery is disconnected — fine, the hub then cold-boots.
RTC_DATA_ATTR uint32_t bootCount = 0;
RTC_DATA_ATTR time_t   windowStart = 0;     // start of the current 24 h window
RTC_DATA_ATTR uint16_t eventsInWindow = 0;
RTC_DATA_ATTR time_t   lastHeartbeat = 0;
RTC_DATA_ATTR uint32_t droppedPhotos = 0;
RTC_DATA_ATTR bool     tamperPending = false;

// ---------- State that survives power loss (NVS flash) ----------
Preferences prefs;
uint16_t nextEventId = 1;

// ---------- ESP-NOW receive queue ----------
// The callback runs in the Wi-Fi task. It only copies the frame into a
// FreeRTOS queue; all real work happens in our own code.
struct RxItem { uint8_t mac[6]; uint8_t len; uint8_t data[250]; };
QueueHandle_t rxQueue;

void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len <= 0 || len > 250) return;
  RxItem it;
  memcpy(it.mac, info->src_addr, 6);
  it.len = (uint8_t)len;
  memcpy(it.data, data, len);
  xQueueSend(rxQueue, &it, 0);   // never block inside a callback
}

// ---------- Receive session (one node at a time) ----------
struct Session {
  bool     active = false;
  uint8_t  mac[6];
  uint8_t  nodeId = 0;
  uint16_t eventId = 0;
  BudgetMsg budget;
  uint8_t  photosStored = 0;
  // current photo
  bool     photoOpen = false;
  uint8_t  photoIdx = 0;
  uint32_t totalLen = 0;
  uint32_t crc = 0;
  uint16_t chunkCount = 0;
  uint8_t  seen[(MAX_PHOTO_BYTES / CHUNK_DATA_MAX) / 8 + 1];  // 1 bit per chunk
} session;

uint8_t *photoBuf = nullptr;
size_t   photoBufSize = 0;

// ---------- Small helpers ----------
time_t nowS() {                       // system time keeps running in deep sleep
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  return tv.tv_sec;
}

uint16_t readBatteryMv() {
  analogSetPinAttenuation(BAT_ADC_PIN, ADC_11db);   // 150–3100 mV range [DS]
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) { sum += analogReadMilliVolts(BAT_ADC_PIN); delay(2); }
  return (uint16_t)((sum / 16) * BAT_DIVIDER * BAT_CAL);
}

void ensurePeer(const uint8_t *mac) {
  if (esp_now_is_peer_exist(mac)) return;
  esp_now_peer_info_t p = {};
  memcpy(p.peer_addr, mac, 6);
  p.channel = ESPNOW_CHANNEL;
  p.encrypt = false;
  esp_now_add_peer(&p);
}

void sendTo(const uint8_t *mac, const void *msg, size_t len) {
  ensurePeer(mac);
  esp_now_send(mac, (const uint8_t *)msg, len);
}

bool chunkArrived(const uint8_t *bits, uint16_t i) { return bits[i >> 3] & (1 << (i & 7)); }
void markChunk(uint8_t *bits, uint16_t i)       { bits[i >> 3] |= (1 << (i & 7)); }

// ---------- Governor: decides each event's budget ----------
void rollWindow() {
  time_t t = nowS();
  if (windowStart == 0 || t - windowStart >= 86400) {
    windowStart = t;
    eventsInWindow = 0;
  }
}

BudgetMsg decideBudget(uint8_t nodeId, uint16_t mv, bool quietPeriod) {
  BudgetMsg b = {MSG_BUDGET, nodeId, 0, 0, 0, 5, FS_SVGA, 12};
  if (quietPeriod || mv < FLOOR_SLEEP_MV) return b;           // refuse
  rollWindow();
  float soc = (mv - 3400) / (4100.0f - 3400.0f);              // crude [E]
  if (soc < 0) soc = 0;
  if (soc > 1) soc = 1;
  int cap = (int)(CAP_EVENTS_FULL * soc + 0.5f);
  if (cap < 1) cap = 1;
  if (eventsInWindow >= cap) return b;                        // daily cap reached
  b.allowed = 1;
  b.eventId = nextEventId;
  b.photos  = mv >= 3900 ? 24 : (mv >= 3750 ? 12 : 6);        // [E] tune by measurement
  return b;
}

// ---------- Flash storage (LittleFS) ----------
int countStored(String *oldest) {
  int n = 0;
  File dir = LittleFS.open("/p");
  if (!dir) return 0;
  for (File f = dir.openNextFile(); f; f = dir.openNextFile()) {
    String name = String("/p/") + f.name();
    if (oldest && (oldest->length() == 0 || name < *oldest)) *oldest = name;
    n++;
  }
  return n;
}

bool savePhoto(uint8_t node, uint16_t ev, uint8_t idx, const uint8_t *buf, size_t len) {
  String oldest;
  while (countStored(&oldest) >= MAX_STORED_FILES) {   // keep the newest photos
    LittleFS.remove(oldest);
    droppedPhotos++;
    oldest = "";
  }
  char path[40];
  snprintf(path, sizeof(path), "/p/%05u_%u_%02u.jpg", ev, node, idx);
  File f = LittleFS.open(path, "w");
  if (!f) return false;
  size_t written = f.write(buf, len);
  f.close();
  return written == len;
}

// ---------- Handling one ESP-NOW message ----------
void handleMessage(const RxItem &it, uint16_t mv, bool quiet, unsigned long &lastHeard) {
  uint8_t type = it.data[0];

  if (type == MSG_HELLO && it.len == sizeof(HelloMsg)) {
    const HelloMsg *h = (const HelloMsg *)it.data;
    if (session.active && memcmp(it.mac, session.mac, 6) == 0) {
      // the node retried because our first answer got lost: send the same budget
      sendTo(it.mac, &session.budget, sizeof(session.budget));
      return;
    }
    if (session.active) {                     // serve one node at a time
      BudgetMsg no = {MSG_BUDGET, h->nodeId, 0, 0, 0, 5, FS_SVGA, 12};
      sendTo(it.mac, &no, sizeof(no));
      return;
    }
    BudgetMsg b = decideBudget(h->nodeId, mv, quiet);
    sendTo(it.mac, &b, sizeof(b));
    LOG("HELLO node %u -> %s\n", h->nodeId, b.allowed ? "allowed" : "refused");
    if (b.allowed) {
      session.active = true;
      memcpy(session.mac, it.mac, 6);
      session.nodeId = h->nodeId;
      session.eventId = b.eventId;
      session.budget = b;
      session.photosStored = 0;
      session.photoOpen = false;
      eventsInWindow++;
      nextEventId++;
      prefs.putUShort("ev", nextEventId);
      lastHeard = millis();
    }
    return;
  }

  // Everything below must come from the node we are serving.
  if (!session.active || memcmp(it.mac, session.mac, 6) != 0) return;
  lastHeard = millis();

  if (type == MSG_PHOTO_START && it.len == sizeof(PhotoStartMsg)) {
    const PhotoStartMsg *s = (const PhotoStartMsg *)it.data;
    session.photoOpen = (s->totalLen > 0 && s->totalLen <= photoBufSize);
    session.photoIdx = s->photoIdx;
    session.totalLen = s->totalLen;
    session.crc = s->crc32;
    session.chunkCount = s->chunkCount;
    memset(session.seen, 0, sizeof(session.seen));
  }
  else if (type == MSG_CHUNK && it.len > CHUNK_HEADER_LEN && session.photoOpen) {
    const ChunkMsg *c = (const ChunkMsg *)it.data;
    size_t offset = (size_t)c->chunkIdx * CHUNK_DATA_MAX;
    if (c->photoIdx == session.photoIdx && c->chunkIdx < session.chunkCount &&
        offset + c->len <= session.totalLen) {
      memcpy(photoBuf + offset, c->data, c->len);
      markChunk(session.seen, c->chunkIdx);   // duplicates are harmless
    }
  }
  else if (type == MSG_PHOTO_END && it.len == sizeof(PhotoEndMsg)) {
    const PhotoEndMsg *e = (const PhotoEndMsg *)it.data;
    bool ok = session.photoOpen && e->photoIdx == session.photoIdx;
    for (uint16_t i = 0; ok && i < session.chunkCount; i++) ok = chunkArrived(session.seen, i);
    if (ok) ok = crc32Update(0, photoBuf, session.totalLen) == session.crc;
    if (ok) ok = savePhoto(session.nodeId, session.eventId, e->photoIdx, photoBuf, session.totalLen);
    if (ok) session.photosStored++;
    AckMsg a = {MSG_ACK, session.nodeId, e->photoIdx, (uint8_t)(ok ? 1 : 0)};
    sendTo(it.mac, &a, sizeof(a));
    session.photoOpen = false;
    LOG("Photo %u: %s\n", e->photoIdx, ok ? "stored" : "bad, asked for resend");
  }
  else if (type == MSG_DONE) {
    LOG("Node %u done, %u photos stored\n", session.nodeId, session.photosStored);
    session.active = false;
  }
}

// Listen for nodes. Returns when nothing is happening any more.
void runReceive(uint16_t mv, bool quiet, uint32_t listenMs) {
  unsigned long start = millis();
  unsigned long lastHeard = millis();
  RxItem it;
  while (true) {
    if (xQueueReceive(rxQueue, &it, pdMS_TO_TICKS(20)) == pdTRUE) {
      handleMessage(it, mv, quiet, lastHeard);
    }
    if (session.active) {
      if (millis() - lastHeard > SESSION_IDLE_MS || millis() - start > SESSION_MAX_MS) {
        LOG("Session timed out\n");
        session.active = false;
      }
    } else if (millis() - start > listenMs && digitalRead(WAKE_PIN) == LOW) {
      return;   // nobody is talking and nobody is asking
    }
    if (millis() - start > SESSION_MAX_MS + listenMs) return;   // absolute ceiling
  }
}

// ---------- Modem: UART + AT commands ----------
HardwareSerial SerialAT(1);
String atBuf;

bool waitFor(const char *expect, uint32_t timeoutMs) {
  atBuf = "";
  unsigned long t0 = millis();
  while (millis() - t0 < timeoutMs) {
    while (SerialAT.available()) {
      atBuf += (char)SerialAT.read();
      if (atBuf.length() > 1024) atBuf.remove(0, 512);
      if (atBuf.indexOf(expect) >= 0) return true;
      if (atBuf.indexOf("ERROR") >= 0) return false;
    }
    delay(2);
  }
  return false;
}

// No default arguments: the Arduino IDE writes its own function prototypes,
// and defaults would then appear twice. An overload does the same job.
bool at(const char *cmd, const char *expect, uint32_t timeoutMs) {
  while (SerialAT.available()) SerialAT.read();      // drop old bytes
  SerialAT.print("AT");
  SerialAT.print(cmd);
  SerialAT.print("\r\n");
  bool ok = waitFor(expect, timeoutMs);
  LOG("AT%s -> %s\n", cmd, ok ? "ok" : "FAIL");
  return ok;
}

bool at(const char *cmd) { return at(cmd, "OK", 1000); }

bool modemResponds() {
  for (int i = 0; i < 3; i++) if (at("", "OK", 400)) return true;
  return false;
}

void pwrkeyPulse(uint32_t ms) {
  digitalWrite(MODEM_PWRKEY, PWRKEY_ON_LEVEL);
  delay(ms);
  digitalWrite(MODEM_PWRKEY, PWRKEY_IDLE_LEVEL);
}

bool modemPowerOn() {
  digitalWrite(MODEM_DTR, LOW);        // DTR low = modem stays awake
  digitalWrite(MODEM_FLIGHT, HIGH);    // allowed to register [L2]
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  if (modemResponds()) return true;    // already on
  pwrkeyPulse(PWRKEY_ON_MS);
  unsigned long t0 = millis();
  while (millis() - t0 < MODEM_BOOT_MS) {
    if (at("", "OK", 500)) {
      LOG("Modem up after %lu ms, STATUS=%d\n", millis() - t0, digitalRead(MODEM_STATUS));
      return true;
    }
    delay(500);
  }
  return false;
}

void modemPowerOff() {
  if (!at("+CPOF", "OK", 9000)) pwrkeyPulse(PWRKEY_OFF_MS);   // AT first, key as fallback
  unsigned long t0 = millis();
  while (millis() - t0 < 20000 && modemResponds()) delay(1000);
  digitalWrite(MODEM_FLIGHT, LOW);
  LOG("Modem off, STATUS=%d\n", digitalRead(MODEM_STATUS));
  SerialAT.end();
}

// Cold boot: assume the modem might be on, and switch it off (§5).
void ensureModemOffAtBoot() {
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  bool on = modemResponds();
  if (!on) {                                     // maybe left at the fast rate
    SerialAT.updateBaudRate(921600);
    on = modemResponds();
  }
  if (on) modemPowerOff(); else SerialAT.end();
}

bool waitRegistered(uint32_t timeoutMs) {
  unsigned long t0 = millis();
  while (millis() - t0 < timeoutMs) {
    if (at("+CEREG?", "OK", 1000) &&
        (atBuf.indexOf(",1") >= 0 || atBuf.indexOf(",5") >= 0)) return true;  // home / roaming
    delay(2000);
  }
  return false;
}

// HTTP POST in three steps: begin (until DOWNLOAD), write the body, finish.
bool httpBegin(const char *url, const char *contentType, size_t len) {
  at("+HTTPTERM", "OK", 2000);                       // clean up any old session
  if (!at("+HTTPINIT", "OK", 10000)) return false;
  char cmd[200];
  snprintf(cmd, sizeof(cmd), "+HTTPPARA=\"URL\",\"%s\"", url);
  if (!at(cmd)) return false;
  snprintf(cmd, sizeof(cmd), "+HTTPPARA=\"CONTENT\",\"%s\"", contentType);
  if (!at(cmd)) return false;
  snprintf(cmd, sizeof(cmd), "+HTTPDATA=%u,30", (unsigned)len);
  return at(cmd, "DOWNLOAD", 5000);
}

int httpFinish() {                                   // returns the HTTP status, or -1
  if (!waitFor("OK", 30000)) return -1;              // body accepted
  if (!at("+HTTPACTION=1", "+HTTPACTION:", 90000)) return -1;
  waitFor("\r\n", 2000);                             // rest of the line
  int method = 0, status = -1, dataLen = 0;
  int p = atBuf.indexOf("+HTTPACTION:");
  String line = (p >= 0) ? atBuf.substring(p) : atBuf;
  sscanf(line.c_str(), "+HTTPACTION: %d,%d,%d", &method, &status, &dataLen);
  at("+HTTPTERM", "OK", 5000);
  return status;
}

bool uploadFile(const String &path, uint16_t mv) {
  File f = LittleFS.open(path, "r");
  if (!f) return false;
  char url[200];
  snprintf(url, sizeof(url), "%s?file=%s&mv=%u", UPLOAD_URL, path.c_str() + 3, mv);
  bool ok = false;
  if (httpBegin(url, "image/jpeg", f.size())) {
    uint8_t buf[512];
    while (f.available()) {
      size_t n = f.read(buf, sizeof(buf));
      SerialAT.write(buf, n);
    }
    int status = httpFinish();
    ok = status >= 200 && status < 300;
    LOG("Upload %s -> HTTP %d\n", path.c_str(), status);
  }
  f.close();
  if (ok) LittleFS.remove(path);                     // delete only after success
  return ok;
}

bool sendHeartbeat(uint16_t mv, const char *kind) {
  char body[160];
  int n = snprintf(body, sizeof(body),
      "kind=%s mv=%u events=%u stored=%d dropped=%lu boots=%lu",
      kind, mv, eventsInWindow, countStored(nullptr),
      (unsigned long)droppedPhotos, (unsigned long)bootCount);
  char url[160];
  snprintf(url, sizeof(url), "%s?type=%s", UPLOAD_URL, kind);
  if (!httpBegin(url, "text/plain", n)) return false;
  SerialAT.write((const uint8_t *)body, n);
  int status = httpFinish();
  return status >= 200 && status < 300;
}

// One modem session: power on, register, upload, power off.
// Requirement 3: the modem only runs while no camera node is asking (WAKE low).
void modemSession(uint16_t mv, bool heartbeatDue) {
  if (digitalRead(WAKE_PIN) == HIGH) return;
  LOG("Modem session\n");
  if (!modemPowerOn()) { LOG("Modem did not start\n"); modemPowerOff(); return; }
#if USE_FAST_BAUD
  if (at("+IPR=921600")) SerialAT.updateBaudRate(921600);   // temporary; never AT+IPREX
#endif
  at("E0");                                                 // no command echo
  bool ready = at("+CPIN?", "READY", 5000);
  if (ready && strlen(APN) > 0) {
    char cmd[80];
    snprintf(cmd, sizeof(cmd), "+CGDCONT=1,\"IP\",\"%s\"", APN);
    at(cmd);
  }
  if (ready) ready = waitRegistered(90000);
  if (ready) {
    at("+CSQ");                                             // signal quality, for the log
    at("+CGACT=1,1", "OK", 30000);                          // data context on
    if (tamperPending && sendHeartbeat(mv, "tamper")) tamperPending = false;
    String oldest;
    while (countStored(&oldest) > 0) {
      if (digitalRead(WAKE_PIN) == HIGH) { LOG("Camera woke: pausing uploads\n"); break; }
      if (!uploadFile(oldest, mv)) break;                   // try again next session
      oldest = "";
    }
    if (heartbeatDue && sendHeartbeat(mv, "hb")) lastHeartbeat = nowS();
  }
  modemPowerOff();
}

// ---------- Deep sleep ----------
const gpio_num_t heldPins[] = {(gpio_num_t)MODEM_PWRKEY, (gpio_num_t)MODEM_FLIGHT,
                               (gpio_num_t)MODEM_DTR};

void releaseHolds() {
  for (gpio_num_t p : heldPins) gpio_hold_dis(p);
  gpio_deep_sleep_hold_dis();
}

void goToSleep() {   // never returns
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);

  // The level-triggered EXT1 trap: wait for WAKE (and tamper) to fall first.
  uint64_t mask = 1ULL << WAKE_PIN;
#if USE_TAMPER
  mask |= 1ULL << TAMPER_PIN;
#endif
  unsigned long t0 = millis();
  bool lineHigh = true;
  while (millis() - t0 < WAKE_LOW_WAIT_MS) {
    lineHigh = digitalRead(WAKE_PIN) == HIGH;
#if USE_TAMPER
    lineHigh = lineHigh || digitalRead(TAMPER_PIN) == HIGH;
#endif
    if (!lineHigh) break;
    delay(50);
  }

  // Modem lines: safe levels, held through sleep.
  digitalWrite(MODEM_PWRKEY, PWRKEY_IDLE_LEVEL);
  digitalWrite(MODEM_FLIGHT, LOW);
  digitalWrite(MODEM_DTR, LOW);
  for (gpio_num_t p : heldPins) gpio_hold_en(p);
  gpio_deep_sleep_hold_en();

  // GPIO12: LED and strapping pin — low, then isolated [SL].
  digitalWrite(BOARD_LED, LOW);
  rtc_gpio_isolate(GPIO_NUM_12);

  // Wake on WAKE/tamper going high, and on a timer for the next heartbeat.
  if (!lineHigh) esp_sleep_enable_ext1_wakeup_io(mask, ESP_EXT1_WAKEUP_ANY_HIGH);
  long untilHb = HEARTBEAT_S - (long)(nowS() - lastHeartbeat);
  if (lineHigh || untilHb < 60) untilHb = 60;     // a stuck line: check again in a minute
  esp_sleep_enable_timer_wakeup((uint64_t)untilHb * 1000000ULL);

  LOG("Sleeping %ld s\n", untilHb);
#if DEBUG_SERIAL
  Serial.flush();
#endif
  esp_deep_sleep_start();
}

// ---------- Main flow: runs once per wake ----------
void setup() {
  releaseHolds();                                  // we own the pins again
  pinMode(MODEM_PWRKEY, OUTPUT);
  digitalWrite(MODEM_PWRKEY, PWRKEY_IDLE_LEVEL);
  pinMode(MODEM_FLIGHT, OUTPUT);
  pinMode(MODEM_DTR, OUTPUT);
  pinMode(MODEM_STATUS, INPUT);
  pinMode(BOARD_LED, OUTPUT);
  digitalWrite(BOARD_LED, LOW);
  pinMode(WAKE_PIN, INPUT);                        // GPIO39 has no internal pulls
#if USE_TAMPER
  pinMode(TAMPER_PIN, INPUT);
#endif

#if DEBUG_SERIAL
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 2000) delay(10);   // bounded, even here
#endif

  bootCount++;
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  bool coldBoot = (cause != ESP_SLEEP_WAKEUP_EXT1 && cause != ESP_SLEEP_WAKEUP_TIMER);
  LOG("Hub boot %lu, cause %d\n", (unsigned long)bootCount, (int)cause);

#if USE_TAMPER
  if (cause == ESP_SLEEP_WAKEUP_EXT1 &&
      (esp_sleep_get_ext1_wakeup_status() & (1ULL << TAMPER_PIN))) {
    tamperPending = true;
    LOG("TAMPER\n");
  }
#endif

  prefs.begin("hub", false);
  nextEventId = prefs.getUShort("ev", 1);
  if (!LittleFS.begin(true)) LOG("LittleFS failed\n");
  LittleFS.mkdir("/p");

  uint16_t mv = readBatteryMv();                   // resting, before the radio starts
  LOG("Battery %u mV (uncalibrated until I-07)\n", mv);

  if (coldBoot) {
    ensureModemOffAtBoot();
    lastHeartbeat = 0;                             // first heartbeat as soon as allowed
  }
  if (mv < FLOOR_SLEEP_MV) goToSleep();            // sleep-only floor

  // Photo buffer: PSRAM if the module has it, internal RAM otherwise.
  photoBufSize = MAX_PHOTO_BYTES;
  photoBuf = psramFound() ? (uint8_t *)ps_malloc(photoBufSize) : nullptr;
  if (!photoBuf) { photoBufSize = 60000; photoBuf = (uint8_t *)malloc(photoBufSize); }

  rxQueue = xQueueCreate(48, sizeof(RxItem));
  WiFi.mode(WIFI_STA);
  WiFi.setChannel(ESPNOW_CHANNEL);
  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onDataRecv);
    if (coldBoot) {
      LOG("Cold boot: refusing triggers for %d s\n", COLD_BOOT_QUIET_S);
      runReceive(mv, true, COLD_BOOT_QUIET_S * 1000UL);
    } else if (cause == ESP_SLEEP_WAKEUP_EXT1 || digitalRead(WAKE_PIN) == HIGH) {
      runReceive(mv, false, HELLO_WAIT_MS);
    }
  }
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);                             // radio off before the modem starts

  bool heartbeatDue = (nowS() - lastHeartbeat) >= HEARTBEAT_S || lastHeartbeat == 0;
  bool photosWaiting = countStored(nullptr) > 0;
  uint16_t mvNow = readBatteryMv();
  if (mvNow >= FLOOR_LTE_MV && (photosWaiting || heartbeatDue || tamperPending)) {
    modemSession(mvNow, heartbeatDue);
  }
  goToSleep();
}

void loop() {
  // never reached: setup() always ends in goToSleep()
}
