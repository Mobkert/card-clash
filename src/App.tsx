import { useCallback, useRef, useState } from 'react'
import { CartoonBackground } from './components/CartoonBackground'
import { MenuScreen } from './screens/MenuScreen'
import { MultiplayerMenuScreen } from './screens/MultiplayerMenuScreen'
import { PlayerCountSelect } from './screens/PlayerCountSelect'
import { PlayScreen } from './screens/PlayScreen'
import type { ClientAction } from './game/applyGameAction'
import type { GameState, PlayerCount, PlayerId } from './game/types'
import {
  MultiplayerClient,
  setActiveMultiplayerClient,
  type MultiplayerCallbacks,
} from './net/multiplayerClient'
import { generatePlayTheme, MENU_THEME, type PlayTheme } from './theme/playTheme'
import './App.css'

type Screen = 'menu' | 'local-count' | 'multiplayer-count' | 'multiplayer' | 'play' | 'online-play'

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [playerCount, setPlayerCount] = useState<PlayerCount>(2)
  const [playTheme, setPlayTheme] = useState<PlayTheme | null>(null)
  const [mpStatus, setMpStatus] = useState('')
  const [mpCode, setMpCode] = useState<string | null>(null)
  const [mpError, setMpError] = useState<string | null>(null)
  const [mpConnecting, setMpConnecting] = useState(false)
  const [onlineGame, setOnlineGame] = useState<GameState | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<PlayerId>(1)
  const mpClientRef = useRef<MultiplayerClient | null>(null)
  const mpBusyRef = useRef(false)

  const enterOnlinePlay = useCallback(() => {
    setPlayTheme(generatePlayTheme())
    setScreen('online-play')
  }, [])

  const resetMultiplayer = useCallback(() => {
    setActiveMultiplayerClient(null)
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
        setMpStatus(
          playerCount === 3
            ? 'Waiting for guests to join (2 needed)…'
            : 'Waiting for guest to join…',
        )
      },
      onJoined: (code, assignedId) => {
        setMpCode(code)
        setMyPlayerId(assignedId)
        setMpStatus('Connected!')
        enterOnlinePlay()
      },
      onGuestJoined: (guestId, _joined, needed) => {
        if (needed > 0) {
          setMpStatus(`Player ${guestId} joined — waiting for ${needed} more…`)
        } else {
          setMpStatus('All players connected — starting match!')
          enterOnlinePlay()
        }
      },
      onState: (state) => {
        setOnlineGame(state)
        setPlayerCount(state.playerCount)
      },
      onWaiting: (message) => setMpStatus(message),
      onError: (message) => {
        setMpError(message)
        setMpConnecting(false)
      },
      onDisconnect: () => {
        setMpError('A player disconnected.')
        setMpConnecting(false)
      },
    }),
    [enterOnlinePlay, playerCount],
  )

  const handleBack = () => {
    resetMultiplayer()
    setScreen('menu')
    setPlayTheme(null)
  }

  const handleLocalPlay = () => {
    setScreen('local-count')
  }

  const handleMultiplayerMenu = () => {
    resetMultiplayer()
    setScreen('multiplayer-count')
  }

  const startLocalGame = (count: PlayerCount) => {
    setPlayerCount(count)
    setPlayTheme(generatePlayTheme())
    setScreen('play')
  }

  const openMultiplayerLobby = (count: PlayerCount) => {
    setPlayerCount(count)
    resetMultiplayer()
    setScreen('multiplayer')
  }

  const handleHost = async () => {
    if (mpBusyRef.current) return
    mpBusyRef.current = true
    setMpConnecting(true)
    setMpError(null)
    setMpCode(null)
    setMyPlayerId(1)

    const client = new MultiplayerClient(1, playerCount, makeCallbacks())
    setActiveMultiplayerClient(client)
    mpClientRef.current = client

    try {
      await client.host()
    } catch {
      /* onError callback handles messaging */
    } finally {
      setMpConnecting(false)
      mpBusyRef.current = false
    }
  }

  const handleJoin = async (code: string) => {
    if (mpBusyRef.current) return
    mpBusyRef.current = true
    setMpConnecting(true)
    setMpError(null)
    setMpCode(null)

    const client = new MultiplayerClient(2, playerCount, makeCallbacks())
    setActiveMultiplayerClient(client)
    mpClientRef.current = client

    try {
      await client.join(code)
    } catch {
      /* onError callback handles messaging */
    } finally {
      setMpConnecting(false)
      mpBusyRef.current = false
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
          <MenuScreen onPlay={handleLocalPlay} onMultiplayer={handleMultiplayerMenu} />
        )}
        {screen === 'local-count' && (
          <PlayerCountSelect
            title="Local Play"
            subtitle="Choose how many players are at the table."
            onBack={() => setScreen('menu')}
            onSelect={startLocalGame}
          />
        )}
        {screen === 'multiplayer-count' && (
          <PlayerCountSelect
            title="Multiplayer"
            subtitle="Pick a match size, then host or join with a room code."
            onBack={() => setScreen('menu')}
            onSelect={openMultiplayerLobby}
          />
        )}
        {screen === 'multiplayer' && (
          <MultiplayerMenuScreen
            playerCount={playerCount}
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
          <PlayScreen
            key={`${playTheme.id}-${playerCount}`}
            theme={playTheme}
            playerCount={playerCount}
            onBack={handleBack}
            mode="local"
          />
        )}
        {screen === 'online-play' && playTheme && (
          onlineGame ? (
            <PlayScreen
              key={`${playTheme.id}-online-${playerCount}`}
              theme={playTheme}
              playerCount={playerCount}
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
