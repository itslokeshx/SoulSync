import { X, Bell, Sparkles, ShieldAlert, Megaphone } from "lucide-react";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import { useAnnouncementStore } from "../../store/announcementStore";
import { Announcement } from "../../types/announcement";

export function AnnouncementPanel() {
  const { announcements, seenIds, isPanelOpen, setPanelOpen, markSeen, markWhatsNewSeen } = useAnnouncements();
  const openModal = useAnnouncementStore((s) => s.openModal);

  if (!isPanelOpen) return null;

  const handleItemClick = (announcement: Announcement) => {
    openModal(announcement);
    markSeen(announcement._id);
    if (announcement.type === "whats_new" && announcement.version) {
      markWhatsNewSeen(announcement.version);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "whats_new":
        return <Sparkles size={13} className="text-sp-green" />;
      case "maintenance":
        return <ShieldAlert size={13} className="text-red-400" />;
      case "feature":
      case "feature_spotlight":
        return <Sparkles size={13} className="text-blue-400" />;
      default:
        return <Megaphone size={13} className="text-white/60" />;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "whats_new":
        return "What's New";
      case "maintenance":
        return "Maintenance";
      case "feature":
      case "feature_spotlight":
        return "Feature Spotlight";
      default:
        return "Notice";
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div
      className="fixed right-0 top-0 bottom-[7.5rem] md:bottom-20 w-full md:w-80 z-40 flex flex-col animate-slideInRight border-l border-white/[0.06] shadow-2xl"
      style={{
        background: "rgba(10,10,10,0.95)",
        backdropFilter: "blur(24px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <h3 className="font-semibold text-white text-[13px] flex items-center gap-2">
          <Bell size={14} className="text-white" /> Updates & News
        </h3>
        <button
          onClick={() => setPanelOpen(false)}
          className="text-white/30 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10"
        >
          <X size={16} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-3 space-y-2">
        {announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-5 opacity-40">
            <Bell size={36} strokeWidth={1.5} className="mb-3 text-white/50" />
            <p className="text-xs text-white/80">No updates or news yet</p>
          </div>
        ) : (
          announcements.map((a) => {
            const isSeen = seenIds.includes(a._id);
            return (
              <button
                key={a._id}
                onClick={() => handleItemClick(a)}
                className={`w-full flex flex-col gap-1.5 p-3.5 rounded-xl border transition-all text-left group ${
                  !isSeen
                    ? "bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.12]"
                    : "bg-transparent border-transparent hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-1.5">
                    {getIcon(a.type)}
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                      {getTypeName(a.type)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-white/30 font-semibold">
                      {formatDate(a.createdAt)}
                    </span>
                    {!isSeen && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sp-green shadow-[0_0_8px_rgba(29,185,84,0.6)]" />
                    )}
                  </div>
                </div>

                <div className="space-y-0.5">
                  <h4 className={`text-[13px] font-bold truncate group-hover:text-sp-green transition-colors ${!isSeen ? "text-white" : "text-white/60"}`}>
                    {a.title}
                  </h4>
                  <p className="text-[11px] text-white/40 line-clamp-2 leading-relaxed">
                    {a.body}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Close Button */}
      <div className="p-4 border-t border-white/[0.04] bg-white/[0.01]">
        <button
          onClick={() => setPanelOpen(false)}
          className="w-full py-2.5 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] text-white hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95"
        >
          <X size={12} strokeWidth={2.5} /> Close
        </button>
      </div>
    </div>
  );
}
