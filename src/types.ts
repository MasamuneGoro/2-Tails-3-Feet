export type BiomeLevelId = "sticky_l1";
export type PoiId = "poi_resin_node" | "poi_fiber_patch" | "poi_stone_node" | "poi_food_source";
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
  | "ev_tool_strain"
  | "ev_dense_find"
  | "ev_preserved_ration"
  | "ev_second_wind";

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

export type Screen =
  | "HUB"
  | "INVENTORY"
  | "PREVIEW_JOURNEY"
  | "SUMMARY_JOURNEY"
  | "POI"
  | "CHOOSE_METHOD"
  | "PREVIEW_HARVEST"
  | "SUMMARY_HARVEST"
  | "CRAFT_MENU"
  | "PREVIEW_CRAFT"
  | "SUMMARY_CRAFT"
  | "EXHAUSTED"
  | "PREVIEW_RECOVER"
  | "SUMMARY_RECOVER"
  | "DEAD";

export interface PlayerStats {
  hunger: number; // 0..maxHunger (dies when >= maxHunger)
  fatigue: number; // 0..maxFatigue (exhausted when >= maxFatigue)
  maxHunger: number;
  maxFatigue: number;
}

export interface PlayerEquipmentState {
  tailSlots: [ItemId | null, ItemId | null];
  shoe: ItemId;
}

export interface InventoryStack {
  id: ItemId | ResourceId | FoodId;
  qty: number;
  // for storable food units: remaining freshness "charges" for each unit
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
  hungerIncreaseRange: [number, number];
  fatigueIncreaseRange: [number, number];
  estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[];
  poi: { id: PoiId; quality: Quality };
  surfacedEvents: EventId[];
}

export interface JourneyResult {
  mode: "explore" | "findFood";
  steps: number;
  surfacedEvents: EventId[];
  hungerDelta: number; // + means hunger increased
  fatigueDelta: number;
  poi: { id: PoiId; quality: Quality };
  gained: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[];
  foodConsumed: { foodId: FoodId; units: number }[];
  outcome: "ok" | "exhausted" | "dead";
}

export interface HarvestPreview {
  poiId: PoiId;
  method: HarvestMethodId;
  periodsRange: [number, number];
  hungerIncreaseRange: [number, number];
  fatigueIncreaseRange: [number, number];
  yieldRange: [number, number];
  estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[];
}

export interface HarvestResult {
  poiId: PoiId;
  method: HarvestMethodId;
  periods: number;
  hungerDelta: number;
  fatigueDelta: number;
  gained: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[];
  xpGained: number;
  foodConsumed: { foodId: FoodId; units: number }[];
  outcome: "ok" | "exhausted" | "dead";
  message?: string;
}

export interface CraftPreview {
  recipeId: string;
  craftPeriods: number;
  hungerIncrease: number;
  fatigueIncrease: number;
  estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[];
}

export interface CraftResult {
  recipeId: string;
  success: boolean;
  failReason?: "missing_resources" | "exhausted" | "dead";
  hungerDelta: number;
  fatigueDelta: number;
  foodConsumed: { foodId: FoodId; units: number }[];
  crafted?: { itemId: ItemId; qty: number };
}
