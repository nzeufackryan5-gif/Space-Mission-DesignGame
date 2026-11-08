import { createClient } from "@supabase/supabase-js";

/**
 * Lit et valide la configuration publique de Supabase fournie par Vite.
 * Les variables doivent être définies dans un fichier d'environnement local.
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("La variable d'environnement VITE_SUPABASE_URL est manquante.");
}

if (!supabaseAnonKey) {
  throw new Error("La variable d'environnement VITE_SUPABASE_ANON_KEY est manquante.");
}

/** Instance Supabase partagée par toute l'application. */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
