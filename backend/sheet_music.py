"""Sheet Music (Image / PDF) → MIDI helpers.

Uses Claude Sonnet 4.6 Vision (via emergentintegrations) to read piano notation
from image or multi-page PDF input and returns time-ordered notes with correct
right/left hand assignment, tempo, and key signature.
"""
from __future__ import annotations
import io
import base64
import uuid
from typing import List, Callable

MAX_SHEET_PAGES = 30
SHEET_IMAGE_MIME = {"image/png", "image/jpeg", "image/webp"}


SHEET_MUSIC_SYSTEM = (
    "You are a world-class piano-music-notation reader (OMR - Optical Music Recognition).\n"
    "You will receive ONE page image of piano sheet music (usually a grand staff: treble+bass).\n"
    "Your job is to extract EVERY note visible on the page with perfect rhythmic accuracy.\n\n"
    "STRICT PIANO NOTATION RULES:\n"
    "- The TOP staff (treble clef 𝄞) plays with the RIGHT hand. The BOTTOM staff (bass clef 𝄢) plays with the LEFT hand.\n"
    "- If a clef changes mid-piece (e.g., bass clef changes to treble clef in the left hand), track it and re-map the pitches accordingly.\n"
    "- Read the key signature (sharps/flats after the clef) and apply it to EVERY note on those pitch letters unless overridden by an accidental in the measure.\n"
    "- Apply accidentals (♯ ♭ ♮ 𝄪 𝄫) to remaining notes of the SAME PITCH LETTER in the SAME OCTAVE in the SAME MEASURE only.\n"
    "- Read the time signature (default 4/4 if absent). Notes MUST sum correctly per measure.\n"
    "- Note values (in beats, quarter=1): whole=4, half=2, dotted-half=3, quarter=1, dotted-quarter=1.5, eighth=0.5, dotted-eighth=0.75, sixteenth=0.25, dotted-sixteenth=0.375, thirty-second=0.125.\n"
    "- Triplets (bracketed 3): three notes fill the duration of two of the same value (e.g., quarter-triplet = 2/3 beat each).\n"
    "- Ties (curved slur between SAME pitches): extend the previous note's duration; do NOT emit a new note. Slurs between DIFFERENT pitches are phrasing marks — ignore.\n"
    "- Chords (stacked noteheads on the same stem): emit each pitch as a SEPARATE note event with the same start beat and same duration.\n"
    "- Ledger lines: count each additional line above/below the staff carefully. Top of treble staff = F5=77; two ledger lines above = C6=84. Bottom of bass staff = G2=43; two ledger lines below = C2=36.\n"
    "- Ottava markings: 8va above raises the affected notes by an octave (+12). 8vb below lowers by an octave (-12). 15ma raises by two octaves (+24). Track when the bracket ends and revert.\n"
    "- Rests: skip, but the time cursor advances for that hand.\n"
    "- Grace notes (small notes): emit them at their written beat with a short duration (0.1 beats), then move on. Ignore ornamentation trills unless clearly written out.\n"
    "- Dynamics (p, mf, f, ff): map to velocity. ppp=0.35, pp=0.45, p=0.55, mp=0.65, mf=0.75, f=0.85, ff=0.95, fff=1.0. Default 0.7 if none marked.\n"
    "- Accents (>): boost velocity by +0.15. Staccato dot: reduce duration by 50%.\n"
    "- Repeats (𝄆 𝄇): EXPAND them — emit the repeated section TWICE in the notes array.\n"
    "- 1st/2nd endings (volta brackets): play 1st ending on repeat 1, 2nd ending on repeat 2. Do NOT emit the 1st ending on repeat 2.\n"
    "- D.C. al Fine / D.S. al Coda / Coda / Segno: expand to a single linear timeline. Follow the roadmap.\n"
    "- If a staff has 2 voices (stems up + stems down), emit BOTH voices as separate notes.\n\n"
    "CHORD-NAME DETECTION:\n"
    "- Also detect the harmonic chord progression. Output at most 24 chord names for this page.\n"
    "- Chord names use standard pop/jazz notation: 'Cmaj', 'Am', 'G7', 'F/A', 'Dm7', 'Csus4', 'Bdim'.\n"
    "- One chord per beat position where the harmony CHANGES (not per beat).\n\n"
    "OUTPUT FORMAT — return ONLY a JSON object, no prose, no markdown fences:\n"
    "{\n"
    '  "tempo_bpm": <int, extract from tempo marking or metronome; use 100 if absent>,\n'
    '  "time_signature": "4/4",\n'
    '  "key_signature": "C major",\n'
    '  "beats_per_page": <total beats present on THIS page>,\n'
    '  "notes": [\n'
    '    {"midi": <21-108>, "beat": <float, beats from start of THIS page>, "beats_duration": <float>, "hand": "right"|"left", "velocity": <0.3-1.0>}\n'
    '  ],\n'
    '  "chords": [\n'
    '    {"beat": <float>, "name": <string like "Cmaj">}\n'
    '  ]\n'
    "}\n\n"
    "MIDI PITCH REFERENCE:\n"
    "- C4 = 60 (middle C). D4=62, E4=64, F4=65, G4=67, A4=69, B4=71.\n"
    "- Treble clef staff: bottom line E4=64, top line F5=77.\n"
    "- Bass clef staff: bottom line G2=43, top line A3=57.\n"
    "- One octave up = +12 semitones. Sharps add 1, flats subtract 1.\n\n"
    "BE THOROUGH — every notehead counts. Missing notes is worse than mis-classifying hands.\n"
    "If a note is ambiguous (no clear clef context), place MIDI ≥ 60 on right-hand, MIDI < 60 on left-hand."
)


