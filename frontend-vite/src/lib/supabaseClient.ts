// src/lib/supabaseClient.ts

import { createClient } from "@supabase/supabase-js";

// Vite automatically reads variables prefixed with VITE_ from your .env file.
// Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env at your project root.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
