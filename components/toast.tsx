// Info: Reusable toast notification component
"use client"

import type React from "react"
import { useState, useEffect, createContext, useContext } from "react"

// Toast types
type ToastType = "success" | "error" | "info" | "warning"

// Toast item interface
interface ToastItem {
  id: string
  message: string
  type: ToastType
  duration: number
}

// Toast context interface
interface ToastContextType {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

// Create context
const ToastContext = createContext<ToastContextType | undefined>(undefined)

/**
 * Toast provider component
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  // Add a new toast
  const addToast = (message: string, type: ToastType = "info", duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type, duration }])
  }

  // Remove a toast by ID
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  )
}

/**
 * Hook to use the toast context
 */
export function useToast() {
  const context = useContext(ToastContext)

  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return context
}

/**
 * Toast container component
 */
function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

/**
 * Individual toast component
 */
function Toast({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, toast.duration)

    return () => clearTimeout(timer)
  }, [toast.duration, onClose])

  // Get the appropriate styles based on toast type
  const getTypeStyles = () => {
    switch (toast.type) {
      case "success":
        return "bg-green-100 border-green-500 text-green-800"
      case "error":
        return "bg-red-100 border-red-500 text-red-800"
      case "warning":
        return "bg-yellow-100 border-yellow-500 text-yellow-800"
      case "info":
      default:
        return "bg-blue-100 border-blue-500 text-blue-800"
    }
  }

  return (
    <div
      className={`px-4 py-3 rounded-md shadow-md border-l-4 max-w-md animate-slide-in ${getTypeStyles()}`}
      role="alert"
    >
      <div className="flex justify-between items-center">
        <p className="font-medium">{toast.message}</p>
        <button
          onClick={onClose}
          className="ml-4 text-gray-500 hover:text-gray-700 focus:outline-none"
          aria-label="Close"
        >
          <span className="text-xl">&times;</span>
        </button>
      </div>
    </div>
  )
}
