import { useCallback, useRef, useState } from 'react'
import { CartoonBackground } from './components/CartoonBackground'
import { MenuScreen } from './screens/MenuScreen'
import { MultiplayerMenuScreen } from './screens/MultiplayerMenuScreen'
import { PlayScreen } from './screens/PlayScreen'
import type { ClientAction } from './game/applyGameAction'
import type { GameState } from './game/types'
import { MultiplayerClient } from './net/multiplayerClient'
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

  const resetMultiplayer = useCallback(() => {
    mpClientRef.current?.disconnect()
    mpClientRef.current = null
    setMpStatus('')
    setMpCode(null)
    setMpError(null)
    setMpConnecting(false)
    setOnlineGame(null)
  }, [])

  const handlePlay = () => {
    setPlayTheme(generatePlayTheme())
    setScreen('play')
  }

  const handleBack = () => {
    resetMultiplayer()
    setScreen('menu')
    setPlayTheme(null)
  }

  const enterOnlinePlay = useCallback(() => {
    setPlayTheme(generatePlayTheme())
    setScreen('online-play')
  }, [])

  const connectClient = useCallback(
    async (playerId: 1 | 2, afterConnect: (client: MultiplayerClient) => void) => {
      setMpConnecting(true)
      setMpError(null)
      resetMultiplayer()
      setMyPlayerId(playerId)

      const client = new MultiplayerClient(playerId, {
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
          setMpError('Disconnected from server.')
          setMpConnecting(false)
        },
      })

      mpClientRef.current = client
      try {
        await client.connect()
        afterConnect(client)
      } catch {
        setMpError('Could not connect. Run the multiplayer server (npm run server).')
        setMpConnecting(false)
      } finally {
        setMpConnecting(false)
      }
    },
    [enterOnlinePlay, resetMultiplayer],
  )

  const handleMultiplayerMenu = () => {
    resetMultiplayer()
    setScreen('multiplayer')
  }

  const handleHost = () => {
    void connectClient(1, (client) => client.host())
  }

  const handleJoin = (code: string) => {
    void connectClient(2, (client) => client.join(code))
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
            onHost={handleHost}
            onJoin={handleJoin}
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
