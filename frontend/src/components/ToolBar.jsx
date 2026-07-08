import React from "react";
import { Sparkles, RefreshCw, Pencil, Hand } from "lucide-react";

const DIFFICULTIES = [
  { id: "beginner", label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

const PRACTICE_MODES = [
  { id: "both", label: "Both" },
  { id: "right", label: "Right" },
  { id: "left", label: "Left" },
];

export default function ToolBar({
  difficulty,
  onDifficultyChange,
  practiceMode,
  onPracticeModeChange,
  onReprocess,
  reprocessing,
  reprocessDisabled,
  editMode,
  onToggleEdit,
  editDisabled,
}) {
  return (
    <div className="glass-bright rounded-xl px-4 py-3 flex flex-wrap items-center gap-3" data-testid="toolbar">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[#00F0FF]" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">Level</span>
        <div className="flex gap-1">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              onClick={() => onDifficultyChange(d.id)}
              className={`px-2.5 h-7 rounded text-[11px] uppercase tracking-wider transition-all border ${
                difficulty === d.id
                  ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                  : "border-white/15 text-white/70 hover:border-[#00F0FF] hover:text-[#00F0FF]"
              }`}
              data-testid={`difficulty-${d.id}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-l border-white/10 pl-3">
        <Hand size={13} className="text-[#FF00E6]" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">Practice</span>
        <div className="flex gap-1">
          {PRACTICE_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onPracticeModeChange(m.id)}
              className={`px-2.5 h-7 rounded text-[11px] uppercase tracking-wider transition-all border ${
                practiceMode === m.id
                  ? "bg-[#FF00E6] text-black border-[#FF00E6]"
                  : "border-white/15 text-white/70 hover:border-[#FF00E6] hover:text-[#FF00E6]"
              }`}
              data-testid={`practice-${m.id}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onReprocess}
          disabled={reprocessDisabled || reprocessing}
          className="flex items-center gap-1.5 px-3 h-8 rounded border border-[#00F0FF]/60 text-[#00F0FF] text-[11px] uppercase tracking-wider hover:bg-[#00F0FF] hover:text-black transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="reprocess-button"
          title="Reprocess with AI using current difficulty"
        >
          <RefreshCw size={13} className={reprocessing ? "animate-spin" : ""} />
          {reprocessing ? "Reprocessing…" : "Reprocess"}
        </button>
        <button
          onClick={onToggleEdit}
          disabled={editDisabled}
          className={`flex items-center gap-1.5 px-3 h-8 rounded border text-[11px] uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            editMode
              ? "bg-yellow-300 text-black border-yellow-300 shadow-[0_0_16px_rgba(253,224,71,0.5)]"
              : "border-yellow-300/60 text-yellow-300 hover:bg-yellow-300 hover:text-black"
          }`}
          data-testid="edit-toggle"
        >
          <Pencil size={13} /> {editMode ? "Editing" : "Edit"}
        </button>
      </div>
    </div>
  );
}
