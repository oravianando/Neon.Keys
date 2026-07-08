import { useCallback, useEffect, useRef, useState } from "react";
import * as Tone from "tone";

/*
  usePianoEngine: manages Tone.js sampler, playback timing, active keys.
*/
export function usePianoEngine({ volume = 0.8, sustain = false, practiceMode = "both" } = {}) {
  const samplerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [activeKeys, setActiveKeys] = useState(new Set());
  const activeKeysRef = useRef(new Set());
  const practiceModeRef = useRef(practiceMode);

  const songRef = useRef(null);
  const noteIdxRef = useRef(0);
  const activeReleasesRef = useRef([]); // {midi, endsAt}
  const rafRef = useRef(null);
  const startWallRef = useRef(0);
  const pausedAtRef = useRef(0);
  const speedRef = useRef(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Initialize sampler
  useEffect(() => {
    const sampler = new Tone.Sampler({
      urls: {
        A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", A1: "A1.mp3",
        C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3",
        C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", A3: "A3.mp3",
        C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", A4: "A4.mp3",
        C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", A5: "A5.mp3",
        C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", A6: "A6.mp3",
        C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", A7: "A7.mp3", C8: "C8.mp3",
      },
      release: sustain ? 2.5 : 1,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => setReady(true),
    }).toDestination();
    sampler.volume.value = Tone.gainToDb(volume);
    samplerRef.current = sampler;

    return () => {
      sampler.dispose();
      samplerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update volume
  useEffect(() => {
    if (samplerRef.current) {
      samplerRef.current.volume.value = Tone.gainToDb(Math.max(0.001, volume));
    }
  }, [volume]);

  // Update release
  useEffect(() => {
    if (samplerRef.current) {
      samplerRef.current.release = sustain ? 2.5 : 1;
    }
  }, [sustain]);

  // Update practice mode ref
  useEffect(() => {
    practiceModeRef.current = practiceMode;
  }, [practiceMode]);

  const setActive = useCallback((midi, on) => {
    if (on) activeKeysRef.current.add(midi);
    else activeKeysRef.current.delete(midi);
    setActiveKeys(new Set(activeKeysRef.current));
  }, []);

  // Play a single note (from user click)
  const playNote = useCallback(
    (midi, duration = 0.6, velocity = 0.8) => {
      if (!samplerRef.current || !ready) return;
      const noteName = Tone.Frequency(midi, "midi").toNote();
      try {
        samplerRef.current.triggerAttackRelease(noteName, duration, undefined, velocity);
      } catch (err) {
        console.warn("playNote failed", err);
      }
      setActive(midi, true);
      setTimeout(() => setActive(midi, false), Math.min(duration * 1000, 400));
    },
    [ready, setActive],
  );

  // Playback loop
  const tick = useCallback(() => {
    const song = songRef.current;
    if (!song) return;
    const now = performance.now() / 1000;
    const elapsed = (now - startWallRef.current) * speedRef.current + pausedAtRef.current;
    setCurrentTime(elapsed);

    // Trigger notes whose time <= elapsed
    while (
      noteIdxRef.current < song.notes.length &&
      song.notes[noteIdxRef.current].time <= elapsed
    ) {
      const n = song.notes[noteIdxRef.current];
      const mode = practiceModeRef.current;
      const skip =
        (mode === "right" && n.hand === "left") ||
        (mode === "left" && n.hand === "right");
      if (!skip) {
        const noteName = Tone.Frequency(n.midi, "midi").toNote();
        const dur = Math.max(n.duration / speedRef.current, 0.08);
        try {
          samplerRef.current?.triggerAttackRelease(noteName, dur, undefined, n.velocity);
        } catch (err) {
          console.warn("scheduled note failed", err);
        }
        setActive(n.midi, true);
        activeReleasesRef.current.push({
          midi: n.midi,
          endsAt: elapsed + n.duration,
        });
      }
      noteIdxRef.current++;
    }

    // Release finished
    activeReleasesRef.current = activeReleasesRef.current.filter((r) => {
      if (r.endsAt <= elapsed) {
        setActive(r.midi, false);
        return false;
      }
      return true;
    });

    // End of song
    if (elapsed >= song.duration) {
      stop();
      return;
    }

    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setActive]);

  const play = useCallback(async () => {
    if (!songRef.current) return;
    await Tone.start();
    startWallRef.current = performance.now() / 1000;
    setIsPlaying(true);
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (!songRef.current) return;
    const now = performance.now() / 1000;
    pausedAtRef.current += (now - startWallRef.current) * speedRef.current;
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    // release currently sounding notes
    activeKeysRef.current.forEach((m) => setActive(m, false));
    activeReleasesRef.current = [];
    samplerRef.current?.releaseAll();
  }, [setActive]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    pausedAtRef.current = 0;
    noteIdxRef.current = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    activeKeysRef.current.forEach((m) => setActive(m, false));
    activeReleasesRef.current = [];
    samplerRef.current?.releaseAll();
  }, [setActive]);

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
      // rewind noteIdx
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
    // If currently playing, rebase timing
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
    activeKeys,
    isPlaying,
    currentTime,
    playNote,
    loadSong,
    play,
    pause,
    stop,
    seek,
    setSpeed,
    getSampler: () => samplerRef.current,
  };
}
