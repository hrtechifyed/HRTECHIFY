import { CONFIG } from "./config.js";

let clientPromise = null;

export function supabaseConfigured() {
  return Boolean(CONFIG.supabaseUrl && CONFIG.supabasePublishableKey);
}

export async function getSupabase() {
  if (!supabaseConfigured()) return null;
  if (!clientPromise) {
    clientPromise = import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm")
      .then(({ createClient }) => createClient(CONFIG.supabaseUrl, CONFIG.supabasePublishableKey));
  }
  return clientPromise;
}

export async function currentUser() {
  const sb = await getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user || null;
}
