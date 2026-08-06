import sharp from 'sharp'
import { mkdirSync } from 'fs'

const SRC = 'public/Logo.png'
const BRAND_INK = '#181410'

mkdirSync('public', { recursive: true })

async function iconTransparent(size, outPath) {
  await sharp(SRC)
    .resize(Math.round(size * 0.8), Math.round(size * 0.8), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.round(size * 0.1), bottom: Math.round(size * 0.1),
      left: Math.round(size * 0.1), right: Math.round(size * 0.1),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outPath)
  console.log('wrote', outPath)
}

async function iconMaskable(size, outPath) {
  const logo = await sharp(SRC)
    .resize(Math.round(size * 0.6), Math.round(size * 0.6), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_INK },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(outPath)
  console.log('wrote', outPath)
}

async function iconSolid(size, outPath) {
  const logo = await sharp(SRC)
    .resize(Math.round(size * 0.75), Math.round(size * 0.75), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND_INK },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(outPath)
  console.log('wrote', outPath)
}

await iconTransparent(192, 'public/pwa-192x192.png')
await iconTransparent(512, 'public/pwa-512x512.png')
await iconMaskable(512, 'public/pwa-maskable-512x512.png')
await iconSolid(180, 'public/apple-touch-icon.png')
await iconSolid(32, 'public/favicon-32x32.png')
