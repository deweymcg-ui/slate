// Generates build/icon.png (1024×1024) — dark slate rounded square with a
// glowing tungsten diamond. Pure Node: math-drawn pixels + hand-rolled PNG.

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const SIZE = 1024
const px = new Uint8Array(SIZE * SIZE * 4)

const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// Signed distance to a rounded rectangle centered at (cx,cy).
function sdRoundRect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - (hw - r)
  const qy = Math.abs(y - cy) - (hh - r)
  const ox = Math.max(qx, 0)
  const oy = Math.max(qy, 0)
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r
}

const DIA_C = [512, 452] // diamond center
const DIA_HALF = 170 // half-size of the (pre-rotation) square
const DIA_R = 34 // corner radius

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4

    // --- Background: rounded square, vertical gradient ---
    const dBg = sdRoundRect(x, y, 512, 512, 512, 512, 224)
    const bgAlpha = clamp(0.5 - dBg, 0, 1) // 1px AA edge
    if (bgAlpha <= 0) {
      px[i + 3] = 0
      continue
    }
    const t = y / SIZE
    let rC = lerp(0x16, 0x0a, t)
    let gC = lerp(0x18, 0x0b, t)
    let bC = lerp(0x1d, 0x0e, t)

    // --- Tungsten radial glow behind the diamond ---
    const gd = Math.hypot(x - 512, y - 480)
    const glow = Math.pow(clamp(1 - gd / 560, 0, 1), 2) * 0.30
    rC += (0xe3 - rC) * glow
    gC += (0xb3 - gC) * glow
    bC += (0x41 - bC) * glow * 0.6

    // --- Diamond: rotate the sample point by -45° around its center ---
    const c = Math.SQRT1_2
    const rx = DIA_C[0] + (x - DIA_C[0]) * c + (y - DIA_C[1]) * c
    const ry = DIA_C[1] - (x - DIA_C[0]) * c + (y - DIA_C[1]) * c
    const dDia = sdRoundRect(rx, ry, DIA_C[0], DIA_C[1], DIA_HALF, DIA_HALF, DIA_R)

    // Soft outer glow from the diamond edge
    if (dDia > 0 && dDia < 150) {
      const halo = Math.pow(1 - dDia / 150, 2.4) * 0.45
      rC += (0xe8 - rC) * halo
      gC += (0xb6 - gC) * halo
      bC += (0x48 - bC) * halo * 0.55
    }

    // Diamond fill: diagonal gradient bright→deep tungsten
    if (dDia < 0.5) {
      const cover = clamp(0.5 - dDia, 0, 1)
      const gt = clamp((rx - (DIA_C[0] - DIA_HALF)) / (2 * DIA_HALF) * 0.5 + (ry - (DIA_C[1] - DIA_HALF)) / (2 * DIA_HALF) * 0.5, 0, 1)
      const dr = lerp(0xf2, 0xc8, gt)
      const dg = lerp(0xc8, 0x95, gt)
      const db = lerp(0x55, 0x2e, gt)
      rC = lerp(rC, dr, cover)
      gC = lerp(gC, dg, cover)
      bC = lerp(bC, db, cover)
    }

    px[i] = Math.round(clamp(rC, 0, 255))
    px[i + 1] = Math.round(clamp(gC, 0, 255))
    px[i + 2] = Math.round(clamp(bC, 0, 255))
    px[i + 3] = Math.round(bgAlpha * 255)
  }
}

// --- PNG encode (8-bit RGBA, filter 0) ---
const crcTable = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  crcTable[n] = c
}
function crc32(buf) {
  let c = -1
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bit depth
ihdr[9] = 6 // RGBA
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  Buffer.from(px.buffer, y * SIZE * 4, SIZE * 4).copy(raw, y * (SIZE * 4 + 1) + 1)
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../build/icon.png')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, png)
console.log(`wrote ${out} (${(png.length / 1024).toFixed(0)} KB)`)
