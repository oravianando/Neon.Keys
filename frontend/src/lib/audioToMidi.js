import {
  BasicPitch,
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
} from "@spotify/basic-pitch";

const MODEL_URL = `${process.env.PUBLIC_URL || ""}/basic-pitch-model/model.json`;
const SAMPLE_RATE = 22050;
const PIANO_MIN = 21; // A0
const PIANO_MAX = 108; // C8

let basicPitchInstance = null;
function getBasicPitch() {
  if (!basicPitchInstance) {
    basicPitchInstance = new BasicPitch(MODEL_URL);
  }
  return basicPitchInstance;
}

// Decode audio file → 22050Hz mono AudioBuffer via OfflineAudioContext
async function decodeAndResample(file) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AudioContextCtor();
  const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  await decodeCtx.close();

  const OfflineCtxCtor =
    window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const targetLength = Math.max(
    SAMPLE_RATE,
    Math.ceil((decoded.duration || 1) * SAMPLE_RATE),
  );
  const offlineCtx = new OfflineCtxCtor(1, targetLength, SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered;
}

/*
  Post-process raw Basic Pitch note events:
   - clamp to piano range (A0..C8)
   - filter out ultra-short fragments
   - merge overlapping same-pitch notes
   - reduce simultaneous polyphony (keep loudest N — focus on main piano voice)
   - clean velocity
   - estimate tempo from onset intervals + light quantization
   - drop out-of-key outliers based on estimated key signature (chroma histogram)
*/
function refineNotes(noteEvents, maxPolyphony = 8) {
  // First pass: filter + normalize
  const filtered = [];
  for (const n of noteEvents) {
    const midi = Math.round(n.pitchMidi);
    if (midi < PIANO_MIN || midi > PIANO_MAX) continue;
    const duration = n.durationSeconds;
    if (duration < 0.06) continue;
    const velocity = Math.max(0.25, Math.min(1, n.amplitude || 0.7));
    filtered.push({
      midi,
      time: Math.max(0, n.startTimeSeconds),
      duration,
      velocity,
    });
  }

  filtered.sort((a, b) => a.time - b.time || a.midi - b.midi);

  // ---- Key-signature outlier detection (chroma histogram) ----
  const chroma = new Array(12).fill(0);
  for (const n of filtered) {
    chroma[n.midi % 12] += n.duration * n.velocity;
  }
  // Common key profiles (Krumhansl major + minor, simplified)
  const MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
  let bestScore = -Infinity, bestKey = 0, bestMode = MAJOR;
  for (const mode of [MAJOR, MINOR]) {
    for (let k = 0; k < 12; k++) {
      let s = 0;
      for (let i = 0; i < 12; i++) s += chroma[(i + k) % 12] * mode[i];
      if (s > bestScore) { bestScore = s; bestKey = k; bestMode = mode; }
    }
  }
  // Score each pitch class against the winning key profile
  const keyStrength = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) keyStrength[(i + bestKey) % 12] = bestMode[i];
  // Filter: notes whose pitch class scores < 15% of max profile strength AND are quiet — drop
  const maxProfile = Math.max(...bestMode);
  const noteThreshold = maxProfile * 0.15;
  const keyFiltered = filtered.filter((n) => {
    const s = keyStrength[n.midi % 12];
    if (s >= noteThreshold) return true;
    // out-of-key: keep only if loud + long
    return n.velocity >= 0.7 && n.duration >= 0.25;
  });

  // ---- Merge overlapping same-pitch notes ----
  const byPitch = new Map();
  for (const n of keyFiltered) {
    if (!byPitch.has(n.midi)) byPitch.set(n.midi, []);
    byPitch.get(n.midi).push(n);
  }
  const merged = [];
  for (const [, arr] of byPitch) {
    arr.sort((a, b) => a.time - b.time);
    let cur = null;
    for (const n of arr) {
      if (!cur) { cur = { ...n }; continue; }
      const curEnd = cur.time + cur.duration;
      if (n.time - curEnd < 0.04) {
        cur.duration = Math.max(curEnd, n.time + n.duration) - cur.time;
        cur.velocity = Math.max(cur.velocity, n.velocity);
      } else {
        merged.push(cur);
        cur = { ...n };
      }
    }
    if (cur) merged.push(cur);
  }
  merged.sort((a, b) => a.time - b.time);

  // ---- Tempo estimation + light quantization ----
  // Estimate tempo by looking at inter-onset intervals (IOI)
  const iois = [];
  const onsets = merged.map((n) => n.time);
  for (let i = 1; i < onsets.length; i++) {
    const d = onsets[i] - onsets[i - 1];
    if (d > 0.05 && d < 2) iois.push(d);
  }
  let subdivision = 0.125; // fall-back = 8th-note @ 120bpm
  if (iois.length > 5) {
    iois.sort((a, b) => a - b);
    const median = iois[Math.floor(iois.length / 2)];
    // Grid = median IOI (usually an 8th or 16th note)
    // Snap to reasonable range 60ms..500ms
    subdivision = Math.max(0.06, Math.min(0.5, median));
  }
  // Quantize starts by max ±25% of a subdivision (soft quantization to preserve feel)
  const quantized = merged.map((n) => {
    const gridT = Math.round(n.time / subdivision) * subdivision;
    const drift = gridT - n.time;
    const maxDrift = subdivision * 0.25;
    const clamped = Math.max(-maxDrift, Math.min(maxDrift, drift));
    return { ...n, time: n.time + clamped };
  });

  // ---- Polyphony reduction ----
  const step = 0.04;
  const kept = new Set();
  const active = [];
  const events = quantized.map((n) => ({ start: n.time, end: n.time + n.duration, note: n }));
  events.sort((a, b) => a.start - b.start);

  let t = 0;
  const end = events.length > 0 ? events[events.length - 1].end : 0;
  let idx = 0;
  while (t <= end + step) {
    while (idx < events.length && events[idx].start <= t) {
      active.push({ note: events[idx].note, endsAt: events[idx].end });
      idx++;
    }
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endsAt <= t) active.splice(i, 1);
    }
    if (active.length > 0) {
      const sorted = [...active].sort((a, b) => b.note.velocity - a.note.velocity);
      for (let i = 0; i < Math.min(maxPolyphony, sorted.length); i++) {
        kept.add(sorted[i].note);
      }
    }
    t += step;
  }
  return quantized.filter((n) => kept.has(n));
}

