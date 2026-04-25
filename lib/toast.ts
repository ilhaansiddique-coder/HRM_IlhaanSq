// Drop-in replacement for sonner's `toast` that adds a "Dismiss" cancel
// button to every toast — keeps UX consistent without each call site
// having to opt in. Always import from "@/lib/toast", never directly
// from "sonner".

import { toast as sonnerToast } from "sonner";

type ToastOptions = Parameters<typeof sonnerToast>[1];

const withDismiss = (opts?: ToastOptions): ToastOptions => ({
  ...opts,
  cancel: { label: "Dismiss", onClick: () => sonnerToast.dismiss() },
});

export const toast = {
  success: (msg: string, opts?: ToastOptions) =>
    sonnerToast.success(msg, withDismiss(opts)),
  error: (msg: string, opts?: ToastOptions) =>
    sonnerToast.error(msg, withDismiss(opts)),
  warning: (msg: string, opts?: ToastOptions) =>
    sonnerToast.warning(msg, withDismiss(opts)),
  info: (msg: string, opts?: ToastOptions) =>
    sonnerToast.info(msg, withDismiss(opts)),
  message: (msg: string, opts?: ToastOptions) =>
    sonnerToast(msg, withDismiss(opts)),
  loading: (msg: string, opts?: ToastOptions) =>
    sonnerToast.loading(msg, opts),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  promise: <T>(
    p: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: unknown) => string);
    }
  ) =>
    sonnerToast.promise(p, {
      ...msgs,
      cancel: { label: "Dismiss", onClick: () => sonnerToast.dismiss() },
    }),
};

export default toast;
