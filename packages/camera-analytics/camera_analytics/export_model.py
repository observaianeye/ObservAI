from ultralytics import YOLO
import sys

def export_model(model_path="yolo11n.pt"):
    print(f"Loading model from {model_path}...")
    try:
        model = YOLO(model_path)
        print("Exporting to ONNX...")
        # Export the model to ONNX format
        # dynamic=True allows for different input sizes if needed, but fixed size is often faster on specific hardware
        # simplify=True runs onnx-simplifier
        path = model.export(format="onnx", imgsz=512, simplify=True)
        print(f"Model exported successfully to {path}")
    except Exception as e:
        print(f"Error exporting model: {e}")
        sys.exit(1)

if __name__ == "__main__":
    export_model()
