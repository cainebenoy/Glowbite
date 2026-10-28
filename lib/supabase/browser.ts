// Browser client for the admin login page only (sends the magic link). Holds the anon key,
// which cannot read leads: leads have RLS with no policies.
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

export const createBrowserSupabase = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
