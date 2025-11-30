# DontPortForward

## Remote device management using Google Firebase as a relay. **No port forwarding required**.
*  This project is solving a simple problem: how do I make a **universal tool** to allow **authenticated** remote access from a webapp?
*  By "universal" I mean a tool that will work on **any computer on any network** and allow access to it from any computer on any other network.
*  By "authenticated" I mean a controlled list of authorized google accounts.
*  My initial usecase was for a raspberry pi at a remote cabin. The internet there is a T-Mobile hotspot; it cannot be port forwarded.
*  If you "self host" this project (not really self hosting, google handles the "relay server" for you), you can expect **usage costs on the order of cents per month** with moderate usage. 
*  Very affordable for **multiple devices 24/7** remote setup.

### The system consists of 4 main components:
*  **Wrapper**: This python script pulls changes from github to keep the agent up to date. It also helps with platform compatibility, and is where the sleep timeout and automatic system reboot interval are set.
*  **Agent**: Runs on the target device (Linux, Windows, macOS). Polls Firestore for commands to run, hosts the API, pushes status, and syncs files from github/shared files.
*  **Web Console**: Next.js app to view devices, send commands, and manage files. I use netlify to host it. The instructions assume you know how to host a nextjs app.
*  **Google Firebase**: In these instructions we will use this for our realtime database, storage and authentication provider.

### Command execution follows this flow: 
*  Authenticated user sends console command from webapp.
*  Firestore holds it in a "Pending Commands" DB collection.
*  Every 60 seconds (adjustable, and this is quicker while "awake") the agent looks for new commands from the DB.
*  If there is a new command the agent runs it and if console output is requested uploads the most recent console output to firestore.
*  Webapp displays the command output.

### Initial Setup Instructions
    
1.  Clone this repo on the device you want to remote control.
2.  Create a Firebase project. If you expect to use this a lot, enable the "Blaze" plan; It does take a card, but the free usage is generous and past that 100,000 reads is 3 cents.
3.  Enable **Firestore Database** and **Storage**.
4.  Enable **Authentication** and add the **Google** provider.
5.  Copy `firestore.rules` content to Firestore Rules in Firebase Console.
6.  Copy `storage.rules` content to Storage Rules in Firebase Console.
7.  Generate a Service Account Key (for the agent) and save as `agent/serviceAccountKey.json`.
8.  Create a web app in Firebase project settings and get the config keys.
9.  Create a `web/.env.local` containing your Firebase config keys:
    ```env
    NEXT_PUBLIC_FIREBASE_API_KEY=...
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
    NEXT_PUBLIC_FIREBASE_APP_ID=...
    ALLOWED_EMAILS:... This is the comma seperated list of emails allowed to access the webapp. This can be different than the list of emails allowed to access the agent.
    ```
10. Now upload that `.env.local` content to netlify or whatever hosting provider you are using.
11. Now we use that same `web/.env.local` file we just created for the agent's config (these are the required values for just the agent):
    ```env
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
    ALLOWED_EMAILS=... The comma seperated list of emails allowed to access this agent.
    DEVICE_ID=... This value is optional and sets the name for this agent that will be displayed in the device list.
12. Navigate to `agent/`.
13. Install dependencies: (You should already have a recent version of python installed.)
    ```bash
    pip install -r requirements.txt
    ```
14. ***WAIT!*** The script is **by default** set to **automatically reboot** the machine if uptime is >24 hours, **if you run the launcher without changing this setting it may cause your machine to immediately reboot**.
*   You can adjust this interval in `wrapper/launcher.py`
*   **For a long term deployment, configure `wrapper/launcher.py` to run after reboot, when internet access is available.**
        Search the web or ask AI for information on how to do this in your environment.
1.  Run the agent:
    ```bash
    python ../wrapper/launcher.py
    ```

## Usage
*   Log in to the web console with the google account you included in `ALLOWED_EMAILS`.
*   Select a device from the sidebar.
*   **Terminal**: Run shell commands on the agent, recieve output. 
*   **Files**: Upload/Download/Edit/Run files in the shared folder.
*   **API**: Explore the endpoints you can access from the agent.
*   **Info**: View system stats (CPU, RAM, Git status).

## Adding additional agents
*   Follow the `Initial Setup Instructions` starting at **step 9** and skipping **step 10**.