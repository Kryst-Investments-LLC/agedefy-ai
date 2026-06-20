// Generates the PWA icons referenced by public/manifest.webmanifest, with no
// external image dependency — a hand-rolled PNG encoder over Node's zlib.
// Design: dark navy background (#0f172a, the theme color) with a centered
// teal→blue brand orb, matching the app's logo gradient.

import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, "ascii")
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function lerp(a, b, t) { return Math.round(a + (b - a) * t) }

function makePng(size, { padding = 0 } = {}) {
  // colors
  const bg = [15, 23, 42] // #0f172a navy
  const teal = [45, 212, 191] // #2dd4bf
  const blue = [96, 165, 250] // #60a5fa
  const cx = size / 2
  const cy = size / 2
  const r = (size / 2) * (0.66 - padding) // orb radius

  const raw = Buffer.alloc((size * 4 + 1) * size)
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      let col
      if (dist <= r) {
        // teal→blue diagonal gradient inside the orb
        const t = (x + y) / (2 * size)
        col = [lerp(teal[0], blue[0], t), lerp(teal[1], blue[1], t), lerp(teal[2], blue[2], t)]
        // soft edge
        if (dist > r - 2) {
          const k = (r - dist) / 2
          col = [lerp(bg[0], col[0], k), lerp(bg[1], col[1], k), lerp(bg[2], col[2], k)]
        }
      } else {
        col = bg
      }
      raw[o++] = col[0]
      raw[o++] = col[1]
      raw[o++] = col[2]
      raw[o++] = 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const dir = new URL("../public/icons/", import.meta.url)
mkdirSync(dir, { recursive: true })

const out = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  // maskable: extra padding so the orb stays inside the platform's safe zone
  ["icon-maskable-192.png", 192, { padding: 0.18 }],
  ["icon-maskable-512.png", 512, { padding: 0.18 }],
]
for (const [name, size, opts] of out) {
  writeFileSync(new URL(name, dir), makePng(size, opts))
  console.log("wrote public/icons/" + name)
}
