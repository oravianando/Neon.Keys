import React, { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import { KEYS, isBlackKey } from "@/lib/piano";

/*
  MultiInstrumentStack: renders 1..N slim piano keyboards, one per non-main track.
  Each keyboard highlights its own active keys.
  currentTime drives which notes are currently active per track.
*/
export default function MultiInstrumentStack({ tracks, currentTime, palette = ["#00F0FF", "#FF00E6", "#7CFF9A", "#FFD700", "#FF71CE"] }) {
  if (!tracks || tracks.length <= 1) return null;

  // Main track priority: piano family > largest note count. Everything else is secondary.
  const sorted = [...tracks].sort((a, b) => {
    const aPiano = a.family === "piano" ? 1 : 0;
    const bPiano = b.family === "piano" ? 1 : 0;
    if (aPiano !== bPiano) return bPiano - aPiano;
    return b.notes.length - a.notes.length;
  });
  const secondary = sorted.slice(1).filter((t) => !t.isDrum);
  if (secondary.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-1 bg-black border-t border-white/10 px-1 pb-1" data-testid="multi-instrument-stack">
      {secondary.map((track, idx) => (
        <TrackKeyboard
          key={track.id}
          track={track}
          currentTime={currentTime}
          color={palette[(idx + 1) % palette.length]}
        />
      ))}
    </div>
  );
}

function TrackKeyboard({ track, currentTime, color }) {
  const [activeMidi, setActiveMidi] = useState(new Set());
  const rafRef = useRef(null);
  const noteIdxRef = useRef(0);
  const activeRef = useRef(new Set());
  const currentTimeRef = useRef(currentTime);

  useEffect(() => {
    currentTimeRef.current = currentTime;
    if (currentTime === 0) noteIdxRef.current = 0;
  }, [currentTime]);

  useEffect(() => {
    const tick = () => {
      const t = currentTimeRef.current;
      // Recompute active set
      const s = new Set();
      for (const n of track.notes) {
        if (n.time <= t && n.time + n.duration > t) {
          s.add(n.midi);
        }
      }
      // Only update state if changed
      let changed = s.size !== activeRef.current.size;
      if (!changed) {
        for (const m of s) if (!activeRef.current.has(m)) { changed = true; break; }
      }
      if (changed) {
        activeRef.current = s;
        setActiveMidi(new Set(s));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [track]);

  const whiteKeys = KEYS.filter((k) => !k.black);

  return (
    <div className="flex items-stretch gap-2" data-testid={`track-${track.id}`}>
      {/* Instrument label */}
      <div className="flex flex-col justify-center px-3 py-1 min-w-[110px] border-r border-white/10">
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white/40">
          <Music2 size={9} style={{ color }} />
          <span>Track</span>
        </div>
        <div className="text-[11px] font-mono font-bold truncate" style={{ color }} title={track.name}>
          {track.name}
        </div>
      </div>

      {/* Mini piano */}
      <div className="flex-1 relative h-14 select-none">
        <div className="flex h-full w-full">
          {whiteKeys.map((k) => {
            const active = activeMidi.has(k.midi);
            return (
              <div
                key={k.midi}
                className="flex-1 h-full relative border-r border-black/40 rounded-b-sm transition-all"
                style={{
                  background: active
                    ? `linear-gradient(180deg, ${color}, ${color}88)`
                    : "linear-gradient(180deg, #ddd, #b8b8b8)",
                  boxShadow: active ? `0 0 12px ${color}, inset 0 -2px 0 rgba(0,0,0,0.15)` : "inset 0 -2px 0 rgba(0,0,0,0.15)",
                }}
              />
            );
          })}
        </div>
        {/* Black keys overlay */}
        <div className="absolute inset-0 flex w-full h-full pointer-events-none">
          {whiteKeys.map((wk) => {
            const nextMidi = wk.midi + 1;
            const hasBlack = isBlackKey(nextMidi) && nextMidi <= 108;
            return (
              <div key={wk.midi} className="relative flex-1 h-full">
                {hasBlack && (() => {
                  const bk = KEYS.find((k) => k.midi === nextMidi);
                  const active = activeMidi.has(bk.midi);
                  return (
                    <div
                      className="absolute rounded-b-sm transition-all"
                      style={{
                        right: "-30%",
                        width: "60%",
                        height: "62%",
                        top: 0,
                        background: active
                          ? `linear-gradient(180deg, ${color}, ${color}77)`
                          : "linear-gradient(180deg, #1a1a1a, #000)",
                        boxShadow: active ? `0 0 12px ${color}` : "0 2px 3px rgba(0,0,0,0.5)",
                        border: "1px solid rgba(255,255,255,0.05)",
                      }}
                    />
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
