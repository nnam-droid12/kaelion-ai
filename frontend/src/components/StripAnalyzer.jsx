import React, { useEffect, useRef, useState } from "react";

export default function StripAnalyzer({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [runner, setRunner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const backendURL = "https://kaelion-ai.onrender.com/analyze";

  // --------------------------
  // Load Edge Impulse Model
  // --------------------------
 useEffect(() => {
  const loadModel = async () => {
    try {
      // Dynamically load the JS file
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/ei-wasm/edge-impulse-standalone.js";
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
      });

     
      const mod = await window.EdgeImpulse.load("/ei-wasm/edge-impulse-standalone.wasm");
      const r = await mod.createRunner();
      await r.init();

      setRunner(r);
    } catch (e) {
      console.error("EI Load Error:", e);
    }
  };

  loadModel();
}, []);

  // --------------------------
  // Start Camera
  // --------------------------
  useEffect(() => {
    if (!runner) return;

    const startCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setIsLoading(false);
    };

    startCamera();
  }, [runner]);

  // --------------------------
  // Frame-by-frame inference
  // --------------------------
  useEffect(() => {
    if (!runner) return;

    const processFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      const W = runner.inputWidth;
      const H = runner.inputHeight;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Resize frame to model input size
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = W;
      tempCanvas.height = H;
      const tctx = tempCanvas.getContext("2d");
      tctx.drawImage(video, 0, 0, W, H);

      const imageData = tctx.getImageData(0, 0, W, H);

      const result = await runner.classify(imageData);

      // Clear canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (result?.results?.length > 0) {
        result.results.forEach((det) => {
          drawBoundingBox(ctx, det, canvas.width, canvas.height);

          if (det.label === "urine_strip" && det.confidence > 0.6) {
            sendToBackend(det);
          }
        });
      }

      requestAnimationFrame(processFrame);
    };

    requestAnimationFrame(processFrame);
  }, [runner]);

  // --------------------------
  // Draw bounding box
  // --------------------------
  const drawBoundingBox = (ctx, det, cw, ch) => {
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 3;
    ctx.font = "16px Arial";
    ctx.fillStyle = "lime";

    const scaleX = cw / runner.inputWidth;
    const scaleY = ch / runner.inputHeight;

    const x = det.x * scaleX;
    const y = det.y * scaleY;
    const w = det.width * scaleX;
    const h = det.height * scaleY;

    ctx.strokeRect(x, y, w, h);
    ctx.fillText(`${det.label} (${Math.round(det.confidence * 100)}%)`, x + 4, y - 6);
  };

  // --------------------------
  // Send detection to backend 
  // --------------------------
  const sendToBackend = async (detection) => {
    try {
      const response = await fetch(backendURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detection }),
      });

      const data = await response.json();
      onResult && onResult(data);
    } catch (e) {
      console.error("Backend Error:", e);
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg max-w-md mx-auto">
      <h4 className="font-semibold mb-3">Strip Analyzer</h4>

      {isLoading ? (
        <div className="text-center text-gray-500">Loading model & camera…</div>
      ) : (
        <>
          <video ref={videoRef} className="hidden" />
          <canvas ref={canvasRef} className="w-full rounded-xl border shadow" />
        </>
      )}
    </div>
  );
}
