import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }
  // Usa service_role key per bypassare RLS (solo lato server)
  return createSupabaseClient(supabaseUrl, supabaseServiceKey);
}
