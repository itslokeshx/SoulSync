import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Home, Search, Library, ChevronLeft, ChevronRight,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, Volume1, VolumeX, Heart, Music2, ListMusic,
  Clock, X, Disc3
} from 'lucide-react';

const API_BASE = 'https://jiosaavn.rajputhemant.dev';

// ─── Helpers ─────────────────────────────────────────────
const formatTime = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const getBestUrl = (downloadUrl) => {
  if (!downloadUrl || !Array.isArray(downloadUrl) || downloadUrl.length === 0) return null;
  const sorted = [...downloadUrl].sort((a, b) => {
    const q = { '12kbps': 1, '48kbps': 2, '96kbps': 3, '160kbps': 4, '320kbps': 5 };
    return (q[b.quality] || 0) - (q[a.quality] || 0);
  });
  return sorted[0]?.url || sorted[0]?.link || null;
};

const getImage = (images, size = 2) => {
  if (!images) return '';
  if (Array.isArray(images)) return images[Math.min(size, images.length - 1)]?.url || images[0]?.url || '';
  if (typeof images === 'string') return images;
  return '';
};

const truncate = (str, len = 30) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
};

// ─── Skeleton Card ───────────────────────────────────────
const SkeletonCard = () => (
  <div className="flex-shrink-0 w-[160px]">
    <div className="w-[160px] h-[160px] rounded-md bg-[#282828] skeleton-pulse" />
    <div className="mt-3 h-3 w-3/4 rounded bg-[#282828] skeleton-pulse" />
    <div className="mt-2 h-2.5 w-1/2 rounded bg-[#282828] skeleton-pulse" />
  </div>
);

// ─── Equalizer Bars ──────────────────────────────────────
const EqBars = () => (
  <div className="flex items-end gap-[2px] h-3">
    <div className="w-[3px] bg-brand rounded-sm eq-bar-1" />
    <div className="w-[3px] bg-brand rounded-sm eq-bar-2" />
    <div className="w-[3px] bg-brand rounded-sm eq-bar-3" />
    <div className="w-[3px] bg-brand rounded-sm eq-bar-4" />
  </div>
);

// ─── Song Card (Home/Browse) ─────────────────────────────
const SongCard = ({ song, onClick, isPlaying, isCurrent }) => (
  <div
    onClick={() => onClick(song)}
    className="flex-shrink-0 w-[160px] group cursor-pointer select-none"
  >
    <div className="relative w-[160px] h-[160px] rounded-md overflow-hidden shadow-lg">
      <img
        src={getImage(song.image)}
        alt={song.name || song.title}
        loading="lazy"
        className="w-full h-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-75"
      />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        {isCurrent && isPlaying ? (
          <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center shadow-xl">
            <EqBars />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center shadow-xl hover:scale-105 transition-transform">
            <Play size={20} className="text-black ml-0.5" fill="black" />
          </div>
        )}
      </div>
      {isCurrent && (
        <div className="absolute bottom-2 right-2">
          <EqBars />
        </div>
      )}
    </div>
    <p className="mt-2 text-sm font-medium text-white truncate">
      {song.name || song.title || 'Unknown'}
    </p>
    <p className="text-xs text-text-secondary truncate">
      {typeof song.artists === 'object' && song.artists?.primary
        ? song.artists.primary.map(a => a.name).join(', ')
        : song.artist || song.subtitle || ''}
    </p>
  </div>
);

// ─── Horizontal Scroll Section ───────────────────────────
const HScrollSection = ({ title, songs, loading, onSongClick, currentSong, isPlaying, onSeeAll }) => (
  <div className="mb-8 fade-in">
    <div className="flex items-center justify-between mb-4 px-1">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      {onSeeAll && (
        <button onClick={onSeeAll} className="text-sm font-semibold text-text-secondary hover:text-brand transition-colors">
          See all
        </button>
      )}
    </div>
    <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
      {loading
        ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        : songs.map((song, i) => (
          <SongCard
            key={song.id || i}
            song={song}
            onClick={onSongClick}
            isPlaying={isPlaying}
            isCurrent={currentSong?.id === song.id}
          />
        ))
      }
    </div>
  </div>
);

