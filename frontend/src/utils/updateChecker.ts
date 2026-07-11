import { App } from "@capacitor/app";

const repo = import.meta.env.VITE_GITHUB_REPO || "itslokeshx/SoulSync";
const VERSION_URL = `https://raw.githubusercontent.com/${repo}/main/version.json`;

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
    const a = v1.split(".").map(Number);
    const b = v2.split(".").map(Number);

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
