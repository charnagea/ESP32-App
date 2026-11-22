/* Smart Post Academy — shared course data. Labels: [M] measured on your hardware,
   [DS] datasheet/vendor (source key), [E] estimate. Status: ✅ ⏳ 🔁 📐 as in PROJECT-STATE.md. */
window.COURSE = {
  title: 'Smart Post Academy',
  subtitle: 'Learn C++ and the ESP32 by writing the complete firmware for your Vineyard Smart Post — the XIAO camera nodes and the LILYGO hub. Built from PROJECT-STATE.md revision 2 (16 Nov 2026).',
  modules: [],

  sequence: [
    { text: 'Quiet. Four PIRs are on; everything else is off or asleep (D-04).', state: { 'PIR ×4': 'on, ~50 µA each [DS]', 'XIAO ×4': 'no power (load switch off)', 'WAKE line': 'LOW', 'Hub ESP32': 'deep sleep', 'Modem': 'off', 'Battery': 'one 18650 in the LILYGO' }, lit: ['PIR ×4'] },
    { text: 'Someone walks past face 2. That PIR\'s OUT goes HIGH. Through the BAT54C it turns the TPS22918 load switch ON, and XIAO #2 gets power and boots.', state: { 'PIR ×4': '#2 OUT = HIGH', 'XIAO ×4': '#2 booting', 'WAKE line': 'LOW', 'Hub ESP32': 'deep sleep', 'Modem': 'off', 'Battery': '' }, lit: ['PIR ×4', 'XIAO ×4'] },
    { text: 'First line of setup(): XIAO #2 drives HOLD HIGH. Now it stays powered even after the PIR pulse ends. Then it raises WAKE.', state: { 'PIR ×4': '#2 may fall any time', 'XIAO ×4': '#2 HOLD = HIGH', 'WAKE line': 'HIGH', 'Hub ESP32': 'waking on EXT1 (GPIO39)', 'Modem': 'off', 'Battery': '' }, lit: ['XIAO ×4', 'WAKE line', 'Hub ESP32'] },
    { text: 'The hub boots (deep sleep wake = a fresh start), reads the battery, starts ESP-NOW. XIAO #2 sends HELLO; the hub\'s governor answers BUDGET: allowed, 24 photos, every 5 s.', state: { 'PIR ×4': '', 'XIAO ×4': '#2 got its budget', 'WAKE line': 'HIGH', 'Hub ESP32': 'awake, radio listening (~100 mA [DS, unverified])', 'Modem': 'off', 'Battery': '' }, lit: ['Hub ESP32', 'XIAO ×4'] },
    { text: 'XIAO #2 captures a JPEG, splits it into 200-byte chunks, sends them, then PHOTO_END. The hub checks every chunk and the CRC, writes the file to flash, and ACKs. Repeat every 5 s.', state: { 'PIR ×4': '', 'XIAO ×4': '#2 capturing, ~155 mA avg [DS, SE]', 'WAKE line': 'HIGH', 'Hub ESP32': 'receiving → LittleFS', 'Modem': 'off', 'Battery': 'one camera + hub radio' }, lit: ['XIAO ×4', 'Hub ESP32'] },
    { text: 'Done. XIAO #2 sends DONE, drops WAKE, releases HOLD. The load switch opens and the XIAO loses power — no sleep current at all.', state: { 'PIR ×4': 'all LOW', 'XIAO ×4': 'no power', 'WAKE line': 'LOW', 'Hub ESP32': 'session closed', 'Modem': 'off', 'Battery': '' }, lit: ['XIAO ×4', 'WAKE line'] },
    { text: 'Only now (requirement 3: never the modem while a camera is powered) the hub turns its radio off and powers the modem: register on LTE, HTTP POST each photo, delete each one after a 2xx reply.', state: { 'PIR ×4': '', 'XIAO ×4': 'no power', 'WAKE line': 'LOW', 'Hub ESP32': 'driving the modem over UART', 'Modem': 'on, bursts up to 2 A [DS, HD]', 'Battery': 'the biggest load of the event' }, lit: ['Modem', 'Hub ESP32'] },
    { text: 'Modem off (AT+CPOF, PWRKEY as fallback). The hub holds its modem pins, arms EXT1 on WAKE plus a timer for the next heartbeat, and goes back to deep sleep.', state: { 'PIR ×4': 'on', 'XIAO ×4': 'no power', 'WAKE line': 'LOW', 'Hub ESP32': 'deep sleep', 'Modem': 'off', 'Battery': 'standby: about 15 mAh/day planned [E]' }, lit: ['Hub ESP32', 'Modem'] }
  ],

  pinmaps: {
    lilygo: {
      title: 'LILYGO T-SIM7600E-H — the ESP32 pins this project uses',
      text: 'From LILYGO\'s documentation [L1, L2] and its example utilities.h (opened 22 Nov 2026). Tap a pin. Amber = owned by the board; green = yours to use; red = careful.',
      pins: [
        { label: 'GPIO4', short: 'PWRKEY', cls: 'used', info: 'Starts and stops the modem. LILYGO\'s example rests it LOW and pulses it HIGH to switch the modem on, which suggests an inverting transistor between the ESP32 and the modem\'s PWRKEY. Treat the polarity as something you confirm on the bench (does the modem answer AT afterwards?).' },
        { label: 'GPIO25', short: 'FLIGHT', cls: 'used', info: 'Modem flight-mode control. Must be HIGH for the modem to register on the network [L2]. The hub drives it LOW before sleeping.' },
        { label: 'GPIO26', short: 'modem→ESP', cls: 'used', info: 'The ESP32\'s UART receive pin, connected to the modem\'s transmit. In code: <code>SerialAT.begin(115200, SERIAL_8N1, 26, 27)</code> — RX first, then TX.' },
        { label: 'GPIO27', short: 'ESP→modem', cls: 'used', info: 'The ESP32\'s UART transmit pin, to the modem\'s receive.' },
        { label: 'GPIO32', short: 'DTR', cls: 'used', info: 'Modem DTR. LOW keeps the modem awake (LILYGO example comment). Held LOW through sleep.' },
        { label: 'GPIO33', short: 'RING', cls: 'used', info: 'Modem RING indicator. Not used by our firmware.' },
        { label: 'GPIO34', short: 'STATUS', cls: 'used', info: 'Modem STATUS output. Input-only pin. The firmware logs it so you can learn its polarity on our board (K-01).' },
        { label: 'GPIO35', short: 'battery ADC', cls: 'used', info: 'Battery voltage through the board\'s divider. Uncalibrated until you compare it with your multimeter (I-07).' },
        { label: 'GPIO36', short: 'solar ADC', cls: 'used', info: 'Solar input voltage through a divider [L2]. Not used yet.' },
        { label: 'GPIO12', short: 'LED · strap', cls: 'bad', info: 'Board LED and an ESP32 strapping pin: HIGH at reset selects 1.8 V flash and may stop the board booting [ET]. Keep it LOW; isolate it before deep sleep [SL].' },
        { label: 'GPIO39', short: 'WAKE (plan)', cls: '', info: 'The only wake-capable pin LILYGO does not assign [REFERENCE §1]. Input-only, no internal pulls, so the design adds 100 kΩ to GND. Open question Q2: does it reach a header on our board?' },
        { label: 'GPIO13', short: 'SD CS / tamper?', cls: 'used', info: 'SD card chip select. Candidate tamper-loop pin (L-2) if the SD slot stays empty. Check the board for a pull-up first.' },
        { label: 'GPIO2/14/15', short: 'SD', cls: 'used', info: 'SD card MISO/SCK/MOSI. GPIO2 and 15 are also strapping pins [ET]. The SD slot has no power control, so it stays empty.' },
        { label: 'GPIO21/22', short: 'I2C', cls: '', info: 'Listed as free I²C SDA/SCL. Not wake-capable.' },
        { label: 'GPIO0', short: 'BOOT', cls: 'bad', info: 'Strapping pin: LOW at reset enters the bootloader [ET]. Don\'t use it.' }
      ]
    },
    xiao: {
      title: 'XIAO ESP32-S3 Sense — labels vs real GPIO numbers',
      text: 'Silk-screen labels are not GPIO numbers (lesson 3). From the Seeed wiki [SE], opened 22 Nov 2026. Tap a pin.',
      pins: [
        { label: 'D0', short: 'GPIO1 · PIR', cls: 'used', info: 'GPIO1. Reads PIR OUT through 10 kΩ. Your bench test proved D0 = GPIO1: on GPIO2 nothing was detected [M, M-01].' },
        { label: 'D1', short: 'GPIO2', cls: '', info: 'GPIO2. Free.' },
        { label: 'D2', short: 'GPIO3 · strap', cls: 'bad', info: 'GPIO3 is a strapping pin on the S3 [SE]. Avoid.' },
        { label: 'D3', short: 'GPIO4 · HOLD', cls: 'used', info: 'GPIO4. HOLD: keeps the node\'s own load switch on. Set HIGH as the very first thing in setup().' },
        { label: 'D4', short: 'GPIO5 · WAKE', cls: 'used', info: 'GPIO5. WAKE: through a diode to the hub\'s GPIO39.' },
        { label: 'D5', short: 'GPIO6', cls: '', info: 'GPIO6. Free.' },
        { label: 'D6', short: 'GPIO43 · TX', cls: '', info: 'GPIO43, UART TX.' },
        { label: 'D7', short: 'GPIO44 · RX', cls: '', info: 'GPIO44, UART RX.' },
        { label: 'D8', short: 'GPIO7 · SD', cls: 'bad', info: 'GPIO7 — shared with the Sense SD slot (SCK). Avoid.' },
        { label: 'D9', short: 'GPIO8 · SD', cls: 'bad', info: 'GPIO8 — Sense SD slot (MISO). Avoid.' },
        { label: 'D10', short: 'GPIO9 · SD', cls: 'bad', info: 'GPIO9 — Sense SD slot (MOSI). Avoid.' },
        { label: 'LED', short: 'GPIO21', cls: 'bad', info: 'GPIO21 — user LED and SD chip select. Your blink test needed GPIO21 explicitly; LED_BUILTIN did not map correctly.' },
        { label: 'BAT+', short: 'power in', cls: 'used', info: 'Battery pad. In the design, the TPS22918 output feeds it. Never plug USB into a XIAO wired to the riser: the switch does not block reverse current (S-07).' }
      ]
    }
  },

  cheatsheet: `
<h2>Boards and settings</h2>
<div class="tw"><table>
<tr><th></th><th>Hub</th><th>Camera node</th></tr>
<tr><td>Board</td><td>LILYGO T-SIM7600E-H</td><td>Seeed XIAO ESP32-S3 Sense</td></tr>
<tr><td>Chip</td><td>ESP32 (classic): 2 × Xtensa LX6, 240 MHz, 520 KB SRAM [DS, ESP32 datasheet]</td><td>ESP32-S3R8: 2 × Xtensa LX7, 240 MHz, 8 MB flash, 8 MB PSRAM [DS, SE]</td></tr>
<tr><td>Arduino board</td><td>ESP32 Wrover Module</td><td>XIAO_ESP32S3</td></tr>
<tr><td>Port</td><td>COM4</td><td>COM3</td></tr>
<tr><td>Settings</td><td>Upload 115200 · Flash 40 MHz · QIO · Default 4MB with spiffs</td><td>PSRAM: OPI PSRAM · USB CDC On Boot: Enabled</td></tr>
<tr><td>MAC</td><td>E0:8C:FE:75:9F:8C [M]</td><td>1C:DB:D4:74:3F:F0 (the one tested) [M]</td></tr>
<tr><td>Core</td><td colspan="2">esp32 by Espressif Systems 3.3.8</td></tr>
</table></div>

<h2>Pins in the firmware</h2>
<div class="tw"><table>
<tr><th>Board</th><th>Name</th><th>GPIO</th><th>Why</th></tr>
<tr><td>XIAO</td><td>PIR_PIN</td><td>1 (D0)</td><td>read PIR OUT</td></tr>
<tr><td>XIAO</td><td>HOLD_PIN</td><td>4 (D3)</td><td>keep own power on</td></tr>
<tr><td>XIAO</td><td>WAKE_PIN</td><td>5 (D4)</td><td>wake the hub</td></tr>
<tr><td>LILYGO</td><td>MODEM_PWRKEY</td><td>4</td><td>modem on/off</td></tr>
<tr><td>LILYGO</td><td>MODEM_FLIGHT</td><td>25</td><td>HIGH = may register</td></tr>
<tr><td>LILYGO</td><td>MODEM_RX / TX</td><td>26 / 27</td><td>UART to the modem</td></tr>
<tr><td>LILYGO</td><td>MODEM_DTR</td><td>32</td><td>LOW = modem awake</td></tr>
<tr><td>LILYGO</td><td>MODEM_STATUS</td><td>34</td><td>input-only</td></tr>
<tr><td>LILYGO</td><td>BAT_ADC_PIN</td><td>35</td><td>battery ÷ divider</td></tr>
<tr><td>LILYGO</td><td>WAKE_PIN</td><td>39</td><td>EXT1 wake (Q2)</td></tr>
<tr><td>LILYGO</td><td>BOARD_LED</td><td>12</td><td>strapping — keep LOW</td></tr>
</table></div>

<h2>API signatures that matter (core 3.3.8)</h2>
<pre class="code"><code>// ESP-NOW callbacks — what YOUR compiler accepted (M-09)
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len);
void onDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status);

WiFi.mode(WIFI_STA);  WiFi.setChannel(1);   // setChannel SETS, channel() only READS
esp_now_init();  esp_now_register_recv_cb(onDataRecv);  esp_now_add_peer(&amp;peer);
esp_now_send(mac, (const uint8_t*)&amp;msg, sizeof(msg));

esp_sleep_get_wakeup_cause();                       // ESP_SLEEP_WAKEUP_EXT1, _TIMER, ...
esp_sleep_enable_ext1_wakeup_io(mask, ESP_EXT1_WAKEUP_ANY_HIGH);
esp_sleep_enable_timer_wakeup(seconds * 1000000ULL); // microseconds
gpio_hold_en(pin);  gpio_deep_sleep_hold_en();      // keep levels through sleep
esp_deep_sleep_start();

analogSetPinAttenuation(35, ADC_11db);  analogReadMilliVolts(35);
Serial1.begin(115200, SERIAL_8N1, RX_PIN, TX_PIN);
</code></pre>

<h2>Modem AT sequence</h2>
<pre class="code"><code>AT            → OK          (modem alive?)
ATE0          → OK          (no echo)
AT+CPIN?      → READY       (SIM ok)
AT+CEREG?     → ...,1 or ,5 (registered: home / roaming)
AT+CSQ        → signal quality
AT+HTTPINIT
AT+HTTPPARA="URL","http://..."
AT+HTTPPARA="CONTENT","image/jpeg"
AT+HTTPDATA=&lt;bytes&gt;,30  → DOWNLOAD → send bytes → OK
AT+HTTPACTION=1          → OK … +HTTPACTION: 1,200,&lt;len&gt;
AT+HTTPTERM
AT+CPOF       → modem off (AT+CFUN=0 only turns the radio off)
Never AT+IPREX (permanent baud). AT+IPR is temporary.</code></pre>

<h2>Rules from your lessons learned</h2>
<ul class="small">
<li>D0 = GPIO1 on the XIAO; always verify label → GPIO (lesson 3).</li>
<li>Core 3.x changed the ESP-NOW callback signatures; most tutorials are outdated (lesson 4).</li>
<li>ESP-NOW only delivers when the receiver is powered and listening; a deep-sleeping ESP32 cannot receive (lessons 8, 12).</li>
<li>Board sleep current ≠ chip sleep current: the XIAO Sense sleeps at 3 mA (lesson 11).</li>
<li>Never a bare <code>while (!Serial)</code> — always a timeout (lesson 13).</li>
<li><code>WiFi.setChannel()</code> sets; <code>WiFi.channel()</code> reads (lesson 14).</li>
<li>Label every number [M], [DS] or [E] (lesson 15).</li>
<li>XIAO: hold BOOT while plugging USB in to upload over a deep-sleep sketch (lesson 19); use a data cable (lesson 20).</li>
</ul>`,

  glossary: [
    ['ADC', 'Analog-to-digital converter: turns a voltage on a pin into a number. The hub reads the battery on GPIO35 with it.'],
    ['Attenuation', 'An ADC setting that lets it measure higher voltages. At 11 dB the ESP32 measures about 150–3100 mV [DS, Arduino ADC docs].'],
    ['AT command', 'A text command sent to the modem over UART, starting with "AT" and ending with a carriage return. The modem answers OK, ERROR or data.'],
    ['BAT54C', 'A dual Schottky diode. In the design it ORs PIR OUT and HOLD onto the load switch\'s ON pin.'],
    ['Baud rate', 'UART speed in bits per second. 115200 is the default for the modem.'],
    ['Bitmask', 'A number used to pick out bits. <code>1ULL << 39</code> is a mask with only bit 39 set.'],
    ['Bootloader', 'Code in ROM that runs first after reset and decides whether to run your program or accept a new upload.'],
    ['Brownout', 'The supply voltage dips too low and the chip resets.'],
    ['Callback', 'A function you hand to a library so it can call you later, e.g. when an ESP-NOW frame arrives.'],
    ['Chunk', 'One piece of a photo small enough for one ESP-NOW frame (200 bytes of data in our protocol).'],
    ['Cold boot', 'A start from power-on (not a wake from deep sleep). RTC memory is empty.'],
    ['CRC-32', 'A 32-bit checksum. If any byte of a photo changes, the CRC almost certainly changes, so the hub can detect damage.'],
    ['Deep sleep', 'ESP32 mode where the CPUs and radio are off and only the RTC domain runs. Waking up restarts your program from setup().'],
    ['Diode-OR', 'Several signals joined through diodes, so any one of them can pull the line HIGH without back-feeding the others.'],
    ['DIP switch', 'Tiny switches on the LILYGO. 1–2 up, 3–4 down routes USB to the ESP32.'],
    ['DTR', 'A modem control line. LOW keeps the SIM7600 awake.'],
    ['ESP-NOW', 'Espressif\'s connectionless Wi-Fi protocol: small frames sent directly from one MAC address to another, no router.'],
    ['EXT0 / EXT1', 'Deep-sleep wake sources from GPIO levels. EXT0: one pin. EXT1: a set of pins, "any HIGH" or "all LOW" on the classic ESP32.'],
    ['FreeRTOS', 'The small operating system inside the ESP32 Arduino core. It runs tasks (your code, Wi-Fi) and offers queues to pass data between them.'],
    ['Flash', 'Non-volatile memory holding your program, NVS and the LittleFS files. Survives power loss.'],
    ['Floor (voltage)', 'A firmware threshold: below it the hub refuses work or skips the modem. Never rely on the protection IC cutoff instead.'],
    ['GPIO', 'General-purpose input/output pin.'],
    ['Governor', 'Hub logic that decides how many events and photos the battery can afford.'],
    ['Heartbeat', 'A small periodic report (battery, counts). Without it a dead post and a quiet post look the same.'],
    ['HOLD', 'The XIAO output that keeps its own load switch on during an event.'],
    ['Interrupt / ISR', 'Code run immediately when a hardware event happens. Keep it tiny.'],
    ['LittleFS', 'A small file system in a flash partition. The hub stores photos there until they are uploaded.'],
    ['Load switch', 'A chip (TPS22918) that connects or disconnects power to a load on command.'],
    ['MAC address', 'A board\'s 6-byte hardware address. ESP-NOW sends to MAC addresses.'],
    ['millis()', 'Milliseconds since this boot, as a 32-bit unsigned number. Wraps after about 49.7 days.'],
    ['NVS', 'Non-volatile storage: a key–value store in flash, used through the Preferences library.'],
    ['Packed struct', 'A struct with no padding bytes, so its byte layout is predictable on both chips.'],
    ['PIR', 'Passive infrared motion sensor (HC-SR501). Its OUT pin goes HIGH on motion.'],
    ['Pointer', 'A variable holding a memory address. <code>p->x</code> reads field x of the struct p points to.'],
    ['PSRAM', 'Extra external RAM (8 MB on both boards). Fast enough for photo buffers; lost in deep sleep.'],
    ['Pull-down / pull-up', 'A resistor that holds a line LOW / HIGH when nothing drives it.'],
    ['PWRKEY', 'The modem\'s power button pin. A pulse starts it; a longer pulse stops it.'],
    ['RTC memory', 'Small memory that stays powered in deep sleep (8 KB slow + 8 KB fast on the ESP32 [DS]). Variables marked RTC_DATA_ATTR live there. Lost on power loss.'],
    ['Strapping pin', 'A pin the chip reads at reset to choose boot options. Pull it the wrong way and the board may not boot.'],
    ['UART', 'Serial port: two wires (TX, RX) plus ground. The ESP32 has three [DS].'],
    ['volatile', 'Tells the compiler a variable can change outside the current code (e.g. in a callback), so it must reread it.'],
    ['WAKE', 'The line from the camera nodes to the hub\'s GPIO39. HIGH wakes the hub.']
  ],

  sources: `
<p class="small">Every [DS] figure in the course carries a source key. Keys from REFERENCE.md were opened on 10 Nov 2026; the rest were opened on 22 Nov 2026 while building this app.</p>
<div class="tw"><table>
<tr><th>Key</th><th>Source</th></tr>
<tr><td>ESP32 DS</td><td><a href="https://documentation.espressif.com/esp32_datasheet_en.pdf">Espressif ESP32 datasheet</a> (22 Nov)</td></tr>
<tr><td>SE</td><td><a href="https://wiki.seeedstudio.com/xiao_esp32s3_getting_started/">Seeed wiki: XIAO ESP32-S3 getting started</a> (10 and 22 Nov)</td></tr>
<tr><td>SE-CAM</td><td><a href="https://wiki.seeedstudio.com/xiao_esp32s3_camera_usage/">Seeed wiki: XIAO ESP32-S3 camera usage</a> (22 Nov)</td></tr>
<tr><td>AR-SLEEP</td><td><a href="https://docs.espressif.com/projects/arduino-esp32/en/latest/api/deepsleep.html">Arduino-ESP32: deep sleep</a> (22 Nov)</td></tr>
<tr><td>AR-ADC</td><td><a href="https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html">Arduino-ESP32: ADC</a> (22 Nov)</td></tr>
<tr><td>EN</td><td><a href="https://docs.espressif.com/projects/esp-idf/en/v5.5.6/esp32/api-reference/network/esp_now.html">ESP-IDF v5.5.6: ESP-NOW</a> (10 and 22 Nov)</td></tr>
<tr><td>TIME</td><td><a href="https://docs.espressif.com/projects/esp-idf/en/v5.5.6/esp32/api-reference/system/system_time.html">ESP-IDF v5.5.6: system time</a> (22 Nov)</td></tr>
<tr><td>PART</td><td><a href="https://raw.githubusercontent.com/espressif/arduino-esp32/master/tools/partitions/default.csv">arduino-esp32 default.csv partition table</a>, master branch (22 Nov)</td></tr>
<tr><td>LG</td><td><a href="https://github.com/Xinyuan-LilyGO/LilyGo-Modem-Series/blob/main/examples/ATdebug/utilities.h">LilyGo utilities.h</a> and <a href="https://github.com/Xinyuan-LilyGO/LilyGo-Modem-Series/blob/main/examples/ATdebug/ATdebug.ino">ATdebug.ino</a> (22 Nov)</td></tr>
<tr><td>AT</td><td><a href="https://trac.godzil.net/ClockworkPi/uConsole/raw/master/SIM7500_SIM7600%20Series_AT%20Command%20Manual_V3.00.pdf">SIMCom SIM7500/SIM7600 AT manual V3.00</a> (third-party mirror; HTTP chapter 13 read 22 Nov)</td></tr>
<tr><td>HD</td><td><a href="https://files.waveshare.com/upload/e/e6/SIM7600G_SIM7600G-H_Hardware_Design_V1.00.pdf">SIM7600G/G-H hardware design</a> (via REFERENCE.md)</td></tr>
<tr><td>L1, L2, L3</td><td><a href="https://wiki.lilygo.cc/products/t-sim-series/t-sim7600x/">LILYGO wiki T-SIM7600X</a>, <a href="https://github.com/Xinyuan-LilyGO/LilyGo-Modem-Series/blob/main/docs/en/esp32/sim7600-esp32/README.MD">quick start</a>, <a href="https://wiki.lilygo.cc/products/t-sim-series/sim.html">model comparison</a> (via REFERENCE.md)</td></tr>
<tr><td>ET</td><td><a href="https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/boot-mode-selection.html">esptool: boot mode selection</a> (via REFERENCE.md)</td></tr>
<tr><td>SL</td><td><a href="https://docs.espressif.com/projects/esp-idf/en/v5.1.2/esp32/api-reference/system/sleep_modes.html">ESP-IDF v5.1.2: sleep modes</a> (via REFERENCE.md)</td></tr>
<tr><td>TPS</td><td><a href="https://www.ti.com/lit/gpn/TPS22918">TI TPS22918 datasheet</a> (via REFERENCE.md)</td></tr>
<tr><td>HC</td><td><a href="https://electrokit.com/upload/quick/17/af/010a_41015509-ds.pdf">HC-SR501 datasheet (Electrokit copy)</a> (via REFERENCE.md)</td></tr>
</table></div>
<p class="small muted">Not verified in any session, and marked "unverified" where used: the ADC2-and-Wi-Fi limitation, the ESP32-S3 input-high threshold, the exact PWRKEY transistor on our board revision.</p>`,

  about: `
<h2>How to use this course</h2>
<p>Work through the modules in order. Each lesson ends with tasks: quizzes, fill-in code, ordering, bug hunts and, in the capstone, code labs that check your program. Progress is saved on this phone.</p>
<p>By the end you will have written — and understood line by line — the two programs in the Firmware tab: the camera node and the hub.</p>
<h2>Number labels</h2>
<div class="tw"><table>
<tr><td><b>[M]</b></td><td>Measured on your own hardware, by you. Only these are facts about your build.</td></tr>
<tr><td><b>[DS]</b></td><td>Datasheet, vendor or third-party document, with its source key (see Sources).</td></tr>
<tr><td><b>[E]</b></td><td>Estimate. A planning number to replace with a measurement.</td></tr>
</table></div>
<h2>Status marks</h2>
<div class="tw"><table>
<tr><td>✅</td><td>verified by a result you reported</td></tr>
<tr><td>⏳</td><td>not done</td></tr>
<tr><td>🔁</td><td>needs re-test</td></tr>
<tr><td>📐</td><td>proposed, not built</td></tr>
</table></div>
<div class="note warn"><b class="lbl">Important</b>The circuits this firmware drives (load switches, diode-OR, WAKE line, tamper loop) are 📐 — proposed in PROJECT-STATE.md §5, not built or tested. The course teaches you to write the program for that design; the bench steps in the project decide whether the design holds.</div>
<p class="small muted">Built 22 Nov 2026 from PROJECT-STATE.md revision 2, REFERENCE.md revision 1 and SKETCHES.md revision 1.</p>`
};
