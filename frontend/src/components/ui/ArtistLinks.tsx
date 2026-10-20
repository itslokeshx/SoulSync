import React from "react";
import { getArtistsList, ArtistItem } from "../../lib/helpers";

interface ArtistLinksProps {
  song: any;
  className?: string;
  linkClassName?: string;
  onArtistClick?: () => void;
}

export const ArtistLinks = ({
  song,
  className = "",
  linkClassName = "",
}: ArtistLinksProps) => {
  const list = getArtistsList(song);

  if (!list.length) return <span className={className}>—</span>;

  return (
    <span className={className}>
      {list.map((artist: ArtistItem, idx: number) => (
        <React.Fragment key={`${artist.name}-${idx}`}>
          <span className={linkClassName}>{artist.name}</span>
          {idx < list.length - 1 && <span className="text-white/40 select-none">, </span>}
        </React.Fragment>
      ))}
    </span>
  );
};
