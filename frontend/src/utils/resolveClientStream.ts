/**
 * Client-Side Direct Stream Resolver (Residential Fallback)
 * Directly resolves audio stream URLs via public Invidious API mirrors from the client,
 * bypassing backend datacenter IP rate-limits on YouTube.
 */
export async function resolveClientStream(songId: string): Promise<string | null> {
  if (!songId || songId.startsWith("local_")) return null;

  const publicInstances = [
    "https://iv.melmac.space",
    "https://invidious.privacydev.net",
    "https://invidious.projectsegfau.lt",
    "https://invidious.lunar.icu",
    "https://yewtu.be",
  ];

  for (const inst of publicInstances) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const resp = await fetch(`${inst}/api/v1/videos/${encodeURIComponent(songId)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!resp.ok) continue;

      const data = await resp.json();
      const adaptive = data?.adaptiveFormats || [];
      const audioFormats = adaptive.filter((f: any) =>
        f.type && typeof f.type === "string" && f.type.startsWith("audio/")
      );

      if (audioFormats.length > 0) {
        audioFormats.sort((a: any, b: any) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
        const url = audioFormats[0].url;
        if (url) {
          console.info(`[ClientStream] Resolved ${songId} via client mirror: ${inst}`);
          return url;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}
