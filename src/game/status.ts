import { getTemplate } from './cards'
import { getPlayer, playerIds } from './players'
import type {
  BoardCharacter,
  BoardSlot,
  CardInstance,
  GameState,
  PlayerCount,
  PlayerId,
  PlayerState,
  VfxEvent,
} from './types'
import { BOARD_ROWS } from './types'

let vfxCounter = 0

export function createVfx(vfx: string, message: string, extra?: Partial<VfxEvent>): VfxEvent {
  vfxCounter += 1
  return { id: `vfx_${vfxCounter}`, vfx, message, ...extra }
}

export function createBoardCharacter(card: CardInstance): BoardCharacter {
  const template = getTemplate(card.templateId)
  const maxHealth = template.health ?? 100
  return {
    card,
    currentHealth: maxHealth,
    maxHealth,
    cooldowns: {},
    usedOneTime: [],
    abilityUseCounts: {},
    statuses: [],
  }
}

export function getAdjacentSlots(row: number, col: number): { row: number; col: number }[] {
  const slots: { row: number; col: number }[] = []
  if (row > 0) slots.push({ row: row - 1, col })
  if (row < BOARD_ROWS - 1) slots.push({ row: row + 1, col })
  slots.push({ row, col: col === 0 ? 1 : 0 })
  return slots
}

export function getPlusAoESlots(row: number, col: number): { row: number; col: number }[] {
  return [{ row, col }, ...getAdjacentSlots(row, col)]
}

/** Top-left anchor for a 2×2 block from a board click (4×2 grid). */
export function get2x2AnchorRow(clickRow: number): number {
  if (clickRow >= BOARD_ROWS - 1) return BOARD_ROWS - 2
  return clickRow
}

export function get2x2AoESlots(clickRow: number): { row: number; col: number }[] {
  const topRow = get2x2AnchorRow(clickRow)
  return [
    { row: topRow, col: 0 },
    { row: topRow, col: 1 },
    { row: topRow + 1, col: 0 },
    { row: topRow + 1, col: 1 },
  ]
}

export function getColSlots(col: number): { row: number; col: number }[] {
  return Array.from({ length: BOARD_ROWS }, (_, row) => ({ row, col }))
}

export function healSlotCharacter(slot: BoardSlot, amount: number): BoardSlot {
  if (!slot.character) return slot
  return {
    ...slot,
    character: {
      ...slot.character,
      currentHealth: Math.min(slot.character.maxHealth, slot.character.currentHealth + amount),
    },
  }
}

export function hasAttackImmunity(char: BoardCharacter): boolean {
  return char.statuses.some((s) => s.type === 'attack_immune')
}

export function consumeAttackImmunity(char: BoardCharacter): BoardCharacter {
  return {
    ...char,
    statuses: char.statuses.filter((s) => s.type !== 'attack_immune'),
  }
}

export function createEmptySlot(row: number, col: number): BoardSlot {
  return { row, col, character: null, obscured: null }
}

export function isCharacterSilenced(char: BoardCharacter): boolean {
  return char.statuses.some((s) => s.type === 'frozen' || s.type === 'webbed')
}

export function isCooldownPaused(char: BoardCharacter): boolean {
  return char.statuses.some((s) => s.type === 'cooldown_paused')
}

/** Status ticks at turn start — add 1 so silence lasts through the full round. */
export function silenceStatusTurns(rounds: number): number {
  return rounds + 1
}

export function getDamageMultiplier(char: BoardCharacter): number {
  return char.statuses.some((s) => s.type === 'half_damage') ? 0.5 : 1
}

export function applyDamageToSlot(
  slot: BoardSlot,
  damage: number,
  eliminated: CardInstance[],
): { slot: BoardSlot; eliminated: CardInstance[]; killed: CardInstance | null } {
  if (!slot.character) return { slot, eliminated, killed: null }
  const newHealth = slot.character.currentHealth - damage
  if (newHealth <= 0) {
    const killed = slot.character.card
    return {
      slot: { ...slot, character: null },
      eliminated: [...eliminated, killed],
      killed,
    }
  }
  return {
    slot: {
      ...slot,
      character: { ...slot.character, currentHealth: newHealth },
    },
    eliminated,
    killed: null,
  }
}

