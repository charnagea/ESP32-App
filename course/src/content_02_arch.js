(function () {
const R = String.raw;
const M = window.COURSE.modules;

/* ===================== PART 3 — ESP32 ARCHITECTURE ===================== */
M.push({
  id: 'arch', part: 'Part 3 · Inside the ESP32', icon: '🧠', title: 'The LILYGO\'s ESP32, inside',
  summary: 'CPU, memories, what survives sleep, partitions, boot and strapping pins.',
  lessons: [
    { id: 'arch-1', title: 'What is on the chip', blocks: [
      { t: 'p', html: 'The LILYGO carries an <b>ESP32-WROVER module</b>: a metal can holding the ESP32 chip plus external flash and PSRAM. LILYGO\'s pages disagree on whether ours is the WROVER-B or -E (Q2), but both have the same "classic" ESP32 inside.' },
      { t: 'table', head: ['Part', 'Value', 'Label'], rows: [
        ['CPU', '2 × Xtensa 32-bit LX6 cores, up to 240 MHz', '[DS, ESP32 DS §4.1.1]'],
        ['ROM', '448 KB (bootloader and built-in functions)', '[DS, ESP32 DS Table 4-1]'],
        ['SRAM', '520 KB on-chip', '[DS, ESP32 DS Table 4-1]'],
        ['RTC FAST / SLOW memory', '8 KB + 8 KB, stay powered in deep sleep', '[DS, ESP32 DS Table 4-1]'],
        ['GPIO', '34 programmable; GPIO34–39 input-only', '[DS, ESP32 DS §4.8.1, Table 6-1]'],
        ['UART', '3 (UART0, 1, 2)', '[DS, ESP32 DS §4.8.3]'],
        ['ADC', '2 × 12-bit SAR ADCs, 18 channels', '[DS, ESP32 DS §4.9.1]'],
        ['Flash (in the module)', '4 MB', '[DS, L3 for WROVER-B]'],
        ['PSRAM (in the module)', '8 MB', '[DS, L3 for WROVER-B]'],
        ['Radio', 'Wi-Fi 2.4 GHz + Bluetooth; ESP-NOW uses the Wi-Fi radio', '']] },
      { t: 'p', html: 'The <b>RTC domain</b> is a small low-power island: RTC memory, the RTC timer, and the RTC GPIOs that can wake the chip. In deep sleep, almost everything else is switched off.' },
      { t: 'mcq', q: 'How many CPU cores does the hub\'s ESP32 have?', opts: ['1', '2', '4'], a: 1, why: 'Two LX6 cores. Arduino runs your setup()/loop() on one; Wi-Fi runs mostly on the other.' },
      { t: 'mcq', q: 'Which pins can only be inputs on the ESP32?', opts: ['GPIO0–5', 'GPIO34–39', 'GPIO21 and 22'], a: 1, why: 'Table 6-1 of the datasheet. That\'s why WAKE (39) and STATUS (34) are inputs, and why GPIO39 needs an external pull-down.' }
    ]},
    { id: 'arch-2', title: 'Where things live — and what survives', blocks: [
      { t: 'table', head: ['Memory', 'Holds', 'Deep sleep', 'Power loss'], rows: [
        ['Flash (program)', 'your compiled code', 'kept', 'kept'],
        ['SRAM', 'normal variables, stack', '<b>lost</b>', 'lost'],
        ['PSRAM', 'big buffers (<code>ps_malloc</code>)', '<b>lost</b> [DS, SL]', 'lost'],
        ['RTC slow memory', '<code>RTC_DATA_ATTR</code> variables', 'kept [DS, SL]', '<b>lost</b>'],
        ['NVS (flash)', 'Preferences key–values', 'kept', 'kept'],
        ['LittleFS (flash)', 'files: the stored photos', 'kept', 'kept']] },
      { t: 'p', html: 'So the hub keeps its daily event counter in RTC memory (cheap, survives every sleep), the event ID in NVS (must never repeat, even after a battery swap), and the photos in LittleFS (must survive anything until uploaded).' },
      { t: 'multi', q: 'The hub deep-sleeps and wakes. Which of these still hold their values?', opts: ['A global <code>int count</code>', 'An <code>RTC_DATA_ATTR uint16_t eventsInWindow</code>', 'A photo buffer from <code>ps_malloc()</code>', 'A file in LittleFS', 'A value saved with Preferences'], a: [1, 3, 4], why: 'Ordinary RAM and PSRAM are powered down in deep sleep.' },
      { t: 'mcq', q: 'The battery is disconnected and reconnected. What happens to RTC_DATA_ATTR variables?', opts: ['Kept', 'Lost — they start from their initial values', 'Copied to flash automatically'], a: 1, why: 'RTC memory needs power. That\'s a cold boot.' }
    ]},
    { id: 'arch-3', title: 'Flash partitions', blocks: [
      { t: 'p', html: 'The 4 MB flash is divided into <b>partitions</b>. Your setting "Default 4MB with spiffs" uses this table [DS, PART — arduino-esp32 master branch]:' },
      { t: 'table', head: ['Name', 'Type', 'Size', 'Used for'], rows: [
        ['nvs', 'data/nvs', '0x5000 = 20 KB', 'Preferences'],
        ['otadata', 'data/ota', '8 KB', 'which app slot boots'],
        ['app0', 'app', '0x140000 = 1.25 MB', 'your program'],
        ['app1', 'app', '1.25 MB', 'second slot for over-the-air updates'],
        ['spiffs', 'data/spiffs', '0x160000 ≈ 1.375 MB', '<b>LittleFS photo storage</b>'],
        ['coredump', 'data', '64 KB', 'crash dumps']] },
      { t: 'p', html: 'LittleFS in Arduino uses the partition labelled "spiffs" by default. That 1.375 MB is why the hub caps stored photos at 50: 50 × ~25 KB ≈ 1.25 MB [E], leaving room for file-system overhead. Check the real photo size once a camera runs.' },
      { t: 'num', q: 'At 25 KB per photo [E], how many photos fit in 1,375 KB if you ignore overhead?', a: 55, tol: 0, why: '1375 ÷ 25 = 55. The cap of 50 leaves ~10 % slack.' }
    ]},
    { id: 'arch-4', title: 'Boot, reset and strapping pins', blocks: [
      { t: 'p', html: 'At reset, the ESP32 reads a few <b>strapping pins</b> to decide how to boot: GPIO0, 2, 12 and 15 [DS, ET]. GPIO0 LOW enters the download (upload) mode. <b>GPIO12 HIGH at reset selects 1.8 V flash and "may prevent flashing and/or booting"</b> on a 3.3 V module [DS, ET].' },
      { t: 'p', html: 'GPIO12 is also the LILYGO\'s LED. So the hub keeps it LOW, and before deep sleep isolates it, as Espressif\'s own example does for WROVER modules [DS, SL]:' },
      { t: 'code', code: R`digitalWrite(BOARD_LED, LOW);
rtc_gpio_isolate(GPIO_NUM_12);   // disconnect it from everything during sleep` },
      { t: 'p', html: 'After every start, <code>esp_sleep_get_wakeup_cause()</code> tells you <i>why</i> the chip is running: <code>ESP_SLEEP_WAKEUP_EXT1</code>, <code>ESP_SLEEP_WAKEUP_TIMER</code>, or "undefined" for a power-on or reset (a cold boot).' },
      { t: 'mcq', q: 'Which pin would be a bad choice for the hub\'s WAKE input?', opts: ['GPIO39', 'GPIO12', 'GPIO13 (if the SD slot is empty)'], a: 1, why: 'A camera holding WAKE high while the hub resets would pull a strapping pin high and could stop it booting.' },
      { t: 'mcq', q: 'The hub starts and the wake cause is "undefined". What happened?', opts: ['A camera woke it', 'The heartbeat timer fired', 'A cold boot: battery connected, reset, or upload'], a: 2, why: 'The firmware then makes sure the modem is off and refuses triggers for 90 s while the PIRs settle.' }
    ]}
  ]
});

M.push({
  id: 'gpio', icon: '🔌', title: 'GPIO, ADC and UART',
  summary: 'Pins in code and in copper, the battery ADC, and serial ports.',
  lessons: [
    { id: 'gpio-1', title: 'Pins in code', blocks: [
      { t: 'code', code: R`pinMode(HOLD_PIN, OUTPUT);       // we drive it
digitalWrite(HOLD_PIN, HIGH);     // 3.3 V
pinMode(PIR_PIN, INPUT);          // we read it
int level = digitalRead(PIR_PIN); // HIGH (1) or LOW (0)
pinMode(1, INPUT_PULLDOWN);       // input with an internal pull-down resistor` },
      { t: 'p', html: 'A <b>pull-down</b> resistor holds a line LOW when nothing drives it, so it never "floats" and picks up noise. GPIO34–39 have <b>no internal pulls</b> on the classic ESP32, so the WAKE line on GPIO39 gets an external 100 kΩ to ground in the design.' },
      { t: 'widget', name: 'pinmap', board: 'lilygo' },
      { t: 'mcq', q: 'Can the hub use <code>pinMode(39, INPUT_PULLDOWN)</code> instead of the external 100 kΩ?', opts: ['Yes', 'No — GPIO34–39 have no internal pull resistors', 'Only in deep sleep'], a: 1 }
    ]},
    { id: 'gpio-2', title: 'Pins in copper', blocks: [
      { t: 'p', html: 'A GPIO is a 3.3 V logic pin. It can source only small currents — it <b>signals</b>, it does not power things. That is why the XIAO controls a <b>load switch</b> (TPS22918) instead of powering itself from a pin.' },
      { t: 'p', html: 'The node\'s power path (📐): the load switch turns on when its ON pin is above 1.0 V and off below 0.5 V [DS, TPS]. Two signals can drive ON through a dual diode (BAT54C): the PIR\'s OUT, <b>or</b> the XIAO\'s HOLD. A 470 kΩ resistor pulls ON down when neither drives it.' },
      { t: 'code', code: R`PIR OUT ──►|──┐
              ├── ON (TPS22918) ── 470 kΩ ── GND
HOLD    ──►|──┘` },
      { t: 'p', html: 'A diode-OR lets either signal turn the switch on without one back-feeding the other. The same trick joins the four WAKE lines into the hub\'s GPIO39.' },
      { t: 'multi', q: 'When is a camera node powered (📐 design)?', opts: ['While its PIR OUT is HIGH', 'While its HOLD pin is HIGH', 'While the hub is awake', 'While WAKE is HIGH'], a: [0, 1], why: 'Only PIR OUT or HOLD reach the ON pin. WAKE goes the other way, to the hub.' },
      { t: 'mcq', q: 'Why must HOLD go HIGH as the <b>first</b> thing in setup()?', opts: ['The PIR pulse may end soon and cut the power before the XIAO finishes booting', 'The camera needs it', 'ESP-NOW needs it'], a: 0, why: 'Open issue K-05: the PIR pulse length against boot-to-HOLD time must be measured.' }
    ]},
    { id: 'gpio-3', title: 'Reading the battery with the ADC', blocks: [
      { t: 'p', html: 'An <b>ADC</b> turns a voltage into a number. The ESP32\'s ADC measures up to about 3.1 V at 11 dB attenuation [DS, AR-ADC], but a full lithium cell is 4.2 V. So the LILYGO feeds GPIO35 through a <b>voltage divider</b> (two resistors) that scales the battery down.' },
      { t: 'widget', name: 'adc' },
      { t: 'code', code: R`analogSetPinAttenuation(BAT_ADC_PIN, ADC_11db);
uint32_t sum = 0;
for (int i = 0; i < 16; i++) { sum += analogReadMilliVolts(BAT_ADC_PIN); delay(2); }
uint16_t mv = (sum / 16) * BAT_DIVIDER * BAT_CAL;   // average of 16 readings` },
      { t: 'note', kind: 'warn', title: 'Open item I-07', html: 'The divider ratio (×2) is an assumption [E]. Before any voltage floor means anything, compare the firmware reading with your multimeter at the battery and set BAT_CAL = multimeter ÷ firmware.' },
      { t: 'num', q: 'Your multimeter reads 3.95 V at the cell. The firmware prints 3,880 mV. What BAT_CAL should you set? (2 decimals)', a: 1.02, tol: 0.006, why: '3950 ÷ 3880 = 1.018 → 1.02.' },
      { t: 'mcq', q: 'Why does the hub read the battery <b>before</b> starting the radio?', opts: ['A resting reading is more honest; the radio\'s current makes the voltage sag', 'The ADC stops working once Wi-Fi is on', 'To save time'], a: 0, why: 'The floors in §5 are "resting" voltages.' }
    ]},
    { id: 'gpio-4', title: 'UART: talking to the modem', blocks: [
      { t: 'p', html: 'A <b>UART</b> sends bytes one bit at a time over a TX wire and receives on an RX wire. Each side\'s TX goes to the other side\'s RX. The ESP32 has three [DS]; <code>Serial</code> (UART0) goes to USB, and the hub uses a second one for the modem.' },
      { t: 'code', code: R`HardwareSerial SerialAT(1);                                   // UART1
SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN); // RX = 26, TX = 27
SerialAT.print("AT\r\n");                                     // send
while (SerialAT.available()) char c = SerialAT.read();        // receive` },
      { t: 'p', html: 'The ESP32\'s <b>GPIO matrix</b> lets almost any UART use almost any pins — that\'s why you pass the pin numbers to <code>begin()</code>. <code>SERIAL_8N1</code> = 8 data bits, no parity, 1 stop bit.' },
      { t: 'fill', q: 'Open the modem UART at 115200 on the LILYGO pins.', code: R`SerialAT.begin({{115200}}, SERIAL_8N1, {{26|MODEM_RX_PIN}}, {{27|MODEM_TX_PIN}});`, why: 'Receive pin first, then transmit. LILYGO: modem TX/RX on 27/26 from the ESP32 side [LG].' }
    ]}
  ]
});

M.push({
  id: 'xiao', icon: '📷', title: 'The XIAO ESP32-S3 Sense',
  summary: 'How the S3 differs, the pins you can use, and why its power is switched off.',
  lessons: [
    { id: 'xiao-1', title: 'ESP32-S3 vs classic ESP32', blocks: [
      { t: 'table', head: ['', 'Hub (ESP32)', 'Node (ESP32-S3R8)'], rows: [
        ['Cores', '2 × LX6, 240 MHz [DS]', '2 × LX7, 240 MHz [DS, SE]'],
        ['Flash / PSRAM', '4 MB / 8 MB [DS, L3]', '8 MB / 8 MB [DS, SE]'],
        ['USB', 'separate USB-serial chip', '<b>native USB</b> inside the chip'],
        ['Camera interface', '—', 'yes (Sense board camera)'],
        ['Callback signatures', 'same core, same signatures', 'same']] },
      { t: 'p', html: 'Native USB is why the XIAO\'s COM port disappears in deep sleep and why <code>while (!Serial)</code> hangs on battery — there is no separate chip keeping the port alive.' },
      { t: 'widget', name: 'pinmap', board: 'xiao' },
      { t: 'mcq', q: 'Why is the PSRAM setting important for the XIAO?', opts: ['The camera frame buffers live in PSRAM', 'ESP-NOW needs PSRAM', 'The bootloader needs it'], a: 0, why: 'Seeed\'s camera page says to enable PSRAM for the camera to work properly [DS, SE-CAM].' }
    ]},
    { id: 'xiao-2', title: 'Choosing the node\'s pins', blocks: [
      { t: 'p', html: 'Your own bench test found that the pin labelled D0 is GPIO1 (M-01). The code always uses <b>real GPIO numbers</b>.' },
      { t: 'fill', q: 'Write the node\'s pin defines with real GPIO numbers.', code: R`#define PIR_PIN  {{1}}   // D0
#define HOLD_PIN {{4}}   // D3
#define WAKE_PIN {{5}}   // D4`, why: 'D0 = GPIO1, D3 = GPIO4, D4 = GPIO5 [SE].' },
      { t: 'multi', q: 'Which GPIOs must the node avoid?', opts: ['GPIO3 (D2)', 'GPIO7, 8, 9 (D8–D10)', 'GPIO21', 'GPIO1', 'GPIO5'], a: [0, 1, 2], why: 'GPIO3 is a strapping pin; 7–9 and 21 belong to the Sense SD slot (21 is also the LED).' },
      { t: 'p', html: 'The camera uses its own set of pins, fixed by the board [DS, SE-CAM]: XCLK 10, SDA 40, SCL 39, data 15/17/18/16/14/12/11/48, VSYNC 38, HREF 47, PCLK 13. There is no power-down or reset pin, so firmware cannot switch the camera off [DS, SE] — another reason to cut the whole board\'s power.' }
    ]},
    { id: 'xiao-3', title: 'Board current vs chip current', blocks: [
      { t: 'p', html: 'The ESP32-S3 chip sleeps at a few µA, but the XIAO Sense <b>board</b> draws about <b>3 mA</b> in deep sleep [DS, SE] — the camera, regulator and other parts don\'t sleep with the chip. The bare XIAO without the Sense board draws 14 µA [DS, SE].' },
      { t: 'num', q: 'Four XIAO Sense boards in deep sleep at 3 mA each [DS]: how many mAh per day?', a: 288, tol: 1, unit: 'mAh/day', why: '4 × 3 mA × 24 h = 288 mAh/day — almost 20× the 15 mAh/day standby target [E]. This is why the June design was dropped.' },
      { t: 'num', q: 'With the load switch off, each node leaks about 0.5 µA [DS, TPS]. Four nodes for a day: how many mAh? (3 decimals)', a: 0.048, tol: 0.002, unit: 'mAh/day', why: '4 × 0.0005 mA × 24 h = 0.048 mAh/day.' },
      { t: 'mcq', q: 'Lesson 11 says chip-level sleep current is not board-level. What follows for the firmware?', opts: ['Use deep sleep more', 'Don\'t design around sleep on the node at all — switch its power off and boot fresh on each trigger', 'Lower the CPU clock'], a: 1 }
    ]}
  ]
});

M.push({
  id: 'sleep', icon: '😴', title: 'Power modes, sleep and wake',
  summary: 'Deep sleep, wake sources, the level-trigger trap and holding pins.',
  lessons: [
    { id: 'sleep-1', title: 'Power modes', blocks: [
      { t: 'table', head: ['Mode', 'What runs', 'ESP32 chip current', 'Wake by'], rows: [
        ['Active', 'CPU, radio', 'tens to hundreds of mA', '—'],
        ['Light sleep', 'CPU paused, RAM kept', 'about 0.8 mA [DS, unverified]', 'timer, GPIO, UART'],
        ['Deep sleep', 'RTC timer + RTC memory', '10 µA [DS, ESP32 DS Table 4-2]', 'timer, EXT0, EXT1, touch, ULP'],
        ['Hibernation', 'RTC timer only', '5 µA [DS, ESP32 DS Table 4-2]', 'timer, EXT1']] },
      { t: 'p', html: 'These are <b>chip</b> figures. The LILYGO <b>board</b> adds its regulator, charger, protection and the off modem\'s leakage. The planning figure for the hub asleep is 0.3–0.5 mA [E] — measuring it is next-steps item 7 (K-13).' },
      { t: 'note', kind: 'fact', title: 'Lesson 12', html: 'In deep and light sleep the radio is off. A sleeping ESP32 <b>cannot receive ESP-NOW</b> [DS, SL]. That is why the design needs a WAKE wire from the cameras to the hub.' },
      { t: 'mcq', q: 'A camera sends ESP-NOW to a hub that is in deep sleep. What happens?', opts: ['The hub wakes up to receive it', 'The frame is lost; the sender\'s callback reports FAIL', 'It is queued until the hub wakes'], a: 1, why: 'Exactly what you measured on 19 Apr: hub off → FAILED seven times (M-08).' }
    ]},
    { id: 'sleep-2', title: 'Deep sleep restarts the program', blocks: [
      { t: 'p', html: 'Waking from deep sleep is like a reset: <code>setup()</code> runs from the top. Your code finds out why it woke and acts on it.' },
      { t: 'code', code: R`esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
if (cause == ESP_SLEEP_WAKEUP_EXT1)       { /* a camera (or the tamper loop) */ }
else if (cause == ESP_SLEEP_WAKEUP_TIMER) { /* heartbeat time */ }
else                                      { /* cold boot */ }` },
      { t: 'p', html: 'The system clock (<code>gettimeofday()</code>) keeps counting through deep sleep on the RTC timer, but a power-on reset clears it [DS, TIME]. The hub uses it to measure its 24-hour event window and the 12-hour heartbeat interval. It may drift a little with the internal oscillator [DS, TIME].' },
      { t: 'order', q: 'Order what the hub does after a wake.', items: ['Release the held pins', 'Read the wake cause', 'Read the battery voltage (resting)', 'Start ESP-NOW and serve the camera', 'Radio off, then modem session if allowed', 'Hold pins, arm wake sources, deep sleep'] }
    ]},
    { id: 'sleep-3', title: 'Wake sources: EXT0, EXT1, timer', blocks: [
      { t: 'p', html: 'Only <b>RTC GPIOs</b> can wake the chip from deep sleep. On the classic ESP32 these are GPIO 0, 2, 4, 12–15, 25–27 and 32–39 [DS, ESP32 DS Table 2-1; AR-SLEEP].' },
      { t: 'table', head: ['Source', 'Pins', 'Notes'], rows: [
        ['EXT0', 'one pin, HIGH or LOW', 'keeps RTC peripherals on, so internal pulls work [DS, SL]'],
        ['EXT1', 'a set of pins: "any HIGH" (or "all LOW")', 'works with RTC peripherals off; use external resistors [DS, SL]'],
        ['Timer', '—', 'microseconds: <code>seconds * 1000000ULL</code>']] },
      { t: 'p', html: 'EXT1 takes a <b>bitmask</b> of GPIO numbers. With the tamper loop (L-2, undecided) the hub would wake on GPIO39 <i>or</i> GPIO13:' },
      { t: 'widget', name: 'mask', goal: [13, 39], goalText: 'select GPIO13 (tamper) and GPIO39 (WAKE).' },
      { t: 'fill', q: 'Arm EXT1 for WAKE on GPIO39, plus a 12-hour heartbeat timer.', code: R`uint64_t mask = {{1ULL << 39|1ULL<<WAKE_PIN|1ULL << WAKE_PIN}};
esp_sleep_enable_ext1_wakeup_io(mask, {{ESP_EXT1_WAKEUP_ANY_HIGH}});
esp_sleep_enable_timer_wakeup(43200 * {{1000000ULL}});
esp_deep_sleep_start();`, why: 'ULL in both places: the mask needs 64 bits and so does the microsecond count.' },
      { t: 'p', html: 'After an EXT1 wake, <code>esp_sleep_get_ext1_wakeup_status()</code> returns the mask of pins that caused it — that is how the hub would tell a tamper wake from a camera wake.' }
    ]},
    { id: 'sleep-4', title: 'The level-trigger trap and held pins', blocks: [
      { t: 'p', html: 'EXT0 and EXT1 react to a <b>level</b>, not an edge: if the pin is already HIGH when the chip sleeps, it wakes again at once [E, REFERENCE §6]. Your SK-03 test counted a long PIR pulse as several wakes this way.' },
      { t: 'widget', name: 'wakeloop', goal: true },
      { t: 'p', html: 'Second problem: in deep sleep, normal GPIOs let go of their levels. The modem\'s PWRKEY, FLIGHT and DTR lines must not float, or the modem could start by itself. The hub <b>holds</b> them:' },
      { t: 'code', code: R`digitalWrite(MODEM_PWRKEY, PWRKEY_IDLE_LEVEL);
digitalWrite(MODEM_FLIGHT, LOW);
digitalWrite(MODEM_DTR, LOW);
gpio_hold_en((gpio_num_t)MODEM_PWRKEY);
gpio_hold_en((gpio_num_t)MODEM_FLIGHT);
gpio_hold_en((gpio_num_t)MODEM_DTR);
gpio_deep_sleep_hold_en();
// ... and first thing after waking:
gpio_hold_dis((gpio_num_t)MODEM_PWRKEY);   // etc.
gpio_deep_sleep_hold_dis();` },
      { t: 'bug', q: 'The hub keeps waking every second. Which line is the cause?', code: R`void goToSleep() {
  esp_now_deinit();
  WiFi.mode(WIFI_OFF);
  uint64_t mask = 1ULL << WAKE_PIN;
  esp_sleep_enable_ext1_wakeup_io(mask, ESP_EXT1_WAKEUP_ANY_HIGH);
  esp_deep_sleep_start();
}`, a: 4, why: 'It arms the level-triggered wake without first waiting for WAKE to fall. If a camera still holds WAKE high, the hub wakes immediately, again and again.' },
      { t: 'mcq', q: 'Why does the node <b>not</b> hold HOLD through deep sleep?', opts: ['It would keep the load switch on forever and the node would sit at 3 mA', 'gpio_hold does not work on the S3', 'HOLD is an input'], a: 0, why: '§5: "HOLD is never held through deep sleep."' }
    ]}
  ]
});
})();
