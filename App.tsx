
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { User, ProcessedFile, FileStatus, CompressionLevel, AppMode, UserPermissions, EnhancementStep } from './types';
import FileUpload from './components/FileUpload.tsx';
import FileItem from './components/FileItem.tsx';
import AccessControl from './components/AccessControl.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import { HPLogo } from './components/HPLogo.tsx';
import { LogOutIcon, UsersIcon, CompressIcon, MergeIcon, ImageToPdfIcon, ArrowLeftIcon, WandIcon, PieChartIcon, XIcon, SplitIcon, DownloadIcon } from './components/icons.tsx';
import { GoogleGenAI, Modality } from "@google/genai";

// Khai báo các thư viện được tải từ CDN trên đối tượng window
declare global {
  interface Window {
    PDFLib: any;
    pdfjsLib: any;
    JSZip: any;
  }
}

// Quyền hạn mặc định cho người dùng mới được tạo bởi admin
const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  canCompressBatch: true,
  canDownloadBatch: false,
  canMerge: true,
  canConvertToPdf: true,
  canEnhanceImage: true,
  canExtract: true,
};

// Người dùng ban đầu, chỉ được sử dụng nếu localStorage trống
const initialUsers: User[] = [
  {
    username: 'admin',
    password: '@215',
    role: 'admin',
    permissions: {
      canCompressBatch: true,
      canDownloadBatch: true,
      canMerge: true,
      canConvertToPdf: true,
      canEnhanceImage: true,
      canExtract: true,
    },
  },
];

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes <= 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


