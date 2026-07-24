import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Lock,
  MessageSquare,
  Megaphone,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit3,
  LogOut,
  Trash2,
  Search,
  Send,
  X,
  ShieldCheck,
  History,
  CornerDownRight,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import toast from "react-hot-toast";
import * as api from "../api/backend";
import { Feedback } from "../types/feedback";

type Tab = "feedback" | "announcements";

const QUICK_REPLY_TEMPLATES = [
  "Thanks for reporting this!",
  "This issue has been fixed.",
  "We're investigating this.",
  "Can you provide more details?",
  "Feature request noted.",
];

export default function AdminPanel() {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);

  // Tabs & Lists
  const [activeTab, setActiveTab] = useState<Tab>("feedback");
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [announcementsList, setAnnouncementsList] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Expanded feedback IDs
  const [expandedFeedback, setExpandedFeedback] = useState<Set<string>>(new Set());
  const [expandedAuditLogs, setExpandedAuditLogs] = useState<Set<string>>(new Set());

  // Feedback filters & search
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<string>("newest");

  // Reply Modal State
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [isEditingReply, setIsEditingReply] = useState(false);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Announcement Form State
  const [annForm, setAnnForm] = useState({
    type: "whats_new",
    title: "",
    body: "",
    version: "",
    ctaText: "",
    ctaRoute: "",
    imageUrl: "",
    active: true,
    priority: 0,
    expiresAt: "",
  });
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [submittingAnn, setSubmittingAnn] = useState(false);

  // Initial check on mount
  useEffect(() => {
    const token = api.getAdminToken();
    if (token) {
      setIsAuthenticated(true);
      fetchData();
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Please enter password.");
      return;
    }
    setLoggingIn(true);
    try {
      await api.adminLogin(password);
      setIsAuthenticated(true);
      toast.success("Welcome back, Admin!");
      fetchData();
    } catch (err: any) {
      console.error(err);
      const status = err.response?.status;
      if (status === 429) {
        toast.error("Too many login attempts. Please try again in 1 minute.");
      } else {
        toast.error("Invalid password.");
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.adminLogout();
      setIsAuthenticated(false);
      setPassword("");
      toast.success("Logged out successfully.");
    } catch (err) {
      console.error(err);
      setIsAuthenticated(false);
    }
  };

  const fetchData = async () => {
    setLoadingList(true);
    setCheckingAuth(false);
    try {
      const fbData = await api.getFeedback(
        filterStatus === "all" ? undefined : filterStatus,
        filterCategory === "all" ? undefined : filterCategory,
        searchQuery || undefined,
        sortOrder
      );
      setFeedbackList(fbData.feedback || []);

      const annData = await api.getAdminAnnouncements();
      setAnnouncementsList(annData.announcements || []);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 401) {
        setIsAuthenticated(false);
        api.setAdminToken(null);
      } else {
        toast.error("Failed to load dashboard data.");
      }
    } finally {
      setLoadingList(false);
    }
  };

  // Re-fetch when active tab, filters, search, or sort change
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === "feedback") {
        setLoadingList(true);
        api.getFeedback(
          filterStatus === "all" ? undefined : filterStatus,
          filterCategory === "all" ? undefined : filterCategory,
          searchQuery || undefined,
          sortOrder
        )
          .then((data) => setFeedbackList(data.feedback || []))
          .catch((err) => console.error("Feedback fetch error:", err))
          .finally(() => setLoadingList(false));
      } else {
        api.getAdminAnnouncements()
          .then((data) => setAnnouncementsList(data.announcements || []))
          .catch((err) => console.error("Announcement fetch error:", err));
      }
    }
  }, [activeTab, filterStatus, filterCategory, searchQuery, sortOrder, isAuthenticated]);

  // Open Reply Modal
  const openReplyModal = (fb: Feedback) => {
    setSelectedFeedback(fb);
    setReplyInput(fb.reply || "");
    setIsEditingReply(!!fb.reply);
    setReplyModalOpen(true);
  };

  // Submit Reply (Send / Edit)
  const handleSendReply = async () => {
    if (!selectedFeedback) return;
    if (!replyInput.trim()) {
      toast.error("Reply message cannot be empty.");
      return;
    }
    if (replyInput.trim().length > 2000) {
      toast.error("Reply message exceeds maximum limit of 2000 characters.");
      return;
    }

    setSubmittingReply(true);
    try {
      let res;
      if (isEditingReply) {
        res = await api.updateAdminReply(selectedFeedback._id, replyInput.trim());
      } else {
        res = await api.sendAdminReply(selectedFeedback._id, replyInput.trim());
      }

      if (res.success && res.feedback) {
        setFeedbackList((prev) =>
          prev.map((item) => (item._id === selectedFeedback._id ? res.feedback : item))
        );
        toast.success(isEditingReply ? "Reply updated successfully!" : "Reply sent to user!");
        setReplyModalOpen(false);
        setSelectedFeedback(null);
        setReplyInput("");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to send reply.");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Delete Reply
  const handleDeleteReply = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this reply? The feedback will revert to Pending status.")) {
      return;
    }
    try {
      const res = await api.deleteAdminReply(id);
      if (res.success && res.feedback) {
        setFeedbackList((prev) =>
          prev.map((item) => (item._id === id ? res.feedback : item))
        );
        toast.success("Reply deleted successfully.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete reply.");
    }
  };

  // Mark Feedback Closed
  const handleCloseFeedback = async (id: string) => {
    try {
      const res = await api.closeAdminFeedback(id);
      if (res.success && res.feedback) {
        setFeedbackList((prev) =>
          prev.map((item) => (item._id === id ? res.feedback : item))
        );
        toast.success("Feedback marked as closed.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to close feedback.");
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this feedback permanently?")) {
      return;
    }
    try {
      const res = await api.deleteFeedback(id);
      if (res.success) {
        setFeedbackList((prev) => prev.filter((item) => item._id !== id));
        toast.success("Feedback deleted permanently");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete feedback.");
    }
  };

  const toggleExpandFeedback = (id: string) => {
    setExpandedFeedback((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandAuditLogs = (id: string) => {
    setExpandedAuditLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Announcement Handlers
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annForm.title.trim() || !annForm.body.trim()) {
      toast.error("Title and body are required.");
      return;
    }
    setSubmittingAnn(true);
    try {
      const payload = {
        ...annForm,
        expiresAt: annForm.expiresAt ? new Date(annForm.expiresAt).toISOString() : undefined,
      };

      if (editingAnnId) {
        const res = await api.updateAnnouncement(editingAnnId, payload);
        if (res.success) {
          toast.success("Announcement updated!");
          setAnnouncementsList((prev) =>
            prev.map((item) => (item._id === editingAnnId ? res.announcement : item))
          );
        }
      } else {
        const res = await api.createAnnouncement(payload);
        if (res.success) {
          toast.success("Announcement created!");
          setAnnouncementsList((prev) => [res.announcement, ...prev]);
        }
      }
      resetAnnForm();
    } catch (err) {
      console.error(err);
      toast.error("Failed to save announcement.");
    } finally {
      setSubmittingAnn(false);
    }
  };

  const handleEditAnnouncement = (ann: any) => {
    setEditingAnnId(ann._id);
    setAnnForm({
      type: ann.type || "whats_new",
      title: ann.title || "",
      body: ann.body || "",
      version: ann.version || "",
      ctaText: ann.ctaText || "",
      ctaRoute: ann.ctaRoute || "",
      imageUrl: ann.imageUrl || "",
      active: ann.active ?? true,
      priority: ann.priority || 0,
      expiresAt: ann.expiresAt ? new Date(ann.expiresAt).toISOString().substring(0, 16) : "",
    });
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      const res = await api.deleteAnnouncement(id);
      if (res.success) {
        setAnnouncementsList((prev) => prev.filter((item) => item._id !== id));
        toast.success("Announcement deleted.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete announcement.");
    }
  };

  const resetAnnForm = () => {
    setEditingAnnId(null);
    setAnnForm({
      type: "whats_new",
      title: "",
      body: "",
      version: "",
      ctaText: "",
      ctaRoute: "",
      imageUrl: "",
      active: true,
      priority: 0,
      expiresAt: "",
    });
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <span className="w-8 h-8 border-2 border-sp-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Password Gate
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/[0.02] border border-white/[0.06] p-6 sm:p-8 rounded-3xl backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-sp-green/10 border border-sp-green/20 flex items-center justify-center text-sp-green mb-4 shadow-[0_0_30px_rgba(29,185,84,0.15)]">
              <Lock size={26} />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">SoulSync Admin</h1>
            <p className="text-xs text-white/40 mt-1">Enter master passcode to access feedback portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Admin Passcode..."
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-sp-green transition-colors"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3.5 rounded-xl bg-sp-green text-black font-extrabold text-xs uppercase tracking-wider hover:bg-white transition-colors duration-200 shadow-lg shadow-sp-green/20 disabled:opacity-50"
            >
              {loggingIn ? "Authenticating..." : "Unlock Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pendingCount = feedbackList.filter((fb) => fb.status === "pending" || fb.status === "new" || fb.status === "seen").length;

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-y-auto bg-[#050505] text-white z-[500] scrollbar-thin">
      <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto animate-fadeIn pb-28">
      {/* Responsive Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b border-white/[0.06] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sp-green/10 border border-sp-green/20 flex items-center justify-center text-sp-green shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">Admin Operations Panel</h1>
            <p className="text-xs text-white/40">Manage Feedback Replies & System Announcements</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-sp-rose/20 text-white/60 hover:text-sp-rose border border-white/[0.06] hover:border-sp-rose/30 text-xs font-bold transition-all duration-200"
        >
          <LogOut size={13} /> Log Out
        </button>
      </div>

      {/* Touch-Scrollable Navigation Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/[0.04] pb-px overflow-x-auto whitespace-nowrap scrollbar-none max-w-full shrink-0">
        <button
          onClick={() => setActiveTab("feedback")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 ${
            activeTab === "feedback"
              ? "border-sp-green text-sp-green"
              : "border-transparent text-white/40 hover:text-white/80"
          }`}
        >
          <MessageSquare size={14} />
          Feedback & Replies
          {pendingCount > 0 && (
            <span className="ml-1 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("announcements")}
          className={`flex items-center gap-2 px-4 sm:px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 shrink-0 ${
            activeTab === "announcements"
              ? "border-sp-green text-sp-green"
              : "border-transparent text-white/40 hover:text-white/80"
          }`}
        >
          <Megaphone size={14} />
          Announcements
        </button>
      </div>

      {/* ─── TAB 1: FEEDBACK & REPLIES ────────────────────────────────────────── */}
      {activeTab === "feedback" && (
        <div className="space-y-6">
          {/* Controls Bar: Filters, Search, Sort */}
          <div className="bg-[#0c0c0e]/90 border border-white/[0.06] p-4 sm:p-5 rounded-2xl sm:rounded-3xl space-y-4 shadow-xl">
            
            {/* Search and Sort row */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search Box */}
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email, username, or message text..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-sp-green transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2 shrink-0">
                <ArrowUpDown size={13} className="text-white/30 shrink-0" />
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full sm:w-auto bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sp-green"
                >
                  <option value="newest" className="bg-[#111]">Newest First</option>
                  <option value="oldest" className="bg-[#111]">Oldest First</option>
                  <option value="pending_first" className="bg-[#111]">Pending First</option>
                </select>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-white/[0.04]">
              {/* Status Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider font-mono mr-1">Status:</span>
                {[
                  { value: "all", label: "All" },
                  { value: "pending", label: "Pending" },
                  { value: "replied", label: "Replied" },
                  { value: "closed", label: "Closed" },
                ].map((opt) => {
                  const active = filterStatus === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFilterStatus(opt.value)}
                      className={`px-3 py-1.5 sm:py-1 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 ${
                        active
                          ? "bg-sp-green text-black shadow-md shadow-sp-green/10"
                          : "bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Category Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider font-mono mr-1">Category:</span>
                {[
                  { value: "all", label: "All" },
                  { value: "bug", label: "Bugs" },
                  { value: "suggestion", label: "Suggestions" },
                  { value: "other", label: "Other" },
                ].map((opt) => {
                  const active = filterCategory === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFilterCategory(opt.value)}
                      className={`px-3 py-1.5 sm:py-1 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all duration-200 ${
                        active
                          ? "bg-sp-green text-black shadow-md shadow-sp-green/10"
                          : "bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Feedback List Content */}
          {loadingList ? (
            <div className="py-20 flex justify-center">
              <span className="w-7 h-7 border-2 border-sp-green border-t-transparent rounded-full animate-spin" />
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="py-16 text-center text-xs text-white/30 italic border border-dashed border-white/10 rounded-2xl p-6">
              No feedback submissions found matching active filters.
            </div>
          ) : (
            <div className="space-y-4">
              {feedbackList.map((fb) => {
                const isExpanded = expandedFeedback.has(fb._id);
                const isAuditOpen = expandedAuditLogs.has(fb._id);
                const isReplied = fb.reply || fb.status === "replied";
                const isClosed = fb.status === "closed" || fb.status === "resolved" || fb.status === "wontfix";

                return (
                  <div
                    key={fb._id}
                    className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-[#0a0a0c] border transition-all duration-200 shadow-lg ${
                      isReplied
                        ? "border-violet-500/25 bg-violet-500/[0.015]"
                        : isClosed
                        ? "border-white/[0.05]"
                        : "border-amber-500/25 bg-amber-500/[0.01]"
                    }`}
                  >
                    {/* Top Meta Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Category Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider uppercase ${
                            fb.category === "bug"
                              ? "bg-sp-rose/10 text-sp-rose"
                              : fb.category === "suggestion"
                              ? "bg-sp-green/10 text-sp-green"
                              : "bg-purple-500/10 text-purple-300"
                          }`}
                        >
                          {fb.category}
                        </span>

                        {/* Status Badge */}
                        {isClosed ? (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-white/50 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Closed
                          </span>
                        ) : isReplied ? (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                            <ShieldCheck size={10} /> Replied
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Clock size={10} /> Pending
                          </span>
                        )}

                        {/* Submission Date */}
                        <span className="text-[10px] text-white/30 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(fb.createdAt).toLocaleDateString()} at{" "}
                          {new Date(fb.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                        {/* Reply / Edit Reply button */}
                        <button
                          type="button"
                          onClick={() => openReplyModal(fb)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all duration-200 ${
                            isReplied
                              ? "bg-violet-500/20 hover:bg-violet-500 text-violet-300 hover:text-white border border-violet-500/30"
                              : "bg-sp-green text-black hover:bg-white shadow-md shadow-sp-green/10"
                          }`}
                        >
                          <Edit3 size={12} />
                          {isReplied ? "Edit Reply" : "Reply"}
                        </button>

                        {/* Delete Reply button */}
                        {isReplied && (
                          <button
                            type="button"
                            onClick={() => handleDeleteReply(fb._id)}
                            className="px-3 py-1.5 rounded-xl bg-sp-rose/10 hover:bg-sp-rose text-sp-rose hover:text-white border border-sp-rose/25 text-[10px] font-extrabold uppercase tracking-wider transition-all"
                            title="Delete reply"
                          >
                            Delete Reply
                          </button>
                        )}

                        {/* Mark Closed button */}
                        {!isClosed && (
                          <button
                            type="button"
                            onClick={() => handleCloseFeedback(fb._id)}
                            className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 text-white/60 hover:text-white border border-white/10 text-[10px] font-extrabold uppercase tracking-wider transition-all"
                          >
                            Mark Closed
                          </button>
                        )}

                        {/* Permanent Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteFeedback(fb._id)}
                          className="p-2 rounded-xl bg-sp-rose/10 hover:bg-sp-rose text-sp-rose hover:text-white border border-sp-rose/25 transition-all"
                          title="Delete feedback permanently"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Submitter details pill */}
                    <div className="text-[11px] text-white/50 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 bg-white/[0.015] p-3 rounded-xl border border-white/[0.03]">
                      <span className="font-bold text-white/80">
                        User: {fb.isAnonymous ? "Anonymous User" : fb.userId?.name || "Registered User"}
                      </span>
                      {!fb.isAnonymous && fb.userId?.email && (
                        <span className="text-white/40">Email: {fb.userId.email}</span>
                      )}
                      {!fb.isAnonymous && fb.userId?.username && (
                        <span className="text-white/40">@{fb.userId.username}</span>
                      )}
                      <span className="text-white/30 font-mono">
                        Platform: {fb.platform} • v{fb.appVersion}
                      </span>
                    </div>

                    {/* Message Body */}
                    <div className="relative mb-3">
                      <p
                        onClick={() => toggleExpandFeedback(fb._id)}
                        className={`text-xs sm:text-sm text-white/90 leading-relaxed cursor-pointer select-text ${
                          isExpanded ? "" : "line-clamp-3"
                        }`}
                      >
                        {fb.message}
                      </p>
                      {fb.message.length > 180 && (
                        <button
                          onClick={() => toggleExpandFeedback(fb._id)}
                          className="mt-1 text-[10px] font-black text-sp-green hover:underline flex items-center gap-0.5"
                        >
                          {isExpanded ? (
                            <>
                              Collapse <ChevronUp size={10} />
                            </>
                          ) : (
                            <>
                              Expand Message <ChevronDown size={10} />
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Admin Reply Support Bubble */}
                    {fb.reply && (
                      <div className="mt-3 p-4 rounded-2xl bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border border-violet-500/25 shadow-inner">
                        <div className="flex items-center justify-between text-[10px] text-violet-300 font-bold mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <ShieldCheck size={13} className="text-sp-green" />
                            SoulSync Support ({fb.repliedBy || "Admin"})
                          </span>
                          <span>
                            {fb.replyAt ? new Date(fb.replyAt).toLocaleDateString() : ""}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{fb.reply}</p>
                      </div>
                    )}

                    {/* Audit Log Accordion */}
                    {fb.auditLogs && fb.auditLogs.length > 0 && (
                      <div className="mt-3 border-t border-white/[0.04] pt-2.5">
                        <button
                          onClick={() => toggleExpandAuditLogs(fb._id)}
                          className="text-[10px] font-bold text-white/40 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <History size={10} />
                          Audit Trail ({fb.auditLogs.length} events)
                          {isAuditOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>

                        {isAuditOpen && (
                          <div className="mt-2 space-y-1.5 bg-black/50 p-3 rounded-xl border border-white/[0.03] max-h-48 overflow-y-auto scrollbar-thin">
                            {fb.auditLogs.map((log, idx) => (
                              <div key={idx} className="text-[10px] text-white/50 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 truncate">
                                  <CornerDownRight size={9} className="text-sp-green shrink-0" />
                                  <strong className="text-white/70 uppercase shrink-0">{log.action}:</strong> 
                                  <span className="truncate">{log.details || log.action} by {log.performedBy}</span>
                                </span>
                                <span className="font-mono text-white/30 shrink-0">
                                  {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: ANNOUNCEMENTS ────────────────────────────────────────────── */}
      {activeTab === "announcements" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Announcement Form */}
          <div className="lg:col-span-1 bg-[#0c0c0e]/90 border border-white/[0.06] p-5 sm:p-6 rounded-3xl h-fit shadow-xl">
            <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
              <Megaphone size={16} className="text-sp-green" />
              {editingAnnId ? "Edit Announcement" : "New Announcement"}
            </h3>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-1">
                  Type
                </label>
                <select
                  value={annForm.type}
                  onChange={(e) => setAnnForm({ ...annForm, type: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sp-green"
                >
                  <option value="whats_new" className="bg-[#111]">What's New</option>
                  <option value="feature_spotlight" className="bg-[#111]">Feature Spotlight</option>
                  <option value="maintenance" className="bg-[#111]">Maintenance</option>
                  <option value="general" className="bg-[#111]">General</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  placeholder="Release headline..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-sp-green"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-1">
                  Body *
                </label>
                <textarea
                  value={annForm.body}
                  onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })}
                  placeholder="Details about what's new..."
                  rows={4}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-sp-green"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={annForm.version}
                    onChange={(e) => setAnnForm({ ...annForm, version: e.target.value })}
                    placeholder="v2.5.0"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-sp-green font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-1">
                    Priority
                  </label>
                  <input
                    type="number"
                    value={annForm.priority}
                    onChange={(e) => setAnnForm({ ...annForm, priority: parseInt(e.target.value) || 0 })}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-sp-green"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-1">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={annForm.ctaText}
                    onChange={(e) => setAnnForm({ ...annForm, ctaText: e.target.value })}
                    placeholder="Explore Now"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sp-green"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider block mb-1">
                    CTA Route
                  </label>
                  <input
                    type="text"
                    value={annForm.ctaRoute}
                    onChange={(e) => setAnnForm({ ...annForm, ctaRoute: e.target.value })}
                    placeholder="/settings"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-sp-green"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="ann-active"
                  checked={annForm.active}
                  onChange={(e) => setAnnForm({ ...annForm, active: e.target.checked })}
                  className="rounded accent-sp-green"
                />
                <label htmlFor="ann-active" className="text-xs text-white/70 font-semibold cursor-pointer">
                  Active immediately
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="submit"
                  disabled={submittingAnn}
                  className="flex-1 py-3 rounded-xl bg-sp-green text-black font-extrabold text-xs uppercase tracking-wider hover:bg-white transition-colors shadow-lg shadow-sp-green/20"
                >
                  {submittingAnn ? "Saving..." : editingAnnId ? "Update" : "Publish"}
                </button>
                {editingAnnId && (
                  <button
                    type="button"
                    onClick={resetAnnForm}
                    className="px-4 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Announcements List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-base font-black text-white mb-4">Published Announcements ({announcementsList.length})</h3>
            {announcementsList.map((ann) => (
              <div
                key={ann._id}
                className="p-5 rounded-2xl bg-[#0a0a0c] border border-white/[0.06] flex items-start justify-between gap-4 shadow-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-sp-green/10 text-sp-green">
                      {ann.type}
                    </span>
                    {ann.version && (
                      <span className="text-[10px] text-white/40 font-mono">{ann.version}</span>
                    )}
                    <span className={`text-[10px] font-bold ${ann.active ? "text-sp-green" : "text-white/30"}`}>
                      • {ann.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white">{ann.title}</h4>
                  <p className="text-xs text-white/60 leading-relaxed">{ann.body}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleEditAnnouncement(ann)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteAnnouncement(ann._id)}
                    className="p-2 rounded-xl bg-sp-rose/10 hover:bg-sp-rose text-sp-rose hover:text-white border border-sp-rose/20"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── SCROLLABLE RESPONSIVE REPLY MODAL ───────────────────────────────── */}
      {replyModalOpen && selectedFeedback && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-2xl bg-[#0c0c0e] border border-white/10 rounded-[28px] p-5 sm:p-6 shadow-2xl space-y-4 overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col my-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-300 shrink-0">
                  <Send size={16} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    {isEditingReply ? "Edit Support Reply" : "Reply to Feedback"}
                  </h3>
                  <p className="text-xs text-white/40">The user will receive this reply inside SoulSync</p>
                </div>
              </div>
              <button
                onClick={() => setReplyModalOpen(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Modal Content Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              {/* Context Feedback Snippet */}
              <div className="bg-white/[0.02] border border-white/[0.06] p-4 rounded-2xl space-y-2">
                <div className="flex flex-wrap items-center justify-between text-[10px] text-white/40 gap-2">
                  <span className="font-bold text-white/80">
                    From: {selectedFeedback.isAnonymous ? "Anonymous User" : selectedFeedback.userId?.email || selectedFeedback.userId?.name || "Registered User"}
                  </span>
                  <span>{new Date(selectedFeedback.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-xs text-white/80 line-clamp-3">{selectedFeedback.message}</p>
              </div>

              {/* Quick Reply Templates */}
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">
                  ⚡ Quick Reply Templates
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REPLY_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setReplyInput(tmpl)}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.03] hover:bg-violet-500/20 text-white/70 hover:text-violet-200 border border-white/[0.06] hover:border-violet-500/30 text-[11px] font-medium transition-all"
                    >
                      + {tmpl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[10px] font-bold text-white/40 uppercase tracking-wider">
                  <span>Support Response *</span>
                  <span className={replyInput.length > 2000 ? "text-sp-rose font-bold" : "text-white/40 font-mono"}>
                    {replyInput.length} / 2000 chars
                  </span>
                </div>
                <textarea
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  placeholder="Type your response to the user..."
                  rows={4}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3.5 text-xs text-white placeholder-white/20 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>

              {/* Live Preview */}
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1.5">
                  👁️ Live Preview (User Support Bubble)
                </label>
                <div className="bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4 rounded-2xl border border-violet-500/25 shadow-inner">
                  <div className="flex items-center justify-between text-[10px] text-violet-300 font-bold mb-1">
                    <span className="flex items-center gap-1.5 text-violet-200">
                      <ShieldCheck size={13} className="text-sp-green" />
                      SoulSync Support
                    </span>
                    <span>Just now</span>
                  </div>
                  <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">
                    {replyInput.trim() || <span className="italic text-white/30">Your response preview will appear here...</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => setReplyModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendReply}
                disabled={submittingReply || !replyInput.trim() || replyInput.length > 2000}
                className="px-6 py-2.5 rounded-xl bg-sp-green text-black font-extrabold text-xs uppercase tracking-wider hover:bg-white transition-colors shadow-lg shadow-sp-green/20 disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={13} />
                {submittingReply ? "Sending..." : isEditingReply ? "Update Reply" : "Send Reply"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      </div>
    </div>
  );
}
