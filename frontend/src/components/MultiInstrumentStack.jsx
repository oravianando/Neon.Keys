import React from "react";
import { Music2, Volume2, VolumeX, Star } from "lucide-react";
import { FAMILY_COLORS } from "@/lib/instruments";

/*
  InstrumentControls: compact chip bar showing one card per track with
  color swatch, name, family, mute+solo. No mini keyboards — all tracks
  share the main piano + rolling-notes area, color-coded per track.
*/
export default function InstrumentControls({
  tracks,
  trackColors,
  mutedTracks,
  soloedTrack,
  onMuteToggle,
  onSoloToggle,
}) {
  if (!tracks || tracks.length <= 1) return null;

  // Order piano-family first, then by note count desc
  const sorted = [...tracks].sort((a, b) => {
    const aP = a.family === "piano" ? 1 : 0;
    const bP = b.family === "piano" ? 1 : 0;
    if (aP !== bP) return bP - aP;
    return b.notes.length - a.notes.length;
  });

  return (
    <div
      className="glass-bright rounded-xl px-3 py-2 flex items-center gap-2 overflow-x-auto piano-scroll"
      data-testid="instrument-controls"
    >
      <div className="text-[10px] uppercase tracking-[0.2em] text-white/50 pr-2 border-r border-white/10 shrink-0">
        Tracks
      </div>
      {sorted.map((t) => {
        const id = String(t.id);
        const color = trackColors[id] || FAMILY_COLORS[t.family] || "#00F0FF";
        const muted = mutedTracks.has(id);
        const soloed = String(soloedTrack) === id;
        return (
          <div
            key={id}
            data-testid={`track-${id}`}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all shrink-0 ${
              muted ? "opacity-40" : ""
            } ${soloed ? "ring-1 ring-yellow-300" : "border-white/10"}`}
            style={{ background: `linear-gradient(90deg, ${color}22, transparent)` }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                background: color,
                boxShadow: `0 0 8px ${color}`,
              }}
            />
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-mono font-bold" style={{ color }} title={t.name}>
                {t.name.length > 18 ? t.name.slice(0, 17) + "…" : t.name}
              </span>
              <span className="text-[8px] uppercase tracking-widest text-white/40 flex items-center gap-1">
                <Music2 size={8} />
                {t.family}
              </span>
            </div>
            <button
              onClick={() => onSoloToggle(id)}
              data-testid={`solo-${id}`}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                soloed
                  ? "bg-yellow-300 text-black border-yellow-300"
                  : "border-white/15 text-white/60 hover:border-yellow-300 hover:text-yellow-300"
              }`}
              title="Solo this track"
            >
              <Star size={11} />
            </button>
            <button
              onClick={() => onMuteToggle(id)}
              data-testid={`mute-${id}`}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                muted
                  ? "bg-[#FF003C] text-white border-[#FF003C]"
                  : "border-white/15 text-white/60 hover:border-[#FF003C] hover:text-[#FF003C]"
              }`}
              title="Mute this track"
            >
              {muted ? <VolumeX size={11} /> : <Volume2 size={11} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}
