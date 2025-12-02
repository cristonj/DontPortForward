"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from "firebase/firestore";
import { 
  API_ENDPOINTS, 
  API_COMMAND_TYPE, 
  DEFAULT_MAX_RETRIES, 
  RETRY_BASE_DELAY_MS,
  getCommandsCollectionPath,
  getCommandDocumentPath
} from "../constants";
import { isNetworkError, getErrorMessage } from "../utils";
import { EndpointList, RequestPanel, ResponsePanel, CodeSnippet } from "./api";

export default function ApiExplorer({ deviceId }: { deviceId: string }) {
  const [selectedEndpoint, setSelectedEndpoint] = useState(API_ENDPOINTS[0]);
  const [requestBody, setRequestBody] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRequestBody(selectedEndpoint.defaultBody || "");
  }, [selectedEndpoint]);

  const handleExecute = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    setResponse(null);
    setError(null);

    try {
      let bodyData = {};
      if (selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PUT') {
        try {
          if (requestBody) {
            bodyData = JSON.parse(requestBody);
          }
        } catch {
          setError("Invalid JSON body");
          setLoading(false);
          return;
        }
      }

      // Retry logic for sending API command
      let docRef: Awaited<ReturnType<typeof addDoc>> | null = null;
      
      for (let attempt = 0; attempt < DEFAULT_MAX_RETRIES; attempt++) {
        try {
          const commandsRef = collection(db, ...getCommandsCollectionPath(deviceId));
          docRef = await addDoc(commandsRef, {
            type: API_COMMAND_TYPE,
            endpoint: selectedEndpoint.path,
            method: selectedEndpoint.method,
            body: bodyData,
            status: 'pending',
            created_at: serverTimestamp()
          });
          break; // Success
        } catch (err) {
          if (isNetworkError(err) && attempt < DEFAULT_MAX_RETRIES - 1) {
            const waitTime = Math.pow(2, attempt) * RETRY_BASE_DELAY_MS;
            console.log(`Network error sending API command (attempt ${attempt + 1}/${DEFAULT_MAX_RETRIES}), retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            throw err; // Re-throw to be caught by outer catch
          }
        }
      }
      
      if (!docRef) {
        throw new Error("Failed to create command after retries");
      }

      const unsubscribe = onSnapshot(doc(db, ...getCommandDocumentPath(deviceId, docRef.id)), (snap) => {
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

    } catch (err) {
      console.error("Error executing API request:", err);
      setError(getErrorMessage(err, 'Unknown error'));
      setLoading(false);
    }
  }, [deviceId, selectedEndpoint, requestBody]);

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 text-gray-200 font-mono overflow-y-auto md:overflow-hidden">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">API Explorer</h2>
        <p className="text-sm text-gray-500">Explore the agent&apos;s local API endpoints.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 md:min-h-0">
        {/* Sidebar: Endpoints */}
        <EndpointList
          endpoints={API_ENDPOINTS}
          selectedEndpoint={selectedEndpoint}
          onSelect={setSelectedEndpoint}
        />

        {/* Main Area: Request & Response */}
        <div className="md:col-span-2 flex flex-col gap-4 md:min-h-0">
          <RequestPanel
            endpoint={selectedEndpoint}
            requestBody={requestBody}
            onRequestBodyChange={setRequestBody}
            onExecute={handleExecute}
            isLoading={loading}
          />

          <ResponsePanel
            response={response}
            error={error}
            isLoading={loading}
          />

          <CodeSnippet
            deviceId={deviceId}
            endpoint={selectedEndpoint}
            requestBody={requestBody}
          />
        </div>
      </div>
    </div>
  );
}
