// =====================================================================
// SmartPost_Node.ino — camera node firmware (Seeed XIAO ESP32-S3 Sense)
// Vineyard Smart Post · course capstone reference solution
//
// STATUS: UNTESTED on hardware. Implements the PROPOSED design (📐) in
// PROJECT-STATE.md revision 2, §5 "Camera node" and "Trigger sequence".
// Compile-checked in GitHub Actions against esp32 core 3.3.8 only.
//
// Arduino IDE settings
//   Board: XIAO_ESP32S3 · Port: COM3 · ESP32 core 3.3.8
//   PSRAM: OPI PSRAM (the camera needs it)
//   USB CDC On Boot: Enabled · USB Mode: Hardware CDC and JTAG
//
// Hardware it expects (§5, all 📐):
//   TPS22918 load switch feeds BAT+; its ON pin = PIR OUT OR HOLD (BAT54C),
//   470 kΩ to GND. PIR OUT -> 10 kΩ -> D0. WAKE -> diode -> hub GPIO39.
//
// SAFETY: never plug USB into a XIAO that is wired to the riser (S-07).
// Bench-test it on USB alone, with the load switch not fitted.
// =====================================================================

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_sleep.h>
#include "esp_camera.h"
#include "SmartPostProtocol.h"

// ---------- Pins: real GPIO numbers (XIAO D0 = GPIO1) ----------
#define PIR_PIN   1   // D0 — reads PIR OUT (through 10 kΩ)
#define HOLD_PIN  4   // D3 — keeps our own load switch ON
#define WAKE_PIN  5   // D4 — wakes the hub (EXT1 on its GPIO39)
// Avoid: D2/GPIO3 (strapping), GPIO7–9 and GPIO21 (Sense SD slot).

// ---------- Settings ----------
#define NODE_ID          1         // 1..4 — CHANGE FOR EACH BOARD
#ifndef DEBUG_SERIAL
#define DEBUG_SERIAL     1         // set 0 for field builds (saves energy)
#endif
#define SERIAL_WAIT_MS   1500      // bounded wait — never a bare while(!Serial)
#define HELLO_TRIES      3         // §5: 3 tries in about 2 s [E]
#define HELLO_GAP_MS     650
#define SEND_RETRIES     5         // per ESP-NOW frame
#define SEND_TIMEOUT_MS  100       // wait for the send callback
#define ACK_TIMEOUT_MS   1500      // wait for the hub's photo ACK
#define MAX_EVENT_MS     180000UL  // hard ceiling on one event (3 min)
#define WARMUP_FRAMES    2         // discard frames while exposure settles [E]

static const uint8_t HUB_MAC[6] = {0xE0, 0x8C, 0xFE, 0x75, 0x9F, 0x8C}; // [M] LILYGO

// ---------- Camera pins, XIAO ESP32-S3 Sense (Seeed wiki) ----------
#define CAM_PIN_PWDN   -1
#define CAM_PIN_RESET  -1
#define CAM_PIN_XCLK   10
#define CAM_PIN_SIOD   40
#define CAM_PIN_SIOC   39
#define CAM_PIN_Y9     48
#define CAM_PIN_Y8     11
#define CAM_PIN_Y7     12
#define CAM_PIN_Y6     14
#define CAM_PIN_Y5     16
#define CAM_PIN_Y4     18
#define CAM_PIN_Y3     17
#define CAM_PIN_Y2     15
#define CAM_PIN_VSYNC  38
#define CAM_PIN_HREF   47
#define CAM_PIN_PCLK   13

#if DEBUG_SERIAL
  #define LOG(...) Serial.printf(__VA_ARGS__)
#else
  #define LOG(...)
#endif

// ---------- State shared with the ESP-NOW callbacks ----------
// Callbacks run in the Wi-Fi task, not in setup(); 'volatile' tells the
// compiler these can change behind its back.
volatile bool    txDone = false;
volatile bool    txOk = false;
volatile bool    budgetReceived = false;
volatile bool    ackReceived = false;
volatile uint8_t ackPhotoIdx = 0;
volatile uint8_t ackOk = 0;
BudgetMsg        budget;           // filled by onDataRecv

unsigned long eventStart = 0;
bool cameraReady = false;

bool timeUp() { return millis() - eventStart > MAX_EVENT_MS; }

// ---------- ESP-NOW callbacks (core 3.3.8 signatures, M-09) ----------
void onDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  txOk = (status == ESP_NOW_SEND_SUCCESS);
  txDone = true;
}

