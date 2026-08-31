import {
  chooseTrade,
  clickDeck,
  closeAbilityModal,
  expireCounterPrompt,
  handleBoardClick,
  popVfxEvent,
  selectCharacterAbility,
  selectHandCard,
  startGame,
  useChainLockedCounter,
  useMirrorCounter,
  usePassive,
  useSpecialNoTarget,
  useSpellBookCounter,
} from './engine'
import type { GameState } from './types'

export type ClientAction =
  | { type: 'SELECT_CARD'; cardInstanceId: string }
  | { type: 'BOARD_CLICK'; boardPlayerId: 1 | 2; row: number; col: number }
  | { type: 'START_GAME' }
  | { type: 'CLICK_DECK' }
  | { type: 'USE_PASSIVE' }
  | { type: 'USE_SPECIAL_NO_TARGET' }
  | { type: 'SELECT_ABILITY'; abilityId: string }
  | { type: 'CLOSE_ABILITY_MODAL' }
  | { type: 'CHOOSE_TRADE'; mode: 'damage' | 'cooldown' }
  | { type: 'CLOSE_TRADE' }
  | { type: 'MIRROR_COUNTER' }
  | { type: 'SPELLBOOK_COUNTER' }
  | { type: 'CHAIN_COUNTER' }
  | { type: 'EXPIRE_COUNTER' }
  | { type: 'POP_VFX'; vfxId: string }
  | { type: 'CLEAR_REFILL' }

function findHandCard(state: GameState, playerId: 1 | 2, instanceId: string) {
  const player = state.players[playerId === 1 ? 0 : 1]
  return player.hand.find((c) => c.instanceId === instanceId) ?? null
}

export function applyGameAction(
  state: GameState,
  playerId: 1 | 2,
  action: ClientAction,
): GameState {
  switch (action.type) {
    case 'SELECT_CARD': {
      const card = findHandCard(state, playerId, action.cardInstanceId)
      if (!card) return state
      return selectHandCard(state, card, playerId)
    }
    case 'BOARD_CLICK':
      return handleBoardClick(state, action.boardPlayerId, action.row, action.col, playerId)
    case 'START_GAME':
      if (playerId !== 1) return { ...state, message: 'Only the host can start the game.' }
      return startGame(state)
    case 'CLICK_DECK':
      return clickDeck(state, playerId, playerId)
    case 'USE_PASSIVE':
      return usePassive(state, playerId)
    case 'USE_SPECIAL_NO_TARGET':
      return useSpecialNoTarget(state, playerId)
    case 'SELECT_ABILITY':
      return selectCharacterAbility(state, action.abilityId)
    case 'CLOSE_ABILITY_MODAL':
      return closeAbilityModal(state)
    case 'CHOOSE_TRADE':
      return chooseTrade(state, action.mode)
    case 'CLOSE_TRADE':
      return { ...state, tradeChoice: null }
    case 'MIRROR_COUNTER':
      return state.counterPrompt
        ? useMirrorCounter(state, state.counterPrompt.defenderId)
        : state
    case 'SPELLBOOK_COUNTER':
      return state.counterPrompt
        ? useSpellBookCounter(state, state.counterPrompt.defenderId)
        : state
    case 'CHAIN_COUNTER':
      return state.counterPrompt
        ? useChainLockedCounter(state, state.counterPrompt.defenderId)
        : state
    case 'EXPIRE_COUNTER':
      return expireCounterPrompt(state)
    case 'POP_VFX':
      return popVfxEvent(state, action.vfxId)
    case 'CLEAR_REFILL':
      return { ...state, refillEffect: null }
    default:
      return state
  }
}
