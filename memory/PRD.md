# NEON.KEYS — Piano App PRD

## Original Problem Statement
Create a piano app, extract MIDI from a song, add song upload option, show rolling notes above piano, add playback speed, add play/pause, add settings for piano.

## User Choices
- Theme: dark neon (Electric & Neon archetype — Void black + Cyan/Pink glow)
- Song format: MIDI upload (with placeholder for MP3/WAV → MIDI in v2)
- Piano sound: Tone.js Sampler with Salamander piano samples
- Persistence: backend (FastAPI + MongoDB) for uploaded songs & settings

## Architecture
### Backend (FastAPI + MongoDB)
- `GET /api/demo-songs` — 5 built-in songs (Twinkle Twinkle, Ode to Joy, Für Elise, Happy Birthday, Canon in D)
- `GET/POST/DELETE /api/songs` — user uploaded songs CRUD
- `GET/PUT /api/settings` — persist global user settings (volume, speed, colors, labels, sustain, lookahead)

### Frontend (React + Tone.js + @tonejs/midi)
- `PianoApp.jsx` — main container, state, data fetching
- `PianoKeyboard.jsx` — 88-key visual + interactive piano
- `RollingNotes.jsx` — Canvas-based falling-notes visualization with neon glow
- `TransportControls.jsx` — play/pause/stop, progress bar, speed slider
- `SongLibrary.jsx` — song list + upload zone
- `SettingsPanel.jsx` — Sheet with volume, colors, toggles, lookahead
- `usePianoEngine.js` — Tone.Sampler, playback scheduler, activeKeys state

## Implemented (2026-02-08)
- 88-key interactive piano with black/white key rendering + click-to-play
- Real piano samples via Salamander (Tone.Sampler)
- MIDI file upload → parsed with @tonejs/midi → saved to backend
- 5 demo songs pre-populated on backend
- Rolling notes canvas synced to key positions, glow effects, per-note colors
- Play / Pause / Stop / Speed (0.25x–2x) / Seek via progress bar
- Settings sheet: volume, note fall time (lookahead), 4 note-color themes, labels toggle, sustain toggle
- Settings persist to backend (500ms debounced PUT)
- Dark neon design system: Unbounded + JetBrains Mono, cyan/pink/purple glow
- Toast notifications (sonner)
- All interactive elements have `data-testid`

## P1 Backlog
- MP3/WAV → MIDI conversion (Basic Pitch by Spotify, or paid Klangio API)
- Practice mode (wait for user to hit correct key)
- Recording user piano input as MIDI
- Loop / A-B repeat markers
- Metronome
- Multi-track color coding for MIDI songs with multiple instruments
- Computer-keyboard-to-piano key mapping (typing letters plays notes)

## P2 Backlog
- Sharing songs via URL
- Sheet-music export
- MIDI keyboard input (Web MIDI API)
- User accounts + song favorites
