"use client";

import { memo } from "react";

interface ResponsePanelProps {
  response: string | null;
  error: string | null;
  isLoading: boolean;
}

export const ResponsePanel = memo(function ResponsePanel({
  response,
  error,
  isLoading,
}: ResponsePanelProps) {
  return (
    <div className="flex-1 bg-black border border-gray-800 rounded-xl p-4 font-mono text-xs overflow-hidden flex flex-col min-h-[300px]">
      <ResponseHeader hasResponse={!!response} hasError={!!error} />
      <ResponseContent 
        response={response} 
        error={error} 
        isLoading={isLoading} 
      />
    </div>
  );
});

interface ResponseHeaderProps {
  hasResponse: boolean;
  hasError: boolean;
}

const ResponseHeader = memo(function ResponseHeader({ hasResponse, hasError }: ResponseHeaderProps) {
  return (
    <div className="text-gray-500 uppercase tracking-wider text-[10px] font-bold mb-2 flex justify-between">
      <span>Response Body</span>
      {hasResponse && <span className="text-green-500">200 OK</span>}
      {hasError && <span className="text-red-500">Error</span>}
    </div>
  );
});

interface ResponseContentProps {
  response: string | null;
  error: string | null;
  isLoading: boolean;
}

const ResponseContent = memo(function ResponseContent({
  response,
  error,
  isLoading,
}: ResponseContentProps) {
  return (
    <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-gray-800">
      {isLoading && (
        <div className="text-gray-600 italic">Waiting for response...</div>
      )}
      {!isLoading && !response && !error && (
        <div className="text-gray-700 italic">No response yet.</div>
      )}
      {error && (
        <div className="text-red-400 whitespace-pre-wrap">{error}</div>
      )}
      {response && (
        <pre className="text-green-300 whitespace-pre-wrap">{response}</pre>
      )}
    </div>
  );
});
