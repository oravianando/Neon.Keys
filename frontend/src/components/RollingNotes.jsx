import React, { useEffect, useRef } from "react";
import { KEYS, isBlackKey } from "@/lib/piano";

/*
  RollingNotes: Canvas that renders falling note bars synchronized with playback.
  Props:
    song, currentTime, lookahead, noteColor, keyRects: {midi: {left, width}}
*/
export default function RollingNotes({
  song,
  currentTime,
  lookahead = 4,
  noteColor = "cyan",
  keyRects,
}) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const currentTimeRef = useRef(currentTime);
  const songRef = useRef(song);
  const keyRectsRef = useRef(keyRects);

  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { songRef.current = song; }, [song]);
  useEffect(() => { keyRectsRef.current = keyRects; }, [keyRects]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    let raf;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const colors = {
      cyan: { white: "#00F0FF", black: "#FF003C" },
      pink: { white: "#FF00E6", black: "#00F0FF" },
      green: { white: "#00FF88", black: "#FFD400" },
      rainbow: null,
    };

    const rainbow = (midi) => {
      const hue = ((midi - 21) / 88) * 360;
      return `hsl(${hue}, 100%, 60%)`;
    };

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      // subtle vertical gradient background
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(5,5,10,0.9)");
      g.addColorStop(1, "rgba(15,5,30,0.4)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // horizontal guide line just above piano (impact line)
      ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(0, 240, 255, 0.8)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, h - 2);
      ctx.lineTo(w, h - 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      const s = songRef.current;
      const t = currentTimeRef.current;
      const rects = keyRectsRef.current || {};
      if (!s || !s.notes) {
        raf = requestAnimationFrame(draw);
        return;
      }

      for (const n of s.notes) {
        const relStart = n.time - t;
        const relEnd = n.time + n.duration - t;
        if (relEnd < 0 || relStart > lookahead) continue;

        const rect = rects[n.midi];
        if (!rect) continue;

        // Y positions: notes fall from top (y=0) to bottom (y=h). At relStart=0, note bottom is at h.
        const bottomY = h - (relStart / lookahead) * h;
        const topY = h - (relEnd / lookahead) * h;
        const noteH = Math.max(6, bottomY - topY);
        const noteY = topY;

        const x = rect.left;
        const noteW = Math.max(3, rect.width - 2);

        const isBlack = isBlackKey(n.midi);
        const palette = colors[noteColor] || colors.cyan;
        const color = noteColor === "rainbow" ? rainbow(n.midi) : (isBlack ? palette.black : palette.white);

        // Draw glow
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = color;
        roundRect(ctx, x + 1, noteY, noteW, noteH, 4);
        ctx.fill();

        // Inner brighter core
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        roundRect(ctx, x + 2, noteY + 2, Math.max(1, noteW - 4), Math.max(1, noteH - 4), 3);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [lookahead, noteColor]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      data-testid="rolling-notes"
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}

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
