import React, { useState, useRef } from "react";
import { calibrateChartFromDataUrl, diagnosePads } from "../api/eiApi";

export default function AnalyzerCard({ imageDataUrl, onMappingUpdated, onDiagnosis }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const canvasRef = useRef();

  // compute pads: equal top->bottom split fallback (10 pads)
  function computePadsFromImage(dataUrl, padsCount = 10) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const W = 640; // scale width for consistent sampling
        const H = Math.round((img.height / img.width) * W);
        const canvas = canvasRef.current || document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, W, H);

        const padH = Math.floor(H / padsCount);
        const pads = [];
        for (let i = 0; i < padsCount; i++) {
          const y0 = i * padH;
          const h = (i === padsCount - 1) ? H - y0 : padH;
         
          const x1 = Math.floor(W * 0.15);
          const x2 = Math.floor(W * 0.85);
          const w = x2 - x1;
          const y1 = y0 + Math.floor(h * 0.15);
          const y2 = y0 + Math.floor(h * 0.85);
          const hh = Math.max(4, y2 - y1);
          if (w <= 0 || hh <= 0) {
            pads.push({ r: 255, g: 255, b: 255 });
            continue;
          }
          const imgData = ctx.getImageData(x1, y1, w, hh).data;
          let r=0,g=0,b=0,c=0;
          for (let p=0; p<imgData.length; p+=4){
            r += imgData[p];
            g += imgData[p+1];
            b += imgData[p+2];
            c++;
          }
          pads.push({
            r: Math.round(r/c),
            g: Math.round(g/c),
            b: Math.round(b/c)
          });
        }
        resolve(pads);
      };
      img.onerror = (e) => reject(new Error("Could not load image"));
      img.src = dataUrl;
    });
  }

  async function handleCalibrate() {
    if (!imageDataUrl) return setMessage("No image to calibrate.");
    setLoading(true);
    setMessage("Uploading chart for calibration...");
    try {
      const res = await calibrateChartFromDataUrl(imageDataUrl);
      if (res && res.mapping) {
        onMappingUpdated && onMappingUpdated(res.mapping);
        setMessage("Calibration successful. Mapping saved.");
      } else {
        throw new Error("Invalid mapping returned");
      }
    } catch (err) {
      console.error(err);
      setMessage("Calibration failed: " + (err.message||err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    if (!imageDataUrl) return setMessage("No strip image available.");
    setLoading(true);
    setMessage("Computing pads...");
    try {
      const pads = await computePadsFromImage(imageDataUrl, 10);
      setMessage("Calling diagnosis API...");
      
      const result = await onDiagnosis({ pads }); 
      
      setMessage("Analysis complete.");
    } catch (err) {
      console.error(err);
      setMessage("Analysis failed: " + (err.message||err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-4 flex flex-col">
      <h3 className="text-lg font-semibold mb-3">Strip Analyzer</h3>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {imageDataUrl ? (
        <>
          <img src={imageDataUrl} className="w-full rounded border border-gray-200 mb-3" alt="Captured strip" />
          <div className="flex gap-3">
            <button
              onClick={handleCalibrate}
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {loading ? "Working..." : "Calibrate Chart (use this image as reference)"}
            </button>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-100"
            >
              {loading ? "Working..." : "Analyze Strip"}
            </button>
          </div>

          {message && <div className="mt-3 text-sm text-gray-600">{message}</div>}
        </>
      ) : (
        <div className="w-full h-48 flex items-center justify-center border border-gray-200 rounded text-gray-400">
          No strip image captured yet.
        </div>
      )}
    </div>
  );
}
