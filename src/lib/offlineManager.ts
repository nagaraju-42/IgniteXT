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


  /**
   * Smart subject resolver that maps files and titles to their full official Subject Names
   */
  resolveSubjectAndTitle(filename: string, existingTitle?: string, existingSubject?: string): { subjectName: string; title: string } {
    const fn = (filename || '').toLowerCase();
    const t = (existingTitle || '').toLowerCase();
    const s = (existingSubject || '').trim();

    // 1. If subject is already a valid specific subject, keep it
    if (s && s !== 'General Notes' && s !== 'Other Materials') {
      return { 
        subjectName: s, 
        title: this.cleanNoteTitle(existingTitle || filename) 
      };
    }

    // 2. Subject name heuristics based on filename and title content
    let subjectName = 'General Notes';

    if (fn.includes('blockchain') || fn.includes('fbt') || t.includes('blockchain') || fn.includes('a57065') || t.includes('a57065')) {
      subjectName = 'Fundamentals of Blockchain Technology';
    } else if (fn.includes('dsv lab') || t.includes('dsv lab') || fn.includes('lab manual')) {
      subjectName = 'DSV Lab';
    } else if (fn.includes('data science') || fn.includes('dsv') || t.includes('data science') || t.includes('visualisation')) {
      subjectName = 'Data Science and Visualisation';
    } else if (fn.includes('cryptography') || fn.includes('cis') || t.includes('cryptography') || fn.includes('a57055') || t.includes('a57055')) {
      subjectName = 'Cryptography and Information Security';
    } else if (fn.includes('cloud') || fn.includes('fcc') || t.includes('cloud') || fn.includes('a57060') || t.includes('a57060')) {
      subjectName = 'Fundamentals of Cloud Computing';
    } else if (fn.includes('big data') || fn.includes('bda') || fn.includes('bd u') || fn.includes('bd sem') || t.includes('big data')) {
      subjectName = 'Big Data';
    } else if (fn.includes('compiler') || fn.includes('cd u') || fn.includes('cd sem') || t.includes('compiler design')) {
      subjectName = 'Compiler Design';
    } else if (fn.includes('machine learning') || fn.includes('ml u') || fn.includes('ml sem') || t.includes('machine learning')) {
      subjectName = 'Machine Learning';
    } else if (fn.includes('iot') || t.includes('iot')) {
      subjectName = 'IOT';
    } else if (fn.includes('r programming') || fn.includes('rp u') || fn.includes('rp sem') || t.includes('r programming')) {
      subjectName = 'R Programming';
    } else if (fn.includes('software engineering') || fn.includes('se-') || fn.includes('se sem') || t.includes('software engineering')) {
      subjectName = 'Software Engineering';
    } else if (fn.includes('project management') || fn.includes('pm unit') || fn.includes('pm sem') || t.includes('project management')) {
      subjectName = 'Project Management';
    } else if (fn.includes('mefa') || t.includes('mefa')) {
      subjectName = 'MEFA';
    }

    return {
      subjectName,
      title: this.cleanNoteTitle(existingTitle || filename)
    };
  },

  cleanNoteTitle(rawTitle: string): string {
    let title = (rawTitle || '').replace(/^null\s+/, '').trim();
    // If it's a raw UUID filename like "09b8670b-95c9-4ad6-bc91-babe2ec253aa-Unit 1.pdf"
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(title)) {
      title = title.replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-?/i, '');
    }
    title = title.replace(/\.(pdf|docx?|pptx?)$/i, '');
    title = decodeURIComponent(title).replace(/[-_]/g, ' ').trim();

    // If title was just a year like "2025"
    if (/^20[2-3][0-9]$/.test(title)) {
      return `${title} Question Paper (PYQ)`;
    }
    // If title contains mid papers or sem
    if (title.toLowerCase().includes('mid paper')) {
      return '2025 Mid Examination Papers';
    }
    if (title.toLowerCase().includes('sem') && !title.toLowerCase().includes('semester')) {
      return '2025 Semester Exam Paper';
    }

    return title || 'Lecture Notes';
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

        // Attempt to fetch DB metadata if online to guarantee 100% accurate subject names and titles
        let dbItemsMap: Record<string, { title: string; subjectName: string }> = {};
        try {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data: dbData } = await supabase
            .from('content_items')
            .select('file_url, title, type, exam_type, exam_year, subjects(name, code)');
          if (dbData) {
            dbData.forEach((item: any) => {
              if (item.file_url) {
                const fullUrl = item.file_url.toLowerCase();
                const rawName = fullUrl.split('/').pop() || '';
                let decodedName = '';
                try { decodedName = decodeURIComponent(rawName); } catch(e) {}

                let displayTitle = (item.title || '').replace(/^null\s+/, '').trim();
                if (item.type === 'pyq' || item.exam_type || item.exam_year) {
                  if (!displayTitle || /^\d{4}$/.test(displayTitle)) {
                    displayTitle = `${item.exam_type ? item.exam_type + ' ' : ''}${item.exam_year || displayTitle || ''} Question Paper (PYQ)`.trim();
                  }
                }

                const subjectName = item.subjects?.name ? item.subjects.name.trim() : '';
                const info = { title: displayTitle, subjectName };

                if (rawName) dbItemsMap[rawName] = info;
                if (decodedName) dbItemsMap[decodedName] = info;
                dbItemsMap[fullUrl] = info;
              }
            });
          }
        } catch(dbErr) {}

        // Re-process all files through DB map and smart heuristics
        for (const diskFile of res.files) {
          const fname = typeof diskFile === 'string' ? diskFile : diskFile.name;
          if (!fname.toLowerCase().endsWith('.pdf')) continue;

          let entry = files.find(f => f.filename === fname);
          const fnameKey = fname.toLowerCase();
          let decodedFname = '';
          try { decodedFname = decodeURIComponent(fnameKey); } catch(e) {}

          let dbMatch = dbItemsMap[fnameKey] || (decodedFname ? dbItemsMap[decodedFname] : null);
          if (!dbMatch) {
            const foundKey = Object.keys(dbItemsMap).find(k => k.endsWith('/' + fnameKey) || k === fnameKey || (decodedFname && k === decodedFname));
            if (foundKey) dbMatch = dbItemsMap[foundKey];
          }

          if (dbMatch) {
            const finalTitle = dbMatch.title || entry?.title || fname;
            const finalSubject = dbMatch.subjectName || entry?.subjectName || 'General Notes';
            if (entry) {
              entry.title = finalTitle;
              entry.subjectName = finalSubject;
            } else {
              entry = {
                filename: fname,
                title: finalTitle,
                subjectName: finalSubject,
                sizeKb: typeof diskFile === 'object' && diskFile.size ? Math.round(diskFile.size / 1024) : 0,
                downloadedAt: Date.now()
              };
              files.push(entry);
            }
          } else {
            // Apply smart subject resolver
            const resolved = this.resolveSubjectAndTitle(fname, entry?.title, entry?.subjectName);
            if (entry) {
              if (!entry.subjectName || entry.subjectName === 'General Notes') {
                entry.subjectName = resolved.subjectName;
              }
              entry.title = resolved.title || entry.title;
            } else {
              entry = {
                filename: fname,
                title: resolved.title,
                subjectName: resolved.subjectName,
                sizeKb: typeof diskFile === 'object' && diskFile.size ? Math.round(diskFile.size / 1024) : 0,
                downloadedAt: Date.now()
              };
              files.push(entry);
            }
          }
        }

        localStorage.setItem('semkit_offline_files', JSON.stringify(files));
        localStorage.setItem('ignitext_offline_files', JSON.stringify(files));
      }
    } catch(e) {
      // readdir error fallback
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

    if (!inferredSubject || inferredSubject === 'General Notes') {
      const resolved = this.resolveSubjectAndTitle(filename, title, subjectName);
      inferredSubject = resolved.subjectName;
      cleanTitle = resolved.title;
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
