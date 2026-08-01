import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ShieldAlert, Sparkles, Megaphone } from "lucide-react";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { openUpdateLink } from "../UpdatePopup";

export function AnnouncementModal() {
  const { isModalOpen, activeModalAnnouncement, closeModal, markSeen, markWhatsNewSeen } = useAnnouncements();
  const navigate = useNavigate();

  // Mark immediately as seen on open to survive sudden app close/navigation
  useEffect(() => {
    if (isModalOpen && activeModalAnnouncement) {
      markSeen(activeModalAnnouncement._id);
      if (activeModalAnnouncement.type === "whats_new" && activeModalAnnouncement.version) {
        markWhatsNewSeen(activeModalAnnouncement.version);
      }
    }
  }, [isModalOpen, activeModalAnnouncement, markSeen, markWhatsNewSeen]);

  const handleClose = () => {
    if (!activeModalAnnouncement) return;
    if (activeModalAnnouncement.type === "whats_new" && activeModalAnnouncement.version) {
      markWhatsNewSeen(activeModalAnnouncement.version);
    }
    closeModal();
    if (window.history.state?.modal === "announcement") {
      window.history.back();
    }
  };

  const handleCTA = () => {
    if (!activeModalAnnouncement) return;
    if (activeModalAnnouncement.type === "whats_new" && activeModalAnnouncement.version) {
      markWhatsNewSeen(activeModalAnnouncement.version);
    }
    closeModal();
    if (window.history.state?.modal === "announcement") {
      window.history.back();
    }
    const route = activeModalAnnouncement.ctaRoute;
    if (route) {
      if (route.startsWith("http://") || route.startsWith("https://")) {
        openUpdateLink(route);
      } else {
        setTimeout(() => {
          navigate(route);
        }, 50);
      }
    }
  };

  useEffect(() => {
    if (!isModalOpen || !activeModalAnnouncement) return;

    // Push local state to handle hardware back button
    window.history.pushState({ modal: "announcement" }, "");

    const handlePopState = () => {
      if (activeModalAnnouncement.type === "whats_new" && activeModalAnnouncement.version) {
        markWhatsNewSeen(activeModalAnnouncement.version);
      }
      closeModal();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isModalOpen, activeModalAnnouncement, closeModal, markWhatsNewSeen]);

  if (!activeModalAnnouncement) return null;

  const getBadgeDetails = () => {
    switch (activeModalAnnouncement.type) {
      case "whats_new":
        return {
          label: `What's New • v${activeModalAnnouncement.version || ""}`,
          style: "bg-sp-green/10 text-sp-green",
          icon: Sparkles,
        };
      case "maintenance":
        return {
          label: "Maintenance",
          style: "bg-red-500/10 text-red-400",
          icon: ShieldAlert,
        };
      case "feature":
      case "feature_spotlight":
        return {
          label: "Feature Spotlight",
          style: "bg-blue-500/10 text-blue-400",
          icon: Sparkles,
        };
      default:
        return {
          label: "Announcement",
          style: "bg-white/[0.06] text-white/60",
          icon: Megaphone,
        };
    }
  };

  const badge = getBadgeDetails();
  const BadgeIcon = badge.icon;

  const modalContent = (
    <AnimatePresence>
      {isModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000]"
          />
          <div className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-fadeIn">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto flex flex-col"
            >
              {/* Banner Image */}
              {activeModalAnnouncement.imageUrl && (
                <div className="relative w-full aspect-[16/8] overflow-hidden border-b border-white/[0.04] bg-black/40 flex items-center justify-center">
                  <img
                    src={activeModalAnnouncement.imageUrl}
                    alt={activeModalAnnouncement.title}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between px-5 pt-5 pb-3">
                <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                  <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase w-fit ${badge.style}`}>
                    <BadgeIcon size={10} strokeWidth={2.5} />
                    {badge.label}
                  </div>
                  <h3 className="text-[17px] font-extrabold text-white leading-snug truncate">
                    {activeModalAnnouncement.title}
                  </h3>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full bg-white/[0.04] border border-white/10 hover:bg-white/[0.1] text-white/50 hover:text-white transition-all active:scale-90 ml-3 flex-shrink-0"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 pb-6 flex-1 overflow-y-auto max-h-[250px] thin-scrollbar">
                <p className="text-[13px] text-white/60 leading-relaxed white-space-pre-wrap select-text">
                  {activeModalAnnouncement.body}
                </p>
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/[0.04] bg-white/[0.01] flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-full bg-white/[0.06] border border-white/10 text-[13px] font-bold text-white/80 hover:text-white hover:bg-white/[0.1] transition-all duration-200 active:scale-95 text-center"
                >
                  Close
                </button>
                {(activeModalAnnouncement.ctaText || activeModalAnnouncement.ctaRoute) && (
                  <button
                    onClick={handleCTA}
                    className="flex-1 py-2.5 rounded-full bg-sp-green text-black font-extrabold text-[13px] hover:scale-[1.03] active:scale-95 transition-all duration-200 text-center"
                    style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.25)" }}
                  >
                    {activeModalAnnouncement.ctaText || (activeModalAnnouncement.type === "whats_new" ? "Update Now" : "Open Link")}
                  </button>
                )}
              </div>
            </motion.div>

            {/* Floating close button for easy thumb reach on mobile */}
            <button
              onClick={handleClose}
              className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto bg-[#1a1a1a]/95 border border-white/10 hover:bg-[#222] text-white/80 hover:text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.6)] active:scale-95 transition-all z-[10001]"
            >
              <X size={14} strokeWidth={2.5} /> Close
            </button>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
}