def _enhance_for_omr(img):
    """Boost contrast + sharpness so notation is easier for Vision to read."""
    from PIL import ImageEnhance, ImageOps
    # Autocontrast normalizes histogram (helps scanned pages with faded ink)
    img = ImageOps.autocontrast(img, cutoff=1)
    img = ImageEnhance.Contrast(img).enhance(1.35)
    img = ImageEnhance.Sharpness(img).enhance(1.5)
    return img


def pdf_to_page_images(pdf_bytes: bytes) -> List[bytes]:
    """Convert each page of a PDF to a PNG image (bytes). Returns up to MAX_SHEET_PAGES.

    Renders at ~225 DPI (3.0x fitz matrix) for high OMR fidelity, then applies
    contrast + sharpness enhancement so noteheads, stems, and accidentals are crisp.
    """
    import fitz  # PyMuPDF
    from PIL import Image
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images: List[bytes] = []
    try:
        matrix = fitz.Matrix(3.0, 3.0)  # ~225 DPI
        for i, page in enumerate(doc):
            if i >= MAX_SHEET_PAGES:
                break
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            img = _enhance_for_omr(img)
            # Cap the longest side at 2400px to keep Vision payload reasonable
            max_side = 2400
            if max(img.size) > max_side:
                scale = max_side / max(img.size)
                new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
                img = img.resize(new_size, Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="PNG", optimize=True)
            images.append(buf.getvalue())
    finally:
        doc.close()
    return images


def normalize_image_bytes(raw: bytes, mime: str) -> tuple[bytes, str]:
    """Ensure image is PNG/JPEG/WEBP. Convert exotic formats to PNG.
    Also runs the OMR pre-processing pipeline (autocontrast + sharpness).
    Returns (bytes, mime).
    """
    from PIL import Image
    try:
        img = Image.open(io.BytesIO(raw))
        if getattr(img, "is_animated", False):
            img.seek(0)
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        img = _enhance_for_omr(img)
        max_side = 2400
        if max(img.size) > max_side:
            scale = max_side / max(img.size)
            new_size = (int(img.size[0] * scale), int(img.size[1] * scale))
            img = img.resize(new_size, Image.LANCZOS)
        buf = io.BytesIO()
        # Prefer PNG (lossless) so notation stays crisp — even if input was JPEG
        img.save(buf, format="PNG", optimize=True)
        return buf.getvalue(), "image/png"
    except Exception:
        # Fallback: return original bytes if pre-processing fails
        return raw, mime if mime in SHEET_IMAGE_MIME else "image/png"


