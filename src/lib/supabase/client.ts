import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let supabaseInstance: any = null;

const DEFAULT_SUPABASE_URL = 'https://ffmioulgyhpsqxodfths.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmbWlvdWxneWhwc3F4b2RmdGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDIzNjcsImV4cCI6MjEwMjE3ODM2N30.0bK1FnUmo7W1YURXQpJ1kAA1pBmGzPm0bSQLKYI7So0';

export function createClient() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

    supabaseInstance = createSupabaseClient(
      url,
      key,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== 'undefined' ? window.localStorage : undefined
        }
      }
    );
  }
  return supabaseInstance;
}
