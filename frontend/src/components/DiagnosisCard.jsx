import React from "react";

export default function DiagnosisCard({ diagnosis }) {
 
  const hasData = diagnosis && (Array.isArray(diagnosis) ? diagnosis.length > 0 : diagnosis.results);
  const items = Array.isArray(diagnosis) ? diagnosis : (diagnosis?.results || []);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 flex flex-col h-full border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">🩺 Diagnosis Report</h3>
        {hasData && (
          <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
            Analyzed
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
          <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">No strip detected yet.</p>
          <p className="text-xs mt-1">Scan a urine strip to see results.</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-1 max-h-[400px]">
          {items.map((d, i) => (
            <div 
              key={i} 
              className="p-3 bg-gray-50 hover:bg-blue-50 transition-colors rounded-xl border border-gray-100"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-gray-700 capitalize">{d.analyte || "Unknown"}</span>
                {d.confidence && (
                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                    {Math.round(d.confidence * 100)}%
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-end">
                <div>
                    <div className="text-sm font-semibold text-blue-600">
                        {d.diagnosis || d.result || "Pending"}
                    </div>
                    {d.level !== undefined && (
                        <div className="text-xs text-gray-500 mt-0.5">
                            Level: <span className="font-mono">{d.level}</span>
                        </div>
                    )}
                </div>
                
                {/* Visual Indicator (Optional: color based on severity if available) */}
                <div className={`w-3 h-3 rounded-full ${getSeverityColor(d.diagnosis)}`}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function getSeverityColor(diagnosis) {
    if (!diagnosis) return "bg-gray-300";
    const lower = diagnosis.toLowerCase();
    if (lower.includes("neg") || lower.includes("normal")) return "bg-green-500";
    if (lower.includes("trace")) return "bg-yellow-400";
    if (lower.includes("pos") || lower.includes("high") || lower.includes("+")) return "bg-red-500";
    return "bg-blue-400";
}