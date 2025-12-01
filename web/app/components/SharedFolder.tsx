"use client";

import { useState, useEffect } from "react";
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
import { withRetry } from "../utils";
import { RefreshIcon, PlusIcon, UploadIcon, CloseIcon, FileIcon, SparkleIcon, PlayIcon, TrashIcon, EditIcon } from "./Icons";

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
  
  // Create File State
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");

  const fetchFiles = async () => {
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
  };

  const fetchStartupFile = async () => {
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
  };

  useEffect(() => {
    if (deviceId) {
      fetchFiles();
      fetchStartupFile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    try {
      const storageRef = ref(storage, getSharedFilePath(deviceId, file.name));
      await withRetry(() => uploadBytes(storageRef, file));
      await fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      alert(`Failed to upload file: ${errorMessage}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
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
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      alert(`Failed to create file: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  const handleEditFile = async (fileItem: FileItem) => {
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
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      alert(`Failed to load file: ${errorMessage}`);
    }
  };

  const handleDownload = async (fileItem: FileItem) => {
    try {
      const url = await withRetry(() => getDownloadURL(fileItem.ref));
      window.open(url, '_blank');
    } catch (error) {
      console.error("Error downloading file:", error);
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      alert(`Failed to download file: ${errorMessage}`);
    }
  };

  const handleDelete = async (fileItem: FileItem) => {
    if (!confirm(`Are you sure you want to delete ${fileItem.name}?`)) return;
    try {
      await withRetry(() => deleteObject(fileItem.ref));
      await fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      alert(`Failed to delete file: ${errorMessage}`);
    }
  };

  const handleRunFile = (fileItem: FileItem) => {
    if (!onRunCommand) return;
    const command = `${PYTHON_RUN_COMMAND_PREFIX}${fileItem.name}`;
    if (confirm(`Run ${fileItem.name} on device?`)) {
        onRunCommand(command);
    }
  };

  const handleSetStartupFile = async (fileItem: FileItem) => {
    if (!deviceId) return;
    try {
      const deviceRef = doc(db, 'devices', deviceId);
      if (startupFile === fileItem.name) {
        // Unset startup file
        await updateDoc(deviceRef, {
          startup_file: null
        });
        setStartupFile(null);
      } else {
        // Set as startup file
        await updateDoc(deviceRef, {
          startup_file: fileItem.name
        });
        setStartupFile(fileItem.name);
      }
    } catch (error) {
      console.error("Error setting startup file:", error);
      const errorMessage = error instanceof Error ? error.message : 'Network error';
      alert(`Failed to set startup file: ${errorMessage}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 p-4 font-mono text-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
        <h2 className="text-gray-200 font-bold">Shared Folder</h2>
        <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button 
                onClick={fetchFiles}
                className="p-2 text-gray-400 hover:text-white bg-gray-900 rounded border border-gray-800 shrink-0"
                title="Refresh"
            >
                <RefreshIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => setIsCreatingFile(true)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded flex items-center gap-2 border border-gray-700 text-xs sm:text-sm shrink-0"
            >
                <PlusIcon className="w-4 h-4" />
                <span className="hidden xs:inline">New File</span>
                <span className="xs:hidden">New</span>
            </button>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded flex items-center gap-2 text-xs sm:text-sm shrink-0">
                <UploadIcon className="w-4 h-4" />
                <span>{uploading ? "Uploading..." : "Upload"}</span>
                <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleUpload} 
                    disabled={uploading}
                />
            </label>
        </div>
      </div>

      {/* Create File Modal */}
      {isCreatingFile && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-lg font-bold text-white">{newFileName ? 'Edit File' : 'Create New File'}</h3>
                    <button onClick={() => setIsCreatingFile(false)} className="text-gray-400 hover:text-white">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>
                <form onSubmit={handleCreateFile} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-4 space-y-4 flex-1 flex flex-col overflow-hidden">
                        <div>
                            <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Filename</label>
                            <input 
                                type="text" 
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                placeholder="e.g. script.py"
                                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                        </div>
                        <div className="flex-1 flex flex-col min-h-[300px]">
                            <label className="block text-xs uppercase text-gray-500 font-bold mb-1">Content</label>
                            <textarea 
                                value={newFileContent}
                                onChange={(e) => setNewFileContent(e.target.value)}
                                className="flex-1 w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                                placeholder="# Write your code here..."
                                spellCheck="false"
                            />
                        </div>
                    </div>
                    <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-900">
                        <button 
                            type="button"
                            onClick={() => setIsCreatingFile(false)}
                            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            disabled={uploading}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-900/20 disabled:opacity-50"
                        >
                            {uploading ? "Saving..." : "Save File"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto border border-gray-800 rounded-lg bg-gray-900/30 scrollbar-thin scrollbar-thumb-gray-800">
        {loading ? (
          <div className="p-4 text-gray-500">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="p-4 text-gray-500 italic">No files in shared folder. Upload one to get started.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-900/80 text-gray-400 text-xs uppercase sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-4 py-3 font-medium border-b border-gray-800">Filename</th>
                <th className="px-4 py-3 font-medium text-right border-b border-gray-800">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {files.map((file) => (
                <tr key={file.fullPath} className="hover:bg-gray-800/50 transition-colors group">
                  <td className="px-4 py-3 text-gray-300 max-w-[150px] sm:max-w-xs truncate">
                    <div className="flex items-center gap-2">
                        <FileIcon className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate" title={file.name}>{file.name}</span>
                        {startupFile === file.name && (
                          <span className="text-xs text-purple-400 font-semibold" title="Runs on startup">
                            ⚡
                          </span>
                        )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1 sm:gap-2">
                        <button
                            onClick={() => handleSetStartupFile(file)}
                            className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                              startupFile === file.name
                                ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 bg-purple-900/10'
                                : 'text-purple-400 hover:text-purple-300 hover:bg-purple-900/20'
                            }`}
                            title={startupFile === file.name ? "Remove from startup" : "Set as startup file"}
                        >
                            <SparkleIcon className="w-3 h-3" />
                            <span className="hidden sm:inline">{startupFile === file.name ? 'Startup' : 'Set Startup'}</span>
                        </button>
                        {file.name.endsWith('.py') && onRunCommand && (
                            <button
                                onClick={() => handleRunFile(file)}
                                className="text-green-400 hover:text-green-300 px-2 py-1 hover:bg-green-900/20 rounded text-xs flex items-center gap-1"
                                title="Run Python Script"
                            >
                                <PlayIcon className="w-3 h-3" />
                                <span className="hidden sm:inline">Run</span>
                            </button>
                        )}
                        <button
                            onClick={() => handleEditFile(file)}
                            className="text-yellow-400 hover:text-yellow-300 px-2 py-1 hover:bg-yellow-900/20 rounded text-xs"
                            title="Edit"
                        >
                            <span className="hidden sm:inline">Edit</span>
                            <span className="sm:hidden"><EditIcon className="w-3 h-3" /></span>
                        </button>
                        <button
                            onClick={() => handleDownload(file)}
                            className="text-blue-400 hover:text-blue-300 px-2 py-1 hover:bg-blue-900/20 rounded text-xs"
                            title="Download"
                        >
                            <span className="hidden sm:inline">Download</span>
                            <span className="sm:hidden"><UploadIcon className="w-3 h-3" /></span>
                        </button>
                        <button
                            onClick={() => handleDelete(file)}
                            className="text-red-400 hover:text-red-300 px-2 py-1 hover:bg-red-900/20 rounded text-xs"
                            title="Delete"
                        >
                            <span className="hidden sm:inline">Delete</span>
                            <span className="sm:hidden"><TrashIcon className="w-3 h-3" /></span>
                        </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
