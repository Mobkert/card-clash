import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { getTemplate } from '../game/cards'
import { clearRefillEffect, createInitialGame, rematchGame } from '../game/engine'
import type { ClientAction } from '../game/applyGameAction'
import { applyGameAction } from '../game/applyGameAction'
import type { GameState, PlayerCount, PlayerId } from '../game/types'
import { getPlayer, playerIds } from '../game/players'
import { AbilityModal } from '../components/AbilityModal'
import { Board } from '../components/Board'
import { Deck } from '../components/Deck'
import { Hand } from '../components/Hand'
import { TradeModal } from '../components/TradeModal'
import { CounterPromptModal } from '../components/CounterPrompt'
import { DoubleTroubleBadge } from '../components/DoubleTroubleBadge'
import { ObjectivesIntro } from '../components/ObjectivesIntro'
import { ObjectivesReveal } from '../components/ObjectivesReveal'
import { ObjectivesPanel } from '../components/ObjectivesPanel'
import { VictoryCinematic } from '../components/VictoryCinematic'
import { VictoryScreen } from '../components/VictoryScreen'
import { ScreenVfx } from '../components/vfx/ScreenVfx'
import { hasBuff } from '../game/status'
import { BOARD_VFX_TYPES } from '../components/vfx/vfxConfig'
import type { PlayTheme } from '../theme/playTheme'
import { themeStyle } from '../theme/playTheme'
import './PlayScreen.css'

interface PlayScreenProps {
  theme: PlayTheme
  playerCount?: PlayerCount
  onBack: () => void
  mode?: 'local' | 'online'
  myPlayerId?: PlayerId
  onlineGame?: GameState
  onOnlineAction?: (action: ClientAction) => void
}

function refillKey(playerId: PlayerId): 'p1' | 'p2' | 'p3' {
  if (playerId === 1) return 'p1'
  if (playerId === 2) return 'p2'
  return 'p3'
}

function onlineRoleLabel(playerId: PlayerId): string {
  if (playerId === 1) return 'Host · Player 1'
  if (playerId === 2) return 'Guest · Player 2'
  return 'Guest · Player 3'
}

