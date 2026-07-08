import React, { useRef } from "react";
import { Upload, Music2, Sparkles, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SongLibrary({
  demoSongs,
  userSongs,
  currentSongId,
  onSelect,
  onUpload,
  onDelete,
  converting,
}) {
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const isAudio = ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext);
    const isMidi = ext === "mid" || ext === "midi";
    if (!isAudio && !isMidi) {
      toast.error("Unsupported file. Use .mid, .midi, .mp3, .wav, .ogg, .m4a, or .flac", { duration: 4000 });
      e.target.value = "";
      return;
    }
    try {
      await onUpload(file, isAudio);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to import: ${err.message || err}`);
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
          disabled={!!converting}
          className="flex items-center gap-2 px-3 py-2 border border-[#00F0FF] text-[#00F0FF] rounded-lg hover:bg-[#00F0FF] hover:text-black transition-all text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="upload-button"
        >
          {converting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {converting ? "Working" : "Upload"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".mid,.midi,.mp3,.wav,.ogg,.m4a,.flac"
          className="hidden"
          onChange={handleFile}
          data-testid="upload-input"
        />
      </div>

      {converting && (
        <div className="glass rounded-lg px-3 py-2.5 border border-[#00F0FF]/40" data-testid="conversion-progress">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/70 mb-1.5">
            <span>{converting.stage}</span>
            <span className="neon-cyan font-mono">{converting.percent}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00F0FF] to-[#7000FF] transition-all duration-200"
              style={{ width: `${converting.percent}%` }}
            />
          </div>
        </div>
      )}

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
          className="p-1.5 rounded-md text-white/40 hover:bg-[#FF003C]/20 hover:text-[#FF003C] transition-all"
          data-testid={`delete-song-${song.id}`}
          aria-label="Delete"
          title="Remove from library"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
