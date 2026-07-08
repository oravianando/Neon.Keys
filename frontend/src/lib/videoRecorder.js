import * as Tone from "tone";

/*
  createVideoRecorder(canvas, options) → recorder
    - canvas: HTMLCanvasElement to capture
    - options:
        fps: number (default 30)
        bitrate: number (target average bits per second; also acts as peak for CBR)
        bitrateMode: "constant" | "variable" (default "constant")
          → "variable" enables VBR encoding (smaller files for scenes with flat colors,
             larger for busy scenes). Passed as a hint to MediaRecorder — browsers that
             ignore the hint still benefit from a reduced average target bitrate.
        mimeType: optional preferred mime type
  Returns: { start(), stop() → Promise<Blob>, mimeType, fileExtension }

  Also captures Tone.js audio destination as an audio track so the produced
  video contains synced piano audio.
*/
export function createVideoRecorder(
  canvas,
  { fps = 30, bitrate = 5_000_000, bitrateMode = "constant" } = {},
) {
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
  // For VBR, target ~60% of the stated bitrate as the average; encoder will spike
  // higher for busy frames and lower for flat frames. Also pass the non-standard
  // `bitrateMode: "variable"` hint which Chromium respects.
  const wantVbr = bitrateMode === "variable";
  const targetBps = wantVbr ? Math.round(bitrate * 0.6) : bitrate;
  const recOpts = mimeType
    ? { mimeType, videoBitsPerSecond: targetBps }
    : { videoBitsPerSecond: targetBps };
  if (wantVbr) recOpts.bitrateMode = "variable";
  const rec = new MediaRecorder(videoStream, recOpts);
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
