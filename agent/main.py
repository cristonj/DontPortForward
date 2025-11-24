import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import threading
import time
import subprocess
import platform
import os
import json
import sys
import psutil
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration
# TODO: Load from config file or env vars
PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")
DEVICE_ID = os.getenv("DEVICE_ID", platform.node())

# Initialize Firebase
# Note: For production, we'll need a way to authenticate. 
# Either service account json or identity.
try:
    cred = credentials.ApplicationDefault()
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        # Fallback to looking for serviceAccountKey.json
        if os.path.exists("serviceAccountKey.json"):
            cred = credentials.Certificate("serviceAccountKey.json")
    
    firebase_admin.initialize_app(cred, {
        'projectId': PROJECT_ID,
    })
    db = firestore.client()
except Exception as e:
    print(f"Error initializing Firebase: {e}")
    # We might want to exit or retry, but for now let's just print
    pass

class Agent:
    def __init__(self, device_id):
        self.device_id = device_id
        self.running = True
        self.doc_ref = db.collection('devices').document(self.device_id)

    def register(self):
        """Register the device in Firestore."""
        try:
            self.doc_ref.set({
                'hostname': platform.node(),
                'platform': platform.system(),
                'release': platform.release(),
                'version': platform.version(),
                'last_seen': firestore.SERVER_TIMESTAMP,
                'status': 'online',
                'ip': self.get_ip_address(), # simplified
                'stats': self.collect_stats()
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
            print(f"Error collecting stats: {e}")
            return {}

    def get_ip_address(self):
        # Placeholder for getting local IP
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"

    def listen_for_commands(self):
        """Listen for new commands in the commands subcollection."""
        # Using a snapshot listener
        commands_ref = self.doc_ref.collection('commands').where('status', '==', 'pending')
        commands_watch = commands_ref.on_snapshot(self.on_command_snapshot)
        
        while self.running:
            # Heartbeat and Stats
            stats = self.collect_stats()
            self.doc_ref.update({
                'last_seen': firestore.SERVER_TIMESTAMP,
                'stats': stats
            })
            time.sleep(10) # Update stats every 10 seconds

    def on_command_snapshot(self, col_snapshot, changes, read_time):
        for change in changes:
            if change.type.name == 'ADDED':
                cmd_doc = change.document
                cmd_data = cmd_doc.to_dict()
                print(f"Received command: {cmd_data}")
                self.process_command(cmd_doc.id, cmd_data)

    def process_command(self, cmd_id, cmd_data):
        command_str = cmd_data.get('command')
        command_type = cmd_data.get('type', 'shell')
        
        print(f"Executing: {command_str} (Type: {command_type})")
        
        # Mark as processing
        self.doc_ref.collection('commands').document(cmd_id).update({
            'status': 'processing',
            'started_at': firestore.SERVER_TIMESTAMP
        })

        output = ""
        error = ""
        return_code = 0
        should_restart = False

        try:
            if command_type == 'restart':
                output = "Agent restarting..."
                should_restart = True
            elif command_type == 'shell':
                if not command_str:
                    raise ValueError("No command string provided for shell execution")
                # Execute command
                # TODO: Implement security checks/whitelisting here!
                result = subprocess.run(
                    command_str, 
                    shell=True, 
                    capture_output=True, 
                    text=True,
                    timeout=30 # Default timeout
                )
                
                output = result.stdout
                error = result.stderr
                return_code = result.returncode
            else:
                error = f"Unknown command type: {command_type}"
                return_code = 1

        except subprocess.TimeoutExpired:
            output = ""
            error = "Command timed out"
            return_code = -1
        except Exception as e:
            output = ""
            error = str(e)
            return_code = -1

        # Update result
        self.doc_ref.collection('commands').document(cmd_id).update({
            'status': 'completed',
            'output': output,
            'error': error,
            'return_code': return_code,
            'completed_at': firestore.SERVER_TIMESTAMP
        })

        if should_restart:
            print("Restarting agent as requested...")
            sys.exit(0)

if __name__ == "__main__":
    print("Starting DontPortForward Agent...")
    agent = Agent(DEVICE_ID)
    agent.register()
    agent.listen_for_commands()

