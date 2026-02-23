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

export type ResourceId = "resin_glob" | "fiber_clump" | "brittle_stone";
export type FoodId = "food_soft_sap" | "food_resin_chew" | "food_dense_ration";
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
  | "eq_standard_shoe";

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
  | "SKILLS";

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

export interface PlayerState {
  biomeLevelId: BiomeLevelId;
  stats: PlayerStats;
  equipment: PlayerEquipmentState;
  inventory: InventoryStack[];
  xp: Record<HarvestMethodId, number>;
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
