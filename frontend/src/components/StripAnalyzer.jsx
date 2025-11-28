import React, { useEffect, useRef, useState } from "react";


class EdgeImpulseClassifier {
  constructor(module) {
    this._module = module;
    this._initialized = false;
  }

  init() {
    return new Promise((resolve) => {

      if (this._initialized) resolve();

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


    let typedArray = new Float32Array(rawData);
    let numBytes = typedArray.length * typedArray.BYTES_PER_ELEMENT;
    
    let ptr = module._malloc(numBytes);
    
  
    let heapBytes = new Uint8Array(module.HEAPU8.buffer, ptr, numBytes);
    heapBytes.set(new Uint8Array(typedArray.buffer));


    let ret = module.run_classifier(ptr, rawData.length, false);

    module._free(ptr);

  
    if (ret.result !== 0) {
      throw new Error("Classification failed error code: " + ret.result);
    }

    let jsResult = {
      anomaly: ret.anomaly,
      results: [],
      bounding_boxes: [] 
    };

    
    for (let cx = 0; cx < ret.size(); cx++) {
      let c = ret.get(cx);
      
      
      const det = { 
        label: c.label, 
        value: c.value, 
        x: c.x, 
        y: c.y, 
        width: c.width, 
        height: c.height 
      };
      
      jsResult.results.push(det);
      jsResult.bounding_boxes.push(det); 

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
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [modelDims, setModelDims] = useState({ width: 96, height: 96 });

  const backendURL = "https://kaelion-ai.onrender.com/analyze";

 
  useEffect(() => {
    const loadRawWasm = async () => {
      try {
        
        if (window.Module && window.Module.run_classifier) {
            console.log("Module already exists");
            return; 
        }

        console.log("Setting up Raw WASM Module...");

       
        window.Module = {
          onRuntimeInitialized: function() {
            console.log("Runtime Initialized via callback!");
          },
          locateFile: function(path) {
          
            return "/ei-wasm/edge-impulse-standalone.wasm";
          }
        };

       
        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = `/ei-wasm/edge-impulse-standalone.js?v=${Date.now()}`;
            script.async = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error("Failed to load .js file"));
            document.body.appendChild(script);
        });

      
        const bridge = new EdgeImpulseClassifier(window.Module);
        
       
        await bridge.init();

        
        const props = bridge.getProperties();
        console.log("Model Loaded!", props);
        setModelDims({ width: props.input_width, height: props.input_height });
        
        setClassifier(bridge);
        setIsLoading(false);

      } catch (e) {
        console.error("Initialization Failed:", e);
        setErrorMsg(e.message);
        setIsLoading(false);
      }
    };

    loadRawWasm();
  }, []);

  // --------------------------
  // Start Camera
  // --------------------------
  useEffect(() => {
    if (!classifier) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current.play();
        }
      } catch (e) {
        setErrorMsg("Camera denied");
      }
    };

    startCamera();
  }, [classifier]);

  // --------------------------
  // Inference Loop
  // --------------------------
  useEffect(() => {
    if (!classifier) return;

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
        
        const result = classifier.classify(features);

        if (result.results && result.results.length > 0) {
           result.results.forEach((det) => {
            
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
        console.error("Inference Error:", err);
      }

      reqId = requestAnimationFrame(processFrame);
    };

    reqId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(reqId);
  }, [classifier, modelDims]);

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
        await fetch(backendURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ detection }),
        });
        
        if(onResult) onResult({ detection }); 
    } catch(e) { console.error(e); }
  };

  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg max-w-md mx-auto relative">
      <h4 className="font-semibold mb-3">Strip Analyzer</h4>
      {errorMsg ? <div className="text-red-500 bg-red-50 p-2 text-center">{errorMsg}</div> : null}
      {isLoading && <div className="text-center text-blue-500 py-4">Initializing Custom Wrapper...</div>}
      <video ref={videoRef} className="hidden" playsInline muted autoPlay />
      <canvas ref={canvasRef} className="w-full rounded-xl border bg-black min-h-[250px]" />
    </div>
  );
}