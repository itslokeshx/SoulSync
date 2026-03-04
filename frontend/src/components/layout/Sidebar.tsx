import { useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Search,
  Heart,
  Library,
  Music2,
  User,
  Download,
  PanelLeft,
} from "lucide-react";
import { useUIStore } from "../../store/uiStore";
import { DuoButton } from "../../duo";

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const view =
    location.pathname === "/"
      ? "home"
      : location.pathname.slice(1).split("/")[0];

  const navItems = [
    { id: "home", label: "Home", Icon: Home, path: "/" },
    { id: "search", label: "Search", Icon: Search, path: "/search" },
    { id: "library", label: "Library", Icon: Library, path: "/library" },
    { id: "liked", label: "Liked Songs", Icon: Heart, path: "/liked" },
    { id: "downloads", label: "Downloads", Icon: Download, path: "/downloads" },
    { id: "profile", label: "Profile", Icon: User, path: "/profile" },
  ];

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
      {/* Logo + Collapse toggle */}
      <div
        className={`flex items-center gap-3 cursor-pointer active:scale-95 transition-transform flex-shrink-0 ${
          collapsed ? "px-0 pt-4 pb-3 justify-center" : "px-5 pt-4 pb-3"
        }`}
        onClick={() => !collapsed && navigate("/")}
      >
        <div
          className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sp-green via-emerald-400 to-teal-300 flex items-center justify-center flex-shrink-0 animate-breathe"
          style={{ boxShadow: "0 0 24px rgba(29,185,84,0.3)" }}
        >
          <Music2 size={16} className="text-black" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <span className="text-[17px] font-extrabold tracking-tight text-white flex-1">
            Soul
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sp-green to-emerald-300">
              Sync
            </span>
          </span>
        )}
      </div>

      {/* Navigation — scrollable if needed */}
      <nav
        className={`flex-1 overflow-y-auto thin-scrollbar space-y-0.5 ${collapsed ? "px-1.5" : "px-3"}`}
      >
        {navItems.map(({ id, label, Icon, path }) => (
          <button
            key={id}
            onClick={() => navigate(path)}
            title={collapsed ? label : undefined}
            className={`w-full flex items-center gap-3 rounded-xl text-[13px] font-semibold transition-all duration-300 relative overflow-hidden ${
              collapsed ? "justify-center px-0 py-2" : "px-3.5 py-2"
            } ${
              view === id
                ? "text-white"
                : "text-sp-sub hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {view === id && (
              <div className="absolute inset-0 bg-gradient-to-r from-sp-green/15 via-sp-green/5 to-transparent rounded-xl" />
            )}
            <Icon
              size={17}
              className={`relative z-10 ${view === id ? "text-sp-green" : ""}`}
              strokeWidth={view === id ? 2.5 : 2}
            />
            {!collapsed && (
              <span className="flex-1 text-left relative z-10">{label}</span>
            )}
            {view === id && !collapsed && (
              <span
                className="w-1.5 h-5 rounded-full bg-sp-green relative z-10"
                style={{ boxShadow: "0 0 8px rgba(29,185,84,0.5)" }}
              />
            )}
          </button>
        ))}
      </nav>

      {/* Duo + Collapse — always visible at bottom */}
      <div
        className={`flex-shrink-0 pb-2 pt-2 border-t border-white/[0.04] ${collapsed ? "px-1.5" : "px-3"}`}
      >
        <DuoButton variant={collapsed ? "mobile-nav" : "sidebar"} />
        <button
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`w-full flex items-center gap-3 rounded-xl text-sp-sub hover:text-white hover:bg-white/[0.04] transition-all duration-200 ${
            collapsed ? "justify-center px-0 py-2.5" : "px-3.5 py-2.5"
          }`}
        >
          <PanelLeft
            size={17}
            className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && (
            <span className="text-[13px] font-semibold">Collapse</span>
          )}
        </button>
      </div>
    </aside>
  );
};
