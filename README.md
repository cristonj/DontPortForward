# DontPortForward

**Universal remote access solution that works when traditional methods fail.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Overview

DontPortForward allows you to control remote computers via a web console without port forwarding, using Firebase Firestore as a relay.

Traditional remote access often requires configuring router port forwarding, which exposes your network to the internet and can be blocked by ISPs.

**DontPortForward** solves these common problems:
- **Bypasses CGNAT (Carrier-Grade NAT)**: Works even if your ISP assigns a private IP address (common with Starlink, LTE/5G, and some residential providers).
- **No Port Forwarding Required**: Since the agent initiates an outbound connection to Firebase, you don't need to open any inbound ports on your router.
- **Firewall Friendly**: Works behind strict corporate or university firewalls that block incoming connections.
- **Secure**: Uses Firebase authentication and encrypted communication; your device isn't directly exposed to the public internet.
- **Cross-Platform**: The agent runs on both **Windows** and **Linux**.
- **Universal Access**: Control your devices and share files from any web browser via the PWA interface (installable on mobile and desktop).

## 📂 Project Structure

- **`web/`**: Next.js 13+ application with Tailwind CSS. This is the client interface.
- **`agent/`**: Python script (`main.py`) that runs on the target machine, executes commands, and reports back.
- **`wrapper/`**: Python launcher (`launcher.py`) that manages the agent (auto-updates from git, reboots, restarts on crash).

## 🛠 Setup

### 1. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Create a **Firestore Database** (start in Test Mode for development).
3. **Web App**:
   - Register a Web App in Firebase Project Settings.
   - Copy the config keys.
   - Create `web/.env.local`:
     ```bash
     NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
     NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
     ```
4. **Agent (Service Account)**:
   - Go to Project Settings > Service Accounts.
   - Generate a new private key (`serviceAccountKey.json`).
   - Place this file in the `agent/` directory.

### 2. Web Client

```bash
cd web
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### 3. Agent (Target Machine)

**Prerequisites**: Python 3.8+

```bash
# Install dependencies
pip install -r agent/requirements.txt

# Run the wrapper (recommended for production)
python wrapper/launcher.py

# OR Run the agent directly (for testing)
cd agent
python main.py
```

## 🖥 Usage

1. Start the agent on your remote machine.
2. Note the **Device ID** printed in the agent logs (defaults to hostname).
3. Open the Web Console.
4. Enter the **Device ID**.
5. Type commands (e.g., `ls`, `whoami`, `uptime`) and hit Send.

## 🔄 Updates & Maintenance

The `wrapper/launcher.py` script automatically:
- Checks this git repository for updates every minute.
- Pulls changes and restarts the agent if updates are found.
- Reboots the machine daily at 03:00 (configurable).

## 📄 License

MIT License
