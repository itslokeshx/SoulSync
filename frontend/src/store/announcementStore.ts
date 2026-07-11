import { create } from "zustand";
import { Announcement } from "../types/announcement";

interface AnnouncementState {
  announcements: Announcement[];
  seenIds: string[];
  lastSeenVersion: string;
  isModalOpen: boolean;
  activeModalAnnouncement: Announcement | null;
  isPanelOpen: boolean;
  loading: boolean;
  hasShownAutoPopupThisSession: boolean;
}

interface AnnouncementActions {
  setAnnouncements: (announcements: Announcement[]) => void;
  setSeenIds: (ids: string[]) => void;
  setLastSeenVersion: (version: string) => void;
  openModal: (announcement: Announcement) => void;
  closeModal: () => void;
  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  setShownAutoPopupThisSession: (shown: boolean) => void;
}

export const useAnnouncementStore = create<AnnouncementState & AnnouncementActions>((set) => ({
  announcements: [],
  seenIds: [],
  lastSeenVersion: "",
  isModalOpen: false,
  activeModalAnnouncement: null,
  isPanelOpen: false,
  loading: false,
  hasShownAutoPopupThisSession: false,

  setAnnouncements: (announcements) => set({ announcements }),
  setSeenIds: (seenIds) => set({ seenIds }),
  setLastSeenVersion: (lastSeenVersion) => set({ lastSeenVersion }),
  openModal: (announcement) => set({ isModalOpen: true, activeModalAnnouncement: announcement }),
  closeModal: () => set({ isModalOpen: false, activeModalAnnouncement: null }),
  togglePanel: () => set((s) => ({ isPanelOpen: !s.isPanelOpen })),
  setPanelOpen: (open) => set({ isPanelOpen: open }),
  setLoading: (loading) => set({ loading }),
  setShownAutoPopupThisSession: (shown) => set({ hasShownAutoPopupThisSession: shown }),
}));