void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len < 1 || memcmp(info->src_addr, HUB_MAC, 6) != 0) return; // only our hub
  if (data[0] == MSG_BUDGET && len == (int)sizeof(BudgetMsg)) {
    memcpy(&budget, data, sizeof(BudgetMsg));
    if (budget.nodeId == NODE_ID) budgetReceived = true;
  } else if (data[0] == MSG_ACK && len == (int)sizeof(AckMsg)) {
    const AckMsg *a = (const AckMsg *)data;
    if (a->nodeId == NODE_ID) {
      ackPhotoIdx = a->photoIdx;
      ackOk = a->ok;
      ackReceived = true;
    }
  }
}

// ---------- Switching ourselves off ----------
// Requirement 4: a node can always switch itself off. It never returns.
void shutdownNode(const char *why) {
  LOG("Shutdown: %s\n", why);
  if (cameraReady) esp_camera_deinit();
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);
  digitalWrite(WAKE_PIN, LOW);     // let the hub go back to sleep
#if DEBUG_SERIAL
  Serial.flush();
#endif
  digitalWrite(HOLD_PIN, LOW);     // release the load switch: power is cut here...
  delay(500);
  // ...unless PIR OUT is still high and holding the switch on. Then sleep with
  // no wake source until the PIR falls and the switch removes our power.
  // HOLD is never held through deep sleep (§5).
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
  esp_deep_sleep_start();
}

// ---------- Sending with bounded retries ----------
bool sendAndWait(const void *msg, size_t len) {
  for (int attempt = 0; attempt < SEND_RETRIES; attempt++) {
    txDone = false;
    if (esp_now_send(HUB_MAC, (const uint8_t *)msg, len) == ESP_OK) {
      unsigned long t0 = millis();
      while (!txDone && millis() - t0 < SEND_TIMEOUT_MS) delay(1);
      if (txDone && txOk) return true;   // the hub's radio acknowledged it
    } else {
      delay(5);                          // send queue full: give it a moment
    }
  }
  return false;
}

// ---------- Camera ----------
framesize_t toFramesize(uint8_t code) {
  switch (code) {
    case FS_VGA: return FRAMESIZE_VGA;    // 640 x 480
    case FS_XGA: return FRAMESIZE_XGA;    // 1024 x 768
    default:     return FRAMESIZE_SVGA;   // 800 x 600
  }
}

bool initCamera(uint8_t frameCode, uint8_t quality) {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer   = LEDC_TIMER_0;
  c.pin_d0 = CAM_PIN_Y2;  c.pin_d1 = CAM_PIN_Y3;
  c.pin_d2 = CAM_PIN_Y4;  c.pin_d3 = CAM_PIN_Y5;
  c.pin_d4 = CAM_PIN_Y6;  c.pin_d5 = CAM_PIN_Y7;
  c.pin_d6 = CAM_PIN_Y8;  c.pin_d7 = CAM_PIN_Y9;
  c.pin_xclk = CAM_PIN_XCLK;   c.pin_pclk = CAM_PIN_PCLK;
  c.pin_vsync = CAM_PIN_VSYNC; c.pin_href = CAM_PIN_HREF;
  c.pin_sccb_sda = CAM_PIN_SIOD;
  c.pin_sccb_scl = CAM_PIN_SIOC;
  c.pin_pwdn = CAM_PIN_PWDN;   c.pin_reset = CAM_PIN_RESET;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size   = toFramesize(frameCode);
  c.jpeg_quality = quality;
  c.fb_count     = 2;
  c.fb_location  = CAMERA_FB_IN_PSRAM;
  c.grab_mode    = CAMERA_GRAB_LATEST;
  return esp_camera_init(&c) == ESP_OK;
}

