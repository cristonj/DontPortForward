import type { StorageReference } from "firebase/storage";

export interface FileItem {
  name: string;
  fullPath: string;
  ref: StorageReference;
}

