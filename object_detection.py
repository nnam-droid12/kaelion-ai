import cv2
import numpy as np
from ultralytics import YOLO
import time
from datetime import datetime
import os

class UrineStripDetector:
    def __init__(self, model_path="runs/detect/train/weights/best.pt", confidence_threshold=0.5):
        """
        Initialize the urine strip detector
        
        Args:
            model_path: Path to the trained YOLO model
            confidence_threshold: Minimum confidence for detections
        """
        
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model not found at: {model_path}\n"
                f"Please train the model first using: python train_model.py"
            )
        
        print(f"Loading model from: {model_path}")
        self.model = YOLO(model_path)
        self.confidence_threshold = confidence_threshold
        self.detection_history = []
        
       
        os.makedirs("detection_results", exist_ok=True)
        
        print(f"✓ Model loaded successfully!")
        print(f"  Classes: {self.model.names}")
        print(f"  Confidence threshold: {confidence_threshold}")
        
    def detect_strips(self, frame, verbose=False):
        """
        Detect urine strips in a frame
        
        Args:
            frame: Input image frame
            verbose: Print detection details
            
        Returns:
            annotated_frame: Frame with detections drawn
            detections: List of detection information
        """
        # Run inference
        results = self.model(frame, conf=self.confidence_threshold, verbose=False)
        annotated_frame = frame.copy()
        detections = []
        
        for r in results:
            boxes = r.boxes
            if boxes is not None and len(boxes) > 0:
                for box in boxes:
                    # Extract box coordinates and confidence
                    x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0])
                    cls = int(box.cls[0])
                    label = self.model.names[cls]
                    
                    # Only process detections above threshold
                    if conf >= self.confidence_threshold:
                        detections.append({
                            'bbox': (int(x1), int(y1), int(x2), int(y2)),
                            'confidence': conf,
                            'class': label,
                            'timestamp': datetime.now()
                        })
                        
                        # Draw bounding box
                        color = self._get_color(cls)
                        cv2.rectangle(annotated_frame, (int(x1), int(y1)), (int(x2), int(y2)), color, 2)
                        
                        # Draw label with background
                        label_text = f"{label}: {conf:.2f}"
                        label_size = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                        cv2.rectangle(annotated_frame, 
                                    (int(x1), int(y1) - label_size[1] - 10),
                                    (int(x1) + label_size[0], int(y1)), 
                                    color, -1)
                        cv2.putText(annotated_frame, label_text, 
                                  (int(x1), int(y1) - 5),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                        
                        # Draw center point
                        center_x, center_y = int((x1 + x2) / 2), int((y1 + y2) / 2)
                        cv2.circle(annotated_frame, (center_x, center_y), 5, color, -1)
                        
                        if verbose:
                            print(f"  Detection: {label} at ({int(x1)}, {int(y1)}, {int(x2)}, {int(y2)}) - Confidence: {conf:.3f}")
        
        if verbose and len(detections) == 0:
            print("  No detections found above threshold")
        
        return annotated_frame, detections
    
    def _get_color(self, class_id):
        """Generate consistent colors for different classes"""
        colors = [(0, 255, 0), (255, 0, 0), (0, 0, 255), (255, 255, 0), 
                 (255, 0, 255), (0, 255, 255), (128, 0, 128), (255, 165, 0)]
        return colors[class_id % len(colors)]
    
    def save_detection(self, frame, detections):
        """Save frame with detections"""
        if detections:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"detection_results/detection_{timestamp}.jpg"
            cv2.imwrite(filename, frame)
            print(f"Detection saved: {filename}")
            return filename
        return None
    
    def run_camera_detection(self, camera_id=0, save_detections=False):
        """
        Run real-time detection on camera feed
        
        Args:
            camera_id: Camera device ID (0 for default camera)
            save_detections: Whether to save frames with detections
        """
        cap = cv2.VideoCapture(camera_id)
        
        if not cap.isOpened():
            print(f"ERROR: Could not open camera {camera_id}")
            print("Available cameras are usually 0, 1, or 2")
            return
        
        # Set camera properties for better quality
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)
        
        fps_counter = 0
        start_time = time.time()
        fps = 0
        
        print("\n" + "="*60)
        print("CAMERA DETECTION STARTED")
        print("="*60)
        print("Controls:")
        print("  'q' - Quit")
        print("  's' - Save current frame")
        print(f"  Confidence threshold: {self.confidence_threshold}")
        print("="*60 + "\n")
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("Failed to read from camera")
                    break
                
                # Perform detection
                annotated_frame, detections = self.detect_strips(frame)
                
                # Calculate and display FPS
                fps_counter += 1
                elapsed = time.time() - start_time
                if elapsed > 1.0:
                    fps = fps_counter / elapsed
                    fps_counter = 0
                    start_time = time.time()
                
                # Add FPS and detection count to frame
                cv2.putText(annotated_frame, f"FPS: {fps:.1f}", (10, 30),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                cv2.putText(annotated_frame, f"Detections: {len(detections)}", (10, 70),
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
                
                # Display frame
                cv2.imshow("Urine Strip Detection", annotated_frame)
                
                # Handle key presses
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
                elif key == ord('s'):
                    saved_path = self.save_detection(annotated_frame, detections)
                    if saved_path:
                        print(f"Frame saved: {saved_path}")
                
                # Auto-save if enabled
                if save_detections and detections:
                    self.save_detection(annotated_frame, detections)
                
                # Store detection history
                if detections:
                    self.detection_history.extend(detections)
        
        except KeyboardInterrupt:
            print("\nDetection interrupted by user")
        finally:
            cap.release()
            cv2.destroyAllWindows()
            
            print(f"\nDetection session completed. Total detections: {len(self.detection_history)}")
    
    def detect_on_image(self, image_path, output_path=None, show=False):
        """
        Detect urine strips on a single image
        
        Args:
            image_path: Path to input image
            output_path: Path to save annotated image (optional)
            show: Display the image (optional)
        
        Returns:
            annotated_frame: Annotated image
            detections: List of detections
        """
        print(f"\nProcessing: {image_path}")
        
        # Read image
        frame = cv2.imread(image_path)
        if frame is None:
            print(f"ERROR: Could not load image: {image_path}")
            return None, []
        
        print(f"Image size: {frame.shape[1]}x{frame.shape[0]}")
        
        # Perform detection
        annotated_frame, detections = self.detect_strips(frame, verbose=True)
        
        print(f"Found {len(detections)} detection(s)")
        
        # Save if output path provided
        if output_path:
            cv2.imwrite(output_path, annotated_frame)
            print(f"Annotated image saved: {output_path}")
        
        # Show if requested
        if show:
            cv2.imshow("Detection Result", annotated_frame)
            print("Press any key to close...")
            cv2.waitKey(0)
            cv2.destroyAllWindows()
        
        return annotated_frame, detections
    
    def batch_detect(self, input_dir, output_dir="detection_results/batch", 
                     save_all=False, min_confidence=None):
        """
        Process multiple images in batch
        
        Args:
            input_dir: Directory containing input images
            output_dir: Directory to save results
            save_all: Save all images (not just those with detections)
            min_confidence: Override confidence threshold for this batch
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Get all image files
        image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
        image_files = [f for f in os.listdir(input_dir) 
                      if any(f.lower().endswith(ext) for ext in image_extensions)]
        
        if not image_files:
            print(f"No images found in {input_dir}")
            return
        
        print(f"\nProcessing {len(image_files)} images from {input_dir}")
        print("="*60)
        
        # Temporarily change confidence if specified
        original_conf = self.confidence_threshold
        if min_confidence is not None:
            self.confidence_threshold = min_confidence
        
        total_detections = 0
        images_with_detections = 0
        
        for i, image_file in enumerate(image_files, 1):
            image_path = os.path.join(input_dir, image_file)
            output_path = os.path.join(output_dir, f"annotated_{image_file}")
            
            _, detections = self.detect_on_image(image_path, 
                                                 output_path if (save_all or detections) else None)
            
            if detections:
                images_with_detections += 1
                total_detections += len(detections)
            
            print(f"[{i}/{len(image_files)}] {image_file}: {len(detections)} detection(s)")
        
       
        self.confidence_threshold = original_conf
        
        print("="*60)
        print(f"Batch processing completed!")
        print(f"  Total images: {len(image_files)}")
        print(f"  Images with detections: {images_with_detections}")
        print(f"  Total detections: {total_detections}")
        print(f"  Results saved to: {output_dir}")
        print("="*60)