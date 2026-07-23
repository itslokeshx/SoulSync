import { useEffect, useRef, useCallback } from "react";
import { getNextRecommendations, getRelatedSongs } from "../api/backend";

const PREFETCH_THRESHOLD = 3; // trigger when 3 or fewer unplayed songs remain in queue
const PREFETCH_LIMIT = 100;
const FETCH_COOLDOWN_MS = 5_000;
const MAX_EMPTY_ROUNDS = 3;

interface UseQueueAutoFillOptions {
  queue: any[];
  queueIndex: number;
  currentSong: any;
  enabled?: boolean;
  onAddSongs: (songs: any[]) => void;
}

export function useQueueAutoFill({
  queue,
  queueIndex,
  currentSong,
  enabled = true,
  onAddSongs,
}: UseQueueAutoFillOptions) {
  const queueRef = useRef(queue);
  const onAddSongsRef = useRef(onAddSongs);
  queueRef.current = queue;
  onAddSongsRef.current = onAddSongs;

  const queueIndexRef = useRef(queueIndex);
  queueIndexRef.current = queueIndex;

  const fetchingRef = useRef(false);
  const lastSongIdRef = useRef<string | null>(null);
  const pageRef = useRef(1);
  const addedIdsRef = useRef<Set<string>>(new Set());
  const lastFetchAtRef = useRef<number>(0);
  const emptyRoundsRef = useRef(0);

  // Reset counters when current playing song changes (periodic re-seeding)
  useEffect(() => {
    if (currentSong?.id !== lastSongIdRef.current) {
      lastSongIdRef.current = currentSong?.id ?? null;
      pageRef.current = 1;
      emptyRoundsRef.current = 0;
      lastFetchAtRef.current = 0;
      fetchingRef.current = false;
    }
  }, [currentSong?.id]);

  const fetchRelated = useCallback(async () => {
    const songId = lastSongIdRef.current;
    if (!songId) return;
    if (fetchingRef.current) return;

    const remaining = queueRef.current.length - queueIndexRef.current - 1;
    if (remaining < 5) {
      emptyRoundsRef.current = 0;
    }

    if (emptyRoundsRef.current >= MAX_EMPTY_ROUNDS) return;
    const now = Date.now();
    if (now - lastFetchAtRef.current < FETCH_COOLDOWN_MS) return;

    fetchingRef.current = true;
    lastFetchAtRef.current = now;

    try {
      let songs: any[] = [];
      let hasMore = false;

      // Always re-seed recommendations from the CURRENTLY playing song
      try {
        const excludeIds = Array.from(
          new Set([
            ...queueRef.current.map((s) => s?.id).filter(Boolean),
            ...Array.from(addedIdsRef.current),
          ])
        );
        const recResult = await getNextRecommendations(songId, excludeIds);
        songs = recResult.songs || [];
        hasMore = recResult.hasMore;
      } catch {
        // Fallback to legacy related songs if rec engine fails
      }

      if (songs.length === 0) {
        const legacyResult = await getRelatedSongs(
          songId,
          pageRef.current,
          PREFETCH_LIMIT,
        );
        songs = legacyResult.songs || [];
        hasMore = legacyResult.hasMore;
      }

      const existingIds = new Set(queueRef.current.map((s) => s.id));
      const newSongs = songs.filter(
        (s: any) =>
          s?.id && !existingIds.has(s.id) && !addedIdsRef.current.has(s.id),
      );

      if (newSongs.length > 0) {
        newSongs.forEach((s: any) => addedIdsRef.current.add(s.id));
        onAddSongsRef.current(newSongs);
        emptyRoundsRef.current = 0;
        if (hasMore) pageRef.current += 1;
      } else {
        emptyRoundsRef.current += 1;
      }
    } catch {
      // Silent fail
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !currentSong) return;
    const remaining = queue.length - queueIndex - 1;
    if (remaining <= PREFETCH_THRESHOLD) {
      fetchRelated();
    }
  }, [enabled, queue.length, queueIndex, currentSong?.id]);
}
