'use client';

import { useState, useEffect, useMemo } from "react";
import { SearchIcon, BookIcon, AlertCircleIcon, ChevronLeftIcon, ChevronRightIcon, GridIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deriveSubjectShortCode } from "@/lib/subjectNaming";

import { Suspense } from "react";
import { useIsNativeApp } from "@/lib/useIsNativeApp";
import { WebSearch } from "@/components/web/WebSearch";

export default function Search() {
  const nativeMode = useIsNativeApp();
  return nativeMode ? (
    <ApkSearch />
  ) : (
    <Suspense fallback={<div className="p-12 text-center text-[var(--ink-soft)]">Loading search...</div>}>
      <WebSearch />
    </Suspense>
  );
}

function ApkSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubjects = async () => {
      const supabase = createClient();
      let loaded: any[] = [];
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, code, semester, total_units, branches(code), regulations(code)')
        .eq('is_active', true);
      
      if (data && data.length > 0) {
        loaded = data;
      } else {
        const { data: basic } = await supabase
          .from('subjects')
          .select('id, name, code, semester, total_units')
          .eq('is_active', true);
        loaded = basic || [];
      }
      setSubjects(loaded);
      setLoading(false);
    };
    fetchSubjects();
  }, []);

  const searchTerm = query.toLowerCase().trim();

  // Instant 0ms Client-Side Filtering by short_name, name, code, and keywords
  const filteredSubjects = useMemo(() => {
    if (!searchTerm) return [];

    return subjects.filter((subject) => {
      const name = (subject.name || '').toLowerCase();
      const code = (subject.code || '').toLowerCase();
      const derivedShort = deriveSubjectShortCode(subject.name, subject.short_name).toLowerCase();
      const rawShort = (subject.short_name || '').toLowerCase();
      const keywords = (subject.keywords || '').toLowerCase();

      // Quick keyword checks for common syllabus searches
      const isCryptoMatch = (searchTerm === 'crypto' || searchTerm === 'cis') && 
        (name.includes('cryptography') || code.includes('a57055'));
      const isDsvMatch = searchTerm === 'dsv' && name.includes('data science');
      const isFbtMatch = (searchTerm === 'fbt' || searchTerm === 'blockchain') && 
        (name.includes('blockchain') || code.includes('a57065'));
      const isFccMatch = (searchTerm === 'fcc' || searchTerm === 'cloud') && 
        (name.includes('cloud') || code.includes('a57060'));

      return (
        name.includes(searchTerm) ||
        code.includes(searchTerm) ||
        derivedShort.includes(searchTerm) ||
        rawShort.includes(searchTerm) ||
        keywords.includes(searchTerm) ||
        isCryptoMatch ||
        isDsvMatch ||
        isFbtMatch ||
        isFccMatch
      );
    });
  }, [subjects, searchTerm]);

  return (
    <div className="px-[18px] pt-4 pb-12 h-full flex flex-col bg-[var(--paper)]">
      {/* Top Search Input Bar */}
      <div className="flex items-center gap-2 border-[2px] border-[var(--ink)] rounded-2xl px-3.5 py-3 bg-[var(--paper-card)] mb-5 shadow-[3px_3px_0_var(--ink)]">
        <button 
          onClick={() => router.back()} 
          type="button" 
          aria-label="Back" 
          className="p-1 -ml-1 text-[var(--ink)] cursor-pointer"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>
        <SearchIcon className="w-4 h-4 text-[var(--ink-soft)] shrink-0" />
        <input
          type="text"
          autoFocus
          placeholder="Search subject (e.g. CIS, A57055, Crypto, DSV)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 bg-transparent text-[14px] font-bold text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] placeholder:font-normal"
        />
        {query && (
          <button 
            onClick={() => setQuery('')}
            className="text-[11px] font-mono bg-[var(--paper-deep)] border border-[var(--rule-strong)] px-2 py-0.5 rounded-full text-[var(--ink-soft)]"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="text-center text-[12px] text-[var(--ink-soft)] mt-6">Loading subjects index...</div>
        ) : !searchTerm ? (
          <div className="flex flex-col items-center justify-center py-12 text-center opacity-70">
            <div className="w-12 h-12 rounded-2xl bg-[#D7E600]/30 border border-[var(--ink)] flex items-center justify-center mb-3 text-[var(--ink)] shadow-[2px_2px_0_var(--ink)]">
              <BookIcon className="w-6 h-6" />
            </div>
            <p className="text-[14px] font-bold text-[var(--ink)]">Search Subjects & Acronyms</p>
            <p className="text-[12px] text-[var(--ink-soft)] mt-1 max-w-[260px] leading-relaxed">
              Type short codes like <strong>CIS</strong>, <strong>DSV</strong>, <strong>FBT</strong>, subject codes like <strong>A57055</strong>, or keywords like <strong>crypto</strong>.
            </p>
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="text-center text-[13px] text-[var(--ink-soft)] py-10 flex flex-col items-center">
            <AlertCircleIcon className="w-8 h-8 mb-2 opacity-50" />
            <span>No subject found matching "{query}"</span>
            <span className="text-[11px] text-[var(--ink-faint)] mt-1">Try searching by branch or full subject name.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--ink-soft)] px-1">
              Found {filteredSubjects.length} {filteredSubjects.length === 1 ? 'Subject' : 'Subjects'}
            </div>

            {/* ONLY SUBJECT CARDS DISPLAYED (No Individual PDFs!) */}
            {filteredSubjects.map((subject) => {
              const shortCode = deriveSubjectShortCode(subject.name, subject.short_name);

              return (
                <Link
                  key={subject.id}
                  href={`/subject?id=${subject.id}`}
                  className="border-[2px] border-[var(--ink)] rounded-2xl p-4 bg-[var(--paper-card)] shadow-[3px_3px_0_var(--ink)] flex items-center justify-between gap-3 active:scale-[0.99] transition-all hover:bg-[var(--paper-deep)] group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-[11px] font-black bg-[#D7E600] text-[var(--ink)] px-2.5 py-0.5 rounded-md border border-[var(--ink)] shadow-xs">
                        {shortCode}
                      </span>
                      {subject.code && (
                        <span className="font-mono text-[10px] font-bold bg-[var(--paper-deep)] text-[var(--ink)] px-2 py-0.5 rounded border border-[var(--rule-strong)]">
                          {subject.code}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                        Sem {subject.semester || 1}
                      </span>
                    </div>

                    <h2 className="font-bold text-[15px] text-[var(--ink)] leading-snug line-clamp-1 group-hover:underline">
                      {subject.name}
                    </h2>

                    <div className="font-mono text-[11px] text-[var(--ink-soft)] mt-1">
                      {subject.total_units || 5} units available
                    </div>
                  </div>

                  <div className="w-9 h-9 rounded-xl bg-[var(--paper)] border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0 text-[var(--ink)] shadow-[2px_2px_0_var(--ink)] group-hover:bg-[var(--ink)] group-hover:text-[var(--paper)] transition-colors">
                    <ChevronRightIcon className="w-5 h-5" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
