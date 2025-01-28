# iroh-operator/src/iroh/core/phone_client.py

class PhoneClient:
    """Client for interacting with the DAHDI Phone API"""
    
    def __init__(self, api_url: str, ws_url: str):
        """Initialize the phone client
        
        Args:
            api_url: Base URL for REST API
            ws_url: WebSocket URL for events
        """
        self.api_url = api_url
        self.ws_url = ws_url
        self.ws_client = None
        self.event_handlers = {}

    async def connect(self):
        """Establish WebSocket connection and start event handling"""
        self.ws_client = await websockets.connect(self.ws_url)
        asyncio.create_task(self._handle_events())

    async def _handle_events(self):
        """Process incoming WebSocket events"""
        while True:
            event = await self.ws_client.recv()
            event_data = json.loads(event)
            await self._dispatch_event(event_data)

    def on_event(self, event_type: str, handler: Callable):
        """Register an event handler
        
        Args:
            event_type: Type of event to handle
            handler: Async function to call when event occurs
        """
        self.event_handlers[event_type] = handler

    async def ring(self, duration: int = 2000):
        """Ring the phone
        
        Args:
            duration: Ring duration in milliseconds
        """
        async with httpx.AsyncClient() as client:
            await client.post(f"{self.api_url}/ring", json={"duration": duration})