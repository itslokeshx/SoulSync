import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { Network } from '@capacitor/network'
import { Capacitor } from '@capacitor/core'
import { Wifi, WifiOff } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────
interface NetworkState {
    isOnline: boolean
    connectionType: 'wifi' | 'cellular' | 'none' | 'unknown'
    isChecking: boolean
}

interface NetworkContextValue extends NetworkState {
    checkNow: () => Promise<void>
}

// ── Context ────────────────────────────────────────────────────
export const NetworkContext = createContext<NetworkContextValue>({
    isOnline: true,
    connectionType: 'unknown',
    isChecking: false,
    checkNow: async () => { },
})

export const useNetwork = () => useContext(NetworkContext)

// ── Provider ───────────────────────────────────────────────────
export function NetworkProvider({ children }: { children: React.ReactNode }) {
    const [network, setNetwork] = useState<NetworkState>({
        isOnline: true,
        connectionType: 'unknown',
        isChecking: true,
    })
    const [showBackOnline, setShowBackOnline] = useState(false)
    const [showGoingOffline, setShowGoingOffline] = useState(false)
    const wasOnlineRef = useRef(true)
    const toastTimer = useRef<NodeJS.Timeout | number>()

    const checkNow = async () => {
        if (Capacitor.isNativePlatform()) {
            const status = await Network.getStatus()
            setNetwork({
                isOnline: status.connected,
                connectionType: status.connectionType as any,
                isChecking: false,
            })
        } else {
            // Web fallback
            setNetwork({
                isOnline: navigator.onLine,
                connectionType: 'unknown',
                isChecking: false,
            })
        }
    }

    useEffect(() => {
        // ── Initial check ──────────────────────────────────────────
        checkNow()

        if (Capacitor.isNativePlatform()) {
            // ── Native listener ────────────────────────────────────────
            const listener = Network.addListener('networkStatusChange', (status) => {
                const comingOnline = !wasOnlineRef.current && status.connected
                const goingOffline = wasOnlineRef.current && !status.connected

                wasOnlineRef.current = status.connected

                setNetwork({
                    isOnline: status.connected,
                    connectionType: status.connectionType as any,
                    isChecking: false,
                })

                // ── Back online toast ──────────────────────────────────
                if (comingOnline) {
                    if (toastTimer.current) clearTimeout(toastTimer.current as any)
                    setShowGoingOffline(false)
                    setShowBackOnline(true)
                    toastTimer.current = setTimeout(() => {
                        setShowBackOnline(false)
                    }, 3000)
                }

                // ── Going offline toast ────────────────────────────────
                if (goingOffline) {
                    if (toastTimer.current) clearTimeout(toastTimer.current as any)
                    setShowBackOnline(false)
                    setShowGoingOffline(true)
                    toastTimer.current = setTimeout(() => {
                        setShowGoingOffline(false)
                    }, 3000)
                }
            })

            return () => {
                listener.then(l => l.remove())
                if (toastTimer.current) clearTimeout(toastTimer.current as any)
            }
        } else {
            // ── Web fallback listeners ─────────────────────────────────
            const goOnline = () => {
                setNetwork(p => ({ ...p, isOnline: true }))
                setShowBackOnline(true)
                setTimeout(() => setShowBackOnline(false), 3000)
            }
            const goOffline = () => {
                setNetwork(p => ({ ...p, isOnline: false }))
            }
            window.addEventListener('online', goOnline)
            window.addEventListener('offline', goOffline)
            return () => {
                window.removeEventListener('online', goOnline)
                window.removeEventListener('offline', goOffline)
            }
        }
    }, [])

    return (
        <NetworkContext.Provider value={{ ...network, checkNow }}>

            {/* ── Offline bar — always visible when offline ──────────── */}
            <div className={`
        fixed top-0 left-0 right-0 z-[9999]
        flex items-center justify-center gap-2
        py-1.5 text-xs font-semibold
        transition-all duration-300 ease-in-out
        ${!network.isOnline
                    ? 'translate-y-0 opacity-100 bg-yellow-500 text-black'
                    : '-translate-y-full opacity-0'
                }
      `}
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <WifiOff className="w-3 h-3" />
                Offline — downloaded songs available
            </div>

            {/* ── Back online toast — YT Music style ────────────────── */}
            <div className={`
        fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999]
        flex items-center gap-2 px-5 py-2.5
        bg-[#1db954] text-black text-sm font-bold
        rounded-full shadow-2xl
        transition-all duration-500
        ${showBackOnline
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }
      `}>
                <Wifi className="w-4 h-4" />
                Back online
            </div>

            {/* ── Going offline toast ───────────────────────────────── */}
            <div className={`
        fixed bottom-28 left-1/2 -translate-x-1/2 z-[9999]
        flex items-center gap-2 px-5 py-2.5
        bg-[#333] text-white text-sm font-bold
        rounded-full shadow-2xl
        transition-all duration-500
        ${showGoingOffline
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }
      `}>
                <WifiOff className="w-4 h-4 text-yellow-400" />
                You're offline
            </div>

            {children}
        </NetworkContext.Provider>
    )
}
