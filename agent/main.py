import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from firebase_admin import storage
import threading
import time
import subprocess
import platform
import os
import json
import sys
import requests
import uvicorn
from dotenv import load_dotenv
from pathlib import Path
import warnings
from requests.exceptions import RequestException, ConnectionError, Timeout
from google.api_core import exceptions as google_exceptions
try:
    from api import app as api_app
    from retry import (
        with_retry,
        NETWORK_EXCEPTIONS,
        LONG_MAX_RETRIES,
        LONG_MAX_DELAY,
    )
except ImportError:
    from agent.api import app as api_app
    from agent.retry import (
        with_retry,
        NETWORK_EXCEPTIONS,
        LONG_MAX_RETRIES,
        LONG_MAX_DELAY,
    )

# Suppress google-crc32c warning (no C extension on Windows Python 3.14)
warnings.filterwarnings("ignore", message="As the c extension couldn't be imported")

# Load environment variables
root_dir = Path(__file__).resolve().parent.parent
env_local = root_dir / 'web/.env.local'
env_file = root_dir / 'web/.env'

# Prioritize local env, then default env, then system env
if env_local.exists():
    print(f"Loading env from {env_local}")
    load_dotenv(dotenv_path=env_local)
elif env_file.exists():
    print(f"Loading env from {env_file}")
    load_dotenv(dotenv_path=env_file)
else:
    # Fallback to system env or .env in current dir
    load_dotenv()

# Configuration
PROJECT_ID = os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")
STORAGE_BUCKET = os.getenv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")
ALLOWED_EMAILS = os.getenv("ALLOWED_EMAILS", "")

if not PROJECT_ID:
    print("Warning: NEXT_PUBLIC_FIREBASE_PROJECT_ID not found in environment variables.")
if not STORAGE_BUCKET:
    print("Warning: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not found in environment variables.")

DEVICE_ID = os.getenv("DEVICE_ID", platform.node())
SHARED_FOLDER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shared')
API_URL = "http://localhost:8000"

# Default configuration values (can be overridden by Firestore config)
DEFAULT_CONFIG = {
    'polling_rate': 30,
    'sleep_polling_rate': 60,
    'idle_timeout': 60,
    'heartbeat_interval': 60,
    'max_output_chars': 50000,
}

# Global config that gets populated on boot
agent_config = DEFAULT_CONFIG.copy()

# Global registry to track active commands for API access
# Format: {cmd_id: CommandExecutor instance}
# This will be shared with api.py
active_commands_registry = {}

# Registry will be synced with api.py in __main__ block

# Initialize Firebase
try:
    cred = credentials.ApplicationDefault()
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
    
    firebase_admin.initialize_app(cred, {
        'projectId': PROJECT_ID,
        'storageBucket': STORAGE_BUCKET
    })
    db = firestore.client()
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    raise

def start_api():
    """Starts the FastAPI server."""
    try:
        # Run the app instance directly to avoid import path issues
        uvicorn.run(api_app, host="0.0.0.0", port=8000, log_level="error", reload=False)
    except Exception as e:
        print(f"Failed to start API server: {e}")

