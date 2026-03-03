import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  Home, Search, Library, ChevronLeft, ChevronRight,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat,
  Volume2, Volume1, VolumeX, Heart, Music2, ListMusic,
  Clock, X, MoreHorizontal, Maximize2
} from 'lucide-react';

const API_BASE = 'https://jiosaavn.rajputhemant.dev';

// ─── UTILITIES ──────────────────────────────────────────
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
  return sorted[0]?.link || sorted[0]?.url || null;
};

const getImage = (images, size = 2) => {
  if (!images) return '';
  if (Array.isArray(images)) return images[Math.min(size, images.length - 1)]?.link || images[0]?.link || '';
  if (typeof images === 'string') return images;
  return '';
};

// ─── API ABSTRACTION ────────────────────────────────────
const api = {
  get: async (endpoint, signal) => {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, { signal });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return data.data || data;
    } catch (e) {
      if (e.name !== 'AbortError') console.error('API Error:', e);
      return null;
    }
  }
};

// ─── UI COMPONENTS ──────────────────────────────────────
const EqBars = memo(() => (
  <div className="flex items-end gap-[2px] h-3">
    <div className="w-[3px] bg-brand rounded-sm eq-bar-1" />
    <div className="w-[3px] bg-brand rounded-sm eq-bar-2" />
    <div className="w-[3px] bg-brand rounded-sm eq-bar-3" />
    <div className="w-[3px] bg-brand rounded-sm eq-bar-4" />
  </div>
));
EqBars.displayName = 'EqBars';

const CardSkeleton = () => (
  <div className="flex-shrink-0 w-[160px]">
    <div className="w-[160px] h-[160px] rounded-lg bg-bg-card-hover skeleton-pulse shadow-md mb-3" />
    <div className="h-3.5 w-3/4 rounded bg-bg-card-hover skeleton-pulse mb-2" />
    <div className="h-2.5 w-1/2 rounded bg-bg-card-hover skeleton-pulse" />
  </div>
);

