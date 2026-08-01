import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronDown,
  Mail,
  Music2,
  Headphones,
  Users,
  Download,
  BarChart3,
  Sparkles,
  Search,
  Share2,
  Heart,
  Clock,
  Shuffle,
  Github,
  Shield,
  UserCircle,
  ListMusic,
  Star,
} from "lucide-react";
import { GITHUB_REPO_URL } from "../lib/constants";

const FEATURES = [
  {
    icon: Music2,
    title: "Music Streaming",
    desc: "Stream millions of songs instantly — no ads, no subscription, completely free.",
  },
  {
    icon: Search,
    title: "Smart Search",
    desc: "Search by song, artist, or album. Handles typos and natural phrasing — just type what you're thinking.",
  },
  {
    icon: Sparkles,
    title: "AI Playlist Builder",
    desc: "Describe a mood or theme and SoulSync builds a full playlist for you. Try 'rainy evening Tamil songs' and see.",
  },
  {
    icon: Heart,
    title: "Made For You",
    desc: "Your home feed learns from what you play, skip, and like. The more you use SoulSync, the better it gets.",
  },
  {
    icon: Headphones,
    title: "SoulLink — Listen Together",
    desc: "Create a room, share a code, and listen in sync with a friend. Built-in chat included.",
  },
  {
    icon: Download,
    title: "Offline Downloads",
    desc: "Download songs for offline listening — with cover art and song info preserved, just like a real music file.",
  },
  {
    icon: BarChart3,
    title: "SoulSync Wrapped",
    desc: "Your personal year in review — top songs, favourite artists, total hours, and more.",
  },
  {
    icon: ListMusic,
    title: "Playlists",
    desc: "Create and organize playlists, reorder songs by drag, and share them publicly.",
  },
  {
    icon: Share2,
    title: "Import from Spotify / YT Music",
    desc: "Paste a playlist link from another app and SoulSync finds and imports the songs.",
  },
  {
    icon: Users,
    title: "Artist Pages",
    desc: "Browse artist songs and albums. Follow artists to get their music in your recommendations.",
  },
  {
    icon: Shuffle,
    title: "Queue & Autoplay",
    desc: "Reorder your queue on the fly. When your playlist ends, SoulSync keeps playing similar songs.",
  },
  {
    icon: Clock,
    title: "Sleep Timer",
    desc: "Set a timer and playback stops automatically — great for listening while drifting off.",
  },
];

const PRIVACY_ITEMS = [
  {
    q: "What data is stored?",
    a: "Your name, email, and profile photo (from sign-in). Your liked songs, playlists, listening history, preferences (languages and moods), and any feedback messages you send.",
  },
  {
    q: "Why is it collected?",
    a: "Listening history and preferences power your personalized feed, Wrapped stats, and recommendations. Your library is synced so it's available across devices.",
  },
  {
    q: "Is my data sold or shared?",
    a: "No. Your data is never sold. There are no ads and no advertising networks. SoulSync uses Firebase Analytics for basic usage patterns (screens visited, app version, device language) — no name or email is ever included in those events.",
  },
  {
    q: "How do I delete my account?",
    a: "There's no self-serve deletion yet. Email itslokeshx@gmail.com and your account and all data will be deleted promptly.",
  },
];