async def sheet_page_to_notes(image_bytes: bytes, mime: str, page_idx: int, api_key: str, extract_json: Callable[[str], dict]) -> dict:
    """Send one page image to Claude Sonnet 4.6 vision and get structured note events (beat-based)."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    image_content = ImageContent(image_base64=image_b64)

    chat = LlmChat(
        api_key=api_key,
        session_id=f"sheet-page-{uuid.uuid4()}",
        system_message=SHEET_MUSIC_SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-6")

    user = UserMessage(
        text=f"Extract every note on this sheet music page (page {page_idx + 1}). Return JSON only.",
        file_contents=[image_content],
    )
    response_text = await chat.send_message(user)
    parsed = extract_json(response_text or "")
    if not parsed or not isinstance(parsed.get("notes"), list):
        return {"tempo_bpm": 100, "time_signature": "4/4", "key_signature": "C major", "beats_per_page": 0, "notes": []}
    return parsed


def stitch_pages(pages: List[dict]) -> dict:
    """Convert per-page beat-timed notes into a single time-ordered song using the first page's tempo.
    Also stitches chord markers with cumulative time offsets.
    """
    if not pages:
        return {"tempo_bpm": 100, "notes": [], "duration": 1.0, "chords": []}

    tempo_bpm = 100
    time_signature = "4/4"
    key_signature = "C major"
    for p in pages:
        try:
            t = int(p.get("tempo_bpm") or 0)
            if 30 <= t <= 240:
                tempo_bpm = t
                time_signature = p.get("time_signature") or time_signature
                key_signature = p.get("key_signature") or key_signature
                break
        except Exception:
            pass

    beat_seconds = 60.0 / max(30, min(240, tempo_bpm))

    all_notes: List[dict] = []
    all_chords: List[dict] = []
    beat_cursor = 0.0

    for p in pages:
        page_notes = p.get("notes") or []
        page_chords = p.get("chords") or []
        page_beats = 0.0
        for n in page_notes:
            try:
                midi = int(n.get("midi"))
                beat = float(n.get("beat", 0))
                dur_beats = float(n.get("beats_duration", 1))
                hand = n.get("hand") or ("right" if midi >= 60 else "left")
                vel = float(n.get("velocity", 0.8))
            except Exception:
                continue
            if midi < 21 or midi > 108:
                continue
            time_s = (beat_cursor + beat) * beat_seconds
            dur_s = max(0.05, dur_beats * beat_seconds)
            all_notes.append({
                "midi": midi,
                "time": time_s,
                "duration": dur_s,
                "velocity": max(0.3, min(1.0, vel)),
                "hand": "left" if hand == "left" else "right",
            })
            page_beats = max(page_beats, beat + dur_beats)
        for c in page_chords:
            try:
                cb = float(c.get("beat", 0))
                name = str(c.get("name", "")).strip()
                if not name:
                    continue
                all_chords.append({"time": (beat_cursor + cb) * beat_seconds, "name": name[:12]})
            except Exception:
                continue
        try:
            declared = float(p.get("beats_per_page") or 0)
        except Exception:
            declared = 0
        beat_cursor += max(page_beats, declared)

    all_notes.sort(key=lambda x: (x["time"], x["midi"]))
    all_chords.sort(key=lambda c: c["time"])
    duration = max((n["time"] + n["duration"] for n in all_notes), default=1.0) + 1.0

    return {
        "tempo_bpm": tempo_bpm,
        "time_signature": time_signature,
        "key_signature": key_signature,
        "notes": all_notes,
        "chords": all_chords,
        "duration": duration,
    }