export function applyDamageToPlayerBoard(
  player: PlayerState,
  row: number,
  col: number,
  damage: number,
): { player: PlayerState; killed: CardInstance | null } {
  const idx = player.board.findIndex((s) => s.row === row && s.col === col)
  if (idx === -1) return { player, killed: null }
  const { slot, eliminated, killed } = applyDamageToSlot(player.board[idx], damage, player.eliminated)
  const board = player.board.map((s, i) => (i === idx ? slot : s))
  return { player: { ...player, board, eliminated }, killed }
}

export function healAllBoardCharacters(player: PlayerState, amount: number): PlayerState {
  const board = player.board.map((slot) => healSlotCharacter(slot, amount))
  return { ...player, board }
}

export function applyHauntStatus(
  char: BoardCharacter,
  duration = 2,
  dotDamage = 10,
  appliedBy?: PlayerId,
): BoardCharacter {
  return {
    ...char,
    statuses: [
      ...char.statuses.filter((s) => s.type !== 'haunt'),
      { type: 'haunt' as const, turnsRemaining: duration, damagePerTurn: dotDamage, appliedBy },
    ],
  }
}

export function consumePendingBuff(
  player: PlayerState,
  type: PlayerState['pendingBuffs'][number]['type'],
): PlayerState {
  return {
    ...player,
    pendingBuffs: player.pendingBuffs.filter((b) => b.type !== type),
    passives: player.passives.filter((p) => {
      const t = getTemplate(p.card.templateId)
      const map: Record<string, string> = {
        moonlight: 'moonlight_buff',
        haunted: 'haunted_buff',
        chaos: 'chaos_buff',
        elemental_immunity: 'elemental_immunity_buff',
        bread: 'bread_buff',
        musical_show: 'musical_show_buff',
        thorn_mail: 'thorn_mail_buff',
        regrowth: 'regrowth_buff',
        gamble_heads: 'gamble_buff',
        gamble_tails: 'gamble_buff',
      }
      return map[type] ? t.effect !== map[type] : true
    }),
  }
}

export function triggerBreadOnElimination(
  players: PlayerState[],
  updatePlayerFn: (p: PlayerState[], id: PlayerId, u: PlayerState) => PlayerState[],
  playerCount: PlayerCount = 2,
): { players: PlayerState[]; vfx: VfxEvent[]; messages: string[] } {
  const vfx: VfxEvent[] = []
  const messages: string[] = []
  let result = players
  for (const pid of playerIds(playerCount)) {
    const p = getPlayer(result, pid)
    if (!p.pendingBuffs.some((b) => b.type === 'bread')) continue
    const healed = healAllBoardCharacters(p, 5)
    result = updatePlayerFn(result, pid, healed)
    messages.push(`Bread — Player ${pid}'s team healed 5 HP!`)
    vfx.push(createVfx('bread', messages[messages.length - 1], { playerId: pid }))
  }
  return { players: result, vfx, messages }
}

export function applyRowLaneDamage(
  player: PlayerState,
  row: number,
  damage: number,
): { player: PlayerState; hits: { row: number; col: number; name: string }[]; hadKill: boolean; killCount: number } {
  const hits: { row: number; col: number; name: string }[] = []
  let eliminated = [...player.eliminated]
  let hadKill = false
  let killCount = 0
  const board = player.board.map((slot) => {
    if (slot.row !== row || !slot.character) return slot
    const name = getTemplate(slot.character.card.templateId).name
    const result = applyDamageToSlot(slot, damage, eliminated)
    eliminated = result.eliminated
    if (result.killed) {
      hadKill = true
      killCount += 1
    }
    hits.push({ row: slot.row, col: slot.col, name })
    return result.slot
  })
  return { player: { ...player, board, eliminated }, hits, hadKill, killCount }
}

export function applyColLaneDamage(
  player: PlayerState,
  col: number,
  damage: number,
): { player: PlayerState; hits: { row: number; col: number; name: string }[]; hadKill: boolean; killCount: number } {
  const hits: { row: number; col: number; name: string }[] = []
  let eliminated = [...player.eliminated]
  let hadKill = false
  let killCount = 0
  const board = player.board.map((slot) => {
    if (slot.col !== col || !slot.character) return slot
    const name = getTemplate(slot.character.card.templateId).name
    const result = applyDamageToSlot(slot, damage, eliminated)
    eliminated = result.eliminated
    if (result.killed) {
      hadKill = true
      killCount += 1
    }
    hits.push({ row: slot.row, col: slot.col, name })
    return result.slot
  })
  return { player: { ...player, board, eliminated }, hits, hadKill, killCount }
}

