import { Filesystem, Directory } from '@capacitor/filesystem';

export const OfflineManager = {
  /**
   * Generates a safe local filename from a URL
   */
  getFileName(url: string) {
    if (!url) return `file_${Date.now()}.pdf`;
    const parts = url.split('/');
    let raw = parts[parts.length - 1] || `file_${Date.now()}.pdf`;
    raw = raw.split('?')[0]; // strip query parameters
    try {
      raw = decodeURIComponent(raw);
    } catch (e) {}
    return raw;
  },

  /**
   * Checks if a file is already downloaded and saved offline
   */
  async isFileDownloaded(filename: string): Promise<boolean> {
    if (!filename) return false;
    const cleanFn = decodeURIComponent(filename || '').toLowerCase().trim();
    const rawFn = (filename || '').toLowerCase().trim();
    
    // Check deleted cache first
    try {
      const deletedList: string[] = JSON.parse(localStorage.getItem('semkit_deleted_cache') || '[]');
      if (deletedList.some(d => d.toLowerCase().trim() === cleanFn || d.toLowerCase().trim() === rawFn)) {
        return false;
      }
    } catch(e) {}

    // Fast metadata check from localStorage
    const metaFiles = this.getDownloadedFiles();
    const inMeta = metaFiles.some((f: any) => {
      const fName = decodeURIComponent(f.filename || '').toLowerCase().trim();
      const orig = (f.filename || '').toLowerCase().trim();
      return fName === cleanFn || orig === rawFn || fName === rawFn || orig === cleanFn || fName.endsWith('/' + cleanFn) || cleanFn.endsWith('/' + fName);
    });
    
    return inMeta;
  },

  /**
   * Downloads a PDF from a URL and saves it to the device's internal storage
   */
  async downloadFile(url: string, filename: string): Promise<string | null> {
    const cleanFilename = decodeURIComponent(filename);
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
        path: `pdf_cache/${cleanFilename}`,
        directory: Directory.Data,
      });
      
      return result.path || `pdf_cache/${cleanFilename}`;
    } catch (error) {
      console.warn('Filesystem.downloadFile failed, trying fetch fallback:', error);
      
      // Resilient fallback: fetch blob and write to filesystem directly
      try {
        const res = await fetch(url);
        if (!okStatus(res.status)) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const r = reader.result as string;
            resolve(r.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const writeRes = await Filesystem.writeFile({
          path: `pdf_cache/${cleanFilename}`,
          data: base64Data,
          directory: Directory.Data,
          recursive: true
        });

        return writeRes.uri || `pdf_cache/${cleanFilename}`;
      } catch (fetchErr) {
        console.error('Fetch fallback also failed:', fetchErr);
        return null;
      }
    }
  },

  /**
   * Opens the file in the native PDF viewer on Android/iOS, or new tab on web
   */
  async openNativeFile(filename: string): Promise<boolean> {
    const cleanFn = decodeURIComponent(filename);
    try {
      const { FileOpener } = await import('@capacitor-community/file-opener');
      const { Capacitor } = await import('@capacitor/core');

      if (Capacitor.isNativePlatform()) {
        const fileUri = await Filesystem.getUri({
          path: `pdf_cache/${cleanFn}`,
          directory: Directory.Data
        });

        await FileOpener.open({
          filePath: fileUri.uri,
          contentType: 'application/pdf',
          openWithDefault: false
        });
        return true;
      } else {
        const dataUri = await this.getOfflineFileDataUri(cleanFn);
        if (dataUri) {
          const win = window.open();
          if (win) {
            win.document.write(
              `<iframe src="${dataUri}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
            );
            return true;
          }
        }
      }
    } catch (e) {
      console.error('FileOpener failed, attempting data URI fallback:', e);
      try {
        const dataUri = await this.getOfflineFileDataUri(cleanFn);
        if (dataUri) {
          window.open(dataUri, '_blank');
          return true;
        }
      } catch (fallbackErr) {
        console.error('Fallback failed too:', fallbackErr);
      }
    }
    return false;
  },

  /**
   * Retrieves an offline file as a Data URI (Base64)
   */
  async getOfflineFileDataUri(filename: string): Promise<string | null> {
    const cleanFn = decodeURIComponent(filename);
    try {
      let result;
      try {
        result = await Filesystem.readFile({
          path: `pdf_cache/${cleanFn}`,
          directory: Directory.Data,
        });
      } catch (firstErr) {
        result = await Filesystem.readFile({
          path: `pdf_cache/${filename}`,
          directory: Directory.Data,
        });
      }
      
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
   * Deletes an offline file and removes it permanently from metadata & disk
   */
  async deleteFile(filename: string) {
    const cleanFn = decodeURIComponent(filename).trim();
    const rawFn = (filename || '').trim();
    
    // Add to deleted cache to prevent resurrecting
    try {
      const deletedList: string[] = JSON.parse(localStorage.getItem('semkit_deleted_cache') || '[]');
      if (!deletedList.includes(cleanFn)) deletedList.push(cleanFn);
      if (!deletedList.includes(rawFn)) deletedList.push(rawFn);
      localStorage.setItem('semkit_deleted_cache', JSON.stringify(deletedList));
    } catch(e) {}

    try {
      await Filesystem.deleteFile({
        path: `pdf_cache/${cleanFn}`,
        directory: Directory.Data,
      });
    } catch (e) {
      try {
        await Filesystem.deleteFile({
          path: `pdf_cache/${rawFn}`,
          directory: Directory.Data,
        });
      } catch (e2) {}
    }

    this.removeMetadata(cleanFn);
    this.removeMetadata(rawFn);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_files_changed', { detail: { filename: cleanFn, action: 'deleted' } }));
      window.dispatchEvent(new CustomEvent('offline_file_deleted', { detail: { filename: cleanFn } }));
      window.dispatchEvent(new Event('storage'));
    }
    return true;
  },

  /**
   * Metadata Management: Always gets immediately from localStorage
   */
  getDownloadedFiles(): any[] {
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
    // Strip raw UUID hashes
    title = title.replace(/^[0-9a-f]{8}[-\s][0-9a-f]{4}[-\s][0-9a-f]{4}[-\s][0-9a-f]{4}[-\s][0-9a-f]{2,12}[-\s]?/i, '');
    title = title.replace(/^[0-9a-f]{8,36}[-\s]?/i, '');
    title = title.replace(/\.(pdf|docx?|pptx?)$/i, '');
    title = decodeURIComponent(title).replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();

    // If title was just a year like "2025"
    if (/^20[2-3][0-9]$/.test(title)) {
      return `${title} Question Paper (PYQ)`;
    }
    if (title.toLowerCase().includes('mid paper') || title.toLowerCase().includes('mid examination')) {
      return title.includes('20') ? title : `2025 Mid Examination Papers`;
    }
    if (title.toLowerCase().includes('sem') && !title.toLowerCase().includes('semester')) {
      return `${title} Semester Exam Paper`;
    }
    if (/^unit\s*[1-5]$/i.test(title)) {
      return `${title.toUpperCase()} Lecture Notes`;
    }

    return title || 'Lecture Notes';
  },

  /**
   * Resilient offline sync that NEVER re-adds deleted files
   */
  async syncAndGetFiles() {
    let files = this.getDownloadedFiles();
    let deletedCache: string[] = [];
    try {
      deletedCache = JSON.parse(localStorage.getItem('semkit_deleted_cache') || '[]');
    } catch(e) {}

    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const res = await Filesystem.readdir({
        path: 'pdf_cache',
        directory: Directory.Data
      });

      if (res && res.files) {
        // Only query Supabase IF online with strict 2s timeout
        let dbItemsMap: Record<string, { title: string; subjectName: string }> = {};
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);

            const { createClient } = await import('@/lib/supabase/client');
            const supabase = createClient();
            const { data: dbData } = await supabase
              .from('content_items')
              .select('file_url, title, type, exam_type, exam_year, subjects(name, code)')
              .abortSignal(controller.signal);

            clearTimeout(timeoutId);

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
          } catch(dbErr) {
            // Silently ignore network abort or timeout - we are offline!
          }
        }

        // Check each disk file
        for (const diskFile of res.files) {
          const fname = typeof diskFile === 'string' ? diskFile : diskFile.name;
          if (!fname.toLowerCase().endsWith('.pdf')) continue;

          const cleanFname = decodeURIComponent(fname).trim();
          
          // If this file was deleted by user, purge it and do NOT add to metadata
          if (deletedCache.some(d => d.toLowerCase() === fname.toLowerCase() || d.toLowerCase() === cleanFname.toLowerCase())) {
            try {
              await Filesystem.deleteFile({ path: `pdf_cache/${fname}`, directory: Directory.Data });
            } catch(e) {}
            continue;
          }

          let entry = files.find((f: any) => 
            f.filename === fname || 
            f.filename === cleanFname ||
            decodeURIComponent(f.filename || '').toLowerCase() === cleanFname.toLowerCase()
          );

          const fnameKey = fname.toLowerCase();
          const cleanFnameKey = cleanFname.toLowerCase();
          let dbMatch = dbItemsMap[fnameKey] || dbItemsMap[cleanFnameKey];
          if (!dbMatch) {
            const foundKey = Object.keys(dbItemsMap).find(k => k.endsWith('/' + fnameKey) || k === fnameKey || k === cleanFnameKey);
            if (foundKey) dbMatch = dbItemsMap[foundKey];
          }

          if (dbMatch) {
            const finalTitle = dbMatch.title || entry?.title || cleanFname;
            const finalSubject = dbMatch.subjectName || entry?.subjectName || 'General Notes';
            if (entry) {
              entry.title = finalTitle;
              entry.subjectName = finalSubject;
            } else {
              entry = {
                filename: cleanFname,
                title: finalTitle,
                subjectName: finalSubject,
                sizeKb: typeof diskFile === 'object' && diskFile.size ? Math.round(diskFile.size / 1024) : 0,
                downloadedAt: Date.now()
              };
              files.push(entry);
            }
          } else {
            const resolved = this.resolveSubjectAndTitle(cleanFname, entry?.title, entry?.subjectName);
            if (entry) {
              if (!entry.subjectName || entry.subjectName === 'General Notes') {
                entry.subjectName = resolved.subjectName;
              }
              entry.title = resolved.title || entry.title;
            } else {
              entry = {
                filename: cleanFname,
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

  saveMetadata(filename: string, title: string, sizeKb?: number, subjectName?: string, isPyq?: boolean) {
    const cleanFn = decodeURIComponent(filename).trim();
    
    // Remove from deleted cache if present
    try {
      const deletedList: string[] = JSON.parse(localStorage.getItem('semkit_deleted_cache') || '[]');
      const filtered = deletedList.filter(d => d.toLowerCase() !== cleanFn.toLowerCase() && d.toLowerCase() !== filename.toLowerCase());
      localStorage.setItem('semkit_deleted_cache', JSON.stringify(filtered));
    } catch(e) {}

    const files = this.getDownloadedFiles();
    const existingIndex = files.findIndex((f: any) => 
      f.filename === filename || 
      decodeURIComponent(f.filename || '').toLowerCase() === cleanFn.toLowerCase()
    );
    
    let inferredSubject = subjectName;
    let cleanTitle = title;
    if (!inferredSubject && title && title.includes(' - ')) {
      const parts = title.split(' - ');
      inferredSubject = parts[0].trim();
      cleanTitle = parts.slice(1).join(' - ').trim();
    }

    if (!inferredSubject || inferredSubject === 'General Notes') {
      const resolved = this.resolveSubjectAndTitle(cleanFn, title, subjectName);
      inferredSubject = resolved.subjectName;
      cleanTitle = resolved.title;
    }

    const detectedPyq = isPyq !== undefined 
      ? isPyq 
      : (/pyq|question|mid|sem|20[2-3][0-9]/i.test(cleanTitle || '') || /pyq|question|mid|sem|20[2-3][0-9]/i.test(cleanFn));

    const newEntry = { 
      filename: cleanFn, 
      title: cleanTitle || title, 
      subjectName: inferredSubject || 'General Notes',
      sizeKb: sizeKb || 0, 
      isPyq: detectedPyq,
      downloadedAt: Date.now() 
    };
    
    if (existingIndex >= 0) {
      files[existingIndex] = { ...files[existingIndex], ...newEntry };
    } else {
      files.push(newEntry);
    }
    localStorage.setItem('semkit_offline_files', JSON.stringify(files));
    localStorage.setItem('ignitext_offline_files', JSON.stringify(files));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_files_changed', { detail: { filename: cleanFn, action: 'saved' } }));
      window.dispatchEvent(new Event('storage'));
    }
  },

  removeMetadata(filename: string) {
    if (!filename) return;
    const cleanFn = decodeURIComponent(filename).toLowerCase().trim();
    const rawFn = (filename || '').toLowerCase().trim();
    const files = this.getDownloadedFiles();
    const filtered = files.filter((f: any) => {
      const fName = decodeURIComponent(f.filename || '').toLowerCase().trim();
      const orig = (f.filename || '').toLowerCase().trim();
      return (
        fName !== cleanFn && 
        orig !== rawFn && 
        fName !== rawFn && 
        orig !== cleanFn &&
        !fName.endsWith('/' + cleanFn) &&
        !cleanFn.endsWith('/' + fName)
      );
    });
    localStorage.setItem('semkit_offline_files', JSON.stringify(filtered));
    localStorage.setItem('ignitext_offline_files', JSON.stringify(filtered));
  }
};

function okStatus(status: number): boolean {
  return status >= 200 && status < 300;
}
