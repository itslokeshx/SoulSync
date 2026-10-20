import { bestImg, onImgErr } from "../../lib/helpers";
import { FALLBACK_IMG } from "../../lib/constants";

interface ArtistCardProps {
  artist: any;
  onClick?: () => void;
}

export const ArtistCard = ({ artist }: ArtistCardProps) => {
  const img = bestImg(artist.image) || FALLBACK_IMG;
  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-2.5 w-[7rem]">
      <div className="relative w-[5.5rem] h-[5.5rem] rounded-full overflow-hidden">
        <img
          src={img}
          onError={onImgErr}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="text-center w-full">
        <p className="text-[12px] font-semibold text-white truncate">
          {artist.name}
        </p>
        <p className="text-[10px] text-white/25 mt-0.5">Artist</p>
      </div>
    </div>
  );
};
