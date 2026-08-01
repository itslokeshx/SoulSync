export type AnnouncementType = "whats_new" | "feature" | "feature_spotlight" | "general" | "maintenance";

export interface Announcement {
  _id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  version?: string;
  ctaText?: string;
  ctaRoute?: string;
  imageUrl?: string;
  active: boolean;
  priority: number;
  createdAt: string;
  expiresAt?: string;
}
