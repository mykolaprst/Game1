// Slices the generated source art in assets-src/ into the web-ready files in public/assets/.
//   npm run assets
// Source sheets are grids with thin white gutters; each cell is cropped with a small inset to drop the gutter.
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';

const SRC = new URL('../assets-src/', import.meta.url).pathname;
const OUT = new URL('../public/assets/', import.meta.url).pathname;
await mkdir(OUT, { recursive: true });

const people = JSON.parse(await readFile(new URL('../src/data/people.json', import.meta.url)));

async function cells(file, cols, rows, inset = 0.018) {
  const img = sharp(SRC + file);
  const { width, height } = await img.metadata();
  const cw = width / cols;
  const ch = height / rows;
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = Math.round(c * cw + cw * inset);
      const top = Math.round(r * ch + ch * inset);
      out.push(sharp(SRC + file).extract({
        left, top, width: Math.round(cw * (1 - 2 * inset)), height: Math.round(ch * (1 - 2 * inset)),
      }));
    }
  }
  return out;
}
const webp = (img, name, opts = { quality: 80 }) => img.webp(opts).toFile(`${OUT}${name}.webp`);

// App icon
await webp(sharp(SRC + 'icon.png').resize(512, 512), 'icon-512');
await webp(sharp(SRC + 'icon.png').resize(192, 192), 'icon-192');

// Era backdrops
for (const era of ['silent', 'sound', 'blockbuster']) {
  await webp(sharp(SRC + `bg-${era}.png`).resize(1200), `bg-${era}`, { quality: 74 });
}

// Posters: three 2x2 sheets plus the regenerated comedy poster
const posterNames = {
  'posters-a.png': [null, 'drama', 'western', 'romance'], // top-left (comedy) replaced by poster-comedy.png
  'posters-b.png': ['adventure', 'horror', 'musical', 'crime'],
  'posters-c.png': ['war', 'scifi', 'premiere', 'closed'],
};
for (const [file, names] of Object.entries(posterNames)) {
  const list = await cells(file, 2, 2, 0.012);
  for (let i = 0; i < names.length; i++) {
    if (names[i]) await webp(list[i].resize(400, 600, { fit: 'cover' }), `poster-${names[i]}`, { quality: 78 });
  }
}
await webp(sharp(SRC + 'poster-comedy.png').resize(400, 600, { fit: 'cover' }), 'poster-comedy', { quality: 78 });

// Event illustrations: 3x2
const eventNames = ['newsreel', 'talkies', 'crash', 'television', 'strike', 'summer'];
const ev = await cells('events.png', 3, 2, 0.012);
for (let i = 0; i < eventNames.length; i++) await webp(ev[i].resize(480, 480, { fit: 'cover' }), `event-${eventNames[i]}`);

// Portraits: four 4x3 sheets, one per generation, in the order people appear in people.json
for (let g = 0; g < 4; g++) {
  const list = await cells(`people-g${g + 1}.png`, 4, 3, 0.02);
  for (let i = 0; i < 12; i++) {
    const p = people[g * 12 + i];
    await webp(list[i].resize(192, 192, { fit: 'cover' }), `person-${p.id}`, { quality: 82 });
  }
}

// Transparent sprites: 4x2, trimmed to their content
const spriteNames = ['writing', 'production', 'camera', 'post', 'marketing', 'research', 'coins', 'star'];
const sp = await cells('sprites.png', 4, 2, 0.035);
for (let i = 0; i < spriteNames.length; i++) {
  const buf = await sp[i].png().toBuffer();
  const trimmed = await sharp(buf).trim({ threshold: 8 }).toBuffer();
  await webp(sharp(trimmed).resize(200, 200, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }), `sprite-${spriteNames[i]}`, { quality: 86 });
}
console.log('assets built into public/assets');
