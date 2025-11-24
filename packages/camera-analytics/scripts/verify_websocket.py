import asyncio
import socketio
import time
import sys

# Simple Socket.IO client to verify data stream
sio = socketio.AsyncClient()

received_metrics = False
received_tracks = False

@sio.event
async def connect():
    print("Connected to WebSocket server")

@sio.event
async def connect_error(data):
    print(f"Connection failed: {data}")

@sio.event
async def disconnect():
    print("Disconnected from server")

@sio.on('global')
async def on_global(data):
    global received_metrics
    print(f"[METRICS] Received global metrics. Timestamp: {data.get('timestamp')}")
    # Verify payload structure
    required_keys = ['current', 'entries', 'exits', 'demographics', 'heatmap']
    missing = [k for k in required_keys if k not in data]
    if missing:
        print(f"  ❌ Missing keys in metrics: {missing}")
    else:
        print(f"  ✓ Metrics payload valid. Current people: {data['current']}")
        received_metrics = True

@sio.on('tracks')
async def on_tracks(data):
    global received_tracks
    print(f"[TRACKS] Received {len(data)} tracks")
    if len(data) > 0:
        track = data[0]
        # Verify track structure
        required_keys = ['id', 'bbox', 'state']
        missing = [k for k in required_keys if k not in track]
        if missing:
            print(f"  ❌ Missing keys in track: {missing}")
        else:
            print(f"  ✓ Track payload valid. Sample ID: {track['id']}")
    received_tracks = True

async def main():
    try:
        # Connect to localhost:5000 where the server should be running
        await sio.connect('http://localhost:5000')
        
        # Wait for some data
        print("Waiting for data streams...")
        start_time = time.time()
        while (not received_metrics or not received_tracks) and (time.time() - start_time < 15):
            await asyncio.sleep(1)
            
        if received_metrics and received_tracks:
            print("\n✅ SUCCESS: Received both metrics and tracks via WebSocket.")
        else:
            print("\n❌ FAILURE: Did not receive all expected data streams.")
            if not received_metrics: print("  - No metrics received")
            if not received_tracks: print("  - No tracks received")
            sys.exit(1)
            
        await sio.disconnect()
        
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())
