# Iroh Operator Architecture

This document details the architectural design and implementation approach for the Iroh Operator project. Our architecture focuses on creating an intelligent phone system that provides timer functionality, home automation control, and natural interaction while maintaining reliability and extensibility.

## System Overview

The Iroh Operator transforms a traditional telephone into a smart home interface through integration with multiple services and intelligent command processing. It provides immediate timer functionality while supporting extended features through a command system.

### Core Principles

Our architecture adheres to several key principles:

1. Immediate Timer Access: The system prioritizes immediate timer setting when the phone goes off-hook, providing a seamless user experience.

2. Service Integration: Clean integration with external services (Home Assistant, Claude AI, Arduino) while maintaining loose coupling.

3. Command Flexibility: A structured command system that supports both direct input and complex operations.

4. State Management: Comprehensive state tracking across all system components.

## Component Architecture

### Layer 1: Phone Interface

The lowest layer handles communication with the DAHDI Phone API:

```python
class PhoneClient:
    """
    Manages communication with DAHDI Phone API through REST and WebSocket.
    Handles connection management and event processing.
    """
    def __init__(self, api_url: str, ws_url: str):
        self.api_url = api_url
        self.ws_url = ws_url
        self.event_handlers = {}
        self.connection_state = ConnectionState.DISCONNECTED
        
    async def connect(self):
        """
        Establishes API connections with automatic reconnection.
        Sets up event handling and state management.
        """
        try:
            self.ws_client = await websockets.connect(self.ws_url)
            await self._setup_event_handling()
        except ConnectionError as e:
            await self._handle_connection_error(e)
```

This layer provides:
- DAHDI API client implementation
- WebSocket event handling
- Connection management
- Error handling

### Layer 2: Command Processing

The command layer handles input processing and routing:

```python
class CommandProcessor:
    """
    Processes phone input and routes commands to appropriate handlers.
    Manages command state and mode transitions.
    """
    def __init__(self):
        self.current_mode = CommandMode.TIMER
        self.command_buffer = []
        self.handlers = self._initialize_handlers()
        
    async def process_dtmf(self, digit: str):
        """
        Processes DTMF input based on current mode.
        Handles command collection and execution.
        """
        if self.current_mode == CommandMode.TIMER:
            await self._handle_timer_digit(digit)
        else:
            await self._handle_command_digit(digit)
```

This layer provides:
- Input processing
- Command routing
- Mode management
- Command validation

### Layer 3: Service Integration

The service layer manages external integrations:

```python
class ServiceManager:
    """
    Coordinates all external service integrations.
    Manages service state and operations.
    """
    def __init__(self):
        self.timer_service = TimerService()
        self.home_assistant = HomeAssistantClient()
        self.ai_service = AIService()
        self.arduino = ArduinoDisplay()
        
    async def initialize(self):
        """
        Initializes all services with proper sequencing.
        Establishes connections and verifies functionality.
        """
        await self.timer_service.start()
        await self.home_assistant.connect()
        await self.ai_service.initialize()
        await self.arduino.connect()
```

This layer provides:
- Service initialization
- Operation coordination
- State management
- Error recovery

### Layer 4: Core Operator

The top layer implements the main operator logic:

```python
class IrohOperator:
    """
    Implements core operator functionality and coordination.
    Manages system state and user interaction.
    """
    def __init__(self):
        self.phone = PhoneClient()
        self.commands = CommandProcessor()
        self.services = ServiceManager()
        self.state = OperatorState()
        
    async def handle_off_hook(self):
        """
        Processes off-hook state with timer-first functionality.
        Manages mode selection and user feedback.
        """
        self.state.mode = CommandMode.TIMER
        await self.phone.play_tone('dial')
        self.commands.reset_buffer()
```

This layer provides:
- System coordination
- State management
- User interaction
- Error handling

## Timer Architecture

The timer system is our primary feature:

### Timer Management

```python
class TimerManager:
    """
    Manages multiple concurrent timers with proper state tracking.
    Handles timer operations and notifications.
    """
    def __init__(self):
        self.active_timers: Dict[str, Timer] = {}
        self.completion_queue: asyncio.Queue = asyncio.Queue()
        
    async def create_timer(self, minutes: int) -> str:
        """
        Creates new timer with proper validation and state management.
        Returns timer identifier for future reference.
        """
        timer_id = self._generate_id()
        timer = Timer(minutes)
        self.active_timers[timer_id] = timer
        await self._start_timer(timer)
        return timer_id
```

