import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { useNetwork } from "./providers/NetworkProvider";
import { getOfflineSongs } from "./utils/offlineDB";
import { useOfflineStore } from "./store/offlineStore";
import { isNative } from "./utils/platform";

import { AppLayout } from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";

import { HomePage, ArtistPage, AlbumPage, LikedPage } from "./pages";
import LibraryPage from "./pages/LibraryPage";
import ProfilePage from "./pages/ProfilePage";
import PlaylistPage from "./pages/PlaylistPage";
import DownloadsPage from "./pages/DownloadsPage";
import SoulLinkPage from "./pages/SoulLinkPage";
import ImportPage from "./pages/ImportPage";
import { SearchPage } from "./pages/SearchPage";
import SongSharePage from "./pages/SongSharePage";

import { PlayerProvider } from "./providers/PlayerProvider";

export default function App() {
  useEffect(() => {
    if (!isNative()) {
      getOfflineSongs().then((songs) => {
        const store = useOfflineStore.getState();

        // Merge state: Keep existing Zustand data if it exists (for fileSize, etc)
        const hydrated = songs.map((s) => {
          const existing = store.downloads.find(d => d.songId === s.id);
          return {
            songId: s.id,
            title: s.name,
            artist: s.artist,
            albumArt: s.albumArt,
            duration: s.duration,
            filePath: existing?.filePath || "",
            downloadedAt: s.savedAt,
            fileSize: existing?.fileSize || s.fileSize || 0,
            playlistName: s.playlistName,
            songData: existing?.songData || s,
          };
        });

        store.updateDownloadsOrder(hydrated);
      });
    }
  }, []);

  return (
    <PlayerProvider>
      <AppRouter />
    </PlayerProvider>
  );
}

function AppRouter() {
  const { isOnline } = useNetwork();
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route path="/" element={<AppLayout />}>
        {/* These work ALWAYS — online or offline */}
        <Route index element={<HomePage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="liked" element={<LikedPage />} />
        <Route path="artist/:id" element={<ArtistPage />} />
        <Route path="album/:id" element={<AlbumPage />} />
        <Route path="playlist/:slug/:id" element={<PlaylistPage />} />
        <Route path="playlist/:id" element={<PlaylistPage />} />
        <Route path="song/:slug/:id" element={<SongSharePage />} />
        <Route path="song/:id" element={<SongSharePage />} />
        <Route path="soullink" element={<SoulLinkPage />} />
        <Route path="import" element={<ImportPage />} />

        {/* Online only — redirect to downloads if offline */}
        <Route
          path="search"
          element={
            isOnline ? <SearchPage /> : <Navigate to="/downloads" replace />
          }
        />

        <Route path="profile" element={<ProfilePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
