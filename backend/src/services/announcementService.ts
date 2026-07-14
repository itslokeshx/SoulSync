import { Announcement } from "../models/Announcement.js";
import { User } from "../models/User.js";
import { cache } from "./cache.js";

const CACHE_KEY = "announcements:active";

export const AnnouncementService = {
  async markWhatsNewSeen(userId: string, version: string): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) return false;
    user.lastSeenWhatsNewVersion = version;
    await user.save();
    return true;
  },

  async markAnnouncementSeen(userId: string, announcementId: string): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) return false;
    const alreadySeen = user.seenAnnouncements.some((s) => s.announcementId === announcementId);
    if (!alreadySeen) {
      user.seenAnnouncements.push({ announcementId, seenAt: new Date() });
      await user.save();
    }
    return true;
  },

  async getActiveAnnouncements(): Promise<any[]> {
    const cached = await cache.get<{ announcements: any[] }>(CACHE_KEY);
    if (cached && cached.announcements) {
      return cached.announcements;
    }

    const now = new Date();
    const activeList = await Announcement.find({
      active: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } },
      ],
    }).sort({ priority: -1, createdAt: -1 });

    await cache.set(CACHE_KEY, { announcements: activeList }, 3600); // 1 hour cache
    return activeList;
  },

  async getAnnouncementStateForUser(userId: string, activeList: any[]) {
    const user = await User.findById(userId);
    if (!user) return null;
    return {
      announcements: activeList,
      seenAnnouncements: user.seenAnnouncements.map((s) => s.announcementId),
      lastSeenWhatsNewVersion: user.lastSeenWhatsNewVersion,
    };
  },

  async getAllAnnouncements(): Promise<any[]> {
    return Announcement.find({}).sort({ createdAt: -1 });
  },

  async createAnnouncement(data: any) {
    const created = await Announcement.create(data);
    await cache.del(CACHE_KEY);
    return created;
  },

  async updateAnnouncement(id: string, updates: any) {
    const updated = await Announcement.findByIdAndUpdate(id, updates, { new: true });
    if (updated) {
      await cache.del(CACHE_KEY);
    }
    return updated;
  },

  async deleteAnnouncement(id: string) {
    const deleted = await Announcement.findByIdAndDelete(id);
    if (deleted) {
      await cache.del(CACHE_KEY);
    }
    return deleted;
  }
};