export function PlayScreen({
  theme,
  playerCount: playerCountProp = 2,
  onBack,
  mode = 'local',
  myPlayerId = 1,
  onlineGame,
  onOnlineAction,
}: PlayScreenProps) {
  const isOnline = mode === 'online'
  const [localGame, setLocalGame] = useState<GameState>(() => createInitialGame(playerCountProp))
  const game = isOnline && onlineGame ? onlineGame : localGame
  const playerCount = game.playerCount
  const isTriple = playerCount === 3
  const ids = playerIds(playerCount)
  const [controllingPlayer, setControllingPlayer] = useState<PlayerId>(1)
  const actorId = isOnline ? myPlayerId : controllingPlayer
  const [newlyDrawnIds, setNewlyDrawnIds] = useState<{ p1: string[]; p2: string[]; p3: string[] }>({
    p1: [],
    p2: [],
    p3: [],
  })
  const [handPreviewId, setHandPreviewId] = useState<string | null>(null)
  const [showVictoryMenu, setShowVictoryMenu] = useState(false)
  const p1BoardRef = useRef<HTMLDivElement>(null)
  const p2BoardRef = useRef<HTMLDivElement>(null)
  const p3BoardRef = useRef<HTMLDivElement>(null)
  const arenaWrapRef = useRef<HTMLDivElement>(null)

  const gameFinished = game.phase === 'finished' && game.winner != null
  const victoryCinematicActive = gameFinished && !showVictoryMenu

  const p1 = getPlayer(game.players, 1)
  const p2 = getPlayer(game.players, 2)
  const p3 = isTriple ? getPlayer(game.players, 3) : null
  const boardRefs: Record<PlayerId, RefObject<HTMLDivElement | null>> = {
    1: p1BoardRef,
    2: p2BoardRef,
    3: p3BoardRef,
  }

  const controlsPlayer = (pid: PlayerId) =>
    isOnline ? myPlayerId === pid : controllingPlayer === pid
  const attackerId = isOnline ? actorId : controllingPlayer

  const dispatch = useCallback(
    (action: ClientAction) => {
      if (isOnline) {
        onOnlineAction?.(action)
        return
      }
      setLocalGame((s) => applyGameAction(s, actorId, action))
    },
    [isOnline, onOnlineAction, actorId],
  )

  useEffect(() => {
    if (!game.refillEffect) return

    const { playerId, drawnInstanceIds } = game.refillEffect
    const key = refillKey(playerId)
    setNewlyDrawnIds((prev) => ({ ...prev, [key]: drawnInstanceIds }))

    const timer = setTimeout(() => {
      setNewlyDrawnIds((prev) => ({ ...prev, [key]: [] }))
      if (isOnline) {
        dispatch({ type: 'CLEAR_REFILL' })
      } else {
        setLocalGame((s) => clearRefillEffect(s))
      }
    }, 900)

    return () => clearTimeout(timer)
  }, [game.refillEffect, isOnline, dispatch])

  useEffect(() => {
    setHandPreviewId(null)
  }, [actorId, game.phase])

  useEffect(() => {
    if (!gameFinished) setShowVictoryMenu(false)
  }, [gameFinished, game.winner])

  useEffect(() => {
    if (isOnline) return

    setControllingPlayer((current) => {
      if (game.counterPrompt) return game.counterPrompt.defenderId

      if (game.phase === 'objectives') {
        for (const id of ids) {
          if (!game.objectivePicks[id]) return id
        }
        return current
      }

      if (game.phase === 'objective_reveal') {
        for (const id of ids) {
          if (!game.objectivesAck[id]) return id
        }
        return current
      }

      if (game.phase === 'playing') return game.activePlayer

      return current
    })
  }, [
    isOnline,
    game.phase,
    game.activePlayer,
    game.objectivePicks[1],
    game.objectivePicks[2],
    game.objectivePicks[3],
    game.objectivesAck[1],
    game.objectivesAck[2],
    game.objectivesAck[3],
    ids,
    game.counterPrompt?.defenderId,
  ])

  useEffect(() => {
    if (game.phase !== 'objectives' && game.phase !== 'objective_reveal') return

    const tick = () => {
      if (isOnline) {
        dispatch({ type: 'TICK_OBJECTIVES' })
      } else {
        setLocalGame((s) => applyGameAction(s, 1, { type: 'TICK_OBJECTIVES' }))
      }
    }

    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [game.phase, game.objectivesDeadlineMs, isOnline, dispatch])

  const selectedId = game.selectedCard?.instanceId ?? null
  const selectedTemplate = game.selectedCard ? getTemplate(game.selectedCard.templateId) : null
  const isPassiveSelected = selectedTemplate?.type === 'passive'
  const isNoTargetSpecial =
    selectedTemplate?.type === 'special' &&
    (selectedTemplate.effect === 'soul_revive' ||
      selectedTemplate.effect === 'quantity_buff' ||
      selectedTemplate.effect === 'pickpocket_steal')
  const isNoTargetAttack =
    selectedTemplate?.type === 'attack' && selectedTemplate.effect === 'caffeinated_buff'

  const isSpecialLaneTargeting =
    selectedTemplate?.type === 'special' && selectedTemplate.effect === 'lane_freeze_damage'
  const isSpecialCharTargeting =
    selectedTemplate?.type === 'special' &&
    (selectedTemplate.effect === 'cannon_damage' ||
      selectedTemplate.effect === 'cobweb' ||
      selectedTemplate.effect === 'cooldown_pause')
  const isLaneTargeting =
    game.characterAttack?.targetMode === 'enemy_lane' ||
    game.characterAttack?.targetMode === 'enemy_lane_second' ||
    isSpecialLaneTargeting
  const isCharTargeting =
    game.characterAttack?.targetMode === 'enemy_character' ||
    game.characterAttack?.targetMode === 'enemy_character_second' ||
    game.characterAttack?.awaitingDoubleSecond === true
  const handDoublePending = game.handAttack?.awaitingDoubleSecond === true
  const handDoubleTemplate = handDoublePending
    ? getTemplate(game.handAttack!.card.templateId)
    : null
  const isHandDoubleChar = handDoublePending && handDoubleTemplate?.effect !== 'obscure'
  const isHandDoubleTree = handDoublePending && handDoubleTemplate?.effect === 'obscure'
  const isDoubleHitSecond = game.characterAttack?.targetMode === 'double_hit_second'
  const isAoeTargeting = game.characterAttack?.targetMode === 'enemy_aoe'
  const isChaosTargeting = game.characterAttack?.targetMode === 'enemy_chaos_2x2'
  const isExplosiveTargeting =
    selectedTemplate?.type === 'attack' && selectedTemplate.effect === 'explosive_aoe'
  const isColumnTargeting =
    selectedTemplate?.type === 'attack' && selectedTemplate.effect === 'column_sweep'
  const isAllyTargeting = game.characterAttack?.targetMode === 'ally_character'
  const isTornadoDestination = !!game.tornadoMove
  const isHandTargeting =
    (selectedTemplate?.type === 'attack' &&
      selectedTemplate.effect !== 'obscure' &&
      selectedTemplate.effect !== 'explosive_aoe' &&
      selectedTemplate.effect !== 'column_sweep') ||
    isSpecialCharTargeting ||
    isHandDoubleChar ||
    isDoubleHitSecond
  const isTreeTargeting =
    (selectedTemplate?.type === 'attack' && selectedTemplate.effect === 'obscure') ||
    isHandDoubleTree
  const activePlayerState = getPlayer(game.players, game.activePlayer)
  const showActiveDoubleTrouble =
    game.phase === 'playing' && hasBuff(activePlayerState, 'double_trouble')

  const isLineOfSightTargeting =
    isHandTargeting || isCharTargeting || isDoubleHitSecond

  const boardFlags = (boardPlayerId: PlayerId) => {
    const enemy = boardPlayerId !== attackerId
    const ally = boardPlayerId === attackerId
    return {
      targeting: (isHandTargeting || isCharTargeting || isDoubleHitSecond) && enemy,
      lineOfSightAttackerId:
        isLineOfSightTargeting && enemy ? attackerId : undefined,
      laneTargeting: isLaneTargeting && enemy,
      aoeTargeting: isAoeTargeting && enemy,
      explosiveTargeting: (isExplosiveTargeting || isChaosTargeting) && enemy,
      columnTargeting: isColumnTargeting && enemy,
      allyTargeting: isAllyTargeting && ally,
      treeTargeting: (isTreeTargeting || isTornadoDestination) && enemy,
    }
  }

  const renderBoard = (
    boardPlayerId: PlayerId,
    playerState: typeof p1,
    label: string,
    boardRef: RefObject<HTMLDivElement | null>,
    layout: 'vertical' | 'horizontal' = 'vertical',
  ) => {
    const flags = boardFlags(boardPlayerId)
    return (
      <Board
        ref={boardRef}
        slots={playerState.board}
        playerId={boardPlayerId}
        label={label}
        layout={layout}
        targeting={flags.targeting}
        lineOfSightAttackerId={flags.lineOfSightAttackerId}
        laneTargeting={flags.laneTargeting}
        aoeTargeting={flags.aoeTargeting}
        explosiveTargeting={flags.explosiveTargeting}
        columnTargeting={flags.columnTargeting}
        allyTargeting={flags.allyTargeting}
        treeTargeting={flags.treeTargeting}
        boardVfx={game.vfxQueue.filter(
          (v) => v.targetPlayerId === boardPlayerId && BOARD_VFX_TYPES.has(v.vfx),
        )}
        onBoardVfxDone={(id) => dispatch({ type: 'POP_VFX', vfxId: id })}
        onSlotClick={(row, col) => {
          if (isOnline && myPlayerId !== boardPlayerId && game.phase === 'setup') return
          dispatch({ type: 'BOARD_CLICK', boardPlayerId, row, col })
        }}
      />
    )
  }
  const abilityModalCharacter = (() => {
    if (!game.abilityModal) return null
    const player = getPlayer(game.players, game.abilityModal.playerId)
    const slot = player.board.find(
      (s) => s.row === game.abilityModal!.row && s.col === game.abilityModal!.col,
    )
    return slot?.character ?? null
  })()
  const viewerId = isOnline ? myPlayerId : actorId
  const ackPlayerId = isOnline ? myPlayerId : actorId
  const viewerObjectives = getPlayer(game.players, viewerId).objectives
  const phaseLabel =
    game.phase === 'setup'
      ? 'Setup Mode'
      : game.phase === 'objectives'
        ? 'Draft Objectives'
        : game.phase === 'objective_reveal'
          ? 'Reveal Objectives'
        : game.phase === 'finished'
          ? 'Game Over'
          : `Player ${game.activePlayer}'s Turn`

  return (
    <div
      className={`play play--${theme.uiVariant}${victoryCinematicActive ? ' play--victory-cinematic' : ''}`}
      style={themeStyle(theme)}
      data-theme-name={theme.name}
    >
      <ScreenVfx
        events={game.vfxQueue.filter((e) => !BOARD_VFX_TYPES.has(e.vfx))}
        onDone={(id) => dispatch({ type: 'POP_VFX', vfxId: id })}
      />

      <header className="play__header">
        <button type="button" className="play__back" onClick={onBack}>
          ← Menu
        </button>
        <div className="play__status">
          {isOnline && (
            <span className="play__online-tag">{onlineRoleLabel(myPlayerId)}</span>
          )}
          <span className={`play__phase play__phase--${game.phase}`}>{phaseLabel}</span>
          {showActiveDoubleTrouble && <DoubleTroubleBadge active />}
          <span className="play__message">
            {game.message}
            {game.phase === 'setup' && (
              <span className="play__theme-tag"> · {theme.name}</span>
            )}
          </span>
        </div>
        {game.phase === 'setup' && (!isOnline || myPlayerId === 1) && (
          <button type="button" className="play__start-btn" onClick={() => dispatch({ type: 'START_GAME' })}>
            Start Game
          </button>
        )}
      </header>

      {!isOnline && game.phase === 'setup' && (
      <div className="play__player-tabs">
        {ids.map((pid) => (
          <button
            key={pid}
            type="button"
            className={`play__tab${controllingPlayer === pid ? ' play__tab--active' : ''}`}
            onClick={() => setControllingPlayer(pid)}
          >
            Control Player {pid}
          </button>
        ))}
      </div>
      )}

      {!isOnline && game.phase !== 'setup' && game.phase !== 'finished' && (
        <div className="play__local-active" aria-live="polite">
          Now playing as <strong>Player {controllingPlayer}</strong>
        </div>
      )}

      <div
        ref={arenaWrapRef}
        className={`play__arena-wrap${victoryCinematicActive ? ' play__arena-wrap--victory' : ''}`}
      >
        {game.phase === 'playing' && !isTriple && (!isOnline || viewerId === 1) && (
          <ObjectivesPanel
            objectives={p1.objectives}
            side="left"
            showRaceHint={!isOnline}
            objectiveCount={3}
          />
        )}

        <div className={`play__arena${isTriple ? ' play__arena--triple' : ''}`}>
          {isTriple && p3 && (
            <div className="play__arena-top">
              {renderBoard(3, p3, 'Player 3', p3BoardRef, 'horizontal')}
            </div>
          )}

          {isTriple ? (
            <div className="play__arena-sides">
              {renderBoard(1, p1, 'Player 1', p1BoardRef)}

              <div className="play__center play__center--triple">
                {game.phase === 'playing' && (
                  <ObjectivesPanel
                    objectives={viewerObjectives}
                    side="center"
                    showRaceHint={!isOnline}
                    objectiveCount={4}
                  />
                )}
                {game.refillEffect && (
                  <div className="play__refill-toast">
                    +{game.refillEffect.cardsDrawn} cards drawn!
                  </div>
                )}
              </div>

              {renderBoard(2, p2, 'Player 2', p2BoardRef)}
            </div>
          ) : (
            <>
              {renderBoard(1, p1, 'Player 1', p1BoardRef)}

              <div className="play__center">
                <div className="play__legend">
                  <span className="legend legend--character">Character</span>
                  <span className="legend legend--attack">Attack</span>
                  <span className="legend legend--passive">Passive</span>
                  <span className="legend legend--special">Special</span>
                </div>
                {game.phase === 'setup' && (
                  <p className="play__setup-hint">
                    Full card pool in each deck — all characters, attacks, specials, and passives (including Thorn Mail, Regrowth, Gamble).
                  </p>
                )}
                {game.phase === 'playing' && (
                  <p className="play__setup-hint">
                    Tap characters for abilities. 1 action/turn — play a card, reroll your deck, or pass. Hand refills after actions.
                  </p>
                )}
                {game.refillEffect && (
                  <div className="play__refill-toast">
                    +{game.refillEffect.cardsDrawn} cards drawn!
                  </div>
                )}
              </div>

              {renderBoard(2, p2, 'Player 2', p2BoardRef)}
            </>
          )}
        </div>

        {game.phase === 'playing' && !isTriple && (!isOnline || viewerId === 2) && (
          <ObjectivesPanel
            objectives={p2.objectives}
            side="right"
            showRaceHint={!isOnline}
            objectiveCount={3}
          />
        )}
      </div>

      {game.phase === 'objectives' && (
        <ObjectivesIntro
          myPlayerId={ackPlayerId}
          playerCount={playerCount}
          draftOptions={game.objectiveDraftOptions}
          picks={game.objectivePicks}
          deadlineMs={game.objectivesDeadlineMs}
          isOnline={isOnline}
          onPick={(objectiveId) => dispatch({ type: 'PICK_OBJECTIVE', objectiveId })}
        />
      )}

      {game.phase === 'objective_reveal' && (
        <ObjectivesReveal
          myPlayerId={ackPlayerId}
          playerCount={playerCount}
          matchObjectives={p1.objectives}
          picks={game.objectivePicks}
          randomPickId={game.objectiveRandomPick}
          objectivesAck={game.objectivesAck}
          deadlineMs={game.objectivesDeadlineMs}
          isOnline={isOnline}
          onAck={() => dispatch({ type: 'ACK_OBJECTIVE_REVEAL' })}
        />
      )}

      {victoryCinematicActive && game.winner != null && (
        <VictoryCinematic
          winnerId={game.winner}
          boardRef={boardRefs[game.winner]}
          arenaWrapRef={arenaWrapRef}
          onComplete={() => setShowVictoryMenu(true)}
        />
      )}

      {showVictoryMenu && game.winner != null && (
        <VictoryScreen
          winnerId={game.winner}
          isOnline={isOnline}
          myPlayerId={isOnline ? myPlayerId : viewerId}
          canRematch={!isOnline || myPlayerId === 1}
          onRematch={() => {
            if (isOnline) {
              dispatch({ type: 'REMATCH' })
            } else {
              setLocalGame(rematchGame(game))
            }
          }}
          onLeave={onBack}
        />
      )}

      {abilityModalCharacter &&
        game.abilityModal &&
        (!isOnline || game.abilityModal.playerId === myPlayerId) && (
        <AbilityModal
          character={abilityModalCharacter}
          onSelect={(id) => dispatch({ type: 'SELECT_ABILITY', abilityId: id })}
          onClose={() => dispatch({ type: 'CLOSE_ABILITY_MODAL' })}
        />
      )}

      {game.tradeChoice && controlsPlayer(game.tradeChoice.playerId) && (
        <TradeModal
          onChoose={(mode) => dispatch({ type: 'CHOOSE_TRADE', mode })}
          onClose={() => dispatch({ type: 'CLOSE_TRADE' })}
        />
      )}

      {game.counterPrompt &&
        (!isOnline || game.counterPrompt.defenderId === myPlayerId) && (
        <CounterPromptModal
          prompt={game.counterPrompt}
          defenderHand={getPlayer(game.players, game.counterPrompt.defenderId).hand}
          onMirror={() => dispatch({ type: 'MIRROR_COUNTER' })}
          onSpellBook={() => dispatch({ type: 'SPELLBOOK_COUNTER' })}
          onChainLocked={() => dispatch({ type: 'CHAIN_COUNTER' })}
          onExpire={() => dispatch({ type: 'EXPIRE_COUNTER' })}
        />
      )}

      {game.lockedCards.length > 0 && (
        <div className="play__locked-cards">
          Locked:{' '}
          {game.lockedCards
            .map((l) => `${getTemplate(l.templateId).name} (${l.turnsRemaining}t)`)
            .join(', ')}
        </div>
      )}

      <div className={`play__players${isTriple ? ' play__players--triple' : ''}`}>
        {ids.map((pid) => {
          const player = getPlayer(game.players, pid)
          const key = refillKey(pid)
          return (
            <div
              key={pid}
              className={`play__player-panel${controlsPlayer(pid) ? ' play__player-panel--active' : ''}`}
            >
              <h4>
                Player {pid} {game.phase === 'playing' && game.activePlayer === pid && '★'}
                {isOnline && myPlayerId === pid && ' (You)'}
              </h4>
              <div className="play__player-row">
                <Deck
                  count={player.deck.length}
                  label="Deck"
                  disabled={
                    !controlsPlayer(pid) ||
                    (game.phase === 'playing' &&
                      (game.activePlayer !== pid ||
                        game.turnActionUsed ||
                        (player.hand.length === 0 && player.deck.length === 0)))
                  }
                  hint={
                    !controlsPlayer(pid)
                      ? isOnline
                        ? 'Opponent deck'
                        : 'Switch control tab to use'
                      : game.phase === 'playing'
                        ? game.activePlayer === pid
                          ? game.turnActionUsed
                            ? 'Action already used this turn'
                            : 'Reroll hand + deck (uses your turn)'
                          : 'Wait for your turn'
                        : 'Draw cards to hand'
                  }
                  onClick={() => dispatch({ type: 'CLICK_DECK' })}
                />
                <div className="play__hand-wrap">
                  {newlyDrawnIds[key].length > 0 && controlsPlayer(pid) && (
                    <span className="hand__refill-label">+{newlyDrawnIds[key].length} drawn</span>
                  )}
                  <Hand
                    cards={player.hand}
                    selectedId={controlsPlayer(pid) ? selectedId : null}
                    newlyDrawnIds={controlsPlayer(pid) ? newlyDrawnIds[key] : []}
                    canInspect={controlsPlayer(pid)}
                    previewId={controlsPlayer(pid) ? handPreviewId : null}
                    onPreviewChange={controlsPlayer(pid) ? setHandPreviewId : () => {}}
                    onSelect={(card) => {
                      if (!controlsPlayer(pid)) return
                      dispatch({ type: 'SELECT_CARD', cardInstanceId: card.instanceId })
                    }}
                    onUsePassive={
                      controlsPlayer(pid) && isPassiveSelected
                        ? () => dispatch({ type: 'USE_PASSIVE' })
                        : undefined
                    }
                  />
                  {controlsPlayer(pid) && (isNoTargetSpecial || isNoTargetAttack) && (
                    <button
                      type="button"
                      className="hand__passive-btn"
                      onClick={() => dispatch({ type: 'USE_SPECIAL_NO_TARGET' })}
                    >
                      Use {selectedTemplate!.name}
                    </button>
                  )}
                </div>
              </div>
              {player.passives.length > 0 && (
                <div className="play__passives">
                  Active:{' '}
                  {player.passives
                    .map((p) => `${getTemplate(p.card.templateId).name} (${p.turnsRemaining}t)`)
                    .join(', ')}
                </div>
              )}
              {player.pendingBuffs.length > 0 && (
                <div className="play__buffs">
                  Buffs: {player.pendingBuffs.map((b) => b.type).join(', ')}
                </div>
              )}
              <DoubleTroubleBadge active={hasBuff(player, 'double_trouble')} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
