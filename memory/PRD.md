# NEON.KEYS — Piano App PRD

## Original Problem Statement
Create a piano app, extract MIDI from a song, add song upload option, show rolling notes above piano, add playback speed, add play/pause, add settings for piano.

## User Choices
- Theme: dark neon
- MIDI upload + **Audio → MIDI conversion via Spotify Basic Pitch (client-side TFJS)**
- **Sheet Music (Image/PDF) → MIDI conversion via Claude Sonnet 4.6 Vision** (all pages stitched)
- Piano sound: Tone.js Salamander sampler
- Persistence: FastAPI + MongoDB

## Architecture
### Backend (FastAPI + MongoDB + PyMuPDF + Pillow)
- `GET /api/demo-songs`, `GET/POST/PUT/DELETE /api/songs`, `GET/PUT /api/settings`
- `POST /api/refine-midi` (Claude MIDI cleanup + hand classification)
- `POST /api/sheet-to-midi` (Claude Vision OMR — accepts image/PDF, returns notes+tracks+tempo)
- `POST /api/video/ai-enhance` (Claude picks VFX preset + title/tagline)

### Frontend
- Components: `PianoApp.jsx`, `PianoKeyboard.jsx`, `RollingNotes.jsx`, `TransportControls.jsx`, `SongLibrary.jsx`, `SettingsPanel.jsx`, `ToolBar.jsx`, `ChordStrip.jsx`, `MidiEditor.jsx`, `VideoRecorderModal.jsx`, `TrackPianoStack.jsx`, `MultiInstrumentStack.jsx`
- Hooks: `usePianoEngine.js`
- Libs: `midiParse.js`, `midiExport.js`, `audioToMidi.js`, `instruments.js`, `piano.js`, `vfx.js`, `videoRecorder.js`
- Assets: `public/basic-pitch-model/` (TFJS model files)

## Implemented
- 2026-02-08 v1: 88-key piano, Tone.js Salamander sampler, MIDI upload, 5 demo songs, rolling notes canvas, play/pause/stop, seek, speed (0.25x-2x), settings panel with backend persist, dark-neon design
- 2026-02-08 v2: Audio → MIDI (Spotify Basic Pitch client-side) — .mp3/.wav/.ogg/.m4a/.flac
- 2026-02-08 v3: AI Left/Right hand classification + noise removal via Claude Sonnet 4.6
- 2026-02-08 v4: Chord detection strip, difficulty picker (beginner/intermediate/advanced), practice mode (L/R isolation), MIDI editor
- 2026-02-08 v5: Video recorder with 20 VFX presets, canvas-composited MP4/WebM export at HD/FHD/4K
- 2026-02-08 v6: Multi-track MIDI parsing, per-track instrument playback, TrackPianoStack visualization, file-size estimate & 4K duration warning
- **2026-02-08 v7 (this iteration):**
  - **Sheet Music → MIDI** — upload image (PNG/JPG/WEBP) or PDF; Claude Sonnet 4.6 Vision extracts every note with correct treble→right/bass→left hand assignment, tempo, time signature, key signature. Multi-page PDFs are stitched together sequentially.
  - **Download MIDI** — download icon on every song row (demo + uploaded) exports a `.mid` file via @tonejs/midi. Songs with hand tags get 2 tracks (Right/Left); multi-track songs preserve their tracks.
  - **Playable + aligned stacked pianos** — TrackPianoStack keyboards now span full width (aligned 1:1 with main piano); track name is a floating badge. Every key is a clickable `<button>` that triggers the track's own instrument family.
  - **Video export key tinting** — inactive white/black piano keys in the exported video are now tinted with the preset's palette[0] (matches rolling notes color) instead of pure white/black.

## Backlog
- P1: End-to-end multi-mode WAV upload test (multi-track split with a stereo pop track)
- P1: Practice mode wait-for-correct-key, computer keyboard → piano mapping, Web MIDI hardware
- P2: Persist `convertMode` (Single/Multi track) preference in `/api/settings`
- P2: Progressive VBR encoding for 4K exports
- P2: Split `server.py` (770 lines) — move sheet-music helpers into `/app/backend/sheet_music.py`
- P2: Break up `usePianoEngine.js` (large hook) into smaller modules
- P2: Sharing songs via URL, sheet-music PDF export, user accounts
