import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Download, Loader2, Sparkles, Check, AlertCircle, ExternalLink } from 'lucide-react'
import * as api from '../api/backend'

const PLATFORMS = [
    {
        id: 'spotify',
        name: 'Spotify',
        color: '#1DB954',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
        ),
        placeholder: 'https://open.spotify.com/playlist/...',
        hint: 'Open playlist → ••• → Share → Copy link',
    },
    {
        id: 'youtube_music',
        name: 'YT Music',
        color: '#FF0000',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm4.872 16.176l-1.968-.168-.48-2.832-1.848 2.616-1.968-.168 2.856-3.672-2.712-3.768 1.968.168.336 2.928 1.944-2.712 1.968.168-2.952 3.576 2.856 3.864zm-9.648-2.4L4.128 12.48 7.224 8.4h2.304l-3.096 4.08 3.24 4.176H7.224v-.88z" />
            </svg>
        ),
        placeholder: 'https://music.youtube.com/playlist?list=...',
        hint: 'Open playlist → Share → Copy link',
    },
    {
        id: 'text',
        name: 'Paste Names',
        color: '#1db954',
        icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="8" height="4" x="8" y="2" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
        ),
        placeholder: 'Paste song names here\nOne per line\nor comma-separated',
        hint: 'Works with any platform — just paste song names',
    },
]

interface PreviewData {
    name: string
    image: string | null
    songNames: string[]
    count: number
    detectedPlatform: string
}

