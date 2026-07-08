import React, { useEffect, useRef } from "react";
import { X, Plus, Minus, Trash2, Save, ArrowUp, ArrowDown, GripHorizontal, Scissors } from "lucide-react";
import { midiToNoteName } from "@/lib/piano";

/*
  MidiEditorOverlay: renders clickable note divs on top of canvas for visible notes.
  Selecting a note allows shifting its pitch via buttons or keyboard.
  A resize handle at the top edge of each selected note lets the user drag to
  change duration (drag UP = longer note, drag DOWN = shorter note).
*/
export function MidiEditorOverlay({
  song,
  currentTime,
  lookahead,
  keyRects,
  selectedIdx,
  onSelectIdx,
  onResize,
}) {
  const containerRef = useRef(null);
  const dragRef = useRef(null); // { idx, startY, startDuration, containerH }

  useEffect(() => {
    if (!onResize) return;
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const deltaY = d.startY - clientY; // up = positive
      // The container maps `lookahead` seconds to containerH pixels.
      // Dragging UP by deltaY pixels adds deltaY / containerH * lookahead seconds.
      const deltaSec = (deltaY / d.containerH) * lookahead;
      onResize(d.idx, d.startDuration + deltaSec);
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [onResize, lookahead]);

  const startResize = (e, idx, note) => {
    e.stopPropagation();
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const containerH = container.getBoundingClientRect().height;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      idx,
      startY: clientY,
      startDuration: note.duration,
      containerH,
    };
    onSelectIdx(idx);
  };

  if (!song) return null;
  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-none"
      data-testid="midi-editor-overlay"
    >
      {song.notes.map((n, idx) => {
        const relStart = n.time - currentTime;
        const relEnd = n.time + n.duration - currentTime;
        if (relEnd < 0 || relStart > lookahead) return null;
        const rect = keyRects[n.midi];
        if (!rect) return null;
        const selected = selectedIdx === idx;
        const noteW = Math.max(3, rect.width - 2);
        return (
          <div
            key={`${idx}-${n.midi}-${n.time}`}
            className="absolute"
            style={{
              left: rect.left + 1,
              width: noteW,
              top: `calc(${100 - (relEnd / lookahead) * 100}% )`,
              height: `${((relEnd - relStart) / lookahead) * 100}%`,
              minHeight: 12,
            }}
          >
            <button
              data-testid={`edit-note-${idx}`}
              onClick={() => onSelectIdx(idx)}
              className={`absolute inset-0 pointer-events-auto rounded border-2 transition-all ${
                selected
                  ? "border-yellow-300 bg-yellow-300/40 shadow-[0_0_16px_rgba(253,224,71,0.9)]"
                  : "border-white/30 bg-white/5 hover:border-white/60 hover:bg-white/20"
              }`}
            />
            {/* Resize handle at the top edge (only when selected + noteW > 12px) */}
            {selected && onResize && noteW >= 12 && (
              <div
                onMouseDown={(e) => startResize(e, idx, n)}
                onTouchStart={(e) => startResize(e, idx, n)}
                className="absolute -top-1 left-0 right-0 h-3 flex items-center justify-center cursor-ns-resize pointer-events-auto z-10 group"
                data-testid={`resize-handle-${idx}`}
                title="Drag to resize duration"
                aria-label="Resize note duration"
              >
                <div className="w-full h-1 bg-yellow-300 rounded-full shadow-[0_0_8px_rgba(253,224,71,1)] group-hover:h-2 transition-all" />
                <GripHorizontal
                  size={12}
                  className="absolute text-black bg-yellow-300 rounded-full p-0.5"
                />
              </div>
            )}
          </div>
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
  onCompressGaps,
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
        {onCompressGaps && (
          <button
            onClick={onCompressGaps}
            className="ml-1 flex items-center gap-1 px-2 h-8 rounded border border-[#00F0FF]/40 text-[#00F0FF] text-xs uppercase tracking-wider hover:bg-[#00F0FF] hover:text-black transition-all"
            data-testid="compress-gaps"
            title="Remove silent gaps longer than 0.3s"
          >
            <Scissors size={12} /> Trim Gaps
          </button>
        )}
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
