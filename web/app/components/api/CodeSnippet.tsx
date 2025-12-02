"use client";

import { memo, useState, useCallback, useMemo } from "react";
import type { ApiEndpoint } from "../../types/api";
import { API_COMMAND_TYPE } from "../../constants";

type SnippetLang = 'python' | 'js';

interface CodeSnippetProps {
  deviceId: string;
  endpoint: ApiEndpoint;
  requestBody: string;
}

export const CodeSnippet = memo(function CodeSnippet({
  deviceId,
  endpoint,
  requestBody,
}: CodeSnippetProps) {
  const [snippetLang, setSnippetLang] = useState<SnippetLang>('python');

  const handleLangChange = useCallback((lang: SnippetLang) => {
    setSnippetLang(lang);
  }, []);

  const snippet = useMemo(() => {
    return generateSnippet(snippetLang, deviceId, endpoint, requestBody);
  }, [snippetLang, deviceId, endpoint, requestBody]);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col shrink-0">
      <SnippetHeader 
        currentLang={snippetLang} 
        onLangChange={handleLangChange} 
      />
      <SnippetContent content={snippet} />
    </div>
  );
});

interface SnippetHeaderProps {
  currentLang: SnippetLang;
  onLangChange: (lang: SnippetLang) => void;
}

const SnippetHeader = memo(function SnippetHeader({ currentLang, onLangChange }: SnippetHeaderProps) {
  return (
    <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900/80">
      <span className="font-bold text-sm text-gray-400 uppercase tracking-wider">
        Access in your app
      </span>
      <div className="flex bg-black rounded-lg p-0.5 border border-gray-800">
        <LangButton
          lang="python"
          label="PYTHON"
          isActive={currentLang === 'python'}
          activeColor="text-blue-400"
          onClick={() => onLangChange('python')}
        />
        <LangButton
          lang="js"
          label="JAVASCRIPT"
          isActive={currentLang === 'js'}
          activeColor="text-yellow-400"
          onClick={() => onLangChange('js')}
        />
      </div>
    </div>
  );
});

interface LangButtonProps {
  lang: SnippetLang;
  label: string;
  isActive: boolean;
  activeColor: string;
  onClick: () => void;
}

const LangButton = memo(function LangButton({ 
  label, 
  isActive, 
  activeColor, 
  onClick 
}: LangButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
        isActive ? `bg-gray-800 ${activeColor}` : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {label}
    </button>
  );
});

interface SnippetContentProps {
  content: string;
}

const SnippetContent = memo(function SnippetContent({ content }: SnippetContentProps) {
  return (
    <div className="p-4 bg-black overflow-x-auto max-h-60 scrollbar-thin scrollbar-thumb-gray-800">
      <pre className="text-[10px] sm:text-xs text-gray-300 font-mono whitespace-pre selection:bg-gray-700 selection:text-white">
        {content}
      </pre>
    </div>
  );
});

function generateSnippet(
  lang: SnippetLang,
  deviceId: string,
  endpoint: ApiEndpoint,
  requestBody: string
): string {
  let bodyObj = {};
  try {
    if (requestBody) bodyObj = JSON.parse(requestBody);
  } catch {
    // Ignore parse errors - use empty object
  }

  if (lang === 'python') {
    const pythonBody = JSON.stringify(bodyObj, null, 4)
      .replace(/true/g, 'True')
      .replace(/false/g, 'False')
      .replace(/null/g, 'None');

    return `import firebase_admin
from firebase_admin import credentials, firestore
import time

# Initialize (if not already done)
if not firebase_admin._apps:
    cred = credentials.Certificate('path/to/serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()
device_id = "${deviceId}"

command = {
    'type': '${API_COMMAND_TYPE}',
    'endpoint': '${endpoint.path}',
    'method': '${endpoint.method}',
    'body': ${pythonBody}, 
    'status': 'pending',
    'created_at': firestore.SERVER_TIMESTAMP
}

_, doc_ref = db.collection('devices').document(device_id).collection('commands').add(command)
print(f"Command sent: {doc_ref.id}")

# Poll for result
while True:
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        if data.get('status') == 'completed':
            print("Output:", data.get('output'))
            break
        elif data.get('status') == 'cancelled':
            print("Cancelled")
            break
    time.sleep(1)`;
  } else {
    const jsBody = JSON.stringify(bodyObj, null, 2).replace(/\n/g, '\n  ');
    return `// Using Firebase JS SDK
import { db } from "./firebase-config";
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";

const deviceId = "${deviceId}";

const command = {
  type: 'api',
  endpoint: '${endpoint.path}',
  method: '${endpoint.method}',
  body: ${jsBody},
  status: 'pending',
  created_at: serverTimestamp()
};

// Send command
const docRef = await addDoc(collection(db, "devices", deviceId, "commands"), command);
console.log("Command sent:", docRef.id);

// Listen for result
const unsub = onSnapshot(doc(db, "devices", deviceId, "commands", docRef.id), (snap) => {
  const data = snap.data();
  if (data?.status === 'completed') {
    console.log("Response:", data.output);
    unsub();
  } else if (data?.status === 'cancelled') {
    console.log("Cancelled");
    unsub();
  }
});`;
  }
}