class FileSyncer(threading.Thread):
    """
    Background thread that syncs files between the local 'shared' folder
    and the Firebase Storage bucket.
    """
    def __init__(self, device_id):
        super().__init__()
        self.device_id = device_id
        self.should_stop = False
        self.local_path = SHARED_FOLDER_PATH
        self._consecutive_failures = 0
        if not os.path.exists(self.local_path):
            os.makedirs(self.local_path)

    def run(self):
        bucket = storage.bucket()
        prefix = f"agents/{self.device_id}/shared/"

        while not self.should_stop:
            # List blobs with retry; on persistent failure back off and try again
            # later instead of crashing the syncer thread.
            blobs = with_retry(
                lambda: list(bucket.list_blobs(prefix=prefix)),
                max_retries=3,
                retry_delay=1.0,
                max_delay=5.0,
                operation_name="list shared blobs",
                suppress_final_error=True,
                should_stop=lambda: self.should_stop,
            )

            if blobs is None:
                self._consecutive_failures += 1
                # Quiet, exponential backoff up to 5 minutes between attempts.
                # Only log the first failure and every 10th after that to avoid
                # filling the console while the hotspot is down.
                if self._consecutive_failures == 1 or self._consecutive_failures % 10 == 0:
                    print(f"FileSyncer: network unavailable (failure #{self._consecutive_failures}), will retry.")
                backoff = min(300, 10 * (2 ** min(self._consecutive_failures, 5)))
                for _ in range(backoff):
                    if self.should_stop:
                        break
                    time.sleep(1)
                continue

            if self._consecutive_failures > 0:
                print("FileSyncer: network restored, resuming sync.")
                self._consecutive_failures = 0

            try:
                # Remote -> Local Sync
                for blob in blobs:
                    filename = os.path.basename(blob.name)
                    if not filename:
                        continue

                    local_file_path = os.path.join(self.local_path, filename)
                    remote_mtime = blob.updated.timestamp()

                    download = False
                    if not os.path.exists(local_file_path):
                        download = True
                        print(f"New file found: {filename}")
                    else:
                        local_mtime = os.path.getmtime(local_file_path)
                        if remote_mtime > local_mtime:
                            download = True
                            print(f"File updated: {filename}")

                    if download:
                        print(f"Downloading {filename}...")

                        def do_download(b=blob, p=local_file_path, mt=remote_mtime):
                            b.download_to_filename(p)
                            os.utime(p, (mt, mt))

                        with_retry(
                            do_download,
                            operation_name=f"download {filename}",
                            suppress_final_error=True,
                            should_stop=lambda: self.should_stop,
                        )

                # Local -> Remote Sync (Deletion)
                remote_filenames = {os.path.basename(b.name) for b in blobs if os.path.basename(b.name)}
                local_filenames = set(os.listdir(self.local_path))

                for filename in local_filenames:
                    if filename not in remote_filenames:
                        print(f"File deleted remotely, removing local: {filename}")
                        try:
                            os.remove(os.path.join(self.local_path, filename))
                        except Exception as e:
                            print(f"Error deleting {filename}: {e}")

            except Exception as e:
                print(f"Error in FileSyncer (non-network): {type(e).__name__}: {e}")

            for _ in range(10):
                if self.should_stop:
                    break
                time.sleep(1)

    def stop(self):
        self.should_stop = True

