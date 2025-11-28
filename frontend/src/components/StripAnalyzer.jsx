import React, { useEffect, useRef, useState } from "react";

export default function StripAnalyzer({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [runner, setRunner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const backendURL = "https://kaelion-ai.onrender.com/analyze";

  // --------------------------
  // 1. Load Edge Impulse (Raw Module Method)
  // --------------------------
  useEffect(() => {
    const loadModel = async () => {
    
      if (window.Module && window.Module.classifier) {
         console.log("Module already loaded");
         setRunner(window.Module);
         setIsLoading(false);
         return;
      }

      console.log("Setting up WASM environment...");

    
      window.Module = {
        onRuntimeInitialized: function() {
          console.log("WASM Runtime Initialized!");
          
        
          setRunner(window.Module);
          setIsLoading(false);
        },
        locateFile: function(path) {
          
          return "/ei-wasm/edge-impulse-standalone.wasm";
        }
      };

     
      const script = document.createElement("script");
      script.src = "/ei-wasm/edge-impulse-standalone.js";
      script.async = true;
      
      script.onerror = () => {
        setErrorMsg("Failed to load /ei-wasm/edge-impulse-standalone.js");
        setIsLoading(false);
      };

      document.body.appendChild(script);
    };

    loadModel();
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
          };
        }
      } catch (e) {
        console.error("Camera Error:", e);
        setErrorMsg("Camera access denied.");
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
    if (!runner) return;

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

      
      
      try {
        
        const W = 96; 
        const H = 96; 
      
        
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = W;
        tempCanvas.height = H;
        const tctx = tempCanvas.getContext("2d");
        tctx.drawImage(video, 0, 0, W, H);

        const imageData = tctx.getImageData(0, 0, W, H);
        
      
        const features = [];
        for (let i = 0; i < imageData.data.length; i += 4) {
             const r = imageData.data[i];
             const g = imageData.data[i + 1];
             const b = imageData.data[i + 2];
            
             features.push((r << 16) | (g << 8) | b);
        }

      
        
        let result;
        if (runner.classify) {
            
             result = await runner.classify(imageData);
        } else if (runner.run_classifier) {
            
             console.warn("Raw classifier detected. Need buffer logic.");
        }

        if (result?.results?.length > 0) {
          result.results.forEach((det) => {
            drawBoundingBox(ctx, det, canvas.width, canvas.height);

            if (det.label === "urine_strip" && det.confidence > 0.6) {
              const now = Date.now();
              if (now - lastSent > 2000) { 
                sendToBackend(det);
                lastSent = now;
              }
            }
          });
        }
      } catch (err) {
       
        if (!err.message.includes("memory")) console.error(err);
      }

      reqId = requestAnimationFrame(processFrame);
    };

    reqId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(reqId);
  }, [runner]);

  const drawBoundingBox = (ctx, det, cw, ch) => {
   
    const inputW = runner.inputWidth || 96;
    const inputH = runner.inputHeight || 96;

    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 3;
    ctx.font = "bold 16px Arial";
    ctx.fillStyle = "#00FF00";

    const scaleX = cw / inputW;
    const scaleY = ch / inputH;

    ctx.strokeRect(det.x * scaleX, det.y * scaleY, det.width * scaleX, det.height * scaleY);
    ctx.fillText(`${det.label} ${Math.round(det.confidence * 100)}%`, det.x * scaleX, (det.y * scaleY) - 5);
  };

  const sendToBackend = async (detection) => {
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
        <div className="bg-red-50 text-red-600 p-3 rounded mb-2 text-sm">{errorMsg}</div>
      ) : isLoading && (
        <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center">
           <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
           <p className="text-gray-600 text-sm">Loading WASM...</p>
        </div>
      )}

      <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="w-full rounded-xl border bg-black min-h-[200px]" />
    </div>
  );
}