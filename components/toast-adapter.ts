"use client"

/**
 * Toast Adapter
 *
 * This adapter provides compatibility between different toast usage patterns
 * in the application. It supports both string-style and object-style toast calls.
 */

import { useToast } from "./toast"

// Type for object-style toast parameters
interface ToastParams {
  title?: string
  description?: string
  variant?: "default" | "destructive"
  duration?: number
}

/**
 * Toast adapter hook that provides compatibility with different toast usage patterns
 */
export function useToastAdapter() {
  const { addToast } = useToast()

  /**
   * Unified toast function that supports both styles:
   * - String style: toast("Message", "success")
   * - Object style: toast({ title: "Title", description: "Description", variant: "default" })
   */
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

  return { toast, addToast }
}
