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
except ImportError:
    from agent.api import app as api_app

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
IDLE_TIMEOUT = 60
SHARED_FOLDER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shared')
API_URL = "http://localhost:8000"

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
    pass

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
        if not os.path.exists(self.local_path):
            os.makedirs(self.local_path)

    def run(self):
        bucket = storage.bucket()
        prefix = f"agents/{self.device_id}/shared/"
        
        while not self.should_stop:
            try:
                blobs = list(bucket.list_blobs(prefix=prefix))
                
                # Remote -> Local Sync
                for blob in blobs:
                    filename = os.path.basename(blob.name)
                    if not filename: continue 
                    
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
                        # Retry download with exponential backoff
                        max_retries = 3
                        retry_delay = 1
                        for attempt in range(max_retries):
                            try:
                                blob.download_to_filename(local_file_path)
                                os.utime(local_file_path, (remote_mtime, remote_mtime))
                                break  # Success
                            except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded, ConnectionError) as e:
                                if attempt < max_retries - 1:
                                    wait_time = retry_delay * (2 ** attempt)
                                    print(f"Network error downloading {filename} (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s...")
                                    time.sleep(wait_time)
                                else:
                                    print(f"Failed to download {filename} after {max_retries} attempts: {e}")
                            except Exception as e:
                                print(f"Error downloading {filename}: {e}")
                                break

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
                print(f"Error in FileSyncer: {e}")
            
            for _ in range(10): 
                if self.should_stop: break
                time.sleep(1)

    def stop(self):
        self.should_stop = True