export function applyAoEDamage(
  player: PlayerState,
  slots: { row: number; col: number }[],
  damage: number,
): { player: PlayerState; hits: { row: number; col: number; name: string }[]; hadKill: boolean; killCount: number } {
  const hits: { row: number; col: number; name: string }[] = []
  let eliminated = [...player.eliminated]
  let hadKill = false
  let killCount = 0
  const slotSet = new Set(slots.map((s) => `${s.row}-${s.col}`))
  const board = player.board.map((slot) => {
    if (!slotSet.has(`${slot.row}-${slot.col}`) || !slot.character) return slot
    const name = getTemplate(slot.character.card.templateId).name
    const result = applyDamageToSlot(slot, damage, eliminated)
    eliminated = result.eliminated
    if (result.killed) {
      hadKill = true
      killCount += 1
    }
    hits.push({ row: slot.row, col: slot.col, name })
    return result.slot
  })
  return { player: { ...player, board, eliminated }, hits, hadKill, killCount }
}

/** @deprecated use applyRowLaneDamage — lanes are horizontal rows */
export function applyLaneDamage(
  player: PlayerState,
  row: number,
  damage: number,
) {
  return applyRowLaneDamage(player, row, damage)
}

export function setAbilityCooldown(
  char: BoardCharacter,
  abilityId: string,
  cooldown: number,
  reduction: number,
): BoardCharacter {
  const cd = Math.max(0, cooldown - reduction)
  return {
    ...char,
    cooldowns: { ...char.cooldowns, [abilityId]: cd },
  }
}

export function tickCooldowns(player: PlayerState): PlayerState {
  const board = player.board.map((slot) => {
    if (!slot.character || isCooldownPaused(slot.character)) return slot
    const cooldowns = { ...slot.character.cooldowns }
    for (const key of Object.keys(cooldowns)) {
      if (cooldowns[key] > 0) cooldowns[key] -= 1
    }
    return { ...slot, character: { ...slot.character, cooldowns } }
  })
  return { ...player, board }
}

export function tickStatusesAndDots(player: PlayerState): {
  player: PlayerState
  messages: string[]
  vfx: VfxEvent[]
  dotDamageByPlayer: Partial<Record<PlayerId, number>>
} {
  const messages: string[] = []
  const vfx: VfxEvent[] = []
  const dotDamageByPlayer: Partial<Record<PlayerId, number>> = {}
  let eliminated = [...player.eliminated]

  const board = player.board.map((slot) => {
    if (!slot.character) return slot
    let char = slot.character

    for (const status of char.statuses) {
      if ((status.type === 'infect' || status.type === 'burn') && status.damagePerTurn) {
        const dmg = status.damagePerTurn
        const name = getTemplate(char.card.templateId).name
        const result = applyDamageToSlot({ ...slot, character: char }, dmg, eliminated)
        eliminated = result.eliminated
        char = result.slot.character!
        messages.push(`${name} takes ${dmg} ${status.type} damage!`)
        vfx.push(
          createVfx(status.type, `${name} −${dmg} ${status.type}!`, {
            targetPlayerId: player.id,
            targets: [{ row: slot.row, col: slot.col, name }],
          }),
        )
        if (status.appliedBy === 1 || status.appliedBy === 2 || status.appliedBy === 3) {
          dotDamageByPlayer[status.appliedBy] = (dotDamageByPlayer[status.appliedBy] ?? 0) + dmg
        }
        if (!result.slot.character) {
          return { ...slot, character: null }
        }
      }
    }

    const statuses = char.statuses
      .map((s) => ({ ...s, turnsRemaining: s.permanent ? s.turnsRemaining : s.turnsRemaining - 1 }))
      .filter((s) => s.permanent || s.turnsRemaining > 0)

    return { ...slot, character: { ...char, statuses } }
  })

  const obscuredBoard = board.map((slot) => {
    if (!slot.obscured) return slot
    const turnsRemaining = slot.obscured.turnsRemaining - 1
    return {
      ...slot,
      obscured: turnsRemaining > 0 ? { ...slot.obscured, turnsRemaining } : null,
    }
  })

  return {
    player: { ...player, board: obscuredBoard, eliminated },
    messages,
    vfx,
    dotDamageByPlayer,
  }
}

