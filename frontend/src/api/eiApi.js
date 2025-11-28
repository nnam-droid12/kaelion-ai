const BASE = "https://kaelion-ai.onrender.com"; 

export async function calibrateChartFromDataUrl(dataUrl) {
 
  const blob = dataURLtoBlob(dataUrl);
  const fd = new FormData();
  fd.append("file", blob, "chart.jpg");
  const resp = await fetch(`${BASE}/calibrate?expected_rows=10`, {
    method: "POST",
    body: fd,
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Calibrate failed: ${resp.status} ${txt}`);
  }
  return resp.json();
}

export async function diagnosePads(padsArray, refMap) {
  
  const body = {
    pads: padsArray.map(p => ({ r: p.r, g: p.g, b: p.b })),
    ref_map: refMap
  };
  const resp = await fetch(`${BASE}/diagnose`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Diagnose failed: ${resp.status} ${txt}`);
  }
  return resp.json();
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
