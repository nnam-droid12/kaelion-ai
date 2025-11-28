import React from "react";

export default function AnalyzerCard({ imageDataUrl }) {
  return (
    <div className="card p-4 flex flex-col">
      <h3 className="text-lg font-semibold mb-3">Strip Analyzer</h3>
      {imageDataUrl ? (
        <img src={imageDataUrl} className="w-full rounded border border-gray-200" alt="Captured strip" />
      ) : (
        <div className="w-full h-48 flex items-center justify-center border border-gray-200 rounded text-gray-400">
          No strip image captured yet.
        </div>
      )}
    </div>
  );
}
