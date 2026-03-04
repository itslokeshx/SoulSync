import { useState } from "react";
import { Play } from "lucide-react";
import { bestImg, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";

interface ArtistCardProps {
  artist: any;
  onClick: () => void;
}

export const ArtistCard = ({ artist, onClick }: ArtistCardProps) => {
  const [hov, setHov] = useState(false);
  const img = bestImg(artist.image) || FALLBACK_IMG;
  return (
    <button
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={onClick}
      className="flex-shrink-0 flex flex-col items-center gap-2.5 w-[7rem] group"
    >
      <div
        className="relative w-[5.5rem] h-[5.5rem] rounded-full overflow-hidden"
        style={{ boxShadow: hov ? "0 8px 32px rgba(0,0,0,0.4)" : "none" }}
      >
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className={`w-full h-full object-cover transition-all duration-400 ${hov ? "brightness-[0.5] scale-110" : ""}`}
        />
        <div
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${hov ? "opacity-100" : "opacity-0"}`}
        >
          <Play size={22} className="text-white fill-white drop-shadow-lg" />
        </div>
      </div>
      <div className="text-center w-full">
        <p className="text-[12px] font-semibold text-white truncate">
          {artist.name}
        </p>
        <p className="text-[10px] text-white/25 mt-0.5">Artist</p>
      </div>
    </button>
  );
};