const App: React.FC = () => {
  // Trạng thái người dùng được khởi tạo từ localStorage để đảm bảo dữ liệu bền vững.
  const [users, setUsers] = useState<User[]>(() => {
    try {
      const storedUsers = localStorage.getItem('pdfCompressorUsers');
      if (storedUsers) {
        const parsedUsers: any[] = JSON.parse(storedUsers);
        // Migration: Đảm bảo tất cả người dùng (đặc biệt là từ localStorage cũ) đều có quyền canExtract
        return parsedUsers.map(u => ({
          ...u,
          permissions: {
            ...DEFAULT_USER_PERMISSIONS, // Lấy giá trị mặc định làm nền
            ...u.permissions, // Ghi đè bằng quyền hiện có
            // HOTFIX: Nếu user là admin, BẮT BUỘC bật quyền canExtract để tránh lỗi dữ liệu cũ khóa tính năng
            canExtract: u.username === 'admin' ? true : (u.permissions?.canExtract !== undefined ? u.permissions.canExtract : true)
          }
        }));
      }
      return initialUsers;
    } catch (error) {
      console.error("Lỗi khi đọc người dùng từ localStorage:", error);
      return initialUsers;
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const [files, setFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('recommended');
  const [appMode, setAppMode] = useState<AppMode | null>(null);
  const [compressionSummary, setCompressionSummary] = useState<{
    totalOriginal: number;
    totalCompressed: number;
    successCount: number;
    totalCount: number;
  } | null>(null);
  
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Kiểm tra phiên đăng nhập đã lưu khi ứng dụng khởi động
  useEffect(() => {
    const savedUsername = localStorage.getItem('pdfCompressorCurrentUser') || sessionStorage.getItem('pdfCompressorCurrentUser');
    if (savedUsername) {
      const user = users.find(u => u.username === savedUsername);
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
      }
    }
  }, [users]);

  // Lưu trạng thái người dùng vào localStorage mỗi khi có thay đổi.
  useEffect(() => {
    try {
      localStorage.setItem('pdfCompressorUsers', JSON.stringify(users));
    } catch (error) {
      console.error("Lỗi khi lưu người dùng vào localStorage:", error);
    }
  }, [users]);

  useEffect(() => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
    }
  }, []);

  const handleLogin = (username: string, password: string, rememberMe: boolean): boolean => {
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      setCurrentUser(user);
      setIsLoggedIn(true);
      
      // Lưu thông tin đăng nhập
      if (rememberMe) {
        localStorage.setItem('pdfCompressorCurrentUser', username);
      } else {
        sessionStorage.setItem('pdfCompressorCurrentUser', username);
      }
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setFiles([]);
    setAppMode(null);
    // Xóa thông tin đăng nhập đã lưu
    localStorage.removeItem('pdfCompressorCurrentUser');
    sessionStorage.removeItem('pdfCompressorCurrentUser');
  };
  
  const handleUpdateUserPermissions = (username: string, permissions: UserPermissions) => {
    setUsers(users.map(u => u.username === username ? { ...u, permissions } : u));
    // Cập nhật ngay lập tức nếu đang là người dùng hiện tại
    if (currentUser && currentUser.username === username) {
        setCurrentUser({ ...currentUser, permissions });
    }
  };
  
  const handleAddUser = (newUser: Pick<User, 'username' | 'password'>): { success: boolean, message: string } => {
    if (users.some(u => u.username === newUser.username)) {
      return { success: false, message: 'Tên đăng nhập đã tồn tại.' };
    }
    const userToAdd: User = {
      ...newUser,
      role: 'user',
      permissions: DEFAULT_USER_PERMISSIONS,
    };
    setUsers([...users, userToAdd]);
    return { success: true, message: 'Đã thêm người dùng thành công.' };
  };

  const handleDeleteUser = (username: string): { success: boolean, message: string } => {
      const userToDelete = users.find(u => u.username === username);
      if (!userToDelete) {
          return { success: false, message: 'Không tìm thấy người dùng.' };
      }
      if (userToDelete.username === currentUser?.username) {
          return { success: false, message: 'Bạn không thể xóa chính mình.' };
      }
      const admins = users.filter(u => u.role === 'admin');
      if (userToDelete.role === 'admin' && admins.length <= 1) {
          return { success: false, message: 'Không thể xóa quản trị viên cuối cùng.' };
      }
      setUsers(users.filter(u => u.username !== username));
      return { success: true, message: `Đã xóa người dùng ${username}.` };
  };

  const handleChangePassword = (username: string, newPassword: string): { success: boolean, message: string } => {
    if (!newPassword.trim()) {
      return { success: false, message: 'Mật khẩu không được để trống.' };
    }
    setUsers(users.map(u => u.username === username ? { ...u, password: newPassword } : u));
    return { success: true, message: `Đã cập nhật mật khẩu cho người dùng ${username}.` };
  };


  const handleFilesAdded = useCallback(async (newFiles: File[]) => {
    // Tạo mảng file xử lý ban đầu
    const initialProcessedFiles = newFiles.map(file => ({
      id: `${file.name}-${file.lastModified}-${Math.random()}`,
      file,
      originalSize: file.size,
      status: FileStatus.Waiting,
      progress: 0,
      extractPageRange: '',
      pageCount: undefined,
    }));

    // Thêm vào state ngay lập tức để UI phản hồi nhanh
    setFiles(prev => [...prev, ...initialProcessedFiles]);
    setCompressionSummary(null);

    // Tính toán số trang bất đồng bộ cho các file PDF
    const updatedFilesWithPages = await Promise.all(initialProcessedFiles.map(async (pFile) => {
      if (pFile.file.type === 'application/pdf') {
        try {
          const buffer = await pFile.file.arrayBuffer();
          // Sử dụng PDFLib để đếm trang
          if (window.PDFLib) {
             const { PDFDocument } = window.PDFLib;
             const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
             return { ...pFile, pageCount: pdfDoc.getPageCount() };
          }
        } catch (error) {
          console.error(`Không thể đọc số trang của file ${pFile.file.name}`, error);
          return pFile;
        }
      }
      return pFile;
    }));

    // Cập nhật lại state với thông tin số trang
    setFiles(prev => prev.map(f => {
      const updated = updatedFilesWithPages.find(u => u.id === f.id);
      return updated ? updated : f;
    }));

  }, []);

  const handleRemoveFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleClearAll = () => {
    setFiles([]);
    setCompressionSummary(null);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, position: number) => {
      e.preventDefault();
      if (dragItem.current !== null) {
          dragOverItem.current = position;
          setDragOverIndex(position);
      }
  };
  
  const handleDrop = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const filesCopy = [...files];
    const dragItemContent = filesCopy[dragItem.current];
    filesCopy.splice(dragItem.current, 1);
    filesCopy.splice(dragOverItem.current, 0, dragItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setFiles(filesCopy);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
      setDragOverIndex(null);
  };

  const handleSelectMode = (mode: AppMode) => {
    setAppMode(mode);
    setFiles([]);
    setIsProcessing(false);
    setIsZipping(false);
    setCompressionSummary(null);
  }
  
  const fileToBase64 = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
      });
      
  const dataUrlToParts = (dataUrl: string): { base64: string; mimeType: string } => {
    const [metaPart, base64Part] = dataUrl.split(',');
    if (!metaPart || !base64Part) {
      console.error("Invalid Data URL:", dataUrl.substring(0, 100));
      throw new Error("Định dạng Data URL không hợp lệ.");
    }
    const meta_type = metaPart.split(':')[1];
    if (!meta_type) {
      console.error("Could not find mime type in Data URL:", metaPart);
      throw new Error("Không thể tìm thấy kiểu mime trong Data URL.");
    }
    const mimeType = meta_type.split(';')[0];
    return { base64: base64Part, mimeType: mimeType || 'image/png' };
  }

  // Extract Pages Helper
  const parsePageRange = (range: string, maxPages: number): number[] => {
    const pages = new Set<number>();
    const parts = range.split(',').map(p => p.trim());
    
    parts.forEach(part => {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(num => parseInt(num));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= maxPages) pages.add(i - 1);
                }
            }
        } else {
            const page = parseInt(part);
            if (!isNaN(page) && page >= 1 && page <= maxPages) {
                pages.add(page - 1);
            }
        }
    });
    
    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleUpdatePageRange = (id: string, range: string) => {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, extractPageRange: range } : f));
  };

  const handleExtractSingleFile = async (id: string, customRange?: string) => {
    const fileToExtract = files.find(f => f.id === id);
    // Nếu có customRange (trích xuất nhanh trong mode khác), ta không cần kiểm tra status
    const isQuickExtract = !!customRange;
    const rangeToUse = customRange || fileToExtract?.extractPageRange;

    // Cho phép trích xuất ngay cả khi status là Done (đối với file đã gộp) hoặc Waiting
    if (!fileToExtract || !rangeToUse) return;

    // Chỉ cập nhật trạng thái UI nếu đang ở mode Extract chính thức
    if (!isQuickExtract) {
        setFiles(prev => prev.map(f =>
            f.id === id ? { ...f, status: FileStatus.Compressing, progress: 0 } : f
        ));
    }
    
    try {
        const { PDFDocument } = window.PDFLib;
        const existingPdfBytes = await fileToExtract.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
        
        const pageIndices = parsePageRange(rangeToUse, pdfDoc.getPageCount());
        
        if (pageIndices.length === 0) {
             throw new Error("Phạm vi trang không hợp lệ hoặc không nằm trong tài liệu.");
        }

        const newPdfDoc = await PDFDocument.create();
        const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
        
        copiedPages.forEach((page) => newPdfDoc.addPage(page));
        
        const pdfBytes = await newPdfDoc.save();
        const compressedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        const downloadUrl = URL.createObjectURL(compressedBlob);
        
        if (!isQuickExtract) {
            setFiles(prev => prev.map(f => f.id === id ? { 
                ...f, 
                status: FileStatus.Done, 
                compressedSize: compressedBlob.size, 
                downloadUrl, 
                progress: 100 
            } : f));
        } else {
            // Nếu là Quick Extract, tự động tải xuống
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `extracted_${fileToExtract.file.name}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
        }

    } catch (error) {
        console.error(`Lỗi khi trích xuất tệp ${fileToExtract.file.name}:`, error);
        alert(`Lỗi: ${(error as Error).message}`);
        if (!isQuickExtract) {
             setFiles(prev => prev.map(f => f.id === id ? { ...f, status: FileStatus.Error, progress: 0 } : f));
        }
    }
  };


  const compressPdfFile = async (
    file: ProcessedFile,
    level: CompressionLevel,
    onProgress: (progress: number) => void
  ): Promise<ProcessedFile> => {
    try {
      const { PDFDocument } = window.PDFLib;
      const existingPdfBytes = await file.file.arrayBuffer();

      if (level === 'light') {
        onProgress(50);
        const pdfDoc = await PDFDocument.load(existingPdfBytes, {
          updateMetadata: false,
          ignoreEncryption: true,
        });
        const pdfBytes = await pdfDoc.save();
        const compressedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        // Kiểm tra nếu nén làm tăng dung lượng (hoặc không giảm đáng kể)
        if (compressedBlob.size >= file.originalSize) {
             onProgress(100);
             return {
                ...file,
                status: FileStatus.Done,
                compressedSize: file.originalSize,
                downloadUrl: URL.createObjectURL(file.file), // Tải file gốc
                progress: 100,
            };
        }

        const downloadUrl = URL.createObjectURL(compressedBlob);
        onProgress(100);
        return {
          ...file,
          status: FileStatus.Done,
          compressedSize: compressedBlob.size,
          downloadUrl,
          progress: 100,
        };
      }

      const loadingTask = window.pdfjsLib.getDocument({ data: existingPdfBytes });
      const pdf = await loadingTask.promise;
      const newPdfDoc = await PDFDocument.create();

      let quality: number;
      let dpi: number;

      switch (level) {
        case 'recommended': quality = 0.7; dpi = 120; break;
        case 'high': quality = 0.6; dpi = 96; break;
        case 'extreme': quality = 0.4; dpi = 72; break;
        default: quality = 0.7; dpi = 120;
      }
      
      const scale = dpi / 72;
      onProgress(5);

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        
        const jpegBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Không thể tạo blob từ canvas."));
                return;
              }
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as ArrayBuffer);
              reader.onerror = () => reject(reader.error);
              reader.readAsArrayBuffer(blob);
            }, 'image/jpeg', quality);
        });
        
        const jpegImage = await newPdfDoc.embedJpg(jpegBytes);
        const newPage = newPdfDoc.addPage([viewport.width, viewport.height]);
        newPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
        const progress = 5 + Math.round((i / pdf.numPages) * 90);
        onProgress(progress);
      }

      const pdfBytes = await newPdfDoc.save();
      const compressedBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      
      // Kiểm tra nếu nén làm tăng dung lượng
      if (compressedBlob.size >= file.originalSize) {
            onProgress(100);
            return {
            ...file,
            status: FileStatus.Done,
            compressedSize: file.originalSize,
            downloadUrl: URL.createObjectURL(file.file), // Tải file gốc
            progress: 100,
        };
      }

      const downloadUrl = URL.createObjectURL(compressedBlob);
      onProgress(100);

      return { ...file, status: FileStatus.Done, compressedSize: compressedBlob.size, downloadUrl, progress: 100 };
    } catch (error) {
      console.error(`Lỗi khi nén tệp ${file.file.name}:`, error);
      onProgress(0);
      return { ...file, status: FileStatus.Error, progress: 0 };
    }
  };

  const handleCompressSingleFile = async (id: string) => {
    const fileToCompress = files.find(f => f.id === id);
    if (!fileToCompress || fileToCompress.status !== FileStatus.Waiting) return;

    setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: FileStatus.Compressing, progress: 0 } : f
    ));
    
    const fileToProcess = { ...files.find(f => f.id === id)! };

    const result = await compressPdfFile(
        fileToProcess,
        compressionLevel,
        (progress) => {
            setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f));
        }
    );

    setFiles(prev => prev.map(f => f.id === id ? result : f));
  };

  const handleCompressAll = async () => {
    if (currentUser?.permissions.canCompressBatch === false) return;
    const filesToCompress = files.filter(f => f.status === FileStatus.Waiting);
    if (filesToCompress.length === 0) return;

    setIsProcessing(true);
    setCompressionSummary(null);
    setFiles(prev => prev.map(f => filesToCompress.some(ftc => ftc.id === f.id) ? { ...f, status: FileStatus.Compressing, progress: 0 } : f));
    
    const compressionPromises = filesToCompress.map(fileToCompress =>
      compressPdfFile(
        fileToCompress,
        compressionLevel,
        (progress) => setFiles(prev => prev.map(f => f.id === fileToCompress.id ? { ...f, progress } : f))
      ).then(result => setFiles(prev => prev.map(f => (f.id === result.id ? result : f))))
    );
    
    await Promise.all(compressionPromises);

    setFiles(currentFiles => {
      const doneFiles = currentFiles.filter(f => 
          filesToCompress.some(ftc => ftc.id === f.id) && f.status === FileStatus.Done && f.compressedSize !== undefined
      );

      if (doneFiles.length > 0) {
        const summary = doneFiles.reduce((acc, file) => {
          acc.totalOriginal += file.originalSize;
          acc.totalCompressed += file.compressedSize!;
          return acc;
        }, { totalOriginal: 0, totalCompressed: 0 });

        setCompressionSummary({
          ...summary,
          successCount: doneFiles.length,
          totalCount: filesToCompress.length,
        });
      }
      return currentFiles;
    });

    setIsProcessing(false);
  };
  
  const handleDownloadAll = async () => {
    if (currentUser?.permissions.canDownloadBatch === false) return;
    const filesToDownload = files.filter(f => f.status === FileStatus.Done && f.downloadUrl);
    if (filesToDownload.length === 0) return;

    setIsZipping(true);
    const zip = new window.JSZip();
    for (const file of filesToDownload) {
      const response = await fetch(file.downloadUrl!);
      const blob = await response.blob();
      zip.file(file.file.name, blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zipBlob);
    link.download = 'files.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setIsZipping(false);
  };

  const handleMergePdfs = async () => {
    if (files.length < 2) {
      alert("Bạn cần ít nhất 2 tệp PDF để gộp.");
      return;
    }
    setIsProcessing(true);
    try {
      const { PDFDocument } = window.PDFLib;
      const mergedPdf = await PDFDocument.create();
      for (const file of files) {
        setFiles(prev => prev.map(f => f.id === file.id ? {...f, status: FileStatus.Compressing, progress: 50} : f));
        const pdfBytes = await file.file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
        setFiles(prev => prev.map(f => f.id === file.id ? {...f, status: FileStatus.Done, progress: 100} : f));
      }
      
      const mergedPdfBytes = await mergedPdf.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      
      // Tạo file mới đại diện cho file đã gộp
      const newFileName = `merged_${Date.now()}.pdf`;
      const newFileObj = new File([blob], newFileName, { type: 'application/pdf' });
      
      const newProcessedFile: ProcessedFile = {
        id: `merged-${Date.now()}`,
        file: newFileObj,
        originalSize: blob.size,
        status: FileStatus.Done, // Đánh dấu là Done để có thể tải xuống hoặc thao tác tiếp
        progress: 100,
        extractPageRange: '',
        pageCount: mergedPdf.getPageCount(),
        downloadUrl: URL.createObjectURL(blob),
      };
      
      // Thêm file mới vào danh sách
      setFiles(prev => [...prev, newProcessedFile]);

    } catch (error) {
      console.error("Lỗi khi gộp PDF:", error);
      alert("Đã xảy ra lỗi trong quá trình gộp tệp. Vui lòng thử lại.");
       setFiles(prev => prev.map(f => ({...f, status: FileStatus.Error})));
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleExtractAll = async () => {
      const filesToExtract = files.filter(f => f.status === FileStatus.Waiting && f.extractPageRange);
      if (filesToExtract.length === 0) return;
      
      setIsProcessing(true);
      await Promise.all(filesToExtract.map(file => handleExtractSingleFile(file.id)));
      setIsProcessing(false);
  }

  const handleConvertImagesToPdf = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    try {
      const { PDFDocument } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();
      for (const file of files) {
        setFiles(prev => prev.map(f => f.id === file.id ? {...f, status: FileStatus.Compressing, progress: 50} : f));
        const imgBytes = await file.file.arrayBuffer();
        let image;
        if (file.file.type === 'image/jpeg') {
          image = await pdfDoc.embedJpg(imgBytes);
        } else if (file.file.type === 'image/png') {
          image = await pdfDoc.embedPng(imgBytes);
        } else {
          continue;
        }
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        setFiles(prev => prev.map(f => f.id === file.id ? {...f, status: FileStatus.Done, progress: 100} : f));
      }
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'converted_from_images.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Lỗi khi chuyển đổi ảnh sang PDF:", error);
      alert("Đã xảy ra lỗi trong quá trình chuyển đổi. Vui lòng thử lại.");
       setFiles(prev => prev.map(f => ({...f, status: FileStatus.Error})));
    } finally {
      setIsProcessing(false);
    }
  };

  const getAIEnhancementErrorMessage = (error: unknown): string => {
    const errorMessage = (error as Error).message || 'Đã xảy ra lỗi không xác định.';

    if (errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("429") || errorMessage.includes("quota")) {
      return "Bạn đã vượt quá hạn mức sử dụng API. Vui lòng kiểm tra gói cước và thông tin thanh toán trong tài khoản Google AI của bạn. Thông thường, bạn cần bật thanh toán (Billing) cho dự án trên Google Cloud để sử dụng tính năng này.";
    }

    if (errorMessage.includes("API Key not valid")) {
      return "API Key không hợp lệ. Vui lòng kiểm tra lại biến môi trường VITE_GEMINI_API_KEY trên Netlify.";
    }

    if (errorMessage.includes("Yêu cầu bị chặn")) {
      return `Yêu cầu của bạn đã bị chặn bởi bộ lọc an toàn của AI. Chi tiết: ${errorMessage}`;
    }

    if (errorMessage.includes("Không nhận được ảnh")) {
      return `AI không thể tạo ảnh cho yêu cầu này. Vui lòng thử lại với một ảnh hoặc yêu cầu khác. Chi tiết: ${errorMessage}`;
    }

    // Cố gắng phân tích cú pháp nếu lỗi là một chuỗi JSON
    if (errorMessage.trim().startsWith('{')) {
      try {
        const errorObj = JSON.parse(errorMessage);
        if (errorObj.error?.message) {
          // Làm cho thông điệp lỗi API dễ đọc hơn
          const apiMsg = errorObj.error.message.replace(/(\r\n|\n|\r)/gm, " ").replace(/\s+/g, ' ');
          return `Lỗi từ Google AI: ${apiMsg}`;
        }
      } catch (e) {
        // Bỏ qua lỗi phân tích cú pháp
      }
    }
    
    // Fallback
    return errorMessage;
  };
  
  const enhanceImageFile = async (
    file: ProcessedFile,
    prompt: string,
    onProgress: (progress: number) => void,
    previousImageBase64?: { base64: string; mimeType: string }
  ): Promise<{ downloadUrl: string; processedSize: number; }> => {
      onProgress(10);
      
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;

      if (!apiKey) {
        console.error("Lỗi cấu hình: Biến môi trường VITE_GEMINI_API_KEY chưa được đặt. Hãy đảm bảo bạn đã cấu hình nó trong phần cài đặt của Netlify.");
        throw new Error("Lỗi cấu hình: Không tìm thấy API Key. Vui lòng kiểm tra lại cấu hình trên Netlify.");
      }
      
      const ai = new GoogleGenAI({ apiKey });
      onProgress(20);

      const parts = [];
      if (previousImageBase64) {
          parts.push({ inlineData: { mimeType: previousImageBase64.mimeType, data: previousImageBase64.base64 } });
      } else {
          const base64Data = await fileToBase64(file.file);
          parts.push({ inlineData: { mimeType: file.file.type, data: base64Data } });
      }
      onProgress(40);
      parts.push({ text: prompt });
      
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: { parts },
          config: {
              responseModalities: [Modality.IMAGE],
          },
      });
      onProgress(80);

      // Kiểm tra xem yêu cầu có bị chặn không
      if (response.promptFeedback?.blockReason) {
        throw new Error(`Yêu cầu bị chặn. Lý do: ${response.promptFeedback.blockReason}. ${response.promptFeedback.blockReasonMessage || ''}`);
      }

      const imageResponsePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

      if (!imageResponsePart?.inlineData) {
        const finishReason = response.candidates?.[0]?.finishReason;
        const responseText = response.text;
        let errorMessage = "Không nhận được ảnh từ phản hồi của AI.";

        if (finishReason === 'NO_IMAGE') {
            errorMessage = "AI đã từ chối tạo ảnh cho yêu cầu này. Điều này có thể xảy ra nếu nội dung không phù hợp với chính sách của AI. Vui lòng thử lại với một ảnh hoặc yêu cầu khác.";
        } else if (finishReason && finishReason !== 'STOP') {
            errorMessage += ` Lý do hoàn thành: ${finishReason}.`;
        }
        
        if (responseText) {
            errorMessage += ` Phản hồi văn bản từ AI: "${responseText.trim()}"`;
        }
        
        console.error("Full AI Response without image:", JSON.stringify(response, null, 2));
        throw new Error(errorMessage);
      }
      
      const enhancedBase64 = imageResponsePart.inlineData.data;
      const mimeType = imageResponsePart.inlineData.mimeType || 'image/png';
      const downloadUrl = `data:${mimeType};base64,${enhancedBase64}`;
      const byteString = atob(enhancedBase64);
      const processedSize = byteString.length;

      onProgress(100);
      return { downloadUrl, processedSize };
  };

  const handleEnhanceSingleFile = async (id: string) => {
    const fileToEnhance = files.find(f => f.id === id);
    if (!fileToEnhance || fileToEnhance.status !== FileStatus.Waiting) return;

    setFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: FileStatus.Compressing, progress: 0 } : f
    ));

    try {
        const initialPrompt = "Nâng cấp ảnh này lên chất lượng cao. Tự động điều chỉnh độ sáng, độ tương phản và cân bằng màu sắc để ảnh trông chuyên nghiệp và sắc nét hơn. Giữ lại các chi tiết gốc.";
        const result = await enhanceImageFile(
            fileToEnhance,
            initialPrompt,
            (progress) => setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f))
        );
        
        const newHistoryEntry: EnhancementStep = { prompt: "Cải thiện ban đầu", imageUrl: result.downloadUrl };

        setFiles(prev => prev.map(f => f.id === id ? {
            ...f,
            status: FileStatus.Done,
            downloadUrl: result.downloadUrl,
            compressedSize: result.processedSize,
            progress: 100,
            enhancementHistory: [newHistoryEntry]
        } : f));
    } catch (error) {
        const fileWithError = files.find(f => f.id === id)!;
        console.error(`Lỗi khi làm nét ảnh ${fileWithError.file.name}:`, error);
        const userFriendlyMessage = getAIEnhancementErrorMessage(error);
        alert(`Lỗi khi làm nét ảnh ${fileWithError.file.name}:\n${userFriendlyMessage}`);
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: FileStatus.Error, progress: 0 } : f));
    }
  };
  
  const handleSendEnhancementPrompt = async (id: string, prompt: string) => {
      const fileToEnhance = files.find(f => f.id === id);
      if (!fileToEnhance || !fileToEnhance.enhancementHistory || fileToEnhance.enhancementHistory.length === 0) return;

      setFiles(prev => prev.map(f =>
          f.id === id ? { ...f, status: FileStatus.Compressing, progress: 0 } : f
      ));

      try {
          const lastStep = fileToEnhance.enhancementHistory[fileToEnhance.enhancementHistory.length - 1];
          const previousImage = dataUrlToParts(lastStep.imageUrl);
          
          const result = await enhanceImageFile(
              fileToEnhance,
              prompt,
              (progress) => setFiles(prev => prev.map(f => f.id === id ? { ...f, progress } : f)),
              previousImage
          );

          const newHistoryEntry: EnhancementStep = { prompt: prompt, imageUrl: result.downloadUrl };

          setFiles(prev => prev.map(f => f.id === id ? {
              ...f,
              status: FileStatus.Done,
              downloadUrl: result.downloadUrl,
              compressedSize: result.processedSize,
              progress: 100,
              enhancementHistory: [...f.enhancementHistory!, newHistoryEntry]
          } : f));

      } catch (error) {
          const fileWithError = files.find(f => f.id === id)!;
          console.error(`Lỗi khi tinh chỉnh ảnh ${fileWithError.file.name}:`, error);
          const userFriendlyMessage = getAIEnhancementErrorMessage(error);
          alert(`Lỗi khi tinh chỉnh ảnh ${fileWithError.file.name}:\n${userFriendlyMessage}`);
          setFiles(prev => prev.map(f => f.id === id ? { ...f, status: FileStatus.Error, progress: 0 } : f));
      }
  };


  const handleEnhanceAll = async () => {
    if (currentUser?.permissions.canEnhanceImage === false) return;
    const filesToEnhance = files.filter(f => f.status === FileStatus.Waiting);
    if (filesToEnhance.length === 0) return;

    setIsProcessing(true);
    setFiles(prev => prev.map(f => filesToEnhance.some(fte => fte.id === f.id) ? { ...f, status: FileStatus.Compressing, progress: 0 } : f));
    
    const initialPrompt = "Nâng cấp ảnh này lên chất lượng cao. Tự động điều chỉnh độ sáng, độ tương phản và cân bằng màu sắc để ảnh trông chuyên nghiệp và sắc nét hơn. Giữ lại các chi tiết gốc.";
    const enhancementPromises = filesToEnhance.map(file =>
        enhanceImageFile(
            file,
            initialPrompt,
            (progress) => setFiles(prev => prev.map(f => f.id === file.id ? { ...f, progress } : f))
        ).then(result => {
            const newHistoryEntry: EnhancementStep = { prompt: "Cải thiện ban đầu", imageUrl: result.downloadUrl };
            setFiles(prev => prev.map(f => (f.id === file.id ? {
                 ...f,
                status: FileStatus.Done,
                downloadUrl: result.downloadUrl,
                compressedSize: result.processedSize,
                progress: 100,
                enhancementHistory: [newHistoryEntry]
            } : f)))
        }).catch(error => {
            console.error(`Lỗi khi làm nét ảnh ${file.file.name}:`, error);
            const userFriendlyMessage = getAIEnhancementErrorMessage(error);
            alert(`Lỗi khi làm nét ảnh ${file.file.name}:\n${userFriendlyMessage}`);
            setFiles(prev => prev.map(f => f.id === file.id ? { ...f, status: FileStatus.Error, progress: 0 } : f));
        })
    );
    
    await Promise.all(enhancementPromises);
    setIsProcessing(false);
  };


  if (!isLoggedIn || !currentUser) {
    return <AccessControl onLogin={handleLogin} />;
  }
  
  const waitingFilesCount = files.filter(f => f.status === FileStatus.Waiting).length;

  const getAcceptedMimeTypes = () => {
    switch (appMode) {
      case 'compress':
      case 'merge':
      case 'extract':
        return 'application/pdf';
      case 'imageToPdf':
      case 'enhanceImage':
        return 'image/jpeg, image/png';
      default:
        return '*/*';
    }
  };
  
  const getPromptText = () => {
    switch (appMode) {
      case 'compress': return 'Kéo và thả tệp PDF vào đây';
      case 'merge': return 'Kéo và thả các tệp PDF để gộp';
      case 'imageToPdf': return 'Kéo và thả tệp ảnh vào đây';
      case 'enhanceImage': return 'Kéo và thả ảnh cần làm nét';
      case 'extract': return 'Kéo và thả tệp PDF cần trích xuất';
      default: return 'Kéo và thả tệp';
    }
  };
  
  const getFileTypeDescription = () => {
    switch (appMode) {
      case 'compress': return 'Chỉ chấp nhận tệp PDF.';
      case 'merge': return 'Các tệp sẽ được gộp theo thứ tự hiển thị.';
      case 'imageToPdf': return 'Chấp nhận tệp JPG và PNG. Sắp xếp ảnh trước khi chuyển đổi.';
      case 'enhanceImage': return 'Chấp nhận tệp JPG và PNG. Mỗi ảnh sẽ được xử lý riêng lẻ.';
      case 'extract': return 'Chỉ chấp nhận tệp PDF. Bạn có thể chọn trang sau khi tải lên.';
      default: return '';
    }
  };

  const getModeTitle = () => {
    switch(appMode) {
        case 'compress': return 'Trình Nén PDF';
        case 'merge': return 'Trình Gộp PDF';
        case 'imageToPdf': return 'Chuyển Ảnh sang PDF';
        case 'enhanceImage': return 'Studio Tinh Chỉnh Ảnh AI';
        case 'extract': return 'Trích Xuất Trang PDF';
        default: return '';
    }
  };

  const MainActionButton = () => {
    switch (appMode) {
      case 'compress':
        return (
          <button
            onClick={handleCompressAll}
            disabled={isProcessing || waitingFilesCount === 0 || !currentUser.permissions.canCompressBatch}
            className="w-full sm:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent focus:ring-offset-primary"
            title={!currentUser.permissions.canCompressBatch ? "Bạn không có quyền này" : ""}
          >
            {isProcessing ? 'Đang nén...' : `Nén tất cả (${waitingFilesCount})`}
          </button>
        );
      case 'merge':
        return (
          <button
            onClick={handleMergePdfs}
            disabled={isProcessing || files.length < 2 || !currentUser.permissions.canMerge}
            className="w-full sm:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent focus:ring-offset-primary"
            title={!currentUser.permissions.canMerge ? "Bạn không có quyền này" : ""}
          >
            {isProcessing ? 'Đang gộp...' : `Gộp ${files.length} tệp`}
          </button>
        );
      case 'imageToPdf':
        return (
          <button
            onClick={handleConvertImagesToPdf}
            disabled={isProcessing || files.length === 0 || !currentUser.permissions.canConvertToPdf}
            className="w-full sm:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent focus:ring-offset-primary"
            title={!currentUser.permissions.canConvertToPdf ? "Bạn không có quyền này" : ""}
          >
            {isProcessing ? 'Đang chuyển đổi...' : `Chuyển ${files.length} ảnh sang PDF`}
          </button>
        );
      case 'enhanceImage':
        return (
          <button
            onClick={handleEnhanceAll}
            disabled={isProcessing || waitingFilesCount === 0 || !currentUser.permissions.canEnhanceImage}
            className="w-full sm:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent focus:ring-offset-primary"
            title={!currentUser.permissions.canEnhanceImage ? "Bạn không có quyền này" : ""}
          >
            {isProcessing ? 'Đang xử lý...' : `Làm nét tất cả (${waitingFilesCount})`}
          </button>
        );
      case 'extract':
        const validExtractCount = files.filter(f => f.status === FileStatus.Waiting && f.extractPageRange).length;
        return (
            <button
            onClick={handleExtractAll}
            disabled={isProcessing || validExtractCount === 0 || !currentUser.permissions.canExtract}
            className="w-full sm:w-auto px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-accent-foreground bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent focus:ring-offset-primary"
            title={!currentUser.permissions.canExtract ? "Bạn không có quyền này" : ""}
            >
            {isProcessing ? 'Đang xử lý...' : `Trích xuất (${validExtractCount})`}
            </button>
        );
      default:
        return null;
    }
  };

    const ToolCard: React.FC<{icon: React.ReactNode, title: string, description: string, onClick: () => void, disabled?: boolean, disabledTitle?: string}> = ({ icon, title, description, onClick, disabled, disabledTitle }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center justify-center w-full p-6 bg-secondary/50 rounded-lg text-center transition-all duration-300 hover:bg-accent/20 hover:ring-2 hover:ring-accent focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-secondary/50 disabled:hover:ring-0"
      title={disabled ? disabledTitle : ''}
    >
      <div className="bg-primary p-4 rounded-full transition-colors duration-300 group-hover:bg-accent text-accent group-hover:text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-primary-foreground">{title}</h3>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
    </button>
);

  return (
    <div className="min-h-screen bg-primary text-primary-foreground flex flex-col">
      {isAdminPanelOpen && currentUser.role === 'admin' && (
        <AdminPanel
          users={users}
          currentUser={currentUser}
          onAddUser={handleAddUser}
          onDeleteUser={handleDeleteUser}
          onChangePassword={handleChangePassword}
          onUpdatePermissions={handleUpdateUserPermissions}
          onClose={() => setIsAdminPanelOpen(false)}
        />
      )}
      <header className="bg-secondary/30 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-4">
             <HPLogo className="h-10 w-10 text-accent" />
            <div>
              <h1 className="text-xl font-bold">PDF Toolkit</h1>
              <p className="text-xs text-gray-400">Bộ công cụ xử lý file pdf</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-300 hidden sm:inline">
              Chào, <span className="font-bold">{currentUser.username}</span>!
            </span>
            {currentUser.role === 'admin' && (
                <button 
                    onClick={() => setIsAdminPanelOpen(true)} 
                    className="p-2 text-gray-400 hover:text-accent rounded-full focus:outline-none focus:ring-2 focus:ring-accent"
                    aria-label="Quản lý người dùng"
                    title="Quản lý người dùng"
                >
                    <UsersIcon className="w-6 h-6" />
                </button>
            )}
            <button 
              onClick={handleLogout} 
              className="p-2 text-gray-400 hover:text-red-500 rounded-full focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Đăng xuất"
              title="Đăng xuất"
            >
              <LogOutIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>
      
      {!appMode ? (
         <main className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center flex-1">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">Bộ công cụ PDF & Ảnh của bạn</h2>
            <p className="mt-4 text-lg text-gray-400">Lựa chọn một công cụ pdf để thực hiện.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full max-w-7xl">
            <ToolCard 
                icon={<CompressIcon className="w-8 h-8" />}
                title="Nén PDF"
                description="Giảm kích thước tệp PDF mà vẫn giữ được chất lượng."
                onClick={() => handleSelectMode('compress')}
            />
            <ToolCard 
                icon={<MergeIcon className="w-8 h-8" />}
                title="Gộp PDF"
                description="Kết hợp nhiều tệp PDF thành một tài liệu duy nhất."
                onClick={() => handleSelectMode('merge')}
                disabled={!currentUser.permissions.canMerge}
                disabledTitle="Bạn không có quyền này"
            />
            <ToolCard 
                icon={<SplitIcon className="w-8 h-8" />}
                title="Trích xuất PDF"
                description="Tách các trang cụ thể từ tệp PDF của bạn."
                onClick={() => handleSelectMode('extract')}
                disabled={!currentUser.permissions.canExtract}
                disabledTitle="Bạn không có quyền này"
            />
            <ToolCard 
                icon={<ImageToPdfIcon className="w-8 h-8" />}
                title="Ảnh sang PDF"
                description="Chuyển đổi các tệp ảnh JPG, PNG thành một tệp PDF."
                onClick={() => handleSelectMode('imageToPdf')}
                disabled={!currentUser.permissions.canConvertToPdf}
                disabledTitle="Bạn không có quyền này"
            />
             <ToolCard 
                icon={<WandIcon className="w-8 h-8" />}
                title="Làm Nét Ảnh"
                description="Cải thiện và tinh chỉnh ảnh bằng cách trò chuyện với AI."
                onClick={() => handleSelectMode('enhanceImage')}
                disabled={!currentUser.permissions.canEnhanceImage}
                disabledTitle="Bạn không có quyền này"
            />
          </div>
        </main>
      ) : (
        <main className="container mx-auto p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
            <div className="bg-secondary/50 p-4 rounded-lg mb-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                     <div>
                        <button onClick={() => setAppMode(null)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-accent transition-colors">
                            <ArrowLeftIcon className="w-4 h-4" />
                            <span>Đổi công cụ</span>
                        </button>
                        <h2 className="text-xl font-bold mt-1 text-primary-foreground">{getModeTitle()}</h2>
                    </div>
                    {appMode === 'compress' && (
                    <div className="text-sm">
                        <label htmlFor="compression-level" className="mr-2 font-medium">Mức nén:</label>
                        <select
                            id="compression-level"
                            value={compressionLevel}
                            onChange={(e) => setCompressionLevel(e.target.value as CompressionLevel)}
                            className="bg-primary border border-secondary text-primary-foreground text-xs rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                        >
                            <option value="light">Nhẹ (Cơ bản)</option>
                            <option value="recommended">Khuyên dùng (Tốt nhất)</option>
                            <option value="high">Cao (Giảm nhiều)</option>
                            <option value="extreme">Cực cao (Giảm tối đa)</option>
                        </select>
                    </div>
                    )}
                     <div className="flex items-center gap-3 w-full sm:w-auto">
                         {files.length > 0 && (
                             <button onClick={handleClearAll} className="text-sm text-red-400 hover:text-red-300">
                                 Xóa tất cả
                             </button>
                         )}
                        <MainActionButton />
                    </div>
                </div>
            </div>

            {compressionSummary && appMode === 'compress' && (
              <div className="mb-6 p-4 bg-secondary/50 rounded-lg flex items-center justify-between animate-fade-in">
                <div className="flex items-center gap-3">
                    <div className="bg-accent/20 p-2 rounded-full text-accent">
                        <PieChartIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium">Đã nén xong {compressionSummary.successCount}/{compressionSummary.totalCount} tệp</p>
                        <p className="text-xs text-gray-400">
                            Tổng: {formatBytes(compressionSummary.totalOriginal)} &rarr; {formatBytes(compressionSummary.totalCompressed)} 
                            <span className="text-green-400 ml-1 font-bold">
                                (-{((compressionSummary.totalOriginal - compressionSummary.totalCompressed) / compressionSummary.totalOriginal * 100).toFixed(1)}%)
                            </span>
                        </p>
                    </div>
                </div>
                {currentUser.permissions.canDownloadBatch && (
                     <button
                        onClick={handleDownloadAll}
                        disabled={isZipping}
                        className="flex items-center px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/80 rounded-md transition-colors"
                    >
                        {isZipping ? <span className="animate-spin mr-2">⏳</span> : <DownloadIcon className="w-4 h-4 mr-2" />}
                        Tải tất cả (ZIP)
                    </button>
                )}
              </div>
            )}

            <div className="space-y-4">
               {files.map((file, index) => (
                <FileItem
                  key={file.id}
                  processedFile={file}
                  onRemove={handleRemoveFile}
                  onCompressSingle={handleCompressSingleFile}
                  onEnhanceSingle={handleEnhanceSingleFile}
                  onExtractSingle={handleExtractSingleFile}
                  onUpdatePageRange={handleUpdatePageRange}
                  onSendEnhancementPrompt={handleSendEnhancementPrompt}
                  currentUser={currentUser}
                  appMode={appMode}
                  index={index}
                  onDragStart={handleDragStart}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={handleDrop}
                  onDragLeave={handleDragLeave}
                  isDragOver={dragOverIndex === index}
                />
              ))}
               <FileUpload
                onFilesAdded={handleFilesAdded}
                acceptedMimeTypes={getAcceptedMimeTypes()}
                promptText={getPromptText()}
                fileTypeDescription={getFileTypeDescription()}
              />
            </div>
            </div>
        </main>
      )}
    </div>
  );
};

export default App;
