import { useState, useMemo, useRef } from 'react'
import { motion, useMotionValue, useTransform, Reorder, useDragControls } from 'framer-motion'
import {
  Search, Shuffle, Play, Trash2, MoreHorizontal,
  Music, Download, ArrowDownAZ, Clock, User, HardDrive, ListMusic, GripVertical, Upload
} from 'lucide-react'
import { useOfflineStore, OfflineSongMeta } from '../store/offlineStore'
import { useApp } from '../context/AppContext'
import { useNetwork } from '../providers/NetworkProvider'
import { useUIStore } from '../store/uiStore'
import { FALLBACK_IMG } from '../lib/constants'
import { useDownloadStore } from '../store/downloadStore'
import { saveOfflineSong, removeOfflineSong } from '../utils/offlineDB'
import { deleteAudioFromDevice, saveAudioToDevice } from '../capacitor/filesystem'
import { readAudioMetadata } from '../utils/audioMetadata'

type FilterKey = 'playlists' | 'songs'

export default function DownloadsPage() {
  const { isOnline } = useNetwork()
  const { downloads, deleteDownload, updateDownloadsOrder } = useOfflineStore()
  const { active: activeDownloads } = useDownloadStore()
  const { playSong, currentSong, isPlaying } = useApp()
  const { showContextMenu } = useUIStore()
  const [filter, setFilter] = useState<FilterKey>('songs')
  const [search, setSearch] = useState('')
  const [reorderMode, setReorderMode] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  // Force clear search if reorder mode
  if (reorderMode && search !== '') {
    setSearch('')
  }

  const sorted = useMemo(() => {
    let list = [...downloads]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.artist.toLowerCase().includes(q)
      )
    }
    // Default to most recent
    return list.sort((a, b) => b.downloadedAt - a.downloadedAt)
  }, [downloads, search])

  const totalSize = useMemo(() => {
    const bytes = downloads.reduce((sum, d) => sum + (d.fileSize || 0), 0)
    if (!bytes) return '0 MB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }, [downloads])

  const formatSize = (bytes: number) => {
    if (!bytes) return ''
    const mb = bytes / (1024 * 1024)
    if (mb >= 1) return mb.toFixed(1) + ' MB'
    return (bytes / 1024).toFixed(0) + ' KB'
  }

  const makeSongs = (list: any[]) =>
    list.map(d => {
      const base = d.songData || {};
      return {
        id: d.songId || base.id,
        name: d.title || base.name || "Untitled",
        title: d.title || base.name || "Untitled",
        artist: d.artist || base.primaryArtists || "Unknown Artist",
        primaryArtists: d.artist || base.primaryArtists || "Unknown Artist",
        image: Array.isArray(base.image) && base.image.length > 0 ? base.image : [{ quality: "500x500", url: d.albumArt || FALLBACK_IMG }],
        duration: d.duration || base.duration || 0,
        ...base,
        _isOffline: true,
        downloadUrl: d.filePath ? [{ quality: "320kbps", url: d.filePath }] : base.downloadUrl || []
      };
    });

  const shuffleAndPlay = () => {
    if (!sorted.length) return
    const shuffled = [...sorted].sort(() => Math.random() - 0.5)
    const songs = makeSongs(shuffled)
    playSong(songs[0], songs)
  }

  const playAll = () => {
    if (!sorted.length) return
    const songs = makeSongs(sorted)
    playSong(songs[0], songs)
  }

  const playOfflineSong = (dl: any) => {
    const songs = makeSongs(sorted)
    const target = songs.find(s => s.id === dl.songId) || makeSongs([dl])[0]
    playSong(target, songs)
  }

  const handleMenu = (e: React.MouseEvent, dl: any) => {
    e.stopPropagation()
    // Build a song-like object so ContextMenu can work with it
    const song = dl.songData || { id: dl.songId, name: dl.title, image: dl.albumArt }
    showContextMenu(e.clientX, e.clientY, song)
  }

  const handleDelete = async (songId: string) => {
    // Attempt to delete physical file on device if path is present
    const songMeta = downloads.find(d => d.songId === songId);
    if (songMeta?.filePath) {
      await deleteAudioFromDevice(songMeta.filePath);
    }

    try {
      await removeOfflineSong(songId)
    } catch (err) {
      console.warn('Failed to prune blob from IDB:', err)
    }
    deleteDownload(songId)
  }

  const handleImportLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fullName = file.name.replace(/\.[^/.]+$/, "")
      let title = fullName
      let artist = "Unknown Artist"
      let albumArt = FALLBACK_IMG

      try {
        const fileBuffer = new Uint8Array(await file.arrayBuffer())
        const parsed = readAudioMetadata(fileBuffer)
        if (parsed.title && parsed.title.trim()) title = parsed.title.trim()
        if (parsed.artist && parsed.artist.trim()) artist = parsed.artist.trim()
        if (parsed.albumArtUrl) albumArt = parsed.albumArtUrl
      } catch {}

      if (title === fullName && fullName.includes("-")) {
        const parts = fullName.split("-").map(p => p.trim())
        if (!artist || artist === "Unknown Artist") artist = parts[0]
        title = parts.slice(1).join(" - ")
      }

      const songId = `local_${Date.now()}_${i}`

      let finalFilePath = ""
      try {
        finalFilePath = await saveAudioToDevice(songId, file, file.name)
      } catch (err) {
        console.warn("Failed to write imported audio to device:", err)
      }

      await saveOfflineSong({
        id: songId,
        name: title,
        artist: artist,
        albumArt: albumArt,
        duration: 0,
        downloadUrl: finalFilePath ? [{ quality: "320kbps", url: finalFilePath }] : [],
        image: [{ quality: "500x500", url: albumArt }],
        savedAt: Date.now()
      }, file).catch(console.error)

      const meta: OfflineSongMeta = {
        songId,
        title,
        artist,
        albumArt: albumArt,
        duration: 0,
        filePath: finalFilePath,
        downloadedAt: Date.now(),
        fileSize: file.size,
        songData: {
          id: songId,
          name: title,
          targetCount: 1,
          isAIGenerated: false,
          primaryArtists: artist,
          image: [{ quality: "500x500", url: albumArt }],
          downloadUrl: finalFilePath ? [{ quality: "320kbps", url: finalFilePath }] : []
        }
      }
      useOfflineStore.getState().addDownloadedSong(meta)
    }

    if (fileRef.current) fileRef.current.value = ''
  }



  const { sortedPlaylists, standalone } = useMemo(() => {
    const pMap = new Map<string, typeof sorted>();
    const std: typeof sorted = [];

    sorted.forEach(dl => {
      // Local imports or singles without a playlistName go to standalone
      if (!dl.playlistName || dl.songId?.startsWith('local_')) {
        std.push(dl);
      } else {
        const list = pMap.get(dl.playlistName) || [];
        list.push(dl);
        pMap.set(dl.playlistName, list);
      }
    });

    const pArray = Array.from(pMap.entries()).map(([name, songs]) => ({
      name,
      songs,
      albumArt: songs[0]?.albumArt || FALLBACK_IMG
    }));

    return { sortedPlaylists: pArray, standalone: std };
  }, [sorted]);

  return (
    <div className="pb-32 overflow-x-hidden">

      {/* ─── HEADER ─── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sp-green/80 to-sp-green flex items-center justify-center shadow-lg shadow-sp-green/20">
              <Download size={18} className="text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Downloads</h1>
              <p className="text-white/40 text-[12px] font-medium">
                {downloads.length} songs · {totalSize}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-400/10 border border-yellow-400/20">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-yellow-400 text-[10px] font-bold uppercase tracking-wider">Offline</span>
              </div>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-white transition-all"
              title="Import Local Audio"
            >
              <Upload size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── ACTION BUTTONS ─── */}
      <input
        type="file"
        multiple
        accept="audio/*,.m4a,.mp3,.aac,.flac,.wav,.mp4"
        ref={fileRef}
        className="hidden"
        onChange={handleImportLocal}
      />

      {downloads.length > 0 && (
        <div className="flex items-center gap-4 px-5 mb-4">
          <button onClick={shuffleAndPlay}
            className="w-12 h-12 rounded-full bg-white/[0.07] flex items-center justify-center hover:bg-white/[0.12] active:scale-90 transition-all">
            <Shuffle size={20} className="text-white" />
          </button>

          <button onClick={playAll}
            className="w-14 h-14 rounded-full bg-sp-green flex items-center justify-center shadow-lg shadow-sp-green/30 hover:scale-105 active:scale-95 transition-all">
            <Play size={24} className="fill-black text-black ml-0.5" />
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="hidden sm:flex items-center gap-2 px-4 h-10 rounded-full bg-white/[0.08] hover:bg-white/[0.12] text-[13px] font-bold text-white transition-all ml-1"
          >
            <Upload size={16} />
            Import Local
          </button>

          <div className="flex-1" />

          <button
            onClick={() => setReorderMode(!reorderMode)}
            className={`flex items-center gap-1.5 px-4 h-10 rounded-full text-[13px] font-semibold transition-all ${reorderMode
              ? "bg-sp-green/20 text-sp-green border border-sp-green/30"
              : "border border-white/10 text-white/50 hover:bg-white/[0.06]"
              }`}
          >
            <ListMusic size={15} />
            {reorderMode ? "Done" : "Reorder"}
          </button>


        </div>
      )}



      {/* ─── SEARCH ─── */}
      {!reorderMode && (
        <div className="px-5 mb-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Find in downloads"
              className="w-full bg-white/[0.07] rounded-md py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:bg-white/[0.12] transition-colors"
            />
          </div>
        </div>
      )}

      {/* ─── FILTER TABS ─── */}
      {!reorderMode && (
        <div className="px-5 mb-4 flex gap-2">
          {(['songs', 'playlists'] as FilterKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-5 py-2 rounded-full text-[13px] font-bold capitalize transition-all ${filter === key
                ? 'bg-sp-green text-black shadow-md shadow-sp-green/20'
                : 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] border border-white/[0.05]'
                }`}
            >
              {key}
            </button>
          ))}
        </div>
      )}



      {/* ─── ACTIVE DOWNLOADS ─── */}
      {activeDownloads.length > 0 && !reorderMode && (
        <div className="px-5 mb-6 space-y-2.5">
          <h3 className="text-[12px] font-bold text-white/40 uppercase tracking-wider mb-3">
            Downloading ({activeDownloads.length})
          </h3>
          {activeDownloads.map((dl) => (
            <div key={dl.id} className="relative bg-white/[0.04] rounded-xl p-2.5 flex items-center gap-3 overflow-hidden border border-white/[0.02]">
              <div
                className="absolute bottom-0 left-0 h-[3px] bg-sp-green/80"
                style={{ width: `${dl.progress}%`, transition: 'width 0.3s ease-out' }}
              />
              <img src={dl.albumArt || FALLBACK_IMG} className="w-11 h-11 rounded-md object-cover flex-shrink-0" alt="" />
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-[14px] font-semibold text-white truncate leading-tight mb-0.5">{dl.name}</p>
                <p className="text-[12px] font-medium text-white/40 truncate">{dl.artist}</p>
              </div>
              <div className="text-[11px] font-bold text-sp-green bg-sp-green/10 px-2 py-1 rounded-full tabular-nums">
                {dl.progress}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── SONG LIST ─── */}
      {sorted.length > 0 ? (
        <div className="px-2">
          {reorderMode ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={sorted}
              onReorder={updateDownloadsOrder}
              className="px-2"
            >
              {sorted.map((dl) => (
                <DownloadReorderItem
                  key={dl.songId}
                  dl={dl}
                  onDelete={() => handleDelete(dl.songId)}
                />
              ))}
            </Reorder.Group>
          ) : (
            <div className="space-y-4">
              {/* Playlists View */}
              {filter === 'playlists' && (
                <div className="px-1 space-y-2">
                  <h3 className="text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2 mt-2 px-2">
                    {sortedPlaylists.length > 0 ? "Downloaded Playlists" : "Playlists"}
                  </h3>
                  {sortedPlaylists.map(playlist => (
                    <div
                      key={playlist.name}
                      onClick={() => {
                        const songs = makeSongs(playlist.songs);
                        playSong(songs[0], songs);
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] cursor-pointer transition-colors border border-white/[0.02]"
                    >
                      <div className="w-14 h-14 rounded-md bg-white/[0.06] overflow-hidden flex-shrink-0 shadow-md">
                        <img src={playlist.albumArt} className="w-full h-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG }} />
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-[15px] font-bold text-white truncate leading-tight mb-1">{playlist.name}</p>
                        <p className="text-[12px] font-medium text-white/50">{playlist.songs.length} tracks</p>
                      </div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-sp-green/10 text-sp-green absolute right-6 shadow-xl opacity-0 hover:scale-105 transition-all group-hover:opacity-100 hidden md:flex">
                        <Play size={20} className="fill-current ml-1" />
                      </div>
                    </div>
                  ))}

                  {/* Standalone songs grouped as "Other Songs" playlist */}
                  {standalone.length > 0 && (
                    <div
                      onClick={() => {
                        const songs = makeSongs(standalone);
                        playSong(songs[0], songs);
                      }}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] cursor-pointer transition-colors border border-white/[0.02]"
                    >
                      <div className="w-14 h-14 rounded-md bg-white/[0.06] overflow-hidden flex-shrink-0 shadow-md flex items-center justify-center">
                        <Music size={24} className="text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-[15px] font-bold text-white truncate leading-tight mb-1">Other Songs</p>
                        <p className="text-[12px] font-medium text-white/50">{standalone.length} tracks</p>
                      </div>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-sp-green/10 text-sp-green absolute right-6 shadow-xl opacity-0 hover:scale-105 transition-all group-hover:opacity-100 hidden md:flex">
                        <Play size={20} className="fill-current ml-1" />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Songs View */}
              {filter === 'songs' && (
                <div className="space-y-0.5">
                  <h3 className="text-[12px] font-bold text-white/40 uppercase tracking-wider mb-2 mt-4 px-3">
                    All Songs
                  </h3>
                  {sorted.map((dl, i) => (
                    <SwipeRow
                      key={dl.songId}
                      dl={dl}
                      isLocal={dl.songId?.startsWith('local_')}
                      index={i}
                      isCurrent={currentSong?.id === dl.songId || currentSong?.id === dl.songData?.id}
                      isPlaying={isPlaying}
                      formatSize={formatSize}
                      onPlay={() => playOfflineSong(dl)}
                      onDelete={() => handleDelete(dl.songId)}
                      onMenu={(e: React.MouseEvent) => handleMenu(e, dl)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="py-24 flex flex-col items-center text-center px-10">
          <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center mb-6">
            <Music size={32} className="text-white/10" />
          </div>
          <h2 className="text-white font-bold mb-2">
            {search ? 'No results' : 'No downloads yet'}
          </h2>
          <p className="text-white/30 text-sm leading-relaxed max-w-xs mb-6">
            {search
              ? `No songs match "${search}"`
              : 'Songs you download will appear here for offline listening.'
            }
          </p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════
 *  SwipeRow — Swipeable song row with delete reveal
 * ═══════════════════════════════════════════════════════ */
function SwipeRow({ dl, isLocal, isCurrent, isPlaying, formatSize, onPlay, onDelete, onMenu }: {
  dl: any; isLocal: boolean; index: number; isCurrent: boolean; isPlaying: boolean
  formatSize: (b: number) => string; onPlay: () => void; onDelete: () => void
  onMenu: (e: React.MouseEvent) => void
}) {
  const x = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-80, -20], [1, 0])
  const bgOpacity = useTransform(x, [-10, 0], [1, 0])
  const rowX = useTransform(x, v => Math.min(0, v))

  return (
    <div className="relative overflow-hidden rounded-lg mx-1 mb-[2px]">
      {/* Delete bg */}
      <motion.div
        style={{ opacity: bgOpacity }}
        className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 flex items-center justify-center rounded-r-lg"
      >
        <motion.div style={{ opacity: deleteOpacity }}>
          <Trash2 className="w-5 h-5 text-white" />
        </motion.div>
      </motion.div>

      <motion.div
        style={{ x: rowX }}
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => { if (info.offset.x < -60) onDelete() }}
        className={`relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors rounded-lg ${isCurrent ? 'bg-white/[0.08]' : 'hover:bg-white/[0.05] active:bg-white/[0.08]'
          }`}
        onClick={onPlay}
      >
        {/* Album art */}
        <div className="w-11 h-11 rounded-md bg-white/[0.06] overflow-hidden flex-shrink-0 shadow-md">
          <img src={dl.albumArt || FALLBACK_IMG} className="w-full h-full object-cover" alt="" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-semibold truncate ${isCurrent ? 'text-sp-green' : 'text-white'}`}>
            {dl.title}
          </p>
          <p className="text-white/40 text-[12px] truncate">{dl.artist}</p>
        </div>

        {/* Now playing bars */}
        {isCurrent && isPlaying && (
          <div className="flex items-end gap-[2px] h-3 mr-1 flex-shrink-0">
            {[1, 2, 3].map(j => (
              <div key={j} className="w-[3px] bg-sp-green rounded-full animate-music-bar"
                style={{ animationDelay: `${j * 0.15}s` }} />
            ))}
          </div>
        )}

        {/* Size + 3-dot or Trash */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-white/20 text-[11px] font-medium tabular-nums">
            {formatSize(dl.fileSize)}
          </span>
          {/* Always show delete and menu buttons */}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/10 transition-colors group"
          >
            <Trash2 size={16} className="text-white/40 group-hover:text-red-400" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMenu(e); }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/[0.1] transition-colors"
          >
            <MoreHorizontal size={16} className="text-white/40" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function DownloadReorderItem({ dl, onDelete }: { dl: any; onDelete: () => void }) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={dl}
      dragListener={false}
      dragControls={controls}
      className="relative flex items-center gap-3 px-2 py-2 mb-1 bg-white/[0.03] rounded-xl border border-white/[0.04]"
    >
      <div
        className="p-3 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 touch-none flex-shrink-0"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical size={20} />
      </div>

      <div className="w-12 h-12 rounded-lg bg-white/[0.06] overflow-hidden flex-shrink-0">
        <img src={dl.albumArt} className="w-full h-full object-cover" alt="" />
      </div>

      <div className="flex-1 min-w-0 pr-2">
        <p className="text-[14px] font-bold text-white truncate leading-tight mb-0.5">
          {dl.title}
        </p>
        <p className="text-[13px] font-medium text-white/50 truncate">
          {dl.artist}
        </p>
      </div>

      <button
        onClick={onDelete}
        title="Delete Download"
        className="p-3 mr-1 rounded-full text-red-500/50 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0"
      >
        <Trash2 size={18} />
      </button>
    </Reorder.Item>
  );
}
