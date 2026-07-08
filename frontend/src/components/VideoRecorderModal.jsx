import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import * as Tone from "tone";
import { Video, X, Download, Play, Square, Sparkles, Wand2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { createVideoRecorder } from "@/lib/videoRecorder";
import {
  VFX_PRESETS,
  drawBackground,
  drawNote,
  drawPiano,
  spawnParticles,
  updateParticles,
  drawParticles,
  keyXFractionCanvas,
  keyWidthFractionCanvas,
} from "@/lib/vfx";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RESOLUTIONS = [
  { id: "hd",  label: "HD 720p",   width: 1280, height: 720,  bitrate: 5_000_000,  fps: 30 },
  { id: "fhd", label: "FHD 1080p", width: 1920, height: 1080, bitrate: 8_000_000,  fps: 30 },
  { id: "4k",  label: "4K 2160p",  width: 3840, height: 2160, bitrate: 20_000_000, fps: 24 },
];

const LOOKAHEAD = 4;
const INTRO_DURATION = 2.5;

// piano occupies bottom ~22% of the canvas; notes above
function dimsForResolution(id) {
  const res = RESOLUTIONS.find((r) => r.id === id) || RESOLUTIONS[0];
  const pianoH = Math.round(res.height * 0.22);
  return { w: res.width, h: res.height, pianoH, notesH: res.height - pianoH, fps: res.fps, bitrate: res.bitrate };
}

// Estimate final file-size in MB for a given resolution + song duration (seconds).
// Formula: (video bitrate + ~128kbps audio) * duration / 8 / 1024 / 1024
function estimateSizeMB(resId, seconds) {
  const r = RESOLUTIONS.find((x) => x.id === resId) || RESOLUTIONS[0];
  const audio = 128_000; // Opus/AAC ~128 kbps
  const bytes = ((r.bitrate + audio) * seconds) / 8;
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
  const dimsRef = useRef(dimsForResolution("hd"));

  // playback engine state refs
  const playStartRef = useRef(0);
  const noteIdxRef = useRef(0);
  const activeKeysRef = useRef(new Map()); // midi -> {hand, track}
  const activeReleasesRef = useRef([]);
  const particlesRef = useRef([]);
  const timeRef = useRef(0);

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

  // Preview render loop (idle mode)
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dims = dimsForResolution(resolutionId);
    dimsRef.current = dims;
    canvas.width = dims.w;
    canvas.height = dims.h;

    let previewT = 0;
    const previewActive = new Map();
    // Cycle a few demo keys for preview
    const previewLoop = () => {
      if (state === "recording") return;
      previewT += 1 / 60;
      previewActive.clear();
      if (song?.notes) {
        for (const n of song.notes) {
          if (n.time <= (previewT % (song.duration || 4)) && (previewT % (song.duration || 4)) < n.time + n.duration) {
            previewActive.set(n.midi, { hand: n.hand || (n.midi < 60 ? "left" : "right"), track: n.track !== undefined ? String(n.track) : "0" });
          }
        }
      } else {
        [60, 64, 67, 72].forEach((m) => (previewT % 2 < 1 ? previewActive.set(m, { hand: "right", track: "0" }) : null));
      }
      renderFrame(ctx, chosen, previewT, previewT % (song?.duration || 4), song, previewActive, [], null, dims);
      if (state !== "recording") rafRef.current = requestAnimationFrame(previewLoop);
    };
    rafRef.current = requestAnimationFrame(previewLoop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset, song?.id, resolutionId]);

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
    const recorder = createVideoRecorder(canvas, { fps: dims.fps, bitrate: dims.bitrate });
    recorderRef.current = recorder;
    setVideoExt(recorder.fileExtension);

    activeKeysRef.current = new Map();
    activeReleasesRef.current = [];
    particlesRef.current = [];
    noteIdxRef.current = 0;
    playStartRef.current = performance.now() / 1000;

    recorder.start();
    const useIntro = showTitleCard && (aiTitle || song.name);
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
        title: aiTitle || song.name,
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
    a.download = `${(song?.name || "piano").replace(/\W+/g, "_")}.${videoExt}`;
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) cleanup(); onOpenChange(v); }}>
      <DialogContent className="max-w-4xl bg-[#050505] border-white/10 text-white" data-testid="video-recorder-modal">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl neon-cyan flex items-center gap-2">
            <Video size={20} /> Create Piano Video
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Resolution + AI Enhance panel */}
          <div className="glass-bright rounded-xl p-3 flex flex-wrap items-center gap-3" data-testid="ai-enhance-panel">            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">Quality</span>
              <div className="flex gap-1" data-testid="resolution-picker">
                {RESOLUTIONS.map((r) => {
                  const dur = (song?.duration || 0) + INTRO_DURATION + 1;
                  const size = estimateSizeMB(r.id, dur);
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
            </div>
            <button
              onClick={runAiEnhance}
              disabled={aiEnhancing || !song || state === "recording"}
              className="flex items-center gap-1.5 px-3 h-8 rounded bg-yellow-300 text-black text-[11px] font-bold uppercase tracking-wider hover:shadow-[0_0_16px_rgba(253,224,71,0.6)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="ai-enhance-button"
              title="Let Claude pick the best VFX preset + generate a title & tagline"
            >
              <Wand2 size={12} className={aiEnhancing ? "animate-spin" : ""} />
              {aiEnhancing ? "Thinking…" : "AI Suggest"}
            </button>
            {aiTitle && (
              <div className="flex items-center gap-2 border-l border-white/10 pl-3 text-xs" data-testid="ai-title-preview">
                <span className="text-white/40 uppercase tracking-widest text-[9px]">Title</span>
                <span className="font-heading font-bold neon-cyan">{aiTitle}</span>
                {aiTagline && <span className="text-white/50 italic">— {aiTagline}</span>}
              </div>
            )}
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

// ------------------- Frame renderer -------------------
function renderFrame(ctx, preset, timeAbs, currentTime, song, activeKeys, particles, overlay, dims) {
  const w = dims.w, h = dims.h;
  const NOTES_H = dims.notesH;
  const PIANO_H = dims.pianoH;
  const tracksColors = overlay?.trackColors || {};

  // Beat shake + zoom on beat
  let shakeX = 0, shakeY = 0, zoom = 1;
  const activeSize = activeKeys instanceof Map ? activeKeys.size : activeKeys.size;
  const beatActive = activeSize > 0;
  if (preset.beatShake > 0 && beatActive) {
    shakeX = (Math.random() - 0.5) * preset.beatShake * 20;
    shakeY = (Math.random() - 0.5) * preset.beatShake * 20;
  }
  if ((preset.zoomOnBeat || 0) > 0 && beatActive) {
    zoom = 1 + preset.zoomOnBeat * 0.06 * (Math.sin(timeAbs * 22) * 0.5 + 0.5);
  }

  ctx.save();
  ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);

  // Background
  drawBackground(ctx, w, h, preset.bg, timeAbs, preset.palette);

  // Rolling notes
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, NOTES_H);
  ctx.clip();
  if (song?.notes) {
    for (const n of song.notes) {
      const relStart = n.time - currentTime;
      const relEnd = n.time + n.duration - currentTime;
      if (relEnd < 0 || relStart > LOOKAHEAD) continue;
      const bottomY = NOTES_H - (relStart / LOOKAHEAD) * NOTES_H;
      const topY = NOTES_H - (relEnd / LOOKAHEAD) * NOTES_H;
      const noteH = Math.max(6, bottomY - topY);
      const xFrac = keyXFractionCanvas(n.midi);
      const wFrac = keyWidthFractionCanvas(n.midi);
      const nx = xFrac * w - (wFrac * w) / 2 + 2;
      const nw = Math.max(4, wFrac * w - 3);
      const trackId = n.track !== undefined ? String(n.track) : "0";
      const tc = tracksColors[trackId];
      const color = tc || (n.hand === "left" ? preset.palette[1] : preset.palette[0]);
      drawNote(ctx, nx, topY, nw, noteH, preset.note, color, 1);
    }
  }
  // Impact line
  ctx.strokeStyle = "rgba(0,240,255,0.5)";
  ctx.lineWidth = 2;
  ctx.shadowColor = preset.palette[0];
  ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.moveTo(0, NOTES_H - 1); ctx.lineTo(w, NOTES_H - 1); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  drawParticles(ctx, particles, preset.trails);

  // Piano keys
  drawPiano(ctx, 0, NOTES_H, w, PIANO_H, activeKeys, preset.palette, preset.keyFx, tracksColors);

  ctx.restore(); // undo zoom+shake

  // Chromatic aberration
  const cd = preset.chromaDepth || 0;
  if (preset.chromatic || cd > 0) {
    const off = Math.max(2, 12 * (cd || 0.4));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.15 + 0.35 * cd;
    ctx.filter = "hue-rotate(180deg)";
    ctx.drawImage(ctx.canvas, -off, 0);
    ctx.filter = "hue-rotate(0deg)";
    ctx.drawImage(ctx.canvas, off, 0);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // AI title card (during intro)
  if (overlay && overlay.introDur > 0 && overlay.elapsed < overlay.introDur) {
    const t = overlay.elapsed;
    const fadeIn = Math.min(1, t / 0.4);
    const fadeOut = Math.min(1, (overlay.introDur - t) / 0.5);
    const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
    const scale = h / 720;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.55 * alpha})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = preset.palette[0];
    ctx.shadowColor = preset.palette[0];
    ctx.shadowBlur = 30 * scale;
    ctx.font = `bold ${Math.round(88 * scale)}px 'Unbounded', sans-serif`;
    ctx.fillText(overlay.title || "", w / 2, h / 2 - 20 * scale);
    ctx.shadowBlur = 12 * scale;
    ctx.font = `${Math.round(24 * scale)}px monospace`;
    ctx.fillStyle = "#ffffff";
    if (overlay.tagline) ctx.fillText(overlay.tagline, w / 2, h / 2 + 40 * scale);
    ctx.restore();
  }

  // Chord subtitle (bottom-center) during song playback
  if (overlay && overlay.showSubtitles && overlay.elapsed >= overlay.introDur && overlay.chords?.length) {
    const st = overlay.songTime;
    const active = [...overlay.chords].reverse().find((c) => c.time <= st);
    if (active) {
      const scale = h / 720;
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = `bold ${Math.round(42 * scale)}px 'Unbounded', sans-serif`;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(w / 2 - 120 * scale, NOTES_H - 70 * scale, 240 * scale, 50 * scale);
      ctx.fillStyle = preset.palette[0];
      ctx.shadowColor = preset.palette[0];
      ctx.shadowBlur = 20 * scale;
      ctx.fillText(active.name, w / 2, NOTES_H - 32 * scale);
      ctx.restore();
    }
  }
}
