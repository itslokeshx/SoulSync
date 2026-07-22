/**
 * Client-Side Direct Stream Resolver (High Availability Failover)
 * Resolves verified playable YouTube audio stream URLs via Cobalt, Piped, Invidious, and backend proxies.
 */

/**
 * Validates whether a candidate stream URL is actually playable.
 * Performs 6 verification checks:
 * 1. Reachable (no network, DNS, or timeout errors)
 * 2. Returns HTTP 200 or 206
 * 3. Has a valid SSL certificate (HTTPS protocol with successful TLS handshake)
 * 4. Is not blocked by CORS (cross-origin fetch with mode: 'cors' succeeds)
 * 5. Returns an audio Content-Type (e.g. audio/mp4, audio/webm, audio/mpeg, etc.)
 * 6. Can actually be assigned to an HTMLAudioElement
 */
export async function validateStreamUrl(
  url: string,
  timeoutMs: number = 3000
): Promise<boolean> {
  if (!url || typeof url !== "string") return false;

  // Check 3 (SSL / Protocol): Must use HTTPS protocol and be a valid URL
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return false;
    }
  } catch {
    return false;
  }

  // Check 6: Can actually be assigned to an HTMLAudioElement without throwing
  if (typeof window !== "undefined" && typeof Audio !== "undefined") {
    try {
      const testAudio = new Audio();
      testAudio.src = url;
      if (!testAudio.src || testAudio.error) {
        return false;
      }
      testAudio.removeAttribute("src");
      testAudio.load();
    } catch {
      return false;
    }
  }

  // Checks 1, 2, 3, 4, 5 via fetch with mode: 'cors'
  try {
    let res: Response;
    // Attempt HEAD request first for fast header check
    try {
      res = await fetch(url, {
        method: "HEAD",
        mode: "cors",
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Fallback to GET range request if server disallows HEAD (405 or 403)
      if (res.status === 405 || res.status === 403) {
        res = await fetch(url, {
          method: "GET",
          headers: { Range: "bytes=0-100" },
          mode: "cors",
          signal: AbortSignal.timeout(timeoutMs),
        });
      }
    } catch {
      // Fallback to GET range request if HEAD method or preflight fails
      res = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-100" },
        mode: "cors",
        signal: AbortSignal.timeout(timeoutMs),
      });
    }

    // Check 2: Returns HTTP 200 (or 206 Partial Content)
    if (res.status !== 200 && res.status !== 206) {
      return false;
    }

    // Check 5: Returns an audio Content-Type header
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const isAudio =
      contentType.includes("audio/") ||
      contentType.includes("application/ogg") ||
      contentType.includes("application/x-mpegurl") ||
      contentType.includes("application/vnd.apple.mpegurl");

    if (!isAudio) {
      return false;
    }

    // Check 6 (extended): Ensure HTMLAudioElement canPlayType supports extracted MIME
    if (typeof window !== "undefined" && typeof Audio !== "undefined") {
      const mime = contentType.split(";")[0].trim();
      if (mime && mime.startsWith("audio/")) {
        const testAudio = new Audio();
        if (testAudio.canPlayType && testAudio.canPlayType(mime) === "") {
          return false;
        }
      }
    }

    return true;
  } catch {
    // Check 1, 3, 4 failure: Reachability failure, DNS error (ERR_NAME_NOT_RESOLVED), SSL cert error, CORS block, or timeout
    return false;
  }
}

async function resolveCobaltStream(songId: string): Promise<string | null> {
  const cobaltInstances = [
    "https://api.cobalt.tools",
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
        if (
          data &&
          (data.status === "redirect" || data.status === "tunnel" || data.status === "picker") &&
          data.url
        ) {
          if (await validateStreamUrl(data.url)) {
            console.info(`[ClientStream] Resolved ${songId} via Cobalt (${inst})`);
            return data.url;
          }
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

  // Tier 1: Try Cobalt audio extractor
  const cobaltUrl = await resolveCobaltStream(songId);
  if (cobaltUrl) return cobaltUrl;

  // Tier 2: Try active Piped API instances
  const pipedInstances = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.drgns.space",
    "https://pipedapi.privacy.com.de",
    "https://pipedapi.simplelogin.fr",
  ];

  for (const inst of pipedInstances) {
    try {
      const res = await fetch(`${inst}/streams/${encodeURIComponent(songId)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.audioStreams) && data.audioStreams.length > 0) {
          // Sort candidates preferring audio/mp4 or M4A format, but try all until a valid one is found
          const candidateStreams = [...data.audioStreams].sort((a: any, b: any) => {
            const aPref = (a.mimeType?.includes("audio/mp4") || a.format === "M4A") ? 1 : 0;
            const bPref = (b.mimeType?.includes("audio/mp4") || b.format === "M4A") ? 1 : 0;
            return bPref - aPref;
          });

          for (const audio of candidateStreams) {
            if (audio?.url && (await validateStreamUrl(audio.url))) {
              console.info(`[ClientStream] Resolved ${songId} via Piped mirror: ${inst}`);
              return audio.url;
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Tier 3: Try active Invidious instances
  const invidiousInstances = [
    "https://inv.us.projectsegfau.lt",
    "https://invidious.drgns.space",
    "https://invidious.lunar.icu",
    "https://inv.tux.pizza",
  ];

  for (const inst of invidiousInstances) {
    try {
      const res = await fetch(`${inst}/api/v1/videos/${encodeURIComponent(songId)}`, {
        signal: AbortSignal.timeout(2500),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.adaptiveFormats)) {
          const audioFormats = data.adaptiveFormats.filter((f: any) =>
            f.type?.includes("audio") && f.url
          );
          for (const fmt of audioFormats) {
            if (await validateStreamUrl(fmt.url)) {
              console.info(`[ClientStream] Resolved ${songId} via Invidious mirror: ${inst}`);
              return fmt.url;
            }
          }
        }
      }
    } catch {
      continue;
    }
  }

  // Tier 4: Fallback to application backend stream proxy
  try {
    const backendBase =
      (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BACKEND_URL) ||
      "https://soulsync-backend-a5fs.onrender.com";
    const backendStreamUrl = `${backendBase.replace(/\/$/, "")}/api/search/stream?id=${encodeURIComponent(songId)}`;
    if (await validateStreamUrl(backendStreamUrl)) {
      console.info(`[ClientStream] Resolved ${songId} via backend stream proxy`);
      return backendStreamUrl;
    }
  } catch {
    // Ignore backend proxy error
  }

  console.warn(`[ClientStream] Unable to resolve any verified playable stream for song: ${songId}`);
  return null;
}


