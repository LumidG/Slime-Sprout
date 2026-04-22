/**
 * Bodies: **face** anchor (not mass centroid) → (W/2, H/2), so the “between
 * eyes” band lines up with that pivot. Placing the blob’s opacity centroid
 * in the center puts eyes in the wrong place.
 *
 * Eyes: opacity **centroid** → (W/2, H/2) (the pair’s midpoint, i.e. face).
 *
 * Accessories: bbox bottom and horizontal center vs `s_Slime1` (after pass).
 *
 * Run: npm run align:sprites
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const SLIME_BODIES = 8;
const SLIME_EYES = 4;
const SLIME_ACCESSORIES = 6;

const ALPHA_CUT = 20;

/**
 * How far down the **body** bbox the face line is (0 = top, 1 = bottom of bbox).
 * Tune if the eyes look too high (lower F) or too low (raise F); ~0.28–0.34
 * is typical for these domes.
 */
const FACE_T = 0.3;

/** @returns {{ cx: number, cy: number } | null} */
function getOpacityCentroid(pixels, w, h) {
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (pixels[i + 3] > ALPHA_CUT) {
        n++;
        sx += x;
        sy += y;
      }
    }
  }
  if (n < 1) return null;
  return { cx: sx / n, cy: sy / n };
}

function shiftRgba(pixels, w, h, dx, dy) {
  const out = new Uint8Array(w * h * 4);
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const sxi = (sy * w + sx) * 4;
      if (pixels[sxi + 3] < 5) continue;
      const dxo = sx + dx;
      const dyo = sy + dy;
      if (dxo < 0 || dyo < 0 || dxo >= w || dyo >= h) continue;
      const di = (dyo * w + dxo) * 4;
      out[di] = pixels[sxi];
      out[di + 1] = pixels[sxi + 1];
      out[di + 2] = pixels[sxi + 2];
      out[di + 3] = pixels[sxi + 3];
    }
  }
  return out;
}

