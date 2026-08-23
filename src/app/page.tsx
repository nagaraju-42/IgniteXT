import Link from "next/link";
import { DownloadIcon, GridIcon, SearchIcon, AlertCircleIcon } from "lucide-react";
import { getRegulations, getPopularContent } from "@/lib/api";
import { OfflineButton } from "@/components/OfflineButton";
import { ReportButton } from "@/components/ReportButton";

// This is a Server Component, meaning this fetches data securely on the server
// before rendering the HTML for the mobile wrapper
export default async function Home() {
  const regulations = await getRegulations();
  const popularContent = await getPopularContent();

  return (
    <div className="px-[18px] pt-4 pb-8">
      <div className="flex justify-between items-start mb-0.5">
        <p className="font-bold text-[19px]">Find your notes</p>
        <Link href="/support" className="text-[10px] font-bold bg-[var(--paper-deep)] text-[var(--ink-soft)] px-2.5 py-1 rounded-full border border-[var(--rule-strong)] hover:bg-[var(--rule)] transition-colors uppercase tracking-wider">
          Feedback
        </Link>
      </div>
      <p className="text-[11.5px] text-[var(--ink-soft)] mb-3.5">
        Free · no login needed to browse
      </p>

      <Link href="/search" className="flex items-center gap-2 border-[1.5px] border-[var(--ink)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--ink-faint)] mb-4 bg-[var(--paper)]">
        <SearchIcon className="w-4 h-4 text-[var(--ink-soft)]" /> Search subject, unit or code
      </Link>

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

      <p className="text-[11px] font-semibold text-[var(--ink-soft)] mb-2 mt-4 uppercase tracking-wide">
        Most Downloaded This Week
      </p>
      
      <div className="flex flex-col gap-2.5">
        {popularContent.length > 0 ? (
          popularContent.map((item) => (
            <div key={item.id} className="border-[1.5px] border-[var(--rule-strong)] rounded-lg p-3 bg-[var(--paper)] flex justify-between items-center gap-2.5">
              <Link href={`/read?url=${encodeURIComponent(item.file_url)}&title=${encodeURIComponent(item.title)}`} className="flex-1 pr-2 block">
                <div className="font-bold text-[14px] text-[var(--ink)] leading-tight mb-1.5 line-clamp-2 hover:underline">
                  {(() => {
                    if (item.type === 'note') {
                      if (item.unit_title) return item.unit_title;
                      if (item.subject_name) return `${item.subject_name} - Unit ${item.unit_number || ''}`.trim();
                      return `Unit ${item.unit_number || ''}`.trim();
                    }
                    // For PYQs or other types, just clean up "null " if it slipped into the DB
                    return item.title.replace(/^null\s/, item.subject_name ? item.subject_name + ' ' : '');
                  })()}
                </div>
                
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {item.type === 'note' && item.unit_number && (
                    <span className="bg-[var(--hl)] text-[var(--ink)] px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-extrabold uppercase tracking-wider">
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
                  <span>·</span>
                  <span className="font-semibold">{item.branch_code}</span>
                  <span>·</span>
                  <span>{item.download_count} DLs</span>
                </div>
              </Link>
              <div className="flex flex-col gap-1 items-center shrink-0">
                <OfflineButton contentId={item.id} fileUrl={item.file_url} title={item.title} />
                <ReportButton contentId={item.id} />
              </div>
            </div>
          ))
        ) : (
          <div className="border-[1.5px] border-dashed border-[var(--rule-strong)] rounded-lg p-4 bg-[var(--paper)] flex flex-col items-center justify-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[var(--paper-deep)] flex items-center justify-center">
              <AlertCircleIcon className="w-4 h-4 text-[var(--ink-soft)]" />
            </div>
            <p className="text-[12.5px] font-medium text-[var(--ink-soft)]">No content available yet</p>
            <p className="text-[11px] text-[var(--ink-faint)] max-w-[200px]">Check back later when community admins upload notes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
