// Info: Singleton client for Supabase (auth only)
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { SupabaseClient } from "@supabase/supabase-js"

// Singleton instance
let supabaseClient: SupabaseClient | null = null

// Use this function in client components
export const getSupabaseBrowserClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClientComponentClient()
  }
  return supabaseClient
}
