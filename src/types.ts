export type BiomeLevelId = "sticky_l1";
export type PoiId = "poi_resin_node" | "poi_fiber_patch" | "poi_stone_node" | "poi_sap_weep" | "poi_resin_hollow" | "poi_dense_pocket";
export type EventId =
  | "ev_sticky_drag"
  | "ev_resin_smear"
  | "ev_slow_going"
  | "ev_loose_fibers"
  | "ev_minor_recovery"
  | "ev_rich_vein_hint"
  | "ev_sticky_snare"
  | "ev_edible_scrap"
  | "ev_efficient_path"
  | "ev_muscle_pull"
  | "ev_dense_find"
  | "ev_preserved_ration"
  | "ev_second_wind"
  | "ev_need_chomper"
  | "ev_need_scoop_for_rations";

export type ResourceId = "resin_glob" | "fiber_clump" | "brittle_stone" | "mat_wing_membrane" | "mat_crystallised_wax";

// ─── Markers, Trophies, Gem-Embedded Trophies, Biomass ───────────────────────
export type MarkerItemId =
  | "marker_exploration"
  | "marker_harvesting"
  | "marker_crafting"
  | "marker_survival"
  | "marker_combat"
  | "marker_loot";

export type TrophyItemId =
  | "trophy_exploration"
  | "trophy_harvesting"
  | "trophy_crafting"
  | "trophy_survival"
  | "trophy_combat"
  | "trophy_loot";

export type GemTrophyItemId =
  | "gem_trophy_exploration"
  | "gem_trophy_harvesting"
  | "gem_trophy_crafting"
  | "gem_trophy_survival"
  | "gem_trophy_combat"
  | "gem_trophy_loot";

export type SpecialItemId = "biomass";

export type ProgressionItemId = MarkerItemId | TrophyItemId | GemTrophyItemId | SpecialItemId;
export type FoodId = "food_soft_sap" | "food_resin_chew" | "food_dense_ration" | "food_moth_flesh" | "food_moth_paste" | "food_gloop_wax";

// ─── Combat ───────────────────────────────────────────────────────────────────

export type CreatureId = "creature_gloop_moth";

export type SituationId =
  | "moth_hovering"
  | "moth_descending"
  | "moth_startled"
  | "moth_wax_pooling"
  | "moth_depleted"
  | "moth_thrashing";

export type MoveId =
  | "jab_wing"
  | "comb_glands"
  | "scoop_pooled"
  | "smash_body"
  | "drill_thorax"
  | "lace_twig"
  | "laced_jab"
  | "expose_and_strike"
  | "drill_resonance"
  | "eat_wax_raw"
  | "eat_soft_tissue"
  | "flee";

export type BattleFlag =
  | "wax_intact"     // wax has NOT been drained — default at battle start
  | "wax_drained"    // comb_glands used
  | "wax_laced"      // twig coated, ready for laced_jab
  | "wax_consumed"   // raw wax eaten mid-battle
  | "wing_torn"      // jab_wing or expose_and_strike used
  | "thorax_open";   // drill_thorax used

export type BattleEndReason = "collapsed" | "disarmed" | "fled";

export interface CounterattackDef {
  triggerFlag: BattleFlag;   // counterattack fires if this flag is set when move resolves
  staminaPenalty: number;
  contaminatesFood: boolean;
  flavor: string;
}

export interface MoveEffect {
  composureDelta: [number, number];    // [min, max] — scaled by proficiency
  integrityDelta: number;              // fixed
  staminaCost: number;                 // positive = costs stamina
  staminaRestore?: number;             // mid-battle stamina restore
  satietyRestore?: number;             // mid-battle satiety restore
  setsFlags?: BattleFlag[];
  clearsFlags?: BattleFlag[];
  midBattleDrop?: { id: ResourceId | FoodId; qty: number };
  counterattack?: CounterattackDef;
  situationNext: SituationId | null;   // null = stays in current situation
  proficiencyMethod?: HarvestMethodId; // which XP scales composure damage
}

export interface PlayerMove {
  id: MoveId;
  label: string;                          // flavourful button text
  tools: [] | [ItemId] | [ItemId, ItemId];// empty = no tool needed
  requiredFlags?: BattleFlag[];
  forbiddenFlags?: BattleFlag[];
  requiredSituation?: SituationId;        // if set, only available in this situation
  effect: MoveEffect;
}

