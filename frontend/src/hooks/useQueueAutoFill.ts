import { useEffect, useRef } from "react";
import { getRecommendations } from "../api/backend";
import { usePlayerStore } from "../store/playerStore";
import { useQueueStore } from "../store/queueStore";
import { getArtists } from "../lib/helpers";
import { normalizeSong, NormalizedSong } from "../utils/normalizeSong";

const REFILL_THRESHOLD = 3;
const ADD_LIMIT = 5;
const MAX_HISTORY = 50;

export function useQueueAutoFill() {
  const currentSong = usePlayerStore((s) => s.currentSong);
  const queue = useQueueStore((s) => s.queue);
  const queueIndex = useQueueStore((s) => s.queueIndex);
  const autoplay = useQueueStore((s) => s.autoplay);
  const addLast = useQueueStore((s) => s.addLast);

  const playedHistory = useRef<string[]>([]);
  const isFetching = useRef(false);

  useEffect(() => {
    const id = currentSong?.id;
    if (!id) return;

    playedHistory.current = [
      ...playedHistory.current.filter((songId) => songId !== id),
      id,
    ].slice(-MAX_HISTORY);
  }, [currentSong?.id]);

  useEffect(() => {
    const fillQueue = async () => {
      if (!autoplay || !currentSong?.id) return;
      if (currentSong._isOffline || currentSong.id.startsWith("local_")) return;

      const remaining = Math.max(0, queue.length - queueIndex - 1);
      if (remaining >= REFILL_THRESHOLD || isFetching.current) return;

      isFetching.current = true;

      try {
        const artistId =
          currentSong.artists?.primary?.[0]?.id ||
          currentSong.artist_map?.primary_artists?.[0]?.id ||
          "";
        const albumId =
          (currentSong as any).albumId || currentSong.album?.id || "";
        const artist = getArtists(currentSong);
        const excludeIds = Array.from(
          new Set([
            ...playedHistory.current,
            ...queue.map((song) => song.id).filter(Boolean),
          ]),
        );

        const { songs } = await getRecommendations({
          song: {
            id: currentSong.id,
            title: currentSong.name || "",
            artist: artist === "—" ? "" : artist,
            artistId,
            language: currentSong.language || "",
            albumId,
          },
          excludeIds,
        });

        const existingIds = new Set([
          ...playedHistory.current,
          ...useQueueStore
            .getState()
            .queue.map((song) => song.id)
            .filter(Boolean),
        ]);
        const songsToAdd = (songs || [])
          .map((song) => normalizeSong(song))
          .filter((song): song is NormalizedSong => {
            if (!song?.id || existingIds.has(song.id)) return false;
            existingIds.add(song.id);
            return true;
          })
          .slice(0, ADD_LIMIT);

        songsToAdd.forEach((song) => addLast(song as any));
      } catch {
        // Silent fail: autoplay should never interrupt playback.
      } finally {
        isFetching.current = false;
      }
    };

    fillQueue();
  }, [autoplay, currentSong?.id, queue.length, queueIndex, addLast]);
}
