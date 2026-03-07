import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== "your-supabase-url-here" &&
  supabaseKey !== "your-supabase-anon-key-here"
);

export function createClient() {
  if (!isSupabaseConfigured) {
    return null;
  }
  return createBrowserClient(supabaseUrl!, supabaseKey!);
}
