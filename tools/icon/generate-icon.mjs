// Generate a branded 512x512 app icon (pine-green ledger notebook) as a PNG.
//   node tools/icon/generate-icon.mjs  ->  build/icon.png
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const S = 512
const here = dirname(fileURLToPath(import.meta.url))

// Palette
const PINE = [15, 122, 84]
const SPINE = [11, 92, 63]
const WHITE = [247, 247, 245]
const LINE = [15, 122, 84]

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

function pixel(x, y) {
  // Rounded green background
  if (!inRoundedRect(x, y, 0, 0, S - 1, S - 1, 96)) return [0, 0, 0, 0]
  // Notebook body
  const bx0 = 150, by0 = 104, bx1 = 372, by1 = 408
  if (inRoundedRect(x, y, bx0, by0, bx1, by1, 20)) {
    if (x < bx0 + 34) return [...SPINE, 255] // spine
    // Ledger lines
    for (const ly of [180, 236, 292, 348]) {
      if (y >= ly && y < ly + 10 && x >= bx0 + 60 && x <= bx1 - 26) return [...LINE, 255]
    }
    return [...WHITE, 255]
  }
  return [...PINE, 255]
}

// Build raw RGBA scanlines with a 0 filter byte per row.
const raw = Buffer.alloc(S * (1 + S * 4))
let o = 0
for (let y = 0; y < S; y++) {
  raw[o++] = 0
  for (let x = 0; x < S; x++) {
    const [r, g, b, a] = pixel(x, y)
    raw[o++] = r
    raw[o++] = g
    raw[o++] = b
    raw[o++] = a
  }
}

// CRC32
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return (buf) => {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
})()

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(CRC(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(S, 0)
ihdr.writeUInt32BE(S, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

mkdirSync(join(here, '..', '..', 'build'), { recursive: true })
const out = join(here, '..', '..', 'build', 'icon.png')
writeFileSync(out, png)
console.log(`Wrote ${out} (${png.length} bytes)`)
