from ultralytics import YOLO
import torch
import os

def train_urine_strip_detector():
    """Train YOLO model for urine strip detection"""
    
    
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Using device: {device}")
    
   
    if not os.path.exists('data.yaml'):
        print("ERROR: data.yaml not found in current directory!")
        print(f"Current directory: {os.getcwd()}")
        return None, None
    
    
    print("Loading pretrained YOLOv8n model...")
    model = YOLO('yolov8n.pt') 
    
    
    print("\nStarting training...")
    
    print("-" * 60)
    
    # Train the model
    results = model.train(
        data='data.yaml',           
        epochs=100,                 
        imgsz=640,                  
        batch=16,                   
        device=device,              
        patience=20,                
        save=True,                  
        project='runs/detect',      
        name='train',               
        exist_ok=True,              
        pretrained=True,            
        optimizer='auto',           
        verbose=True,               
        seed=42,                    
        deterministic=True,         
        single_cls=False,           
        rect=False,                 
        cos_lr=False,               
        close_mosaic=10,            
        resume=False,               
        amp=True,                   
        fraction=1.0,               
        profile=False,              
        # Data augmentation parameters
        hsv_h=0.015,               
        hsv_s=0.7,                 
        hsv_v=0.4,                 
        degrees=0.0,               
        translate=0.1,             
        scale=0.5,                 
        shear=0.0,                 
        perspective=0.0,           
        flipud=0.0,                
        fliplr=0.5,                
        mosaic=1.0,                
        mixup=0.0,                 
        copy_paste=0.0,            
    )
    
    
    print("\n" + "="*60)
    print("Training Complete! Evaluating model on validation set...")
    print("="*60)
    
    metrics = model.val()
    
    print("\n" + "="*60)
    print("TRAINING RESULTS:")
    print("="*60)
    print(f"mAP50:       {metrics.box.map50:.4f}   (50% IoU threshold)")
    print(f"mAP50-95:    {metrics.box.map:.4f}   (Average across IoU thresholds)")
    print(f"Precision:   {metrics.box.mp:.4f}   (How many detections were correct)")
    print(f"Recall:      {metrics.box.mr:.4f}   (How many objects were found)")
    print("="*60)
    
    # Interpret results
    print("\nInterpretation:")
    if metrics.box.map50 > 0.7:
        print("✓ Excellent performance! Your model is working well.")
    elif metrics.box.map50 > 0.5:
        print("✓ Good performance! Model should work for detection.")
    elif metrics.box.map50 > 0.3:
        print("⚠ Moderate performance. May need more training or better data.")
    else:
        print("⚠ Low performance. Check your labels and consider more training.")
    
    # Save the best model path
    best_model_path = 'runs/detect/train/weights/best.pt'
    print(f"\n📁 Best model saved at: {best_model_path}")
    print(f"📊 Training plots saved at: runs/detect/train/")
    print(f"   - results.png (training curves)")
    print(f"   - confusion_matrix.png")
    print(f"   - val_batch*_pred.jpg (validation predictions)")
    
    print("\n" + "="*60)
    print("NEXT STEPS:")
    print("="*60)
    print("1. Check runs/detect/train/results.png to see training progress")
    print("2. Look at val_batch predictions to verify model is learning")
    print("3. Run: python main.py")
    print("4. Choose option 2 to test on a single image")
    print("="*60)
    
    return model, metrics

if __name__ == "__main__":
    try:
      
        model, metrics = train_urine_strip_detector()
        
        if model is not None:
            print("\n Training completed successfully!")
            
            
            test_image_dir = 'datasets/test/images'
            if os.path.exists(test_image_dir):
                test_images = [f for f in os.listdir(test_image_dir) 
                              if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
                if test_images:
                    print(f"\n🔍 Testing model on sample image: {test_images[0]}")
                    test_path = os.path.join(test_image_dir, test_images[0])
                    results = model.predict(
                        source=test_path,
                        conf=0.25,
                        save=True,
                        project='runs/detect',
                        name='test_prediction',
                        exist_ok=True
                    )
                    print(f"✓ Test prediction saved to: runs/detect/test_prediction/")
        else:
            print("\n Training failed. Please check the errors above.")
            
    except KeyboardInterrupt:
        print("\n\n⚠ Training interrupted by user")
    except Exception as e:
        print(f"\n Error during training: {e}")
        import traceback
        traceback.print_exc()