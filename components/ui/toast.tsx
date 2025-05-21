"use client"

import { useRef } from "react"

import * as React from "react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Toast variant types for different notification purposes
 */
export type ToastVariant = "default" | "success" | "error" | "warning" | "info" | "loading"

/**
 * Toast position options for placement on the screen
 */
export type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center"

/**
 * Toast action button configuration
 */
export interface ToastAction {
  label: string
  onClick: () => void
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
}

/**
 * Toast notification configuration
 */
export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
  onDismiss?: () => void
  action?: ToastAction
  position?: ToastPosition
  dismissible?: boolean
  important?: boolean
  progressBar?: boolean
  ariaLive?: "assertive" | "polite" | "off"
}

/**
 * Toast group for organizing related notifications
 */
export interface ToastGroup {
  id: string
  title: string
  toasts: Toast[]
}

/**
 * Toast context state interface
 */
interface ToastContextState {
  toasts: Toast[]
  groups: ToastGroup[]
  showToast: (toast: Omit<Toast, "id">) => string
  updateToast: (id: string, toast: Partial<Toast>) => void
  dismissToast: (id: string) => void
  dismissAllToasts: () => void
  createToastGroup: (title: string) => string
  addToastToGroup: (groupId: string, toast: Omit<Toast, "id">) => string
  dismissToastGroup: (groupId: string) => void
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: Omit<Toast, "id" | "variant">
      success: Omit<Toast, "id" | "variant">
      error: Omit<Toast, "id" | "variant">
    },
  ) => Promise<T>
}

/**
 * Toast provider props interface
 */
interface ToastProviderProps {
  children: React.ReactNode
  defaultPosition?: ToastPosition
  defaultDuration?: number
  maxToasts?: number
  pauseOnHover?: boolean
}

/**
 * Default toast context state
 */
const defaultToastContext: ToastContextState = {
  toasts: [],
  groups: [],
  showToast: () => "",
  updateToast: () => {},
  dismissToast: () => {},
  dismissAllToasts: () => {},
  createToastGroup: () => "",
  addToastToGroup: () => "",
  dismissToastGroup: () => {},
  promise: async () => {
    throw new Error("Toast context not initialized")
  },
}

/**
 * Toast context for providing toast functionality throughout the application
 */
export const ToastContext = createContext<ToastContextState>(defaultToastContext)

/**
 * Generate a unique ID for toasts
 */
const generateId = () => `toast-${Math.random().toString(36).substring(2, 9)}`

/**
 * Toast provider component that manages toast state and rendering
 */
