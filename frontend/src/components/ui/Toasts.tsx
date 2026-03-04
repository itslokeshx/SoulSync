import { X } from "lucide-react";

export interface Toast {
  id: number;
  message: string;
  type: "info" | "success" | "error";
}

interface ToastsProps {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

export const Toasts = ({ toasts, dismiss }: ToastsProps) => (
  <div className="fixed bottom-36 md:bottom-24 right-4 md:right-5 z-[60] flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-[13px] font-medium animate-fadeIn backdrop-blur-2xl border ${
          t.type === "error"
            ? "bg-red-900/80 text-red-100 border-red-500/20"
            : t.type === "success"
              ? "bg-sp-green/90 text-black border-sp-green/30"
              : "bg-white/[0.08] text-white border-white/[0.06]"
        }`}
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
      >
        <span className="text-[11px]">
          {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
        </span>
        <span>{t.message}</span>
        <button
          onClick={() => dismiss(t.id)}
          className="ml-1 opacity-40 hover:opacity-100 transition-opacity"
        >
          <X size={11} />
        </button>
      </div>
    ))}
  </div>
);
