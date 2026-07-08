import React from "react";
import { KEYS, midiToNoteName, isBlackKey } from "@/lib/piano";

/*
  PianoKeyboard: 88-key visual + interactive piano.
  Props:
   - activeKeys: Set of midi numbers currently active
   - onKeyDown(midi): triggered on mouse/touch
   - showLabels: bool
   - registerKeyRef(midi, el): callback to register key DOM (used by parent for note x-positions)
*/
export default function PianoKeyboard({ activeKeys, onKeyDown, showLabels, registerKeyRef }) {
  const whiteKeys = KEYS.filter((k) => !k.black);

  const handleDown = (midi) => {
    onKeyDown?.(midi);
  };

  return (
    <div
      className="relative w-full h-full select-none"
      data-testid="piano-keyboard"
    >
      {/* White keys layer */}
      <div className="flex h-full w-full">
        {whiteKeys.map((k) => {
          const active = activeKeys.has(k.midi);
          return (
            <button
              key={k.midi}
              ref={(el) => registerKeyRef?.(k.midi, el)}
              className={`white-key flex-1 h-full relative ${active ? "active" : ""}`}
              onMouseDown={() => handleDown(k.midi)}
              onTouchStart={(e) => {
                e.preventDefault();
                handleDown(k.midi);
              }}
              data-testid={`piano-key-${k.name.replace("#", "s")}`}
            >
              {showLabels && k.name.startsWith("C") && (
                <span className="key-label">{k.name}</span>
              )}
            </button>
          );
        })}
      </div>
      {/* Black keys overlay */}
      <div className="absolute inset-0 flex w-full h-full pointer-events-none">
        {whiteKeys.map((wk, i) => {
          // Check if there's a black key AFTER this white key
          const nextMidi = wk.midi + 1;
          const hasBlack = isBlackKey(nextMidi) && nextMidi <= 108;
          return (
            <div
              key={wk.midi}
              className="relative flex-1 h-full"
            >
              {hasBlack && (() => {
                const bk = KEYS.find((k) => k.midi === nextMidi);
                const active = activeKeys.has(bk.midi);
                return (
                  <button
                    ref={(el) => registerKeyRef?.(bk.midi, el)}
                    className={`black-key ${active ? "active" : ""} pointer-events-auto`}
                    style={{
                      right: "-30%",
                      width: "60%",
                      height: "62%",
                      top: 0,
                    }}
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
                  >
                    {showLabels && bk.name.startsWith("C") && (
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
