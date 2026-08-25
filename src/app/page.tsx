'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { GridIcon, SearchIcon, AlertCircleIcon, BookIcon, HistoryIcon } from "lucide-react";
import { getRegulations, getPopularContent, getSubjects } from "@/lib/api";
import { OfflineButton } from "@/components/OfflineButton";
import { ReportButton } from "@/components/ReportButton";
import { ClientGateLink } from "@/components/ClientGateLink";

import { getUnitColor } from "@/lib/colorUtils";
import { FileTypeIcon } from "@/components/FileTypeIcon";

export default function Home() {
  const [profile, setProfile] = useState<any>(null);
  const [userSubjects, setUserSubjects] = useState<any[]>([]);
  const [regulations, setRegulations] = useState<any[]>([]);
  const [popularContent, setPopularContent] = useState<any[]>([]);
  
  useEffect(() => {
    // 1. Fetch Profile from cookie
    try {
      const match = document.cookie.match(/(?:^|; )ignitext_profile=([^;]*)/);
      if (match && match[1]) {
        const parsed = JSON.parse(decodeURIComponent(match[1]));
        setProfile(parsed);
        // Fetch subjects for this specific user
        getSubjects(parsed.reg_id, parsed.branch_id, parsed.sem).then(data => {
          setUserSubjects(data);
        });
      }
    } catch(e) {}

    // 2. Fetch standard home data
    getRegulations().then(data => setRegulations(data));
    getPopularContent().then(data => setPopularContent(data));
  }, []);

  return (
    <div className="px-[18px] pt-4 pb-8">
      <div className="flex justify-between items-start mb-0.5">
        <p className="font-bold text-[19px]">Find your notes</p>
        <Link href="/support" className="text-[10px] font-bold bg-[var(--paper-deep)] text-[var(--ink-soft)] px-2.5 py-1 rounded-full border border-[var(--rule-strong)] hover:bg-[var(--rule)] transition-colors uppercase tracking-wider">
          Feedback
        </Link>
      </div>
      <p className="text-[11.5px] text-[var(--ink-soft)] mb-3.5">
        Free • no login needed to browse
      </p>

      <Link href="/search" className="flex items-center gap-2 border-[1.5px] border-[var(--ink)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink-faint)] mb-4 bg-[var(--paper)]">
        <SearchIcon className="w-4 h-4 text-[var(--ink-soft)]" /> Search subject, unit or code
      </Link>

      {profile && userSubjects.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <BookIcon className="w-4 h-4 text-[var(--ink)]" />
            <p className="text-[12.5px] font-bold text-[var(--ink)] uppercase tracking-wide">
              Your Semester Subjects
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {userSubjects.map(sub => (
              <Link 
                key={sub.id} 
                href={`/subject?id=${sub.id}`}
                className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center hover:border-[var(--ink)] transition-colors group shadow-sm"
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="font-bold text-[14px] text-[var(--ink)] leading-tight truncate group-hover:underline">
                    {sub.name}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--ink-soft)] mt-1.5 flex gap-2">
                    <span className="bg-[var(--paper-deep)] px-1.5 py-0.5 rounded text-[var(--ink-soft)] font-semibold">{sub.code}</span>
                    <span className="flex items-center">{sub.total_content || 0} files</span>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-[var(--paper-deep)] flex items-center justify-center group-hover:bg-[var(--ink)] group-hover:text-[var(--paper)] transition-colors shrink-0">
                  <GridIcon className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {!profile && (
        <>
          <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-2 uppercase tracking-wide">
            Choose Regulation
          </p>
          <div className="flex gap-2 flex-wrap mb-3.5">
            {regulations.length > 0 ? (
              regulations.map((reg) => (
                <div 
                  key={reg.id}
                  className={`font-mono text-[11px] border-[1.5px] rounded-full px-3 py-1 cursor-pointer transition-colors ${
                    reg.code === 'R22' 
                      ? 'border-[var(--ink)] bg-[var(--hl)] text-[var(--hl-ink)] font-semibold' 
                      : 'border-[var(--rule-strong)] text-[var(--ink-soft)]'
                  }`}
                >
                  {reg.code}
                </div>
              ))
            ) : (
              <div className="text-[12px] text-[var(--ink-soft)] flex items-center gap-1.5 py-1">
                <AlertCircleIcon className="w-3.5 h-3.5" /> No regulations found in database
              </div>
            )}
          </div>

          <Link href="/browse" className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 mb-2.5 bg-[var(--paper)] flex justify-between items-center hover:bg-[var(--paper-deep)] transition-colors group">
            <div>
              <div className="font-semibold text-[13px] group-hover:text-[var(--hl-ink)] transition-colors">Continue browsing</div>
            </div>
            <GridIcon className="w-[18px] h-[18px] text-[var(--ink-soft)] group-hover:text-[var(--ink)] transition-colors" />
          </Link>
        </>
      )}

      <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-2 mt-4 uppercase tracking-wide">
        Most Downloaded This Week
      </p>
      
      <div className="flex flex-col gap-2.5">
        {popularContent.length > 0 ? (
          popularContent.map((item) => (
            <div key={item.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-3">
              <FileTypeIcon filename={item.file_url} className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center shadow-sm" />
              <ClientGateLink url={item.file_url} className="flex-1 min-w-0 block">
                <div className="font-bold text-[14px] text-[var(--ink)] leading-tight mb-1.5 truncate hover:underline">
                  {(() => {
                    if (item.type === 'note') {
                      if (item.unit_title) return item.unit_title;
                      if (item.subject_name) return `${item.subject_name} - Unit ${item.unit_number || ''}`.trim();
                      return `Unit ${item.unit_number || ''}`.trim();
                    }
                    return item.title.replace(/^null\s/, item.subject_name ? item.subject_name + ' ' : '');
                  })()}
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  {item.type === 'note' && item.unit_number && (
                    <span className={`${getUnitColor(item.unit_number)} px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-extrabold uppercase tracking-wider`}>
                      Unit {item.unit_number}
                    </span>
                  )}
                  {item.type === 'pyq' && item.exam_type && (
                    <span className="bg-[var(--ink)] text-[var(--paper)] px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-extrabold uppercase tracking-wider">
                      {item.exam_type} {item.exam_year}
                    </span>
                  )}
                  <span className="bg-[var(--paper-deep)] text-[var(--ink)] px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-extrabold uppercase tracking-wider max-w-full truncate">
                    {item.subject_name} {item.subject_code && `(${item.subject_code})`}
                  </span>
                </div>

                <div className="font-mono text-[10px] text-[var(--ink-soft)] flex items-center gap-1.5">
                  <span className="font-semibold">{item.regulation_code}</span>
                  <span>•</span>
                  <span className="font-semibold">{item.branch_code}</span>
                  <span>•</span>
                  <span>{item.download_count} DLs</span>
                </div>
              </ClientGateLink>
              <div className="flex flex-col gap-1 items-center shrink-0">
                <OfflineButton contentId={item.id} fileUrl={item.file_url} title={`${item.subject_name || 'Subject'} - ${item.title}`} />
                <ReportButton contentId={item.id} />
              </div>
            </div>
          ))
        ) : (
          <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg p-6 bg-[var(--paper)] flex flex-col items-center justify-center text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--paper-deep)] flex items-center justify-center">
              <SearchIcon className="w-5 h-5 text-[var(--ink-soft)]" />
            </div>
            <div>
              <p className="text-[13.5px] font-bold text-[var(--ink)]">Start your journey</p>
              <p className="text-[11.5px] text-[var(--ink-soft)] mt-1 max-w-[220px] mx-auto">Explore the subjects to find your notes and previous year questions.</p>
            </div>
            <Link href="/browse" className="mt-2 bg-[var(--ink)] text-[var(--paper)] text-[12px] font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Explore Subjects
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
