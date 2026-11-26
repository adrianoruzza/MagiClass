import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

/**
 * Core inner illustration elements of the official MagiClass icon (512x512 coordinate space).
 * Faithful 1:1 reproduction of the provided MagiClass artwork:
 * - Black header bar with white centered "MagiClass" wordmark
 * - Warm cream body (#f3ede1)
 * - Row 1 left: 3 terracotta circles + sage-green pill bar underneath
 * - Row 1/2 right: 1 terracotta/steel-blue split circle + 1 steel-blue circle
 * - Row 2: 2 brick-red/navy split circles + 3 steel-blue circles
 * - Row 3: 4 deep-blue circles
 * - Bottom-right black quarter-curve corner with crisp geometric "AR" monogram
 */
const buildInnerArtwork = () => `
  <!-- Warm cream body background -->
  <rect x="0" y="0" width="512" height="512" fill="#f3ede1" />

  <!-- Top black header bar -->
  <rect x="0" y="0" width="512" height="134" fill="#0c0c0c" />

  <!-- Wordmark "MagiClass" -->
  <text
    x="256"
    y="96"
    text-anchor="middle"
    fill="#ffffff"
    font-family="'Outfit', 'Noto Sans', 'Liberation Sans', 'DejaVu Sans', sans-serif"
    font-size="80"
    font-weight="600"
    letter-spacing="-1"
  >MagiClass</text>

  <!-- Row 1 Left: 3 solid terracotta circles -->
  <circle cx="84" cy="201" r="32" fill="#d87a56" />
  <circle cx="163" cy="201" r="32" fill="#d87a56" />
  <circle cx="242" cy="201" r="32" fill="#d87a56" />

  <!-- Row 1 Left: sage-green horizontal pill bar -->
  <rect x="52" y="246" width="222" height="20" rx="10" fill="#a9c1a6" />

  <!-- Row 1/2 Right: 1 split terracotta/steel-blue circle + 1 solid steel-blue circle -->
  <circle cx="342" cy="233" r="32" fill="#5988b5" />
  <path d="M 310 233 A 32 32 0 0 1 374 233 Z" fill="#d87a56" />
  <circle cx="428" cy="233" r="32" fill="#5988b5" />

  <!-- Row 2: 2 brick-red/deep-navy split circles (top ~44%, bottom ~56%) -->
  <circle cx="84" cy="323" r="32" fill="#234d75" />
  <path d="M 52.25 319 A 32 32 0 0 1 115.75 319 Z" fill="#b5524c" />

  <circle cx="170" cy="323" r="32" fill="#234d75" />
  <path d="M 138.25 319 A 32 32 0 0 1 201.75 319 Z" fill="#b5524c" />

  <!-- Row 2 Right: 3 solid steel-blue circles -->
  <circle cx="256" cy="323" r="32" fill="#5685b2" />
  <circle cx="342" cy="323" r="32" fill="#5685b2" />
  <circle cx="428" cy="323" r="32" fill="#5685b2" />

  <!-- Row 3: 4 solid deep-blue circles -->
  <circle cx="84" cy="414" r="32" fill="#285987" />
  <circle cx="170" cy="414" r="32" fill="#285987" />
  <circle cx="256" cy="414" r="32" fill="#285987" />
  <circle cx="342" cy="414" r="32" fill="#285987" />

  <!-- Bottom-right black quarter-curve wedge -->
  <path d="M 512 378 A 134 134 0 0 0 378 512 L 512 512 Z" fill="#0c0c0c" />

  <!-- Crisp geometric white "AR" monogram inside corner wedge -->
  <path
    fill="#ffffff"
    fill-rule="evenodd"
    d="M 442 444 L 449.5 444 L 454.5 481 L 447 481 L 445.8 473.5 L 432 473.5 L 427.4 481 L 419 481 Z M 443.4 453 L 435.6 467 L 444.8 467 Z"
  />
  <path
    fill="#ffffff"
    fill-rule="evenodd"
    d="M 458.5 444 L 473 444 C 480.4 444 485 448.1 485 454.8 C 485 460.1 481.8 463.7 476.6 465 L 486.2 481 L 477.8 481 L 469.2 465.8 L 466 465.8 L 466 481 L 458.5 481 Z M 466 450.4 L 466 459.8 L 472.6 459.8 C 476.2 459.8 478 458 478 455 C 478 452 476.2 450.4 472.6 450.4 Z"
  />
`;

// Standard SVG (rounded card with thin dark border and transparent outer corners)
const standardSvg = `<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="magiclass-card-clip">
      <rect x="4" y="4" width="504" height="504" rx="74" />
    </clipPath>
  </defs>
  <g clip-path="url(#magiclass-card-clip)">
    ${buildInnerArtwork()}
  </g>
  <rect x="4" y="4" width="504" height="504" rx="74" stroke="#0c0c0c" stroke-width="2.5" fill="none" />
</svg>`;

// Opaque square SVG for Apple Touch Icon (iOS applies its own squircle mask; opaque corners avoid black corner artifacts)
const appleTouchSvg = `<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${buildInnerArtwork()}
</svg>`;

// Maskable SVG with full-bleed background and centered artwork inside the 80% circular safe zone
const maskableSvg = `<svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <clipPath id="magiclass-mask-card-clip">
      <rect x="4" y="4" width="504" height="504" rx="74" />
    </clipPath>
  </defs>
  <!-- Full-bleed warm cream background matching the card body -->
  <rect width="512" height="512" fill="#f3ede1" />
  <!-- Centered scaled card (72%) well within the 80% safe zone -->
  <g transform="translate(71.68, 71.68) scale(0.72)">
    <g clip-path="url(#magiclass-mask-card-clip)">
      ${buildInnerArtwork()}
    </g>
    <rect x="4" y="4" width="504" height="504" rx="74" stroke="#0c0c0c" stroke-width="2.5" fill="none" />
  </g>
</svg>`;

async function generate() {
  const svgBuffer = Buffer.from(standardSvg);
  const appleTouchBuffer = Buffer.from(appleTouchSvg);
  const maskableSvgBuffer = Buffer.from(maskableSvg);

  // Write SVGs to public
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), standardSvg);
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), standardSvg);

  // Generate PNGs
  const tasks = [
    { name: 'favicon-16x16.png', size: 16, buffer: svgBuffer },
    { name: 'favicon-32x32.png', size: 32, buffer: svgBuffer },
    { name: 'pwa-64x64.png', size: 64, buffer: svgBuffer },
    { name: 'apple-touch-icon.png', size: 180, buffer: appleTouchBuffer },
    { name: 'pwa-192x192.png', size: 192, buffer: svgBuffer },
    { name: 'pwa-512x512.png', size: 512, buffer: svgBuffer },
    { name: 'pwa-maskable-192x192.png', size: 192, buffer: maskableSvgBuffer },
    { name: 'pwa-maskable-512x512.png', size: 512, buffer: maskableSvgBuffer },
  ];

  for (const task of tasks) {
    await sharp(task.buffer, { density: 300 })
      .resize(task.size, task.size)
      .png()
      .toFile(path.join(publicDir, task.name));
    console.log(`Generated ${task.name}`);
  }

  // Generate favicon.ico in public/ and sync root favicon.ico if it exists
  await sharp(svgBuffer, { density: 300 })
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Generated public/favicon.ico');

  const rootFaviconPath = path.resolve('favicon.ico');
  if (fs.existsSync(rootFaviconPath)) {
    await sharp(svgBuffer, { density: 300 })
      .resize(32, 32)
      .png()
      .toFile(rootFaviconPath);
    console.log('Updated root favicon.ico');
  }
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
