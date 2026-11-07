import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="px-[18px] pt-4 pb-12 h-full overflow-y-auto">
      <Link href="/" className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] mb-6 transition-colors">
        <ChevronLeftIcon className="w-4 h-4" /> Back to Home
      </Link>

      <h1 className="font-bold text-[22px] mb-2">Privacy Policy</h1>
      <p className="text-[12px] text-[var(--ink-soft)] mb-6">Last Updated: August 2026</p>

      <div className="space-y-6 text-[14px] leading-relaxed text-[var(--ink)]">
        <section>
          <h2 className="font-bold text-[16px] mb-2">1. Introduction</h2>
          <p>
            Welcome to IgniteXT. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we handle your information when you use our mobile application and website.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[16px] mb-2">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Device Storage:</strong> We require local storage permissions solely to save educational PDFs (notes, PYQs) directly to your device so you can access them offline.</li>
            <li><strong>Usage Data:</strong> We may collect anonymous analytics (such as download counts) to understand which study materials are most helpful to our community.</li>
            <li><strong>Student Verification:</strong> We collect your college Hall Ticket Number to verify student status before allowing access to educational materials. This is used solely to prevent unauthorized access.</li>
            <li><strong>Account Data:</strong> If you are a Community Admin, we securely store your authentication credentials (email) via our authentication provider (Supabase).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold text-[16px] mb-2">3. How We Use Your Information</h2>
          <p>
            The information we collect is used exclusively to provide and improve the IgniteXT educational platform. We do not sell, rent, or share your personal data with third-party advertisers. Local storage access is used strictly for caching the files you explicitly choose to download.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[16px] mb-2">4. Third-Party Services</h2>
          <p>
            Our app utilizes secure third-party services including Cloudflare R2 (for file hosting) and Supabase (for database and authentication). These services operate under their own strict privacy policies and data protection standards.
          </p>
        </section>

        <section>
          <h2 className="font-bold text-[16px] mb-2">5. Contact Us</h2>
          <p>
            If you have any questions or concerns about this Privacy Policy or our data practices, please contact the developer team at:<br/>
            <strong>Email:</strong> <a href="mailto:bigguysolution@gmail.com" className="text-[var(--hl-ink)] underline">bigguysolution@gmail.com</a>
          </p>
        </section>
      </div>
    </div>
  );
}
