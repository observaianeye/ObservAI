
import logging
import time
import sys
import os
from abc import ABC, abstractmethod
from typing import Tuple, Optional, Any
import numpy as np
import cv2
import torch

# Add package to path if needed
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PARENT_DIR = os.path.dirname(CURRENT_DIR)
MIVOLO_REPO_DIR = os.path.join(PARENT_DIR, "mivolo_repo")

# --- MONKEY PATCH FOR TIMM / MiVOLO COMPATIBILITY ---
try:
    import timm.models._helpers
    if not hasattr(timm.models._helpers, 'remap_checkpoint'):
        def remap_checkpoint(model, checkpoint, *args, **kwargs):
            return checkpoint
        timm.models._helpers.remap_checkpoint = remap_checkpoint
        logging.getLogger(__name__).info("Patched timm.models._helpers.remap_checkpoint")

    import timm.models._pretrained
    if not hasattr(timm.models._pretrained, 'split_model_name_tag'):
        def split_model_name_tag(model_name):
            if ':' in model_name:
                return model_name.split(':', 1)
            return model_name, None
        timm.models._pretrained.split_model_name_tag = split_model_name_tag
        logging.getLogger(__name__).info("Patched timm.models._pretrained.split_model_name_tag")

except ImportError:
    pass
# ----------------------------------------------------

if MIVOLO_REPO_DIR not in sys.path:
    sys.path.append(MIVOLO_REPO_DIR)


# Try to import InsightFace dependencies safely
try:
    import insightface
    from insightface.app import FaceAnalysis
except ImportError:
    insightface = None
    FaceAnalysis = None

logger = logging.getLogger(__name__)

class AgeGenderEstimator(ABC):
    """
    Abstract base class for Age and Gender estimation models.
    """
    
    @abstractmethod
    def prepare(self, ctx_id: int = 0, det_size: Tuple[int, int] = (640, 640)) -> None:
        """Initialize the model."""
        pass

    @abstractmethod
    def predict(self, face_img: np.ndarray) -> Tuple[Optional[float], Optional[str], float]:
        """
        Predict age and gender from a cropped face image.
        Returns: (age, gender, confidence)
        """
        pass

