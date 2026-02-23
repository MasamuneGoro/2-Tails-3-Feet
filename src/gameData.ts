import type {
  BiomeLevelId,
  EventId,
  FoodId,
  HarvestMethodId,
  ItemId,
  PoiId,
  Quality,
  ResourceId,
} from "./types";

export const BIOME_LEVEL: {
  id: BiomeLevelId;
  name: string;
  exploreStepsRange: [number, number];
  foodStepsRange: [number, number];
  satietyPerStep: number;
  staminaPerStep: number;
  poiWeightsExplore: Record<PoiId, number>;
  poiWeightsFood: Record<PoiId, number>;
  eventProfile: {
    commonChance: number;
    uncommonChance: number;
    rareChance: number;
    surfacedEventsMax: number;
    explorePools: { common: EventId[]; uncommon: EventId[]; rare: EventId[] };
    foodPools: { common: EventId[]; uncommon: EventId[]; rare: EventId[] };
  };
} = {
  id: "sticky_l1",
  name: "Sticky Biome (L1)",
  exploreStepsRange: [75, 125],
  foodStepsRange: [63, 100],
  satietyPerStep: 1,
  staminaPerStep: 5,
  poiWeightsExplore: {
    poi_resin_node: 40,
    poi_fiber_patch: 35,
    poi_stone_node: 25,
    poi_sap_weep: 0,
    poi_resin_hollow: 0,
    poi_dense_pocket: 0,
  },
  poiWeightsFood: {
    poi_sap_weep: 50,
    poi_resin_hollow: 35,
    poi_dense_pocket: 15,
    poi_resin_node: 0,
    poi_fiber_patch: 0,
    poi_stone_node: 0,
  },
  eventProfile: {
    commonChance: 0.2,
    uncommonChance: 0.08,
    rareChance: 0.02,
    surfacedEventsMax: 2,
    explorePools: {
      common: ["ev_sticky_drag", "ev_resin_smear", "ev_slow_going", "ev_loose_fibers", "ev_minor_recovery"],
      uncommon: ["ev_rich_vein_hint", "ev_sticky_snare", "ev_edible_scrap", "ev_efficient_path", "ev_muscle_pull"],
      rare: ["ev_dense_find", "ev_preserved_ration", "ev_second_wind"],
    },
    foodPools: {
      common: ["ev_sticky_drag", "ev_resin_smear", "ev_slow_going", "ev_loose_fibers", "ev_minor_recovery"],
      uncommon: ["ev_sticky_snare", "ev_edible_scrap", "ev_efficient_path", "ev_muscle_pull"],
      rare: ["ev_preserved_ration", "ev_second_wind"],
    },
  },
};

