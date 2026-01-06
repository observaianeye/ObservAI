#!/bin/bash
# Simple script to run camera analytics without module installation

cd "$(dirname "$0")"
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

python3 -m camera_analytics.run_with_websocket "$@"
