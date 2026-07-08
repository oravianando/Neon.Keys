import React, { useRef } from "react";
import { Upload, Music2, Sparkles, Trash2, Loader2, FileMusic, Download } from "lucide-react";
import { toast } from "sonner";

const CONVERT_MODES = [
  { id: "single", label: "Single Track" },
  { id: "multi", label: "Multi-Track (AI split)" },
];

export default function SongLibrary({
  demoSongs,
  userSongs,
  currentSongId,
  onSelect,
  onUpload,
  onUploadSheet,
  onDelete,
  onDownloadMidi,
  converting,
  convertMode = "single",
  onConvertModeChange,
}) {
  const inputRef = useRef(null);
  const sheetInputRef = useRef(null);

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

  const handleSheetFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    const isImage = ["png", "jpg", "jpeg", "webp"].includes(ext);
    const isPdf = ext === "pdf";
    if (!isImage && !isPdf) {
      toast.error("Use a sheet music image (.png, .jpg, .webp) or PDF", { duration: 4000 });
      e.target.value = "";
      return;
    }
    try {
      await onUploadSheet(file);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to import sheet: ${err.message || err}`);
    }
    e.target.value = "";
  };

  return (
    <div className="glass-bright rounded-2xl p-5 flex flex-col gap-4 h-full overflow-hidden" data-testid="song-library">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Library</div>
          <h2 className="font-heading font-bold text-xl">Songs</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => sheetInputRef.current?.click()}
            disabled={!!converting}
            className="flex items-center gap-1.5 px-2.5 py-2 border border-[#FF00E6] text-[#FF00E6] rounded-lg hover:bg-[#FF00E6] hover:text-black transition-all text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="upload-sheet-button"
            title="Sheet music image or PDF → MIDI"
          >
            {converting?.kind === "sheet" ? <Loader2 size={12} className="animate-spin" /> : <FileMusic size={12} />}
            Sheet
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={!!converting}
            className="flex items-center gap-1.5 px-2.5 py-2 border border-[#00F0FF] text-[#00F0FF] rounded-lg hover:bg-[#00F0FF] hover:text-black transition-all text-[10px] uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="upload-button"
            title="Upload MIDI or Audio"
          >
            {converting && converting.kind !== "sheet" ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {converting && converting.kind !== "sheet" ? "Working" : "Upload"}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".mid,.midi,.mp3,.wav,.ogg,.m4a,.flac"
          className="hidden"
          onChange={handleFile}
          data-testid="upload-input"
        />
        <input
          ref={sheetInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
          className="hidden"
          onChange={handleSheetFile}
          data-testid="upload-sheet-input"
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

      <div className="border-t border-white/5 pt-2" data-testid="convert-mode-picker">
        <div className="text-[9px] uppercase tracking-[0.2em] text-white/40 mb-1">Audio → MIDI</div>
        <div className="flex gap-1">
          {CONVERT_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onConvertModeChange?.(m.id)}
              disabled={!!converting}
              className={`flex-1 px-2 h-7 rounded text-[10px] uppercase tracking-wider transition-all border ${
                convertMode === m.id
                  ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                  : "border-white/15 text-white/70 hover:border-[#00F0FF] hover:text-[#00F0FF]"
              } disabled:opacity-40`}
              data-testid={`convert-mode-${m.id}`}
            >
              {m.label}
            </button>
          ))}
        </div>
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
                  onDownloadMidi={onDownloadMidi}
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
                onDownloadMidi={onDownloadMidi}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SongRow({ song, active, onSelect, onDelete, onDownloadMidi }) {
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
      <div className="flex items-center gap-1">
        {onDownloadMidi && (
          <button
            onClick={(e) => { e.stopPropagation(); onDownloadMidi(song); }}
            className="p-1.5 rounded-md text-white/40 hover:bg-[#00F0FF]/20 hover:text-[#00F0FF] transition-all"
            data-testid={`download-midi-${song.id}`}
            aria-label="Download MIDI"
            title="Download as .mid"
          >
            <Download size={14} />
          </button>
        )}
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
    </div>
  );
}
