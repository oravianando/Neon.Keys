import React, { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { chordNameToMidi, chordDisplayName } from "@/lib/chordParser";
import { KEYS, isBlackKey } from "@/lib/piano";

/*
  ChordTutorial — a floating, glass-morphic overlay that sits ABOVE the main
  piano and shows the currently-active chord's shape:
    • Chord name (large, neon)
    • Mini keyboard (2 octaves centered on middle C) with the chord's notes
      highlighted in the note-color, so learners see exactly which keys to press.
    • Play button — triggers all chord tones via `onPlay(midiArray)` so the
      user can hear the chord.

  Positioned absolutely by its parent. Overlay is non-interactive except for the
  Play button, which sits at pointer-events: auto.
*/
export default function ChordTutorial({ chords, currentTime, visible, noteColor = "#00F0FF", onPlay }) {
  const [active, setActive] = useState(null);
  const lastNameRef = useRef(null);

  useEffect(() => {
    if (!chords || chords.length === 0 || !visible) {
      if (active) setActive(null);
      return;
    }
    let picked = null;
    for (const c of chords) {
      if (c.time <= currentTime + 0.05) picked = c;
      else break;
    }
    const nextName = picked?.name || null;
    if (nextName !== lastNameRef.current) {
      lastNameRef.current = nextName;
      setActive(picked);
    }
  }, [chords, currentTime, visible, active]);

  if (!visible || !active) return null;

  const midis = chordNameToMidi(active.name);
  if (!midis || midis.length === 0) return null;

  const start = 48;
  const end = 72;
  const chordSet = new Set(midis);
  const whiteKeys = KEYS.filter((k) => !k.black && k.midi >= start && k.midi <= end);

  const handlePlay = (e) => {
    e.stopPropagation();
    if (onPlay) onPlay(midis);
  };

  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-2 z-30 select-none flex flex-col items-center gap-2 animate-fade-in"
      style={{ filter: "drop-shadow(0 4px 20px rgba(0,0,0,0.5))" }}
      data-testid="chord-tutorial-overlay"
    >
      <div
        className="glass px-3 py-2 rounded-lg border flex items-center gap-2"
        style={{ borderColor: noteColor, boxShadow: `0 0 20px ${noteColor}55` }}
      >
        <span
          className="font-heading font-bold text-2xl tracking-widest"
          style={{ color: noteColor, textShadow: `0 0 12px ${noteColor}` }}
          data-testid="chord-tutorial-name"
        >
          {chordDisplayName(active.name)}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">chord</span>
        {onPlay && (
          <button
            onClick={handlePlay}
            onMouseDown={(e) => e.stopPropagation()}
            className="pointer-events-auto ml-1 w-7 h-7 rounded-full flex items-center justify-center border transition-all hover:scale-110 active:scale-95"
            style={{
              borderColor: noteColor,
              color: noteColor,
              boxShadow: `0 0 10px ${noteColor}66`,
            }}
            data-testid="chord-tutorial-play"
            title="Play this chord"
            aria-label={`Play ${chordDisplayName(active.name)} chord`}
          >
            <Play size={12} fill="currentColor" />
          </button>
        )}
      </div>
      <MiniKeyboard whiteKeys={whiteKeys} chordSet={chordSet} noteColor={noteColor} />
    </div>
  );
}

function MiniKeyboard({ whiteKeys, chordSet, noteColor }) {
  return (
    <div
      className="relative rounded-md overflow-hidden glass border border-white/10"
      style={{ width: 240, height: 60 }}
      data-testid="chord-tutorial-mini-keyboard"
    >
      <div className="flex h-full w-full">
        {whiteKeys.map((k) => {
          const active = chordSet.has(k.midi);
          return (
            <div
              key={k.midi}
              className="flex-1 h-full relative border-r border-black/40 last:border-r-0"
              style={{
                background: active
                  ? `linear-gradient(180deg, ${noteColor}, ${noteColor}77)`
                  : "linear-gradient(180deg, #ddd, #a8a8a8)",
                boxShadow: active
                  ? `inset 0 -3px 0 ${noteColor}, 0 0 8px ${noteColor}88`
                  : "inset 0 -2px 0 rgba(0,0,0,0.2)",
              }}
              data-testid={`chord-tutorial-key-${k.name.replace("#", "s")}`}
            />
          );
        })}
      </div>
      <div className="absolute inset-0 flex w-full h-full pointer-events-none">
        {whiteKeys.map((wk, i) => {
          const nextMidi = wk.midi + 1;
          const hasBlack = isBlackKey(nextMidi) && i < whiteKeys.length - 1;
          return (
            <div key={wk.midi} className="relative flex-1 h-full">
              {hasBlack && (() => {
                const active = chordSet.has(nextMidi);
                return (
                  <div
                    className="absolute rounded-b-sm"
                    style={{
                      right: "-30%",
                      width: "60%",
                      height: "62%",
                      top: 0,
                      background: active
                        ? `linear-gradient(180deg, ${noteColor}, ${noteColor}66)`
                        : "linear-gradient(180deg, #1a1a1a, #000)",
                      boxShadow: active ? `0 0 8px ${noteColor}` : "0 2px 3px rgba(0,0,0,0.5)",
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
  );
}
