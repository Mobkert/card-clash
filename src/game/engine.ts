import { getAbility, getCardUsageHint, getTemplate } from './cards'
import {
  createCardInstance,
  createPlayer,
  drawToHand,
  ensureMinOneCharacterInHand,
  rerollPlayerDeck,
} from './deck'
import {
  applyObjectiveEvent,
  buildMatchObjectives,
  canFinalizeObjectiveDraft,
  cloneObjectivesForPlayer,
  bothPlayersPicked,
  canProceedFromObjectiveReveal,
  emptyObjectivePicks,
  emptyObjectivesAck,
  emptyObjectiveStats,
  OBJECTIVES_INTRO_MS,
  OBJECTIVE_REVEAL_ANIM_MS,
  resolveObjectiveDraftPicks,
} from './objectives'
import { rollDraftOptions } from './objectiveFeasibility'
import {
  appendVfx,
  applyAoEDamage,
  applyColLaneDamage,
  applyDamageToPlayerBoard,
  applyDamageToSlot,
  applyHauntStatus,
  applyRowLaneDamage,
  applyRegrowthHeal,
  calcAttackDamage,
  calcOutgoingDamage,
  consumeAttackImmunity,
  consumePendingBuff,
  consumeDoubleTrouble,
  consumeShard,
  createBoardCharacter,
  createVfx,
  get2x2AoESlots,
  getAdjacentSlots,
  getPlusAoESlots,
  getGambleMultiplier,
  hasAttackImmunity,
  hasBuff,
  healSlotCharacter,
  isCharacterSilenced,
  isTargetBlockedByCharacter,
  applyThornMailRetaliation,
  removeTemplateFromDeck,
  setAbilityCooldown,
  silenceStatusTurns,
  tickCooldowns,
  tickPassivesAndBuffs,
  tickStatusesAndDots,
  triggerBreadOnElimination,
} from './status'
import type {
  AbilityDef,
  CardInstance,
  CardTemplate,
  GameState,
  HandAttackState,
  PlayerState,
  TargetMode,
  VfxEvent,
} from './types'

export function createInitialGame(): GameState {
  const p1 = createPlayer(1)
  const p2 = createPlayer(2)
  const p1Drawn = drawToHand(p1)
  const p2Drawn = drawToHand(p2)

  return {
    phase: 'setup',
    players: [p1Drawn.player, p2Drawn.player],
    activePlayer: 1,
    selectedCard: null,
    characterAttack: null,
    handAttack: null,
    tornadoMove: null,
    abilityModal: null,
    tradeChoice: null,
    counterPrompt: null,
    lockedCards: [],
    skipNextTurnFor: null,
    bonusTurnFor: null,
    turnActionUsed: false,
    refillEffect: null,
    vfxQueue: [],
    message: 'Setup mode — place cards on each board, then press Start Game.',
    objectiveDraftOptions: [],
    objectivePicks: emptyObjectivePicks(),
    objectiveRandomPick: null,
    objectivesAck: emptyObjectivesAck(),
    objectivesDeadlineMs: null,
    winner: null,
  }
}

function updatePlayer(players: [PlayerState, PlayerState], playerId: 1 | 2, updated: PlayerState) {
  return playerId === 1 ? [updated, players[1]] as [PlayerState, PlayerState] : [players[0], updated] as [PlayerState, PlayerState]
}

/** Board updates use local `players`; objective stats live on tracked game state — merge before return. */
function mergePlayerObjectiveProgress(
  gameState: GameState,
  boardPlayers: [PlayerState, PlayerState],
): [PlayerState, PlayerState] {
  return boardPlayers.map((p) => {
    const tracked = getPlayer(gameState.players, p.id)
    return {
      ...p,
      objectiveStats: tracked.objectiveStats,
      objectives: tracked.objectives,
    }
  }) as [PlayerState, PlayerState]
}

function getPlayer(players: [PlayerState, PlayerState], playerId: 1 | 2): PlayerState {
  return playerId === 1 ? players[0] : players[1]
}

function findSlotIndex(player: PlayerState, row: number, col: number) {
  return player.board.findIndex((s) => s.row === row && s.col === col)
}

function removeFromHand(player: PlayerState, card: CardInstance): PlayerState {
  return { ...player, hand: player.hand.filter((c) => c.instanceId !== card.instanceId) }
}

function canTakeTurnAction(state: GameState, playerId: 1 | 2): boolean {
  if (state.phase === 'finished') return false
  if (state.phase === 'objectives' || state.phase === 'objective_reveal') return false
  if (state.phase !== 'playing') return true
  if (state.activePlayer !== playerId) return false
  return !state.turnActionUsed
}

function trackObjectiveKill(state: GameState, attackerId: 1 | 2): GameState {
  return applyObjectiveEvent(state, attackerId, 'eliminations', 1)
}

function trackObjectiveKills(state: GameState, attackerId: 1 | 2, count: number): GameState {
  let next = state
  for (let i = 0; i < count; i += 1) {
    next = trackObjectiveKill(next, attackerId)
  }
  return next
}

function trackObjectiveDamage(state: GameState, playerId: 1 | 2, amount: number): GameState {
  if (amount <= 0) return state
  return applyObjectiveEvent(state, playerId, 'damage_dealt', amount)
}

function startTurnProcessing(state: GameState, playerId: 1 | 2): GameState {
  if (state.skipNextTurnFor === playerId) {
    return finishTurnAction(
      {
        ...state,
        skipNextTurnFor: null,
        message: `Player ${playerId}'s turn skipped (Mirror counter used).`,
      },
      playerId,
    )
  }

  let players = state.players
  let vfx = [...state.vfxQueue]
  let messages: string[] = []

  const player = getPlayer(players, playerId)
  const ticked = tickStatusesAndDots(player)
  players = updatePlayer(players, playerId, ticked.player)
  messages.push(...ticked.messages)
  vfx.push(...ticked.vfx)

  let nextState: GameState = { ...state, players }
  for (const creditedId of [1, 2] as const) {
    const amount = ticked.dotDamageByPlayer[creditedId] ?? 0
    if (amount > 0) nextState = trackObjectiveDamage(nextState, creditedId, amount)
  }
  players = nextState.players

  const regrowth = applyRegrowthHeal(getPlayer(players, playerId))
  players = updatePlayer(players, playerId, regrowth.player)
  messages.push(...(regrowth.message ? [regrowth.message] : []))
  vfx.push(...regrowth.vfx)

  const cooled = tickCooldowns(getPlayer(players, playerId))
  const buffed = tickPassivesAndBuffs(cooled)
  players = updatePlayer(players, playerId, buffed)

  const lockedCards = state.lockedCards
    .map((l) => ({ ...l, turnsRemaining: l.turnsRemaining - 1 }))
    .filter((l) => l.turnsRemaining > 0)

  return {
    ...nextState,
    players,
    lockedCards,
    vfxQueue: vfx,
    message: messages[0] ?? state.message,
  }
}

function finishTurnAction(state: GameState, actingPlayerId: 1 | 2): GameState {
  const player = getPlayer(state.players, actingPlayerId)
  const { player: refilled, drawn, drawnCards } = drawToHand(player)

  if (state.bonusTurnFor === actingPlayerId) {
    return startTurnProcessing(
      {
        ...state,
        players: updatePlayer(state.players, actingPlayerId, refilled),
        activePlayer: actingPlayerId,
        bonusTurnFor: null,
        selectedCard: null,
        characterAttack: null,
        handAttack: null,
        tornadoMove: null,
        abilityModal: null,
        turnActionUsed: false,
        refillEffect:
          drawn > 0
            ? {
                playerId: actingPlayerId,
                cardsDrawn: drawn,
                drawnInstanceIds: drawnCards.map((c) => c.instanceId),
              }
            : null,
        message: `Musical Show — Player ${actingPlayerId} takes a bonus turn!`,
      },
      actingPlayerId,
    )
  }

  const nextPlayer = actingPlayerId === 1 ? 2 : 1

  let newState: GameState = {
    ...state,
    players: updatePlayer(state.players, actingPlayerId, refilled),
    activePlayer: nextPlayer as 1 | 2,
    selectedCard: null,
    characterAttack: null,
    handAttack: null,
    tornadoMove: null,
    abilityModal: null,
    turnActionUsed: false,
    refillEffect:
      drawn > 0
        ? {
            playerId: actingPlayerId,
            cardsDrawn: drawn,
            drawnInstanceIds: drawnCards.map((c) => c.instanceId),
          }
        : null,
    message: `Drew ${drawn} card${drawn === 1 ? '' : 's'}. Player ${nextPlayer}'s turn.`,
  }

  newState = startTurnProcessing(newState, nextPlayer)
  return newState
}

function completeAction(state: GameState, playerId: 1 | 2, vfx: VfxEvent[] = []): GameState {
  let s: GameState = {
    ...state,
    characterAttack: null,
    handAttack: null,
    tornadoMove: null,
    selectedCard: null,
  }
  if (vfx.length) s = appendVfx(s, ...vfx)
  if (s.phase === 'finished') return s
  if (state.phase === 'playing') {
    s = { ...s, turnActionUsed: true }
    return finishTurnAction(s, playerId)
  }
  return s
}

export function clearRefillEffect(state: GameState): GameState {
  return { ...state, refillEffect: null }
}

export function popVfxEvent(state: GameState, id: string): GameState {
  return { ...state, vfxQueue: state.vfxQueue.filter((v) => v.id !== id) }
}

export function selectHandCard(state: GameState, card: CardInstance, controllingPlayer: 1 | 2): GameState {
  if (state.handAttack) {
    return { ...state, message: 'Finish your Double Trouble second target first!' }
  }
  if (state.tornadoMove) {
    return { ...state, message: 'Choose where to relocate the enemy first!' }
  }
  if (state.counterPrompt) {
    return { ...state, message: 'Respond to the counter prompt first!' }
  }
  if (state.selectedCard?.instanceId === card.instanceId) {
    return {
      ...state,
      selectedCard: null,
      message: 'Card deselected.',
    }
  }
  if (state.phase === 'playing' && state.activePlayer !== controllingPlayer) {
    return { ...state, message: 'Wait for your turn.' }
  }
  if (state.phase === 'playing' && state.turnActionUsed) {
    return { ...state, message: 'You already used your action this turn.' }
  }
  const template = getTemplate(card.templateId)
  if (isCardLocked(state, card.templateId)) {
    const lock = state.lockedCards.find((l) => l.templateId === card.templateId)
    return {
      ...state,
      message: `${template.name} is chain-locked (${lock?.turnsRemaining ?? 0} turns left).`,
    }
  }
  const usageHint = getCardUsageHint(template)
  const shortHint = usageHint.startsWith('Select,') ? usageHint.slice(usageHint.indexOf(',') + 1).trim() : usageHint
  return {
    ...state,
    selectedCard: card,
    characterAttack: null,
    handAttack: null,
    tornadoMove: null,
    abilityModal: null,
    message: `Selected ${template.name}${shortHint ? ` — ${shortHint}` : ''}`,
  }
}

export function clickDeck(
  state: GameState,
  playerId: 1 | 2,
  controllingPlayer: 1 | 2,
): GameState {
  if (state.handAttack) {
    return { ...state, message: 'Finish your Double Trouble second target first!' }
  }
  if (state.tornadoMove) {
    return { ...state, message: 'Choose where to relocate the enemy first!' }
  }
  if (state.counterPrompt) {
    return { ...state, message: 'Respond to the counter prompt first!' }
  }
  if (state.characterAttack) {
    return { ...state, message: 'Cancel your ability selection first!' }
  }

  if (state.phase === 'playing') {
    if (state.activePlayer !== playerId || controllingPlayer !== playerId) {
      return { ...state, message: 'Wait for your turn.' }
    }
    if (!canTakeTurnAction(state, playerId)) {
      return { ...state, message: 'You already used your action this turn.' }
    }

    const player = getPlayer(state.players, playerId)
    if (player.hand.length === 0 && player.deck.length === 0) {
      return { ...state, message: 'No cards left to reroll.' }
    }

    const { player: rerolled, newHand } = rerollPlayerDeck(player)
    const players = updatePlayer(state.players, playerId, rerolled)
    const result = completeAction(
      {
        ...state,
        players,
        selectedCard: null,
        abilityModal: null,
        message: `Deck rerolled — ${newHand.length} card${newHand.length === 1 ? '' : 's'} in hand!`,
      },
      playerId,
    )

    return {
      ...result,
      refillEffect: {
        playerId,
        cardsDrawn: newHand.length,
        drawnInstanceIds: newHand.map((c) => c.instanceId),
      },
    }
  }

  const player = getPlayer(state.players, playerId)
  const { player: refilled, drawn } = drawToHand(player)
  if (drawn === 0) {
    return {
      ...state,
      message: player.hand.length >= 6 ? 'Hand is full (max 6).' : 'Deck is empty.',
    }
  }
  return {
    ...state,
    players: updatePlayer(state.players, playerId, refilled),
    message: `Drew ${drawn} card${drawn > 1 ? 's' : ''}.`,
  }
}

export function placeCharacterOnBoard(
  state: GameState,
  playerId: 1 | 2,
  row: number,
  col: number,
): GameState {
  if (!state.selectedCard) {
    return { ...state, message: 'Select a character card from your hand first.' }
  }
  if (!canTakeTurnAction(state, playerId)) {
    return state.activePlayer !== playerId
      ? { ...state, message: 'Wait for your turn.' }
      : { ...state, message: 'You already used your action this turn.' }
  }

  const template = getTemplate(state.selectedCard.templateId)
  if (template.type !== 'character') {
    return { ...state, message: 'Only character cards can be placed on the board.' }
  }

  const player = getPlayer(state.players, playerId)
  if (!player.hand.some((c) => c.instanceId === state.selectedCard!.instanceId)) {
    return { ...state, message: 'That card is not in this player\'s hand.' }
  }

  const slotIndex = findSlotIndex(player, row, col)
  if (slotIndex === -1) return state
  const slot = player.board[slotIndex]
  if (slot.obscured) {
    return { ...state, message: 'That slot is obscured by a Tree!' }
  }
  if (slot.character) {
    return { ...state, message: 'That slot is already occupied.' }
  }

  const character = createBoardCharacter(state.selectedCard)
  const newBoard = player.board.map((s, i) =>
    i === slotIndex ? { ...s, character } : s,
  )
  const updatedPlayer = ensureMinOneCharacterInHand({
    ...removeFromHand(player, state.selectedCard),
    board: newBoard,
  })

  const placed = completeAction(
    { ...state, players: updatePlayer(state.players, playerId, updatedPlayer) },
    playerId,
    [
      createVfx('character_deploy', `${template.name} deployed!`, {
        playerId,
        targetPlayerId: playerId,
        targets: [{ row, col, name: template.name }],
      }),
    ],
  )
  return applyObjectiveEvent(placed, playerId, 'chars_placed', 1)
}

export function openCharacterAbilities(
  state: GameState,
  playerId: 1 | 2,
  row: number,
  col: number,
  controllingPlayer: 1 | 2,
): GameState {
  if (state.handAttack) {
    return { ...state, message: 'Finish your Double Trouble second target first!' }
  }
  if (state.tornadoMove) {
    return { ...state, message: 'Choose where to relocate the enemy first!' }
  }
  if (playerId !== controllingPlayer) return state

  const player = getPlayer(state.players, playerId)
  const slotIndex = findSlotIndex(player, row, col)
  const slot = player.board[slotIndex]
  if (!slot?.character) return state

  if (isCharacterSilenced(slot.character)) {
    return { ...state, message: 'This character is silenced and cannot attack!' }
  }

  if (state.phase === 'playing') {
    if (state.activePlayer !== controllingPlayer) {
      return { ...state, message: 'Wait for your turn.' }
    }
    if (state.turnActionUsed) {
      return { ...state, message: 'You already used your action this turn.' }
    }
    if (state.selectedCard) {
      return { ...state, message: 'Deselect your hand card first.' }
    }
  }

  return {
    ...state,
    abilityModal: { playerId, row, col },
    selectedCard: null,
    characterAttack: null,
    handAttack: null,
    message: 'Choose an ability.',
  }
}

