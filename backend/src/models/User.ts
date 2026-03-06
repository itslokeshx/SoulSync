import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

export interface ISongEmbed {
  songId: string;
  title: string;
  artist: string;
  albumArt: string;
  duration: number;
  downloadUrl: { quality: string; url: string }[];
}

export const SongEmbedSchema = new Schema<ISongEmbed>(
  {
    songId: String,
    title: String,
    artist: String,
    albumArt: String,
    duration: Number,
    downloadUrl: [{ quality: String, url: String }],
  },
  { _id: false },
);

export interface IUser extends Document {
  // Google OAuth
  googleId?: string;
  // Email/password
  email: string;
  username?: string;
  passwordHash?: string;
  authProvider: "google" | "local" | "both";
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  // Profile
  name: string;
  photoURL?: string;
  preferences: {
    languages: string[];
    eras: string[];
    moods: string[];
  };
  likedSongs: ISongEmbed[];
  totalListeningTime: number;
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    googleId: { type: String, sparse: true, index: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: /^[a-zA-Z0-9_]+$/,
    },
    passwordHash: { type: String, select: false },
    authProvider: {
      type: String,
      enum: ["google", "local", "both"],
      default: "google",
    },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },
    name: { type: String, required: true },
    photoURL: String,
    preferences: {
      languages: { type: [String], default: [] },
      eras: { type: [String], default: [] },
      moods: { type: [String], default: [] },
    },
    likedSongs: { type: [SongEmbedSchema], default: [] },
    totalListeningTime: { type: Number, default: 0 },
    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Strip googleId if falsy so a missing Google ID is stored as absent (not null)
// This prevents E11000 dup key errors on the unique googleId index
UserSchema.pre("validate", function (next) {
  if (!this.googleId) {
    this.set("googleId", undefined);
  }
  next();
});

// Hash password before save if modified
UserSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash") || !this.passwordHash) return next();
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || "12");
  this.passwordHash = await bcrypt.hash(this.passwordHash, rounds);
  next();
});

export const User = mongoose.model<IUser>("User", UserSchema);
