import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && anon ? createClient(url, anon) : null;

function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Crie o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (veja o README)."
    );
  }
  return supabase;
}

/**
 * Mesma interface do window.storage dos artifacts do Claude:
 *  - shared = true  → dados do time, salvos no Supabase (todos veem)
 *  - shared = false → dados do dispositivo (sessão de login), salvos no localStorage
 */
export const storage = {
  async get(key, shared = false) {
    if (!shared) {
      const v = localStorage.getItem(key);
      return v === null ? null : { key, value: v, shared };
    }
    const sb = requireSupabase();
    const { data, error } = await sb.from("storage").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data ? { key, value: data.value, shared } : null;
  },

  async set(key, value, shared = false) {
    if (!shared) {
      localStorage.setItem(key, value);
      return { key, value, shared };
    }
    const sb = requireSupabase();
    const { error } = await sb.from("storage").upsert({ key, value });
    if (error) throw error;
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    if (!shared) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared };
    }
    const sb = requireSupabase();
    const { error } = await sb.from("storage").delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true, shared };
  },
};
