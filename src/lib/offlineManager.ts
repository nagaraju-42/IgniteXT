import { Filesystem, Directory } from '@capacitor/filesystem';

export const OfflineManager = {
  /**
   * Generates a safe local filename from a URL
   */
  getFileName(url: string) {
    const parts = url.split('/');
    return parts[parts.length - 1] || `file_${Date.now()}.pdf`;
  },

  /**
   * Checks if a file is already downloaded and saved offline
   */
  async isFileDownloaded(filename: string): Promise<boolean> {
    try {
      await Filesystem.stat({
        path: `pdf_cache/${filename}`,
        directory: Directory.Data,
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Downloads a PDF from a URL and saves it to the device's internal storage
   */
  async downloadFile(url: string, filename: string): Promise<string | null> {
    try {
      // Ensure the cache directory exists
      try {
        await Filesystem.mkdir({
          path: 'pdf_cache',
          directory: Directory.Data,
          recursive: true
        });
      } catch (e) {
        // Directory might already exist, ignore
      }

      const result = await Filesystem.downloadFile({
        url: url,
        path: `pdf_cache/${filename}`,
        directory: Directory.Data,
      });
      
      return result.path || null;
    } catch (error) {
      console.error('Download failed:', error);
      return null;
    }
  },

  /**
   * Opens the file in the native PDF viewer on Android/iOS, or new tab on web
   */
  async openNativeFile(filename: string): Promise<boolean> {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.getPlatform() === 'web') {
        const uri = await this.getOfflineFileDataUri(filename);
        if (uri) {
           window.open(uri, '_blank');
           return true;
        }
        return false;
      }
      
      const { FileOpener } = await import('@capacitor-community/file-opener');
      const uriResult = await Filesystem.getUri({
        path: `pdf_cache/${filename}`,
        directory: Directory.Data
      });
      await FileOpener.open({ filePath: uriResult.uri });
      return true;
    } catch (error) {
      console.error('Failed to open native file:', error);
      return false;
    }
  },

  /**
   * Reads an offline file and returns it as a Base64 Data URI so it can be viewed in an iframe
   */
  async getOfflineFileDataUri(filename: string): Promise<string | null> {
    try {
      const result = await Filesystem.readFile({
        path: `pdf_cache/${filename}`,
        directory: Directory.Data,
      });
      
      // On web, Capacitor might return a Blob directly
      if (result.data instanceof Blob) {
        return URL.createObjectURL(result.data);
      }
      
      // On native, it returns a base64 string
      return `data:application/pdf;base64,${result.data}`;
    } catch (error) {
      console.error('Failed to read offline file:', error);
      return null;
    }
  },

  /**
   * Deletes an offline file
   */
  async deleteFile(filename: string) {
    try {
      await Filesystem.deleteFile({
        path: `pdf_cache/${filename}`,
        directory: Directory.Data,
      });
    } catch (e) {
      console.warn('Physical file deletion error:', e);
    }
    this.removeMetadata(filename);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_files_changed', { detail: { filename, action: 'deleted' } }));
    }
    return true;
  },

  /**
   * Metadata Management
   */
  getDownloadedFiles() {
    try {
      const data = localStorage.getItem('semkit_offline_files') || localStorage.getItem('ignitext_offline_files');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async syncAndGetFiles() {
    let files = this.getDownloadedFiles();
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const res = await Filesystem.readdir({
        path: 'pdf_cache',
        directory: Directory.Data
      });
      if (res && res.files) {
        const diskNames = new Set(res.files.map(f => typeof f === 'string' ? f : f.name));
        // Keep files that actually exist on disk
        files = files.filter(f => diskNames.has(f.filename));
        
        // Add files that exist on disk but were missing from metadata
        for (const diskFile of res.files) {
          const fname = typeof diskFile === 'string' ? diskFile : diskFile.name;
          if (fname.toLowerCase().endsWith('.pdf') && !files.some(f => f.filename === fname)) {
            const cleanTitle = decodeURIComponent(fname.replace(/^[0-9]+_/, '').replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
            files.push({
              filename: fname,
              title: cleanTitle || 'Saved Document',
              sizeKb: typeof diskFile === 'object' && diskFile.size ? Math.round(diskFile.size / 1024) : 0,
              downloadedAt: Date.now()
            });
          }
        }
        localStorage.setItem('semkit_offline_files', JSON.stringify(files));
        localStorage.setItem('ignitext_offline_files', JSON.stringify(files));
      }
    } catch(e) {
      // readdir might fail on web, fallback to metadata
    }
    return files;
  },

  saveMetadata(filename: string, title: string, sizeKb?: number, subjectName?: string) {
    const files = this.getDownloadedFiles();
    const existingIndex = files.findIndex((f: any) => f.filename === filename);
    
    let inferredSubject = subjectName;
    let cleanTitle = title;
    if (!inferredSubject && title && title.includes(' - ')) {
      const parts = title.split(' - ');
      inferredSubject = parts[0].trim();
      cleanTitle = parts.slice(1).join(' - ').trim();
    }

    const newEntry = { 
      filename, 
      title: cleanTitle || title, 
      subjectName: inferredSubject || 'General Notes',
      sizeKb: sizeKb || 0, 
      downloadedAt: Date.now() 
    };
    
    if (existingIndex >= 0) {
      files[existingIndex] = newEntry;
    } else {
      files.push(newEntry);
    }
    localStorage.setItem('semkit_offline_files', JSON.stringify(files));
    localStorage.setItem('ignitext_offline_files', JSON.stringify(files));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_files_changed', { detail: { filename, action: 'saved' } }));
    }
  },

  removeMetadata(filename: string) {
    const files = this.getDownloadedFiles();
    const filtered = files.filter((f: any) => f.filename !== filename);
    localStorage.setItem('semkit_offline_files', JSON.stringify(filtered));
    localStorage.setItem('ignitext_offline_files', JSON.stringify(filtered));
  }
};