export const EVENTS: Record<EventId, {
  id: EventId;
  name: string;
  text: string;
  tag: "common" | "uncommon" | "rare";
  netEffect: string;
}> = {
  ev_sticky_drag:    { id: "ev_sticky_drag",    name: "Sticky Drag",       tag: "common",   text: "The ground wants to keep you. It's almost flattering.",                                             netEffect: "+20 steps (−20 satiety, −20 stamina)" },
  ev_resin_smear:    { id: "ev_resin_smear",    name: "Resin Smear",       tag: "common",   text: "Something warm and gloopy splashes your tails. It smells suspiciously edible.",                    netEffect: "+30 satiety" },
  ev_slow_going:     { id: "ev_slow_going",     name: "Slow Going",        tag: "common",   text: "Every step is a negotiation. The biome is winning.",                                               netEffect: "−20 stamina" },
  ev_loose_fibers:   { id: "ev_loose_fibers",   name: "Loose Fibers",      tag: "common",   text: "Wispy strands snag on everything. Annoying now, useful later — maybe.",                            netEffect: "+1 Fiber Clump" },
  ev_minor_recovery: { id: "ev_minor_recovery", name: "Micro-Second Wind", tag: "common",   text: "Your body finds a sneaky little rhythm. Don't question it.",                                       netEffect: "+20 stamina" },
  ev_rich_vein_hint: { id: "ev_rich_vein_hint", name: "Rich Vein Hint",    tag: "uncommon", text: "Something dense pulses underfoot. It knows you noticed.",                                          netEffect: "+1 Resin Glob" },
  ev_sticky_snare:   { id: "ev_sticky_snare",   name: "Sticky Snare",      tag: "uncommon", text: "The ground grabs a tail and yanks. You pull free, but it costs you.",                             netEffect: "−30 stamina" },
  ev_edible_scrap:   { id: "ev_edible_scrap",   name: "Edible Scrap",      tag: "uncommon", text: "A small mystery morsel. Probably fine. Definitely eaten.",                                         netEffect: "+80 satiety" },
  ev_efficient_path: { id: "ev_efficient_path", name: "Efficient Path",    tag: "uncommon", text: "A ribbon of firm ground. You glide through it like you planned this all along.",                   netEffect: "+30 stamina" },
  ev_muscle_pull:    { id: "ev_muscle_pull",    name: "Muscle Pull",       tag: "uncommon", text: "Something twangs in a tail you didn't know you had. You keep moving, but slower.",                 netEffect: "−20 stamina, −20 satiety" },
  ev_dense_find:     { id: "ev_dense_find",     name: "Dense Find",        tag: "rare",     text: "A pocket of material so concentrated it feels like a secret.",                                     netEffect: "+2 Resin Glob, +1 Brittle Stone" },
  ev_preserved_ration:{ id: "ev_preserved_ration", name: "Preserved Ration", tag: "rare",  text: "A wrapped lump that shouldn't exist here. You don't ask questions.",                               netEffect: "+1 Dense Ration" },
  ev_second_wind:    { id: "ev_second_wind",    name: "Second Wind",       tag: "rare",     text: "Your body clicks into a higher gear entirely. Savour it — it won't last.",                        netEffect: "+60 stamina" },
  ev_need_chomper: {
    id: "ev_need_chomper",
    name: "Missed Snack",
    text: "Something soft and edible sits right there. Your tails wave uselessly. You needed a Chomper.",
    tag: "common",
    netEffect: "no effect",
  },
  ev_need_scoop_for_rations: {
    id: "ev_need_scoop_for_rations",
    name: "Rations Slip Away",
    text: "The good stuff sits deep in a sticky pool, laughing at you. A Sticky Scoop would have helped.",
    tag: "common",
    netEffect: "no effect",
  },
};

export const POIS: Record<
  PoiId,
  {
    id: PoiId;
    name: string;
    flavor: string;
    qualityTiers: Quality[];
    kind: "harvest" | "food";
    resourceId?: ResourceId;
    baseYieldRange?: [number, number];
    methodTuning?: Record<HarvestMethodId, { periodsRange: [number, number]; staminaPerPeriod: number }>;
    methodRank?: Record<HarvestMethodId, "best" | "good" | "ok" | "weak" | "veryWeak" | "wasteful">;
    efficiencyMultipliers?: Record<string, number>;
    foodSpec?: {
      sapQtyRange: [number, number];
      storableQtyRange: [number, number];
      storableFood: FoodId;
      forageSatietyCostPerPeriod: number;
      forageStaminaCostPerPeriod: number;
    };
  }