export function closeAbilityModal(state: GameState): GameState {
  return { ...state, abilityModal: null, characterAttack: null }
}

function getTargetMode(ability: AbilityDef): TargetMode {
  if (ability.effect === 'lane_damage' || ability.effect === 'conditional_lane_damage') return 'enemy_lane'
  if (ability.targetType === 'enemy_aoe') return 'enemy_aoe'
  if (ability.targetType === 'ally_character') return 'ally_character'
  return 'enemy_character'
}

function abilityRequirementMet(char: NonNullable<BoardSlot['character']>, ability: AbilityDef): boolean {
  if (!ability.requiresUses) return true
  return (char.abilityUseCounts[ability.requiresUses.abilityId] ?? 0) >= ability.requiresUses.count
}

function targetHint(ability: AbilityDef): string {
  if (ability.targetType === 'none') return `${ability.name} — activating.`
  if (ability.targetType === 'ally_character') return `${ability.name} — click one of your characters.`
  if (ability.targetType === 'enemy_aoe') return `${ability.name} — click enemy board to aim the blast (+ shape).`
  if (ability.effect === 'lane_damage' || ability.effect === 'conditional_lane_damage') {
    return `${ability.name} — click an enemy row (horizontal lane).`
  }
  if (ability.effect === 'double_target_damage') return `${ability.name} — click first enemy, then a second.`
  return `${ability.name} — click an enemy.`
}

const BLOCKED_TARGET_MSG = 'That character is blocked by another in the same lane!'

const SINGLE_TARGET_ENEMY_EFFECTS = new Set<AbilityDef['effect']>([
  'damage',
  'sacrifice_nuke',
  'damage_self_heal',
  'stare',
  'double_target_damage',
  'half_damage_debuff',
  'web',
  'infect',
  'haunt_debuff',
])

function rejectIfBlocked(
  state: GameState,
  attackerId: 1 | 2,
  defenderId: 1 | 2,
  targetRow: number,
  targetCol: number,
): GameState | null {
  const defender = getPlayer(state.players, defenderId)
  if (isTargetBlockedByCharacter(defender.board, targetRow, targetCol, attackerId, defenderId)) {
    return { ...state, message: BLOCKED_TARGET_MSG }
  }
  return null
}

function maybeApplyThornMail(
  players: [PlayerState, PlayerState],
  defenderId: 1 | 2,
  attackerId: 1 | 2,
  vfxList: VfxEvent[],
  attackerRow?: number,
  attackerCol?: number,
): [PlayerState, PlayerState] {
  if (attackerId === defenderId) return players
  return applyThornMailRetaliation(
    players,
    defenderId,
    attackerId,
    updatePlayer,
    vfxList,
    attackerRow,
    attackerCol,
  )
}

function applyGambleConsume(
  players: [PlayerState, PlayerState],
  playerId: 1 | 2,
  vfxList: VfxEvent[],
): [PlayerState, PlayerState] {
  const player = getPlayer(players, playerId)
  const heads = hasBuff(player, 'gamble_heads')
  const tails = hasBuff(player, 'gamble_tails')
  if (!heads && !tails) return players
  const updated = consumePendingBuff(player, heads ? 'gamble_heads' : 'gamble_tails')
  vfxList.push(
    createVfx(heads ? 'gamble_heads' : 'gamble_tails', heads ? 'Gamble — 2× damage!' : 'Gamble — half damage!', {
      playerId,
    }),
  )
  return updatePlayer(players, playerId, updated)
}

function appendGambleStrikeVfx(
  vfxList: VfxEvent[],
  playerId: 1 | 2,
  targetPlayerId: 1 | 2,
  targets: { row: number; col: number; name: string }[],
  gambleMult: number,
) {
  if (gambleMult === 1) return
  vfxList.push(
    createVfx(
      gambleMult > 1 ? 'gamble_heads' : 'gamble_tails',
      gambleMult > 1 ? 'GAMBLE — 2× DAMAGE!' : 'GAMBLE — HALF DAMAGE!',
      { playerId, targetPlayerId, targets },
    ),
  )
}

function resolveDamageVfx(ability: AbilityDef): string {
  if (ability.vfx) return ability.vfx
  if (ability.id === 'soul_slash') return 'soul_slash'
  if (ability.id === 'banana_boom' || ability.effect === 'sacrifice_nuke') return 'banana_boom'
  return 'damage'
}

function resolveLaneVfx(ability: AbilityDef): string {
  if (ability.vfx) return ability.vfx
  if (ability.id === 'soul_slice') return 'soul_slice'
  return 'boulder_roll'
}

function applyHauntRecoil(
  players: [PlayerState, PlayerState],
  attackerId: 1 | 2,
  attackerRow: number,
  attackerCol: number,
): { players: [PlayerState, PlayerState]; vfx: VfxEvent[]; message: string | null; recoilCredit: { playerId: 1 | 2; amount: number } | null } {
  const player = getPlayer(players, attackerId)
  const idx = findSlotIndex(player, attackerRow, attackerCol)
  const slot = player.board[idx]
  if (!slot?.character?.statuses.some((s) => s.type === 'haunt')) {
    return { players, vfx: [], message: null, recoilCredit: null }
  }
  const haunt = slot.character.statuses.find((s) => s.type === 'haunt')
  const dmg = haunt?.damagePerTurn ?? 10
  const creditPlayerId =
    haunt?.appliedBy === 1 || haunt?.appliedBy === 2
      ? haunt.appliedBy
      : ((attackerId === 1 ? 2 : 1) as 1 | 2)
  const name = getTemplate(slot.character.card.templateId).name
  const result = applyDamageToSlot(slot, dmg, player.eliminated)
  const board = player.board.map((s, i) => (i === idx ? result.slot : s))
  const updated = { ...player, board, eliminated: result.eliminated }
  return {
    players: updatePlayer(players, attackerId, updated),
    vfx: [
      createVfx('haunt_recoil', `${name} takes ${dmg} haunt damage!`, {
        playerId: attackerId,
        targetPlayerId: attackerId,
        targets: [{ row: attackerRow, col: attackerCol, name }],
      }),
    ],
    message: `${name} is haunted — ${dmg} recoil damage!`,
    recoilCredit: { playerId: creditPlayerId, amount: dmg },
  }
}

export function selectCharacterAbility(state: GameState, abilityId: string): GameState {
  if (!state.abilityModal) return state

  const { playerId, row, col } = state.abilityModal

  if (state.phase === 'playing') {
    if (state.activePlayer !== playerId) {
      return { ...state, message: 'Wait for your turn.' }
    }
    if (!canTakeTurnAction(state, playerId)) {
      return { ...state, message: 'You already used your action this turn.' }
    }
  }

  const player = getPlayer(state.players, playerId)
  const slot = player.board[findSlotIndex(player, row, col)]
  if (!slot?.character) return state

  const ability = getAbility(slot.character.card.templateId, abilityId)
  if (!ability) return state

  if (ability.oneTime && slot.character.usedOneTime.includes(abilityId)) {
    return { ...state, message: 'That ability was already used.' }
  }
  if (isCharacterSilenced(slot.character)) {
    return { ...state, message: 'This character is silenced and cannot use abilities!' }
  }
  if ((slot.character.cooldowns[abilityId] ?? 0) > 0) {
    return { ...state, message: `${ability.name} on cooldown (${slot.character.cooldowns[abilityId]} turns).` }
  }
  if (!abilityRequirementMet(slot.character, ability)) {
    const req = ability.requiresUses!
    return {
      ...state,
      message: `${ability.name} needs ${req.abilityId.replace(/_/g, ' ')} used ${req.count} times first (${slot.character.abilityUseCounts[req.abilityId] ?? 0}/${req.count}).`,
    }
  }

  if (ability.targetType === 'none') {
    return applyAbilityEffect(
      { ...state, abilityModal: null },
      playerId,
      row,
      col,
      ability,
      playerId,
      row,
      col,
    )
  }

  const attackerPlayer = getPlayer(state.players, playerId)

  if (
    hasBuff(attackerPlayer, 'chaos') &&
    !CHAOS_EXCLUDED_ABILITIES.has(ability.id) &&
    ability.targetType === 'enemy_character'
  ) {
    return {
      ...state,
      abilityModal: null,
      characterAttack: { playerId, row, col, abilityId, targetMode: 'enemy_chaos_2x2' },
      message: 'Chaos — click the enemy board to aim a 2×2 blast!',
    }
  }

  const targetMode = getTargetMode(ability)

  return {
    ...state,
    abilityModal: null,
    characterAttack: { playerId, row, col, abilityId, targetMode },
    message: targetHint(ability),
  }
}

function updateAttackerSlot(
  players: [PlayerState, PlayerState],
  playerId: 1 | 2,
  row: number,
  col: number,
  updater: (char: NonNullable<BoardSlot['character']>) => NonNullable<BoardSlot['character']>,
): [PlayerState, PlayerState] {
  const player = getPlayer(players, playerId)
  const idx = findSlotIndex(player, row, col)
  if (idx === -1 || !player.board[idx].character) return players
  const board = player.board.map((s, i) =>
    i === idx ? { ...s, character: updater(s.character!) } : s,
  )
  return updatePlayer(players, playerId, { ...player, board })
}

type BoardSlot = PlayerState['board'][number]

