import { useEffect, useRef, useCallback } from "react";
import { getRelatedSongs } from "../api/backend";

const REFILL_THRESHOLD = 100; // trigger when fewer than N songs remain
const PREFETCH_LIMIT = 100;
const MAX_QUEUE_SIZE = 300;
const FETCH_COOLDOWN_MS = 5_000; // faster refill for large targets
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
  // Use refs so fetchRelated never needs to be recreated
  const queueRef = useRef(queue);
  const onAddSongsRef = useRef(onAddSongs);
  queueRef.current = queue;
  onAddSongsRef.current = onAddSongs;

  const fetchingRef = useRef(false);
  const lastSongIdRef = useRef<string | null>(null);
  const pageRef = useRef(1);
  const addedIdsRef = useRef<Set<string>>(new Set());
  const lastFetchAtRef = useRef<number>(0);
  const emptyRoundsRef = useRef(0);

  // Reset all counters when the song changes
  useEffect(() => {
    if (currentSong?.id !== lastSongIdRef.current) {
      lastSongIdRef.current = currentSong?.id ?? null;
      pageRef.current = 1;
      addedIdsRef.current = new Set();
      emptyRoundsRef.current = 0;
      lastFetchAtRef.current = 0;
      fetchingRef.current = false;
    }
  }, [currentSong?.id]);

  // Stable fetch function — deps are only refs, never changes
  const fetchRelated = useCallback(async () => {
    const songId = lastSongIdRef.current;
    if (!songId) return;
    if (fetchingRef.current) return;
    if (emptyRoundsRef.current >= MAX_EMPTY_ROUNDS) return;
    const now = Date.now();
    if (now - lastFetchAtRef.current < FETCH_COOLDOWN_MS) return;

    fetchingRef.current = true;
    lastFetchAtRef.current = now;

    try {
      const { songs, hasMore } = await getRelatedSongs(
        songId,
        pageRef.current,
        PREFETCH_LIMIT,
      );

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
        // No new songs — increment exhaustion counter
        emptyRoundsRef.current += 1;
      }
    } catch {
      // Silent fail
    } finally {
      fetchingRef.current = false;
    }
  }, []); // stable — no deps needed since we use refs

  useEffect(() => {
    if (!enabled || !currentSong) return;
    const remaining = queue.length - queueIndex - 1;
    // Aggressively fill if under 300 songs OR approaching end
    if (queue.length < MAX_QUEUE_SIZE || remaining < REFILL_THRESHOLD) {
      fetchRelated();
    }
  }, [enabled, queue.length, queueIndex, currentSong?.id]);
}
