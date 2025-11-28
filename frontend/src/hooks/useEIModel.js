import { useEffect, useState } from "react";

export default function useEIModel() {
  const [model, setModel] = useState(null);

  useEffect(() => {
    async function load() {
      if (!window.EI) {
        console.error("EI script not loaded");
        return;
      }

      console.log("Loading WASM model...");

      try {
        const instance = await window.EI.loadImpulse({
          wasm: "/ei-wasm/edge-impulse-standalone.wasm"
        });

        console.log("Model loaded:", instance);
        setModel(instance);
      } catch (err) {
        console.error("Error loading WASM model:", err);
      }
    }

    load();
  }, []);

  return model;
}
