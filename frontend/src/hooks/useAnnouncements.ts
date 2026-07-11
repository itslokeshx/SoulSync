import { useEffect, useCallback } from "react";
import axios from "axios";
import { useAnnouncementStore } from "../store/announcementStore";
import {
  getLastSeenWhatsNewVersion,
  setLastSeenWhatsNewVersion as saveLastSeenVersion,
  getSeenAnnouncementIds,
  addSeenAnnouncementId as saveSeenId,
} from "../utils/announcementStorage";
import { getCurrentVersion } from "../utils/updateChecker";
import { isNative } from "../utils/platform";

const API = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 60 seconds

export function useAnnouncements() {
  const {
    announcements,
    seenIds,
    lastSeenVersion,
    isModalOpen,
    activeModalAnnouncement,
    isPanelOpen,
    loading,
    setAnnouncements,
    setSeenIds,
    setLastSeenVersion,
    openModal,
    closeModal,
    togglePanel,
    setPanelOpen,
    setLoading,
    setShownAutoPopupThisSession,
  } = useAnnouncementStore();

  const markSeen = useCallback(async (id: string) => {
    await saveSeenId(id);
    const updatedSeen = await getSeenAnnouncementIds();
    setSeenIds(updatedSeen);
  }, [setSeenIds]);

  const markWhatsNewSeen = useCallback(async (version: string) => {
    await saveLastSeenVersion(version);
    setLastSeenVersion(version);
  }, [setLastSeenVersion]);

  const evaluateAutoPopup = useCallback(async (activeList: any[]) => {
    if (useAnnouncementStore.getState().hasShownAutoPopupThisSession) {
      return;
    }

    const currentVersion = await getCurrentVersion();
    const localSeenVersion = await getLastSeenWhatsNewVersion();
    const localSeenIds = await getSeenAnnouncementIds();

    setLastSeenVersion(localSeenVersion);
    setSeenIds(localSeenIds);

    // 1. Eligible Whats New
    const eligibleWhatsNew = activeList.find(
      (a) =>
        a.type === "whats_new" &&
        a.version === currentVersion &&
        localSeenVersion !== currentVersion
    );

    // 2. Eligible Ad-hoc (Feature, General, Maintenance)
    const eligibleAdHoc = activeList.find(
      (a) =>
        ["feature", "general", "maintenance"].includes(a.type) &&
        !localSeenIds.includes(a._id)
    );

    let winner = null;

    if (eligibleWhatsNew && eligibleAdHoc) {
      // Compare priority first
      if (eligibleWhatsNew.priority !== eligibleAdHoc.priority) {
        winner = eligibleWhatsNew.priority > eligibleAdHoc.priority ? eligibleWhatsNew : eligibleAdHoc;
      } else {
        // Compare createdAt
        const whatsNewTime = new Date(eligibleWhatsNew.createdAt).getTime();
        const adHocTime = new Date(eligibleAdHoc.createdAt).getTime();
        winner = whatsNewTime >= adHocTime ? eligibleWhatsNew : eligibleAdHoc;
      }
    } else {
      winner = eligibleWhatsNew || eligibleAdHoc || null;
    }

    if (winner) {
      // Auto popup with delay
      setTimeout(() => {
        openModal(winner);
        setShownAutoPopupThisSession(true);
        // If it's ad-hoc, mark it as seen automatically since it's displayed
        if (winner.type !== "whats_new") {
          markSeen(winner._id);
        }
      }, 1500);
    }
  }, [openModal, setShownAutoPopupThisSession, setLastSeenVersion, setSeenIds, markSeen]);

  const fetchActiveAnnouncements = useCallback(async (force = false) => {
    // Avoid double fetching / spamming
    if (!force && Date.now() - lastFetchTime < CACHE_DURATION && announcements.length > 0) {
      await evaluateAutoPopup(announcements);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/announcements/active`, {
        timeout: 5000,
      });
      const active = res.data?.announcements || [];
      setAnnouncements(active);
      lastFetchTime = Date.now();
      await evaluateAutoPopup(active);
    } catch (err) {
      console.warn("[Announcements] Fetch failed silently (offline/network error):", err);
      // Fallback: evaluate auto-popup with already cached list if we have it
      if (announcements.length > 0) {
        await evaluateAutoPopup(announcements);
      }
    } finally {
      setLoading(false);
    }
  }, [announcements, setAnnouncements, setLoading, evaluateAutoPopup]);

  // Hook initialization
  useEffect(() => {
    // Fetch on mount
    fetchActiveAnnouncements();

    // Fetch on app resume (Capacitor native)
    let listener: any = null;
    const registerResumeListener = async () => {
      if (isNative()) {
        const { App } = await import("@capacitor/app");
        listener = await App.addListener("resume", () => {
          fetchActiveAnnouncements(true);
        });
      }
    };
    registerResumeListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [fetchActiveAnnouncements]);

  // Calculate unread count (active ad-hoc announcements not in seenIds)
  const unreadCount = announcements.filter(
    (a) =>
      ["feature", "general", "maintenance"].includes(a.type) &&
      !seenIds.includes(a._id)
  ).length;

  return {
    announcements,
    seenIds,
    lastSeenVersion,
    isModalOpen,
    activeModalAnnouncement,
    isPanelOpen,
    loading,
    unreadCount,
    fetchActiveAnnouncements,
    markSeen,
    markWhatsNewSeen,
    closeModal,
    togglePanel,
    setPanelOpen,
  };
}
