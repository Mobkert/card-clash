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

/** Strip opponent hand/deck contents for online clients. */
export function filterGameStateForPlayer(state: GameState, viewerId: 1 | 2): GameState {
  const [p1, p2] = state.players
  const players: [PlayerState, PlayerState] =
    viewerId === 1 ? [p1, hidePlayerSecrets(p2)] : [hidePlayerSecrets(p1), p2]

  let filtered: GameState = { ...state, players }

  if (filtered.selectedCard && filtered.activePlayer !== viewerId) {
    filtered = { ...filtered, selectedCard: null }
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

  return filtered
}

export function isHiddenCard(templateId: string): boolean {
  return templateId === HIDDEN_TEMPLATE
}
