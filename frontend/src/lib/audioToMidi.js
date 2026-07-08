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

  // Merge overlapping same-pitch notes
  const byPitch = new Map();
  for (const n of filtered) {
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
      if (n.time - curEnd < 0.03) {
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

  // Reduce polyphony: sweep timeline in 40ms steps, if more than maxPolyphony
  // notes are active, drop the ones with lowest velocity (focuses on main voice).
  const step = 0.04;
  const kept = new Set();
  const active = []; // { note, endsAt }
  const events = merged.map((n) => ({ start: n.time, end: n.time + n.duration, note: n }));
  events.sort((a, b) => a.start - b.start);

  let t = 0;
  const end = events.length > 0 ? events[events.length - 1].end : 0;
  let idx = 0;
  while (t <= end + step) {
    // Add new-starting notes
    while (idx < events.length && events[idx].start <= t) {
      active.push({ note: events[idx].note, endsAt: events[idx].end });
      idx++;
    }
    // Remove finished
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endsAt <= t) active.splice(i, 1);
    }
    if (active.length > 0) {
      // Sort by velocity desc; keep top N
      const sorted = [...active].sort((a, b) => b.note.velocity - a.note.velocity);
      for (let i = 0; i < Math.min(maxPolyphony, sorted.length); i++) {
        kept.add(sorted[i].note);
      }
    }
    t += step;
  }

  return merged.filter((n) => kept.has(n));
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
