import * as Tone from "tone";

/*
  createVideoRecorder(canvas, options) → recorder
    - canvas: HTMLCanvasElement to capture
    - options: { fps, mimeType }
  Returns: { start(), stop() → Promise<Blob> }

  Also captures Tone.js audio destination as an audio track so the produced
  video contains synced piano audio.
*/
export function createVideoRecorder(canvas, { fps = 30, bitrate = 5_000_000 } = {}) {
  const videoStream = canvas.captureStream(fps);

  // Attach audio from Tone
  let audioDest = null;
  try {
    const rawCtx = Tone.getContext().rawContext;
    audioDest = rawCtx.createMediaStreamDestination();
    Tone.getDestination().connect(audioDest);
    const audioTrack = audioDest.stream.getAudioTracks()[0];
    if (audioTrack) videoStream.addTrack(audioTrack);
  } catch (e) {
    console.warn("Could not attach audio to recording", e);
  }

  // Prefer mp4 if supported; else webm
  const candidates = [
    "video/mp4;codecs=avc1.42E01F,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  let mimeType = "";
  for (const t of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(t)) {
      mimeType = t;
      break;
    }
  }
  const rec = new MediaRecorder(videoStream, mimeType ? { mimeType, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate });
  const chunks = [];
  rec.ondataavailable = (e) => e.data && e.data.size > 0 && chunks.push(e.data);

  let stopResolve;
  const stoppedPromise = new Promise((r) => (stopResolve = r));
  rec.onstop = () => {
    // Cleanup: disconnect audio dest
    try { if (audioDest) Tone.getDestination().disconnect(audioDest); } catch (e) { /* ignore */ }
    videoStream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    stopResolve(blob);
  };

  return {
    mimeType: mimeType || "video/webm",
    fileExtension: (mimeType || "").includes("mp4") ? "mp4" : "webm",
    start() {
      rec.start(1000);
    },
    async stop() {
      if (rec.state !== "inactive") rec.stop();
      return stoppedPromise;
    },
    isRecording: () => rec.state === "recording",
  };
}
