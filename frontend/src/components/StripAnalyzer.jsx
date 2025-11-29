import React, { useEffect, useRef, useState } from "react";

// =========================================================================
// 1. RAW WASM BRIDGE (YOLO/SSD - RECTANGLES)
// =========================================================================
class EdgeImpulseClassifier {
  constructor(module) {
    this._module = module;
    this._initialized = false;
  }

  init() {
    return new Promise((resolve) => {
      if (this._initialized) resolve();
      
  
      if (this._module.calledRun) {
        this._initialized = true;
        resolve();
        return;
      }

      // Hook into the Emscripten runtime ready callback
      // We wrap the existing one if it exists to be safe
      const originalOnRuntimeInitialized = this._module.onRuntimeInitialized;
      this._module.onRuntimeInitialized = () => {
        if (originalOnRuntimeInitialized) originalOnRuntimeInitialized();
        this._initialized = true;
        resolve();
      };
    });
  }

  getProperties() {
    return this._module.get_properties();
  }

  classify(rawData) {
    if (!this._initialized) throw new Error("Module is not initialized");
    const module = this._module;

    // 1. Copy JS float data to C++ heap
    let typedArray = new Float32Array(rawData);
    let numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
    let ptr = module._malloc(numBytes);
    let heapBytes = new Uint8Array(module.HEAPU8.buffer, ptr, numBytes);
    heapBytes.set(new Uint8Array(typedArray.buffer));

    // 2. Run classifier (False = not debug mode)
    let ret = module.run_classifier(ptr, rawData.length, false);
    module._free(ptr); // Free memory immediately

    if (ret.result !== 0) {
      throw new Error("Classification failed code: " + ret.result);
    }

    let jsResult = { anomaly: ret.anomaly, results: [] };

    // 3. Extract Results
    for (let cx = 0; cx < ret.size(); cx++) {
      let c = ret.get(cx);
      // YOLO returns bounding boxes (x, y, width, height)
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

// =========================================================================
// 2. REACT COMPONENT
// =========================================================================
export default function StripAnalyzer({ onResult }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [classifier, setClassifier] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [modelDims, setModelDims] = useState({ width: 320, height: 320 }); // YOLO Default

  const backendURL = "https://kaelion-ai.onrender.com/analyze";

  // --------------------------
  // 1. Load SIMD WASM
  // --------------------------
  useEffect(() => {
    const loadWasm = async () => {
      try {
        console.log("Loading YOLO (SIMD)...");

        // 1. Define loading logic
        const loadScript = () => {
            return new Promise((resolve, reject) => {
                if (window.EdgeImpulse || (window.Module && window.Module.run_classifier)) {
                    resolve();
                    return;
                }
                const script = document.createElement("script");
                script.src = `/ei-wasm/edge-impulse-standalone.js?v=${Date.now()}`;
                script.async = true;
                script.onload = () => {
                    console.log("Script downloaded successfully");
                    resolve();
                };
                script.onerror = () => reject(new Error("Failed to load script. Check /public/ei-wasm/ path."));
                document.body.appendChild(script);
            });
        };

     
        const waitForGlobal = async () => {
             return new Promise((resolve, reject) => {
                 let count = 0;
                 const interval = setInterval(() => {
                     
                     if (window.EdgeImpulse) {
                         clearInterval(interval);
                         resolve(window.EdgeImpulse);
                     } 
                  
                     else if (window.Module && window.Module.run_classifier) {
                         clearInterval(interval);
                         resolve(window.Module);
                     }
                     
                     count++;
                     if (count > 100) { // 10 seconds timeout
                         clearInterval(interval);
                         reject(new Error("Timeout: Script loaded but window.EdgeImpulse not found"));
                     }
                 }, 100);
             });
        };

       
        if (!window.Module) {
            window.Module = {
                onRuntimeInitialized: function() {},
                locateFile: function(path) {
                    return "/ei-wasm/edge-impulse-standalone.wasm";
                }
            };
        }

   
        await loadScript();
        let eiFactory = await waitForGlobal();

      
        let eiModule;
        if (typeof eiFactory === 'function') {
        
            console.log("Initializing Factory...");
            eiModule = await eiFactory(); 
        } else {
          
            eiModule = eiFactory;
        }

        if (!eiModule) throw new Error("Failed to initialize Module");

       
        const bridge = new EdgeImpulseClassifier(eiModule);
        
       
        await bridge.init();

        const props = bridge.getProperties();
        console.log("YOLO Model Loaded:", props);
        setModelDims({ width: props.input_width, height: props.input_height });
        
        setClassifier(bridge);
        setIsLoading(false);

      } catch (e) {
        console.error("Setup Error:", e);
        setErrorMsg(`Error: ${e.message}`);
        setIsLoading(false);
      }
    };

    loadWasm();
  }, []);

  // --------------------------
  // 2. Start Camera
  // --------------------------
  useEffect(() => {
    if (!classifier) return;

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
          videoRef.current.onloadedmetadata = () => videoRef.current.play();
        }
      } catch (e) {
        setErrorMsg("Camera access denied.");
      }
    };

    startCamera();
  }, [classifier]);

 
  useEffect(() => {
    if (!classifier) return;

    let reqId;
    let lastSent = 0;
    const sendCooldown = 3000; 

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
        const result = classifier.classify(features);

        if (result.results && result.results.length > 0) {
        
           const bestDet = result.results.sort((a, b) => b.value - a.value)[0];

           if (bestDet && bestDet.value > 0.75) { 
                
             
                drawBoundingBox(ctx, bestDet, canvas.width, canvas.height);

             
                const now = Date.now();
                if (now - lastSent > sendCooldown && bestDet.label === "urine_strip") {
                  
               
                  const cropBlob = await captureCrop(video, bestDet);
                  if (cropBlob) {
                      sendToBackend(cropBlob, bestDet);
                      lastSent = now;
                  }
                }
           }
        }
      } catch (err) {
      
      }

      reqId = requestAnimationFrame(processFrame);
    };

