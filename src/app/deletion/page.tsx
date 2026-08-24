import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

export default function DataDeletion() {
  return (
    <div className="px-[18px] pt-4 pb-12 h-full overflow-y-auto">
      <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] mb-6 transition-colors">
        <ChevronLeftIcon className="w-4 h-4" /> Back to Home
      </Link>

      <h1 className="font-bold text-[22px] mb-2">Data Deletion Instructions</h1>
      <p className="text-[12px] text-[var(--ink-soft)] mb-6">IgniteXT Privacy & Security</p>

      <div className="space-y-6 text-[14px] leading-relaxed text-[var(--ink)]">
        <section>
          <h2 className="font-bold text-[16px] mb-2">How to Request Data Deletion</h2>
          <p className="mb-3">
            If you would like to request the complete deletion of your data (including your College Hall Ticket Number and any associated analytics from our systems), please follow these simple steps:
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Send an email to <a href="mailto:bigguysolution@gmail.com" className="text-[var(--hl-ink)] underline font-medium">bigguysolution@gmail.com</a>.</li>
            <li>Use the exact subject line: <strong>"Data Deletion Request - IgniteXT"</strong>.</li>
            <li>In the body of the email, please include the exact Hall Ticket Number you used to access the app.</li>
          </ol>
        </section>

        <section>
          <h2 className="font-bold text-[16px] mb-2">What Data is Deleted?</h2>
          <p>
            Upon receiving your verified request, our developer team will permanently purge your Hall Ticket Number and any associated usage records from our secure database within 7 to 14 business days. Absolutely no personal data will be kept or retained after the deletion process is complete.
          </p>
        </section>
      </div>
    </div>
  );
}
