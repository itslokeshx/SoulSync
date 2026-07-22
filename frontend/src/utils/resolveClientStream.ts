/**
 * Client-Side Direct Stream Resolver (Proxied Stream Failover)
 * Returns a high-availability proxied Invidious audio stream URL for direct HTML5 audio playback,
 * bypassing CORS, IP-locking (HTTP 403), and backend rate limits.
 */
export async function resolveClientStream(songId: string): Promise<string | null> {
  if (!songId || songId.startsWith("local_")) return null;

  const pipedInstances = [
    "https://api.piped.video",
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.privacy.com.de",
    "https://pipedapi.palvelu.org",
  ];

  for (const inst of pipedInstances) {
    try {
      const res = await fetch(`${inst}/streams/${encodeURIComponent(songId)}`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
          const audio = data.audioStreams.find((s: any) => s.mimeType?.includes("audio/mp4") || s.format === "M4A") || data.audioStreams[0];
          if (audio?.url) {
            console.info(`[ClientStream] Resolved ${songId} via Piped mirror: ${inst}`);
            return audio.url;
          }
        }
      }
    } catch {
      continue;
    }
  }

  const publicInstances = [
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
    "https://inv.tux.pizza",
    "https://invidious.projectsegfau.lt",
  ];

  const inst = publicInstances[Math.floor(Math.random() * publicInstances.length)];
  return `${inst}/latest_version?id=${encodeURIComponent(songId)}&itag=140`;
}
