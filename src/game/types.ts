export type CardType = 'character' | 'attack' | 'passive' | 'special'

export type PlayerId = 1 | 2 | 3
export type PlayerCount = 2 | 3

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
  /** Player who applied this status — used for objective damage credit on DOT/recoil. */
  appliedBy?: PlayerId
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
  placedBy: PlayerId
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
  id: PlayerId
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
  objectives: PlayerObjective[]
  objectiveStats: PlayerObjectiveStats
}

export type GamePhase = 'setup' | 'objectives' | 'objective_reveal' | 'playing' | 'finished'

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
  playerId: PlayerId
  card: CardInstance
  targetPlayerId: PlayerId
  fromRow: number
  fromCol: number
}

export interface HandAttackState {
  playerId: PlayerId
  card: CardInstance
  targetMode: 'enemy_character' | 'enemy_slot'
  firstTarget: { playerId: PlayerId; row: number; col: number }
  awaitingDoubleSecond: true
}

export interface CharacterAttackState {
  playerId: PlayerId
  row: number
  col: number
  abilityId: string | null
  targetMode: TargetMode
  firstTarget?: { playerId: PlayerId; row: number; col: number }
  awaitingDoubleSecond?: boolean
}

export interface RefillEffect {
  playerId: PlayerId
  cardsDrawn: number
  drawnInstanceIds: string[]
}

export interface VfxEvent {
  id: string
  vfx: string
  message: string
  playerId?: PlayerId
  targetPlayerId?: PlayerId
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
  defenderId: PlayerId
  attackerId: PlayerId
  playedCard: CardInstance
  playedKind: 'attack' | 'special'
  targetPlayerId: PlayerId
  targetRow: number
  targetCol: number
  deadlineMs: number
}

/** @deprecated use CounterPrompt */
export type MirrorPrompt = CounterPrompt & { attackCard: CardInstance }

export interface PlayerObjective {
  id: string
  label: string
  target: number
  progress: number
  completed: boolean
}

export interface PlayerObjectiveStats {
  eliminations: number
  attacks_played: number
  specials_played: number
  damage_dealt: number
  abilities_used: number
  chars_placed: number
}

export interface TradeChoicePrompt {
  playerId: PlayerId
  passiveCard: CardInstance
}

export interface GameState {
  phase: GamePhase
  playerCount: PlayerCount
  players: PlayerState[]
  activePlayer: PlayerId
  selectedCard: CardInstance | null
  characterAttack: CharacterAttackState | null
  handAttack: HandAttackState | null
  tornadoMove: TornadoMoveState | null
  abilityModal: { playerId: PlayerId; row: number; col: number } | null
  tradeChoice: TradeChoicePrompt | null
  counterPrompt: CounterPrompt | null
  lockedCards: LockedCard[]
  skipNextTurnFor: PlayerId | null
  bonusTurnFor: PlayerId | null
  turnActionUsed: boolean
  refillEffect: RefillEffect | null
  vfxQueue: VfxEvent[]
  message: string
  objectiveDraftOptions: PlayerObjective[]
  objectivePicks: Record<PlayerId, string | null>
  objectiveRandomPick: string | null
  objectivesAck: Record<PlayerId, boolean>
  objectivesDeadlineMs: number | null
  winner: PlayerId | null
}

export const BOARD_ROWS = 4
export const BOARD_COLS = 2
export const MAX_HAND_SIZE = 6
/** Minimum deck size; buildDeck uses max(DECK_SIZE, card pool length). */
export const DECK_SIZE = 33
export const DEFAULT_MAX_PASSIVES = 1
