import { useCallback, useRef, useState } from 'react'
import { CartoonBackground } from './components/CartoonBackground'
import { MenuScreen } from './screens/MenuScreen'
import { MultiplayerMenuScreen } from './screens/MultiplayerMenuScreen'
import { PlayScreen } from './screens/PlayScreen'
import type { ClientAction } from './game/applyGameAction'
import type { GameState } from './game/types'
import { MultiplayerClient, type MultiplayerCallbacks } from './net/multiplayerClient'
import { generatePlayTheme, MENU_THEME, type PlayTheme } from './theme/playTheme'
import './App.css'

type Screen = 'menu' | 'multiplayer' | 'play' | 'online-play'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [playTheme, setPlayTheme] = useState<PlayTheme | null>(null)
  const [mpStatus, setMpStatus] = useState('')
  const [mpCode, setMpCode] = useState<string | null>(null)
  const [mpError, setMpError] = useState<string | null>(null)
  const [mpConnecting, setMpConnecting] = useState(false)
  const [onlineGame, setOnlineGame] = useState<GameState | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<1 | 2>(1)
  const mpClientRef = useRef<MultiplayerClient | null>(null)

  const enterOnlinePlay = useCallback(() => {
    setPlayTheme(generatePlayTheme())
    setScreen('online-play')
  }, [])

  const resetMultiplayer = useCallback(() => {
    mpClientRef.current?.disconnect()
    mpClientRef.current = null
    setMpStatus('')
    setMpCode(null)
    setMpError(null)
    setMpConnecting(false)
    setOnlineGame(null)
  }, [])

  const makeCallbacks = useCallback(
    (): MultiplayerCallbacks => ({
      onHosted: (code) => {
        setMpCode(code)
        setMpStatus('Waiting for guest to join…')
      },
      onJoined: (code) => {
        setMpCode(code)
        setMpStatus('Connected!')
        enterOnlinePlay()
      },
      onGuestJoined: () => {
        setMpStatus('Guest connected — starting match!')
        enterOnlinePlay()
      },
      onState: (state) => {
        setOnlineGame(state)
      },
      onWaiting: (message) => setMpStatus(message),
      onError: (message) => {
        setMpError(message)
        setMpConnecting(false)
      },
      onDisconnect: () => {
        setMpError('Opponent disconnected.')
        setMpConnecting(false)
      },
    }),
    [enterOnlinePlay],
  )

  const handlePlay = () => {
    setPlayTheme(generatePlayTheme())
    setScreen('play')
  }

  const handleBack = () => {
    resetMultiplayer()
    setScreen('menu')
    setPlayTheme(null)
  }

  const handleMultiplayerMenu = () => {
    resetMultiplayer()
    setScreen('multiplayer')
  }

  const handleHost = async () => {
    setMpConnecting(true)
    setMpError(null)
    mpClientRef.current?.disconnect()
    mpClientRef.current = null
    setMyPlayerId(1)

    const client = new MultiplayerClient(1, makeCallbacks())
    mpClientRef.current = client

    try {
      await client.host()
    } catch {
      /* onError callback handles messaging */
    } finally {
      setMpConnecting(false)
    }
  }

  const handleJoin = async (code: string) => {
    setMpConnecting(true)
    setMpError(null)
    mpClientRef.current?.disconnect()
    mpClientRef.current = null
    setMyPlayerId(2)

    const client = new MultiplayerClient(2, makeCallbacks())
    mpClientRef.current = client

    try {
      await client.join(code)
    } catch {
      /* onError callback handles messaging */
    } finally {
      setMpConnecting(false)
    }
  }

  const handleOnlineAction = (action: ClientAction) => {
    mpClientRef.current?.sendAction(action)
  }

  const activeTheme = (screen === 'play' || screen === 'online-play') && playTheme ? playTheme : MENU_THEME

  return (
    <div className="app">
      <CartoonBackground key={activeTheme.id} theme={activeTheme} />
      <div className="app__content">
        {screen === 'menu' && (
          <MenuScreen onPlay={handlePlay} onMultiplayer={handleMultiplayerMenu} />
        )}
        {screen === 'multiplayer' && (
          <MultiplayerMenuScreen
            onBack={handleBack}
            onHost={() => void handleHost()}
            onJoin={(code) => void handleJoin(code)}
            status={mpStatus}
            roomCode={mpCode}
            isConnecting={mpConnecting}
            error={mpError}
          />
        )}
        {screen === 'play' && playTheme && (
          <PlayScreen key={playTheme.id} theme={playTheme} onBack={handleBack} mode="local" />
        )}
        {screen === 'online-play' && playTheme && (
          onlineGame ? (
            <PlayScreen
              key={`${playTheme.id}-online`}
              theme={playTheme}
              onBack={handleBack}
              mode="online"
              myPlayerId={myPlayerId}
              onlineGame={onlineGame}
              onOnlineAction={handleOnlineAction}
            />
          ) : (
            <div className="app__loading">Connecting to game…</div>
          )
        )}
      </div>
    </div>
  )
}

export default App
