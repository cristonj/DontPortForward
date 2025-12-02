"use client";

import { memo } from "react";
import type { ApiEndpoint } from "../../types/api";
import { LoadingSpinner } from "../ui";

interface RequestPanelProps {
  endpoint: ApiEndpoint;
  requestBody: string;
  onRequestBodyChange: (value: string) => void;
  onExecute: () => void;
  isLoading: boolean;
}

export const RequestPanel = memo(function RequestPanel({
  endpoint,
  requestBody,
  onRequestBodyChange,
  onExecute,
  isLoading,
}: RequestPanelProps) {
  const methodColorClass = 
    endpoint.method === 'GET' ? 'bg-green-500/20 text-green-400' : 
    endpoint.method === 'POST' ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-red-500/20 text-red-400';

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className={`text-sm font-bold px-2 py-1 rounded ${methodColorClass}`}>
          {endpoint.method}
        </span>
        <span className="text-lg text-white font-mono break-all">{endpoint.path}</span>
      </div>
      
      <p className="text-gray-400 text-sm">{endpoint.description}</p>
      
      {(endpoint.method === 'POST' || endpoint.method === 'PUT') && (
        <RequestBodyInput
          value={requestBody}
          onChange={onRequestBodyChange}
        />
      )}

      <ExecuteButton onClick={onExecute} isLoading={isLoading} />
    </div>
  );
});

interface RequestBodyInputProps {
  value: string;
  onChange: (value: string) => void;
}

const RequestBodyInput = memo(function RequestBodyInput({ value, onChange }: RequestBodyInputProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-gray-500 uppercase font-bold">
        Request Body (JSON)
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-32 bg-black border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-300 focus:border-blue-500 focus:outline-none resize-none"
      />
    </div>
  );
});

interface ExecuteButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

const ExecuteButton = memo(function ExecuteButton({ onClick, isLoading }: ExecuteButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`mt-2 px-6 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
        isLoading 
          ? "bg-gray-700 text-gray-400 cursor-not-allowed"
          : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
      }`}
    >
      {isLoading ? (
        <>
          <LoadingSpinner size="sm" color="white" />
          Sending Request...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Send Request
        </>
      )}
    </button>
  );
});
