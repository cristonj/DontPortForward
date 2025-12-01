import type { ApiEndpoint } from "../types";

export const API_ENDPOINTS: ApiEndpoint[] = [
  { path: "/status", method: "GET", description: "Get full system status including hardware stats and git info" },
  { path: "/health", method: "GET", description: "Simple health check endpoint" },
  { path: "/exec", method: "POST", description: "Execute a shell command", defaultBody: '{\n  "command": "ls -la",\n  "cwd": "."\n}' },
  { path: "/files/list", method: "GET", description: "List files in a directory (use ?path=/path/to/dir in real request, here defaults to current)" },
  { path: "/files/read", method: "POST", description: "Read a file content", defaultBody: '{\n  "path": "README.md"\n}' },
  { path: "/files/write", method: "POST", description: "Write content to a file", defaultBody: '{\n  "path": "test.txt",\n  "content": "Hello world!"\n}' },
  { path: "/processes", method: "GET", description: "List running processes" },
  { path: "/processes/{pid}", method: "DELETE", description: "Kill a process (replace {pid} in path - not supported in this UI yet, requires manual implementation)" },
];

export const API_COMMAND_TYPE = "api" as const;
