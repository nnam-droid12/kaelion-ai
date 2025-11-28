import React, { useEffect, useRef, useState } from "react";

export default function StripAnalyzer({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [runner, setRunner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  
 
  const [modelDims, setModelDims] = useState({ width: 96, height: 96 });

  const backendURL = "https://kaelion-ai.onrender.com/analyze";

  // --------------------------
  // 1. Load Edge Impulse (Browser + SIMD Build)
  // --------------------------
  useEffect(() => {
    const loadModel = async () => {
      try {
        console.log("Loading Edge Impulse (Browser SIMD)...");

      
        if (!window.EdgeImpulse) {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
           
            script.src = `/ei-wasm/edge-impulse-standalone.js?v=${new Date().getTime()}`;
            script.async = true;
            script.onload = () => {
            
              if (window.EdgeImpulse) resolve();
              else reject(new Error("Script loaded but window.EdgeImpulse is missing."));
            };
            script.onerror = () => reject(new Error("Failed to load script. Check public/ei-wasm/ folder."));
            document.body.appendChild(script);
          });
        }

       
        const ei = window.EdgeImpulse;
        const mod = await ei.load("/ei-wasm/edge-impulse-standalone.wasm");
        const r = await mod.createRunner();
        await r.init();
        
        
        const props = r.getProperties();
        console.log("Model Loaded. Input Size:", props.input_width, "x", props.input_height);
        
        setModelDims({ width: props.input_width, height: props.input_height });
        setRunner(r);
        setIsLoading(false);

      } catch (e) {
        console.error("Model Load Error:", e);
     
        if (e.message && e.message.includes("compile")) {
             setErrorMsg("Your device does not support WebAssembly SIMD. Please download the standard 'WebAssembly (browser)' build instead.");
        } else {
             setErrorMsg(e.message);
        }
        setIsLoading(false);
      }
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
        setErrorMsg("Camera access denied or unavailable.");
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
  // 3. Inference Loop (Detection)
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

     
      const W = modelDims.width;
      const H = modelDims.height;
      
   
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

      try {
      
        const result = await runner.classify(features);

       
        if (result && result.type === "object-detection") {
           const boxes = result.bounding_boxes || [];
           
           boxes.forEach((det) => {
          
             if (det.value > 0.6) { 
                drawBoundingBox(ctx, det, canvas.width, canvas.height);

             
                const now = Date.now();
                if (now - lastSent > 2000 && det.label === "urine_strip") { 
                   sendToBackend(det);
                   lastSent = now;
                }
             }
           });
        } 

      } catch (err) {
      
      }

      reqId = requestAnimationFrame(processFrame);
    };

    reqId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(reqId);
  }, [runner, modelDims]);

  // --------------------------
  // Helper: Draw Bounding Box
  // --------------------------
  const drawBoundingBox = (ctx, det, cw, ch) => {
 
    const scaleX = cw / modelDims.width;
    const scaleY = ch / modelDims.height;

    const x = det.x * scaleX;
    const y = det.y * scaleY;
    const w = det.width * scaleX;
    const h = det.height * scaleY;

    ctx.strokeStyle = "#00FF00"; 
    ctx.lineWidth = 4;
    ctx.font = "bold 18px Arial";
    ctx.fillStyle = "#00FF00";

    ctx.strokeRect(x, y, w, h);
    ctx.fillText(`${det.label} ${Math.round(det.value * 100)}%`, x, y - 10);
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
        <div className="bg-red-50 text-red-600 p-4 rounded text-center border border-red-200">
          <p className="font-bold">Error</p>
          <p className="text-sm">{errorMsg}</p>
        </div>
      ) : isLoading && (
        <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center">
           <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-2"></div>
           <p className="text-gray-600 font-medium">Loading AI Model...</p>
        </div>
      )}

      
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="w-full rounded-xl border bg-black min-h-[250px]" />
    </div>
  );
}