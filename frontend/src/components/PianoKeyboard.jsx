import React from "react";
import { KEYS, isBlackKey } from "@/lib/piano";

/*
  activeKeys can be a Set<midi> or a Map<midi, {hand}>. If Map, we colour by hand.
  Palette:
    right hand → cyan (#00F0FF, --key-right)
    left hand  → red  (#FF003C, --key-left)
*/
function getMeta(activeKeys, midi) {
  if (!activeKeys) return null;
  if (activeKeys instanceof Map) return activeKeys.get(midi) || null;
  if (activeKeys instanceof Set) return activeKeys.has(midi) ? { hand: midi < 60 ? "left" : "right" } : null;
  return null;
}

export default function PianoKeyboard({ activeKeys, onKeyDown, showLabels, registerKeyRef, trackColors }) {
  const whiteKeys = KEYS.filter((k) => !k.black);

  const handleDown = (midi) => {
    onKeyDown?.(midi);
  };

  const colorFor = (meta) => {
    if (!meta) return null;
    const tc = trackColors && meta.track != null ? trackColors[String(meta.track)] : null;
    if (tc) return tc;
    return meta.hand === "left" ? "#FF003C" : "#00F0FF";
  };

  return (
    <div
      className="relative w-full h-full select-none"
      data-testid="piano-keyboard"
    >
      <div className="flex h-full w-full">
        {whiteKeys.map((k) => {
          const meta = getMeta(activeKeys, k.midi);
          const active = !!meta;
          const c = colorFor(meta);
          const cls = active
            ? (meta.hand === "left" ? "white-key active-left" : "white-key active-right")
            : "white-key";
          const style = active && c
            ? {
                background: `linear-gradient(180deg, ${c}, ${c}88)`,
                boxShadow: `0 0 24px ${c}, 0 0 48px ${c}66, inset 0 -4px 0 rgba(0,0,0,0.15)`,
              }
            : undefined;
          return (
            <button
              key={k.midi}
              ref={(el) => registerKeyRef?.(k.midi, el)}
              className={`${cls} flex-1 h-full relative`}
              style={style}
              onMouseDown={() => handleDown(k.midi)}
              onTouchStart={(e) => {
                e.preventDefault();
                handleDown(k.midi);
              }}
              data-testid={`piano-key-${k.name.replace("#", "s")}`}
              data-active-hand={active ? meta.hand : undefined}
              data-active-track={active && meta.track != null ? meta.track : undefined}
            >
              {showLabels && (
                <span className="key-label">{k.name}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="absolute inset-0 flex w-full h-full pointer-events-none">
        {whiteKeys.map((wk) => {
          const nextMidi = wk.midi + 1;
          const hasBlack = isBlackKey(nextMidi) && nextMidi <= 108;
          return (
            <div
              key={wk.midi}
              className="relative flex-1 h-full"
            >
              {hasBlack && (() => {
                const bk = KEYS.find((k) => k.midi === nextMidi);
                const meta = getMeta(activeKeys, bk.midi);
                const active = !!meta;
                const c = colorFor(meta);
                const cls = active
                  ? (meta.hand === "left" ? "black-key active-left" : "black-key active-right")
                  : "black-key";
                const style = {
                  right: "-30%",
                  width: "60%",
                  height: "62%",
                  top: 0,
                };
                if (active && c) {
                  style.background = `linear-gradient(180deg, ${c}, ${c}77)`;
                  style.boxShadow = `0 0 20px ${c}, 0 0 40px ${c}66, inset 0 -2px 0 rgba(255,255,255,0.1)`;
                }
                return (
                  <button
                    ref={(el) => registerKeyRef?.(bk.midi, el)}
                    className={`${cls} pointer-events-auto`}
                    style={style}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleDown(bk.midi);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDown(bk.midi);
                    }}
                    data-testid={`piano-key-${bk.name.replace("#", "s")}`}
                    data-active-hand={active ? meta.hand : undefined}
                    data-active-track={active && meta.track != null ? meta.track : undefined}
                  >
                    {showLabels && (
                      <span className="key-label">{bk.name}</span>
                    )}
                  </button>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
