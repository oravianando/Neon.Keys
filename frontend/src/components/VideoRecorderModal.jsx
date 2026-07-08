import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import * as Tone from "tone";
import { Video, X, Download, Play, Square, Sparkles, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createVideoRecorder } from "@/lib/videoRecorder";
import { renderFrame } from "@/lib/videoFrameRenderer";
import {
  VFX_PRESETS,
  spawnParticles,
  updateParticles,
  keyXFractionCanvas,
} from "@/lib/vfx";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RESOLUTIONS = [
  { id: "hd",  label: "HD 720p",   width: 1280, height: 720,  bitrate: 5_000_000,  fps: 30 },
  { id: "fhd", label: "FHD 1080p", width: 1920, height: 1080, bitrate: 8_000_000,  fps: 30 },
  { id: "4k",  label: "4K 2160p",  width: 3840, height: 2160, bitrate: 20_000_000, fps: 24 },
];

const INTRO_DURATION = 2.5;

// piano occupies bottom ~22% of the canvas; notes above
function dimsForResolution(id) {
  const res = RESOLUTIONS.find((r) => r.id === id) || RESOLUTIONS[0];
  const pianoH = Math.round(res.height * 0.22);
  return { w: res.width, h: res.height, pianoH, notesH: res.height - pianoH, fps: res.fps, bitrate: res.bitrate };
}

