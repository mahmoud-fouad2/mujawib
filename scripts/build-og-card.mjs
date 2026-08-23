/**
 * Builds the 1200×630 link preview cards.
 *
 *   pnpm og:build
 *
 * The site used to point og:image at the horizontal wordmark — 1319×382, a
 * 3.45:1 strip declared as `summary_large_image`, which expects about 1.91:1.
 * Every platform that renders a large card crops it to fit, and WhatsApp,
 * where most of these links are actually sent, cropped hardest. A card built
 * at the right ratio says something on its own instead.
 *
 * Output is committed, so this only needs running when the wordmark or the
 * headline changes. It needs IBM Plex Sans Arabic visible to fontconfig —
 * the repo ships WOFF2, which fontconfig cannot read, so point FONTCONFIG_FILE
 * at a config listing a directory of the TrueType originals:
 *
 *   https://github.com/IBM/plex/tree/master/packages/plex-sans-arabic
 */
import { resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const brand = resolve(root, 'public', 'images', 'brand')

const W = 1200
const H = 630
const INK = '#0b0d10'
const TEXT = '#f4f6f8'
const MUTED = '#8c94a1'
const VOICE = '#1474ff'

/** XML-escape, so an apostrophe or ampersand in the copy cannot break the SVG. */
function esc(value) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

const cards = [
  {
    file: 'og-card-ar.png',
    rtl: true,
    lines: ['موظف استقبال يرد بالعربية،', 'ويحجز الموعد في نفس المكالمة.'],
    kicker: 'للعيادات والمعارض والشركات · خدمة مُدارة',
  },
  {
    file: 'og-card-en.png',
    rtl: false,
    lines: ['A receptionist that answers', 'in Arabic, and books the slot.'],
    kicker: 'For clinics, showrooms and teams · a managed service',
  },
]

// The wordmark reads at roughly a third of the card; wider makes the card a
// logo with a caption rather than a statement with a signature.
const LOGO_W = 300
const logo = await sharp(resolve(brand, 'logo-horizontal-paper.png'))
  .resize({ width: LOGO_W })
  .toBuffer({ resolveWithObject: true })

for (const card of cards) {
  // Anchor to the reading edge: right in Arabic, left in English. `direction`
  // has to be on the element itself — librsvg renders each <text> in isolation,
  // so without it the trailing full stop jumps to the wrong end of the line.
  const edge = card.rtl ? W - 80 : 80
  const anchor = card.rtl ? 'start' : 'start'
  const dir = card.rtl ? 'rtl' : 'ltr'

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <rect x="${card.rtl ? W - 80 - 96 : 80}" y="446" width="96" height="4" fill="${VOICE}"/>
  <text x="${edge}" y="332" direction="${dir}" text-anchor="${anchor}"
        font-family="IBM Plex Sans Arabic" font-weight="600" font-size="58"
        fill="${TEXT}">${esc(card.lines[0])}</text>
  <text x="${edge}" y="406" direction="${dir}" text-anchor="${anchor}"
        font-family="IBM Plex Sans Arabic" font-weight="600" font-size="58"
        fill="${MUTED}">${esc(card.lines[1])}</text>
  <text x="${edge}" y="516" direction="${dir}" text-anchor="${anchor}"
        font-family="IBM Plex Sans Arabic" font-weight="400" font-size="26"
        fill="${MUTED}">${esc(card.kicker)}</text>
</svg>`

  await sharp(Buffer.from(svg))
    .composite([
      {
        input: logo.data,
        top: 112,
        left: card.rtl ? W - 80 - LOGO_W : 80,
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(resolve(brand, card.file))

  console.log(`built ${card.file}`)
}