function applyAbilityCore(
  state: GameState,
  attackerId: 1 | 2,
  attackerRow: number,
  attackerCol: number,
  ability: AbilityDef,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
  options?: { skipCooldown?: boolean; cooldownAbility?: AbilityDef },
): { state: GameState; vfx: VfxEvent[]; message: string } {
  let players = state.players
  const attacker = getPlayer(players, attackerId)
  const vfxList: VfxEvent[] = []
  let message = ''
  const shardActive = hasBuff(attacker, 'shard')
  const gambleMult = getGambleMultiplier(attacker)
  let gambleApplied = false
  let hauntedApplied = false
  const attackerIdx = findSlotIndex(attacker, attackerRow, attackerCol)
  const attackerChar = attacker.board[attackerIdx]?.character
  const calcAbilityDmg = (base: number) =>
    calcOutgoingDamage(attacker, base, shardActive, attackerChar, gambleMult)

  const applyHauntedToEnemy = (tPid: 1 | 2, tRow: number, tCol: number) => {
    if (attackerId === tPid || !hasBuff(getPlayer(players, attackerId), 'haunted')) return
    players = applyHauntedToTarget(players, attackerId, tPid, tRow, tCol, vfxList)
    hauntedApplied = true
  }

  const applyHauntedToHits = (tPid: 1 | 2, hits: { row: number; col: number }[]) => {
    if (attackerId === tPid || !hasBuff(getPlayer(players, attackerId), 'haunted')) return
    for (const hit of hits) {
      players = applyHauntedToTarget(players, attackerId, tPid, hit.row, hit.col, vfxList)
    }
    hauntedApplied = true
  }

  const trackDamage = (amount: number) => {
    if (attackerId !== targetPlayerId && amount > 0) {
      state = trackObjectiveDamage(state, attackerId, amount)
    }
  }

  const trackKill = (count = 1) => {
    if (attackerId !== targetPlayerId && count > 0) {
      state = trackObjectiveKills(state, attackerId, count)
    }
  }

  const hauntRecoil = applyHauntRecoil(players, attackerId, attackerRow, attackerCol)
  players = hauntRecoil.players
  vfxList.push(...hauntRecoil.vfx)
  if (hauntRecoil.message) message = hauntRecoil.message
  if (hauntRecoil.recoilCredit) {
    state = trackObjectiveDamage(state, hauntRecoil.recoilCredit.playerId, hauntRecoil.recoilCredit.amount)
  }

  if (
    attackerId !== targetPlayerId &&
    SINGLE_TARGET_ENEMY_EFFECTS.has(ability.effect)
  ) {
    const defender = getPlayer(players, targetPlayerId)
    if (isTargetBlockedByCharacter(defender.board, targetRow, targetCol, attackerId, targetPlayerId)) {
      return { state: { ...state, message: BLOCKED_TARGET_MSG }, vfx: [], message: BLOCKED_TARGET_MSG }
    }
  }

  if (
    ability.effect === 'damage' ||
    ability.effect === 'sacrifice_nuke' ||
    ability.effect === 'damage_self_heal' ||
    ability.effect === 'stare' ||
    ability.effect === 'double_target_damage'
  ) {
    let dmg = calcAbilityDmg(ability.damage ?? 0)
    if (gambleMult !== 1 && attackerId !== targetPlayerId) gambleApplied = true
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    const tChar = target.board[tIdx]?.character
    if (!tChar) return { state: { ...state, message: 'Invalid target.' }, vfx: [], message: 'Invalid target.' }
    const targetName = getTemplate(tChar.card.templateId).name
    const updated = applyDamageToPlayerBoard(target, targetRow, targetCol, dmg)
    const hadKill = updated.killed != null
    players = updatePlayer(players, targetPlayerId, updated.player)
    players = applyBreadIfNeeded(players, hadKill, vfxList)
    players = maybeApplyThornMail(players, targetPlayerId, attackerId, vfxList, attackerRow, attackerCol)
    trackDamage(dmg)
    if (hadKill) trackKill()
    applyHauntedToEnemy(targetPlayerId, targetRow, targetCol)
    appendGambleStrikeVfx(vfxList, attackerId, targetPlayerId, [{ row: targetRow, col: targetCol, name: targetName }], gambleMult)
    message = `${ability.name} dealt ${dmg} to ${targetName}!`
    const vfxType = resolveDamageVfx(ability)
    vfxList.push(
      createVfx(vfxType, message, {
        playerId: attackerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: targetName }],
      }),
    )
    if (ability.effect === 'stare') {
      const target = getPlayer(players, targetPlayerId)
      const board = target.board.map((s, i) => {
        if (i !== tIdx || !s.character) return s
        return {
          ...s,
          character: {
            ...s.character,
            statuses: [
              ...s.character.statuses.filter((st) => st.type !== 'webbed' && st.type !== 'frozen'),
              { type: 'webbed' as const, turnsRemaining: silenceStatusTurns(ability.duration ?? 1) },
            ],
          },
        }
      })
      players = updatePlayer(players, targetPlayerId, { ...target, board })
      message = `Stare — ${dmg} damage! ${targetName} cannot act!`
    }
    if (ability.effect === 'damage_self_heal') {
      const healAmt = ability.heal ?? 5
      players = updateAttackerSlot(players, attackerId, attackerRow, attackerCol, (char) => ({
        ...char,
        currentHealth: Math.min(char.maxHealth, char.currentHealth + healAmt),
      }))
      message = `${ability.name} — ${dmg} to ${targetName}, healed ${healAmt} HP!`
    }
    if (hasBuff(attacker, 'double_trouble') && DOUBLE_TROUBLE_SINGLE_EFFECTS.has(ability.effect)) {
      appendDoubleTroubleHitVfx(vfxList, attackerId, targetPlayerId, targetRow, targetCol, targetName)
    }
    if (shardActive) {
      vfxList.push(
        createVfx('shard_strike', 'SHARD — 2× DAMAGE!', {
          playerId: attackerId,
          targetPlayerId,
          targets: [{ row: targetRow, col: targetCol, name: targetName }],
        }),
      )
      players = applyShardConsume(players, attackerId, true, vfxList)
    }
    if (ability.effect === 'sacrifice_nuke') {
      players = updatePlayer(players, attackerId, removeTemplateFromDeck(getPlayer(players, attackerId), 'char_banana'))
      const aIdx = findSlotIndex(getPlayer(players, attackerId), attackerRow, attackerCol)
      const aBoard = getPlayer(players, attackerId).board.map((s, i) =>
        i === aIdx ? { ...s, character: null } : s,
      )
      players = updatePlayer(players, attackerId, { ...getPlayer(players, attackerId), board: aBoard })
    }
  }

  if (ability.effect === 'lane_damage' || ability.effect === 'conditional_lane_damage') {
    const dmg = calcAbilityDmg(ability.damage ?? 0)
    if (gambleMult !== 1) gambleApplied = true
    const target = getPlayer(players, targetPlayerId)
    const laneResult = applyRowLaneDamage(target, targetRow, dmg)
    players = updatePlayer(players, targetPlayerId, laneResult.player)
    players = applyBreadIfNeeded(players, laneResult.hadKill, vfxList)
    for (let i = 0; i < laneResult.hits.length; i++) {
      players = maybeApplyThornMail(players, targetPlayerId, attackerId, vfxList, attackerRow, attackerCol)
    }
    trackDamage(dmg * laneResult.hits.length)
    if (laneResult.killCount > 0) trackKill(laneResult.killCount)
    applyHauntedToHits(targetPlayerId, laneResult.hits)
    appendGambleStrikeVfx(vfxList, attackerId, targetPlayerId, laneResult.hits, gambleMult)
    message = `${ability.name} swept row ${targetRow + 1} for ${dmg} each!`
    vfxList.push(
      createVfx(resolveLaneVfx(ability), message, {
        playerId: attackerId,
        targetPlayerId,
        laneRow: targetRow,
        targets: laneResult.hits,
      }),
    )
    if (shardActive) {
      for (const hit of laneResult.hits) {
        vfxList.push(
          createVfx('shard_strike', 'SHARD — 2× DAMAGE!', {
            playerId: attackerId,
            targetPlayerId,
            targets: [hit],
          }),
        )
      }
      players = applyShardConsume(players, attackerId, true, vfxList)
    }
  }

  if (ability.effect === 'heal_adjacent') {
    const player = getPlayer(players, attackerId)
    const healAmt = ability.heal ?? 20
    const adj = getAdjacentSlots(attackerRow, attackerCol)
    const healed: { row: number; col: number; name: string }[] = []
    const board = player.board.map((slot) => {
      const isAdj = adj.some((a) => a.row === slot.row && a.col === slot.col)
      if (!isAdj || !slot.character) return slot
      healed.push({ row: slot.row, col: slot.col, name: getTemplate(slot.character.card.templateId).name })
      return healSlotCharacter(slot, healAmt)
    })
    players = updatePlayer(players, attackerId, { ...player, board })
    message = healed.length
      ? `Healing Essence restored ${healAmt} HP to ${healed.length} ally${healed.length === 1 ? '' : 'ies'}!`
      : 'No adjacent allies to heal.'
    vfxList.push(
      createVfx(ability.vfx ?? 'healing_essence', message, {
        playerId: attackerId,
        targetPlayerId: attackerId,
        targets: healed.length ? healed : [{ row: attackerRow, col: attackerCol, name: 'Healing Tree' }],
      }),
    )
  }

  if (ability.effect === 'sacrifice_heal_ally') {
    const ally = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(ally, targetRow, targetCol)
    if (!ally.board[tIdx]?.character) return { state: { ...state, message: 'Invalid ally.' }, vfx: [], message: 'Invalid ally.' }
    const allyName = getTemplate(ally.board[tIdx].character!.card.templateId).name
    const board = ally.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: { ...s.character, currentHealth: s.character.maxHealth },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...ally, board })
    const aIdx = findSlotIndex(getPlayer(players, attackerId), attackerRow, attackerCol)
    const attackerPlayer = getPlayer(players, attackerId)
    const aBoard = attackerPlayer.board.map((s, i) => (i === aIdx ? { ...s, character: null } : s))
    players = updatePlayer(players, attackerId, { ...attackerPlayer, board: aBoard })
    message = `Sacrifice — ${allyName} fully healed!`
    vfxList.push(
      createVfx(ability.vfx ?? 'sacrifice_heal', message, {
        playerId: attackerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: allyName }],
      }),
    )
  }

  if (ability.effect === 'self_immunity') {
    const selfName = getTemplate(
      getPlayer(players, attackerId).board[findSlotIndex(getPlayer(players, attackerId), attackerRow, attackerCol)]!
        .character!.card.templateId,
    ).name
    players = updateAttackerSlot(players, attackerId, attackerRow, attackerCol, (char) => ({
      ...char,
      statuses: [
        ...char.statuses.filter((st) => st.type !== 'attack_immune'),
        { type: 'attack_immune' as const, turnsRemaining: 999, permanent: true },
      ],
    }))
    message = 'Immunity active — blocks the next attack card!'
    vfxList.push(
      createVfx(ability.vfx ?? 'immunity', message, {
        playerId: attackerId,
        targetPlayerId: attackerId,
        targets: [{ row: attackerRow, col: attackerCol, name: selfName }],
      }),
    )
  }

  if (ability.effect === 'aoe_plus_damage') {
    const dmg = calcAbilityDmg(ability.damage ?? 0)
    if (gambleMult !== 1) gambleApplied = true
    const target = getPlayer(players, targetPlayerId)
    const aoeSlots = getPlusAoESlots(targetRow, targetCol)
    const hits: { row: number; col: number; name: string }[] = []
    let eliminated = [...target.eliminated]
    let hadKill = false
    let killCount = 0
    const board = target.board.map((slot) => {
      const inAoE = aoeSlots.some((a) => a.row === slot.row && a.col === slot.col)
      if (!inAoE || !slot.character) return slot
      const name = getTemplate(slot.character.card.templateId).name
      const result = applyDamageToSlot(slot, dmg, eliminated)
      eliminated = result.eliminated
      if (result.killed) {
        hadKill = true
        killCount += 1
      }
      hits.push({ row: slot.row, col: slot.col, name })
      return result.slot
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board, eliminated })
    players = applyBreadIfNeeded(players, hadKill, vfxList)
    trackDamage(dmg * hits.length)
    if (killCount > 0) trackKill(killCount)
    applyHauntedToHits(targetPlayerId, hits)
    appendGambleStrikeVfx(vfxList, attackerId, targetPlayerId, hits.length ? hits : [{ row: targetRow, col: targetCol, name: 'Blast' }], gambleMult)
    message = `${ability.name} hit ${hits.length} target${hits.length === 1 ? '' : 's'} for ${dmg} each!`
    vfxList.push(
      createVfx(ability.vfx ?? 'turd_bomb', message, {
        playerId: attackerId,
        targetPlayerId,
        aoeCenter: { row: targetRow, col: targetCol },
        targets: hits.length ? hits : [{ row: targetRow, col: targetCol, name: 'Blast' }],
      }),
    )
    if (shardActive && hits.length) {
      for (const hit of hits) {
        vfxList.push(
          createVfx('shard_strike', 'SHARD — 2× DAMAGE!', {
            playerId: attackerId,
            targetPlayerId,
            targets: [hit],
          }),
        )
      }
      players = applyShardConsume(players, attackerId, true, vfxList)
    }
  }

  if (ability.effect === 'half_damage_debuff') {
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) return { state: { ...state, message: 'Invalid target.' }, vfx: [], message: 'Invalid target.' }
    const board = target.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'half_damage'),
            { type: 'half_damage' as const, turnsRemaining: 999, permanent: true },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    players = maybeApplyThornMail(players, targetPlayerId, attackerId, vfxList, attackerRow, attackerCol)
    const peelName = getTemplate(target.board[tIdx].character!.card.templateId).name
    message = `${peelName} now deals half damage!`
    vfxList.push(
      createVfx('banana_peel', message, {
        playerId: attackerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: peelName }],
      }),
    )
  }

  if (ability.effect === 'web') {
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) return { state: { ...state, message: 'Invalid target.' }, vfx: [], message: 'Invalid target.' }
    const board = target.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'webbed'),
            { type: 'webbed' as const, turnsRemaining: silenceStatusTurns(ability.duration ?? 1) },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    players = maybeApplyThornMail(players, targetPlayerId, attackerId, vfxList, attackerRow, attackerCol)
    const webName = getTemplate(target.board[tIdx].character!.card.templateId).name
    message = 'Webbed — cannot attack!'
    vfxList.push(
      createVfx('web', message, {
        playerId: attackerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: webName }],
      }),
    )
  }

  if (ability.effect === 'infect') {
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) return { state: { ...state, message: 'Invalid target.' }, vfx: [], message: 'Invalid target.' }
    const board = target.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'infect'),
            {
              type: 'infect' as const,
              turnsRemaining: ability.duration ?? 2,
              damagePerTurn: ability.dotDamage ?? 10,
              appliedBy: attackerId,
            },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    players = maybeApplyThornMail(players, targetPlayerId, attackerId, vfxList, attackerRow, attackerCol)
    const infectName = getTemplate(target.board[tIdx].character!.card.templateId).name
    message = 'Infected!'
    vfxList.push(
      createVfx('infect', message, {
        playerId: attackerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: infectName }],
      }),
    )
  }

  if (ability.effect === 'haunt_debuff') {
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) return { state: { ...state, message: 'Invalid target.' }, vfx: [], message: 'Invalid target.' }
    const board = target.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'haunt'),
            {
              type: 'haunt' as const,
              turnsRemaining: ability.duration ?? 2,
              damagePerTurn: ability.dotDamage ?? 10,
              appliedBy: attackerId,
            },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    players = maybeApplyThornMail(players, targetPlayerId, attackerId, vfxList, attackerRow, attackerCol)
    const hauntName = getTemplate(target.board[tIdx].character!.card.templateId).name
    message = `${hauntName} is haunted!`
    vfxList.push(
      createVfx(ability.vfx ?? 'haunt', message, {
        playerId: attackerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: hauntName }],
      }),
    )
  }

  // Mark cooldown / one-time on attacker
  if (!options?.skipCooldown) {
    const cdSource = options?.cooldownAbility ?? ability
    players = updateAttackerSlot(players, attackerId, attackerRow, attackerCol, (char) => {
      let updated = char
      if (cdSource.cooldown > 0) {
        updated = setAbilityCooldown(updated, cdSource.id, cdSource.cooldown, attacker.cooldownReduction)
      }
      if (cdSource.oneTime) {
        updated = { ...updated, usedOneTime: [...updated.usedOneTime, cdSource.id] }
      }
      if (cdSource.id === 'katana_strike') {
        updated = {
          ...updated,
          abilityUseCounts: {
            ...updated.abilityUseCounts,
            katana_strike: (updated.abilityUseCounts.katana_strike ?? 0) + 1,
          },
        }
      }
      return updated
    })
  }

  if (gambleApplied) {
    players = applyGambleConsume(players, attackerId, vfxList)
  }
  if (hauntedApplied) {
    players = updatePlayer(
      players,
      attackerId,
      consumePendingBuff(getPlayer(players, attackerId), 'haunted'),
    )
  }

  return {
    state: { ...state, players: mergePlayerObjectiveProgress(state, players), message },
    vfx: vfxList,
    message,
  }
}

function applyAbilityEffect(
  state: GameState,
  attackerId: 1 | 2,
  attackerRow: number,
  attackerCol: number,
  ability: AbilityDef,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
): GameState {
  const { state: newState, vfx, message } = applyAbilityCore(
    state,
    attackerId,
    attackerRow,
    attackerCol,
    ability,
    targetPlayerId,
    targetRow,
    targetCol,
  )
  const completed = completeAction({ ...newState, message }, attackerId, vfx)
  return applyObjectiveEvent(completed, attackerId, 'abilities_used', 1)
}

