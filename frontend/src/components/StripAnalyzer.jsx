import React, { useEffect, useRef, useState } from "react";

class EdgeImpulseClassifier {
  constructor(module) {
    this._module = module;
    this._initialized = false;
  }

  init() {
    return new Promise((resolve) => {
      if (this._initialized) return resolve();
      this._module.onRuntimeInitialized = () => {
        this._initialized = true;
        resolve();
      };
      if (this._module.calledRun) {
        this._initialized = true;
        resolve();
      }
    });
  }

  getProperties() {
    return this._module.get_properties();
  }

  classify(rawData) {
    if (!this._initialized) throw new Error("Module is not initialized");

    const module = this._module;
    const typedArray = new Float32Array(rawData);
    const ptr = module._malloc(typedArray.length * 4);
    module.HEAPU8.set(new Uint8Array(typedArray.buffer), ptr);

    const ret = module.run_classifier(ptr, typedArray.length, false);
    module._free(ptr);

    if (ret.result !== 0) throw new Error("Classification failed");

    let jsResult = { anomaly: ret.anomaly, results: [] };

    for (let i = 0; i < ret.size(); i++) {
      let c = ret.get(i);
      jsResult.results.push({
        label: c.label,
        value: c.value,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height
      });
      c.delete();
    }

    ret.delete();
    return jsResult;
  }
}

export default function StripAnalyzer({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [classifier, setClassifier] = useState(null);
  const [modelDims, setModelDims] = useState({ width: 96, height: 96 });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const backendURL = "https://kaelion-ai.onrender.com/analyze";

  // ----------------------------
  // LOAD FOMO WASM
  // ----------------------------
  useEffect(() => {
    if (typeof window === "undefined") return; // SSR guard

    async function loadWasm() {
      try {
        window.Module = {
          locateFile: () => "/ei-wasm/edge-impulse-standalone.wasm",
        };

        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = `/ei-wasm/edge-impulse-standalone.js?v=${Date.now()}`;
          script.onload = resolve;
          script.onerror = () => reject("Failed to load WASM");
          document.body.appendChild(script);
        });

        const clf = new EdgeImpulseClassifier(window.Module);
        await clf.init();

        const props = clf.getProperties();
        setModelDims({ width: props.input_width, height: props.input_height });

        setClassifier(clf);
        setIsLoading(false);
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to load model");
        setIsLoading(false);
      }
    }

    loadWasm();
  }, []);

  // ----------------------------
  // START CAMERA
  // ----------------------------
  useEffect(() => {
    if (!classifier) return;

    async function startCam() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current.play();
        }
      } catch (err) {
        setErrorMsg("Camera blocked");
      }
    }

    startCam();
  }, [classifier]);

  // ----------------------------
  // MAIN FRAME LOOP
  // ----------------------------
  useEffect(() => {
    if (!classifier) return;

    let req;
    let lastSent = 0;

    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // 🔥 FIX: ensure DOM exists before using it
      if (!video || !canvas) {
        req = requestAnimationFrame(loop);
        return;
      }

      if (video.readyState !== 4) {
        req = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext("2d");

      // sync canvas to video safely
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const minDim = Math.min(canvas.width, canvas.height);
      const sx = (canvas.width - minDim) / 2;
      const sy = (canvas.height - minDim) / 2;

      const W = modelDims.width;
      const H = modelDims.height;

      const tmp = document.createElement("canvas");
      tmp.width = W;
      tmp.height = H;

      const tctx = tmp.getContext("2d");
      tctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, W, H);

      const img = tctx.getImageData(0, 0, W, H);
      const features = [];

      for (let i = 0; i < img.data.length; i += 4) {
        const r = img.data[i];
        const g = img.data[i + 1];
        const b = img.data[i + 2];
        features.push((r << 16) | (g << 8) | b);
      }

      // run FOMO inference
      const result = classifier.classify(features);

      if (result.results?.length > 0) {
        result.results.forEach(det => {
          if (det.value > 0.5) {
            drawCircle(ctx, det, minDim, sx, sy);

            const now = Date.now();
            if (now - lastSent > 2000 && det.label === "urine_strip") {
              sendToBackend(det);
              lastSent = now;
            }
          }
        });
      }

      req = requestAnimationFrame(loop);
    };

    req = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(req);
  }, [classifier, modelDims]);

  // ----------------------------
  // DRAW FOMO MARKER (CIRCLE)
  // ----------------------------
  function drawCircle(ctx, det, cropSize, sx, sy) {
    const factor = cropSize / modelDims.width;
    const cx = det.x * factor + sx;
    const cy = det.y * factor + sy;

    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "lime";
    ctx.stroke();

    ctx.fillStyle = "lime";
    ctx.font = "bold 16px Arial";
    ctx.fillText(`${det.label} ${Math.round(det.value * 100)}%`, cx + 25, cy);
  }

  async function sendToBackend(det) {
    try {
      await fetch(backendURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detection: det }),
      });
      if (onResult) onResult({ detection: det });
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg max-w-md mx-auto relative">
      <h4 className="font-semibold mb-3">Strip Analyzer</h4>

      {errorMsg && <p className="text-red-500 text-sm">{errorMsg}</p>}

      <div className="relative bg-black rounded-xl overflow-hidden min-h-[260px] border">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            Loading FOMO...
          </div>
        )}

        <video ref={videoRef} className="hidden" playsInline autoPlay muted />
        <canvas ref={canvasRef} className="w-full h-full object-contain" />
      </div>

      <p className="text-xs text-gray-500 text-center mt-2">
        Keep the strip centered for better detection.
      </p>
    </div>
  );
}
