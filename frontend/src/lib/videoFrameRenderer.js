// Composed frame renderer for the video export & preview canvas.
// Extracted from VideoRecorderModal.jsx so the modal stays lean.
//
// A single call to renderFrame draws:
//   1. Background (via preset.bg)
//   2. Rolling notes (clipped to notes area)
//   3. Particles
//   4. Piano keys
//   5. Chromatic aberration overlay
//   6. Title card (during intro)
//   7. Chord subtitle (during song playback)
//
// NOTE: Camera-zoom effects are intentionally removed. Only translation-based
// shake remains, which gives energy without motion-sickness.

import {
  drawBackground,
  drawNote,
  drawParticles,
  drawPiano,
  hexA,
  keyXFractionCanvas,
  keyWidthFractionCanvas,
} from "@/lib/vfx";

const LOOKAHEAD = 4.0;

export function renderFrame(
  ctx,
  preset,
  timeAbs,
  currentTime,
  song,
  activeKeys,
  particles,
  overlay,
  dims,
) {
  const w = dims.w;
  const h = dims.h;
  const NOTES_H = dims.notesH;
  const PIANO_H = dims.pianoH;
  const tracksColors = overlay?.trackColors || {};

  // Determine stacked-piano layout.
  // If the song has multiple non-drum tracks, we render the main piano larger,
  // and stacked mini-pianos for each secondary track below.
  const secondaryTracks = getSecondaryTracks(song?.tracks);
  const hasStack = secondaryTracks.length > 0 && (overlay?.showStack !== false);
  let mainPianoH = PIANO_H;
  let stackH = 0;
  if (hasStack) {
    // Reserve 40% of piano area for stacked tracks (max 4 rows).
    const usableStack = PIANO_H * 0.55;
    stackH = usableStack;
    mainPianoH = PIANO_H - stackH;
  }

  // Beat shake (no zoom — user preference)
  let shakeX = 0;
  let shakeY = 0;
  const activeSize = activeKeys?.size || 0;
  const beatActive = activeSize > 0;
  if (preset.beatShake > 0 && beatActive) {
    shakeX = (Math.random() - 0.5) * preset.beatShake * 20;
    shakeY = (Math.random() - 0.5) * preset.beatShake * 20;
  }

  ctx.save();
  ctx.translate(shakeX, shakeY);

  // Background
  drawBackground(ctx, w, h, preset.bg, timeAbs, preset.palette);

  // Rolling notes
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, NOTES_H);
  ctx.clip();
  if (song?.notes) {
    for (const n of song.notes) {
      const relStart = n.time - currentTime;
      const relEnd = n.time + n.duration - currentTime;
      if (relEnd < 0 || relStart > LOOKAHEAD) continue;
      const bottomY = NOTES_H - (relStart / LOOKAHEAD) * NOTES_H;
      const topY = NOTES_H - (relEnd / LOOKAHEAD) * NOTES_H;
      const noteH = Math.max(6, bottomY - topY);
      const xFrac = keyXFractionCanvas(n.midi);
      const wFrac = keyWidthFractionCanvas(n.midi);
      const nx = xFrac * w - (wFrac * w) / 2 + 2;
      const nw = Math.max(4, wFrac * w - 3);
      const trackId = n.track !== undefined ? String(n.track) : "0";
      const tc = tracksColors[trackId];
      const color = tc || (n.hand === "left" ? preset.palette[1] : preset.palette[0]);
      drawNote(ctx, nx, topY, nw, noteH, preset.note, color, 1);
    }
  }
  // Impact line at the piano boundary
  ctx.strokeStyle = "rgba(0,240,255,0.5)";
  ctx.lineWidth = 2;
  ctx.shadowColor = preset.palette[0];
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(0, NOTES_H - 1);
  ctx.lineTo(w, NOTES_H - 1);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  drawParticles(ctx, particles, preset.trails);

  // Main piano keys (top of piano region)
  drawPiano(ctx, 0, NOTES_H, w, mainPianoH, activeKeys, preset.palette, preset.keyFx, tracksColors);

  // Stacked mini pianos for secondary tracks
  if (hasStack) {
    drawStackedTrackPianos(
      ctx,
      0,
      NOTES_H + mainPianoH,
      w,
      stackH,
      secondaryTracks,
      currentTime,
      tracksColors,
      preset,
    );
  }

  // Pulse-glow bloom (subtle white flash on the impact line when many keys hit)
  const pg = preset.pulseGlow || 0;
  if (pg > 0 && activeSize >= 2) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = pg * Math.min(1, activeSize / 6);
    const grad = ctx.createLinearGradient(0, NOTES_H - 60, 0, NOTES_H);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, hexA(preset.palette[0], 0.7));
    ctx.fillStyle = grad;
    ctx.fillRect(0, NOTES_H - 60, w, 60);
    ctx.restore();
  }

  ctx.restore(); // undo shake

  // Chromatic aberration
  const cd = preset.chromaDepth || 0;
  if (preset.chromatic || cd > 0) {
    const off = Math.max(2, 12 * (cd || 0.4));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.15 + 0.35 * cd;
    ctx.filter = "hue-rotate(180deg)";
    ctx.drawImage(ctx.canvas, -off, 0);
    ctx.filter = "hue-rotate(0deg)";
    ctx.drawImage(ctx.canvas, off, 0);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Title card (during intro)
  if (overlay && overlay.introDur > 0 && overlay.elapsed < overlay.introDur) {
    drawTitleCard(ctx, w, h, overlay, preset);
  }

  // Chord subtitle (bottom-center) during song playback
  if (
    overlay &&
    overlay.showSubtitles &&
    overlay.elapsed >= overlay.introDur &&
    overlay.chords?.length
  ) {
    drawChordSubtitle(ctx, w, NOTES_H, h, overlay, preset);
  }
}

