import type { Timestamp } from "firebase/firestore";
import type { CommandStatus } from "../constants/commands";

export interface CommandLog {
  id: string;
  command: string;
  output?: string;
  error?: string;
  status: CommandStatus;
  created_at: Timestamp | null;
  completed_at?: Timestamp | null;
  last_activity?: Timestamp | null;
  output_lines?: number;
  error_lines?: number;
}
