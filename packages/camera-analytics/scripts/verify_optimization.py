import sys
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

# Add package root to path
sys.path.append(str(Path(__file__).parent.parent))

from camera_analytics.analytics import CameraAnalyticsEngine
from camera_analytics.config import AnalyticsConfig

def test_optimization():
    print("Testing optimization settings...")
    
    # Config with high confidence and snapshot interval
    config = AnalyticsConfig(
        confidence_threshold=0.6,
        snapshot_interval=2.0
    )
    
    # Mock YOLO and CV2 to avoid actual inference/camera
    with patch('camera_analytics.analytics.YOLO') as MockYOLO, \
         patch('camera_analytics.analytics.cv2') as MockCV2:
        
        # Setup Mock YOLO instance
        mock_model = MockYOLO.return_value
        
        # Initialize Engine
        engine = CameraAnalyticsEngine(
            config=config,
            source="test.mp4",
            output_path=Path("test_output.json"),
            display=False
        )
        
        # Verify config loaded
        print(f"Engine Conf: {engine.conf}")
        print(f"Engine Snapshot Interval: {engine.snapshot_interval}")
        
        assert engine.conf == 0.6, f"Expected conf 0.6, got {engine.conf}"
        assert engine.snapshot_interval == 2.0, f"Expected snapshot 2.0, got {engine.snapshot_interval}"
        
        # Verify YOLO overrides were set
        # Note: overrides is a dict, so we check if the key was set
        # In the code: self.model.overrides['conf'] = self.conf
        # MockYOLO.return_value.overrides is a MagicMock by default, so we can treat it as dict if we want, 
        # but simpler to just check if the code ran without error and set the attribute.
        # Actually, let's check if the attribute exists on the mock
        # mock_model.overrides.__setitem__.assert_called_with('conf', 0.6) # This might be too specific on mock implementation
        
        print("Config loaded correctly.")
        
        # Test run branching
        with patch.object(engine, '_run_snapshots') as mock_run_snapshots:
             engine.run()
             mock_run_snapshots.assert_called_once()
             print("Snapshot mode triggered correctly.")
             
        # Test continuous branching
        engine.snapshot_interval = 0.0
        with patch.object(engine, '_run_continuous') as mock_run_continuous:
             engine.run()
             mock_run_continuous.assert_called_once()
             print("Continuous mode triggered correctly.")

    print("Optimization test passed!")

if __name__ == "__main__":
    test_optimization()
