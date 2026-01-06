"""
Hardware-specific model optimization for SOTA performance.

Supports:
- Apple Silicon (M3 Pro) with MPS (Metal Performance Shaders) & CoreML
- NVIDIA RTX (5070/etc) with TensorRT
- CPU fallback with ONNX optimization

Target: <5ms inference latency
"""

from __future__ import annotations

import platform
import sys
from pathlib import Path
from typing import Optional

import torch


class HardwareOptimizer:
    """Automatic hardware detection and model optimization."""

    @staticmethod
    def detect_hardware() -> dict:
        """Detect available hardware accelerators."""
        system = platform.system()
        machine = platform.machine()

        # Check CUDA (NVIDIA)
        cuda_available = torch.cuda.is_available()
        cuda_device = None
        if cuda_available:
            cuda_device = torch.cuda.get_device_name(0)

        # Check MPS (Apple Silicon)
        mps_available = (
            hasattr(torch.backends, "mps") and torch.backends.mps.is_available()
        )

        return {
            "system": system,
            "machine": machine,
            "cuda_available": cuda_available,
            "cuda_device": cuda_device,
            "mps_available": mps_available,
            "cpu_only": not (cuda_available or mps_available),
        }

    @staticmethod
    def get_optimal_device() -> str:
        """
        Return the optimal device string for PyTorch/Ultralytics.

        Returns:
            'cuda' for NVIDIA, 'mps' for Apple Silicon, 'cpu' otherwise
        """
        hw = HardwareOptimizer.detect_hardware()

        if hw["cuda_available"]:
            print(f"[OPTIMIZE] Using CUDA: {hw['cuda_device']}")
            return "cuda"
        elif hw["mps_available"]:
            print(f"[OPTIMIZE] Using MPS (Metal) on {hw['machine']}")
            return "mps"
        else:
            print(f"[OPTIMIZE] Using CPU on {hw['system']} {hw['machine']}")
            return "cpu"

    @staticmethod
    def optimize_model(
        model,
        model_path: str,
        target_format: Optional[str] = None,
    ):
        """
        Optimize YOLO model for specific hardware.

        Args:
            model: Loaded YOLO model instance
            model_path: Path to original .pt model
            target_format: Optional format override ('coreml', 'tensorrt', 'onnx', None)

        Returns:
            Optimized model or model path
        """
        hw = HardwareOptimizer.detect_hardware()
        base_name = Path(model_path).stem

        # NVIDIA TensorRT optimization
        if hw["cuda_available"] and not hw["system"] == "Darwin":
            if target_format == "tensorrt" or target_format is None:
                try:
                    engine_path = f"{base_name}_tensorrt.engine"
                    if not Path(engine_path).exists():
                        print(f"[OPTIMIZE] Exporting to TensorRT: {engine_path}")
                        model.export(format="engine", half=True)  # FP16 for RTX
                        print(f"[OPTIMIZE] ✅ TensorRT engine created: {engine_path}")
                    else:
                        print(f"[OPTIMIZE] ✅ Using cached TensorRT: {engine_path}")
                    return engine_path
                except Exception as e:
                    print(f"[OPTIMIZE] ⚠️ TensorRT export failed: {e}")
                    print("[OPTIMIZE] Falling back to CUDA")

        # Apple Silicon CoreML optimization
        if hw["mps_available"] and hw["system"] == "Darwin":
            if target_format == "coreml" or target_format is None:
                try:
                    coreml_path = f"{base_name}.mlpackage"
                    if not Path(coreml_path).exists():
                        print(f"[OPTIMIZE] Exporting to CoreML: {coreml_path}")
                        # CoreML export for Apple Silicon
                        model.export(format="coreml", nms=True, half=True)
                        print(f"[OPTIMIZE] ✅ CoreML model created: {coreml_path}")
                    else:
                        print(f"[OPTIMIZE] ✅ Using cached CoreML: {coreml_path}")
                    # Note: Ultralytics doesn't load CoreML directly, so we use MPS instead
                    print("[OPTIMIZE] Using MPS backend for real-time inference")
                except Exception as e:
                    print(f"[OPTIMIZE] ⚠️ CoreML export failed: {e}")
                    print("[OPTIMIZE] Falling back to MPS")

        # CPU ONNX optimization
        if hw["cpu_only"] or target_format == "onnx":
            try:
                onnx_path = f"{base_name}.onnx"
                if not Path(onnx_path).exists():
                    print(f"[OPTIMIZE] Exporting to ONNX: {onnx_path}")
                    model.export(format="onnx", simplify=True, dynamic=False)
                    print(f"[OPTIMIZE] ✅ ONNX model created: {onnx_path}")
                else:
                    print(f"[OPTIMIZE] ✅ Using cached ONNX: {onnx_path}")
                return onnx_path
            except Exception as e:
                print(f"[OPTIMIZE] ⚠️ ONNX export failed: {e}")

        # Return original model path if optimization not available
        print(f"[OPTIMIZE] Using standard PyTorch model: {model_path}")
        return model_path

    @staticmethod
    def get_optimal_inference_params() -> dict:
        """
        Get optimal inference parameters based on hardware.

        Returns:
            Dict with recommended settings (imgsz, half, device, etc.)
        """
        hw = HardwareOptimizer.detect_hardware()

        params = {
            "device": HardwareOptimizer.get_optimal_device(),
            "verbose": False,
        }

        # NVIDIA CUDA settings
        if hw["cuda_available"]:
            params.update(
                {
                    "half": True,  # FP16 for faster inference
                    "imgsz": 640,  # Standard for RTX GPUs
                }
            )

        # Apple Silicon MPS settings
        elif hw["mps_available"]:
            params.update(
                {
                    "half": False,  # MPS doesn't support FP16 well yet
                    "imgsz": 640,  # Optimal for M3 Pro
                }
            )

        # CPU settings
        else:
            params.update(
                {
                    "half": False,
                    "imgsz": 512,  # Smaller for CPU
                }
            )

        return params


def print_optimization_report():
    """Print a detailed hardware and optimization report."""
    hw = HardwareOptimizer.detect_hardware()
    device = HardwareOptimizer.get_optimal_device()
    params = HardwareOptimizer.get_optimal_inference_params()

    print("\n" + "=" * 60)
    print("🚀 ObservAI Hardware Optimization Report")
    print("=" * 60)
    print(f"System:        {hw['system']} ({hw['machine']})")
    print(f"PyTorch:       {torch.__version__}")
    print(f"Python:        {sys.version.split()[0]}")
    print(f"CUDA:          {'✅ ' + hw['cuda_device'] if hw['cuda_available'] else '❌'}")
    print(f"MPS (Metal):   {'✅' if hw['mps_available'] else '❌'}")
    print(f"\nOptimal Device:  {device.upper()}")
    print(f"Image Size:      {params['imgsz']}px")
    print(f"Half Precision:  {params['half']}")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    # Test hardware detection
    print_optimization_report()