function Accordion({
  q,
  a,
  isLast,
}: {
  q: string;
  a: string;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${!isLast ? "border-b border-white/[0.04]" : ""}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 py-3 text-left"
      >
        <span className="text-[13px] font-semibold text-white/75">{q}</span>
        <ChevronDown
          size={14}
          className={`text-white/30 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="text-[12px] text-white/40 leading-relaxed pb-3.5">{a}</p>
      )}
    </div>
  );
}

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
        className="relative rounded-3xl overflow-hidden mb-4 p-6 sm:p-8"
        style={{
          background:
            "linear-gradient(135deg, rgba(29,185,84,0.14) 0%, rgba(16,185,129,0.06) 50%, rgba(255,255,255,0.015) 100%)",
          border: "1px solid rgba(29,185,84,0.18)",
        }}
      >
        <div
          className="absolute -top-12 -right-12 w-52 h-52 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(29,185,84,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="relative z-10 flex items-center gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 flex items-center justify-center flex-shrink-0"
            style={{ boxShadow: "0 0 24px rgba(29,185,84,0.25)" }}
          >
            <Music2 size={22} className="text-black" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              About SoulSync
            </h1>
            <p className="text-white/35 text-xs mt-0.5">
              Built by one person, for everyone
            </p>
          </div>
        </div>

        <p className="relative z-10 text-[13px] text-white/50 leading-relaxed mb-5">
          SoulSync is a free music streaming app — no subscriptions, no ads, no
          paywalls. Stream songs, build playlists, discover new music, and
          listen with friends. It's a personal project, not a company.
        </p>

        <div
          className="relative z-10 rounded-2xl p-4 sm:p-5"
          style={{
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-2.5">
            <UserCircle size={13} className="text-sp-green" />
            <span className="text-[10px] font-black text-sp-green uppercase tracking-widest">
              Developer & Contact
            </span>
          </div>
          <p className="text-white text-sm font-semibold mb-0.5">
            Loki —{" "}
            <span className="text-white/45 font-normal">
              solo developer, college student
            </span>
          </p>
          <p className="text-white/35 text-xs mb-3 leading-relaxed">
            Bug, feature idea, or just want to say hi? I read every message.
          </p>
          <a
            href="mailto:itslokeshx@gmail.com"
            id="about-contact-email"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-bold transition-all duration-200 active:scale-95"
            style={{
              background: "rgba(29,185,84,0.12)",
              border: "1px solid rgba(29,185,84,0.28)",
              color: "#1db954",
            }}
          >
            <Mail size={13} />
            itslokeshx@gmail.com
          </a>
        </div>
      </div>

      <div className="space-y-3">
        <div
          className="rounded-2xl border border-white/[0.06] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.022)" }}
        >
          <div className="px-5 pt-5 pb-3 border-b border-white/[0.04] flex items-center gap-2">
            <Sparkles size={13} className="text-sp-green" />
            <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
              Features
            </h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3.5 px-5 py-3.5"
              >
                <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={13} className="text-white/40" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white leading-snug">
                    {title}
                  </p>
                  <p className="text-[12px] text-white/38 mt-0.5 leading-relaxed">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl border border-white/[0.06] px-5 pt-5 pb-2"
          style={{ background: "rgba(255,255,255,0.022)" }}
        >
          <div className="flex items-center gap-2 mb-1 pb-3 border-b border-white/[0.04]">
            <Shield size={13} className="text-sp-green" />
            <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
              Privacy
            </h2>
          </div>
          <p className="text-[12px] text-white/40 leading-relaxed pt-3 pb-1">
            No ads. No data selling. No third-party sharing for commercial
            purposes.
          </p>
          {PRIVACY_ITEMS.map((item, i) => (
            <Accordion
              key={item.q}
              q={item.q}
              a={item.a}
              isLast={i === PRIVACY_ITEMS.length - 1}
            />
          ))}
        </div>

        <div
          className="rounded-2xl border border-white/[0.06] px-5 py-5"
          style={{ background: "rgba(255,255,255,0.022)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Heart size={13} className="text-sp-green" />
            <h2 className="text-[11px] font-black text-white uppercase tracking-widest">
              The Story
            </h2>
          </div>
          <p className="text-[13px] text-white/42 leading-relaxed">
            SoulSync started as a late-night frustration with ad-filled
            streaming — and a question: could one person build something that
            actually felt good to use? Several months of work later, that
            project grew into this, shaped almost entirely by real user
            feedback. Still one person building it.
          </p>
        </div>

        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          id="about-star-repo"
          className="flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-all duration-200 active:scale-[0.99] group"
          style={{
            background: "rgba(22,27,34,0.7)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0">
              <Github size={15} className="text-white/50 group-hover:text-white transition-colors" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white/70 group-hover:text-white transition-colors leading-snug">
                Star on GitHub
              </p>
              <p className="text-[11px] text-white/30 mt-0.5">
                Open source · itslokeshx/SoulSync
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0 transition-all duration-200 group-hover:scale-105"
            style={{
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.25)",
            }}
          >
            <Star size={12} className="fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-bold text-amber-400">Star</span>
          </div>
        </a>


      </div>
    </div>
  );
}
