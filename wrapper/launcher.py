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
REBOOT_TIME = "03:00" # Reboot at 3 AM
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

def should_reboot():
    """Checks if it's time to reboot the system."""
    now = datetime.datetime.now()
    current_time = now.strftime("%H:%M")
    return current_time == REBOOT_TIME

def run_agent(root_dir):
    """Runs the agent script as a subprocess."""
    agent_path = os.path.join(root_dir, AGENT_SCRIPT_PATH)
    if not os.path.exists(agent_path):
        print(f"Error: Agent script not found at {agent_path}")
        return None

    print(f"Launching {agent_path}...")
    # Run from the project root so imports work if needed, 
    # or from agent dir? Usually agent dir is better for relative file access (like serviceAccountKey.json).
    # The original agent code looks for serviceAccountKey.json in current dir.
    # So let's run it from the agent directory.
    agent_dir = os.path.dirname(agent_path)
    return subprocess.Popen([sys.executable, "main.py"], cwd=agent_dir)

def main():
    root_dir = get_project_root()
    print(f"Project root: {root_dir}")
    
    agent_process = run_agent(root_dir)
    last_update_check = time.time()
    
    while True:
        try:
            time.sleep(1)
            
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

            # Check if agent is still running
            if agent_process is None or agent_process.poll() is not None:
                print(f"Agent not running. Restarting...")
                agent_process = run_agent(root_dir)

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