    reqId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(reqId);
  }, [classifier, modelDims]);

  // --------------------------
  // Helpers
  // --------------------------
  
  // Draw Rectangle
  const drawBoundingBox = (ctx, det, cw, ch) => {
    const scaleX = cw / modelDims.width;
    const scaleY = ch / modelDims.height;

    const x = det.x * scaleX;
    const y = det.y * scaleY;
    const w = det.width * scaleX;
    const h = det.height * scaleY;

    ctx.strokeStyle = "#00FF00";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);

    const text = `${det.label} ${Math.round(det.value * 100)}%`;
    ctx.font = "bold 16px Arial";
    const textW = ctx.measureText(text).width;
    ctx.fillStyle = "#00FF00";
    ctx.fillRect(x, y - 24, textW + 8, 24);
    ctx.fillStyle = "black";
    ctx.fillText(text, x + 4, y - 6);
  };

  // Capture Crop Region
  const captureCrop = async (video, det) => {
    // Map coords back to video size
    const scaleX = video.videoWidth / modelDims.width;
    const scaleY = video.videoHeight / modelDims.height;

    const x = Math.max(0, det.x * scaleX);
    const y = Math.max(0, det.y * scaleY);
    const w = det.width * scaleX;
    const h = det.height * scaleY;

    if (w <= 0 || h <= 0) return null;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = w;
    cropCanvas.height = h;
    const ctx = cropCanvas.getContext("2d");
    
    ctx.drawImage(video, x, y, w, h, 0, 0, w, h);

    // Return as Base64 or Blob
    return new Promise(resolve => cropCanvas.toBlob(resolve, 'image/jpeg', 0.9));
  };

  const sendToBackend = async (imageBlob, detectionMeta) => {
    console.log("Sending strip for diagnosis...");
    
    const formData = new FormData();
    formData.append("file", imageBlob, "strip.jpg");
    // Pass metadata if backend needs it (optional)
    formData.append("confidence", detectionMeta.value); 

    try {
        const response = await fetch(backendURL, {
            method: "POST",
            body: formData, // Sending Multipart Form Data (Image)
        });
        
        if (!response.ok) throw new Error("Analysis failed");
        
        const data = await response.json();
        console.log("Diagnosis received:", data);
        if(onResult) onResult(data); 

    } catch(e) { 
        console.error("Backend Error:", e); 
    }
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg max-w-md mx-auto relative">
      <h4 className="font-semibold mb-3">Strip Analyzer (YOLO)</h4>
      {errorMsg && <div className="text-red-500 text-sm mb-2 text-center">{errorMsg}</div>}
      
      <div className="relative rounded-xl overflow-hidden bg-black min-h-[250px] border shadow-inner">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-white z-10 bg-black/80">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    Loading AI...
                </div>
            </div>
          )}
          <video ref={videoRef} className="hidden" playsInline muted autoPlay />
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
      </div>
      <p className="text-xs text-gray-400 text-center mt-2">Hold strip steady inside the frame</p>
    </div>
  );
}