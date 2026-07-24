import { App } from "@capacitor/app";

const VERSION_URL = "https://raw.githubusercontent.com/itslokeshx/SoulSync/main/version.json";


export const getCurrentVersion = async () => {
    try {
        const info = await App.getInfo();
        return info.version;
    } catch {
        // Fallback for web or dev environment where App.getInfo() might throw
        return "1.0.0";
    }
};

export const getLatestVersion = async () => {
    const res = await fetch(VERSION_URL + "?t=" + Date.now()); // cache buster
    return await res.json();
};

export const compareVersions = (v1: string, v2: string) => {
    if (!v1 || !v2) return false;
    const clean1 = String(v1).replace(/^v/i, "").trim();
    const clean2 = String(v2).replace(/^v/i, "").trim();
    const a = clean1.split(".").map((n) => parseInt(n, 10) || 0);
    const b = clean2.split(".").map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const diff = (a[i] || 0) - (b[i] || 0);
        if (diff !== 0) return diff < 0;
    }
    return false;
};

export const checkForUpdate = async () => {
    try {
        const current = await getCurrentVersion();
        const latest = await getLatestVersion();

        const updateAvailable = compareVersions(current, latest.version);

        if (updateAvailable) {
            return latest;
        }

        return null;
    } catch (e) {
        console.error("Update check failed", e);
        return null;
    }
};
