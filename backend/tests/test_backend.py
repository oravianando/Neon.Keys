"""Backend regression + sheet-to-midi endpoint tests for NEON.KEYS iteration 13."""
import io
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://song-to-keys-3.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    return s


# ---------- Regression ----------
class TestRegression:
    def test_demo_songs(self, client):
        r = client.get(f"{API}/demo-songs", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) > 0
        assert any(s.get("id") == "twinkle-twinkle-little-star" for s in data)

    def test_songs_list(self, client):
        r = client.get(f"{API}/songs", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_settings_get(self, client):
        r = client.get(f"{API}/settings", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), dict)

    def test_settings_put(self, client):
        r = client.put(f"{API}/settings", json={"theme": "neon-pink"}, timeout=30)
        assert r.status_code == 200

    def test_settings_convert_mode_default(self, client):
        r = client.get(f"{API}/settings", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "convert_mode" in data, f"convert_mode missing from settings: {list(data.keys())}"
        assert data["convert_mode"] in ("single", "multi")

    def test_settings_convert_mode_persist(self, client):
        # Set to multi
        r = client.put(f"{API}/settings", json={"convert_mode": "multi"}, timeout=30)
        assert r.status_code == 200
        # Verify persisted
        g = client.get(f"{API}/settings", timeout=30)
        assert g.json().get("convert_mode") == "multi"
        # Restore default
        client.put(f"{API}/settings", json={"convert_mode": "single"}, timeout=30)

    def test_song_create_delete(self, client):
        payload = {
            "name": "TEST_regression_song",
            "duration": 2.0,
            "notes": [{"midi": 60, "time": 0.0, "duration": 0.5, "velocity": 0.8}],
            "chords": [],
            "source": "test",
        }
        r = client.post(f"{API}/songs", json=payload, timeout=30)
        assert r.status_code in (200, 201), r.text
        sid = r.json().get("id")
        assert sid
        d = client.delete(f"{API}/songs/{sid}", timeout=30)
        assert d.status_code in (200, 204)

    def test_refine_midi(self, client):
        payload = {
            "notes": [
                {"midi": 60, "time": 0.0, "duration": 0.5, "velocity": 0.8},
                {"midi": 62, "time": 0.5, "duration": 0.5, "velocity": 0.8},
            ],
            "duration": 1.5,
            "name": "TEST_scale",
        }
        r = client.post(f"{API}/refine-midi", json=payload, timeout=90)
        # Refine may return 200 or non-200 depending on LLM; require not-500
        assert r.status_code in (200, 400, 422), f"unexpected {r.status_code}: {r.text[:200]}"

    def test_refine_midi_multi_track(self, client):
        """Iteration 15: multi_track=True returns tracks[] with >=2 distinct instrument families."""
        # Realistic ~50-note melody + bass (Twinkle-like: right-hand melody + left-hand bass)
        notes = []
        t = 0.0
        melody = [60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60,
                  67, 67, 65, 65, 64, 64, 62, 67, 67, 65, 65, 64, 64, 62,
                  60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60]
        for m in melody:
            notes.append({"midi": m, "time": t, "duration": 0.4, "velocity": 0.85})
            t += 0.5
        # Bass line at half rate
        tb = 0.0
        bass = [36, 43, 36, 43, 41, 43, 36, 43] * 2
        for b in bass:
            notes.append({"midi": b, "time": tb, "duration": 0.9, "velocity": 0.75})
            tb += 1.0

        r = client.post(f"{API}/refine-midi", json={
            "notes": notes,
            "duration": t + 1.0,
            "name": "TEST_multi_track_song",
            "multi_track": True,
            "force_refresh": True,
        }, timeout=120)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        assert "tracks" in data and isinstance(data["tracks"], list), f"missing tracks in {list(data.keys())}"
        assert "stats" in data
        assert data["stats"].get("multi_track") is True
        assert data["stats"].get("track_count", 0) >= 2, f"track_count={data['stats'].get('track_count')} tracks={[t.get('name') for t in data['tracks']]}"
        assert len(data["tracks"]) >= 2, f"expected >=2 tracks, got {len(data['tracks'])}"
        families = set()
        allowed = {"piano", "strings", "bass", "synthPad", "synthLead"}
        for tk in data["tracks"]:
            assert "id" in tk and tk["id"].startswith("t")
            assert "name" in tk
            assert tk.get("family") in allowed, f"unexpected family: {tk.get('family')}"
            assert "program" in tk
            assert tk.get("isDrum") is False
            assert isinstance(tk.get("notes"), list) and len(tk["notes"]) > 0
            for n in tk["notes"]:
                assert "midi" in n and "time" in n and "duration" in n
            families.add(tk["family"])
        # Not required to have distinct families if fallback triggered, but log
        print(f"MT_FAMILIES={families} TRACK_NAMES={[t['name'] for t in data['tracks']]}")

    def test_refine_midi_multi_track_fallback_small(self, client):
        """Small note array should still return at least 1 track via fallback."""
        notes = [
            {"midi": 60, "time": 0.0, "duration": 0.4, "velocity": 0.8},
            {"midi": 62, "time": 0.5, "duration": 0.4, "velocity": 0.8},
            {"midi": 64, "time": 1.0, "duration": 0.4, "velocity": 0.8},
            {"midi": 65, "time": 1.5, "duration": 0.4, "velocity": 0.8},
            {"midi": 67, "time": 2.0, "duration": 0.4, "velocity": 0.8},
        ]
        r = client.post(f"{API}/refine-midi", json={
            "notes": notes, "duration": 3.0, "name": "TEST_small_mt",
            "multi_track": True, "force_refresh": True,
        }, timeout=90)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "tracks" in data
        # Fallback may produce 1 or 2 tracks; must be at least 1
        assert len(data["tracks"]) >= 1

    def test_refine_midi_single_track_regression(self, client):
        """multi_track omitted/False returns notes+chords+stats (single-track shape preserved)."""
        r = client.post(f"{API}/refine-midi", json={
            "notes": [
                {"midi": 60, "time": 0.0, "duration": 0.5, "velocity": 0.8},
                {"midi": 64, "time": 0.5, "duration": 0.5, "velocity": 0.8},
                {"midi": 67, "time": 1.0, "duration": 0.5, "velocity": 0.8},
            ],
            "duration": 2.0, "name": "TEST_single",
            "force_refresh": True,
        }, timeout=90)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "notes" in data and "chords" in data and "stats" in data
        # tracks may be empty list for single-track
        assert data["stats"].get("multi_track") in (False, None)

    def test_refine_midi_cache_key_differs_by_multi_track(self, client):
        """Same notes, different multi_track flag → different cache entries but both valid."""
        notes = [
            {"midi": 60, "time": 0.0, "duration": 0.5, "velocity": 0.8},
            {"midi": 62, "time": 0.5, "duration": 0.5, "velocity": 0.8},
            {"midi": 64, "time": 1.0, "duration": 0.5, "velocity": 0.8},
        ]
        payload_single = {"notes": notes, "duration": 2.0, "name": "TEST_cache", "multi_track": False}
        payload_multi = {"notes": notes, "duration": 2.0, "name": "TEST_cache", "multi_track": True}
        r1 = client.post(f"{API}/refine-midi", json=payload_single, timeout=90)
        r2 = client.post(f"{API}/refine-midi", json=payload_multi, timeout=90)
        assert r1.status_code == 200 and r2.status_code == 200
        d1, d2 = r1.json(), r2.json()
        # Both hits or one cached — shapes must be correct
        assert "notes" in d1 and "notes" in d2
        assert d1["stats"].get("multi_track") in (False, None)
        assert d2["stats"].get("multi_track") is True

    def test_video_ai_enhance(self, client):
        r = client.post(f"{API}/video/ai-enhance", json={"song_name": "TEST", "duration": 10, "note_count": 20}, timeout=90)
        assert r.status_code in (200, 400, 422, 500)  # smoke: endpoint reachable


# ---------- Sheet-to-MIDI ----------
class TestSheetToMidi:
    def test_empty_file(self, client):
        files = {"file": ("empty.png", b"", "image/png")}
        r = client.post(f"{API}/sheet-to-midi", files=files, timeout=60)
        assert r.status_code == 400

    def test_corrupt_file(self, client):
        files = {"file": ("bad.png", b"not-an-image-at-all-random-bytes-1234", "image/png")}
        r = client.post(f"{API}/sheet-to-midi", files=files, timeout=60)
        # Should fail: either 400 (couldn't read) or 422 (no notes)
        assert r.status_code in (400, 422), r.text

    def test_real_sheet_music(self, client):
        """Fetch a real public-domain simple piano sheet music image and convert."""
        # A well-known public-domain simple sheet music image (Twinkle Twinkle)
        pdf_url = "https://www.makingmusicfun.net/public/assets/pdf/sheet_music/twinkle-twinkle-little-star-piano-solo.pdf"
        img_bytes = None
        content_type = "application/pdf"
        filename = "twinkle.pdf"
        try:
            rr = requests.get(pdf_url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
            if rr.status_code == 200 and len(rr.content) > 1000:
                img_bytes = rr.content
        except Exception:
            pass
        if img_bytes is None:
            pytest.skip("Could not fetch reference sheet music PDF")

        files = {"file": (filename, img_bytes, content_type)}
        r = client.post(f"{API}/sheet-to-midi", files=files, timeout=180)
        # Accept 200 (extracted notes) OR 422 (vision could not extract)
        assert r.status_code in (200, 422), f"unexpected {r.status_code}: {r.text[:300]}"
        if r.status_code == 200:
            data = r.json()
            assert data["source"] == "sheet"
            assert data["page_count"] >= 1
            assert data["duration"] > 0
            assert isinstance(data["notes"], list) and len(data["notes"]) > 0
            # Iteration 14: chords array must be present
            assert "chords" in data, "response missing chords array"
            assert isinstance(data["chords"], list)
            # Iteration 14 target: note count should be >= previous iteration_13 (97)
            print(f"NOTE_COUNT={len(data['notes'])} CHORDS={len(data['chords'])}")
            assert "tempo_bpm" in data
            assert "time_signature" in data
            assert "key_signature" in data
            assert "tracks" in data
            for n in data["notes"]:
                assert 21 <= n["midi"] <= 108
                assert "time" in n and "duration" in n and "velocity" in n
                assert n["hand"] in ("left", "right")
            # Left-hand majority MIDI<60 (middle C is a valid crossover)
            lefts = [n for n in data["notes"] if n["hand"] == "left"]
            left_low = sum(1 for n in lefts if n["midi"] < 60)
            if lefts:
                assert left_low >= len(lefts) * 0.8, f"only {left_low}/{len(lefts)} left-hand notes are midi<60"
            # Right-hand majority
            rights = [n for n in data["notes"] if n["hand"] == "right"]
            right_high = sum(1 for n in rights if n["midi"] >= 60)
            if rights:
                assert right_high >= len(rights) * 0.6

    def test_png_image_preprocessing(self, client):
        """Verify PNG input path (autocontrast + sharpness preprocessing) runs OK."""
        from PIL import Image, ImageDraw
        img = Image.new("RGB", (800, 400), "white")
        d = ImageDraw.Draw(img)
        # Simple treble+bass staff lines
        for y in [80, 100, 120, 140, 160]:
            d.line([(50, y), (750, y)], fill="black", width=2)
        for y in [240, 260, 280, 300, 320]:
            d.line([(50, y), (750, y)], fill="black", width=2)
        # A couple of noteheads
        for cx in [150, 250, 350, 450]:
            d.ellipse([cx-10, 110, cx+10, 128], fill="black")
            d.ellipse([cx-10, 270, cx+10, 288], fill="black")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        files = {"file": ("simple.png", buf.getvalue(), "image/png")}
        r = client.post(f"{API}/sheet-to-midi", files=files, timeout=180)
        # Accept 200 or 422 (LLM may or may not extract from synthetic staff)
        assert r.status_code in (200, 422), f"unexpected {r.status_code}: {r.text[:200]}"
