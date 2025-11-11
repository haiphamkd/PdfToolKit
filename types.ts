export enum FileStatus {
  Waiting = 'waiting',
  Compressing = 'compressing',
  Done = 'done',
  Error = 'error',
}

export type CompressionLevel = 'light' | 'recommended' | 'high' | 'extreme';

export type AppMode = 'compress' | 'merge' | 'imageToPdf' | 'enhanceImage';

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
}

export interface UserPermissions {
  canCompressBatch: boolean;
  canDownloadBatch: boolean;
  canMerge: boolean;
  canConvertToPdf: boolean;
  canEnhanceImage: boolean;
}

export interface User {
  username: string;
  password: string; // Trong ứng dụng thực tế, đây sẽ là một chuỗi băm
  role: 'admin' | 'user';
  permissions: UserPermissions;
}
