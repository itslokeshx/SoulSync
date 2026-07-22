export interface FeedbackAuditLog {
  action: "reply" | "edit_reply" | "delete_reply" | "close";
  performedBy: string;
  timestamp: string;
  details?: string;
}

export interface Feedback {
  _id: string;
  message: string;
  category: "bug" | "suggestion" | "other";
  userId?: {
    _id: string;
    name: string;
    email: string;
    username?: string;
  };
  isAnonymous: boolean;
  appVersion: string;
  platform: "web" | "android" | "desktop";
  status: "pending" | "replied" | "closed" | "new" | "seen" | "resolved" | "wontfix";
  reply?: string;
  replyAt?: string;
  repliedBy?: string;
  replySeen?: boolean;
  auditLogs?: FeedbackAuditLog[];
  createdAt: string;
}
