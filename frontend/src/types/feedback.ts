export interface Feedback {
  _id: string;
  message: string;
  category: "bug" | "suggestion" | "other";
  userId?: {
    _id: string;
    name: string;
    email: string;
  };
  isAnonymous: boolean;
  appVersion: string;
  platform: "web" | "android" | "desktop";
  status: "new" | "seen" | "resolved" | "wontfix";
  createdAt: string;
}
