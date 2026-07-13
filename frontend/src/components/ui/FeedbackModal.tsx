import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MessageSquare, Send } from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { submitFeedback } from "../../api/backend";
import { getPlatform } from "../../utils/platform";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<"bug" | "suggestion" | "other">("suggestion");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter a feedback message.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Map current platform
      const rawPlatform = getPlatform();
      const platformMapped = rawPlatform === "android" ? "android" : (rawPlatform === "electron" ? "desktop" : "web");

      // Get app version
      let version = "4.0.0"; // default
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (info.version) {
          version = info.version;
        }
      } catch {
        // web fallback
      }

      await submitFeedback(message, category, version, platformMapped);
      toast.success("Feedback submitted! Thank you 🎵");
      setMessage("");
      onClose();
    } catch (err) {
      console.error("Feedback submit error:", err);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[10000]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-sp-green/10 text-sp-green">
                    <MessageSquare size={16} />
                  </div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    Send Feedback
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Category Chip Selection */}
                <div>
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-2 font-mono">
                    Feedback Category
                  </label>
                  <div className="flex gap-2">
                    {(["suggestion", "bug", "other"] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all duration-200 ${
                          category === cat
                            ? "bg-sp-green text-black shadow-lg shadow-sp-green/20"
                            : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback Input */}
                <div>
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block mb-2 font-mono">
                    Your Message
                  </label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={2000}
                    placeholder={
                      category === "bug"
                        ? "What went wrong? Steps to reproduce help a lot!"
                        : category === "suggestion"
                        ? "What would make SoulSync better? Share your ideas!"
                        : "Write your thoughts here..."
                    }
                    className="w-full bg-white/[0.03] border border-white/5 focus:border-sp-green/50 rounded-xl p-3 text-[13px] text-white placeholder-white/30 focus:outline-none resize-none transition-all duration-200"
                  />
                  <div className="flex justify-end text-[10px] text-white/30 mt-1 font-mono">
                    {message.length} / 2000
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/[0.04] bg-white/[0.01] flex gap-2.5 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !message.trim()}
                  className="px-5 py-2 rounded-xl bg-sp-green text-black font-extrabold text-[13px] flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-100 transition-all duration-200"
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send size={12} />
                  )}
                  Submit
                </button>
              </div>
            </motion.form>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
