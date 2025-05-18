import { createPagesBrowserClient } from "@supabase/auth-helpers-nextjs"
import { createServerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"

// Use this function in client components
export const getSupabaseBrowserClient = () => {
  return createPagesBrowserClient()
}

// Use this function in server components
export const getSupabaseServerClient = () => {
  const cookieStore = cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options })
      },
      remove(name: string, options: any) {
        cookieStore.delete({ name, ...options })
      },
    },
  })
}
