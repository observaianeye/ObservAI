#!/usr/bin/env python3
"""
Entry point script for running camera analytics with WebSocket
This avoids relative import issues by running as a top-level script
"""

import sys
import os

# Add the parent directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Now import and run the main function
from camera_analytics.run_with_websocket import main

if __name__ == "__main__":
    main()