// ---------- One photo, chunked, with CRC and an application-level ACK ----------
bool sendPhoto(const camera_fb_t *fb, uint8_t idx, uint16_t eventId) {
  PhotoStartMsg s;
  s.type = MSG_PHOTO_START;
  s.nodeId = NODE_ID;
  s.eventId = eventId;
  s.photoIdx = idx;
  s.totalLen = fb->len;
  s.crc32 = crc32Update(0, fb->buf, fb->len);
  s.chunkCount = (fb->len + CHUNK_DATA_MAX - 1) / CHUNK_DATA_MAX;  // round up
  if (!sendAndWait(&s, sizeof(s))) return false;

  ChunkMsg m;
  m.type = MSG_CHUNK;
  m.nodeId = NODE_ID;
  m.photoIdx = idx;
  for (uint16_t i = 0; i < s.chunkCount; i++) {
    size_t offset = (size_t)i * CHUNK_DATA_MAX;
    size_t n = fb->len - offset;
    if (n > CHUNK_DATA_MAX) n = CHUNK_DATA_MAX;
    m.chunkIdx = i;
    m.len = (uint8_t)n;
    memcpy(m.data, fb->buf + offset, n);
    if (!sendAndWait(&m, CHUNK_HEADER_LEN + n)) return false;
    if (timeUp()) return false;
  }

  ackReceived = false;
  PhotoEndMsg e = {MSG_PHOTO_END, NODE_ID, idx};
  if (!sendAndWait(&e, sizeof(e))) return false;
  unsigned long t0 = millis();
  while (!ackReceived && millis() - t0 < ACK_TIMEOUT_MS) delay(2);
  return ackReceived && ackPhotoIdx == idx && ackOk;
}

// ---------- The whole event runs once, in setup() ----------
void setup() {
  // 1. Hold our own power on — FIRST, before anything slow (§5).
  pinMode(HOLD_PIN, OUTPUT);
  digitalWrite(HOLD_PIN, HIGH);
  pinMode(WAKE_PIN, OUTPUT);
  digitalWrite(WAKE_PIN, LOW);
  pinMode(PIR_PIN, INPUT);
  eventStart = millis();

#if DEBUG_SERIAL
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < SERIAL_WAIT_MS) delay(10);
#endif
  LOG("Node %d awake, PIR=%d\n", NODE_ID, digitalRead(PIR_PIN));

  // 2. Wake the hub.
  digitalWrite(WAKE_PIN, HIGH);

  // 3. Radio up on the agreed channel.
  WiFi.mode(WIFI_STA);
  WiFi.setChannel(ESPNOW_CHANNEL);
  if (esp_now_init() != ESP_OK) shutdownNode("esp_now_init failed");
  esp_now_register_send_cb(onDataSent);
  esp_now_register_recv_cb(onDataRecv);
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, HUB_MAC, 6);
  peer.channel = ESPNOW_CHANNEL;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) shutdownNode("add peer failed");

  // 4. Ask the hub for a budget: bounded, then give up (S-02).
  HelloMsg hello = {MSG_HELLO, NODE_ID, (uint8_t)digitalRead(PIR_PIN)};
  for (int i = 0; i < HELLO_TRIES && !budgetReceived; i++) {
    esp_now_send(HUB_MAC, (const uint8_t *)&hello, sizeof(hello));
    unsigned long t1 = millis();
    while (!budgetReceived && millis() - t1 < HELLO_GAP_MS) delay(5);
  }
  if (!budgetReceived) shutdownNode("hub did not answer");
  if (!budget.allowed) shutdownNode("hub refused (governor)");
  LOG("Budget: event %u, %u photos every %u s\n",
      budget.eventId, budget.photos, budget.intervalS);

  // 5. Camera on, throw away the first frames.
  if (!initCamera(budget.frameSize, budget.jpegQuality)) shutdownNode("camera init failed");
  cameraReady = true;
  for (int i = 0; i < WARMUP_FRAMES; i++) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
  }

  // 6. Capture and send (D-03: every 5 s for 2 min by default).
  uint8_t sent = 0;
  for (uint8_t p = 0; p < budget.photos && !timeUp(); p++) {
    unsigned long shotAt = millis();
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) { LOG("Capture %u failed\n", p); continue; }
    bool ok = sendPhoto(fb, p, budget.eventId);
    if (!ok) ok = sendPhoto(fb, p, budget.eventId);   // one resend, then move on
    LOG("Photo %u: %u bytes, %s\n", p, (unsigned)fb->len, ok ? "stored" : "LOST");
    esp_camera_fb_return(fb);                         // always give the buffer back
    if (ok) sent++;
    if (p + 1 < budget.photos) {
      while (millis() - shotAt < budget.intervalS * 1000UL && !timeUp()) delay(20);
    }
  }

  // 7. Tell the hub we're done, then switch off.
  DoneMsg done = {MSG_DONE, NODE_ID, sent};
  sendAndWait(&done, sizeof(done));
  shutdownNode("event complete");
}

void loop() {
  // never reached: setup() always ends in shutdownNode()
}
