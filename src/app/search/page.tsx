import { SearchIcon, HistoryIcon } from "lucide-react";
import Link from "next/link";

export default function Search() {
  return (
    <div className="px-[18px] pt-4 pb-8 h-full flex flex-col">
      <div className="flex items-center gap-2 border-[1.5px] border-[var(--ink)] rounded-lg px-3 py-2.5 bg-[var(--paper)] mb-6">
        <SearchIcon className="w-4 h-4 text-[var(--ink)]" />
        <input 
          autoFocus
          type="text" 
          placeholder="Search subject, unit or code..." 
          className="bg-transparent border-none outline-none flex-1 text-[13px] font-medium placeholder:text-[var(--ink-faint)]"
        />
      </div>

      <div className="flex-1">
        <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-3 uppercase tracking-wide">
          Recent Searches
        </p>
        <div className="flex flex-col gap-3">
          {['DBMS Unit 4', 'Operating Systems', 'R22 CS302'].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-[13px] text-[var(--ink-soft)]">
              <HistoryIcon className="w-4 h-4 opacity-70" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