// Return non-primary, non-drum tracks (matches TrackPianoStack.jsx logic).
function getSecondaryTracks(tracks) {
  if (!tracks || tracks.length <= 1) return [];
  const sorted = [...tracks].sort((a, b) => {
    const aP = a.family === "piano" ? 1 : 0;
    const bP = b.family === "piano" ? 1 : 0;
    if (aP !== bP) return bP - aP;
    return (b.notes?.length || 0) - (a.notes?.length || 0);
  });
  return sorted.slice(1).filter((t) => !t.isDrum).slice(0, 4);
}

function drawStackedTrackPianos(ctx, x0, y0, w, totalH, tracks, currentTime, trackColors, preset) {
  if (!tracks.length) return;
  const rowH = totalH / tracks.length;
  const gap = Math.max(2, Math.round(rowH * 0.05));
  const pianoH = rowH - gap;

  tracks.forEach((track, i) => {
    const y = y0 + i * rowH + gap / 2;
    // Build an activeKeys Map for THIS track based on currentTime
    const active = new Map();
    for (const n of track.notes || []) {
      if (n.time <= currentTime && currentTime < n.time + n.duration) {
        active.set(n.midi, { hand: n.hand || "right", track: String(track.id) });
      }
    }

    // Faint background band so track keys separate visually from main piano
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x0, y, w, pianoH);
    ctx.restore();

    // Determine a per-track color: prefer explicit trackColors, else preset palette rotation
    const color =
      trackColors?.[String(track.id)] ||
      preset.palette[i % preset.palette.length] ||
      preset.palette[0];
    // Draw the mini piano with the track's color as palette[0]
    drawPiano(ctx, x0, y, w, pianoH, active, [color, hexA(color, 0.6)], preset.keyFx, {
      [String(track.id)]: color,
    });

    // Overlay track label in the top-left corner of this row
    const scale = Math.max(0.7, pianoH / 60);
    ctx.save();
    ctx.font = `bold ${Math.round(11 * scale)}px monospace`;
    ctx.textBaseline = "top";
    const label = `${(track.name || "Track").toUpperCase()} · ${track.family || "misc"}`;
    const metrics = ctx.measureText(label);
    const padX = 6 * scale;
    const padY = 3 * scale;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x0 + 8, y + 4, metrics.width + padX * 2, 14 * scale + padY);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 * scale;
    ctx.fillText(label, x0 + 8 + padX, y + 4 + padY / 2);
    ctx.restore();
  });
}

function drawTitleCard(ctx, w, h, overlay, preset) {
  const t = overlay.elapsed;
  const fadeIn = Math.min(1, t / 0.4);
  const fadeOut = Math.min(1, (overlay.introDur - t) / 0.5);
  const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
  const scale = h / 720;
  const c1 = preset.palette[0];
  const c2 = preset.palette[1] || c1;

  ctx.save();
  // Gradient-tinted dark overlay
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, hexA(c1, 0.15 * alpha));
  bg.addColorStop(0.5, `rgba(0,0,0,${0.75 * alpha})`);
  bg.addColorStop(1, hexA(c2, 0.15 * alpha));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";

  // Neon underline bar
  const barW = w * 0.42;
  const barH = 4 * scale;
  const barX = (w - barW) / 2;
  const barY = h / 2 + 60 * scale;
  const bg2 = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  bg2.addColorStop(0, hexA(c1, 0));
  bg2.addColorStop(0.5, c1);
  bg2.addColorStop(1, hexA(c2, 0));
  ctx.fillStyle = bg2;
  ctx.shadowColor = c1;
  ctx.shadowBlur = 20 * scale;
  ctx.fillRect(barX, barY, barW, barH);
  ctx.shadowBlur = 0;

  // Title text
  ctx.fillStyle = c1;
  ctx.shadowColor = c1;
  ctx.shadowBlur = 40 * scale;
  ctx.font = `bold ${Math.round(96 * scale)}px 'Unbounded', sans-serif`;
  ctx.fillText(overlay.title || "", w / 2, h / 2 - 8 * scale);

  // Tagline
  if (overlay.tagline) {
    ctx.shadowBlur = 12 * scale;
    ctx.font = `${Math.round(26 * scale)}px monospace`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(overlay.tagline, w / 2, h / 2 + 34 * scale);
  }
  ctx.restore();
}

function drawChordSubtitle(ctx, w, NOTES_H, h, overlay, preset) {
  const st = overlay.songTime;
  const active = [...overlay.chords].reverse().find((c) => c.time <= st);
  if (!active) return;
  const scale = h / 720;
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `bold ${Math.round(42 * scale)}px 'Unbounded', sans-serif`;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(w / 2 - 120 * scale, NOTES_H - 70 * scale, 240 * scale, 50 * scale);
  ctx.fillStyle = preset.palette[0];
  ctx.shadowColor = preset.palette[0];
  ctx.shadowBlur = 20 * scale;
  ctx.fillText(active.name, w / 2, NOTES_H - 32 * scale);
  ctx.restore();
}
