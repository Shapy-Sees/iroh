# Client Development Guide

## Overview

The DAHDI Phone API supports development of client applications through both REST and WebSocket interfaces. This guide covers best practices, common patterns, and implementation guidance for client development.

## Connection Architecture

### Primary Interfaces

1. REST API (Port 8000)
   - Synchronous control operations
   - Status queries
   - Configuration
   - Audio playback

2. WebSocket API (Port 8001) 
   - Asynchronous events
   - State changes
   - DTMF detection
   - Voice activity
   - Line voltage monitoring

### Connection Flow

1. Initial Setup
```python
rest_url = "http://server:8000"
ws_url = "ws://server:8001/ws"

# First verify server is available
response = await client.get(f"{rest_url}/status")
if response.status_code == 200:
    # Connect WebSocket
    ws_client = await websockets.connect(ws_url)
```

2. Event Handling Setup
```python
async def handle_events():
    while True:
        event = await ws_client.recv()
        event_data = json.loads(event)
        
        # Handle different event types
        if event_data["type"] == "off_hook":
            await handle_off_hook(event_data)
        elif event_data["type"] == "dtmf":
            await handle_dtmf(event_data)
        elif event_data["type"] == "on_hook":
            await handle_on_hook(event_data)
```

## Event Sequences

### Phone States

Track phone state through these events:

1. Idle State:
```json
{
    "type": "on_hook",
    "timestamp": "2025-01-29T12:00:00Z"
}
```

2. Active State:
```json
{
    "type": "off_hook",
    "timestamp": "2025-01-29T12:00:00Z"
}
```

3. DTMF Input:
```json
{
    "type": "dtmf",
    "digit": "5",
    "duration": 100,
    "signal_level": -20.5,
    "timestamp": "2025-01-29T12:00:00Z"
}
```

### Command Sequences

Common command patterns:

1. Ring Phone:
```python
# Start ring
await client.post(f"{rest_url}/ring", json={
    "pattern": "NORMAL",
    "duration": 2000
})

# Stop ring early if needed
await client.post(f"{rest_url}/stop-ring")
```

2. Play Audio:
```python
# Prepare audio data (8kHz, 16-bit, mono)
audio_data = prepare_audio()

# Play through phone
await client.post(
    f"{rest_url}/play-audio",
    content=audio_data,
    headers={"Content-Type": "application/octet-stream"}
)
```

## Common Use Cases

### 1. Command Processor Pattern

Handle sequences of DTMF inputs:

```python
class CommandProcessor:
    def __init__(self):
        self.command_buffer = []
        self.last_digit_time = None
        
    async def handle_dtmf(self, event):
        now = datetime.fromisoformat(event["timestamp"])
        
        # Reset buffer if too much time between digits
        if self.last_digit_time and (now - self.last_digit_time).seconds > 2:
            self.command_buffer = []
            
        self.command_buffer.append(event["digit"])
        self.last_digit_time = now
        
        # Process complete commands
        if self._is_complete_command():
            await self._execute_command()
            self.command_buffer = []

    def _is_complete_command(self):
        # Example: Check if buffer matches known command pattern
        if len(self.command_buffer) == 3:
            return True
        return False
```

### 2. Timer Pattern

Implement timer functionality:

```python
class PhoneTimer:
    def __init__(self):
        self.active_timers = {}
        
    async def handle_sequence(self, events):
        # Check for timer sequence (e.g., pickup -> digit -> hangup)
        if self._is_timer_sequence(events):
            duration = int(events[1]["digit"]) * 60  # Minutes to seconds
            await self.start_timer(duration)
    
    async def start_timer(self, duration):
        timer_id = str(uuid.uuid4())
        self.active_timers[timer_id] = asyncio.create_task(
            self._timer_task(duration, timer_id)
        )
        
    async def _timer_task(self, duration, timer_id):
        await asyncio.sleep(duration)
        # Ring phone when timer complete
        await client.post(f"{rest_url}/ring", json={
            "pattern": "TIMER",
            "repeat": 1
        })
        del self.active_timers[timer_id]
```

