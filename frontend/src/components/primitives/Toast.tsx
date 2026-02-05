"use client"

/**
 * Re-exports the existing AutoCoach toast system.
 *
 * Usage:
 *   import { ToastProvider, useToast } from "@/components/primitives/Toast"
 *
 *   // Wrap your layout with <ToastProvider>
 *   // Then in any child component:
 *   const { showToast } = useToast()
 *   showToast("Document uploaded!", "success")
 *
 * Supported types: "success" | "error" | "warning"
 */
export { ToastProvider, ToastContainer } from "@/components/ui/Toast"
export { useToast } from "@/hooks/useToast"
export type { Toast, ToastType } from "@/hooks/useToast"
