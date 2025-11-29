#  Kaelion AI: Smart Urine Test Strip Analyzer and Diagnosis

> **Automating Urinalysis:** Detecting, analyzing, and diagnosing urine dipstick test strips using Edge AI, Computer Vision, and Colorimetry.


# 🔴 LIVE VIDEO DEMO

![Video Thumbnail](https://usercdn.edgeimpulse.com/project821834/26ab975d25a54b60836f61ded658b9a864174616f73564d1bff48fecf1bfbf1d)

![ Click Here to Watch the Video on YouTube](https://youtu.be/Of6aLeaTMEc)

---

##  Project Links
- **Live Project (Edge Impulse):** [View Public Project](https://studio.edgeimpulse.com/public/821834/latest)
- **GitHub Repository:** [Source Code](https://github.com/nnam-droid12/kaelion-ai)
- **Frontend URL.** [Frontend URL](https://kaelion-ai.vercel.app/)

---

##  Table of Contents
1. [Introduction](#-introduction)
2. [Problem Statement](#-problem-statement)
3. [Proposed Solution](#-proposed-solution)
4. [Dataset and Data Curation](#-dataset-and-data-curation)
5. [Pipeline (Impulse) Design](#-pipeline-impulse-design)
6. [Model Training and Parameters](#-model-training-and-parameters)
7. [Experiments & Model Optimization](#-experiments--model-optimization)
8. [Testing and Evaluation](#-testing-and-evaluation)
9. [Deployment and Real-World Application](#-deployment-and-real-world-application)
10. [Results](#-results)
11. [Challenges and Future Work](#-challenges-and-future-work)

---

##  Introduction

Urine dipstick tests are one of the simplest, most cost-effective diagnostic tools used globally. However, the interpretation of these tests relies heavily on **visual comparison**—a process prone to human error, lighting inconsistencies, and subjectivity.

**Kaelion AI** eliminates this ambiguity. By leveraging **Edge Impulse's Object Detection**, we automate the detection of the test strip and reference chart, extract precise color data, and provide an instant, algorithmic diagnosis for conditions like **diabetes, kidney disorders, and UTIs**.

---

##  Problem Statement

Medical personnel and patients currently rely on holding a strip next to a bottle and "eyeballing" the color match.
* **Variable Lighting:** A test read under yellow bulb light looks different than one read under daylight.
* **Human Error:** Fatigue or color vision deficiency can lead to misdiagnosis.
* **Documentation:** No digital record of the visual state of the strip at the time of the test.

**Our Goal:** To create an Edge AI system that "sees" the strip, normalizes the environment, and creates a consistent medical readout.

---

##  Proposed Solution

Our solution is a full-stack Edge AI Web Application:
1.  **Detection:** Uses a **YOLO-based object detection model** to locate the `Urine_Strip` and the `Reference_Chart` within a video feed.
2.  **Extraction:** Dynamically crops the detected regions.
3.  **Diagnosis:** Uses a custom algorithm to compare the RGB/HSV values of the strip against the reference chart to determine the chemical levels.

---

##  Dataset and Data Curation

A high-quality model starts with high-quality data. We curated a custom dataset specifically for this hackathon.

**Data Collection Strategy:**
* **Sources:** Captured using a **Samsung Galaxy** and an **iPhone 12** to ensure the model generalizes across different camera sensors.
* **Environment:** Images were taken in varied lighting (natural sunlight, fluorescent, shadow) and backgrounds (white tables, dark desks, cluttered labs).
* **Volume:** We curated a total of **1,309 images**.

### Data Samples
*Example of iPhone 12 Capture:*
![iphone-image2.jpeg](https://usercdn.edgeimpulse.com/project821834/b5768330683ebb5518c79609c473055053db1fc8b4cd8a23e26887a30ccb1283)

*Example of Samsung Capture:*
![samsung-image.jpeg](https://usercdn.edgeimpulse.com/project821834/edecd5e033f05c6a8576a29dd99bc080456d3ab38c9dfc78e6ba23778c25a185)

*Edge Impulse Data Acquisition View:*
!(https://usercdn.edgeimpulse.com/project821834/de5670ff07857b98a269516e56f7a0bb2d7abf8d1eb4d69d906f73cd48e7f087)

### Labeling Strategy
We utilized **AI-Assisted Labeling** within Edge Impulse to speed up the workflow, identifying two core classes: `Urine_Strip` and `Reference_Chart`.

![AI data labeling](https://usercdn.edgeimpulse.com/project821834/453426c751527ce91b3567375b09b3e48c9586815fed001e304c36b799a0b2e0)

| Dataset Stats | Value |
|:---|:---|
| **Total Images** | 1,309 |
| **Classes** | `Urine_Strip`, `Reference_Chart` |
| **Split** | 80% Training / 20% Testing |

---

##  Pipeline (Impulse) Design

The Impulse (Machine Learning Pipeline) was designed to be lightweight enough for web deployment but accurate enough for medical contexts.

1.  **Image Data:** Resized to **320x320** to preserve small details on the color blocks.
2.  **Image Processing:** RGB Color depth.
3.  **Learning Block:** **YOLO-Pro (Developer Preview)**.

**Why YOLO-Pro?**
We chose YOLO-Pro over FOMO because **localization** is critical. We don't just need to know *if* a strip is there; we need the exact **bounding box coordinates** to crop the image for color analysis. YOLO provides the box width/height required for this logic.

![create-impulse-image.PNG](https://usercdn.edgeimpulse.com/project821834/d012236577770d8dc0619a2f06344510dbf43c4ce7320b71a60d062daeca5f24)

---

## ️ Model Training and Parameters

Training was performed on Edge Impulse's GPU infrastructure using the edge impulse free tier.

| Parameter | Value | Reasoning |
|:---|:---|:---|
| **Model** | YOLO-Pro | Optimized for embedded detection tasks. |
| **Epochs** | 25 | Sufficient for convergence without overfitting. |
| **Learning Rate** | 0.001 | Lower rate chosen for fine-grained feature learning. |
| **Batch Size** | 16 | Optimized for GPU memory constraints. |
| **Data Augmentation** | Enabled | Critical to handle lighting variations in real-world use. |

*Training Results:*
![model-output.PNG](https://usercdn.edgeimpulse.com/project821834/009e3443586721f328708868b691c12f79f1542783f60a22e46d54ff7d016b78)

---

##  Experiments & Model Optimization

A key part of our development was iterating on the dataset to improve performance. We noticed early on that the model struggled to differentiate the **Reference Chart** from complex backgrounds.

### The Experiment: Improving Reference Chart Detection

**Hypothesis:** Increasing the variety of reference chart angles and lighting conditions will improve the model's F1 Score and reduce false negatives.

**Action:**
1.  **Baseline:** We started with **1,156 images**. The model had decent detection for strips but struggled with the chart.
2.  **Intervention:** We captured and annotated an additional **153 images** specifically focused on the `Reference_Chart` in challenging orientations.
3.  **Result:** The total dataset grew to **1,309 images**.

### Visual Proof of Improvement

**1. Baseline Performance (Before Data Injection):**
*The model initially had lower confidence on the chart class.*


![model-output.PNG](https://usercdn.edgeimpulse.com/project821834/8548433976e395dd2660ddbcd86339154c9120f2a98070ce60418bb57c82c7e1)
> *(Above: Initial training results showing lower precision for reference charts)*

**2. Data Injection:**
*We added specific examples of the charts to balance the classes.*


![additional-data-upload-1.PNG](https://usercdn.edgeimpulse.com/project821834/5b523f90f44dbc6532acd6fbf2d875c0b27dc7c6dda66241903e67f5e6ab1153)

![additional-data-upload-2.PNG](https://usercdn.edgeimpulse.com/project821834/be0d339353c4c6f9cc9ac088a3943cdc4d8cbe0bf77978a4b77fa0cccd4bcb16)

**3. Final Performance (After Data Injection):**
*After retraining with the 153 new images, the Precision Score increased significantly, validating our hypothesis.*



![additional-object-detection-yolo-pro-1.PNG](https://usercdn.edgeimpulse.com/project821834/a077273da1d18eb800ff99c2c03c17071da387c5219a286d134946cb5eef013d)

![additional-object-detection-yolo-pro-2.PNG](https://usercdn.edgeimpulse.com/project821834/d92fbd1705c9796d1d41f72d2c855154425946c32fb709c463f1ba3496b9efe4)

![additional-object-detection-yolo-pro-3.PNG](https://usercdn.edgeimpulse.com/project821834/b46065d806724905fe73e72d5a6d24a5727f92e7cb4dd378afaf5a16c85d5ca1)

> *(Above: Final training results showing improved detection confidence)*

---

##  Testing and Evaluation

We validated the model using the separated Test Set (data the model had never seen during training).

* **Testing Accuracy:** 88% (Precision)
* **F1 Score:** 0.88

The high precision is crucial because in a medical context, **false positives** (detecting a strip where there isn't one) can lead to confusing UI behavior.

![model-testing-3.PNG](https://usercdn.edgeimpulse.com/project821834/a47988f8021fad9cefe3e2276ac72423228c9958f80a5cae312f558dc5e4a5ad)

![additional-model-testing-improve-1.PNG](https://usercdn.edgeimpulse.com/project821834/5abd82957f2ee2131ec4d7ec8eaec54b5f285d41790039c4c510aa991cd576b1)

---

##  Deployment and Real-World Application

We deployed the model as a **WebAssembly (Browser WASM)** library to create a privacy-focused, offline-capable web application.

### The Stack
* **Frontend:** React + Vite
* **Inference Engine:** Edge Impulse WASM (Simd)
* **Backend:** FastAPI (for logging results)

### How the Application Works
The model isn't just detecting objects; it drives the logic of the application:
1.  **Search:** The app continuously scans the camera feed.
2.  **Lock:** Once confidence > 85%, the app "locks" onto the strip.
3.  **Analyze:** The bounding box coordinates are used to extracting the average color of the reaction pads.
4.  **Diagnose:** These colors are mapped to clinical values (e.g., Glucose: Negative, Protein: Trace).

*Deployment Build:*
![model-deployment-4.PNG](https://usercdn.edgeimpulse.com/project821834/208f902b6143529be70989a6cfb5935fb74b0df2772b0dc1bf1576caed9092fa)

---

##  Results

| Metric | Outcome |
|:---|:---|
| **Inference Time** | ~250ms (Browser/Mobile) |
| **Model Size** | 10.1 MB (Unoptimized Float32) |
| **Detection Accuracy** | ~88% |

This project successfully demonstrates that expensive, proprietary automated urinalysis machines can be replaced by a smartphone and a robust Edge AI model.

---

##  Challenges and Future Work

* **Lighting Normalization:** Extreme shadow still affects the *color analysis* logic, even if detection works. Future work involves integrating OpenCV for histogram equalization.
* **Segmentation:** Moving from Bounding Boxes (YOLO) to Segmentation (Mask R-CNN) would allow for pixel-perfect isolation of the circular reaction pads.

---

## Repository and References

- **GitHub Repository:** [Kaelion AI](https://github.com/nnam-droid12/kaelion-ai)
- **Edge Impulse Project:** [Live Project](https://studio.edgeimpulse.com/public/821834/latest)

---

> *Developed for the Global Edge AI Hackathon.*