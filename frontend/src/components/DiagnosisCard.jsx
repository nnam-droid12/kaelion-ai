import React from "react";

export default function DiagnosisCard({ diagnosis }) {
  return (
    <div className="card p-4 flex flex-col">
      <h3 className="text-lg font-semibold mb-3">Diagnosis</h3>

      {!diagnosis || diagnosis.length === 0 ? (
        <div className="text-gray-500">No diagnosis yet.</div>
      ) : (
        <div className="space-y-3">
          {diagnosis.map((d, i) => (
            <div key={i} className="p-3 bg-white rounded shadow-sm">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-sm font-medium">{d.analyte}</div>
                  <div className="text-xs text-gray-600">{d.diagnosis}</div>
                </div>
                <div className="text-sm font-semibold text-blue-600">conf: {d.confidence ?? d.confidence}</div>
              </div>
              {d.level !== undefined && (
                <div className="mt-2 text-xs text-gray-500">Level: {d.level}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
