from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import psutil
import platform
import subprocess
import os
import socket

# Command registry - will be set by main.py after initialization
# This avoids circular import issues
active_commands_registry = {}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CommandRequest(BaseModel):
    command: str
    cwd: Optional[str] = None

class FileReadRequest(BaseModel):
    path: str

class FileWriteRequest(BaseModel):
    path: str
    content: str

def get_ip_address():
    """
    Retrieves the primary IP address of the device.
    Uses a connection to a public DNS server (8.8.8.8) to determine the
    local IP address used for outbound traffic. This does not actually
    establish a connection.
    Gracefully handles network failures by falling back to localhost.
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)  # Set timeout to avoid hanging
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except (socket.timeout, socket.error, OSError) as e:
        # Network error - fallback to localhost
        return "127.0.0.1"
    except Exception:
        # Any other error - fallback to localhost
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

@app.post("/exec")
def execute_command(request: CommandRequest):
    try:
        result = subprocess.run(
            request.command,
            shell=True,
            capture_output=True,
            text=True,
            cwd=request.cwd or os.getcwd()
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/files/list")
def list_files(path: str = "."):
    try:
        abs_path = os.path.abspath(path)
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="Path not found")
        
        files = []
        for item in os.listdir(abs_path):
            item_path = os.path.join(abs_path, item)
            try:
                stat = os.stat(item_path)
                files.append({
                    "name": item,
                    "is_dir": os.path.isdir(item_path),
                    "size": stat.st_size,
                    "mtime": stat.st_mtime
                })
            except OSError:
                continue
        return {"files": files, "path": abs_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/files/read")
def read_file(request: FileReadRequest):
    try:
        abs_path = os.path.abspath(request.path)
        if not os.path.exists(abs_path):
            raise HTTPException(status_code=404, detail="File not found")
        if not os.path.isfile(abs_path):
             raise HTTPException(status_code=400, detail="Not a file")
             
        with open(abs_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        return {"content": content, "path": abs_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/files/write")
def write_file(request: FileWriteRequest):
    try:
        abs_path = os.path.abspath(request.path)
        # Ensure directory exists
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
        
        with open(abs_path, 'w', encoding='utf-8') as f:
            f.write(request.content)
        return {"status": "success", "path": abs_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/processes")
def list_processes():
    try:
        current_user = None
        try:
            current_user = psutil.Process().username()
        except Exception:
            pass

        procs = []
        for proc in psutil.process_iter(['pid', 'name', 'username', 'status', 'cpu_percent', 'memory_percent']):
            try:
                # Filter by current user if available to reduce noise
                if current_user and proc.info.get('username') != current_user:
                    continue
                    
                procs.append(proc.info)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
                
        # Sort by CPU usage descending
        procs.sort(key=lambda x: x.get('cpu_percent', 0), reverse=True)
        
        return {"processes": procs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/processes/{pid}")
def kill_process(pid: int):
    try:
        proc = psutil.Process(pid)
        proc.kill()
        return {"status": "success", "pid": pid}
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/commands/{cmd_id}/output")
def get_command_output(cmd_id: str, seconds: int = Query(60, ge=1, le=3600, description="Number of seconds of output to retrieve")):
    """
    Get recent output for a command. Output is stored in memory only, not in database.
    Returns the last N seconds of output (default 60 seconds).
    """
    try:
        # Try to get from registry
        if cmd_id not in active_commands_registry:
            raise HTTPException(status_code=404, detail="Command not found or no longer available")
        
        executor = active_commands_registry[cmd_id]
        stdout, stderr = executor.get_recent_output(seconds=seconds)
        
        return {
            "cmd_id": cmd_id,
            "output": stdout,
            "error": stderr,
            "seconds": seconds,
            "status": "active" if executor.process and executor.process.poll() is None else "completed"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/commands/{cmd_id}/output/all")
def get_all_command_output(cmd_id: str):
    """
    Get all available output for a command (up to memory limit).
    """
    try:
        if cmd_id not in active_commands_registry:
            raise HTTPException(status_code=404, detail="Command not found or no longer available")
        
        executor = active_commands_registry[cmd_id]
        stdout, stderr = executor.get_all_output()
        
        return {
            "cmd_id": cmd_id,
            "output": stdout,
            "error": stderr,
            "status": "active" if executor.process and executor.process.poll() is None else "completed"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