// Estimate final file-size in MB for a given resolution + song duration (seconds).
// Applies a 60% discount when VBR is enabled (typical VBR savings on piano visualizations).
function estimateSizeMB(resId, seconds, vbr = false) {
  const r = RESOLUTIONS.find((x) => x.id === resId) || RESOLUTIONS[0];
  const audio = 128_000; // Opus/AAC ~128 kbps
  const bitrate = vbr ? r.bitrate * 0.6 : r.bitrate;
  const bytes = ((bitrate + audio) * seconds) / 8;
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(mb * 1024)}KB`;
  if (mb < 100) return `${mb.toFixed(1)}MB`;
  return `${Math.round(mb)}MB`;
}

const FOURK_DURATION_LIMIT_SECONDS = 180;

export default function VideoRecorderModal({ open, onOpenChange, song, sampler, trackColors }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const recorderRef = useRef(null);
  const [preset, setPreset] = useState(VFX_PRESETS[0].id);
  const [state, setState] = useState("idle"); // idle | previewing | recording | finished
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoExt, setVideoExt] = useState("webm");
  const [aiEnhancing, setAiEnhancing] = useState(false);
  const [aiTitle, setAiTitle] = useState("");
  const [aiTagline, setAiTagline] = useState("");
  const [showTitleCard, setShowTitleCard] = useState(true);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [resolutionId, setResolutionId] = useState("hd");
  const [useVbr, setUseVbr] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const dimsRef = useRef(dimsForResolution("hd"));

  // playback engine state refs
  const playStartRef = useRef(0);
  const noteIdxRef = useRef(0);
  const activeKeysRef = useRef(new Map()); // midi -> {hand, track}
  const activeReleasesRef = useRef([]);
  const particlesRef = useRef([]);
  const timeRef = useRef(0);
  // Preview loop refs (particles need to persist across preview frames)
  const previewParticlesRef = useRef([]);
  const previewPrevActiveRef = useRef(new Set());
  // Editable video title (defaults to AI title or song name)
  const [videoTitle, setVideoTitle] = useState("");

  useEffect(() => {
    if (!open) {
      cleanup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    if (recorderRef.current) {
      try { recorderRef.current.stop(); } catch (e) { /* ignore */ }
      recorderRef.current = null;
    }
    activeKeysRef.current = new Map();
    activeReleasesRef.current = [];
    particlesRef.current = [];
    timeRef.current = 0;
    noteIdxRef.current = 0;
    setProgress(0);
    setState("idle");
  }

  const chosen = VFX_PRESETS.find((p) => p.id === preset) || VFX_PRESETS[0];

  // Sync default title with song or AI-generated title
  useEffect(() => {
    if (aiTitle) setVideoTitle(aiTitle);
    else if (song?.name && !videoTitle) setVideoTitle(song.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiTitle, song?.id]);

  // Preview render loop (idle mode).
  // NOTE: Radix DialogContent uses a portal + presence animation, so canvasRef
  // may be null on the very first effect pass. Retry on next animation frame
  // until the canvas is mounted.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let rafInit = null;

    const setup = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) {
        rafInit = requestAnimationFrame(setup);
        return;
      }
      const ctx = canvas.getContext("2d");
      const dims = dimsForResolution(resolutionId);
      dimsRef.current = dims;
      canvas.width = dims.w;
      canvas.height = dims.h;

      let previewT = 0;
      const previewActive = new Map();
      previewParticlesRef.current = [];
      previewPrevActiveRef.current = new Set();

      const previewLoop = () => {
        if (cancelled || state === "recording") return;
        previewT += 1 / 60;
        previewActive.clear();
        const cycleDur = song?.duration || 4;
        const localT = previewT % cycleDur;
        if (song?.notes) {
          for (const n of song.notes) {
            if (n.time <= localT && localT < n.time + n.duration) {
              previewActive.set(n.midi, {
                hand: n.hand || (n.midi < 60 ? "left" : "right"),
                track: n.track !== undefined ? String(n.track) : "0",
              });
            }
          }
        } else {
          [60, 64, 67, 72].forEach((m) => (previewT % 2 < 1 ? previewActive.set(m, { hand: "right", track: "0" }) : null));
        }

      // Spawn particles when a key transitions from inactive → active
      const prev = previewPrevActiveRef.current;
      for (const [midi, meta] of previewActive) {
        if (!prev.has(midi)) {
          const xFrac = keyXFractionCanvas(midi);
          const px = xFrac * dims.w;
          const py = dims.notesH;
          const tc = trackColors?.[meta.track];
          spawnParticles(previewParticlesRef.current, px, py, chosen.particle, tc || chosen.palette[0]);
        }
      }
      previewPrevActiveRef.current = new Set(previewActive.keys());
      updateParticles(previewParticlesRef.current);

      renderFrame(ctx, chosen, previewT, localT, song, previewActive, previewParticlesRef.current, null, dims);
      if (state !== "recording") rafRef.current = requestAnimationFrame(previewLoop);
      };  // end previewLoop

      rafRef.current = requestAnimationFrame(previewLoop);
    };  // end setup

    rafInit = requestAnimationFrame(setup);
    return () => {
      cancelled = true;
      if (rafInit) cancelAnimationFrame(rafInit);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset, song?.id, resolutionId, trackColors]);

  const startRecording = async () => {
    if (!song || !song.notes?.length) {
      toast.error("Select a song with notes first");
      return;
    }
    if (!sampler) {
      toast.error("Audio not ready");
      return;
    }
    cancelAnimationFrame(rafRef.current);
    setState("recording");
    setProgress(0);
    setVideoUrl(null);

    await Tone.start();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dims = dimsForResolution(resolutionId);
    dimsRef.current = dims;
    canvas.width = dims.w;
    canvas.height = dims.h;
    const recorder = createVideoRecorder(canvas, {
      fps: dims.fps,
      bitrate: dims.bitrate,
      bitrateMode: useVbr ? "variable" : "constant",
    });
    recorderRef.current = recorder;
    setVideoExt(recorder.fileExtension);

    activeKeysRef.current = new Map();
    activeReleasesRef.current = [];
    particlesRef.current = [];
    noteIdxRef.current = 0;
    playStartRef.current = performance.now() / 1000;

    recorder.start();
    const useIntro = showTitleCard && (videoTitle || song.name);
    const introDur = useIntro ? INTRO_DURATION : 0;
    const duration = introDur + song.duration + 1;

    const loop = () => {
      const now = performance.now() / 1000;
      const elapsed = now - playStartRef.current;
      const songTime = Math.max(0, elapsed - introDur);
      timeRef.current = elapsed;
      setProgress(Math.min(100, (elapsed / duration) * 100));

      // Trigger notes (only after intro finishes)
      if (elapsed >= introDur) {
        while (
          noteIdxRef.current < song.notes.length &&
          song.notes[noteIdxRef.current].time <= songTime
        ) {
          const n = song.notes[noteIdxRef.current];
          const noteName = Tone.Frequency(n.midi, "midi").toNote();
          try {
            sampler.triggerAttackRelease(noteName, Math.max(n.duration, 0.1), undefined, n.velocity);
          } catch (e) { /* ignore */ }
          const trackId = n.track !== undefined ? String(n.track) : "0";
          const hand = n.hand || (n.midi < 60 ? "left" : "right");
          activeKeysRef.current.set(n.midi, { hand, track: trackId });
          activeReleasesRef.current.push({ midi: n.midi, endsAt: songTime + n.duration });
          // Particles at key position (colored by track)
          const xFrac = keyXFractionCanvas(n.midi);
          const px = xFrac * dimsRef.current.w;
          const py = dimsRef.current.notesH;
          const tc = trackColors?.[trackId];
          spawnParticles(particlesRef.current, px, py, chosen.particle, tc || chosen.palette[0]);
          noteIdxRef.current++;
        }
      }
      // Release
      activeReleasesRef.current = activeReleasesRef.current.filter((r) => {
        if (r.endsAt <= songTime) {
          activeKeysRef.current.delete(r.midi);
          return false;
        }
        return true;
      });

      updateParticles(particlesRef.current);
      const overlay = {
        introDur,
        elapsed,
        songTime,
        title: videoTitle || song.name,
        tagline: aiTagline,
        showSubtitles,
        chords: song.chords || [],
        trackColors: trackColors || {},
      };
      renderFrame(ctx, chosen, elapsed, songTime, song, activeKeysRef.current, particlesRef.current, overlay, dimsRef.current);

      if (elapsed >= duration) {
        stopRecording();
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  };

  const stopRecording = async () => {
    cancelAnimationFrame(rafRef.current);
    if (recorderRef.current) {
      try {
        const blob = await recorderRef.current.stop();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setState("finished");
        toast.success("Video ready!");
      } catch (e) {
        console.error(e);
        toast.error("Recording failed");
        setState("idle");
      }
      recorderRef.current = null;
    }
  };

  const downloadVideo = () => {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    const nameForFile = (videoTitle || song?.name || "piano").replace(/\W+/g, "_");
    a.download = `${nameForFile}.${videoExt}`;
    a.click();
  };

  const runAiEnhance = async () => {
    if (!song) return;
    setAiEnhancing(true);
    try {
      const res = await axios.post(
        `${API}/video/ai-enhance`,
        {
          song_name: song.name || "",
          duration: song.duration || 0,
          note_count: song.notes?.length || 0,
          chord_names: (song.chords || []).slice(0, 20).map((c) => c.name),
          families: (song.tracks || []).map((t) => t.family),
          available_presets: VFX_PRESETS.map((p) => p.id),
        },
        { timeout: 30000 },
      );
      const { preset_id, title, tagline, mood } = res.data;
      if (preset_id) setPreset(preset_id);
      if (title) setAiTitle(title);
      if (tagline) setAiTagline(tagline);
      toast.success(`AI picked ${preset_id}${mood ? ` (${mood} mood)` : ""}`);
    } catch (err) {
      console.error("AI enhance failed", err);
      toast.error("AI enhance failed");
    } finally {
      setAiEnhancing(false);
    }
  };

  // Auto-run AI enhance when the toggle is ON and a song is loaded (once per song)
  const aiAutoDoneRef = useRef(null);
  useEffect(() => {
    if (!open || !aiEnabled || !song?.id) return;
    if (aiAutoDoneRef.current === song.id) return;
    aiAutoDoneRef.current = song.id;
    runAiEnhance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aiEnabled, song?.id]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) cleanup(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl bg-[#050505] border-white/10 text-white" data-testid="video-recorder-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl neon-cyan flex items-center gap-2">
            <Video size={20} /> Create Piano Video
          </DialogTitle>
          <DialogDescription className="sr-only">
            Record a video of your piano performance with visual effects, resolution options, and AI-picked presets.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Resolution + AI Enhance panel */}
          <div className="glass-bright rounded-xl p-3 flex flex-wrap items-center gap-3" data-testid="ai-enhance-panel">            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">Quality</span>
              <div className="flex gap-1" data-testid="resolution-picker">
                {RESOLUTIONS.map((r) => {
                  const dur = (song?.duration || 0) + INTRO_DURATION + 1;
                  const size = estimateSizeMB(r.id, dur, useVbr);
                  return (
                    <button
                      key={r.id}
                      onClick={() => setResolutionId(r.id)}
                      disabled={state === "recording"}
                      className={`px-2.5 h-10 rounded text-[11px] uppercase tracking-wider transition-all border flex flex-col items-center justify-center leading-tight ${
                        resolutionId === r.id
                          ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                          : "border-white/15 text-white/70 hover:border-[#00F0FF] hover:text-[#00F0FF]"
                      } disabled:opacity-40`}
                      data-testid={`resolution-${r.id}`}
                      title={`${r.width}×${r.height} @ ${r.fps}fps, ${(r.bitrate / 1_000_000).toFixed(0)}Mbps`}
                    >
                      <span className="font-bold">{r.label}</span>
                      <span className={`text-[9px] font-mono opacity-70`} data-testid={`size-${r.id}`}>~{size}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 border-l border-white/10 pl-3">
              <Wand2 size={13} className="text-yellow-300" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">AI</span>
              <Switch
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
                disabled={state === "recording"}
                data-testid="toggle-ai-enhance"
                aria-label="Enable AI enhancer"
              />
            </div>
            <button
              onClick={runAiEnhance}
              disabled={aiEnhancing || !song || state === "recording" || !aiEnabled}
              className="flex items-center gap-1.5 px-3 h-8 rounded bg-yellow-300 text-black text-[11px] font-bold uppercase tracking-wider hover:shadow-[0_0_16px_rgba(253,224,71,0.6)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="ai-enhance-button"
              title={aiEnabled ? "Let Claude pick the best VFX preset + generate a title & tagline" : "AI enhancer is OFF"}
            >
              <Wand2 size={12} className={aiEnhancing ? "animate-spin" : ""} />
              {aiEnhancing ? "Thinking…" : "AI Suggest"}
            </button>
            {aiTagline && (
              <span
                className="text-white/50 italic text-xs border-l border-white/10 pl-3"
                data-testid="ai-tagline-preview"
                title={aiTagline}
              >
                — {aiTagline}
              </span>
            )}
            <div className="flex items-center gap-2 border-l border-white/10 pl-3 flex-1 min-w-[200px]" data-testid="video-title-field">
              <span className="text-white/40 uppercase tracking-widest text-[9px] whitespace-nowrap">Title</span>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                disabled={state === "recording"}
                placeholder={song?.name || "Video title"}
                maxLength={60}
                className="flex-1 min-w-0 bg-transparent border-b border-white/15 focus:border-[#00F0FF] focus:outline-none px-1 py-1 text-sm font-heading font-bold neon-cyan placeholder:text-white/25 placeholder:font-normal placeholder:italic disabled:opacity-40 transition-colors"
                data-testid="video-title-input"
                aria-label="Video title"
              />
            </div>
            <div className="ml-auto flex items-center gap-4">
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/60">
                <Switch
                  checked={showTitleCard}
                  onCheckedChange={setShowTitleCard}
                  disabled={state === "recording"}
                  data-testid="toggle-title-card"
                />
                Title Card
              </label>
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/60">
                <Switch
                  checked={useVbr}
                  onCheckedChange={setUseVbr}
                  disabled={state === "recording"}
                  data-testid="toggle-vbr"
                />
                <span title="Variable bitrate — smaller file sizes, best for 4K">VBR</span>
              </label>
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/60">
                <Switch
                  checked={showSubtitles}
                  onCheckedChange={setShowSubtitles}
                  disabled={state === "recording"}
                  data-testid="toggle-chord-subtitles"
                />
                Chord Subtitles
              </label>
            </div>
          </div>

          {/* VFX preset picker */}
          <div className="glass-bright rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-[#00F0FF]" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">VFX Preset</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto piano-scroll">
              {VFX_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPreset(p.id)}
                  disabled={state === "recording"}
                  className={`px-2.5 h-7 rounded text-[11px] uppercase tracking-wider transition-all border ${
                    preset === p.id
                      ? "bg-[#00F0FF] text-black border-[#00F0FF]"
                      : "border-white/15 text-white/70 hover:border-[#00F0FF] hover:text-[#00F0FF]"
                  } disabled:opacity-40`}
                  data-testid={`vfx-preset-${p.id}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Canvas preview */}
          {resolutionId === "4k" && (song?.duration || 0) > FOURK_DURATION_LIMIT_SECONDS && (
            <div
              className="flex items-start gap-2 rounded-lg border border-yellow-300/40 bg-yellow-300/10 px-3 py-2 text-[11px] text-yellow-200"
              data-testid="fourk-duration-warning"
            >
              <span className="text-yellow-300 font-bold uppercase tracking-wider mr-1">4K warning</span>
              <span className="font-mono">
                This song is {Math.round(song.duration)}s (&gt; {FOURK_DURATION_LIMIT_SECONDS}s). Recording at 4K may exceed browser memory
                and slow rendering. Consider using FHD for songs longer than 3 minutes.
              </span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full rounded-xl border border-white/10 bg-black"
            style={{ aspectRatio: "16/9" }}
            data-testid="video-canvas"
          />

          {/* Controls */}
          <div className="flex items-center gap-3">
            {state !== "recording" && state !== "finished" && (
              <button
                onClick={startRecording}
                disabled={!song}
                className="flex items-center gap-2 px-5 h-10 rounded-lg bg-[#00F0FF] text-black text-sm font-bold uppercase tracking-wider hover:shadow-[0_0_24px_rgba(0,240,255,0.7)] transition-all disabled:opacity-40"
                data-testid="start-record"
              >
                <Play size={14} /> Start Recording
              </button>
            )}
            {state === "recording" && (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-5 h-10 rounded-lg bg-[#FF003C] text-white text-sm font-bold uppercase tracking-wider hover:shadow-[0_0_24px_rgba(255,0,60,0.7)] transition-all"
                data-testid="stop-record"
              >
                <Square size={14} /> Stop
              </button>
            )}
            {state === "finished" && videoUrl && (
              <>
                <video src={videoUrl} controls className="rounded-lg max-h-48" data-testid="preview-video" />
                <button
                  onClick={downloadVideo}
                  className="flex items-center gap-2 px-5 h-10 rounded-lg bg-yellow-300 text-black text-sm font-bold uppercase tracking-wider hover:shadow-[0_0_24px_rgba(253,224,71,0.7)] transition-all"
                  data-testid="download-video"
                >
                  <Download size={14} /> Download .{videoExt}
                </button>
                <button
                  onClick={() => { cleanup(); }}
                  className="flex items-center gap-2 px-4 h-10 rounded-lg border border-white/20 text-sm uppercase tracking-wider hover:border-white/50"
                  data-testid="record-again"
                >
                  <X size={14} /> Record Again
                </button>
              </>
            )}
            {state === "recording" && (
              <div className="flex-1 min-w-[200px]">
                <div className="text-[10px] uppercase tracking-wider text-white/60 mb-1 flex justify-between">
                  <span>Recording…</span>
                  <span className="neon-cyan font-mono" data-testid="record-progress">{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#00F0FF] to-[#FF003C]" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-white/40 font-mono">
            Video capture uses your browser&apos;s MediaRecorder API. Output format: {videoExt.toUpperCase()}. Audio + visuals are recorded together.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

