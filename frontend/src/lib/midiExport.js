import { Midi } from "@tonejs/midi";

/*
  Serialize a song (as stored in the app: { name, duration, notes:[{midi,time,duration,velocity,hand,track}], tracks:[...] })
  into a downloadable .mid file. Notes are grouped by track (if present) or by hand (right/left)
  or into a single track. Triggers a browser download.
*/
export function downloadSongAsMidi(song) {
  if (!song || !song.notes || song.notes.length === 0) {
    throw new Error("No notes to export");
  }
  const midi = new Midi();
  midi.header.setTempo(100);

  // Grouping strategy:
  //   1. If explicit tracks provided → use those
  //   2. Else if any note has a hand tag → 2 tracks: Right / Left
  //   3. Else → single track
  const groups = [];
  if (song.tracks && song.tracks.length > 0) {
    for (const t of song.tracks) {
      groups.push({
        name: t.name || `Track ${t.id}`,
        program: t.program ?? 0,
        notes: t.notes,
      });
    }
  } else if (song.notes.some((n) => n.hand)) {
    const right = song.notes.filter((n) => (n.hand || "right") === "right");
    const left = song.notes.filter((n) => n.hand === "left");
    if (right.length) groups.push({ name: "Right Hand", program: 0, notes: right });
    if (left.length) groups.push({ name: "Left Hand", program: 0, notes: left });
  } else {
    groups.push({ name: song.name || "Piano", program: 0, notes: song.notes });
  }

  for (const g of groups) {
    const track = midi.addTrack();
    track.name = g.name;
    track.instrument.number = g.program || 0;
    for (const n of g.notes) {
      track.addNote({
        midi: n.midi,
        time: n.time,
        duration: Math.max(n.duration || 0.05, 0.05),
        velocity: Math.max(0.1, Math.min(1, n.velocity ?? 0.8)),
      });
    }
  }

  const bytes = midi.toArray();
  const blob = new Blob([bytes], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (song.name || "song").replace(/[^\w\-]+/g, "_");
  a.download = `${safeName}.mid`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
