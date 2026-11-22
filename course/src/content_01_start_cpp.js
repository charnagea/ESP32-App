(function () {
const R = String.raw;
const M = window.COURSE.modules;

/* ===================== PART 1 — START HERE ===================== */
M.push({
  id: 'start', part: 'Part 1 · Start here', icon: '🧭', title: 'The mission',
  summary: 'What you will build, how numbers are labelled, and your tools.',
  lessons: [
    { id: 'start-1', title: 'Two programs, one post', blocks: [
      { t: 'p', html: 'Your Smart Post has <b>five computers</b>: four <b>camera nodes</b> (Seeed XIAO ESP32-S3 Sense), one per face of the post, and one <b>hub</b> (LILYGO T-SIM7600E-H) at the bottom with the 4G modem and the battery.' },
      { t: 'p', html: 'That means you write <b>two programs</b> (Arduino calls them <i>sketches</i>):' },
      { t: 'table', head: ['Program', 'Runs on', 'Job'], rows: [
        ['<code>SmartPost_Node.ino</code>', 'each XIAO', 'wake the hub, ask permission, take photos, send them over ESP-NOW, switch itself off'],
        ['<code>SmartPost_Hub.ino</code>', 'the LILYGO', 'sleep, wake on a camera, decide the budget, receive and store photos, upload them over 4G, report a heartbeat']] },
      { t: 'p', html: 'The rule that shapes everything is yours (D-04): <i>"Nothing is on ever unless someone triggers the PIR."</i> Step through one trigger below to see the whole system move.' },
      { t: 'widget', name: 'seq', goal: true },
      { t: 'mcq', q: 'Which board stores the photos and uploads them to the internet?', opts: ['Each XIAO uploads its own photos', 'The LILYGO hub', 'The PIR sensors'], a: 1, why: 'Only the hub has the 4G modem. The XIAOs send photos to the hub over ESP-NOW and then switch off.' },
      { t: 'mcq', q: 'Why does a camera node switch itself completely off instead of deep-sleeping?', opts: ['Deep sleep is not possible on the ESP32-S3', 'The XIAO Sense board draws about 3 mA in deep sleep [DS, SE] — four of them would drain the cell', 'The camera breaks if left in sleep'], a: 1, why: '3 mA × 4 boards × 24 h = 288 mAh a day — far above the 15 mAh/day planned standby [E]. Cutting power with a load switch removes it (lesson 11).' }
    ]},
    { id: 'start-2', title: 'Reading numbers and status marks', blocks: [
      { t: 'p', html: 'In this project every number wears a label, because both big budget mistakes so far came from unlabelled numbers (lesson 15).' },
      { t: 'table', head: ['Label', 'Means', 'Example'], rows: [
        ['[M]', 'measured on <i>your</i> hardware', 'hub MAC E0:8C:FE:75:9F:8C [M]'],
        ['[DS]', 'datasheet or vendor, with a source', 'XIAO Sense deep sleep 3 mA [DS, SE]'],
        ['[E]', 'estimate — replace it with a measurement', 'standby 15 mAh/day [E]']] },
      { t: 'p', html: 'Status marks: ✅ verified by your result · ⏳ not done · 🔁 needs re-test · 📐 proposed, not built.' },
      { t: 'note', kind: 'warn', title: 'Keep this in mind', html: 'The load switches, diode-OR and WAKE line the firmware relies on are all 📐. You will learn to program the design; the bench tests decide if it works.' },
      { t: 'mcq', q: '"The hub uses about 0.3–0.5 mA in deep sleep" appears in the state file with which label?', opts: ['[M] — you measured it', '[E] — an estimate, waiting for measurement K-13', '[DS] — LILYGO guarantees it'], a: 1, why: 'Nothing about current has been measured yet (state file §4). Hub sleep current is next-steps item 7.' },
      { t: 'mcq', q: 'A sketch compiled and a friend says it works on their board. What status does it get in your project?', opts: ['✅', '📐 or 🔁 until it runs on your boards and you report the result', '[M]'], a: 1, why: 'Only a result you report moves a mark to ✅.' }
    ]},
    { id: 'start-3', title: 'Your toolchain', blocks: [
      { t: 'p', html: 'You program both boards from <b>Arduino IDE 2.x</b> with the board package <b>esp32 by Espressif Systems 3.3.8</b>. The package (the "core") contains the compiler, the Arduino functions and Espressif\'s ESP-IDF libraries underneath.' },
      { t: 'table', head: ['', 'Hub', 'Camera node'], rows: [
        ['Tools → Board', 'ESP32 Wrover Module', 'XIAO_ESP32S3'],
        ['Port', 'COM4', 'COM3'],
        ['Other settings', 'Upload 115200, Flash 40 MHz, QIO, "Default 4MB with spiffs"', 'PSRAM: OPI PSRAM (the camera needs it)'],
        ['How USB connects', 'USB-to-serial chip on the board', 'native USB inside the ESP32-S3']] },
      { t: 'note', kind: 'tip', title: 'Two gotchas you already hit', html: 'A charge-only cable powers a board but shows no COM port (lesson 20). And a XIAO running a deep-sleep sketch drops its COM port: hold <b>BOOT</b> while plugging in, then release, to upload (lesson 19).' },
      { t: 'order', q: 'Put the steps for uploading to the LILYGO in order.', items: ['Set DIP switches 1–2 up, 3–4 down', 'Connect a data cable to the ESP32 USB-C port', 'Tools → Board: ESP32 Wrover Module, Port: COM4', 'Click Upload', 'Open Serial Monitor at 115200 baud'] },
      { t: 'mcq', q: 'Your XIAO is in deep sleep and COM3 has disappeared. What do you do?', opts: ['Reinstall the drivers', 'Hold BOOT, plug in USB, release BOOT, then upload', 'Use the LILYGO\'s COM4 instead'], a: 1, why: 'Native USB lives inside the chip; when the chip sleeps, the port vanishes. BOOT forces the bootloader.' }
    ]}
  ]
});

/* ===================== PART 2 — C++ ===================== */
M.push({
  id: 'sketch', part: 'Part 2 · C++ for microcontrollers', icon: '📄', title: 'Anatomy of a sketch',
  summary: 'setup(), loop(), statements, Serial output and the preprocessor.',
  lessons: [
    { id: 'sketch-1', title: 'setup() and loop()', blocks: [
      { t: 'p', html: 'Every Arduino sketch has two functions. <code>setup()</code> runs once after the board starts. <code>loop()</code> then runs again and again, forever.' },
      { t: 'code', code: R`void setup() {
  // runs once at start-up
}

void loop() {
  // runs forever after setup() returns
}` },
      { t: 'p', html: 'Our firmware is unusual: <b>both programs do everything in <code>setup()</code></b> and never reach <code>loop()</code>. The node ends by cutting its own power; the hub ends with <code>esp_deep_sleep_start()</code>. Waking from deep sleep restarts the chip, so <code>setup()</code> runs again on the next event.' },
      { t: 'mcq', q: 'The hub wakes from deep sleep. Which code runs first?', opts: ['loop(), from where it stopped', 'setup(), from the top', 'Nothing until you press reset'], a: 1, why: 'A deep-sleep wake is a fresh start: global variables are re-initialised (except RTC memory) and setup() runs from the top.' },
      { t: 'mcq', q: 'What does this print, once a second?', code: R`int n = 0;
void setup() { Serial.begin(115200); }
void loop() { n = n + 1; Serial.println(n); delay(1000); }`, opts: ['1 1 1 1 …', '1 2 3 4 …', '0 0 0 …'], a: 1, why: 'n is a global variable: it keeps its value between loop() calls.' }
    ]},
    { id: 'sketch-2', title: 'Statements, comments, Serial', blocks: [
      { t: 'p', html: 'A statement ends with <code>;</code>. Comments start with <code>//</code> (to the end of the line) or sit between <code>/* … */</code>. Braces <code>{ }</code> group statements into a block.' },
      { t: 'p', html: '<code>Serial</code> is the USB serial port. <code>Serial.begin(115200)</code> opens it; <code>Serial.println(x)</code> prints a line; <code>Serial.printf()</code> prints formatted text:' },
      { t: 'code', code: R`Serial.printf("Battery %u mV, node %d\n", mv, nodeId);
// %u unsigned · %d signed · %s text · %02X hex, 2 digits · %lu unsigned long` },
      { t: 'p', html: 'On the XIAO, <code>Serial</code> is native USB. <code>while (!Serial)</code> waits for a computer to open the port — on battery, with no computer, it waits <b>forever</b> and the board never runs your code (lesson 13). Always add a timeout:' },
      { t: 'code', code: R`Serial.begin(115200);
unsigned long t0 = millis();
while (!Serial && millis() - t0 < 1500) delay(10);   // gives up after 1.5 s` },
      { t: 'bug', q: 'This node sketch works on USB but does nothing on battery. Tap the line that causes it.', code: R`void setup() {
  pinMode(4, OUTPUT);
  digitalWrite(4, HIGH);
  Serial.begin(115200);
  while (!Serial) { delay(10); }
  Serial.println("Node awake");
}`, a: 4, why: 'A bare while(!Serial) never returns without a USB host. Lesson 13 — always bound the wait.' },
      { t: 'fill', q: 'Complete the format string so it prints <code>MAC E0:8C</code> from the bytes 0xE0 and 0x8C.', code: R`Serial.printf("MAC {{%02X}}:{{%02X}}\n", mac[0], mac[1]);`, why: '%02X = hexadecimal, upper case, at least 2 digits, padded with 0.' }
    ]},
    { id: 'sketch-3', title: '#include, #define and #if', blocks: [
      { t: 'p', html: 'Lines starting with <code>#</code> are handled by the <b>preprocessor</b> before compiling. <code>#include</code> pastes in a library\'s declarations; <code>#define</code> makes a name the compiler replaces with text.' },
      { t: 'code', code: R`#include <WiFi.h>               // library from the core
#include "SmartPostProtocol.h"  // a file in your sketch folder

#define PIR_PIN  1              // every PIR_PIN becomes 1
#define DEBUG_SERIAL 1

#if DEBUG_SERIAL
  #define LOG(...) Serial.printf(__VA_ARGS__)
#else
  #define LOG(...)               // field build: LOG() becomes nothing
#endif` },
      { t: 'p', html: 'The <code>LOG</code> trick lets you keep all your debug prints and switch them off for the field build with one line. Every second awake costs current, and serial printing keeps the chip awake longer.' },
      { t: 'mcq', q: 'With <code>#define DEBUG_SERIAL 0</code>, what does <code>LOG("x=%d\\n", x);</code> compile to?', opts: ['A Serial.printf call', 'Nothing — an empty statement', 'A compile error'], a: 1, why: 'The #else branch defines LOG(...) as empty, so the call vanishes before compiling.' },
      { t: 'mcq', q: '<code>&lt;WiFi.h&gt;</code> vs <code>"SmartPostProtocol.h"</code> — what is the difference?', opts: ['None', 'Angle brackets search the libraries; quotes search your sketch folder first', 'Quotes are for C, brackets for C++'], a: 1, why: 'That is why SmartPostProtocol.h must sit inside each sketch folder.' }
    ]}
  ]
});

M.push({
  id: 'types', icon: '🔢', title: 'Variables, types and bits',
  summary: 'Fixed-width integers, overflow, constants, hex and bitwise operators.',
  lessons: [
    { id: 'types-1', title: 'Types and their sizes', blocks: [
      { t: 'p', html: 'A variable is a named box in memory. Its <b>type</b> says how many bytes and what kind of value. On the ESP32:' },
      { t: 'table', head: ['Type', 'Bytes', 'Range', 'Used for'], rows: [
        ['<code>bool</code>', '1', 'true / false', 'flags'],
        ['<code>uint8_t</code>', '1', '0 … 255', 'bytes, message types, node IDs'],
        ['<code>uint16_t</code>', '2', '0 … 65,535', 'event IDs, chunk numbers, millivolts'],
        ['<code>uint32_t</code>', '4', '0 … 4,294,967,295', 'CRC, photo length'],
        ['<code>uint64_t</code>', '8', '0 … 1.8×10¹⁹', 'wake masks (GPIO39 needs bit 39)'],
        ['<code>int</code>', '4', '±2.1×10⁹', 'general counting'],
        ['<code>float</code>', '4', '~7 digits', 'state of charge'],
        ['<code>char</code>', '1', 'one character', 'text']] },
      { t: 'p', html: 'Messages between the two chips use the fixed-width types (<code>uint8_t</code>, <code>uint16_t</code>, …) so both sides agree on exactly how many bytes each field takes.' },
      { t: 'mcq', q: 'Which type holds a wake mask with bit 39 set?', opts: ['uint8_t', 'uint32_t', 'uint64_t'], a: 2, why: 'Bit 39 needs at least 40 bits. uint32_t stops at bit 31.' },
      { t: 'mcq', q: 'A photo is about 25,000 bytes [E]. Which type do you use for its length?', opts: ['uint8_t', 'uint16_t', 'uint32_t'], a: 2, why: 'uint16_t would work for 25 KB but fails above 65,535 bytes; XGA photos can be bigger. The protocol uses uint32_t.' }
    ]},
    { id: 'types-2', title: 'Overflow and millis()', blocks: [
      { t: 'p', html: 'Unsigned integers <b>wrap around</b>: a <code>uint8_t</code> at 255 plus 1 becomes 0. No error, no warning.' },
      { t: 'num', q: '<code>uint8_t x = 250; x = x + 10;</code> — what is x now?', a: 4, tol: 0, why: '260 − 256 = 4.' },
      { t: 'p', html: '<code>millis()</code> returns milliseconds since boot as a 32-bit unsigned number. It wraps after about 49.7 days. The hub never runs that long in one wake, but the safe pattern costs nothing — always <b>subtract</b>:' },
      { t: 'code', code: R`unsigned long t0 = millis();
while (millis() - t0 < 5000) { ... }   // correct, even across a wrap
// while (millis() < t0 + 5000)          // wrong: breaks at the wrap` },
      { t: 'bug', q: 'Which line breaks when millis() wraps around?', code: R`unsigned long start = millis();
bool waiting = true;
while (waiting) {
  if (millis() > start + 2000) waiting = false;
  delay(5);
}`, a: 3, why: 'start + 2000 can wrap to a small number. Use millis() - start > 2000.' }
    ]},
    { id: 'types-3', title: 'Constants and number suffixes', blocks: [
      { t: 'p', html: 'Three ways to name a constant:' },
      { t: 'code', code: R`#define HEARTBEAT_S 43200            // text replacement, no type
const uint16_t FLOOR_LTE_MV = 3600;   // typed, read-only variable
constexpr uint8_t NODE_ID = 1;        // typed, known at compile time` },
      { t: 'p', html: 'Suffixes set the type of a literal number: <code>1000UL</code> is unsigned long, <code>1ULL</code> is unsigned 64-bit, <code>4.1f</code> is a float.' },
      { t: 'p', html: 'This matters with shifts. <code>1 &lt;&lt; 39</code> is computed in a 32-bit <code>int</code>: undefined, and wrong. <code>1ULL &lt;&lt; 39</code> is computed in 64 bits: correct.' },
      { t: 'mcq', q: 'Which line builds a correct timer value for 12 hours in microseconds?', opts: ['<code>43200 * 1000000</code>', '<code>43200 * 1000000ULL</code>', '<code>43200 * 1000</code>'], a: 1, why: '43,200,000,000 does not fit in 32 bits. The ULL suffix makes the multiplication 64-bit.' },
      { t: 'mcq', q: 'Why does the firmware write <code>budget.intervalS * 1000UL</code>?', opts: ['To convert seconds to ms in an unsigned long, so it compares cleanly with millis()', 'Because UL makes it faster', 'It is required by ESP-NOW'], a: 0 }
    ]},
    { id: 'types-4', title: 'Bits, hex and bitwise operators', blocks: [
      { t: 'p', html: 'A byte is 8 bits. Hex writes each 4 bits as one digit 0–F, so a byte is two hex digits: <code>0xE0</code> = 1110 0000 = 224.' },
      { t: 'widget', name: 'bits', goal: 0x2C, goalText: '0x2C (44)' },
      { t: 'table', head: ['Operator', 'Does', 'Example'], rows: [
        ['<code>&amp;</code>', 'AND — keep bits set in both', '<code>x &amp; 0x0F</code> keeps the low 4 bits'],
        ['<code>|</code>', 'OR — set bits', '<code>mask |= 1ULL &lt;&lt; 13</code>'],
        ['<code>^</code>', 'XOR — flip bits', 'used inside the CRC'],
        ['<code>~</code>', 'NOT — invert all bits', '<code>~crc</code>'],
        ['<code>&lt;&lt; &gt;&gt;</code>', 'shift left / right', '<code>i &gt;&gt; 3</code> = i ÷ 8']] },
      { t: 'p', html: 'The hub tracks which photo chunks arrived with one <b>bit per chunk</b>. Chunk i lives in byte <code>i &gt;&gt; 3</code>, bit <code>i &amp; 7</code>:' },
      { t: 'fill', q: 'Complete bitSet and bitGet.', code: R`void bitSet(uint8_t *bits, uint16_t i) { bits[i >> 3] {{|=}} (1 << (i & 7)); }
bool bitGet(const uint8_t *bits, uint16_t i) { return bits[i >> 3] {{&}} (1 << (i & 7)); }`, why: '|= turns the bit on without touching the others; & tests it.' },
      { t: 'num', q: 'Chunk number 13 is stored in which byte of the bitmap (counting from 0)?', a: 1, tol: 0, why: '13 >> 3 = 1 (13 ÷ 8 = 1, remainder 5 → bit 5).' }
    ]}
  ]
});

M.push({
  id: 'flow', icon: '🔀', title: 'Decisions, loops and functions',
  summary: 'if/else, bounded loops, functions and variable lifetime.',
  lessons: [
    { id: 'flow-1', title: 'if, else and the ternary', blocks: [
      { t: 'p', html: 'Comparisons: <code>== != &lt; &gt; &lt;= &gt;=</code>. Combine with <code>&amp;&amp;</code> (and), <code>||</code> (or), <code>!</code> (not). Note <code>=</code> assigns and <code>==</code> compares.' },
      { t: 'code', code: R`if (mv < FLOOR_SLEEP_MV) {
  goToSleep();                 // below 3,400 mV [E]: do nothing else
} else if (mv < FLOOR_LTE_MV) {
  // capture allowed, but no modem
} else {
  // everything allowed
}

// The ternary operator: condition ? valueIfTrue : valueIfFalse
uint8_t photos = mv >= 3900 ? 24 : (mv >= 3750 ? 12 : 6);` },
      { t: 'num', q: 'With the line above, how many photos does the budget give at mv = 3800?', a: 12, tol: 0, why: '3800 is not ≥ 3900, but it is ≥ 3750 → 12. The thresholds are [E], to tune once the battery is measured.' },
      { t: 'bug', q: 'This check never refuses a node. Why?', code: R`bool refuse = false;
if (eventsInWindow = cap) {
  refuse = true;
}`, a: 1, why: '= assigns cap to eventsInWindow (and is true whenever cap ≠ 0). You meant >= .' }
    ]},
    { id: 'flow-2', title: 'Loops — always with an exit', blocks: [
      { t: 'p', html: '<code>for</code> repeats a known number of times; <code>while</code> repeats while a condition holds; <code>break</code> leaves a loop early.' },
      { t: 'code', code: R`for (uint8_t p = 0; p < budget.photos; p++) { /* one photo */ }

int tries = 0;
while (!budgetReceived && tries < 3) { sendHello(); tries++; }` },
      { t: 'note', kind: 'warn', title: 'Project rule', html: 'On a battery, every loop that waits for something must have a limit: a count, a timeout, or both. "An unbounded retry loop on a battery-powered node" is an anti-pattern in REFERENCE §11 — one stuck loop at 155 mA empties the cell.' },
      { t: 'bug', q: 'Which line can drain the battery?', code: R`void waitForHub() {
  int tries = 0;
  while (!budgetReceived) {
    esp_now_send(HUB_MAC, (const uint8_t*)&hello, sizeof(hello));
    tries++;
    delay(650);
  }
}`, a: 2, why: 'tries is counted but never checked: if the hub is asleep or dead, the node retries forever. Use while (!budgetReceived && tries < 3).' },
      { t: 'fill', q: 'Make this wait end after 1,500 ms at most.', code: R`unsigned long t0 = millis();
while (!ackReceived && {{millis() - t0 < 1500}}) delay(2);`, hint: 'subtract, then compare', why: 'Classic bounded wait.' }
    ]},
    { id: 'flow-3', title: 'Functions', blocks: [
      { t: 'p', html: 'A function packages steps under a name. It takes <b>parameters</b> and may <b>return</b> a value; <code>void</code> means it returns nothing.' },
      { t: 'code', code: R`bool timeUp() {
  return millis() - eventStart > MAX_EVENT_MS;
}

uint16_t readBatteryMv() {
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) sum += analogReadMilliVolts(BAT_ADC_PIN);
  return (uint16_t)((sum / 16) * BAT_DIVIDER * BAT_CAL);
}` },
      { t: 'p', html: 'A function must be declared before it is used, or the Arduino IDE must be able to find it (it adds declarations automatically for most functions in the .ino file). Two traps caused by those automatic declarations: don\'t give parameters <b>default values</b> (<code>int f(int x = 1)</code>) — write a second, shorter version of the function instead (an <i>overload</i>); and leave out C++\'s <code>[[noreturn]]</code> marker. <code>shutdownNode()</code> and <code>goToSleep()</code> never return, so the firmware says so in a comment.' },
      { t: 'mcq', q: 'Why does <code>sendAndWait()</code> return <code>bool</code>?', opts: ['So the caller can tell whether the frame got through and decide what to do', 'Because ESP-NOW requires it', 'To save memory'], a: 0 },
      { t: 'fill', q: 'Complete the function signature: it takes a millivolt reading and returns true when the modem may run.', code: R`{{bool}} modemAllowed({{uint16_t}} mv) {
  return mv >= FLOOR_LTE_MV;
}`, why: 'bool result, uint16_t input (millivolts fit in 0…65,535).' }
    ]},
    { id: 'flow-4', title: 'Scope and lifetime', blocks: [
      { t: 'table', head: ['Where declared', 'Visible in', 'Lives until'], rows: [
        ['inside a function', 'that function (block)', 'the function returns'],
        ['outside all functions (global)', 'the whole file', 'reset or deep sleep'],
        ['<code>static</code> inside a function', 'that function', 'reset or deep sleep — keeps its value between calls'],
        ['<code>RTC_DATA_ATTR</code> global', 'the whole file', 'power loss — survives deep sleep'],
        ['NVS (Preferences) / LittleFS', 'via the library', 'forever, until you erase it']] },
      { t: 'p', html: 'The hub counts events across many wakes, so its counters cannot be ordinary globals. You will meet RTC memory and NVS in Part 3.' },
      { t: 'mcq', q: 'The hub counts eventsInWindow in an ordinary global <code>uint16_t</code>. What happens after each deep sleep?', opts: ['The count continues', 'It is reset to its initial value', 'It becomes random'], a: 1, why: 'Deep sleep powers down normal RAM; setup() starts with fresh globals. Use RTC_DATA_ATTR.' }
    ]}
  ]
});

M.push({
  id: 'data', icon: '🧱', title: 'Arrays, text and structs',
  summary: 'MAC arrays, memcpy, safe strings, enums and packed message structs.',
  lessons: [
    { id: 'data-1', title: 'Arrays, memcpy and memcmp', blocks: [
      { t: 'p', html: 'An array is a row of same-type values, indexed from 0. A MAC address is 6 bytes:' },
      { t: 'code', code: R`static const uint8_t HUB_MAC[6] = {0xE0, 0x8C, 0xFE, 0x75, 0x9F, 0x8C};
// HUB_MAC[0] is 0xE0, HUB_MAC[5] is 0x8C. HUB_MAC[6] does not exist!

memcpy(peer.peer_addr, HUB_MAC, 6);               // copy 6 bytes
if (memcmp(info->src_addr, HUB_MAC, 6) != 0) return; // compare 6 bytes; 0 = equal` },
      { t: 'mcq', q: '<code>memcmp(a, b, 6)</code> returns 0. What does that mean?', opts: ['The arrays differ', 'The 6 bytes are identical', 'An error happened'], a: 1, why: 'memcmp returns 0 for "equal" — the opposite of what beginners expect. Hence the != 0 test for "not our hub".' },
      { t: 'fill', q: 'Ignore frames that do not come from the hub.', code: R`if ({{memcmp}}(info->src_addr, HUB_MAC, {{6}}) != 0) return;`, why: '' }
    ]},
    { id: 'data-2', title: 'Text the safe way', blocks: [
      { t: 'p', html: 'C text is an array of <code>char</code> ending with a zero byte. <code>snprintf</code> writes formatted text into a buffer and <b>never overflows it</b> when you pass its size:' },
      { t: 'code', code: R`char path[40];
snprintf(path, sizeof(path), "/p/%05u_%u_%02u.jpg", eventId, nodeId, idx);
// eventId 42, node 2, photo 7  ->  "/p/00042_2_07.jpg"` },
      { t: 'p', html: 'Bytes from the radio are <b>not</b> guaranteed to end with a zero. SK-01 was fixed for this: print with a length.' },
      { t: 'bug', q: 'Which line can read past the end of the received data?', code: R`void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  Serial.printf("Received %d bytes\n", len);
  Serial.printf("Message: %s\n", (char*)data);
}`, a: 2, why: '%s keeps reading until a zero byte, which may not be there. Use Serial.printf("%.*s", len, (const char*)data).' },
      { t: 'mcq', q: 'Why does the photo filename use <code>%05u</code> for the event ID?', opts: ['Leading zeros make names sort in event order, so "oldest file" = smallest name', 'Filenames must be 5 digits on LittleFS', 'It saves flash'], a: 0, why: 'The hub deletes the oldest photo when storage is full; zero-padded names make that a simple string comparison.' },
      { t: 'p', html: 'The Arduino <code>String</code> class is easier but allocates memory as it grows. The hub uses it only for short-lived AT replies; anything long-lived uses fixed <code>char</code> buffers.' }
    ]},
    { id: 'data-3', title: 'enum and struct', blocks: [
      { t: 'p', html: 'An <code>enum</code> names a set of values. A <code>struct</code> groups fields into one type.' },
      { t: 'code', code: R`enum MsgType : uint8_t { MSG_HELLO = 1, MSG_BUDGET = 2, MSG_PHOTO_START = 3,
                         MSG_CHUNK = 4, MSG_PHOTO_END = 5, MSG_ACK = 6, MSG_DONE = 7 };

struct HelloMsg {
  uint8_t type;     // MSG_HELLO
  uint8_t nodeId;   // 1..4
  uint8_t pirHigh;  // PIR level at boot
};

HelloMsg hello = {MSG_HELLO, NODE_ID, 1};   // fields in declaration order
hello.nodeId = 3;                           // the dot reads/writes a field` },
      { t: 'p', html: '<code>: uint8_t</code> after the enum name fixes its size to one byte — important, because the first byte of every message is its type.' },
      { t: 'mcq', q: 'Which field tells the receiver what kind of message arrived?', opts: ['The last byte', 'The first byte, <code>type</code>', 'The ESP-NOW header'], a: 1 }
    ]},
    { id: 'data-4', title: 'Packed structs, sizeof and offsetof', blocks: [
      { t: 'p', html: 'Compilers may insert invisible <b>padding</b> bytes inside a struct so fields line up in memory. Two different chips could pad differently, and then the bytes on the radio would not match. <code>__attribute__((packed))</code> forbids padding:' },
      { t: 'code', code: R`struct __attribute__((packed)) BudgetMsg {
  uint8_t  type;
  uint8_t  nodeId;
  uint8_t  allowed;
  uint16_t eventId;
  uint8_t  photos;
  uint8_t  intervalS;
  uint8_t  frameSize;
  uint8_t  jpegQuality;
};` },
      { t: 'num', q: 'What is <code>sizeof(BudgetMsg)</code> in bytes?', a: 9, tol: 0, why: '7 × uint8_t + 1 × uint16_t = 7 + 2 = 9. (Checked by compiling the header when this app was built.)' },
      { t: 'code', code: R`struct __attribute__((packed)) ChunkMsg {
  uint8_t  type;  uint8_t nodeId;  uint8_t photoIdx;
  uint16_t chunkIdx;
  uint8_t  len;
  uint8_t  data[200];
};
#define CHUNK_HEADER_LEN (offsetof(ChunkMsg, data))` },
      { t: 'num', q: '<code>offsetof(ChunkMsg, data)</code> — how many bytes come before <code>data</code>?', a: 6, tol: 0, why: '1 + 1 + 1 + 2 + 1 = 6. The node sends 6 + n bytes, not the full 206, for the last short chunk.' },
      { t: 'mcq', q: 'Is a full ChunkMsg (206 bytes) allowed in one ESP-NOW v1 frame?', opts: ['Yes, the v1 limit is 250 bytes [DS, EN]', 'No, the limit is 128 bytes', 'Only with encryption'], a: 0 }
    ]}
  ]
});

M.push({
  id: 'ptr', icon: '👉', title: 'Pointers, callbacks and timing',
  summary: 'Addresses, ->, casting bytes to structs, callbacks, volatile and non-blocking waits.',
  lessons: [
    { id: 'ptr-1', title: 'Addresses and pointers', blocks: [
      { t: 'p', html: 'Every variable has an <b>address</b> in memory. <code>&amp;x</code> gives the address; a <b>pointer</b> stores one; <code>*p</code> reads what it points to; <code>p-&gt;field</code> reads a field of the struct it points to.' },
      { t: 'code', code: R`HelloMsg hello = {MSG_HELLO, 2, 1};
HelloMsg *p = &hello;     // p holds hello's address
p->nodeId = 3;            // same as hello.nodeId = 3

// Sending a struct: pass its address and its size, viewed as bytes
esp_now_send(HUB_MAC, (const uint8_t *)&hello, sizeof(hello));

// Receiving: view the incoming bytes as a struct (after checking the length!)
const AckMsg *a = (const AckMsg *)data;
if (a->ok) { ... }` },
      { t: 'p', html: '<code>const</code> in <code>const uint8_t *data</code> promises you won\'t modify the bytes through that pointer.' },
      { t: 'fill', q: 'Send the DoneMsg called <code>done</code>.', code: R`esp_now_send(HUB_MAC, (const uint8_t *){{&done}}, {{sizeof(done)}});`, why: 'Address + byte count is how C hands raw memory around.' },
      { t: 'mcq', q: 'In <code>void onDataRecv(const esp_now_recv_info_t *info, …)</code>, how do you read the sender MAC?', opts: ['<code>info.src_addr</code>', '<code>info-&gt;src_addr</code>', '<code>*info.src_addr</code>'], a: 1, why: 'info is a pointer, so use ->. (Recorded in REFERENCE §7 from your compiler.)' }
    ]},
    { id: 'ptr-2', title: 'Callbacks and the core 3.3.8 signatures', blocks: [
      { t: 'p', html: 'A <b>callback</b> is a function you give to a library to call later. You register it by name (the name, without parentheses, is a pointer to the function):' },
      { t: 'code', code: R`void onDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) { ... }
void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) { ... }

esp_now_register_send_cb(onDataSent);
esp_now_register_recv_cb(onDataRecv);` },
      { t: 'note', kind: 'fact', title: 'Measured on your setup (M-09)', html: 'Core 3.3.8\'s compiler required exactly these parameter types. Most online tutorials use older signatures (lesson 4). If your compiler ever disagrees, the compiler wins — write it down.' },
      { t: 'bug', q: 'This came from a 2021 tutorial. Which line fails to compile on core 3.3.8?', code: R`#include <esp_now.h>
void onDataRecv(const uint8_t *mac, const uint8_t *data, int len) {
  Serial.println(len);
}
void setup() {
  esp_now_register_recv_cb(onDataRecv);
}`, a: 1, why: 'Core 3.x passes const esp_now_recv_info_t *info as the first parameter; the MAC is info->src_addr.' }
    ]},
    { id: 'ptr-3', title: 'volatile and other tasks', blocks: [
      { t: 'p', html: 'The ESP-NOW callbacks run in the <b>Wi-Fi task</b>, a separate thread of execution, not inside your <code>setup()</code> [DS, EN]. Espressif advises against lengthy work there and suggests passing data on through a queue [DS, EN].' },
      { t: 'p', html: 'When a callback sets a flag that your code is waiting on, mark it <code>volatile</code>. Otherwise the compiler may read it once, keep it in a register, and your wait loop never sees the change.' },
      { t: 'code', code: R`volatile bool txDone = false;      // written in the callback, read in setup()

void onDataSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  txOk = (status == ESP_NOW_SEND_SUCCESS);
  txDone = true;                   // short and quick
}` },
      { t: 'p', html: 'The node only stores small flags. The hub receives many chunks, so its callback copies each frame into a <b>FreeRTOS queue</b> and returns at once; the main code takes frames out of the queue:' },
      { t: 'code', code: R`QueueHandle_t rxQueue = xQueueCreate(48, sizeof(RxItem));   // 48 slots

void onDataRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  RxItem it;  memcpy(it.mac, info->src_addr, 6);  it.len = len;  memcpy(it.data, data, len);
  xQueueSend(rxQueue, &it, 0);     // 0 = never block inside a callback
}
// in the main code:
if (xQueueReceive(rxQueue, &it, pdMS_TO_TICKS(20)) == pdTRUE) handleMessage(it);` },
      { t: 'multi', q: 'Which of these belong in an ESP-NOW receive callback?', opts: ['Copy the bytes somewhere', 'Set a volatile flag', 'Write a photo to flash', 'Wait 1 s for the next frame', 'Push the frame into a queue'], a: [0, 1, 4], why: 'Slow work (flash writes, delays) blocks the Wi-Fi task and frames get lost.' }
    ]},
    { id: 'ptr-4', title: 'Waiting without getting stuck', blocks: [
      { t: 'p', html: '<code>delay(ms)</code> pauses your code (other tasks, like Wi-Fi, keep running). A <b>wait with timeout</b> polls a condition and gives up after a limit — the most common pattern in this firmware:' },
      { t: 'code', code: R`bool sendAndWait(const void *msg, size_t len) {
  for (int attempt = 0; attempt < SEND_RETRIES; attempt++) {     // bounded retries
    txDone = false;
    if (esp_now_send(HUB_MAC, (const uint8_t *)msg, len) == ESP_OK) {
      unsigned long t0 = millis();
      while (!txDone && millis() - t0 < SEND_TIMEOUT_MS) delay(1); // bounded wait
      if (txDone && txOk) return true;
    } else {
      delay(5);
    }
  }
  return false;
}` },
      { t: 'num', q: 'Worst case: SEND_RETRIES = 5 and SEND_TIMEOUT_MS = 100. Roughly how many ms can one sendAndWait() take before giving up?', a: 500, tol: 30, why: '5 attempts × 100 ms ≈ 500 ms (plus small overheads).' },
      { t: 'order', q: 'Order the steps of one bounded attempt.', items: ['Clear the done flag', 'Call esp_now_send()', 'Note the start time', 'Poll the flag until it is set or the timeout passes', 'Return true if the send succeeded, else try again'] }
    ]}
  ]
});
})();
