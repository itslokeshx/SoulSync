import "dotenv/config";
import mongoose from "mongoose";
import { Announcement } from "./src/models/Announcement.js";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);
  console.log("Connected. Fetching all announcements:");

  const all = await Announcement.find({}).sort({ createdAt: -1 });
  console.log(`Total announcements: ${all.length}`);
  for (const a of all) {
    console.log(`- ID: ${a._id}, Title: "${a.title}", Active: ${a.active}, Type: ${a.type}, Version: ${a.version}`);
  }

  await mongoose.disconnect();
}

main().catch(console.error);