export default function ImportPage() {
    const navigate = useNavigate()
    const [selected, setSelected] = useState('spotify')
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [suggestion, setSuggestion] = useState('')
    const [preview, setPreview] = useState<PreviewData | null>(null)
    const [matching, setMatching] = useState(false)
    const [matchResult, setMatchResult] = useState<any>(null)

    const platform = useMemo(() => PLATFORMS.find(p => p.id === selected)!, [selected])
    const isTextMode = selected === 'text'

    const handleImport = async () => {
        if (!input.trim()) return
        setLoading(true)
        setError('')
        setSuggestion('')
        setPreview(null)

        try {
            const res = await api.importPlaylist(input.trim())
            if (res.count === 0) {
                setError('No songs found. Try pasting song names directly.')
                return
            }
            setPreview(res)
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Import failed')
            setSuggestion(err.response?.data?.suggestion || '')
        } finally {
            setLoading(false)
        }
    }

    // Convert JioSaavn song object to playlist song format
    const toSongEmbed = (song: any) => {
        if (!song) return null
        const artists = song.artists?.primary || song.artists?.all || []
        const artistName = artists.map((a: any) => a.name).join(', ') || song.subtitle || ''
        const images = Array.isArray(song.image) ? song.image : []
        const albumArt = images.find((i: any) => i.quality === '500x500')?.url ||
            images.find((i: any) => i.quality === '150x150')?.url ||
            images[images.length - 1]?.url || ''
        const dlUrls = Array.isArray(song.downloadUrl) ? song.downloadUrl : []
        return {
            songId: song.id,
            title: song.name || '',
            artist: artistName,
            albumArt,
            duration: Number(song.duration) || 0,
            downloadUrl: dlUrls.map((d: any) => ({ quality: d.quality, url: d.url })),
        }
    }

    const handleAIMatch = async () => {
        if (!preview) return
        setMatching(true)
        setError('')
        try {
            const res = await api.buildPlaylistFromImport(preview.songNames, preview.name)

            // Extract matched songs into playlist format
            const allMatched = [...(res.matched || []), ...(res.partial || [])]
            const songs = allMatched
                .map((m: any) => toSongEmbed(m.song))
                .filter(Boolean)

            if (songs.length > 0) {
                // Save as a real playlist in the user's library
                const playlist = await api.createPlaylist({
                    name: res.playlistName || preview.name || 'Imported Playlist',
                    description: `Imported from ${preview.detectedPlatform.replace('_', ' ')} • ${songs.length} songs`,
                    isPublic: false,
                    isAIGenerated: true,
                    songs,
                    tags: ['imported', preview.detectedPlatform],
                })
                setMatchResult({ ...res, savedPlaylistId: playlist._id })
            } else {
                setMatchResult(res)
                setError('No songs could be matched on JioSaavn. Try pasting names manually.')
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'AI matching failed')
        } finally {
            setMatching(false)
        }
    }

    return (
        <div className="pb-32 overflow-x-hidden min-h-screen">

            {/* ─── HEADER ─── */}
            <div className="flex items-center gap-3 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4">
                <button onClick={() => navigate(-1)}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/[0.07] flex items-center justify-center hover:bg-white/[0.12] transition-colors flex-shrink-0">
                    <ArrowLeft size={16} className="text-white" />
                </button>
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold text-white">Import Playlist</h1>
                    <p className="text-white/30 text-[11px] sm:text-[12px] truncate">From any platform — free, no account needed</p>
                </div>
            </div>

            {/* ─── PLATFORM CHIPS ─── */}
            <div className="flex gap-2 px-4 sm:px-5 mb-4 sm:mb-6 overflow-x-auto no-scrollbar">
                {PLATFORMS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => { setSelected(p.id); setInput(''); setError(''); setPreview(null); setMatchResult(null) }}
                        className={`flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl border transition-all duration-200 active:scale-95 ${selected === p.id
                            ? 'border-current shadow-lg'
                            : 'border-transparent bg-white/[0.05] hover:bg-white/[0.08]'
                            }`}
                        style={selected === p.id ? {
                            borderColor: p.color,
                            backgroundColor: `${p.color}15`,
                            color: p.color,
                        } : { color: '#9b9b9b' }}
                    >
                        <span className="[&_svg]:w-4 [&_svg]:h-4 sm:[&_svg]:w-5 sm:[&_svg]:h-5">{p.icon}</span>
                        <span className="text-[12px] sm:text-[13px] font-bold whitespace-nowrap">{p.name}</span>
                    </button>
                ))}
            </div>

            {/* ─── MATCH RESULT ─── */}
            {matchResult && (
                <div className="mx-5 mb-6">
                    <div className="bg-sp-green/[0.08] border border-sp-green/20 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-sp-green/20 flex items-center justify-center">
                                <Check size={24} className="text-sp-green" />
                            </div>
                            <div>
                                <p className="text-white font-bold text-lg">{matchResult.playlistName}</p>
                                <p className="text-sp-green text-sm font-medium">
                                    {matchResult.stats?.found || 0} of {matchResult.stats?.total || 0} songs found
                                </p>
                            </div>
                        </div>

                        {matchResult.stats?.notFound > 0 && (
                            <p className="text-white/30 text-xs mb-4">
                                {matchResult.stats.notFound} songs couldn't be found on JioSaavn
                            </p>
                        )}

                        <div className="flex gap-3">
                            <button onClick={() => navigate(matchResult.savedPlaylistId ? `/playlist/${matchResult.savedPlaylistId}` : '/library')}
                                className="flex-1 py-3 rounded-full bg-sp-green text-black font-bold text-sm active:scale-95 transition-transform">
                                View Playlist
                            </button>
                            <button onClick={() => { setPreview(null); setMatchResult(null); setInput('') }}
                                className="flex-1 py-3 rounded-full bg-white/[0.07] text-white font-bold text-sm active:scale-95 transition-transform">
                                Import Another
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── PREVIEW ─── */}
            {preview && !matchResult && (
                <div className="mx-5 mb-6">
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                            {preview.image && (
                                <img src={preview.image} className="w-14 h-14 rounded-xl object-cover" alt="" />
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-white font-bold truncate">{preview.name}</p>
                                <p className="text-white/40 text-sm">{preview.count} songs found</p>
                                <p className="text-sp-green text-[11px] font-medium mt-0.5 flex items-center gap-1">
                                    <Check size={12} /> Imported from {preview.detectedPlatform.replace('_', ' ')}
                                </p>
                            </div>
                        </div>

                        {/* Song preview */}
                        <div className="space-y-1.5 max-h-[200px] overflow-y-auto mb-5 pr-1">
                            {preview.songNames.slice(0, 15).map((name, i) => (
                                <div key={i} className="flex items-center gap-2.5 text-sm">
                                    <span className="text-white/20 text-xs w-5 text-right font-mono">{i + 1}</span>
                                    <span className="text-white/70 truncate">{name}</span>
                                </div>
                            ))}
                            {preview.count > 15 && (
                                <p className="text-white/25 text-xs pl-8">+{preview.count - 15} more songs</p>
                            )}
                        </div>

                        <button onClick={handleAIMatch} disabled={matching}
                            className="w-full py-3.5 rounded-full bg-sp-green text-black font-bold text-sm flex items-center justify-center gap-2 
                               active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-sp-green/20">
                            {matching ? (
                                <><Loader2 size={16} className="animate-spin" /> Matching songs...</>
                            ) : (
                                <><Sparkles size={16} /> Match {preview.count} songs with AI →</>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* ─── INPUT AREA ─── */}
            {!preview && !matchResult && (
                <>
                    <div className="mx-4 sm:mx-5 mb-3 sm:mb-4">
                        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl sm:rounded-2xl p-3 sm:p-4">
                            <p className="text-white/30 text-xs mb-3 flex items-center gap-1.5">
                                <ExternalLink size={12} /> {platform.hint}
                            </p>
                            <textarea
                                value={input}
                                onChange={e => { setInput(e.target.value); setError('') }}
                                placeholder={platform.placeholder}
                                rows={isTextMode ? 8 : 3}
                                className="w-full bg-white/[0.06] rounded-xl px-4 py-3 text-sm text-white outline-none placeholder-white/15 
                           resize-none font-mono border border-white/[0.06] focus:border-sp-green/30 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mx-5 mb-4 bg-red-500/[0.08] border border-red-500/20 rounded-xl px-4 py-3">
                            <div className="flex items-start gap-2">
                                <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-red-400 text-sm font-medium">{error}</p>
                                    {suggestion && <p className="text-white/30 text-xs mt-1">{suggestion}</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Import button */}
                    <div className="px-4 sm:px-5 mb-6 sm:mb-8">
                        <button onClick={handleImport} disabled={!input.trim() || loading}
                            className="w-full py-3 sm:py-4 rounded-full bg-sp-green text-black font-bold text-[13px] sm:text-[14px] flex items-center justify-center gap-2
                               active:scale-95 transition-transform disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-sp-green/20">
                            {loading ? (
                                <><Loader2 size={18} className="animate-spin" /> Reading playlist...</>
                            ) : (
                                <><Download size={18} /> Import Playlist</>
                            )}
                        </button>
                    </div>

                    {/* How it works */}
                    <div className="mx-4 sm:mx-5 bg-white/[0.02] border border-white/[0.04] rounded-xl sm:rounded-2xl p-4 sm:p-5">
                        <p className="text-white/30 text-[11px] font-bold uppercase tracking-widest mb-4">How it works</p>
                        <div className="space-y-3">
                            {[
                                'Paste any public playlist URL or song names',
                                'We extract all song names (no login needed)',
                                'AI finds each song on JioSaavn',
                                'Playlist saved to your SoulSync library',
                            ].map((step, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-sp-green/10 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sp-green text-xs font-bold">{i + 1}</span>
                                    </div>
                                    <p className="text-white/35 text-[13px] leading-relaxed">{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
