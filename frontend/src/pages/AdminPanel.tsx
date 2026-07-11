import React, { useState, useEffect, useCallback } from "react";
import {
  Lock,
  MessageSquare,
  Megaphone,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Plus,
  Edit3,
  LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import * as api from "../api/backend";
import { Feedback } from "../types/feedback";

type Tab = "feedback" | "announcements";

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

  // Feedback filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

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

  // Initial check on mount to see if token exists in memory/session
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
      const fbData = await api.getFeedback();
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

  // Re-fetch when active tab, filters change
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === "feedback") {
        api.getFeedback(
          filterStatus === "all" ? undefined : filterStatus,
          filterCategory === "all" ? undefined : filterCategory
        )
          .then((data) => setFeedbackList(data.feedback || []))
          .catch((err) => console.error("Feedback fetch error:", err));
      } else {
        api.getAdminAnnouncements()
          .then((data) => setAnnouncementsList(data.announcements || []))
          .catch((err) => console.error("Announcement fetch error:", err));
      }
    }
  }, [activeTab, filterStatus, filterCategory, isAuthenticated]);

  // Feedback Handlers
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await api.updateFeedbackStatus(id, newStatus);
      if (res.success) {
        setFeedbackList((prev) =>
          prev.map((item) => (item._id === id ? { ...item, status: newStatus as any } : item))
        );
        toast.success(`Feedback updated to ${newStatus}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to update status.");
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

  // Announcement Form Handlers
  const handleAnnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annForm.title.trim() || !annForm.body.trim()) {
      toast.error("Title and Body are required.");
      return;
    }
    if (annForm.type === "whats_new" && !annForm.version.trim()) {
      toast.error("Version is required for 'What's New' type.");
      return;
    }

    setSubmittingAnn(true);
    try {
      const formattedData = {
        ...annForm,
        priority: Number(annForm.priority) || 0,
        expiresAt: annForm.expiresAt ? new Date(annForm.expiresAt).toISOString() : undefined,
      };

      if (editingAnnId) {
        const res = await api.updateAnnouncement(editingAnnId, formattedData);
        if (res.success) {
          toast.success("Announcement updated!");
          setAnnouncementsList((prev) =>
            prev.map((item) => (item._id === editingAnnId ? res.announcement : item))
          );
          resetAnnForm();
        }
      } else {
        const res = await api.createAnnouncement(formattedData);
        if (res.success) {
          toast.success("Announcement published!");
          setAnnouncementsList((prev) => [res.announcement, ...prev]);
          resetAnnForm();
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to save announcement.");
    } finally {
      setSubmittingAnn(false);
    }
  };

  const resetAnnForm = () => {
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
    setEditingAnnId(null);
  };

  const handleEditAnn = (ann: any) => {
    setEditingAnnId(ann._id);
    setAnnForm({
      type: ann.type || "whats_new",
      title: ann.title || "",
      body: ann.body || "",
      version: ann.version || "",
      ctaText: ann.ctaText || "",
      ctaRoute: ann.ctaRoute || "",
      imageUrl: ann.imageUrl || "",
      active: ann.active !== undefined ? ann.active : true,
      priority: ann.priority || 0,
      expiresAt: ann.expiresAt ? new Date(ann.expiresAt).toISOString().split("T")[0] : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleAnnActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await api.updateAnnouncement(id, { active: !currentActive });
      if (res.success) {
        setAnnouncementsList((prev) =>
          prev.map((item) => (item._id === id ? { ...item, active: !currentActive } : item))
        );
        toast.success(`Announcement ${!currentActive ? "activated" : "deactivated"}`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to toggle active state.");
    }
  };

  // Get count of 'new' feedback items
  const newFeedbackCount = feedbackList.filter((fb) => fb.status === "new").length;

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-sp-dark flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-sp-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── LOGIN PANEL ───────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-sp-dark flex items-center justify-center p-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-sp-card border border-white/10 rounded-[28px] p-8 shadow-2xl flex flex-col items-center gap-6"
        >
          <div className="w-12 h-12 rounded-2xl bg-sp-green/10 flex items-center justify-center text-sp-green">
            <Lock size={22} />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-black text-white">Admin Gate</h2>
            <p className="text-xs text-white/40 mt-1">
              Enter password to access admin console
            </p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Secret Key"
            className="w-full bg-white/[0.03] border border-white/5 focus:border-sp-green/50 rounded-xl p-3 text-center text-sm text-white placeholder-white/20 focus:outline-none transition-all duration-200"
            autoFocus
          />
          <button
            type="submit"
            disabled={loggingIn || !password.trim()}
            className="w-full py-3 rounded-xl bg-sp-green text-black font-extrabold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-100 transition-all duration-200 flex justify-center items-center"
          >
            {loggingIn ? (
              <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              "Access Console"
            )}
          </button>
        </form>
      </div>
    );
  }

  // ─── ADMIN DASHBOARD PANEL ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-sp-dark text-white p-6 max-w-5xl mx-auto pb-32">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Admin Console</h1>
          <p className="text-xs text-white/40 mt-0.5 font-mono">SoulSync Hidden System Panel</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 text-white/60 hover:text-red-400 text-xs font-bold transition-all duration-200 w-fit"
        >
          <LogOut size={13} /> Log Out
        </button>
      </div>

      {/* Tabs Menu */}
      <div className="flex gap-2 mb-6 border-b border-white/[0.04] pb-px">
        <button
          onClick={() => setActiveTab("feedback")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 ${
            activeTab === "feedback"
              ? "border-sp-green text-sp-green"
              : "border-transparent text-white/40 hover:text-white/80"
          }`}
        >
          <MessageSquare size={14} />
          Feedback
          {newFeedbackCount > 0 && (
            <span className="ml-1 bg-sp-rose text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
              {newFeedbackCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("announcements")}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all duration-200 ${
            activeTab === "announcements"
              ? "border-sp-green text-sp-green"
              : "border-transparent text-white/40 hover:text-white/80"
          }`}
        >
          <Megaphone size={14} />
          Announcements
        </button>
      </div>

      {/* ─── TAB 1: FEEDBACK LIST ────────────────────────────────────────────── */}
      {activeTab === "feedback" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-wrap gap-3 bg-white/[0.01] border border-white/[0.04] p-4 rounded-2xl">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider font-mono">Status</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white/[0.04] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sp-green/30"
              >
                <option value="all">All Statuses</option>
                <option value="new">New</option>
                <option value="seen">Seen</option>
                <option value="resolved">Resolved</option>
                <option value="wontfix">Wontfix</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-bold text-white/30 tracking-wider font-mono">Category</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-white/[0.04] border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sp-green/30"
              >
                <option value="all">All Categories</option>
                <option value="bug">Bug</option>
                <option value="suggestion">Suggestion</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* List content */}
          {loadingList ? (
            <div className="py-20 flex justify-center">
              <span className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : feedbackList.length === 0 ? (
            <div className="py-20 text-center text-xs text-white/20 italic border border-dashed border-white/10 rounded-2xl">
              No feedback submissions found matching active filters.
            </div>
          ) : (
            <div className="space-y-3">
              {feedbackList.map((fb) => {
                const isExpanded = expandedFeedback.has(fb._id);
                return (
                  <div
                    key={fb._id}
                    className={`p-5 rounded-2xl bg-white/[0.01] border transition-all duration-200 ${
                      fb.status === "new" ? "border-sp-rose/25 bg-sp-rose/[0.005]" : "border-white/[0.04]"
                    }`}
                  >
                    {/* Top Row: Meta & Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Category Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase ${
                            fb.category === "bug"
                              ? "bg-sp-rose/10 text-sp-rose"
                              : fb.category === "suggestion"
                              ? "bg-sp-green/10 text-sp-green"
                              : "bg-purple-500/10 text-purple-300"
                          }`}
                        >
                          {fb.category}
                        </span>

                        {/* Status Label */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-mono tracking-wider uppercase ${
                            fb.status === "new"
                              ? "bg-red-500/15 text-red-400 font-bold"
                              : fb.status === "seen"
                              ? "bg-sp-amber/15 text-sp-amber"
                              : fb.status === "resolved"
                              ? "bg-green-500/15 text-green-400"
                              : "bg-white/10 text-white/40"
                          }`}
                        >
                          {fb.status}
                        </span>

                        {/* Date */}
                        <span className="text-[10px] text-white/30 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(fb.createdAt).toLocaleDateString()} at{" "}
                          {new Date(fb.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {/* Dropdown status inline edit */}
                      <select
                        value={fb.status}
                        onChange={(e) => handleUpdateStatus(fb._id, e.target.value)}
                        className="bg-white/[0.03] border border-white/10 hover:border-white/20 rounded-lg px-2 py-1 text-[10px] text-white/70 focus:outline-none cursor-pointer"
                      >
                        <option value="new">New</option>
                        <option value="seen">Seen</option>
                        <option value="resolved">Resolved</option>
                        <option value="wontfix">Wontfix</option>
                      </select>
                    </div>

                    {/* Submitter details */}
                    <div className="text-[11px] text-white/50 mb-3 flex flex-wrap gap-x-3 gap-y-1 bg-white/[0.01] p-2 rounded-lg w-fit border border-white/[0.02]">
                      <span className="font-semibold text-white/70">
                        {fb.isAnonymous ? "Anonymous User" : fb.userId?.name || "Registered User"}
                      </span>
                      {!fb.isAnonymous && fb.userId?.email && (
                        <span className="text-white/30">{fb.userId.email}</span>
                      )}
                      <span className="text-white/30 font-mono">
                        Platform: {fb.platform} • Version: {fb.appVersion}
                      </span>
                    </div>

                    {/* Message Body */}
                    <div className="relative">
                      <p
                        onClick={() => toggleExpandFeedback(fb._id)}
                        className={`text-xs text-white/80 leading-relaxed cursor-pointer select-text ${
                          isExpanded ? "" : "line-clamp-3"
                        }`}
                      >
                        {fb.message}
                      </p>
                      {fb.message.length > 200 && (
                        <button
                          onClick={() => toggleExpandFeedback(fb._id)}
                          className="mt-2 text-[10px] font-black text-sp-green hover:underline flex items-center gap-0.5"
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: ANNOUNCEMENTS MANAGEMENT ───────────────────────────────── */}
      {activeTab === "announcements" && (
        <div className="space-y-8">
          {/* Creator Form */}
          <form
            onSubmit={handleAnnSubmit}
            className="p-6 rounded-[28px] bg-white/[0.01] border border-white/[0.04] space-y-4"
          >
            <h3 className="text-sm font-black text-white/80 uppercase tracking-widest flex items-center gap-1.5 mb-2 font-mono">
              <Plus size={14} />
              {editingAnnId ? "Edit Announcement" : "Create Announcement"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Type Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Type</label>
                <select
                  value={annForm.type}
                  onChange={(e) => setAnnForm({ ...annForm, type: e.target.value })}
                  className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30"
                >
                  <option value="whats_new">What's New</option>
                  <option value="feature">New Feature</option>
                  <option value="general">General Notification</option>
                  <option value="maintenance">Maintenance alert</option>
                </select>
              </div>

              {/* Version (Visible only if whats_new) */}
              {annForm.type === "whats_new" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">App Version</label>
                  <input
                    type="text"
                    value={annForm.version}
                    onChange={(e) => setAnnForm({ ...annForm, version: e.target.value })}
                    placeholder="e.g. 3.1.0"
                    className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30"
                  />
                </div>
              )}

              {/* Title */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Title</label>
                <input
                  type="text"
                  value={annForm.title}
                  onChange={(e) => setAnnForm({ ...annForm, title: e.target.value })}
                  placeholder="Announcement Title"
                  className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30"
                />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Body</label>
                <textarea
                  rows={4}
                  value={annForm.body}
                  onChange={(e) => setAnnForm({ ...annForm, body: e.target.value })}
                  placeholder="Detail text..."
                  className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30 resize-none"
                />
              </div>

              {/* Image URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Image URL (Optional)</label>
                <input
                  type="text"
                  value={annForm.imageUrl}
                  onChange={(e) => setAnnForm({ ...annForm, imageUrl: e.target.value })}
                  placeholder="https://..."
                  className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30"
                />
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Priority (Higher = First)</label>
                <input
                  type="number"
                  value={annForm.priority}
                  onChange={(e) => setAnnForm({ ...annForm, priority: Number(e.target.value) })}
                  className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30"
                />
              </div>

              {/* CTA Text */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">CTA Button Text (Optional)</label>
                <input
                  type="text"
                  value={annForm.ctaText}
                  onChange={(e) => setAnnForm({ ...annForm, ctaText: e.target.value })}
                  placeholder="e.g. Try Now"
                  className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30"
                />
              </div>

              {/* CTA Route */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">CTA Client Route (Optional)</label>
                <input
                  type="text"
                  value={annForm.ctaRoute}
                  onChange={(e) => setAnnForm({ ...annForm, ctaRoute: e.target.value })}
                  placeholder="e.g. /library"
                  className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30"
                />
              </div>

              {/* Expiry Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-white/40 tracking-wider">Expires At (Optional)</label>
                <input
                  type="date"
                  value={annForm.expiresAt}
                  onChange={(e) => setAnnForm({ ...annForm, expiresAt: e.target.value })}
                  className="bg-white/[0.04] border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-sp-green/30"
                />
              </div>

              {/* Active Checkbox */}
              <div className="flex items-center gap-3 pt-4">
                <input
                  type="checkbox"
                  id="active"
                  checked={annForm.active}
                  onChange={(e) => setAnnForm({ ...annForm, active: e.target.checked })}
                  className="w-4 h-4 rounded accent-sp-green bg-white/5 border-white/10"
                />
                <label htmlFor="active" className="text-xs font-bold text-white/80 cursor-pointer">
                  Active (Show to clients)
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-3">
              {editingAnnId && (
                <button
                  type="button"
                  onClick={resetAnnForm}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white/50 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] transition-all"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                disabled={submittingAnn}
                className="px-6 py-2.5 rounded-xl bg-sp-green text-black font-extrabold text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-100 transition-all duration-200"
              >
                {submittingAnn ? "Saving..." : editingAnnId ? "Update" : "Publish"}
              </button>
            </div>
          </form>

          {/* List of existing */}
          <div className="space-y-4">
            <h3 className="text-xs font-black text-white/40 uppercase tracking-widest font-mono">
              Published Announcements
            </h3>

            {announcementsList.length === 0 ? (
              <p className="text-xs text-white/30 italic">No announcements published yet.</p>
            ) : (
              <div className="space-y-3">
                {announcementsList.map((ann) => {
                  return (
                    <div
                      key={ann._id}
                      className={`p-5 rounded-2xl bg-white/[0.01] border flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all duration-200 ${
                        ann.active ? "border-white/[0.05]" : "border-white/5 opacity-60"
                      }`}
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-[9px] uppercase tracking-wider text-white/60 font-black font-mono">
                            {ann.type}
                          </span>
                          {!ann.active && (
                            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] uppercase tracking-wider text-white/40 font-mono">
                              Inactive
                            </span>
                          )}
                          {ann.version && (
                            <span className="text-[10px] text-sp-green font-mono">v{ann.version}</span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white leading-tight">{ann.title}</h4>
                        <p className="text-xs text-white/60 leading-relaxed font-sans">{ann.body}</p>
                      </div>

                      {/* Side Actions */}
                      <div className="flex sm:flex-col gap-2 items-center sm:items-end w-fit shrink-0">
                        {/* Toggle Active Button */}
                        <button
                          onClick={() => handleToggleAnnActive(ann._id, ann.active)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${
                            ann.active
                              ? "bg-red-500/10 text-red-400 hover:bg-red-500/15"
                              : "bg-green-500/10 text-green-400 hover:bg-green-500/15"
                          }`}
                        >
                          {ann.active ? "Deactivate" : "Activate"}
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleEditAnn(ann)}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all duration-200"
                        >
                          <Edit3 size={10} /> Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
