import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Piano as PianoIcon } from "lucide-react";
import PianoKeyboard from "@/components/PianoKeyboard";
import RollingNotes from "@/components/RollingNotes";
import TransportControls from "@/components/TransportControls";
import SongLibrary from "@/components/SongLibrary";
import SettingsPanel from "@/components/SettingsPanel";
import { usePianoEngine } from "@/hooks/usePianoEngine";
import { parseMidiFile } from "@/lib/midiParse";
import { convertAudioToMidi } from "@/lib/audioToMidi";
import { downloadSongAsMidi } from "@/lib/midiExport";
import ChordStrip from "@/components/ChordStrip";
import ToolBar from "@/components/ToolBar";
import { MidiEditorOverlay, EditToolbar } from "@/components/MidiEditor";
import VideoRecorderModal from "@/components/VideoRecorderModal";
import InstrumentControls from "@/components/MultiInstrumentStack";
import TrackPianoStack from "@/components/TrackPianoStack";
import { FAMILY_COLORS } from "@/lib/instruments";
import { toast } from "sonner";

const TRACK_PALETTE = ["#00F0FF", "#FF00E6", "#7CFF9A", "#FFD700", "#FFA500", "#B388FF", "#00FF88", "#FF6B6B"];

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_SETTINGS = {
  volume: 0.8,
  speed: 1.0,
  show_labels: true,
  note_color: "cyan",
  sustain: false,
  lookahead: 4.0,
  difficulty: "intermediate",
  practice_mode: "both",
};