// ─── Main App ────────────────────────────────────────────
export default function App() {
  // ── Navigation ──
  const [currentView, setCurrentView] = useState('home');
  const [viewHistory, setViewHistory] = useState([{ view: 'home', data: null }]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [viewData, setViewData] = useState(null);

  // ── Search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCache] = useState(() => new Map());
  const abortRef = useRef(null);

  // ── Home Sections ──
  const [homeSections, setHomeSections] = useState({
    trending: { songs: [], loading: true },
    bollywood: { songs: [], loading: true },
    english: { songs: [], loading: true },
    romantic: { songs: [], loading: true },
  });

  // ── Playback ──
  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [liked, setLiked] = useState(new Set());
  const audioRef = useRef(null);

  // ── Artist / Album ──
  const [artistData, setArtistData] = useState(null);
  const [albumData, setAlbumData] = useState(null);
  const [pageLoading, setPageLoading] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState(null);

  const showToast = useCallback((msg, type = 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // ── Navigation helpers ──
  const navigate = useCallback((view, data = null) => {
    setCurrentView(view);
    setViewData(data);
    const newEntry = { view, data };
    setViewHistory(prev => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newEntry];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const entry = viewHistory[newIndex];
      setCurrentView(entry.view);
      setViewData(entry.data);
    }
  }, [historyIndex, viewHistory]);

  const goForward = useCallback(() => {
    if (historyIndex < viewHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const entry = viewHistory[newIndex];
      setCurrentView(entry.view);
      setViewData(entry.data);
    }
  }, [historyIndex, viewHistory]);

  // ── Fetch helper ──
  const fetchApi = useCallback(async (endpoint, signal) => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { signal });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return data.data || data;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('API Error:', e);
      }
      return null;
    }
  }, []);

  // ── Fetch home sections ──
  useEffect(() => {
    const queries = [
      { key: 'trending', query: 'trending hindi 2024' },
      { key: 'bollywood', query: 'bollywood hits' },
      { key: 'english', query: 'english top hits' },
      { key: 'romantic', query: 'romantic hindi songs' },
    ];

    queries.forEach(async ({ key, query }) => {
      const data = await fetchApi(`/api/search/songs?query=${encodeURIComponent(query)}&page=1&limit=20`);
      setHomeSections(prev => ({
        ...prev,
        [key]: { songs: data?.results || [], loading: false },
      }));
    });
  }, [fetchApi]);

  // ── Search with debounce ──
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    if (searchCache.has(searchQuery.trim())) {
      setSearchResults(searchCache.get(searchQuery.trim()));
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      const [songsData, albumsData, artistsData] = await Promise.all([
        fetchApi(`/api/search/songs?query=${encodeURIComponent(searchQuery)}&page=1&limit=20`, signal),
        fetchApi(`/api/search/albums?query=${encodeURIComponent(searchQuery)}&limit=10`, signal),
        fetchApi(`/api/search/artists?query=${encodeURIComponent(searchQuery)}&limit=10`, signal),
      ]);

      const result = {
        songs: songsData?.results || [],
        albums: albumsData?.results || [],
        artists: artistsData?.results || [],
      };

      // LRU cache (max 5)
      if (searchCache.size >= 5) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
      }
      searchCache.set(searchQuery.trim(), result);

      setSearchResults(result);
      setSearchLoading(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchApi, searchCache]);

  // ── Audio Engine ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMeta = () => setDuration(audio.duration);
    const onEnded = () => {
      if (isRepeat) {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };
    const onError = () => showToast('Failed to load audio. Trying next…');

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [isRepeat, queue, queueIndex]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // ── Play song ──
  const playSong = useCallback((song, songList = null, index = -1) => {
    const url = getBestUrl(song.downloadUrl);
    if (!url) {
      showToast('No playable URL found for this song');
      return;
    }

    setCurrentSong(song);
    if (songList) {
      setQueue(songList);
      setQueueIndex(index >= 0 ? index : songList.findIndex(s => s.id === song.id));
    } else if (queue.length === 0 || !queue.find(s => s.id === song.id)) {
      setQueue(prev => [...prev, song]);
      setQueueIndex(prev => prev + 1);
    } else {
      setQueueIndex(queue.findIndex(s => s.id === song.id));
    }

    const audio = audioRef.current;
    if (audio) {
      audio.src = url;
      audio.play().then(() => setIsPlaying(true)).catch(() => { });
    }

    // Fetch suggestions for auto-queue
    fetchApi(`/api/songs/${song.id}/suggestions?limit=10`).then(data => {
      if (data && Array.isArray(data)) {
        setQueue(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const newSongs = data.filter(s => !existingIds.has(s.id));
          return [...prev, ...newSongs];
        });
      }
    });
  }, [queue, fetchApi, showToast]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play().then(() => setIsPlaying(true)).catch(() => { }); }
  }, [isPlaying, currentSong]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = queueIndex + 1;
      if (nextIdx >= queue.length) nextIdx = 0;
    }
    const nextSong = queue[nextIdx];
    if (nextSong) {
      setQueueIndex(nextIdx);
      const url = getBestUrl(nextSong.downloadUrl);
      if (url) {
        setCurrentSong(nextSong);
        const audio = audioRef.current;
        if (audio) {
          audio.src = url;
          audio.play().then(() => setIsPlaying(true)).catch(() => { });
        }
      }
    }
  }, [queue, queueIndex, isShuffle]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) prevIdx = queue.length - 1;
    const prevSong = queue[prevIdx];
    if (prevSong) {
      setQueueIndex(prevIdx);
      const url = getBestUrl(prevSong.downloadUrl);
      if (url) {
        setCurrentSong(prevSong);
        if (audio) {
          audio.src = url;
          audio.play().then(() => setIsPlaying(true)).catch(() => { });
        }
      }
    }
  }, [queue, queueIndex]);

  const handleSeek = useCallback((e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) audioRef.current.currentTime = time;
    setCurrentTime(time);
  }, []);

  const handleVolume = useCallback((e) => {
    setVolume(parseFloat(e.target.value));
  }, []);

  // ── Open Artist ──
  const openArtist = useCallback(async (artist) => {
    setPageLoading(true);
    navigate('artist', artist);
    const id = artist.id || artist.artistId;
    const [details, songsData] = await Promise.all([
      fetchApi(`/api/artists/${id}`),
      fetchApi(`/api/artists/${id}/songs`),
    ]);
    setArtistData({
      ...artist,
      ...(details || {}),
      topSongs: songsData?.results || songsData?.songs || details?.topSongs || [],
    });
    setPageLoading(false);
  }, [fetchApi, navigate]);

  // ── Open Album ──
  const openAlbum = useCallback(async (album) => {
    setPageLoading(true);
    navigate('album', album);
    const data = await fetchApi(`/api/albums?id=${album.id}`);
    setAlbumData(data || album);
    setPageLoading(false);
  }, [fetchApi, navigate]);

  // ── Browse genres ──
  const browseGenre = useCallback((genre) => {
    setSearchQuery(genre);
    navigate('search');
  }, [navigate]);

  // ── Sidebar ──
  const genres = ['Trending', 'Bollywood', 'Pop', 'Hip-Hop', 'Romance', 'Party', 'Devotional', 'Classical'];

  const Sidebar = () => (
    <aside className="fixed left-0 top-0 bottom-[90px] w-[240px] bg-black flex flex-col z-30">
      {/* Logo */}
      <div className="px-6 pt-6 pb-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center">
          <Music2 size={20} className="text-black" />
        </div>
        <span className="text-2xl font-extrabold text-brand tracking-tight">Saavn</span>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-1">
        {[
          { icon: Home, label: 'Home', view: 'home' },
          { icon: Search, label: 'Search', view: 'search' },
          { icon: Library, label: 'Your Library', view: 'library' },
        ].map(({ icon: Icon, label, view }) => (
          <button
            key={view}
            onClick={() => { navigate(view); if (view === 'home') setSearchQuery(''); }}
            className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-md text-sm font-semibold transition-all duration-200
              ${currentView === view
                ? 'bg-bg-card-hover text-white border-l-[3px] border-brand pl-[9px]'
                : 'text-text-secondary hover:text-white hover:bg-bg-card'
              }`}
          >
            <Icon size={22} />
            {label}
          </button>
        ))}
      </nav>

      {/* Browse */}
      <div className="mt-6 px-5 flex-1 overflow-y-auto hide-scrollbar">
        <h3 className="text-[11px] font-bold text-text-muted tracking-widest uppercase mb-3">Browse</h3>
        <div className="flex flex-wrap gap-2">
          {genres.map(g => (
            <button
              key={g}
              onClick={() => browseGenre(g)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-bg-card text-text-secondary
                hover:bg-bg-card-hover hover:text-white transition-all duration-200"
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-border-subtle">
        <p className="text-[10px] text-text-muted">Powered by JioSaavn</p>
        <p className="text-[9px] text-text-muted mt-0.5">v1.0.0</p>
      </div>
    </aside>
  );

  // ── Top Bar ──
  const TopBar = () => (
    <div className="sticky top-0 z-20 flex items-center gap-4 px-6 py-4 bg-bg-primary/90 backdrop-blur-md">
      {/* Nav arrows */}
      <button onClick={goBack} disabled={historyIndex <= 0}
        className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center disabled:opacity-30 hover:bg-bg-card-hover transition">
        <ChevronLeft size={18} />
      </button>
      <button onClick={goForward} disabled={historyIndex >= viewHistory.length - 1}
        className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center disabled:opacity-30 hover:bg-bg-card-hover transition">
        <ChevronRight size={18} />
      </button>

      {/* Search */}
      <div className="flex-1 max-w-xl relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (currentView !== 'search' && e.target.value) navigate('search');
            if (!e.target.value && currentView === 'search') navigate('home');
          }}
          placeholder="What do you want to listen to?"
          className="w-full py-2.5 pl-11 pr-10 rounded-full bg-bg-elevated text-sm text-white
            placeholder-text-muted border border-transparent focus:border-white/20
            focus:outline-none transition-all duration-200"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); navigate('home'); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );

  // ── Home Page ──
  const HomePage = () => (
    <div className="px-6 pb-8 fade-in">
      <h1 className="text-2xl font-bold text-white mb-6 mt-2">Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}</h1>
      <HScrollSection title="Trending Now 🔥" songs={homeSections.trending.songs} loading={homeSections.trending.loading}
        onSongClick={(s) => playSong(s, homeSections.trending.songs)} currentSong={currentSong} isPlaying={isPlaying} />
      <HScrollSection title="Top Bollywood Hits" songs={homeSections.bollywood.songs} loading={homeSections.bollywood.loading}
        onSongClick={(s) => playSong(s, homeSections.bollywood.songs)} currentSong={currentSong} isPlaying={isPlaying} />
      <HScrollSection title="English Charts" songs={homeSections.english.songs} loading={homeSections.english.loading}
        onSongClick={(s) => playSong(s, homeSections.english.songs)} currentSong={currentSong} isPlaying={isPlaying} />
      <HScrollSection title="Romantic Songs 💕" songs={homeSections.romantic.songs} loading={homeSections.romantic.loading}
        onSongClick={(s) => playSong(s, homeSections.romantic.songs)} currentSong={currentSong} isPlaying={isPlaying} />
    </div>
  );

  // ── Search Results ──
  const SearchResultsView = () => {
    if (searchLoading) {
      return (
        <div className="px-6 pb-8 fade-in">
          <h2 className="text-xl font-bold mb-4">Searching…</h2>
          <div className="flex gap-4 overflow-x-auto hide-scrollbar">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      );
    }

    if (!searchResults) {
      return (
        <div className="px-6 pb-8 fade-in">
          <h2 className="text-xl font-bold mb-4">Search</h2>
          <p className="text-text-secondary text-sm">Start typing to search for songs, artists, and albums.</p>
          {/* Genre Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
            {genres.map((g, i) => {
              const colors = ['from-indigo-600', 'from-pink-600', 'from-green-600', 'from-purple-600', 'from-orange-600', 'from-cyan-600', 'from-rose-600', 'from-amber-600'];
              return (
                <button key={g} onClick={() => browseGenre(g)}
                  className={`relative h-[100px] rounded-lg bg-gradient-to-br ${colors[i % colors.length]} to-transparent overflow-hidden
                    hover:scale-[1.02] transition-transform duration-200`}>
                  <span className="absolute bottom-3 left-4 text-lg font-bold">{g}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    const { songs = [], albums = [], artists = [] } = searchResults;
    const noResults = songs.length === 0 && albums.length === 0 && artists.length === 0;

    if (noResults) {
      return (
        <div className="px-6 pb-8 fade-in flex flex-col items-center justify-center py-20">
          <Search size={48} className="text-text-muted mb-4" />
          <p className="text-xl font-bold mb-2">No results found for &ldquo;{searchQuery}&rdquo;</p>
          <p className="text-text-secondary text-sm">Try different keywords or check for typos.</p>
        </div>
      );
    }

    return (
      <div className="px-6 pb-8 fade-in">
        {/* Artists */}
        {artists.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Artists</h2>
            <div className="flex gap-5 overflow-x-auto hide-scrollbar pb-2">
              {artists.map(artist => (
                <button key={artist.id} onClick={() => openArtist(artist)}
                  className="flex-shrink-0 flex flex-col items-center gap-2 group w-[120px]">
                  <div className="w-[100px] h-[100px] rounded-full overflow-hidden bg-bg-card shadow-lg">
                    <img src={getImage(artist.image)} alt={artist.name || artist.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                  </div>
                  <p className="text-sm font-medium truncate w-full text-center group-hover:text-white text-text-secondary transition-colors">
                    {artist.name || artist.title}
                  </p>
                  <p className="text-[10px] text-text-muted">Artist</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Songs */}
        {songs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Songs</h2>
            <div className="space-y-0.5">
              {songs.slice(0, 20).map((song, i) => {
                const isCurrent = currentSong?.id === song.id;
                return (
                  <button
                    key={song.id || i}
                    onClick={() => playSong(song, songs, i)}
                    className={`w-full flex items-center gap-4 px-3 py-2 rounded-md group transition-all duration-150
                      ${isCurrent ? 'bg-bg-card-hover' : 'hover:bg-bg-card'}`}
                  >
                    {/* Number / Play / Eq */}
                    <div className="w-6 flex items-center justify-center">
                      {isCurrent && isPlaying ? <EqBars /> :
                        <span className="text-sm text-text-muted group-hover:hidden">{i + 1}</span>}
                      {!(isCurrent && isPlaying) && <Play size={14} className="text-white hidden group-hover:block" fill="white" />}
                    </div>
                    {/* Art */}
                    <img src={getImage(song.image, 0)} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" loading="lazy" />
                    {/* Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-sm font-medium truncate ${isCurrent ? 'text-brand' : 'text-white'}`}>
                        {song.name || song.title}
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {typeof song.artists === 'object' && song.artists?.primary
                          ? song.artists.primary.map(a => a.name).join(', ')
                          : song.artist || song.subtitle || ''}
                      </p>
                    </div>
                    {/* Album */}
                    <p className="hidden md:block text-xs text-text-muted truncate max-w-[200px]">
                      {song.album?.name || song.album || ''}
                    </p>
                    {/* Duration */}
                    <span className="text-xs text-text-muted w-12 text-right">
                      {formatTime(song.duration)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Albums */}
        {albums.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Albums</h2>
            <div className="flex gap-4 overflow-x-auto hide-scrollbar pb-2">
              {albums.map(album => (
                <button key={album.id} onClick={() => openAlbum(album)}
                  className="flex-shrink-0 w-[160px] group text-left cursor-pointer">
                  <div className="w-[160px] h-[160px] rounded-md overflow-hidden shadow-lg">
                    <img src={getImage(album.image)} alt={album.name || album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy" />
                  </div>
                  <p className="mt-2 text-sm font-medium text-white truncate">{album.name || album.title}</p>
                  <p className="text-xs text-text-secondary truncate">{album.artist || album.subtitle || album.year || ''}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Artist Page ──
  const ArtistPage = () => {
    if (pageLoading || !artistData) {
      return (
        <div className="px-6 py-8 fade-in">
          <div className="h-[280px] rounded-xl bg-bg-card skeleton-pulse mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-bg-card skeleton-pulse" />
            ))}
          </div>
        </div>
      );
    }

    const artistName = artistData.name || artistData.title || '';
    const imgSrc = getImage(artistData.image);
    const topSongs = artistData.topSongs || [];
    const fanCount = artistData.fanCount || artistData.followerCount;

    return (
      <div className="fade-in">
        {/* Banner */}
        <div className="relative h-[320px] overflow-hidden">
          <img src={imgSrc} alt={artistName}
            className="absolute inset-0 w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/60 to-transparent" />
          <div className="absolute bottom-6 left-6">
            <p className="text-xs text-text-secondary font-medium mb-1 uppercase tracking-widest">Artist</p>
            <h1 className="text-5xl font-extrabold text-white drop-shadow-xl">{artistName}</h1>
            {fanCount && (
              <p className="text-sm text-text-secondary mt-2">{Number(fanCount).toLocaleString()} followers</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex items-center gap-4">
          <button onClick={() => { if (topSongs.length > 0) playSong(topSongs[0], topSongs, 0); }}
            className="w-14 h-14 rounded-full bg-brand flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
            <Play size={24} className="text-black ml-0.5" fill="black" />
          </button>
        </div>

        {/* Popular Songs */}
        <div className="px-6 pb-8">
          <h2 className="text-xl font-bold mb-4">Popular</h2>
          <div className="space-y-0.5">
            {topSongs.slice(0, 10).map((song, i) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <button
                  key={song.id || i}
                  onClick={() => playSong(song, topSongs, i)}
                  className={`w-full flex items-center gap-4 px-3 py-2 rounded-md group transition-all duration-150
                    ${isCurrent ? 'bg-bg-card-hover' : 'hover:bg-bg-card'}`}
                >
                  <div className="w-6 flex items-center justify-center">
                    {isCurrent && isPlaying ? <EqBars /> :
                      <span className="text-sm text-text-muted group-hover:hidden">{i + 1}</span>}
                    {!(isCurrent && isPlaying) && <Play size={14} className="text-white hidden group-hover:block" fill="white" />}
                  </div>
                  <img src={getImage(song.image, 0)} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" loading="lazy" />
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium truncate ${isCurrent ? 'text-brand' : 'text-white'}`}>
                      {song.name || song.title}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {typeof song.artists === 'object' && song.artists?.primary
                        ? song.artists.primary.map(a => a.name).join(', ')
                        : song.artist || song.subtitle || ''}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">{formatTime(song.duration)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Album Page ──
  const AlbumPage = () => {
    if (pageLoading || !albumData) {
      return (
        <div className="px-6 py-8 fade-in">
          <div className="flex gap-6">
            <div className="w-[230px] h-[230px] rounded-lg bg-bg-card skeleton-pulse flex-shrink-0" />
            <div className="flex-1 space-y-3 pt-8">
              <div className="h-8 w-2/3 rounded bg-bg-card skeleton-pulse" />
              <div className="h-4 w-1/3 rounded bg-bg-card skeleton-pulse" />
              <div className="h-4 w-1/4 rounded bg-bg-card skeleton-pulse" />
            </div>
          </div>
        </div>
      );
    }

    const albumName = albumData.name || albumData.title;
    const albumArt = getImage(albumData.image);
    const songs = albumData.songs || [];
    const artist = typeof albumData.artists === 'object' && albumData.artists?.primary
      ? albumData.artists.primary.map(a => a.name).join(', ')
      : albumData.artist || albumData.subtitle || '';

    return (
      <div className="fade-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-6 flex gap-6 items-end bg-gradient-to-b from-bg-card/50 to-transparent">
          <img src={albumArt} alt={albumName}
            className="w-[230px] h-[230px] rounded-lg shadow-2xl object-cover flex-shrink-0" />
          <div>
            <p className="text-xs text-text-secondary font-medium uppercase tracking-widest mb-1">Album</p>
            <h1 className="text-4xl font-extrabold text-white mb-3">{albumName}</h1>
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <span className="font-medium text-white">{artist}</span>
              {albumData.year && <><span>•</span><span>{albumData.year}</span></>}
              {songs.length > 0 && <><span>•</span><span>{songs.length} songs</span></>}
            </div>
          </div>
        </div>

        {/* Play All */}
        <div className="px-6 py-4 flex items-center gap-4">
          <button onClick={() => { if (songs.length > 0) playSong(songs[0], songs, 0); }}
            className="w-14 h-14 rounded-full bg-brand flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
            <Play size={24} className="text-black ml-0.5" fill="black" />
          </button>
        </div>

        {/* Track List */}
        <div className="px-6 pb-8">
          {/* Header row */}
          <div className="flex items-center gap-4 px-3 py-2 border-b border-border-subtle text-text-muted text-xs mb-2">
            <span className="w-6 text-center">#</span>
            <span className="flex-1">Title</span>
            <Clock size={14} />
          </div>
          <div className="space-y-0.5">
            {songs.map((song, i) => {
              const isCurrent = currentSong?.id === song.id;
              return (
                <button
                  key={song.id || i}
                  onClick={() => playSong(song, songs, i)}
                  className={`w-full flex items-center gap-4 px-3 py-2.5 rounded-md group transition-all duration-150
                    ${isCurrent ? 'bg-bg-card-hover' : 'hover:bg-bg-card'}`}
                >
                  <div className="w-6 flex items-center justify-center">
                    {isCurrent && isPlaying ? <EqBars /> :
                      <span className="text-sm text-text-muted group-hover:hidden">{i + 1}</span>}
                    {!(isCurrent && isPlaying) && <Play size={14} className="text-white hidden group-hover:block" fill="white" />}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium truncate ${isCurrent ? 'text-brand' : 'text-white'}`}>
                      {song.name || song.title}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {typeof song.artists === 'object' && song.artists?.primary
                        ? song.artists.primary.map(a => a.name).join(', ')
                        : song.artist || song.subtitle || ''}
                    </p>
                  </div>
                  <span className="text-xs text-text-muted">{formatTime(song.duration)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── Queue Panel ──
  const [showQueue, setShowQueue] = useState(false);

  const QueuePanel = () => {
    if (!showQueue) return null;
    return (
      <div className="fixed right-0 top-0 bottom-[90px] w-[320px] bg-bg-secondary border-l border-border-subtle z-30 flex flex-col fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h3 className="text-base font-bold">Queue</h3>
          <button onClick={() => setShowQueue(false)} className="text-text-muted hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto hide-scrollbar px-3 py-2">
          {queue.length === 0 ? (
            <p className="text-sm text-text-muted text-center mt-10">Queue is empty</p>
          ) : (
            <div className="space-y-0.5">
              {queue.map((song, i) => {
                const isCurrent = i === queueIndex;
                return (
                  <button key={`${song.id}-${i}`}
                    onClick={() => {
                      setQueueIndex(i);
                      const url = getBestUrl(song.downloadUrl);
                      if (url) {
                        setCurrentSong(song);
                        const audio = audioRef.current;
                        if (audio) { audio.src = url; audio.play().then(() => setIsPlaying(true)).catch(() => { }); }
                      }
                    }}
                    className={`w-full flex items-center gap-3 px-2 py-2 rounded-md transition-all duration-150
                      ${isCurrent ? 'bg-bg-card-hover' : 'hover:bg-bg-card'}`}
                  >
                    {isCurrent && isPlaying ? <EqBars /> : <span className="text-xs text-text-muted w-4">{i + 1}</span>}
                    <img src={getImage(song.image, 0)} alt="" className="w-9 h-9 rounded object-cover flex-shrink-0" loading="lazy" />
                    <div className="flex-1 min-w-0 text-left">
                      <p className={`text-xs font-medium truncate ${isCurrent ? 'text-brand' : 'text-white'}`}>
                        {song.name || song.title}
                      </p>
                      <p className="text-[10px] text-text-secondary truncate">
                        {typeof song.artists === 'object' && song.artists?.primary
                          ? song.artists.primary.map(a => a.name).join(', ')
                          : song.artist || song.subtitle || ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Player Bar ──
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const PlayerBar = () => (
    <div className="fixed bottom-0 left-0 right-0 h-[90px] bg-bg-card border-t border-border-subtle z-40 flex items-center px-4">
      {/* Left - Song Info */}
      <div className="flex items-center gap-3 w-[30%] min-w-0">
        {currentSong ? (
          <>
            <img src={getImage(currentSong.image, 1)} alt=""
              className="w-14 h-14 rounded-md object-cover shadow-lg flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentSong.name || currentSong.title}</p>
              <p className="text-xs text-text-secondary truncate">
                {typeof currentSong.artists === 'object' && currentSong.artists?.primary
                  ? currentSong.artists.primary.map(a => a.name).join(', ')
                  : currentSong.artist || currentSong.subtitle || ''}
              </p>
            </div>
            <button onClick={() => setLiked(prev => {
              const n = new Set(prev);
              n.has(currentSong.id) ? n.delete(currentSong.id) : n.add(currentSong.id);
              return n;
            })} className="flex-shrink-0 ml-1">
              <Heart size={16}
                className={`transition-colors ${liked.has(currentSong?.id) ? 'text-brand fill-brand' : 'text-text-muted hover:text-white'}`} />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-md bg-bg-elevated flex items-center justify-center">
              <Music2 size={20} className="text-text-muted" />
            </div>
            <div>
              <p className="text-sm text-text-muted">No song playing</p>
            </div>
          </div>
        )}
      </div>

      {/* Center - Controls */}
      <div className="flex flex-col items-center w-[40%]">
        {/* Buttons */}
        <div className="flex items-center gap-5 mb-1.5">
          <button onClick={() => setIsShuffle(!isShuffle)}
            className={`transition-colors ${isShuffle ? 'text-brand' : 'text-text-secondary hover:text-white'}`}>
            <Shuffle size={16} />
          </button>
          <button onClick={playPrev} className="text-text-secondary hover:text-white transition-colors">
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-white flex items-center justify-center hover:scale-105 transition-transform">
            {isPlaying
              ? <Pause size={18} className="text-black" fill="black" />
              : <Play size={18} className="text-black ml-0.5" fill="black" />}
          </button>
          <button onClick={playNext} className="text-text-secondary hover:text-white transition-colors">
            <SkipForward size={18} fill="currentColor" />
          </button>
          <button onClick={() => setIsRepeat(!isRepeat)}
            className={`transition-colors ${isRepeat ? 'text-brand' : 'text-text-secondary hover:text-white'}`}>
            <Repeat size={16} />
          </button>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2 w-full max-w-lg">
          <span className="text-[11px] text-text-muted w-10 text-right font-mono">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 progress-bar"
            style={{ '--progress': `${progressPct}%` }}
          />
          <span className="text-[11px] text-text-muted w-10 font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right - Volume + Queue */}
      <div className="flex items-center justify-end gap-3 w-[30%]">
        <button onClick={() => setShowQueue(!showQueue)}
          className={`transition-colors ${showQueue ? 'text-brand' : 'text-text-secondary hover:text-white'}`}>
          <ListMusic size={18} />
        </button>
        <VolumeIcon size={18} className="text-text-secondary flex-shrink-0" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={handleVolume}
          className="w-24 h-1 progress-bar"
          style={{ '--progress': `${volume * 100}%` }}
        />
      </div>
    </div>
  );

  // ── Render view content ──
  const renderView = () => {
    switch (currentView) {
      case 'search': return <SearchResultsView />;
      case 'artist': return <ArtistPage />;
      case 'album': return <AlbumPage />;
      case 'library': return (
        <div className="px-6 py-8 fade-in flex flex-col items-center justify-center min-h-[400px]">
          <Library size={48} className="text-text-muted mb-4" />
          <h2 className="text-xl font-bold mb-2">Your Library</h2>
          <p className="text-text-secondary text-sm">Sign in to save your favorite tracks.</p>
        </div>
      );
      default: return <HomePage />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg-primary font-sans">
      <audio ref={audioRef} preload="auto" />
      <Sidebar />
      <QueuePanel />

      {/* Main content */}
      <main
        className="ml-[240px] flex-1 overflow-y-auto hide-scrollbar pb-[90px]"
        style={{ marginRight: showQueue ? '320px' : '0' }}
      >
        <TopBar />
        {renderView()}
      </main>

      <PlayerBar />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-[100px] right-6 z-50 px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium fade-in
          ${toast.type === 'error' ? 'bg-red-600/90 text-white' : 'bg-brand text-black'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
