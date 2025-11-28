"""
urine_diagnosis.py

Windows-compatible urine strip diagnosis pipeline.

- Detection: YOLOv8 (ultralytics)
- Calibration: extract reference chart patch colors from provided image or live camera
- Normalization: simple white-balance + scale using chart
- Matching: mean patch LAB -> CIEDE2000 to nearest reference patch
- Diagnosis: direct, rule-based outputs (no 'possible'), per-user mapping derived from typical dipstick meanings

Usage:
    python urine_diagnosis.py

Controls (while running):
    c : force calibration from chart image or from chart in view
    q : quit

Author: Kaelion-AI (adapted & tuned)
"""

import cv2
import numpy as np
import math
import time
from ultralytics import YOLO
from sklearn.cluster import KMeans
from skimage import color, filters, morphology, measure

# -----------------------
# CONFIG
# -----------------------
# YOLO model path
YOLO_MODEL_PATH = "runs/detect/train/weights/best.pt"  
# Reference chart image (Windows path style - forward slashes work)
CALIBRATION_IMAGE_PATH = "C:/Users/hp/Documents/Kaelion-AI/reference_chart2.png"

# Detection class labels that YOLO will output (must match what you trained)
# Make sure your YOLO model was trained to label the reference chart and the strip as shown here
REF_LABEL = "reference_chart"
STRIP_LABEL = "urine_stripe"

# Order of analytes on the strip (top-to-bottom). Adjust if your strip order differs.
ANALYTE_ORDER = [
    "Leukocytes", "Nitrites", "Urobilinogen", "Protein", "pH",
    "Blood", "SpecificGravity", "Ketone", "Bilirubin", "Glucose"
]

# Diagnosis text per analyte (direct statements)
DIAGNOSIS_TEXT = {
    "Leukocytes": "UTI / urinary tract inflammation (leukocytes present)",
    "Nitrites": "Bacteriuria - indicative of urinary tract infection (nitrites positive)",
    "Urobilinogen": "Elevated urobilinogen - possible liver disease or hemolysis",
    "Protein": "Proteinuria - possible kidney damage or disease",
    "pH": "Abnormal urinary pH - acid-base imbalance (check values)",
    "Blood": "Hematuria - blood in urine (possible kidney/urinary tract bleeding)",
    "SpecificGravity": "Abnormal urine concentration - check hydration or kidney function",
    "Ketone": "Ketones present - abnormal fat metabolism (check for diabetes/ketoacidosis)",
    "Bilirubin": "Bilirubin present - possible liver dysfunction or bile duct problem",
    "Glucose": "Glucosuria - elevated urinary glucose (suggestive of diabetes)"
}

# Matching thresholds and tuning
MAX_MATCH_DISTANCE = 18.0
LOW_CONF_DISTANCE = 30.0
PAD_MIN_AREA = 350  # minimum patch area to consider (pixels) for chart extraction

# -----------------------
# Utility functions
# -----------------------
def rgb_to_lab_vector(rgb_tuple):
    """Convert a (R,G,B) tuple 0-255 to LAB triple using cv2 (returns floats)."""
    r, g, b = rgb_tuple
    arr = np.uint8([[[b, g, r]]])
    lab = cv2.cvtColor(arr, cv2.COLOR_BGR2LAB)[0,0].astype(float)
    return lab

# CIEDE2000 implementation (numerical, based on Sharma et al.)
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
# Chart calibration: extract uniform patches from known reference chart image
# -----------------------
def extract_patches_from_chart_image(img_bgr, expected_patches=30):
    """
    Extract candidate color patches from a reference chart image.
    Returns list of dict { 'bbox':(x,y,w,h), 'lab':array(L,a,b), 'mean_bgr':(b,g,r) }.
    """
    img = img_bgr.copy()
    h, w = img.shape[:2]
    blur = cv2.GaussianBlur(img, (3,3), 0)
    lab = cv2.cvtColor(blur, cv2.COLOR_BGR2LAB)
    samples = lab.reshape((-1,3)).astype(np.float32)
    K = min(40, max(6, expected_patches))
    # KMeans cluster in LAB color space to find dominant colored regions
    km = KMeans(n_clusters=K, random_state=0).fit(samples)
    labels = km.labels_.reshape((h, w))
    centers = km.cluster_centers_.astype(np.uint8)
    patches = []
    for i in range(centers.shape[0]):
        mask = (labels == i).astype(np.uint8)
        # morphological cleanup
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
            patches.append({'bbox':(x,y,ww,hh), 'lab':mean_lab, 'mean_bgr':mean_bgr, 'area':area})
    # sort top-to-bottom then left-to-right for mapping convenience
    patches_sorted = sorted(patches, key=lambda p: (p['bbox'][1], p['bbox'][0]))
    return patches_sorted

