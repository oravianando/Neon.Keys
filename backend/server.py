from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
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

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class Note(BaseModel):
    midi: int
    time: float
    duration: float
    velocity: float = 0.8


class Song(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    duration: float
    notes: List[Note]
    source: str = "upload"  # 'upload' | 'demo'
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SongCreate(BaseModel):
    name: str
    duration: float
    notes: List[Note]
    source: str = "upload"


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
