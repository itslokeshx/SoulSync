import React from "react";
import { getArtistsList } from "../../lib/helpers";

interface ArtistLinksProps {
  song: any;
  className?: string;
}

export const ArtistLinks = ({ song, className = "" }: ArtistLinksProps) => {
  const list = getArtistsList(song);

  if (!list.length) return <span className={className}>—</span>;

  return (
    <span className={className}>
      {list.map((artist, idx) => (
        <React.Fragment key={`${artist.name}-${idx}`}>
          <span>
            {artist.name}
          </span>
          {idx < list.length - 1 && <span className="text-white/40">, </span>}
        </React.Fragment>
      ))}
    </span>
  );
};