function applyChaosAbilityEffect(
  state: GameState,
  attackerId: 1 | 2,
  attackerRow: number,
  attackerCol: number,
  ability: AbilityDef,
  targetPlayerId: 1 | 2,
  clickRow: number,
): GameState {
  const aoeSlots = get2x2AoESlots(clickRow)
  let players = state.players
  const attacker = getPlayer(players, attackerId)
  const vfxList: VfxEvent[] = []
  let message = ''
  let hadKill = false
  let killCount = 0
  const hits: { row: number; col: number; name: string }[] = []

  const shardActive = hasBuff(attacker, 'shard')
  const aIdx = findSlotIndex(attacker, attackerRow, attackerCol)
  const attackerChar = attacker.board[aIdx]?.character
  const baseDmg = ability.damage ?? 0
  const gambleMult = getGambleMultiplier(attacker)
  let gambleApplied = false
  let gameState = state

  let target = getPlayer(players, targetPlayerId)
  const slotSet = new Set(aoeSlots.map((s) => `${s.row}-${s.col}`))

  if (
    ability.effect === 'damage' ||
    ability.effect === 'stare' ||
    ability.effect === 'double_target_damage'
  ) {
    let dmg = calcOutgoingDamage(attacker, baseDmg, shardActive, attackerChar, gambleMult)
    if (gambleMult !== 1) gambleApplied = true
    let eliminated = [...target.eliminated]
    const board = target.board.map((slot) => {
      if (!slotSet.has(`${slot.row}-${slot.col}`) || !slot.character) return slot
      const name = getTemplate(slot.character.card.templateId).name
      const result = applyDamageToSlot(slot, dmg, eliminated)
      eliminated = result.eliminated
      if (result.killed) {
        hadKill = true
        killCount += 1
      }
      hits.push({ row: slot.row, col: slot.col, name })
      return result.slot
    })
    target = { ...target, board, eliminated }
    players = updatePlayer(players, targetPlayerId, target)

    if (ability.effect === 'stare') {
      const tBoard = target.board.map((s) => {
        if (!slotSet.has(`${s.row}-${s.col}`) || !s.character) return s
        return {
          ...s,
          character: {
            ...s.character,
            statuses: [
              ...s.character.statuses.filter((st) => st.type !== 'webbed' && st.type !== 'frozen'),
              { type: 'webbed' as const, turnsRemaining: silenceStatusTurns(ability.duration ?? 1) },
            ],
          },
        }
      })
      players = updatePlayer(players, targetPlayerId, { ...target, board: tBoard })
    }

    message = `Chaos ${ability.name} — ${hits.length} hit for ${dmg} each!`
    if (hits.length > 0) {
      gameState = trackObjectiveDamage(gameState, attackerId, dmg * hits.length)
      if (hadKill) gameState = trackObjectiveKills(gameState, attackerId, killCount)
    }
    appendGambleStrikeVfx(vfxList, attackerId, targetPlayerId, hits, gambleMult)
    if (hasBuff(getPlayer(players, attackerId), 'haunted')) {
      for (const hit of hits) {
        players = applyHauntedToTarget(players, attackerId, targetPlayerId, hit.row, hit.col, vfxList)
      }
    }
    vfxList.push(
      createVfx('chaos', message, {
        playerId: attackerId,
        targetPlayerId,
        aoeCenter: { row: aoeSlots[0]?.row ?? clickRow, col: 0 },
        targets: hits.length ? hits : [{ row: clickRow, col: 0, name: 'Blast' }],
      }),
    )
  } else if (ability.effect === 'web' || ability.effect === 'infect' || ability.effect === 'haunt_debuff') {
    const board = target.board.map((s) => {
      if (!slotSet.has(`${s.row}-${s.col}`) || !s.character) return s
      const name = getTemplate(s.character.card.templateId).name
      hits.push({ row: s.row, col: s.col, name })
      if (ability.effect === 'web') {
        return {
          ...s,
          character: {
            ...s.character,
            statuses: [
              ...s.character.statuses.filter((st) => st.type !== 'webbed'),
              { type: 'webbed' as const, turnsRemaining: silenceStatusTurns(ability.duration ?? 2) },
            ],
          },
        }
      }
      if (ability.effect === 'infect') {
        return {
          ...s,
          character: {
            ...s.character,
            statuses: [
              ...s.character.statuses.filter((st) => st.type !== 'infect'),
              {
                type: 'infect' as const,
                turnsRemaining: ability.duration ?? 3,
                damagePerTurn: ability.dotDamage ?? 10,
                appliedBy: attackerId,
              },
            ],
          },
        }
      }
      return {
        ...s,
        character: applyHauntStatus(s.character, ability.duration ?? 2, ability.dotDamage ?? 10, attackerId),
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    message = `Chaos ${ability.name} — hit ${hits.length} in the blast!`
    vfxList.push(
      createVfx('chaos', message, {
        playerId: attackerId,
        targetPlayerId,
        aoeCenter: { row: aoeSlots[0]?.row ?? clickRow, col: 0 },
        targets: hits,
      }),
    )
  } else if (ability.effect === 'half_damage_debuff') {
    const board = target.board.map((s) => {
      if (!slotSet.has(`${s.row}-${s.col}`) || !s.character) return s
      hits.push({ row: s.row, col: s.col, name: getTemplate(s.character.card.templateId).name })
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'half_damage'),
            { type: 'half_damage' as const, turnsRemaining: ability.duration ?? 2 },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    message = `Chaos ${ability.name} — weakened ${hits.length} enemies!`
    vfxList.push(createVfx('chaos', message, { playerId: attackerId, targetPlayerId, targets: hits }))
  } else {
    return { ...state, message: 'Chaos cannot amplify that ability.' }
  }

  players = applyBreadIfNeeded(players, hadKill, vfxList)
  players = updatePlayer(players, attackerId, consumePendingBuff(getPlayer(players, attackerId), 'chaos'))

  if (shardActive && hits.length) {
    players = applyShardConsume(players, attackerId, true, vfxList)
  }
  if (gambleApplied) {
    players = applyGambleConsume(players, attackerId, vfxList)
  }
  if (hasBuff(getPlayer(players, attackerId), 'haunted') && hits.length > 0) {
    players = updatePlayer(
      players,
      attackerId,
      consumePendingBuff(getPlayer(players, attackerId), 'haunted'),
    )
  }

  const cdSource = ability
  players = updateAttackerSlot(players, attackerId, attackerRow, attackerCol, (char) => {
    let updated = char
    if (cdSource.cooldown > 0) {
      updated = setAbilityCooldown(updated, cdSource.id, cdSource.cooldown, attacker.cooldownReduction)
    }
    if (cdSource.oneTime) {
      updated = { ...updated, usedOneTime: [...updated.usedOneTime, cdSource.id] }
    }
    return updated
  })

  let finalState: GameState = {
    ...gameState,
    players: mergePlayerObjectiveProgress(gameState, players),
    message,
  }
  finalState = applyObjectiveEvent(finalState, attackerId, 'abilities_used', 1)
  return completeAction(appendVfx(finalState, ...vfxList), attackerId)
}

function countEnemyCharacters(
  player: PlayerState,
  exclude?: { row: number; col: number },
): number {
  return player.board.filter((s) => {
    if (!s.character) return false
    if (exclude && s.row === exclude.row && s.col === exclude.col) return false
    return true
  }).length
}

const DOUBLE_TROUBLE_SINGLE_EFFECTS = new Set<AbilityDef['effect']>([
  'damage',
  'sacrifice_nuke',
  'web',
  'infect',
  'half_damage_debuff',
])

const DOUBLE_TROUBLE_ATTACK_EFFECTS = new Set<CardTemplate['effect']>([
  'freeze_damage',
  'burn',
  'obscure',
])

function abilitySupportsDoubleTrouble(ability: AbilityDef): boolean {
  return (
    DOUBLE_TROUBLE_SINGLE_EFFECTS.has(ability.effect) ||
    ability.effect === 'lane_damage' ||
    ability.effect === 'conditional_lane_damage'
  )
}

function attackCardSupportsDoubleTrouble(template: CardTemplate): boolean {
  return template.type === 'attack' && !!template.effect && DOUBLE_TROUBLE_ATTACK_EFFECTS.has(template.effect)
}

function countEnemyRowsWithCharacters(
  player: PlayerState,
  excludeRow?: number,
): number {
  const rows = new Set<number>()
  for (const slot of player.board) {
    if (slot.character && slot.row !== excludeRow) rows.add(slot.row)
  }
  return rows.size
}

function countOtherEnemySlots(
  player: PlayerState,
  exclude: { row: number; col: number },
): number {
  return player.board.filter((s) => s.row !== exclude.row || s.col !== exclude.col).length
}

function appendDoubleTroubleHitVfx(
  vfxList: VfxEvent[],
  attackerId: 1 | 2,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
  targetName: string,
) {
  vfxList.push(
    createVfx('double_trouble', 'DOUBLE STRIKE!', {
      playerId: attackerId,
      targetPlayerId,
      targets: [{ row: targetRow, col: targetCol, name: targetName }],
    }),
  )
}

function finalizeCharacterAbility(
  state: GameState,
  playerId: 1 | 2,
  row: number,
  col: number,
  ability: AbilityDef,
  players: [PlayerState, PlayerState],
  vfx: VfxEvent[],
  message: string,
): GameState {
  const cdSource = ability
  let updated = updateAttackerSlot(players, playerId, row, col, (char) =>
    setAbilityCooldown(char, cdSource.id, cdSource.cooldown, getPlayer(players, playerId).cooldownReduction),
  )
  updated = updatePlayer(updated, playerId, consumeDoubleTrouble(getPlayer(updated, playerId)))
  const completed = completeAction({ ...state, players: updated, message }, playerId, vfx)
  return applyObjectiveEvent(completed, playerId, 'abilities_used', 1)
}

function finalizeHandAttack(
  state: GameState,
  playerId: 1 | 2,
  card: CardInstance,
  players: [PlayerState, PlayerState],
  vfx: VfxEvent[],
  message: string,
): GameState {
  let updated = updatePlayer(players, playerId, consumeDoubleTrouble(getPlayer(players, playerId)))
  updated = updatePlayer(updated, playerId, removeFromHand(getPlayer(updated, playerId), card))
  return completeAction({ ...state, players: updated, handAttack: null, message }, playerId, vfx)
}

export function useCharacterAbilityOnTarget(
  state: GameState,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
  controllingPlayer: 1 | 2,
): GameState {
  if (!state.characterAttack?.abilityId) return state

  const { playerId, row, col, abilityId, targetMode, firstTarget, awaitingDoubleSecond } =
    state.characterAttack
  if (playerId !== controllingPlayer) return state
  if (!canTakeTurnAction(state, playerId)) {
    return { ...state, message: 'You already used your action this turn.' }
  }

  const attacker = getPlayer(state.players, playerId)
  const attackerSlot = attacker.board[findSlotIndex(attacker, row, col)]
  if (!attackerSlot?.character) return state

  const originalAbility = getAbility(attackerSlot.character.card.templateId, abilityId)
  if (!originalAbility) return state

  const ability = originalAbility

  if (targetMode === 'ally_character') {
    if (targetPlayerId !== playerId) {
      return { ...state, message: 'Select one of your characters.' }
    }
    const ally = getPlayer(state.players, playerId)
    const tIdx = findSlotIndex(ally, targetRow, targetCol)
    if (tIdx === -1 || !ally.board[tIdx]?.character) {
      return { ...state, message: 'Select one of your characters.' }
    }
    return applyAbilityEffect(state, playerId, row, col, ability, playerId, targetRow, targetCol)
  }

  if (targetMode === 'enemy_aoe') {
    if (targetPlayerId === playerId) {
      return { ...state, message: 'Click the enemy board to aim the blast (+ shape).' }
    }
    return applyAbilityEffect(state, playerId, row, col, ability, targetPlayerId, targetRow, targetCol)
  }

  if (targetMode === 'enemy_chaos_2x2') {
    if (targetPlayerId === playerId) {
      return { ...state, message: 'Click the enemy board to aim the Chaos blast (2×2).' }
    }
    return applyChaosAbilityEffect(state, playerId, row, col, ability, targetPlayerId, targetRow)
  }

  if (targetMode === 'double_hit_second' && awaitingDoubleSecond && firstTarget) {
    if (
      firstTarget.playerId === targetPlayerId &&
      firstTarget.row === targetRow &&
      firstTarget.col === targetCol
    ) {
      return { ...state, message: 'Pick a different second enemy.' }
    }
    const blocked = rejectIfBlocked(state, playerId, targetPlayerId, targetRow, targetCol)
    if (blocked) return blocked
    const target = getPlayer(state.players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (tIdx === -1 || !target.board[tIdx]?.character) {
      return { ...state, message: 'Select an enemy character.' }
    }
    const hit2 = applyAbilityCore(
      state,
      playerId,
      row,
      col,
      ability,
      targetPlayerId,
      targetRow,
      targetCol,
    )
    return finalizeCharacterAbility(
      hit2.state,
      playerId,
      row,
      col,
      ability,
      hit2.state.players,
      hit2.vfx,
      'Double Hit — both enemies struck!',
    )
  }

  if (targetMode === 'enemy_lane' || targetMode === 'enemy_lane_second') {
    if (targetPlayerId === playerId) {
      return { ...state, message: 'Click a row on the enemy board (horizontal lane).' }
    }

    if (awaitingDoubleSecond && firstTarget && targetMode === 'enemy_lane_second') {
      if (firstTarget.row === targetRow) {
        return { ...state, message: 'Pick a different row for the second lane strike.' }
      }
      const hit2 = applyAbilityCore(
        state,
        playerId,
        row,
        col,
        ability,
        targetPlayerId,
        targetRow,
        targetCol,
        { skipCooldown: true },
      )
      const vfx = [
        ...hit2.vfx,
        createVfx('double_trouble_ready', 'DOUBLE TROUBLE — two lanes struck!', { playerId }),
      ]
      return finalizeCharacterAbility(
        hit2.state,
        playerId,
        row,
        col,
        ability,
        hit2.state.players,
        vfx,
        'Double Trouble — both lane hits landed!',
      )
    }

    const doubleActiveLane = hasBuff(attacker, 'double_trouble')
    if (
      doubleActiveLane &&
      (ability.effect === 'lane_damage' || ability.effect === 'conditional_lane_damage') &&
      targetMode === 'enemy_lane'
    ) {
      const hit1 = applyAbilityCore(
        state,
        playerId,
        row,
        col,
        ability,
        targetPlayerId,
        targetRow,
        targetCol,
        { skipCooldown: true },
      )
      const enemyBoard = getPlayer(hit1.state.players, targetPlayerId)
      const otherRows = countEnemyRowsWithCharacters(enemyBoard, targetRow)

      if (otherRows === 0) {
        const vfx = [
          ...hit1.vfx,
          createVfx('double_trouble_ready', 'DOUBLE TROUBLE — only one lane!', { playerId }),
        ]
        return finalizeCharacterAbility(
          hit1.state,
          playerId,
          row,
          col,
          ability,
          hit1.state.players,
          vfx,
          'Double Trouble — hit the only enemy lane!',
        )
      }

      return appendVfx(
        {
          ...hit1.state,
          characterAttack: {
            playerId,
            row,
            col,
            abilityId,
            targetMode: 'enemy_lane_second',
            awaitingDoubleSecond: true,
            firstTarget: { playerId: targetPlayerId, row: targetRow, col: targetCol },
          },
          message: 'Double Trouble — first lane hit! Pick a second row.',
        },
        ...hit1.vfx,
      )
    }

    return applyAbilityEffect(state, playerId, row, col, ability, targetPlayerId, targetRow, targetCol)
  }

  if (targetPlayerId === playerId) {
    return { ...state, message: 'Select an enemy character.' }
  }

  const target = getPlayer(state.players, targetPlayerId)
  const tIdx = findSlotIndex(target, targetRow, targetCol)
  if (tIdx === -1 || !target.board[tIdx]?.character) {
    return { ...state, message: 'Select an enemy character.' }
  }

  const blocked = rejectIfBlocked(state, playerId, targetPlayerId, targetRow, targetCol)
  if (blocked) return blocked

  if (ability.effect === 'double_target_damage' && targetMode === 'enemy_character' && !awaitingDoubleSecond) {
    const hit1 = applyAbilityCore(
      state,
      playerId,
      row,
      col,
      ability,
      targetPlayerId,
      targetRow,
      targetCol,
      { skipCooldown: true },
    )
    const enemyBoard = getPlayer(hit1.state.players, targetPlayerId)
    const otherEnemies = countEnemyCharacters(enemyBoard, { row: targetRow, col: targetCol })

    if (otherEnemies === 0) {
      return finalizeCharacterAbility(
        hit1.state,
        playerId,
        row,
        col,
        ability,
        hit1.state.players,
        hit1.vfx,
        'Double Hit — only one enemy on board!',
      )
    }

    return appendVfx(
      {
        ...hit1.state,
        characterAttack: {
          playerId,
          row,
          col,
          abilityId,
          targetMode: 'double_hit_second',
          awaitingDoubleSecond: true,
          firstTarget: { playerId: targetPlayerId, row: targetRow, col: targetCol },
        },
        message: 'Double Hit — pick a second enemy.',
      },
      ...hit1.vfx,
    )
  }

  // Second hit of Double Trouble
  if (awaitingDoubleSecond && firstTarget && targetMode === 'enemy_character_second') {
    if (
      firstTarget.playerId === targetPlayerId &&
      firstTarget.row === targetRow &&
      firstTarget.col === targetCol
    ) {
      return { ...state, message: 'Pick a different second enemy.' }
    }
    const blockedSecond = rejectIfBlocked(state, playerId, targetPlayerId, targetRow, targetCol)
    if (blockedSecond) return blockedSecond
    const hit2 = applyAbilityCore(
      state,
      playerId,
      row,
      col,
      ability,
      targetPlayerId,
      targetRow,
      targetCol,
      { skipCooldown: true },
    )
    const vfx = [
      ...hit2.vfx,
      createVfx('double_trouble_ready', 'DOUBLE TROUBLE — two enemies struck!', { playerId }),
    ]
    return finalizeCharacterAbility(
      hit2.state,
      playerId,
      row,
      col,
      ability,
      hit2.state.players,
      vfx,
      'Double Trouble — both hits landed!',
    )
  }

  const doubleActive = hasBuff(attacker, 'double_trouble')

  // First hit with Double Trouble — resolve immediately, then pick second target
  if (doubleActive && abilitySupportsDoubleTrouble(ability) && DOUBLE_TROUBLE_SINGLE_EFFECTS.has(ability.effect)) {
    const hit1 = applyAbilityCore(
      state,
      playerId,
      row,
      col,
      ability,
      targetPlayerId,
      targetRow,
      targetCol,
      { skipCooldown: true },
    )

    const enemyBoard = getPlayer(hit1.state.players, targetPlayerId)
    const otherEnemies = countEnemyCharacters(enemyBoard, { row: targetRow, col: targetCol })

    if (otherEnemies === 0) {
      const vfx = [
        ...hit1.vfx,
        createVfx('double_trouble_ready', 'DOUBLE TROUBLE — only one target!', { playerId }),
      ]
      return finalizeCharacterAbility(
        hit1.state,
        playerId,
        row,
        col,
        ability,
        hit1.state.players,
        vfx,
        'Double Trouble — hit the only enemy!',
      )
    }

    return appendVfx(
      {
        ...hit1.state,
        characterAttack: {
          playerId,
          row,
          col,
          abilityId,
          targetMode: 'enemy_character_second',
          awaitingDoubleSecond: true,
          firstTarget: { playerId: targetPlayerId, row: targetRow, col: targetCol },
        },
        message: 'Double Trouble — first hit! Pick a second enemy.',
      },
      ...hit1.vfx,
    )
  }

  return applyAbilityEffect(state, playerId, row, col, ability, targetPlayerId, targetRow, targetCol)
}

const ELEMENTAL_IMMUNE_EFFECTS = new Set<CardTemplate['effect']>([
  'burn',
  'freeze_damage',
  'tornado_move',
  'obscure',
  'column_sweep',
])

const CHAOS_EXCLUDED_ABILITIES = new Set(['soul_slice', 'boulder_roll', 'turd_bomb', 'redliner_shot'])

const HAUNT_PASSIVE_DURATION = 2
const HAUNT_PASSIVE_DOT = 10

function applyBreadIfNeeded(
  players: [PlayerState, PlayerState],
  hadKill: boolean,
  vfxList: VfxEvent[],
): [PlayerState, PlayerState] {
  if (!hadKill) return players
  const bread = triggerBreadOnElimination(players, updatePlayer)
  vfxList.push(...bread.vfx)
  return bread.players
}

function tryBlockElementalImmunity(
  players: [PlayerState, PlayerState],
  targetPlayerId: 1 | 2,
  effect: CardTemplate['effect'] | undefined,
  attackerId: 1 | 2,
  vfxList: VfxEvent[],
): { players: [PlayerState, PlayerState]; blocked: boolean } {
  if (!effect || !ELEMENTAL_IMMUNE_EFFECTS.has(effect)) {
    return { players, blocked: false }
  }
  const defender = getPlayer(players, targetPlayerId)
  if (!hasBuff(defender, 'elemental_immunity')) {
    return { players, blocked: false }
  }
  vfxList.push(
    createVfx('elemental_immunity', 'Elemental Immunity blocked the attack!', {
      playerId: attackerId,
      targetPlayerId,
    }),
  )
  return { players, blocked: true }
}

function getMoonlightBonus(player: PlayerState, effect: CardTemplate['effect'] | undefined): number {
  if (effect === 'burn') return 0
  return hasBuff(player, 'moonlight') ? 5 : 0
}

function applyHauntedToTarget(
  players: [PlayerState, PlayerState],
  attackerId: 1 | 2,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
  vfxList: VfxEvent[],
): [PlayerState, PlayerState] {
  const attacker = getPlayer(players, attackerId)
  if (!hasBuff(attacker, 'haunted')) return players

  const target = getPlayer(players, targetPlayerId)
  const tIdx = findSlotIndex(target, targetRow, targetCol)
  const slot = target.board[tIdx]
  if (!slot?.character) return players

  const name = getTemplate(slot.character.card.templateId).name
  const board = target.board.map((s, i) =>
    i === tIdx && s.character
      ? { ...s, character: applyHauntStatus(s.character, HAUNT_PASSIVE_DURATION, HAUNT_PASSIVE_DOT, attackerId) }
      : s,
  )
  vfxList.push(
    createVfx('haunt', `Haunted — ${name} is haunted!`, {
      playerId: attackerId,
      targetPlayerId,
      targets: [{ row: targetRow, col: targetCol, name }],
    }),
  )
  return updatePlayer(players, targetPlayerId, { ...target, board })
}

function hasMirrorInHand(player: PlayerState): boolean {
  return player.hand.some((c) => c.templateId === 'spc_mirror')
}

function hasSpellBookInHand(player: PlayerState): boolean {
  return player.hand.some((c) => c.templateId === 'atk_spell_book')
}

function hasChainLockedInHand(player: PlayerState): boolean {
  return player.hand.some((c) => c.templateId === 'atk_chain_locked')
}

function hasAnyCounterInHand(player: PlayerState): boolean {
  return hasMirrorInHand(player) || hasSpellBookInHand(player) || hasChainLockedInHand(player)
}

function hasCounterForPlayedKind(
  player: PlayerState,
  playedKind: 'attack' | 'special',
): boolean {
  if (playedKind === 'attack') return hasAnyCounterInHand(player)
  return hasChainLockedInHand(player)
}

function findMirrorCard(player: PlayerState): CardInstance | null {
  return player.hand.find((c) => c.templateId === 'spc_mirror') ?? null
}

function findSpellBookCard(player: PlayerState): CardInstance | null {
  return player.hand.find((c) => c.templateId === 'atk_spell_book') ?? null
}

function findChainLockedCard(player: PlayerState): CardInstance | null {
  return player.hand.find((c) => c.templateId === 'atk_chain_locked') ?? null
}

const REACTIVE_EFFECTS = new Set<CardTemplate['effect']>([
  'mirror_reactive',
  'spell_book_reactive',
  'chain_locked_reactive',
])

const COUNTERABLE_ATTACKS = new Set<CardTemplate['effect']>([
  'freeze_damage',
  'burn',
  'obscure',
  'explosive_aoe',
  'column_sweep',
])

function isCardLocked(state: GameState, templateId: string): boolean {
  return state.lockedCards.some((l) => l.templateId === templateId && l.turnsRemaining > 0)
}

function addCardLock(state: GameState, templateId: string, turns: number): GameState {
  const filtered = state.lockedCards.filter((l) => l.templateId !== templateId)
  return {
    ...state,
    lockedCards: [...filtered, { templateId, turnsRemaining: turns }],
  }
}

function tryOpenCounterPrompt(
  state: GameState,
  attackerId: 1 | 2,
  playedCard: CardInstance,
  playedKind: 'attack' | 'special',
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
): GameState | null {
  if (state.phase !== 'playing') return null

  const template = getTemplate(playedCard.templateId)
  if (template.effect && REACTIVE_EFFECTS.has(template.effect)) return null

  const defenderId = playedKind === 'attack' ? targetPlayerId : (attackerId === 1 ? 2 : 1)
  const defender = getPlayer(state.players, defenderId)
  if (!hasCounterForPlayedKind(defender, playedKind)) return null

  return {
    ...state,
    selectedCard: null,
    counterPrompt: {
      defenderId,
      attackerId,
      playedCard,
      playedKind,
      targetPlayerId,
      targetRow,
      targetCol,
      deadlineMs: Date.now() + 5000,
    },
    message: `Player ${defenderId} — counter available! Respond within 5 seconds.`,
  }
}

function applyShardConsume(
  players: [PlayerState, PlayerState],
  playerId: 1 | 2,
  hadShard: boolean,
  vfxList: VfxEvent[],
): [PlayerState, PlayerState] {
  if (!hadShard) return players
  const p = getPlayer(players, playerId)
  const updated = consumeShard(p)
  vfxList.push(createVfx('shard_consume', 'SHARD consumed — 2× damage used!', { playerId }))
  return updatePlayer(players, playerId, updated)
}

function tryBlockAttackImmunity(
  players: [PlayerState, PlayerState],
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
  attackerId: 1 | 2,
  vfxList: VfxEvent[],
): { players: [PlayerState, PlayerState]; blocked: boolean; targetName: string } {
  const target = getPlayer(players, targetPlayerId)
  const tIdx = findSlotIndex(target, targetRow, targetCol)
  const slot = target.board[tIdx]
  if (!slot?.character) return { players, blocked: false, targetName: '' }
  const targetName = getTemplate(slot.character.card.templateId).name
  if (!hasAttackImmunity(slot.character)) {
    return { players, blocked: false, targetName }
  }
  const board = target.board.map((s, i) =>
    i === tIdx ? { ...s, character: consumeAttackImmunity(s.character!) } : s,
  )
  vfxList.push(
    createVfx('immunity', `${targetName} is immune — attack blocked!`, {
      playerId: attackerId,
      targetPlayerId,
      targets: [{ row: targetRow, col: targetCol, name: targetName }],
    }),
  )
  return {
    players: updatePlayer(players, targetPlayerId, { ...target, board }),
    blocked: true,
    targetName,
  }
}

function executeAttackCard(
  state: GameState,
  playerId: 1 | 2,
  card: CardInstance,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
  options?: { removeFromHand?: boolean; doubleTroubleActive?: boolean },
): { state: GameState; vfx: VfxEvent[]; message: string } {
  const shouldRemoveFromHand = options?.removeFromHand ?? true
  const doubleTroubleActive = options?.doubleTroubleActive ?? hasBuff(getPlayer(state.players, playerId), 'double_trouble')
  const template = getTemplate(card.templateId)
  const player = getPlayer(state.players, playerId)
  const vfxList: VfxEvent[] = []
  let players = state.players
  let message = ''
  const shardActive = hasBuff(player, 'shard')
  const moonBonus = getMoonlightBonus(player, template.effect)
  const gambleMult = getGambleMultiplier(player)
  let gambleApplied = false
  let objectiveDamage = 0
  let objectiveKills = 0

  if (template.type === 'attack' && template.effect) {
    const elem = tryBlockElementalImmunity(players, targetPlayerId, template.effect, playerId, vfxList)
    players = elem.players
    if (elem.blocked) {
      message = 'Elemental Immunity blocked the attack!'
      if (shouldRemoveFromHand) {
        players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
      }
      return { state: { ...state, players, message }, vfx: vfxList, message }
    }
  }

  if (
    (template.effect === 'freeze_damage' || template.effect === 'burn') &&
    isTargetBlockedByCharacter(
      getPlayer(players, targetPlayerId).board,
      targetRow,
      targetCol,
      playerId,
      targetPlayerId,
    )
  ) {
    return { state: { ...state, message: BLOCKED_TARGET_MSG }, vfx: [], message: BLOCKED_TARGET_MSG }
  }

  if (template.effect === 'freeze_damage') {
    const immune = tryBlockAttackImmunity(players, targetPlayerId, targetRow, targetCol, playerId, vfxList)
    players = immune.players
    if (immune.blocked) {
      message = `${immune.targetName} is immune — Ice Surge blocked!`
      if (shouldRemoveFromHand) {
        players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
      }
      return { state: { ...state, players, message }, vfx: vfxList, message }
    }
    let dmg = calcAttackDamage(getPlayer(players, playerId), (template.damage ?? 0) + moonBonus, shardActive)
    if (gambleMult !== 1) gambleApplied = true
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) {
      return { state: { ...state, message: 'Invalid target.' }, vfx: [], message: 'Invalid target.' }
    }
    const targetName = getTemplate(target.board[tIdx].character!.card.templateId).name
    const damageResult = applyDamageToPlayerBoard(target, targetRow, targetCol, dmg)
    const board = damageResult.player.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'frozen'),
            { type: 'frozen' as const, turnsRemaining: silenceStatusTurns(template.duration ?? 1) },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...damageResult.player, board })
    players = applyBreadIfNeeded(players, damageResult.killed != null, vfxList)
    players = maybeApplyThornMail(players, targetPlayerId, playerId, vfxList)
    if (hasBuff(getPlayer(players, playerId), 'haunted')) {
      players = applyHauntedToTarget(players, playerId, targetPlayerId, targetRow, targetCol, vfxList)
    }
    message = `Ice Surge — ${dmg} damage and frozen!`
    vfxList.push(
      createVfx('freeze', message, {
        playerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: targetName }],
      }),
    )
    if (shardActive) {
      vfxList.push(
        createVfx('shard_strike', 'SHARD — 2× DAMAGE!', {
          playerId,
          targetPlayerId,
          targets: [{ row: targetRow, col: targetCol, name: targetName }],
        }),
      )
    }
    if (doubleTroubleActive) {
      appendDoubleTroubleHitVfx(vfxList, playerId, targetPlayerId, targetRow, targetCol, targetName)
    }
    appendGambleStrikeVfx(vfxList, playerId, targetPlayerId, [{ row: targetRow, col: targetCol, name: targetName }], gambleMult)
    objectiveDamage += dmg
    if (damageResult.killed != null) objectiveKills += 1
  } else if (template.effect === 'burn') {
    const immune = tryBlockAttackImmunity(players, targetPlayerId, targetRow, targetCol, playerId, vfxList)
    players = immune.players
    if (immune.blocked) {
      message = `${immune.targetName} is immune — Pepper blocked!`
      if (shouldRemoveFromHand) {
        players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
      }
      return { state: { ...state, players, message }, vfx: vfxList, message }
    }
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) {
      return { state: { ...state, message: 'Invalid target.' }, vfx: [], message: 'Invalid target.' }
    }
    const targetName = getTemplate(target.board[tIdx].character!.card.templateId).name
    const burnDot = calcAttackDamage(getPlayer(players, playerId), template.dotDamage ?? 15, shardActive)
    if (gambleMult !== 1) gambleApplied = true
    const board = target.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'burn'),
            {
              type: 'burn' as const,
              turnsRemaining: template.duration ?? 3,
              damagePerTurn: burnDot,
              appliedBy: playerId,
            },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    players = maybeApplyThornMail(players, targetPlayerId, playerId, vfxList)
    if (hasBuff(getPlayer(players, playerId), 'haunted')) {
      players = applyHauntedToTarget(players, playerId, targetPlayerId, targetRow, targetCol, vfxList)
    }
    message = `Pepper — burning for ${burnDot} damage each round!`
    vfxList.push(
      createVfx('burn', message, {
        playerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: targetName }],
      }),
    )
    if (shardActive) {
      vfxList.push(
        createVfx('shard_strike', 'SHARD — 2× DAMAGE!', {
          playerId,
          targetPlayerId,
          targets: [{ row: targetRow, col: targetCol, name: targetName }],
        }),
      )
    }
    if (doubleTroubleActive) {
      appendDoubleTroubleHitVfx(vfxList, playerId, targetPlayerId, targetRow, targetCol, targetName)
    }
    appendGambleStrikeVfx(vfxList, playerId, targetPlayerId, [{ row: targetRow, col: targetCol, name: targetName }], gambleMult)
  } else if (template.effect === 'obscure') {
    const immune = tryBlockAttackImmunity(players, targetPlayerId, targetRow, targetCol, playerId, vfxList)
    players = immune.players
    if (immune.blocked) {
      message = `${immune.targetName} is immune — Tree blocked!`
      if (shouldRemoveFromHand) {
        players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
      }
      return { state: { ...state, players, message }, vfx: vfxList, message }
    }
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (tIdx === -1) return { state, vfx: [], message: '' }
    const slotChar = target.board[tIdx]?.character
    const targetName = slotChar ? getTemplate(slotChar.card.templateId).name : 'Slot'
    const board = target.board.map((s, i) =>
      i === tIdx
        ? { ...s, obscured: { turnsRemaining: template.duration ?? 2, placedBy: playerId } }
        : s,
    )
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    message = 'Tree obscures that slot for 2 rounds!'
    vfxList.push(
      createVfx('tree', message, {
        playerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: targetName }],
      }),
    )
    if (shardActive) {
      vfxList.push(
        createVfx('shard_strike', 'SHARD — 2× DAMAGE!', {
          playerId,
          targetPlayerId,
          targets: [{ row: targetRow, col: targetCol, name: targetName }],
        }),
      )
    }
    if (doubleTroubleActive) {
      appendDoubleTroubleHitVfx(vfxList, playerId, targetPlayerId, targetRow, targetCol, targetName)
    }
  } else if (template.effect === 'explosive_aoe') {
    const dmg = calcAttackDamage(getPlayer(players, playerId), (template.damage ?? 7) + moonBonus, shardActive)
    if (gambleMult !== 1) gambleApplied = true
    const target = getPlayer(players, targetPlayerId)
    const aoeSlots = get2x2AoESlots(targetRow)
    const { player: updated, hits, hadKill, killCount } = applyAoEDamage(target, aoeSlots, dmg)
    players = updatePlayer(players, targetPlayerId, updated)
    players = applyBreadIfNeeded(players, hadKill, vfxList)
    const anchorRow = aoeSlots[0]?.row ?? targetRow
    message = `Explosive — ${hits.length} hit for ${dmg} each!`
    vfxList.push(
      createVfx('explosive', message, {
        playerId,
        targetPlayerId,
        aoeCenter: { row: anchorRow, col: 0 },
        targets: hits.length ? hits : [{ row: anchorRow, col: 0, name: 'Blast' }],
      }),
    )
    if (shardActive && hits.length) {
      vfxList.push(
        createVfx('shard_strike', 'SHARD — 2× DAMAGE!', {
          playerId,
          targetPlayerId,
          targets: hits,
        }),
      )
    }
    if (hasBuff(getPlayer(players, playerId), 'haunted')) {
      for (const hit of hits) {
        players = applyHauntedToTarget(players, playerId, targetPlayerId, hit.row, hit.col, vfxList)
      }
    }
    appendGambleStrikeVfx(vfxList, playerId, targetPlayerId, hits, gambleMult)
    objectiveDamage += dmg * hits.length
    objectiveKills += killCount
  } else if (template.effect === 'column_sweep') {
    const dmg = calcAttackDamage(getPlayer(players, playerId), (template.damage ?? 5) + moonBonus, shardActive)
    if (gambleMult !== 1) gambleApplied = true
    const target = getPlayer(players, targetPlayerId)
    const col = targetCol
    const { player: updated, hits, hadKill, killCount } = applyColLaneDamage(target, col, dmg)
    players = updatePlayer(players, targetPlayerId, updated)
    players = applyBreadIfNeeded(players, hadKill, vfxList)
    message = `Sweep — ${hits.length} hit in column for ${dmg} each!`
    vfxList.push(
      createVfx('sweep', message, {
        playerId,
        targetPlayerId,
        laneCol: col,
        targets: hits.length ? hits : [{ row: 0, col, name: 'Wind' }],
      }),
    )
    if (shardActive && hits.length) {
      vfxList.push(
        createVfx('shard_strike', 'SHARD — 2× DAMAGE!', {
          playerId,
          targetPlayerId,
          targets: hits,
        }),
      )
    }
    if (hasBuff(getPlayer(players, playerId), 'haunted')) {
      for (const hit of hits) {
        players = applyHauntedToTarget(players, playerId, targetPlayerId, hit.row, hit.col, vfxList)
      }
    }
    appendGambleStrikeVfx(vfxList, playerId, targetPlayerId, hits, gambleMult)
    objectiveDamage += dmg * hits.length
    objectiveKills += killCount
  }

  if (template.type === 'attack' && gambleApplied) {
    players = applyShardConsume(players, playerId, shardActive, vfxList)
    players = applyGambleConsume(players, playerId, vfxList)
    let attacker = getPlayer(players, playerId)
    if (moonBonus > 0) {
      attacker = consumePendingBuff(attacker, 'moonlight')
    }
    if (hasBuff(getPlayer(players, playerId), 'haunted')) {
      attacker = consumePendingBuff(attacker, 'haunted')
    }
    players = updatePlayer(players, playerId, attacker)
  } else if (template.type === 'attack') {
    players = applyShardConsume(players, playerId, shardActive, vfxList)
    let attacker = getPlayer(players, playerId)
    if (moonBonus > 0) {
      attacker = consumePendingBuff(attacker, 'moonlight')
    }
    if (hasBuff(getPlayer(players, playerId), 'haunted')) {
      attacker = consumePendingBuff(attacker, 'haunted')
    }
    players = updatePlayer(players, playerId, attacker)
  }

  if (shouldRemoveFromHand) {
    players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
  }

  let resultState: GameState = { ...state, players, message: message || `${template.name} used!` }
  if (playerId !== targetPlayerId) {
    if (objectiveDamage > 0) resultState = trackObjectiveDamage(resultState, playerId, objectiveDamage)
    for (let i = 0; i < objectiveKills; i += 1) {
      resultState = trackObjectiveKill(resultState, playerId)
    }
  }
  if (template.type === 'attack') {
    resultState = applyObjectiveEvent(resultState, playerId, 'attacks_played', 1)
  }

  return {
    state: resultState,
    vfx: vfxList,
    message: message || `${template.name} used!`,
  }
}