> = {
  poi_resin_node: {
    id: "poi_resin_node",
    name: "Resin Node",
    flavor: "A bulging blister of sap, pulsing like it's got somewhere to be.",
    qualityTiers: ["common", "uncommon"],
    kind: "harvest",
    resourceId: "resin_glob",
    baseYieldRange: [2, 4],
    methodTuning: {
      scoop: { periodsRange: [6, 8], staminaPerPeriod: 10 },
      poke: { periodsRange: [7, 9], staminaPerPeriod: 10 },
      drill: { periodsRange: [8, 10], staminaPerPeriod: 20 },
      tease: { periodsRange: [10, 12], staminaPerPeriod: 10 },
      smash: { periodsRange: [4, 6], staminaPerPeriod: 30 },
    },
    methodRank: { scoop: "best", poke: "good", drill: "ok", tease: "weak", smash: "wasteful" },
    efficiencyMultipliers: { best: 1.25, good: 1.0, ok: 0.85, weak: 0.6, veryWeak: 0.35, wasteful: 0.4 },
  },
  poi_fiber_patch: {
    id: "poi_fiber_patch",
    name: "Fiber Patch",
    flavor: "A tangled mat of strands clinging to the earth like it lost a bet.",
    qualityTiers: ["common", "uncommon"],
    kind: "harvest",
    resourceId: "fiber_clump",
    baseYieldRange: [2, 4],
    methodTuning: {
      tease: { periodsRange: [6, 8], staminaPerPeriod: 10 },
      poke: { periodsRange: [7, 9], staminaPerPeriod: 10 },
      scoop: { periodsRange: [8, 10], staminaPerPeriod: 10 },
      drill: { periodsRange: [9, 11], staminaPerPeriod: 20 },
      smash: { periodsRange: [4, 6], staminaPerPeriod: 30 },
    },
    methodRank: { tease: "best", poke: "good", scoop: "ok", drill: "weak", smash: "wasteful" },
    efficiencyMultipliers: { best: 1.25, good: 1.0, ok: 0.85, weak: 0.6, veryWeak: 0.35, wasteful: 0.4 },
  },
  poi_stone_node: {
    id: "poi_stone_node",
    name: "Stone Node",
    flavor: "Brittle rock poking up through the goo, looking very pleased with itself.",
    qualityTiers: ["common", "uncommon"],
    kind: "harvest",
    resourceId: "brittle_stone",
    baseYieldRange: [3, 5],
    methodTuning: {
      smash: { periodsRange: [5, 7], staminaPerPeriod: 22 },
      drill: { periodsRange: [7, 9], staminaPerPeriod: 14 },
      poke: { periodsRange: [10, 12], staminaPerPeriod: 10 },
      tease: { periodsRange: [12, 14], staminaPerPeriod: 10 },
      scoop: { periodsRange: [12, 14], staminaPerPeriod: 10 },
    },
    methodRank: { smash: "best", drill: "good", poke: "weak", tease: "veryWeak", scoop: "veryWeak" },
    efficiencyMultipliers: { best: 1.25, good: 1.0, ok: 0.85, weak: 0.6, veryWeak: 0.35, wasteful: 0.25 },
  },
  poi_sap_weep: {
    id: "poi_sap_weep",
    name: "Sap Weep",
    flavor: "The ground here is basically crying. Warm, gloopy tears. Probably edible.",
    qualityTiers: ["common", "uncommon"],
    kind: "food",
    foodSpec: {
      sapQtyRange: [3, 6] as [number, number],
      storableQtyRange: [0, 4] as [number, number],
      storableFood: "food_resin_chew" as FoodId,
      forageSatietyCostPerPeriod: 10,
      forageStaminaCostPerPeriod: 10,
    },
  },
  poi_resin_hollow: {
    id: "poi_resin_hollow",
    name: "Resin Hollow",
    flavor: "A sunken pocket stuffed with chewable lumps. Something lived here once. It left snacks.",
    qualityTiers: ["common", "uncommon"],
    kind: "food",
    foodSpec: {
      sapQtyRange: [1, 3] as [number, number],
      storableQtyRange: [8, 16] as [number, number],
      storableFood: "food_resin_chew" as FoodId,
      forageSatietyCostPerPeriod: 10,
      forageStaminaCostPerPeriod: 10,
    },
  },
  poi_dense_pocket: {
    id: "poi_dense_pocket",
    name: "Dense Pocket",
    flavor: "Suspiciously compact. Days of eating if you had the right tools — and the patience.",
    qualityTiers: ["common", "uncommon"],
    kind: "food",
    foodSpec: {
      sapQtyRange: [1, 2] as [number, number],
      storableQtyRange: [3, 9] as [number, number],
      storableFood: "food_dense_ration" as FoodId,
      forageSatietyCostPerPeriod: 10,
      forageStaminaCostPerPeriod: 20,
    },
  },
};

