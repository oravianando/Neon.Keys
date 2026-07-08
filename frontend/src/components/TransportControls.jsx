import React from "react";
import { Play, Pause, Square, Gauge } from "lucide-react";
import { Slider } from "@/components/ui/slider";

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function TransportControls({
  isPlaying,
  currentTime,
  duration,
  speed,
  onPlay,
  onPause,
  onStop,
  onSeek,
  onSpeedChange,
  songName,
}) {
  const pct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="glass-bright rounded-2xl px-5 py-4 flex flex-col gap-3" data-testid="transport-controls">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] tracking-[0.3em] text-white/40 uppercase mb-0.5">Now Playing</div>
          <div className="font-heading text-lg font-bold truncate neon-cyan" data-testid="current-song-name">
            {songName || "— No Song Loaded —"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isPlaying ? (
            <button
              onClick={onPause}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-[#00F0FF] text-black hover:shadow-[0_0_24px_rgba(0,240,255,0.7)] transition-all"
              data-testid="pause-button"
              aria-label="Pause"
            >
              <Pause size={18} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-[#00F0FF] text-black hover:shadow-[0_0_24px_rgba(0,240,255,0.7)] transition-all"
              data-testid="play-button"
              aria-label="Play"
            >
              <Play size={18} fill="currentColor" />
            </button>
          )}
          <button
            onClick={onStop}
            className="w-11 h-11 rounded-full flex items-center justify-center border border-white/20 text-white hover:border-[#FF003C] hover:text-[#FF003C] transition-all"
            data-testid="stop-button"
            aria-label="Stop"
          >
            <Square size={16} fill="currentColor" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-xs font-mono text-white/60 tabular-nums w-12" data-testid="current-time">{fmt(currentTime)}</span>
        <div
          className="flex-1 h-2 rounded-full bg-white/10 relative cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const p = (e.clientX - rect.left) / rect.width;
            onSeek?.(p * (duration || 0));
          }}
          data-testid="progress-bar"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#00F0FF] to-[#7000FF] shadow-[0_0_12px_rgba(0,240,255,0.6)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-mono text-white/60 tabular-nums w-12 text-right">{fmt(duration || 0)}</span>
      </div>

      <div className="flex items-center gap-4 pt-1">
        <div className="flex items-center gap-2 text-white/60">
          <Gauge size={14} />
          <span className="text-[10px] tracking-[0.2em] uppercase">Speed</span>
        </div>
        <div className="flex-1 max-w-xs">
          <Slider
            value={[speed]}
            min={0.25}
            max={2}
            step={0.05}
            onValueChange={(v) => onSpeedChange?.(v[0])}
            data-testid="speed-slider"
          />
        </div>
        <span className="text-sm font-mono neon-cyan tabular-nums w-12 text-right" data-testid="speed-value">{speed.toFixed(2)}x</span>
      </div>
    </div>
  );
}
