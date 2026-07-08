import React, { useEffect } from "react";
import { X, Plus, Minus, Trash2, Save, ArrowUp, ArrowDown } from "lucide-react";
import { midiToNoteName } from "@/lib/piano";

/*
  MidiEditorOverlay: renders clickable note divs on top of canvas for visible notes.
  Selecting a note allows shifting its pitch via buttons or keyboard.
*/
export function MidiEditorOverlay({
  song,
  currentTime,
  lookahead,
  keyRects,
  selectedIdx,
  onSelectIdx,
}) {
  if (!song) return null;
  return (
    <div className="absolute inset-0 z-20 pointer-events-none" data-testid="midi-editor-overlay">
      {song.notes.map((n, idx) => {
        const relStart = n.time - currentTime;
        const relEnd = n.time + n.duration - currentTime;
        if (relEnd < 0 || relStart > lookahead) return null;
        const rect = keyRects[n.midi];
        if (!rect) return null;
        // percentages of container
        return (
          <button
            key={`${idx}-${n.midi}-${n.time}`}
            data-testid={`edit-note-${idx}`}
            onClick={() => onSelectIdx(idx)}
            className={`absolute pointer-events-auto rounded border-2 transition-all ${
              selectedIdx === idx
                ? "border-yellow-300 bg-yellow-300/40 shadow-[0_0_16px_rgba(253,224,71,0.9)]"
                : "border-white/30 bg-white/5 hover:border-white/60 hover:bg-white/20"
            }`}
            style={{
              left: rect.left + 1,
              width: Math.max(3, rect.width - 2),
              top: `calc(${100 - (relEnd / lookahead) * 100}% )`,
              height: `${((relEnd - relStart) / lookahead) * 100}%`,
              minHeight: 8,
            }}
          />
        );
      })}
    </div>
  );
}

export function EditToolbar({
  selectedIdx,
  selectedNote,
  onShift,
  onDelete,
  onSave,
  onCancel,
  onGlobalShift,
  isDirty,
  saving,
}) {
  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (selectedIdx === null || selectedIdx === undefined) return;
      if (e.key === "ArrowRight") { e.preventDefault(); onShift(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); onShift(-1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); onShift(12); }
      else if (e.key === "ArrowDown") { e.preventDefault(); onShift(-12); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onDelete(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIdx, onShift, onDelete]);

  return (
    <div
      className="glass-bright rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 border border-yellow-300/40"
      data-testid="edit-toolbar"
    >
      <div className="text-xs uppercase tracking-[0.2em] text-yellow-300 font-bold">Editing MIDI</div>

      <div className="flex items-center gap-1 border-l border-white/10 pl-3">
        <span className="text-[10px] uppercase tracking-wider text-white/50 mr-1">Selected</span>
        <span className="text-sm font-mono font-bold text-yellow-300 min-w-[64px]" data-testid="selected-note-label">
          {selectedNote ? midiToNoteName(selectedNote.midi) : "—"}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onShift(-12)}
          disabled={selectedIdx == null}
          className="w-8 h-8 rounded border border-white/15 flex items-center justify-center hover:border-yellow-300 hover:text-yellow-300 transition-all disabled:opacity-30"
          data-testid="shift-octave-down"
          title="-1 octave"
        >
          <ArrowDown size={14} />
        </button>
        <button
          onClick={() => onShift(-1)}
          disabled={selectedIdx == null}
          className="w-8 h-8 rounded border border-white/15 flex items-center justify-center hover:border-yellow-300 hover:text-yellow-300 transition-all disabled:opacity-30"
          data-testid="shift-semitone-down"
          title="-1 semitone (←)"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={() => onShift(1)}
          disabled={selectedIdx == null}
          className="w-8 h-8 rounded border border-white/15 flex items-center justify-center hover:border-yellow-300 hover:text-yellow-300 transition-all disabled:opacity-30"
          data-testid="shift-semitone-up"
          title="+1 semitone (→)"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => onShift(12)}
          disabled={selectedIdx == null}
          className="w-8 h-8 rounded border border-white/15 flex items-center justify-center hover:border-yellow-300 hover:text-yellow-300 transition-all disabled:opacity-30"
          data-testid="shift-octave-up"
          title="+1 octave"
        >
          <ArrowUp size={14} />
        </button>
        <button
          onClick={onDelete}
          disabled={selectedIdx == null}
          className="w-8 h-8 rounded border border-[#FF003C]/50 text-[#FF003C] flex items-center justify-center hover:bg-[#FF003C] hover:text-black transition-all disabled:opacity-30"
          data-testid="delete-note"
          title="Delete note (Del)"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
        <span className="text-[10px] uppercase tracking-wider text-white/50 mr-1">All:</span>
        <button
          onClick={() => onGlobalShift(-1)}
          className="px-2 h-8 rounded border border-white/15 text-xs hover:border-cyan-300 hover:text-cyan-300 transition-all"
          data-testid="global-shift-down"
        >
          −1
        </button>
        <button
          onClick={() => onGlobalShift(1)}
          className="px-2 h-8 rounded border border-white/15 text-xs hover:border-cyan-300 hover:text-cyan-300 transition-all"
          data-testid="global-shift-up"
        >
          +1
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onCancel}
          className="px-3 h-8 rounded border border-white/20 text-xs uppercase tracking-wider hover:border-white/50 transition-all"
          data-testid="edit-cancel"
        >
          <X size={13} className="inline mr-1" /> Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty || saving}
          className="px-3 h-8 rounded bg-yellow-300 text-black text-xs font-bold uppercase tracking-wider hover:shadow-[0_0_16px_rgba(253,224,71,0.7)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          data-testid="edit-save"
        >
          <Save size={13} className="inline mr-1" /> {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
