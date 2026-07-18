import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Pause } from "lucide-react";
import { HSection } from "../components/cards/HSection";
import { SongCard } from "../components/cards/SongCard";
import { useApp } from "../context/AppContext";
import { useDashboard } from "../hooks/useDashboard";
import { Skeleton } from "../components/ui/Skeleton";
import { normalizeSongs } from "../utils/normalizeSong";
import { bestImg, getArtists } from "../lib/helpers";

export const HomePage = () => {
  const navigate = useNavigate();
  const {
    currentSong,
    isPlaying,
    playSong: onPlay,
  } = useApp();

  const {
    loading: dashboardLoading,
    authLoading,
    mixesLoading,
    error,
    dashboard,
    row1,
    row2,
    row3,
    suggestionsSongs,
    mobileGridSongs,
    mobileSavedPages,
    normalizedRecentlyPlayed,
    guestNewReleases,
    normalizedNewReleases,
    localGreeting,
    localSubtitle,
    handleHomeSongClick,
    mixSet,
    user,
    refetch,
  } = useDashboard(onPlay);

  const [activePage, setActivePage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="animate-fadeIn space-y-12">
      {/* Greetings Header */}
      <div>
        {authLoading ? (
          <div>
            <Skeleton className="h-8 w-64 rounded-lg mb-2" />
            <Skeleton className="h-4 w-48 rounded-md" />
          </div>
        ) : (
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              {localGreeting}
            </h1>
            <p className="text-white/30 text-sm mt-1">{localSubtitle}</p>
          </div>
        )}
      </div>

      {/* A. Recently Played (First) */}
      {authLoading || dashboardLoading ? (
        user && (
          <div className="space-y-4">
            <Skeleton className="h-6 w-40 rounded-md mb-4" />
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 6 }).map((_, j) => (
                <div
                  key={j}
                  className="flex-shrink-0 w-44 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
                >
                  <Skeleton className="w-full aspect-square mb-3 rounded-xl" />
                  <Skeleton className="h-3 w-4/5 mb-2 rounded-md" />
                  <Skeleton className="h-2.5 w-1/2 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        user && normalizedRecentlyPlayed.length > 0 && (
          <>
            {/* Desktop Version */}
            <div className="hidden md:block">
              <HSection
                title="Recently Played"
                songs={normalizedRecentlyPlayed}
                loading={false}
                currentSong={currentSong}
                isPlaying={isPlaying}
                onPlay={(song) => handleHomeSongClick(song)}
              />
            </div>

            {/* Mobile 3x3 Grid Version */}
            <div className="block md:hidden mb-12">
              <div 
                ref={scrollRef}
                onScroll={() => {
                  if (scrollRef.current) {
                    const { scrollLeft, clientWidth } = scrollRef.current;
                    const pageIndex = Math.round(scrollLeft / clientWidth);
                    setActivePage(pageIndex);
                  }
                }}
                className="flex overflow-x-auto hide-scrollbar snap-x snap-mandatory -mx-4 px-4 gap-4 pb-2"
              >
                {mobileSavedPages.map((pageSongs, pageIdx) => (
                  <div 
                    key={pageIdx} 
                    className="flex-shrink-0 w-[calc(100vw-32px)] snap-center grid grid-cols-3 gap-2.5"
                  >
                    {pageSongs.map((song) => {
                      const isCurrent = currentSong?.id === song.id;
                      const img = bestImg(song.image) || "";
                      return (
                        <div
                          key={song.id}
                          onClick={() => handleHomeSongClick(song, mobileGridSongs)}
                          className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group border active:scale-95 transition-all duration-200 ${
                            isCurrent
                              ? "border-sp-green ring-1 ring-sp-green/30"
                              : "border-white/[0.06] hover:border-white/[0.12]"
                          }`}
                        >
                          <img
                            src={img}
                            alt={song.name}
                            className={`w-full h-full object-cover transition-transform duration-500 ${
                              isCurrent && isPlaying ? "scale-105" : "group-hover:scale-105"
                            }`}
                          />
                          
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent flex flex-col justify-end p-2">
                            {isCurrent && (
                              <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1 border border-sp-green/20">
                                {isPlaying ? (
                                  <div className="flex gap-[2px] items-end h-2.5 px-0.5">
                                    <div className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-2.5" />
                                    <div className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-1.5" style={{ animationDelay: "150ms" }} />
                                    <div className="w-[1.5px] bg-sp-green rounded-full animate-pulse h-2.5" style={{ animationDelay: "300ms" }} />
                                  </div>
                                ) : (
                                  <Pause size={8} className="text-sp-green fill-sp-green" />
                                )}
                              </div>
                            )}

                            <div className="w-full text-center">
                              <p className={`text-[10px] font-bold truncate tracking-tight leading-snug ${
                                isCurrent ? "text-sp-green" : "text-white"
                              }`}>
                                {song.name}
                              </p>
                              <p className="text-[8px] text-white/50 truncate tracking-tight mt-0.5">
                                {getArtists(song)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {mobileSavedPages.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-3">
                  {mobileSavedPages.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        activePage === idx ? "bg-sp-green w-3.5" : "bg-white/20"
                      }`} 
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* B. Your Weekly Mixes (Second) */}
      {mixesLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 rounded-md mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 4 }).map((_, j) => (
              <div
                key={j}
                className="flex-shrink-0 w-44 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
              >
                <Skeleton className="w-full aspect-square mb-3 rounded-xl" />
                <Skeleton className="h-3 w-4/5 mb-2 rounded-md" />
                <Skeleton className="h-2.5 w-1/2 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        mixSet?.mixes && mixSet.mixes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-xl font-black text-white tracking-tight">
                Your Weekly Mixes
              </h2>
            </div>
            {mixSet.mixes.map((mix: any) => {
              const normalizedSongs = normalizeSongs(mix.songs || []);
              if (normalizedSongs.length === 0) return null;
              return (
                <HSection
                  key={mix.key}
                  title={mix.title}
                  subtitle={mix.description}
                  songs={normalizedSongs}
                  loading={false}
                  currentSong={currentSong}
                  isPlaying={isPlaying}
                  onPlay={(song) => onPlay(song, normalizedSongs)}
                />
              );
            })}
          </div>
        )
      )}

      {/* C. Suggestions / Made For You (3 Rows, Combined) */}
      {authLoading || dashboardLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 rounded-md mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 6 }).map((_, j) => (
              <div
                key={j}
                className="flex-shrink-0 w-44 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
              >
                <Skeleton className="w-full aspect-square mb-3 rounded-xl" />
                <Skeleton className="h-3 w-4/5 mb-2 rounded-md" />
                <Skeleton className="h-2.5 w-1/2 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        user && suggestionsSongs.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-lg font-bold text-white leading-tight">
                Made For You
              </h2>
            </div>
            <div className="space-y-4">
              {row1.length > 0 && (
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
                  {row1.map((s) => (
                    <SongCard
                      key={s.id}
                      song={s}
                      isCurrent={currentSong?.id === s.id}
                      isPlaying={isPlaying}
                      onPlay={() => handleHomeSongClick(s, suggestionsSongs)}
                    />
                  ))}
                </div>
              )}
              {row2.length > 0 && (
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
                  {row2.map((s) => (
                    <SongCard
                      key={s.id}
                      song={s}
                      isCurrent={currentSong?.id === s.id}
                      isPlaying={isPlaying}
                      onPlay={() => handleHomeSongClick(s, suggestionsSongs)}
                    />
                  ))}
                </div>
              )}
              {row3.length > 0 && (
                <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1 -mx-1 px-1">
                  {row3.map((s) => (
                    <SongCard
                      key={s.id}
                      song={s}
                      isCurrent={currentSong?.id === s.id}
                      isPlaying={isPlaying}
                      onPlay={() => handleHomeSongClick(s, suggestionsSongs)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* D. New Releases (Fourth - generic industry releases, not personalized) */}
      {authLoading || dashboardLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-36 rounded-md mb-4" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 5 }).map((_, j) => (
              <div
                key={j}
                className="flex-shrink-0 w-44 p-3 rounded-2xl bg-white/[0.02] border border-white/[0.04]"
              >
                <Skeleton className="w-full aspect-square mb-3 rounded-xl" />
                <Skeleton className="h-3 w-4/5 mb-2 rounded-md" />
                <Skeleton className="h-2.5 w-1/2 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        !user && guestNewReleases.length > 0 ? (
          guestNewReleases.map((section: any) => (
            <HSection
              key={section.title}
              title={section.title}
              songs={section.songs}
              loading={false}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={(song) => handleHomeSongClick(song, section.songs)}
            />
          ))
        ) : (
          normalizedNewReleases.length > 0 && (
            <HSection
              title={dashboard?.newReleases?.title || "New Releases"}
              songs={normalizedNewReleases}
              loading={false}
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={(song) => handleHomeSongClick(song)}
            />
          )
        )
      )}

      {/* Error fallback */}
      {error && !dashboard && (
        <div className="text-center py-16">
          <p className="text-white/40 text-sm">Couldn't load your dashboard.</p>
          <button
            onClick={() => {
              refetch();
            }}
            className="mt-3 px-4 py-2 rounded-full text-sm bg-white/[0.06] text-white hover:bg-white/[0.1] transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

export default HomePage;