### 3. Voice Activity Monitor

Monitor for voice activity:

```python
class VoiceMonitor:
    def __init__(self):
        self.voice_active = False
        self.min_energy = -50.0
        
    async def handle_voice(self, event):
        is_active = event["energy_level"] > self.min_energy
        
        if is_active != self.voice_active:
            self.voice_active = is_active
            await self._handle_voice_change(is_active)
            
    async def _handle_voice_change(self, is_active):
        if is_active:
            print("Voice activity started")
        else:
            print("Voice activity ended")
```

## Error Handling

### Connection Management

1. WebSocket Reconnection:
```python
async def maintain_connection():
    while True:
        try:
            async with websockets.connect(ws_url) as ws:
                await handle_events(ws)
        except websockets.ConnectionClosed:
            print("Connection lost, reconnecting...")
            await asyncio.sleep(5)
        except Exception as e:
            print(f"Error: {e}")
            await asyncio.sleep(5)
```

2. REST Error Handling:
```python
async def safe_request(method, url, **kwargs):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.request(method, url, **kwargs)
            response.raise_for_status()
            return response
    except httpx.HTTPError as e:
        print(f"HTTP error: {e}")
    except Exception as e:
        print(f"Request error: {e}")
    return None
```

### Event Processing Errors

Handle malformed or unexpected events:

```python
def process_event(event_data):
    try:
        # Validate event has required fields
        if "type" not in event_data:
            raise ValueError("Event missing type field")
            
        # Type-specific validation
        if event_data["type"] == "dtmf":
            if "digit" not in event_data:
                raise ValueError("DTMF event missing digit")
                
        return event_data
    except Exception as e:
        logger.error(f"Event processing error: {e}")
        return None
```

## Best Practices

1. Event Processing
   - Keep event handlers lightweight
   - Process events asynchronously
   - Maintain event order when needed
   - Buffer events appropriately

2. State Management
   - Track phone state locally
   - Validate state transitions
   - Handle missed events
   - Periodic state synchronization

3. Resource Management
   - Clean up WebSocket connections
   - Limit concurrent operations
   - Implement timeouts
   - Handle backpressure

4. Error Recovery
   - Implement reconnection logic
   - Handle partial failures
   - Log errors appropriately
   - Maintain consistent state

## Testing

### Mock Server

Use mock server for testing:

```python
class MockPhoneServer:
    def __init__(self):
        self.app = FastAPI()
        self.setup_routes()
        
    def setup_routes(self):
        @self.app.post("/ring")
        async def ring(request: Request):
            return {"status": "success"}
            
        @self.app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            await websocket.accept()
            # Send test events
            await websocket.send_json({
                "type": "off_hook",
                "timestamp": datetime.utcnow().isoformat()
            })
```

### Event Simulation

Test event sequences:

```python
async def simulate_timer_sequence():
    # Simulate phone pickup
    await ws.send_json({
        "type": "off_hook",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Simulate DTMF
    await ws.send_json({
        "type": "dtmf",
        "digit": "3",
        "duration": 100,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Simulate hangup
    await ws.send_json({
        "type": "on_hook",
        "timestamp": datetime.utcnow().isoformat()
    })
```

## Debugging

Enable detailed logging:

```python
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Component-specific loggers
ws_logger = logging.getLogger('websocket')
rest_logger = logging.getLogger('rest')
event_logger = logging.getLogger('events')
```

Monitor WebSocket traffic:

```python
async def log_websocket_traffic(websocket):
    while True:
        try:
            message = await websocket.recv()
            logging.debug(f"WS Received: {message}")
        except Exception as e:
            logging.error(f"WS Error: {e}")
            break
```

## Performance Considerations

1. Event Processing
   - Buffer events appropriately
   - Process events asynchronously
   - Implement backpressure handling
   - Monitor processing latency

2. Connection Management
   - Maintain single WebSocket connection
   - Reuse HTTP connections
   - Implement connection pooling
   - Monitor connection health

3. Resource Usage
   - Monitor memory usage
   - Track event processing times
   - Implement rate limiting
   - Clean up resources properly
