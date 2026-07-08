import React, { useRef } from "react";
import { Upload, Music2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SongLibrary({
  demoSongs,
  userSongs,
  currentSongId,
  onSelect,
  onUpload,
  onDelete,
}) {
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "mp3" || ext === "wav") {
      toast.info("Audio → MIDI conversion is coming soon. Please upload a .mid file for now.", { duration: 4500 });
      e.target.value = "";
      return;
    }
    if (ext !== "mid" && ext !== "midi") {
      toast.error("Unsupported file. Please upload .mid or .midi", { duration: 4000 });
      e.target.value = "";
      return;
    }
    try {
      await onUpload(file);
      toast.success(`Loaded "${file.name}"`);
    } catch (err) {
      toast.error("Failed to parse MIDI file.");
    }
    e.target.value = "";
  };

  return (
    <div className="glass-bright rounded-2xl p-5 flex flex-col gap-4 h-full overflow-hidden" data-testid="song-library">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Library</div>
          <h2 className="font-heading font-bold text-xl">Songs</h2>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 border border-[#00F0FF] text-[#00F0FF] rounded-lg hover:bg-[#00F0FF] hover:text-black transition-all text-xs uppercase tracking-wider"
          data-testid="upload-button"
        >
          <Upload size={14} />
          Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".mid,.midi,.mp3,.wav"
          className="hidden"
          onChange={handleFile}
          data-testid="upload-input"
        />
      </div>

      <div className="flex-1 overflow-y-auto piano-scroll pr-1 space-y-4">
        {userSongs.length > 0 && (
          <section>
            <div className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2 flex items-center gap-1.5">
              <Music2 size={11} /> Uploaded
            </div>
            <div className="space-y-1.5">
              {userSongs.map((s) => (
                <SongRow
                  key={s.id}
                  song={s}
                  active={s.id === currentSongId}
                  onSelect={onSelect}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-2 flex items-center gap-1.5">
            <Sparkles size={11} /> Demos
          </div>
          <div className="space-y-1.5">
            {demoSongs.map((s) => (
              <SongRow
                key={s.id}
                song={s}
                active={s.id === currentSongId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SongRow({ song, active, onSelect, onDelete }) {
  return (
    <div
      className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
        active
          ? "bg-[#00F0FF]/10 border-[#00F0FF]/50 shadow-[0_0_20px_rgba(0,240,255,0.15)]"
          : "border-white/5 hover:border-white/20 hover:bg-white/5"
      }`}
      onClick={() => onSelect(song)}
      data-testid={`song-row-${song.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold truncate ${active ? "neon-cyan" : "text-white"}`}>
          {song.name}
        </div>
        <div className="text-[10px] font-mono text-white/40">
          {Math.round(song.duration)}s • {song.notes.length} notes
        </div>
      </div>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(song); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-[#FF003C]/20 text-white/40 hover:text-[#FF003C] transition-all"
          data-testid={`delete-song-${song.id}`}
          aria-label="Delete"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}
