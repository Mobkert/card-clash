import { getTemplate } from './cards'
import { TEST_CARD_IDS } from './cards'
import { emptyObjectiveStats } from './objectives'
import type { CardInstance, CardType, PlayerState } from './types'
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

export function isCharacterCard(templateId: string): boolean {
  return getTemplate(templateId).type === 'character'
}

export function countCharactersInHand(hand: CardInstance[]): number {
  return hand.filter((c) => isCharacterCard(c.templateId)).length
}

/** If hand has no characters, pull one from the deck (add to hand or swap with a non-character). */
export function ensureMinOneCharacterInHand(player: PlayerState): PlayerState {
  if (countCharactersInHand(player.hand) > 0 || player.deck.length === 0) {
    return player
  }

  const deckCharIdx = player.deck.findIndex((c) => isCharacterCard(c.templateId))
  if (deckCharIdx === -1) return player

  const charCard = player.deck[deckCharIdx]!
  const deck = [...player.deck.slice(0, deckCharIdx), ...player.deck.slice(deckCharIdx + 1)]

  if (player.hand.length < MAX_HAND_SIZE) {
    return { ...player, deck, hand: [...player.hand, charCard] }
  }

  const nonCharIdx = player.hand.findIndex((c) => !isCharacterCard(c.templateId))
  if (nonCharIdx === -1) return player

  const outCard = player.hand[nonCharIdx]!
  const hand = player.hand.map((c, i) => (i === nonCharIdx ? charCard : c))
  return { ...player, hand, deck: [...deck, outCard] }
}

export const DECK_MIN_CHARACTERS = 4
export const DECK_MIN_ATTACKS = 4
export const DECK_MIN_SPECIALS = 2

export function countCardsByType(cards: CardInstance[]): Record<CardType, number> {
  const counts = { character: 0, attack: 0, passive: 0, special: 0 }
  for (const card of cards) {
    counts[getTemplate(card.templateId).type] += 1
  }
  return counts
}

function ensureDeckMinimums(deck: CardInstance[]): CardInstance[] {
  const result = [...deck]
  const templatesByType = {
    character: TEST_CARD_IDS.filter((id) => getTemplate(id).type === 'character'),
    attack: TEST_CARD_IDS.filter((id) => getTemplate(id).type === 'attack'),
    special: TEST_CARD_IDS.filter((id) => getTemplate(id).type === 'special'),
  }

  const addUntil = (type: keyof typeof templatesByType, minimum: number) => {
    const options = templatesByType[type]
    if (options.length === 0) return
    while (countCardsByType(result)[type] < minimum) {
      const templateId = options[Math.floor(Math.random() * options.length)]!
      result.push(createCardInstance(templateId))
    }
  }

  addUntil('character', DECK_MIN_CHARACTERS)
  addUntil('attack', DECK_MIN_ATTACKS)
  addUntil('special', DECK_MIN_SPECIALS)

  return shuffle(result)
}

export function buildDeck(): CardInstance[] {
  const pool = TEST_CARD_IDS
  const cards: CardInstance[] = pool.map((templateId) => createCardInstance(templateId))
  const targetSize = Math.max(DECK_SIZE, pool.length)
  let index = 0
  while (cards.length < targetSize) {
    cards.push(createCardInstance(pool[index % pool.length]))
    index += 1
  }
  return ensureDeckMinimums(shuffle(cards))
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
    objectives: [],
    objectiveStats: emptyObjectiveStats(),
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
  return {
    player: ensureMinOneCharacterInHand(updated),
    drawn: drawnCards.length,
    drawnCards,
  }
}

export function drawOneCard(player: PlayerState): { player: PlayerState; card: CardInstance | null } {
  if (player.hand.length >= MAX_HAND_SIZE || player.deck.length === 0) {
    return { player, card: null }
  }
  const [card, ...rest] = player.deck
  return {
    player: ensureMinOneCharacterInHand({ ...player, deck: rest, hand: [...player.hand, card] }),
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

  const updated = ensureMinOneCharacterInHand({ ...player, hand: newHand, deck: newDeck })
  return {
    player: updated,
    newHand: updated.hand,
  }
}