async function loadRgba(p) {
  return sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function saveRgba(pixels, w, h, outPath) {
  await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toFile(outPath);
}

function isTrivialShift(dx, dy) {
  return Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
}

function getBbox(pixels, w, h) {
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (pixels[i + 3] > ALPHA_CUT) {
        n++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (n < 1) return null;
  return { minX, minY, maxX, maxY, count: n };
}

/**
 * Shift so mass center of opacity sits on image center (eyes: pair midpoint).
 */
function shiftToImageCenter(pixels, w, h) {
  const c = getOpacityCentroid(pixels, w, h);
  if (!c) return null;
  const tx = w / 2;
  const ty = h / 2;
  const dx = Math.round(tx - c.cx);
  const dy = Math.round(ty - c.cy);
  return { dx, dy, c, tx, ty };
}

/** Slime body: a point on the “face” band (horizontal mid, FACE_T down the blob) → (W/2, H/2). */
function shiftBodyFaceToCenter(pixels, w, h) {
  const b = getBbox(pixels, w, h);
  if (!b) return null;
  const faceX = 0.5 * (b.minX + b.maxX);
  const bh = b.maxY - b.minY;
  const faceY = b.minY + FACE_T * bh;
  const tx = w / 2;
  const ty = h / 2;
  const dx = Math.round(tx - faceX);
  const dy = Math.round(ty - faceY);
  return { dx, dy, tx, ty, faceX, faceY, b };
}

async function alignBodyFace(p, label) {
  const { data, info } = await loadRgba(p);
  const w = info.width;
  const h = info.height;
  const buf = new Uint8Array(data);
  const s = shiftBodyFaceToCenter(buf, w, h);
  if (!s) {
    console.log(`  ${label}: skip (no body bbox)`);
    return;
  }
  if (isTrivialShift(s.dx, s.dy)) {
    console.log(`  ${label}: body face @ (${s.tx},${s.ty})  already`);
    return;
  }
  const out = shiftRgba(buf, w, h, s.dx, s.dy);
  await saveRgba(out, w, h, p);
  console.log(`  ${label}: body face (at ${s.faceX.toFixed(0)},${s.faceY.toFixed(0)} → center)  dx=${s.dx} dy=${s.dy}`);
}

async function alignCentroidToCenter(p, label) {
  const { data, info } = await loadRgba(p);
  const w = info.width;
  const h = info.height;
  const buf = new Uint8Array(data);
  const s = shiftToImageCenter(buf, w, h);
  if (!s) {
    console.log(`  ${label}: skip (no opaque pixels)`);
    return;
  }
  if (isTrivialShift(s.dx, s.dy)) {
    console.log(`  ${label}: already centered (pivot ≈ ${s.tx}, ${s.ty})`);
    return;
  }
  const out = shiftRgba(buf, w, h, s.dx, s.dy);
  await saveRgba(out, w, h, p);
  console.log(`  ${label}: centroid → (${s.tx},${s.ty})  dx=${s.dx} dy=${s.dy}`);
}

/**
 * Hats/flowers: horizontal center of bbox = W/2, bottom of bbox = bodyTop - pad.
 * Uses reference body s_Slime1 (must already be centroid-aligned).
 */
const BRIM_PAD_PX = 2;

async function alignAccessoriesToBody() {
  const refPath = path.join(publicDir, 's_Slime1.png');
  if (!fs.existsSync(refPath)) {
    throw new Error('s_Slime1.png missing (needed for hat placement)');
  }
  const { data: bdata, info } = await loadRgba(refPath);
  const W = info.width;
  const H = info.height;
  const bbuf = new Uint8Array(bdata);
  const bas = getBbox(bbuf, W, H);
  if (!bas) throw new Error('s_Slime1 has no opaque pixels');
  const bodyTopY = bas.minY;
  const yBrim = bodyTopY - BRIM_PAD_PX;

  for (let n = 1; n <= SLIME_ACCESSORIES; n++) {
    const name = `s_Accessory${n}.png`;
    const p = path.join(publicDir, name);
    if (!fs.existsSync(p)) continue;
    const { data } = await loadRgba(p);
    const buf = new Uint8Array(data);
    const b = getBbox(buf, W, H);
    if (!b) {
      console.log(`  ${name}: skip (empty)`);
      continue;
    }
    const accCx = 0.5 * (b.minX + b.maxX);
    const dx = Math.round(W / 2 - accCx);
    const dy = Math.round(yBrim - b.maxY);
    if (isTrivialShift(dx, dy)) {
      console.log(`  ${name}: already on body (ref bodyTopY=${bodyTopY})`);
      continue;
    }
    const out = shiftRgba(buf, W, H, dx, dy);
    await saveRgba(out, W, H, p);
    console.log(`  ${name}: on-head dx=${dx} dy=${dy} (body top=${bodyTopY})`);
  }
}

async function main() {
  const bodies = Array.from({ length: SLIME_BODIES }, (_, i) => `s_Slime${i + 1}.png`);
  const eyes = Array.from({ length: SLIME_EYES }, (_, i) => `s_Eyes${i + 1}.png`);
  const firstP = path.join(publicDir, bodies[0] ?? 's_Slime1.png');
  if (!bodies.length || !fs.existsSync(firstP)) {
    throw new Error('No s_Slime*.png found');
  }
  const m = await sharp(firstP).metadata();
  console.log(`Size ${m.width}x${m.height} — image center pivot = (${(m.width ?? 0) / 2}, ${(m.height ?? 0) / 2})`);

  for (const f of bodies) {
    const p = path.join(publicDir, f);
    if (fs.existsSync(p)) await alignBodyFace(p, f);
  }
  for (const f of eyes) {
    const p = path.join(publicDir, f);
    if (fs.existsSync(p)) await alignCentroidToCenter(p, f);
  }

  await alignAccessoriesToBody();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