const SongCard = memo(({ song, onClick, isPlaying, isCurrent }) => (
  <button
    onClick={() => onClick(song)}
    className="flex-shrink-0 w-[160px] group text-left cursor-pointer transition-colors p-3 hover:bg-bg-card-hover rounded-xl"
  >
    <div className="relative w-full aspect-square rounded-md overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)] mb-4">
      <img src={getImage(song.image)} alt={song.name || song.title} loading="lazy"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
      <div className={`absolute inset-0 bg-black/40 flex flex-col items-center justify-center transition-opacity duration-200
        ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {isCurrent && isPlaying ? (
          <EqBars />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center shadow-[0_8px_16px_rgba(0,0,0,0.4)] hover:scale-105 transition-transform text-black hover:bg-brand-hover">
            <Play size={24} className="ml-1" fill="currentColor" />
          </div>
        )}
      </div>
    </div>
    <p className="text-sm font-bold text-text-primary truncate">{song.name || song.title || 'Unknown'}</p>
    <p className="text-xs text-text-secondary truncate mt-1">
      {typeof song.artists === 'object' && song.artists?.primary
        ? song.artists.primary.map(a => a.name).join(', ')
        : song.artist || song.subtitle || ''}
    </p>
  </button>
));
SongCard.displayName = 'SongCard';

const HSection = ({ title, items, loading, onItemClick, currentId, isPlaying }) => (
  <div className="mb-10 fade-in">
    <div className="flex items-end justify-between mb-5 px-1">
      <h2 className="text-2xl font-bold tracking-tight text-text-primary">{title}</h2>
    </div>
    <div className="flex gap-2 overflow-x-auto hide-scrollbar -mx-2 px-2 pb-4">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        : items.map((item, i) => (
          <SongCard
            key={item.id || i}
            song={item}
            onClick={onItemClick}
            isPlaying={isPlaying}
            isCurrent={currentId === item.id}
          />
        ))
      }
    </div>
  </div>
);

// ─── APP SHELL ──────────────────────────────────────────
export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [viewHistory, setViewHistory] = useState([{ view: 'home', data: null }]);
  const [hIndex, setHIndex] = useState(0);
  const [viewData, setViewData] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const abortRef = useRef(null);

  const [homeFeed, setHomeFeed] = useState({
    trending: { items: [], loading: true },
    bollywood: { items: [], loading: true },
    english: { items: [], loading: true }
  });

  const [currentSong, setCurrentSong] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueIdx, setQueueIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState({ current: 0, duration: 0 });
  const [volume, setVolume] = useState(1);
  const [settings, setSettings] = useState({ shuffle: false, repeat: false });
  const [liked, setLiked] = useState(new Set());
  const audioRef = useRef(null);

  const [artistData, setArtistData] = useState(null);
  const [albumData, setAlbumData] = useState(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Helpers ──
  const showToast = useCallback(msg => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const navigate = useCallback((view, data = null) => {
    setCurrentView(view);
    setViewData(data);
    setViewHistory(prev => {
      const slice = prev.slice(0, hIndex + 1);
      return [...slice, { view, data }];
    });
    setHIndex(prev => prev + 1);
  }, [hIndex]);

  // ── Fetch Home Feed ──
  useEffect(() => {
    const fetchHome = async () => {
      const qs = [
        { key: 'trending', q: 'trending hindi' },
        { key: 'bollywood', q: 'bollywood hits' },
        { key: 'english', q: 'global top hits' }
      ];
      for (const { key, q } of qs) {
        const data = await api.get(`/search/songs?q=${encodeURIComponent(q)}&page=1&n=12`);
        setHomeFeed(prev => ({
          ...prev,
          [key]: { items: data?.results || [], loading: false }
        }));
      }
    };
    fetchHome();
  }, []);

  // ── Search ──
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;
      const q = encodeURIComponent(searchQuery);

      const [songs, albums, artists] = await Promise.all([
        api.get(`/search/songs?q=${q}&page=1&n=20`, signal),
        api.get(`/search/albums?q=${q}&page=1&n=10`, signal),
        api.get(`/search/artists?q=${q}&page=1&n=10`, signal)
      ]);

      setSearchResults({
        songs: songs?.results || [],
        albums: albums?.results || [],
        artists: artists?.results || []
      });
      setSearchLoading(false);
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Audio Lifecycle ──
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const updTime = () => setProgress(p => ({ ...p, current: a.currentTime }));
    const updDur = () => setProgress(p => ({ ...p, duration: a.duration }));
    const ended = () => {
      if (settings.repeat) { a.currentTime = 0; a.play(); }
      else playNext();
    };
    a.addEventListener('timeupdate', updTime);
    a.addEventListener('loadedmetadata', updDur);
    a.addEventListener('ended', ended);
    return () => {
      a.removeEventListener('timeupdate', updTime);
      a.removeEventListener('loadedmetadata', updDur);
      a.removeEventListener('ended', ended);
    };
  }, [settings.repeat, queue, queueIdx]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  // ── Play Controls ──
  const playTrack = useCallback((song, list = null, idx = -1) => {
    const url = getBestUrl(song.downloadUrl);
    if (!url) { showToast('Track not available'); return; }

    setCurrentSong(song);
    if (list) {
      setQueue(list);
      setQueueIdx(idx >= 0 ? idx : list.findIndex(s => s.id === song.id));
    } else {
      setQueue(prev => [...prev, song]);
      setQueueIdx(prev => prev + 1);
    }

    const a = audioRef.current;
    if (a) {
      a.src = url;
      a.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !currentSong) return;
    if (isPlaying) { a.pause(); setIsPlaying(false); }
    else { a.play().then(() => setIsPlaying(true)).catch(console.error); }
  }, [isPlaying, currentSong]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let next = settings.shuffle ? Math.floor(Math.random() * queue.length) : queueIdx + 1;
    if (next >= queue.length) next = 0;
    playTrack(queue[next], queue, next);
  }, [queue, queueIdx, settings.shuffle, playTrack]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    const a = audioRef.current;
    if (a && a.currentTime > 3) { a.currentTime = 0; return; }
    let prev = queueIdx - 1;
    if (prev < 0) prev = queue.length - 1;
    playTrack(queue[prev], queue, prev);
  }, [queue, queueIdx, playTrack]);

  const openArtist = useCallback(async (artist) => {
    setPageLoading(true);
    navigate('artist');
    const id = artist.id || artist.artistId;
    const [dets, songs] = await Promise.all([
      api.get(`/artist?id=${id}`),
      api.get(`/artist/songs?id=${id}`)
    ]);
    setArtistData({
      ...artist,
      ...dets,
      topSongs: songs?.results || songs?.songs || []
    });
    setPageLoading(false);
  }, [navigate]);

  const openAlbum = useCallback(async (album) => {
    setPageLoading(true);
    navigate('album');
    const data = await api.get(`/album?id=${album.id}`);
    setAlbumData(data || album);
    setPageLoading(false);
  }, [navigate]);

  // ── Views ──
  const HomeView = () => (
    <div className="px-8 pb-12 pt-4 fade-in max-w-[1800px] mx-auto">
      <h1 className="text-[2rem] font-bold text-text-primary tracking-tight mb-8">
        Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}
      </h1>
      <HSection title="Trending Now" items={homeFeed.trending.items} loading={homeFeed.trending.loading}
        onItemClick={s => playTrack(s, homeFeed.trending.items)} currentId={currentSong?.id} isPlaying={isPlaying} />
      <HSection title="Bollywood Hits" items={homeFeed.bollywood.items} loading={homeFeed.bollywood.loading}
        onItemClick={s => playTrack(s, homeFeed.bollywood.items)} currentId={currentSong?.id} isPlaying={isPlaying} />
      <HSection title="Global Top Hits" items={homeFeed.english.items} loading={homeFeed.english.loading}
        onItemClick={s => playTrack(s, homeFeed.english.items)} currentId={currentSong?.id} isPlaying={isPlaying} />
    </div>
  );

  const SearchView = () => {
    if (searchLoading) return (
      <div className="px-8 py-8 flex flex-wrap gap-4">{Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}</div>
    );
    if (!searchResults) return (
      <div className="px-8 py-8">
        <h2 className="text-2xl font-bold mb-6">Browse all</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {['Hindi', 'English', 'Punjabi', 'Tamil', 'Telugu', 'Pop', 'Romance', 'Party', 'Devotional', 'Hip Hop'].map((g, i) => {
            const cols = ['bg-pink-600', 'bg-purple-600', 'bg-orange-600', 'bg-emerald-600', 'bg-blue-600'];
            return (
              <div key={g} onClick={() => setSearchQuery(g)} className={`aspect-square rounded-xl p-4 cursor-pointer hover:scale-105 transition-transform ${cols[i % cols.length]} shadow-md relative overflow-hidden`}>
                <span className="text-xl font-bold">{g}</span>
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-black/20 rounded-full blur-xl" />
              </div>
            );
          })}
        </div>
      </div>
    );

    const { songs, albums, artists } = searchResults;
    if (!songs.length && !albums.length && !artists.length) return (
      <div className="px-8 py-20 text-center"><p className="text-xl text-text-secondary">No results found for "{searchQuery}"</p></div>
    );

    return (
      <div className="px-8 pb-12 pt-4 fade-in max-w-[1800px] mx-auto">
        {songs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Top Songs</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {songs.slice(0, 8).map((s, i) => (
                <button key={s.id} onClick={() => playTrack(s, songs, i)}
                  className="flex items-center gap-4 p-2 rounded-md hover:bg-bg-card-hover group text-left w-full transition-colors">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <img src={getImage(s.image)} alt="" className="w-full h-full object-cover rounded shadow" />
                    <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center rounded">
                      <Play size={16} fill="white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-base font-medium truncate ${currentSong?.id === s.id ? 'text-brand' : 'text-white'}`}>{s.name || s.title}</p>
                    <p className="text-sm text-text-secondary truncate">{s.subtitle}</p>
                  </div>
                  <span className="text-sm text-text-secondary w-12 text-right">{formatTime(s.duration)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {artists.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Artists</h2>
            <div className="flex gap-6 overflow-x-auto hide-scrollbar pb-4 -mx-2 px-2">
              {artists.map(a => (
                <button key={a.id} onClick={() => openArtist(a)} className="flex flex-col items-center gap-3 w-[140px] flex-shrink-0 group hover:bg-bg-card-hover p-3 rounded-xl transition-colors">
                  <img src={getImage(a.image)} alt="" className="w-[110px] h-[110px] rounded-full object-cover shadow-lg group-hover:shadow-2xl transition-shadow" />
                  <p className="text-base font-bold truncate w-full text-center">{a.name || a.title}</p>
                  <span className="text-xs text-text-secondary">Artist</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {albums.length > 0 && (
          <HSection title="Albums" items={albums} onItemClick={openAlbum} />
        )}
      </div>
    );
  };

  const TrackListView = ({ headerRef, tracks = [], isAlbum = false }) => (
    <div className="px-8 pb-12 max-w-[1800px] mx-auto fade-in">
      <div className="flex items-center gap-6 mb-8 pt-6">
        <button onClick={() => { if (tracks.length) playTrack(tracks[0], tracks, 0) }}
          className="w-14 h-14 rounded-full bg-brand flex items-center justify-center hover:scale-105 transition-transform text-black shadow-lg">
          <Play size={24} className="ml-1" fill="currentColor" />
        </button>
        <button className="text-text-secondary hover:text-white"><Heart size={32} /></button>
        <button className="text-text-secondary hover:text-white"><MoreHorizontal size={32} /></button>
      </div>
      <div>
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border-subtle text-text-secondary text-sm mb-4">
          <span className="w-6 text-center">#</span>
          <span className="flex-1">Title</span>
          {!isAlbum && <span className="flex-1 hidden md:block">Album</span>}
          <Clock size={16} />
        </div>
        {tracks.map((s, i) => {
          const isCur = currentSong?.id === s.id;
          return (
            <button key={s.id} onClick={() => playTrack(s, tracks, i)}
              className="w-full flex items-center gap-4 px-4 py-2.5 rounded-md hover:bg-bg-card-hover group transition-colors text-left focus:outline-none">
              <div className="w-6 flex justify-center text-text-secondary text-base">
                {isCur && isPlaying ? <EqBars /> : <span className="group-hover:hidden">{i + 1}</span>}
                {(!isCur || !isPlaying) && <Play size={16} fill="white" className="hidden group-hover:block" />}
              </div>
              <img src={getImage(s.image)} alt="" className="w-10 h-10 rounded shadow object-cover" />
              <div className="flex-1 min-w-0">
                <p className={`text-base truncate ${isCur ? 'text-brand' : 'text-white'}`}>{s.name || s.title}</p>
                <p className="text-sm text-text-secondary truncate">{s.subtitle}</p>
              </div>
              {!isAlbum && <p className="flex-1 hidden md:block text-sm text-text-secondary truncate">{s.album?.name || s.album}</p>}
              <span className="text-sm text-text-secondary w-12 text-right">{formatTime(s.duration)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const ArtistAlbumView = () => {
    if (pageLoading) return <div className="px-8 py-12"><div className="w-full h-[300px] skeleton-pulse bg-bg-card rounded-2xl" /></div>;
    const isArtist = currentView === 'artist';
    const data = isArtist ? artistData : albumData;
    if (!data) return null;

    return (
      <div className="relative fade-in">
        <div className={`h-[340px] px-8 flex items-end pb-6 ${isArtist ? '' : 'bg-gradient-to-b from-bg-card to-bg-primary'}`}>
          {isArtist ? (
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0" style={{ backgroundImage: `url(${getImage(data.image)})` }}>
              <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/50 to-transparent" />
            </div>
          ) : (
            <img src={getImage(data.image)} className="w-[232px] h-[232px] rounded shadow-2xl z-10 mr-6 object-cover" />
          )}
          <div className="z-10 w-full">
            <h2 className="text-sm font-bold uppercase tracking-widest mb-2 opacity-80">{isArtist ? 'Artist' : 'Album'}</h2>
            <h1 className="text-[4rem] font-bold text-white tracking-tighter leading-none mb-4 drop-shadow-lg">
              {data.name || data.title}
            </h1>
            <p className="text-sm font-medium opacity-80">{isArtist ? `${Number(data.fanCount || data.followerCount || 0).toLocaleString()} followers` : data.subtitle}</p>
          </div>
        </div>
        <TrackListView tracks={data.topSongs || data.songs || []} isAlbum={!isArtist} />
      </div>
    );
  };

  // ── Render Shell ──
  return (
    <div className="h-screen flex flex-col bg-bg-primary text-text-primary antialiased">
      <audio ref={audioRef} preload="auto" />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[260px] bg-bg-sidebar flex flex-col shrink-0">
          <div className="px-6 py-6 cursor-pointer flex gap-3 items-center group" onClick={() => navigate('home')}>
            <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center text-black shadow-[0_0_15px_rgba(29,185,84,0.4)] group-hover:scale-105 transition-transform">
              <Music2 size={16} />
            </div>
            <span className="text-[22px] font-bold tracking-tight text-white">SoulSync</span>
          </div>
          <nav className="px-3 flex flex-col gap-1">
            <button onClick={() => navigate('home')} className={`flex items-center gap-4 px-3 py-3 rounded-md font-bold transition-colors ${currentView === 'home' ? 'bg-bg-card text-white' : 'text-text-secondary hover:text-white'}`}>
              <Home size={24} className={currentView === 'home' ? 'text-white' : ''} /> Home
            </button>
            <button onClick={() => navigate('search')} className={`flex items-center gap-4 px-3 py-3 rounded-md font-bold transition-colors ${currentView === 'search' ? 'bg-bg-card text-white' : 'text-text-secondary hover:text-white'}`}>
              <Search size={24} className={currentView === 'search' ? 'text-white' : ''} /> Search
            </button>
          </nav>
        </aside>

        {/* content window */}
        <main className="flex-1 bg-bg-card overflow-y-auto hide-scrollbar rounded-lg mt-2 mr-2 mb-2 shadow-[0_0_40px_rgba(0,0,0,0.8)] relative border border-border-subtle">
          {/* Header */}
          <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-bg-card/90 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <button onClick={() => { if (hIndex > 0) { setHIndex(hIndex - 1); setCurrentView(viewHistory[hIndex - 1].view); setViewData(viewHistory[hIndex - 1].data); } }}
                className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:scale-105 disabled:opacity-30"><ChevronLeft size={20} /></button>
              <button onClick={() => { if (hIndex < viewHistory.length - 1) { setHIndex(hIndex + 1); setCurrentView(viewHistory[hIndex + 1].view); setViewData(viewHistory[hIndex + 1].data); } }}
                className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:scale-105 disabled:opacity-30"><ChevronRight size={20} /></button>
              {currentView === 'search' && (
                <div className="ml-4 relative w-[320px]">
                  <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input type="text" autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="What do you want to play?"
                    className="w-full bg-[#242424] text-white rounded-full py-2.5 pl-10 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/20 border border-transparent shadow-inner" />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white"><X size={18} /></button>}
                </div>
              )}
            </div>
          </header>
          {currentView === 'home' && <HomeView />}
          {currentView === 'search' && <SearchView />}
          {(currentView === 'artist' || currentView === 'album') && <ArtistAlbumView />}
        </main>
      </div>

      {/* Player Bar */}
      <footer className="h-[90px] bg-bg-primary shrink-0 flex items-center justify-between px-4 border-t border-border-subtle z-50">
        <div className="w-[30%] flex items-center gap-4 h-full pr-4 overflow-hidden">
          {currentSong ? (
            <>
              <img src={getImage(currentSong.image)} className="w-14 h-14 rounded object-cover shadow-lg" alt="" />
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate hover:underline cursor-pointer">{currentSong.name || currentSong.title}</p>
                <p className="text-xs text-text-secondary truncate hover:underline cursor-pointer hover:text-white mt-1">{currentSong.subtitle}</p>
              </div>
              <button onClick={() => setLiked(prev => { const n = new Set(prev); n.has(currentSong.id) ? n.delete(currentSong.id) : n.add(currentSong.id); return n; })}>
                <Heart size={16} className={liked.has(currentSong?.id) ? 'text-brand fill-brand' : 'text-text-secondary hover:text-white'} />
              </button>
            </>
          ) : <div className="text-text-secondary text-sm font-medium">No active track</div>}
        </div>

        <div className="w-[40%] flex flex-col items-center justify-center">
          <div className="flex items-center gap-6 mb-2">
            <button onClick={() => setSettings(prev => ({ ...prev, shuffle: !prev.shuffle }))} className={`${settings.shuffle ? 'text-brand' : 'text-text-secondary'} hover:text-white`}><Shuffle size={18} /></button>
            <button onClick={playPrev} className="text-text-secondary hover:text-white"><SkipBack size={20} fill="currentColor" /></button>
            <button onClick={togglePlay} className="w-8 h-8 bg-white rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-black shrink-0">
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
            </button>
            <button onClick={playNext} className="text-text-secondary hover:text-white"><SkipForward size={20} fill="currentColor" /></button>
            <button onClick={() => setSettings(prev => ({ ...prev, repeat: !prev.repeat }))} className={`${settings.repeat ? 'text-brand' : 'text-text-secondary'} hover:text-white`}><Repeat size={18} /></button>
          </div>
          <div className="flex items-center gap-2 w-full max-w-[600px]">
            <span className="text-xs text-text-secondary w-10 text-right">{formatTime(progress.current)}</span>
            <div className="flex-1 relative group flex items-center h-4">
              <input type="range" min={0} max={progress.duration || 0} value={progress.current}
                onChange={e => { const val = parseFloat(e.target.value); if (audioRef.current) audioRef.current.currentTime = val; setProgress(p => ({ ...p, current: val })) }}
                className="w-full absolute z-10 opacity-0 group-hover:opacity-100 cursor-pointer" />
              <div className="h-1 bg-[#4d4d4d] w-full rounded-full overflow-hidden absolute">
                <div className="h-full bg-white group-hover:bg-brand transition-colors" style={{ width: `${(progress.current / (progress.duration || 1)) * 100}%` }} />
              </div>
            </div>
            <span className="text-xs text-text-secondary w-10">{formatTime(progress.duration)}</span>
          </div>
        </div>

        <div className="w-[30%] flex justify-end items-center gap-4 pl-4">
          {volume === 0 ? <VolumeX size={18} className="text-text-secondary" /> : volume < 0.5 ? <Volume1 size={18} className="text-text-secondary" /> : <Volume2 size={18} className="text-text-secondary" />}
          <div className="w-[100px] relative group flex items-center h-4">
            <input type="range" min={0} max={1} step={0.01} value={volume} onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-full absolute z-10 opacity-0 group-hover:opacity-100 cursor-pointer" />
            <div className="h-1 bg-[#4d4d4d] w-full rounded-full overflow-hidden absolute">
              <div className="h-full bg-white group-hover:bg-brand transition-colors" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      </footer>

      {toast && <div className="fixed bottom-[110px] left-1/2 -translate-x-1/2 bg-[#2e77d0] text-white px-6 py-3 rounded-lg font-bold shadow-2xl z-50 fade-in">{toast}</div>}
    </div>
  );
}