class MiVOLOEstimator(AgeGenderEstimator):
    """
    Wrapper for MiVOLO (Multi-input Vision Transformer for Age and Gender).
    Using the 'mivolo_repo' submodule.
    """
    def __init__(self, model_path: str = "models/model_im1k.pth.tar", device: str = None):
        # Allow override of model path via environment variable
        env_model_path = os.environ.get("MIVOLO_MODEL_PATH")
        if env_model_path:
             self.model_path = env_model_path
        else:
             # Default to local models dir in package
             self.model_path = os.path.join(PARENT_DIR, "models", "mivolo_model.pth")
        
        self.device = device if device else ("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
        self.predictor = None

    def prepare(self, ctx_id: int = 0, det_size: Tuple[int, int] = (640, 640)) -> None:
        try:
            from mivolo.model.mi_volo import MiVOLO
            from mivolo.structures import PersonAndFaceResult
            
            # Check if model exists
            if not os.path.exists(self.model_path):
                 logger.warning(f"MiVOLO model not found at {self.model_path}")
                 logger.warning("Please download weights using setup_mivolo.sh manually.")
                 return

            logger.info(f"Loading MiVOLO model from {self.model_path} to {self.device}")
            
            # Correct initialization based on inspection of source code
            self.predictor = MiVOLO(
                ckpt_path=self.model_path,
                device=self.device,
                half=True,
                use_persons=True, # Model likely requires it
                disable_faces=False,
                verbose=False
            )
            self.predictor.model.eval()
            
            logger.info(f"✅ MiVOLO initialized successfully on {self.device}")

        except ImportError as e:
            logger.error(f"MiVOLO import failed: {e}. Is 'mivolo_repo' in path?")
        except Exception as e:
            logger.error(f"Failed to load MiVOLO: {e}")
            import traceback
            traceback.print_exc()

    def predict(self, face_img: np.ndarray) -> Tuple[Optional[float], Optional[str], float]:
        if self.predictor is None:
            return None, None, 0.0
            
        try:
            from mivolo.data.misc import prepare_classification_images
            
            # Prepare inputs manually
            # We treat the face crop as both the face and the person crop (heuristic)
            faces_crops = [face_img]
            bodies_crops = [face_img] # Duplicate for context
            
            input_size = self.predictor.input_size
            mean = self.predictor.data_config["mean"]
            std = self.predictor.data_config["std"]
            
            # Prepare tensors
            faces_input = prepare_classification_images(
                faces_crops, input_size, mean, std, device=self.device
            )
            person_input = prepare_classification_images(
                bodies_crops, input_size, mean, std, device=self.device
            )
            
            # Concatenate inputs (batch size 1)
            # MiVOLO expects [B, 6, H, W] if use_persons is True
            # faces_input is [1, 3, H, W]
            model_input = torch.cat((faces_input, person_input), dim=1)
            
            # Inference
            output = self.predictor.inference(model_input)
            
            # Decode Output
            # Logic from MiVOLO.fill_in_results
            if self.predictor.meta.only_age:
                age_output = output
                gender_probs = None
            else:
                age_output = output[:, 2]
                gender_output = output[:, :2].softmax(-1)
                gender_probs, gender_indx = gender_output.topk(1)
            
            # Process Age
            age_raw = age_output[0].item()
            min_age = self.predictor.meta.min_age
            max_age = self.predictor.meta.max_age
            avg_age = self.predictor.meta.avg_age
            
            # De-normalize age
            age = age_raw * (max_age - min_age) + avg_age
            age = max(0, age) # clamp
            
            # Process Gender
            gender = None
            confidence = 0.0
            if gender_probs is not None:
                g_idx = gender_indx[0].item()
                g_score = gender_probs[0].item()
                # 0 = Male, 1 = Female (Usually? Check source)
                # Source of fill_in_results: gender = "male" if gender_indx[index].item() == 0 else "female"
                gender = "male" if g_idx == 0 else "female"
                confidence = g_score
                
            return float(age), gender, float(confidence)

        except Exception as e:
            logger.error(f"MiVOLO prediction error: {e}")
            import traceback
            traceback.print_exc()
            return None, None, 0.0
    
    def detect_and_predict(self, full_frame: np.ndarray) -> Any:
        return []


class InsightFaceEstimator(AgeGenderEstimator):
    """
    Optimized InsightFace wrapper using buffalo_l for highest accuracy.
    buffalo_l provides significantly better age/gender prediction than buffalo_s,
    especially for profile faces and low-resolution crops.
    """
    MIN_FACE_INPUT_SIZE = 256

    def __init__(self, model_name: str = "buffalo_l", providers: list = None):
        self.model_name = model_name
        if providers is None:
            import platform as _platform
            _system = _platform.system()
            if _system == "Darwin":
                self.providers = ["CoreMLExecutionProvider", "CPUExecutionProvider"]
            else:
                self.providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        else:
            self.providers = providers
        self.app = None

    def prepare(self, ctx_id: int = 0, det_size: Tuple[int, int] = (640, 640)) -> None:
        if FaceAnalysis is None:
            logger.error("InsightFace library not found.")
            return

        logger.info(f"Initializing InsightFace ({self.model_name}) with providers: {self.providers}")
        try:
            self.app = FaceAnalysis(name=self.model_name, providers=self.providers)
            self.app.prepare(ctx_id=ctx_id, det_size=det_size)
            logger.info(f"InsightFace ({self.model_name}) initialized successfully.")
            # Log loaded model names safely (models dict has string keys)
            try:
                if self.app and hasattr(self.app, 'models'):
                    model_names = list(self.app.models.keys()) if isinstance(self.app.models, dict) else [str(m) for m in self.app.models]
                    print(f"[INFO] InsightFace loaded models: {model_names}")
                    # Check for genderage model availability
                    has_genderage = any('genderage' in str(name) for name in model_names)
                    if not has_genderage:
                        print(f"[WARN] 'genderage' model NOT found in InsightFace! Age/gender will NOT work.")
            except Exception as e:
                print(f"[INFO] InsightFace models loaded (could not enumerate: {e})")
        except Exception as e:
            logger.error(f"Failed to initialize InsightFace ({self.model_name}): {e}")
            if self.model_name == "buffalo_l":
                logger.warning("buffalo_l failed, trying buffalo_s as fallback...")
                try:
                    self.model_name = "buffalo_s"
                    self.app = FaceAnalysis(name="buffalo_s", providers=self.providers)
                    self.app.prepare(ctx_id=ctx_id, det_size=det_size)
                    logger.info("InsightFace (buffalo_s fallback) initialized successfully.")
                    return
                except Exception:
                    pass
            if "CPUExecutionProvider" not in self.providers:
                logger.warning("Falling back to CPUExecutionProvider...")
                self.providers = ["CPUExecutionProvider"]
                self.app = FaceAnalysis(name=self.model_name, providers=self.providers)
                self.app.prepare(ctx_id=ctx_id, det_size=det_size)

    def _upscale_if_needed(self, img: np.ndarray) -> np.ndarray:
        """Upscale small crops so InsightFace's detector can find faces reliably."""
        h, w = img.shape[:2]
        min_dim = min(h, w)
        if min_dim < self.MIN_FACE_INPUT_SIZE:
            scale = self.MIN_FACE_INPUT_SIZE / min_dim
            new_w = int(w * scale)
            new_h = int(h * scale)
            return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        return img

    def _enhance_contrast(self, img: np.ndarray) -> np.ndarray:
        """
        CLAHE (Contrast Limited Adaptive Histogram Equalization) ile kontrast iyileştir.
        Düşük ışık ve düşük kaliteli video kaynaklarında yüz tespitini iyileştirir.
        Özellikle iPhone/YouTube gibi kaynaklar için kritik.
        """
        try:
            lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
            l_ch, a_ch, b_ch = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            l_enhanced = clahe.apply(l_ch)
            enhanced = cv2.merge([l_enhanced, a_ch, b_ch])
            return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)
        except Exception:
            return img  # Hata durumunda orijinal görüntüyü döndür

    def predict(self, face_img: np.ndarray) -> Tuple[Optional[float], Optional[str], float]:
        if self.app is None:
            return None, None, 0.0

        try:
            processed = self._upscale_if_needed(face_img)
            processed = self._enhance_contrast(processed)
            faces = self.app.get(processed)
            if not faces:
                return None, None, 0.0

            face = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))

            det_score = float(face.det_score) if hasattr(face, 'det_score') else 0.0
            if det_score < 0.15:
                return None, None, 0.0

            age = float(face.age) if face.age is not None else None

            # --- Gender decoding ---
            # InsightFace's genderage model makes a binary decision (1=Male, 0=Female).
            # det_score is the FACE DETECTION confidence, NOT the gender prediction confidence.
            # Using det_score as gender confidence causes the temporal-voting consensus to
            # behave erratically (low det_score = low vote weight → gender never reaches 65%
            # consensus threshold → stuck at "unknown").
            # Fix: use a fixed, high gender confidence (0.85) because the model's binary
            # decision IS the gender confidence. Only det_score is used to gate acceptance.
            GENDER_CONFIDENCE = 0.85

            gender = None
            if hasattr(face, "gender") and face.gender is not None:
                # InsightFace stores gender as float 1.0 (male) or 0.0 (female).
                # Round to nearest int to handle edge cases like 0.9999.
                gender = "male" if round(float(face.gender)) == 1 else "female"
            elif hasattr(face, "sex"):
                if isinstance(face.sex, str):
                    gender = "male" if face.sex.upper() == 'M' else "female"
                else:
                    gender = "male" if float(face.sex) > 0.5 else "female"

            # Scale gender confidence slightly by det_score so very weak detections
            # contribute less, but never drop below 0.6 for accepted detections.
            confidence = max(0.60, GENDER_CONFIDENCE * min(1.0, det_score / 0.80))

            logger.debug(
                f"InsightFace predict: age={age:.1f if age else 'N/A'}, "
                f"gender={gender}, det_score={det_score:.3f}, gender_conf={confidence:.3f}"
            )

            return age, gender, confidence

        except Exception as e:
            logger.debug(f"InsightFace predict exception: {e}")
            return None, None, 0.0

    def detect_and_predict(self, full_frame: np.ndarray) -> Any:
         return self.app.get(full_frame)


