# NEON.KEYS — Piano App PRD

## Original Problem Statement
Create a piano app, extract MIDI from a song, add song upload option, show rolling notes above piano, add playback speed, add play/pause, add settings for piano.

## User Choices
- Theme: dark neon
- MIDI upload + **Audio → MIDI conversion via Spotify Basic Pitch (client-side TFJS)**
- Piano sound: Tone.js Salamander sampler
- Persistence: FastAPI + MongoDB

## Architecture
### Backend (FastAPI + MongoDB)
- `GET /api/demo-songs`, `GET/POST/DELETE /api/songs`, `GET/PUT /api/settings`

### Frontend
- `PianoApp.jsx`, `PianoKeyboard.jsx`, `RollingNotes.jsx`, `TransportControls.jsx`, `SongLibrary.jsx`, `SettingsPanel.jsx`, `usePianoEngine.js`, `lib/midiParse.js`, `lib/audioToMidi.js`, `public/basic-pitch-model/` (TFJS model files)

## Implemented
- 2026-02-08 v1: 88-key piano, Tone.js Salamander sampler, MIDI upload (@tonejs/midi), 5 demo songs, rolling notes canvas, play/pause/stop, seek, speed (0.25x-2x), settings sheet (volume/colors/labels/sustain/lookahead) with backend persist, dark-neon design
- 2026-02-08 v2: **Audio → MIDI conversion (Spotify Basic Pitch client-side)** — .mp3/.wav/.ogg/.m4a/.flac supported; realtime progress UI (decoding → detecting pitches → building MIDI); model files served from `/basic-pitch-model/`; unified upload handler in SongLibrary

## Backlog
- P1: Practice mode (wait for correct key), computer keyboard → piano mapping, Web MIDI API for hardware
- P1: Basic Pitch tuning parameters exposed in settings (onset/frame thresholds, min note length)
- P2: Sharing songs via URL, sheet-music export, user accounts, multi-track color coding
