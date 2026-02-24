import type {
  BiomeLevelId,
  BattleFlag,
  CreatureId,
  EventId,
  FoodId,
  HarvestMethodId,
  ItemId,
  MoveId,
  PlayerMove,
  PoiId,
  Quality,
  ResourceId,
  SituationId,
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
      storableQtyRange: [0, 40] as [number, number],
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
      storableQtyRange: [80, 160] as [number, number],
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
      storableQtyRange: [30, 90] as [number, number],
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
  mat_wing_membrane: { id: "mat_wing_membrane", name: "Wing Membrane", flavor: "Translucent and surprisingly tough. Catches the light strangely. You sense it has uses you haven't discovered yet." },
  mat_crystallised_wax: { id: "mat_crystallised_wax", name: "Crystallised Wax", flavor: "Something happened inside the moth that shouldn't have. Cold, rigid, almost humming. You're not sure what it's for yet." },
};

export const FOODS: Record<
  FoodId,
  { id: FoodId; name: string; satietyRestored: number; storable: boolean; freshnessRange?: [number, number]; flavor: string }
> = {
  food_soft_sap: { id: "food_soft_sap", name: "Soft Sap", satietyRestored: 150, storable: false, flavor: "Warm, gloopy, and barely qualifies as food. Your belly doesn't care." },
  food_resin_chew: { id: "food_resin_chew", name: "Resin Chew", satietyRestored: 1, storable: true, freshnessRange: [100, 136], flavor: "Chewy in a way that makes you think. Not about what's in it, though." },
  food_dense_ration: { id: "food_dense_ration", name: "Dense Ration", satietyRestored: 4, storable: true, freshnessRange: [156, 236], flavor: "Suspiciously well-preserved. You decide gratitude is the right response." },
  food_moth_flesh: { id: "food_moth_flesh", name: "Moth Flesh", satietyRestored: 35, storable: true, freshnessRange: [40, 70], flavor: "Pale and dense. Faintly waxy aftertaste. Surprisingly filling." },
  food_moth_paste: { id: "food_moth_paste", name: "Moth Paste", satietyRestored: 14, storable: true, freshnessRange: [25, 45], flavor: "You'd rather not think about what this used to be. You eat it anyway." },
  food_gloop_wax: { id: "food_gloop_wax", name: "Gloop Wax", satietyRestored: 18, storable: true, freshnessRange: [80, 140], flavor: "Thick and faintly sweet. Numbs the tongue slightly. You eat it anyway." },
};

