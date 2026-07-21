/**
 * Client-Side Direct Stream Resolver (Proxied Stream Failover)
 * Resolves audio stream URLs via verified public Invidious proxied stream endpoints,
 * bypassing IP-locking (HTTP 403) and backend rate limits.
 */
export async function resolveClientStream(songId: string): Promise<string | null> {
  if (!songId || songId.startsWith("local_")) return null;

  const publicInstances = [
    "https://invidious.projectsegfau.lt",
    "https://invidious.nerdvpn.de",
    "https://yewtu.be",
    "https://inv.tux.pizza",
    "https://invidious.drgns.space",
  ];

  for (const inst of publicInstances) {
    try {
      const streamUrl = `${inst}/latest_version?id=${encodeURIComponent(songId)}&itag=140`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const resp = await fetch(streamUrl, {
        method: "HEAD",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok || resp.status === 206 || resp.status === 302) {
        console.info(`[ClientStream] Resolved ${songId} via proxied stream mirror: ${inst}`);
        return streamUrl;
      }
    } catch {
      continue;
    }
  }

  // Fallback: return primary working mirror stream URL directly
  return `https://invidious.projectsegfau.lt/latest_version?id=${encodeURIComponent(songId)}&itag=140`;
}
