"use client";

import { memo, FormEvent } from "react";
import { CloseIcon } from "../Icons";

interface FileCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  onFileNameChange: (name: string) => void;
  fileContent: string;
  onFileContentChange: (content: string) => void;
  onSubmit: (e: FormEvent) => void;
  isUploading: boolean;
}

export const FileCreateModal = memo(function FileCreateModal({
  isOpen,
  onClose,
  fileName,
  onFileNameChange,
  fileContent,
  onFileContentChange,
  onSubmit,
  isUploading,
}: FileCreateModalProps) {
  if (!isOpen) return null;

  const isEditing = !!fileName;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl">
        <ModalHeader 
          title={isEditing ? 'Edit File' : 'Create New File'} 
          onClose={onClose} 
        />
        <form onSubmit={onSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 space-y-4 flex-1 flex flex-col overflow-hidden">
            <FileNameInput 
              value={fileName} 
              onChange={onFileNameChange} 
            />
            <FileContentInput 
              value={fileContent} 
              onChange={onFileContentChange} 
            />
          </div>
          <ModalFooter 
            onClose={onClose} 
            isUploading={isUploading} 
          />
        </form>
      </div>
    </div>
  );
});

interface ModalHeaderProps {
  title: string;
  onClose: () => void;
}

const ModalHeader = memo(function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-800">
      <h3 className="text-lg font-bold text-white">{title}</h3>
      <button 
        type="button"
        onClick={onClose} 
        className="text-gray-400 hover:text-white"
      >
        <CloseIcon className="w-6 h-6" />
      </button>
    </div>
  );
});

interface FileNameInputProps {
  value: string;
  onChange: (value: string) => void;
}

const FileNameInput = memo(function FileNameInput({ value, onChange }: FileNameInputProps) {
  return (
    <div>
      <label className="block text-xs uppercase text-gray-500 font-bold mb-1">
        Filename
      </label>
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. script.py"
        className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
        autoFocus
      />
    </div>
  );
});

interface FileContentInputProps {
  value: string;
  onChange: (value: string) => void;
}

const FileContentInput = memo(function FileContentInput({ value, onChange }: FileContentInputProps) {
  return (
    <div className="flex-1 flex flex-col min-h-[300px]">
      <label className="block text-xs uppercase text-gray-500 font-bold mb-1">
        Content
      </label>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-white font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
        placeholder="# Write your code here..."
        spellCheck="false"
      />
    </div>
  );
});

interface ModalFooterProps {
  onClose: () => void;
  isUploading: boolean;
}

const ModalFooter = memo(function ModalFooter({ onClose, isUploading }: ModalFooterProps) {
  return (
    <div className="p-4 border-t border-gray-800 flex justify-end gap-3 bg-gray-900">
      <button 
        type="button"
        onClick={onClose}
        className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors text-sm font-medium"
      >
        Cancel
      </button>
      <button 
        type="submit"
        disabled={isUploading}
        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg shadow-blue-900/20 disabled:opacity-50"
      >
        {isUploading ? "Saving..." : "Save File"}
      </button>
    </div>
  );
});