export function expireCounterPrompt(state: GameState): GameState {
  if (!state.counterPrompt) return state

  const prompt = state.counterPrompt
  const cleared = { ...state, counterPrompt: null }

  if (prompt.playedKind === 'special') {
    return completeAction(executeSpecialCard(cleared, prompt.attackerId, prompt.playedCard), prompt.attackerId)
  }

  const template = getTemplate(prompt.playedCard.templateId)
  if (template.effect === 'tornado_move') {
    return beginTornadoMove(
      cleared,
      prompt.attackerId,
      prompt.playedCard,
      prompt.targetPlayerId,
      prompt.targetRow,
      prompt.targetCol,
    )
  }

  const { state: executed, vfx } = executeAttackCard(
    cleared,
    prompt.attackerId,
    prompt.playedCard,
    prompt.targetPlayerId,
    prompt.targetRow,
    prompt.targetCol,
  )

  return completeAction(appendVfx(executed, ...vfx), prompt.attackerId)
}

/** @deprecated use expireCounterPrompt */
export const expireMirrorPrompt = expireCounterPrompt

function cancelPendingPlay(state: GameState): GameState {
  return { ...state, counterPrompt: null, selectedCard: null }
}

export function useMirrorCounter(state: GameState, defenderId: 1 | 2): GameState {
  if (!state.counterPrompt || state.counterPrompt.defenderId !== defenderId) {
    return { ...state, message: 'No counter window active.' }
  }

  const prompt = state.counterPrompt
  const defender = getPlayer(state.players, defenderId)
  const mirrorCard = findMirrorCard(defender)
  if (!mirrorCard) {
    return { ...state, message: 'No Mirror card in hand.' }
  }

  if (prompt.playedKind === 'special') {
    return { ...state, message: 'Mirror cannot reflect special cards!' }
  }

  const { attackerId, playedCard, targetRow, targetCol } = prompt

  const attacker = getPlayer(state.players, attackerId)
  let reflectRow = targetRow
  let reflectCol = targetCol
  const directSlot = attacker.board[findSlotIndex(attacker, targetRow, targetCol)]
  if (!directSlot?.character) {
    const fallback = attacker.board.find((s) => s.character)
    if (fallback) {
      reflectRow = fallback.row
      reflectCol = fallback.col
    }
  }

  let resultState = cancelPendingPlay(state)

  if (prompt.playedKind === 'attack') {
    const template = getTemplate(playedCard.templateId)
    if (template.effect === 'tornado_move') {
      return { ...resultState, message: 'Mirror cannot reflect Tornado!' }
    }
    if (!COUNTERABLE_ATTACKS.has(template.effect)) {
      return { ...resultState, message: 'Mirror cannot reflect that attack!' }
    }
    const { state: reflected, vfx, message } = executeAttackCard(
      resultState,
      attackerId,
      playedCard,
      attackerId,
      reflectRow,
      reflectCol,
    )
    resultState = reflected
    const def = getPlayer(resultState.players, defenderId)
    let players = updatePlayer(resultState.players, defenderId, removeFromHand(def, mirrorCard))
    const mirrorVfx = createVfx('mirror_reflect', 'MIRROR — attack reflected!', { playerId: defenderId })
    let newState: GameState = {
      ...resultState,
      players,
      skipNextTurnFor: defenderId,
      message: message || 'Mirror reflected the attack! Your next turn is skipped.',
    }
    newState = appendVfx(newState, mirrorVfx, ...vfx)
    return completeAction(newState, attackerId)
  }

  return { ...resultState, message: 'Mirror only reflects attack cards.' }
}

