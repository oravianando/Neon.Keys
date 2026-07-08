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
- **2026-02-08 v7:**
  - **Sheet Music → MIDI** — upload image (PNG/JPG/WEBP) or PDF; Claude Sonnet 4.6 Vision extracts every note with correct treble→right/bass→left hand assignment, tempo, time signature, key signature. Multi-page PDFs are stitched together sequentially.
  - **Download MIDI** — download icon on every song row (demo + uploaded) exports a `.mid` file via @tonejs/midi. Songs with hand tags get 2 tracks (Right/Left); multi-track songs preserve their tracks.
  - **Playable + aligned stacked pianos** — TrackPianoStack keyboards now span full width (aligned 1:1 with main piano); track name is a floating badge. Every key is a clickable `<button>` that triggers the track's own instrument family.
  - **Video export key tinting** — inactive white/black piano keys in the exported video are now tinted with the preset's palette[0] (matches rolling notes color) instead of pure white/black.
- **2026-02-08 v10 (this iteration):**
  - **Video/Audio sync fix in Recorder** — audio notes are now PRE-SCHEDULED on the Tone audio graph at exact `Tone.now() + n.time` seconds; the visual RAF loop derives elapsed time from the same `Tone.now()` clock. This eliminates the audio/video drift that occurred when RAF was throttled by GC pauses.
  - **Chord Tutorial mode** — floating overlay above the main piano (component: `ChordTutorial`, testid `chord-tutorial-overlay`) shows the current chord name + a mini 2-octave keyboard highlighting the chord tones. Uses a new `/app/frontend/src/lib/chordParser.js` that parses standard chord notation (maj/min/7/maj7/m7/sus/dim/aug/add9/9/11/13/slash chords). Toggleable via Settings → Chord Tutorial switch (`data-testid='chord-tutorial-switch'`), persisted via Settings.chord_tutorial (backend field).
  - **Note resize in Edit mode** — MidiEditorOverlay now renders a yellow resize handle at the top edge of the SELECTED note. Dragging up increases duration, dragging down decreases; clamped to [0.05, 30] seconds. Works on mouse + touch. Song's total duration auto-extends if a resize pushes past the current end.
  - **Demo-song edit save** — clicking SAVE on an edited demo song now saves it as a NEW user song (`{name} (edited)`) instead of failing with 404.
- **2026-02-08 v9:**
  - **VBR toggle in Video Recorder** — `Switch` control (`data-testid='toggle-vbr'`, default ON). When enabled, MediaRecorder targets ~60% of the stated bitrate (variable rate); file-size estimate updates accordingly.
  - **AI enhancer ON/OFF toggle + auto-run** — new `Switch` (`data-testid='toggle-ai-enhance'`, default ON). When ON, Claude AI enhance runs automatically once per song when the modal opens (populates title, tagline, picks preset). When OFF, the AI Suggest button is disabled and no auto-request fires.
  - **`renderFrame` split out** — moved from `VideoRecorderModal.jsx` (~130 lines removed) into `/app/frontend/src/lib/videoFrameRenderer.js`. VideoRecorderModal is now 560 lines.
  - **Zoom removed from all VFX presets** — `zoomOnBeat` replaced with `pulseGlow` (0..1). Only shake remains for beat energy; a soft white bloom on the impact line pulses when 2+ keys hit simultaneously.
  - **Multi-track INSTRUMENT recognition** — `/api/refine-midi` now accepts `multi_track: true`. Claude Sonnet 4.6 classifies notes into 5 instrument roles (melody→piano, harmony→strings, bass→bass, pad→synthPad, accent→synthLead) — each becomes a track with a distinct Tone.js family, MIDI program, and color. Fallback to hand-based Melody+Bass if LLM produces <2 usable tracks.
  - **Stacked mini pianos in video canvas** — when a song has 2+ non-drum tracks, the video render splits the piano region into a main piano (bottom-most) + up to 4 stacked mini piano rows above the main, each showing that track's active notes in the track's color, with a floating name+family label. Applies to both preview and recorded video.
  - **`convert_mode` persistence** — Song Library's Single/Multi track toggle now hydrates from `GET /api/settings.convert_mode` on mount and PUTs on every change.
  - **Preview canvas race fix** — resolved a Radix DialogContent portal race that left the canvas at default 300×150 until a user clicked a preset; canvas now initializes reliably on modal open.
- **2026-02-08 v8:**
  - **Live particle VFX in preview canvas** — VideoRecorderModal preview loop now spawns and animates particles when notes trigger; cycling presets updates particle color.
  - **Editable video title input** — replaced read-only `ai-title-preview` with editable `<input>` (`data-testid='video-title-input'`); title feeds both the on-screen title card and downloaded filename.
  - **Enhanced sheet-music conversion** — PDF DPI 2.0x→3.0x, PIL autocontrast+sharpness pre-processing, expanded OMR prompt (ottava, grace notes, triplets, dynamics, D.C./D.S., chord detection). Now returns `chords` array. Parallel page processing (asyncio.gather + Semaphore(4)).
  - **Backend refactor** — moved sheet-music helpers into `/app/backend/sheet_music.py` (server.py 770→620 lines).
  - **Settings model** — added `convert_mode` field for future UI persistence.
  - **VBR encoding hook** — `createVideoRecorder` accepts `bitrateMode: 'variable'` for smaller 4K files.

## Backlog
- P1: End-to-end multi-mode WAV upload test (multi-track split with a stereo pop track)
- P1: Practice mode wait-for-correct-key, computer keyboard → piano mapping, Web MIDI hardware
- P2: Persist `convertMode` (Single/Multi track) preference in `/api/settings`
- P2: Progressive VBR encoding for 4K exports
- P2: Split `server.py` (770 lines) — move sheet-music helpers into `/app/backend/sheet_music.py`
- P2: Break up `usePianoEngine.js` (large hook) into smaller modules
- P2: Sharing songs via URL, sheet-music PDF export, user accounts
