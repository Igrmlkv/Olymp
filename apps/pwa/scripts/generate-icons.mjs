import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/**
 * Renders the PWA icon set from one source drawing, so the icons can always be
 * regenerated instead of living as opaque binaries.
 *
 * Usage: pnpm --filter @olymp/pwa icons
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public', 'icons')

const BG = '#0f172a'
const PEAK = '#fbbf24'
const INNER = '#38bdf8'

/**
 * The mark: a mountain (Олимп) with a second peak inside it.
 * `scale` shrinks the drawing towards the centre; maskable icons need the art
 * inside the inner 80% circle, because launchers crop the corners away.
 * `radius` is the background corner radius, 0 for a full-bleed square.
 * width/height are not redundant with `.resize()`: they set the raster size
 * sharp starts from, and dropping them doubles the output for a softer edge.
 */
function mark(size, { radius, scale }) {
  const pad = (1 - scale) / 2
  const vb = 64
  const inner = `
    <g transform="translate(${vb * pad} ${vb * pad}) scale(${scale})">
      <path d="M12 46 L32 16 L52 46 Z" fill="none" stroke="${PEAK}"
            stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M22 46 L32 31 L42 46" fill="none" stroke="${INNER}"
            stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
    </g>`

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}">
      <rect width="${vb}" height="${vb}" rx="${radius}" fill="${BG}"/>${inner}
    </svg>`,
  )
}

const ICONS = [
  { file: 'icon-192.png', size: 192, radius: 14, scale: 1 },
  { file: 'icon-512.png', size: 512, radius: 14, scale: 1 },
  // Maskable: full-bleed background, art pulled into the safe zone.
  { file: 'icon-512-maskable.png', size: 512, radius: 0, scale: 0.68 },
  // iOS rounds the corners itself.
  { file: 'apple-touch-icon.png', size: 180, radius: 0, scale: 0.86 },
]

await mkdir(OUT, { recursive: true })

for (const { file, size, radius, scale } of ICONS) {
  const png = await sharp(mark(size, { radius, scale }), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toBuffer()
  await writeFile(resolve(OUT, file), png)
  console.log(`${file} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} KB`)
}
