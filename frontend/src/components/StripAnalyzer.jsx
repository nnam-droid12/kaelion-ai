import React, { useEffect, useRef, useState } from "react";

export default function StripAnalyzer({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [runner, setRunner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  const backendURL = "https://kaelion-ai.onrender.com/analyze";

  // --------------------------
  // 1. Load Model (Dynamic Import Strategy)
  // --------------------------
  useEffect(() => {
    const initModel = async () => {
      try {
        console.log("Attempting to load Edge Impulse module...");

       
        let EdgeImpulse = window.EdgeImpulse;

      
        if (!EdgeImpulse) {
            try {
             
                const module = await import(/* @vite-ignore */ "/ei-wasm/edge-impulse-standalone.js");
                
              
                EdgeImpulse = module.default || module;
                
             
                if (!EdgeImpulse && window.EdgeImpulse) {
                    EdgeImpulse = window.EdgeImpulse;
                }
            } catch (importErr) {
                console.warn("Dynamic import failed, falling back to script injection", importErr);
            }
        }

     
        if (!EdgeImpulse) {
             await new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "/ei-wasm/edge-impulse-standalone.js";
                script.onload = () => {
                    if (window.EdgeImpulse) resolve();
                    else reject(new Error("Script loaded but EdgeImpulse object missing"));
                };
                script.onerror = reject;
                document.body.appendChild(script);
             });
             EdgeImpulse = window.EdgeImpulse;
        }

        if (!EdgeImpulse) {
            throw new Error("Could not load Edge Impulse library. Check file content.");
        }

        console.log("Library loaded. Initializing WASM...");
        
      
        const mod = await EdgeImpulse.load("/ei-wasm/edge-impulse-standalone.wasm");
        const r = await mod.createRunner();
        await r.init();

        console.log("Runner initialized successfully!");
        setRunner(r);
      } catch (e) {
        console.error("Initialization Error:", e);
        setErrorMsg(`Error: ${e.message || "Failed to load model"}`);
        setIsLoading(false);
      }
    };

    initModel();
  }, []);

  // --------------------------
  // 2. Start Camera
  // --------------------------
  useEffect(() => {
    if (!runner) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: "environment",
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play();
            setIsLoading(false);
          };
        }
      } catch (e) {
        console.error("Camera Error:", e);
        setErrorMsg("Camera permission denied.");
        setIsLoading(false);
      }
    };

    startCamera();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [runner]);

  // --------------------------
  // 3. Inference Loop
  // --------------------------
  useEffect(() => {
    if (!runner || isLoading) return;

    let reqId;
    let lastSent = 0;

    const processFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (!video || !canvas || video.readyState !== 4) {
        reqId = requestAnimationFrame(processFrame);
        return;
      }

      const ctx = canvas.getContext("2d");
      
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const W = runner.inputWidth;
      const H = runner.inputHeight;
      
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = W;
      tempCanvas.height = H;
      const tctx = tempCanvas.getContext("2d");
      tctx.drawImage(video, 0, 0, W, H);

      const imageData = tctx.getImageData(0, 0, W, H);

      try {
        const result = await runner.classify(imageData);

        if (result?.results?.length > 0) {
          result.results.forEach((det) => {
            drawBoundingBox(ctx, det, canvas.width, canvas.height);

            if (det.label === "urine_strip" && det.confidence > 0.6) {
              const now = Date.now();
            
              if (now - lastSent > 2500) { 
                sendToBackend(det);
                lastSent = now;
              }
            }
          });
        }
      } catch (err) {
        console.error(err);
      }

      reqId = requestAnimationFrame(processFrame);
    };

    reqId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(reqId);
  }, [runner, isLoading]);

  const drawBoundingBox = (ctx, det, cw, ch) => {
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#00FF00";

    const scaleX = cw / runner.inputWidth;
    const scaleY = ch / runner.inputHeight;

    ctx.strokeRect(det.x * scaleX, det.y * scaleY, det.width * scaleX, det.height * scaleY);
    ctx.fillText(`${det.label} ${Math.round(det.confidence * 100)}%`, det.x * scaleX, (det.y * scaleY) - 5);
  };

  const sendToBackend = async (detection) => {
    console.log("Detected:", detection);
    try {
      const response = await fetch(backendURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detection }),
      });
      const data = await response.json();
      if(onResult) onResult(data);
    } catch (e) {
      console.error("Backend Error:", e);
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg max-w-md mx-auto relative">
      <h4 className="font-semibold mb-3">Strip Analyzer</h4>

      {errorMsg ? (
        <div className="bg-red-50 text-red-600 p-3 rounded text-sm mb-2">{errorMsg}</div>
      ) : isLoading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="text-blue-600 font-medium">Starting AI...</div>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="w-full rounded-xl border bg-black min-h-[200px]" />
    </div>
  );
}