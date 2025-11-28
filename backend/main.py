# main.py
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import numpy as np
import cv2
import math
from sklearn.cluster import KMeans
import io
import base64

# -----------------------
# Config / thresholds
# -----------------------
PAD_MIN_AREA = 350
MAX_MATCH_DISTANCE = 18.0
LOW_CONF_DISTANCE = 30.0

ANALYTE_ORDER = [
    "Leukocytes", "Nitrites", "Urobilinogen", "Protein", "pH",
    "Blood", "SpecificGravity", "Ketone", "Bilirubin", "Glucose"
]

DIAGNOSIS_TEXT = {
    "Leukocytes": "UTI / urinary tract inflammation (leukocytes present)",
    "Nitrites": "Bacteriuria - indicative of urinary tract infection (nitrites positive)",
    "Urobilinogen": "Elevated urobilinogen -  liver disease or hemolysis",
    "Protein": "Proteinuria -  kidney damage or disease",
    "pH": "Abnormal urinary pH - acid-base imbalance",
    "Blood": "Hematuria - blood in urine ( kidney/urinary tract bleeding)",
    "SpecificGravity": "Abnormal urine concentration - check hydration or kidney function",
    "Ketone": "Ketones present - abnormal fat metabolism (check for diabetes/ketoacidosis)",
    "Bilirubin": "Bilirubin present - liver dysfunction or bile duct problem",
    "Glucose": "Glucosuria - elevated urinary glucose (suggestive of diabetes)"
}

# -----------------------
# FastAPI + CORS
# -----------------------
app = FastAPI(title="Kaelion-AI Urine Diagnosis API")

# Allow your frontend origin here (or * for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: replace '*' with your site URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------
# Utility functions
# -----------------------
def rgb_to_lab_vector(rgb_tuple):
    """Convert (r,g,b) 0-255 to LAB using OpenCV (returns float triple)."""
    r, g, b = rgb_tuple
    arr = np.uint8([[[b, g, r]]])
    lab = cv2.cvtColor(arr, cv2.COLOR_BGR2LAB)[0,0].astype(float)
    return lab

# CIEDE2000 implementation (from your original code)
def _deg2rad(deg):
    return deg * (math.pi / 180.0)
def _rad2deg(rad):
    return rad * (180.0 / math.pi)

def ciede2000(Lab_1, Lab_2):
    L1, a1, b1 = float(Lab_1[0]), float(Lab_1[1]), float(Lab_1[2])
    L2, a2, b2 = float(Lab_2[0]), float(Lab_2[1]), float(Lab_2[2])
    avg_L = 0.5*(L1+L2)
    C1 = math.sqrt(a1*a1 + b1*b1)
    C2 = math.sqrt(a2*a2 + b2*b2)
    avg_C = 0.5*(C1+C2)
    G = 0.5*(1 - math.sqrt((avg_C**7)/(avg_C**7 + 25**7)))
    a1p = (1+G)*a1
    a2p = (1+G)*a2
    C1p = math.sqrt(a1p*a1p + b1*b1)
    C2p = math.sqrt(a2p*a2p + b2*b2)
    h1p = math.atan2(b1, a1p) if C1p != 0 else 0.0
    h2p = math.atan2(b2, a2p) if C2p != 0 else 0.0
    if h1p < 0: h1p += 2*math.pi
    if h2p < 0: h2p += 2*math.pi
    dLp = L2 - L1
    dCp = C2p - C1p
    dhp = 0.0
    if C1p*C2p == 0:
        dhp = 0.0
    else:
        dh = h2p - h1p
        if abs(dh) <= math.pi:
            dhp = dh
        elif dh > math.pi:
            dhp = dh - 2*math.pi
        else:
            dhp = dh + 2*math.pi
    dHp = 2 * math.sqrt(C1p*C2p) * math.sin(dhp/2.0)
    avg_Lp = 0.5*(L1 + L2)
    avg_Cp = 0.5*(C1p + C2p)
    if C1p*C2p == 0:
        avg_hp = h1p + h2p
    else:
        dh = abs(h1p - h2p)
        if dh <= math.pi:
            avg_hp = 0.5*(h1p + h2p)
        else:
            if (h1p + h2p) < 2*math.pi:
                avg_hp = 0.5*(h1p + h2p + 2*math.pi)
            else:
                avg_hp = 0.5*(h1p + h2p - 2*math.pi)
    T = (1 - 0.17*math.cos(avg_hp - _deg2rad(30)) +
         0.24*math.cos(2*avg_hp) +
         0.32*math.cos(3*avg_hp + _deg2rad(6)) -
         0.20*math.cos(4*avg_hp - _deg2rad(63)))
    delta_ro = 30 * math.exp(-(((_rad2deg(avg_hp) - 275)/25.0)**2))
    RC = 2 * math.sqrt((avg_Cp**7)/(avg_Cp**7 + 25**7))
    SL = 1 + (0.015*((avg_Lp - 50)**2))/math.sqrt(20 + ((avg_Lp - 50)**2))
    SC = 1 + 0.045*avg_Cp
    SH = 1 + 0.015*avg_Cp*T
    RT = -math.sin(_deg2rad(2*delta_ro))*RC
    KL = KC = KH = 1.0
    deltaE = math.sqrt((dLp/(KL*SL))**2 + (dCp/(KC*SC))**2 + (dHp/(KH*SH))**2 + RT*(dCp/(KC*SC))*(dHp/(KH*SH)))
    return float(deltaE)

