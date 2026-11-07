'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeftIcon, Loader2Icon, SaveIcon } from "lucide-react";

export default function PlatformSettings() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  
  const [settings, setSettings] = useState({
    upi_id: '',
    show_tip_jar: 'false',
    admob_banner_id: '',
    admob_interstitial_id: '',
    app_version: '1.0.0',
    maintenance_mode: 'false'
  });

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/community/login');

      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (!prof || prof.role !== 'superadmin') return router.push('/community');

      const { data: s } = await supabase.from('platform_settings').select('*');
      if (s) {
        const mapped: any = { ...settings };
        s.forEach((row: any) => {
          mapped[row.key] = row.value || '';
        });
        setSettings(mapped);
      }
      setLoading(false);
    }
    loadData();
  }, [router, supabase]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ text: '', type: '' });

    const updates = Object.entries(settings).map(([key, value]) => ({
      key,
      value: String(value)
    }));

    const { error } = await supabase.from('platform_settings').upsert(updates, { onConflict: 'key' });
    
    setSaving(false);
    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({ text: 'Settings updated successfully!', type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[var(--paper)]">
        <Loader2Icon className="w-8 h-8 animate-spin text-[var(--ink)] mb-4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--paper)] min-h-screen">
      <div className="px-[18px] py-4 border-b border-[var(--rule-strong)] bg-[var(--paper)] flex items-center shadow-sm sticky top-0 z-10">
        <Link href="/admin" className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors">
          <ChevronLeftIcon className="w-5 h-5" /> Back
        </Link>
        <div className="font-bold text-[15px] flex-1 text-center pr-6">Platform Settings</div>
      </div>

      <div className="flex-1 overflow-y-auto px-[18px] py-6">
        {message.text && (
          <div className={`p-3 rounded-lg text-[13px] font-medium mb-6 ${message.type === 'error' ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--hl)] text-[var(--ink)]'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-6">
          
          <div className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-5 bg-[var(--paper-card)] flex flex-col gap-4">
            <h2 className="font-bold text-[16px]">General</h2>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-[13px] font-semibold text-[var(--ink)]">Maintenance Mode</label>
                <p className="text-[11px] text-[var(--ink-soft)]">Restrict app access to admins only</p>
              </div>
              <input 
                type="checkbox" 
                checked={settings.maintenance_mode === 'true'}
                onChange={e => setSettings({...settings, maintenance_mode: e.target.checked ? 'true' : 'false'})}
                className="w-5 h-5 accent-[var(--ink)]" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Current App Version</label>
              <input 
                value={settings.app_version}
                onChange={e => setSettings({...settings, app_version: e.target.value})}
                type="text" 
                placeholder="e.g. 1.0.0" 
                className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" 
              />
              <p className="text-[10px] text-[var(--ink-faint)] mt-1">Users on older versions will be prompted to update.</p>
            </div>
          </div>

          <div className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-5 bg-[var(--paper-card)] flex flex-col gap-4">
            <h2 className="font-bold text-[16px]">Monetization & Tips</h2>
            
            <div className="flex items-center justify-between border-b border-[var(--rule)] pb-4">
              <div>
                <label className="block text-[13px] font-semibold text-[var(--ink)]">Show Tip Jar</label>
                <p className="text-[11px] text-[var(--ink-soft)]">Display UPI donate option on downloads</p>
              </div>
              <input 
                type="checkbox" 
                checked={settings.show_tip_jar === 'true'}
                onChange={e => setSettings({...settings, show_tip_jar: e.target.checked ? 'true' : 'false'})}
                className="w-5 h-5 accent-[var(--ink)]" 
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">UPI ID</label>
              <input 
                value={settings.upi_id}
                onChange={e => setSettings({...settings, upi_id: e.target.value})}
                type="text" 
                placeholder="e.g. name@okhdfcbank" 
                className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" 
              />
            </div>
          </div>

          <div className="border-[1.5px] border-[var(--rule-strong)] rounded-xl p-5 bg-[var(--paper-card)] flex flex-col gap-4">
            <h2 className="font-bold text-[16px]">AdMob Configuration</h2>
            
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Banner Ad Unit ID</label>
              <input 
                value={settings.admob_banner_id}
                onChange={e => setSettings({...settings, admob_banner_id: e.target.value})}
                type="text" 
                placeholder="ca-app-pub-..." 
                className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" 
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--ink-soft)] mb-1.5 uppercase">Interstitial Ad Unit ID</label>
              <input 
                value={settings.admob_interstitial_id}
                onChange={e => setSettings({...settings, admob_interstitial_id: e.target.value})}
                type="text" 
                placeholder="ca-app-pub-..." 
                className="w-full bg-[var(--paper)] border-[1.5px] border-[var(--rule-strong)] rounded-lg px-3 py-2 text-[13px] font-medium outline-none" 
              />
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn btn-p flex items-center justify-center gap-2 py-3 mt-2">
            {saving ? <Loader2Icon className="w-5 h-5 animate-spin" /> : <SaveIcon className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
