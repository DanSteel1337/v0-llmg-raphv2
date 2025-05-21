"use client"

import { useContext } from "react"
import { ToastContext, type Toast, type ToastVariant } from "./toast"

/**
 * Toast options without ID and variant
 */
type ToastOptions = Omit<Toast, "id" | "variant">

/**
 * Hook for using the toast notification system
 *
 * @example
 * ```tsx
 * const { toast } = useToast()
 *
 * // Show a success toast
 * toast.success({
 *   title: "Success!",
 *   description: "Your changes have been saved."
 * })
 *
 * // Show a toast with an action button
 * toast.info({
 *   title: "Information",
 *   description: "Would you like to continue?",
 *   action: {
 *     label: "Continue",
 *     onClick: () => handleContinue()
 *   }
 * })
 *
 * // Use with promises
 * toast.promise(saveData(), {
 *   loading: {
 *     title: "Saving",
 *     description: "Please wait while we save your changes."
 *   },
 *   success: {
 *     title: "Success",
 *     description: "Your changes have been saved."
 *   },
 *   error: {
 *     title: "Error",
 *     description: "There was a problem saving your changes."
 *   }
 * })
 * ```
 */
export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  /**
   * Show a toast with the specified variant
   */
  const showToastWithVariant = (variant: ToastVariant) => (options: ToastOptions) => {
    return context.showToast({ ...options, variant })
  }

  /**
   * Toast API with variant-specific methods and utilities
   */
  const toast = {
    /**
     * Show a default toast
     */
    show: (options: ToastOptions) => context.showToast(options),

    /**
     * Show a success toast
     */
    success: showToastWithVariant("success"),

    /**
     * Show an error toast
     */
    error: showToastWithVariant("error"),

    /**
     * Show a warning toast
     */
    warning: showToastWithVariant("warning"),

    /**
     * Show an info toast
     */
    info: showToastWithVariant("info"),

    /**
     * Show a loading toast
     */
    loading: showToastWithVariant("loading"),

    /**
     * Update an existing toast
     */
    update: context.updateToast,

    /**
     * Dismiss a specific toast
     */
    dismiss: context.dismissToast,

    /**
     * Dismiss all toasts
     */
    dismissAll: context.dismissAllToasts,

    /**
     * Handle a promise with loading, success, and error states
     */
    promise: context.promise,

    /**
     * Create a toast group
     */
    createGroup: context.createToastGroup,

    /**
     * Add a toast to a group
     */
    addToGroup: context.addToastToGroup,

    /**
     * Dismiss a toast group
     */
    dismissGroup: context.dismissToastGroup,
  }

  return { toast }
}

export { Toast, ToastVariant, ToastAction } from "./toast"
