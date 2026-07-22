/**
 * Client-Side Direct Stream Resolver (High Availability Failover)
 * Resolves working direct YouTube audio stream URLs via Cobalt, Piped, and Invidious APIs.
 */

async function resolveCobaltStream(songId: string): Promise<string | null> {
  const cobaltInstances = [
    "https://api.cobalt.tools",
    "https://cobalt-api.kwippy.com",
  ];

  for (const inst of cobaltInstances) {
    try {
      const res = await fetch(`${inst}/api/json`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${songId}`,
          downloadMode: "audio",
          audioFormat: "mp3",
        }),
        signal: AbortSignal.timeout(2500),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && (data.status === "redirect" || data.status === "tunnel" || data.status === "picker") && data.url) {
          console.info(`[ClientStream] Resolved ${songId} via Cobalt (${inst})`);
          return data.url;
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

export async function resolveClientStream(songId: string): Promise<string | null> {
  if (!songId || songId.startsWith("local_")) return null;

  // Tier 1: Try Cobalt high-speed audio extractor
  const cobaltUrl = await resolveCobaltStream(songId);
  if (cobaltUrl) return cobaltUrl;

  // Tier 2: Try active Piped API instances
  const pipedInstances = [
    "https://pipedapi.tokhmi.xyz",
    "https://pipedapi.moomoo.me",
    "https://pipedapi.syncflix.org",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.mha.fi",
    "https://piped-api.lunar.icu",
  ];

  for (const inst of pipedInstances) {
    try {
      const res = await fetch(`${inst}/streams/${encodeURIComponent(songId)}`, {
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
          const audio =
            data.audioStreams.find(
              (s: any) => s.mimeType?.includes("audio/mp4") || s.format === "M4A"
            ) || data.audioStreams[0];
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

  // Tier 3: Try active Invidious instances
  const publicInstances = [
    "https://invidious.flokinet.to",
    "https://invidious.privacydev.net",
    "https://iv.melmac.space",
    "https://invidious.fdn.fr",
    "https://invidious.nerdvpn.de",
  ];

  const inst = publicInstances[Math.floor(Math.random() * publicInstances.length)];
  return `${inst}/latest_version?id=${encodeURIComponent(songId)}&itag=140`;
}
