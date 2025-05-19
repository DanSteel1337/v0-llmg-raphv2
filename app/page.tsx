"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-client"

export default function Home() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkSession() {
      try {
        const supabase = getSupabaseBrowserClient()
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("Error checking session:", error)
          router.push("/login")
          return
        }

        if (session) {
          router.push("/dashboard")
        } else {
          router.push("/login")
        }
      } catch (err) {
        console.error("Unexpected error checking session:", err)
        router.push("/login")
      } finally {
        setIsLoading(false)
      }
    }

    checkSession()
  }, [router])

  // Show loading state while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  // This won't be rendered as we're redirecting
  return null
}