/*
  convertAudioToMidi(file, onProgress) → Song
*/
export async function convertAudioToMidi(file, onProgress = () => {}) {
  onProgress("decoding", 0);
  const audioBuffer = await decodeAndResample(file);
  onProgress("decoding", 100);

  const bp = getBasicPitch();
  const frames = [];
  const onsets = [];
  const contours = [];

  onProgress("analyzing", 0);
  await bp.evaluateModel(
    audioBuffer,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p) => onProgress("analyzing", Math.round(p)),
  );

  onProgress("converting", 30);
  // Recommended Basic Pitch defaults for musical output:
  //   onsetThresh=0.5, frameThresh=0.3, minNoteLen=11 frames,
  //   inferOnsets=true, melodiaTrick=true, energyTolerance=11
  const rawNotes = outputToNotesPoly(
    frames,
    onsets,
    0.5,   // onsetThresh
    0.3,   // frameThresh
    11,    // minNoteLen (frames)
    true,  // inferOnsets
    null,  // maxFreq
    null,  // minFreq
    true,  // melodiaTrick
    11,    // energyTolerance
  );

  onProgress("converting", 60);
  const withBends = addPitchBendsToNoteEvents(contours, rawNotes);
  const noteEvents = noteFramesToTime(withBends);
  const notes = refineNotes(noteEvents);

  onProgress("converting", 100);

  const duration =
    notes.length > 0
      ? Math.max(...notes.map((n) => n.time + n.duration)) + 1
      : 1;

  onProgress("done", 100);

  return {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.(mp3|wav|ogg|m4a|flac)$/i, ""),
    duration,
    notes,
    source: "upload",
  };
}

export function isAudioFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  return ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext);
}
