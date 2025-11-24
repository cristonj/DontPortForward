"use client";

import { useState, useEffect } from "react";
import { storage } from "../../lib/firebase";
import { 
  ref, 
  listAll, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  StorageReference
} from "firebase/storage";

interface SharedFolderProps {
  deviceId: string;
  onRunCommand?: (command: string) => void;
}

interface FileItem {
  name: string;
  fullPath: string;
  ref: StorageReference;
}

export default function SharedFolder({ deviceId, onRunCommand }: SharedFolderProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Create File State
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFileContent, setNewFileContent] = useState("");

  const fetchFiles = async () => {
    if (!deviceId) return;
    setLoading(true);
    try {
      const listRef = ref(storage, `agents/${deviceId}/shared`);
      const res = await listAll(listRef);
      const fileItems = res.items.map((itemRef) => ({
        name: itemRef.name,
        fullPath: itemRef.fullPath,
        ref: itemRef,
      }));
      setFiles(fileItems);
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [deviceId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUploading(true);
    try {
      const storageRef = ref(storage, `agents/${deviceId}/shared/${file.name}`);
      await uploadBytes(storageRef, file);
      await fetchFiles();
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Failed to upload file");
    } finally {
      setUploading(false);
      // Reset input
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
        const storageRef = ref(storage, `agents/${deviceId}/shared/${newFileName}`);
        await uploadBytes(storageRef, blob);
        await fetchFiles();
        setIsCreatingFile(false);
        setNewFileName("");
        setNewFileContent("");
    } catch (error) {
        console.error("Error creating file:", error);
        alert("Failed to create file");
    } finally {
        setUploading(false);
    }
  };

  const handleEditFile = async (fileItem: FileItem) => {
    // Only allow editing text files for now to avoid issues with large binaries
    const MAX_SIZE = 1024 * 1024; // 1MB limit
    try {
        const url = await getDownloadURL(fileItem.ref);
        const response = await fetch(url);
        
        // Check size roughly
        // Cloud storage CORS might block content-length, or it might be null
        const sizeHeader = response.headers.get("content-length");
        const size = sizeHeader ? Number(sizeHeader) : 0;
        
        if (size > MAX_SIZE) {
            alert("File is too large to edit in the browser.");
            return;
        }

        const text = await response.text();
        // Double check length of text content
        if (text.length > MAX_SIZE) {
            alert("File is too large to edit in the browser.");
            return;
        }

        setNewFileName(fileItem.name);
        setNewFileContent(text);
        setIsCreatingFile(true);
    } catch (error) {
        console.error("Error fetching file content:", error);
        alert("Failed to load file for editing.");
    }
  };

  const handleDownload = async (fileItem: FileItem) => {
    try {
      const url = await getDownloadURL(fileItem.ref);
      window.open(url, '_blank');
    } catch (error) {
      console.error("Error getting download URL:", error);
    }
  };

  const handleDelete = async (fileItem: FileItem) => {
    if (!confirm(`Are you sure you want to delete ${fileItem.name}?`)) return;
    try {
      await deleteObject(fileItem.ref);
      await fetchFiles();
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const handleRunFile = (fileItem: FileItem) => {
    if (!onRunCommand) return;
    const command = `python shared/${fileItem.name}`;
    if (confirm(`Run ${fileItem.name} on device?`)) {
        onRunCommand(command);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 p-4 font-mono text-sm">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-gray-200 font-bold">Shared Folder</h2>
        <div className="flex gap-2">
            <button 
                onClick={fetchFiles}
                className="p-2 text-gray-400 hover:text-white bg-gray-900 rounded border border-gray-800"
                title="Refresh"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            </button>
            <button
                onClick={() => setIsCreatingFile(true)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded flex items-center gap-2 border border-gray-700"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New File</span>
            </button>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{uploading ? "Uploading..." : "Upload File"}</span>
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

      <div className="flex-1 overflow-y-auto border border-gray-800 rounded-lg bg-gray-900/30">
        {loading ? (
          <div className="p-4 text-gray-500">Loading files...</div>
        ) : files.length === 0 ? (
          <div className="p-4 text-gray-500 italic">No files in shared folder. Upload one to get started.</div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-900/80 text-gray-400 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Filename</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {files.map((file) => (
                <tr key={file.fullPath} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 text-gray-300">
                    <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {file.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                        {file.name.endsWith('.py') && onRunCommand && (
                            <button
                                onClick={() => handleRunFile(file)}
                                className="text-green-400 hover:text-green-300 px-2 py-1 hover:bg-green-900/20 rounded text-xs flex items-center gap-1"
                                title="Run Python Script"
                            >
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                                Run
                            </button>
                        )}
                        <button
                        onClick={() => handleEditFile(file)}
                        className="text-yellow-400 hover:text-yellow-300 px-2 py-1 hover:bg-yellow-900/20 rounded text-xs"
                        >
                        Edit
                        </button>
                        <button
                        onClick={() => handleDownload(file)}
                        className="text-blue-400 hover:text-blue-300 px-2 py-1 hover:bg-blue-900/20 rounded text-xs"
                        >
                        Download
                        </button>
                        <button
                        onClick={() => handleDelete(file)}
                        className="text-red-400 hover:text-red-300 px-2 py-1 hover:bg-red-900/20 rounded text-xs"
                        >
                        Delete
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
        Files uploaded here are synced to the agent's <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-300">shared/</code> folder.
      </div>
    </div>
  );
}
