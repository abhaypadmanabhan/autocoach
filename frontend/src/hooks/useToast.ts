"use client";

import { toast as sonnerToast } from "sonner";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export function useToast() {
  return {
    showToast: (message: string, type: ToastType = "info") => {
      switch (type) {
        case "success":
          sonnerToast.success(message);
          break;
        case "error":
          sonnerToast.error(message);
          break;
        case "warning":
          sonnerToast.warning(message);
          break;
        default:
          sonnerToast(message);
      }
    },
    dismissToast: (id?: string) => {
      sonnerToast.dismiss(id);
    },
    toasts: [] as Toast[],
  };
}
