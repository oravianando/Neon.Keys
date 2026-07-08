import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Piano as PianoIcon } from "lucide-react";
import PianoKeyboard from "@/components/PianoKeyboard";
import RollingNotes from "@/components/RollingNotes";
import TransportControls from "@/components/TransportControls";
import SongLibrary from "@/components/SongLibrary";
import SettingsPanel from "@/components/SettingsPanel";
import { usePianoEngine } from "@/hooks/usePianoEngine";
import { parseMidiFile } from "@/lib/midiParse";
import { toast } from "sonner";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DEFAULT_SETTINGS = {
  volume: 0.8,
  speed: 1.0,
  show_labels: true,
  note_color: "cyan",
  sustain: false,
  lookahead: 4.0,
};

export default function PianoApp() {
  const [demoSongs, setDemoSongs] = useState([]);
  const [userSongs, setUserSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [keyRects, setKeyRects] = useState({});
  const keyElsRef = useRef({});
  const boardWrapRef = useRef(null);

  const engine = usePianoEngine({
    volume: settings.volume,
    sustain: settings.sustain,
  });

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
      axios.put(`${API}/settings`, { id: "global", ...settings }).catch(() => {});
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
      setCurrentSong(song);
      engine.loadSong(song);
    },
    [engine],
  );

  const handleUpload = useCallback(
    async (file) => {
      const parsed = await parseMidiFile(file);
      // Save to backend
      try {
        const res = await axios.post(`${API}/songs`, {
          name: parsed.name,
          duration: parsed.duration,
          notes: parsed.notes,
          source: "upload",
        });
        const saved = res.data;
        setUserSongs((prev) => [saved, ...prev]);
        handleSelectSong(saved);
      } catch (e) {
        // fall back to local session
        setUserSongs((prev) => [parsed, ...prev]);
        handleSelectSong(parsed);
      }
    },
    [handleSelectSong],
  );

  const handleDelete = useCallback(async (song) => {
    try {
      await axios.delete(`${API}/songs/${song.id}`);
    } catch (e) {}
    setUserSongs((prev) => prev.filter((s) => s.id !== song.id));
    if (currentSong?.id === song.id) {
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
            onDelete={handleDelete}
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
          />

          {/* Rolling notes + piano stack */}
          <div ref={boardWrapRef} className="flex-1 min-h-[420px] flex flex-col relative rounded-2xl overflow-hidden border border-white/10">
            <div className="flex-1 relative">
              <RollingNotes
                song={currentSong}
                currentTime={engine.currentTime}
                lookahead={settings.lookahead}
                noteColor={settings.note_color}
                keyRects={keyRects}
              />
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
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
