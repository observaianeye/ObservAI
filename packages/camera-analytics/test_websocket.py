import asyncio
import socketio

sio = socketio.AsyncClient()

@sio.event
async def connect():
    print("Connected to backend")
    # Send start_stream event
    # The backend expects 'start_stream' with some config or empty
    print("Sending start_stream...")
    await sio.emit('start_stream', {'source': '0'})

@sio.event
async def global_stream(data):
    print("Received metrics:", data)
    # If we receive data, it works!
    await sio.disconnect()

@sio.event
async def disconnect():
    print("Disconnected")

async def main():
    try:
        await sio.connect('http://localhost:5001')
        await sio.wait()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    asyncio.run(main())
