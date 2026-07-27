import React from "react";
import { useNavigate } from "react-router-dom";
import { getArtistsList, ArtistItem } from "../../lib/helpers";
import { searchArtists } from "../../api/jiosaavn";

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
  onArtistClick,
}: ArtistLinksProps) => {
  const navigate = useNavigate();
  const list = getArtistsList(song);

  if (!list.length) return <span className={className}>—</span>;

  const handleArtistClick = async (
    e: React.MouseEvent | React.KeyboardEvent,
    artist: ArtistItem
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (onArtistClick) {
      onArtistClick();
    }

    if (artist.id && artist.id.trim() !== "" && artist.id !== "null") {
      navigate(`/artist/${artist.id}`);
      return;
    }

    if (artist.name) {
      try {
        const results = await searchArtists(artist.name);
        if (results && results.length > 0 && results[0].id) {
          navigate(`/artist/${results[0].id}`);
          return;
        }
      } catch (err) {
        console.error("Failed to resolve artist ID by name:", err);
      }

      navigate(`/artist/${encodeURIComponent(artist.name)}`);
    }
  };

  return (
    <span className={className} onClick={(e) => e.stopPropagation()}>
      {list.map((artist: ArtistItem, idx: number) => (
        <React.Fragment key={`${artist.name}-${idx}`}>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => handleArtistClick(e, artist)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                handleArtistClick(e, artist);
              }
            }}
            className={`hover:underline hover:text-white cursor-pointer transition-colors ${linkClassName}`}
          >
            {artist.name}
          </span>
          {idx < list.length - 1 && <span className="text-white/40 select-none">, </span>}
        </React.Fragment>
      ))}
    </span>
  );
};
