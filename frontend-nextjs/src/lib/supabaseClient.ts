// src/lib/supabaseClient.ts

import { createClient } from "@supabase/supabase-js";

// Next.js automatically reads variables prefixed with NEXT_PUBLIC_ from your .env.local file.
// Make sure you have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local at your project root.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
