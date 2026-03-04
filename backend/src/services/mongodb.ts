import mongoose from "mongoose";

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