Key features:
1. Multiple concurrent timers
2. Accurate timing
3. Completion notification
4. State persistence

### Timer Notification

Timer completion follows a structured flow:

```
[Timer Completion] → [Phone Ring] → [Off-Hook Detection] → [Voice Notification]
```

Implementation considerations:
1. Ring timing
2. Voice synthesis
3. User acknowledgment
4. Retry logic

## Command System Architecture

### Command Structure

Commands are processed based on input mode:

1. Timer Mode (Default)
   - Direct digit input
   - Automatic timer creation
   - Immediate feedback

2. Command Mode (After * or #)
   - Structured commands
   - Service selection
   - Parameter collection

### Command Flow

```
[Input] → [Mode Check] → [Command Collection] → [Validation] → [Execution]
                                                           → [Feedback]
```

## Service Integration Architecture

### Home Assistant Integration

```python
class HomeAssistantClient:
    """
    Manages Home Assistant integration with state tracking.
    Handles device control and status monitoring.
    """
    def __init__(self, config: HAConfig):
        self.config = config
        self.state_cache = StateCache()
        self.event_subscription = None
        
    async def control_device(self, device_id: str, command: str):
        """
        Controls Home Assistant devices with state tracking.
        Manages command execution and feedback.
        """
        try:
            await self._execute_command(device_id, command)
            await self._update_state_cache(device_id)
            await self._notify_state_change(device_id)
        except HAError as e:
            await self._handle_ha_error(e)
```

### AI Integration

```python
class AIService:
    """
    Manages AI interaction for voice processing and response generation.
    Handles context and conversation state.
    """
    def __init__(self, config: AIConfig):
        self.claude = ClaudeClient(config.claude_key)
        self.tts = ElevenLabsClient(config.elevenlabs_key)
        self.context = ConversationContext()
        
    async def process_voice_command(self, audio: bytes):
        async def process_voice_command(self, audio: bytes):
        """
        Processes voice commands with context awareness.
        Handles speech-to-text, intent detection, and response generation.
        """
        try:
            text = await self._speech_to_text(audio)
            intent = await self._detect_intent(text)
            response = await self._generate_response(intent)
            audio_response = await self._synthesize_speech(response)
            return audio_response
        except AIError as e:
            await self._handle_ai_error(e)
```

### Arduino Display Integration

```python
class ArduinoDisplay:
    """
    Manages Arduino display updates and state synchronization.
    Handles serial communication and display protocol.
    """
    def __init__(self, port: str):
        self.port = port
        self.serial = None
        self.display_state = DisplayState()
        
    async def update_display(self, timers: List[Timer]):
        """
        Updates display with current timer information.
        Manages display formatting and communication.
        """
        try:
            display_data = self._format_timer_data(timers)
            await self._send_display_update(display_data)
            await self._verify_display_update()
        except DisplayError as e:
            await self._handle_display_error(e)
```

## State Management Architecture

### System State

The operator maintains hierarchical state:

```python
class OperatorState:
    """
    Manages complete system state with proper synchronization.
    Handles state transitions and validation.
    """
    def __init__(self):
        self.phone_state = PhoneState.IDLE
        self.command_mode = CommandMode.TIMER
        self.active_timers: Dict[str, Timer] = {}
        self.service_states: Dict[str, ServiceState] = {}
        
    async def transition_to(self, new_state: PhoneState):
        """
        Manages state transitions with proper validation.
        Handles cleanup and initialization for new state.
        """
        if self._is_valid_transition(new_state):
            await self._cleanup_current_state()
            await self._initialize_new_state(new_state)
            self.phone_state = new_state
```

### State Synchronization

State is synchronized across components:

```
[Operator State] → [Service States] → [Display State]
                → [Phone State]    → [Command State]
```

Key considerations:
1. State consistency
2. Transition validation
3. Error recovery
4. Event propagation

## Error Handling Architecture

### Layer-Specific Error Handling

Each layer implements appropriate error handling:

```python
class ServiceError(Exception):
    """Base class for service-related errors"""
    def __init__(self, message: str, service: str, retry_allowed: bool = True):
        super().__init__(message)
        self.service = service
        self.retry_allowed = retry_allowed

class ErrorHandler:
    """
    Manages error handling across system components.
    Implements recovery strategies and user feedback.
    """
    async def handle_error(self, error: Exception, context: Dict[str, Any]):
        """
        Processes errors with context-aware recovery.
        Manages user notification and system stability.
        """
        if isinstance(error, ServiceError):
            await self._handle_service_error(error)
        elif isinstance(error, CommunicationError):
            await self._handle_communication_error(error)
        else:
            await self._handle_system_error(error)
```

### Error Recovery Strategies

1. Service Errors
   - Automatic retry
   - Service restart
   - Fallback options
   - User notification

2. Communication Errors
   - Connection retry
   - Protocol fallback
   - Buffer management
   - Timeout handling

3. System Errors
   - State preservation
   - Safe shutdown
   - Resource cleanup
   - Error logging

## Testing Architecture

### Test Categories

```python
class TestSuite:
    """
    Comprehensive test suite implementation.
    Manages test scenarios and validation.
    """
    def __init__(self):
        self.unit_tests = UnitTests()
        self.integration_tests = IntegrationTests()
        self.system_tests = SystemTests()
        
    async def run_tests(self, category: str = 'all'):
        """
        Executes test suite with proper setup and teardown.
        Manages test environment and reporting.
        """
        try:
            await self._setup_test_environment()
            await self._run_test_category(category)
            await self._generate_test_report()
        finally:
            await self._cleanup_test_environment()
```

Test coverage includes:
1. Command Processing
   - DTMF handling
   - Mode transitions
   - Command validation

2. Timer Management
   - Timer creation
   - Concurrent timers
   - Completion handling

3. Service Integration
   - API communication
   - State synchronization
   - Error handling

## Performance Considerations

### Resource Management

```python
class ResourceManager:
    """
    Manages system resources with proper allocation.
    Handles resource limits and cleanup.
    """
    def __init__(self):
        self.resource_pools = {}
        self.usage_metrics = {}
        
    async def allocate_resources(self, request: ResourceRequest):
        """
        Allocates resources with proper constraints.
        Manages resource tracking and limits.
        """
        try:
            await self._check_resource_limits(request)
            resources = await self._allocate(request)
            await self._track_allocation(resources)
            return resources
        except ResourceError as e:
            await self._handle_resource_error(e)
```

Key aspects:
1. Memory management
2. Connection pooling
3. Thread allocation
4. Resource cleanup

## Security Architecture

### Access Control

```python
class SecurityManager:
    """
    Manages system security and access control.
    Handles authentication and authorization.
    """
    def __init__(self):
        self.access_control = AccessControl()
        self.auth_provider = AuthProvider()
        
    async def validate_operation(self, operation: Operation):
        """
        Validates operations for security compliance.
        Manages access control and auditing.
        """
        try:
            await self._check_authorization(operation)
            await self._validate_parameters(operation)
            await self._audit_operation(operation)
        except SecurityError as e:
            await self._handle_security_error(e)
```

Security considerations:
1. API key management
2. Input validation
3. Error sanitization
4. Audit logging

## Deployment Architecture

### Container Structure

```python
class ContainerManager:
    """
    Manages container deployment and orchestration.
    Handles service discovery and configuration.
    """
    def __init__(self):
        self.containers = {}
        self.networks = {}
        
    async def deploy_services(self):
        """
        Deploys services with proper dependencies.
        Manages container lifecycle and health.
        """
        try:
            await self._deploy_core_services()
            await self._verify_service_health()
            await self._establish_networks()
        except DeploymentError as e:
            await self._handle_deployment_error(e)
```

## Development Guidelines

When extending the system, consider:

1. Timer Functionality
   - Maintain immediate access
   - Ensure accuracy
   - Handle conflicts
   - Provide feedback

2. Command Processing
   - Follow command structure
   - Validate input
   - Handle modes
   - Manage state

3. Service Integration
   - Implement error handling
   - Manage resources
   - Track state
   - Provide feedback

4. Testing
   - Write unit tests
   - Perform integration testing
   - Validate behavior
   - Check error handling

This architecture provides a robust foundation for building an intelligent phone operator system while maintaining clean separation of concerns and proper resource management.