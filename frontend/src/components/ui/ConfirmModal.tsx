import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          onClick={onCancel}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-white/[0.06] p-6 shadow-2xl"
            style={{ background: "rgba(24,24,28,0.98)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  danger ? "bg-red-500/10" : "bg-sp-green/10"
                }`}
              >
                <AlertTriangle
                  size={18}
                  className={danger ? "text-red-400" : "text-sp-green"}
                />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-white mb-1">
                  {title}
                </h3>
                <p className="text-[13px] text-white/40 leading-relaxed">
                  {message}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 mt-6 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`px-5 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 ${
                  danger
                    ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20"
                    : "bg-sp-green/15 text-sp-green hover:bg-sp-green/25 border border-sp-green/20"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
