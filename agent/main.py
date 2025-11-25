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

if env_local.exists():
    print(f"Loading env from {env_local}")
    load_dotenv(dotenv_path=env_local)
elif env_file.exists():
    print(f"Loading env from {env_file}")
    load_dotenv(dotenv_path=env_file)
else:
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
IDLE_TIMEOUT = 30
SHARED_FOLDER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shared')
API_URL = "http://localhost:8000"

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
                        blob.download_to_filename(local_file_path)
                        os.utime(local_file_path, (remote_mtime, remote_mtime))

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
    def __init__(self, cmd_id, cmd_data, device_ref):
        super().__init__()
        self.cmd_id = cmd_id
        self.cmd_data = cmd_data
        self.device_ref = device_ref
        self.cmd_ref = device_ref.collection('commands').document(cmd_id)
        self.process = None
        self.should_stop = False
        self.output_buffer = []
        self.error_buffer = []
        self.last_flush = time.time()
        self.kill_listener = None

    def _read_stream(self, stream, buffer):
        try:
            for line in iter(stream.readline, ''):
                if line:
                    buffer.append(line)
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
        self.kill_listener = self.cmd_ref.on_snapshot(self.on_doc_update)

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
                
                self.flush_output()
                time.sleep(0.1)

            return_code = self.process.returncode
            error_msg = "Command cancelled by user." if self.should_stop else ""

            self.flush_output(force=True)
            
            update_data = {
                'status': 'completed',
                'return_code': return_code,
                'completed_at': firestore.SERVER_TIMESTAMP
            }
            if self.should_stop:
                update_data['error'] = (self.cmd_data.get('error', '') + '\n' + error_msg).strip()
                update_data['status'] = 'cancelled'

            self.cmd_ref.update(update_data)

        except Exception as e:
            print(f"[{self.cmd_id}] Error: {e}")
            self.cmd_ref.update({
                'status': 'completed',
                'error': str(e),
                'completed_at': firestore.SERVER_TIMESTAMP
            })
        finally:
            if self.kill_listener:
                self.kill_listener.unsubscribe()
            if self.process and self.process.poll() is None:
                 self.process.terminate()

    def flush_output(self, force=False):
        current_time = time.time()
        if force or (current_time - self.last_flush > 1.0):
            updates = {}
            full_out = "".join(self.output_buffer)
            full_err = "".join(self.error_buffer)
            
            if full_out or full_err:
                updates['output'] = full_out
                updates['error'] = full_err
                
                try:
                    self.cmd_ref.update(updates)
                    self.last_flush = current_time
                except Exception as e:
                    print(f"[{self.cmd_id}] Error flushing: {e}")
                    if "Resource exhausted" in str(e) or "Document too large" in str(e):
                        self.cmd_ref.update({
                            'error': full_err + "\n[Output truncated due to size limit]",
                            'status': 'completed'
                        })
                        self.should_stop = True

    def on_doc_update(self, col_snapshot, changes, read_time):
        try:
            docs = []
            if hasattr(col_snapshot, '__iter__'):
                docs = list(col_snapshot)
            else:
                docs = [col_snapshot]

            for doc in docs:
                data = doc.to_dict()
                if data and data.get('kill_signal') is True:
                    self.should_stop = True
        except Exception as e:
            print(f"Error in kill listener: {e}")


class Agent:
    def __init__(self, device_id):
        self.device_id = device_id
        self.running = True
        self.doc_ref = db.collection('devices').document(self.device_id)
        self.watch = None
        self.active_commands = {} # cmd_id -> CommandExecutor
        self.last_activity_time = time.time()
        self.file_syncer = FileSyncer(device_id)
        
        self.polling_rate = 10
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
        """Fetches data from the local API."""
        try:
            response = requests.get(f"{API_URL}/status", timeout=5)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Error fetching data from API: {e}")
        return {}

    def register(self):
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
                'polling_rate': 10,
                'sleep_polling_rate': 60,
                'allowed_emails': ALLOWED_EMAILS.split(',') if ALLOWED_EMAILS else []
            }
            
            self.doc_ref.set(data, merge=True)
            print(f"Device {self.device_id} registered.")
        except Exception as e:
            print(f"Error registering device: {e}")

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
        try:
            info = self.fetch_agent_info()
            update_data = {
                'last_seen': firestore.SERVER_TIMESTAMP,
                'stats': info.get('stats', {}),
                'mode': 'active' if self.watch else 'sleep'
            }
            if info.get('git'):
                update_data['git'] = info.get('git')
                
            self.doc_ref.update(update_data)
        except Exception as e:
            print(f"Error sending heartbeat: {e}")

    def listen_for_commands(self):
        self.last_activity_time = time.time()
        self.start_watching()
        self.file_syncer.start()
        
        while self.running:
            current_time = time.time()
            
            finished_ids = [cmd_id for cmd_id, thread in self.active_commands.items() if not thread.is_alive()]
            for cmd_id in finished_ids:
                print(f"Command {cmd_id} finished.")
                del self.active_commands[cmd_id]

            is_busy = len(self.active_commands) > 0
            if is_busy:
                self.last_activity_time = current_time

            idle_time = current_time - self.last_activity_time
            
            if self.watch: 
                if idle_time > self.idle_timeout and not is_busy:
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

if __name__ == "__main__":
    print("Starting DontPortForward Agent...")
    
    # Start API in a separate thread
    api_thread = threading.Thread(target=start_api)
    api_thread.daemon = True
    api_thread.start()
    
    # Give API a moment to start
    time.sleep(2)
    
    agent = Agent(DEVICE_ID)
    agent.register()
    agent.listen_for_commands()
