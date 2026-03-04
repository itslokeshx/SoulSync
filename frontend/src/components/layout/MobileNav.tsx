import { useLocation, useNavigate } from "react-router-dom";
import { Home, Search, Heart, Library, Download } from "lucide-react";
import { DuoButton } from "../../duo";

export const MobileNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const view =
    location.pathname === "/"
      ? "home"
      : location.pathname.slice(1).split("/")[0];

  return (
    <nav
      className="fixed bottom-2 left-3 right-3 h-[3.75rem] md:hidden z-50 flex items-center justify-around select-none rounded-2xl glass-heavy"
      style={{
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {[
        { id: "home", Icon: Home, label: "Home", path: "/" },
        { id: "search", Icon: Search, label: "Search", path: "/search" },
        { id: "downloads", Icon: Download, label: "Saves", path: "/downloads" },
        { id: "library", Icon: Library, label: "Library", path: "/library" },
        { id: "liked", Icon: Heart, label: "Liked", path: "/liked" },
      ].map(({ id, Icon, label, path }) => (
        <button
          key={id}
          onClick={() => navigate(path)}
          className={`flex flex-col items-center gap-0.5 py-2 px-5 transition-all duration-300 relative ${
            view === id ? "text-sp-green" : "text-white/40 active:text-white"
          }`}
        >
          {view === id && (
            <span
              className="absolute -top-0.5 w-5 h-0.5 rounded-full bg-sp-green"
              style={{ boxShadow: "0 0 8px rgba(29,185,84,0.5)" }}
            />
          )}
          <Icon size={20} strokeWidth={view === id ? 2.5 : 1.8} />
          <span
            className={`text-[10px] font-medium ${view === id ? "text-sp-green" : ""}`}
          >
            {label}
          </span>
        </button>
      ))}
      <DuoButton variant="mobile-nav" />
    </nav>
  );
};