export const ITEMS: Record<
  string,
  {
    id: ItemId;
    name: string;
    slot: "tail" | "shoe";
    flavor: string;
    effects?: {
      staminaRecoveryPerPeriod?: number;
      staminaRecoveryPerPeriodWorking?: number;
      staminaRecoveryPerPeriodResting?: number;
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
    flavor: "A coiled attachment that hums quietly no matter what you're doing. Something about it helps.",
    effects: { staminaRecoveryPerPeriod: 2, staminaRecoveryPerPeriodWorking: 5, staminaRecoveryPerPeriodResting: 15 },
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

// ─── Progression Items — Markers, Trophies, Gem-Embedded Trophies, Biomass ────

import type { BlotMarkCategory, GemTrophyItemId, MarkerItemId, ProgressionItemId, TrophyItemId } from "./types";

export type ProgressionItemDef = {
  id: ProgressionItemId;
  name: string;
  flavor: string;
  category?: BlotMarkCategory; // for markers/trophies/gem trophies
  kind: "marker" | "trophy" | "gem_trophy" | "biomass";
};

export const MARKERS: Record<MarkerItemId, ProgressionItemDef> = {
  marker_exploration: { id: "marker_exploration", kind: "marker", category: "Exploration", name: "Exploration Marker", flavor: "A pale amber bead, still faintly warm. You found your way." },
  marker_harvesting:  { id: "marker_harvesting",  kind: "marker", category: "Harvesting",  name: "Harvesting Marker",  flavor: "A rough green chip, edges scored from use. Something gave way." },
  marker_crafting:    { id: "marker_crafting",    kind: "marker", category: "Crafting",    name: "Crafting Marker",    flavor: "A flat grey shard with one clean face. Shaped, not broken." },
  marker_survival:    { id: "marker_survival",    kind: "marker", category: "Survival",    name: "Survival Marker",    flavor: "A dull red nodule. The body remembers what the mind tried to forget." },
  marker_combat:      { id: "marker_combat",      kind: "marker", category: "Combat",      name: "Combat Marker",      flavor: "A dark violet splinter, dense for its size. Something ended." },
  marker_loot:        { id: "marker_loot",        kind: "marker", category: "Loot",        name: "Loot Marker",        flavor: "A clear yellow fleck, almost translucent. Taken cleanly." },
};

export const TROPHIES: Record<TrophyItemId, ProgressionItemDef> = {
  trophy_exploration: { id: "trophy_exploration", kind: "trophy", category: "Exploration", name: "Exploration Trophy", flavor: "A clouded amber lens, perfect on one face. The terrain is in it somewhere." },
  trophy_harvesting:  { id: "trophy_harvesting",  kind: "trophy", category: "Harvesting",  name: "Harvesting Trophy",  flavor: "A scored green prism, every face worked. It knows what tools feel like." },
  trophy_crafting:    { id: "trophy_crafting",    kind: "trophy", category: "Crafting",    name: "Crafting Trophy",    flavor: "A grey octahedron, seamless. You didn't find this — you arrived at it." },
  trophy_survival:    { id: "trophy_survival",    kind: "trophy", category: "Survival",    name: "Survival Trophy",    flavor: "A dark red ovoid, heavier than it looks. It has been very close to the edge." },
  trophy_combat:      { id: "trophy_combat",      kind: "trophy", category: "Combat",      name: "Combat Trophy",      flavor: "A violet shard the size of a knuckle, warm to the touch. Something is still in it." },
  trophy_loot:        { id: "trophy_loot",        kind: "trophy", category: "Loot",        name: "Loot Trophy",        flavor: "A clear yellow tetrahedron. The best possible outcome, made solid." },
};

export const GEM_TROPHIES: Record<GemTrophyItemId, ProgressionItemDef> = {
  gem_trophy_exploration: { id: "gem_trophy_exploration", kind: "gem_trophy", category: "Exploration", name: "Gem-Embedded Exploration Trophy", flavor: "The amber lens, now studded with its markers. Each bead is a step you remembered." },
  gem_trophy_harvesting:  { id: "gem_trophy_harvesting",  kind: "gem_trophy", category: "Harvesting",  name: "Gem-Embedded Harvesting Trophy",  flavor: "The green prism, inlaid with scored chips. Every method, crystallised." },
  gem_trophy_crafting:    { id: "gem_trophy_crafting",    kind: "gem_trophy", category: "Crafting",    name: "Gem-Embedded Crafting Trophy",    flavor: "The grey octahedron, set with clean grey shards. It hums faintly when you hold it still." },
  gem_trophy_survival:    { id: "gem_trophy_survival",    kind: "gem_trophy", category: "Survival",    name: "Gem-Embedded Survival Trophy",    flavor: "The red ovoid, laced with red nodules. Dense. It has been through things." },
  gem_trophy_combat:      { id: "gem_trophy_combat",      kind: "gem_trophy", category: "Combat",      name: "Gem-Embedded Combat Trophy",      flavor: "The violet shard set deep with seven splinters. It vibrates slightly if you listen." },
  gem_trophy_loot:        { id: "gem_trophy_loot",        kind: "gem_trophy", category: "Loot",        name: "Gem-Embedded Loot Trophy",        flavor: "The yellow tetrahedron, set with two clear flecks. Perfectly transparent." },
};

export const BIOMASS_ITEM: ProgressionItemDef = {
  id: "biomass", kind: "biomass", name: "Biomass",
  flavor: "Dense, dark paste. The Gate rendered it from what you gave. It smells faintly sweet. You don't know why yet.",
};

// Maps BlotMarkCategory → which MarkerItemId it produces
export const CATEGORY_MARKER: Record<BlotMarkCategory, MarkerItemId> = {
  Exploration: "marker_exploration",
  Harvesting:  "marker_harvesting",
  Crafting:    "marker_crafting",
  Survival:    "marker_survival",
  Combat:      "marker_combat",
  Loot:        "marker_loot",
};

// Maps BlotMarkCategory → which TrophyItemId it produces (gate mark reward)
export const CATEGORY_TROPHY: Record<BlotMarkCategory, TrophyItemId> = {
  Exploration: "trophy_exploration",
  Harvesting:  "trophy_harvesting",
  Crafting:    "trophy_crafting",
  Survival:    "trophy_survival",
  Combat:      "trophy_combat",
  Loot:        "trophy_loot",
};

// Maps TrophyItemId → GemTrophyItemId
export const TROPHY_TO_GEM: Record<TrophyItemId, GemTrophyItemId> = {
  trophy_exploration: "gem_trophy_exploration",
  trophy_harvesting:  "gem_trophy_harvesting",
  trophy_crafting:    "gem_trophy_crafting",
  trophy_survival:    "gem_trophy_survival",
  trophy_combat:      "gem_trophy_combat",
  trophy_loot:        "gem_trophy_loot",
};

// The gate mark for each category — earning this mark gives a Trophy instead of a Marker
export const CATEGORY_GATE_MARK = {
  Exploration: "mark_visit_all_poi",
  Harvesting:  "mark_all_methods",
  Crafting:    "mark_craft_all_tools",
  Survival:    "mark_low_satiety_survive",
  Combat:      "mark_first_win",
  Loot:        "mark_full_corpse",
} as const;

// Gem-Embedded Trophy recipes (require Tinker Shaft)
// Input format: Trophy + all markers for that category + 1 resin per marker
export interface GemTrophyRecipe {
  id: string;
  category: BlotMarkCategory;
  output: GemTrophyItemId;
  trophyInput: TrophyItemId;
  markerInput: MarkerItemId;
  markerQty: number; // how many markers required (= max markers for that category)
  resinQty: number;  // = markerQty
}

export const GEM_TROPHY_RECIPES: Record<GemTrophyItemId, GemTrophyRecipe> = {
  gem_trophy_exploration: { id: "rcp_gem_exploration", category: "Exploration", output: "gem_trophy_exploration", trophyInput: "trophy_exploration", markerInput: "marker_exploration", markerQty: 2, resinQty: 2 },
  gem_trophy_harvesting:  { id: "rcp_gem_harvesting",  category: "Harvesting",  output: "gem_trophy_harvesting",  trophyInput: "trophy_harvesting",  markerInput: "marker_harvesting",  markerQty: 3, resinQty: 3 },
  gem_trophy_crafting:    { id: "rcp_gem_crafting",    category: "Crafting",    output: "gem_trophy_crafting",    trophyInput: "trophy_crafting",    markerInput: "marker_crafting",    markerQty: 2, resinQty: 2 },
  gem_trophy_survival:    { id: "rcp_gem_survival",    category: "Survival",    output: "gem_trophy_survival",    trophyInput: "trophy_survival",    markerInput: "marker_survival",    markerQty: 2, resinQty: 2 },
  gem_trophy_combat:      { id: "rcp_gem_combat",      category: "Combat",      output: "gem_trophy_combat",      trophyInput: "trophy_combat",      markerInput: "marker_combat",      markerQty: 7, resinQty: 7 },
  gem_trophy_loot:        { id: "rcp_gem_loot",        category: "Loot",        output: "gem_trophy_loot",        trophyInput: "trophy_loot",        markerInput: "marker_loot",        markerQty: 2, resinQty: 2 },
};

// The 3 Gem-Embedded Trophies required to unlock the Gate passage
export const GATE_REQUIRED_GEM_TROPHIES: GemTrophyItemId[] = [
  "gem_trophy_exploration",
  "gem_trophy_harvesting",
  "gem_trophy_combat",
];

// Biomass conversion table — items that can be liquidated at the Gate
export const BIOMASS_VALUES: Partial<Record<string, number>> = {
  // Resources
  resin_glob:           2,
  fiber_clump:          2,
  brittle_stone:        4,
  mat_wing_membrane:    10,
  mat_crystallised_wax: 70,
  // Equipment (craftable only — tinker shaft, shoes, deferred items not listed)
  eq_fiber_comb:        12,
  eq_sticky_scoop:      12,
  eq_crude_hammerhead:  18,
  eq_hand_drill:        18,
  eq_chomper:           28,
  eq_tail_curler:       28,
};

// ─── Situation hint text ───────────────────────────────────────────────────────
// Multiple variants per situation — picked based on turn count to avoid repetition
// Situations where spamming is viable (hovering, thrashing, startled) get more variants
export const SITUATION_VARIANTS: Record<SituationId, string[]> = {
  moth_hovering: [
    "It drifts above you, wax glands glistening. Something drips.",
    "It circles slowly, wings barely moving. The air smells faintly sweet.",
    "It hangs there, indifferent. Wax catches the light on its underside.",
    "Still hovering. Patient. The dripping hasn't stopped.",
  ],
  moth_descending: [
    "It's coming lower. Wings slow. You could reach it.",
    "Descending now, almost within range. A brief window.",
    "It drifts down, tilting slightly. Now or not at all.",
  ],
  moth_startled: [
    "It lurches sideways — erratic, exposed, unpredictable.",
    "Startled, it jerks back. For a moment it's wide open.",
    "A sharp flinch. It scrambles to reorient. You have a second.",
    "It staggers mid-air. Not flying properly. Make something of it.",
  ],
  moth_wax_pooling: [
    "Wax is collecting on the ground beneath it. Don't let it build up.",
    "A puddle of wax is forming below. It won't last.",
    "The wax is pooling fast. Could be useful. Could be a problem.",
  ],
  moth_depleted: [
    "Its glands are dry. It seems lighter. Less threatening.",
    "Nothing left to secrete. It drifts differently now — unguarded.",
    "Drained. The menace is mostly gone. Something else remains.",
  ],
  moth_thrashing: [
    "It knows it's losing. Wings beat hard. Stay back or get close fast.",
    "Erratic now, desperate. Hard to predict. Harder to ignore.",
    "Thrashing. It's not going quietly. Be deliberate.",
    "Still fighting. Composure nearly gone. One more good move.",
  ],
};

// Pick variant based on turn to cycle through without repeating immediately
export function getSituationText(situation: SituationId, turn: number): string {
  const variants = SITUATION_VARIANTS[situation];
  return variants[turn % variants.length];
}

// Keep single-text export for backward compat
export const SITUATION_TEXT: Record<SituationId, string> = Object.fromEntries(
  Object.entries(SITUATION_VARIANTS).map(([k, v]) => [k, v[0]])
) as Record<SituationId, string>;

// Situation transitions — what the creature does each turn independent of player
// Maps current situation → next situation
export const SITUATION_TRANSITIONS: Record<SituationId, SituationId> = {
  moth_hovering:    "moth_descending",
  moth_descending:  "moth_wax_pooling",
  moth_wax_pooling: "moth_startled",
  moth_startled:    "moth_hovering",
  moth_depleted:    "moth_thrashing",
  moth_thrashing:   "moth_thrashing",
};

// ─── Player moves ──────────────────────────────────────────────────────────────
export const MOVES: Record<MoveId, PlayerMove> = {
  jab_wing: {
    id: "jab_wing",
    label: "Jab at the wing joint",
    tools: ["eq_pointed_twig"],
    forbiddenFlags: ["wax_laced"],
    effect: {
      composureDelta: [15, 25],
      integrityDelta: -8,
      staminaCost: 12,
      setsFlags: ["wing_torn"],
      situationNext: "moth_startled",
      proficiencyMethod: "poke",
    },
  },
  comb_glands: {
    id: "comb_glands",
    label: "Comb the wax glands",
    tools: ["eq_fiber_comb"],
    forbiddenFlags: ["wax_laced"],
    effect: {
      composureDelta: [5, 5],
      integrityDelta: 0,
      staminaCost: 8,
      setsFlags: ["wax_drained"],
      clearsFlags: ["wax_intact"],
      midBattleDrop: { id: "food_gloop_wax", qty: 2 },
      situationNext: "moth_depleted",
      proficiencyMethod: "tease",
    },
  },
  scoop_pooled: {
    id: "scoop_pooled",
    label: "Scoop the wax off the ground",
    tools: ["eq_sticky_scoop"],
    requiredSituation: "moth_wax_pooling",
    effect: {
      composureDelta: [0, 0],
      integrityDelta: 0,
      staminaCost: 6,
      midBattleDrop: { id: "food_gloop_wax", qty: 3 },
      situationNext: "moth_hovering",
      proficiencyMethod: "scoop",
    },
  },
  smash_body: {
    id: "smash_body",
    label: "Bring it down hard",
    tools: ["eq_crude_hammerhead"],
    effect: {
      composureDelta: [35, 45],
      integrityDelta: -30,
      staminaCost: 18,
      counterattack: {
        triggerFlag: "wax_intact",
        staminaPenalty: 20,
        contaminatesFood: true,
        flavor: "Wax splatters across you and your food stores.",
      },
      situationNext: "moth_thrashing",
      proficiencyMethod: "smash",
    },
  },
  drill_thorax: {
    id: "drill_thorax",
    label: "Find the hollow and bore in",
    tools: ["eq_hand_drill"],
    requiredSituation: "moth_descending",
    effect: {
      composureDelta: [25, 35],
      integrityDelta: -20,
      staminaCost: 15,
      setsFlags: ["thorax_open"],
      situationNext: "moth_startled",
      proficiencyMethod: "drill",
    },
  },
  lace_twig: {
    id: "lace_twig",
    label: "Coat your twig in the wax",
    tools: ["eq_sticky_scoop", "eq_pointed_twig"],
    requiredFlags: ["wax_drained"],
    forbiddenFlags: ["wax_laced"],
    effect: {
      composureDelta: [0, 0],
      integrityDelta: 0,
      staminaCost: 5,
      setsFlags: ["wax_laced"],
      situationNext: null,
    },
  },
  laced_jab: {
    id: "laced_jab",
    label: "Strike with the laced twig",
    tools: ["eq_pointed_twig"],
    requiredFlags: ["wax_laced"],
    effect: {
      composureDelta: [40, 55],
      integrityDelta: -8,
      staminaCost: 10,
      clearsFlags: ["wax_laced"],
      situationNext: "moth_thrashing",
      proficiencyMethod: "poke",
    },
  },
  expose_and_strike: {
    id: "expose_and_strike",
    label: "Comb wings open, then hit",
    tools: ["eq_fiber_comb", "eq_crude_hammerhead"],
    effect: {
      composureDelta: [45, 60],
      integrityDelta: -12,
      staminaCost: 20,
      setsFlags: ["wing_torn"],
      midBattleDrop: { id: "mat_wing_membrane", qty: 1 },
      situationNext: "moth_thrashing",
      proficiencyMethod: "smash",
    },
  },
  drill_resonance: {
    id: "drill_resonance",
    label: "Pierce then drill the cavity",
    tools: ["eq_pointed_twig", "eq_hand_drill"],
    requiredFlags: ["thorax_open"],
    effect: {
      composureDelta: [50, 70],
      integrityDelta: -25,
      staminaCost: 22,
      midBattleDrop: { id: "mat_crystallised_wax", qty: 1 },
      situationNext: "moth_thrashing",
      proficiencyMethod: "drill",
    },
  },
  eat_wax_raw: {
    id: "eat_wax_raw",
    label: "Lick the raw wax off your tool",
    tools: [],
    requiredFlags: ["wax_drained"],
    forbiddenFlags: ["wax_consumed"],
    effect: {
      composureDelta: [0, 0],
      integrityDelta: 0,
      staminaCost: 0,
      staminaRestore: 25,
      setsFlags: ["wax_consumed"],
      situationNext: null,
    },
  },
  eat_soft_tissue: {
    id: "eat_soft_tissue",
    label: "Tear into the exposed abdomen",
    tools: [],
    requiredFlags: ["thorax_open"],
    effect: {
      composureDelta: [10, 10],
      integrityDelta: -20,
      staminaCost: 0,
      satietyRestore: 40,
      situationNext: "moth_startled",
    },
  },
  flee: {
    id: "flee",
    label: "Back away quickly",
    tools: [],
    effect: {
      composureDelta: [0, 0],
      integrityDelta: 0,
      staminaCost: 15,
      situationNext: null,
    },
  },
};

// ─── Creature definitions ──────────────────────────────────────────────────────
export interface CreatureDef {
  id: CreatureId;
  name: string;
  flavor: string;
  composureMax: number;
  integrityMax: number;
  initialSituation: SituationId;
  initialFlags: BattleFlag[];
  availableMoves: MoveId[];  // full list — engine filters by flags/situation
  dropTable: DropCondition[];
}

export interface DropCondition {
  id: ResourceId | FoodId;
  qtyRange: [number, number];
  integrityMin?: number;
  integrityMax?: number;
  requiredFlags?: BattleFlag[];
  endReasons?: ("collapsed" | "disarmed" | "fled")[];
  freshnessRange?: [number, number];
}

export const CREATURES: Record<CreatureId, CreatureDef> = {
  creature_gloop_moth: {
    id: "creature_gloop_moth",
    name: "Gloop Moth",
    flavor: "A large, slow moth that secretes a paralysing wax from its wing-glands. Docile until threatened. The wax smells faintly of something you used to like.",
    composureMax: 100,
    integrityMax: 100,
    initialSituation: "moth_hovering",
    initialFlags: ["wax_intact"],
    availableMoves: [
      "jab_wing", "comb_glands", "scoop_pooled", "smash_body",
      "drill_thorax", "lace_twig", "laced_jab", "expose_and_strike",
      "drill_resonance", "eat_wax_raw", "eat_soft_tissue", "flee",
    ],
    dropTable: [
      // Gloop Wax — requires wax_drained, scales with integrity
      { id: "food_gloop_wax", qtyRange: [4, 5], integrityMin: 80, requiredFlags: ["wax_drained"], freshnessRange: [80, 140] },
      { id: "food_gloop_wax", qtyRange: [3, 4], integrityMin: 60, integrityMax: 79, requiredFlags: ["wax_drained"], freshnessRange: [80, 140] },
      { id: "food_gloop_wax", qtyRange: [1, 2], integrityMin: 40, integrityMax: 59, requiredFlags: ["wax_drained"], freshnessRange: [80, 140] },
      // Wing Membrane — requires wing_torn and sufficient integrity
      { id: "mat_wing_membrane", qtyRange: [1, 2], integrityMin: 80, requiredFlags: ["wing_torn"] },
      { id: "mat_wing_membrane", qtyRange: [1, 1], integrityMin: 50, integrityMax: 79, requiredFlags: ["wing_torn"] },
      // Moth Flesh — good integrity, corpse present
      { id: "food_moth_flesh", qtyRange: [3, 4], integrityMin: 80, endReasons: ["collapsed", "disarmed"], freshnessRange: [40, 70] },
      { id: "food_moth_flesh", qtyRange: [2, 3], integrityMin: 60, integrityMax: 79, endReasons: ["collapsed", "disarmed"], freshnessRange: [40, 70] },
      { id: "food_moth_flesh", qtyRange: [2, 2], integrityMin: 40, integrityMax: 59, endReasons: ["collapsed", "disarmed"], freshnessRange: [40, 70] },
      // Moth Paste — degraded body
      { id: "food_moth_paste", qtyRange: [1, 2], integrityMin: 20, integrityMax: 39, endReasons: ["collapsed", "disarmed"], freshnessRange: [25, 45] },
      // Crystallised Wax — flag-triggered by drill_resonance move (mid-battle), always drops regardless of integrity
      // (handled as mid-battle drop directly in the move, not in drop table)
    ],
  },
};
