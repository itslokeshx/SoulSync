import { Feedback } from "../models/Feedback.js";
import mongoose from "mongoose";

async function sendNtfyNotification(feedback: any) {
  try {
    const rawUrl = process.env.NTFY_URL || "https://ntfy.sh";
    const rawTopic = process.env.NTFY_TOPIC;
    
    // Extract topic and endpoint URL cleanly
    let topic = rawTopic;
    let targetUrl = rawUrl.trim();

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = `https://${targetUrl}`;
    }

    const urlObj = new URL(targetUrl);
    const pathSegments = urlObj.pathname.split("/").filter(Boolean);

    if (!topic) {
      if (pathSegments.length > 0) {
        topic = pathSegments[pathSegments.length - 1];
      } else {
        topic = "soulsync";
      }
    }

    const categoryUpper = (feedback.category || "feedback").toUpperCase();
    const iconTag = feedback.category === "bug" ? "bug" : feedback.category === "suggestion" ? "bulb" : "speech_balloon";
    
    let userLabel = "Anonymous User";
    if (feedback.userId) {
      if (typeof feedback.userId === "object" && feedback.userId.email) {
        userLabel = `${feedback.userId.name || "User"} (${feedback.userId.email})`;
      } else {
        userLabel = `User ID: ${feedback.userId}`;
      }
    }

    const title = `SoulSync Feedback [${categoryUpper}]`;
    const message = `🎵 SoulSync Feedback [${categoryUpper}]\nFrom: ${userLabel}\nPlatform: ${feedback.platform || "Web"} (v${feedback.appVersion || "1.0.0"})\n\n"${feedback.message}"`;

    const headers: Record<string, string> = {
      "User-Agent": "SoulSync-Backend/5.0 (+https://soulsync.app)",
    };

    if (process.env.NTFY_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.NTFY_TOKEN.trim()}`;
    } else if (process.env.NTFY_AUTH) {
      const auth = process.env.NTFY_AUTH.trim();
      headers["Authorization"] = auth.startsWith("Basic ") || auth.startsWith("Bearer ")
        ? auth
        : `Basic ${Buffer.from(auth).toString("base64")}`;
    }

    // JSON Publishing endpoint on ntfy (e.g. https://ntfy.sh/) requires root server URL
    const jsonServerUrl = `${urlObj.protocol}//${urlObj.host}/`;
    const payload = {
      topic: topic,
      title: title,
      message: message,
      priority: feedback.category === "bug" ? 4 : 3,
      tags: ["incoming_envelope", iconTag],
    };

    let sent = false;

    // Method 1: JSON Publishing to ntfy server root
    try {
      const resp = await fetch(jsonServerUrl, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        sent = true;
        console.log(`[Ntfy] Feedback notification successfully sent to topic '${topic}' via JSON API (${jsonServerUrl})`);
      } else {
        const errText = await resp.text().catch(() => "");
        console.warn(`[Ntfy] JSON publish to ${jsonServerUrl} returned status ${resp.status}: ${errText}. Retrying with topic header POST...`);
      }
    } catch (e) {
      console.warn(`[Ntfy] JSON publish to ${jsonServerUrl} failed:`, e);
    }

    // Method 2: Header-based POST directly to topic URL if Method 1 didn't succeed
    if (!sent) {
      const topicUrl = `${urlObj.protocol}//${urlObj.host}/${topic}`;
      const respFallback = await fetch(topicUrl, {
        method: "POST",
        headers: {
          ...headers,
          "Title": title,
          "Priority": feedback.category === "bug" ? "high" : "default",
          "Tags": `incoming_envelope,${iconTag}`,
        },
        body: message,
      });

      if (!respFallback.ok) {
        const errFallback = await respFallback.text().catch(() => "");
        console.error(`[Ntfy] Fallback publish to ${topicUrl} failed (Status ${respFallback.status}): ${errFallback}`);
      } else {
        console.log(`[Ntfy] Feedback notification successfully sent to topic '${topic}' via Topic URL (${topicUrl})`);
      }
    }
  } catch (err) {
    console.error("[Ntfy] Exception while sending feedback notification:", err);
  }
}

