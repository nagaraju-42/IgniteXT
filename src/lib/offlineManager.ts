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
      
      const { FileOpener } = await import('@capawesome-team/capacitor-file-opener');
      const uriResult = await Filesystem.getUri({
        path: `pdf_cache/${filename}`,
        directory: Directory.Data
      });
      await FileOpener.openFile({ path: uriResult.uri, mimeType: 'application/pdf' });
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
      this.removeMetadata(filename);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Metadata Management
   */
  getDownloadedFiles() {
    try {
      const data = localStorage.getItem('ignitext_offline_files');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveMetadata(filename: string, title: string, sizeKb?: number) {
    const files = this.getDownloadedFiles();
    const existingIndex = files.findIndex((f: any) => f.filename === filename);
    const newEntry = { filename, title, sizeKb: sizeKb || 0, downloadedAt: Date.now() };
    
    if (existingIndex >= 0) {
      files[existingIndex] = newEntry;
    } else {
      files.push(newEntry);
    }
    localStorage.setItem('ignitext_offline_files', JSON.stringify(files));
  },

  removeMetadata(filename: string) {
    const files = this.getDownloadedFiles();
    const filtered = files.filter((f: any) => f.filename !== filename);
    localStorage.setItem('ignitext_offline_files', JSON.stringify(filtered));
  }
};
