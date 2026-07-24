import { useEffect, useCallback, useRef } from "react";
import { useAnnouncementStore } from "../store/announcementStore";
import {
  getLastSeenWhatsNewVersion,
  setLastSeenWhatsNewVersion as saveLastSeenVersion,
  getSeenAnnouncementIds,
  addSeenAnnouncementId as saveSeenId,
} from "../utils/announcementStorage";
import { getCurrentVersion, compareVersions } from "../utils/updateChecker";
import { isNative } from "../utils/platform";
import { useAuth } from "../auth/AuthContext";
import {
  getActiveAnnouncements,
  markAnnouncementSeen,
  markWhatsNewVersionSeen,
} from "../api/backend";

const API = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");

let lastFetchTime = 0;
const CACHE_DURATION = 60000; // 60 seconds
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_STOP = 3;

export function useAnnouncements() {
  const { isAuthenticated } = useAuth();
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

  // Use a ref to avoid putting announcements in callback deps (which causes infinite re-render loops)
  const announcementsRef = useRef(announcements);
  announcementsRef.current = announcements;
  const hasFetched = useRef(false);

  const markSeen = useCallback(async (id: string) => {
    await saveSeenId(id);
    const updatedSeen = await getSeenAnnouncementIds();
    setSeenIds(updatedSeen);
    if (isAuthenticated) {
      try {
        await markAnnouncementSeen(id);
      } catch (err) {
        console.error("Failed to mark announcement seen on server:", err);
      }
    }
  }, [setSeenIds, isAuthenticated]);

  const markWhatsNewSeen = useCallback(async (version: string) => {
    await saveLastSeenVersion(version);
    setLastSeenVersion(version);
    if (isAuthenticated) {
      try {
        await markWhatsNewVersionSeen(version);
      } catch (err) {
        console.error("Failed to mark version seen on server:", err);
      }
    }
  }, [setLastSeenVersion, isAuthenticated]);

  const evaluateAutoPopup = useCallback(async (activeList: any[]) => {
    if (useAnnouncementStore.getState().hasShownAutoPopupThisSession) {
      return;
    }

    const currentVersion = await getCurrentVersion();
    const localSeenVersion = await getLastSeenWhatsNewVersion();
    const localSeenIds = await getSeenAnnouncementIds();

    setLastSeenVersion(localSeenVersion);
    setSeenIds(localSeenIds);

    const isNativeApp = isNative();

    // 1. Eligible Whats New / Release Announcement
    // Rules:
    // - Release update popups ONLY trigger on APK native app (isNativeApp === true)
    // - Must have a version specified
    // - User's current APK version MUST be strictly lower than the announcement version (compareVersions(currentVersion, a.version) === true)
    // - MUST NOT have been seen by ID or version already
    const eligibleWhatsNew = isNativeApp ? activeList.find(
      (a) =>
        a.type === "whats_new" &&
        a.version &&
        !localSeenIds.includes(a._id) &&
        (!localSeenVersion || compareVersions(localSeenVersion, a.version)) &&
        compareVersions(currentVersion, a.version)
    ) : null;

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
        // Mark it as seen by ID to prevent double popup
        markSeen(winner._id);
        if (winner.type === "whats_new" && winner.version) {
          markWhatsNewSeen(winner.version);
        }
      }, 1500);
    }
  }, [openModal, setShownAutoPopupThisSession, setLastSeenVersion, setSeenIds, markSeen, markWhatsNewSeen]);

  const fetchActiveAnnouncements = useCallback(async (force = false) => {
    // Stop retrying after consecutive failures (prevents console spam)
    if (!force && consecutiveFailures >= MAX_FAILURES_BEFORE_STOP) {
      return;
    }

    // Avoid double fetching / spamming
    const cached = announcementsRef.current;
    if (!force && Date.now() - lastFetchTime < CACHE_DURATION && cached.length > 0) {
      await evaluateAutoPopup(cached);
      return;
    }

    setLoading(true);
    try {
      const res = await getActiveAnnouncements();
      const active = res.announcements || [];
      setAnnouncements(active);
      lastFetchTime = Date.now();
      consecutiveFailures = 0; // Reset on success

      if (isAuthenticated) {
        const serverSeenIds = res.seenAnnouncements || [];
        const serverVersion = res.lastSeenWhatsNewVersion || "";

        const localSeenIds = await getSeenAnnouncementIds();
        const localSeenVersion = await getLastSeenWhatsNewVersion();

        const allSeenIds = Array.from(new Set([...localSeenIds, ...serverSeenIds]));

        // Reconcile missing local seen IDs
        const missingLocally = serverSeenIds.filter(id => !localSeenIds.includes(id));
        for (const id of missingLocally) {
          await saveSeenId(id);
        }

        // Reconcile missing server seen IDs
        const missingOnServer = localSeenIds.filter(id => !serverSeenIds.includes(id));
        for (const id of missingOnServer) {
          try {
            await markAnnouncementSeen(id);
          } catch (err) {
            console.error(`Failed to sync seen announcement ${id} to server:`, err);
          }
        }

        // Reconcile version
        if (serverVersion && (!localSeenVersion || compareVersions(localSeenVersion, serverVersion))) {
          await saveLastSeenVersion(serverVersion);
          setLastSeenVersion(serverVersion);
        } else if (localSeenVersion && (!serverVersion || compareVersions(serverVersion, localSeenVersion))) {
          try {
            await markWhatsNewVersionSeen(localSeenVersion);
          } catch (err) {
            console.error("Failed to sync seen version to server:", err);
          }
        }

        setSeenIds(allSeenIds);
      }

      await evaluateAutoPopup(active);
    } catch (err) {
      consecutiveFailures++;
      if (consecutiveFailures <= 1) {
        console.warn("[Announcements] Fetch failed (offline/network error) — will not retry further.", err);
      }
      // Fallback: evaluate auto-popup with already cached list if we have it
      if (cached.length > 0) {
        await evaluateAutoPopup(cached);
      }
    } finally {
      setLoading(false);
    }
  }, [setAnnouncements, setLoading, evaluateAutoPopup, isAuthenticated]);

  // Hook initialization — fetch only once on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchActiveAnnouncements();

    // Fetch on app resume (Capacitor native)
    let listener: any = null;
    const registerResumeListener = async () => {
      if (isNative()) {
        const { App } = await import("@capacitor/app");
        listener = await App.addListener("resume", () => {
          consecutiveFailures = 0; // Reset failures on resume
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate unread count (any active announcement whose ID is NOT in seenIds shows the notification dot)
  const unreadCount = announcements.filter((a) => !seenIds.includes(a._id)).length;

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