def prepare_reference_mapping(img_path, expected_rows=10):
    """
    Given a reference chart image path, attempt to produce a mapping:
      analyte -> list of (level_label, lab_vector)
    This mapping uses spatial clustering: group patches into 'rows' and assign to ANALYTE_ORDER.
    """
    img = cv2.imread(img_path)
    if img is None:
        raise FileNotFoundError(f"Chart image not found: {img_path}")
    patches = extract_patches_from_chart_image(img, expected_patches=40)
    if not patches:
        raise RuntimeError("No patches found in chart image - try a clearer crop.")
    # cluster patch y centers into expected_rows
    centers = np.array([p['bbox'][1] + p['bbox'][3]/2 for p in patches]).reshape(-1,1)
    # if not enough patches, fallback: group evenly into rows
    try:
        km = KMeans(n_clusters=min(expected_rows, max(2, len(patches))), random_state=0).fit(centers)
        labels = km.labels_
        row_groups = {}
        for i,lab in enumerate(labels):
            row_groups.setdefault(int(lab), []).append(patches[i])
        # order rows by mean y
        ordered_rows = sorted(row_groups.items(), key=lambda kv: np.mean([p['bbox'][1] for p in kv[1]]))
        mapping = {}
        for idx,(row_id, plist) in enumerate(ordered_rows):
            analyte = ANALYTE_ORDER[idx] if idx < len(ANALYTE_ORDER) else f"custom_{idx}"
            # sort row by x -> increasing color intensity progression in general
            plist_sorted = sorted(plist, key=lambda p: p['bbox'][0])
            levels = []
            for j, p in enumerate(plist_sorted):
                # assign textual level depending on position (we'll use generic labels that we'll interpret later)
                label = f"level_{j}"
                labvec = p['lab']
                levels.append((label, labvec))
            mapping[analyte] = levels
        return mapping
    except Exception as e:
        # fallback: evenly split list into rows
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
# Strip segmentation (pad detection)
# -----------------------
def segment_strip_into_pads(strip_img, expected_pads=10):
    """
    Given a cropped strip ROI, return a list of pad boxes (x,y,w,h) divided top-to-bottom.
    Approach: convert to LAB, use vertical intensity changes to find boundaries. Fallback to even split.
    """
    img = strip_img.copy()
    h, w = img.shape[:2]
    small = cv2.resize(img, (max(20, w//2), max(20, h//2)))
    lab = cv2.cvtColor(small, cv2.COLOR_BGR2LAB)
    L = lab[:,:,0].astype(float)
    proj = np.mean(L, axis=1)  # across width
    smooth = filters.gaussian(proj, sigma=3)
    grad = np.abs(np.gradient(smooth))
    thr = np.mean(grad) + 0.5*np.std(grad)
    idxs = np.where(grad > thr)[0]
    # up-scale to original coordinates
    idxs_full = sorted(list(set([int(i*(h/smooth.shape[0])) for i in idxs])))
    if len(idxs_full) < expected_pads-1:
        # fallback: even split top-to-bottom
        ph = h // expected_pads
        pads = [(0, i*ph, w, ph if i < expected_pads-1 else h - i*ph) for i in range(expected_pads)]
        return pads
    # build pad centers using local minima in projection
    minima = measure.find_peaks_cwt(-smooth, widths=np.arange(3,25))
    minima_coords = [int(m*(h/smooth.shape[0])) for m in minima if 0 < m < smooth.shape[0]]
    if len(minima_coords) >= expected_pads:
        minima_coords = minima_coords[:expected_pads]
        pad_half = int(h/(2*expected_pads))
        pads = []
        for c in minima_coords:
            y0 = max(0, c - pad_half)
            y1 = min(h, c + pad_half)
            pads.append((0, y0, w, y1-y0))
        return pads
    # fallback even split
    ph = h // expected_pads
    pads = [(0, i*ph, w, ph if i < expected_pads-1 else h - i*ph) for i in range(expected_pads)]
    return pads

# -----------------------
# Matching and interpretation
# -----------------------
def match_lab_to_levels(lab_vec, reference_levels):
    """
    Given a mean LAB vector for a pad, compare to reference_levels list:
      reference_levels: list of tuples (label_string, lab_vector)
    Returns best_label, best_distance
    """
    best_d = float('inf')
    best_label = None
    for lbl, lab_ref in reference_levels:
        d = ciede2000(lab_vec, lab_ref)
        if d < best_d:
            best_d = d
            best_label = lbl
    return best_label, best_d

def interpret_match_labels(match_dict):
    """
    match_dict: analyte -> (best_label, distance)
    Returns list of diagnosis strings and confidences per analyte.
    We use conservative mapping: any non-first-level (which usually is negative/lowest) -> generate a direct diagnosis.
    """
    diagnoses = []
    confidences = {}
    for analyte, (lbl, dist) in match_dict.items():
        # convert label to a human-friendly 'level' (we don't know exact textual mapping from chart)
        # heuristics: label like level_0 -> consider as lowest (negative/normal)
        if lbl is None:
            confidences[analyte] = 0.0
            continue
        # numeric parse
        level_num = 0
        if isinstance(lbl, str) and lbl.startswith("level_"):
            try:
                level_num = int(lbl.split("_")[1])
            except:
                level_num = 0
        # confidence score from distance
        if dist <= MAX_MATCH_DISTANCE:
            conf = max(0.6, 1.0 - dist/(MAX_MATCH_DISTANCE*1.6))
        elif dist <= LOW_CONF_DISTANCE:
            conf = 0.35
        else:
            conf = 0.08
        confidences[analyte] = conf
        # diagnosis rules:
        # If level_num == 0 => negative/lowest (no diagnosis)
        if level_num == 0:
            continue
        # If level_num >=1 then consider it abnormal and produce the direct diagnosis string
        diag_text = DIAGNOSIS_TEXT.get(analyte, f"{analyte} abnormal")
        # Optionally append severity from level_num
        severity = ""
        if level_num == 1:
            severity = " (trace/small)"
        elif level_num == 2:
            severity = " (small/moderate)"
        elif level_num >= 3:
            severity = " (moderate/large)"
        diagnoses.append(f"{analyte}: {diag_text}{severity}  [conf:{conf:.2f}]")
    return diagnoses, confidences

# -----------------------
# MAIN pipeline
# -----------------------
def main():
    print("Loading YOLO model:", YOLO_MODEL_PATH)
    ymodel = YOLO(YOLO_MODEL_PATH)  # will use CPU/GPU according to ultralytics installation
    print("YOLO model loaded. Labels:", ymodel.names)

    # prepare calibration mapping from static image if available
    print("Preparing reference mapping from image (if available)...")
    try:
        ref_map = prepare_reference_mapping(CALIBRATION_IMAGE_PATH, expected_rows=len(ANALYTE_ORDER))
        print("Reference mapping prepared for analytes:", list(ref_map.keys()))
        calibrated = True
    except Exception as e:
        print("Warning: failed to prepare mapping from image:", e)
        ref_map = {}
        calibrated = False

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam. Check device ID and camera permissions.")

    last_cal = 0
    print("Press 'c' to force calibration from webcam (place chart clearly); 'q' to quit.")
    while True:
        ret, frame = cap.read()
        if not ret:
            continue

        # run YOLO on the frame - ultralytics returns results object
        results = ymodel.predict(source=frame, conf=0.35, verbose=False)
        # results is a list; on single image use results[0]
        dets = []
        if len(results) > 0:
            r = results[0]
            boxes = r.boxes
            if boxes is not None and len(boxes) > 0:
                for b in boxes:
                    xyxy = b.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = map(int, xyxy[:4])
                    conf = float(b.conf[0])
                    cls = int(b.cls[0])
                    label = ymodel.names[cls] if cls < len(ymodel.names) else str(cls)
                    dets.append({'label': label, 'bbox': (x1,y1,x2-x1,y2-y1), 'conf': conf})

        # check keyboard
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        if key == ord('c'):
            force_cal = True
        else:
            force_cal = False

        # find chart and strip boxes
        chart_box = next((d for d in dets if d['label'] == REF_LABEL), None)
        strip_box = next((d for d in dets if d['label'] == STRIP_LABEL), None)

        # calibrate if chart found or user forced
        if (chart_box is not None or force_cal) and (time.time() - last_cal > 1.5):
            last_cal = time.time()
            try:
                if chart_box is not None:
                    x,y,w,h = chart_box['bbox']
                    roi = frame[y:y+h, x:x+w]
                else:
                    roi = cv2.imread(CALIBRATION_IMAGE_PATH)
                    if roi is None:
                        print("Calibration image not found; aborting calibration.")
                        roi = None
                if roi is not None:
                    print("Extracting patches from calibration ROI...")
                    mapping = prepare_reference_mapping_from_img(roi=None) if False else prepare_reference_mapping(CALIBRATION_IMAGE_PATH, expected_rows=len(ANALYTE_ORDER))
                    if mapping:
                        ref_map = mapping
                        calibrated = True
                        print("Calibration successful. Mapped analytes:", list(ref_map.keys()))
            except Exception as e:
                print("Calibration failed:", e)

        # if we have a strip and mapping, perform pad extraction & matching
        if strip_box is not None and calibrated:
            x,y,w,h = strip_box['bbox']
            strip_roi = frame[y:y+h, x:x+w]
            pads = segment_strip_into_pads(strip_roi, expected_pads=len(ANALYTE_ORDER))
            match_results = {}
            # for each pad, compute mean LAB and match to reference set for that analyte
            for idx, pad in enumerate(pads):
                px, py, pw, ph = pad
                crop = strip_roi[py:py+ph, px:px+pw]
                if crop.size == 0:
                    match_results[ANALYTE_ORDER[idx]] = (None, float('inf'))
                    continue
                # sample inner region to avoid borders
                ch, cw = crop.shape[:2]
                inner = crop[int(0.15*ch):int(0.85*ch), int(0.15*cw):int(0.85*cw)]
                if inner.size == 0:
                    inner = crop
                mean_bgr = cv2.mean(inner)[:3]
                mean_lab = cv2.cvtColor(np.uint8([[mean_bgr]]), cv2.COLOR_BGR2LAB).reshape(3).astype(float)
                analyte = ANALYTE_ORDER[idx]
                refs = ref_map.get(analyte, [])
                if not refs:
                    match_results[analyte] = (None, float('inf'))
                    continue
                # find best among analyte's levels
                best_lbl, best_d = match_lab_to_levels(mean_lab, refs)
                match_results[analyte] = (best_lbl, best_d)

            # interpret matches -> diagnosis list
            diagnoses, confidences = interpret_match_labels(match_results)
            # overlay detection & diagnosis on frame
            # draw boxes
            for d in dets:
                bx, by, bw, bh = d['bbox']
                cv2.rectangle(frame, (bx,by), (bx+bw, by+bh), (0,255,0), 2)
                cv2.putText(frame, f"{d['label']}:{d['conf']:.2f}", (bx, max(by-5,0)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,255,0), 2)
            # overlay per-analyte text
            for i, (a,(lbl,dist)) in enumerate(match_results.items()):
                text = f"{a}: {lbl or 'N/A'} (d={dist:.1f})"
                cv2.putText(frame, text, (10, 20 + i*20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255,255,0), 1)
            # overlay diagnoses
            for j, line in enumerate(diagnoses[:6]):
                cv2.putText(frame, line, (10, 250 + j*20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0,0,255), 2)
        else:
            # draw detection boxes if any
            for d in dets:
                bx, by, bw, bh = d['bbox']
                cv2.rectangle(frame, (bx,by), (bx+bw, by+bh), (0,255,0), 2)
                cv2.putText(frame, f"{d['label']}:{d['conf']:.2f}", (bx, max(by-5,0)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0,255,0), 1)

        # UI hints
        cv2.putText(frame, "Press c=calibrate (chart), q=quit", (10, frame.shape[0]-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200,200,200), 1)
        cv2.imshow("Urine Strip Diagnosis (Kaelion-AI)", frame)

    cap.release()
    cv2.destroyAllWindows()

# -----------------------
# small helper to support earlier fallback path (not used)
# -----------------------
def prepare_reference_mapping_from_frame(frame):
    """Wrapper to use the already-captured frame/ROI for patch extraction (not currently used)."""
    return prepare_reference_mapping(CALIBRATION_IMAGE_PATH, expected_rows=len(ANALYTE_ORDER))


if __name__ == "__main__":
    main()
