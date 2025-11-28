
import React, { useEffect, useRef, useState } from "react";

export default function StripAnalyzer({ imageDataUrl, onAnalyze }) {
  const canvasRef = useRef(null);
  const [detectedColor, setDetectedColor] = useState(null);

  useEffect(() => {
    if (!imageDataUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageDataUrl;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      const W = 360;
      const H = Math.round((img.height / img.width) * W);
      canvas.width = W;
      canvas.height = H;
      ctx.drawImage(img, 0, 0, W, H);

    
      const cx = Math.round(W / 2);
      const cy = Math.round(H / 2);
      const size = 20;
      const data = ctx.getImageData(cx - size, cy - size, size * 2, size * 2).data;
      let r = 0, g = 0, b = 0, c = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i]; g += data[i+1]; b += data[i+2]; c++;
      }
      const rgb = { r: Math.round(r/c), g: Math.round(g/c), b: Math.round(b/c) };
      setDetectedColor(rgb);
      onAnalyze && onAnalyze({ image: imageDataUrl, rgb });
    };
  }, [imageDataUrl, onAnalyze]);

  return (
    <div className="bg-white p-4 rounded-2xl shadow-lg max-w-md mx-auto">
      <h4 className="font-semibold mb-2">Strip Analyzer</h4>
      {!imageDataUrl ? (
        <div className="text-sm text-gray-500">No image captured yet.</div>
      ) : (
        <>
          <canvas ref={canvasRef} className="w-full rounded-md border" />
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full border shadow-sm" style={{ backgroundColor: detectedColor ? `rgb(${detectedColor.r}, ${detectedColor.g}, ${detectedColor.b})` : "#fff" }} />
              <div>
                <div className="text-sm font-medium">Detected color</div>
                <div className="text-xs text-gray-600">{detectedColor ? `RGB (${detectedColor.r}, ${detectedColor.g}, ${detectedColor.b})` : "-"}</div>
              </div>
            </div>
            <button className="px-3 py-2 bg-emerald-600 text-white rounded-lg" onClick={() => onAnalyze && onAnalyze({ image: imageDataUrl, rgb: detectedColor })}>Analyze</button>
          </div>
        </>
      )}
    </div>
  );
}
