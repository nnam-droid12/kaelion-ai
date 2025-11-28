import React, { useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import CameraCard from "./components/CameraCard";
import AnalyzerCard from "./components/AnalyzerCard";
import DiagnosisCard from "./components/DiagnosisCard";
import { diagnosePads } from "./api/eiApi";

function App() {
  const camRef = useRef();
  const [captured, setCaptured] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);
  const [refMap, setRefMap] = useState(null);

  const handleCapture = (img) => {
    setCaptured(img);
    setDiagnosis(null);
  };

  
  const handleMappingUpdated = (mapping) => {
    setRefMap(mapping);
    console.log("Saved reference mapping:", mapping);
  };

  
  const handleDiagnosisRequest = async ({ pads }) => {
    if (!refMap) {
      alert("No calibration found — please Calibrate the reference chart first.");
      return;
    }
    try {
      const res = await diagnosePads(pads, refMap);
      if (res && res.diagnoses) {
      
        setDiagnosis(res.diagnoses);
      } else {
        setDiagnosis([{ analyte: "error", diagnosis: "No diagnoses returned", confidence: 0 }]);
      }
      return res;
    } catch (err) {
      console.error(err);
      alert("Diagnosis API failed: " + (err.message || err));
      return null;
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col bg-[#F7F9FC]">
        <Header />

        <main className="p-6 flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="lg:col-span-1">
              <CameraCard ref={camRef} onCapture={handleCapture} />
            </div>

            <div className="lg:col-span-1">
              <AnalyzerCard
                imageDataUrl={captured}
                onMappingUpdated={handleMappingUpdated}
                onDiagnosis={handleDiagnosisRequest}
              />
            </div>

            <div className="lg:col-span-1">
              <DiagnosisCard diagnosis={diagnosis} />
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