export function ToastProvider({
  children,
  defaultPosition = "bottom-right",
  defaultDuration = 5000,
  maxToasts = 5,
  pauseOnHover = true,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [groups, setGroups] = useState<ToastGroup[]>([])
  const [isMounted, setIsMounted] = useState(false)

  // Mount check for SSR
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  /**
   * Show a new toast notification
   */
  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = generateId()
      const newToast: Toast = {
        id,
        variant: "default",
        duration: defaultDuration,
        position: defaultPosition,
        dismissible: true,
        progressBar: true,
        ...toast,
      }

      setToasts((prev) => {
        // Limit the number of toasts
        const updatedToasts = [...prev, newToast]
        if (updatedToasts.length > maxToasts) {
          // Remove oldest non-important toasts first
          const nonImportantIndex = updatedToasts.findIndex((t) => !t.important)
          if (nonImportantIndex !== -1) {
            updatedToasts.splice(nonImportantIndex, 1)
          } else {
            // If all are important, remove the oldest
            updatedToasts.shift()
          }
        }
        return updatedToasts
      })

      return id
    },
    [defaultDuration, defaultPosition, maxToasts],
  )

  /**
   * Update an existing toast
   */
  const updateToast = useCallback((id: string, toast: Partial<Toast>) => {
    setToasts((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          return { ...t, ...toast }
        }
        return t
      }),
    )
  }, [])

  /**
   * Dismiss a specific toast
   */
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => {
      const toast = prev.find((t) => t.id === id)
      if (toast?.onDismiss) {
        toast.onDismiss()
      }
      return prev.filter((t) => t.id !== id)
    })
  }, [])

  /**
   * Dismiss all toasts
   */
  const dismissAllToasts = useCallback(() => {
    setToasts([])
  }, [])

  /**
   * Create a new toast group
   */
  const createToastGroup = useCallback((title: string) => {
    const id = generateId()
    setGroups((prev) => [...prev, { id, title, toasts: [] }])
    return id
  }, [])

  /**
   * Add a toast to a specific group
   */
  const addToastToGroup = useCallback(
    (groupId: string, toast: Omit<Toast, "id">) => {
      const id = generateId()
      const newToast: Toast = {
        id,
        variant: "default",
        duration: defaultDuration,
        position: defaultPosition,
        dismissible: true,
        ...toast,
      }

      setGroups((prev) =>
        prev.map((group) => {
          if (group.id === groupId) {
            return {
              ...group,
              toasts: [...group.toasts, newToast],
            }
          }
          return group
        }),
      )

      return id
    },
    [defaultDuration, defaultPosition],
  )

  /**
   * Dismiss a toast group
   */
  const dismissToastGroup = useCallback((groupId: string) => {
    setGroups((prev) => prev.filter((group) => group.id !== groupId))
  }, [])

  /**
   * Handle promise with toast notifications for loading, success, and error states
   */
  const promise = useCallback(
    async <T,>(
      promise: Promise<T>,
      options: {
        loading: Omit<Toast, "id" | "variant">
        success: Omit<Toast, "id" | "variant">
        error: Omit<Toast, "id" | "variant">
      },
    ): Promise<T> => {
      const toastId = showToast({
        ...options.loading,
        variant: "loading",
        duration: Number.POSITIVE_INFINITY, // Don't auto-dismiss loading toasts
      })

      try {
        const result = await promise
        // Replace loading toast with success toast
        updateToast(toastId, {
          ...options.success,
          variant: "success",
          duration: options.success.duration || defaultDuration,
        })
        return result
      } catch (error) {
        // Replace loading toast with error toast
        updateToast(toastId, {
          ...options.error,
          variant: "error",
          description: options.error.description || (error instanceof Error ? error.message : String(error)),
          duration: options.error.duration || defaultDuration,
        })
        throw error
      }
    },
    [showToast, updateToast, defaultDuration],
  )

  // Auto-dismiss toasts after their duration
  useEffect(() => {
    if (toasts.length === 0) return

    const timers = toasts.map((toast) => {
      if (toast.duration === Number.POSITIVE_INFINITY) return undefined

      const timer = setTimeout(() => {
        dismissToast(toast.id)
      }, toast.duration)

      return { id: toast.id, timer }
    })

    return () => {
      timers.forEach((timer) => {
        if (timer?.timer) clearTimeout(timer.timer)
      })
    }
  }, [toasts, dismissToast])

  // Group toasts by position for rendering
  const groupedToasts = React.useMemo(() => {
    const groups: Record<ToastPosition, Toast[]> = {
      "top-right": [],
      "top-left": [],
      "bottom-right": [],
      "bottom-left": [],
      "top-center": [],
      "bottom-center": [],
    }

    toasts.forEach((toast) => {
      const position = toast.position || defaultPosition
      groups[position].push(toast)
    })

    return groups
  }, [toasts, defaultPosition])

  // Context value
  const value = React.useMemo(
    () => ({
      toasts,
      groups,
      showToast,
      updateToast,
      dismissToast,
      dismissAllToasts,
      createToastGroup,
      addToastToGroup,
      dismissToastGroup,
      promise,
    }),
    [
      toasts,
      groups,
      showToast,
      updateToast,
      dismissToast,
      dismissAllToasts,
      createToastGroup,
      addToastToGroup,
      dismissToastGroup,
      promise,
    ],
  )

  // Don't render toasts on the server
  if (!isMounted) {
    return <>{children}</>
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isMounted &&
        createPortal(
          <>
            {/* Top Left */}
            <ToastContainer position="top-left" toasts={groupedToasts["top-left"]} pauseOnHover={pauseOnHover} />

            {/* Top Center */}
            <ToastContainer position="top-center" toasts={groupedToasts["top-center"]} pauseOnHover={pauseOnHover} />

            {/* Top Right */}
            <ToastContainer position="top-right" toasts={groupedToasts["top-right"]} pauseOnHover={pauseOnHover} />

            {/* Bottom Left */}
            <ToastContainer position="bottom-left" toasts={groupedToasts["bottom-left"]} pauseOnHover={pauseOnHover} />

            {/* Bottom Center */}
            <ToastContainer
              position="bottom-center"
              toasts={groupedToasts["bottom-center"]}
              pauseOnHover={pauseOnHover}
            />

            {/* Bottom Right */}
            <ToastContainer
              position="bottom-right"
              toasts={groupedToasts["bottom-right"]}
              pauseOnHover={pauseOnHover}
            />

            {/* Toast Groups */}
            {groups.map((group) => (
              <ToastGroupContainer key={group.id} group={group} pauseOnHover={pauseOnHover} />
            ))}
          </>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}

/**
 * Toast container component for a specific position
 */
function ToastContainer({
  position,
  toasts,
  pauseOnHover,
}: {
  position: ToastPosition
  toasts: Toast[]
  pauseOnHover: boolean
}) {
  // Position-specific styles
  const containerStyles = {
    "top-left": "top-0 left-0",
    "top-center": "top-0 left-1/2 -translate-x-1/2",
    "top-right": "top-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "bottom-right": "bottom-0 right-0",
    "bottom-center": "bottom-0 left-1/2 -translate-x-1/2",
  }

  // Animation variants based on position
  const getAnimationVariants = (pos: ToastPosition) => {
    if (pos.includes("top")) {
      return {
        initial: { opacity: 0, y: -20 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -20 },
      }
    }
    return {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 },
    }
  }

  if (toasts.length === 0) return null

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col gap-2 p-4 max-h-screen overflow-hidden pointer-events-none",
        containerStyles[position],
      )}
      aria-live="polite"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            animationVariants={getAnimationVariants(position)}
            pauseOnHover={pauseOnHover}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

