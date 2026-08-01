import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Music2,
  Headphones,
  Users,
  Zap,
  Download,
  BarChart3,
  Bot,
  Star,
  Mail,
  Github,
  Heart,
  Sparkles,
  Share2,
  Library,
} from "lucide-react";
import { GITHUB_REPO_URL } from "../lib/constants";

const Section = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`rounded-2xl border border-white/[0.06] p-5 sm:p-6 ${className}`}
    style={{ background: "rgba(255,255,255,0.025)" }}
  >
    {children}
  </div>
);

const FeatureItem = ({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) => (
  <div className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-0">
    <div className="w-8 h-8 rounded-xl bg-sp-green/10 border border-sp-green/20 flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon size={15} className="text-sp-green" />
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{desc}</p>
    </div>
  </div>
);

const StackBadge = ({ label }: { label: string }) => (
  <span className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white/50 font-medium">
    {label}
  </span>
);

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div className="animate-fadeIn max-w-2xl mx-auto pb-16">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-white/40 hover:text-white text-[13px] mb-6 transition-colors"
      >
        <ChevronLeft size={15} />
        Back
      </button>

      <div
        className="relative rounded-3xl overflow-hidden mb-6 p-7 sm:p-9"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.18) 0%, rgba(16,185,129,0.08) 50%, rgba(255,255,255,0.02) 100%)",
          border: "1px solid rgba(29,185,84,0.2)",
        }}
      >
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(29,185,84,0.15) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 flex items-center justify-center flex-shrink-0"
            style={{ boxShadow: "0 0 30px rgba(29,185,84,0.3)" }}
          >
            <Music2 size={26} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              About SoulSync
            </h1>
            <p className="text-sp-green text-xs font-semibold mt-0.5 tracking-wide uppercase">
              v5.1.1 · Open Source
            </p>
          </div>
        </div>
        <p className="relative z-10 text-white/55 text-sm leading-relaxed">
          SoulSync is a solo-developer passion project — a MERN + AI-powered
          music streaming platform built as a hobby and learning exercise by a
          college student. It started as a midnight side project, grew over
          several months of iterating on real user feedback, and runs entirely
          on free-tier infrastructure. Not a commercial product, just something
          built with genuine enthusiasm for music and code.
        </p>
      </div>

      <div className="space-y-4">
        <Section>
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-0.5 flex items-center gap-2">
            <Sparkles size={13} className="text-sp-green" />
            Features
          </h2>
          <p className="text-[11px] text-white/25 mb-3">
            What SoulSync actually does
          </p>
          <FeatureItem
            icon={Music2}
            title="Music Streaming"
            desc="50M+ songs streamed from JioSaavn's catalog — no ads, no subscription, completely free."
          />
          <FeatureItem
            icon={Bot}
            title="AI-Powered Playlists"
            desc="Describe a mood or theme in plain language and SoulSync generates a curated playlist using Groq's open-weight LLMs."
          />
          <FeatureItem
            icon={Zap}
            title="Made For You — Personalized Recommendations"
            desc="Behavior-weighted taste engine builds your home feed from listening history, replays, likes, and skips. No two feeds are alike."
          />
          <FeatureItem
            icon={Headphones}
            title="SoulLink — Synced Listening Sessions"
            desc="Real-time shared listening rooms over WebSockets. Share a 6-character room code and listen together in sync — with in-room chat."
          />
          <FeatureItem
            icon={Download}
            title="Offline Downloads with Embedded Metadata"
            desc="Download songs for offline playback. Files are saved with full ID3-style metadata including album art, artist, and title."
          />
          <FeatureItem
            icon={BarChart3}
            title="SoulSync Wrapped"
            desc="Year-in-review listening stats — top tracks, top artists, primary listening languages, and total time spent listening. Presented as an interactive story deck."
          />
          <FeatureItem
            icon={Library}
            title="Custom Playlists & Library"
            desc="Create and manage playlists, reorder songs by drag-and-drop, and import playlists from Spotify, Apple Music, or YouTube Music."
          />
          <FeatureItem
            icon={Share2}
            title="Song & Playlist Sharing"
            desc="Share individual songs or full playlists via shareable links, accessible even without signing in."
          />
          <FeatureItem
            icon={Star}
            title="Intent-Aware Search"
            desc="Natural language search with typo resilience, entity relationships (director → movie → soundtrack), and adaptive ranking from real click signals."
          />
        </Section>

        <Section>
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-0.5 flex items-center gap-2">
            <Heart size={13} className="text-sp-green" />
            The Story
          </h2>
          <p className="text-[11px] text-white/25 mb-3">
            How this started
          </p>
          <p className="text-sm text-white/50 leading-relaxed">
            It started at midnight — a frustration with ad-heavy streaming and a
            curiosity about whether a solo developer could build something that
            felt genuinely good to use. Several months of commits later, here it
            is: real users, real feedback, and a growing feature set that went
            well past what the original scope intended.
          </p>
          <p className="text-sm text-white/40 leading-relaxed mt-3">
            Every feature was driven by actual use. SoulLink came from wanting to
            listen with a friend in another city. SoulSync Wrapped came from
            wondering what the year's listening actually looked like. Offline
            downloads came from a long flight. Built solo, improved with every
            bug report and suggestion.
          </p>
        </Section>

        <Section>
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            <Zap size={13} className="text-sp-green" />
            Tech Stack
          </h2>
          <div className="flex flex-wrap gap-2">
            {[
              "MongoDB",
              "Express",
              "React 18",
              "Node.js",
              "TypeScript",
              "Socket.io",
              "Groq (LLM)",
              "Capacitor",
              "Zustand",
              "Framer Motion",
              "Vite",
              "Vercel",
              "Render",
            ].map((t) => (
              <StackBadge key={t} label={t} />
            ))}
          </div>
          <p className="text-[11px] text-white/25 mt-3 leading-relaxed">
            MERN stack at the core, with AI/LLM integration via Groq Cloud SDK for
            playlist generation and natural language features. Android APK via
            Capacitor. Deployed entirely on free-tier infrastructure.
          </p>
        </Section>

        <Section>
          <h2 className="text-sm font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            <Mail size={13} className="text-sp-green" />
            Contact
          </h2>
          <p className="text-sm text-white/50 leading-relaxed mb-4">
            Got a bug, a feature idea, or just want to say hi? Feedback is the
            main reason SoulSync keeps improving.
          </p>
          <a
            href="mailto:itslokeshx@gmail.com"
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-sp-green/10 border border-sp-green/25 text-sp-green text-sm font-semibold hover:bg-sp-green/20 transition-all duration-200 w-fit"
          >
            <Mail size={14} />
            itslokeshx@gmail.com
          </a>
          <p className="text-[11px] text-white/25 mt-3">
            You can also use the Support Chat on the Profile page to send
            feedback directly — replies land in the same inbox.
          </p>
        </Section>

        <Section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white/50">Source Code</h2>
              <p className="text-[11px] text-white/25 mt-0.5">MIT License · Open Source</p>
            </div>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#161b22]/80 border border-white/[0.08] text-white/50 hover:text-white hover:border-white/20 text-xs font-semibold transition-all duration-200 flex-shrink-0"
            >
              <Github size={13} />
              GitHub
            </a>
          </div>
        </Section>
      </div>
    </div>
  );
}
