import { useState } from "react";
import { Play } from "lucide-react";
import { bestImg, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";

interface AlbumCardProps {
  album: any;
  onClick: () => void;
}

export const AlbumCard = ({ album, onClick }: AlbumCardProps) => {
  const [hov, setHov] = useState(false);
  const img = bestImg(album.image) || FALLBACK_IMG;
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      className="flex-shrink-0 w-[10.5rem] p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] transition-all duration-300 text-left group"
      style={{ boxShadow: hov ? "0 8px 40px rgba(0,0,0,0.4)" : "none" }}
    >
      <div className="relative mb-3 rounded-xl overflow-hidden">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full aspect-square object-cover transition-all duration-500 ${hov ? "scale-105 brightness-[0.4]" : ""}`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${hov ? "opacity-100" : "opacity-0"}`}
        >
          <div
            className="w-11 h-11 rounded-full bg-sp-green flex items-center justify-center"
            style={{ boxShadow: "0 4px 20px rgba(29,185,84,0.5)" }}
          >
            <Play size={16} className="text-black fill-black ml-0.5" />
          </div>
        </div>
      </div>
      <p className="text-[13px] font-semibold text-white truncate">
        {album.name}
      </p>
      <p className="text-[11px] text-sp-sub truncate mt-1">
        {album.description || album.year || ""}
      </p>
    </button>
  );
};
