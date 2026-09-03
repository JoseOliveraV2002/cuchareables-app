"use client";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Esto solo debería verse si faltan las variables de entorno al desplegar.
  console.warn(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Configúralas en Vercel / .env.local."
  );
}

// URL de respaldo válida (nunca se usa de verdad) solo para que la app no truene
// si faltan las variables de entorno durante el build.
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key");
