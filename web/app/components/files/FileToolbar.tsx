"use client";

import { memo, ChangeEvent } from "react";
import { RefreshIcon, PlusIcon, UploadIcon } from "../Icons";

interface FileToolbarProps {
  onRefresh: () => void;
  onNewFile: () => void;
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
}

export const FileToolbar = memo(function FileToolbar({
  onRefresh,
  onNewFile,
  onUpload,
  isUploading,
}: FileToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
      <h2 className="text-gray-200 font-bold">Shared Folder</h2>
      <div className="flex gap-2 w-full sm:w-auto justify-end">
        <RefreshButton onClick={onRefresh} />
        <NewFileButton onClick={onNewFile} />
        <UploadButton onUpload={onUpload} isUploading={isUploading} />
      </div>
    </div>
  );
});

interface RefreshButtonProps {
  onClick: () => void;
}

const RefreshButton = memo(function RefreshButton({ onClick }: RefreshButtonProps) {
  return (
    <button 
      onClick={onClick}
      className="p-2 text-gray-400 hover:text-white bg-gray-900 rounded border border-gray-800 shrink-0"
      title="Refresh"
    >
      <RefreshIcon className="w-4 h-4" />
    </button>
  );
});

interface NewFileButtonProps {
  onClick: () => void;
}

const NewFileButton = memo(function NewFileButton({ onClick }: NewFileButtonProps) {
  return (
    <button
      onClick={onClick}
      className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded flex items-center gap-2 border border-gray-700 text-xs sm:text-sm shrink-0"
    >
      <PlusIcon className="w-4 h-4" />
      <span className="hidden xs:inline">New File</span>
      <span className="xs:hidden">New</span>
    </button>
  );
});

interface UploadButtonProps {
  onUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
}

const UploadButton = memo(function UploadButton({ onUpload, isUploading }: UploadButtonProps) {
  return (
    <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded flex items-center gap-2 text-xs sm:text-sm shrink-0">
      <UploadIcon className="w-4 h-4" />
      <span>{isUploading ? "Uploading..." : "Upload"}</span>
      <input 
        type="file" 
        className="hidden" 
        onChange={onUpload} 
        disabled={isUploading}
      />
    </label>
  );
});
