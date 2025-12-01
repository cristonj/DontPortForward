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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>
            <button
                onClick={() => setIsCreatingFile(true)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded flex items-center gap-2 border border-gray-700 text-xs sm:text-sm shrink-0"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden xs:inline">New File</span>
                <span className="xs:hidden">New</span>
            </button>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded flex items-center gap-2 text-xs sm:text-sm shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
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
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
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
                        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
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
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            <span className="hidden sm:inline">{startupFile === file.name ? 'Startup' : 'Set Startup'}</span>
                        </button>
                        {file.name.endsWith('.py') && onRunCommand && (
                            <button
                                onClick={() => handleRunFile(file)}
                                className="text-green-400 hover:text-green-300 px-2 py-1 hover:bg-green-900/20 rounded text-xs flex items-center gap-1"
                                title="Run Python Script"
                            >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                <span className="hidden sm:inline">Run</span>
                            </button>
                        )}
                        <button
                        onClick={() => handleEditFile(file)}
                        className="text-yellow-400 hover:text-yellow-300 px-2 py-1 hover:bg-yellow-900/20 rounded text-xs"
                        title="Edit"
                        >
                        <span className="hidden sm:inline">Edit</span>
                        <svg className="w-3 h-3 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                        onClick={() => handleDownload(file)}
                        className="text-blue-400 hover:text-blue-300 px-2 py-1 hover:bg-blue-900/20 rounded text-xs"
                        title="Download"
                        >
                        <span className="hidden sm:inline">Download</span>
                        <svg className="w-3 h-3 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        </button>
                        <button
                        onClick={() => handleDelete(file)}
                        className="text-red-400 hover:text-red-300 px-2 py-1 hover:bg-red-900/20 rounded text-xs"
                        title="Delete"
                        >
                        <span className="hidden sm:inline">Delete</span>
                        <svg className="w-3 h-3 sm:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
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
