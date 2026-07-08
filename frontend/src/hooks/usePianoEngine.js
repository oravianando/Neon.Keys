import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import { getInstrument } from "@/lib/instruments";

/*
  usePianoEngine: manages Tone.js instruments (per-track), playback timing,
  active keys with hand info, solo/mute per track, and note-hit callback.
*/
export function usePianoEngine({
  volume = 0.8,
  sustain = false,
  practiceMode = "both",
  mutedTracks = new Set(),
  soloedTrack = null,
  onNoteStart = null,
} = {}) {
  const [ready, setReady] = useState(false);
  const [activeKeys, setActiveKeys] = useState(new Map()); // midi -> { hand, track }
  const activeKeysRef = useRef(new Map());

  const practiceModeRef = useRef(practiceMode);
  const mutedTracksRef = useRef(mutedTracks);
  const soloedTrackRef = useRef(soloedTrack);
  const onNoteStartRef = useRef(onNoteStart);

  useEffect(() => { practiceModeRef.current = practiceMode; }, [practiceMode]);
  useEffect(() => { mutedTracksRef.current = mutedTracks; }, [mutedTracks]);
  useEffect(() => { soloedTrackRef.current = soloedTrack; }, [soloedTrack]);
  useEffect(() => { onNoteStartRef.current = onNoteStart; }, [onNoteStart]);

  const songRef = useRef(null);
  const noteIdxRef = useRef(0);
  const activeReleasesRef = useRef([]);
  const rafRef = useRef(null);
  const startWallRef = useRef(0);
  const pausedAtRef = useRef(0);
  const speedRef = useRef(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Warm up the piano sampler (fires setReady when loaded)
  useEffect(() => {
    const piano = getInstrument("piano");
    // Tone.Sampler exposes loaded; poll briefly
    const check = () => {
      if (piano.loaded) setReady(true);
      else setTimeout(check, 200);
    };
    check();
    // Volume applied globally to Tone.Destination
    Tone.Destination.volume.value = Tone.gainToDb(Math.max(0.001, volume));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Tone.Destination.volume.value = Tone.gainToDb(Math.max(0.001, volume));
  }, [volume]);

  useEffect(() => {
    const piano = getInstrument("piano");
    if (piano && piano.release !== undefined) piano.release = sustain ? 2.5 : 1;
  }, [sustain]);

  const setActive = useCallback((midi, on, meta = null) => {
    if (on) activeKeysRef.current.set(midi, meta || { hand: "right" });
    else activeKeysRef.current.delete(midi);
    setActiveKeys(new Map(activeKeysRef.current));
  }, []);

  const trackAllowed = useCallback((trackId) => {
    const solo = soloedTrackRef.current;
    if (solo !== null && solo !== undefined) {
      return String(trackId) === String(solo);
    }
    return !mutedTracksRef.current.has(String(trackId));
  }, []);

  const familyForNote = useCallback((n) => {
    const song = songRef.current;
    if (!song?.tracks || n.track === undefined) return "piano";
    const t = song.tracks[n.track];
    return t?.family || "piano";
  }, []);

  // Play a single note (from user click on the keyboard)
  const playNote = useCallback(
    (midi, duration = 0.6, velocity = 0.8, family = "piano") => {
      if (!ready) return;
      const inst = getInstrument(family);
      const noteName = Tone.Frequency(midi, "midi").toNote();
      try {
        inst.triggerAttackRelease(noteName, duration, undefined, velocity);
      } catch (err) {
        console.warn("playNote failed", err);
      }
      setActive(midi, true, { hand: midi < 60 ? "left" : "right" });
      onNoteStartRef.current?.(midi, midi < 60 ? "left" : "right");
      setTimeout(() => setActive(midi, false), Math.min(duration * 1000, 400));
    },
    [ready, setActive],
  );

  const tick = useCallback(() => {
    const song = songRef.current;
    if (!song) return;
    const now = performance.now() / 1000;
    const elapsed = (now - startWallRef.current) * speedRef.current + pausedAtRef.current;
    setCurrentTime(elapsed);

    while (
      noteIdxRef.current < song.notes.length &&
      song.notes[noteIdxRef.current].time <= elapsed
    ) {
      const n = song.notes[noteIdxRef.current];
      const mode = practiceModeRef.current;
      const trackId = n.track !== undefined ? String(n.track) : "main";
      const skipMode =
        (mode === "right" && n.hand === "left") ||
        (mode === "left" && n.hand === "right");
      const skipTrack = !trackAllowed(trackId);
      if (!skipMode && !skipTrack) {
        const family = familyForNote(n);
        const inst = getInstrument(family);
        const noteName = Tone.Frequency(n.midi, "midi").toNote();
        const dur = Math.max(n.duration / speedRef.current, 0.08);
        try {
          inst.triggerAttackRelease(noteName, dur, undefined, n.velocity);
        } catch (err) {
          console.warn("scheduled note failed", err);
        }
        setActive(n.midi, true, { hand: n.hand || (n.midi < 60 ? "left" : "right"), track: trackId });
        activeReleasesRef.current.push({ midi: n.midi, endsAt: elapsed + n.duration });
        onNoteStartRef.current?.(n.midi, n.hand || (n.midi < 60 ? "left" : "right"), trackId);
      }
      noteIdxRef.current++;
    }

    activeReleasesRef.current = activeReleasesRef.current.filter((r) => {
      if (r.endsAt <= elapsed) {
        setActive(r.midi, false);
        return false;
      }
      return true;
    });

    if (elapsed >= song.duration) {
      stop();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActive, trackAllowed, familyForNote]);

  const play = useCallback(async () => {
    if (!songRef.current) return;
    await Tone.start();
    startWallRef.current = performance.now() / 1000;
    setIsPlaying(true);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const releaseAllInstruments = () => {
    // We don't know all families used, but iterating known families is cheap.
    ["piano","bass","guitar","strings","ensemble","brass","reed","pipe","organ","chromatic","synthLead","synthPad","synthFx","misc"].forEach((f) => {
      try { getInstrument(f).releaseAll?.(); } catch (e) { /* ignore */ }
    });
  };

  const pause = useCallback(() => {
    if (!songRef.current) return;
    const now = performance.now() / 1000;
    pausedAtRef.current += (now - startWallRef.current) * speedRef.current;
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    activeKeysRef.current.clear();
    setActiveKeys(new Map());
    activeReleasesRef.current = [];
    releaseAllInstruments();
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    pausedAtRef.current = 0;
    noteIdxRef.current = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    activeKeysRef.current.clear();
    setActiveKeys(new Map());
    activeReleasesRef.current = [];
    releaseAllInstruments();
  }, []);

  const loadSong = useCallback(
    (song) => {
      stop();
      songRef.current = song;
      noteIdxRef.current = 0;
      pausedAtRef.current = 0;
      setCurrentTime(0);
    },
    [stop],
  );

  const seek = useCallback(
    (time) => {
      if (!songRef.current) return;
      const wasPlaying = isPlaying;
      if (wasPlaying) pause();
      pausedAtRef.current = Math.max(0, Math.min(time, songRef.current.duration));
      noteIdxRef.current = songRef.current.notes.findIndex(
        (n) => n.time >= pausedAtRef.current,
      );
      if (noteIdxRef.current === -1) noteIdxRef.current = songRef.current.notes.length;
      setCurrentTime(pausedAtRef.current);
      if (wasPlaying) play();
    },
    [isPlaying, pause, play],
  );

  const setSpeed = useCallback((s) => {
    if (isPlaying) {
      const now = performance.now() / 1000;
      pausedAtRef.current += (now - startWallRef.current) * speedRef.current;
      startWallRef.current = now;
    }
    speedRef.current = s;
  }, [isPlaying]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return {
    ready,
    activeKeys, // Map<midi, {hand, track}>
    isPlaying,
    currentTime,
    playNote,
    loadSong,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    getSampler: () => getInstrument("piano"),
  };
}
