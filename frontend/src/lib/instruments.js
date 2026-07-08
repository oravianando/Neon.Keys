import * as Tone from "tone";

/*
  Instrument factory: given a General-MIDI family string, return a Tone.js
  instrument ready to `triggerAttackRelease(note, dur, time, velocity)`.
  Instruments are cached per family and connected to the shared destination.
*/

const cache = new Map();

function makePiano() {
  return new Tone.Sampler({
    urls: {
      A0: "A0.mp3", C1: "C1.mp3", "D#1": "Ds1.mp3", "F#1": "Fs1.mp3", A1: "A1.mp3",
      C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3", A2: "A2.mp3",
      C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3", A3: "A3.mp3",
      C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3", A4: "A4.mp3",
      C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3", A5: "A5.mp3",
      C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3", A6: "A6.mp3",
      C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3", A7: "A7.mp3", C8: "C8.mp3",
    },
    release: 1,
    baseUrl: "https://tonejs.github.io/audio/salamander/",
  }).toDestination();
}

function makeSynth(config, volume = -8) {
  const inst = new Tone.PolySynth(Tone.Synth, config).toDestination();
  inst.volume.value = volume;
  return inst;
}

const RECIPES = {
  piano: () => makePiano(),
  bass: () => {
    const inst = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sawtooth" },
      envelope: { attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.4 },
    }).toDestination();
    inst.volume.value = -8;
    return inst;
  },
  guitar: () => {
    const inst = new Tone.PolySynth(Tone.PluckSynth, { attackNoise: 1.5, dampening: 3500, resonance: 0.85 }).toDestination();
    inst.volume.value = -4;
    return inst;
  },
  strings: () => makeSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.35, decay: 0.3, sustain: 0.75, release: 1.1 },
  }, -10),
  ensemble: () => makeSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.4, decay: 0.4, sustain: 0.8, release: 1.2 },
  }, -10),
  brass: () => makeSynth({
    oscillator: { type: "square" },
    envelope: { attack: 0.06, decay: 0.15, sustain: 0.65, release: 0.5 },
  }, -12),
  reed: () => makeSynth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.06, decay: 0.15, sustain: 0.7, release: 0.5 },
  }, -10),
  pipe: () => makeSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.1, decay: 0.2, sustain: 0.6, release: 0.7 },
  }, -10),
  organ: () => makeSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.25 },
  }, -10),
  chromatic: () => makeSynth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.4, sustain: 0.1, release: 0.6 },
  }, -8),
  synthLead: () => makeSynth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.02, decay: 0.2, sustain: 0.55, release: 0.4 },
  }, -12),
  synthPad: () => makeSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.5 },
  }, -14),
  synthFx: () => makeSynth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.3, decay: 0.3, sustain: 0.6, release: 1.0 },
  }, -14),
  misc: () => makeSynth({}, -10),
};

export function getInstrument(family) {
  const key = family || "piano";
  if (cache.has(key)) return cache.get(key);
  const factory = RECIPES[key] || RECIPES.misc;
  const inst = factory();
  cache.set(key, inst);
  return inst;
}

export function disposeAllInstruments() {
  for (const inst of cache.values()) {
    try { inst.dispose(); } catch (e) { /* ignore */ }
  }
  cache.clear();
}

/*
  Family palette — colors used for the multi-instrument stack UI.
*/
export const FAMILY_COLORS = {
  piano: "#00F0FF",
  bass: "#FF00E6",
  guitar: "#FFA500",
  strings: "#7CFF9A",
  ensemble: "#00FF88",
  brass: "#FFD700",
  reed: "#FFB300",
  pipe: "#00E5FF",
  organ: "#FF6B6B",
  chromatic: "#B388FF",
  synthLead: "#FF4081",
  synthPad: "#8E24AA",
  synthFx: "#00BFA5",
  drums: "#795548",
  misc: "#9E9E9E",
};
