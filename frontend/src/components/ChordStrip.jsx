import React from "react";

/*
  ChordStrip: horizontal strip above rolling notes showing detected chord names.
  Chords are positioned by time relative to the currentTime + lookahead window.
*/
export default function ChordStrip({ chords, currentTime, lookahead }) {
  if (!chords || chords.length === 0) return null;

  const visible = chords.filter(
    (c) => c.time >= currentTime - 0.5 && c.time <= currentTime + lookahead + 0.5,
  );

  return (
    <div
      className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-10 overflow-hidden"
      data-testid="chord-strip"
    >
      {visible.map((c, i) => {
        const rel = (c.time - currentTime) / lookahead; // 0..1
        const leftPct = Math.max(0, Math.min(100, rel * 100));
        const active = c.time <= currentTime && (visible[i + 1]?.time ?? Infinity) > currentTime;
        return (
          <div
            key={`${c.time}-${i}`}
            className={`absolute top-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border transition-all ${
              active
                ? "bg-[#00F0FF]/25 border-[#00F0FF] text-[#00F0FF] shadow-[0_0_12px_rgba(0,240,255,0.6)]"
                : "bg-black/50 border-white/15 text-white/70"
            }`}
            style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
            data-testid={`chord-label-${i}`}
          >
            {c.name}
          </div>
        );
      })}
    </div>
  );
}
