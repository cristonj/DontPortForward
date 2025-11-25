"use client";

import { useState } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";

interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
}

const ENDPOINTS: ApiEndpoint[] = [
  { path: "/status", method: "GET", description: "Get full system status including hardware stats and git info" },
  { path: "/health", method: "GET", description: "Simple health check endpoint" },
];

export default function ApiExplorer({ deviceId }: { deviceId: string }) {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint>(ENDPOINTS[0]);
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExecute = async () => {
    if (!deviceId) return;
    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      const commandsRef = collection(db, "devices", deviceId, "commands");
      const docRef = await addDoc(commandsRef, {
        type: 'api',
        endpoint: selectedEndpoint.path,
        method: selectedEndpoint.method,
        status: 'pending',
        created_at: serverTimestamp()
      });

      const unsubscribe = onSnapshot(doc(db, "devices", deviceId, "commands", docRef.id), (snap) => {
        const data = snap.data();
        if (data?.status === 'completed') {
          if (data.error) {
            setError(data.error);
          } else {
            setResponse(data.output);
          }
          setLoading(false);
          unsubscribe();
        } else if (data?.status === 'cancelled') {
             setError("Request cancelled");
             setLoading(false);
             unsubscribe();
        }
      });

    } catch (err: any) {
      console.error("Error executing API request:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 text-gray-200 font-mono">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">API Explorer</h2>
        <p className="text-sm text-gray-500">Explore the agent's local API endpoints.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Sidebar: Endpoints */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-800 bg-gray-900/80 font-bold text-sm text-gray-400 uppercase tracking-wider">
            Endpoints
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.path}
                onClick={() => setSelectedEndpoint(ep)}
                className={`w-full text-left p-3 rounded-lg text-sm transition-colors flex items-center justify-between group ${
                  selectedEndpoint.path === ep.path
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "hover:bg-gray-800 text-gray-400"
                }`}
              >
                <div className="font-mono">{ep.path}</div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    ep.method === 'GET' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                    {ep.method}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Area: Request & Response */}
        <div className="md:col-span-2 flex flex-col gap-4 min-h-0">
            {/* Request Details */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                     <span className={`text-sm font-bold px-2 py-1 rounded ${
                        selectedEndpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                     }`}>
                         {selectedEndpoint.method}
                     </span>
                     <span className="text-lg text-white font-mono">{selectedEndpoint.path}</span>
                </div>
                <p className="text-gray-400 text-sm mb-6">{selectedEndpoint.description}</p>
                
                <button
                    onClick={handleExecute}
                    disabled={loading}
                    className={`px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center gap-2 ${
                        loading 
                        ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                    }`}
                >
                    {loading ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending Request...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Send Request
                        </>
                    )}
                </button>
            </div>

            {/* Response Area */}
            <div className="flex-1 bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs overflow-hidden flex flex-col min-h-[300px]">
                <div className="text-gray-500 uppercase tracking-wider text-[10px] font-bold mb-2 flex justify-between">
                    <span>Response Body</span>
                    {response && <span className="text-green-500">200 OK</span>}
                    {error && <span className="text-red-500">Error</span>}
                </div>
                <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-800">
                    {loading && <div className="text-gray-600 italic">Waiting for response...</div>}
                    {!loading && !response && !error && <div className="text-gray-700 italic">No response yet.</div>}
                    {error && <div className="text-red-400 whitespace-pre-wrap">{error}</div>}
                    {response && (
                        <pre className="text-green-300 whitespace-pre-wrap">
                            {response}
                        </pre>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
