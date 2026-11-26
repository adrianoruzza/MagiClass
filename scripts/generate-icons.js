import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const sourceImagePath = path.resolve('public/assets/aistudio/MagiClass_5ece652f.png');
const publicDir = path.resolve('public');

if (!fs.existsSync(sourceImagePath)) {
  console.error(`Source icon not found at ${sourceImagePath}`);
  process.exit(1);
}

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

/**
 * Builds a valid multi-resolution ICO binary embedding PNG frames (16x16, 32x32, 48x48).
 */
function buildIcoBuffer(pngFrames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(pngFrames.length, 4); // Image count

  const dirEntries = [];
  let offset = 6 + pngFrames.length * 16;

  for (const frame of pngFrames) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 0); // Width
    entry.writeUInt8(frame.size >= 256 ? 0 : frame.size, 1); // Height
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(frame.data.length, 8); // Image data size
    entry.writeUInt32LE(offset, 12); // Offset in file
    dirEntries.push(entry);
    offset += frame.data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngFrames.map((f) => f.data)]);
}

async function generate() {
  const inputMeta = await sharp(sourceImagePath).metadata();
  const srcWidth = inputMeta.width || 1024;
  const srcHeight = inputMeta.height || 1024;

  // Ensure a centered square crop if the source image is ever non-square
  let squareBuffer;
  if (srcWidth !== srcHeight) {
    const side = Math.min(srcWidth, srcHeight);
    const left = Math.floor((srcWidth - side) / 2);
    const top = Math.floor((srcHeight - side) / 2);
    squareBuffer = await sharp(sourceImagePath)
      .extract({ left, top, width: side, height: side })
      .png()
      .toBuffer();
  } else {
    squareBuffer = await sharp(sourceImagePath).png().toBuffer();
  }

  // Standard transparent-corner PNG icons (contain, zero distortion/clipping)
  const standardSizes = [
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'pwa-64x64.png', size: 64 },
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'app-icon.png', size: 512 },
  ];

  for (const task of standardSizes) {
    await sharp(squareBuffer)
      .resize(task.size, task.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(path.join(publicDir, task.name));
    console.log(`Generated ${task.name} (${task.size}x${task.size})`);
  }

  // Apple Touch Icon (180x180 with matching app burgundy background so iOS squircle has no dark artifacts)
  await sharp(squareBuffer)
    .resize(180, 180, {
      fit: 'contain',
      background: { r: 129, g: 0, b: 39, alpha: 1 },
    })
    .flatten({ background: '#810027' })
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png (180x180)');

  // Maskable PWA icons (80% centered artwork inside full-bleed #810027 safe zone)
  for (const maskSize of [192, 512]) {
    const innerSize = Math.round(maskSize * 0.78);
    const innerIcon = await sharp(squareBuffer)
      .resize(innerSize, innerSize, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: maskSize,
        height: maskSize,
        channels: 4,
        background: { r: 129, g: 0, b: 39, alpha: 1 },
      },
    })
      .composite([{ input: innerIcon, gravity: 'center' }])
      .png()
      .toFile(path.join(publicDir, `pwa-maskable-${maskSize}x${maskSize}.png`));
    console.log(`Generated pwa-maskable-${maskSize}x${maskSize}.png`);
  }

  // Multi-resolution favicon.ico (16x16, 32x32, 48x48) in public/ and root
  const icoFrames = [];
  for (const size of [16, 32, 48]) {
    const data = await sharp(squareBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    icoFrames.push({ size, data });
  }
  const icoBuffer = buildIcoBuffer(icoFrames);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuffer);
  console.log('Generated public/favicon.ico');

  const rootFaviconPath = path.resolve('favicon.ico');
  fs.writeFileSync(rootFaviconPath, icoBuffer);
  console.log('Updated root favicon.ico');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
