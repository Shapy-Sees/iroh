# File: iroh/utils/debug.py
# Debug utilities for the Iroh Home Management System
# Provides comprehensive debugging, monitoring, and diagnostic capabilities

import asyncio
import json
import os
import psutil
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

from .logger import get_logger

logger = get_logger(__name__)

class DebugUtils:
    """
    Debug utility class providing system monitoring and diagnostic tools
    """
    def __init__(self):
        self.start_time = time.time()
        self.performance_metrics: Dict[str, List[float]] = {
            'cpu_usage': [],
            'memory_usage': [],
            'event_latency': []
        }
        self.state_history: List[Dict[str, Any]] = []
        self.command_history: List[Dict[str, Any]] = []
        self._monitoring = False
        
        # Create debug directory if it doesn't exist
        self.debug_dir = Path('debug_logs')
        self.debug_dir.mkdir(exist_ok=True)
    
    def start_monitoring(self, interval: float = 5.0) -> None:
        """
        Start system monitoring
        
        Args:
            interval: Monitoring interval in seconds
        """
        if not self._monitoring:
            self._monitoring = True
            asyncio.create_task(self._monitor_system(interval))
            logger.info(f"System monitoring started with {interval}s interval")
    
    def stop_monitoring(self) -> None:
        """Stop system monitoring"""
        self._monitoring = False
        logger.info("System monitoring stopped")
    
    async def _monitor_system(self, interval: float) -> None:
        """
        Monitor system metrics at specified interval
        
        Args:
            interval: Monitoring interval in seconds
        """
        process = psutil.Process()
        
        while self._monitoring:
            try:
                # Collect CPU and memory metrics
                cpu_percent = process.cpu_percent()
                memory_info = process.memory_info()
                
                self.performance_metrics['cpu_usage'].append(cpu_percent)
                self.performance_metrics['memory_usage'].append(memory_info.rss / 1024 / 1024)  # MB
                
                # Keep only last hour of metrics (at 5s interval = 720 samples)
                max_samples = int(3600 / interval)
                for metric_list in self.performance_metrics.values():
                    if len(metric_list) > max_samples:
                        metric_list.pop(0)
                
                logger.debug_verbose(
                    f"System metrics - CPU: {cpu_percent}%, "
                    f"Memory: {memory_info.rss / 1024 / 1024:.1f}MB"
                )
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Error in system monitoring: {str(e)}")
                await asyncio.sleep(interval)
    
    def log_state_change(self, old_state: Dict[str, Any], new_state: Dict[str, Any]) -> None:
        """
        Log a state change event
        
        Args:
            old_state: Previous state dictionary
            new_state: New state dictionary
        """
        timestamp = datetime.now().isoformat()
        
        state_change = {
            'timestamp': timestamp,
            'old_state': old_state,
            'new_state': new_state
        }
        
        self.state_history.append(state_change)
        
        # Keep only last 100 state changes
        if len(self.state_history) > 100:
            self.state_history.pop(0)
        
        logger.debug_verbose(f"State change logged: {json.dumps(state_change, indent=2)}")
    
    def log_command(self, command: str, args: Optional[Dict[str, Any]] = None) -> None:
        """
        Log a command execution
        
        Args:
            command: Command name or identifier
            args: Command arguments (optional)
        """
        timestamp = datetime.now().isoformat()
        
        command_entry = {
            'timestamp': timestamp,
            'command': command,
            'args': args or {}
        }
        
        self.command_history.append(command_entry)
        
        # Keep only last 100 commands
        if len(self.command_history) > 100:
            self.command_history.pop(0)
        
        logger.debug_verbose(f"Command logged: {json.dumps(command_entry, indent=2)}")
    
    def dump_debug_info(self) -> Dict[str, Any]:
        """
        Generate comprehensive debug information
        
        Returns:
            Dictionary containing debug information
        """
        debug_info = {
            'timestamp': datetime.now().isoformat(),
            'uptime': time.time() - self.start_time,
            'performance': {
                'current_cpu': self.performance_metrics['cpu_usage'][-1] if self.performance_metrics['cpu_usage'] else None,
                'current_memory': self.performance_metrics['memory_usage'][-1] if self.performance_metrics['memory_usage'] else None,
                'avg_cpu': sum(self.performance_metrics['cpu_usage']) / len(self.performance_metrics['cpu_usage']) if self.performance_metrics['cpu_usage'] else None,
                'avg_memory': sum(self.performance_metrics['memory_usage']) / len(self.performance_metrics['memory_usage']) if self.performance_metrics['memory_usage'] else None
            },
            'state_history': self.state_history[-10:],  # Last 10 state changes
            'command_history': self.command_history[-10:],  # Last 10 commands
            'system_info': {
                'python_version': sys.version,
                'platform': sys.platform,
                'cpu_count': os.cpu_count(),
                'total_memory': psutil.virtual_memory().total / 1024 / 1024  # MB
            }
        }
        
        # Save debug info to file
        debug_file = self.debug_dir / f"debug_dump_{int(time.time())}.json"
        with open(debug_file, 'w') as f:
            json.dump(debug_info, f, indent=2)
        
        logger.info(f"Debug information dumped to {debug_file}")
        return debug_info
    
    def measure_latency(self, start_time: float) -> None:
        """
        Measure and record event processing latency
        
        Args:
            start_time: Event start timestamp
        """
        latency = time.time() - start_time
        self.performance_metrics['event_latency'].append(latency)
        
        # Keep only last 1000 latency measurements
        if len(self.performance_metrics['event_latency']) > 1000:
            self.performance_metrics['event_latency'].pop(0)
        
        logger.debug_verbose(f"Event processing latency: {latency * 1000:.2f}ms")
    
    def get_average_latency(self) -> float:
        """
        Calculate average event processing latency
        
        Returns:
            Average latency in seconds
        """
        latencies = self.performance_metrics['event_latency']
        return sum(latencies) / len(latencies) if latencies else 0.0

# Example usage:
#
# debug_utils = DebugUtils()
# debug_utils.start_monitoring()
# debug_utils.log_command("quick_timer", {"duration": 5})
# debug_utils.measure_latency(start_time)
# debug_info = debug_utils.dump_debug_info()
