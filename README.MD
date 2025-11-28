#  Kaelion AI: Smart Urine Test Strip Analyzer and Diagnosis

> Detecting, analyzing, and diagnosing urine dipstick test strips using Edge AI and color analysis.

---


## Github Repository: 
[Github Repository](https://github.com/nnam-droid12/kaelion-ai)

##  Table of Contents

1. [Introduction](#introduction)
2. [Problem Statement](#problem-statement)
3. [Proposed Solution](#proposed-solution)
4. [Dataset and Data Curation](#dataset-and-data-curation)
5. [Pipeline (Impulse) Design](#pipeline-impulse-design)
6. [Model Training and Parameters](#model-training-and-parameters)
7. [Experiments](#experiments)
8. [Testing and Evaluation](#testing-and-evaluation)
9. [Deployment and Real-World Inference](#deployment-and-real-world-inference)
10. [Results](#results)
11. [Challenges and Future Work](#challenges-and-future-work)
12. [Repository and References](#repository-and-references)

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

An example of the phone camera we used in capturing our data of urine test stripe and reference chart.

EXAMPLE OF IPHONE 12 PHONE USED
![iphone-image2.jpeg](https://usercdn.edgeimpulse.com/project821834/b5768330683ebb5518c79609c473055053db1fc8b4cd8a23e26887a30ccb1283)

EXAMPLE OF SAMSUNG PHONE USED
![samsung-image.jpeg](https://usercdn.edgeimpulse.com/project821834/edecd5e033f05c6a8576a29dd99bc080456d3ab38c9dfc78e6ba23778c25a185)


SAMPLE OF THE DATA UPLOADED TO EDGE IMPULSE STUDIO

![image of data upload to edge impulse studio](https://usercdn.edgeimpulse.com/project821834/de5670ff07857b98a269516e56f7a0bb2d7abf8d1eb4d69d906f73cd48e7f087)


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
| **Classes** | `Urine_Stripe`, `reference_chart` |
| **Image Sources** | Real dipstick tests from phone camera |
| **Resolution** | 320×320 pixels |
| **Annotations** | Bounding boxes using Edge Impulse data acquisition tool |
| **Data Split** | 77% validation set / 55% test set |



### Data Quality Considerations
- Images captured in varying **lighting conditions** (natural, fluorescent, LED)
- Different **camera types** (smartphones such as samsung, iphones)
- Ensured balance between positive and negative examples
- Labeled all samples as `"Urine__Strip" and "reference_chart"`

---

## Pipeline (Impulse) Design

The **Edge Impulse pipeline** was constructed with the following key blocks:

| Block | Function |
|--------|-----------|
| **Image Data Block** | Handles preprocessing (resize 320x320) |

| **YOLO-Pro (Developer Preview)** | Performs object detection |

| **Color Feature Extraction (Custom)** | Extracts average HSV and LAB color features from detected strip regions |

| **Classification Head** | Maps color differences to diagnostic outcomes |

### Why These Blocks?
- **YOLO-Pro** was chosen for its high performance and speed on embedded hardware.
- **Color feature extraction** enables accurate analysis independent of lighting.
- Modular structure simplifies integration with edge devices like Raspberry Pi and Jetson Nano.


---

##  Model Training and Parameters

Training was performed on **Edge Impulse Studio** using the GPU processor.

To create an Impulse, I follow these steps:
- Go to the Impulse Design section, then select the Create Impulse page. We have opted for a 320x320 pixel image size in the “Image Data” form fields to achieve better accuracy.
- Click on “Add a processing block” and choose “Image”. This step will pre-process and normalize the image data while also giving us the option to choose the color depth.
- Click on “Add a learning block” and choose “Object Detection (Images)”.
- Finally,  I click on the “Save Impulse” button to complete the process.


![create-impulse-image.PNG](https://usercdn.edgeimpulse.com/project821834/d012236577770d8dc0619a2f06344510dbf43c4ce7320b71a60d062daeca5f24)


On the Image page, I choose RGB as color depth and click on the Save parameters button. The page will be redirected to the Generate Features page.

![create-image-page-1.PNG](https://usercdn.edgeimpulse.com/project821834/26a8c14e66e4007d8e2907706ccf1bd032e63f0c8c07d159e5b3b17ba2840218)


Now we can initiate feature generation by clicking on the Generate features button. Once the feature generation is completed, the data visualization will be visible in the Feature Explorer panel.


![generate-feature-image-1.PNG](https://usercdn.edgeimpulse.com/project821834/576ea06fe51f339c540b380fbea8958c04d1c060ed5084a2bfb9d0d169b78823)


![generate-feature-image-2.PNG](https://usercdn.edgeimpulse.com/project821834/fbc31066c7893d8e2f031d21c1ba39b830a12845b9895501b228bacc0bd1d9d2)


Go to the Object Detection page, then click “Choose a different model” and select the YOLO preview model. There are 4 variations of the model size available, and we selected the Nano version with 2.4 million parameters. Afterward, click the “Start training” button. The training process will take a few minutes to complete.

![choose-model-for-training-image.PNG](https://usercdn.edgeimpulse.com/project821834/a47d4b276e7451eb0362d28578e34e47769b73552f2ccc25a4d5cf861a6619e9)


![choose-model-for-training-image-2.PNG](https://usercdn.edgeimpulse.com/project821834/023717c525683b950e6843c055cde11506fd3b299dc0f68c4646220aad8f51c4)


![choose-model-for-training-image-3.PNG](https://usercdn.edgeimpulse.com/project821834/c7bc1db94fa60ebc6ed17c0675d4ceb33ea95a84406bfc5b696df618db07c77b)


Once the training is completed we can see the precision score and metrics as shown below.

![model-output.PNG](https://usercdn.edgeimpulse.com/project821834/009e3443586721f328708868b691c12f79f1542783f60a22e46d54ff7d016b78)


| Parameter | Value | Reason |
|------------|--------|--------|
| **Epochs** | 60 | Balanced between compute time and performance |
| **Learning Rate** | 0.001 | Prevents overfitting on limited dataset |
| **Batch Size** | 32 | Fits GPU memory constraints |
| **Model Architecture** | YOLO-Pro (developer preview) | Optimized for embedded edge inference |
| **Pretrained Weights** | ✅ Yes | Improved convergence speed |
| **Validation Split** | 20% | Ensures reliable evaluation |


---

##  Experiments

Urine dipstick tests are one of the simplest and most cost-effective diagnostic tools used in medical labs and at home.


---

##  Testing and Evaluation

On the Model testing page, click on the “Classify All” button which will initiate model testing with the trained float32 model. The testing accuracy is 55.02%.


![model-testing-2.PNG](https://usercdn.edgeimpulse.com/project821834/de8b86f94fa6e6cc164e298f35677d09cb43fd55de37fd9be546f9bfcbf1d977)

![model-testing-3.PNG](https://usercdn.edgeimpulse.com/project821834/5680f9f7d04357663f59d7ee1597a69e198bf59c6b8933de368657303010c72a)

The trained model achieved the following results:

| Metric | Score |
|---------|--------|
| **Precision** | 0.88 |
| **Recall** | 0.56 |
| **F1 score** | 0.68 |

Sample Detection Output:



Color Comparison Visualization:



---

##  Deployment and Real-World Inference

Go to Deployment page on edge impulse Linux and choose selected deployment as shown in the image below

![model-deployment-2.PNG](https://usercdn.edgeimpulse.com/project821834/18f3d475fa4108dcbad896443967bef17b64b13bddee3adc0616624a4b9eb87c)

In the model optimization section
Select:

Unoptimized (float32) - Highest accuracy - recommended for medical-style tasks

![model-deployment-3.PNG](https://usercdn.edgeimpulse.com/project821834/353163acd69ec9e9271918fca37289594afd8bde9a4e31a4a02045ec1e7a2318)

1. Click Build and wait for the process to complete.
2. Download the file: klion-ai-linux-x86_64-v3.eim

![model-deployment-4.PNG](https://usercdn.edgeimpulse.com/project821834/208f902b6143529be70989a6cfb5935fb74b0df2772b0dc1bf1576caed9092fa)

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
| **Model Size** | 10.1 MB |
| **Accuracy (Diagnosis Matching)** | ~88% (in preliminary tests) |
| **Edge Device** | Raspberry Pi 4B + Pi Camera |


---

##  Challenges and Future Work

### Challenges
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

---

##  Acknowledgements

Special thanks to the **Edge Impulse team** for organizing the **Global Edge AI Hackathon**, and to the open-source AI community for making powerful tools accessible for impactful healthcare innovation.

---

> _“Innovation happens when we bridge the gap between simplicity and intelligence.”

