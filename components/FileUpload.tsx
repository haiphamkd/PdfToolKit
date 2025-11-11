import React, { useState, useCallback, useRef } from 'react';
import { UploadCloudIcon } from './icons';

interface FileUploadProps {
  onFilesAdded: (files: File[]) => void;
  acceptedMimeTypes: string;
  promptText: string;
  fileTypeDescription: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesAdded, acceptedMimeTypes, promptText, fileTypeDescription }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const acceptedTypes = acceptedMimeTypes.split(',').map(t => t.trim());
    const files = Array.from(e.dataTransfer.files).filter((file: File) => acceptedTypes.includes(file.type));
    if (files.length > 0) {
      onFilesAdded(files);
    }
  }, [onFilesAdded, acceptedMimeTypes]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const acceptedTypes = acceptedMimeTypes.split(',').map(t => t.trim());
    const files = Array.from(e.target.files || []).filter((file: File) => acceptedTypes.includes(file.type));
    if (files.length > 0) {
      onFilesAdded(files);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`w-full p-8 border-2 border-dashed rounded-lg text-center transition-colors duration-300 ${isDragging ? 'border-accent bg-accent/10' : 'border-secondary'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept={acceptedMimeTypes}
        multiple
        className="hidden"
      />
      <UploadCloudIcon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-primary-foreground">
        {promptText}
      </h3>
      <p className="mt-1 text-xs text-gray-400">hoặc</p>
      <button
        type="button"
        onClick={openFileDialog}
        className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
      >
        Chọn tệp
      </button>
      <p className="mt-4 text-xs text-gray-500">{fileTypeDescription}</p>
    </div>
  );
};

export default FileUpload;