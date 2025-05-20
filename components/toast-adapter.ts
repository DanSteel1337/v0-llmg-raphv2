"use client"

/**
 * Toast Adapter
 *
 * This adapter provides a compatibility layer for different toast usage patterns.
 * It allows components to use the toast functionality in a more flexible way.
 */

import { useToast } from "@/components/toast"

// Type definitions for the toast parameters
export interface ToastParams {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
}

/**
 * Hook that provides a toast function compatible with both object-style and string-style usage
 */
export function useToastAdapter() {
  const { addToast } = useToast()

  // Create a toast function that can handle both styles of usage
  const toast = (params: ToastParams | string, type?: "success" | "error" | "info" | "warning") => {
    if (typeof params === "string") {
      // String style: toast("Message", "success")
      addToast(params, type || "info")
    } else {
      // Object style: toast({ title: "Title", description: "Description", variant: "default" })
      const message = params.description ? `${params.title || ""} ${params.description}`.trim() : params.title || ""

      const toastType = params.variant === "destructive" ? "error" : "info"
      addToast(message, toastType, params.duration)
    }
  }

  return { toast }
}
