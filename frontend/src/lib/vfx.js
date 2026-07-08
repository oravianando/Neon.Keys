// 20 VFX presets combining background, note, particle, and key effects.
// Extended properties: trails, chromaDepth (0..1), zoomOnBeat (0..1)
export const VFX_PRESETS = [
  { id: "neon-cyan",     label: "Neon Cyan",       bg: "grid",      note: "glow",     particle: "burst",   keyFx: "glow",   chromatic: false, beatShake: 0.0,  palette: ["#00F0FF", "#FF003C"], trails: false, chromaDepth: 0.0, zoomOnBeat: 0.0 },
  { id: "neon-pink",     label: "Neon Pink",       bg: "grid",      note: "glow",     particle: "burst",   keyFx: "glow",   chromatic: false, beatShake: 0.0,  palette: ["#FF00E6", "#00F0FF"], trails: true,  chromaDepth: 0.0, zoomOnBeat: 0.15 },
  { id: "aurora",        label: "Aurora Waves",    bg: "aurora",    note: "gradient", particle: "ring",    keyFx: "pulse",  chromatic: false, beatShake: 0.1,  palette: ["#7CFF9A", "#00F0FF"], trails: true,  chromaDepth: 0.0, zoomOnBeat: 0.1  },
  { id: "vaporwave",     label: "Vaporwave",       bg: "vapor",     note: "gradient", particle: "sparks",  keyFx: "pulse",  chromatic: true,  beatShake: 0.15, palette: ["#FF71CE", "#01CDFE"], trails: false, chromaDepth: 0.6, zoomOnBeat: 0.2  },
  { id: "matrix",        label: "Matrix Rain",     bg: "matrix",    note: "solid",    particle: "sparks",  keyFx: "glow",   chromatic: false, beatShake: 0.0,  palette: ["#00FF41", "#88FF88"], trails: true,  chromaDepth: 0.0, zoomOnBeat: 0.0  },
  { id: "starfield",     label: "Starfield",       bg: "starfield", note: "glow",     particle: "burst",   keyFx: "pulse",  chromatic: false, beatShake: 0.1,  palette: ["#FFFFFF", "#FFD700"], trails: true,  chromaDepth: 0.0, zoomOnBeat: 0.2  },
  { id: "sunset",        label: "Sunset",          bg: "sunset",    note: "gradient", particle: "burst",   keyFx: "glow",   chromatic: false, beatShake: 0.1,  palette: ["#FF6B6B", "#FFD93D"], trails: false, chromaDepth: 0.0, zoomOnBeat: 0.0  },
  { id: "cyberpunk",     label: "Cyberpunk",       bg: "grid",      note: "solid",    particle: "burst",   keyFx: "glow",   chromatic: true,  beatShake: 0.3,  palette: ["#FF0080", "#00FFFF"], trails: false, chromaDepth: 0.9, zoomOnBeat: 0.35 },
  { id: "fire",          label: "Fire",            bg: "sunset",    note: "glow",     particle: "sparks",  keyFx: "glow",   chromatic: false, beatShake: 0.25, palette: ["#FF3D00", "#FFC107"], trails: true,  chromaDepth: 0.0, zoomOnBeat: 0.15 },
  { id: "ice",           label: "Ice Crystal",     bg: "aurora",    note: "gradient", particle: "ring",    keyFx: "glow",   chromatic: false, beatShake: 0.0,  palette: ["#B3E5FC", "#FFFFFF"], trails: true,  chromaDepth: 0.3, zoomOnBeat: 0.0  },
  { id: "galaxy",        label: "Galaxy",          bg: "starfield", note: "glow",     particle: "burst",   keyFx: "pulse",  chromatic: false, beatShake: 0.1,  palette: ["#A020F0", "#FF69B4"], trails: true,  chromaDepth: 0.4, zoomOnBeat: 0.25 },
  { id: "confetti",      label: "Confetti Party",  bg: "plain",     note: "solid",    particle: "burst",   keyFx: "pulse",  chromatic: false, beatShake: 0.4,  palette: ["#FF0080", "#00FFFF"], trails: false, chromaDepth: 0.0, zoomOnBeat: 0.5  },
  { id: "laser",         label: "Laser Show",      bg: "plain",     note: "solid",    particle: "sparks",  keyFx: "glow",   chromatic: false, beatShake: 0.2,  palette: ["#FF0000", "#00FF88"], trails: true,  chromaDepth: 0.5, zoomOnBeat: 0.3  },
  { id: "monochrome",    label: "Monochrome",      bg: "plain",     note: "solid",    particle: "burst",   keyFx: "glow",   chromatic: false, beatShake: 0.0,  palette: ["#FFFFFF", "#AAAAAA"], trails: false, chromaDepth: 0.0, zoomOnBeat: 0.0  },
  { id: "gold",          label: "Gold Rush",       bg: "plain",     note: "glow",     particle: "sparks",  keyFx: "glow",   chromatic: false, beatShake: 0.05, palette: ["#FFD700", "#FFA500"], trails: true,  chromaDepth: 0.0, zoomOnBeat: 0.1  },
  { id: "hologram",      label: "Hologram",        bg: "grid",      note: "gradient", particle: "ring",    keyFx: "pulse",  chromatic: true,  beatShake: 0.05, palette: ["#00FFFF", "#FF00FF"], trails: false, chromaDepth: 0.85,zoomOnBeat: 0.15 },
  { id: "underwater",    label: "Underwater",      bg: "aurora",    note: "gradient", particle: "burst",   keyFx: "pulse",  chromatic: false, beatShake: 0.0,  palette: ["#0077BE", "#7EE8FA"], trails: true,  chromaDepth: 0.2, zoomOnBeat: 0.05 },
  { id: "storm",         label: "Lightning Storm", bg: "storm",     note: "solid",    particle: "sparks",  keyFx: "glow",   chromatic: false, beatShake: 0.6,  palette: ["#FFEB3B", "#FFFFFF"], trails: false, chromaDepth: 0.0, zoomOnBeat: 0.6  },
  { id: "rainbow-flow",  label: "Rainbow Flow",    bg: "grid",      note: "rainbow",  particle: "burst",   keyFx: "pulse",  chromatic: false, beatShake: 0.1,  palette: ["rainbow"],            trails: true,  chromaDepth: 0.0, zoomOnBeat: 0.2  },
  { id: "retro-arcade",  label: "Retro Arcade",    bg: "vapor",     note: "solid",    particle: "burst",   keyFx: "glow",   chromatic: false, beatShake: 0.15, palette: ["#FF0000", "#00FF00"], trails: false, chromaDepth: 0.4, zoomOnBeat: 0.25 },
];

