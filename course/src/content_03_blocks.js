(function () {
const R = String.raw;
const M = window.COURSE.modules;

/* ===================== PART 4 — BUILDING BLOCKS ===================== */
M.push({
  id: 'store', part: 'Part 4 · The building blocks', icon: '💾', title: 'Saving data',
  summary: 'RTC memory, NVS with Preferences, LittleFS files, PSRAM buffers.',
  lessons: [
    { id: 'store-1', title: 'RTC memory and NVS', blocks: [
      { t: 'code', code: R`RTC_DATA_ATTR uint16_t eventsInWindow = 0;  // survives deep sleep, not power loss

#include <Preferences.h>
Preferences prefs;
prefs.begin("hub", false);                    // namespace "hub", read-write
uint16_t ev = prefs.getUShort("ev", 1);       // default 1 if never saved
prefs.putUShort("ev", ev + 1);                // written to flash
prefs.end();` },
      { t: 'p', html: 'Flash wears out after many writes, and writing costs time and energy, so save to NVS only what must survive a power loss — here, once per event. The SK-04 test sketch already used Preferences for its counters.' },
      { t: 'mcq', q: 'The event ID names the photo files. Why is it in NVS rather than RTC memory?', opts: ['After a battery swap, RTC memory restarts at 1 and new photos would overwrite or collide with unsent ones', 'NVS is faster', 'RTC memory is too small for a uint16_t'], a: 0 },
      { t: 'fill', q: 'Load the saved event ID (default 1).', code: R`prefs.begin({{"hub"}}, false);
nextEventId = prefs.{{getUShort}}("ev", 1);`, why: '' }
    ]},
    { id: 'store-2', title: 'Files with LittleFS', blocks: [
      { t: 'code', code: R`#include <LittleFS.h>
LittleFS.begin(true);              // true = format if mounting fails (first run)
LittleFS.mkdir("/p");

File f = LittleFS.open("/p/00042_2_07.jpg", "w");
size_t written = f.write(buf, len);
f.close();
bool ok = (written == len);        // always check

File dir = LittleFS.open("/p");
for (File g = dir.openNextFile(); g; g = dir.openNextFile()) {
  Serial.println(g.name());        // name without the folder
}
LittleFS.remove("/p/00042_2_07.jpg");` },
      { t: 'p', html: 'The hub\'s rules (§5): a photo stays in flash <b>until an upload succeeds</b>, and there is a <b>cap</b> on stored photos. When the cap is reached the reference firmware deletes the oldest to keep the newest — a choice you can change (a thief\'s latest photos usually matter most).' },
      { t: 'order', q: 'Order the hub\'s handling of one photo.', items: ['Receive all chunks into the buffer', 'Check every chunk arrived and the CRC matches', 'If the cap is reached, delete the oldest file', 'Write the file and check the byte count', 'Send ACK to the node', 'Later: upload, and delete the file only after HTTP 2xx'] }
    ]},
    { id: 'store-3', title: 'Big buffers in PSRAM', blocks: [
      { t: 'p', html: 'A photo is tens of KB. The hub keeps one in RAM while its chunks arrive. WROVER modules have 8 MB PSRAM [DS, L3]; <code>ps_malloc()</code> allocates there. If PSRAM is missing, fall back to a smaller buffer in internal RAM.' },
      { t: 'code', code: R`photoBufSize = MAX_PHOTO_BYTES;                       // 120,000
photoBuf = psramFound() ? (uint8_t *)ps_malloc(photoBufSize) : nullptr;
if (!photoBuf) { photoBufSize = 60000; photoBuf = (uint8_t *)malloc(photoBufSize); }` },
      { t: 'mcq', q: 'Why can\'t the hub keep photos in PSRAM through deep sleep instead of writing them to flash?', opts: ['PSRAM is lost in deep sleep [DS]', 'PSRAM is read-only', 'LittleFS is faster'], a: 0 }
    ]}
  ]
});

M.push({
  id: 'espnow', icon: '📡', title: 'ESP-NOW, the radio link',
  summary: 'Channels, peers, sending, delivery status and receiving safely.',
  lessons: [
    { id: 'espnow-1', title: 'What ESP-NOW is', blocks: [
      { t: 'p', html: 'ESP-NOW sends small frames from one ESP32\'s Wi-Fi radio straight to another\'s <b>MAC address</b> — no router, no IP, no connection. Both radios must be on the <b>same Wi-Fi channel</b>.' },
      { t: 'table', head: ['Fact', 'Value', 'Label'], rows: [
        ['Max payload, v1.0', '250 bytes', '[DS, EN]'],
        ['Max payload, v2.0', '1,470 bytes', '[DS, EN]'],
        ['Max peers', '20 (encrypted: 7 by default, up to 17)', '[DS, EN]'],
        ['Default rate', '1 Mbps', '[DS, REFERENCE §7]']] },
      { t: 'p', html: 'Our protocol keeps every message ≤ 250 bytes, so it works with either version.' },
      { t: 'note', kind: 'tip', title: 'Lesson 14', html: '<code>WiFi.setChannel(1)</code> <b>sets</b> the channel. <code>WiFi.channel()</code> only <b>reads</b> it. Use the same channel constant on both boards (ESPNOW_CHANNEL in the protocol header).' },
      { t: 'mcq', q: 'The hub is on channel 1 and a node on channel 6. What happens?', opts: ['Frames still arrive', 'Nothing arrives — the radios listen on different frequencies', 'ESP-NOW switches channels automatically'], a: 1 }
    ]},
    { id: 'espnow-2', title: 'Starting the link', blocks: [
      { t: 'code', code: R`WiFi.mode(WIFI_STA);               // Wi-Fi must be started first
WiFi.setChannel(ESPNOW_CHANNEL);    // same channel on both boards
if (esp_now_init() != ESP_OK) shutdownNode("esp_now_init failed");
esp_now_register_send_cb(onDataSent);
esp_now_register_recv_cb(onDataRecv);

esp_now_peer_info_t peer = {};      // = {} zeroes every field
memcpy(peer.peer_addr, HUB_MAC, 6);
peer.channel = ESPNOW_CHANNEL;
peer.encrypt = false;
esp_now_add_peer(&peer);` },
      { t: 'order', q: 'Put the ESP-NOW start-up in order.', items: ['WiFi.mode(WIFI_STA)', 'WiFi.setChannel(ESPNOW_CHANNEL)', 'esp_now_init()', 'Register the callbacks', 'Fill esp_now_peer_info_t and esp_now_add_peer()'] },
      { t: 'p', html: 'Your 19 Apr test found that <code>WiFi.macAddress()</code> right after <code>WiFi.mode()</code> returned zeros, while <code>esp_wifi_get_mac()</code> returned the real address (M-10). Use the latter if you ever print your own MAC.' }
    ]},
    { id: 'espnow-3', title: 'Sending and what "success" means', blocks: [
      { t: 'p', html: '<code>esp_now_send()</code> only <b>queues</b> the frame and returns at once. Later, the send callback reports <code>ESP_NOW_SEND_SUCCESS</code> if the frame was received on the MAC layer [DS, EN] — the other radio acknowledged it.' },
      { t: 'note', kind: 'warn', title: 'Not the same as "the hub processed it"', html: 'Espressif: success does not guarantee the application layer received the data; they suggest application-level acks, retransmission and sequence numbers [DS, EN]. That is exactly why our protocol has chunk numbers, a CRC and an ACK message.' },
      { t: 'mcq', q: 'The send callback reports SUCCESS for a chunk. Can the node assume the photo is safe on the hub?', opts: ['Yes', 'No — the hub\'s queue could overflow or the flash write could fail; only the hub\'s ACK confirms it', 'Only with encryption'], a: 1 },
      { t: 'p', html: 'A sender should wait for each callback before the next send. Sending faster than the radio can deliver fills the queue; <code>esp_now_send</code> then returns an error instead of ESP_OK, and <code>sendAndWait()</code> pauses 5 ms and retries.' }
    ]},
    { id: 'espnow-4', title: 'Receiving safely', blocks: [
      { t: 'p', html: 'Anyone on the channel can send you bytes. A receive callback should check <b>who</b> sent them and <b>how many</b> arrived before treating them as a struct.' },
      { t: 'code', code: R`void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (len < 1 || memcmp(info->src_addr, HUB_MAC, 6) != 0) return;  // only our hub
  if (data[0] == MSG_BUDGET && len == (int)sizeof(BudgetMsg)) {
    memcpy(&budget, data, sizeof(BudgetMsg));
    if (budget.nodeId == NODE_ID) budgetReceived = true;
  }
}` },
      { t: 'bug', q: 'Which line could read beyond the received bytes?', code: R`void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  if (memcmp(info->src_addr, HUB_MAC, 6) != 0) return;
  const AckMsg *a = (const AckMsg *)data;
  if (data[0] == MSG_ACK && a->nodeId == NODE_ID) {
    ackOk = a->ok;
    ackReceived = true;
  }
}`, a: 3, why: 'It never checks len == sizeof(AckMsg). A 1-byte frame with type MSG_ACK would make a->nodeId and a->ok read memory that wasn\'t received.' }
    ]}
  ]
});

M.push({
  id: 'proto', icon: '🧩', title: 'Designing the photo protocol',
  summary: 'The handshake, chunking, CRC, ACKs and giving up gracefully.',
  lessons: [
    { id: 'proto-1', title: 'The conversation', blocks: [
      { t: 'p', html: 'A <b>protocol</b> is the agreed order and format of messages. Ours lives in <code>SmartPostProtocol.h</code>, one identical copy in each sketch folder.' },
      { t: 'table', head: ['Message', 'Direction', 'Meaning'], rows: [
        ['HELLO', 'node → hub', 'I woke up; may I capture?'],
        ['BUDGET', 'hub → node', 'yes/no, event ID, photos, interval, size, quality'],
        ['PHOTO_START', 'node → hub', 'length, CRC and chunk count of the next photo'],
        ['CHUNK', 'node → hub', 'up to 200 bytes of the photo'],
        ['PHOTO_END', 'node → hub', 'that was the last chunk'],
        ['ACK', 'hub → node', 'stored (1) or resend (0)'],
        ['DONE', 'node → hub', 'event finished, switching off']] },
      { t: 'order', q: 'Order one event with one photo.', items: ['Node raises WAKE', 'Node sends HELLO', 'Hub sends BUDGET', 'Node sends PHOTO_START', 'Node sends the CHUNKs', 'Node sends PHOTO_END', 'Hub sends ACK', 'Node sends DONE and drops WAKE'] }
    ]},
    { id: 'proto-2', title: 'Chunking a photo', blocks: [
      { t: 'p', html: 'A 25 KB JPEG is far bigger than one 250-byte frame, so the node cuts it into numbered <b>chunks</b>. The number of chunks rounds <b>up</b>:' },
      { t: 'code', code: R`chunkCount = (len + CHUNK_DATA_MAX - 1) / CHUNK_DATA_MAX;   // integer division, rounded up

for (uint16_t i = 0; i < chunkCount; i++) {
  size_t offset = (size_t)i * CHUNK_DATA_MAX;
  size_t n = len - offset;
  if (n > CHUNK_DATA_MAX) n = CHUNK_DATA_MAX;               // the last chunk is shorter
  ...
}` },
      { t: 'num', q: 'A JPEG is 25,601 bytes. With 200 data bytes per chunk, how many chunks?', a: 129, tol: 0, why: '25,601 / 200 = 128.005 → 129. The last chunk carries 1 byte.' },
      { t: 'widget', name: 'chunks' },
      { t: 'p', html: 'The hub places each chunk at <code>chunkIdx × 200</code> in its buffer, so chunks may arrive out of order or twice without harm.' }
    ]},
    { id: 'proto-3', title: 'CRC and the ACK', blocks: [
      { t: 'p', html: 'The node computes a <b>CRC-32</b> of the whole JPEG and sends it in PHOTO_START. The hub recomputes it over what it received. Different → something got lost or damaged → ACK with ok = 0 → the node resends the photo once.' },
      { t: 'widget', name: 'crc' },
      { t: 'code', code: R`inline uint32_t crc32Update(uint32_t crc, const uint8_t *buf, size_t len) {
  crc = ~crc;
  while (len--) {
    crc ^= *buf++;                                   // mix in the next byte
    for (int k = 0; k < 8; k++)                      // 8 steps per byte
      crc = (crc >> 1) ^ (0xEDB88320u & (0u - (crc & 1u)));
  }
  return ~crc;
}` },
      { t: 'p', html: 'The hub also keeps a <b>bitmap</b>: one bit per chunk, set when that chunk arrives. Before checking the CRC it verifies every bit is set.' },
      { t: 'mcq', q: 'All chunk bits are set but the CRC differs. What is the most likely cause?', opts: ['A chunk from the previous photo or a damaged chunk landed in the buffer', 'The CRC function is too slow', 'The ACK was lost'], a: 0, why: 'The hub then asks for a resend (ok = 0). That\'s the whole point of the CRC.' }
    ]},
    { id: 'proto-4', title: 'Retries and giving up', blocks: [
      { t: 'p', html: 'Every wait in the protocol has a limit, and each limit has a planned outcome:' },
      { t: 'table', head: ['Situation', 'Limit', 'Then'], rows: [
        ['Hub doesn\'t answer HELLO', '3 tries in ~2 s [E]', 'node switches off (S-02)'],
        ['Hub refuses', '—', 'node switches off'],
        ['A frame isn\'t acknowledged', '5 retries × 100 ms', 'photo send fails'],
        ['Photo ACK missing or ok = 0', '1 resend', 'skip that photo'],
        ['Whole event', '3 minutes', 'node switches off'],
        ['Hub hears nothing from the node', '8 s idle', 'hub closes the session']] },
      { t: 'multi', q: 'Which of these does the node do when the hub never answers HELLO?', opts: ['Drop WAKE', 'Release HOLD', 'Keep retrying until the battery is flat', 'Take photos anyway and store them'], a: [0, 1], why: 'The node has no storage plan of its own; it gives up and powers down.' }
    ]}
  ]
});

M.push({
  id: 'camera', icon: '🎞️', title: 'The camera',
  summary: 'Configuring esp_camera and handling frame buffers.',
  lessons: [
    { id: 'camera-1', title: 'Configuring the camera', blocks: [
      { t: 'p', html: 'The core includes Espressif\'s camera driver (<code>esp_camera.h</code>). You fill a <code>camera_config_t</code> with the board\'s pins and the image settings, then call <code>esp_camera_init()</code>.' },
      { t: 'code', code: R`camera_config_t c = {};
c.pin_d0 = 15; c.pin_d1 = 17; c.pin_d2 = 18; c.pin_d3 = 16;   // Y2..Y5
c.pin_d4 = 14; c.pin_d5 = 12; c.pin_d6 = 11; c.pin_d7 = 48;   // Y6..Y9
c.pin_xclk = 10; c.pin_pclk = 13; c.pin_vsync = 38; c.pin_href = 47;
c.pin_sccb_sda = 40; c.pin_sccb_scl = 39;
c.pin_pwdn = -1; c.pin_reset = -1;          // the XIAO has neither
c.xclk_freq_hz = 20000000;                  // 20 MHz, as in Seeed's example
c.pixel_format = PIXFORMAT_JPEG;            // compressed by the sensor
c.frame_size = FRAMESIZE_SVGA;              // 800 x 600
c.jpeg_quality = 12;                        // lower number = better, bigger
c.fb_count = 2;
c.fb_location = CAMERA_FB_IN_PSRAM;
c.grab_mode = CAMERA_GRAB_LATEST;
if (esp_camera_init(&c) != ESP_OK) shutdownNode("camera init failed");` },
      { t: 'p', html: 'Pins and the 20 MHz clock come from Seeed\'s camera page [DS, SE-CAM]. Resolution and quality come from the hub\'s budget, so the governor can send smaller photos when the battery is low.' },
      { t: 'mcq', q: 'jpeg_quality 10 vs 30: which gives the smaller file?', opts: ['10', '30'], a: 1, keep: true, why: 'In esp_camera a higher number means more compression: smaller files, lower quality.' },
      { t: 'fill', q: 'Ask the sensor for JPEG frames stored in PSRAM.', code: R`c.pixel_format = {{PIXFORMAT_JPEG}};
c.fb_location  = {{CAMERA_FB_IN_PSRAM}};`, why: '' }
    ]},
    { id: 'camera-2', title: 'Frame buffers', blocks: [
      { t: 'p', html: '<code>esp_camera_fb_get()</code> hands you a frame buffer: <code>fb-&gt;buf</code> (the JPEG bytes) and <code>fb-&gt;len</code>. You <b>must</b> give it back with <code>esp_camera_fb_return(fb)</code>, or the driver runs out of buffers.' },
      { t: 'p', html: 'The first frames after start-up are often badly exposed while auto-exposure settles [E], so the node captures and discards two first.' },
      { t: 'bug', q: 'After the second photo, esp_camera_fb_get() starts returning nullptr. Which line is missing its partner?', code: R`for (uint8_t p = 0; p < budget.photos; p++) {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) continue;
  bool ok = sendPhoto(fb, p, budget.eventId);
  if (ok) sent++;
}`, a: 1, why: 'Every esp_camera_fb_get() needs an esp_camera_fb_return(fb) after the photo has been sent; with fb_count = 2 the buffers are gone after two photos.' },
      { t: 'mcq', q: 'Night: no illumination. What will a night trigger produce?', opts: ['Infrared photos', 'Black frames at full event cost — still undecided in §5', 'Nothing; the camera refuses'], a: 1 }
    ]}
  ]
});

M.push({
  id: 'modem', icon: '📶', title: 'The 4G modem',
  summary: 'PWRKEY, AT commands, getting online, HTTP POST and switching off.',
  lessons: [
    { id: 'modem-1', title: 'A computer inside the computer', blocks: [
      { t: 'p', html: 'The SIM7600 is a separate module with its own processor. The ESP32 controls it through a few pins and talks to it over UART with text <b>AT commands</b>.' },
      { t: 'table', head: ['Fact', 'Value', 'Label'], rows: [
        ['Supply', '3.4–4.2 V, 3.8 V typical', '[DS, HD]'],
        ['Peak current', '2 A', '[DS, HD]'],
        ['Power on', 'PWRKEY low ≥ 100 ms (500 ms typical); UART ready after 13–14 s', '[DS, HD]'],
        ['Power off', 'PWRKEY low ≥ 2.5 s; wait 2 s before restarting', '[DS, HD]'],
        ['Off leakage', '20 µA max', '[DS, HD]']] },
      { t: 'p', html: '<b>Polarity.</b> LILYGO\'s ATdebug example rests the ESP32\'s GPIO4 LOW and pulses it HIGH to start the modem [LG]. The modem\'s own PWRKEY is active-low [DS, HD], so the board most likely has an inverting transistor in between. The firmware makes this a setting — <code>PWRKEY_ON_LEVEL HIGH</code> — and checks the result by asking <code>AT</code> instead of trusting the pulse.' },
      { t: 'p', html: 'Two more pins: <b>FLIGHT</b> (GPIO25) must be HIGH to register on the network [L2]; <b>DTR</b> (GPIO32) LOW keeps the modem awake [LG].' },
      { t: 'mcq', q: 'Why does the hub check "does the modem answer AT?" rather than trusting the PWRKEY pulse?', opts: ['The polarity and the board\'s behaviour are unverified (K-01); an answer is proof', 'AT is faster', 'PWRKEY can\'t be read back'], a: 0 }
    ]},
    { id: 'modem-2', title: 'AT commands', blocks: [
      { t: 'p', html: 'Send <code>AT</code> + command + <code>\\r\\n</code>. The modem answers with data lines and ends with <code>OK</code> or <code>ERROR</code>. Some commands take seconds, so every one gets a timeout.' },
      { t: 'code', code: R`bool at(const char *cmd, const char *expect, uint32_t timeoutMs) {
  while (SerialAT.available()) SerialAT.read();      // drop old bytes
  SerialAT.print("AT"); SerialAT.print(cmd); SerialAT.print("\r\n");
  return waitFor(expect, timeoutMs);                 // true if 'expect' arrives in time
}
bool at(const char *cmd) { return at(cmd, "OK", 1000); }   // short form: expect OK, 1 s

at("");                       // AT          -> OK
at("E0");                     // echo off
at("+CPIN?", "READY", 5000);  // SIM ready?` },
      { t: 'note', kind: 'warn', title: 'Baud rate', html: '<code>AT+IPR=921600</code> changes the speed until the modem restarts [DS, AT §2.2.12]. <code>AT+IPREX</code> changes it permanently — never use it, or you may lose contact at the default rate. 921600 is untested on your board (K-14), so the firmware keeps 115200 unless you turn on USE_FAST_BAUD.' },
      { t: 'fill', q: 'Ask whether the SIM is ready, waiting up to 5 seconds for "READY".', code: R`bool ready = at({{"+CPIN?"}}, {{"READY"}}, 5000);`, why: '' }
    ]},
    { id: 'modem-3', title: 'Getting online', blocks: [
      { t: 'table', head: ['Command', 'Why'], rows: [
        ['<code>AT+CPIN?</code>', 'SIM inserted and unlocked → <code>READY</code>'],
        ['<code>AT+CGDCONT=1,"IP","apn"</code>', 'set your operator\'s APN (Q11: which SIM?)'],
        ['<code>AT+CEREG?</code>', 'LTE registration; status <code>1</code> = home, <code>5</code> = roaming'],
        ['<code>AT+CSQ</code>', 'signal quality, for the log'],
        ['<code>AT+CPSI?</code>', 'detailed radio info — the L-7 antenna check'],
        ['<code>AT+CGACT=1,1</code>', 'activate the data connection']] },
      { t: 'order', q: 'Order the steps to get the modem online.', items: ['FLIGHT HIGH, DTR LOW', 'PWRKEY pulse', 'Poll AT until OK (up to ~25 s)', 'AT+CPIN? → READY', 'Set the APN if needed', 'Poll AT+CEREG? until registered', 'AT+CGACT=1,1'] },
      { t: 'mcq', q: 'Registration never succeeds. Which open item should you suspect first at the site?', opts: ['The antenna position under summer leaves (L-7)', 'The CRC', 'LittleFS'], a: 0 }
    ]},
    { id: 'modem-4', title: 'Uploading with HTTP POST', blocks: [
      { t: 'p', html: 'The SIM7600 has a built-in HTTP client [DS, AT §13]. One upload:' },
      { t: 'code', code: R`AT+HTTPINIT
AT+HTTPPARA="URL","http://your-server/upload?file=00042_2_07.jpg"
AT+HTTPPARA="CONTENT","image/jpeg"
AT+HTTPDATA=25600,30        -> DOWNLOAD   (bytes, seconds to send them)
<send exactly 25600 bytes>  -> OK
AT+HTTPACTION=1             -> OK, then +HTTPACTION: 1,200,<len>
AT+HTTPTERM` },
      { t: 'table', head: ['Detail', 'Value', 'Label'], rows: [
        ['HTTPDATA size', '1 … 153,600 bytes', '[DS, AT §13.2.7]'],
        ['HTTPDATA time', '10 … 65,535 s', '[DS, AT §13.2.7]'],
        ['HTTPACTION methods', '0 GET, 1 POST, 2 HEAD, 3 DELETE', '[DS, AT §13.2.4]'],
        ['Content-Type default', 'text/plain', '[DS, AT §13.2.3]']] },
      { t: 'order', q: 'Order one photo upload.', items: ['AT+HTTPINIT', 'AT+HTTPPARA="URL",…', 'AT+HTTPPARA="CONTENT","image/jpeg"', 'AT+HTTPDATA=<size>,30 and wait for DOWNLOAD', 'Write the file\'s bytes', 'AT+HTTPACTION=1 and read the status', 'AT+HTTPTERM', 'Delete the file only if the status was 2xx'] },
      { t: 'note', kind: 'warn', title: 'Your decision', html: '<b>Where do the photos go?</b> The state file doesn\'t say. The firmware posts to <code>UPLOAD_URL</code>, a placeholder you must replace with a server that accepts an HTTP POST of a JPEG. Plain HTTP is simplest for a first test; HTTPS adds certificate work.' }
    ]},
    { id: 'modem-5', title: 'Switching off, and requirement 3', blocks: [
      { t: 'p', html: '<code>AT+CPOF</code> powers the module down; <code>AT+CFUN=0</code> only turns off its radio (REFERENCE §2; unverified). The firmware tries CPOF first and falls back to a 2.6 s PWRKEY pulse, then confirms that AT no longer answers.' },
      { t: 'p', html: '<b>Requirement 3:</b> everything must stay under the battery protection\'s 3 A trip [DS, L2]. Modem 2 A + two cameras at 0.366 A = 2.73 A [DS]. So the modem never runs while a camera node is on. The hub checks WAKE before starting the modem and between uploads, and pauses if a camera wakes.' },
      { t: 'num', q: 'Modem peak 2 A plus ONE camera at its capture peak 0.366 A [DS]: total in amps?', a: 2.366, tol: 0.005, unit: 'A', why: '2.37 A. That\'s the L-3 "fast first photo" case — under 3 A, but requirement 3 forbids it until you decide Q15.' },
      { t: 'mcq', q: 'A camera wakes in the middle of the upload loop. What does the reference firmware do?', opts: ['Ignores it', 'Stops uploading, powers the modem off, sleeps, and the camera\'s WAKE wakes it again at once', 'Uploads faster'], a: 1, why: 'The node retries HELLO for ~2 s; the hub may miss that event while the modem shuts down. Note this as a known gap to test.' }
    ]}
  ]
});

M.push({
  id: 'robust', icon: '🔋', title: 'Firmware that lives on a battery',
  summary: 'The governor, voltage floors, heartbeats, field builds and the full flows.',
  lessons: [
    { id: 'robust-1', title: 'The governor', blocks: [
      { t: 'p', html: 'The hub decides how many events per day the battery can afford. §6 derived a cap of <b>7 events a day</b> for one 1 W panel [E] — but solar is now six strips of unknown rating, so that cap is <b>not a design basis</b> until H-02 closes. The firmware keeps it as a named constant you will recompute.' },
      { t: 'widget', name: 'budget' },
      { t: 'num', q: 'Harvest limit from §6: (200 − 15 − 6) ÷ 24. Events per day? (one decimal)', a: 7.5, tol: 0.05, why: '179 ÷ 24 = 7.46 ≈ 7.5. Every input is [E]; recompute after next-steps item 9.' },
      { t: 'code', code: R`BudgetMsg decideBudget(uint8_t nodeId, uint16_t mv, bool quietPeriod) {
  BudgetMsg b = {MSG_BUDGET, nodeId, 0, 0, 0, 5, FS_SVGA, 12};   // refused by default
  if (quietPeriod || mv < FLOOR_SLEEP_MV) return b;
  rollWindow();                                   // new 24 h window? reset the count
  float soc = (mv - 3400) / (4100.0f - 3400.0f);   // crude state of charge [E]
  if (soc < 0) soc = 0;
  if (soc > 1) soc = 1;
  int cap = (int)(CAP_EVENTS_FULL * soc + 0.5f);  // scale the cap with charge
  if (cap < 1) cap = 1;
  if (eventsInWindow >= cap) return b;
  b.allowed = 1;
  b.eventId = nextEventId;
  b.photos  = mv >= 3900 ? 24 : (mv >= 3750 ? 12 : 6);
  return b;
}` },
      { t: 'num', q: 'mv = 3750, CAP_EVENTS_FULL = 7. What cap does the formula give?', a: 4, tol: 0, why: 'soc = 350/700 = 0.5 → 7 × 0.5 + 0.5 = 4.0 → 4.' }
    ]},
    { id: 'robust-2', title: 'Floors, heartbeats and field builds', blocks: [
      { t: 'table', head: ['Rule', 'Value', 'Label'], rows: [
        ['Below this: sleep only, refuse all nodes', '3,400 mV resting', '[E] §5'],
        ['Below this: no modem', '3,600 mV resting', '[E] §5'],
        ['Never rely on', 'the protection IC\'s 2.5 V cutoff', '§5'],
        ['Heartbeat', 'every 12 h', 'one or two a day, §5']] },
      { t: 'p', html: 'Without a heartbeat, a dead post and a quiet post look the same. Each heartbeat reports voltage, events, stored and dropped photos, boot count.' },
      { t: 'multi', q: 'What do you change for the field build?', opts: ['DEBUG_SERIAL 0 on both boards', 'Keep the board LED off (GPIO12 LOW)', 'Leave Serial Monitor printing on', 'Recheck UPLOAD_URL, APN and BAT_CAL'], a: [0, 1, 3] },
      { t: 'mcq', q: 'The camera nodes have no battery pin. How do they respect a low battery?', opts: ['They don\'t need to', 'Through the hub: below the floor it refuses their HELLO, and they switch off (S-02, K-21 still open)', 'They measure it with the camera'], a: 1 }
    ]},
    { id: 'robust-3', title: 'Both programs as state machines', blocks: [
      { t: 'p', html: 'A <b>state machine</b> describes a program as states and the events that move it between them. Writing it down before coding is how you keep a battery device from getting stuck.' },
      { t: 'order', q: 'Order the camera node\'s life.', items: ['HOLD HIGH', 'Bounded serial wait (debug only)', 'WAKE HIGH', 'ESP-NOW up', 'HELLO until BUDGET (max 3)', 'Camera init + warm-up frames', 'Capture → send → ACK, per photo', 'DONE', 'WAKE LOW, HOLD LOW → power cut'] },
      { t: 'order', q: 'Order the hub\'s life after a camera wake.', items: ['Release held pins', 'Read wake cause and battery', 'Start ESP-NOW', 'Answer HELLO with a budget', 'Receive photos and ACK them', 'Session ends (DONE or idle)', 'Radio off; modem session if ≥ 3,600 mV', 'Wait for WAKE LOW, hold pins, sleep'] }
    ]}
  ]
});
})();