export function tickPassivesAndBuffs(player: PlayerState): PlayerState {
  const passives = player.passives
    .map((p) => ({ ...p, turnsRemaining: p.turnsRemaining - 1 }))
    .filter((p) => p.turnsRemaining > 0)

  const pendingBuffs = player.pendingBuffs
    .map((b) => (b.turnsRemaining != null ? { ...b, turnsRemaining: b.turnsRemaining - 1 } : b))
    .filter((b) => b.turnsRemaining == null || b.turnsRemaining > 0)

  let maxPassives = 1
  if (pendingBuffs.some((b) => b.type === 'quantity')) maxPassives = 2

  let damageDealtMultiplier = 1
  let damageTakenMultiplier = 1
  let cooldownReduction = 0

  for (const b of pendingBuffs) {
    if (b.type === 'trade_damage') {
      damageDealtMultiplier = 1.5
      damageTakenMultiplier = 1.5
    }
    if (b.type === 'trade_cooldown') {
      cooldownReduction = 1
      damageTakenMultiplier = 1.75
    }
    if (b.type === 'caffeinated') {
      cooldownReduction += 1
    }
  }

  return {
    ...player,
    passives,
    pendingBuffs,
    maxPassives,
    damageDealtMultiplier,
    damageTakenMultiplier,
    cooldownReduction,
  }
}

export function removeTemplateFromDeck(player: PlayerState, templateId: string): PlayerState {
  return {
    ...player,
    deck: player.deck.filter((c) => c.templateId !== templateId),
    hand: player.hand.filter((c) => c.templateId !== templateId),
  }
}

export function consumeShard(player: PlayerState): PlayerState {
  return {
    ...player,
    pendingBuffs: player.pendingBuffs.filter((b) => b.type !== 'shard'),
    passives: player.passives.filter((p) => p.card.templateId !== 'pas_shard'),
  }
}

export function consumeDoubleTrouble(player: PlayerState): PlayerState {
  return {
    ...player,
    pendingBuffs: player.pendingBuffs.filter((b) => b.type !== 'double_trouble'),
    passives: player.passives.filter((p) => p.card.templateId !== 'pas_double_trouble'),
  }
}

export function consumeBuff(player: PlayerState, type: 'shard' | 'double_trouble'): PlayerState {
  if (type === 'shard') return consumeShard(player)
  return consumeDoubleTrouble(player)
}

export function hasBuff(player: PlayerState, type: string): boolean {
  return player.pendingBuffs.some((b) => b.type === type)
}

/** True when another character in the same row (lane) blocks line-of-sight (Trees do not block). */
export function isTargetBlockedByCharacter(
  defenderBoard: BoardSlot[],
  targetRow: number,
  targetCol: number,
  attackerId: PlayerId,
  defenderId: PlayerId,
): boolean {
  if (attackerId === defenderId) return false

  // P1 (top) attacking P2: left slot (col 0) blocks right slot (col 1) in the same lane.
  // P2 (bottom) attacking P1: right slot (col 1) blocks left slot (col 0) in the same lane.
  const blockerCol = attackerId === 1 && defenderId === 2 ? 0 : attackerId === 2 && defenderId === 1 ? 1 : null
  if (blockerCol == null) return false

  const blockedCol = blockerCol === 1 ? 0 : 1
  if (targetCol !== blockedCol) return false

  return defenderBoard.some(
    (slot) => slot.row === targetRow && slot.col === blockerCol && slot.character,
  )
}

const THORN_MAIL_DAMAGE = 3

function findThornRetaliationTarget(
  attacker: PlayerState,
  attackerId: PlayerId,
  preferredRow?: number,
  preferredCol?: number,
): { row: number; col: number } | null {
  if (preferredRow != null && preferredCol != null) {
    const idx = attacker.board.findIndex((s) => s.row === preferredRow && s.col === preferredCol)
    if (idx !== -1 && attacker.board[idx]?.character) {
      return { row: preferredRow, col: preferredCol }
    }
  }
  const frontRow = attackerId === 1 ? 0 : 3
  for (const col of [0, 1]) {
    const slot = attacker.board.find((s) => s.row === frontRow && s.col === col && s.character)
    if (slot) return { row: slot.row, col: slot.col }
  }
  const any = attacker.board.find((s) => s.character)
  return any ? { row: any.row, col: any.col } : null
}

