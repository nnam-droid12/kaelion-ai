import React, { useEffect, useRef, useState } from "react";

export default function StripAnalyzer({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [runner, setRunner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const backendURL = "https://kaelion-ai.onrender.com/analyze";

  // --------------------------
  // 1. Initialize Edge Impulse
  // --------------------------
  useEffect(() => {
    const initModel = async () => {
    
      if (!window.EdgeImpulse) {
        console.error("Edge Impulse script not loaded in index.html");
        return;
      }

      try {
      
        const mod = await window.EdgeImpulse.load("/ei-wasm/edge-impulse-standalone.wasm");
        const r = await mod.createRunner();
        await r.init();
        
        console.log("Model loaded successfully");
        setRunner(r);
      } catch (e) {
        console.error("EI Init Error:", e);
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
            width: { ideal: 640 }, // Lower resolution helps FPS
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

    let requestAnimationFrameId;

    const processFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

     
      if (!video || !canvas || video.readyState !== 4) {
        requestAnimationFrameId = requestAnimationFrame(processFrame);
        return;
      }

      const ctx = canvas.getContext("2d");
      const W = runner.inputWidth;
      const H = runner.inputHeight;

    
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

     
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
              
              sendToBackend(det);
            }
          });
        }
      } catch (err) {
        console.warn("Inference error:", err);
      }

      requestAnimationFrameId = requestAnimationFrame(processFrame);
    };

    requestAnimationFrameId = requestAnimationFrame(processFrame);

    return () => cancelAnimationFrame(requestAnimationFrameId);
  }, [runner, isLoading]);

  // --------------------------
  // Helper: Draw Box
  // --------------------------
  const drawBoundingBox = (ctx, det, cw, ch) => {
    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 4;
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#00FF00";

    const scaleX = cw / runner.inputWidth;
    const scaleY = ch / runner.inputHeight;

    const x = det.x * scaleX;
    const y = det.y * scaleY;
    const w = det.width * scaleX;
    const h = det.height * scaleY;

    ctx.strokeRect(x, y, w, h);
    ctx.fillText(`${det.label} ${Math.round(det.confidence * 100)}%`, x, y - 10);
  };

  const sendToBackend = async (detection) => {
  
    if (window.isSending) return;
    window.isSending = true;
    setTimeout(() => { window.isSending = false; }, 2000); 
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

      {isLoading && (
        <div className="text-center text-gray-500 py-10">
          <p>Initializing Camera & Model...</p>
        </div>
      )}

     
      <video 
        ref={videoRef} 
        className="hidden" 
        playsInline 
        muted 
        autoPlay
      />
      
      <canvas 
        ref={canvasRef} 
        className={`w-full rounded-xl border shadow ${isLoading ? 'hidden' : 'block'}`} 
      />
    </div>
  );
}