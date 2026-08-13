import QRCode from 'qrcode'
import { mkdirSync } from 'fs'

// Usage : node scripts/generate-qr-code.mjs [url] [outPath] [--width=1200] [--dark=#181410] [--light=#F3ECDC]
// Sans argument : génère le QR code de la page recrutement dans qr-codes/recrutement.png

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const flags = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => a.replace(/^--/, '').split('='))
)

const url = args[0] ?? 'https://pompiers-lamadeleine.fr/recrutement'
const outPath = args[1] ?? 'qr-codes/recrutement.png'
const width = flags.width ? Number(flags.width) : 1200
const dark = flags.dark ?? '#181410'
const light = flags.light ?? '#F3ECDC'

mkdirSync(outPath.split('/').slice(0, -1).join('/') || '.', { recursive: true })

await QRCode.toFile(outPath, url, {
  errorCorrectionLevel: 'H',
  width,
  margin: 2,
  color: { dark, light },
})

console.log('QR code généré :', outPath, '->', url)
