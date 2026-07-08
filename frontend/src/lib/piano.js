// Piano constants and helpers
export const MIN_MIDI = 21; // A0
export const MAX_MIDI = 108; // C8
export const TOTAL_KEYS = MAX_MIDI - MIN_MIDI + 1; // 88

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function midiToNoteName(midi) {
  const octave = Math.floor(midi / 12) - 1;
  const name = NOTE_NAMES[midi % 12];
  return `${name}${octave}`;
}

export function isBlackKey(midi) {
  const pc = midi % 12;
  return [1, 3, 6, 8, 10].includes(pc);
}

// Return array of all 88 keys with meta
export function buildKeys() {
  const keys = [];
  let whiteIndex = 0;
  for (let m = MIN_MIDI; m <= MAX_MIDI; m++) {
    const black = isBlackKey(m);
    keys.push({
      midi: m,
      name: midiToNoteName(m),
      black,
      whiteIndex: black ? null : whiteIndex,
    });
    if (!black) whiteIndex++;
  }
  return keys;
}

export const KEYS = buildKeys();
export const WHITE_KEY_COUNT = KEYS.filter((k) => !k.black).length; // 52

// Given a midi note, compute its horizontal position (0..1) across the keyboard
export function keyXFraction(midi) {
  const key = KEYS.find((k) => k.midi === midi);
  if (!key) return 0;
  if (!key.black) {
    return (key.whiteIndex + 0.5) / WHITE_KEY_COUNT;
  }
  // Black key sits between white keys - find neighboring whites
  const prevWhite = KEYS.slice(0, KEYS.indexOf(key)).reverse().find((k) => !k.black);
  const nextWhite = KEYS.slice(KEYS.indexOf(key) + 1).find((k) => !k.black);
  const w1 = prevWhite ? prevWhite.whiteIndex : 0;
  const w2 = nextWhite ? nextWhite.whiteIndex : WHITE_KEY_COUNT - 1;
  return ((w1 + w2 + 1) / 2) / WHITE_KEY_COUNT;
}

export function keyWidthFraction(midi) {
  const key = KEYS.find((k) => k.midi === midi);
  if (!key) return 0;
  return (key.black ? 0.6 : 1) / WHITE_KEY_COUNT;
}
