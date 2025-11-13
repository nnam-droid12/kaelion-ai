#  Kaelion AI: Smart Urine Test Strip Analyzer and Diagnosis

> Detecting, analyzing, and diagnosing urine dipstick test strips using Edge AI and color analysis.

---

## project public link: 
[View the project on Edge Impulse](https://studio.edgeimpulse.com/public/821834/latest)


## Github Repository: 
[Github Repository](https://github.com/nnam-droid12/kaelion-ai)

##  Table of Contents

1. [Introduction](#introduction)
2. [Problem Statement](#problem-statement)
3. [Proposed Solution](#proposed-solution)
4. [Dataset and Data Curation](#dataset-and-data-curation)
5. [Pipeline (Impulse) Design](#pipeline-impulse-design)
6. [Model Training and Parameters](#model-training-and-parameters)
7. [Testing and Evaluation](#testing-and-evaluation)
8. [Deployment and Real-World Inference](#deployment-and-real-world-inference)
9. [Results](#results)
10. [Challenges and Future Work](#challenges-and-future-work)
11. [Repository and References](#repository-and-references)

---

##  Introduction

Urine dipstick tests are one of the simplest and most cost-effective diagnostic tools used in medical labs and at home.  
However, **manual interpretation** of the color changes on the strip can lead to **human error** and **inconsistent diagnosis**.

**Kaelion AI** introduces an automated approach to detecting urine test strips, analyzing their color reactions, and comparing them with reference charts to predict possible health conditions such as **diabetes, kidney disorders, or urinary infections** powered by Edge Impulse.

---

##  Problem Statement

Medical personnel and patients often rely on **visual comparison** between a urine test strip and a printed color reference chart.  
Lighting conditions, camera quality, and human perception cause **inaccuracies** in color interpretation.

Our goal:  
> “To create an Edge AI-powered system that automatically detects a urine test strip from an image or video feed, extracts color features, compares them with a reference chart, and provides an instant diagnosis.”

---

##  Proposed Solution

The proposed solution uses a **YOLO-based object detection model** trained to identify the urine test strip, followed by a **color extraction algorithm** that analyzes the detected regions and matches them with the color reference chart to infer diagnostic results.


---

##  Dataset and Data Curation

The dataset was curated from **real-world urine test strips** and **reference charts** collected under various lighting and background conditions using my phone and a friend's phone camera.

We captured 1156 images of the urine stripes and reference charts using samsung phone camera and iphone camera and uploaded them to Edge Impulse Studio.



![image of data upload to edge impulse studio](https://usercdn.edgeimpulse.com/project821834/de5670ff07857b98a269516e56f7a0bb2d7abf8d1eb4d69d906f73cd48e7f087)


![image two of data upload to edge impulse studio](https://usercdn.edgeimpulse.com/project821834/2f4ab9548fad220e95865778c9db302ce08a368f45583880d2cf721adf188270)

![image three of data upload to edge impulse studio](https://usercdn.edgeimpulse.com/project821834/78e6eba7c95fed112f909f7d75c1b6d4066151c7dd983385c29d755b6a69c98e)


We can see the uploaded images on the Data Acquisition page.


![image of data uploaded to edge impulse studio](https://usercdn.edgeimpulse.com/project821834/25875aae4da9cc67e593a126dd3c4693cb1e6409be1b79cc054ea154bf9f1939)


![image two of data uploaded to edge impulse studio](https://usercdn.edgeimpulse.com/project821834/bd865c94bdd9136758ac49611006656d4e76b8b567b6a06a826a43d1c3e17bfd)



We can now label the data using bounding boxes in the Labeling Queue tab, as demonstrated in the GIF below.


![manual data labeling](https://usercdn.edgeimpulse.com/project821834/24c8d1d8b7547774ec01d09418230b5619d28964ad66d7770b5b5852e7c271e3)

We also made use of Edge impulse AI labeling queue to speed up workflow, as demonstrated or shown in GIF below


![AI data labeling](https://usercdn.edgeimpulse.com/project821834/453426c751527ce91b3567375b09b3e48c9586815fed001e304c36b799a0b2e0)





| Dataset Attribute | Description |
|--------------------|-------------|
| **Total Images** | 1,000+ images |
| **Classes** | `Urine_Strip`, `reference_chart` |
| **Image Sources** | Real dipstick tests from phone camera |
| **Resolution** | 320×320 pixels |
| **Annotations** | Bounding boxes using Edge Impulse data acquisition tool |
| **Data Split** | 77% validation set / 55% test set |



### Data Quality Considerations
- Images captured in varying **lighting conditions** (natural, fluorescent, LED)
- Different **camera types** (smartphones such as samsung, iphones, webcams)
- Ensured balance between positive and negative examples
- Labeled all samples as `"Urine__Strip" and "reference_chart"`

---

## ⚙ Pipeline (Impulse) Design

The **Edge Impulse pipeline** was constructed with the following key blocks:

| Block | Function |
|--------|-----------|
| **Image Data Block** | Handles preprocessing (resize 320x320) |

![create-impulse-image.PNG](https://usercdn.edgeimpulse.com/project821834/3e7f55de0ba1bfcfff43913561df4d2c07ae40cf4bf06231584f95fb0a621e2c)

| **YOLO-Pro (Developer Preview)** | Performs object detection |

![choose-model-for-training-image-3.PNG](https://usercdn.edgeimpulse.com/project821834/41f105ea827b549fd0c99d5da36dc763ae990b033890f74ee41c763604e2bdb0)


| **Color Feature Extraction (Custom)** | Extracts average HSV and LAB color features from detected strip regions |
| **Classification Head** | Maps color differences to diagnostic outcomes |

### Why These Blocks?
- **YOLO-Pro** was chosen for its high performance and speed on embedded hardware.
- **Color feature extraction** enables accurate analysis independent of lighting.
- Modular structure simplifies integration with edge devices like Raspberry Pi and Jetson Nano.


---

##  Model Training and Parameters

Training was performed on **Edge Impulse Studio** using the GPU processor.

| Parameter | Value | Reason |
|------------|--------|--------|
| **Epochs** | 50 | Balanced between compute time and performance |
| **Learning Rate** | 0.001 | Prevents overfitting on limited dataset |
| **Batch Size** | 16 | Fits GPU memory constraints |
| **Model Architecture** | YOLO-Pro (Nano) | Optimized for embedded edge inference |
| **Pretrained Weights** | ✅ Yes | Improved convergence speed |
| **Validation Split** | 20% | Ensures reliable evaluation |

### Training Log (Excerpt)


---

##  Testing and Evaluation

The trained model achieved the following results:

| Metric | Score |
|---------|--------|
| **Precision** | 0.87 |
| **Recall** | 0.64 |
| **F1 score** | 0.74 |

Sample Detection Output:



Color Comparison Visualization:



---

##  Deployment and Real-World Inference

The model was deployed using the **Edge Impulse “Bring Your Own Model (BYOM)”** workflow.  
It runs efficiently on a **Raspberry Pi 4** with real-time camera inference.

**Inference Flow:**
1. Detect urine test strip using YOLO.
2. Crop and isolate test regions.
3. Extract HSV color values from the reaction zones.
4. Compare with pre-stored reference chart data.
5. Output diagnosis (e.g., "Possible Glucose Presence - Risk of Diabetes").



---

##  Results

| Parameter | Value |
|------------|--------|
| **Average Inference Time** | 250 ms/frame |
| **Model Size** | 2.4 MB |
| **Accuracy (Diagnosis Matching)** | ~88% (in preliminary tests) |
| **Edge Device** | Raspberry Pi 4B + Pi Camera |

<p align="center">
  <video width="700" controls>
    <source src="assets/demo_video.mp4" type="video/mp4">
    Your browser does not support HTML5 video.
  </video>
</p>

---

##  Challenges and Future Work

### Challenges
- Limited dataset variety in lighting and background.
- Variations in color perception between different camera sensors.
- Reducing false positives in test strip boundary detection.

### Future Work
- Integrate Mask R-CNN for **color segmentation** of specific test zones.
- Enhance color normalization under varied lighting.
- Add a **mobile app interface** for instant test results.
- Cloud dashboard for remote diagnosis.

---

##  Repository and References

-  **GitHub Repository:** [Kaelion AI](https://github.com/nnam-droid12/kaelion-ai)
-  **Edge Impulse Project:** *To be added once finalized*

---

##  Acknowledgements

Special thanks to the **Edge Impulse team** for organizing the **Global Edge AI Hackathon**, and to the open-source AI community for making powerful tools accessible for impactful healthcare innovation.

---

> _“Innovation happens when we bridge the gap between simplicity and intelligence.” — William Nnamani_

