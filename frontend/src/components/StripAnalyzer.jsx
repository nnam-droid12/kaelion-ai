import { useEffect, useRef, useState } from "react";

export default function StripAnalyzer({ classifier, modelDims }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [diagnosis, setDiagnosis] = useState("No diagnosis yet.");

  let req = null;
  let lastDet = null;
  let lastDetTime = 0;

  useEffect(() => {
    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });

        videoRef.current.srcObject = stream;
        videoRef.current.play();

        setLoading(false);
        loop();
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    startCamera();

    return () => {
      if (req) cancelAnimationFrame(req);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const drawCircle = (ctx, det, minDim, sx, sy) => {
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(
      canvasRef.current.width / 2,
      canvasRef.current.height / 2,
      minDim * 0.3,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    ctx.fillStyle = "lime";
    ctx.font = "28px Arial";
    ctx.fillText(det.label, sx + 20, sy + 40);
  };

  const loop = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== 4) {
      req = requestAnimationFrame(loop);
      return;
    }

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const minDim = Math.min(canvas.width, canvas.height);
    const sx = (canvas.width - minDim) / 2;
    const sy = (canvas.height - minDim) / 2;

  
    const tmp = document.createElement("canvas");
    tmp.width = modelDims.width;
    tmp.height = modelDims.height;
    const tctx = tmp.getContext("2d");

    tctx.drawImage(video, sx, sy, minDim, minDim, 0, 0, tmp.width, tmp.height);

    const img = tctx.getImageData(0, 0, tmp.width, tmp.height);

   
    const features = [];
    for (let i = 0; i < img.data.length; i += 4) {
      features.push(
        (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]
      );
    }

  
    const result = classifier.classify(features);

    let currentDet = null;

    if (result.results && result.results.length > 0) {
      currentDet = result.results.reduce((a, b) =>
        a.value > b.value ? a : b
      );
    }

    
    if (currentDet && currentDet.value > 0.5) {
      lastDet = currentDet;
      lastDetTime = Date.now();
      setDiagnosis(currentDet.label);
    }

   
    if (lastDet && Date.now() - lastDetTime < 1500) {
      drawCircle(ctx, lastDet, minDim, sx, sy);
    }

    req = requestAnimationFrame(loop);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl text-center mb-3">Strip Analyzer</h2>

      {loading && <p>Loading model & camera…</p>}

      <div className="flex justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className="rounded-xl border mb-3"
          style={{ width: "350px", height: "auto" }}
        />
      </div>

      <div className="flex justify-center">
        <canvas
          ref={canvasRef}
          width={350}
          height={350}
          className="border rounded-xl"
        />
      </div>

      <div className="text-center mt-4">
        <h3 className="text-lg font-semibold">Diagnosis</h3>
        <p>{diagnosis}</p>
      </div>
    </div>
  );
}
