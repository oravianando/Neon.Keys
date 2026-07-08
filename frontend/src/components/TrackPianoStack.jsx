import React, { useEffect, useRef, useState } from "react";
import { Music2 } from "lucide-react";
import { KEYS, isBlackKey } from "@/lib/piano";
import { FAMILY_COLORS } from "@/lib/instruments";

/*
  TrackPianoStack — renders mini piano keyboards below the main piano,
  one per non-primary, non-drum track. Each keyboard highlights its own
  active notes in the track's color AND is interactive (click a key to
  hear that track's instrument).

  Layout note: the keyboard grid MUST align 1:1 with the main piano
  (same 88-key layout, no left sidebar taking space). Track name is
  rendered as a floating badge on the top-left of each row.
*/
export default function TrackPianoStack({
  tracks,
  currentTime,
  trackColors = {},
  mutedTracks = new Set(),
  soloedTrack = null,
  onKeyDown,
}) {
  if (!tracks || tracks.length <= 1) return null;

  const sorted = [...tracks].sort((a, b) => {
    const aP = a.family === "piano" ? 1 : 0;
    const bP = b.family === "piano" ? 1 : 0;
    if (aP !== bP) return bP - aP;
    return b.notes.length - a.notes.length;
  });
  const secondary = sorted.slice(1).filter((t) => !t.isDrum);
  if (secondary.length === 0) return null;

  return (
    <div
      className="w-full flex flex-col gap-1 bg-black border-t border-white/10 pb-1"
      data-testid="track-piano-stack"
    >
      {secondary.map((track) => {
        const id = String(track.id);
        const color = trackColors[id] || FAMILY_COLORS[track.family] || "#00F0FF";
        const muted = mutedTracks.has(id);
        const isSoloed = String(soloedTrack) === id;
        const soloActive = soloedTrack != null && !isSoloed;
        const dim = muted || soloActive;
        return (
          <TrackKeyboardRow
            key={id}
            track={track}
            currentTime={currentTime}
            color={color}
            dimmed={dim}
            onKeyDown={onKeyDown}
          />
        );
      })}
    </div>
  );
}

function TrackKeyboardRow({ track, currentTime, color, dimmed, onKeyDown }) {
  const [activeMidi, setActiveMidi] = useState(new Set());
  const rafRef = useRef(null);
  const activeRef = useRef(new Set());
  const currentTimeRef = useRef(currentTime);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    const tick = () => {
      const t = currentTimeRef.current;
      const s = new Set();
      for (const n of track.notes) {
        if (n.time <= t && n.time + n.duration > t) s.add(n.midi);
      }
      let changed = s.size !== activeRef.current.size;
      if (!changed) {
        for (const m of s)
          if (!activeRef.current.has(m)) {
            changed = true;
            break;
          }
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

  const handlePress = (midi) => {
    if (dimmed) return;
    onKeyDown?.(midi, track.family || "piano");
  };

  return (
    <div
      className={`relative flex flex-col transition-opacity ${dimmed ? "opacity-30" : ""}`}
      data-testid={`track-stack-${track.id}`}
    >
      {/* Floating badge (does not consume horizontal space) */}
      <div
        className="absolute top-1 left-2 z-10 flex items-center gap-1.5 pointer-events-none glass px-2 py-0.5 rounded-md"
        style={{ borderColor: color, borderWidth: 1 }}
      >
        <Music2 size={9} style={{ color }} />
        <span className="text-[9px] font-mono font-bold uppercase tracking-widest" style={{ color }}>
          {track.name}
        </span>
        <span className="text-[8px] text-white/40 uppercase tracking-widest">{track.family}</span>
      </div>

      <div className="flex-1 relative h-14 select-none">
        <div className="flex h-full w-full">
          {whiteKeys.map((k) => {
            const active = activeMidi.has(k.midi);
            return (
              <button
                key={k.midi}
                type="button"
                onMouseDown={() => handlePress(k.midi)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handlePress(k.midi);
                }}
                className="flex-1 h-full relative border-r border-black/40 rounded-b-sm transition-all cursor-pointer active:brightness-90"
                style={{
                  background: active
                    ? `linear-gradient(180deg, ${color}, ${color}88)`
                    : "linear-gradient(180deg, #ddd, #b8b8b8)",
                  boxShadow: active
                    ? `0 0 12px ${color}, inset 0 -2px 0 rgba(0,0,0,0.15)`
                    : "inset 0 -2px 0 rgba(0,0,0,0.15)",
                }}
                data-testid={`stack-key-${track.id}-${k.name.replace("#", "s")}`}
                aria-label={`Play ${k.name} on ${track.name}`}
              />
            );
          })}
        </div>
        <div className="absolute inset-0 flex w-full h-full pointer-events-none">
          {whiteKeys.map((wk) => {
            const nextMidi = wk.midi + 1;
            const hasBlack = isBlackKey(nextMidi) && nextMidi <= 108;
            return (
              <div key={wk.midi} className="relative flex-1 h-full">
                {hasBlack &&
                  (() => {
                    const bk = KEYS.find((k) => k.midi === nextMidi);
                    const active = activeMidi.has(bk.midi);
                    return (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handlePress(bk.midi);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePress(bk.midi);
                        }}
                        className="absolute rounded-b-sm transition-all pointer-events-auto cursor-pointer active:brightness-90"
                        style={{
                          right: "-30%",
                          width: "60%",
                          height: "62%",
                          top: 0,
                          background: active
                            ? `linear-gradient(180deg, ${color}, ${color}77)`
                            : "linear-gradient(180deg, #1a1a1a, #000)",
                          boxShadow: active
                            ? `0 0 12px ${color}`
                            : "0 2px 3px rgba(0,0,0,0.5)",
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                        data-testid={`stack-key-${track.id}-${bk.name.replace("#", "s")}`}
                        aria-label={`Play ${bk.name} on ${track.name}`}
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