class CommandExecutor(threading.Thread):
    """
    Handles the execution of a single command (shell or API) in a separate thread.
    Captures stdout/stderr in memory, only writes to Firestore on-demand or completion.
    Optimized for long-running scripts to minimize Firestore writes.
    """
    def __init__(self, cmd_id, cmd_data, device_ref):
        super().__init__()
        self.cmd_id = cmd_id
        self.cmd_data = cmd_data
        self.device_ref = device_ref
        self.cmd_ref = device_ref.collection('commands').document(cmd_id)
        self.process = None
        self.should_stop = False
        self.output_buffer = []  # List of (timestamp, line) tuples for stdout
        self.error_buffer = []   # List of (timestamp, line) tuples for stderr
        self.last_heartbeat = time.time()
        self.kill_listener = None
        # Use config values (from Firestore or defaults)
        self.heartbeat_interval = float(agent_config.get('heartbeat_interval', 60))
        self.command_start_time = time.time()
        self.max_memory_lines = 10000  # Keep last 10k lines in memory
        self.max_output_chars = agent_config.get('max_output_chars', 50000)  # Limit output size sent to Firestore

    def _read_stream(self, stream, buffer):
        try:
            for line in iter(stream.readline, ''):
                if line:
                    # Store with timestamp for time-based queries
                    buffer.append((time.time(), line))
                    # Limit memory usage by keeping only recent lines
                    if len(buffer) > self.max_memory_lines:
                        buffer.pop(0)  # Remove oldest line
                else:
                    break
        except Exception:
            pass
        finally:
            try:
                stream.close()
            except:
                pass

    def run(self):
        command_str = self.cmd_data.get('command')
        command_type = self.cmd_data.get('type', 'shell')
        
        print(f"[{self.cmd_id}] Executing: {command_str}")
        self.command_start_time = time.time()

        # Subscribing to the doc lets us receive kill_signal / output_request
        # events. If the subscribe fails (slow / flaky network) we still want
        # the command to run — kill via Firestore won't work until the network
        # recovers, but the subprocess and its output remain intact.
        try:
            self.kill_listener = self.cmd_ref.on_snapshot(self.on_doc_update)
        except Exception as e:
            print(f"[{self.cmd_id}] Failed to subscribe to command doc (will run without live kill signal): {type(e).__name__}: {e}")
            self.kill_listener = None

        # Register this command in the global registry for API access
        active_commands_registry[self.cmd_id] = self

        try:
            # Mark as processing. If the network is down we still proceed with the
            # subprocess; the heartbeat / final-status writes will catch up later.
            with_retry(
                lambda: self.cmd_ref.update({
                    'status': 'processing',
                    'started_at': firestore.SERVER_TIMESTAMP
                }),
                operation_name="mark command processing",
                log_prefix=f"[{self.cmd_id}]",
                suppress_final_error=True,
                should_stop=lambda: self.should_stop,
            )

            if command_type == 'restart':
                with_retry(
                    lambda: self.cmd_ref.update({
                        'output': 'Agent restarting...',
                        'status': 'completed',
                        'completed_at': firestore.SERVER_TIMESTAMP
                    }),
                    operation_name="ack restart",
                    log_prefix=f"[{self.cmd_id}]",
                    suppress_final_error=True,
                )
                print("Restarting agent...")
                time.sleep(2) # Allow time for firestore update to flush
                os._exit(0)
                return

            if command_type == 'api':
                endpoint = self.cmd_data.get('endpoint', '/health')
                method = self.cmd_data.get('method', 'GET')
                body = self.cmd_data.get('body', {})
                print(f"[{self.cmd_id}] API Request: {method} {endpoint}")
                
                try:
                    url = f"{API_URL}{endpoint}"

                    def make_api_request():
                        return requests.request(method, url, json=body, timeout=10)

                    response = with_retry(
                        make_api_request,
                        exceptions=(ConnectionError, Timeout),
                        operation_name="API request",
                        log_prefix=f"[{self.cmd_id}]"
                    )

                    try:
                        output_data = json.dumps(response.json(), indent=2)
                    except Exception:
                        output_data = response.text

                    with_retry(
                        lambda: self.cmd_ref.update({
                            'output': output_data,
                            'status': 'completed',
                            'return_code': response.status_code,
                            'completed_at': firestore.SERVER_TIMESTAMP
                        }),
                        operation_name="record API result",
                        log_prefix=f"[{self.cmd_id}]",
                        suppress_final_error=True,
                    )

                except Exception as e:
                    error_msg = f"Network error: {str(e)}" if isinstance(e, (ConnectionError, Timeout)) else str(e)
                    print(f"[{self.cmd_id}] API request failed: {error_msg}")
                    with_retry(
                        lambda: self.cmd_ref.update({
                            'error': error_msg,
                            'status': 'completed',
                            'completed_at': firestore.SERVER_TIMESTAMP
                        }),
                        operation_name="record API error",
                        log_prefix=f"[{self.cmd_id}]",
                        suppress_final_error=True,
                    )
                return

            if not command_str:
                raise ValueError("No command string provided")

            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"

            self.process = subprocess.Popen(
                command_str,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                cwd=os.path.dirname(os.path.abspath(__file__))
            )
            
            stdout_thread = threading.Thread(target=self._read_stream, args=(self.process.stdout, self.output_buffer))
            stderr_thread = threading.Thread(target=self._read_stream, args=(self.process.stderr, self.error_buffer))
            stdout_thread.daemon = True
            stderr_thread.daemon = True
            stdout_thread.start()
            stderr_thread.start()

            while True:
                if self.should_stop:
                    print(f"[{self.cmd_id}] Kill signal received. Terminating...")
                    self.process.terminate()
                    try:
                        self.process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        self.process.kill()
                    break

                if self.process.poll() is not None:
                    stdout_thread.join(timeout=1)
                    stderr_thread.join(timeout=1)
                    break
                
                # Send minimal heartbeat periodically (no output, just alive signal)
                self.send_heartbeat()
                time.sleep(1.0)  # Check every 1s

            return_code = self.process.returncode

            # Write final output once when command completes
            self.write_final_output()
            
            update_data = {
                'status': 'completed',
                'return_code': return_code,
                'completed_at': firestore.SERVER_TIMESTAMP
            }
            if self.should_stop:
                update_data['status'] = 'cancelled'

            # Retry final status update with the long profile — losing this means
            # the UI thinks the command is still running.
            with_retry(
                lambda: self.cmd_ref.update(update_data),
                max_retries=LONG_MAX_RETRIES,
                max_delay=LONG_MAX_DELAY,
                operation_name="update final status",
                log_prefix=f"[{self.cmd_id}]",
                suppress_final_error=True
            )
            
            # Keep in registry for a short time after completion for API access
            # Will be cleaned up after a delay

        except Exception as e:
            print(f"[{self.cmd_id}] Error: {e}")
            # Retry error status update
            error_data = {
                'status': 'completed',
                'error': str(e),
                'completed_at': firestore.SERVER_TIMESTAMP
            }
            with_retry(
                lambda: self.cmd_ref.update(error_data),
                max_retries=2,
                operation_name="update error status",
                log_prefix=f"[{self.cmd_id}]",
                suppress_final_error=True
            )
        finally:
            if self.kill_listener:
                try:
                    self.kill_listener.unsubscribe()
                except Exception as e:
                    print(f"[{self.cmd_id}] Error unsubscribing kill listener: {type(e).__name__}: {e}")
            if self.process and self.process.poll() is None:
                 self.process.terminate()
            # Unregister after a delay to allow API access to final output
            def cleanup():
                time.sleep(300)  # Keep for 5 minutes after completion
                if self.cmd_id in active_commands_registry:
                    del active_commands_registry[self.cmd_id]
            threading.Thread(target=cleanup, daemon=True).start()

    def send_heartbeat(self):
        """Send a minimal heartbeat to show the command is still alive.

        Output stays in memory; we only push timestamp + line counts. The retry
        budget is intentionally small so a long outage doesn't stall the polling
        loop (which needs to detect when the subprocess exits). On failure we
        leave ``last_heartbeat`` unchanged so the next loop iteration retries.
        """
        current_time = time.time()
        elapsed = current_time - self.last_heartbeat

        if elapsed < self.heartbeat_interval:
            return

        result = with_retry(
            lambda: self.cmd_ref.update({
                'last_activity': firestore.SERVER_TIMESTAMP,
                'output_lines': len(self.output_buffer),
                'error_lines': len(self.error_buffer)
            }),
            max_retries=2,
            retry_delay=0.5,
            max_delay=2.0,
            operation_name="command heartbeat",
            log_prefix=f"[{self.cmd_id}]",
            suppress_final_error=True,
            should_stop=lambda: self.should_stop,
        )
        if result is not None:
            self.last_heartbeat = current_time
        else:
            # Back off a little so we don't hammer a failing network every second,
            # but stay well under heartbeat_interval so we resume quickly on recovery.
            self.last_heartbeat = current_time - max(self.heartbeat_interval - 10, 0)

    def write_final_output(self):
        """Write final output when command completes. Called once at the end."""
        stdout, stderr = self.get_all_output()

        # Truncate to max size (keep the end, which is most recent)
        if len(stdout) > self.max_output_chars:
            stdout = "... (truncated)\n" + stdout[-self.max_output_chars:]
        if len(stderr) > self.max_output_chars:
            stderr = "... (truncated)\n" + stderr[-self.max_output_chars:]

        update_data = {
            'last_activity': firestore.SERVER_TIMESTAMP,
            'output_lines': len(self.output_buffer),
            'error_lines': len(self.error_buffer)
        }
        if stdout:
            update_data['output'] = stdout
        if stderr:
            update_data['error'] = stderr

        # The final output is important — use the long retry profile so we
        # don't drop it when the network is slow but eventually reachable.
        with_retry(
            lambda: self.cmd_ref.update(update_data),
            max_retries=LONG_MAX_RETRIES,
            max_delay=LONG_MAX_DELAY,
            operation_name="write final output",
            log_prefix=f"[{self.cmd_id}]",
            suppress_final_error=True,
        )
    
    def get_recent_output(self, seconds=60):
        """Get output from the last N seconds. Returns (stdout, stderr) as strings."""
        current_time = time.time()
        cutoff_time = current_time - seconds
        
        # Filter lines by timestamp
        recent_out = [line for ts, line in self.output_buffer if ts >= cutoff_time]
        recent_err = [line for ts, line in self.error_buffer if ts >= cutoff_time]
        
        return "".join(recent_out), "".join(recent_err)
    
    def get_all_output(self):
        """Get all output. Returns (stdout, stderr) as strings."""
        return "".join(line for _, line in self.output_buffer), "".join(line for _, line in self.error_buffer)

    def on_doc_update(self, col_snapshot, changes, read_time):
        try:
            docs = []
            if hasattr(col_snapshot, '__iter__'):
                docs = list(col_snapshot)
            else:
                docs = [col_snapshot]

            for doc in docs:
                data = doc.to_dict()
                if data:
                    if data.get('kill_signal') is True:
                        self.should_stop = True
                    # Check for output request
                    output_request = data.get('output_request')
                    if output_request and isinstance(output_request, dict):
                        seconds = output_request.get('seconds', 60)
                        request_id = output_request.get('request_id')
                        # Only process if we haven't handled this request yet
                        if request_id and request_id != getattr(self, '_last_request_id', None):
                            self._last_request_id = request_id
                            # Get requested output and write to Firestore
                            stdout, stderr = self.get_recent_output(seconds=seconds)
                            output_update = {
                                'output': stdout,
                                'error': stderr,
                                'output_request': firestore.DELETE_FIELD  # Clear the request
                            }
                            with_retry(
                                lambda: self.cmd_ref.update(output_update),
                                max_retries=2,
                                retry_delay=0.5,
                                operation_name="handle output request",
                                log_prefix=f"[{self.cmd_id}]",
                                suppress_final_error=True
                            )
        except Exception as e:
            print(f"Error in kill listener: {e}")


