// Command types
export const COMMAND_TYPE_SHELL = "shell" as const;
export const COMMAND_TYPE_API = "api" as const;
export const COMMAND_TYPE_RESTART = "restart" as const;

export type CommandType = typeof COMMAND_TYPE_SHELL | typeof COMMAND_TYPE_API | typeof COMMAND_TYPE_RESTART;

// Command statuses
export const COMMAND_STATUS_PENDING = "pending" as const;
export const COMMAND_STATUS_PROCESSING = "processing" as const;
export const COMMAND_STATUS_COMPLETED = "completed" as const;
export const COMMAND_STATUS_CANCELLED = "cancelled" as const;

export type CommandStatus = 
  | typeof COMMAND_STATUS_PENDING
  | typeof COMMAND_STATUS_PROCESSING
  | typeof COMMAND_STATUS_COMPLETED
  | typeof COMMAND_STATUS_CANCELLED;

// Active statuses (commands that are still running)
export const ACTIVE_COMMAND_STATUSES: CommandStatus[] = [
  COMMAND_STATUS_PENDING,
  COMMAND_STATUS_PROCESSING,
];

// Completed statuses (commands that have finished)
export const COMPLETED_COMMAND_STATUSES: CommandStatus[] = [
  COMMAND_STATUS_COMPLETED,
  COMMAND_STATUS_CANCELLED,
];
