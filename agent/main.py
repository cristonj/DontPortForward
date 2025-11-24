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
import psutil
from dotenv import load_dotenv
from pathlib import Path
import warnings

# Suppress google-crc32c warning (no C extension on Windows Python 3.14)
warnings.filterwarnings("ignore", message="As the c extension couldn't be imported")

# Load environment variables
# Try to find .env.local or .env in the project root (parent of agent directory)
root_dir = Path(__file__).resolve().parent.parent
env_local = root_dir / '.env.local'
env_file = root_dir / '.env'

if env_local.exists():
    print(f"Loading env from {env_local}")
    load_dotenv(dotenv_path=env_local)
elif env_file.exists():
    print(f"Loading env from {env_file}")
    load_dotenv(dotenv_path=env_file)
else:
    # Fallback to default behavior (current dir search)
    load_dotenv()

# Configuration
PROJECT_ID = os.getenv("NEXT_PUBLIC_FIREBASE_PROJECT_ID")
STORAGE_BUCKET = os.getenv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")

if not PROJECT_ID:
    print("Warning: NEXT_PUBLIC_FIREBASE_PROJECT_ID not found in environment variables.")
if not STORAGE_BUCKET:
    print("Warning: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET not found in environment variables.")

DEVICE_ID = os.getenv("DEVICE_ID", platform.node())
IDLE_TIMEOUT = 300  # 5 minutes
SHARED_FOLDER_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shared')

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
                # print("Checking for file updates...")
                blobs = list(bucket.list_blobs(prefix=prefix))
                
                # Remote -> Local Sync
                for blob in blobs:
                    filename = os.path.basename(blob.name)
                    if not filename: continue # Skip directory marker if any
                    
                    local_file_path = os.path.join(self.local_path, filename)
                    remote_mtime = blob.updated.timestamp()
                    
                    download = False
                    if not os.path.exists(local_file_path):
                        download = True
                        print(f"New file found: {filename}")
                    else:
                        # Check modification time
                        local_mtime = os.path.getmtime(local_file_path)
                        # We allow some drift, or just strict newer
                        if remote_mtime > local_mtime:
                            download = True
                            print(f"File updated: {filename}")
                    
                    if download:
                        print(f"Downloading {filename}...")
                        blob.download_to_filename(local_file_path)
                        # Touch local file to match remote time to avoid loop? 
                        # Or just accept that next check local_mtime will be now.
                        # If we set local_mtime to remote_mtime, it handles it.
                        os.utime(local_file_path, (remote_mtime, remote_mtime))

                # Local -> Remote Sync (Optional, implementing Delete if remote deleted?)
                # For now, let's keep it additive/update from remote as source of truth.
                # If we want exact copy, we should delete local files not in remote.
                
                remote_filenames = {os.path.basename(b.name) for b in blobs if os.path.basename(b.name)}
                local_filenames = set(os.listdir(self.local_path))
                
                for filename in local_filenames:
                    if filename not in remote_filenames:
                        # Only delete if it's not a temporary file or something
                        # Assume managed folder
                        print(f"File deleted remotely, removing local: {filename}")
                        try:
                            os.remove(os.path.join(self.local_path, filename))
                        except Exception as e:
                            print(f"Error deleting {filename}: {e}")

            except Exception as e:
                print(f"Error in FileSyncer: {e}")
            
            # Sleep
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
        """Reads from a stream and appends to a buffer in a separate thread."""
        try:
            for line in iter(stream.readline, ''):
                if line:
                    buffer.append(line)
                else:
                    break
        except Exception as e:
            # Stream might be closed
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

        # Listen for kill signal
        self.kill_listener = self.cmd_ref.on_snapshot(self.on_doc_update)

        try:
            # Mark as processing
            self.cmd_ref.update({
                'status': 'processing',
                'started_at': firestore.SERVER_TIMESTAMP
            })

            if command_type == 'restart':
                self.cmd_ref.update({'output': 'Agent restarting...', 'status': 'completed', 'completed_at': firestore.SERVER_TIMESTAMP})
                print("Restarting agent...")
                # We need to exit the main process, but we are in a thread.
                # To kill main process:
                os._exit(0)
                return

            if not command_str:
                raise ValueError("No command string provided")

            # Start process
            # Force python output to be unbuffered using -u if the command is python
            # But the user might run 'python script.py' or just 'script.py'.
            # A generic way to unbuffer stdout in python subprocess is setting env var PYTHONUNBUFFERED=1
            
            env = os.environ.copy()
            env["PYTHONUNBUFFERED"] = "1"

            self.process = subprocess.Popen(
                command_str,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env=env,
                cwd=os.path.dirname(os.path.abspath(__file__)) # Set CWD to agent dir so 'shared/script.py' works
            )
            
            # Start reader threads
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

                # Check if process ended
                if self.process.poll() is not None:
                    # Wait a bit for readers to finish capturing output
                    stdout_thread.join(timeout=1)
                    stderr_thread.join(timeout=1)
                    break
                
                # Flush to firestore if needed
                self.flush_output()
                time.sleep(0.1)

            return_code = self.process.returncode
            if self.should_stop:
                error_msg = "Command cancelled by user."
            else:
                error_msg = ""

            # Final flush
            self.flush_output(force=True)
            
            # Update final status
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
                'status': 'completed', # or error
                'error': str(e),
                'completed_at': firestore.SERVER_TIMESTAMP
            })
        finally:
            if self.kill_listener:
                self.kill_listener.unsubscribe()
            if self.process and self.process.poll() is None:
                 # Cleanup if still running
                 self.process.terminate()

    def flush_output(self, force=False):
        current_time = time.time()
        # Flush every 1 second or if forced
        if force or (current_time - self.last_flush > 1.0):
            updates = {}
            
            # Use current buffer length to determine what's new (though we just concat everything)
            # To properly stream chunks for VERY long outputs without exceeding Firestore document limit,
            # one would need to use subcollections or separate docs.
            # But for "streaming" updates to the same doc, we just update the field.
            # If the output gets massive (>1MB), Firestore will error.
            # For now, we assume reasonable output size.

            full_out = "".join(self.output_buffer)
            full_err = "".join(self.error_buffer)
            
            # Check if there is anything new to update compared to last flush?
            # Actually, we always overwrite 'output' field with full content so far.
            # If we want to reduce writes, we could check if buffers changed length.
            # But here we just check if we have content.
            
            if full_out or full_err:
                updates['output'] = full_out
                updates['error'] = full_err
                
                try:
                    self.cmd_ref.update(updates)
                    self.last_flush = current_time
                except Exception as e:
                    print(f"[{self.cmd_id}] Error flushing: {e}")
                    # If document is too big, maybe we should truncate?
                    if "Resource exhausted" in str(e) or "Document too large" in str(e):
                        self.cmd_ref.update({
                            'error': full_err + "\n[Output truncated due to size limit]",
                            'status': 'completed' # Stop to prevent infinite loop of errors
                        })
                        self.should_stop = True

    def on_doc_update(self, col_snapshot, changes, read_time):
        try:
            # The first argument is the snapshot(s).
            # If it's a list (QuerySnapshot), iterate.
            # If it's a DocumentSnapshot, use it.
            
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

    def get_git_info(self):
        """Collect git status information."""
        try:
            repo_path = os.path.dirname(os.path.abspath(__file__))
            
            def run_git(args):
                return subprocess.check_output(['git'] + args, cwd=repo_path, text=True, stderr=subprocess.DEVNULL).strip()
            
            subprocess.check_call(['git', 'rev-parse', '--is-inside-work-tree'], cwd=repo_path, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)

            branch = run_git(['rev-parse', '--abbrev-ref', 'HEAD'])
            commit = run_git(['rev-parse', '--short', 'HEAD'])
            status = run_git(['status', '--porcelain'])
            is_dirty = bool(status)
            last_commit_date = run_git(['log', '-1', '--format=%cd', '--date=iso'])
            
            return {
                'branch': branch,
                'commit': commit,
                'is_dirty': is_dirty,
                'last_commit_date': last_commit_date
            }
        except Exception:
            return None

    def register(self):
        try:
            self.doc_ref.set({
                'hostname': platform.node(),
                'platform': platform.system(),
                'release': platform.release(),
                'version': platform.version(),
                'last_seen': firestore.SERVER_TIMESTAMP,
                'status': 'online',
                'ip': self.get_ip_address(),
                'stats': self.collect_stats(),
                'git': self.get_git_info()
            }, merge=True)
            print(f"Device {self.device_id} registered.")
        except Exception as e:
            print(f"Error registering device: {e}")

    def collect_stats(self):
        try:
            return {
                'cpu_percent': psutil.cpu_percent(interval=None),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent,
                'boot_time': psutil.boot_time()
            }
        except Exception as e:
            return {}

    def get_ip_address(self):
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"

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
            stats = self.collect_stats()
            git_info = self.get_git_info()
            update_data = {
                'last_seen': firestore.SERVER_TIMESTAMP,
                'stats': stats,
                'mode': 'active' if self.watch else 'sleep'
            }
            if git_info:
                update_data['git'] = git_info
                
            self.doc_ref.update(update_data)
        except Exception as e:
            print(f"Error sending heartbeat: {e}")

    def listen_for_commands(self):
        self.last_activity_time = time.time()
        self.start_watching()
        self.file_syncer.start()
        
        while self.running:
            current_time = time.time()
            
            # Clean up finished threads
            finished_ids = [cmd_id for cmd_id, thread in self.active_commands.items() if not thread.is_alive()]
            for cmd_id in finished_ids:
                print(f"Command {cmd_id} finished.")
                del self.active_commands[cmd_id]

            # Determine activity
            is_busy = len(self.active_commands) > 0
            if is_busy:
                self.last_activity_time = current_time

            idle_time = current_time - self.last_activity_time
            
            if self.watch: # Active Mode
                if idle_time > IDLE_TIMEOUT and not is_busy:
                    print(f"No activity for {IDLE_TIMEOUT}s. Entering sleep mode...")
                    self.stop_watching()
                else:
                    self.send_heartbeat()
                    time.sleep(10)
            else: # Sleep Mode
                if self.has_pending_commands():
                    print("Activity detected via poll. Waking up...")
                    self.last_activity_time = time.time()
                    self.start_watching()
                else:
                    self.send_heartbeat()
                    time.sleep(60)
        
        # Cleanup
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
    agent = Agent(DEVICE_ID)
    agent.register()
    agent.listen_for_commands()
