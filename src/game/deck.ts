import { TEST_CARD_IDS } from './cards'
import type { CardInstance, PlayerState } from './types'
import { BOARD_COLS, BOARD_ROWS, DEFAULT_MAX_PASSIVES, DECK_SIZE, MAX_HAND_SIZE } from './types'
import { createEmptySlot } from './status'

let instanceCounter = 0

export function createCardInstance(templateId: string): CardInstance {
  instanceCounter += 1
  return { instanceId: `${templateId}_${instanceCounter}`, templateId }
}

function shuffle<T>(array: T[]): T[] {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function buildDeck(): CardInstance[] {
  const pool = TEST_CARD_IDS
  // Include every template at least once (old logic capped at DECK_SIZE and skipped late entries).
  const cards: CardInstance[] = pool.map((templateId) => createCardInstance(templateId))
  const targetSize = Math.max(DECK_SIZE, pool.length)
  let index = 0
  while (cards.length < targetSize) {
    cards.push(createCardInstance(pool[index % pool.length]))
    index += 1
  }
  return shuffle(cards)
}

export function createEmptyBoard() {
  const board = []
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      board.push(createEmptySlot(row, col))
    }
  }
  return board
}

export function createPlayer(id: 1 | 2): PlayerState {
  return {
    id,
    deck: buildDeck(),
    hand: [],
    board: createEmptyBoard(),
    passives: [],
    eliminated: [],
    pendingBuffs: [],
    maxPassives: DEFAULT_MAX_PASSIVES,
    damageTakenMultiplier: 1,
    damageDealtMultiplier: 1,
    cooldownReduction: 0,
  }
}

export function drawToHand(player: PlayerState): {
  player: PlayerState
  drawn: number
  drawnCards: CardInstance[]
} {
  const updated = { ...player, deck: [...player.deck], hand: [...player.hand] }
  const drawnCards: CardInstance[] = []
  while (updated.hand.length < MAX_HAND_SIZE && updated.deck.length > 0) {
    const [card, ...rest] = updated.deck
    updated.deck = rest
    updated.hand.push(card)
    drawnCards.push(card)
  }
  return { player: updated, drawn: drawnCards.length, drawnCards }
}

export function drawOneCard(player: PlayerState): { player: PlayerState; card: CardInstance | null } {
  if (player.hand.length >= MAX_HAND_SIZE || player.deck.length === 0) {
    return { player, card: null }
  }
  const [card, ...rest] = player.deck
  return {
    player: { ...player, deck: rest, hand: [...player.hand, card] },
    card,
  }
}

/** Shuffle hand + deck together, then deal a fresh hand (uses all cards in pool). */
export function rerollPlayerDeck(player: PlayerState): {
  player: PlayerState
  newHand: CardInstance[]
} {
  const pool = shuffle([...player.hand, ...player.deck])
  const newHand = pool.slice(0, MAX_HAND_SIZE)
  const newDeck = pool.slice(MAX_HAND_SIZE)
  return {
    player: { ...player, hand: newHand, deck: newDeck },
    newHand,
  }
}
