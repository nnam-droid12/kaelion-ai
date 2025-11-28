import React from "react";

export default function DiagnosisCard({ diagnosis }) {
  return (
    <div className="card p-4 flex flex-col">
      <h3 className="text-lg font-semibold mb-3">Diagnosis</h3>
      {diagnosis ? (
        <div className="space-y-2">
          {diagnosis.map((d, i) => (
            <div key={i} className="p-3 bg-[#EAF3FF] rounded">
              <strong>{d.parameter}</strong>: {d.value} → <span className="text-[#2F80ED]">{d.result}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-gray-500">No diagnosis yet.</div>
      )}
    </div>
  );
}