export interface BattleState {
  creatureId: CreatureId;
  composure: number;
  integrity: number;
  flags: BattleFlag[];
  situation: SituationId;
  turn: number;
  movesUsed: MoveId[];                    // for novelty tracking
  doubleCombosLanded: number;
  staminaCostAccrued: number;
  midBattleDrops: { id: ResourceId | FoodId; qty: number }[];
  midBattleSatietyRestored: number;
  midBattleStaminaRestored: number;
}

export interface BattleResult {
  creatureId: CreatureId;
  endReason: BattleEndReason;
  finalComposure: number;
  finalIntegrity: number;
  flags: BattleFlag[];
  movesUsed: MoveId[];
  doubleCombosLanded: number;
  netStaminaCost: number;                 // after novelty refund
  satietyRestoredMidBattle: number;
  staminaRestoredMidBattle: number;
  midBattleDrops: { id: ResourceId | FoodId; qty: number }[];
  corpseDrops: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[];
  foodContaminated: boolean;
}
export type HarvestMethodId = "poke" | "smash" | "tease" | "drill" | "scoop";

export type ItemId =
  | "eq_tail_curler"
  | "eq_chomper"
  | "eq_tinker_shaft"
  | "eq_pointed_twig"
  | "eq_crude_hammerhead"
  | "eq_fiber_comb"
  | "eq_hand_drill"
  | "eq_sticky_scoop"
  | "eq_standard_shoe"
  | MarkerItemId
  | TrophyItemId
  | GemTrophyItemId
  | SpecialItemId;

export type Quality = "common" | "uncommon";

export interface BlotState {
  poiId: PoiId;
  quality: Quality;
  variant: number;
  harvestCharges?: number;
  maxHarvestCharges?: number;
  sapRemaining?: number;
  storableRemaining?: number;
  storableFood?: FoodId;
}

export interface StaminaRecoveryEntry {
  itemId: ItemId;
  name: string;
  recovered: number;
}

export type Screen =
  | "HUB"
  | "PREVIEW_JOURNEY"
  | "SUMMARY_JOURNEY"
  | "PREVIEW_HARVEST"
  | "SUMMARY_HARVEST"
  | "CRAFT_MENU"
  | "PREVIEW_CRAFT"
  | "SUMMARY_CRAFT"
  | "EXHAUSTED"
  | "PREVIEW_RECOVER"
  | "SUMMARY_RECOVER"
  | "DEAD"
  | "INVENTORY"
  | "SKILLS"
  | "BATTLE"
  | "SUMMARY_BATTLE"
  | "MARKS"
  | "GATE"
  | "PHASE_COMPLETE";

export interface PlayerStats {
  satiety: number;
  stamina: number;
  maxSatiety: number;
  maxStamina: number;
}

export interface PlayerEquipmentState {
  tailSlots: [ItemId | null, ItemId | null];
  shoe: ItemId;
}

export interface InventoryStack {
  id: ItemId | ResourceId | FoodId;
  qty: number;
  freshness?: number[];
}

// ─── Blot Marks (achievements) ────────────────────────────────────────────────

export type BlotMarkId =
  // Exploration
  | "mark_first_journey"
  | "mark_first_find_food"
  | "mark_visit_all_poi"
  // Harvesting
  | "mark_first_harvest"
  | "mark_all_methods"
  | "mark_harvest_proficiency"
  | "mark_all_proficiency"
  // Crafting
  | "mark_first_craft"
  | "mark_craft_all_tools"
  | "mark_craft_equipment"
  // Survival
  | "mark_first_recover"
  | "mark_low_satiety_survive"
  | "mark_eat_on_site"
  // Combat
  | "mark_first_encounter"
  | "mark_first_hunt"
  | "mark_first_win"
  | "mark_use_combo"
  | "mark_novelty_2"
  | "mark_novelty_4"
  | "mark_drill_resonance"
  | "mark_high_integrity_win"
  | "mark_avoid_moth"
  // Loot
  | "mark_first_wing_membrane"
  | "mark_first_crystallised_wax"
  | "mark_full_corpse";

export type BlotMarkCategory = "Exploration" | "Harvesting" | "Crafting" | "Survival" | "Combat" | "Loot";

export interface BlotMark {
  id: BlotMarkId;
  category: BlotMarkCategory;
  title: string;
  flavour: string;
}

