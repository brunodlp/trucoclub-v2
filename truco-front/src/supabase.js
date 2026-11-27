import { createClient } from "@supabase/supabase-js";

// Proyecto de Supabase. La clave "publishable" es pública a propósito (va en el navegador):
// sola no permite leer nada, porque las tablas del juego están en un esquema cerrado y
// todo pasa por el backend.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://wnywcpoplqzsdanywgdg.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_LOEUpDf5YcZ5nuFa5ZEbkg_0oSuvzBn";

// supabase-js guarda la sesión en el navegador y renueva el token solo antes de que venza.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
