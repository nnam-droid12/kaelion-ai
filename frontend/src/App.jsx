import React, { useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import CameraCard from "./components/CameraCard";
import AnalyzerCard from "./components/AnalyzerCard";
import DiagnosisCard from "./components/DiagnosisCard";

function App() {
  const camRef = useRef();
  const [captured, setCaptured] = useState(null);
  const [diagnosis, setDiagnosis] = useState(null);

  const handleCapture = (img) => {
    setCaptured(img);
    setDiagnosis(null);
    // TODO: run inference + diagnosis logic
    // setDiagnosis([...]);
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
              <AnalyzerCard imageDataUrl={captured} />
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
