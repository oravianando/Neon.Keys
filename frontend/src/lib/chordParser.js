// Parse a chord name (e.g., "Cmaj", "Am", "G7", "F/A", "Dm7", "Csus4", "Cadd9")
// into an array of MIDI note numbers rooted around C4 (60).
//
// Supports: maj, min, m, dim, aug, sus2, sus4, add9, 6, 7, maj7, m7, 7b5, 7#5,
// 9, m9, maj9, 11, 13, and slash chords "Xchord/Y" where Y is the bass note.

const NOTE_MAP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Interval formulas (semitones from root) for each quality.
const QUALITIES = {
  // Triads
  "":       [0, 4, 7],           // implicit major
  "maj":    [0, 4, 7],
  "M":      [0, 4, 7],
  "m":      [0, 3, 7],
  "min":    [0, 3, 7],
  "dim":    [0, 3, 6],
  "aug":    [0, 4, 8],
  "sus2":   [0, 2, 7],
  "sus4":   [0, 5, 7],
  "sus":    [0, 5, 7],
  // Sevenths
  "7":      [0, 4, 7, 10],
  "M7":     [0, 4, 7, 11],
  "maj7":   [0, 4, 7, 11],
  "m7":     [0, 3, 7, 10],
  "min7":   [0, 3, 7, 10],
  "mM7":    [0, 3, 7, 11],
  "dim7":   [0, 3, 6, 9],
  "m7b5":   [0, 3, 6, 10],
  "ø7":     [0, 3, 6, 10],
  "7b5":    [0, 4, 6, 10],
  "7#5":    [0, 4, 8, 10],
  // Sixth
  "6":      [0, 4, 7, 9],
  "m6":     [0, 3, 7, 9],
  // Extensions (kept compact; drop 11/13 root duplicates)
  "9":      [0, 4, 7, 10, 14],
  "maj9":   [0, 4, 7, 11, 14],
  "m9":     [0, 3, 7, 10, 14],
  "add9":   [0, 4, 7, 14],
  "11":     [0, 4, 7, 10, 14, 17],
  "13":     [0, 4, 7, 10, 14, 21],
};

function parseRoot(str) {
  if (!str) return null;
  const letter = str[0].toUpperCase();
  if (!(letter in NOTE_MAP)) return null;
  let semis = NOTE_MAP[letter];
  let rest = str.slice(1);
  // Accidentals: b, ♭, #, ♯
  if (rest[0] === "#" || rest[0] === "♯") { semis += 1; rest = rest.slice(1); }
  else if (rest[0] === "b" || rest[0] === "♭") { semis -= 1; rest = rest.slice(1); }
  return { semis, rest };
}

// Return an array of MIDI note numbers for the chord, centered around C4.
// Returns null if the name can't be parsed.
export function chordNameToMidi(name) {
  if (!name || typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  // Slash chord split
  const [chordPart, bassPart] = trimmed.split("/");
  const root = parseRoot(chordPart);
  if (!root) return null;
  const qualityStr = root.rest;

  // Pick the LONGEST matching quality key (e.g., "m7b5" before "m7" before "m").
  let intervals = null;
  let bestKey = "";
  for (const q of Object.keys(QUALITIES)) {
    if (qualityStr.startsWith(q) && q.length >= bestKey.length) {
      intervals = QUALITIES[q];
      bestKey = q;
    }
  }
  // Empty string is always present so intervals never null; but guard anyway.
  if (!intervals) intervals = QUALITIES[""];

  const ROOT_OCTAVE = 60; // C4
  // Root MIDI note nearest to C4 (60), pick within [55..66]
  let rootMidi = ROOT_OCTAVE + root.semis;
  if (rootMidi < 55) rootMidi += 12;
  if (rootMidi > 66) rootMidi -= 12;

  const notes = intervals.map((iv) => rootMidi + iv);

  // Handle slash-chord bass: place bass note ONE octave below the chord root.
  if (bassPart) {
    const bass = parseRoot(bassPart);
    if (bass) {
      let bassMidi = ROOT_OCTAVE + bass.semis - 12;
      if (bassMidi < 36) bassMidi += 12;
      notes.unshift(bassMidi);
    }
  }
  return notes;
}

// Human-friendly display name normalization (Cmaj -> C, Cm -> Cm, etc.)
export function chordDisplayName(name) {
  if (!name) return "";
  return name.replace(/^([A-G][#b♯♭]?)maj$/, "$1").replace(/^([A-G][#b♯♭]?)M$/, "$1");
}
