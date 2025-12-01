"use client";

import { memo, useMemo } from "react";
import { LOG_OUTPUT_MAX_LINES } from "../constants";

interface LogOutputProps {
  text: string;
  isError?: boolean;
}

const LogOutput = memo(function LogOutput({ text, isError = false }: LogOutputProps) {
  const lines = useMemo(() => text.split("\n"), [text]);
  const displayLines = useMemo(() => {
    if (lines.length <= LOG_OUTPUT_MAX_LINES) return lines;
    return lines.slice(-LOG_OUTPUT_MAX_LINES);
  }, [lines]);

  return (
    <pre className={`whitespace-pre-wrap break-all leading-relaxed ${isError ? "text-red-400/80" : ""}`}>
      {displayLines.map((line, idx) => (
        <div key={idx} className={isError ? "hover:bg-red-900/10" : "hover:bg-gray-800/30"}>
          <span className="text-gray-600 select-none mr-3 inline-block w-8 text-right">
            {displayLines.length - LOG_OUTPUT_MAX_LINES + idx + 1 > 0
              ? displayLines.length - LOG_OUTPUT_MAX_LINES + idx + 1
              : idx + 1}
          </span>
          <span>{line || " "}</span>
        </div>
      ))}
    </pre>
  );
},
(prevProps, nextProps) => {
  return prevProps.text === nextProps.text && prevProps.isError === nextProps.isError;
});

LogOutput.displayName = "LogOutput";

export default LogOutput;
