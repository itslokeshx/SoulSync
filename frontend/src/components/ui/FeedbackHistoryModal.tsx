import React, { useState, useEffect } from "react";
import { X, MessageSquare, Clock, CheckCircle2, AlertCircle, HelpCircle, ShieldCheck } from "lucide-react";
import { getUserFeedbackHistory, markFeedbackRead } from "../../api/backend";
import { Feedback } from "../../types/feedback";

interface FeedbackHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshUnread?: () => void;
}

export function FeedbackHistoryModal({ isOpen, onClose, onRefreshUnread }: FeedbackHistoryModalProps) {
  const [history, setHistory] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getUserFeedbackHistory();
      if (res.history) {
        setHistory(res.history);
        
        // Auto mark unread replies as read when viewing
        for (const item of res.history) {
          if (item.reply && item.replySeen === false) {
            markFeedbackRead(item._id).catch(() => {});
          }
        }
        if (onRefreshUnread) onRefreshUnread();
      }
    } catch (err) {
      console.error("Failed to load feedback history:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getStatusBadge = (fb: Feedback) => {
    const isReplied = fb.reply || fb.status === "replied";
    const isClosed = fb.status === "closed" || fb.status === "resolved" || fb.status === "wontfix";

    if (isClosed) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-white/60 flex items-center gap-1">
          <CheckCircle2 size={10} /> Closed
        </span>
      );
    }
    if (isReplied) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-sp-green/15 text-sp-green border border-sp-green/30 flex items-center gap-1 shadow-sm">
          <MessageSquare size={10} /> Replied
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/20 flex items-center gap-1">
        <Clock size={10} /> Pending
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0c0c0e] border border-white/10 rounded-[28px] p-6 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-sp-green/10 border border-sp-green/20 flex items-center justify-center text-sp-green">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight">Your Feedback History</h3>
              <p className="text-xs text-white/40">Track support replies and updates</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-7 h-7 border-2 border-sp-green border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-white/40">Loading feedback history...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs text-rose-400">
              Failed to load feedback history. Please try again.
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl p-6">
              <HelpCircle size={32} className="mx-auto text-white/20 mb-2" />
              <p className="text-sm font-bold text-white/60">No Feedback Submitted Yet</p>
              <p className="text-xs text-white/30 mt-1 max-w-sm mx-auto">
                Have questions or ideas? Submit feedback directly from your profile to connect with SoulSync Support.
              </p>
            </div>
          ) : (
            history.map((fb) => {
              const hasReply = !!fb.reply;
              const isUnread = hasReply && fb.replySeen === false;

              return (
                <div
                  key={fb._id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isUnread
                      ? "bg-violet-500/[0.04] border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
                      : "bg-white/[0.02] border-white/[0.06]"
                  }`}
                >
                  {/* Item Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-white/70">
                        {fb.category}
                      </span>
                      {getStatusBadge(fb)}
                      {isUnread && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-violet-500 text-white animate-pulse">
                          NEW REPLY
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-white/30 font-mono">
                      {new Date(fb.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Conversation Layout */}
                  <div className="space-y-3">
                    {/* User Message */}
                    <div className="bg-white/[0.03] p-3.5 rounded-xl border border-white/[0.04]">
                      <div className="flex items-center justify-between text-[10px] text-white/40 font-bold mb-1">
                        <span>You</span>
                        <span>{new Date(fb.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">{fb.message}</p>
                    </div>

                    {/* Support Reply Bubble */}
                    {hasReply && (
                      <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4 rounded-xl border border-violet-500/25 ml-3 relative">
                        <div className="flex items-center justify-between text-[10px] text-violet-300 font-bold mb-1.5">
                          <span className="flex items-center gap-1.5 text-violet-200">
                            <ShieldCheck size={13} className="text-sp-green" />
                            SoulSync Support ({fb.repliedBy || "Support"})
                          </span>
                          <span>
                            {fb.replyAt ? `${new Date(fb.replyAt).toLocaleDateString()} ${new Date(fb.replyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Replied"}
                          </span>
                        </div>
                        <p className="text-xs text-white/95 leading-relaxed whitespace-pre-wrap">{fb.reply}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
