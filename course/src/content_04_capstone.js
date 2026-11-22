(function () {
const R = String.raw;
const M = window.COURSE.modules;

/* ===================== PART 5 — CAPSTONE ===================== */
M.push({
  id: 'capnode', part: 'Part 5 · Capstone: write the firmware', icon: '🛠️', title: 'Capstone A — the camera node',
  summary: 'Write SmartPost_Node.ino piece by piece. Each lab checks your code.',
  intro: 'Ten labs build the complete node program. Type in the editor (the symbol bar helps on a phone), press Check, fix what fails. The checks look for the essential lines; they don\'t compile your code. The real compile happens in Arduino IDE. Your code is saved on the phone.',
  lessons: [
    { id: 'cn-1', title: 'Lab 1 · Includes, pins, settings', blocks: [
      { t: 'p', html: 'Every sketch opens with its includes, its pins and its settings. Use real GPIO numbers.' },
      { t: 'lab', id: 'n1', title: 'Top of SmartPost_Node.ino',
        task: '<ul><li>Include <code>WiFi.h</code>, <code>esp_now.h</code>, <code>esp_camera.h</code> and your <code>SmartPostProtocol.h</code>.</li><li>Define PIR_PIN, HOLD_PIN, WAKE_PIN (D0, D3, D4 as real GPIOs).</li><li>Define NODE_ID 1 and a DEBUG_SERIAL switch.</li><li>Declare the hub\'s MAC as a 6-byte array.</li></ul>',
        starter: R`// SmartPost_Node.ino — camera node (XIAO ESP32-S3 Sense)
// Board: XIAO_ESP32S3 · PSRAM: OPI PSRAM · core 3.3.8

// includes


// pins (real GPIO numbers!)


// settings


// the hub's MAC address (E0:8C:FE:75:9F:8C)
`,
        checks: [
          { re: R`#include\s*<WiFi\.h>`, msg: 'includes WiFi.h' },
          { re: R`#include\s*<esp_now\.h>`, msg: 'includes esp_now.h' },
          { re: R`#include\s*["<]esp_camera\.h[">]`, msg: 'includes esp_camera.h' },
          { re: R`#include\s*"SmartPostProtocol\.h"`, msg: 'includes "SmartPostProtocol.h" with quotes' },
          { re: R`#define\s+PIR_PIN\s+1\b`, msg: 'PIR_PIN is GPIO1 (D0 — lesson 3)' },
          { re: R`#define\s+PIR_PIN\s+0\b`, not: true, msg: 'not GPIO0: the label D0 is not GPIO0' },
          { re: R`#define\s+HOLD_PIN\s+4\b`, msg: 'HOLD_PIN is GPIO4 (D3)' },
          { re: R`#define\s+WAKE_PIN\s+5\b`, msg: 'WAKE_PIN is GPIO5 (D4)' },
          { re: R`#define\s+NODE_ID\s+[1-4]\b`, msg: 'NODE_ID is 1–4' },
          { re: R`#define\s+DEBUG_SERIAL\s+[01]\b`, msg: 'DEBUG_SERIAL switch' },
          { re: R`uint8_t\s+HUB_MAC\s*\[\s*6?\s*\]\s*=\s*\{\s*0xE0\s*,\s*0x8C\s*,\s*0xFE\s*,\s*0x75\s*,\s*0x9F\s*,\s*0x8C\s*\}`, f: 'mi', msg: 'HUB_MAC = {0xE0, 0x8C, 0xFE, 0x75, 0x9F, 0x8C}' }
        ],
        hint: 'D0 = GPIO1, D3 = GPIO4, D4 = GPIO5. Write the MAC as <code>static const uint8_t HUB_MAC[6] = {0xE0, …};</code>',
        solution: R`#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <esp_sleep.h>
#include "esp_camera.h"
#include "SmartPostProtocol.h"

#define PIR_PIN   1   // D0
#define HOLD_PIN  4   // D3
#define WAKE_PIN  5   // D4

#define NODE_ID          1
#define DEBUG_SERIAL     1
#define SERIAL_WAIT_MS   1500
#define HELLO_TRIES      3
#define HELLO_GAP_MS     650
#define SEND_RETRIES     5
#define SEND_TIMEOUT_MS  100
#define ACK_TIMEOUT_MS   1500
#define MAX_EVENT_MS     180000UL
#define WARMUP_FRAMES    2

static const uint8_t HUB_MAC[6] = {0xE0, 0x8C, 0xFE, 0x75, 0x9F, 0x8C};

#if DEBUG_SERIAL
  #define LOG(...) Serial.printf(__VA_ARGS__)
#else
  #define LOG(...)
#endif` }
    ]},
    { id: 'cn-2', title: 'Lab 2 · The first lines of setup()', blocks: [
      { t: 'p', html: 'Order matters: HOLD first (the PIR pulse may end any moment), then the bounded serial wait, then WAKE.' },
      { t: 'lab', id: 'n2', title: 'Start of setup()',
        task: '<ul><li>Make HOLD_PIN an output and drive it HIGH — before anything else.</li><li>Make WAKE_PIN an output, LOW; PIR_PIN an input.</li><li>Record <code>eventStart = millis()</code>.</li><li>Inside <code>#if DEBUG_SERIAL</code>: start Serial and wait at most SERIAL_WAIT_MS.</li><li>Then raise WAKE.</li></ul>',
        starter: R`unsigned long eventStart = 0;

void setup() {
  // 1. hold our own power on

  // 2. other pins

  // 3. debug serial, bounded

  // 4. wake the hub

}`,
        checks: [
          { re: R`pinMode\s*\(\s*HOLD_PIN\s*,\s*OUTPUT\s*\)`, msg: 'HOLD_PIN is an OUTPUT' },
          { re: R`digitalWrite\s*\(\s*HOLD_PIN\s*,\s*HIGH\s*\)[\s\S]*Serial\.begin`, msg: 'HOLD goes HIGH before Serial.begin' },
          { re: R`pinMode\s*\(\s*WAKE_PIN\s*,\s*OUTPUT\s*\)`, msg: 'WAKE_PIN is an OUTPUT' },
          { re: R`pinMode\s*\(\s*PIR_PIN\s*,\s*INPUT\s*\)`, msg: 'PIR_PIN is an INPUT' },
          { re: R`eventStart\s*=\s*millis\s*\(\s*\)`, msg: 'eventStart = millis()' },
          { re: R`while\s*\(\s*!\s*Serial\s*\)`, not: true, msg: 'no bare while(!Serial) (lesson 13)' },
          { re: R`while\s*\(\s*!\s*Serial\s*&&\s*millis\s*\(\s*\)\s*-\s*\w+\s*<\s*\w+`, msg: 'serial wait bounded with millis() - t0 < limit' },
          { re: R`Serial\.begin[\s\S]*digitalWrite\s*\(\s*WAKE_PIN\s*,\s*HIGH\s*\)`, msg: 'WAKE goes HIGH after the serial wait' }
        ],
        hint: 'Pattern: <code>unsigned long t0 = millis(); while (!Serial &amp;&amp; millis() - t0 &lt; SERIAL_WAIT_MS) delay(10);</code>',
        solution: R`unsigned long eventStart = 0;

void setup() {
  pinMode(HOLD_PIN, OUTPUT);
  digitalWrite(HOLD_PIN, HIGH);      // first: keep our power on
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

  digitalWrite(WAKE_PIN, HIGH);      // wake the hub
  // ... continues in the next labs
}` }
    ]},
    { id: 'cn-3', title: 'Lab 3 · The callbacks', blocks: [
      { t: 'lab', id: 'n3', title: 'onDataSent and onDataRecv',
        task: '<ul><li>Declare volatile flags: <code>txDone</code>, <code>txOk</code>, <code>budgetReceived</code>, <code>ackReceived</code>, plus <code>ackPhotoIdx</code>, <code>ackOk</code>, and a <code>BudgetMsg budget</code>.</li><li>onDataSent (core 3.3.8 signature) stores whether the status was ESP_NOW_SEND_SUCCESS and sets txDone.</li><li>onDataRecv (core 3.3.8 signature) ignores anything not from HUB_MAC, copies a BUDGET of the right length for our NODE_ID, and records an ACK of the right length.</li></ul>',
        starter: R`// shared flags (written in callbacks, read in setup)


void onDataSent(/* signature? */) {
}

void onDataRecv(/* signature? */) {
}`,
        checks: [
          { re: R`volatile\s+bool\s+txDone`, msg: 'volatile bool txDone' },
          { re: R`volatile\s+bool\s+budgetReceived`, msg: 'volatile bool budgetReceived' },
          { re: R`volatile\s+bool\s+ackReceived`, msg: 'volatile bool ackReceived' },
          { re: R`void\s+onDataSent\s*\(\s*const\s+wifi_tx_info_t\s*\*\s*\w+\s*,\s*esp_now_send_status_t\s+\w+\s*\)`, msg: 'onDataSent(const wifi_tx_info_t *, esp_now_send_status_t) — M-09' },
          { re: R`void\s+onDataRecv\s*\(\s*const\s+esp_now_recv_info_t\s*\*\s*\w+\s*,\s*const\s+uint8_t\s*\*\s*\w+\s*,\s*int\s+\w+\s*\)`, msg: 'onDataRecv(const esp_now_recv_info_t *, const uint8_t *, int) — M-09' },
          { re: R`ESP_NOW_SEND_SUCCESS`, msg: 'compares the status with ESP_NOW_SEND_SUCCESS' },
          { re: R`memcmp\s*\(\s*\w+\s*->\s*src_addr\s*,\s*HUB_MAC\s*,\s*6\s*\)`, msg: 'filters on info->src_addr vs HUB_MAC' },
          { re: R`sizeof\s*\(\s*BudgetMsg\s*\)`, msg: 'checks the BUDGET length with sizeof(BudgetMsg)' },
          { re: R`sizeof\s*\(\s*AckMsg\s*\)`, msg: 'checks the ACK length with sizeof(AckMsg)' },
          { re: R`NODE_ID`, msg: 'only accepts messages for our NODE_ID' }
        ],
        hint: 'Exact types: <code>const wifi_tx_info_t *info, esp_now_send_status_t status</code> and <code>const esp_now_recv_info_t *info, const uint8_t *data, int len</code>.',
        solution: R`volatile bool    txDone = false;
volatile bool    txOk = false;
volatile bool    budgetReceived = false;
volatile bool    ackReceived = false;
volatile uint8_t ackPhotoIdx = 0;
volatile uint8_t ackOk = 0;
BudgetMsg        budget;

void onDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  txOk = (status == ESP_NOW_SEND_SUCCESS);
  txDone = true;
}

void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len < 1 || memcmp(info->src_addr, HUB_MAC, 6) != 0) return;
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
}` }
    ]},
    { id: 'cn-4', title: 'Lab 4 · Radio up', blocks: [
      { t: 'lab', id: 'n4', title: 'Start ESP-NOW and add the hub as a peer',
        task: 'Continue setup(): station mode, set the channel (the right function!), init ESP-NOW and stop the node if it fails, register both callbacks, add the hub as a peer on ESPNOW_CHANNEL without encryption.',
        starter: R`  // 3. radio up
`,
        checks: [
          { re: R`WiFi\.mode\s*\(\s*WIFI_STA\s*\)`, msg: 'WiFi.mode(WIFI_STA)' },
          { re: R`WiFi\.setChannel\s*\(\s*ESPNOW_CHANNEL\s*\)`, msg: 'WiFi.setChannel(ESPNOW_CHANNEL) — lesson 14' },
          { re: R`WiFi\.channel\s*\(\s*\w+\s*\)`, not: true, msg: 'not WiFi.channel(n), which only reads' },
          { re: R`WiFi\.mode[\s\S]*WiFi\.setChannel[\s\S]*esp_now_init`, msg: 'order: mode → setChannel → esp_now_init' },
          { re: R`esp_now_init\s*\(\s*\)\s*!=\s*ESP_OK`, msg: 'checks esp_now_init() result' },
          { re: R`esp_now_register_send_cb\s*\(\s*onDataSent\s*\)`, msg: 'registers onDataSent' },
          { re: R`esp_now_register_recv_cb\s*\(\s*onDataRecv\s*\)`, msg: 'registers onDataRecv' },
          { re: R`esp_now_peer_info_t\s+\w+\s*=\s*\{\s*\}`, msg: 'peer info zero-initialised with = {}' },
          { re: R`memcpy\s*\(\s*\w+\.peer_addr\s*,\s*HUB_MAC\s*,\s*6\s*\)`, msg: 'copies HUB_MAC into peer_addr' },
          { re: R`esp_now_add_peer\s*\(\s*&\s*\w+\s*\)`, msg: 'esp_now_add_peer(&peer)' }
        ],
        hint: 'See the ESP-NOW module, lesson "Starting the link".',
        solution: R`  WiFi.mode(WIFI_STA);
  WiFi.setChannel(ESPNOW_CHANNEL);
  if (esp_now_init() != ESP_OK) shutdownNode("esp_now_init failed");
  esp_now_register_send_cb(onDataSent);
  esp_now_register_recv_cb(onDataRecv);
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, HUB_MAC, 6);
  peer.channel = ESPNOW_CHANNEL;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) shutdownNode("add peer failed");` }
    ]},
    { id: 'cn-5', title: 'Lab 5 · sendAndWait()', blocks: [
      { t: 'lab', id: 'n5', title: 'Send one frame, with bounded retries',
        task: 'Write <code>bool sendAndWait(const void *msg, size_t len)</code>: up to SEND_RETRIES attempts; each clears txDone, calls esp_now_send, waits up to SEND_TIMEOUT_MS for the callback, and returns true on success. Return false when all attempts fail.',
        starter: R`bool sendAndWait(const void *msg, size_t len) {

}`,
        checks: [
          { re: R`bool\s+sendAndWait\s*\(\s*const\s+void\s*\*\s*\w+\s*,\s*size_t\s+\w+\s*\)`, msg: 'signature bool sendAndWait(const void *msg, size_t len)' },
          { re: R`for\s*\([^;]*;[^;]*<\s*SEND_RETRIES`, msg: 'loop bounded by SEND_RETRIES' },
          { re: R`txDone\s*=\s*false`, msg: 'clears txDone before sending' },
          { re: R`esp_now_send\s*\(\s*HUB_MAC\s*,\s*\(\s*const\s+uint8_t\s*\*\s*\)\s*\w+\s*,\s*\w+\s*\)`, msg: 'esp_now_send(HUB_MAC, (const uint8_t *)msg, len)' },
          { re: R`millis\s*\(\s*\)\s*-\s*\w+\s*<\s*SEND_TIMEOUT_MS`, msg: 'waits at most SEND_TIMEOUT_MS' },
          { re: R`return\s+true`, msg: 'returns true on success' },
          { re: R`return\s+false`, msg: 'returns false after the last attempt' }
        ],
        solution: R`bool sendAndWait(const void *msg, size_t len) {
  for (int attempt = 0; attempt < SEND_RETRIES; attempt++) {
    txDone = false;
    if (esp_now_send(HUB_MAC, (const uint8_t *)msg, len) == ESP_OK) {
      unsigned long t0 = millis();
      while (!txDone && millis() - t0 < SEND_TIMEOUT_MS) delay(1);
      if (txDone && txOk) return true;
    } else {
      delay(5);
    }
  }
  return false;
}` }
    ]},
    { id: 'cn-6', title: 'Lab 6 · Switching off', blocks: [
      { t: 'p', html: 'Requirement 4: the node can always switch itself off. If PIR OUT still holds the load switch on, sleep with <b>no</b> wake source until the PIR falls and power disappears. Never hold HOLD through sleep.' },
      { t: 'lab', id: 'n6', title: 'void shutdownNode(const char *why)',
        task: 'This function never returns (leave out <code>[[noreturn]]</code>; a comment says it). Log the reason, de-init the camera if it was started (bool <code>cameraReady</code>), de-init ESP-NOW, Wi-Fi off, drop WAKE, flush Serial (debug only), drop HOLD, wait 500 ms, disable all wake sources, deep sleep.',
        starter: R`bool cameraReady = false;

void shutdownNode(const char *why) {   // never returns

}`,
        checks: [
          { re: R`void\s+shutdownNode\s*\(\s*const\s+char\s*\*\s*\w+\s*\)`, msg: 'void shutdownNode(const char *why)' },
          { re: R`\[\[\s*noreturn`, not: true, msg: 'no [[noreturn]] (clashes with the IDE prototypes)' },
          { re: R`if\s*\(\s*cameraReady\s*\)\s*esp_camera_deinit\s*\(\s*\)`, msg: 'de-inits the camera only if it was started' },
          { re: R`esp_now_deinit\s*\(\s*\)`, msg: 'esp_now_deinit()' },
          { re: R`WiFi\.mode\s*\(\s*WIFI_OFF\s*\)`, msg: 'WiFi.mode(WIFI_OFF)' },
          { re: R`digitalWrite\s*\(\s*WAKE_PIN\s*,\s*LOW\s*\)[\s\S]*digitalWrite\s*\(\s*HOLD_PIN\s*,\s*LOW\s*\)`, msg: 'WAKE LOW before HOLD LOW' },
          { re: R`gpio_hold_en\s*\(\s*\(?\s*gpio_num_t\s*\)?\s*HOLD_PIN`, not: true, msg: 'does not hold HOLD through sleep' },
          { re: R`esp_sleep_disable_wakeup_source\s*\(\s*ESP_SLEEP_WAKEUP_ALL\s*\)`, msg: 'disables every wake source' },
          { re: R`esp_deep_sleep_start\s*\(\s*\)`, msg: 'esp_deep_sleep_start()' }
        ],
        solution: R`bool cameraReady = false;

void shutdownNode(const char *why) {   // never returns
  LOG("Shutdown: %s\n", why);
  if (cameraReady) esp_camera_deinit();
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);
  digitalWrite(WAKE_PIN, LOW);
#if DEBUG_SERIAL
  Serial.flush();
#endif
  digitalWrite(HOLD_PIN, LOW);     // power is cut here if PIR OUT is low
  delay(500);
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
  esp_deep_sleep_start();          // wait, at ~3 mA, until the PIR falls
}` }
    ]},
    { id: 'cn-7', title: 'Lab 7 · Ask the hub, or give up', blocks: [
      { t: 'lab', id: 'n7', title: 'HELLO until BUDGET',
        task: 'Build a HelloMsg (type, NODE_ID, current PIR level). Send it up to HELLO_TRIES times; after each send wait up to HELLO_GAP_MS for budgetReceived. If no budget: shutdownNode. If budget.allowed is 0: shutdownNode.',
        starter: R`  // 4. ask for a budget
`,
        checks: [
          { re: R`HelloMsg\s+\w+\s*=\s*\{\s*MSG_HELLO\s*,\s*NODE_ID`, msg: 'HelloMsg starts {MSG_HELLO, NODE_ID, …}' },
          { re: R`digitalRead\s*\(\s*PIR_PIN\s*\)`, msg: 'includes the PIR level' },
          { re: R`<\s*HELLO_TRIES`, msg: 'bounded by HELLO_TRIES' },
          { re: R`millis\s*\(\s*\)\s*-\s*\w+\s*<\s*HELLO_GAP_MS`, msg: 'waits at most HELLO_GAP_MS per try' },
          { re: R`if\s*\(\s*!\s*budgetReceived\s*\)\s*shutdownNode`, msg: 'gives up if the hub never answered' },
          { re: R`if\s*\(\s*!\s*budget\.allowed\s*\)\s*shutdownNode`, msg: 'switches off if the hub refused' }
        ],
        solution: R`  HelloMsg hello = {MSG_HELLO, NODE_ID, (uint8_t)digitalRead(PIR_PIN)};
  for (int i = 0; i < HELLO_TRIES && !budgetReceived; i++) {
    esp_now_send(HUB_MAC, (const uint8_t *)&hello, sizeof(hello));
    unsigned long t1 = millis();
    while (!budgetReceived && millis() - t1 < HELLO_GAP_MS) delay(5);
  }
  if (!budgetReceived) shutdownNode("hub did not answer");
  if (!budget.allowed) shutdownNode("hub refused (governor)");` }
    ]},
    { id: 'cn-8', title: 'Lab 8 · Camera on', blocks: [
      { t: 'lab', id: 'n8', title: 'initCamera() and warm-up',
        task: '<ul><li>Write <code>bool initCamera(uint8_t frameCode, uint8_t quality)</code>: fill a zeroed camera_config_t with the XIAO pins, 20 MHz XCLK, JPEG, frame size from the code (use a helper <code>toFramesize()</code>), quality, 2 buffers in PSRAM, GRAB_LATEST; return whether esp_camera_init succeeded.</li><li>In setup(): init with the budget\'s values (switch off on failure), set cameraReady, and discard WARMUP_FRAMES frames.</li></ul>',
        starter: R`framesize_t toFramesize(uint8_t code) {
  switch (code) {
    case FS_VGA: return FRAMESIZE_VGA;
    case FS_XGA: return FRAMESIZE_XGA;
    default:     return FRAMESIZE_SVGA;
  }
}

bool initCamera(uint8_t frameCode, uint8_t quality) {

}`,
        checks: [
          { re: R`camera_config_t\s+\w+\s*=\s*\{\s*\}`, msg: 'camera_config_t zero-initialised' },
          { re: R`pin_xclk\s*=\s*(10|CAM_PIN_XCLK)\b`, msg: 'XCLK on GPIO10' },
          { re: R`pin_sccb_sda\s*=\s*(40|CAM_PIN_SIOD)\b`, msg: 'SCCB SDA on GPIO40' },
          { re: R`pin_d7\s*=\s*(48|CAM_PIN_Y9)\b`, msg: 'D7 (Y9) on GPIO48' },
          { re: R`pin_pwdn\s*=\s*-\s*1`, msg: 'no power-down pin (-1)' },
          { re: R`xclk_freq_hz\s*=\s*20000000`, msg: '20 MHz clock' },
          { re: R`pixel_format\s*=\s*PIXFORMAT_JPEG`, msg: 'JPEG' },
          { re: R`fb_location\s*=\s*CAMERA_FB_IN_PSRAM`, msg: 'frame buffers in PSRAM' },
          { re: R`esp_camera_init\s*\(\s*&\s*\w+\s*\)\s*==\s*ESP_OK`, msg: 'returns esp_camera_init(&c) == ESP_OK' }
        ],
        solution: R`bool initCamera(uint8_t frameCode, uint8_t quality) {
  camera_config_t c = {};
  c.ledc_channel = LEDC_CHANNEL_0;
  c.ledc_timer   = LEDC_TIMER_0;
  c.pin_d0 = 15; c.pin_d1 = 17; c.pin_d2 = 18; c.pin_d3 = 16;
  c.pin_d4 = 14; c.pin_d5 = 12; c.pin_d6 = 11; c.pin_d7 = 48;
  c.pin_xclk = 10; c.pin_pclk = 13; c.pin_vsync = 38; c.pin_href = 47;
  c.pin_sccb_sda = 40; c.pin_sccb_scl = 39;
  c.pin_pwdn = -1; c.pin_reset = -1;
  c.xclk_freq_hz = 20000000;
  c.pixel_format = PIXFORMAT_JPEG;
  c.frame_size   = toFramesize(frameCode);
  c.jpeg_quality = quality;
  c.fb_count     = 2;
  c.fb_location  = CAMERA_FB_IN_PSRAM;
  c.grab_mode    = CAMERA_GRAB_LATEST;
  return esp_camera_init(&c) == ESP_OK;
}

// in setup(), after the budget:
//   if (!initCamera(budget.frameSize, budget.jpegQuality)) shutdownNode("camera init failed");
//   cameraReady = true;
//   for (int i = 0; i < WARMUP_FRAMES; i++) {
//     camera_fb_t *fb = esp_camera_fb_get();
//     if (fb) esp_camera_fb_return(fb);
//   }` }
    ]},
    { id: 'cn-9', title: 'Lab 9 · sendPhoto()', blocks: [
      { t: 'lab', id: 'n9', title: 'One photo: start, chunks, end, ACK',
        task: '<ul><li>PhotoStartMsg with length, CRC (crc32Update from 0) and chunk count rounded up.</li><li>A loop sending ChunkMsg frames: offset = i × CHUNK_DATA_MAX, the last chunk shorter, send only CHUNK_HEADER_LEN + n bytes, stop if timeUp().</li><li>Clear ackReceived, send PhotoEndMsg, wait up to ACK_TIMEOUT_MS, return true only for a matching ok ACK.</li></ul>',
        starter: R`bool timeUp() { return millis() - eventStart > MAX_EVENT_MS; }

bool sendPhoto(const camera_fb_t *fb, uint8_t idx, uint16_t eventId) {

}`,
        checks: [
          { re: R`crc32Update\s*\(\s*0\s*,\s*fb\s*->\s*buf\s*,\s*fb\s*->\s*len\s*\)`, msg: 'CRC of the whole JPEG: crc32Update(0, fb->buf, fb->len)' },
          { re: R`\(\s*fb\s*->\s*len\s*\+\s*CHUNK_DATA_MAX\s*-\s*1\s*\)\s*/\s*CHUNK_DATA_MAX`, msg: 'chunk count rounded up' },
          { re: R`\*\s*CHUNK_DATA_MAX`, msg: 'offset = i × CHUNK_DATA_MAX' },
          { re: R`if\s*\(\s*\w+\s*>\s*CHUNK_DATA_MAX\s*\)`, msg: 'last chunk can be shorter' },
          { re: R`CHUNK_HEADER_LEN\s*\+\s*\w+`, msg: 'sends CHUNK_HEADER_LEN + n bytes' },
          { re: R`timeUp\s*\(\s*\)`, msg: 'respects the event time limit' },
          { re: R`ackReceived\s*=\s*false[\s\S]*MSG_PHOTO_END`, msg: 'clears ackReceived before PHOTO_END' },
          { re: R`ACK_TIMEOUT_MS`, msg: 'bounded wait for the ACK' },
          { re: R`ackPhotoIdx\s*==\s*idx`, msg: 'checks the ACK is for this photo' }
        ],
        hint: 'Copy the structure from the protocol module, lesson "Chunking a photo".',
        solution: R`bool timeUp() { return millis() - eventStart > MAX_EVENT_MS; }

bool sendPhoto(const camera_fb_t *fb, uint8_t idx, uint16_t eventId) {
  PhotoStartMsg s;
  s.type = MSG_PHOTO_START;
  s.nodeId = NODE_ID;
  s.eventId = eventId;
  s.photoIdx = idx;
  s.totalLen = fb->len;
  s.crc32 = crc32Update(0, fb->buf, fb->len);
  s.chunkCount = (fb->len + CHUNK_DATA_MAX - 1) / CHUNK_DATA_MAX;
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
}` }
    ]},
    { id: 'cn-10', title: 'Lab 10 · The capture loop', blocks: [
      { t: 'lab', id: 'n10', title: 'Capture, send, pace, finish',
        task: 'For each photo in the budget (and while not timeUp): note the time, get a frame (skip if null), send it with one resend on failure, <b>return the frame buffer</b>, count successes, and wait for the next interval (not after the last). Then send DoneMsg and shutdownNode("event complete"). <code>loop()</code> stays empty.',
        starter: R`  // 6. capture and send
  uint8_t sent = 0;

  // 7. done
`,
        checks: [
          { re: R`for\s*\([^;]*;\s*\w+\s*<\s*budget\.photos\s*&&\s*!\s*timeUp\s*\(\s*\)`, msg: 'loop over budget.photos while !timeUp()' },
          { re: R`esp_camera_fb_get\s*\(\s*\)`, msg: 'gets a frame' },
          { re: R`if\s*\(\s*!\s*fb\s*\)`, msg: 'handles a failed capture' },
          { re: R`sendPhoto\s*\([\s\S]*sendPhoto\s*\(`, msg: 'one resend on failure' },
          { re: R`esp_camera_fb_return\s*\(\s*fb\s*\)`, msg: 'returns the frame buffer' },
          { re: R`intervalS\s*\*\s*1000UL`, msg: 'paces photos by budget.intervalS × 1000UL' },
          { re: R`DoneMsg\s+\w+\s*=\s*\{\s*MSG_DONE\s*,\s*NODE_ID\s*,\s*sent\s*\}`, msg: 'DoneMsg {MSG_DONE, NODE_ID, sent}' },
          { re: R`shutdownNode\s*\(\s*"event complete"\s*\)`, msg: 'ends with shutdownNode("event complete")' }
        ],
        solution: R`  uint8_t sent = 0;
  for (uint8_t p = 0; p < budget.photos && !timeUp(); p++) {
    unsigned long shotAt = millis();
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) { LOG("Capture %u failed\n", p); continue; }
    bool ok = sendPhoto(fb, p, budget.eventId);
    if (!ok) ok = sendPhoto(fb, p, budget.eventId);
    esp_camera_fb_return(fb);
    if (ok) sent++;
    if (p + 1 < budget.photos) {
      while (millis() - shotAt < budget.intervalS * 1000UL && !timeUp()) delay(20);
    }
  }

  DoneMsg done = {MSG_DONE, NODE_ID, sent};
  sendAndWait(&done, sizeof(done));
  shutdownNode("event complete");
}

void loop() {
  // never reached
}` },
      { t: 'note', kind: 'tip', title: 'Node finished', html: 'Put the labs together in order (includes → globals and callbacks → helpers → setup) and compare with <a href="#/code">SmartPost_Node.ino in the Firmware tab</a>.' }
    ]}
  ]
});

M.push({
  id: 'caphub', icon: '🏗️', title: 'Capstone B — the hub',
  summary: 'Write SmartPost_Hub.ino: wake, govern, receive, store, upload, sleep.',
  intro: 'Ten labs build the hub. It is longer than the node because it owns the decisions: budget, storage, modem and sleep.',
  lessons: [
    { id: 'ch-1', title: 'Lab 1 · Pins, settings, RTC state', blocks: [
      { t: 'lab', id: 'h1', title: 'Top of SmartPost_Hub.ino',
        task: '<ul><li>Define the modem pins (PWRKEY 4, FLIGHT 25, RX 26, TX 27, DTR 32, STATUS 34), BOARD_LED 12, BAT_ADC_PIN 35, WAKE_PIN 39.</li><li>PWRKEY_ON_LEVEL HIGH and PWRKEY_IDLE_LEVEL LOW (from LILYGO\'s example — to verify).</li><li>FLOOR_SLEEP_MV 3400, FLOOR_LTE_MV 3600, HEARTBEAT_S 43200.</li><li>RTC_DATA_ATTR variables: bootCount, windowStart, eventsInWindow, lastHeartbeat.</li></ul>',
        starter: R`// SmartPost_Hub.ino — LILYGO T-SIM7600E-H · ESP32 Wrover Module · core 3.3.8
#include <WiFi.h>
#include <esp_now.h>
#include <esp_sleep.h>
#include <driver/gpio.h>
#include <driver/rtc_io.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <sys/time.h>
#include "SmartPostProtocol.h"

// pins

// settings

// state that survives deep sleep
`,
        checks: [
          { re: R`#define\s+MODEM_PWRKEY\s+4\b`, msg: 'PWRKEY 4' },
          { re: R`#define\s+MODEM_FLIGHT\s+25\b`, msg: 'FLIGHT 25' },
          { re: R`#define\s+MODEM_RX_PIN\s+26\b`, msg: 'RX 26' },
          { re: R`#define\s+MODEM_TX_PIN\s+27\b`, msg: 'TX 27' },
          { re: R`#define\s+MODEM_DTR\s+32\b`, msg: 'DTR 32' },
          { re: R`#define\s+MODEM_STATUS\s+34\b`, msg: 'STATUS 34' },
          { re: R`#define\s+BAT_ADC_PIN\s+35\b`, msg: 'battery ADC 35' },
          { re: R`#define\s+WAKE_PIN\s+39\b`, msg: 'WAKE 39' },
          { re: R`#define\s+PWRKEY_ON_LEVEL\s+HIGH`, msg: 'PWRKEY_ON_LEVEL HIGH' },
          { re: R`#define\s+FLOOR_SLEEP_MV\s+3400`, msg: 'FLOOR_SLEEP_MV 3400' },
          { re: R`#define\s+FLOOR_LTE_MV\s+3600`, msg: 'FLOOR_LTE_MV 3600' },
          { re: R`RTC_DATA_ATTR\s+uint16_t\s+eventsInWindow`, msg: 'RTC_DATA_ATTR uint16_t eventsInWindow' },
          { re: R`RTC_DATA_ATTR\s+time_t\s+lastHeartbeat`, msg: 'RTC_DATA_ATTR time_t lastHeartbeat' }
        ],
        solution: R`#define MODEM_TX_PIN   27
#define MODEM_RX_PIN   26
#define MODEM_PWRKEY    4
#define MODEM_FLIGHT   25
#define MODEM_DTR      32
#define MODEM_STATUS   34
#define BOARD_LED      12
#define BAT_ADC_PIN    35
#define WAKE_PIN       39
#define TAMPER_PIN     13

#define DEBUG_SERIAL       1
#define USE_TAMPER         0
#define USE_FAST_BAUD      0
#define PWRKEY_ON_LEVEL    HIGH
#define PWRKEY_IDLE_LEVEL  LOW
#define PWRKEY_ON_MS       500
#define PWRKEY_OFF_MS      2600
#define MODEM_BOOT_MS      25000
#define COLD_BOOT_QUIET_S  90
#define HELLO_WAIT_MS      3000
#define SESSION_IDLE_MS    8000
#define SESSION_MAX_MS     200000UL
#define WAKE_LOW_WAIT_MS   5000
#define HEARTBEAT_S        43200
#define MAX_PHOTO_BYTES    120000
#define MAX_STORED_FILES   50
#define BAT_DIVIDER        2.0f
#define BAT_CAL            1.000f
#define FLOOR_SLEEP_MV     3400
#define FLOOR_LTE_MV       3600
#define CAP_EVENTS_FULL    7
#define APN                ""
#define UPLOAD_URL         "http://example.invalid/upload"

RTC_DATA_ATTR uint32_t bootCount = 0;
RTC_DATA_ATTR time_t   windowStart = 0;
RTC_DATA_ATTR uint16_t eventsInWindow = 0;
RTC_DATA_ATTR time_t   lastHeartbeat = 0;
RTC_DATA_ATTR uint32_t droppedPhotos = 0;
RTC_DATA_ATTR bool     tamperPending = false;` }
    ]},
    { id: 'ch-2', title: 'Lab 2 · Receive into a queue', blocks: [
      { t: 'lab', id: 'h2', title: 'RxItem, the queue and onDataRecv',
        task: 'Define <code>struct RxItem { uint8_t mac[6]; uint8_t len; uint8_t data[250]; };</code>, a global <code>QueueHandle_t rxQueue</code>, and an onDataRecv (3.3.8 signature) that rejects len ≤ 0 or > 250, copies MAC, length and bytes into an RxItem, and pushes it with xQueueSend without blocking.',
        starter: R`struct RxItem { uint8_t mac[6]; uint8_t len; uint8_t data[250]; };
QueueHandle_t rxQueue;

void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {

}`,
        checks: [
          { re: R`len\s*<=\s*0\s*\|\|\s*len\s*>\s*250`, msg: 'rejects len ≤ 0 or > 250' },
          { re: R`memcpy\s*\(\s*\w+\.mac\s*,\s*info\s*->\s*src_addr\s*,\s*6\s*\)`, msg: 'copies the sender MAC' },
          { re: R`memcpy\s*\(\s*\w+\.data\s*,\s*data\s*,\s*len\s*\)`, msg: 'copies the bytes' },
          { re: R`xQueueSend\s*\(\s*rxQueue\s*,\s*&\s*\w+\s*,\s*0\s*\)`, msg: 'xQueueSend(rxQueue, &it, 0) — never block in a callback' },
          { re: R`LittleFS|delay\s*\(`, not: true, msg: 'no flash writes or delays in the callback' }
        ],
        solution: R`void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len <= 0 || len > 250) return;
  RxItem it;
  memcpy(it.mac, info->src_addr, 6);
  it.len = (uint8_t)len;
  memcpy(it.data, data, len);
  xQueueSend(rxQueue, &it, 0);
}
// in setup(): rxQueue = xQueueCreate(48, sizeof(RxItem));` }
    ]},
    { id: 'ch-3', title: 'Lab 3 · Battery and governor', blocks: [
      { t: 'lab', id: 'h3', title: 'readBatteryMv() and decideBudget()',
        task: '<ul><li>readBatteryMv(): 11 dB attenuation on BAT_ADC_PIN, average 16 analogReadMilliVolts readings, × BAT_DIVIDER × BAT_CAL.</li><li>decideBudget(nodeId, mv, quietPeriod): refused by default; refuse during the quiet period or below FLOOR_SLEEP_MV; roll the 24 h window; scale CAP_EVENTS_FULL by a crude state of charge (3,400→0, 4,100→1), at least 1; refuse at the cap; otherwise allow with nextEventId and 24/12/6 photos by voltage.</li></ul>',
        starter: R`uint16_t nextEventId = 1;

uint16_t readBatteryMv() {

}

BudgetMsg decideBudget(uint8_t nodeId, uint16_t mv, bool quietPeriod) {

}`,
        checks: [
          { re: R`analogSetPinAttenuation\s*\(\s*BAT_ADC_PIN\s*,\s*ADC_11db\s*\)`, msg: '11 dB attenuation on the battery pin' },
          { re: R`analogReadMilliVolts\s*\(\s*BAT_ADC_PIN\s*\)`, msg: 'analogReadMilliVolts(BAT_ADC_PIN)' },
          { re: R`BAT_DIVIDER\s*\*\s*BAT_CAL|BAT_CAL\s*\*\s*BAT_DIVIDER`, msg: '× BAT_DIVIDER × BAT_CAL' },
          { re: R`quietPeriod\s*\|\|\s*mv\s*<\s*FLOOR_SLEEP_MV`, msg: 'refuses in the quiet period or below the sleep floor' },
          { re: R`rollWindow\s*\(\s*\)`, msg: 'rolls the 24 h window' },
          { re: R`CAP_EVENTS_FULL\s*\*\s*soc`, msg: 'scales the cap with state of charge' },
          { re: R`eventsInWindow\s*>=\s*cap`, msg: 'refuses at the cap' },
          { re: R`\.allowed\s*=\s*1`, msg: 'sets allowed = 1' },
          { re: R`\.eventId\s*=\s*nextEventId`, msg: 'uses nextEventId' }
        ],
        hint: 'rollWindow(): if windowStart is 0 or nowS() − windowStart ≥ 86400, set windowStart = nowS() and eventsInWindow = 0.',
        solution: R`time_t nowS() { struct timeval tv; gettimeofday(&tv, nullptr); return tv.tv_sec; }

void rollWindow() {
  time_t t = nowS();
  if (windowStart == 0 || t - windowStart >= 86400) { windowStart = t; eventsInWindow = 0; }
}

uint16_t readBatteryMv() {
  analogSetPinAttenuation(BAT_ADC_PIN, ADC_11db);
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) { sum += analogReadMilliVolts(BAT_ADC_PIN); delay(2); }
  return (uint16_t)((sum / 16) * BAT_DIVIDER * BAT_CAL);
}

BudgetMsg decideBudget(uint8_t nodeId, uint16_t mv, bool quietPeriod) {
  BudgetMsg b = {MSG_BUDGET, nodeId, 0, 0, 0, 5, FS_SVGA, 12};
  if (quietPeriod || mv < FLOOR_SLEEP_MV) return b;
  rollWindow();
  float soc = (mv - 3400) / (4100.0f - 3400.0f);
  if (soc < 0) soc = 0;
  if (soc > 1) soc = 1;
  int cap = (int)(CAP_EVENTS_FULL * soc + 0.5f);
  if (cap < 1) cap = 1;
  if (eventsInWindow >= cap) return b;
  b.allowed = 1;
  b.eventId = nextEventId;
  b.photos  = mv >= 3900 ? 24 : (mv >= 3750 ? 12 : 6);
  return b;
}` }
    ]},
    { id: 'ch-4', title: 'Lab 4 · Reassemble a photo', blocks: [
      { t: 'p', html: 'The full handleMessage() also answers HELLO (serving one node at a time). This lab is its heart: PHOTO_START, CHUNK and PHOTO_END.' },
      { t: 'lab', id: 'h4', title: 'Chunks into the buffer, then CRC and ACK',
        task: '<ul><li>PHOTO_START: open the photo only if 0 &lt; totalLen ≤ photoBufSize; store index, length, CRC, chunk count; clear the <code>seen</code> bitmap.</li><li>CHUNK: if it belongs to the open photo and fits, memcpy it to chunkIdx × CHUNK_DATA_MAX and set its bit.</li><li>PHOTO_END: ok only if every bit is set, the CRC matches and savePhoto() succeeds; send AckMsg back.</li></ul>',
        starter: R`  if (type == MSG_PHOTO_START && it.len == sizeof(PhotoStartMsg)) {

  }
  else if (type == MSG_CHUNK && it.len > CHUNK_HEADER_LEN && session.photoOpen) {

  }
  else if (type == MSG_PHOTO_END && it.len == sizeof(PhotoEndMsg)) {

  }`,
        checks: [
          { re: R`totalLen\s*<=\s*photoBufSize`, msg: 'refuses photos bigger than the buffer' },
          { re: R`memset\s*\(\s*session\.seen\s*,\s*0`, msg: 'clears the bitmap at PHOTO_START' },
          { re: R`chunkIdx\s*\*\s*CHUNK_DATA_MAX`, msg: 'offset = chunkIdx × CHUNK_DATA_MAX' },
          { re: R`offset\s*\+\s*\w+\s*->\s*len\s*<=\s*session\.totalLen`, msg: 'checks the chunk fits inside the photo' },
          { re: R`bitSet\s*\(\s*session\.seen`, msg: 'marks the chunk in the bitmap' },
          { re: R`bitGet\s*\(\s*session\.seen`, msg: 'checks every chunk arrived' },
          { re: R`crc32Update\s*\(\s*0\s*,\s*photoBuf\s*,\s*session\.totalLen\s*\)\s*==\s*session\.crc`, msg: 'compares the CRC' },
          { re: R`savePhoto\s*\(`, msg: 'saves the photo' },
          { re: R`AckMsg\s+\w+\s*=\s*\{\s*MSG_ACK`, msg: 'builds an AckMsg' },
          { re: R`sendTo\s*\(\s*it\.mac\s*,\s*&\s*\w+\s*,\s*sizeof`, msg: 'sends the ACK back to the node' }
        ],
        solution: R`  if (type == MSG_PHOTO_START && it.len == sizeof(PhotoStartMsg)) {
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
      bitSet(session.seen, c->chunkIdx);
    }
  }
  else if (type == MSG_PHOTO_END && it.len == sizeof(PhotoEndMsg)) {
    const PhotoEndMsg *e = (const PhotoEndMsg *)it.data;
    bool ok = session.photoOpen && e->photoIdx == session.photoIdx;
    for (uint16_t i = 0; ok && i < session.chunkCount; i++) ok = bitGet(session.seen, i);
    if (ok) ok = crc32Update(0, photoBuf, session.totalLen) == session.crc;
    if (ok) ok = savePhoto(session.nodeId, session.eventId, e->photoIdx, photoBuf, session.totalLen);
    if (ok) session.photosStored++;
    AckMsg a = {MSG_ACK, session.nodeId, e->photoIdx, (uint8_t)(ok ? 1 : 0)};
    sendTo(it.mac, &a, sizeof(a));
    session.photoOpen = false;
  }` }
    ]},
    { id: 'ch-5', title: 'Lab 5 · Store to flash', blocks: [
      { t: 'lab', id: 'h5', title: 'savePhoto() with a cap',
        task: 'While countStored(&amp;oldest) ≥ MAX_STORED_FILES: remove the oldest file and count it as dropped. Build the path <code>/p/%05u_%u_%02u.jpg</code> with snprintf and sizeof, open it for writing, write, close, and return whether every byte was written.',
        starter: R`bool savePhoto(uint8_t node, uint16_t ev, uint8_t idx, const uint8_t *buf, size_t len) {

}`,
        checks: [
          { re: R`while\s*\(\s*countStored\s*\(\s*&\s*\w+\s*\)\s*>=\s*MAX_STORED_FILES\s*\)`, msg: 'enforces the cap' },
          { re: R`LittleFS\.remove\s*\(`, msg: 'removes the oldest file' },
          { re: R`droppedPhotos\s*\+\+`, msg: 'counts dropped photos (for the heartbeat)' },
          { re: R`snprintf\s*\(\s*\w+\s*,\s*sizeof\s*\(\s*\w+\s*\)\s*,\s*"/p/%05u_%u_%02u\.jpg"`, msg: 'snprintf with sizeof and the zero-padded name' },
          { re: R`LittleFS\.open\s*\(\s*\w+\s*,\s*"w"\s*\)`, msg: 'opens for writing' },
          { re: R`\.close\s*\(\s*\)`, msg: 'closes the file' },
          { re: R`return\s+\w+\s*==\s*len`, msg: 'returns written == len' }
        ],
        solution: R`int countStored(String *oldest) {
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
  while (countStored(&oldest) >= MAX_STORED_FILES) {
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
}` }
    ]},
    { id: 'ch-6', title: 'Lab 6 · Talking AT', blocks: [
      { t: 'lab', id: 'h6', title: 'waitFor() and at()',
        task: '<ul><li><code>bool waitFor(const char *expect, uint32_t timeoutMs)</code>: collect bytes from SerialAT into the String atBuf until it contains expect (true), contains "ERROR" (false), or the timeout passes (false). Trim atBuf if it grows past 1024 chars.</li><li><code>bool at(const char *cmd, const char *expect, uint32_t timeoutMs)</code>: drain old bytes, send "AT" + cmd + "\\r\\n", return waitFor().</li><li>An overload <code>bool at(const char *cmd)</code> that calls the long one with "OK" and 1000 ms (no default arguments — see the Functions lesson).</li></ul>',
        starter: R`HardwareSerial SerialAT(1);
String atBuf;

bool waitFor(const char *expect, uint32_t timeoutMs) {

}

bool at(const char *cmd, const char *expect, uint32_t timeoutMs) {

}

bool at(const char *cmd) {

}`,
        checks: [
          { re: R`millis\s*\(\s*\)\s*-\s*\w+\s*<\s*timeoutMs`, msg: 'waitFor is bounded by timeoutMs' },
          { re: R`SerialAT\.available\s*\(\s*\)`, msg: 'reads while bytes are available' },
          { re: R`atBuf\.indexOf\s*\(\s*expect\s*\)\s*>=\s*0`, msg: 'succeeds when expect appears' },
          { re: R`atBuf\.indexOf\s*\(\s*"ERROR"\s*\)\s*>=\s*0`, msg: 'fails fast on ERROR' },
          { re: R`atBuf\.length\s*\(\s*\)\s*>\s*1024`, msg: 'keeps atBuf from growing forever' },
          { re: R`SerialAT\.print\s*\(\s*"AT"\s*\)`, msg: 'sends "AT"' },
          { re: R`SerialAT\.print\s*\(\s*"\\r\\n"\s*\)`, msg: 'ends with "\\r\\n"' },
          { re: R`return\s+waitFor\s*\(|=\s*waitFor\s*\(`, msg: 'at() uses waitFor()' },
          { re: R`=\s*"OK"`, not: true, msg: 'no default arguments (Arduino prototypes would clash)' },
          { re: R`bool\s+at\s*\(\s*const\s+char\s*\*\s*\w+\s*\)\s*\{[^}]*at\s*\(\s*\w+\s*,\s*"OK"\s*,\s*1000\s*\)`, msg: 'short overload at(cmd) calls at(cmd, "OK", 1000)' }
        ],
        solution: R`bool waitFor(const char *expect, uint32_t timeoutMs) {
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

bool at(const char *cmd, const char *expect, uint32_t timeoutMs) {
  while (SerialAT.available()) SerialAT.read();
  SerialAT.print("AT");
  SerialAT.print(cmd);
  SerialAT.print("\r\n");
  bool ok = waitFor(expect, timeoutMs);
  LOG("AT%s -> %s\n", cmd, ok ? "ok" : "FAIL");
  return ok;
}

bool at(const char *cmd) { return at(cmd, "OK", 1000); }` }
    ]},
    { id: 'ch-7', title: 'Lab 7 · Modem on and off', blocks: [
      { t: 'lab', id: 'h7', title: 'modemPowerOn() and modemPowerOff()',
        task: '<ul><li>pwrkeyPulse(ms): ON level, delay, back to IDLE level.</li><li>modemPowerOn(): DTR LOW, FLIGHT HIGH, open SerialAT (RX 26, TX 27); if it already answers AT return true; else pulse PWRKEY_ON_MS and poll AT for up to MODEM_BOOT_MS.</li><li>modemPowerOff(): try AT+CPOF (9 s); if that fails, pulse PWRKEY_OFF_MS; wait up to 20 s until AT stops answering; FLIGHT LOW; SerialAT.end().</li></ul>',
        starter: R`bool modemResponds() {
  for (int i = 0; i < 3; i++) if (at("", "OK", 400)) return true;
  return false;
}

void pwrkeyPulse(uint32_t ms) {
}

bool modemPowerOn() {
}

void modemPowerOff() {
}`,
        checks: [
          { re: R`digitalWrite\s*\(\s*MODEM_PWRKEY\s*,\s*PWRKEY_ON_LEVEL\s*\)[\s\S]*delay\s*\(\s*ms\s*\)[\s\S]*digitalWrite\s*\(\s*MODEM_PWRKEY\s*,\s*PWRKEY_IDLE_LEVEL\s*\)`, msg: 'pulse: ON level → delay → IDLE level' },
          { re: R`digitalWrite\s*\(\s*MODEM_FLIGHT\s*,\s*HIGH\s*\)`, msg: 'FLIGHT HIGH before starting' },
          { re: R`SerialAT\.begin\s*\(\s*115200\s*,\s*SERIAL_8N1\s*,\s*MODEM_RX_PIN\s*,\s*MODEM_TX_PIN\s*\)`, msg: 'SerialAT.begin(115200, SERIAL_8N1, RX, TX)' },
          { re: R`pwrkeyPulse\s*\(\s*PWRKEY_ON_MS\s*\)`, msg: 'start pulse PWRKEY_ON_MS' },
          { re: R`millis\s*\(\s*\)\s*-\s*\w+\s*<\s*MODEM_BOOT_MS`, msg: 'bounded wait for the modem to boot' },
          { re: R`at\s*\(\s*"\+CPOF"`, msg: 'tries AT+CPOF' },
          { re: R`pwrkeyPulse\s*\(\s*PWRKEY_OFF_MS\s*\)`, msg: 'falls back to a long PWRKEY pulse' },
          { re: R`digitalWrite\s*\(\s*MODEM_FLIGHT\s*,\s*LOW\s*\)`, msg: 'FLIGHT LOW when off' },
          { re: R`IPREX`, not: true, msg: 'never AT+IPREX' }
        ],
        solution: R`void pwrkeyPulse(uint32_t ms) {
  digitalWrite(MODEM_PWRKEY, PWRKEY_ON_LEVEL);
  delay(ms);
  digitalWrite(MODEM_PWRKEY, PWRKEY_IDLE_LEVEL);
}

bool modemPowerOn() {
  digitalWrite(MODEM_DTR, LOW);
  digitalWrite(MODEM_FLIGHT, HIGH);
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  if (modemResponds()) return true;
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
  if (!at("+CPOF", "OK", 9000)) pwrkeyPulse(PWRKEY_OFF_MS);
  unsigned long t0 = millis();
  while (millis() - t0 < 20000 && modemResponds()) delay(1000);
  digitalWrite(MODEM_FLIGHT, LOW);
  LOG("Modem off, STATUS=%d\n", digitalRead(MODEM_STATUS));
  SerialAT.end();
}` }
    ]},
    { id: 'ch-8', title: 'Lab 8 · HTTP upload', blocks: [
      { t: 'lab', id: 'h8', title: 'httpBegin(), httpFinish(), uploadFile()',
        task: '<ul><li>httpBegin(url, type, len): HTTPTERM (cleanup), HTTPINIT, HTTPPARA URL, HTTPPARA CONTENT, HTTPDATA=len,30 waiting for "DOWNLOAD".</li><li>httpFinish(): wait for OK, HTTPACTION=1 waiting for "+HTTPACTION:", read the line, parse the status with sscanf, HTTPTERM, return the status.</li><li>uploadFile(path, mv): stream the file in 512-byte blocks after httpBegin; delete it <b>only</b> on a 2xx status.</li></ul>',
        starter: R`bool httpBegin(const char *url, const char *contentType, size_t len) {
}

int httpFinish() {
}

bool uploadFile(const String &path, uint16_t mv) {
}`,
        checks: [
          { re: R`"\+HTTPINIT"`, msg: 'AT+HTTPINIT' },
          { re: R`\+HTTPPARA=\\"URL\\"`, msg: 'AT+HTTPPARA="URL",…' },
          { re: R`\+HTTPPARA=\\"CONTENT\\"`, msg: 'AT+HTTPPARA="CONTENT",…' },
          { re: R`\+HTTPDATA=%u,30`, msg: 'AT+HTTPDATA=<len>,30' },
          { re: R`"DOWNLOAD"`, msg: 'waits for DOWNLOAD' },
          { re: R`"\+HTTPACTION=1"`, msg: 'AT+HTTPACTION=1 (POST)' },
          { re: R`sscanf\s*\([^;]*\+HTTPACTION: %d,%d,%d`, msg: 'parses +HTTPACTION: method,status,len' },
          { re: R`"\+HTTPTERM"`, msg: 'AT+HTTPTERM' },
          { re: R`SerialAT\.write\s*\(\s*\w+\s*,\s*\w+\s*\)`, msg: 'streams the file bytes to the modem' },
          { re: R`status\s*>=\s*200\s*&&\s*status\s*<\s*300`, msg: 'success = 2xx' },
          { re: R`if\s*\(\s*ok\s*\)\s*LittleFS\.remove`, msg: 'deletes the file only after success' }
        ],
        solution: R`bool httpBegin(const char *url, const char *contentType, size_t len) {
  at("+HTTPTERM", "OK", 2000);
  if (!at("+HTTPINIT", "OK", 10000)) return false;
  char cmd[200];
  snprintf(cmd, sizeof(cmd), "+HTTPPARA=\"URL\",\"%s\"", url);
  if (!at(cmd)) return false;
  snprintf(cmd, sizeof(cmd), "+HTTPPARA=\"CONTENT\",\"%s\"", contentType);
  if (!at(cmd)) return false;
  snprintf(cmd, sizeof(cmd), "+HTTPDATA=%u,30", (unsigned)len);
  return at(cmd, "DOWNLOAD", 5000);
}

int httpFinish() {
  if (!waitFor("OK", 30000)) return -1;
  if (!at("+HTTPACTION=1", "+HTTPACTION:", 90000)) return -1;
  waitFor("\r\n", 2000);
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
  }
  f.close();
  if (ok) LittleFS.remove(path);
  return ok;
}` }
    ]},
    { id: 'ch-9', title: 'Lab 9 · Going to sleep', blocks: [
      { t: 'lab', id: 'h9', title: 'void goToSleep()',
        task: '<ul><li>Radio off.</li><li>Wait up to WAKE_LOW_WAIT_MS for WAKE to go LOW (the level trap).</li><li>Set PWRKEY idle, FLIGHT LOW, DTR LOW; gpio_hold_en each; gpio_deep_sleep_hold_en().</li><li>LED LOW and rtc_gpio_isolate(GPIO_NUM_12).</li><li>Arm EXT1 (any HIGH) only if WAKE is low; always arm a timer for the next heartbeat (at least 60 s).</li><li>esp_deep_sleep_start().</li></ul>',
        starter: R`void goToSleep() {   // never returns

}`,
        checks: [
          { re: R`WiFi\.mode\s*\(\s*WIFI_OFF\s*\)`, msg: 'radio off' },
          { re: R`WAKE_LOW_WAIT_MS`, msg: 'bounded wait for WAKE LOW' },
          { re: R`gpio_hold_en\s*\(`, msg: 'holds the modem pins' },
          { re: R`gpio_deep_sleep_hold_en\s*\(\s*\)`, msg: 'gpio_deep_sleep_hold_en()' },
          { re: R`rtc_gpio_isolate\s*\(\s*GPIO_NUM_12\s*\)`, msg: 'isolates GPIO12' },
          { re: R`1ULL\s*<<\s*WAKE_PIN`, msg: 'mask 1ULL << WAKE_PIN' },
          { re: R`esp_sleep_enable_ext1_wakeup_io\s*\(\s*\w+\s*,\s*ESP_EXT1_WAKEUP_ANY_HIGH\s*\)`, msg: 'EXT1, any HIGH' },
          { re: R`esp_sleep_enable_timer_wakeup\s*\([^;]*1000000ULL`, msg: 'timer wake in microseconds (…1000000ULL)' },
          { re: R`if\s*\(\s*!\s*lineHigh\s*\)\s*esp_sleep_enable_ext1_wakeup_io|if\s*\(\s*digitalRead\s*\(\s*WAKE_PIN\s*\)\s*==\s*LOW\s*\)\s*esp_sleep_enable_ext1_wakeup_io`, msg: 'arms EXT1 only when WAKE is low' },
          { re: R`esp_deep_sleep_start\s*\(\s*\)`, msg: 'esp_deep_sleep_start()' }
        ],
        solution: R`const gpio_num_t heldPins[] = {(gpio_num_t)MODEM_PWRKEY, (gpio_num_t)MODEM_FLIGHT,
                               (gpio_num_t)MODEM_DTR};

void goToSleep() {   // never returns
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);

  uint64_t mask = 1ULL << WAKE_PIN;
  unsigned long t0 = millis();
  bool lineHigh = true;
  while (millis() - t0 < WAKE_LOW_WAIT_MS) {
    lineHigh = digitalRead(WAKE_PIN) == HIGH;
    if (!lineHigh) break;
    delay(50);
  }

  digitalWrite(MODEM_PWRKEY, PWRKEY_IDLE_LEVEL);
  digitalWrite(MODEM_FLIGHT, LOW);
  digitalWrite(MODEM_DTR, LOW);
  for (gpio_num_t p : heldPins) gpio_hold_en(p);
  gpio_deep_sleep_hold_en();

  digitalWrite(BOARD_LED, LOW);
  rtc_gpio_isolate(GPIO_NUM_12);

  if (!lineHigh) esp_sleep_enable_ext1_wakeup_io(mask, ESP_EXT1_WAKEUP_ANY_HIGH);
  long untilHb = HEARTBEAT_S - (long)(nowS() - lastHeartbeat);
  if (lineHigh || untilHb < 60) untilHb = 60;
  esp_sleep_enable_timer_wakeup((uint64_t)untilHb * 1000000ULL);
  esp_deep_sleep_start();
}` }
    ]},
    { id: 'ch-10', title: 'Lab 10 · setup(), the conductor', blocks: [
      { t: 'lab', id: 'h10', title: 'The hub\'s setup()',
        task: 'Release the holds and set up pins; count the boot; read the wake cause (cold boot = neither EXT1 nor TIMER); open Preferences and LittleFS; read the battery; on a cold boot make sure the modem is off; below the sleep floor go straight to sleep; allocate the photo buffer; create the queue; start ESP-NOW and run the receive loop (90 s quiet on a cold boot, otherwise only if EXT1 woke you or WAKE is high); radio off; run a modem session if the battery is ≥ FLOOR_LTE_MV and there is something to send; goToSleep().',
        starter: R`void setup() {

}

void loop() {}`,
        checks: [
          { re: R`releaseHolds\s*\(\s*\)`, msg: 'releases the held pins first' },
          { re: R`esp_sleep_get_wakeup_cause\s*\(\s*\)`, msg: 'reads the wake cause' },
          { re: R`ESP_SLEEP_WAKEUP_EXT1[\s\S]*ESP_SLEEP_WAKEUP_TIMER|ESP_SLEEP_WAKEUP_TIMER[\s\S]*ESP_SLEEP_WAKEUP_EXT1`, msg: 'tells cold boots from EXT1/TIMER wakes' },
          { re: R`LittleFS\.begin\s*\(\s*true\s*\)`, msg: 'mounts LittleFS (format on first run)' },
          { re: R`ensureModemOffAtBoot\s*\(\s*\)`, msg: 'cold boot: modem off' },
          { re: R`if\s*\(\s*mv\s*<\s*FLOOR_SLEEP_MV\s*\)\s*goToSleep`, msg: 'sleep-only floor' },
          { re: R`xQueueCreate\s*\(`, msg: 'creates the queue before ESP-NOW starts' },
          { re: R`WiFi\.setChannel\s*\(\s*ESPNOW_CHANNEL\s*\)`, msg: 'WiFi.setChannel(ESPNOW_CHANNEL)' },
          { re: R`COLD_BOOT_QUIET_S`, msg: 'quiet period on a cold boot' },
          { re: R`WiFi\.mode\s*\(\s*WIFI_OFF\s*\)[\s\S]*modemSession`, msg: 'radio off before the modem session' },
          { re: R`>=\s*FLOOR_LTE_MV`, msg: 'modem only at or above FLOOR_LTE_MV' },
          { re: R`goToSleep\s*\(\s*\)\s*;\s*\}\s*void\s+loop`, msg: 'setup() ends with goToSleep()' }
        ],
        solution: R`void setup() {
  releaseHolds();
  pinMode(MODEM_PWRKEY, OUTPUT);
  digitalWrite(MODEM_PWRKEY, PWRKEY_IDLE_LEVEL);
  pinMode(MODEM_FLIGHT, OUTPUT);
  pinMode(MODEM_DTR, OUTPUT);
  pinMode(MODEM_STATUS, INPUT);
  pinMode(BOARD_LED, OUTPUT);
  digitalWrite(BOARD_LED, LOW);
  pinMode(WAKE_PIN, INPUT);

#if DEBUG_SERIAL
  Serial.begin(115200);
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 2000) delay(10);
#endif

  bootCount++;
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  bool coldBoot = (cause != ESP_SLEEP_WAKEUP_EXT1 && cause != ESP_SLEEP_WAKEUP_TIMER);

  prefs.begin("hub", false);
  nextEventId = prefs.getUShort("ev", 1);
  if (!LittleFS.begin(true)) LOG("LittleFS failed\n");
  LittleFS.mkdir("/p");

  uint16_t mv = readBatteryMv();
  if (coldBoot) {
    ensureModemOffAtBoot();
    lastHeartbeat = 0;
  }
  if (mv < FLOOR_SLEEP_MV) goToSleep();

  photoBufSize = MAX_PHOTO_BYTES;
  photoBuf = psramFound() ? (uint8_t *)ps_malloc(photoBufSize) : nullptr;
  if (!photoBuf) { photoBufSize = 60000; photoBuf = (uint8_t *)malloc(photoBufSize); }

  rxQueue = xQueueCreate(48, sizeof(RxItem));
  WiFi.mode(WIFI_STA);
  WiFi.setChannel(ESPNOW_CHANNEL);
  if (esp_now_init() == ESP_OK) {
    esp_now_register_recv_cb(onDataRecv);
    if (coldBoot) {
      runReceive(mv, true, COLD_BOOT_QUIET_S * 1000UL);
    } else if (cause == ESP_SLEEP_WAKEUP_EXT1 || digitalRead(WAKE_PIN) == HIGH) {
      runReceive(mv, false, HELLO_WAIT_MS);
    }
  }
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);

  bool heartbeatDue = (nowS() - lastHeartbeat) >= HEARTBEAT_S || lastHeartbeat == 0;
  bool photosWaiting = countStored(nullptr) > 0;
  uint16_t mvNow = readBatteryMv();
  if (mvNow >= FLOOR_LTE_MV && (photosWaiting || heartbeatDue || tamperPending)) {
    modemSession(mvNow, heartbeatDue);
  }
  goToSleep();
}

void loop() {}` },
      { t: 'note', kind: 'tip', title: 'Hub finished', html: 'The pieces you didn\'t write in a lab — runReceive(), the HELLO branch of handleMessage(), ensureModemOffAtBoot(), waitRegistered(), sendHeartbeat() and modemSession() — are in <a href="#/code">SmartPost_Hub.ino</a>. Read them now: you know every construct they use.' }
    ]}
  ]
});

M.push({
  id: 'live', icon: '🚦', title: 'Bring it to life',
  summary: 'Compile, bench-test in the right order, and the decisions still yours.',
  lessons: [
    { id: 'live-1', title: 'Assemble and compile', blocks: [
      { t: 'order', q: 'Order the steps to compile the node.', items: ['Create a folder SmartPost_Node with SmartPost_Node.ino inside', 'Copy SmartPostProtocol.h into the same folder', 'Tools → Board: XIAO_ESP32S3, PSRAM: OPI PSRAM', 'Set NODE_ID for this board', 'Verify (compile) before uploading'] },
      { t: 'p', html: 'Both sketches were compile-checked against core 3.3.8 when this app was built. If your IDE disagrees about a function signature, the compiler wins — note it so the project files can be corrected at the next wrap-up.' },
      { t: 'mcq', q: 'Each XIAO needs a different program change. Which?', opts: ['HUB_MAC', 'NODE_ID (1–4)', 'ESPNOW_CHANNEL'], a: 1 }
    ]},
    { id: 'live-2', title: 'Bench-test in the project\'s order', blocks: [
      { t: 'p', html: 'The firmware is untested (📐). Each part is proven by a step in PROJECT-STATE §10, and items 1–4 come first because they need only a multimeter:' },
      { t: 'table', head: ['Next step', 'What it proves for the firmware'], rows: [
        ['1–4', 'protection layout, board identity (is GPIO39 on a header?), blue LED and modem state, H pin'],
        ['5', 'XIAO deep-sleep current and PIR wake (SK-04)'],
        ['7', 'hub sleep current; <b>calibrate BAT_CAL</b>'],
        ['11', 'load switch, diode-OR, HOLD, boot-to-HOLD time, off-switch'],
        ['12', 'camera capture and ESP-NOW image transfer over ~1.5 m in the post (K-10)'],
        ['13', 'hub firmware: EXT1 wake, modem control, held pins, flash, governor, heartbeat'],
        ['14', 'SIM and LTE upload: PWRKEY polarity, timings, 921600 baud, floors']] },
      { t: 'note', kind: 'warn', title: 'WARNING — before you wire the node firmware to real power', html: 'Never plug USB into a XIAO that is wired to the riser (S-07): the load switch does not block reverse current. Test the node sketch on USB alone first, with nothing on the riser.' },
      { t: 'mcq', q: 'You have a finished node sketch. What is the first hardware test for it?', opts: ['Install it in the post', 'Run it on USB on the bench with the hub nearby, watch the serial log', 'Connect it to the riser and the battery'], a: 1 }
    ]},
    { id: 'live-3', title: 'Decisions still yours', blocks: [
      { t: 'table', head: ['Setting in the code', 'Waits on'], rows: [
        ['<code>UPLOAD_URL</code>', 'where photos go — not decided yet'],
        ['<code>APN</code>', 'Q11: which SIM and network'],
        ['<code>WAKE_PIN 39</code>', 'Q2: GPIO39 on a header? (else 13 or 14)'],
        ['<code>PWRKEY_ON_LEVEL</code>', 'bench check: does the modem answer AT after the pulse?'],
        ['<code>BAT_DIVIDER</code>, <code>BAT_CAL</code>', 'I-07 calibration'],
        ['<code>CAP_EVENTS_FULL</code>', 'H-02: harvest of the six strips'],
        ['<code>USE_TAMPER</code>', 'L-2 and Q14'],
        ['modem during capture', 'Q15 fast first photo vs requirement 3'],
        ['night captures', 'undecided (§5)']] },
      { t: 'multi', q: 'Which of these must be settled before the post goes to the vineyard?', opts: ['UPLOAD_URL', 'APN', 'BAT_CAL', 'The colour of the code editor'], a: [0, 1, 2] },
      { t: 'note', kind: 'tip', title: 'You made it', html: 'You can now read and write every line of both programs. Next in the project itself: next-steps item 1 — the protection layout check with your multimeter.' }
    ]}
  ]
});
})();