/** Per-run tracking state for marks */
export interface BlotMarkState {
  earned: Partial<Record<BlotMarkId, true>>;
  revealed: Partial<Record<BlotMarkId, true>>;
  // Condition tracking
  poisVisited: Set<PoiId>;
  distinctMethodsUsed: Set<HarvestMethodId>;
  lowestSatietySeen: number;
  hasSeenLowSatiety: boolean; // crossed 30% at least once
  toolsCrafted: Set<string>; // ItemIds of harvesting tools crafted
  // Marker claim tracking — which gate marks have had their Trophy/Marker deposited
  claimedMarkers: Partial<Record<BlotMarkId, true>>;
  // Gate state
  gateDiscovered: boolean;
  gateUnlocked: boolean; // all 3 required gem trophies slotted
  gateSlottedTrophies: GemTrophyItemId[]; // which gem trophies have been embedded
}

export interface PlayerState {
  biomeLevelId: BiomeLevelId;
  stats: PlayerStats;
  equipment: PlayerEquipmentState;
  inventory: InventoryStack[];
  xp: Record<HarvestMethodId, number>;
  /** Which harvest methods have been tried at each POI — keyed by PoiId */
  toolDiscovery: Record<string, HarvestMethodId[]>;
}

export interface JourneyPreview {
  mode: "explore" | "findFood";
  stepsRange: [number, number];
  satietyCostRange: [number, number];
  satietyRestoredRange: [number, number];
  staminaCostRange: [number, number];
  staminaRecoveryPerPeriodRange: [number, number];
  estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[];
  poi: { id: PoiId; quality: Quality };
  surfacedEvents: EventId[];
  blot: BlotState;
  mothEncountered?: boolean;
}

export interface JourneyResult {
  mode: "explore" | "findFood";
  steps: number;
  surfacedEvents: EventId[];
  eventEffects: Record<EventId, { satietyDelta: number; staminaDelta: number; gained: { id: ResourceId | FoodId; qty: number }[] }>;
  satietyDelta: number;
  satietyRestoredByChomper: number;
  staminaDelta: number;
  staminaRecovery: StaminaRecoveryEntry[];
  poi: { id: PoiId; quality: Quality };
  gained: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[];
  foodConsumed: { foodId: FoodId; units: number }[];
  softSapEaten?: { satietyRestored: number; units: number };
  blot: BlotState;
  outcome: "ok" | "exhausted" | "dead";
  mothEncountered?: boolean;
  mothDefeated?: boolean;  // set after hunt, replaces encounter line
}

export interface HarvestPreview {
  poiId: PoiId;
  method: HarvestMethodId;
  periodsRange: [number, number];
  satietyCostRange: [number, number];
  satietyRestoredRange: [number, number];
  staminaCostRange: [number, number];
  staminaRecoveryPerPeriodRange: [number, number];
  yieldRange: [number, number];
  estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[];
  efficiencyLabel: string;
}

export interface HarvestResult {
  poiId: PoiId;
  method: HarvestMethodId;
  periods: number;
  satietyDelta: number;
  satietyRestoredByChomper: number;
  staminaDelta: number;
  staminaRecovery: StaminaRecoveryEntry[];
  gained: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[];
  xpGained: number;
  foodConsumed: { foodId: FoodId; units: number }[];
  outcome: "ok" | "exhausted" | "dead";
  message?: string;
}

export interface CraftPreview {
  recipeId: string;
  craftPeriods: number;
  satietyCost: number;
  satietyRestoredRange: [number, number];
  staminaCost: number;
  staminaRecoveryTotal: number;
  estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[];
}

export interface CraftResult {
  recipeId: string;
  success: boolean;
  failReason?: "missing_resources" | "exhausted" | "dead";
  satietyDelta: number;
  satietyRestoredByChomper: number;
  staminaDelta: number;
  staminaRecovery: StaminaRecoveryEntry[];
  foodConsumed: { foodId: FoodId; units: number }[];
  crafted?: { itemId: ItemId; qty: number };
}

export interface EatSapResult {
  unitsEaten: number;
  satietyRestored: number;
  staminaCost: number;
  outcome: "ok" | "exhausted" | "dead";
}

export interface HarvestStorableResult {
  foodId: FoodId;
  qty: number;
  freshness: number[];
  satietyCost: number;
  staminaCost: number;
  staminaRecovery: StaminaRecoveryEntry[];
  foodConsumed: { foodId: FoodId; units: number }[];
  xpGained: number;
  outcome: "ok" | "exhausted" | "dead";
}
