import sharp from "sharp";
import { fileURLToPath } from "node:url";

const publicDir = fileURLToPath(new URL("../../public/", import.meta.url));
const iconSource = `${publicDir}images/orenza-app-icon.svg`;

await Promise.all([
  [180, "orenza-app-icon-180.png"],
  [192, "orenza-app-icon-192.png"],
  [512, "orenza-app-icon-512.png"]
].map(([size, name]) => sharp(iconSource)
  .resize(Number(size), Number(size))
  .png({ compressionLevel: 9 })
  .toFile(`${publicDir}images/${name}`)));

const socialBackground = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0b2019"/>
        <stop offset=".6" stop-color="#173f33"/>
        <stop offset="1" stop-color="#244e3f"/>
      </linearGradient>
      <radialGradient id="glow" cx="80%" cy="45%" r="55%">
        <stop offset="0" stop-color="#d3a43c" stop-opacity=".18"/>
        <stop offset="1" stop-color="#d3a43c" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect width="1200" height="630" fill="url(#glow)"/>
    <circle cx="1080" cy="70" r="210" fill="none" stroke="#d3a43c" stroke-opacity=".08" stroke-width="2"/>
    <circle cx="95" cy="590" r="170" fill="none" stroke="#ffffff" stroke-opacity=".05" stroke-width="2"/>
    <path d="M74 522H714" stroke="#d3a43c" stroke-opacity=".28"/>
  </svg>
`);

const socialIcon = await sharp(iconSource).resize(310, 310).png().toBuffer();
const wordmark = await sharp(`${publicDir}images/orenza-wordmark-gold-v2.png`)
  .resize({ width: 650 })
  .png()
  .toBuffer();

await sharp(socialBackground)
  .composite([
    { input: wordmark, left: 70, top: 180 },
    { input: socialIcon, left: 805, top: 160 }
  ])
  .png({ compressionLevel: 9 })
  .toFile(`${publicDir}images/orenza-social-preview.png`);

console.log("Orenza app icons and social preview generated.");
