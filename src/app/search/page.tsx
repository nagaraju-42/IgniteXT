'use client';

import { useState, useEffect } from "react";
import { SearchIcon, BookIcon, FileTextIcon, HistoryIcon, ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { OfflineManager } from "@/lib/offlineManager";
import { requireStudentAccess } from "@/components/StudentGate";

export default function Search() {
  const [query, setQuery] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [offlineFiles, setOfflineFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const { data } = await supabase.from('subjects').select('id, name, code, regulation_code').order('name');
      if (data) setSubjects(data);
      
      const downloaded = OfflineManager.getDownloadedFiles();
      setOfflineFiles(downloaded || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const generateAbbr = (name: string) => {
    // e.g. "Big Data" -> "BD", "Database Management Systems" -> "DBMS"
    return name.split(/[\s-]+/).map(w => w[0]).join('').toUpperCase();
  };

  const q = query.trim().toLowerCase();
  const isAbbrSearch = q.length >= 2 && q.length <= 5; // e.g. "BD", "DBMS"

  // Filter Online Subjects
  const filteredSubjects = query ? subjects.filter(sub => {
    const nameMatch = sub.name.toLowerCase().includes(q);
    const codeMatch = sub.code && sub.code.toLowerCase().includes(q);
    const abbrMatch = isAbbrSearch && generateAbbr(sub.name).includes(q.toUpperCase());
    return nameMatch || codeMatch || abbrMatch;
  }).slice(0, 5) : [];

  // Filter Offline Files
  const filteredOffline = query ? offlineFiles.filter(file => {
    const cleanTitle = file.title.replace(/^null\s/, '').replace(/^null - /, '');
    const titleMatch = cleanTitle.toLowerCase().includes(q);
    
    // Attempt abbreviation on the subject part of the title
    const subjectPart = cleanTitle.split(' - ')[0];
    const abbrMatch = isAbbrSearch && generateAbbr(subjectPart).includes(q.toUpperCase());
    
    return titleMatch || abbrMatch;
  }).slice(0, 5) : [];

  const handleOpenOffline = async (filename: string) => {
    requireStudentAccess(async () => {
      const success = await OfflineManager.openNativeFile(filename);
      if (!success) {
        alert('Could not open offline file.');
      }
    });
  };

  return (
    <div className="px-[18px] pt-4 pb-8 h-full flex flex-col">
      <div className="flex items-center gap-2 border-[1.5px] border-[var(--ink)] rounded-lg px-3 py-2.5 bg-[var(--paper)] mb-6 shadow-sm">
        <SearchIcon className="w-4 h-4 text-[var(--ink)]" />
        <input 
          autoFocus
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search subject (e.g. BD, DBMS)..." 
          className="bg-transparent border-none outline-none flex-1 text-[13px] font-medium placeholder:text-[var(--ink-faint)]"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {!query && (
          <div>
            <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-3 uppercase tracking-wide">
              Quick Suggestions
            </p>
            <div className="flex flex-col gap-3">
              {['BD', 'DBMS', 'OS', 'CN'].map((item, i) => (
                <div key={i} onClick={() => setQuery(item)} className="flex items-center gap-3 text-[13px] font-bold text-[var(--ink-soft)] cursor-pointer hover:text-[var(--ink)] p-2 rounded-lg hover:bg-[var(--paper-deep)] transition-colors">
                  <HistoryIcon className="w-4 h-4 opacity-70" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {query && loading && <div className="text-[12px] text-[var(--ink-soft)] text-center py-4">Searching...</div>}

        {query && !loading && (
          <div className="flex flex-col gap-6">
            
            {/* ONLINE SUBJECT MATCHES */}
            {filteredSubjects.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-3 uppercase tracking-wide">
                  Online Subjects
                </p>
                <div className="flex flex-col gap-2">
                  {filteredSubjects.map((sub, i) => (
                    <Link href={`/subject?id=${sub.id}`} key={i} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center hover:bg-[var(--paper-deep)] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-[var(--paper-deep)] flex items-center justify-center shrink-0">
                          <BookIcon className="w-4 h-4 text-[var(--ink)]" />
                        </div>
                        <div>
                          <div className="font-bold text-[13.5px] text-[var(--ink)]">{sub.name}</div>
                          <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-0.5">
                            {sub.code} • {sub.regulation_code}
                          </div>
                        </div>
                      </div>
                      <ArrowRightIcon className="w-4 h-4 text-[var(--ink-soft)]" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* OFFLINE FILE MATCHES */}
            {filteredOffline.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-3 uppercase tracking-wide">
                  Saved Offline Notes
                </p>
                <div className="flex flex-col gap-2">
                  {filteredOffline.map((file, i) => {
                    const cleanTitle = file.title.replace(/^null\s/, '').replace(/^null - /, '');
                    const titleParts = cleanTitle.split(' - ');
                    const displaySubject = titleParts.length > 1 ? titleParts[0] : 'Document';
                    const displayUnit = titleParts.length > 1 ? titleParts.slice(1).join(' - ') : titleParts[0];

                    return (
                      <div 
                        key={i} 
                        onClick={() => handleOpenOffline(file.filename)}
                        className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center cursor-pointer hover:bg-[var(--paper-deep)] transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded bg-[var(--red-bg)] text-[var(--red)] flex items-center justify-center shrink-0">
                            <FileTextIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[13.5px] text-[var(--ink)] truncate">{displaySubject}</div>
                            <div className="font-semibold text-[11px] text-[var(--ink-soft)] truncate mt-0.5">{displayUnit}</div>
                          </div>
                        </div>
                        <span className="font-mono text-[9px] font-bold bg-[var(--hl)] text-[var(--ink)] px-2 py-1 rounded">OFFLINE</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredSubjects.length === 0 && filteredOffline.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[14px] font-bold text-[var(--ink)]">No results found</p>
                <p className="text-[12px] text-[var(--ink-soft)] mt-1">Try searching for a different shortcut.</p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
