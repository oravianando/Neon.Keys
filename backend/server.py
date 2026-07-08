from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
import hashlib
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class Note(BaseModel):
    midi: int
    time: float
    duration: float
    velocity: float = 0.8
    hand: Optional[str] = None  # 'left' | 'right' | None


class Song(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    duration: float
    notes: List[Note]
    chords: List[dict] = Field(default_factory=list)
    tracks: List[dict] = Field(default_factory=list)
    source: str = "upload"  # 'upload' | 'demo'
    difficulty: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SongCreate(BaseModel):
    name: str
    duration: float
    notes: List[Note]
    chords: List[dict] = Field(default_factory=list)
    tracks: List[dict] = Field(default_factory=list)
    source: str = "upload"
    difficulty: Optional[str] = None


class Settings(BaseModel):
    id: str = "global"
    volume: float = 0.8
    speed: float = 1.0
    show_labels: bool = True
    note_color: str = "cyan"
    sustain: bool = False
    lookahead: float = 4.0


# ---------- Demo song data ----------
def make_song(name: str, seq, tempo=120):
    """seq: list of (midi, start_beat, duration_beats, velocity)"""
    beat = 60.0 / tempo
    notes = [
        {"midi": m, "time": s * beat, "duration": d * beat, "velocity": v}
        for (m, s, d, v) in seq
    ]
    duration = max(n["time"] + n["duration"] for n in notes) + 1.0
    return {
        "id": name.lower().replace(" ", "-"),
        "name": name,
        "duration": duration,
        "notes": notes,
        "source": "demo",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# Twinkle Twinkle
twinkle = make_song("Twinkle Twinkle Little Star", [
    (60,0,1,.8),(60,1,1,.8),(67,2,1,.8),(67,3,1,.8),(69,4,1,.8),(69,5,1,.8),(67,6,2,.8),
    (65,8,1,.8),(65,9,1,.8),(64,10,1,.8),(64,11,1,.8),(62,12,1,.8),(62,13,1,.8),(60,14,2,.8),
    (67,16,1,.8),(67,17,1,.8),(65,18,1,.8),(65,19,1,.8),(64,20,1,.8),(64,21,1,.8),(62,22,2,.8),
    (67,24,1,.8),(67,25,1,.8),(65,26,1,.8),(65,27,1,.8),(64,28,1,.8),(64,29,1,.8),(62,30,2,.8),
    (60,32,1,.8),(60,33,1,.8),(67,34,1,.8),(67,35,1,.8),(69,36,1,.8),(69,37,1,.8),(67,38,2,.8),
    (65,40,1,.8),(65,41,1,.8),(64,42,1,.8),(64,43,1,.8),(62,44,1,.8),(62,45,1,.8),(60,46,2,.8),
], tempo=110)

# Ode to Joy (Beethoven's 9th, main theme)
ode_seq = [
    (64,0,1,.8),(64,1,1,.8),(65,2,1,.8),(67,3,1,.8),
    (67,4,1,.8),(65,5,1,.8),(64,6,1,.8),(62,7,1,.8),
    (60,8,1,.8),(60,9,1,.8),(62,10,1,.8),(64,11,1,.8),
    (64,12,1.5,.8),(62,13.5,.5,.8),(62,14,2,.8),
    (64,16,1,.8),(64,17,1,.8),(65,18,1,.8),(67,19,1,.8),
    (67,20,1,.8),(65,21,1,.8),(64,22,1,.8),(62,23,1,.8),
    (60,24,1,.8),(60,25,1,.8),(62,26,1,.8),(64,27,1,.8),
    (62,28,1.5,.8),(60,29.5,.5,.8),(60,30,2,.8),
]
ode = make_song("Ode to Joy", ode_seq, tempo=115)

# Für Elise (opening)
fur = make_song("Für Elise (Intro)", [
    (76,0,.5,.85),(75,.5,.5,.75),(76,1,.5,.85),(75,1.5,.5,.75),(76,2,.5,.85),
    (71,2.5,.5,.8),(74,3,.5,.8),(72,3.5,.5,.8),(69,4,1,.7),
    (60,5,.5,.5),(64,5.5,.5,.5),(69,6,.5,.5),(71,6.5,1,.7),
    (64,7.5,.5,.5),(68,8,.5,.5),(71,8.5,.5,.5),(72,9,1,.7),
    (64,10,.5,.5),(76,10.5,.5,.85),(75,11,.5,.75),(76,11.5,.5,.85),(75,12,.5,.75),
    (76,12.5,.5,.85),(71,13,.5,.8),(74,13.5,.5,.8),(72,14,.5,.8),(69,14.5,1,.7),
], tempo=140)

# Happy Birthday
hb = make_song("Happy Birthday", [
    (60,0,.75,.8),(60,.75,.25,.8),(62,1,1,.8),(60,2,1,.8),(65,3,1,.8),(64,4,2,.8),
    (60,6,.75,.8),(60,6.75,.25,.8),(62,7,1,.8),(60,8,1,.8),(67,9,1,.8),(65,10,2,.8),
    (60,12,.75,.8),(60,12.75,.25,.8),(72,13,1,.8),(69,14,1,.8),(65,15,1,.8),(64,16,1,.8),(62,17,2,.8),
    (70,19,.75,.8),(70,19.75,.25,.8),(69,20,1,.8),(65,21,1,.8),(67,22,1,.8),(65,23,2,.8),
], tempo=120)

# Canon in D (opening)
canon = make_song("Canon in D (Melody)", [
    (78,0,2,.8),(76,2,2,.8),(74,4,2,.8),(73,6,2,.8),
    (71,8,2,.8),(69,10,2,.8),(71,12,2,.8),(73,14,2,.8),
    (74,16,1,.8),(76,17,1,.8),(78,18,1,.8),(78,19,1,.8),
    (81,20,1,.8),(78,21,1,.8),(76,22,1,.8),(74,23,1,.8),
], tempo=90)

DEMO_SONGS = [twinkle, ode, fur, hb, canon]


# ---------- Endpoints ----------
@api_router.get("/")
async def root():
    return {"message": "Piano App API", "status": "ok"}


@api_router.get("/demo-songs")
async def get_demo_songs():
    return DEMO_SONGS


@api_router.post("/songs")
async def create_song(payload: SongCreate):
    song = Song(**payload.model_dump())
    doc = song.model_dump()
    await db.songs.insert_one(doc)
    return song


@api_router.get("/songs")
async def list_songs():
    songs = await db.songs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return songs


@api_router.get("/songs/{song_id}")
async def get_song(song_id: str):
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(404, "Song not found")
    return song


@api_router.delete("/songs/{song_id}")
async def delete_song(song_id: str):
    result = await db.songs.delete_one({"id": song_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Song not found")
    return {"deleted": True}


@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        return Settings().model_dump()
    return doc


@api_router.put("/settings")
async def update_settings(payload: Settings):
    doc = payload.model_dump()
    doc["id"] = "global"
    await db.settings.update_one({"id": "global"}, {"$set": doc}, upsert=True)
    return doc


# ---------- LLM-based MIDI refinement ----------
REFINE_VERSION = "v2"


class RefineRequest(BaseModel):
    notes: List[Note]
    name: Optional[str] = None
    difficulty: str = "intermediate"  # 'beginner' | 'intermediate' | 'advanced'
    force_refresh: bool = False


class Chord(BaseModel):
    time: float
    name: str  # e.g. "Cmaj", "Am", "F/A"


class EditSongRequest(BaseModel):
    notes: List[Note]


MAX_LLM_NOTES = 500


def _extract_json(text: str) -> dict:
    """Best-effort JSON extraction from LLM response."""
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return {}


def _refine_cache_key(notes: List[dict], difficulty: str) -> str:
    canonical = json.dumps(
        [
            {
                "m": n["midi"],
                "t": round(n["time"], 3),
                "d": round(n["duration"], 3),
                "v": round(n["velocity"], 2),
            }
            for n in notes
        ],
        separators=(",", ":"),
        sort_keys=True,
    )
    payload = f"{REFINE_VERSION}|{difficulty}|{canonical}"
    return hashlib.sha256(payload.encode()).hexdigest()


DIFFICULTY_INSTRUCTIONS = {
    "beginner": (
        "TARGET LEVEL: BEGINNER pianist.\n"
        "- Right hand MUST contain only the primary single-note melody (top voice).\n"
        "- Left hand MUST be simplified to at most 1 note per chord (root note only). Drop inner voices.\n"
        "- Drop grace notes, trills, and any dense passing runs. Merge notes shorter than 200ms into the nearest longer note.\n"
        "- Drop up to 30% of the notes to keep the arrangement easy to play."
    ),
    "intermediate": (
        "TARGET LEVEL: INTERMEDIATE pianist.\n"
        "- Right hand keeps the melody with light ornaments.\n"
        "- Left hand keeps 2-3 note chord voicings; drop dense inner voices.\n"
        "- Drop clear noise/artifacts. Drop up to 20% of notes."
    ),
    "advanced": (
        "TARGET LEVEL: ADVANCED pianist.\n"
        "- Preserve the piece as-is; only drop clearly-erroneous artifacts (spurious very-short blips, out-of-key single-frame detections).\n"
        "- Keep the full harmonic content. Drop no more than 10% of notes."
    ),
}


async def _classify_hands(notes: List[dict], difficulty: str) -> dict:
    """Send notes to Claude and get back {right, left, drop, chords}."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    lines = []
    for i, n in enumerate(notes):
        lines.append(
            f"{i} {n['midi']} {round(n['time'], 3)} {round(n['duration'], 3)} {round(n['velocity'], 2)}"
        )
    notes_block = "\n".join(lines)

    diff_key = difficulty if difficulty in DIFFICULTY_INSTRUCTIONS else "intermediate"
    diff_prompt = DIFFICULTY_INSTRUCTIONS[diff_key]

    system_message = (
        "You are an expert piano-music-theory assistant. You will receive detected note events from audio-to-MIDI extraction.\n"
        "Each line is: `index midi time duration velocity`. Time is in seconds. MIDI 60 = middle C (C4).\n\n"
        f"{diff_prompt}\n\n"
        "Your tasks:\n"
        "1. Classify each retained note into 'right' (melody, usually MIDI >= 60) or 'left' (bass/chord accompaniment, usually MIDI < 60).\n"
        "2. Put noise/mistake indices into 'drop'. Also drop notes per the difficulty rules above.\n"
        "3. Detect the chord progression as {time_seconds, chord_name} entries. Chord names use standard notation like 'Cmaj', 'Am', 'G7', 'F/A', 'Dm7'. Return 4-30 chords depending on piece length. Chords should be time-ordered.\n"
        "4. Every input index must appear in exactly one of right/left/drop.\n\n"
        "Return ONLY a JSON object, no prose, no markdown:\n"
        '{"right": [int, ...], "left": [int, ...], "drop": [int, ...], "chords": [{"time": number, "name": string}, ...]}'
    )

    user_text = f"Total notes: {len(notes)}\nDifficulty: {diff_key}\n\nNotes:\n{notes_block}"

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"midi-refine-{uuid.uuid4()}",
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-6")

    response_text = await chat.send_message(UserMessage(text=user_text))
    parsed = _extract_json(response_text or "")
    if not parsed:
        raise ValueError("LLM returned no parseable JSON")
    return parsed


@api_router.post("/refine-midi")
async def refine_midi(payload: RefineRequest):
    """Use Claude Sonnet 4.6 to tag notes with left/right hand, drop noise, detect chords. Cached by content-hash."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM key not configured")

    original = [n.model_dump() for n in payload.notes]
    if not original:
        return {"notes": [], "chords": [], "stats": {"input": 0, "output": 0, "dropped": 0, "refined": False, "cached": False}}

    difficulty = payload.difficulty or "intermediate"
    cache_key = _refine_cache_key(original, difficulty)

    if not payload.force_refresh:
        cached = await db.midi_refinements.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            return {
                "notes": cached["notes"],
                "chords": cached.get("chords", []),
                "stats": {**cached.get("stats", {}), "cached": True},
            }

    to_llm = original[:MAX_LLM_NOTES]
    passthrough = original[MAX_LLM_NOTES:]

    try:
        classification = await _classify_hands(to_llm, difficulty)
    except Exception as e:
        logger.warning(f"LLM refinement failed, using heuristic fallback: {e}")
        classification = {"right": [], "left": [], "drop": [], "chords": []}
        for i, n in enumerate(to_llm):
            (classification["right"] if n["midi"] >= 60 else classification["left"]).append(i)

    right_set = set(classification.get("right", []) or [])
    left_set = set(classification.get("left", []) or [])
    drop_set = set(classification.get("drop", []) or [])
    chords_raw = classification.get("chords", []) or []

    # Difficulty-aware drop cap
    drop_cap_pct = {"beginner": 0.30, "intermediate": 0.20, "advanced": 0.10}.get(difficulty, 0.20)
    drop_cap = max(0, int(len(to_llm) * drop_cap_pct))
    if len(drop_set) > drop_cap:
        drop_set = set(list(drop_set)[:drop_cap])

    refined: List[dict] = []
    for i, n in enumerate(to_llm):
        if i in drop_set:
            continue
        if i in left_set:
            n["hand"] = "left"
        elif i in right_set:
            n["hand"] = "right"
        else:
            n["hand"] = "left" if n["midi"] < 60 else "right"
        refined.append(n)

    for n in passthrough:
        n["hand"] = "left" if n["midi"] < 60 else "right"
        refined.append(n)

    refined.sort(key=lambda x: (x["time"], x["midi"]))

    # Clean up chords
    chords: List[dict] = []
    for c in chords_raw:
        try:
            t = float(c.get("time"))
            name = str(c.get("name", "")).strip()
            if name:
                chords.append({"time": t, "name": name[:12]})
        except Exception:
            continue
    chords.sort(key=lambda c: c["time"])

    stats = {
        "input": len(original),
        "output": len(refined),
        "dropped": len(original) - len(refined),
        "refined": True,
        "difficulty": difficulty,
        "cached": False,
    }

    # Cache
    await db.midi_refinements.update_one(
        {"key": cache_key},
        {"$set": {
            "key": cache_key,
            "notes": refined,
            "chords": chords,
            "stats": stats,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    return {"notes": refined, "chords": chords, "stats": stats}


@api_router.put("/songs/{song_id}")
async def update_song(song_id: str, payload: EditSongRequest):
    """Update the notes of a saved song (used by the MIDI editor)."""
    notes = [n.model_dump() for n in payload.notes]
    duration = max((n["time"] + n["duration"] for n in notes), default=1.0) + 1
    result = await db.songs.update_one(
        {"id": song_id},
        {"$set": {"notes": notes, "duration": duration}},
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Song not found")
    doc = await db.songs.find_one({"id": song_id}, {"_id": 0})
    return doc


# ---------- AI video enhancements ----------
class VideoEnhanceRequest(BaseModel):
    song_name: str = ""
    duration: float = 0
    note_count: int = 0
    chord_names: List[str] = Field(default_factory=list)
    families: List[str] = Field(default_factory=list)
    available_presets: List[str] = Field(default_factory=list)


@api_router.post("/video/ai-enhance")
async def video_ai_enhance(payload: VideoEnhanceRequest):
    """LLM picks the best VFX preset and generates a title + tagline for the video."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM key not configured")

    from emergentintegrations.llm.chat import LlmChat, UserMessage

    system_message = (
        "You are a music-video art director. Given a piece of music, pick the BEST VFX preset from the available list "
        "and generate a short 2-4 word poetic TITLE and a one-line TAGLINE.\n\n"
        "Choose presets that fit the mood:\n"
        "- Slow / classical / ballad → aurora, ice, underwater, sunset, monochrome, gold\n"
        "- Fast / energetic / EDM → cyberpunk, laser, storm, confetti, retro-arcade, neon-cyan\n"
        "- Sad / minor → aurora, ice, monochrome, underwater\n"
        "- Happy / major → sunset, rainbow-flow, gold, confetti\n"
        "- Jazzy / bluesy → gold, sunset, fire, retro-arcade\n"
        "- Electronic / synth → vaporwave, hologram, matrix, galaxy, neon-pink\n"
        "- Epic / cinematic → storm, galaxy, starfield, fire\n\n"
        "Return ONLY a JSON object, no prose:\n"
        '{"preset_id": "one-of-the-available-preset-ids", "title": "Short Title", "tagline": "One-line tagline", "mood": "one-word mood"}'
    )

    user_text = (
        f"Song: {payload.song_name or 'Untitled'}\n"
        f"Duration: {payload.duration:.1f}s, notes: {payload.note_count}, "
        f"instruments: {', '.join(payload.families) or 'piano'}\n"
        f"Detected chords: {', '.join(payload.chord_names[:12]) or 'unknown'}\n"
        f"Available presets: {', '.join(payload.available_presets)}"
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"video-enhance-{uuid.uuid4()}",
        system_message=system_message,
    ).with_model("anthropic", "claude-sonnet-4-6")

    try:
        response_text = await chat.send_message(UserMessage(text=user_text))
        parsed = _extract_json(response_text or "")
        if not parsed:
            raise ValueError("no JSON")
    except Exception as e:
        logger.warning(f"AI enhance failed, using defaults: {e}")
        parsed = {
            "preset_id": (payload.available_presets or ["neon-cyan"])[0],
            "title": payload.song_name or "Piano Performance",
            "tagline": "Made with NEON.KEYS",
            "mood": "neutral",
        }

    # Sanitize
    preset_id = str(parsed.get("preset_id", "")).strip()
    if preset_id not in payload.available_presets and payload.available_presets:
        preset_id = payload.available_presets[0]
    title = str(parsed.get("title", payload.song_name))[:40] or "Piano Performance"
    tagline = str(parsed.get("tagline", ""))[:80]
    mood = str(parsed.get("mood", ""))[:24]

    return {
        "preset_id": preset_id,
        "title": title,
        "tagline": tagline,
        "mood": mood,
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
