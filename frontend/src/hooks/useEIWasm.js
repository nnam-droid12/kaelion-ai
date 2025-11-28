
import { useEffect, useState, useRef } from "react";

function waitForEI(timeout = 5000, interval = 100) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (window?.EI) return resolve(window.EI);
      if (Date.now() - start > timeout) return reject(new Error("window.EI not found"));
      setTimeout(check, interval);
    };
    check();
  });
}

export default function useEIWasm() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const runnerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      console.log("[useEIWasm] waiting for window.EI...");
      try {
        await waitForEI(8000, 100);
        console.log("[useEIWasm] window.EI found");

       
        console.log("[useEIWasm] calling window.EI.loadImpulse()");
        const instance = await window.EI.loadImpulse({
          wasm: "/ei-wasm/edge-impulse-standalone.wasm"
        });

        
        runnerRef.current = instance;
        if (!cancelled) {
          console.log("[useEIWasm] EI loaded:", instance);
          setReady(true);
        }
      } catch (err) {
        console.error("[useEIWasm] load error:", err);
        if (!cancelled) setError(err.message || String(err));
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  
  async function runInference(imageData) {
    if (!runnerRef.current) {
      throw new Error("Runner not ready");
    }
    try {
      
      if (typeof runnerRef.current.classify === "function") {
        const res = await runnerRef.current.classify(imageData);
        console.log("[useEIWasm] inference result", res);
        return res;
      } else if (typeof runnerRef.current.run === "function") {
        const res = await runnerRef.current.run(imageData);
        console.log("[useEIWasm] inference result (run)", res);
        return res;
      } else {
        throw new Error("runner has no classify/run method — open console to inspect runner object");
      }
    } catch (err) {
      console.error("[useEIWasm] inference error:", err);
      throw err;
    }
  }

  return { ready, error, runInference, runner: runnerRef.current };
}
