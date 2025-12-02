"use client";

import { memo } from "react";
import type { FileItem } from "../../types";
import { 
  FileIcon, 
  SparkleIcon, 
  PlayIcon, 
  EditIcon, 
  UploadIcon, 
  TrashIcon 
} from "../Icons";

interface FileListTableProps {
  files: FileItem[];
  loading: boolean;
  startupFile: string | null;
  onEdit: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onRun: (file: FileItem) => void;
  onSetStartup: (file: FileItem) => void;
  showRunButton?: boolean;
}

export const FileListTable = memo(function FileListTable({
  files,
  loading,
  startupFile,
  onEdit,
  onDownload,
  onDelete,
  onRun,
  onSetStartup,
  showRunButton = true,
}: FileListTableProps) {
  if (loading) {
    return <div className="p-4 text-gray-500">Loading files...</div>;
  }

  if (files.length === 0) {
    return (
      <div className="p-4 text-gray-500 italic">
        No files in shared folder. Upload one to get started.
      </div>
    );
  }

  return (
    <table className="w-full text-left border-collapse">
      <thead className="bg-gray-900/80 text-gray-400 text-xs uppercase sticky top-0 z-10 backdrop-blur-sm">
        <tr>
          <th className="px-4 py-3 font-medium border-b border-gray-800">Filename</th>
          <th className="px-4 py-3 font-medium text-right border-b border-gray-800">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-800">
        {files.map((file) => (
          <FileRow
            key={file.fullPath}
            file={file}
            isStartupFile={startupFile === file.name}
            onEdit={() => onEdit(file)}
            onDownload={() => onDownload(file)}
            onDelete={() => onDelete(file)}
            onRun={() => onRun(file)}
            onSetStartup={() => onSetStartup(file)}
            showRunButton={showRunButton && file.name.endsWith('.py')}
          />
        ))}
      </tbody>
    </table>
  );
});

interface FileRowProps {
  file: FileItem;
  isStartupFile: boolean;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRun: () => void;
  onSetStartup: () => void;
  showRunButton: boolean;
}

const FileRow = memo(function FileRow({
  file,
  isStartupFile,
  onEdit,
  onDownload,
  onDelete,
  onRun,
  onSetStartup,
  showRunButton,
}: FileRowProps) {
  return (
    <tr className="hover:bg-gray-800/50 transition-colors group">
      <td className="px-4 py-3 text-gray-300 max-w-[150px] sm:max-w-xs truncate">
        <div className="flex items-center gap-2">
          <FileIcon className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="truncate" title={file.name}>{file.name}</span>
          {isStartupFile && (
            <span className="text-xs text-purple-400 font-semibold" title="Runs on startup">
              ⚡
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <FileActions
          isStartupFile={isStartupFile}
          showRunButton={showRunButton}
          onSetStartup={onSetStartup}
          onRun={onRun}
          onEdit={onEdit}
          onDownload={onDownload}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
});

interface FileActionsProps {
  isStartupFile: boolean;
  showRunButton: boolean;
  onSetStartup: () => void;
  onRun: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

const FileActions = memo(function FileActions({
  isStartupFile,
  showRunButton,
  onSetStartup,
  onRun,
  onEdit,
  onDownload,
  onDelete,
}: FileActionsProps) {
  return (
    <div className="flex justify-end gap-1 sm:gap-2">
      <button
        onClick={onSetStartup}
        className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
          isStartupFile
            ? 'text-purple-400 hover:text-purple-300 hover:bg-purple-900/20 bg-purple-900/10'
            : 'text-purple-400 hover:text-purple-300 hover:bg-purple-900/20'
        }`}
        title={isStartupFile ? "Remove from startup" : "Set as startup file"}
      >
        <SparkleIcon className="w-3 h-3" />
        <span className="hidden sm:inline">
          {isStartupFile ? 'Startup' : 'Set Startup'}
        </span>
      </button>
      
      {showRunButton && (
        <button
          onClick={onRun}
          className="text-green-400 hover:text-green-300 px-2 py-1 hover:bg-green-900/20 rounded text-xs flex items-center gap-1"
          title="Run Python Script"
        >
          <PlayIcon className="w-3 h-3" />
          <span className="hidden sm:inline">Run</span>
        </button>
      )}
      
      <button
        onClick={onEdit}
        className="text-yellow-400 hover:text-yellow-300 px-2 py-1 hover:bg-yellow-900/20 rounded text-xs"
        title="Edit"
      >
        <span className="hidden sm:inline">Edit</span>
        <span className="sm:hidden"><EditIcon className="w-3 h-3" /></span>
      </button>
      
      <button
        onClick={onDownload}
        className="text-blue-400 hover:text-blue-300 px-2 py-1 hover:bg-blue-900/20 rounded text-xs"
        title="Download"
      >
        <span className="hidden sm:inline">Download</span>
        <span className="sm:hidden"><UploadIcon className="w-3 h-3" /></span>
      </button>
      
      <button
        onClick={onDelete}
        className="text-red-400 hover:text-red-300 px-2 py-1 hover:bg-red-900/20 rounded text-xs"
        title="Delete"
      >
        <span className="hidden sm:inline">Delete</span>
        <span className="sm:hidden"><TrashIcon className="w-3 h-3" /></span>
      </button>
    </div>
  );
});
