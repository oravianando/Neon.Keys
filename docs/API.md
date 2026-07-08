# API Reference

All routes prefixed with `/api`. The frontend calls them via `${REACT_APP_BACKEND_URL}/api/...`.

## Songs

### `GET /api/demo-songs`
Returns the curated demo library (readonly).

**200 OK**
```json
[
  { "id": "twinkle-twinkle-little-star", "name": "Twinkle Twinkle Little Star",
    "duration": 27, "notes": [...], "chords": [] },
  ...
]
```

### `GET /api/songs`
User-uploaded songs, newest first.

**200 OK** — array of `Song`.

### `POST /api/songs`
Save a new song.

**Body**
```json
{
  "name": "My Song",
  "duration": 45.2,
  "notes": [
    { "midi": 60, "time": 0, "duration": 0.5, "velocity": 0.9, "hand": "right", "track": 0 }
  ],
  "chords": [{ "time": 0, "name": "Cmaj" }],
  "tracks": [...],
  "difficulty": "intermediate",
  "source": "upload"
}
```

**201 Created** — the saved `Song` (with generated `id` if not provided).

### `PUT /api/songs/{id}`
Update the notes array only (used by the MIDI editor).

**Body**
```json
{ "notes": [ ... ] }
```

**200 OK** or **404** if id not found.

### `DELETE /api/songs/{id}`

**200 OK**: `{ "deleted": true }`.

## Settings

### `GET /api/settings`

**200 OK**
```json
{
  "id": "global",
  "volume": 0.8,
  "speed": 1.0,
  "show_labels": true,
  "note_color": "cyan",
  "sustain": false,
  "lookahead": 4.0,
  "convert_mode": "single",
  "chord_tutorial": true
}
```

### `PUT /api/settings`
Idempotent upsert. Body is the full `Settings` object.

## AI Endpoints

### `POST /api/refine-midi`

Send raw MIDI notes; get back cleaned, hand-classified notes + chords + optional instrument tracks.

**Body**
```json
{
  "notes": [{"midi":60,"time":0,"duration":0.4,"velocity":0.9}, ...],
  "name": "My Song",
  "difficulty": "intermediate",
  "force_refresh": false,
  "multi_track": true
}
```

**200 OK**
```json
{
  "notes": [...cleaned notes with `hand` and `track` fields...],
  "chords": [{"time":0.5,"name":"Cmaj"}, ...],
  "tracks": [
    {"id":"t0","name":"Melody","family":"piano","program":0,"isDrum":false,"notes":[...]},
    {"id":"t1","name":"Bass","family":"bass","program":32,"isDrum":false,"notes":[...]}
  ],
  "stats": {
    "input": 300, "output": 275, "dropped": 25, "refined": true,
    "difficulty": "intermediate", "multi_track": true, "track_count": 2, "cached": false
  }
}
```

Errors: **500** if `EMERGENT_LLM_KEY` missing; **400** if `notes` empty.

### `POST /api/sheet-to-midi`

`multipart/form-data` upload — `file` field with an image or PDF.

**Response (200 OK)**
```json
{
  "name": "twinkle-twinkle-little-star-piano-solo",
  "duration": 42.5,
  "notes": [...],
  "chords": [{"time":0.5,"name":"C"}, ...],
  "tracks": [
    {"id":"t0","name":"Right Hand","family":"piano","program":0,"isDrum":false,"notes":[...]},
    {"id":"t1","name":"Left Hand","family":"piano","program":0,"isDrum":false,"notes":[...]}
  ],
  "tempo_bpm": 120,
  "time_signature": "4/4",
  "key_signature": "C major",
  "page_count": 2,
  "source": "sheet"
}
```

**Errors**
- 400 — empty file / unreadable file / no pages
- 422 — Vision produced 0 notes across all pages
- 500 — `EMERGENT_LLM_KEY` missing

### `POST /api/video/ai-enhance`

Given song metadata, Claude picks the best VFX preset + generates title/tagline.

**Body**
```json
{
  "song_name": "Let It Be",
  "duration": 240,
  "note_count": 800,
  "chord_names": ["C","G","Am","F"],
  "families": ["piano","bass"],
  "available_presets": ["neon-cyan","fire","aurora", ...]
}
```

**Response**
```json
{
  "preset_id": "aurora",
  "title": "Let It Be",
  "tagline": "Whispers in cold air",
  "mood": "melancholic"
}
```

## Data Shapes Summary

| Type | Fields |
|------|--------|
| `Note` | `midi:int, time:float, duration:float, velocity:float, hand?:'left'\|'right', track?:int` |
| `Chord` | `time:float, name:str` |
| `Track` | `id:str, name:str, family:str, program:int, isDrum:bool, notes:Note[]` |
| `Song` | `id:str, name:str, duration:float, notes:Note[], chords:Chord[], tracks:Track[], difficulty:str, source:str, created_at:str` |
| `Settings` | `id:'global', volume:float, speed:float, show_labels:bool, note_color:str, sustain:bool, lookahead:float, convert_mode:'single'\|'multi', chord_tutorial:bool` |
| `RefineStats` | `input:int, output:int, dropped:int, refined:bool, difficulty:str, multi_track?:bool, track_count?:int, cached:bool` |

## Instrument Family → General MIDI Program

| Family | Program # | Track color |
|--------|-----------|-------------|
| piano | 0 | #00F0FF |
| strings | 48 | #7CFF9A |
| bass | 32 | #FF00E6 |
| synthPad | 88 | #B388FF |
| synthLead | 80 | #FFD700 |
| drums | (channel 10) | #795548 |

## Error Codes

| Code | Meaning | Common causes |
|------|---------|---------------|
| 400 | Bad request | Empty file, missing required fields |
| 404 | Not found | Song `id` doesn't exist for PUT/DELETE |
| 422 | Semantic error | Sheet music produced no notes |
| 500 | Server error | LLM key missing, Claude timeout |

## Rate & Timeout Guidance

- `/refine-midi` — ~5–15s single-track, ~10–30s multi-track. Frontend uses 180s axios timeout.
- `/sheet-to-midi` — ~15–30s per page, parallelized 4-at-a-time. Frontend uses 300s timeout.
- `/video/ai-enhance` — ~3–8s. Frontend uses 30s timeout.
- All other CRUD endpoints — <100ms.
