"use client";

import { memo } from "react";
import type { ApiEndpoint } from "../../types/api";

interface EndpointListProps {
  endpoints: ApiEndpoint[];
  selectedEndpoint: ApiEndpoint;
  onSelect: (endpoint: ApiEndpoint) => void;
}

export const EndpointList = memo(function EndpointList({
  endpoints,
  selectedEndpoint,
  onSelect,
}: EndpointListProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden flex flex-col">
      <div className="p-3 border-b border-gray-800 bg-gray-900/80 font-bold text-sm text-gray-400 uppercase tracking-wider">
        Endpoints
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {endpoints.map((ep) => (
          <EndpointButton
            key={ep.path}
            endpoint={ep}
            isSelected={selectedEndpoint.path === ep.path}
            onSelect={() => onSelect(ep)}
          />
        ))}
      </div>
    </div>
  );
});

interface EndpointButtonProps {
  endpoint: ApiEndpoint;
  isSelected: boolean;
  onSelect: () => void;
}

const EndpointButton = memo(function EndpointButton({
  endpoint,
  isSelected,
  onSelect,
}: EndpointButtonProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg text-sm transition-colors flex items-center justify-between group ${
        isSelected
          ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
          : "hover:bg-gray-800 text-gray-400"
      }`}
    >
      <div className="font-mono truncate mr-2" title={endpoint.path}>
        {endpoint.path}
      </div>
      <MethodBadge method={endpoint.method} />
    </button>
  );
});

interface MethodBadgeProps {
  method: string;
}

const MethodBadge = memo(function MethodBadge({ method }: MethodBadgeProps) {
  const colorClass = 
    method === 'GET' ? 'bg-green-500/20 text-green-400' : 
    method === 'POST' ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-red-500/20 text-red-400';

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${colorClass}`}>
      {method}
    </span>
  );
});
