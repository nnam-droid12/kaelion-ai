from object_detection import UrineStripDetector
import os

def main():
    """Main function to demonstrate the enhanced detector"""
    
  
    detector = UrineStripDetector(
        model_path="runs/detect/train/weights/best.pt",
        confidence_threshold=0.1  
    )
    
    print("Urine Strip Detector initialized!")
    print("Options:")
    print("1. Real-time camera detection")
    print("2. Single image detection")
    print("3. Batch image processing")
    
    choice = input("Enter your choice (1-3): ")
    
    if choice == '1':
        
        detector.run_camera_detection(camera_id=0, save_detections=True)
        
    elif choice == '2':
        
        image_path = input("Enter image path: ")
        output_path = f"detection_results/annotated_{os.path.basename(image_path)}"
        
        annotated_frame, detections = detector.detect_on_image(image_path, output_path)
        if annotated_frame is not None:
            print(f"Found {len(detections)} detections")
            for i, det in enumerate(detections):
                print(f"  Detection {i+1}: {det['class']} (confidence: {det['confidence']:.2f})")
        
    elif choice == '3':
        # Batch processing
        input_dir = input("Enter input directory path: ")
        output_dir = "detection_results/batch_results"
        os.makedirs(output_dir, exist_ok=True)
        
        image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
        image_files = [f for f in os.listdir(input_dir) 
                      if any(f.lower().endswith(ext) for ext in image_extensions)]
        
        total_detections = 0
        for image_file in image_files:
            image_path = os.path.join(input_dir, image_file)
            output_path = os.path.join(output_dir, f"annotated_{image_file}")
            
            _, detections = detector.detect_on_image(image_path, output_path)
            total_detections += len(detections)
            print(f"Processed {image_file}: {len(detections)} detections")
        
        print(f"Batch processing completed. Total detections: {total_detections}")

if __name__ == "__main__":
    main()
