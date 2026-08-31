import type { CardInstance, GameState, PlayerState } from './types'

const HIDDEN_TEMPLATE = '__hidden__'

function hideCard(_card: CardInstance, index: number, prefix: string): CardInstance {
  return { instanceId: `${prefix}_${index}`, templateId: HIDDEN_TEMPLATE }
}

function hidePlayerSecrets(player: PlayerState): PlayerState {
  return {
    ...player,
    hand: player.hand.map((c, i) => hideCard(c, i, 'hidden_hand')),
    deck: player.deck.map((c, i) => hideCard(c, i, 'hidden_deck')),
    eliminated: player.eliminated.map((c, i) => hideCard(c, i, 'hidden_elim')),
  }
}

function selectedCardOwner(state: GameState, card: CardInstance): 1 | 2 | null {
  const [p1, p2] = state.players
  if (p1.hand.some((c) => c.instanceId === card.instanceId)) return 1
  if (p2.hand.some((c) => c.instanceId === card.instanceId)) return 2
  return null
}

function sanitizeMessage(state: GameState, viewerId: 1 | 2): string {
  if (state.abilityModal && state.abilityModal.playerId !== viewerId) {
    return `Player ${state.abilityModal.playerId} is choosing…`
  }

  if (state.selectedCard) {
    const owner = selectedCardOwner(state, state.selectedCard)
    if (owner !== null && owner !== viewerId) {
      return `Player ${owner} is choosing…`
    }
  }

  if (state.handAttack && state.handAttack.playerId !== viewerId) {
    return `Player ${state.handAttack.playerId} is choosing…`
  }

  if (state.characterAttack && state.characterAttack.playerId !== viewerId) {
    return `Player ${state.characterAttack.playerId} is choosing…`
  }

  if (state.tradeChoice && state.tradeChoice.playerId !== viewerId) {
    return `Player ${state.tradeChoice.playerId} is choosing…`
  }

  if (state.tornadoMove && state.tornadoMove.playerId !== viewerId) {
    return `Player ${state.tornadoMove.playerId} is choosing…`
  }

  return state.message
}

/** Strip opponent hand/deck contents for online clients. */
export function filterGameStateForPlayer(state: GameState, viewerId: 1 | 2): GameState {
  const [p1, p2] = state.players
  const players: [PlayerState, PlayerState] =
    viewerId === 1 ? [p1, hidePlayerSecrets(p2)] : [hidePlayerSecrets(p1), p2]

  let selectedCard = state.selectedCard
  if (selectedCard) {
    const owner = selectedCardOwner(state, selectedCard)
    if (owner !== null && owner !== viewerId) {
      selectedCard = null
    }
  }

  let filtered: GameState = {
    ...state,
    players,
    selectedCard,
    message: sanitizeMessage(state, viewerId),
  }

  if (filtered.abilityModal && filtered.abilityModal.playerId !== viewerId) {
    filtered = { ...filtered, abilityModal: null }
  }

  if (filtered.handAttack && filtered.handAttack.playerId !== viewerId) {
    filtered = { ...filtered, handAttack: null }
  }

  if (filtered.tradeChoice && filtered.tradeChoice.playerId !== viewerId) {
    filtered = { ...filtered, tradeChoice: null }
  }

  if (filtered.tornadoMove && filtered.tornadoMove.playerId !== viewerId) {
    filtered = { ...filtered, tornadoMove: null }
  }

  if (filtered.characterAttack && filtered.characterAttack.playerId !== viewerId) {
    filtered = { ...filtered, characterAttack: null }
  }

  if (filtered.counterPrompt && filtered.counterPrompt.defenderId !== viewerId) {
    filtered = { ...filtered, counterPrompt: null }
  }

  if (filtered.refillEffect && filtered.refillEffect.playerId !== viewerId) {
    filtered = { ...filtered, refillEffect: null }
  }

  return filtered
}

export function isHiddenCard(templateId: string): boolean {
  return templateId === HIDDEN_TEMPLATE
}
