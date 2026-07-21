import React from "react";
import { useNavigate } from "react-router-dom";
import { getArtistsList } from "../../lib/helpers";

interface ArtistLinksProps {
  song: any;
  className?: string;
}

export const ArtistLinks = ({ song, className = "" }: ArtistLinksProps) => {
  const navigate = useNavigate();
  const list = getArtistsList(song);

  if (!list.length) return <span className={className}>—</span>;

  return (
    <span className={className}>
      {list.map((artist, idx) => (
        <React.Fragment key={`${artist.name}-${idx}`}>
          <span
            onClick={(e) => {
              e.stopPropagation();
              const target = artist.id || artist.name;
              if (target) {
                navigate(`/artist/${encodeURIComponent(target)}`);
              }
            }}
            className="hover:underline hover:text-white cursor-pointer transition-colors"
          >
            {artist.name}
          </span>
          {idx < list.length - 1 && <span className="text-white/40">, </span>}
        </React.Fragment>
      ))}
    </span>
  );
};
