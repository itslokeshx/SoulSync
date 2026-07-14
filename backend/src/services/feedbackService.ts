import { Feedback } from "../models/Feedback.js";

export const FeedbackService = {
  async createFeedback(data: {
    message: string;
    category: string;
    userId?: string;
    isAnonymous: boolean;
    appVersion: string;
    platform: string;
  }) {
    return Feedback.create({
      ...data,
      status: "new",
    });
  },

  async getFeedbackList(filter: { status?: string; category?: string }) {
    return Feedback.find(filter)
      .sort({ createdAt: -1 })
      .populate("userId", "name email")
      .lean();
  },

  async updateStatus(id: string, status: string) {
    return Feedback.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
  },

  async deleteFeedback(id: string) {
    return Feedback.findByIdAndDelete(id);
  }
};