/**
 * Toast group container component
 */
function ToastGroupContainer({
  group,
  pauseOnHover,
}: {
  group: ToastGroup
  pauseOnHover: boolean
}) {
  const { dismissToastGroup } = useContext(ToastContext)

  if (group.toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden pointer-events-auto"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-medium">{group.title}</h3>
          <button
            onClick={() => dismissToastGroup(group.id)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            aria-label="Close toast group"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {group.toasts.map((toast) => (
            <div key={toast.id} className="p-2">
              <ToastContent toast={toast} pauseOnHover={pauseOnHover} />
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Individual toast item component with animations
 */
function ToastItem({
  toast,
  animationVariants,
  pauseOnHover,
}: {
  toast: Toast
  animationVariants: any
  pauseOnHover: boolean
}) {
  const { dismissToast } = useContext(ToastContext)
  const [isPaused, setIsPaused] = useState(false)
  const [remainingTime, setRemainingTime] = useState(toast.duration || 5000)
  const startTimeRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)

  // Handle progress bar animation
  useEffect(() => {
    if (toast.duration === Number.POSITIVE_INFINITY || !toast.progressBar) return

    const startTime = Date.now()
    const totalDuration = toast.duration || 5000

    const updateProgress = () => {
      if (isPaused) {
        // If paused, update the remaining time but don't animate
        if (startTimeRef.current) {
          const elapsed = Date.now() - startTimeRef.current
          setRemainingTime((prev) => Math.max(0, prev - elapsed))
          startTimeRef.current = Date.now()
        }
        rafRef.current = requestAnimationFrame(updateProgress)
        return
      }

      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, totalDuration - elapsed)
      setRemainingTime(remaining)

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(updateProgress)
      }
    }

    rafRef.current = requestAnimationFrame(updateProgress)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [toast.duration, toast.progressBar, isPaused])

  // Handle pause on hover
  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover && toast.duration !== Number.POSITIVE_INFINITY) {
      setIsPaused(true)
      startTimeRef.current = Date.now()
    }
  }, [pauseOnHover, toast.duration])

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover && toast.duration !== Number.POSITIVE_INFINITY) {
      setIsPaused(false)
    }
  }, [pauseOnHover, toast.duration])

  return (
    <motion.div
      layout
      initial={animationVariants.initial}
      animate={animationVariants.animate}
      exit={animationVariants.exit}
      className="pointer-events-auto w-full max-w-sm"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <ToastContent
        toast={toast}
        onDismiss={() => dismissToast(toast.id)}
        remainingTime={remainingTime}
        pauseOnHover={pauseOnHover}
      />
    </motion.div>
  )
}

