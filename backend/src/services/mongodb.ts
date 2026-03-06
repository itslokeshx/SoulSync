import mongoose from "mongoose";

/**
 * Ensure the googleId index is sparse so multiple docs with no
 * googleId (email/password users) can coexist without E11000 errors.
 * The old index was created non-sparse; we drop it and let Mongoose
 * recreate it correctly on next sync.
 */
async function fixGoogleIdIndex(): Promise<void> {
  try {
    const col = mongoose.connection.collection("users");
    const indexes = await col.indexes();
    const bad = indexes.find(
      (idx) => idx.name === "googleId_1" && idx.unique === true && !idx.sparse,
    );
    if (bad) {
      await col.dropIndex("googleId_1");
      console.log(
        "[MongoDB] Dropped non-sparse googleId_1 index — will be recreated as sparse",
      );
    }
  } catch (err) {
    // Non-fatal: index may not exist yet
    console.warn("[MongoDB] fixGoogleIdIndex skipped:", (err as Error).message);
  }
}

export async function connectMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("[MongoDB] MONGODB_URI not set — skipping connection");
    return;
  }

  try {
    await mongoose.connect(uri, {
      dbName: "soulsync",
    });
    console.log("[MongoDB] Connected successfully");
    await fixGoogleIdIndex();
  } catch (err) {
    console.error("[MongoDB] Connection error:", err);
    // Don't crash — allow app to work without DB in dev
  }
}

mongoose.connection.on("error", (err) => {
  console.error("[MongoDB] Runtime error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[MongoDB] Disconnected");
});
