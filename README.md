# DontPortForward

Remote device management using Firebase as a relay. No port forwarding required.

## Components

1.  **Agent**: Runs on the target device (Linux, Windows, macOS). Polls Firestore for commands, pushes status, and syncs files.
2.  **Web Console**: Next.js app to view devices, send commands, and manage files.

## Setup Instructions

### 1. Firebase Setup
1.  Create a Firebase project.
2.  Enable **Firestore Database** and **Storage**.
3.  Enable **Authentication** and add the **Google** provider.
4.  Copy `firestore.rules` content to Firestore Rules in Firebase Console.
5.  Copy `storage.rules` content to Storage Rules in Firebase Console.
6.  Generate a Service Account Key (for the agent) and save as `agent/serviceAccountKey.json`.
7.  Create a web app in Firebase project settings and get the config keys.

### 2. Web App Setup
1.  Navigate to `web/`.
2.  Copy `.env.example` to `.env.local` (or create it) and fill in Firebase keys:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
    NEXT_PUBLIC_FIREBASE_APP_ID=...
    ```
3.  Install dependencies and run:
    ```bash
    npm install
    npm run dev
    ```

### 3. Agent Setup
1.  Navigate to `agent/`.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  (Optional) Set Environment Variables:
    *   `DEVICE_ID`: Custom ID (defaults to hostname)
    *   `ALLOWED_EMAILS`: Comma-separated list of emails allowed to access this agent.
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID` & `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`: Required if not loading from `web/.env`.
4.  Run the agent:
    ```bash
    python main.py
    ```

## Usage
*   Log in to the web console with Google.
*   Select a device from the sidebar.
*   **Terminal**: Run shell commands.
*   **Files**: Upload/Download/Edit files in the shared folder.
*   **Info**: View system stats (CPU, RAM, Git status).

## Architecture
*   **Command Relay**: Web App writes to `devices/{id}/commands`. Agent listens, executes, and updates the document with output.
*   **File Sync**: Web App uploads to `agents/{id}/shared/`. Agent polls/syncs this bucket path to its local `agent/shared/` folder.