export const RESOURCES: Record<ResourceId, { id: ResourceId; name: string; flavor: string }> = {
  resin_glob: { id: "resin_glob", name: "Resin Glob", flavor: "Sticky, clingy, and oddly proud of it." },
  fiber_clump: { id: "fiber_clump", name: "Fiber Clump", flavor: "Tough little strands that lash, bind, and occasionally tickle." },
  brittle_stone: { id: "brittle_stone", name: "Brittle Stone", flavor: "Cracks if you look at it wrong, but holds a surprisingly mean edge." },
};

export const FOODS: Record<
  FoodId,
  { id: FoodId; name: string; satietyRestored: number; storable: boolean; freshnessRange?: [number, number]; flavor: string }
> = {
  food_soft_sap: { id: "food_soft_sap", name: "Soft Sap", satietyRestored: 150, storable: false, flavor: "Warm, gloopy, and barely qualifies as food. Your belly doesn't care." },
  food_resin_chew: { id: "food_resin_chew", name: "Resin Chew", satietyRestored: 40, storable: true, freshnessRange: [25, 34], flavor: "Chewy in a way that makes you think. Not about what's in it, though." },
  food_dense_ration: { id: "food_dense_ration", name: "Dense Ration", satietyRestored: 120, storable: true, freshnessRange: [39, 59], flavor: "Suspiciously well-preserved. You decide gratitude is the right response." },
};

export const ITEMS: Record<
  ItemId,
  {
    id: ItemId;
    name: string;
    slot: "tail" | "shoe";
    flavor: string;
    effects?: {
      staminaRecoveryPerPeriod?: number;
      staminaRecoveryPerPeriodWorking?: number;
      chomper?: { enableImmediateFoodAtPoi: boolean; autoConsumeStorableFoodPerPeriod: boolean; biteSize?: number };
    };
    harvestingMethod?: HarvestMethodId;
    isCraftingTool?: boolean;
    unlocksRecipes?: string[];
  }
> = {
  eq_tail_curler: {
    id: "eq_tail_curler",
    name: "Tail Curler",
    slot: "tail",
    flavor: "A coiled attachment that hums faintly when you rest. Something about it helps.",
    effects: { staminaRecoveryPerPeriod: 10, staminaRecoveryPerPeriodWorking: 5 },
  },
  eq_chomper: {
    id: "eq_chomper",
    name: "Chomper",
    slot: "tail",
    flavor: "Snappy, eager, and absolutely not picky. It will eat things before you've even decided.",
    effects: { chomper: { enableImmediateFoodAtPoi: true, autoConsumeStorableFoodPerPeriod: true, biteSize: 2 } },
  },
  eq_tinker_shaft: {
    id: "eq_tinker_shaft",
    name: "Tinker Shaft",
    slot: "tail",
    flavor: "A fiddly little shaft covered in crude fittings. In the right tail, it makes things.",
    isCraftingTool: true,
    unlocksRecipes: [
      "rcp_crude_hammerhead",
      "rcp_hand_drill",
      "rcp_fiber_comb",
      "rcp_sticky_scoop",
      "rcp_chomper",
      "rcp_tail_curler",
    ],
  },
  eq_pointed_twig: { id: "eq_pointed_twig", name: "Pointed Twig", slot: "tail", flavor: "A stick you sharpened with another stick. Humble origins, honest results.", harvestingMethod: "poke" },
  eq_crude_hammerhead: { id: "eq_crude_hammerhead", name: "Crude Hammerhead", slot: "tail", flavor: "Heavy, blunt, and enthusiastic. It doesn't ask questions.", harvestingMethod: "smash" },
  eq_fiber_comb: { id: "eq_fiber_comb", name: "Fiber Comb", slot: "tail", flavor: "Teeth that coax rather than force. The fibers respect it, mostly.", harvestingMethod: "tease" },
  eq_hand_drill: { id: "eq_hand_drill", name: "Mini Drill", slot: "tail", flavor: "Tiny, tireless, and takes it personally when the rock doesn't cooperate.", harvestingMethod: "drill" },
  eq_sticky_scoop: { id: "eq_sticky_scoop", name: "Sticky Scoop", slot: "tail", flavor: "A shallow cup that gathers soft things before they escape. Very dedicated.", harvestingMethod: "scoop" },
  eq_standard_shoe: { id: "eq_standard_shoe", name: "Standard Grip Shoe", slot: "shoe", flavor: "Three feet, one shoe each. Nothing fancy — just enough to keep you upright." },
};