# -----------------------
# Chart patch extraction (similar to original)
# -----------------------
def extract_patches_from_chart_image(img_bgr, expected_patches=30):
    img = img_bgr.copy()
    h, w = img.shape[:2]
    blur = cv2.GaussianBlur(img, (3,3), 0)
    lab = cv2.cvtColor(blur, cv2.COLOR_BGR2LAB)
    samples = lab.reshape((-1,3)).astype(np.float32)
    K = min(40, max(6, expected_patches))
    km = KMeans(n_clusters=K, random_state=0).fit(samples)
    labels = km.labels_.reshape((h, w))
    patches = []
    for i in range(km.cluster_centers_.shape[0]):
        mask = (labels == i).astype(np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5,5), np.uint8))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7,7), np.uint8))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < PAD_MIN_AREA:
                continue
            x,y,ww,hh = cv2.boundingRect(cnt)
            crop = img[y:y+hh, x:x+ww]
            mean_bgr = cv2.mean(crop)[:3]
            mean_lab = cv2.cvtColor(np.uint8([[mean_bgr]]), cv2.COLOR_BGR2LAB).reshape(3).astype(float)
            patches.append({'bbox':(int(x),int(y),int(ww),int(hh)), 'lab':mean_lab.tolist(), 'mean_bgr':[float(mean_bgr[2]), float(mean_bgr[1]), float(mean_bgr[0])], 'area':area})
    patches_sorted = sorted(patches, key=lambda p: (p['bbox'][1], p['bbox'][0]))
    return patches_sorted