export function useSpellBookCounter(state: GameState, defenderId: 1 | 2): GameState {
  if (!state.counterPrompt || state.counterPrompt.defenderId !== defenderId) {
    return { ...state, message: 'No counter window active.' }
  }

  const prompt = state.counterPrompt
  const defender = getPlayer(state.players, defenderId)
  const spellBook = findSpellBookCard(defender)
  if (!spellBook) {
    return { ...state, message: 'No Spell Book in hand.' }
  }

  if (prompt.playedKind === 'special') {
    return { ...state, message: 'Spell Book cannot counter special cards!' }
  }

  const stolen = createCardInstance(prompt.playedCard.templateId)
  const stolenName = getTemplate(stolen.templateId).name
  let players = state.players
  const def = getPlayer(players, defenderId)
  players = updatePlayer(
    players,
    defenderId,
    {
      ...removeFromHand(def, spellBook),
      hand: [...removeFromHand(def, spellBook).hand, stolen],
    },
  )

  const vfx = createVfx('spell_book', `SPELL BOOK — stole ${stolenName}!`, { playerId: defenderId })
  const newState: GameState = {
    ...state,
    players,
    counterPrompt: null,
    selectedCard: null,
    message: `Spell Book cancelled the card — ${stolenName} added to your hand!`,
  }
  return completeAction(appendVfx(newState, vfx), prompt.attackerId)
}

export function useChainLockedCounter(state: GameState, defenderId: 1 | 2): GameState {
  if (!state.counterPrompt || state.counterPrompt.defenderId !== defenderId) {
    return { ...state, message: 'No counter window active.' }
  }

  const prompt = state.counterPrompt
  const defender = getPlayer(state.players, defenderId)
  const chainCard = findChainLockedCard(defender)
  if (!chainCard) {
    return { ...state, message: 'No Chain Locked in hand.' }
  }

  const lockedName = getTemplate(prompt.playedCard.templateId).name
  const lockTurns = getTemplate(chainCard.templateId).duration ?? 3
  let players = state.players
  players = updatePlayer(players, defenderId, removeFromHand(defender, chainCard))

  const vfx = createVfx('chain_locked', `CHAIN LOCKED — ${lockedName} sealed!`, {
    playerId: defenderId,
  })
  let newState: GameState = addCardLock(
    {
      ...state,
      players,
      counterPrompt: null,
      selectedCard: null,
      message: `${lockedName} locked for both players (${lockTurns} turns)!`,
    },
    prompt.playedCard.templateId,
    lockTurns,
  )
  return completeAction(appendVfx(newState, vfx), prompt.attackerId)
}

function executeSpecialCard(state: GameState, playerId: 1 | 2, card: CardInstance): GameState {
  const template = getTemplate(card.templateId)
  const player = getPlayer(state.players, playerId)
  let players = state.players
  let message = ''
  const vfxList: VfxEvent[] = []

  if (template.effect === 'soul_revive') {
    if (player.eliminated.length === 0) {
      return { ...state, message: 'No eliminated characters to revive.' }
    }
    const revived = player.eliminated[player.eliminated.length - 1]
    const newEliminated = player.eliminated.slice(0, -1)
    players = updatePlayer(players, playerId, {
      ...removeFromHand(player, card),
      eliminated: newEliminated,
      hand: [...player.hand.filter((c) => c.instanceId !== card.instanceId), revived],
    })
    message = `${getTemplate(revived.templateId).name} revived to hand!`
    vfxList.push(createVfx('soul_revive', message, { playerId }))
  } else if (template.effect === 'quantity_buff') {
    players = updatePlayer(players, playerId, {
      ...removeFromHand(player, card),
      pendingBuffs: [
        ...player.pendingBuffs,
        { type: 'quantity', turnsRemaining: template.duration ?? 5 },
      ],
      maxPassives: 2,
    })
    message = 'Quantity — 2 passives allowed for 5 turns!'
    vfxList.push(createVfx('quantity', message, { playerId }))
  } else if (template.effect === 'pickpocket_steal') {
    const enemyId: 1 | 2 = playerId === 1 ? 2 : 1
    const stolenResult = stealRandomCardFromEnemy(playerId, enemyId, players)
    if (!stolenResult.stolen) {
      return { ...state, message: 'Enemy has no cards to steal!' }
    }
    players = updatePlayer(
      stolenResult.players,
      playerId,
      removeFromHand(getPlayer(stolenResult.players, playerId), card),
    )
    const stolenName = getTemplate(stolenResult.stolen.templateId).name
    message = `Pickpocket stole ${stolenName} from Player ${enemyId}!`
    vfxList.push(createVfx('pickpocket', message, { playerId, targetPlayerId: enemyId }))
  } else {
    return state
  }

  return applyObjectiveEvent(
    appendVfx({ ...state, players, message }, ...vfxList),
    playerId,
    'specials_played',
    1,
  )
}

function tryHandAttackDoubleTroubleFirstHit(
  state: GameState,
  playerId: 1 | 2,
  card: CardInstance,
  template: CardTemplate,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
): GameState | null {
  const player = getPlayer(state.players, playerId)
  if (!hasBuff(player, 'double_trouble') || !attackCardSupportsDoubleTrouble(template)) {
    return null
  }

  const enemyBoard = getPlayer(state.players, targetPlayerId)
  const hasSecondTarget =
    template.effect === 'obscure'
      ? countOtherEnemySlots(enemyBoard, { row: targetRow, col: targetCol }) > 0
      : countEnemyCharacters(enemyBoard, { row: targetRow, col: targetCol }) > 0

  const result = executeAttackCard(state, playerId, card, targetPlayerId, targetRow, targetCol, {
    removeFromHand: false,
    doubleTroubleActive: true,
  })

  if (!hasSecondTarget) {
    const vfx = [
      ...result.vfx,
      createVfx('double_trouble_ready', 'DOUBLE TROUBLE — only one target!', { playerId }),
    ]
    let players = updatePlayer(
      result.state.players,
      playerId,
      consumeDoubleTrouble(getPlayer(result.state.players, playerId)),
    )
    players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
    return completeAction({ ...result.state, players, message: result.message }, playerId, vfx)
  }

  const handAttack: HandAttackState = {
    playerId,
    card,
    awaitingDoubleSecond: true,
    firstTarget: { playerId: targetPlayerId, row: targetRow, col: targetCol },
    targetMode: template.effect === 'obscure' ? 'enemy_slot' : 'enemy_character',
  }

  return appendVfx(
    {
      ...result.state,
      selectedCard: card,
      handAttack,
      message: 'Double Trouble — first hit! Pick a second target.',
    },
    ...result.vfx,
  )
}

