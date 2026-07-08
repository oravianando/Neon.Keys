import { Midi } from "@tonejs/midi";

const GM_INSTRUMENT_NAMES = [
  "Acoustic Grand Piano","Bright Acoustic Piano","Electric Grand Piano","Honky-tonk Piano","Electric Piano 1","Electric Piano 2","Harpsichord","Clavinet",
  "Celesta","Glockenspiel","Music Box","Vibraphone","Marimba","Xylophone","Tubular Bells","Dulcimer",
  "Drawbar Organ","Percussive Organ","Rock Organ","Church Organ","Reed Organ","Accordion","Harmonica","Tango Accordion",
  "Acoustic Guitar (nylon)","Acoustic Guitar (steel)","Electric Guitar (jazz)","Electric Guitar (clean)","Electric Guitar (muted)","Overdriven Guitar","Distortion Guitar","Guitar Harmonics",
  "Acoustic Bass","Electric Bass (finger)","Electric Bass (pick)","Fretless Bass","Slap Bass 1","Slap Bass 2","Synth Bass 1","Synth Bass 2",
  "Violin","Viola","Cello","Contrabass","Tremolo Strings","Pizzicato Strings","Orchestral Harp","Timpani",
  "String Ensemble 1","String Ensemble 2","Synth Strings 1","Synth Strings 2","Choir Aahs","Voice Oohs","Synth Voice","Orchestra Hit",
  "Trumpet","Trombone","Tuba","Muted Trumpet","French Horn","Brass Section","Synth Brass 1","Synth Brass 2",
  "Soprano Sax","Alto Sax","Tenor Sax","Baritone Sax","Oboe","English Horn","Bassoon","Clarinet",
  "Piccolo","Flute","Recorder","Pan Flute","Blown Bottle","Shakuhachi","Whistle","Ocarina",
  "Lead 1 (square)","Lead 2 (sawtooth)","Lead 3 (calliope)","Lead 4 (chiff)","Lead 5 (charang)","Lead 6 (voice)","Lead 7 (fifths)","Lead 8 (bass + lead)",
  "Pad 1 (new age)","Pad 2 (warm)","Pad 3 (polysynth)","Pad 4 (choir)","Pad 5 (bowed)","Pad 6 (metallic)","Pad 7 (halo)","Pad 8 (sweep)",
  "FX 1 (rain)","FX 2 (soundtrack)","FX 3 (crystal)","FX 4 (atmosphere)","FX 5 (brightness)","FX 6 (goblins)","FX 7 (echoes)","FX 8 (sci-fi)",
  "Sitar","Banjo","Shamisen","Koto","Kalimba","Bagpipe","Fiddle","Shanai",
  "Tinkle Bell","Agogo","Steel Drums","Woodblock","Taiko Drum","Melodic Tom","Synth Drum","Reverse Cymbal",
  "Guitar Fret Noise","Breath Noise","Seashore","Bird Tweet","Telephone Ring","Helicopter","Applause","Gunshot",
];

export function programToInstrumentFamily(program) {
  if (program <= 7) return "piano";
  if (program <= 15) return "chromatic";
  if (program <= 23) return "organ";
  if (program <= 31) return "guitar";
  if (program <= 39) return "bass";
  if (program <= 47) return "strings";
  if (program <= 55) return "ensemble";
  if (program <= 63) return "brass";
  if (program <= 71) return "reed";
  if (program <= 79) return "pipe";
  if (program <= 87) return "synthLead";
  if (program <= 95) return "synthPad";
  if (program <= 103) return "synthFx";
  return "misc";
}

/*
  Parse a MIDI file into a Song structure that preserves per-track (per-instrument) notes.
  Returns:
    {
      id, name, duration, source: "upload",
      notes: [...],       // flat combined (backward-compat)
      tracks: [
        { id, name, program, family, isDrum, notes: [...] },
        ...
      ]
    }
*/
export async function parseMidiFile(file) {
  const buffer = await file.arrayBuffer();
  const midi = new Midi(buffer);

  const tracks = [];
  midi.tracks.forEach((track, i) => {
    if (!track.notes || track.notes.length === 0) return;
    const program = track.instrument?.number ?? 0;
    const isDrum = !!track.instrument?.percussion || track.channel === 9;
    const family = isDrum ? "drums" : programToInstrumentFamily(program);
    const name =
      track.name ||
      track.instrument?.name ||
      GM_INSTRUMENT_NAMES[program] ||
      `Track ${i + 1}`;
    const notes = track.notes.map((n) => ({
      midi: n.midi,
      time: n.time,
      duration: Math.max(n.duration, 0.05),
      velocity: n.velocity || 0.8,
      track: i,
    }));
    tracks.push({ id: `t${i}`, name, program, family, isDrum, notes });
  });

  // Skip drum tracks from the main visualization (still stored for playback)
  const flatNotes = tracks.flatMap((t) => t.notes);
  flatNotes.sort((a, b) => a.time - b.time);

  const duration =
    flatNotes.length > 0
      ? Math.max(...flatNotes.map((n) => n.time + n.duration)) + 1
      : 1;

  return {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.(mid|midi)$/i, ""),
    duration,
    notes: flatNotes,
    tracks,
    source: "upload",
  };
}
