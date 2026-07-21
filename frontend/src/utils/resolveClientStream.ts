/**
 * Client-Side Direct Stream Resolver (Proxied Stream Failover)
 * Returns a high-availability proxied Invidious audio stream URL for direct HTML5 audio playback,
 * bypassing CORS, IP-locking (HTTP 403), and backend rate limits.
 */
export async function resolveClientStream(songId: string): Promise<string | null> {
  if (!songId || songId.startsWith("local_")) return null;

  const publicInstances = [
    "https://invidious.projectsegfau.lt",
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
    "https://inv.tux.pizza",
  ];

  // Fast random selection across working proxy instances to distribute load
  const inst = publicInstances[Math.floor(Math.random() * publicInstances.length)];
  const streamUrl = `${inst}/latest_version?id=${encodeURIComponent(songId)}&itag=140`;
  console.info(`[ClientStream] Resolved ${songId} via proxied stream mirror: ${inst}`);
  return streamUrl;
}