class CommandExecutor(threading.Thread):
    """
    Handles the execution of a single command (shell or API) in a separate thread.
    Captures stdout/stderr and updates Firestore in real-time.
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
        self.last_flush = time.time()
        self.kill_listener = None
        self.flush_interval = 30.0  # Update status in Firestore every 30 seconds (reduced from 10s to cut DB ops by 66%)
        self.command_start_time = time.time()
        self.max_memory_lines = 10000  # Keep last 10k lines in memory (can be large, no DB limit)

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
        self.kill_listener = self.cmd_ref.on_snapshot(self.on_doc_update)
        
        # Register this command in the global registry for API access
        active_commands_registry[self.cmd_id] = self

        try:
            self.cmd_ref.update({
                'status': 'processing',
                'started_at': firestore.SERVER_TIMESTAMP
            })

            if command_type == 'restart':
                self.cmd_ref.update({'output': 'Agent restarting...', 'status': 'completed', 'completed_at': firestore.SERVER_TIMESTAMP})
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
                    # Retry logic with exponential backoff for network failures
                    max_retries = 3
                    retry_delay = 1
                    last_error = None
                    
                    for attempt in range(max_retries):
                        try:
                            response = requests.request(method, url, json=body, timeout=5)
                            try:
                                output_data = json.dumps(response.json(), indent=2)
                            except:
                                output_data = response.text
                                
                            self.cmd_ref.update({
                                'output': output_data,
                                'status': 'completed',
                                'return_code': response.status_code,
                                'completed_at': firestore.SERVER_TIMESTAMP
                            })
                            return  # Success, exit retry loop
                        except (ConnectionError, Timeout) as e:
                            last_error = e
                            if attempt < max_retries - 1:
                                wait_time = retry_delay * (2 ** attempt)
                                print(f"[{self.cmd_id}] Network error (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s...")
                                time.sleep(wait_time)
                            else:
                                raise
                        except RequestException as e:
                            # Non-retryable request errors (4xx, 5xx)
                            raise
                    
                except Exception as e:
                    error_msg = f"Network error: {str(e)}" if isinstance(e, (ConnectionError, Timeout)) else str(e)
                    print(f"[{self.cmd_id}] API request failed: {error_msg}")
                    try:
                        self.cmd_ref.update({
                            'error': error_msg,
                            'status': 'completed',
                            'completed_at': firestore.SERVER_TIMESTAMP
                        })
                    except Exception as update_error:
                        print(f"[{self.cmd_id}] Failed to update Firestore with error: {update_error}")
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
                
                # Check for new data less frequently to reduce CPU usage
                self.flush_output()
                time.sleep(0.5)  # Check every 0.5s instead of 0.1s

            return_code = self.process.returncode
            error_msg = "Command cancelled by user." if self.should_stop else ""

            # Final status update (no output written to DB)
            self.flush_output(force=True)
            
            update_data = {
                'status': 'completed',
                'return_code': return_code,
                'completed_at': firestore.SERVER_TIMESTAMP
            }
            if self.should_stop:
                update_data['status'] = 'cancelled'

            # Retry final status update with exponential backoff
            max_retries = 3
            retry_delay = 1
            for attempt in range(max_retries):
                try:
                    self.cmd_ref.update(update_data)
                    break  # Success
                except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded) as e:
                    if attempt < max_retries - 1:
                        wait_time = retry_delay * (2 ** attempt)
                        print(f"[{self.cmd_id}] Network error updating final status (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        print(f"[{self.cmd_id}] Failed to update final status after {max_retries} attempts: {e}")
                except Exception as e:
                    print(f"[{self.cmd_id}] Error updating final status: {e}")
                    break
            
            # Keep in registry for a short time after completion for API access
            # Will be cleaned up after a delay

        except Exception as e:
            print(f"[{self.cmd_id}] Error: {e}")
            # Retry error status update
            max_retries = 2
            retry_delay = 1
            for attempt in range(max_retries):
                try:
                    self.cmd_ref.update({
                        'status': 'completed',
                        'error': str(e),
                        'completed_at': firestore.SERVER_TIMESTAMP
                    })
                    break
                except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded) as update_error:
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay * (2 ** attempt))
                    else:
                        print(f"[{self.cmd_id}] Failed to update error status: {update_error}")
                except Exception as update_error:
                    print(f"[{self.cmd_id}] Error updating error status: {update_error}")
                    break
        finally:
            if self.kill_listener:
                self.kill_listener.unsubscribe()
            if self.process and self.process.poll() is None:
                 self.process.terminate()
            # Unregister after a delay to allow API access to final output
            def cleanup():
                time.sleep(300)  # Keep for 5 minutes after completion
                if self.cmd_id in active_commands_registry:
                    del active_commands_registry[self.cmd_id]
            threading.Thread(target=cleanup, daemon=True).start()

    def flush_output(self, force=False):
        """Update status in Firestore periodically. Output is NOT written to DB."""
        current_time = time.time()
        elapsed = current_time - self.last_flush
        
        # Only update status periodically, not output
        if not force and elapsed < self.flush_interval:
            return
        
        # Update only status/metadata in Firestore, never output
        # Gracefully handle network failures - don't retry here to avoid blocking
        try:
            self.cmd_ref.update({
                'last_activity': firestore.SERVER_TIMESTAMP,
                'output_lines': len(self.output_buffer),
                'error_lines': len(self.error_buffer)
            })
            self.last_flush = current_time
        except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded) as e:
            # Network errors - log but don't fail, will retry on next flush
            print(f"[{self.cmd_id}] Network error updating status (will retry): {e}")
        except Exception as e:
            print(f"[{self.cmd_id}] Error updating status: {e}")
    
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
                            # Retry output request update with exponential backoff
                            max_retries = 2
                            retry_delay = 0.5
                            for attempt in range(max_retries):
                                try:
                                    self.cmd_ref.update({
                                        'output': stdout,
                                        'error': stderr,
                                        'output_request': firestore.DELETE_FIELD  # Clear the request
                                    })
                                    break  # Success
                                except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded) as e:
                                    if attempt < max_retries - 1:
                                        time.sleep(retry_delay * (2 ** attempt))
                                    else:
                                        print(f"[{self.cmd_id}] Error handling output request after {max_retries} attempts: {e}")
                                except Exception as e:
                                    print(f"[{self.cmd_id}] Error handling output request: {e}")
                                    break
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
        self.active_commands = {} # cmd_id -> CommandExecutor
        self.last_activity_time = time.time()
        self.file_syncer = FileSyncer(device_id)
        
        self.polling_rate = 30  # Increased from 10s to 30s to reduce DB operations by 66%
        self.sleep_polling_rate = 60
        self.idle_timeout = IDLE_TIMEOUT

        self.doc_ref.on_snapshot(self.on_device_update)

    def on_device_update(self, doc_snapshot, changes, read_time):
        for change in changes:
             if change.type.name == 'MODIFIED':
                 data = change.document.to_dict()
                 if data:
                     if 'polling_rate' in data:
                         self.polling_rate = data['polling_rate']
                     if 'sleep_polling_rate' in data:
                         self.sleep_polling_rate = data['sleep_polling_rate']
                     print(f"Config updated: Active={self.polling_rate}s, Sleep={self.sleep_polling_rate}s")

    def fetch_agent_info(self):
        """Fetches data from the local API with retry logic."""
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                response = requests.get(f"{API_URL}/status", timeout=5)
                if response.status_code == 200:
                    return response.json()
                else:
                    print(f"API returned status {response.status_code}, retrying...")
            except (ConnectionError, Timeout) as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)
                    print(f"Network error fetching agent info (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    print(f"Error fetching data from API after {max_retries} attempts: {e}")
            except Exception as e:
                print(f"Error fetching data from API: {e}")
                break  # Don't retry for non-network errors
        
        return {}  # Return empty dict on failure

    def register(self):
        """Register device with retry logic for network failures."""
        max_retries = 3
        retry_delay = 2
        
        for attempt in range(max_retries):
            try:
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
                    'polling_rate': 30,  # Increased from 10s to 30s to reduce DB operations
                    'sleep_polling_rate': 60,
                    'allowed_emails': ALLOWED_EMAILS.split(',') if ALLOWED_EMAILS else []
                }
                
                self.doc_ref.set(data, merge=True)
                print(f"Device {self.device_id} registered.")
                return  # Success
            except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded, ConnectionError) as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)
                    print(f"Network error registering device (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s...")
                    time.sleep(wait_time)
                else:
                    print(f"Error registering device after {max_retries} attempts: {e}")
            except Exception as e:
                print(f"Error registering device: {e}")
                break  # Don't retry for non-network errors

    def start_watching(self):
        if not self.watch:
             print("Starting real-time listener...")
             commands_ref = self.doc_ref.collection('commands').where(field_path='status', op_string='==', value='pending')
             self.watch = commands_ref.on_snapshot(self.on_command_snapshot)

    def stop_watching(self):
        if self.watch:
            print("Stopping real-time listener...")
            self.watch.unsubscribe()
            self.watch = None

    def has_pending_commands(self):
        try:
            docs = self.doc_ref.collection('commands').where(field_path='status', op_string='==', value='pending').limit(1).get()
            return len(list(docs)) > 0
        except Exception as e:
            print(f"Error checking for pending commands: {e}")
            return False

    def send_heartbeat(self):
        """Send heartbeat with graceful error handling."""
        try:
            info = self.fetch_agent_info()
            update_data = {
                'last_seen': firestore.SERVER_TIMESTAMP,
                'stats': info.get('stats', {}),
                'mode': 'active' if self.watch else 'sleep'
            }
            if info.get('git'):
                update_data['git'] = info.get('git')
            
            # Retry logic for Firestore updates
            max_retries = 2
            retry_delay = 1
            for attempt in range(max_retries):
                try:
                    self.doc_ref.update(update_data)
                    return  # Success
                except (google_exceptions.ServiceUnavailable, google_exceptions.DeadlineExceeded) as e:
                    if attempt < max_retries - 1:
                        time.sleep(retry_delay * (2 ** attempt))
                    else:
                        print(f"Error sending heartbeat after {max_retries} attempts: {e}")
                except Exception as e:
                    print(f"Error sending heartbeat: {e}")
                    break
        except Exception as e:
            print(f"Error preparing heartbeat: {e}")

    def start_file_syncer(self):
        """Start the file syncer if not already running."""
        if not self.file_syncer.is_alive():
            self.file_syncer.start()

    def listen_for_commands(self):
        self.last_activity_time = time.time()
        self.start_watching()
        self.start_file_syncer()
        
        while self.running:
            current_time = time.time()
            
            finished_ids = [cmd_id for cmd_id, thread in self.active_commands.items() if not thread.is_alive()]
            for cmd_id in finished_ids:
                print(f"Command {cmd_id} finished.")
                del self.active_commands[cmd_id]

            is_busy = len(self.active_commands) > 0

            idle_time = current_time - self.last_activity_time
            
            if self.watch: 
                if idle_time > self.idle_timeout:
                    print(f"No activity for {self.idle_timeout}s. Entering sleep mode...")
                    self.stop_watching()
                else:
                    self.send_heartbeat()
                    time.sleep(self.polling_rate)
            else: 
                if self.has_pending_commands():
                    print("Activity detected via poll. Waking up...")
                    self.last_activity_time = time.time()
                    self.start_watching()
                else:
                    self.send_heartbeat()
                    time.sleep(self.sleep_polling_rate)
        
        self.file_syncer.stop()
        self.file_syncer.join()

    def on_command_snapshot(self, col_snapshot, changes, read_time):
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
            # Get the device document to check for startup_file
            doc_snapshot = self.doc_ref.get()
            if not doc_snapshot.exists:
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
            
            # Create the document first
            self.doc_ref.collection('commands').document(cmd_id).set(cmd_data)
            
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