export function applyThornMailRetaliation(
  players: PlayerState[],
  defenderId: PlayerId,
  attackerId: PlayerId,
  updatePlayerFn: (p: PlayerState[], id: PlayerId, u: PlayerState) => PlayerState[],
  vfxList: VfxEvent[],
  attackerRow?: number,
  attackerCol?: number,
): PlayerState[] {
  if (attackerId === defenderId) return players
  const defender = getPlayer(players, defenderId)
  if (!defender.pendingBuffs.some((b) => b.type === 'thorn_mail')) return players

  const attacker = getPlayer(players, attackerId)
  const target = findThornRetaliationTarget(attacker, attackerId, attackerRow, attackerCol)
  if (!target) return players

  const { player: updatedAttacker } = applyDamageToPlayerBoard(
    attacker,
    target.row,
    target.col,
    THORN_MAIL_DAMAGE,
  )
  const hitSlot = updatedAttacker.board.find((s) => s.row === target.row && s.col === target.col)
  const name = hitSlot?.character
    ? getTemplate(hitSlot.character.card.templateId).name
    : 'Enemy'

  vfxList.push(
    createVfx('thorn_mail', `Thorn Mail — ${name} takes ${THORN_MAIL_DAMAGE} damage!`, {
      playerId: defenderId,
      targetPlayerId: attackerId,
      targets: [{ row: target.row, col: target.col, name }],
    }),
  )

  return updatePlayerFn(players, attackerId, updatedAttacker)
}

export function getGambleMultiplier(player: PlayerState): number {
  if (hasBuff(player, 'gamble_heads')) return 2
  if (hasBuff(player, 'gamble_tails')) return 0.5
  return 1
}

export function findLowestHpSlot(player: PlayerState): BoardSlot | null {
  let lowest: BoardSlot | null = null
  for (const slot of player.board) {
    if (!slot.character) continue
    if (!lowest || slot.character.currentHealth < lowest.character!.currentHealth) {
      lowest = slot
    }
  }
  return lowest
}

export function applyRegrowthHeal(player: PlayerState): {
  player: PlayerState
  vfx: VfxEvent[]
  message: string | null
} {
  if (!hasBuff(player, 'regrowth')) {
    return { player, vfx: [], message: null }
  }
  const slot = findLowestHpSlot(player)
  if (!slot?.character) {
    return { player, vfx: [], message: 'Regrowth — no allies to heal.' }
  }
  const idx = player.board.findIndex((s) => s.row === slot.row && s.col === slot.col)
  const name = getTemplate(slot.character.card.templateId).name
  const board = player.board.map((s, i) => (i === idx ? healSlotCharacter(s, 5) : s))
  const message = `Regrowth — ${name} healed 5 HP!`
  return {
    player: { ...player, board },
    vfx: [
      createVfx('healing_essence', message, {
        playerId: player.id,
        targets: [{ row: slot.row, col: slot.col, name }],
      }),
    ],
    message,
  }
}

export function calcOutgoingDamage(
  player: PlayerState,
  baseDamage: number,
  shard: boolean,
  attackerChar?: BoardCharacter | null,
  gambleMultiplier = 1,
): number {
  let dmg = baseDamage * player.damageDealtMultiplier
  if (shard) dmg *= 2
  if (gambleMultiplier !== 1) dmg *= gambleMultiplier
  if (attackerChar) dmg *= getDamageMultiplier(attackerChar)
  return Math.round(dmg)
}

/** Attack-card damage — applies Gamble heads/tails when armed. */
export function calcAttackDamage(
  player: PlayerState,
  baseDamage: number,
  shard: boolean,
  attackerChar?: BoardCharacter | null,
): number {
  return calcOutgoingDamage(player, baseDamage, shard, attackerChar, getGambleMultiplier(player))
}

export function appendVfx(state: GameState, ...events: VfxEvent[]): GameState {
  return { ...state, vfxQueue: [...state.vfxQueue, ...events] }
}

export function popVfx(state: GameState, id: string): GameState {
  return { ...state, vfxQueue: state.vfxQueue.filter((v) => v.id !== id) }
}
