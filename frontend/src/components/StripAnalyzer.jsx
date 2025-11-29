
import React, { useEffect, useRef, useState } from "react";



export default function StripAnalyzer({ onResult /* optional callback when backend returns */ }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const tempCanvasRef = useRef(null);
  const moduleRef = useRef(null);          
  const modelPropsRef = useRef({ width: 96, height: 96 }); 
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);


  const backendURL = "https://kaelion-ai.onrender.com/calibrate";

  const CONF_THRESHOLD = 0.5; 
  const SEND_COOLDOWN_MS = 1500; 

  // -------------------------
  // Helper: load EI raw JS/WASM runtime (if not already loaded)
  // -------------------------
  useEffect(() => {
    let didCancel = false;
    async function initModule() {
      try {
        if (window.Module && typeof window.Module.run_classifier === "function") {
         
          moduleRef.current = window.Module;
        } else {
         
          window.Module = window.Module || {};
          window.Module.locateFile = (path) => `/ei-wasm/${path}`;
        
          await new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = `/ei-wasm/edge-impulse-standalone.js?v=${Date.now()}`;
            s.async = true;
            s.onload = resolve;
            s.onerror = (e) => reject(new Error("Failed to load Edge Impulse JS runtime"));
            document.body.appendChild(s);
          });
       
          const waitFor = (ms) => new Promise(r => setTimeout(r, ms));
          for (let i = 0; i < 40; i++) {
            if (window.Module && typeof window.Module.run_classifier === "function") break;
            await waitFor(100);
          }
          if (!window.Module || typeof window.Module.run_classifier !== "function") {
            throw new Error("Edge Impulse runtime did not expose run_classifier()");
          }
          moduleRef.current = window.Module;
        }

       
        if (moduleRef.current.onRuntimeInitialized) {
        
          await new Promise((resolve) => {
            const m = moduleRef.current;
            if (m.calledRun || m._runCalled) return resolve();
            const prev = m.onRuntimeInitialized;
            m.onRuntimeInitialized = function () {
              try { prev && prev(); } catch {}
              resolve();
            };
          });
        }

       
        try {
          const props = moduleRef.current.get_properties();
          if (props && props.input_width && props.input_height) {
            modelPropsRef.current = { width: props.input_width, height: props.input_height };
          }
        } catch (err) {
          console.warn("Could not read model properties, using fallback dims.", err);
        }

        if (!didCancel) setIsReady(true);
      } catch (err) {
        console.error("EI runtime load error:", err);
        if (!didCancel) setError(err.message || String(err));
      }
    }

    initModule();
    return () => { didCancel = true; };
  }, []);

  // -------------------------
  // Start camera once runtime ready
  // -------------------------
  useEffect(() => {
    if (!isReady) return;
    let mounted = true;
    async function startCamera() {
      try {
        const constraints = { video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!mounted) return;
        const v = videoRef.current;
        v.srcObject = stream;
        await v.play();
      
        if (!tempCanvasRef.current) {
          const tc = document.createElement("canvas");
          tempCanvasRef.current = tc;
        }
      } catch (e) {
        console.error("Camera error:", e);
        setError("Camera permission denied or no camera available.");
      }
    }
    startCamera();
    return () => {
      mounted = false;
      try {
        const s = videoRef.current && videoRef.current.srcObject;
        if (s && s.getTracks) s.getTracks().forEach(t => t.stop());
      } catch {}
    };
  }, [isReady]);

  // -------------------------
  // Main inference loop (highly optimized)
  // -------------------------
  useEffect(() => {
    if (!isReady) return;
    const module = moduleRef.current;
    if (!module || typeof module.run_classifier !== "function") return;

    let raf = null;
    let lastSent = 0;


    const { width: modelW, height: modelH } = modelPropsRef.current;
    const tempCanvas = tempCanvasRef.current;
    tempCanvas.width = modelW;
    tempCanvas.height = modelH;
    const tctx = tempCanvas.getContext("2d");


    let lastPtr = 0;
    let lastSize = 0;

    const process = async () => {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || video.readyState < 2) {
          raf = requestAnimationFrame(process);
          return;
        }

      
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    
        const minDim = Math.min(video.videoWidth, video.videoHeight);
        const sx = Math.round((video.videoWidth - minDim) / 2);
        const sy = Math.round((video.videoHeight - minDim) / 2);

       
        tctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, modelW, modelH);

       
        const imgData = tctx.getImageData(0, 0, modelW, modelH).data; 
       
        const rgbBytes = new Uint8Array(modelW * modelH * 3);
        let p = 0;
        for (let i = 0, n = imgData.length; i < n; i += 4) {
          rgbBytes[p++] = imgData[i];     // R
          rgbBytes[p++] = imgData[i + 1]; // G
          rgbBytes[p++] = imgData[i + 2]; // B
        }

      
        const numBytes = rgbBytes.length;
        if (lastSize !== numBytes) {
          if (lastPtr) module._free(lastPtr);
          lastPtr = module._malloc(numBytes);
          lastSize = numBytes;
        }
     
        module.HEAPU8.set(rgbBytes, lastPtr);

       
        const ret = module.run_classifier(lastPtr, numBytes, 0);
      
        if (ret && typeof ret.size === "function" && ret.size() > 0) {
          // draw markers for each detection
          for (let i = 0; i < ret.size(); i++) {
            const obj = ret.get(i);
            
            const label = obj.label ? obj.label : "obj";
            const val = typeof obj.value === "number" ? obj.value : (obj.value && obj.value.toFixed ? obj.value : 0);
            const x = typeof obj.x === "number" ? obj.x : 0;
            const y = typeof obj.y === "number" ? obj.y : 0;
           
            const factor = minDim / modelW;
            const cx = Math.round(sx + x * factor);
            const cy = Math.round(sy + y * factor);

        
            if (val >= CONF_THRESHOLD) {
            
              drawMarker(ctx, cx, cy, label, val);

            
              const now = Date.now();
              if (now - lastSent > SEND_COOLDOWN_MS) {
                lastSent = now;
               
                const detection = { label, confidence: val, x: cx, y: cy };
                
                onResult && onResult({ detection });
           
                if (backendURL) {
                  fetch(backendURL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ detection }),
                  }).catch(e => console.warn("backend post failed:", e));
                }
              }
            }
         
            try { obj.delete && obj.delete(); } catch (e) {}
          }
        }
        try { ret.delete && ret.delete(); } catch (e) {}

      } catch (err) {
        console.error("Processing error:", err);
      } finally {
        raf = requestAnimationFrame(process);
      }
    };

    raf = requestAnimationFrame(process);

    return () => {
      if (raf) cancelAnimationFrame(raf);
  
      try { if (lastPtr) module._free(lastPtr); } catch (e) {}
    };
  }, [isReady, onResult]);


  const drawMarker = (ctx, cx, cy, label, val) => {
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#00FF66";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.stroke();
  
    const text = `${label} ${(val * 100).toFixed(0)}%`;
    ctx.font = "bold 14px Inter, Arial";
    const tw = ctx.measureText(text).width;
    const px = Math.max(6, cx - tw/2);
    ctx.fillRect(px - 6, cy + 28, tw + 12, 22);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, px, cy + 44);
    ctx.restore();
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg">
      <h4 className="font-semibold mb-3">Strip Analyzer</h4>

      {error && <div className="text-red-500 mb-2">{error}</div>}
      {!isReady ? (
        <div className="text-sm text-gray-500">Loading model & runtime…</div>
      ) : (
        <>
          <div className="relative rounded-xl overflow-hidden bg-black border" style={{ minHeight: 260 }}>
            <video ref={videoRef} className="hidden" playsInline muted />
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div style={{ position: "absolute", right: 10, top: 10, zIndex: 20 }}>
              <div className="px-2 py-1 bg-white bg-opacity-80 rounded text-xs">FOMO - center detection</div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Center the strip inside the camera view for best results.</p>
        </>
      )}
    </div>
  );
}