function useHandAttackOnTarget(
  state: GameState,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
  controllingPlayer: 1 | 2,
): GameState {
  const pending = state.handAttack
  if (!pending?.awaitingDoubleSecond) return state
  if (pending.playerId !== controllingPlayer) return state
  if (!canTakeTurnAction(state, controllingPlayer)) {
    return { ...state, message: 'You already used your action this turn.' }
  }

  const { card, firstTarget, targetMode } = pending

  if (targetPlayerId === controllingPlayer) {
    return { ...state, message: 'Click an enemy for your second Double Trouble hit.' }
  }

  if (
    firstTarget.playerId === targetPlayerId &&
    firstTarget.row === targetRow &&
    firstTarget.col === targetCol
  ) {
    return { ...state, message: 'Pick a different second target.' }
  }

  if (targetMode === 'enemy_character') {
    const target = getPlayer(state.players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (tIdx === -1 || !target.board[tIdx].character) {
      return { ...state, message: 'Select an enemy character.' }
    }
    const blocked = rejectIfBlocked(state, pending.playerId, targetPlayerId, targetRow, targetCol)
    if (blocked) return blocked
  }

  const hit2 = executeAttackCard(state, pending.playerId, card, targetPlayerId, targetRow, targetCol, {
    removeFromHand: false,
    doubleTroubleActive: true,
  })

  const vfx = [
    ...hit2.vfx,
    createVfx('double_trouble_ready', 'DOUBLE TROUBLE — both attacks landed!', { playerId: pending.playerId }),
  ]

  return finalizeHandAttack(
    hit2.state,
    pending.playerId,
    card,
    hit2.state.players,
    vfx,
    'Double Trouble — both hits landed!',
  )
}

function countTornadoDestinations(
  board: PlayerState['board'],
  exclude: { row: number; col: number },
): number {
  return board.filter(
    (s) =>
      !s.character &&
      !s.obscured &&
      !(s.row === exclude.row && s.col === exclude.col),
  ).length
}

function beginTornadoMove(
  state: GameState,
  playerId: 1 | 2,
  card: CardInstance,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
): GameState {
  const elem = tryBlockElementalImmunity(state.players, targetPlayerId, 'tornado_move', playerId, [])
  if (elem.blocked) {
    return { ...state, message: 'Elemental Immunity blocked Tornado!' }
  }

  const target = getPlayer(state.players, targetPlayerId)
  const tIdx = findSlotIndex(target, targetRow, targetCol)
  const slot = target.board[tIdx]
  if (!slot?.character) {
    return { ...state, message: 'Select an enemy character to relocate.' }
  }

  if (countTornadoDestinations(target.board, { row: targetRow, col: targetCol }) === 0) {
    return { ...state, message: 'No empty slots to relocate that enemy to!' }
  }

  const charName = getTemplate(slot.character.card.templateId).name
  return {
    ...state,
    selectedCard: card,
    tornadoMove: {
      playerId,
      card,
      targetPlayerId,
      fromRow: targetRow,
      fromCol: targetCol,
    },
    message: `Tornado grabbed ${charName} — click an empty slot on their board.`,
  }
}

function completeTornadoMove(
  state: GameState,
  targetPlayerId: 1 | 2,
  toRow: number,
  toCol: number,
  controllingPlayer: 1 | 2,
): GameState {
  const pending = state.tornadoMove
  if (!pending) return state
  if (pending.playerId !== controllingPlayer) return state
  if (pending.targetPlayerId !== targetPlayerId) {
    return { ...state, message: 'Click an empty slot on the enemy board.' }
  }
  if (!canTakeTurnAction(state, pending.playerId)) {
    return { ...state, message: 'You already used your action this turn.' }
  }

  if (toRow === pending.fromRow && toCol === pending.fromCol) {
    return { ...state, message: 'Pick a different empty slot to relocate them.' }
  }

  const target = getPlayer(state.players, targetPlayerId)
  const fromIdx = findSlotIndex(target, pending.fromRow, pending.fromCol)
  const toIdx = findSlotIndex(target, toRow, toCol)
  const fromSlot = target.board[fromIdx]
  const toSlot = target.board[toIdx]

  if (!fromSlot?.character) {
    return { ...state, tornadoMove: null, message: 'That enemy is no longer there.' }
  }
  if (toSlot.character) {
    return { ...state, message: 'That slot is occupied — pick an empty slot.' }
  }
  if (toSlot.obscured) {
    return { ...state, message: 'That slot is obscured by a Tree!' }
  }

  const char = fromSlot.character
  const charName = getTemplate(char.card.templateId).name
  const board = target.board.map((slot, i) => {
    if (i === fromIdx) return { ...slot, character: null }
    if (i === toIdx) return { ...slot, character: char }
    return slot
  })

  let players = updatePlayer(state.players, targetPlayerId, { ...target, board })
  players = updatePlayer(players, pending.playerId, removeFromHand(getPlayer(players, pending.playerId), pending.card))

  const message = `Tornado relocated ${charName}!`
  const vfx = createVfx('tornado', message, {
    playerId: pending.playerId,
    targetPlayerId,
    targets: [
      { row: pending.fromRow, col: pending.fromCol, name: charName },
      { row: toRow, col: toCol, name: charName },
    ],
  })

  return completeAction(
    appendVfx({ ...state, players, tornadoMove: null, message }, vfx),
    pending.playerId,
  )
}

const TARGETED_SPECIAL_EFFECTS = new Set<CardTemplate['effect']>([
  'cannon_damage',
  'cobweb',
  'lane_freeze_damage',
  'cooldown_pause',
])

function stealRandomCardFromEnemy(
  thiefId: 1 | 2,
  enemyId: 1 | 2,
  players: [PlayerState, PlayerState],
): { players: [PlayerState, PlayerState]; stolen: CardInstance | null } {
  const enemy = getPlayer(players, enemyId)
  const pool = [...enemy.hand, ...enemy.deck]
  if (pool.length === 0) return { players, stolen: null }
  const stolen = pool[Math.floor(Math.random() * pool.length)]
  const fromHand = enemy.hand.some((c) => c.instanceId === stolen.instanceId)
  const updatedEnemy: PlayerState = fromHand
    ? { ...enemy, hand: enemy.hand.filter((c) => c.instanceId !== stolen.instanceId) }
    : { ...enemy, deck: enemy.deck.filter((c) => c.instanceId !== stolen.instanceId) }
  const thief = getPlayer(players, thiefId)
  return {
    players: updatePlayer(
      updatePlayer(players, enemyId, updatedEnemy),
      thiefId,
      { ...thief, hand: [...thief.hand, stolen] },
    ),
    stolen,
  }
}

function executeTargetedSpecial(
  state: GameState,
  playerId: 1 | 2,
  card: CardInstance,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
): { state: GameState; vfx: VfxEvent[]; message: string } {
  const template = getTemplate(card.templateId)
  let players = state.players
  const vfxList: VfxEvent[] = []
  let message = ''

  if (template.effect === 'cannon_damage') {
    const blocked = rejectIfBlocked(state, playerId, targetPlayerId, targetRow, targetCol)
    if (blocked) return { state: blocked, vfx: [], message: blocked.message ?? BLOCKED_TARGET_MSG }

    const immune = tryBlockAttackImmunity(players, targetPlayerId, targetRow, targetCol, playerId, vfxList)
    players = immune.players
    if (immune.blocked) {
      message = `${immune.targetName} is immune — Cannon blocked!`
      players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
      return { state: { ...state, players, message }, vfx: vfxList, message }
    }

    const dmg = template.damage ?? 75
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) {
      return { state: { ...state, message: 'Select an enemy character.' }, vfx: [], message: 'Select an enemy character.' }
    }
    const targetName = getTemplate(target.board[tIdx].character!.card.templateId).name
    const damageResult = applyDamageToPlayerBoard(target, targetRow, targetCol, dmg)
    players = updatePlayer(players, targetPlayerId, damageResult.player)
    players = applyBreadIfNeeded(players, damageResult.killed != null, vfxList)
    players = maybeApplyThornMail(players, targetPlayerId, playerId, vfxList)
    players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
    message = `BOOM! Cannon dealt ${dmg} to ${targetName}!`
    vfxList.push(
      createVfx('cannon', message, {
        playerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: targetName }],
      }),
    )
    vfxList.push(
      createVfx('cannon_hit', message, {
        playerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: targetName }],
      }),
    )
    let resultState: GameState = { ...state, players, message }
    if (playerId !== targetPlayerId) {
      resultState = trackObjectiveDamage(resultState, playerId, dmg)
      if (damageResult.killed != null) resultState = trackObjectiveKill(resultState, playerId)
    }
    return { state: resultState, vfx: vfxList, message }
  }

  if (template.effect === 'cobweb') {
    const blocked = rejectIfBlocked(state, playerId, targetPlayerId, targetRow, targetCol)
    if (blocked) return { state: blocked, vfx: [], message: blocked.message ?? BLOCKED_TARGET_MSG }

    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) {
      return { state: { ...state, message: 'Select an enemy character.' }, vfx: [], message: 'Select an enemy character.' }
    }
    const webName = getTemplate(target.board[tIdx].character!.card.templateId).name
    const board = target.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'webbed'),
            { type: 'webbed' as const, turnsRemaining: silenceStatusTurns(template.duration ?? 2) },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    players = maybeApplyThornMail(players, targetPlayerId, playerId, vfxList)
    players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
    message = `Cobweb — ${webName} silenced for ${template.duration ?? 2} rounds!`
    vfxList.push(
      createVfx('cobweb', message, {
        playerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: webName }],
      }),
    )
    vfxList.push(
      createVfx('web', message, {
        playerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: webName }],
      }),
    )
    return { state: { ...state, players, message }, vfx: vfxList, message }
  }

  if (template.effect === 'lane_freeze_damage') {
    const target = getPlayer(players, targetPlayerId)
    const dmg = template.damage ?? 10
    const freezeTurns = silenceStatusTurns(template.duration ?? 2)
    const hits: { row: number; col: number; name: string }[] = []
    let eliminated = [...target.eliminated]
    let hadKill = false
    let killCount = 0
    const board = target.board.map((slot) => {
      if (slot.row !== targetRow || !slot.character) return slot
      const name = getTemplate(slot.character.card.templateId).name
      const result = applyDamageToSlot(slot, dmg, eliminated)
      eliminated = result.eliminated
      if (result.killed) {
        hadKill = true
        killCount += 1
      }
      hits.push({ row: slot.row, col: slot.col, name })
      if (!result.slot.character) return result.slot
      return {
        ...result.slot,
        character: {
          ...result.slot.character,
          statuses: [
            ...result.slot.character.statuses.filter((st) => st.type !== 'frozen'),
            { type: 'frozen' as const, turnsRemaining: freezeTurns },
          ],
        },
      }
    })
    if (hits.length === 0) {
      return { state: { ...state, message: 'That lane has no enemies!' }, vfx: [], message: 'That lane has no enemies!' }
    }
    players = updatePlayer(players, targetPlayerId, { ...target, board, eliminated })
    players = applyBreadIfNeeded(players, hadKill, vfxList)
    for (let i = 0; i < hits.length; i++) {
      players = maybeApplyThornMail(players, targetPlayerId, playerId, vfxList)
    }
    players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
    message = `Ice Cream — lane ${targetRow + 1} frozen! ${hits.length} hit for ${dmg} each!`
    vfxList.push(
      createVfx('ice_cream', message, {
        playerId,
        targetPlayerId,
        laneRow: targetRow,
        targets: hits,
      }),
    )
    vfxList.push(
      createVfx('ice_cream_lane', message, {
        playerId,
        targetPlayerId,
        laneRow: targetRow,
        targets: hits,
      }),
    )
    let resultState: GameState = { ...state, players, message }
    if (playerId !== targetPlayerId) {
      resultState = trackObjectiveDamage(resultState, playerId, dmg * hits.length)
      if (killCount > 0) resultState = trackObjectiveKills(resultState, playerId, killCount)
    }
    return { state: resultState, vfx: vfxList, message }
  }

  if (template.effect === 'cooldown_pause') {
    const target = getPlayer(players, targetPlayerId)
    const tIdx = findSlotIndex(target, targetRow, targetCol)
    if (!target.board[tIdx]?.character) {
      return { state: { ...state, message: 'Select an enemy character.' }, vfx: [], message: 'Select an enemy character.' }
    }
    const clockName = getTemplate(target.board[tIdx].character!.card.templateId).name
    const board = target.board.map((s, i) => {
      if (i !== tIdx || !s.character) return s
      return {
        ...s,
        character: {
          ...s.character,
          statuses: [
            ...s.character.statuses.filter((st) => st.type !== 'cooldown_paused'),
            { type: 'cooldown_paused' as const, turnsRemaining: silenceStatusTurns(template.duration ?? 2) },
          ],
        },
      }
    })
    players = updatePlayer(players, targetPlayerId, { ...target, board })
    players = updatePlayer(players, playerId, removeFromHand(getPlayer(players, playerId), card))
    message = `Clock — ${clockName}'s cooldowns paused for ${template.duration ?? 2} rounds!`
    vfxList.push(
      createVfx('clock', message, {
        playerId,
        targetPlayerId,
        targets: [{ row: targetRow, col: targetCol, name: clockName }],
      }),
    )
    return { state: { ...state, players, message }, vfx: vfxList, message }
  }

  return { state, vfx: [], message: '' }
}

function resolveHandCard(
  state: GameState,
  playerId: 1 | 2,
  card: CardInstance,
  targetPlayerId: 1 | 2,
  targetRow: number,
  targetCol: number,
): GameState {
  if (state.counterPrompt) {
    return { ...state, message: 'Waiting for counter response…' }
  }

  const template = getTemplate(card.templateId)

  if (template.effect && REACTIVE_EFFECTS.has(template.effect)) {
    return { ...state, message: `${template.name} is reactive — hold it in hand.` }
  }

  if (template.type === 'attack' && template.effect !== 'tornado_move' && state.phase === 'playing') {
    const countered = tryOpenCounterPrompt(
      state,
      playerId,
      card,
      'attack',
      targetPlayerId,
      targetRow,
      targetCol,
    )
    if (countered) return countered
  }

  if (
    template.type === 'special' &&
    template.effect &&
    TARGETED_SPECIAL_EFFECTS.has(template.effect) &&
    state.phase === 'playing'
  ) {
    const countered = tryOpenCounterPrompt(
      state,
      playerId,
      card,
      'special',
      targetPlayerId,
      targetRow,
      targetCol,
    )
    if (countered) return countered
  }

  const player = getPlayer(state.players, playerId)
  const vfxList: VfxEvent[] = []
  let players = state.players
  let message = ''

  if (
    template.effect === 'freeze_damage' ||
    template.effect === 'burn' ||
    template.effect === 'obscure'
  ) {
    const doubleFirst = tryHandAttackDoubleTroubleFirstHit(
      state,
      playerId,
      card,
      template,
      targetPlayerId,
      targetRow,
      targetCol,
    )
    if (doubleFirst) return doubleFirst

    const result = executeAttackCard(state, playerId, card, targetPlayerId, targetRow, targetCol)
    return completeAction(appendVfx(result.state, ...result.vfx), playerId)
  }

  if (template.effect === 'explosive_aoe' || template.effect === 'column_sweep') {
    const result = executeAttackCard(state, playerId, card, targetPlayerId, targetRow, targetCol)
    return completeAction(appendVfx(result.state, ...result.vfx), playerId)
  }

  if (template.effect === 'tornado_move') {
    return beginTornadoMove(state, playerId, card, targetPlayerId, targetRow, targetCol)
  }

  if (template.effect === 'caffeinated_buff') {
    players = updatePlayer(players, playerId, {
      ...removeFromHand(player, card),
      pendingBuffs: [
        ...player.pendingBuffs.filter((b) => b.type !== 'caffeinated'),
        { type: 'caffeinated', turnsRemaining: template.duration ?? 3 },
      ],
    })
    message = 'Caffeinated — ability cooldowns −1 for 3 rounds!'
    vfxList.push(createVfx('caffeinated', message, { playerId }))
    return completeAction({ ...state, players, message }, playerId, vfxList)
  }

  if (template.effect === 'soul_revive') {
    return completeAction(executeSpecialCard(state, playerId, card), playerId)
  }

  if (template.effect === 'quantity_buff' || template.effect === 'pickpocket_steal') {
    return completeAction(executeSpecialCard(state, playerId, card), playerId)
  }

  if (template.effect && TARGETED_SPECIAL_EFFECTS.has(template.effect)) {
    const result = executeTargetedSpecial(state, playerId, card, targetPlayerId, targetRow, targetCol)
    const completed = completeAction(appendVfx(result.state, ...result.vfx), playerId)
    return applyObjectiveEvent(completed, playerId, 'specials_played', 1)
  }

  const updatedAttacker = removeFromHand(getPlayer(players, playerId), card)
  players = updatePlayer(players, playerId, updatedAttacker)

  return completeAction(
    appendVfx({ ...state, players, message: message || `${template.name} used!` }, ...vfxList),
    playerId,
  )
}

export function usePassive(state: GameState, playerId: 1 | 2): GameState {
  if (!state.selectedCard) return { ...state, message: 'Select a passive card first.' }
  if (state.phase === 'playing' && state.activePlayer !== playerId) {
    return { ...state, message: 'Wait for your turn.' }
  }

  const template = getTemplate(state.selectedCard.templateId)
  if (template.type !== 'passive') return { ...state, message: 'Select a passive card.' }

  const player = getPlayer(state.players, playerId)
  if (!player.hand.some((c) => c.instanceId === state.selectedCard!.instanceId)) {
    return { ...state, message: 'That card is not in this player\'s hand.' }
  }

  if (player.passives.length >= player.maxPassives) {
    return { ...state, message: `Max ${player.maxPassives} passive(s) active.` }
  }

  if (template.effect === 'trade_buff') {
    return {
      ...state,
      tradeChoice: { playerId, passiveCard: state.selectedCard },
      message: 'Choose your trade deal.',
    }
  }

  let pendingBuffs = [...player.pendingBuffs]
  const vfxList: VfxEvent[] = []

  if (template.effect === 'shard_buff') {
    pendingBuffs = [...pendingBuffs.filter((b) => b.type !== 'shard'), { type: 'shard' }]
    vfxList.push(createVfx('shard', 'SHARD armed — next attack 2×!', { playerId }))
  }
  if (template.effect === 'double_trouble_buff') {
    pendingBuffs = [...pendingBuffs.filter((b) => b.type !== 'double_trouble'), { type: 'double_trouble' }]
    vfxList.push(createVfx('double_trouble_ready', 'DOUBLE TROUBLE ready!', { playerId }))
  }
  if (template.effect === 'elemental_immunity_buff') {
    pendingBuffs = [
      ...pendingBuffs.filter((b) => b.type !== 'elemental_immunity'),
      { type: 'elemental_immunity', turnsRemaining: template.duration ?? 3 },
    ]
    vfxList.push(createVfx('elemental_immunity', 'Elemental Immunity active!', { playerId }))
  }
  if (template.effect === 'moonlight_buff') {
    pendingBuffs = [...pendingBuffs.filter((b) => b.type !== 'moonlight'), { type: 'moonlight' }]
    vfxList.push(createVfx('moonlight', 'Moonlight — next attack +5!', { playerId }))
  }
  if (template.effect === 'bread_buff') {
    pendingBuffs = [
      ...pendingBuffs.filter((b) => b.type !== 'bread'),
      { type: 'bread', turnsRemaining: template.duration ?? 3 },
    ]
    vfxList.push(createVfx('bread', 'Bread — eliminations heal your team!', { playerId }))
  }
  if (template.effect === 'haunted_buff') {
    pendingBuffs = [...pendingBuffs.filter((b) => b.type !== 'haunted'), { type: 'haunted' }]
    vfxList.push(createVfx('haunted', 'Haunted — next attack inflicts Haunt!', { playerId }))
  }
  if (template.effect === 'chaos_buff') {
    pendingBuffs = [...pendingBuffs.filter((b) => b.type !== 'chaos'), { type: 'chaos' }]
    vfxList.push(createVfx('chaos', 'Chaos — next ability becomes 2×2!', { playerId }))
  }

  let bonusTurnFor = state.bonusTurnFor
  if (template.effect === 'musical_show_buff') {
    pendingBuffs = [
      ...pendingBuffs.filter((b) => b.type !== 'musical_show'),
      { type: 'musical_show', turnsRemaining: template.duration ?? 1 },
    ]
    bonusTurnFor = playerId
    vfxList.push(createVfx('musical_show', 'Musical Show — bonus turn queued!', { playerId }))
  }
  if (template.effect === 'thorn_mail_buff') {
    pendingBuffs = [
      ...pendingBuffs.filter((b) => b.type !== 'thorn_mail'),
      { type: 'thorn_mail', turnsRemaining: template.duration ?? 3 },
    ]
    vfxList.push(createVfx('thorn_mail', 'Thorn Mail — enemies take 3 damage when they hit your team!', { playerId }))
  }
  if (template.effect === 'regrowth_buff') {
    pendingBuffs = [
      ...pendingBuffs.filter((b) => b.type !== 'regrowth'),
      { type: 'regrowth', turnsRemaining: template.duration ?? 3 },
    ]
    vfxList.push(createVfx('regrowth', 'Regrowth — heal lowest ally each turn!', { playerId }))
  }
  if (template.effect === 'gamble_buff') {
    const heads = Math.random() < 0.5
    pendingBuffs = [
      ...pendingBuffs.filter((b) => b.type !== 'gamble_heads' && b.type !== 'gamble_tails'),
      { type: heads ? 'gamble_heads' : 'gamble_tails' },
    ]
    vfxList.push(
      createVfx(heads ? 'gamble_heads' : 'gamble_tails', heads ? 'Gamble — HEADS! Next attack 2×!' : 'Gamble — TAILS! Next attack half damage!', {
        playerId,
      }),
    )
  }

  const updatedPlayer: PlayerState = {
    ...removeFromHand(player, state.selectedCard),
    passives: [
      ...player.passives,
      { card: state.selectedCard, turnsRemaining: template.duration ?? 99 },
    ],
    pendingBuffs,
  }

  return appendVfx(
    {
      ...state,
      players: updatePlayer(state.players, playerId, updatedPlayer),
      selectedCard: null,
      bonusTurnFor,
      message: `Activated ${template.name} — does not use your turn.`,
    },
    ...vfxList,
  )
}