/**
 * Toast content component
 */
function ToastContent({
  toast,
  onDismiss,
  remainingTime,
  pauseOnHover,
}: {
  toast: Toast
  onDismiss?: () => void
  remainingTime?: number
  pauseOnHover: boolean
}) {
  // Variant-specific styles and icons
  const variantStyles = {
    default: "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700",
    success: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    error: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
    warning: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    info: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    loading: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700",
  }

  const variantIcons = {
    default: null,
    success: <CheckCircle className="h-5 w-5 text-green-500 dark:text-green-400" />,
    error: <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500 dark:text-amber-400" />,
    info: <Info className="h-5 w-5 text-blue-500 dark:text-blue-400" />,
    loading: <Loader2 className="h-5 w-5 text-gray-500 dark:text-gray-400 animate-spin" />,
  }

  // Progress percentage calculation
  const progressPercentage =
    typeof remainingTime === "number" && toast.duration && toast.duration !== Number.POSITIVE_INFINITY
      ? (remainingTime / toast.duration) * 100
      : 0

  return (
    <div
      className={cn("relative overflow-hidden rounded-lg border shadow-lg", variantStyles[toast.variant || "default"])}
      role="alert"
      aria-live={toast.ariaLive || "polite"}
    >
      <div className="flex p-4">
        {/* Icon */}
        {variantIcons[toast.variant || "default"] && (
          <div className="flex-shrink-0 mr-3">{variantIcons[toast.variant || "default"]}</div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {toast.title && <h4 className="text-sm font-medium">{toast.title}</h4>}
          {toast.description && <div className="mt-1 text-sm opacity-90">{toast.description}</div>}

          {/* Action button */}
          {toast.action && (
            <div className="mt-2">
              <button
                onClick={toast.action.onClick}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md",
                  toast.action.variant === "destructive"
                    ? "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-800/30 dark:text-red-300 dark:hover:bg-red-800/40"
                    : toast.action.variant === "outline"
                      ? "border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-800"
                      : toast.action.variant === "secondary"
                        ? "bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                        : toast.action.variant === "ghost"
                          ? "hover:bg-gray-100 dark:hover:bg-gray-800"
                          : toast.action.variant === "link"
                            ? "text-blue-600 hover:underline dark:text-blue-400"
                            : "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-800/30 dark:text-blue-300 dark:hover:bg-blue-800/40",
                )}
              >
                {toast.action.label}
              </button>
            </div>
          )}
        </div>

        {/* Dismiss button */}
        {toast.dismissible !== false && onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 ml-3 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {toast.progressBar && toast.duration !== Number.POSITIVE_INFINITY && (
        <div
          className={cn(
            "h-1 transition-all duration-150",
            toast.variant === "success"
              ? "bg-green-500 dark:bg-green-400"
              : toast.variant === "error"
                ? "bg-red-500 dark:bg-red-400"
                : toast.variant === "warning"
                  ? "bg-amber-500 dark:bg-amber-400"
                  : toast.variant === "info"
                    ? "bg-blue-500 dark:bg-blue-400"
                    : toast.variant === "loading"
                      ? "bg-gray-500 dark:bg-gray-400"
                      : "bg-gray-500 dark:bg-gray-400",
          )}
          style={{ width: `${progressPercentage}%` }}
        />
      )}
    </div>
  )
}

/**
 * Hook to use the toast context
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export { useToast as toast }
