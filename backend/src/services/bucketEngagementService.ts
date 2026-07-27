import mongoose from "mongoose";
import { BucketEngagement } from "../models/BucketEngagement.js";

export interface BucketRatios {
  discoveryRatio: number;
  forgottenRatio: number;
  playlistRatio: number;
}

export const DEFAULT_BUCKET_RATIOS: BucketRatios = {
  discoveryRatio: 0.70,
  forgottenRatio: 0.20,
  playlistRatio: 0.10,
};

export async function recordBucketEngagement(
  userId: string,
  bucket: "discovery" | "forgotten" | "playlist",
  action: "played" | "skipped" | "ignored"
): Promise<void> {
  if (!userId || userId === "guest" || !mongoose.Types.ObjectId.isValid(userId)) return;

  try {
    const userObjId = new mongoose.Types.ObjectId(userId);
    const incField = `${action}Count`;
    await BucketEngagement.findOneAndUpdate(
      { userId: userObjId, bucket },
      {
        $inc: { [incField]: 1 },
        $set: { updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );
  } catch (err) {}
}

export async function getAdaptiveBucketRatios(userId?: string): Promise<BucketRatios> {
  if (!userId || userId === "guest" || !mongoose.Types.ObjectId.isValid(userId)) {
    return { ...DEFAULT_BUCKET_RATIOS };
  }

  try {
    const userObjId = new mongoose.Types.ObjectId(userId);
    const records = await BucketEngagement.find({ userId: userObjId }).lean();

    if (!records || records.length === 0) {
      return { ...DEFAULT_BUCKET_RATIOS };
    }

    const engagementMap = new Map<string, { played: number; skipped: number; ignored: number }>();
    let grandTotal = 0;

    for (const r of records) {
      const p = r.playedCount || 0;
      const s = r.skippedCount || 0;
      const i = r.ignoredCount || 0;
      const tot = p + s + i;
      grandTotal += tot;
      engagementMap.set(r.bucket, { played: p, skipped: s, ignored: i });
    }

    if (grandTotal < 5) {
      return { ...DEFAULT_BUCKET_RATIOS };
    }

    const computeBucketWeight = (
      bucketName: "discovery" | "forgotten" | "playlist",
      baseWeight: number,
      minFloor: number
    ): number => {
      const data = engagementMap.get(bucketName);
      if (!data) return baseWeight;

      const total = data.played + data.skipped + data.ignored;
      if (total === 0) return baseWeight;

      const ratio = data.played / total;
      const adjusted = baseWeight + (ratio - 0.5) * 0.30;
      return Math.max(minFloor, adjusted);
    };

    let rawDisc = computeBucketWeight("discovery", 0.70, 0.20);
    let rawForg = computeBucketWeight("forgotten", 0.20, 0.05);
    let rawPlay = computeBucketWeight("playlist", 0.10, 0.05);

    const sum = rawDisc + rawForg + rawPlay;
    if (sum <= 0) return { ...DEFAULT_BUCKET_RATIOS };

    let discoveryRatio = Math.round((rawDisc / sum) * 100) / 100;
    let forgottenRatio = Math.round((rawForg / sum) * 100) / 100;
    let playlistRatio = Math.round((1.0 - discoveryRatio - forgottenRatio) * 100) / 100;

    if (playlistRatio < 0.05) {
      playlistRatio = 0.05;
      discoveryRatio = Math.round((1.0 - forgottenRatio - playlistRatio) * 100) / 100;
    }

    return {
      discoveryRatio: Math.max(0.20, discoveryRatio),
      forgottenRatio: Math.max(0.05, forgottenRatio),
      playlistRatio: Math.max(0.05, playlistRatio),
    };
  } catch (err) {
    return { ...DEFAULT_BUCKET_RATIOS };
  }
}