export default function PianoApp() {
  const [demoSongs, setDemoSongs] = useState([]);
  const [userSongs, setUserSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [keyRects, setKeyRects] = useState({});
  const [converting, setConverting] = useState(null);
  const [audioUrls, setAudioUrls] = useState({}); // songId -> Blob URL
  const [playingOriginal, setPlayingOriginal] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedNoteIdx, setSelectedNoteIdx] = useState(null);
  const [editSnapshot, setEditSnapshot] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const [mutedTracks, setMutedTracks] = useState(new Set());
  const [soloedTrack, setSoloedTrack] = useState(null);
  const [convertMode, setConvertMode] = useState("single"); // 'single' | 'multi'
  const audioElRef = useRef(null);
  const keyElsRef = useRef({});
  const boardWrapRef = useRef(null);
  const rollingNotesRef = useRef(null);

  // Compute per-track colors
  const trackColors = useMemo(() => {
    const map = {};
    currentSong?.tracks?.forEach((t, idx) => {
      const id = String(t.id);
      map[id] = FAMILY_COLORS[t.family] || TRACK_PALETTE[idx % TRACK_PALETTE.length];
    });
    return map;
  }, [currentSong]);

  const engine = usePianoEngine({
    volume: settings.volume,
    sustain: settings.sustain,
    practiceMode: settings.practice_mode,
    mutedTracks,
    soloedTrack,
    onNoteStart: (midi, hand, trackId) => {
      rollingNotesRef.current?.spawnAt(midi, hand, trackId);
    },
  });

  const toggleMute = useCallback((trackId) => {
    setMutedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  const toggleSolo = useCallback((trackId) => {
    setSoloedTrack((prev) => (String(prev) === trackId ? null : trackId));
  }, []);

  // Reset mute/solo when song changes
  useEffect(() => {
    setMutedTracks(new Set());
    setSoloedTrack(null);
  }, [currentSong?.id]);

  // Load demo songs, user songs, settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [demoRes, songsRes, setRes] = await Promise.all([
          axios.get(`${API}/demo-songs`),
          axios.get(`${API}/songs`),
          axios.get(`${API}/settings`),
        ]);
        setDemoSongs(demoRes.data || []);
        setUserSongs(songsRes.data || []);
        if (setRes.data) {
          setSettings({ ...DEFAULT_SETTINGS, ...setRes.data });
        }
      } catch (e) {
        console.error("Failed to load initial data", e);
        toast.error("Failed to reach backend");
      }
    })();
  }, []);

  // Persist settings (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      axios.put(`${API}/settings`, { id: "global", ...settings }).catch((err) => {
        console.warn("Failed to persist settings", err);
      });
    }, 500);
    return () => clearTimeout(t);
  }, [settings]);

  // Speed sync
  useEffect(() => {
    engine.setSpeed(settings.speed);
  }, [settings.speed, engine]);

  // Compute key rectangles for canvas alignment
  const measureKeys = useCallback(() => {
    const wrap = boardWrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const rects = {};
    Object.entries(keyElsRef.current).forEach(([midi, el]) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      rects[midi] = {
        left: r.left - wrapRect.left,
        width: r.width,
      };
    });
    setKeyRects(rects);
  }, []);

  useEffect(() => {
    measureKeys();
    const ro = new ResizeObserver(measureKeys);
    if (boardWrapRef.current) ro.observe(boardWrapRef.current);
    window.addEventListener("resize", measureKeys);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measureKeys);
    };
  }, [measureKeys]);

  const registerKeyRef = useCallback((midi, el) => {
    keyElsRef.current[midi] = el;
  }, []);

  const handleSelectSong = useCallback(
    (song) => {
      // Stop original if playing
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      setPlayingOriginal(false);
      setCurrentSong(song);
      engine.loadSong(song);
    },
    [engine],
  );

  const toggleOriginal = useCallback(() => {
    const el = audioElRef.current;
    if (!el) return;
    if (playingOriginal) {
      el.pause();
      setPlayingOriginal(false);
    } else {
      // pause MIDI playback if running
      engine.pause();
      el.currentTime = 0;
      el.play().then(() => setPlayingOriginal(true)).catch((err) => {
        console.warn("Original audio playback failed", err);
        toast.error("Could not play original audio");
      });
    }
  }, [engine, playingOriginal]);

  const handleUpload = useCallback(
    async (file, isAudio) => {
      let parsed;
      if (isAudio) {
        setConverting({ stage: "Decoding audio", percent: 0, kind: "audio" });
        try {
          parsed = await convertAudioToMidi(file, (stage, percent) => {
            const label = {
              decoding: "Decoding audio",
              analyzing: "Detecting pitches",
              converting: "Building MIDI",
              done: "Done",
            }[stage] || stage;
            setConverting({ stage: label, percent, kind: "audio" });
          });
          // AI refinement: hand classification + noise removal via Claude Sonnet 4.6
          if (parsed.notes.length > 0) {
            setConverting({ stage: `AI cleaning (${settings.difficulty})`, percent: 0, kind: "audio" });
            try {
              const refineRes = await axios.post(
                `${API}/refine-midi`,
                {
                  notes: parsed.notes,
                  name: parsed.name,
                  difficulty: settings.difficulty,
                },
                { timeout: 120000 },
              );
              parsed.notes = refineRes.data.notes;
              parsed.chords = refineRes.data.chords || [];
              parsed.difficulty = settings.difficulty;
              // If multi-track conversion requested, split notes by hand into tracks
              if (convertMode === "multi") {
                const rightNotes = [];
                const leftNotes = [];
                for (const n of parsed.notes) {
                  const t = (n.hand === "left") ? 1 : 0;
                  const clone = { ...n, track: t };
                  if (t === 0) { rightNotes.push(clone); }
                  else { leftNotes.push(clone); }
                }
                parsed.notes = [...rightNotes, ...leftNotes].sort((a, b) => a.time - b.time);
                parsed.tracks = [
                  { id: "t0", name: "Melody", program: 0, family: "piano", isDrum: false, notes: rightNotes },
                  { id: "t1", name: "Bass",   program: 32, family: "bass", isDrum: false, notes: leftNotes },
                ].filter((t) => t.notes.length > 0);
              }
              const stats = refineRes.data.stats || {};
              if (stats.refined) {
                toast.success(
                  `AI refined ${stats.input} → ${stats.output} notes${stats.cached ? " (cached)" : ""}`,
                );
              }
            } catch (err) {
              console.warn("LLM refinement failed, using unrefined notes", err);
              toast.warning("AI refinement skipped — using raw MIDI");
            }
            setConverting({ stage: "AI cleaning", percent: 100, kind: "audio" });
          }
          if (parsed.notes.length === 0) {
            toast.warning("No notes detected. Try a clearer melodic recording.");
          } else {
            toast.success(`Ready — ${parsed.notes.length} notes`);
          }
        } catch (err) {
          console.error("Audio conversion failed", err);
          toast.error("Audio conversion failed. Try a shorter or clearer file.");
          setConverting(null);
          throw err;
        } finally {
          setConverting(null);
        }
      } else {
        parsed = await parseMidiFile(file);
        toast.success(`Loaded "${file.name}"`);
      }

      try {
        const res = await axios.post(`${API}/songs`, {
          name: parsed.name,
          duration: parsed.duration,
          notes: parsed.notes,
          chords: parsed.chords || [],
          tracks: parsed.tracks || [],
          source: "upload",
          difficulty: parsed.difficulty || settings.difficulty,
        });
        const saved = res.data;
        // Preserve tracks locally (backend may return without tracks if none provided)
        if (parsed.tracks && parsed.tracks.length > 0 && (!saved.tracks || saved.tracks.length === 0)) {
          saved.tracks = parsed.tracks;
        }
        setUserSongs((prev) => [saved, ...prev]);
        if (isAudio) {
          const blobUrl = URL.createObjectURL(file);
          setAudioUrls((prev) => ({ ...prev, [saved.id]: blobUrl }));
        }
        handleSelectSong(saved);
      } catch (err) {
        console.warn("Failed to persist song to backend, using local session", err);
        setUserSongs((prev) => [parsed, ...prev]);
        if (isAudio) {
          const blobUrl = URL.createObjectURL(file);
          setAudioUrls((prev) => ({ ...prev, [parsed.id]: blobUrl }));
        }
        handleSelectSong(parsed);
      }
    },
    [handleSelectSong, settings.difficulty],
  );

  const handleUploadSheet = useCallback(
    async (file) => {
      setConverting({ stage: "Uploading sheet", percent: 5, kind: "sheet" });
      try {
        const form = new FormData();
        form.append("file", file);
        setConverting({ stage: "AI reading notation", percent: 25, kind: "sheet" });
        const res = await axios.post(`${API}/sheet-to-midi`, form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 300000,
        });
        const data = res.data;
        setConverting({ stage: "Saving", percent: 90, kind: "sheet" });
        const savedRes = await axios.post(`${API}/songs`, {
          name: data.name || file.name.replace(/\.[^.]+$/, ""),
          duration: data.duration,
          notes: data.notes,
          chords: data.chords || [],
          tracks: data.tracks || [],
          source: "sheet",
          difficulty: settings.difficulty,
        });
        const saved = savedRes.data;
        if (data.tracks?.length && (!saved.tracks || saved.tracks.length === 0)) {
          saved.tracks = data.tracks;
        }
        setUserSongs((prev) => [saved, ...prev]);
        handleSelectSong(saved);
        toast.success(
          `Sheet imported — ${data.notes.length} notes across ${data.page_count || 1} page(s) (${data.tempo_bpm || 100} BPM, ${data.key_signature || "C"})`,
        );
      } catch (err) {
        console.error("Sheet-to-MIDI failed", err);
        const msg = err.response?.data?.detail || err.message || "Sheet processing failed";
        toast.error(msg);
        throw err;
      } finally {
        setConverting(null);
      }
    },
    [handleSelectSong, settings.difficulty],
  );

  const handleDownloadMidi = useCallback((song) => {
    try {
      downloadSongAsMidi(song);
      toast.success(`Downloading ${song.name}.mid`);
    } catch (err) {
      console.error("MIDI download failed", err);
      toast.error(err.message || "Could not download MIDI");
    }
  }, []);

  const handleStackKey = useCallback(
    (midi, family) => {
      engine.playNote(midi, 0.5, 0.8, family || "piano");
    },
    [engine],
  );

  const handleDelete = useCallback(async (song) => {
    try {
      await axios.delete(`${API}/songs/${song.id}`);
    } catch (err) {
      console.warn("Failed to delete song on server", err);
    }
    setUserSongs((prev) => prev.filter((s) => s.id !== song.id));
    setAudioUrls((prev) => {
      if (prev[song.id]) URL.revokeObjectURL(prev[song.id]);
      const { [song.id]: _, ...rest } = prev;
      return rest;
    });
    if (currentSong?.id === song.id) {
      if (audioElRef.current) audioElRef.current.pause();
      setPlayingOriginal(false);
      setCurrentSong(null);
      engine.loadSong({ id: "empty", name: "", duration: 1, notes: [] });
    }
    toast.success("Song removed");
  }, [currentSong, engine]);

  const handlePlay = async () => {
    if (!currentSong) {
      toast.info("Pick a song from the library first");
      return;
    }
    await engine.play();
  };

  // ---------- Reprocess ----------
  const handleReprocess = useCallback(async () => {
    if (!currentSong || !currentSong.notes?.length) {
      toast.info("Select a song with notes first");
      return;
    }
    setReprocessing(true);
    try {
      engine.pause();
      const res = await axios.post(
        `${API}/refine-midi`,
        {
          notes: currentSong.notes.map((n) => ({
            midi: n.midi, time: n.time, duration: n.duration, velocity: n.velocity,
          })),
          name: currentSong.name,
          difficulty: settings.difficulty,
          force_refresh: true,
        },
        { timeout: 120000 },
      );
      const newNotes = res.data.notes;
      const newChords = res.data.chords || [];
      const updated = {
        ...currentSong,
        notes: newNotes,
        chords: newChords,
        difficulty: settings.difficulty,
      };
      // Persist to backend (if it's a saved song)
      try {
        await axios.put(`${API}/songs/${currentSong.id}`, { notes: newNotes });
      } catch (e) {
        console.warn("Could not persist reprocessed notes", e);
      }
      setCurrentSong(updated);
      setUserSongs((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      engine.loadSong(updated);
      const stats = res.data.stats || {};
      toast.success(`Reprocessed (${settings.difficulty}): ${stats.input} → ${stats.output} notes`);
    } catch (err) {
      console.error("Reprocess failed", err);
      toast.error("Reprocess failed");
    } finally {
      setReprocessing(false);
    }
  }, [currentSong, engine, settings.difficulty]);

  // ---------- Edit Mode ----------
  const enterEditMode = useCallback(() => {
    if (!currentSong) {
      toast.info("Select a song to edit");
      return;
    }
    engine.pause();
    engine.stop();
    setEditSnapshot(JSON.parse(JSON.stringify(currentSong.notes)));
    setSelectedNoteIdx(null);
    setEditMode(true);
  }, [currentSong, engine]);

  const exitEditMode = useCallback((keepChanges = false) => {
    if (!keepChanges && editSnapshot && currentSong) {
      const restored = { ...currentSong, notes: editSnapshot };
      setCurrentSong(restored);
      engine.loadSong(restored);
    }
    setEditMode(false);
    setSelectedNoteIdx(null);
    setEditSnapshot(null);
  }, [editSnapshot, currentSong, engine]);

  const shiftNote = useCallback((delta) => {
    if (selectedNoteIdx == null || !currentSong) return;
    setCurrentSong((prev) => {
      if (!prev) return prev;
      const notes = prev.notes.map((n, i) => {
        if (i !== selectedNoteIdx) return n;
        const newMidi = Math.max(21, Math.min(108, n.midi + delta));
        return { ...n, midi: newMidi };
      });
      const updated = { ...prev, notes };
      engine.loadSong(updated);
      return updated;
    });
    // Play the shifted note
    const n = currentSong.notes[selectedNoteIdx];
    if (n) engine.playNote(Math.max(21, Math.min(108, n.midi + delta)), 0.3, 0.7);
  }, [selectedNoteIdx, currentSong, engine]);

  const deleteSelectedNote = useCallback(() => {
    if (selectedNoteIdx == null || !currentSong) return;
    setCurrentSong((prev) => {
      if (!prev) return prev;
      const notes = prev.notes.filter((_, i) => i !== selectedNoteIdx);
      const updated = { ...prev, notes };
      engine.loadSong(updated);
      return updated;
    });
    setSelectedNoteIdx(null);
  }, [selectedNoteIdx, currentSong, engine]);

  const globalShift = useCallback((delta) => {
    if (!currentSong) return;
    setCurrentSong((prev) => {
      if (!prev) return prev;
      const notes = prev.notes.map((n) => ({
        ...n,
        midi: Math.max(21, Math.min(108, n.midi + delta)),
      }));
      const updated = { ...prev, notes };
      engine.loadSong(updated);
      return updated;
    });
  }, [currentSong, engine]);

  const saveEdits = useCallback(async () => {
    if (!currentSong) return;
    setSavingEdit(true);
    try {
      await axios.put(`${API}/songs/${currentSong.id}`, { notes: currentSong.notes });
      setUserSongs((prev) => prev.map((s) => (s.id === currentSong.id ? { ...s, notes: currentSong.notes } : s)));
      toast.success("Edits saved");
      setEditSnapshot(null);
      setEditMode(false);
      setSelectedNoteIdx(null);
    } catch (err) {
      console.error("Save edits failed", err);
      toast.error("Could not save edits");
    } finally {
      setSavingEdit(false);
    }
  }, [currentSong]);

  const isDirty = editSnapshot
    ? JSON.stringify(currentSong?.notes) !== JSON.stringify(editSnapshot)
    : false;

  const selectedNote =
    selectedNoteIdx != null && currentSong?.notes?.[selectedNoteIdx];

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white flex flex-col overflow-hidden relative">
      {/* Background */}
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
      <div
        className="fixed inset-0 pointer-events-none opacity-25"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, rgba(0,240,255,0.15), transparent 50%), radial-gradient(circle at 80% 20%, rgba(112,0,255,0.15), transparent 50%), radial-gradient(circle at 50% 100%, rgba(255,0,60,0.12), transparent 55%)",
        }}
      />

      {/* Header */}
      <header className="relative z-20 px-6 lg:px-10 py-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00F0FF] to-[#7000FF] flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.5)]">
            <PianoIcon size={20} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[10px] tracking-[0.3em] uppercase text-white/40">Emergent</div>
            <h1 className="font-heading font-black text-xl leading-none tracking-tighter">
              NEON<span className="neon-cyan">.KEYS</span>
            </h1>
          </div>
        </div>
        <SettingsPanel settings={settings} onChange={setSettings} />
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 p-4 lg:p-6 min-h-0">
        {/* Left: Library */}
        <aside className="min-h-0 lg:max-h-full order-2 lg:order-1">
          <SongLibrary
            demoSongs={demoSongs}
            userSongs={userSongs}
            currentSongId={currentSong?.id}
            onSelect={handleSelectSong}
            onUpload={handleUpload}
            onUploadSheet={handleUploadSheet}
            onDelete={handleDelete}
            onDownloadMidi={handleDownloadMidi}
            converting={converting}
            convertMode={convertMode}
            onConvertModeChange={setConvertMode}
          />
        </aside>

        {/* Right: Play view */}
        <section className="flex flex-col gap-4 min-h-0 order-1 lg:order-2">
          <TransportControls
            isPlaying={engine.isPlaying}
            currentTime={engine.currentTime}
            duration={currentSong?.duration || 0}
            speed={settings.speed}
            onPlay={handlePlay}
            onPause={engine.pause}
            onStop={engine.stop}
            onSeek={engine.seek}
            onSpeedChange={(s) => setSettings((prev) => ({ ...prev, speed: s }))}
            songName={currentSong?.name}
            hasOriginal={!!(currentSong && audioUrls[currentSong.id])}
            playingOriginal={playingOriginal}
            onToggleOriginal={toggleOriginal}
          />
          <audio
            ref={audioElRef}
            src={currentSong ? audioUrls[currentSong.id] : undefined}
            onEnded={() => setPlayingOriginal(false)}
            onPause={() => setPlayingOriginal(false)}
            className="hidden"
            data-testid="original-audio"
          />

          {editMode ? (
            <EditToolbar
              selectedIdx={selectedNoteIdx}
              selectedNote={selectedNote}
              onShift={shiftNote}
              onDelete={deleteSelectedNote}
              onSave={saveEdits}
              onCancel={() => exitEditMode(false)}
              onGlobalShift={globalShift}
              isDirty={isDirty}
              saving={savingEdit}
            />
          ) : (
            <ToolBar
              difficulty={settings.difficulty}
              onDifficultyChange={(d) => setSettings((prev) => ({ ...prev, difficulty: d }))}
              practiceMode={settings.practice_mode}
              onPracticeModeChange={(m) => setSettings((prev) => ({ ...prev, practice_mode: m }))}
              onReprocess={handleReprocess}
              reprocessing={reprocessing}
              reprocessDisabled={!currentSong || !currentSong.notes?.length}
              editMode={editMode}
              onToggleEdit={editMode ? () => exitEditMode(false) : enterEditMode}
              editDisabled={!currentSong}
              onRecordVideo={() => { engine.pause(); setVideoOpen(true); }}
              recordDisabled={!currentSong || !currentSong.notes?.length}
            />
          )}

          {/* Rolling notes + piano stack */}
          <div ref={boardWrapRef} className="flex-1 min-h-[420px] flex flex-col relative rounded-2xl overflow-hidden border border-white/10">
            <div className="flex-1 relative">
              <ChordStrip
                chords={currentSong?.chords}
                currentTime={engine.currentTime}
                lookahead={settings.lookahead}
              />
              <RollingNotes
                ref={rollingNotesRef}
                song={currentSong}
                currentTime={engine.currentTime}
                lookahead={settings.lookahead}
                noteColor={settings.note_color}
                keyRects={keyRects}
                practiceMode={settings.practice_mode}
                trackColors={trackColors}
              />
              {editMode && (
                <MidiEditorOverlay
                  song={currentSong}
                  currentTime={engine.currentTime}
                  lookahead={settings.lookahead}
                  keyRects={keyRects}
                  selectedIdx={selectedNoteIdx}
                  onSelectIdx={setSelectedNoteIdx}
                />
              )}
              {currentSong && currentSong.notes?.some((n) => n.hand) && !editMode && (
                <div className="absolute top-10 right-3 glass rounded-lg px-3 py-2 flex items-center gap-3 text-[10px] uppercase tracking-widest z-10" data-testid="hand-legend">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.7)]" />
                    <span className="text-white/70">Right</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-[#FF003C] shadow-[0_0_10px_rgba(255,0,60,0.7)]" />
                    <span className="text-white/70">Left</span>
                  </div>
                </div>
              )}
              {!currentSong && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center px-6">
                    <div className="text-[10px] tracking-[0.4em] uppercase text-white/40 mb-3">Ready</div>
                    <h2 className="font-heading text-3xl lg:text-4xl font-black tracking-tighter mb-2">
                      Choose a song<br />
                      <span className="neon-cyan">or upload MIDI</span>
                    </h2>
                    <p className="text-white/50 text-sm font-mono">Notes will rain toward the keys ↓</p>
                  </div>
                </div>
              )}
            </div>

            <div className="h-[180px] md:h-[200px] w-full bg-black relative border-t border-[#00F0FF]/30">
              <PianoKeyboard
                activeKeys={engine.activeKeys}
                onKeyDown={(m) => engine.playNote(m, 0.6, 0.85)}
                showLabels={settings.show_labels}
                registerKeyRef={registerKeyRef}
                trackColors={trackColors}
              />
            </div>
          </div>
          <InstrumentControls
            tracks={currentSong?.tracks}
            trackColors={trackColors}
            mutedTracks={mutedTracks}
            soloedTrack={soloedTrack}
            onMuteToggle={toggleMute}
            onSoloToggle={toggleSolo}
          />
          <TrackPianoStack
            tracks={currentSong?.tracks}
            currentTime={engine.currentTime}
            trackColors={trackColors}
            mutedTracks={mutedTracks}
            soloedTrack={soloedTrack}
            onKeyDown={handleStackKey}
          />
        </section>
      </main>

      <VideoRecorderModal
        open={videoOpen}
        onOpenChange={setVideoOpen}
        song={currentSong}
        sampler={engine.getSampler()}
        trackColors={trackColors}
      />
    </div>
  );
}
