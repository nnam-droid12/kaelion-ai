import React, { useEffect, useRef, useState } from "react";

export default function StripAnalyzer({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [runner, setRunner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
  const backendURL = "https://kaelion-ai.onrender.com/analyze";

  // --------------------------
  // 1. Load Edge Impulse Model (With Safety Polling)
  // --------------------------
  useEffect(() => {
    const initModel = async () => {
      
    
      const waitForEdgeImpulse = () => {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const checkInterval = setInterval(() => {
            if (window.EdgeImpulse) {
              clearInterval(checkInterval);
              resolve(window.EdgeImpulse);
            } else {
              attempts++;
             
              if (attempts > 100) {
                clearInterval(checkInterval);
                reject(new Error("Timeout: Edge Impulse script could not be found."));
              }
            }
          }, 100);
        });
      };

      try {
        console.log("Waiting for EI script...");
        const ei = await waitForEdgeImpulse();
        
        console.log("Script found. Loading WASM...");
     
        const mod = await ei.load("/ei-wasm/edge-impulse-standalone.wasm");
        
        const r = await mod.createRunner();
        await r.init();

        console.log("Runner initialized:", r.classifierStudioName);
        setRunner(r);
      } catch (e) {
        console.error("EI Load Error:", e);
        setErrorMsg("Failed to load AI Model. Check console.");
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
            videoRef.current.play().catch(e => console.error("Play error:", e));
            setIsLoading(false);
          };
        }
      } catch (e) {
        console.error("Camera Error:", e);
        setErrorMsg("Camera access denied or unavailable.");
        setIsLoading(false);
      }
    };

    startCamera();

  
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [runner]);

  // --------------------------
  // 3. Inference Loop
  // --------------------------
  useEffect(() => {
    if (!runner || isLoading) return;

    let requestAnimationFrameId;
    let lastSentTime = 0; 

    const processFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

    
      if (!video || !canvas || video.readyState !== 4) {
        requestAnimationFrameId = requestAnimationFrame(processFrame);
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
              if (now - lastSentTime > 2000) { 
                sendToBackend(det);
                lastSentTime = now;
              }
            }
          });
        }
      } catch (err) {
        console.error("Inference Error:", err);
      }

      requestAnimationFrameId = requestAnimationFrame(processFrame);
    };

    requestAnimationFrame(processFrame);

    return () => cancelAnimationFrame(requestAnimationFrameId);
  }, [runner, isLoading]);

  // --------------------------
  // Helper: Draw Box
  // --------------------------
  const drawBoundingBox = (ctx, det, cw, ch) => {
    ctx.strokeStyle = "#00FF00"; // Bright Green
    ctx.lineWidth = 4;
    ctx.font = "bold 16px sans-serif";
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

  // --------------------------
  // Send to Backend
  // --------------------------
  const sendToBackend = async (detection) => {
    console.log("Sending detection...", detection);
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
         <div className="bg-red-50 text-red-600 p-4 rounded-lg text-center">
           {errorMsg}
         </div>
      ) : isLoading ? (
        <div className="text-center text-gray-500 py-10 bg-gray-100 rounded-xl">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p>Loading AI Model & Camera...</p>
        </div>
      ) : null}

    
      <video 
        ref={videoRef} 
        className="hidden" 
        playsInline 
        muted 
        autoPlay
      />
      
    
      <canvas 
        ref={canvasRef} 
        className={`w-full rounded-xl border shadow ${isLoading || errorMsg ? 'hidden' : 'block'}`} 
      />
    </div>
  );
}