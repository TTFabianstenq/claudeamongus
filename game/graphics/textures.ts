/**
 * Procedural texture factory. Every surface in HOLLOWMOOR is painted at
 * runtime onto canvases — wood grain, damp plaster, peeling wallpaper,
 * brick, book spines — so the repository ships zero image assets.
 */

import * as THREE from 'three';

type Painter = (ctx: CanvasRenderingContext2D, size: number, rand: () => number) => void;

const cache = new Map<string, THREE.CanvasTexture>();

function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeTexture(
  key: string,
  size: number,
  painter: Painter,
  opts: { repeat?: [number, number]; anisotropy?: number } = {}
): THREE.CanvasTexture {
  const cached = cache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  painter(ctx, size, lcg(key.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 7)));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = opts.anisotropy ?? 4;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  cache.set(key, tex);
  return tex;
}

/** Scatter translucent specks for grime/noise. */
function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  rand: () => number,
  count: number,
  color: string,
  alphaMax: number,
  rMax = 2
): void {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rand() * alphaMax;
    ctx.fillStyle = color;
    const r = 0.4 + rand() * rMax;
    ctx.fillRect(rand() * size, rand() * size, r, r);
  }
  ctx.globalAlpha = 1;
}

function grimeEdges(ctx: CanvasRenderingContext2D, size: number, strength = 0.35): void {
  const g = ctx.createLinearGradient(0, size * 0.55, 0, size);
  g.addColorStop(0, 'rgba(20,14,8,0)');
  g.addColorStop(1, `rgba(20,14,8,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/* ------------------------------------------------------------------ */

export function woodFloorTexture(dark = false): THREE.CanvasTexture {
  return makeTexture(`woodFloor${dark ? '_dark' : ''}`, 512, (ctx, size, rand) => {
    const base = dark ? '#3a2a1c' : '#6b4d31';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const plankH = size / 8;
    for (let row = 0; row < 8; row++) {
      const y = row * plankH;
      const tone = (rand() - 0.5) * 26;
      ctx.fillStyle = `rgb(${(dark ? 58 : 107) + tone},${(dark ? 42 : 77) + tone * 0.8},${(dark ? 28 : 49) + tone * 0.6})`;
      ctx.fillRect(0, y + 1, size, plankH - 2);
      // grain streaks
      for (let i = 0; i < 26; i++) {
        ctx.strokeStyle = `rgba(${dark ? 25 : 60},${dark ? 18 : 40},${dark ? 12 : 24},${0.12 + rand() * 0.2})`;
        ctx.lineWidth = 0.6 + rand();
        ctx.beginPath();
        const gy = y + rand() * plankH;
        ctx.moveTo(0, gy);
        ctx.bezierCurveTo(
          size * 0.3,
          gy + (rand() - 0.5) * 5,
          size * 0.7,
          gy + (rand() - 0.5) * 5,
          size,
          gy
        );
        ctx.stroke();
      }
      // plank seams + butt joints
      ctx.fillStyle = 'rgba(15,10,6,0.85)';
      ctx.fillRect(0, y, size, 1.6);
      const joint = rand() * size;
      ctx.fillRect(joint, y, 1.6, plankH);
      // nail heads
      ctx.fillStyle = 'rgba(20,16,10,0.8)';
      ctx.fillRect(joint + 5, y + 3, 2, 2);
      ctx.fillRect(joint + 5, y + plankH - 6, 2, 2);
    }
    speckle(ctx, size, rand, 900, '#1a120a', 0.16);
    grimeEdges(ctx, size, 0.12);
  });
}

export function plankTexture(): THREE.CanvasTexture {
  return makeTexture('plank', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#4c4034';
    ctx.fillRect(0, 0, size, size);
    const plankW = size / 6;
    for (let col = 0; col < 6; col++) {
      const x = col * plankW;
      const tone = (rand() - 0.5) * 22;
      ctx.fillStyle = `rgb(${76 + tone},${64 + tone},${52 + tone})`;
      ctx.fillRect(x + 1, 0, plankW - 2, size);
      for (let i = 0; i < 22; i++) {
        ctx.strokeStyle = `rgba(30,24,18,${0.1 + rand() * 0.22})`;
        ctx.lineWidth = 0.7 + rand();
        ctx.beginPath();
        const gx = x + rand() * plankW;
        ctx.moveTo(gx, 0);
        ctx.bezierCurveTo(
          gx + (rand() - 0.5) * 6,
          size * 0.3,
          gx + (rand() - 0.5) * 6,
          size * 0.7,
          gx,
          size
        );
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(12,10,8,0.9)';
      ctx.fillRect(x, 0, 1.6, size);
    }
    speckle(ctx, size, rand, 700, '#141008', 0.2);
  });
}

export function wallpaperTexture(): THREE.CanvasTexture {
  return makeTexture('wallpaper', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#5d5a4e';
    ctx.fillRect(0, 0, size, size);
    // vertical stripe pattern
    for (let x = 0; x < size; x += 64) {
      ctx.fillStyle = 'rgba(84,80,66,0.9)';
      ctx.fillRect(x, 0, 30, size);
      ctx.fillStyle = 'rgba(70,66,55,0.8)';
      ctx.fillRect(x + 40, 0, 6, size);
    }
    // faded damask motif rows
    ctx.strokeStyle = 'rgba(96,90,70,0.5)';
    ctx.lineWidth = 1.4;
    for (let y = 32; y < size; y += 96) {
      for (let x = 15; x < size; x += 64) {
        ctx.beginPath();
        ctx.ellipse(x, y, 8, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(x, y + 48, 5, 8, Math.PI / 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // water stains
    for (let i = 0; i < 7; i++) {
      const sx = rand() * size;
      const sy = rand() * size;
      const r = 26 + rand() * 60;
      const g = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, r);
      g.addColorStop(0, 'rgba(48,40,26,0.16)');
      g.addColorStop(0.8, 'rgba(42,34,22,0.24)');
      g.addColorStop(1, 'rgba(42,34,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    speckle(ctx, size, rand, 500, '#22201a', 0.15);
    grimeEdges(ctx, size, 0.4);
  });
}

export function wainscotTexture(): THREE.CanvasTexture {
  return makeTexture('wainscot', 512, (ctx, size, rand) => {
    // upper: aged paper, lower third: wood panelling
    ctx.fillStyle = '#57544a';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rand, 420, '#2c2a22', 0.14);
    for (let i = 0; i < 5; i++) {
      const sx = rand() * size;
      const sy = rand() * size * 0.6;
      const r = 24 + rand() * 44;
      const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, r);
      g.addColorStop(0, 'rgba(44,38,26,0.18)');
      g.addColorStop(1, 'rgba(44,38,26,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    const panelTop = size * 0.62;
    ctx.fillStyle = '#4a3423';
    ctx.fillRect(0, panelTop, size, size - panelTop);
    ctx.fillStyle = 'rgba(20,13,8,0.9)';
    ctx.fillRect(0, panelTop, size, 4);
    for (let x = 0; x < size; x += 85) {
      ctx.fillStyle = 'rgba(26,17,10,0.55)';
      ctx.fillRect(x + 8, panelTop + 14, 70, size - panelTop - 26);
      ctx.fillStyle = 'rgba(84,60,40,0.55)';
      ctx.fillRect(x + 12, panelTop + 18, 62, size - panelTop - 34);
    }
    for (let i = 0; i < 300; i++) {
      ctx.globalAlpha = rand() * 0.12;
      ctx.fillStyle = '#1c130c';
      ctx.fillRect(rand() * size, panelTop + rand() * (size - panelTop), 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    grimeEdges(ctx, size, 0.3);
  });
}

export function plasterTexture(): THREE.CanvasTexture {
  return makeTexture('plaster', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#63615a';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rand, 2600, '#4b4942', 0.2, 2.4);
    speckle(ctx, size, rand, 1200, '#74716a', 0.16, 2);
    // hairline cracks
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(30,28,24,0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      let x = rand() * size;
      let y = rand() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += (rand() - 0.5) * 46;
        y += rand() * 34;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    grimeEdges(ctx, size, 0.32);
  });
}

export function brickTexture(): THREE.CanvasTexture {
  return makeTexture('brick', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#3f3833';
    ctx.fillRect(0, 0, size, size);
    const bh = size / 10;
    const bw = size / 5;
    for (let row = 0; row < 10; row++) {
      const offset = row % 2 === 0 ? 0 : bw / 2;
      for (let col = -1; col < 6; col++) {
        const x = col * bw + offset;
        const y = row * bh;
        const tone = (rand() - 0.5) * 24;
        ctx.fillStyle = `rgb(${94 + tone},${58 + tone * 0.7},${44 + tone * 0.5})`;
        ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        speckle(ctx, size, rand, 6, '#241a14', 0.3, 2);
      }
    }
    grimeEdges(ctx, size, 0.42);
  });
}

export function concreteTexture(): THREE.CanvasTexture {
  return makeTexture('concrete', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#4e4d4b';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rand, 3400, '#3c3b39', 0.25, 2.6);
    speckle(ctx, size, rand, 1500, '#5d5c58', 0.18, 2);
    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = 'rgba(28,27,25,0.6)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      let x = rand() * size;
      let y = rand() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 10; s++) {
        x += (rand() - 0.5) * 60;
        y += (rand() - 0.3) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // damp patches
    for (let i = 0; i < 5; i++) {
      const sx = rand() * size;
      const sy = rand() * size;
      const r = 40 + rand() * 90;
      const g = ctx.createRadialGradient(sx, sy, 6, sx, sy, r);
      g.addColorStop(0, 'rgba(24,26,24,0.3)');
      g.addColorStop(1, 'rgba(24,26,24,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
  });
}

export function tileTexture(): THREE.CanvasTexture {
  return makeTexture('tile', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#2e2e2c';
    ctx.fillRect(0, 0, size, size);
    const t = size / 8;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const tone = (rand() - 0.5) * 14;
        const dark = (row + col) % 2 === 0;
        ctx.fillStyle = dark
          ? `rgb(${140 + tone},${138 + tone},${128 + tone})`
          : `rgb(${94 + tone},${96 + tone},${92 + tone})`;
        ctx.fillRect(col * t + 2, row * t + 2, t - 4, t - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(col * t + 2, row * t + 2, t - 4, 4);
      }
    }
    speckle(ctx, size, rand, 700, '#1a1a18', 0.2);
    grimeEdges(ctx, size, 0.25);
  });
}

export function carpetTexture(): THREE.CanvasTexture {
  return makeTexture('carpet', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#4a3b38';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rand, 6000, '#3a2d2b', 0.3, 1.6);
    speckle(ctx, size, rand, 3000, '#5a4844', 0.22, 1.4);
    // border pattern
    ctx.strokeStyle = 'rgba(30,22,20,0.5)';
    ctx.lineWidth = 5;
    ctx.strokeRect(16, 16, size - 32, size - 32);
    grimeEdges(ctx, size, 0.2);
  });
}

export function grassTexture(): THREE.CanvasTexture {
  return makeTexture('grass', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#1d2416';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 5200; i++) {
      const g = 28 + rand() * 42;
      ctx.strokeStyle = `rgba(${g * 0.55},${g},${g * 0.4},${0.25 + rand() * 0.4})`;
      ctx.lineWidth = 1;
      const x = rand() * size;
      const y = rand() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rand() - 0.5) * 4, y - 3 - rand() * 5);
      ctx.stroke();
    }
    // muddy patches
    for (let i = 0; i < 8; i++) {
      const sx = rand() * size;
      const sy = rand() * size;
      const r = 20 + rand() * 60;
      const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, r);
      g.addColorStop(0, 'rgba(40,32,20,0.35)');
      g.addColorStop(1, 'rgba(40,32,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
  });
}

export function asphaltTexture(): THREE.CanvasTexture {
  return makeTexture('asphalt', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#33322f';
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, rand, 4200, '#262522', 0.3, 2.2);
    speckle(ctx, size, rand, 1600, '#454440', 0.2, 1.6);
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = 'rgba(20,20,18,0.6)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      let x = rand() * size;
      let y = 0;
      ctx.moveTo(x, y);
      while (y < size) {
        x += (rand() - 0.5) * 30;
        y += 20 + rand() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  });
}

export function metalTexture(): THREE.CanvasTexture {
  return makeTexture('metal', 256, (ctx, size, rand) => {
    ctx.fillStyle = '#5a5c5e';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.05})`;
      ctx.fillRect(0, y, size, 1);
    }
    speckle(ctx, size, rand, 500, '#3c3e40', 0.3, 2);
    // rust blooms
    for (let i = 0; i < 7; i++) {
      const sx = rand() * size;
      const sy = rand() * size;
      const r = 8 + rand() * 26;
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, r);
      g.addColorStop(0, 'rgba(112,58,30,0.5)');
      g.addColorStop(1, 'rgba(112,58,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
  });
}

