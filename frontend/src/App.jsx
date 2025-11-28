import React, { useState } from "react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StripAnalyzer from "./components/StripAnalyzer";
import DiagnosisCard from "./components/DiagnosisCard";

function App() {
  const [diagnosis, setDiagnosis] = useState(null);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <div className="flex-1 flex flex-col bg-[#F7F9FC]">
        <Header />

        <main className="p-6 flex-1 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            <div className="lg:col-span-2">
              <StripAnalyzer onResult={setDiagnosis} />
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
