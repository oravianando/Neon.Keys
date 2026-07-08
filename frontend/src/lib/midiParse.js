import { Midi } from "@tonejs/midi";

// Parse a MIDI ArrayBuffer into our internal Song format
export async function parseMidiFile(file) {
  const buffer = await file.arrayBuffer();
  const midi = new Midi(buffer);

  const notes = [];
  midi.tracks.forEach((track) => {
    track.notes.forEach((n) => {
      notes.push({
        midi: n.midi,
        time: n.time,
        duration: Math.max(n.duration, 0.05),
        velocity: n.velocity || 0.8,
      });
    });
  });

  notes.sort((a, b) => a.time - b.time);

  const duration =
    notes.length > 0
      ? Math.max(...notes.map((n) => n.time + n.duration)) + 1
      : 1;

  return {
    id: crypto.randomUUID(),
    name: file.name.replace(/\.(mid|midi)$/i, ""),
    duration,
    notes,
    source: "upload",
  };
}
