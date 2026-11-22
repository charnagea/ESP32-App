// SmartPostProtocol.h — the messages the camera nodes and the hub exchange over ESP-NOW.
// The SAME file sits in both sketch folders (SmartPost_Node and SmartPost_Hub).
// If you change one copy, copy it to the other. CI checks that they are identical.
//
// Vineyard Smart Post · course reference solution · UNTESTED on hardware (📐)

#pragma once
#include <stdint.h>
#include <stddef.h>

#define ESPNOW_CHANNEL   1      // both boards must use the same Wi-Fi channel
#define CHUNK_DATA_MAX   200    // image bytes per chunk; header + 200 fits ESP-NOW v1's 250-byte limit [DS, REFERENCE §7]

// Every message starts with one byte saying what it is.
enum MsgType : uint8_t {
  MSG_HELLO       = 1,  // node -> hub : "I woke up, may I capture?"
  MSG_BUDGET      = 2,  // hub  -> node: "yes/no, and this many photos"
  MSG_PHOTO_START = 3,  // node -> hub : size and CRC of the next photo
  MSG_CHUNK       = 4,  // node -> hub : one piece of the photo
  MSG_PHOTO_END   = 5,  // node -> hub : "that was the last chunk"
  MSG_ACK         = 6,  // hub  -> node: "photo arrived intact" (or not)
  MSG_DONE        = 7   // node -> hub : "event finished, I'm switching off"
};

// Our own frame-size codes, so the hub doesn't need the camera library.
enum FrameSizeCode : uint8_t { FS_VGA = 0, FS_SVGA = 1, FS_XGA = 2 };

// __attribute__((packed)) = no padding bytes between fields,
// so both chips lay the bytes out identically.
struct __attribute__((packed)) HelloMsg {
  uint8_t type;      // MSG_HELLO
  uint8_t nodeId;    // 1..4
  uint8_t pirHigh;   // PIR OUT level when the node booted
};

struct __attribute__((packed)) BudgetMsg {
  uint8_t  type;        // MSG_BUDGET
  uint8_t  nodeId;
  uint8_t  allowed;     // 0 = refused, 1 = go
  uint16_t eventId;
  uint8_t  photos;      // how many photos this event
  uint8_t  intervalS;   // seconds between photos
  uint8_t  frameSize;   // FrameSizeCode
  uint8_t  jpegQuality; // 10 (best) .. 63 (smallest)
};

struct __attribute__((packed)) PhotoStartMsg {
  uint8_t  type;        // MSG_PHOTO_START
  uint8_t  nodeId;
  uint16_t eventId;
  uint8_t  photoIdx;
  uint32_t totalLen;    // bytes in the JPEG
  uint32_t crc32;       // CRC-32 of the whole JPEG
  uint16_t chunkCount;
};

struct __attribute__((packed)) ChunkMsg {
  uint8_t  type;        // MSG_CHUNK
  uint8_t  nodeId;
  uint8_t  photoIdx;
  uint16_t chunkIdx;
  uint8_t  len;         // bytes used in data[]
  uint8_t  data[CHUNK_DATA_MAX];
};

struct __attribute__((packed)) PhotoEndMsg {
  uint8_t type;         // MSG_PHOTO_END
  uint8_t nodeId;
  uint8_t photoIdx;
};

struct __attribute__((packed)) AckMsg {
  uint8_t type;         // MSG_ACK
  uint8_t nodeId;
  uint8_t photoIdx;
  uint8_t ok;           // 1 = stored, 0 = resend
};

struct __attribute__((packed)) DoneMsg {
  uint8_t type;         // MSG_DONE
  uint8_t nodeId;
  uint8_t photosSent;
};

// Bytes actually sent for a chunk: the header plus only the used data.
#define CHUNK_HEADER_LEN (offsetof(ChunkMsg, data))

// Standard CRC-32 (the one ZIP files use). Call with crc = 0 the first time;
// pass the previous result to continue over more bytes.
inline uint32_t crc32Update(uint32_t crc, const uint8_t *buf, size_t len) {
  crc = ~crc;
  while (len--) {
    crc ^= *buf++;
    for (int k = 0; k < 8; k++) {
      crc = (crc >> 1) ^ (0xEDB88320u & (0u - (crc & 1u)));
    }
  }
  return ~crc;
}