export const FeedbackService = {
  async createFeedback(data: {
    message: string;
    category: string;
    userId?: string;
    isAnonymous: boolean;
    appVersion: string;
    platform: string;
  }) {
    const created = await Feedback.create({
      ...data,
      status: "pending",
      replySeen: false,
    });

    const populated = await Feedback.findById(created._id).populate("userId", "name email username").lean();

    try {
      await sendNtfyNotification(populated || created);
    } catch (err) {
      console.error("[Ntfy Notification Error]", err);
    }

    return created;
  },

  async getFeedbackList(filterOptions: {
    status?: string;
    category?: string;
    search?: string;
    sort?: string;
  }) {
    const query: any = {};

    // Status filter
    if (filterOptions.status && filterOptions.status !== "all") {
      if (filterOptions.status === "pending") {
        query.status = { $in: ["pending", "new", "seen"] };
      } else if (filterOptions.status === "closed") {
        query.status = { $in: ["closed", "resolved", "wontfix"] };
      } else {
        query.status = filterOptions.status;
      }
    }

    // Category filter
    if (filterOptions.category && filterOptions.category !== "all") {
      query.category = filterOptions.category;
    }

    // Search filter across message, reply, or user details
    if (filterOptions.search && filterOptions.search.trim()) {
      const searchRegex = new RegExp(filterOptions.search.trim(), "i");
      query.$or = [
        { message: searchRegex },
        { reply: searchRegex },
        { repliedBy: searchRegex },
      ];
    }

    // Determine sorting order
    let sortObj: any = { createdAt: -1 };
    if (filterOptions.sort === "oldest") {
      sortObj = { createdAt: 1 };
    } else if (filterOptions.sort === "pending_first") {
      sortObj = { status: 1, createdAt: -1 };
    }

    let items = await Feedback.find(query)
      .sort(sortObj)
      .populate("userId", "name email username")
      .lean();

    // If search term is provided, also filter populated user fields (email, username, name)
    if (filterOptions.search && filterOptions.search.trim()) {
      const searchLower = filterOptions.search.trim().toLowerCase();
      items = items.filter((item: any) => {
        const msgMatch = item.message?.toLowerCase().includes(searchLower);
        const replyMatch = item.reply?.toLowerCase().includes(searchLower);
        const userObj = item.userId;
        const nameMatch = userObj?.name?.toLowerCase().includes(searchLower);
        const emailMatch = userObj?.email?.toLowerCase().includes(searchLower);
        const usernameMatch = userObj?.username?.toLowerCase().includes(searchLower);
        return msgMatch || replyMatch || nameMatch || emailMatch || usernameMatch;
      });
    }

    return items;
  },

  async replyToFeedback(id: string, replyText: string, adminIdentifier: string) {
    const feedback = await Feedback.findById(id);
    if (!feedback) return null;

    feedback.reply = replyText;
    feedback.replyAt = new Date();
    feedback.repliedBy = adminIdentifier;
    feedback.replySeen = false;
    feedback.status = "replied";

    if (!feedback.auditLogs) feedback.auditLogs = [];
    feedback.auditLogs.push({
      action: "reply",
      performedBy: adminIdentifier,
      timestamp: new Date(),
      details: `Replied to feedback`,
    });

    await feedback.save();
    return feedback;
  },

  async editReply(id: string, replyText: string, adminIdentifier: string) {
    const feedback = await Feedback.findById(id);
    if (!feedback) return null;

    feedback.reply = replyText;
    feedback.replyAt = new Date();
    feedback.repliedBy = adminIdentifier;
    feedback.replySeen = false;

    if (!feedback.auditLogs) feedback.auditLogs = [];
    feedback.auditLogs.push({
      action: "edit_reply",
      performedBy: adminIdentifier,
      timestamp: new Date(),
      details: `Updated reply content`,
    });

    await feedback.save();
    return feedback;
  },

  async deleteReply(id: string, adminIdentifier: string) {
    const feedback = await Feedback.findById(id);
    if (!feedback) return null;

    feedback.reply = undefined;
    feedback.replyAt = undefined;
    feedback.repliedBy = undefined;
    feedback.status = "pending";

    if (!feedback.auditLogs) feedback.auditLogs = [];
    feedback.auditLogs.push({
      action: "delete_reply",
      performedBy: adminIdentifier,
      timestamp: new Date(),
      details: `Deleted admin reply`,
    });

    await feedback.save();
    return feedback;
  },

  async closeFeedback(id: string, adminIdentifier: string) {
    const feedback = await Feedback.findById(id);
    if (!feedback) return null;

    feedback.status = "closed";

    if (!feedback.auditLogs) feedback.auditLogs = [];
    feedback.auditLogs.push({
      action: "close",
      performedBy: adminIdentifier,
      timestamp: new Date(),
      details: `Marked feedback as closed`,
    });

    await feedback.save();
    return feedback;
  },

  async getUserFeedbackHistory(userId: string) {
    return Feedback.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
  },

  async markReplySeen(id: string, userId: string) {
    return Feedback.findOneAndUpdate(
      { _id: id, userId: new mongoose.Types.ObjectId(userId) },
      { $set: { replySeen: true } },
      { new: true }
    );
  },

  async updateStatus(id: string, status: any) {
    return Feedback.findByIdAndUpdate(id, { status }, { new: true });
  },

  async deleteFeedback(id: string) {
    return Feedback.findByIdAndDelete(id);
  },
};
