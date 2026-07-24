import { useState, useEffect } from "react";
import packageJson from "../../package.json";

const FALLBACK_URL = `https://github.com/itslokeshx/SoulSync/releases/download/v5.1.1/SoulSync_5.1.1.apk`;

export const useApkDownloadUrl = () => {
  const [url, setUrl] = useState(FALLBACK_URL);

  useEffect(() => {
    fetch("https://api.github.com/repos/itslokeshx/SoulSync/releases/latest")
      .then((res) => {
        if (!res.ok) throw new Error("API response not OK");
        return res.json();
      })
      .then((data) => {
        if (data && data.assets && Array.isArray(data.assets)) {
          const apkAsset = data.assets.find(
            (asset: any) => asset.name && asset.name.endsWith(".apk")
          );
          if (apkAsset && apkAsset.browser_download_url) {
            setUrl(apkAsset.browser_download_url);
          }
        }
      })
      .catch((err) => {
        console.warn("Failed to fetch latest APK release from GitHub, using fallback:", err);
      });
  }, []);

  return url;
};
