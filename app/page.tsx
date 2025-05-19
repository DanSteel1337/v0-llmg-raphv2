"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function checkSession() {
      const supabase = getSupabaseBrowserClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        router.push("/dashboard")
      } else {
        router.push("/login")
      }
    }

    checkSession()
  }, [router])

  // Return empty div - this won't be rendered as we're redirecting
  return <div></div>
}
