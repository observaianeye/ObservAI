from ultralytics import YOLO
import cv2
import numpy as np
import os

try:
    print("Loading YOLO model...")
    model = YOLO("yolov8n.pt")
    print("Model loaded.")
    
    # Create a dummy image
    img = np.zeros((640, 640, 3), dtype=np.uint8)
    
    tracker_path = os.path.abspath("camera_analytics/bytetrack.yaml")
    print(f"Using tracker: {tracker_path}")
    
    print("Running tracking with custom config...")
    results = model.track(img, persist=True, tracker=tracker_path)
    print("Tracking successful.")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