class EstimatorFactory:
    @staticmethod
    def create_estimator(config: dict = None) -> AgeGenderEstimator:
        if config is None:
            config = {}

        model_type = config.get("model_type", "auto")

        if model_type == "insightface":
            logger.info("Factory: Creating InsightFace Estimator...")
            return InsightFaceEstimator()

        if model_type == "mivolo":
            logger.info("Factory: Creating MiVOLO Estimator...")
            return MiVOLOEstimator()

        # "auto" mode: try MiVOLO first (better accuracy), fall back to InsightFace
        try:
            import importlib
            importlib.import_module("mivolo.model.mi_volo")
            mivolo_model_path = os.path.join(PARENT_DIR, "models", "mivolo_model.pth")
            if os.path.exists(mivolo_model_path):
                logger.info("Factory: MiVOLO available — creating MiVOLO Estimator...")
                return MiVOLOEstimator()
            else:
                logger.info("Factory: MiVOLO module found but model weights missing — falling back to InsightFace")
        except ImportError:
            logger.info("Factory: MiVOLO not installed — falling back to InsightFace")

        if insightface is not None:
            logger.info("Factory: Creating InsightFace Estimator (auto-fallback)...")
            estimator = InsightFaceEstimator()
            print(f"[INFO] Factory selected: {type(estimator).__name__}")
            return estimator

        logger.warning("Factory: No demographics estimator available (install InsightFace or MiVOLO)")
        return MiVOLOEstimator()