import * as React from "react";
import { create } from "zustand";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

type ToastTone = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id">) => void;
  remove: (id: string) => void;
}

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = Math.random().toString(36).slice(2);
    set({ toasts: [...get().toasts, { ...t, id }] });
    setTimeout(() => get().remove(id), 3500);
  },
  remove: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export function toast(t: Omit<ToastItem, "id" | "tone"> & { tone?: ToastTone }) {
  useToastStore.getState().push({ ...t, tone: t.tone ?? "info" });
}

const ICONS: Record<ToastTone, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-low" />,
  success: <CheckCircle2 className="h-4 w-4 text-passed" />,
  warning: <AlertTriangle className="h-4 w-4 text-moderate" />,
  error: <AlertTriangle className="h-4 w-4 text-critical" />,
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-md border bg-background p-3 shadow-lg",
          )}
        >
          <div className="mt-0.5">{ICONS[t.tone]}</div>
          <div className="flex-1">
            <div className="text-sm font-medium">{t.title}</div>
            {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
