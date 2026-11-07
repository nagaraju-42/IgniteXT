'use client';

import { useState, useEffect } from "react";
import { SearchIcon, FileTextIcon, BookIcon, AlertCircleIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { OfflineManager } from "@/lib/offlineManager";

export default function Search() {
  const [query, setQuery] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [offlineFiles, setOfflineFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('subjects').select('id, name, code, is_active').eq('is_active', true);
      if (data) setSubjects(data);
      
      const downloaded = await OfflineManager.getDownloadedFiles();
      setOfflineFiles(downloaded);
      
      setLoading(false);
    };
    fetchData();
  }, []);

  const getAbbreviation = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toLowerCase();
  };

  const searchTerm = query.toLowerCase().trim();

  // Filter Online Subjects
  const filteredSubjects = searchTerm ? subjects.filter((subject) => {
    const nameMatch = subject.name?.toLowerCase().includes(searchTerm);
    const codeMatch = subject.code?.toLowerCase().includes(searchTerm);
    const abbrMatch = subject.name ? getAbbreviation(subject.name).includes(searchTerm) : false;
    
    return nameMatch || codeMatch || abbrMatch;
  }).slice(0, 5) : [];

  // Filter Offline Files
  const filteredOffline = searchTerm ? offlineFiles.filter((file) => {
    return file.title.toLowerCase().includes(searchTerm);
  }).slice(0, 5) : [];

  const handleOpenOffline = async (contentId: string, fileUrl: string) => {
    const success = await OfflineManager.openNativeFile(contentId, fileUrl);
    if (!success) {
      alert('Could not open offline file.');
    }
  };

  return (
    <div className="px-[18px] pt-4 pb-8 h-full flex flex-col bg-[var(--paper)]">
      <div className="flex items-center gap-2 border-[1.5px] border-[var(--ink)] rounded-lg px-3 py-2.5 bg-[var(--paper)] mb-6 shadow-sm">
        <Link href="/browse" className="-ml-1 mr-1">
          <ChevronLeftIcon className="w-5 h-5 text-[var(--ink-soft)]" />
        </Link>
        <SearchIcon className="w-4 h-4 text-[var(--ink-soft)]" />
        <input
          type="text"
          autoFocus
          placeholder="Search subject (e.g. Big Data), code, or abbreviation (e.g. BD)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-[13.5px] font-medium outline-none placeholder:text-[var(--ink-faint)]"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-[12px] text-[var(--ink-soft)] mt-4">Searching...</div>
        ) : !searchTerm ? (
          <div className="flex flex-col items-center justify-center h-40 text-center opacity-50">
            <SearchIcon className="w-8 h-8 mb-3 text-[var(--ink-soft)]" />
            <p className="text-[13px] font-semibold text-[var(--ink)]">Type to start searching</p>
            <p className="text-[11px] text-[var(--ink-soft)] mt-1 max-w-[200px]">You can search by subject name, code, or just initials.</p>
          </div>
        ) : filteredSubjects.length === 0 && filteredOffline.length === 0 ? (
          <div className="text-center text-[12px] text-[var(--ink-soft)] mt-4 flex flex-col items-center">
            <AlertCircleIcon className="w-6 h-6 mb-2 opacity-50" />
            No matches found for "{query}"
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Online Subjects Results */}
            {filteredSubjects.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <BookIcon className="w-3.5 h-3.5" /> Subjects
                </h3>
                <div className="flex flex-col gap-2">
                  {filteredSubjects.map((subject) => (
                    <Link
                      key={subject.id}
                      href={`/subject?id=${subject.id}`}
                      className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper-card)] flex flex-col hover:border-[var(--ink)] transition-colors group shadow-sm"
                    >
                      <span className="font-bold text-[14px] text-[var(--ink)] group-hover:underline truncate">{subject.name}</span>
                      <span className="font-mono text-[10px] text-[var(--ink-soft)] mt-1 bg-[var(--paper-deep)] self-start px-1.5 py-0.5 rounded font-semibold">{subject.code}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Offline Files Results */}
            {filteredOffline.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold text-[var(--ink-soft)] uppercase tracking-wider mb-2 flex items-center gap-1.5 mt-2">
                  <FileTextIcon className="w-3.5 h-3.5" /> Offline Files
                </h3>
                <div className="flex flex-col gap-2">
                  {filteredOffline.map((file, i) => (
                    <div
                      key={i}
                      onClick={() => handleOpenOffline(file.contentId, file.fileUrl)}
                      className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper-card)] flex items-center gap-3 cursor-pointer hover:border-[var(--ink)] transition-colors group shadow-sm"
                    >
                      <div className="w-8 h-8 rounded bg-[var(--hl)] text-[var(--hl-ink)] flex items-center justify-center shrink-0">
                        <FileTextIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[13px] text-[var(--ink)] truncate group-hover:underline">{file.title}</div>
                        <div className="font-mono text-[9px] text-[var(--ink-soft)] mt-1 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Available Offline
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
