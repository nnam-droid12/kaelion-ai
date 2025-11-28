import React, { forwardRef, useImperativeHandle, useRef } from "react";
import Webcam from "react-webcam";

const CameraCard = forwardRef(({ onCapture }, ref) => {
  const webcamRef = useRef();

  useImperativeHandle(ref, () => ({
    capture: () => {
      const imageSrc = webcamRef.current.getScreenshot();
      onCapture(imageSrc);
    }
  }));

  return (
    <div className="card p-4 flex flex-col">
      <h3 className="text-lg font-semibold mb-3">Live Camera</h3>
      <div className="w-full h-48 rounded overflow-hidden border border-gray-200">
        <Webcam
          ref={webcamRef}
          className="w-full h-full object-cover"
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: "environment" }}
        />
      </div>
      <div className="mt-3 flex gap-3">
        <button
          onClick={() => webcamRef.current && onCapture(webcamRef.current.getScreenshot())}
          className="flex-1 py-2 bg-[#2F80ED] text-white rounded hover:bg-blue-600"
        >
          Capture
        </button>
        <button
          onClick={() => onCapture(null)}
          className="flex-1 py-2 border border-gray-300 rounded hover:bg-gray-100"
        >
          Clear
        </button>
      </div>
    </div>
  );
});

export default CameraCard;
