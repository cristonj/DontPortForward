"use client";

import { useState, useEffect, useCallback, FormEvent, ChangeEvent } from "react";
import { app, db } from "../../lib/firebase";
import { 
  getStorage,
  ref, 
  listAll, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject
} from "firebase/storage";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { FileItem } from "../types";
import { 
  MAX_FILE_SIZE_FOR_EDIT, 
  PYTHON_RUN_COMMAND_PREFIX,
  getSharedFolderPath,
  getSharedFilePath
} from "../constants";
import { withRetry, getErrorMessage } from "../utils";
import { FileCreateModal, FileListTable, FileToolbar } from "./files";

const storage = getStorage(app);

interface SharedFolderProps {
  deviceId: string;
  onRunCommand?: (command: string) => void;
}

export default function SharedFolder({ deviceId, onRunCommand }: SharedFolderProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startupFile, setStartupFile] = useState<string | null>(null);
  
  // Create/Edit File State
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");

  const fetchFiles = useCallback(async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const listRef = ref(storage, getSharedFolderPath(deviceId));
      const res = await withRetry(() => listAll(listRef));
      setFiles(res.items.map((itemRef) => ({
        name: itemRef.name,
        fullPath: itemRef.fullPath,
        ref: itemRef,
      })));
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  const fetchStartupFile = useCallback(async () => {
    if (!deviceId) return;
    try {
      const deviceRef = doc(db, 'devices', deviceId);
      const deviceSnap = await getDoc(deviceRef);
      if (deviceSnap.exists()) {
        const data = deviceSnap.data();
        setStartupFile(data.startup_file || null);
      }
    } catch (error) {
      console.error("Error fetching startup file:", error);
    }
  }, [deviceId]);

  useEffect(() => {
    if (deviceId) {
      fetchFiles();
      fetchStartupFile();
    }
  }, [deviceId, fetchFiles, fetchStartupFile]);

  const handleUpload = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    try {
      const storageRef = ref(storage, getSharedFilePath(deviceId, file.name));
      await withRetry(() => uploadBytes(storageRef, file));
      await fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      alert(`Failed to upload file: ${getErrorMessage(error, 'Network error')}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [deviceId, fetchFiles]);

  const handleCreateFile = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) {
      alert("Please enter a filename");
      return;
    }

    setUploading(true);
    try {
      const blob = new Blob([newFileContent], { type: 'text/plain' });
      const storageRef = ref(storage, getSharedFilePath(deviceId, newFileName));
      await withRetry(() => uploadBytes(storageRef, blob));
      await fetchFiles();
      setIsCreatingFile(false);
      setNewFileName("");
      setNewFileContent("");
    } catch (error) {
      console.error("Error creating file:", error);
      alert(`Failed to create file: ${getErrorMessage(error, 'Network error')}`);
    } finally {
      setUploading(false);
    }
  }, [deviceId, newFileName, newFileContent, fetchFiles]);

  const handleEditFile = useCallback(async (fileItem: FileItem) => {
    try {
      const url = await withRetry(() => getDownloadURL(fileItem.ref));
      const response = await fetch(url);
      
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const text = await response.text();
      if (text.length > MAX_FILE_SIZE_FOR_EDIT) {
        alert("File is too large to edit in the browser.");
        return;
      }

      setNewFileName(fileItem.name);
      setNewFileContent(text);
      setIsCreatingFile(true);
    } catch (error) {
      console.error("Error loading file:", error);
      alert(`Failed to load file: ${getErrorMessage(error, 'Network error')}`);
    }
  }, []);

  const handleDownload = useCallback(async (fileItem: FileItem) => {
    try {
      const url = await withRetry(() => getDownloadURL(fileItem.ref));
      window.open(url, '_blank');
    } catch (error) {
      console.error("Error downloading file:", error);
      alert(`Failed to download file: ${getErrorMessage(error, 'Network error')}`);
    }
  }, []);

  const handleDelete = useCallback(async (fileItem: FileItem) => {
    if (!confirm(`Are you sure you want to delete ${fileItem.name}?`)) return;
    try {
      await withRetry(() => deleteObject(fileItem.ref));
      await fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      alert(`Failed to delete file: ${getErrorMessage(error, 'Network error')}`);
    }
  }, [fetchFiles]);

  const handleRunFile = useCallback((fileItem: FileItem) => {
    if (!onRunCommand) return;
    const command = `${PYTHON_RUN_COMMAND_PREFIX}${fileItem.name}`;
    if (confirm(`Run ${fileItem.name} on device?`)) {
      onRunCommand(command);
    }
  }, [onRunCommand]);

  const handleSetStartupFile = useCallback(async (fileItem: FileItem) => {
    if (!deviceId) return;
    try {
      const deviceRef = doc(db, 'devices', deviceId);
      if (startupFile === fileItem.name) {
        // Unset startup file
        await updateDoc(deviceRef, { startup_file: null });
        setStartupFile(null);
      } else {
        // Set as startup file
        await updateDoc(deviceRef, { startup_file: fileItem.name });
        setStartupFile(fileItem.name);
      }
    } catch (error) {
      console.error("Error setting startup file:", error);
      alert(`Failed to set startup file: ${getErrorMessage(error, 'Network error')}`);
    }
  }, [deviceId, startupFile]);

  const handleCloseModal = useCallback(() => {
    setIsCreatingFile(false);
    setNewFileName("");
    setNewFileContent("");
  }, []);

  return (
    <div className="flex flex-col h-full bg-gray-950 p-4 font-mono text-sm overflow-hidden">
      <FileToolbar
        onRefresh={fetchFiles}
        onNewFile={() => setIsCreatingFile(true)}
        onUpload={handleUpload}
        isUploading={uploading}
      />

      <FileCreateModal
        isOpen={isCreatingFile}
        onClose={handleCloseModal}
        fileName={newFileName}
        onFileNameChange={setNewFileName}
        fileContent={newFileContent}
        onFileContentChange={setNewFileContent}
        onSubmit={handleCreateFile}
        isUploading={uploading}
      />

      <div className="flex-1 overflow-y-auto border border-gray-800 rounded-lg bg-gray-900/30 scrollbar-thin scrollbar-thumb-gray-800">
        <FileListTable
          files={files}
          loading={loading}
          startupFile={startupFile}
          onEdit={handleEditFile}
          onDownload={handleDownload}
          onDelete={handleDelete}
          onRun={handleRunFile}
          onSetStartup={handleSetStartupFile}
          showRunButton={!!onRunCommand}
        />
      </div>
      
      <div className="mt-3 text-xs text-gray-500">
        Files uploaded here are synced to the agent&apos;s <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">shared/</code> folder.
        {startupFile && (
          <span className="ml-2 text-purple-400">
            ⚡ Startup file: <code className="bg-gray-800 px-1 py-0.5 rounded text-purple-300">{startupFile}</code>
          </span>
        )}
      </div>
    </div>
  );
}
