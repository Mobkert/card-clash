export type CardType = 'character' | 'attack' | 'passive' | 'special'

export type TargetType =
  | 'enemy_character'
  | 'enemy_lane'
  | 'enemy_slot'
  | 'enemy_aoe'
  | 'ally_character'
  | 'none'

export type AbilityEffectId =
  | 'damage'
  | 'lane_damage'
  | 'half_damage_debuff'
  | 'sacrifice_nuke'
  | 'web'
  | 'infect'
  | 'freeze_damage'
  | 'burn'
  | 'obscure'
  | 'soul_revive'
  | 'mirror_reactive'
  | 'quantity_buff'
  | 'shard_buff'
  | 'double_trouble_buff'
  | 'trade_buff'
  | 'heal_adjacent'
  | 'sacrifice_heal_ally'
  | 'double_target_damage'
  | 'self_immunity'
  | 'damage_self_heal'
  | 'aoe_plus_damage'
  | 'stare'
  | 'haunt_debuff'
  | 'conditional_lane_damage'
  | 'tornado_move'
  | 'explosive_aoe'
  | 'column_sweep'
  | 'spell_book_reactive'
  | 'caffeinated_buff'
  | 'chain_locked_reactive'
  | 'elemental_immunity_buff'
  | 'moonlight_buff'
  | 'bread_buff'
  | 'haunted_buff'
  | 'chaos_buff'
  | 'musical_show_buff'
  | 'thorn_mail_buff'
  | 'regrowth_buff'
  | 'gamble_buff'
  | 'cannon_damage'
  | 'cobweb'
  | 'lane_freeze_damage'
  | 'cooldown_pause'
  | 'pickpocket_steal'

export interface AbilityDef {
  id: string
  name: string
  description: string
  effect: AbilityEffectId
  damage?: number
  heal?: number
  cooldown: number
  oneTime?: boolean
  targetType: TargetType
  duration?: number
  dotDamage?: number
  vfx?: string
  requiresUses?: { abilityId: string; count: number }
}

export interface CardTemplate {
  id: string
  name: string
  type: CardType
  description: string
  health?: number
  abilities?: AbilityDef[]
  effect?: AbilityEffectId
  damage?: number
  duration?: number
  dotDamage?: number
  buff?: string
  vfx?: string
}

export interface CardInstance {
  instanceId: string
  templateId: string
}

export type StatusType =
  | 'frozen'
  | 'webbed'
  | 'half_damage'
  | 'infect'
  | 'burn'
  | 'attack_immune'
  | 'haunt'
  | 'cooldown_paused'

export interface CharacterStatus {
  type: StatusType
  turnsRemaining: number
  damagePerTurn?: number
  permanent?: boolean
}

export interface BoardCharacter {
  card: CardInstance
  currentHealth: number
  maxHealth: number
  cooldowns: Record<string, number>
  usedOneTime: string[]
  abilityUseCounts: Record<string, number>
  statuses: CharacterStatus[]
}

export interface SlotObscure {
  turnsRemaining: number
  placedBy: 1 | 2
}

export interface BoardSlot {
  row: number
  col: number
  character: BoardCharacter | null
  obscured: SlotObscure | null
}

export interface PassiveEffect {
  card: CardInstance
  turnsRemaining: number
  data?: { tradeMode?: 'damage' | 'cooldown' }
}

export interface PendingBuff {
  type:
    | 'shard'
    | 'double_trouble'
    | 'trade_damage'
    | 'trade_cooldown'
    | 'quantity'
    | 'caffeinated'
    | 'elemental_immunity'
    | 'moonlight'
    | 'bread'
    | 'haunted'
    | 'chaos'
    | 'musical_show'
    | 'thorn_mail'
    | 'regrowth'
    | 'gamble_heads'
    | 'gamble_tails'
  turnsRemaining?: number
  tradeMode?: 'damage' | 'cooldown'
}

export interface LockedCard {
  templateId: string
  turnsRemaining: number
}

export interface PlayerState {
  id: 1 | 2
  deck: CardInstance[]
  hand: CardInstance[]
  board: BoardSlot[]
  passives: PassiveEffect[]
  eliminated: CardInstance[]
  pendingBuffs: PendingBuff[]
  maxPassives: number
  damageTakenMultiplier: number
  damageDealtMultiplier: number
  cooldownReduction: number
}

export type GamePhase = 'setup' | 'playing'

export type TargetMode =
  | 'enemy_character'
  | 'enemy_lane'
  | 'enemy_slot'
  | 'enemy_aoe'
  | 'enemy_chaos_2x2'
  | 'ally_character'
  | 'enemy_character_second'
  | 'enemy_lane_second'
  | 'double_hit_second'

export interface TornadoMoveState {
  playerId: 1 | 2
  card: CardInstance
  targetPlayerId: 1 | 2
  fromRow: number
  fromCol: number
}

export interface HandAttackState {
  playerId: 1 | 2
  card: CardInstance
  targetMode: 'enemy_character' | 'enemy_slot'
  firstTarget: { playerId: 1 | 2; row: number; col: number }
  awaitingDoubleSecond: true
}

export interface CharacterAttackState {
  playerId: 1 | 2
  row: number
  col: number
  abilityId: string | null
  targetMode: TargetMode
  firstTarget?: { playerId: 1 | 2; row: number; col: number }
  awaitingDoubleSecond?: boolean
}

export interface RefillEffect {
  playerId: 1 | 2
  cardsDrawn: number
  drawnInstanceIds: string[]
}

export interface VfxEvent {
  id: string
  vfx: string
  message: string
  playerId?: 1 | 2
  targetPlayerId?: 1 | 2
  lane?: number
  /** Horizontal row index for lane attacks */
  laneRow?: number
  /** Center cell for plus-shaped AOE attacks (e.g. Turd Bomb) */
  aoeCenter?: { row: number; col: number }
  /** Column index for vertical sweep attacks */
  laneCol?: number
  targets?: { row: number; col: number; name: string }[]
}

export interface CounterPrompt {
  defenderId: 1 | 2
  attackerId: 1 | 2
  playedCard: CardInstance
  playedKind: 'attack' | 'special'
  targetPlayerId: 1 | 2
  targetRow: number
  targetCol: number
  deadlineMs: number
}

/** @deprecated use CounterPrompt */
export type MirrorPrompt = CounterPrompt & { attackCard: CardInstance }

export interface TradeChoicePrompt {
  playerId: 1 | 2
  passiveCard: CardInstance
}

export interface GameState {
  phase: GamePhase
  players: [PlayerState, PlayerState]
  activePlayer: 1 | 2
  selectedCard: CardInstance | null
  characterAttack: CharacterAttackState | null
  handAttack: HandAttackState | null
  tornadoMove: TornadoMoveState | null
  abilityModal: { playerId: 1 | 2; row: number; col: number } | null
  tradeChoice: TradeChoicePrompt | null
  counterPrompt: CounterPrompt | null
  lockedCards: LockedCard[]
  skipNextTurnFor: 1 | 2 | null
  bonusTurnFor: 1 | 2 | null
  turnActionUsed: boolean
  refillEffect: RefillEffect | null
  vfxQueue: VfxEvent[]
  message: string
}

export const BOARD_ROWS = 4
export const BOARD_COLS = 2
export const MAX_HAND_SIZE = 6
/** Minimum deck size; buildDeck uses max(DECK_SIZE, card pool length). */
export const DECK_SIZE = 33
export const DEFAULT_MAX_PASSIVES = 1
