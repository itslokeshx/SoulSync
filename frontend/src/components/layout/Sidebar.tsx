import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Heart,
  Library,
  Music2,
  User,
  Download,
  PanelLeft,
  Headphones,
} from "lucide-react";
import { useUIStore } from "../../store/uiStore";
import { useDownloadStore } from "../../store/downloadStore";
import { useAnnouncements } from "../../hooks/useAnnouncements";
import { useDuoStore } from "../../duo/duoStore";

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const { unreadCount } = useAnnouncements();
  const { active: duoActive, partnerConnected } = useDuoStore();

  const view =
    location.pathname === "/"
      ? "home"
      : location.pathname.slice(1).split("/")[0];
  const hasActiveDownloads = useDownloadStore((s) =>
    s.active.some((d) => d.status === "downloading" || d.status === "saving"),
  );

  const mainNavItems = [
    { id: "home", label: "Home", Icon: Home, path: "/" },
    { id: "library", label: "Library", Icon: Library, path: "/library" },
    { id: "liked", label: "Liked Songs", Icon: Heart, path: "/liked" },
    { id: "downloads", label: "Downloads", Icon: Download, path: "/downloads" },
    { id: "profile", label: "Profile", Icon: User, path: "/profile" },
  ];

  const renderNavItem = (item: (typeof mainNavItems)[0]) => {
    const { id, label, Icon, path } = item;
    const isSelected = view === id;

    return (
      <button
        key={id}
        onClick={() => navigate(path)}
        title={collapsed ? label : undefined}
        className={`w-full flex items-center gap-3 rounded-xl text-[13px] font-semibold transition-all duration-300 relative overflow-hidden ${
          collapsed ? "justify-center px-0 py-2.5" : "px-3.5 py-2.5"
        } ${
          isSelected
            ? "text-white bg-white/[0.06]"
            : "text-sp-sub hover:text-white hover:bg-white/[0.04]"
        }`}
      >
        {isSelected && (
          <div className="absolute inset-0 bg-gradient-to-r from-sp-green/15 via-sp-green/5 to-transparent rounded-xl" />
        )}
        <Icon
          size={17}
          className={`relative z-10 ${isSelected ? "text-sp-green" : ""}`}
          strokeWidth={isSelected ? 2.5 : 2}
        />
        {!collapsed && (
          <span className="flex-1 text-left relative z-10">{label}</span>
        )}
        {isSelected && !collapsed && (
          <span
            className="w-1.5 h-5 rounded-full bg-sp-green relative z-10"
            style={{ boxShadow: "0 0 8px rgba(29,185,84,0.5)" }}
          />
        )}
        {id === "downloads" && hasActiveDownloads && (
          <span className="absolute top-1 right-1 z-20 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sp-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sp-green" />
          </span>
        )}
        {id === "profile" && unreadCount > 0 && (
          <span className="absolute top-1 right-1 z-20 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sp-green opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sp-green shadow-[0_0_8px_#1db954]" />
          </span>
        )}
      </button>
    );
  };

  const isSoulLinkSelected = view === "soullink";

  return (
    <aside
      className={`hidden md:flex md:flex-col fixed left-0 top-0 bottom-[4.75rem] z-30 select-none transition-all duration-300 ${
        collapsed ? "w-[4.5rem]" : "w-[17rem]"
      }`}
      style={{
        background: "linear-gradient(180deg,#0c0c0c 0%,#060606 100%)",
        borderRight: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      {/* Header: Logo + Collapse toggle */}
      {collapsed ? (
        <div className="flex items-center justify-center flex-shrink-0 pt-4 pb-3">
          <button
            onClick={toggleSidebar}
            title="Expand sidebar"
            className="w-9 h-9 rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] hover:scale-105 active:scale-95 flex items-center justify-center text-sp-sub hover:text-white transition-all duration-200 border border-white/[0.06]"
          >
            <PanelLeft
              size={18}
              className="rotate-180 text-sp-green transition-transform duration-300"
            />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-shrink-0 px-5 pt-4 pb-3">
          <div
            className="flex items-center gap-3 cursor-pointer active:scale-95 transition-transform"
            onClick={() => navigate("/")}
          >
            <div
              className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 flex items-center justify-center flex-shrink-0 animate-breathe"
              style={{ boxShadow: "0 0 24px rgba(29,185,84,0.3)" }}
            >
              <Music2 size={16} className="text-black" strokeWidth={2.5} />
            </div>
            <span className="text-[17px] font-extrabold tracking-tight text-white">
              Soul
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green to-emerald-300">
                Sync
              </span>
            </span>
          </div>

          <button
            onClick={toggleSidebar}
            title="Collapse sidebar"
            className="p-1.5 rounded-xl text-sp-sub hover:text-white hover:bg-white/[0.08] transition-all duration-200"
          >
            <PanelLeft
              size={18}
              className="transition-transform duration-300"
            />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav
        className={`flex-1 overflow-y-auto thin-scrollbar pb-3 ${
          collapsed ? "px-1.5" : "px-3"
        }`}
      >
        {/* Main menus: Home, Library, Liked Songs, Downloads, Profile */}
        <div className="space-y-1">
          {mainNavItems.map(renderNavItem)}
        </div>

        {/* SoulLink Item — Exactly 20px below Profile, Ultra Eye-Catching */}
        <div className="mt-[20px]">
          <button
            onClick={() => navigate("/soullink")}
            title={collapsed ? "SoulLink — Listen Together" : undefined}
            className={`w-full relative flex items-center transition-all duration-300 group overflow-hidden ${
              collapsed
                ? "justify-center p-2.5 rounded-2xl"
                : "px-3.5 py-2.5 rounded-xl gap-3"
            } ${
              isSoulLinkSelected
                ? "text-white"
                : "text-sp-sub hover:text-white"
            }`}
            style={{
              background: isSoulLinkSelected
                ? "linear-gradient(135deg, rgba(29,185,84,0.28) 0%, rgba(16,185,129,0.16) 100%)"
                : "linear-gradient(135deg, rgba(29,185,84,0.12) 0%, rgba(255,255,255,0.03) 100%)",
              border: isSoulLinkSelected
                ? "1px solid rgba(29,185,84,0.55)"
                : "1px solid rgba(29,185,84,0.25)",
              boxShadow: isSoulLinkSelected
                ? "0 0 24px rgba(29,185,84,0.35), inset 0 1px 0 rgba(255,255,255,0.2)"
                : "0 0 16px rgba(29,185,84,0.1)",
            }}
          >
            {/* Ambient glowing background shimmer */}
            <div
              className="absolute inset-0 opacity-40 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(29,185,84,0.22) 50%, transparent 100%)",
              }}
            />

            {/* Glowing Icon Container */}
            <div
              className={`relative flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                collapsed
                  ? "w-8 h-8 rounded-xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 text-black shadow-lg shadow-sp-green/40"
                  : "w-7 h-7 rounded-lg bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 text-black shadow-md shadow-sp-green/30"
              }`}
            >
              <Headphones size={collapsed ? 16 : 15} strokeWidth={2.5} />
              {duoActive && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span
                    className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${partnerConnected ? "bg-sp-green animate-ping" : "bg-amber-400 animate-pulse"}`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2.5 w-2.5 ${partnerConnected ? "bg-sp-green" : "bg-amber-400"}`}
                  />
                </span>
              )}
            </div>

            {!collapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0 relative z-10">
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[13px] font-extrabold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-100 to-sp-green">
                    SoulLink
                  </span>
                  <span className="text-[9px] font-semibold text-sp-green/80 tracking-wider uppercase -mt-0.5">
                    {duoActive
                      ? partnerConnected
                        ? "Connected"
                        : "Waiting…"
                      : "Listen Together"}
                  </span>
                </div>

                <span className="px-1.5 py-0.5 text-[9px] font-black tracking-widest uppercase rounded-md bg-sp-green/20 text-sp-green border border-sp-green/30 shadow-[0_0_8px_rgba(29,185,84,0.3)]">
                  DUO
                </span>
              </div>
            )}
          </button>
        </div>
      </nav>
    </aside>
  );
};
