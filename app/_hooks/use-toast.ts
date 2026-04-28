// Re-export toast from sonner for compatibility
import { toast as sonnerToast } from "sonner";

export { sonnerToast as toast };

// useToast hook for compatibility - sonner uses direct toast() calls
export const useToast = () => {
  return { toast: sonnerToast };
};