export const RECIPES: Record<
  string,
  {
    id: string;
    name: string;
    output: { itemId: ItemId; qty: number };
    inputs: { id: ResourceId; qty: number }[];
    craftPeriods: number;
    satietyPerPeriod: number;
    staminaPerPeriod: number;
    requiresTinker: boolean;
  }
> = {
  rcp_fiber_comb: {
    id: "rcp_fiber_comb",
    name: "Fiber Comb",
    output: { itemId: "eq_fiber_comb", qty: 1 },
    inputs: [{ id: "fiber_clump", qty: 3 }, { id: "resin_glob", qty: 1 }],
    craftPeriods: 4,
    satietyPerPeriod: 10,
    staminaPerPeriod: 20,
    requiresTinker: false,
  },
  rcp_sticky_scoop: {
    id: "rcp_sticky_scoop",
    name: "Sticky Scoop",
    output: { itemId: "eq_sticky_scoop", qty: 1 },
    inputs: [{ id: "resin_glob", qty: 2 }, { id: "fiber_clump", qty: 1 }],
    craftPeriods: 4,
    satietyPerPeriod: 10,
    staminaPerPeriod: 20,
    requiresTinker: false,
  },
  rcp_crude_hammerhead: {
    id: "rcp_crude_hammerhead",
    name: "Crude Hammerhead",
    output: { itemId: "eq_crude_hammerhead", qty: 1 },
    inputs: [{ id: "brittle_stone", qty: 2 }, { id: "fiber_clump", qty: 2 }],
    craftPeriods: 8,
    satietyPerPeriod: 10,
    staminaPerPeriod: 20,
    requiresTinker: true,
  },
  rcp_hand_drill: {
    id: "rcp_hand_drill",
    name: "Mini Drill",
    output: { itemId: "eq_hand_drill", qty: 1 },
    inputs: [{ id: "brittle_stone", qty: 2 }, { id: "resin_glob", qty: 1 }, { id: "fiber_clump", qty: 1 }],
    craftPeriods: 8,
    satietyPerPeriod: 10,
    staminaPerPeriod: 20,
    requiresTinker: true,
  },
  rcp_chomper: {
    id: "rcp_chomper",
    name: "Chomper",
    output: { itemId: "eq_chomper", qty: 1 },
    inputs: [{ id: "resin_glob", qty: 3 }, { id: "fiber_clump", qty: 2 }, { id: "brittle_stone", qty: 2 }],
    craftPeriods: 10,
    satietyPerPeriod: 10,
    staminaPerPeriod: 20,
    requiresTinker: true,
  },
  rcp_tail_curler: {
    id: "rcp_tail_curler",
    name: "Tail Curler",
    output: { itemId: "eq_tail_curler", qty: 1 },
    inputs: [{ id: "fiber_clump", qty: 4 }, { id: "resin_glob", qty: 1 }, { id: "brittle_stone", qty: 2 }],
    craftPeriods: 10,
    satietyPerPeriod: 10,
    staminaPerPeriod: 20,
    requiresTinker: true,
  },
};
