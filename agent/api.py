from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psutil
import platform
import subprocess
import os
import socket

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_ip_address():
    """
    Retrieves the primary IP address of the device.
    Uses a connection to a public DNS server (8.8.8.8) to determine the
    local IP address used for outbound traffic. This does not actually
    establish a connection.
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def get_git_info():
    """Collect git status information."""
    try:
        repo_path = os.path.dirname(os.path.abspath(__file__))
        
        def run_git(args):
            return subprocess.check_output(['git'] + args, cwd=repo_path, text=True, stderr=subprocess.DEVNULL).strip()
        
        # Check if inside git tree
        try:
            subprocess.check_call(['git', 'rev-parse', '--is-inside-work-tree'], cwd=repo_path, stderr=subprocess.DEVNULL, stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            return None

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

@app.get("/status")
def get_status():
    try:
        stats = {
            'cpu_percent': psutil.cpu_percent(interval=None),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': psutil.disk_usage('/').percent,
            'boot_time': psutil.boot_time()
        }
    except Exception:
        stats = {}

    return {
        'hostname': platform.node(),
        'platform': platform.system(),
        'release': platform.release(),
        'version': platform.version(),
        'ip': get_ip_address(),
        'stats': stats,
        'git': get_git_info()
    }

@app.get("/health")
def health():
    return {"status": "ok"}