def prepare_reference_mapping_from_image_bytes(img_bytes, expected_rows=10):
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image bytes")
    patches = extract_patches_from_chart_image(img, expected_patches=40)
    if not patches:
        raise RuntimeError("No patches found in chart image - try a clearer crop.")
    centers = np.array([p['bbox'][1] + p['bbox'][3]/2 for p in patches]).reshape(-1,1)
    try:
        km = KMeans(n_clusters=min(expected_rows, max(2, len(patches))), random_state=0).fit(centers)
        labels = km.labels_
        row_groups = {}
        for i,lab in enumerate(labels):
            row_groups.setdefault(int(lab), []).append(patches[i])
        ordered_rows = sorted(row_groups.items(), key=lambda kv: np.mean([p['bbox'][1] for p in kv[1]]))
        mapping = {}
        for idx,(row_id, plist) in enumerate(ordered_rows):
            analyte = ANALYTE_ORDER[idx] if idx < len(ANALYTE_ORDER) else f"custom_{idx}"
            plist_sorted = sorted(plist, key=lambda p: p['bbox'][0])
            levels = []
            for j, p in enumerate(plist_sorted):
                label = f"level_{j}"
                labvec = p['lab']
                levels.append((label, labvec))
            mapping[analyte] = levels
        return mapping
    except Exception:
        mapping = {}
        N = len(ANALYTE_ORDER)
        per_row = max(1, len(patches)//N)
        for i, analyte in enumerate(ANALYTE_ORDER):
            slice_start = i*per_row
            slice_end = slice_start + per_row
            slice_patches = patches[slice_start:slice_end]
            levels = [(f"level_{j}", p['lab']) for j,p in enumerate(slice_patches)]
            mapping[analyte] = levels
        return mapping

# -----------------------
# Matching & interpreting
# -----------------------
def match_lab_to_levels(lab_vec, reference_levels):
    best_d = float('inf')
    best_label = None
    for lbl, lab_ref in reference_levels:
        d = ciede2000(lab_vec, lab_ref)
        if d < best_d:
            best_d = d
            best_label = lbl
    return best_label, best_d

def interpret_match_labels(match_dict):
    diagnoses = []
    confidences = {}
    for analyte, (lbl, dist) in match_dict.items():
        if lbl is None:
            confidences[analyte] = 0.0
            continue
        level_num = 0
        if isinstance(lbl, str) and lbl.startswith("level_"):
            try:
                level_num = int(lbl.split("_")[1])
            except:
                level_num = 0
        if dist <= MAX_MATCH_DISTANCE:
            conf = max(0.6, 1.0 - dist/(MAX_MATCH_DISTANCE*1.6))
        elif dist <= LOW_CONF_DISTANCE:
            conf = 0.35
        else:
            conf = 0.08
        confidences[analyte] = conf
        if level_num == 0:
            continue
        diag_text = DIAGNOSIS_TEXT.get(analyte, f"{analyte} abnormal")
        severity = ""
        if level_num == 1:
            severity = " (trace/small)"
        elif level_num == 2:
            severity = " (small/moderate)"
        elif level_num >= 3:
            severity = " (moderate/large)"
        diagnoses.append({"analyte": analyte, "diagnosis": diag_text + severity, "confidence": round(conf,2), "level": level_num})
    return diagnoses, confidences

# -----------------------
# API models
# -----------------------
class PadRGB(BaseModel):
    r: float
    g: float
    b: float

class DiagnoseRequest(BaseModel):
    pads: List[PadRGB]  # ordered top→bottom, one entry per analyte/pad
    ref_map: Optional[Dict[str, List[List[Any]]]] = None  
    # ref_map format: analyte -> [ [label, [L,a,b]], ... ]

# -----------------------
# Endpoints
# -----------------------
@app.post("/calibrate")
async def calibrate_chart(file: UploadFile = File(...), expected_rows: int = len(ANALYTE_ORDER)):
    """
    Upload reference chart image (multipart file). Returns a mapping analyte -> [(label, [L,a,b]), ...]
    Save this mapping client-side (frontend) and send it with /diagnose calls.
    """
    content = await file.read()
    try:
        mapping = prepare_reference_mapping_from_image_bytes(content, expected_rows=expected_rows)
       
        return {"status":"ok", "mapping": mapping}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/diagnose")
async def diagnose(req: DiagnoseRequest):
    """
    Diagnose from pads (list of RGBs) and a ref_map.
    Pads must be ordered top-to-bottom matching ANALYTE_ORDER.
    """
    if not req.ref_map:
        raise HTTPException(status_code=400, detail="ref_map required. Call /calibrate first or provide mapping.")

    # convert ref_map values to list of (label, labvec)
    prepared_ref = {}
    for analyte, levels in req.ref_map.items():
        prepared_ref[analyte] = [(lbl, np.array(lab).astype(float)) for lbl, lab in levels]

    match_results = {}
    for i, pad in enumerate(req.pads):
        analyte = ANALYTE_ORDER[i] if i < len(ANALYTE_ORDER) else f"custom_{i}"
        labvec = rgb_to_lab_vector((pad.r, pad.g, pad.b))
        refs = prepared_ref.get(analyte, [])
        if not refs:
            match_results[analyte] = (None, float('inf'))
            continue
        best_lbl, best_d = match_lab_to_levels(labvec, refs)
        match_results[analyte] = (best_lbl, float(best_d))

    diagnoses, confidences = interpret_match_labels(match_results)
    return {"status":"ok", "matches": match_results, "diagnoses": diagnoses, "confidences": confidences}

@app.get("/")
async def root():
    return {"status":"ok", "info":"Kaelion-AI Urine Diagnosis API"}

# Entry point for uvicorn
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
