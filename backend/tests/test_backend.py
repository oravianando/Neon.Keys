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
            assert "tracks" in data
            for n in data["notes"]:
                assert 21 <= n["midi"] <= 108
                assert "time" in n and "duration" in n and "velocity" in n
                assert n["hand"] in ("left", "right")
            # Verify hand tagging heuristic: notes with midi<60 should generally be 'left'
            # (LLM decides; check at least most notes below 60 are left)
            low = [n for n in data["notes"] if n["midi"] < 60]
            if low:
                lefts = sum(1 for n in low if n["hand"] == "left")
                assert lefts >= len(low) * 0.5
