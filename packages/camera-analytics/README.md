# ObservAI Camera Analytics

Python toolchain that powers the real-time camera features defined in the ObservAI initial plan:

- Visitor counting with in/out tracking
- Demographic estimation (age buckets and gender distribution)
- Queue detection with wait time estimates
- Heatmap generation for hot spots inside the venue
- Table zone dwell-time analytics

## Quick start

Create a Python virtual environment, install the package in editable mode, and run the CLI:

```bash
cd packages/camera-analytics
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -e .
python -m camera_analytics.run --source 0 --output ../../data/camera/latest_metrics.json --display
```

See `python -m camera_analytics.run --help` for all options.

- `--source` can be a webcam index (e.g. `0`) or a video file.
- Metrics are written to `data/camera/latest_metrics.json` by default. The NestJS API reads this file through the new `CameraService`. Override with `--output` or `CAMERA_METRICS_PATH` when running the API.
- Adjust the monitored areas by editing `config/default_zones.yaml`. Coordinates are normalized (0–1) so they scale with different camera resolutions.
- Add `--display` to inspect live overlays (bounding boxes, zones, counters). Skip it when running headless.

The CLI downloads the required open-source models (`yolov8n` and `insightface` buffalo_l) on first launch and performs all inference locally on the CPU, so it can be tested directly on a MacBook webcam without extra hardware.
