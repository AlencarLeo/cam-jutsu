import { useEffect, useRef } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandLandmarkerResult } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function mirror(resultado: HandLandmarkerResult) {
    return {
      landmarks: resultado.landmarks.map((mao) =>
        mao.map((p) => ({ ...p, x: 1 - p.x })),
      ),
      lados: resultado.handedness.map((h) =>
        h[0].categoryName === "Left" ? "Right" : "Left",
      ),
    };
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationId = 0;
    let cancelled = false;

    async function start() {
      // 1. Start the camera
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (cancelled) return;

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // 2. Match canvas size to video size
      const canvas = canvasRef.current!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;

      // 3. Load MediaPipe hand detector
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const detector = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
      if (cancelled) return;

      // 4. Detect and draw on every frame
      let lastVideoTime = -1;

      function loop() {
        if (cancelled) return;

        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          
          const result = mirror(detector.detectForVideo(video, performance.now()));

          // Clear previous frame
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw a dot on each landmark
          for (const hand of result.landmarks) {
            for (const point of hand) {
              const x = point.x * canvas.width; // normalized (0–1) → pixels
              const y = point.y * canvas.height;

              ctx.beginPath();
              ctx.arc(x, y, 5, 0, Math.PI * 2);
              ctx.fillStyle = "#ff5500";
              ctx.fill();
            }
          }
        }

        animationId = requestAnimationFrame(loop);
      }

      loop();
    }

    start().catch(console.error);

    // Cleanup when the component unmounts
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", transform: "scaleX(-1)" }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