export function chooseTrade(
  state: GameState,
  mode: 'damage' | 'cooldown',
): GameState {
  if (!state.tradeChoice) return state
  const { playerId, passiveCard } = state.tradeChoice
  const player = getPlayer(state.players, playerId)
  const template = getTemplate(passiveCard.templateId)

  const tradeBuff =
    mode === 'damage'
      ? { type: 'trade_damage' as const, turnsRemaining: template.duration ?? 3 }
      : { type: 'trade_cooldown' as const, turnsRemaining: template.duration ?? 3 }

  const updatedPlayer: PlayerState = {
    ...removeFromHand(player, passiveCard),
    passives: [
      ...player.passives,
      { card: passiveCard, turnsRemaining: template.duration ?? 3, data: { tradeMode: mode } },
    ],
    pendingBuffs: [...player.pendingBuffs.filter((b) => b.type !== 'trade_damage' && b.type !== 'trade_cooldown'), tradeBuff],
    damageDealtMultiplier: mode === 'damage' ? 1.5 : 1,
    damageTakenMultiplier: mode === 'damage' ? 1.5 : 1.75,
    cooldownReduction: mode === 'cooldown' ? 1 : 0,
  }

  return appendVfx(
    {
      ...state,
      players: updatePlayer(state.players, playerId, updatedPlayer),
      tradeChoice: null,
      selectedCard: null,
      message: mode === 'damage' ? 'Trade: 1.5× damage dealt & taken!' : 'Trade: −1 cooldowns, 1.75× damage taken!',
    },
    createVfx(
      mode === 'damage' ? 'trade_damage' : 'trade_cooldown',
      mode === 'damage' ? '1.5× DAMAGE PACT' : 'COOLDOWN PACT',
      { playerId },
    ),
  )
}

export function removeFromBoard(
  state: GameState,
  playerId: 1 | 2,
  row: number,
  col: number,
): GameState {
  if (state.phase !== 'setup') {
    return { ...state, message: 'Can only remove cards during setup.' }
  }
  const player = getPlayer(state.players, playerId)
  const slotIndex = findSlotIndex(player, row, col)
  if (slotIndex === -1 || !player.board[slotIndex].character) return state

  const card = player.board[slotIndex].character!.card
  const newBoard = player.board.map((slot, i) =>
    i === slotIndex ? { ...slot, character: null } : slot,
  )

  return {
    ...state,
    players: updatePlayer(state.players, playerId, {
      ...player,
      board: newBoard,
      hand: [...player.hand, card],
    }),
    message: `Returned ${getTemplate(card.templateId).name} to hand.`,
  }
}

export function startGame(state: GameState): GameState {
  const draftOptions = rollDraftOptions(state)
  const players = [
    {
      ...state.players[0],
      objectives: [],
      objectiveStats: emptyObjectiveStats(),
    },
    {
      ...state.players[1],
      objectives: [],
      objectiveStats: emptyObjectiveStats(),
    },
  ] as [PlayerState, PlayerState]

  return {
    ...state,
    phase: 'objectives',
    players,
    winner: null,
    objectiveDraftOptions: draftOptions,
    objectivePicks: emptyObjectivePicks(),
    objectivesDeadlineMs: Date.now() + OBJECTIVES_INTRO_MS,
    selectedCard: null,
    characterAttack: null,
    handAttack: null,
    tornadoMove: null,
    abilityModal: null,
    tradeChoice: null,
    counterPrompt: null,
    lockedCards: [],
    skipNextTurnFor: null,
    bonusTurnFor: null,
    turnActionUsed: false,
    refillEffect: null,
    vfxQueue: [],
    message: 'Pick 1 objective each — a random third will be added. First to complete all three wins!',
  }
}

export function rematchGame(_state: GameState): GameState {
  return createInitialGame()
}

function beginObjectiveRevealPhase(state: GameState, resolvedPicks: { 1: string; 2: string; random: string }): GameState {
  return {
    ...state,
    phase: 'objective_reveal',
    objectivePicks: { 1: resolvedPicks[1], 2: resolvedPicks[2] },
    objectiveRandomPick: resolvedPicks.random,
    objectiveDraftOptions: [],
    objectivesAck: emptyObjectivesAck(),
    objectivesDeadlineMs: Date.now() + OBJECTIVE_REVEAL_ANIM_MS + OBJECTIVES_INTRO_MS,
    selectedCard: null,
    characterAttack: null,
    handAttack: null,
    tornadoMove: null,
    abilityModal: null,
    tradeChoice: null,
    counterPrompt: null,
    message: 'Match objectives revealed — press Next when ready!',
  }
}

function finalizeObjectiveDraft(state: GameState): GameState {
  const resolvedPicks = resolveObjectiveDraftPicks(state)
  const matchObjectives = cloneObjectivesForPlayer(buildMatchObjectives(state))
  const players = [
    {
      ...state.players[0],
      objectives: cloneObjectivesForPlayer(matchObjectives),
      objectiveStats: emptyObjectiveStats(),
    },
    {
      ...state.players[1],
      objectives: cloneObjectivesForPlayer(matchObjectives),
      objectiveStats: emptyObjectiveStats(),
    },
  ] as [PlayerState, PlayerState]

  return beginObjectiveRevealPhase(
    { ...state, players },
    resolvedPicks,
  )
}

function beginPlayingPhase(state: GameState): GameState {
  let s: GameState = {
    ...state,
    phase: 'playing',
    activePlayer: 1,
    winner: null,
    objectivesDeadlineMs: null,
    objectivesAck: emptyObjectivesAck(),
    objectiveRandomPick: null,
    selectedCard: null,
    characterAttack: null,
    handAttack: null,
    tornadoMove: null,
    abilityModal: null,
    tradeChoice: null,
    counterPrompt: null,
    lockedCards: [],
    skipNextTurnFor: null,
    bonusTurnFor: null,
    turnActionUsed: false,
    refillEffect: null,
    vfxQueue: [],
    message: 'Game started! Player 1 goes first.',
  }
  s = startTurnProcessing(s, 1)
  return s
}

export function pickObjective(state: GameState, playerId: 1 | 2, objectiveId: string): GameState {
  if (state.phase !== 'objectives') return state
  if (state.objectivePicks[playerId]) {
    return { ...state, message: 'You already picked an objective.' }
  }
  if (!state.objectiveDraftOptions.some((obj) => obj.id === objectiveId)) {
    return { ...state, message: 'Invalid objective.' }
  }
  const opponentId: 1 | 2 = playerId === 1 ? 2 : 1
  if (state.objectivePicks[opponentId] === objectiveId) {
    return { ...state, message: 'Your opponent already chose that objective.' }
  }

  const objectivePicks = { ...state.objectivePicks, [playerId]: objectiveId }
  const next: GameState = {
    ...state,
    objectivePicks,
    message: `Player ${playerId} chose an objective.${bothPlayersPicked({ ...state, objectivePicks }) ? ' Revealing match objectives…' : ''}`,
  }

  if (bothPlayersPicked(next)) {
    return finalizeObjectiveDraft(next)
  }

  return next
}

export function tickObjectivesDeadline(state: GameState, now = Date.now()): GameState {
  if (state.phase === 'objectives') {
    if (!canFinalizeObjectiveDraft(state, now)) return state
    return finalizeObjectiveDraft(state)
  }
  if (state.phase === 'objective_reveal') {
    return tickObjectiveRevealDeadline(state, now)
  }
  return state
}

export function ackObjectiveReveal(state: GameState, playerId: 1 | 2): GameState {
  if (state.phase !== 'objective_reveal') return state

  const objectivesAck = { ...state.objectivesAck, [playerId]: true }
  const next: GameState = { ...state, objectivesAck }

  if (canProceedFromObjectiveReveal(next)) {
    return beginPlayingPhase(next)
  }

  return {
    ...next,
    message:
      objectivesAck[1] && objectivesAck[2]
        ? 'Starting game…'
        : `Player ${playerId} is ready. Waiting for opponent…`,
  }
}

export function tickObjectiveRevealDeadline(state: GameState, now = Date.now()): GameState {
  if (state.phase !== 'objective_reveal') return state
  if (!canProceedFromObjectiveReveal(state, now)) return state
  return beginPlayingPhase(state)
}

export function handleBoardClick(
  state: GameState,
  playerId: 1 | 2,
  row: number,
  col: number,
  controllingPlayer: 1 | 2,
): GameState {
  if (state.tornadoMove) {
    if (playerId === controllingPlayer) {
      return { ...state, message: 'Click an empty slot on the enemy board.' }
    }
    return completeTornadoMove(state, playerId, row, col, controllingPlayer)
  }

  if (state.handAttack?.awaitingDoubleSecond) {
    if (playerId === controllingPlayer) {
      return { ...state, message: 'Click an enemy for your second Double Trouble hit.' }
    }
    return useHandAttackOnTarget(state, playerId, row, col, controllingPlayer)
  }

  if (state.characterAttack?.abilityId) {
    const { targetMode } = state.characterAttack
    if (targetMode === 'enemy_lane' || targetMode === 'enemy_lane_second') {
      if (playerId === controllingPlayer) {
        return { ...state, message: 'Click a row on the enemy board (horizontal lane).' }
      }
      return useCharacterAbilityOnTarget(state, playerId, row, col, controllingPlayer)
    }
    if (targetMode === 'enemy_aoe') {
      if (playerId === controllingPlayer) {
        return { ...state, message: 'Click the enemy board to aim the blast (+ shape).' }
      }
      return useCharacterAbilityOnTarget(state, playerId, row, col, controllingPlayer)
    }
    if (targetMode === 'enemy_chaos_2x2') {
      if (playerId === controllingPlayer) {
        return { ...state, message: 'Click the enemy board to aim the Chaos blast (2×2).' }
      }
      return useCharacterAbilityOnTarget(state, playerId, row, col, controllingPlayer)
    }
    if (targetMode === 'ally_character') {
      if (playerId !== controllingPlayer) {
        return { ...state, message: 'Click one of your characters.' }
      }
      return useCharacterAbilityOnTarget(state, playerId, row, col, controllingPlayer)
    }
    return useCharacterAbilityOnTarget(state, playerId, row, col, controllingPlayer)
  }

  if (state.selectedCard) {
    const template = getTemplate(state.selectedCard.templateId)

    if (template.type === 'character' && playerId === controllingPlayer) {
      return placeCharacterOnBoard(state, playerId, row, col)
    }

    if (template.type === 'attack' && template.effect === 'obscure' && playerId !== controllingPlayer) {
      if (!canTakeTurnAction(state, controllingPlayer)) {
        return { ...state, message: 'You already used your action this turn.' }
      }
      return resolveHandCard(state, controllingPlayer, state.selectedCard, playerId, row, col)
    }

    if (template.type === 'attack' && playerId !== controllingPlayer) {
      if (!canTakeTurnAction(state, controllingPlayer)) {
        return { ...state, message: 'You already used your action this turn.' }
      }
      return resolveHandCard(state, controllingPlayer, state.selectedCard, playerId, row, col)
    }

    if (
      template.type === 'special' &&
      template.effect &&
      TARGETED_SPECIAL_EFFECTS.has(template.effect)
    ) {
      if (template.effect === 'lane_freeze_damage') {
        if (playerId === controllingPlayer) {
          return { ...state, message: 'Click a row on the enemy board (horizontal lane).' }
        }
      } else if (playerId === controllingPlayer) {
        return { ...state, message: 'Click an enemy to target.' }
      }
      if (!canTakeTurnAction(state, controllingPlayer)) {
        return { ...state, message: 'You already used your action this turn.' }
      }
      return resolveHandCard(state, controllingPlayer, state.selectedCard, playerId, row, col)
    }

    if (template.type === 'special' && template.effect !== 'soul_revive' && template.effect !== 'quantity_buff' && template.effect !== 'pickpocket_steal') {
      // other specials handled above
    }

    if (template.type === 'character' && playerId !== controllingPlayer) {
      return { ...state, message: 'Place character cards on your own board.' }
    }

    if ((template.type === 'attack' || (template.type === 'special' && TARGETED_SPECIAL_EFFECTS.has(template.effect ?? undefined))) && playerId === controllingPlayer) {
      return { ...state, message: 'Click an enemy to target.' }
    }
  }

  const player = getPlayer(state.players, playerId)
  const slotIndex = findSlotIndex(player, row, col)
  if (slotIndex !== -1 && player.board[slotIndex].character && playerId === controllingPlayer) {
    return openCharacterAbilities(state, playerId, row, col, controllingPlayer)
  }

  if (state.phase === 'setup' && playerId === controllingPlayer) {
    return removeFromBoard(state, playerId, row, col)
  }

  return state
}

export function useSpecialNoTarget(state: GameState, playerId: 1 | 2): GameState {
  if (!state.selectedCard || !canTakeTurnAction(state, playerId)) {
    return { ...state, message: 'Cannot use that now.' }
  }
  const template = getTemplate(state.selectedCard.templateId)
  if (template.type !== 'special' && template.effect !== 'caffeinated_buff') return state

  if (state.counterPrompt) {
    return { ...state, message: 'Waiting for counter response…' }
  }

  if (template.type === 'special') {
    const countered = tryOpenCounterPrompt(
      state,
      playerId,
      state.selectedCard,
      'special',
      playerId,
      0,
      0,
    )
    if (countered) return countered
  }

  if (template.effect === 'soul_revive' || template.effect === 'quantity_buff' || template.effect === 'pickpocket_steal') {
    return resolveHandCard(state, playerId, state.selectedCard, playerId, 0, 0)
  }
  if (template.effect === 'caffeinated_buff') {
    return resolveHandCard(state, playerId, state.selectedCard, playerId, 0, 0)
  }
  return state
}
