'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  SearchIcon,
  BookIcon,
  FileTextIcon,
  ChevronRightIcon,
  AlertCircleIcon,
  EyeIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { deriveSubjectShortCode } from '@/lib/subjectNaming';

export function WebSearch() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const initialQuery = searchParams.get('q') || '';
  const [query, setQuery] = useState<string>(initialQuery);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null && qParam !== query) {
      setQuery(qParam);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadSearchIndex() {
      setLoading(true);
      const [{ data: subData }, { data: matData }] = await Promise.all([
        supabase
          .from('subjects')
          .select('id, name, code, semester, total_units')
          .eq('is_active', true),
        supabase
          .from('content_items')
          .select('id, title, type, unit_number, unit_title, file_url, file_size_kb, subject_id, subjects(name, code, semester)')
          .eq('status', 'published')
          .limit(300),
      ]);

      setSubjects(subData || []);
      setMaterials(matData || []);
      setLoading(false);
    }

    loadSearchIndex();
  }, []);

  const searchTerm = query.toLowerCase().trim();

  const filteredSubjects = useMemo(() => {
    if (!searchTerm) return [];
    return subjects.filter((subject) => {
      const name = (subject.name || '').toLowerCase();
      const code = (subject.code || '').toLowerCase();
      const short = deriveSubjectShortCode(subject.name, subject.code).toLowerCase();
      return name.includes(searchTerm) || code.includes(searchTerm) || short.includes(searchTerm);
    });
  }, [subjects, searchTerm]);

  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return [];
    return materials
      .filter((item) => {
        const title = (item.title || '').toLowerCase();
        const unitTitle = (item.unit_title || '').toLowerCase();
        const subName = (item.subjects?.name || '').toLowerCase();
        const subCode = (item.subjects?.code || '').toLowerCase();
        return (
          title.includes(searchTerm) ||
          unitTitle.includes(searchTerm) ||
          subName.includes(searchTerm) ||
          subCode.includes(searchTerm)
        );
      })
      .slice(0, 24);
  }, [materials, searchTerm]);

  const handleSearchChange = (val: string) => {
    setQuery(val);
    try {
      const url = new URL(window.location.href);
      if (val.trim()) url.searchParams.set('q', val);
      else url.searchParams.delete('q');
      window.history.replaceState({}, '', url.toString());
    } catch {
      // Ignore history failure
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display font-black text-[30px] sm:text-[36px] text-[var(--ink)] leading-none mb-3">
          SEARCH NOTES, SUBJECTS & PYQS
        </h1>

        <div className="flex items-center gap-3 border-2 border-[var(--ink)] rounded-2xl px-4 py-3 bg-[#FAF9F5] shadow-[4px_4px_0_var(--ink)]">
          <SearchIcon className="w-5 h-5 text-[var(--ink-soft)] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Type subject code (CIS, WT, OS, ML, BD), topic, IMP, or PYQ..."
            className="flex-1 bg-transparent text-[15px] font-bold text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] placeholder:font-normal"
          />
          {query && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="font-mono text-[11px] font-bold bg-[var(--paper-deep)] hover:bg-[#D7E600] border border-[var(--ink)] px-3 py-1 rounded-full cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[13px] font-bold text-[var(--ink-soft)]">
          Loading subjects & materials index...
        </div>
      ) : !searchTerm ? (
        <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-12 text-center bg-[var(--paper-card)]">
          <BookIcon className="w-10 h-10 mx-auto mb-3 text-[var(--ink)]" />
          <p className="font-bold text-[15px] text-[var(--ink)]">Start typing to search across all PDFs</p>
          <p className="text-[12.5px] text-[var(--ink-soft)] mt-1 mb-4">
            Try acronyms like <strong>CIS</strong>, <strong>WT</strong>, <strong>OS</strong>, <strong>ML</strong>, or keywords like <strong>PYQ</strong>, <strong>IMP</strong>, <strong>Mid Topics</strong>.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['CIS', 'WT', 'OS', 'CN', 'ML', 'PYQ', 'IMP'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleSearchChange(tag)}
                className="font-mono text-[11.5px] font-bold bg-[var(--paper)] hover:bg-[#D7E600] border border-[var(--ink)] px-3 py-1 rounded-full cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : filteredSubjects.length === 0 && filteredMaterials.length === 0 ? (
        <div className="border-2 border-dashed border-[var(--rule-strong)] rounded-2xl p-12 text-center bg-[var(--paper-card)]">
          <AlertCircleIcon className="w-10 h-10 mx-auto mb-2 text-[var(--ink-faint)]" />
          <p className="font-bold text-[15px] text-[var(--ink)]">
            No matching subjects or notes found for "{query}"
          </p>
          <p className="text-[12.5px] text-[var(--ink-soft)] mt-1">
            Try checking the spelling or browse subjects by semester.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Matching Subjects */}
          {filteredSubjects.length > 0 && (
            <section>
              <h2 className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-3">
                Matching Subjects ({filteredSubjects.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredSubjects.map((subject) => {
                  const shortCode = deriveSubjectShortCode(subject.name, subject.code);
                  return (
                    <Link
                      key={subject.id}
                      href={`/subject?id=${subject.id}`}
                      className="border-2 border-[var(--ink)] rounded-2xl p-4 bg-[#FAF9F5] shadow-[3px_3px_0_var(--ink)] hover:bg-white flex items-center justify-between gap-3 group transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10.5px] font-black bg-[#D7E600] border border-[var(--ink)] px-2 py-0.5 rounded">
                            {shortCode}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--ink-soft)]">
                            Sem {subject.semester}
                          </span>
                        </div>
                        <div className="font-bold text-[15px] text-[var(--ink)] truncate group-hover:underline">
                          {subject.name}
                        </div>
                      </div>
                      <ChevronRightIcon className="w-5 h-5 text-[var(--ink)] shrink-0" />
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Direct Matching PDFs */}
          {filteredMaterials.length > 0 && (
            <section>
              <h2 className="font-mono text-[11.5px] font-bold uppercase tracking-wider text-[var(--ink-soft)] mb-3">
                Direct PDFs & Papers ({filteredMaterials.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredMaterials.map((item) => {
                  const sizeMb = item.file_size_kb ? (item.file_size_kb / 1024).toFixed(1) : '1.0';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        router.push(`/subject?id=${item.subject_id}&doc=${encodeURIComponent(item.id)}`)
                      }
                      className="text-left border-2 border-[var(--ink)] rounded-2xl p-3.5 bg-[#FAF9F5] hover:bg-[#D7E600]/25 shadow-[2px_2px_0_var(--ink)] flex items-center justify-between gap-3 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#D7E600] border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0">
                          <FileTextIcon className="w-5 h-5 text-[var(--ink)]" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-[13.5px] text-[var(--ink)] truncate">
                            {item.title}
                          </div>
                          <div className="font-mono text-[10.5px] text-[var(--ink-soft)] truncate">
                            {item.subjects?.name || 'Subject'} · {item.type.toUpperCase()} · {sizeMb} MB
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-[10.5px] font-bold bg-[var(--ink)] text-[#D7E600] px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                        <EyeIcon className="w-3 h-3" /> Preview
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
