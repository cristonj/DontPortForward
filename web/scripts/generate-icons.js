/* eslint-disable @typescript-eslint/no-require-imports */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const logoPath = path.join(publicDir, 'logo.svg');

async function generateIcons() {
  console.log('Generating icons from logo.svg...');

  // Read the SVG
  const svgBuffer = fs.readFileSync(logoPath);

  // Generate favicon.ico (multiple sizes)
  console.log('Generating favicon.ico...');
  const faviconSizes = [16, 32, 48];
  const faviconImages = await Promise.all(
    faviconSizes.map(size =>
      sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );

  // Create ICO file (simplified - using first size as ICO)
  // For a proper ICO, we'd need a library, but browsers accept PNG as favicon
  fs.writeFileSync(
    path.join(publicDir, 'favicon.ico'),
    faviconImages[1] // Use 32x32 for favicon
  );

  // Generate Apple touch icon (180x180)
  console.log('Generating apple-touch-icon.png...');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // Generate PWA icons
  const pwaSizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ];

  for (const { size, name } of pwaSizes) {
    console.log(`Generating ${name}...`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, name));
  }

  // Generate additional sizes for better coverage
  const additionalSizes = [
    { size: 144, name: 'icon-144.png' },
    { size: 384, name: 'icon-384.png' },
  ];

  for (const { size, name } of additionalSizes) {
    console.log(`Generating ${name}...`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(publicDir, name));
  }

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
