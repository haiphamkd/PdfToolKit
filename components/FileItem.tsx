import React, { useState } from 'react';
import { ProcessedFile, FileStatus, User, AppMode } from '../types';
import { PdfIcon, DownloadIcon, TrashIcon, CheckCircleIcon, XCircleIcon, ClockIcon, GripVerticalIcon, SendIcon } from './icons';

interface FileItemProps {
  processedFile: ProcessedFile;
  onRemove: (id: string) => void;
  onCompressSingle: (id: string) => void;
  onEnhanceSingle: (id: string) => void;
  onSendEnhancementPrompt: (id: string, prompt: string) => void;
  currentUser: User;
  appMode: AppMode;
  index: number;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, position: number) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
  onDragLeave: () => void;
  isDragOver: boolean;
}

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const enhancementSuggestions = [
    { label: 'Nâng cấp & Chỉnh màu', prompt: 'Upscale the image and perform professional color grading. Enhance the dynamic range and correct any color casts.' },
    { label: 'Tăng cường ánh sáng', prompt: 'Improve the lighting of the image. Make it brighter and more vibrant, as if shot in natural, soft light, without washing out the details.' },
    { label: 'Thêm chiều sâu & tương phản', prompt: 'Add more depth and contrast to the image. Make the blacks deeper and the whites brighter, enhancing the overall three-dimensional feel.' },
    { label: 'Làm màu sắc sống động', prompt: 'Boost the color saturation and vibrance to make the image more vivid and appealing. Make the colors pop without looking unnatural.' },
    { label: 'Làm sắc nét chi tiết', prompt: 'Intelligently sharpen the details in the image. Focus on edges and textures to make them crisper, without introducing halos or artifacts.' },
];