// ============ Background renderers ============
export function drawBackground(ctx, w, h, style, time, palette) {
  const [c1, c2] = palette;
  const [p1, p2] = [c1 === "rainbow" ? "#ff0080" : c1, c2 === "rainbow" ? "#00ffff" : (c2 || c1)];
  ctx.save();
  // Base dark fill
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, w, h);

  switch (style) {
    case "grid": {
      const step = 40;
      const offset = (time * 20) % step;
      ctx.strokeStyle = hexA(p1, 0.08);
      ctx.lineWidth = 1;
      for (let x = -offset; x < w; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = -offset; y < h; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      // Radial spotlight
      const g = ctx.createRadialGradient(w / 2, h * 0.5, 20, w / 2, h * 0.5, w * 0.7);
      g.addColorStop(0, hexA(p1, 0.18));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "aurora": {
      for (let i = 0; i < 3; i++) {
        const g = ctx.createLinearGradient(0, 0, w, h);
        const shift = (Math.sin(time * 0.3 + i) + 1) * 0.5;
        g.addColorStop(0, hexA(p1, 0.25 - i * 0.05));
        g.addColorStop(shift, hexA(p2, 0.3 - i * 0.05));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "vapor": {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, hexA(p1, 0.35));
      g.addColorStop(0.5, "#1a0a2e");
      g.addColorStop(1, hexA(p2, 0.35));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // Sun disc
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.55, h * 0.25, 0, Math.PI * 2);
      const sg = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, h * 0.25);
      sg.addColorStop(0, "#ffdc00");
      sg.addColorStop(1, hexA(p1, 0.4));
      ctx.fillStyle = sg;
      ctx.fill();
      // Perspective lines
      ctx.strokeStyle = hexA(p2, 0.7);
      ctx.lineWidth = 1;
      const vy = h * 0.75;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(w / 2, vy);
        ctx.lineTo(w / 2 + (i / 8) * w, h);
        ctx.stroke();
      }
      break;
    }
    case "matrix": {
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = p1;
      ctx.font = "14px monospace";
      const cols = Math.floor(w / 14);
      for (let c = 0; c < cols; c++) {
        const y = ((time * 200 + c * 60) % (h + 200)) - 100;
        const ch = String.fromCharCode(0x30A0 + ((c * 7 + Math.floor(time * 4)) % 96));
        ctx.globalAlpha = 0.5;
        ctx.fillText(ch, c * 14, y);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "starfield": {
      // Deterministic stars
      for (let i = 0; i < 120; i++) {
        const sx = ((i * 173) % w);
        const sy = ((i * 97 + time * 20) % h);
        const sz = 0.5 + ((i * 31) % 20) / 10;
        ctx.globalAlpha = 0.4 + 0.6 * Math.sin(time * 2 + i);
        ctx.fillStyle = i % 8 === 0 ? p2 : "#ffffff";
        ctx.fillRect(sx, sy, sz, sz);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "sunset": {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0a0a20");
      g.addColorStop(0.55, hexA(p1, 0.6));
      g.addColorStop(1, hexA(p2, 0.7));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
    case "storm": {
      const flash = Math.sin(time * 8) > 0.94 ? 0.5 : 0;
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = hexA(p1, 0.6);
      ctx.lineWidth = 2;
      if (flash > 0) {
        ctx.beginPath();
        let x = w * 0.5, y = 0;
        while (y < h) {
          const nx = x + (Math.random() - 0.5) * 40;
          const ny = y + 30;
          ctx.moveTo(x, y); ctx.lineTo(nx, ny);
          x = nx; y = ny;
        }
        ctx.stroke();
      }
      break;
    }
    case "plain":
    default: {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0a0a0a");
      g.addColorStop(1, "#000000");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      break;
    }
  }
  ctx.restore();
}

// ============ Note rendering ============
export function drawNote(ctx, x, y, w, h, style, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const r = Math.min(6, w / 2, h / 2);
  switch (style) {
    case "gradient": {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, color);
      g.addColorStop(1, hexA(color, 0.4));
      ctx.fillStyle = g;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      roundRect(ctx, x, y, w, h, r); ctx.fill();
      break;
    }
    case "solid": {
      ctx.fillStyle = color;
      roundRect(ctx, x, y, w, h, r); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      roundRect(ctx, x, y, w, h, r); ctx.stroke();
      break;
    }
    case "rainbow": {
      const hue = (x / 4) % 360;
      const c = `hsl(${hue}, 100%, 60%)`;
      ctx.fillStyle = c;
      ctx.shadowColor = c; ctx.shadowBlur = 22;
      roundRect(ctx, x, y, w, h, r); ctx.fill();
      break;
    }
    case "glow":
    default: {
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.fillStyle = color;
      roundRect(ctx, x, y, w, h, r); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      roundRect(ctx, x + 2, y + 2, Math.max(1, w - 4), Math.max(1, h - 4), Math.max(0, r - 2));
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ============ Piano rendering on canvas ============
export function drawPiano(ctx, x0, y0, w, h, activeKeys, palette, keyFx) {
  const WHITE = 52;
  const wKeyW = w / WHITE;
  ctx.save();
  ctx.translate(x0, y0);
  // White keys
  let whiteIdx = 0;
  for (let m = 21; m <= 108; m++) {
    const pc = m % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(pc);
    if (isBlack) continue;
    const kx = whiteIdx * wKeyW;
    const active = activeKeys.has(m);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (active) {
      const c1 = palette[0]; const c2 = hexA(palette[0], 0.6);
      g.addColorStop(0, c1); g.addColorStop(1, c2);
      ctx.shadowColor = palette[0];
      ctx.shadowBlur = keyFx === "pulse" ? 32 : 22;
    } else {
      g.addColorStop(0, "#f2f2f2"); g.addColorStop(1, "#c8c8c8");
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = g;
    roundRect(ctx, kx + 0.5, 0, wKeyW - 1, h, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    whiteIdx++;
  }
  // Black keys
  whiteIdx = 0;
  for (let m = 21; m <= 108; m++) {
    const pc = m % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(pc);
    if (!isBlack) { whiteIdx++; continue; }
    // Previous white key is at whiteIdx-1; black key straddles boundary
    const bkX = (whiteIdx - 1) * wKeyW + wKeyW * 0.7;
    const bkW = wKeyW * 0.6;
    const bkH = h * 0.62;
    const active = activeKeys.has(m);
    if (active) {
      ctx.shadowColor = palette[1];
      ctx.shadowBlur = keyFx === "pulse" ? 28 : 20;
      const g = ctx.createLinearGradient(0, 0, 0, bkH);
      g.addColorStop(0, palette[1]);
      g.addColorStop(1, hexA(palette[1], 0.5));
      ctx.fillStyle = g;
    } else {
      ctx.shadowBlur = 0;
      const g = ctx.createLinearGradient(0, 0, 0, bkH);
      g.addColorStop(0, "#222"); g.addColorStop(1, "#000");
      ctx.fillStyle = g;
    }
    roundRect(ctx, bkX, 0, bkW, bkH, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

// ============ Particle helpers ============
export function spawnParticles(store, x, y, style, color) {
  const count = { burst: 12, sparks: 6, ring: 20, none: 0 }[style] || 0;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / Math.max(count, 1);
    const speed = style === "sparks" ? 2 + Math.random() * 3 : (style === "ring" ? 4 : 1 + Math.random() * 3);
    store.push({
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(a) * speed + (Math.random() - 0.5) * 0.4,
      vy: style === "ring" ? Math.sin(a) * speed : -(2 + Math.random() * 3),
      life: 1,
      size: 2 + Math.random() * 2,
      color,
    });
  }
}
export function updateParticles(store, dt = 1 / 60) {
  for (let i = store.length - 1; i >= 0; i--) {
    const p = store[i];
    p.px = p.x;
    p.py = p.y;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15;
    p.life -= dt * 1.2;
    if (p.life <= 0) store.splice(i, 1);
  }
}
export function drawParticles(ctx, store, withTrails = false) {
  ctx.save();
  for (const p of store) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;
    if (withTrails && p.px !== undefined) {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.size * 0.6);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.px, p.py);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ============ Utils ============
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function hexA(hex, a) {
  // hex like "#RRGGBB" or "rgb(..)" — normalize
  if (hex.startsWith("hsl") || hex.startsWith("rgb")) return hex;
  const m = /^#?([a-f0-9]{2})([a-f0-9]{2})([a-f0-9]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

export function keyXFractionCanvas(midi) {
  // 88 keys: MIDI 21..108. 52 white keys. Compute the white-key index or interpolated position.
  const WHITE = 52;
  let wIdx = 0;
  for (let m = 21; m < midi; m++) {
    const pc = m % 12;
    if (![1, 3, 6, 8, 10].includes(pc)) wIdx++;
  }
  const pc = midi % 12;
  if (![1, 3, 6, 8, 10].includes(pc)) {
    return (wIdx + 0.5) / WHITE;
  }
  // Black key
  return (wIdx + 0) / WHITE; // aligned with the boundary after previous white
}

export function keyWidthFractionCanvas(midi) {
  const WHITE = 52;
  const pc = midi % 12;
  const isBlack = [1, 3, 6, 8, 10].includes(pc);
  return (isBlack ? 0.6 : 1) / WHITE;
}
