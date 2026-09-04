const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 table
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[i] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(12 + len);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crcVal = crc32(buf.subarray(4, 8 + len));
  buf.writeUInt32BE(crcVal, 8 + len);
  return buf;
}

function createPng(width, height, drawFn) {
  const scanlineWidth = width * 4;
  const rawData = Buffer.alloc((scanlineWidth + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (scanlineWidth + 1);
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const color = drawFn(x, y, width, height);
      rawData[pixelOffset] = color[0];     // R
      rawData[pixelOffset + 1] = color[1]; // G
      rawData[pixelOffset + 2] = color[2]; // B
      rawData[pixelOffset + 3] = color[3]; // A
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // Color type: RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Ensure directories
const targetDir = path.resolve(__dirname, '..', 'sample_avatar', 'assets');
fs.mkdirSync(targetDir, { recursive: true });

const W = 600;
const H = 600;
const CX = W / 2;
const CY = H / 2;

// 1. Body
const bodyPng = createPng(W, H, (x, y) => {
  // Head circle (cx: 300, cy: 260, r: 150)
  const dx = x - CX;
  const dy = y - 260;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Body torso (cx: 300, cy: 450, rx: 120, ry: 90)
  const bdx = (x - CX) / 120;
  const bdy = (y - 450) / 90;
  const bDist = Math.sqrt(bdx * bdx + bdy * bdy);

  // Ears (left: 170, 150, right: 430, 150)
  const e1dx = (x - 190) / 40;
  const e1dy = (y - 140) / 70;
  const e1Dist = Math.sqrt(e1dx * e1dx + e1dy * e1dy);

  const e2dx = (x - 410) / 40;
  const e2dy = (y - 140) / 70;
  const e2Dist = Math.sqrt(e2dx * e2dx + e2dy * e2dy);

  // Cat ears outer
  if (e1Dist <= 1.0 || e2Dist <= 1.0) {
    // Ear inner pink
    if (e1Dist <= 0.6 || e2Dist <= 0.6) {
      return [255, 180, 200, 255]; // Pink
    }
    return [70, 60, 95, 255]; // Dark violet outer ear
  }

  // Torso / clothes
  if (bDist <= 1.0) {
    if (bDist >= 0.9) return [40, 35, 60, 255]; // Outline
    return [90, 80, 140, 255]; // Violet sweater
  }

  // Head
  if (dist <= 150) {
    if (dist >= 145) return [50, 45, 70, 255]; // Head outline
    // Cheeks / blush (left: 210, 290, right: 390, 290)
    const c1Dist = Math.hypot(x - 210, y - 290);
    const c2Dist = Math.hypot(x - 390, y - 290);
    if (c1Dist < 25 || c2Dist < 25) {
      return [255, 185, 195, 255]; // Cute blush
    }
    return [255, 240, 230, 255]; // Fair skin tone
  }

  // Hair bangs on top
  if (y < 230 && dist <= 165) {
    return [70, 60, 95, 255];
  }

  return [0, 0, 0, 0]; // Transparent
});
fs.writeFileSync(path.join(targetDir, 'body.png'), bodyPng);

// 2. Eye Open
const eyeOpenPng = createPng(W, H, (x, y) => {
  // Left eye: (230, 250), Right eye: (370, 250), r: 24
  const d1 = Math.hypot(x - 230, y - 250);
  const d2 = Math.hypot(x - 370, y - 250);

  if (d1 <= 24 || d2 <= 24) {
    // Highlights
    const h1 = Math.hypot(x - 224, y - 244);
    const h2 = Math.hypot(x - 364, y - 244);
    if (h1 <= 7 || h2 <= 7) return [255, 255, 255, 255]; // White shine
    return [55, 45, 90, 255]; // Deep purple pupil
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(targetDir, 'eye-open.png'), eyeOpenPng);

// 3. Eye Closed (happy blink ^ ^)
const eyeClosedPng = createPng(W, H, (x, y) => {
  // Curved blink line left: x in [205, 255], y around 250
  const checkBlink = (cx) => {
    const lx = x - cx;
    if (Math.abs(lx) <= 24) {
      const targetY = 250 - (lx * lx) / 80;
      if (Math.abs(y - targetY) <= 3.5) {
        return true;
      }
    }
    return false;
  };

  if (checkBlink(230) || checkBlink(370)) {
    return [50, 40, 75, 255];
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(targetDir, 'eye-closed.png'), eyeClosedPng);

// 4. Mouth Closed (cute cat smile :3)
const mouthClosedPng = createPng(W, H, (x, y) => {
  // Cat curve center 300, y: 310
  const mx = x - 300;
  if (Math.abs(mx) <= 20) {
    const targetY = 310 + Math.abs(mx) * 0.4;
    if (Math.abs(y - targetY) <= 2.5) {
      return [180, 70, 90, 255];
    }
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(targetDir, 'mouth-closed.png'), mouthClosedPng);

// 5. Mouth Open (talking)
const mouthOpenPng = createPng(W, H, (x, y) => {
  // Open smiling mouth (cx: 300, cy: 318, rx: 25, ry: 18)
  const mdx = (x - 300) / 25;
  const mdy = (y - 318) / 18;
  const mDist = Math.sqrt(mdx * mdx + mdy * mdy);

  if (mDist <= 1.0) {
    if (mDist >= 0.85) return [160, 50, 70, 255]; // Outline
    // Tongue
    if (y > 320) return [255, 130, 150, 255];
    return [120, 30, 50, 255]; // Mouth interior
  }
  return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(targetDir, 'mouth-open.png'), mouthOpenPng);

console.log('[generateSampleAssets] Successfully created 5 transparent PNG assets in sample_avatar/assets/');
