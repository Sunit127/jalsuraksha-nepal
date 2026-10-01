/** Generates PWA / favicon PNGs from the JalSuraksha mark.  node scripts/generate-icons.mjs */
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0f2447"/>
  <g transform="translate(${pad ? 96 : 56} ${pad ? 96 : 56}) scale(${pad ? 10 : 12.5})">
    <path d="M16 2.5 4.5 6.8v8.1c0 7.3 4.9 12.9 11.5 14.6 6.6-1.7 11.5-7.3 11.5-14.6V6.8L16 2.5Z" fill="#1e3a6e"/>
    <path d="M16 8.2c-2.9 3.6-5.3 6.8-5.3 9.6a5.3 5.3 0 0 0 10.6 0c0-2.8-2.4-6-5.3-9.6Z" fill="#38bdf8"/>
    <path d="M13.4 18.4c.3 1.5 1.4 2.5 2.9 2.7" stroke="#e0f2fe" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;

writeFileSync("app/icon.svg", mark(false));
for (const [name, size, pad] of [["icon-192.png", 192, false], ["icon-512.png", 512, false], ["maskable-512.png", 512, true], ["apple-touch-icon.png", 180, false]]) {
  await sharp(Buffer.from(mark(pad))).resize(size, size).png().toFile(`public/icons/${name}`);
}
console.log("icons written");
