import { isNative } from "./platform";

const KEYS = {
  LAST_SEEN_VERSION: "lastSeenWhatsNewVersion",
  SEEN_IDS: "seenAnnouncementIds",
};

export async function getLastSeenWhatsNewVersion(): Promise<string> {
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: KEYS.LAST_SEEN_VERSION });
    return value || "";
  } else {
    return localStorage.getItem(KEYS.LAST_SEEN_VERSION) || "";
  }
}

export async function setLastSeenWhatsNewVersion(version: string): Promise<void> {
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: KEYS.LAST_SEEN_VERSION, value: version });
  } else {
    localStorage.setItem(KEYS.LAST_SEEN_VERSION, version);
  }
}

export async function getSeenAnnouncementIds(): Promise<string[]> {
  let val = "";
  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: KEYS.SEEN_IDS });
    val = value || "";
  } else {
    val = localStorage.getItem(KEYS.SEEN_IDS) || "";
  }

  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // ignore
  }
  return [];
}

export async function addSeenAnnouncementId(id: string): Promise<void> {
  const current = await getSeenAnnouncementIds();
  if (current.includes(id)) return;
  const updated = [id, ...current].slice(0, 100);
  const val = JSON.stringify(updated);

  if (isNative()) {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: KEYS.SEEN_IDS, value: val });
  } else {
    localStorage.setItem(KEYS.SEEN_IDS, val);
  }
}
