export enum FileStatus {
  Waiting = 'waiting',
  Compressing = 'compressing',
  Done = 'done',
  Error = 'error',
}

export type CompressionLevel = 'light' | 'recommended' | 'high' | 'extreme';

export type AppMode = 'compress' | 'merge' | 'imageToPdf' | 'enhanceImage' | 'extract';

export interface EnhancementStep {
  prompt: string;
  imageUrl: string;
}

export interface ProcessedFile {
  id: string;
  file: File;
  originalSize: number;
  compressedSize?: number;
  status: FileStatus;
  downloadUrl?: string;
  progress?: number;
  enhancementHistory?: EnhancementStep[];
  extractPageRange?: string; // Ví dụ: "1-5, 8, 11-13"
  pageCount?: number; // Tổng số trang của file PDF
}

export interface UserPermissions {
  canCompressBatch: boolean;
  canDownloadBatch: boolean;
  canMerge: boolean;
  canConvertToPdf: boolean;
  canEnhanceImage: boolean;
  canExtract: boolean;
}

export interface User {
  username: string;
  password: string; // Trong ứng dụng thực tế, đây sẽ là một chuỗi băm
  role: 'admin' | 'user';
  permissions: UserPermissions;
}