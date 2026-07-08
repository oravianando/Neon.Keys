import {
  BasicPitch,
  addPitchBendsToNoteEvents,
  noteFramesToTime,
  outputToNotesPoly,
} from "@spotify/basic-pitch";

const MODEL_URL = `${process.env.PUBLIC_URL || ""}/basic-pitch-model/model.json`;
const SAMPLE_RATE = 22050;

let basicPitchInstance = null;
function getBasicPitch() {
  if (!basicPitchInstance) {
    basicPitchInstance = new BasicPitch(MODEL_URL);
  }
  return basicPitchInstance;
}

// Decode audio file to 22050Hz mono Float32Array
async function decodeAndResample(file) {
  const arrayBuffer = await file.arrayBuffer();
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const decodeCtx = new AudioContextCtor();
  const decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  await decodeCtx.close();

  const OfflineCtxCtor =
    window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const targetLength = Math.ceil((decoded.duration || 1) * SAMPLE_RATE);
  const offlineCtx = new OfflineCtxCtor(1, targetLength, SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered;
}

/*
  convertAudioToMidi(file, onProgress) → Song
  onProgress(stage, percent) callback:
    stage: 'decoding' | 'analyzing' | 'converting' | 'done'
    percent: 0-100
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

  onProgress("converting", 0);
  // outputToNotesPoly(frames, onsets, onsetThresh, frameThresh, minNoteLen)
  const rawNotes = outputToNotesPoly(frames, onsets, 0.3, 0.3, 11);
  const withBends = addPitchBendsToNoteEvents(contours, rawNotes);
  const noteEvents = noteFramesToTime(withBends);
  onProgress("converting", 100);

  const notes = noteEvents
    .map((n) => ({
      midi: n.pitchMidi,
      time: n.startTimeSeconds,
      duration: Math.max(n.durationSeconds, 0.05),
      velocity: Math.max(0.2, Math.min(1, n.amplitude)),
    }))
    .sort((a, b) => a.time - b.time);

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