export function fabricTexture(): THREE.CanvasTexture {
  return makeTexture('fabric', 256, (ctx, size, rand) => {
    ctx.fillStyle = '#3d4245';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 3) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + rand() * 0.03})`;
      ctx.fillRect(0, y, size, 1);
    }
    for (let x = 0; x < size; x += 3) {
      ctx.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.04})`;
      ctx.fillRect(x, 0, 1, size);
    }
    speckle(ctx, size, rand, 300, '#23282b', 0.2, 2);
  });
}

export function bookSpinesTexture(): THREE.CanvasTexture {
  return makeTexture('books', 512, (ctx, size, rand) => {
    ctx.fillStyle = '#181410';
    ctx.fillRect(0, 0, size, size);
    const shelfH = size / 4;
    const palette = ['#5a3a2a', '#41503c', '#3c4356', '#5c5138', '#54303a', '#4a4440', '#38352c'];
    for (let shelf = 0; shelf < 4; shelf++) {
      const y = shelf * shelfH;
      let x = 0;
      while (x < size) {
        const w = 10 + rand() * 22;
        const h = shelfH * (0.68 + rand() * 0.26);
        const lean = rand() < 0.08 ? (rand() - 0.5) * 0.18 : 0;
        ctx.save();
        ctx.translate(x + w / 2, y + shelfH);
        ctx.rotate(lean);
        ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
        ctx.fillRect(-w / 2, -h, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(-w / 2, -h, 2, h);
        ctx.fillStyle = 'rgba(210,190,140,0.35)';
        ctx.fillRect(-w / 2 + 2, -h + 6, w - 4, 2);
        ctx.fillRect(-w / 2 + 2, -h * 0.4, w - 4, 1.4);
        ctx.restore();
        x += w + (rand() < 0.12 ? 8 : 0.5);
      }
      ctx.fillStyle = 'rgba(10,8,6,0.9)';
      ctx.fillRect(0, y + shelfH - 4, size, 4);
    }
    grimeEdges(ctx, size, 0.3);
  });
}

export function curtainTexture(): THREE.CanvasTexture {
  return makeTexture('curtain', 256, (ctx, size, rand) => {
    ctx.fillStyle = '#33272a';
    ctx.fillRect(0, 0, size, size);
    for (let x = 0; x < size; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, 'rgba(0,0,0,0.4)');
      g.addColorStop(0.5, 'rgba(90,70,74,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, size);
    }
    speckle(ctx, size, rand, 400, '#191114', 0.25, 2);
  });
}

export function barkTexture(): THREE.CanvasTexture {
  return makeTexture('bark', 256, (ctx, size, rand) => {
    ctx.fillStyle = '#2e261e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(${18 + rand() * 26},${14 + rand() * 20},${10 + rand() * 14},0.8)`;
      ctx.lineWidth = 2 + rand() * 4;
      const x = rand() * size;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(
        x + (rand() - 0.5) * 20,
        size * 0.33,
        x + (rand() - 0.5) * 20,
        size * 0.66,
        x,
        size
      );
      ctx.stroke();
    }
    speckle(ctx, size, rand, 600, '#453a2c', 0.2, 2);
  });
}