class Agent:
    """
    Main agent class that manages device registration, command polling,
    and heartbeat reporting.
    """
    def __init__(self, device_id):
        self.device_id = device_id
        self.running = True
        self.doc_ref = db.collection('devices').document(self.device_id)
        self.watch = None
        self.device_watch = None
        self.active_commands = {} # cmd_id -> CommandExecutor
        self.last_activity_time = time.time()
        self.file_syncer = FileSyncer(device_id)
        self.last_listener_event = time.time()  # Track when listener last fired
        self.listener_restart_count = 0  # Track how many times we've restarted the listener

        # Load config from Firestore document on boot
        self.load_config_from_firestore()

        # Use config values (from Firestore or defaults)
        self.polling_rate = agent_config.get('polling_rate', 30)
        self.sleep_polling_rate = agent_config.get('sleep_polling_rate', 60)
        self.idle_timeout = agent_config.get('idle_timeout', 60)

        # Subscribe to the device document for config updates. If this throws
        # synchronously (e.g. the network is dead at startup) we want to keep
        # the agent alive — config changes via the snapshot are optional, and
        # the rest of the agent can still execute commands and heartbeat.
        try:
            self.device_watch = self.doc_ref.on_snapshot(self.on_device_update)
        except Exception as e:
            print(f"Failed to subscribe to device config updates (will run with current config): {type(e).__name__}: {e}")
    
    def load_config_from_firestore(self):
        """Load configuration from Firestore device document on boot.

        Retries briefly on transient network errors, then falls back to defaults
        so a slow network at boot doesn't block the agent indefinitely — the
        ``on_device_update`` snapshot listener will update config later when the
        network recovers.
        """
        global agent_config
        print("Loading configuration from Firestore...")

        doc_snapshot = with_retry(
            lambda: self.doc_ref.get(),
            max_retries=3,
            retry_delay=2.0,
            max_delay=10.0,
            operation_name="load config",
            suppress_final_error=True,
        )

        if doc_snapshot is None:
            print("Could not reach Firestore for config — using defaults; "
                  "live config will apply when the network recovers.")
            return

        try:
            if doc_snapshot.exists:
                data = doc_snapshot.to_dict()
                config_keys = ['polling_rate', 'sleep_polling_rate', 'idle_timeout',
                             'heartbeat_interval', 'max_output_chars']

                for key in config_keys:
                    if key in data and data[key] is not None:
                        agent_config[key] = data[key]
                        print(f"  Config loaded: {key} = {data[key]}")

                print("Configuration loaded successfully.")
            else:
                print("No existing device document found. Using default configuration.")
        except Exception as e:
            print(f"Error parsing config from Firestore: {type(e).__name__}: {e}")
            print("Using default configuration.")

    def on_device_update(self, doc_snapshot, changes, read_time):
        for change in changes:
             if change.type.name == 'MODIFIED':
                 data = change.document.to_dict()
                 if data:
                     updated = []
                     if 'polling_rate' in data:
                         self.polling_rate = data['polling_rate']
                         updated.append(f"polling_rate={data['polling_rate']}s")
                     if 'sleep_polling_rate' in data:
                         self.sleep_polling_rate = data['sleep_polling_rate']
                         updated.append(f"sleep_polling_rate={data['sleep_polling_rate']}s")
                     if 'idle_timeout' in data:
                         self.idle_timeout = data['idle_timeout']
                         updated.append(f"idle_timeout={data['idle_timeout']}s")
                     # Note: heartbeat_interval and max_output_chars only apply to new commands
                     # They are read from agent_config when CommandExecutor is created
                     if 'heartbeat_interval' in data:
                         agent_config['heartbeat_interval'] = data['heartbeat_interval']
                         updated.append(f"heartbeat_interval={data['heartbeat_interval']}s")
                     if 'max_output_chars' in data:
                         agent_config['max_output_chars'] = data['max_output_chars']
                         updated.append(f"max_output_chars={data['max_output_chars']}")
                     if updated:
                         print(f"Config updated: {', '.join(updated)}")

    def fetch_agent_info(self):
        """Fetches data from the local API with retry logic."""
        def do_fetch():
            response = requests.get(f"{API_URL}/status", timeout=5)
            if response.status_code == 200:
                return response.json()
            raise ConnectionError(f"API returned status {response.status_code}")
        
        result = with_retry(
            do_fetch,
            exceptions=(ConnectionError, Timeout),
            operation_name="fetch agent info",
            suppress_final_error=True
        )
        return result if result else {}

    def cleanup_stale_commands(self):
        """Clean up any pending or processing commands from previous runs."""
        print("Cleaning up stale commands...")

        def build_and_commit():
            batch = db.batch()
            commands_ref = self.doc_ref.collection('commands')

            processing_docs = list(commands_ref.where(
                field_path='status', op_string='==', value='processing'
            ).get())
            count = 0
            for doc in processing_docs:
                batch.update(doc.reference, {
                    'status': 'completed',
                    'completed_at': firestore.SERVER_TIMESTAMP,
                    'output': 'Command interrupted by agent restart.',
                    'error': 'Agent restarted'
                })
                count += 1

            pending_docs = list(commands_ref.where(
                field_path='status', op_string='==', value='pending'
            ).get())
            for doc in pending_docs:
                batch.update(doc.reference, {
                    'status': 'cancelled',
                    'completed_at': firestore.SERVER_TIMESTAMP,
                    'output': 'Command cancelled by agent restart.',
                    'error': 'Agent restarted'
                })
                count += 1

            if count > 0:
                batch.commit()
                print(f"Cleaned up {count} stale commands.")

        with_retry(
            build_and_commit,
            max_retries=5,
            retry_delay=2.0,
            max_delay=15.0,
            operation_name="cleanup stale commands",
            suppress_final_error=True,
            should_stop=lambda: not self.running,
        )

    def register(self):
        """Register device with retry logic for network failures."""
        info = self.fetch_agent_info()
        
        data = {
            'hostname': info.get('hostname', platform.node()),
            'platform': info.get('platform', platform.system()),
            'release': info.get('release', platform.release()),
            'version': info.get('version', platform.version()),
            'last_seen': firestore.SERVER_TIMESTAMP,
            'status': 'online',
            'ip': info.get('ip', '127.0.0.1'),
            'stats': info.get('stats', {}),
            'git': info.get('git', {}),
            'polling_rate': agent_config.get('polling_rate', 30),
            'sleep_polling_rate': agent_config.get('sleep_polling_rate', 60),
            'idle_timeout': agent_config.get('idle_timeout', 60),
            'heartbeat_interval': agent_config.get('heartbeat_interval', 60),
            'max_output_chars': agent_config.get('max_output_chars', 50000),
            'allowed_emails': ALLOWED_EMAILS.split(',') if ALLOWED_EMAILS else []
        }
        
        with_retry(
            lambda: self.doc_ref.set(data, merge=True),
            max_retries=LONG_MAX_RETRIES,
            retry_delay=2,
            max_delay=LONG_MAX_DELAY,
            operation_name="register device",
            suppress_final_error=True,
            should_stop=lambda: not self.running,
        )

        # Cleanup stale commands regardless of registration outcome — they are
        # leftovers from a previous agent process and we want them resolved
        # whether or not the initial registration write went through.
        self.cleanup_stale_commands()
        print(f"Device {self.device_id} registered.")

    def start_watching(self):
        if self.watch:
            return
        print("Starting real-time listener...")
        try:
            commands_ref = self.doc_ref.collection('commands').where(field_path='status', op_string='==', value='pending')
            self.watch = commands_ref.on_snapshot(self.on_command_snapshot)
            self.last_listener_event = time.time()
        except Exception as e:
            # on_snapshot can fail synchronously if the underlying gRPC stream
            # can't be established (DNS, TLS, transient 5xx). Don't crash — we
            # will retry from check_listener_health, and the fallback poll keeps
            # pulling pending commands in the meantime.
            print(f"Failed to start real-time listener (will retry): {type(e).__name__}: {e}")
            self.watch = None

    def stop_watching(self):
        if self.watch:
            print("Stopping real-time listener...")
            try:
                self.watch.unsubscribe()
            except Exception as e:
                print(f"Error unsubscribing listener: {e}")
            self.watch = None

    def restart_listener(self):
        """Tear down and re-establish the real-time command listener."""
        self.listener_restart_count += 1
        print(f"Restarting real-time listener (restart #{self.listener_restart_count})...")
        self.stop_watching()
        time.sleep(1)  # Brief pause before reconnecting
        self.start_watching()
        # Reset the timer even if start failed — check_listener_health will try
        # again on its next pass without spamming restarts every cycle.
        self.last_listener_event = time.time()

    def check_listener_health(self):
        """
        Check if the real-time listener is still alive.
        If it hasn't fired in a long time, restart it.
        Also poll for any pending commands as a fallback.
        """
        # Listener health check: if no event in 5 minutes, restart
        listener_stale_threshold = 5 * 60  # 5 minutes
        time_since_last_event = time.time() - self.last_listener_event

        if time_since_last_event > listener_stale_threshold:
            print(f"Listener has not fired in {int(time_since_last_event)}s — restarting...")
            self.restart_listener()
            return

        # Fallback poll: directly query for pending commands
        # This catches anything the listener may have missed
        self.poll_pending_commands()

    def poll_pending_commands(self):
        """
        Fallback polling: directly query Firestore for pending commands.
        Picks up commands the real-time listener may have silently missed.
        """
        def do_query():
            return list(
                self.doc_ref.collection('commands')
                .where(field_path='status', op_string='==', value='pending')
                .get()
            )

        pending_docs = with_retry(
            do_query,
            max_retries=3,
            retry_delay=1.0,
            max_delay=5.0,
            operation_name="poll pending commands",
            suppress_final_error=True,
            should_stop=lambda: not self.running,
        )
        if not pending_docs:
            return
        for doc in pending_docs:
            cmd_id = doc.id
            if cmd_id not in self.active_commands:
                cmd_data = doc.to_dict()
                print(f"[poll fallback] Found missed pending command: {cmd_id}")
                self.start_command(cmd_id, cmd_data)

    def has_pending_commands(self):
        try:
            docs = self.doc_ref.collection('commands').where(field_path='status', op_string='==', value='pending').limit(1).get()
            return len(list(docs)) > 0
        except Exception as e:
            print(f"Error checking for pending commands: {e}")
            return False

    def send_heartbeat(self):
        """Send heartbeat with graceful error handling.

        Kept on a short retry budget so the main polling loop can't get stuck
        here during a network outage — the next loop iteration will retry, and
        meanwhile running commands continue executing in their own threads.
        """
        try:
            info = self.fetch_agent_info()
            update_data = {
                'last_seen': firestore.SERVER_TIMESTAMP,
                'stats': info.get('stats', {}),
                'mode': 'active'
            }
            if info.get('git'):
                update_data['git'] = info.get('git')

            with_retry(
                lambda: self.doc_ref.update(update_data),
                max_retries=2,
                retry_delay=1.0,
                max_delay=3.0,
                operation_name="send heartbeat",
                suppress_final_error=True,
                should_stop=lambda: not self.running,
            )
        except Exception as e:
            print(f"Error preparing heartbeat: {e}")

    def start_file_syncer(self):
        """Start the file syncer if not already running."""
        if not self.file_syncer.is_alive():
            self.file_syncer.start()

    def listen_for_commands(self):
        # Keep the real-time listener open permanently — commands fire instantly via push.
        # Additionally, periodically verify listener health and poll as a fallback,
        # since gRPC-based listeners can silently disconnect after extended periods.
        self.start_watching()
        self.start_file_syncer()

        while self.running:
            finished_ids = [cmd_id for cmd_id, thread in self.active_commands.items() if not thread.is_alive()]
            for cmd_id in finished_ids:
                print(f"Command {cmd_id} finished.")
                del self.active_commands[cmd_id]

            self.send_heartbeat()
            self.check_listener_health()
            time.sleep(self.polling_rate)

        self.file_syncer.stop()
        self.file_syncer.join()

    def on_command_snapshot(self, col_snapshot, changes, read_time):
        # Mark that the listener is alive every time it fires (even with no changes)
        self.last_listener_event = time.time()
        for change in changes:
            if change.type.name == 'ADDED':
                self.last_activity_time = time.time()
                cmd_doc = change.document
                cmd_data = cmd_doc.to_dict()
                print(f"Received command: {cmd_data}")
                self.start_command(cmd_doc.id, cmd_data)

    def start_command(self, cmd_id, cmd_data):
        if cmd_id in self.active_commands:
            print(f"Command {cmd_id} is already running.")
            return

        executor = CommandExecutor(cmd_id, cmd_data, self.doc_ref)
        self.active_commands[cmd_id] = executor
        executor.start()

    def run_startup_file(self):
        """Check for and execute the startup file if configured."""
        try:
            # Get the device document to check for startup_file. If the network
            # is down at boot, skip startup-file execution rather than crashing
            # — the user can re-trigger it once connectivity returns.
            doc_snapshot = with_retry(
                lambda: self.doc_ref.get(),
                max_retries=3,
                retry_delay=2.0,
                max_delay=10.0,
                operation_name="load startup_file config",
                suppress_final_error=True,
            )
            if doc_snapshot is None or not doc_snapshot.exists:
                return
            
            data = doc_snapshot.to_dict()
            startup_file = data.get('startup_file')
            
            if not startup_file:
                return
            
            startup_path = os.path.join(SHARED_FOLDER_PATH, startup_file)
            
            if not os.path.exists(startup_path):
                print(f"Startup file {startup_file} not found in shared folder. Skipping.")
                return
            
            if not os.path.isfile(startup_path):
                print(f"Startup file {startup_path} is not a file. Skipping.")
                return
            
            print(f"Executing startup file: {startup_file}")
            
            # Determine how to execute based on file extension
            file_ext = os.path.splitext(startup_file)[1].lower()
            
            if file_ext == '.py':
                command = f"python {startup_path}"
            elif file_ext in ['.sh', '.bash']:
                command = f"bash {startup_path}"
            elif file_ext in ['.ps1']:
                command = f"powershell -ExecutionPolicy Bypass -File {startup_path}"
            elif file_ext in ['.bat', '.cmd']:
                command = startup_path
            else:
                # Try to execute directly (for executable files)
                if os.access(startup_path, os.X_OK):
                    command = startup_path
                else:
                    print(f"Unknown file type for startup file {startup_file}. Skipping.")
                    return
            
            # Create a command document in Firestore so it's tracked and visible in UI
            cmd_id = f"startup_{int(time.time())}"
            cmd_data = {
                'command': command,
                'type': 'shell',
                'status': 'pending',
                'created_at': firestore.SERVER_TIMESTAMP,
                'is_startup': True
            }
            
            # Create the document first — best-effort; if it fails the command
            # still runs locally and the next heartbeat / final write will sync.
            with_retry(
                lambda: self.doc_ref.collection('commands').document(cmd_id).set(cmd_data),
                max_retries=5,
                retry_delay=2.0,
                max_delay=15.0,
                operation_name="create startup command doc",
                suppress_final_error=True,
            )

            # Execute using the standard command executor
            print(f"Queueing startup command: {command}")
            self.start_command(cmd_id, cmd_data)
            
        except Exception as e:
            print(f"Error checking/executing startup file: {e}")

if __name__ == "__main__":
    print("Starting DontPortForward Agent...")
    
    # Sync the registry with api.py module so they share the same dict
    import sys
    if 'api' in sys.modules:
        sys.modules['api'].active_commands_registry = active_commands_registry
    if 'agent.api' in sys.modules:
        sys.modules['agent.api'].active_commands_registry = active_commands_registry
    
    # Start API in a separate thread
    api_thread = threading.Thread(target=start_api)
    api_thread.daemon = True
    api_thread.start()
    
    # Give API a moment to start
    time.sleep(2)
    
    agent = Agent(DEVICE_ID)
    agent.register()
    
    # Start file syncer early so startup files can be synced
    agent.start_file_syncer()
    
    # Wait a moment for registration to complete and file syncer to sync files
    time.sleep(5)
    
    # Check for and execute startup file
    agent.run_startup_file()
    
    agent.listen_for_commands()