const FileItem: React.FC<FileItemProps> = ({
  processedFile,
  onRemove,
  onCompressSingle,
  onEnhanceSingle,
  onSendEnhancementPrompt,
  appMode,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onDragLeave,
  isDragOver,
}) => {
  const { file, status, originalSize, compressedSize, downloadUrl, id, progress, enhancementHistory } = processedFile;
  const reduction = originalSize && compressedSize ? ((originalSize - compressedSize) / originalSize) * 100 : 0;
  const [prompt, setPrompt] = useState('');

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSendEnhancementPrompt(id, prompt.trim());
      setPrompt('');
    }
  };

  const handleSuggestionClick = (suggestionPrompt: string) => {
    onSendEnhancementPrompt(id, suggestionPrompt);
  };

  const StatusIndicator = () => {
    switch (status) {
      case FileStatus.Waiting:
        if (appMode === 'compress') {
            return (
              <button
                onClick={() => onCompressSingle(id)}
                className="px-3 py-1 text-xs font-semibold rounded-md text-accent-foreground bg-accent hover:bg-accent/90 transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={`Nén tệp ${file.name}`}
              >
                Nén
              </button>
            );
        }
        if (appMode === 'enhanceImage') {
            return (
              <button
                onClick={() => onEnhanceSingle(id)}
                className="px-3 py-1 text-xs font-semibold rounded-md text-accent-foreground bg-accent hover:bg-accent/90 transition-colors focus:outline-none focus:ring-2 focus:ring-accent"
                aria-label={`Làm nét ảnh ${file.name}`}
              >
                Làm nét
              </button>
            );
        }
        return (
            <div className="flex items-center justify-center space-x-2 text-gray-400" title="Chờ xử lý hàng loạt">
                <ClockIcon className="w-5 h-5" />
                <span className="text-xs font-medium">Đang chờ</span>
            </div>
        );
      case FileStatus.Compressing:
        return (
          <div className="flex items-center space-x-2 w-full">
            <svg className="animate-spin h-5 w-5 text-accent flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div className="w-full bg-primary/50 rounded-full h-2">
              <div className="bg-accent h-2 rounded-full transition-all duration-200" style={{ width: `${progress || 0}%` }}></div>
            </div>
            <span className="text-xs w-10 text-right">{progress || 0}%</span>
          </div>
        );
      case FileStatus.Done:
         if (appMode === 'enhanceImage') return null; // Sẽ được xử lý bởi phần giao diện trò chuyện
         return (
            <div className="flex items-center justify-center space-x-2 text-green-400" title="Hoàn thành">
                <CheckCircleIcon className="w-5 h-5" />
                <span className="text-xs font-medium">Hoàn thành</span>
            </div>
        );
      case FileStatus.Error:
        return (
          <div className="flex items-center justify-center space-x-2 text-red-500" title="Đã xảy ra lỗi">
            <XCircleIcon className="w-5 h-5" />
            <span className="text-xs font-medium">Lỗi</span>
          </div>
        );
      default:
        return null;
    }
  };

  const showDragHandle = appMode === 'merge' || appMode === 'imageToPdf';
  const isDownloadable = status === FileStatus.Done && downloadUrl && appMode === 'compress';
  
  const isEnhancementDone = appMode === 'enhanceImage' && status === FileStatus.Done && enhancementHistory && enhancementHistory.length > 0;
  const latestImageUrl = isEnhancementDone ? enhancementHistory![enhancementHistory!.length - 1].imageUrl : undefined;
  
  const downloadTitle = "Tải xuống ảnh đã làm nét";
  const downloadFilename = `enhanced_${file.name}`;

  if (isEnhancementDone) {
    return (
      <div className="bg-secondary/50 p-4 rounded-lg flex flex-col space-y-4">
        <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-foreground truncate" title={file.name}>{file.name}</p>
                <p className="text-xs text-gray-400">{formatBytes(originalSize)}</p>
            </div>
            <div className="flex items-center">
                 <a href={latestImageUrl} download={downloadFilename} className="p-2 text-gray-400 hover:text-accent rounded-full" title={downloadTitle}>
                    <DownloadIcon className="w-5 h-5" />
                </a>
                <button onClick={() => onRemove(id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full" title="Xóa tệp">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
                <img src={latestImageUrl} alt="Ảnh đã làm nét" className="w-full rounded-md object-contain max-h-96" />
            </div>
            {enhancementHistory!.length > 1 && (
                 <div className="md:w-1/3 space-y-2 max-h-96 overflow-y-auto pr-2">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase">Lịch sử chỉnh sửa</h4>
                    {enhancementHistory!.slice(0, -1).reverse().map((step, idx) => (
                        <div key={idx} className="bg-primary/50 p-2 rounded flex items-center gap-2 opacity-70">
                            <img src={step.imageUrl} alt={`Bước ${idx}`} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                            <p className="text-xs text-gray-300 italic">"{step.prompt}"</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
       
        {status === FileStatus.Done && (
            <div className="space-y-3">
              <div>
                  <p className="text-xs text-gray-400 mb-2 font-semibold">Gợi ý từ Trợ lý AI:</p>
                  <div className="flex flex-wrap gap-2">
                      {enhancementSuggestions.map((suggestion) => (
                          <button
                              key={suggestion.label}
                              onClick={() => handleSuggestionClick(suggestion.prompt)}
                              className="px-3 py-1.5 text-xs font-medium bg-primary/70 text-gray-300 rounded-full hover:bg-accent/80 hover:text-accent-foreground transition-colors"
                          >
                              {suggestion.label}
                          </button>
                      ))}
                  </div>
              </div>
              <form onSubmit={handlePromptSubmit} className="relative">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Hoặc tự nhập yêu cầu của bạn..."
                  className="w-full pl-4 pr-12 py-3 bg-primary/70 border border-secondary rounded-full text-primary-foreground placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button type="submit" className="absolute inset-y-0 right-0 flex items-center justify-center px-4 text-accent hover:text-accent/80 disabled:opacity-50" disabled={!prompt.trim()} aria-label="Gửi lời nhắc">
                  <SendIcon className="w-5 h-5" />
                </button>
              </form>
            </div>
        )}

      </div>
    );
  }

  return (
    <div
      draggable={showDragHandle}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
      className={`relative bg-secondary/50 p-3 rounded-lg flex items-center space-x-4 transition-all duration-200 ${isDragOver ? 'bg-accent/20 ring-2 ring-accent' : ''}`}
    >
      {showDragHandle && (
        <div className="cursor-grab text-gray-500 hover:text-white" title="Kéo để sắp xếp">
          <GripVerticalIcon className="w-5 h-5" />
        </div>
      )}
      <div className="flex-shrink-0">
         <img src={file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined} alt={file.name} className={`w-10 h-10 object-cover rounded ${file.type.startsWith('image/') ? '' : 'hidden'}`} />
         <div className={file.type.startsWith('image/') ? 'hidden' : ''}>
            <PdfIcon className="w-10 h-10 text-red-400" />
         </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary-foreground truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-400">
          {formatBytes(originalSize)}
          {status === FileStatus.Done && compressedSize && appMode === 'compress' && (
            <>
              <span className="mx-1">&rarr;</span>
              {formatBytes(compressedSize)}
              <span className="ml-2 text-green-400 font-semibold">
                (-{reduction.toFixed(1)}%)
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center space-x-3 w-48 justify-end">
        <div className="w-full text-center">
            <StatusIndicator />
        </div>
      </div>
      {isDownloadable && (
        <a href={downloadUrl} download={file.name} className="p-2 text-gray-400 hover:text-accent rounded-full" title="Tải xuống tệp đã nén">
            <DownloadIcon className="w-5 h-5" />
        </a>
      )}
      <button onClick={() => onRemove(id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full" title="Xóa tệp">
        <TrashIcon className="w-5 h-5" />
      </button>
    </div>
  );
};

export default FileItem;