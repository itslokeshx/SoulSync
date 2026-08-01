import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ShieldCheck, Clock, CheckCircle2, MessageSquare, Sparkles, AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { submitFeedback, getUserFeedbackHistory, markFeedbackRead } from "../../api/backend";
import { getPlatform } from "../../utils/platform";
import { Feedback } from "../../types/feedback";
import { analytics } from "../../services/analytics";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshUnread?: () => void;
}

export function FeedbackModal({ isOpen, onClose, onRefreshUnread }: FeedbackModalProps) {
  const [messages, setMessages] = useState<Feedback[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [category, setCategory] = useState<"bug" | "suggestion" | "other">("suggestion");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchChatHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getUserFeedbackHistory();
      if (res.history) {
        // Sort oldest to newest for natural chat timeline (bottom is latest)
        const sorted = [...res.history].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setMessages(sorted);

        // Mark any unread replies as read on server
        const unreadItems = res.history.filter((item) => item.reply && item.replySeen === false);
        if (unreadItems.length > 0) {
          await Promise.all(unreadItems.map((item) => markFeedbackRead(item._id).catch(() => {})));
        }
        if (onRefreshUnread) onRefreshUnread();
      }
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      analytics.track("support_chat_open");
      fetchChatHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    setIsSubmitting(true);
    const messageText = inputMessage.trim();

    try {
      const rawPlatform = getPlatform();
      const platformMapped = rawPlatform === "android" ? "android" : rawPlatform === "electron" ? "desktop" : "web";

      let version = "5.1.2";
      try {
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (info.version) version = info.version;
      } catch {
        // web fallback
      }

      const res = await submitFeedback(messageText, category, version, platformMapped);
      if (res.success && res.feedback) {
        setMessages((prev) => [...prev, res.feedback]);
        toast.success("Message sent to SoulSync Support!");
        setInputMessage("");
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error("Chat send error:", err);
      toast.error("Failed to send message. Please try again.");
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
          <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none p-3 sm:p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="w-full max-w-lg h-[82vh] sm:h-[75vh] max-h-[680px] bg-[#0c0c0e] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl pointer-events-auto flex flex-col"
            >
              {/* Professional Chat Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sp-green/20 to-violet-500/20 border border-sp-green/30 flex items-center justify-center text-sp-green shadow-[0_0_20px_rgba(29,185,84,0.15)]">
                      <MessageSquare size={18} />
                    </div>
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-sp-green border-2 border-[#0c0c0e] shadow-[0_0_8px_#1db954]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight flex items-center gap-1.5 leading-tight">
                      SoulSync Support
                      <ShieldCheck size={14} className="text-sp-green" />
                    </h3>
                    <p className="text-[11px] text-white/40 font-medium">Direct Support & Feedback Channel</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Category Pills Selector */}
              <div className="px-5 py-2.5 bg-white/[0.015] border-b border-white/[0.04] flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 font-mono shrink-0">
                  Topic:
                </span>
                {[
                  { key: "suggestion", label: "💡 Suggestion" },
                  { key: "bug", label: "🐛 Bug Report" },
                  { key: "other", label: "🎵 Other" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCategory(item.key as any)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 ${
                      category === item.key
                        ? "bg-sp-green text-black shadow-md shadow-sp-green/10"
                        : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Chat Timeline (Scrollable Messages) */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin">
                {loadingHistory ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-white/30">
                    <span className="w-6 h-6 border-2 border-sp-green border-t-transparent rounded-full animate-spin mb-2" />
                    Connecting to Support Chat...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-white/30">
                      <Sparkles size={22} className="text-sp-green" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">How can we help you?</h4>
                      <p className="text-xs text-white/40 max-w-xs mt-1 leading-relaxed">
                        Send feature ideas, report issues, or ask questions. SoulSync Support will reply right here!
                      </p>
                    </div>
                  </div>
                ) : (
                  messages.map((item) => {
                    const hasReply = !!item.reply;

                    return (
                      <div key={item._id} className="space-y-3">
                        {/* User Message Bubble (Right Side) */}
                        <div className="flex justify-end">
                          <div className="max-w-[85%] sm:max-w-[78%] space-y-1">
                            <div className="bg-gradient-to-r from-sp-green/15 to-sp-green/20 border border-sp-green/30 p-3.5 rounded-2xl rounded-tr-sm text-xs text-white leading-relaxed shadow-md">
                              <p className="whitespace-pre-wrap">{item.message}</p>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 text-[9px] text-white/30 font-mono pr-1">
                              <span className="capitalize text-sp-green/80 font-bold">{item.category}</span>
                              <span>•</span>
                              <span>
                                {new Date(item.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Support Reply Bubble (Left Side) */}
                        {hasReply && (
                          <div className="flex justify-start">
                            <div className="max-w-[85%] sm:max-w-[80%] space-y-1">
                              <div className="bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-transparent border border-violet-500/30 p-4 rounded-2xl rounded-tl-sm text-xs text-white leading-relaxed shadow-lg">
                                <div className="flex items-center justify-between text-[10px] text-violet-300 font-bold mb-1.5 pb-1 border-b border-violet-500/20">
                                  <span className="flex items-center gap-1.5 text-violet-200">
                                    <ShieldCheck size={12} className="text-sp-green" />
                                    SoulSync Support ({item.repliedBy || "Admin"})
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap text-white/95">{item.reply}</p>
                              </div>
                              <div className="text-[9px] text-white/30 font-mono pl-1">
                                {item.replyAt ? new Date(item.replyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Footer Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 bg-[#09090b] border-t border-white/[0.06] shrink-0"
              >
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    maxLength={2000}
                    placeholder={`Message Support (${category})...`}
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-sp-green/60 rounded-2xl pl-4 pr-12 py-3 text-xs text-white placeholder-white/30 focus:outline-none transition-all duration-200"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !inputMessage.trim()}
                    className="absolute right-1.5 p-2 rounded-xl bg-sp-green text-black hover:bg-white transition-all duration-200 disabled:opacity-30 disabled:hover:bg-sp-green shrink-0 shadow-md"
                  >
                    {isSubmitting ? (
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin block" />
                    ) : (
                      <Send size={14} />
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
