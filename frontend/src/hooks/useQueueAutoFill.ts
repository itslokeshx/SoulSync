import { useEffect, useRef, useCallback } from "react";
import { getRelatedSongs } from "../api/backend";

const REFILL_THRESHOLD = 10; // Start fetching when fewer than N songs remain
const PREFETCH_LIMIT = 50;

interface UseQueueAutoFillOptions {
  queue: any[];
  queueIndex: number;
  currentSong: any;
  enabled?: boolean;
  onAddSongs: (songs: any[]) => void;
}

/**
 * Automatically fills the queue with related songs when it runs low.
 * Triggers when fewer than REFILL_THRESHOLD songs remain after current index.
 */
export function useQueueAutoFill({
  queue,
  queueIndex,
  currentSong,
  enabled = true,
  onAddSongs,
}: UseQueueAutoFillOptions) {
  const fetchingRef = useRef(false);
  const lastSongIdRef = useRef<string | null>(null);
  const pageRef = useRef(1);
  const addedIdsRef = useRef<Set<string>>(new Set());

  // Reset page counter when the base song changes
  useEffect(() => {
    if (currentSong?.id !== lastSongIdRef.current) {
      lastSongIdRef.current = currentSong?.id ?? null;
      pageRef.current = 1;
    }
  }, [currentSong?.id]);

  const fetchRelated = useCallback(async () => {
    if (!currentSong?.id || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { songs, hasMore } = await getRelatedSongs(
        currentSong.id,
        pageRef.current,
        PREFETCH_LIMIT,
      );

      // Filter out songs already in the queue or already added
      const existingIds = new Set(queue.map((s) => s.id));
      const newSongs = songs.filter(
        (s: any) =>
          s?.id && !existingIds.has(s.id) && !addedIdsRef.current.has(s.id),
      );

      if (newSongs.length > 0) {
        newSongs.forEach((s: any) => addedIdsRef.current.add(s.id));
        onAddSongs(newSongs);
      }

      if (hasMore) {
        pageRef.current += 1;
      }
    } catch {
      // Silent fail — queue auto-fill is non-critical
    } finally {
      fetchingRef.current = false;
    }
  }, [currentSong?.id, queue, onAddSongs]);

  useEffect(() => {
    if (!enabled || !currentSong) return;
    const remaining = queue.length - queueIndex - 1;
    if (remaining < REFILL_THRESHOLD) {
      fetchRelated();
    }
  }, [enabled, queue.length, queueIndex, currentSong, fetchRelated]);
}
