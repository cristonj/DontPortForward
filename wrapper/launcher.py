import os
import time
import subprocess
import sys
import datetime
from pathlib import Path

# Configuration
# This launcher assumes it is in the 'wrapper' directory
# and the agent is in the 'agent' directory at the same level.
CHECK_INTERVAL = 60  # Check for updates every 60 seconds
REBOOT_INTERVAL = 24 * 60 * 60  # Reboot once per day (24 hours in seconds)
# Paths relative to the project root
AGENT_SCRIPT_PATH = os.path.join("agent", "main.py")

def get_project_root():
    """Returns the project root directory."""
    # current file is in wrapper/, so root is one level up
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def git_pull(root_dir):
    """Pulls changes from git. Returns True if updates were found."""
    try:
        # Check if .git exists in root
        if not os.path.exists(os.path.join(root_dir, ".git")):
            print("Not a git repository. Skipping update check.")
            return False

        # Fetch remote
        subprocess.run(["git", "fetch"], check=True, capture_output=True, cwd=root_dir)
        
        # Check status
        status = subprocess.run(["git", "status", "-uno"], capture_output=True, text=True, cwd=root_dir).stdout
        
        if "Your branch is behind" in status:
            print("Update found. Pulling...")
            subprocess.run(["git", "pull"], check=True, cwd=root_dir)
            return True
        
    except Exception as e:
        print(f"Error checking for updates: {e}")
    
    return False

def restart_program():
    """Restarts the current program (launcher)."""
    print("Restarting launcher...")
    os.execv(sys.executable, ['python'] + sys.argv)

def get_system_uptime():
    """Gets system uptime in seconds. Returns 0 if unable to determine."""
    try:
        if sys.platform == "linux":
            # Read /proc/uptime on Linux
            with open("/proc/uptime", "r") as f:
                uptime_seconds = float(f.read().split()[0])
                return uptime_seconds
        elif sys.platform == "win32":
            # On Windows, use boot time from system
            import ctypes
            lib = ctypes.windll.kernel32
            tick_count = lib.GetTickCount64()
            return tick_count / 1000.0  # Convert milliseconds to seconds
        else:
            # For other platforms, try to use uptime command
            try:
                result = subprocess.run(["uptime", "-s"], capture_output=True, text=True, check=True)
                boot_time_str = result.stdout.strip()
                boot_time = datetime.datetime.strptime(boot_time_str, "%Y-%m-%d %H:%M:%S")
                uptime = (datetime.datetime.now() - boot_time).total_seconds()
                return uptime
            except:
                return 0
    except Exception as e:
        print(f"Error getting system uptime: {e}")
        return 0

def should_reboot():
    """Checks if system has been up for more than 24 hours."""
    uptime = get_system_uptime()
    if uptime > REBOOT_INTERVAL:
        print(f"System uptime: {uptime / 3600:.2f} hours (threshold: {REBOOT_INTERVAL / 3600} hours)")
        return True
    return False

def run_agent(root_dir):
    """
    Runs the agent script as a subprocess.
    
    The agent is executed from its own directory ('agent/') to ensure
    relative paths (like serviceAccountKey.json) work correctly.
    """
    agent_path = os.path.join(root_dir, AGENT_SCRIPT_PATH)
    if not os.path.exists(agent_path):
        print(f"Error: Agent script not found at {agent_path}")
        return None

    print(f"Launching {agent_path}...")
    agent_dir = os.path.dirname(agent_path)
    return subprocess.Popen([sys.executable, "main.py"], cwd=agent_dir)

def main():
    root_dir = get_project_root()
    print(f"Project root: {root_dir}")
    
    agent_process = run_agent(root_dir)
    last_update_check = time.time()
    
    while True:
        try:
            # Calculate time to next update check
            time_since_check = time.time() - last_update_check
            wait_time = max(1, CHECK_INTERVAL - time_since_check)

            if agent_process:
                try:
                    # efficient blocking wait: returns immediately if agent exits, 
                    # otherwise waits up to wait_time
                    agent_process.wait(timeout=wait_time)
                    
                    # If we get here, the agent has exited
                    print(f"Agent exited (code {agent_process.returncode}). Restarting...")
                    agent_process = run_agent(root_dir)
                except subprocess.TimeoutExpired:
                    # Timeout reached, meaning agent is still running.
                    pass
            else:
                # No agent process (failed to start?), sleep briefly and retry
                time.sleep(5)
                agent_process = run_agent(root_dir)
            
            # Check for updates
            if time.time() - last_update_check > CHECK_INTERVAL:
                last_update_check = time.time()
                
                if git_pull(root_dir):
                    print("Code updated. Restarting agent...")
                    if agent_process and agent_process.poll() is None:
                        agent_process.terminate()
                        try:
                            agent_process.wait(timeout=5)
                        except subprocess.TimeoutExpired:
                            agent_process.kill()
                    
                    # Restart launcher to load new launcher code if changed
                    restart_program()

            # Check for system reboot
            if should_reboot():
                print("Scheduled reboot time. Rebooting system...")
                if sys.platform == "win32":
                    subprocess.run(["shutdown", "/r", "/t", "1"])
                else:
                    subprocess.run(["sudo", "reboot"])

        except KeyboardInterrupt:
            print("Stopping...")
            if agent_process and agent_process.poll() is None:
                agent_process.terminate()
            break
        except Exception as e:
            print(f"Launcher error: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()

