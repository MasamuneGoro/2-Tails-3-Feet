import {
  BIOME_LEVEL,
  EVENTS,
  FOODS,
  ITEMS,
  POIS,
  RECIPES,
  RESOURCES,
} from "./gameData";
import type {
  BlotState,
  CraftPreview,
  CraftResult,
  EatSapResult,
  EventId,
  FoodId,
  HarvestMethodId,
  HarvestPreview,
  HarvestResult,
  HarvestStorableResult,
  InventoryStack,
  ItemId,
  JourneyPreview,
  JourneyResult,
  PlayerState,
  PoiId,
  Quality,
  ResourceId,
} from "./types";

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

export function qualityRoll(): Quality {
  return Math.random() < 0.2 ? "uncommon" : "common";
}

export function hungerBand(hunger: number, maxHunger: number): "comfort" | "concern" | "desperation" {
  const ratio = hunger / maxHunger;
  if (ratio < 0.5) return "comfort";
  if (ratio < 0.8) return "concern";
  return "desperation";
}

export const SKILL_MAX_LEVEL = 10;
export const SKILL_XP_PER_LEVEL = 100;

export function skillLevel(xp: number): number {
  return Math.min(SKILL_MAX_LEVEL, Math.floor(xp / SKILL_XP_PER_LEVEL) + 1);
}

export function skillXpToNextLevel(xp: number): number {
  const level = skillLevel(xp);
  if (level >= SKILL_MAX_LEVEL) return 0;
  return level * SKILL_XP_PER_LEVEL - xp;
}

export function skillXpForLevel(level: number): number {
  return (level - 1) * SKILL_XP_PER_LEVEL;
}

export function getItemName(id: ItemId) { return ITEMS[id]?.name ?? id; }
export function getResourceName(id: ResourceId) { return RESOURCES[id]?.name ?? id; }
export function getFoodName(id: FoodId) { return FOODS[id]?.name ?? id; }

export function invGet(stack: InventoryStack[], id: InventoryStack["id"]) {
  return stack.find((s) => s.id === id);
}

export function invAdd(stack: InventoryStack[], id: InventoryStack["id"], qty: number, freshness?: number[]) {
  const s = invGet(stack, id);
  if (!s) { stack.push({ id, qty, freshness }); return; }
  s.qty += qty;
  if (freshness && freshness.length) s.freshness = (s.freshness ?? []).concat(freshness);
}

export function invRemove(stack: InventoryStack[], id: InventoryStack["id"], qty: number) {
  const s = invGet(stack, id);
  if (!s) return false;
  if (s.qty < qty) return false;
  s.qty -= qty;
  if (s.freshness) s.freshness = s.freshness.slice(0, s.qty);
  if (s.qty <= 0) stack.splice(stack.indexOf(s), 1);
  return true;
}

export function invRemoveFreshnessUnits(stack: InventoryStack[], foodId: FoodId, units: number) {
  const s = invGet(stack, foodId);
  if (!s || !s.freshness || s.freshness.length < units) return false;
  s.freshness = s.freshness.slice(units);
  s.qty -= units;
  if (s.qty <= 0) stack.splice(stack.indexOf(s), 1);
  return true;
}

export function rotStorableFoodOneCharge(stack: InventoryStack[]) {
  for (const s of [...stack]) {
    if (typeof s.id === "string" && (s.id as string).startsWith("food_")) {
      const food = FOODS[s.id as FoodId];
      if (food?.storable && s.freshness && s.freshness.length) {
        s.freshness = s.freshness.map((v) => v - 1);
        const remaining: number[] = [];
        for (const v of s.freshness) { if (v > 0) remaining.push(v); }
        s.freshness = remaining;
        s.qty = remaining.length;
        if (s.qty <= 0) stack.splice(stack.indexOf(s), 1);
      }
    }
  }
}

export function hasEquippedTail(player: PlayerState, itemId: ItemId) {
  return player.equipment.tailSlots.includes(itemId);
}

// Count how many of a given item are equipped (0, 1, or 2 for dual-wielding)
export function countEquippedTail(player: PlayerState, itemId: ItemId): number {
  return player.equipment.tailSlots.filter(s => s === itemId).length;
}

export function autoConsumeStorableFood(player: PlayerState, periods: number, chomperAutoEnabled = true) {
  const chomperCount = countEquippedTail(player, "eq_chomper");
  if (chomperCount === 0 || !chomperAutoEnabled) {
    for (let i = 0; i < periods; i++) rotStorableFoodOneCharge(player.inventory);
    return [];
  }
  // Each Chomper consumes up to 1 unit per period — dual Chompers = up to 2 per period
  const consumed: { foodId: FoodId; units: number }[] = [];
  for (let i = 0; i < periods; i++) {
    rotStorableFoodOneCharge(player.inventory);
    for (let c = 0; c < chomperCount; c++) {
      if (player.stats.hunger <= 0) break;
      const storable = player.inventory.find((s) => {
        const id = s.id;
        return typeof id === "string" && id.startsWith("food_") && FOODS[id as FoodId]?.storable && s.qty > 0;
      });
      if (!storable) break;
      const foodId = storable.id as FoodId;
      if (storable.freshness && storable.freshness.length) {
        invRemoveFreshnessUnits(player.inventory, foodId, 1);
      } else {
        invRemove(player.inventory, foodId, 1);
      }
      const red = FOODS[foodId].hungerReduction;
      player.stats.hunger = clamp(player.stats.hunger - red, 0, player.stats.maxHunger);
      const rec = consumed.find((x) => x.foodId === foodId);
      if (rec) rec.units += 1;
      else consumed.push({ foodId, units: 1 });
    }
  }
  return consumed;
}

export function applyFatigueRecovery(player: PlayerState, periods: number, isResting = false) {
  // Stack Tail Curlers: each one contributes its recovery per period
  const count = countEquippedTail(player, "eq_tail_curler");
  if (count === 0) return 0;
  const base = ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0;
  if (base <= 0) return 0;
  // 1.5x per curler when resting (belly down)
  const perCurler = isResting ? base * 1.5 : base;
  const per = perCurler * count;
  const before = player.stats.fatigue;
  player.stats.fatigue = clamp(player.stats.fatigue - per * periods, 0, player.stats.maxFatigue);
  return before - player.stats.fatigue;
}

export function rollEvents(mode: "explore" | "findFood"): EventId[] {
  const prof = BIOME_LEVEL.eventProfile;
  const pool = mode === "explore" ? prof.explorePools : prof.foodPools;
  const out: EventId[] = [];
  const attempts = prof.surfacedEventsMax;
  for (let i = 0; i < attempts; i++) {
    const r = Math.random();
    if (r < prof.rareChance) out.push(pool.rare[randInt(0, pool.rare.length - 1)]);
    else if (r < prof.rareChance + prof.uncommonChance) out.push(pool.uncommon[randInt(0, pool.uncommon.length - 1)]);
    else if (r < prof.rareChance + prof.uncommonChance + prof.commonChance)
      out.push(pool.common[randInt(0, pool.common.length - 1)]);
  }
  return Array.from(new Set(out)).slice(0, prof.surfacedEventsMax);
}

export function makeJourneyPreview(player: PlayerState, mode: "explore" | "findFood", chomperAutoEnabled = true): JourneyPreview {
  const stepsRange = mode === "explore" ? BIOME_LEVEL.exploreStepsRange : BIOME_LEVEL.foodStepsRange;
  const poiId = pickWeighted(mode === "explore" ? BIOME_LEVEL.poiWeightsExplore : BIOME_LEVEL.poiWeightsFood);
  const quality = qualityRoll();
  const events = rollEvents(mode);

  const baseHungerIncreaseRange: [number, number] = [stepsRange[0] * BIOME_LEVEL.hungerPerStep, stepsRange[1] * BIOME_LEVEL.hungerPerStep];
  const baseFatigueIncreaseRange: [number, number] = [stepsRange[0] * BIOME_LEVEL.fatiguePerStep, stepsRange[1] * BIOME_LEVEL.fatiguePerStep];

  // Tail Curler applies at reduced rate during journeys (max ~half cost)
  const curlerCount = countEquippedTail(player, "eq_tail_curler");
  const tailCurlerRecoveryPerPeriod = curlerCount * (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0);
  const journeyPeriods = (n: number) => Math.floor(n / 20);

  const hungerIncreaseRange = baseHungerIncreaseRange;
  const fatigueIncreaseRange: [number, number] = [
    Math.max(0, baseFatigueIncreaseRange[0] - tailCurlerRecoveryPerPeriod * journeyPeriods(stepsRange[0])),
    Math.max(0, baseFatigueIncreaseRange[1] - tailCurlerRecoveryPerPeriod * journeyPeriods(stepsRange[1])),
  ];

  const chomperCount = countEquippedTail(player, "eq_chomper");
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  const totalPeriodsUpper = stepsRange[1];

  if (chomperCount > 0 && chomperAutoEnabled) {
    const storableIds = Array.from(new Set(
      player.inventory
        .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
        .map((s) => s.id as FoodId)
    ));
    for (const id of storableIds) {
      const maxUnits = Math.min(totalPeriodsUpper * chomperCount, invGet(player.inventory, id)?.qty ?? 0);
      estFoodConsumed.push({ foodId: id, unitsRange: [0, maxUnits] });
    }
  }

  const blot = generateBlot(poiId, quality);
  return { mode, stepsRange, hungerIncreaseRange, fatigueIncreaseRange, estFoodConsumed, poi: { id: poiId, quality }, surfacedEvents: events, blot };
}

export function generateBlot(poiId: PoiId, quality: Quality): BlotState {
  const poiData = POIS[poiId];
  if (poiData.kind === "harvest") {
    const base = quality === "uncommon" ? 4 : 3;
    const harvestCharges = randInt(base, base + 2);
    return { poiId, quality, harvestCharges, maxHarvestCharges: harvestCharges };
  } else {
    const spec = poiData.foodSpec!;
    const sapRemaining = randInt(spec.sapQtyRange[0], spec.sapQtyRange[1]);
    const storableRemaining = randInt(spec.storableQtyRange[0], spec.storableQtyRange[1]);
    return { poiId, quality, sapRemaining, storableRemaining, storableFood: spec.storableFood };
  }
}

// Apply all event effects, returning per-event deltas for display
function applyEvents(
  player: PlayerState,
  events: EventId[],
  chomperAutoEnabled: boolean,
): {
  eventEffects: JourneyResult["eventEffects"];
  extraSteps: number;
  foodConsumed: { foodId: FoodId; units: number }[];
} {
  const eventEffects: JourneyResult["eventEffects"] = {} as any;
  let extraSteps = 0;
  const foodConsumed: { foodId: FoodId; units: number }[] = [];

  for (const e of events) {
    const hungerBefore = player.stats.hunger;
    const fatigueBefore = player.stats.fatigue;
    const gained: { id: ResourceId | FoodId; qty: number }[] = [];

    switch (e) {
      case "ev_sticky_drag":
        // +2 extra steps — hunger and fatigue applied as normal steps
        extraSteps += 20;
        player.stats.hunger = clamp(player.stats.hunger + 20 * BIOME_LEVEL.hungerPerStep, 0, player.stats.maxHunger);
        player.stats.fatigue = clamp(player.stats.fatigue + 20 * BIOME_LEVEL.fatiguePerStep, 0, player.stats.maxFatigue);
        applyFatigueRecovery(player, Math.floor(20 / 20)); // 1 effective period for extra steps
        // chomper also gets 2 more periods to work
        if (countEquippedTail(player, "eq_chomper") > 0 && chomperAutoEnabled) {
          const fc = autoConsumeStorableFood(player, 2, chomperAutoEnabled);
          for (const c of fc) {
            const r = foodConsumed.find(x => x.foodId === c.foodId);
            if (r) r.units += c.units; else foodConsumed.push({ ...c });
          }
        }
        break;
      case "ev_resin_smear":
        player.stats.hunger = clamp(player.stats.hunger - 30, 0, player.stats.maxHunger);
        break;
      case "ev_slow_going":
        player.stats.fatigue = clamp(player.stats.fatigue + 20, 0, player.stats.maxFatigue);
        break;
      case "ev_loose_fibers":
        invAdd(player.inventory, "fiber_clump", 1);
        gained.push({ id: "fiber_clump", qty: 1 });
        break;
      case "ev_minor_recovery":
        player.stats.fatigue = clamp(player.stats.fatigue - 20, 0, player.stats.maxFatigue);
        break;
      case "ev_rich_vein_hint":
        invAdd(player.inventory, "resin_glob", 1);
        gained.push({ id: "resin_glob", qty: 1 });
        break;
      case "ev_sticky_snare":
        player.stats.fatigue = clamp(player.stats.fatigue + 30, 0, player.stats.maxFatigue);
        break;
      case "ev_edible_scrap":
        player.stats.hunger = clamp(player.stats.hunger - 80, 0, player.stats.maxHunger);
        break;
      case "ev_efficient_path":
        player.stats.fatigue = clamp(player.stats.fatigue - 30, 0, player.stats.maxFatigue);
        break;
      case "ev_muscle_pull":
        player.stats.fatigue = clamp(player.stats.fatigue + 20, 0, player.stats.maxFatigue);
        player.stats.hunger = clamp(player.stats.hunger + 20, 0, player.stats.maxHunger);
        break;
      case "ev_dense_find":
        invAdd(player.inventory, "resin_glob", 2);
        invAdd(player.inventory, "brittle_stone", 1);
        gained.push({ id: "resin_glob", qty: 2 }, { id: "brittle_stone", qty: 1 });
        break;
      case "ev_preserved_ration":
        invAdd(player.inventory, "food_dense_ration", 1, [randInt(5, 8)]);
        gained.push({ id: "food_dense_ration", qty: 1 });
        break;
      case "ev_second_wind":
        player.stats.fatigue = clamp(player.stats.fatigue - 60, 0, player.stats.maxFatigue);
        break;
      // system events — no mechanical effect
      case "ev_need_chomper":
      case "ev_need_scoop_for_rations":
        break;
    }

    eventEffects[e] = {
      hungerDelta: player.stats.hunger - hungerBefore,
      fatigueDelta: player.stats.fatigue - fatigueBefore,
      gained,
    };
  }

  return { eventEffects, extraSteps, foodConsumed };
}

export function resolveJourney(player: PlayerState, preview: JourneyPreview, chomperAutoEnabled = true): JourneyResult {
  const steps = randInt(preview.stepsRange[0], preview.stepsRange[1]);
  const eventsOut: EventId[] = [...preview.surfacedEvents];

  const hungerDelta = steps * BIOME_LEVEL.hungerPerStep;
  const fatigueDelta = steps * BIOME_LEVEL.fatiguePerStep;

  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  player.stats.fatigue = clamp(player.stats.fatigue + fatigueDelta, 0, player.stats.maxFatigue);

  const recovered = applyFatigueRecovery(player, Math.floor(steps / 20));

  const foodConsumed = autoConsumeStorableFood(player, steps, chomperAutoEnabled);

  // Apply events — real mechanics now
  const { eventEffects, extraSteps, foodConsumed: eventFood } = applyEvents(player, eventsOut, chomperAutoEnabled);
  for (const c of eventFood) {
    const r = foodConsumed.find(x => x.foodId === c.foodId);
    if (r) r.units += c.units; else foodConsumed.push({ ...c });
  }

  const poi = preview.poi;
  const poiData = POIS[poi.id];
  const gained: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[] = [];
  // Collect event-gained items into main gained list
  for (const eff of Object.values(eventEffects)) {
    for (const g of eff.gained) {
      const existing = gained.find(x => x.id === g.id);
      if (existing) existing.qty += g.qty; else gained.push({ ...g });
    }
  }

  let softSapEaten: { hungerRestored: number; units: number } | undefined;

  // Death check BEFORE food blot resolution
  if (player.stats.hunger >= player.stats.maxHunger) {
    return {
      mode: preview.mode, steps: steps + extraSteps, surfacedEvents: eventsOut, eventEffects,
      hungerDelta, fatigueDelta: fatigueDelta - recovered, poi, gained, foodConsumed, blot: preview.blot, outcome: "dead",
    };
  }

  // Food blot — sap auto-eat removed; deferred to POI screen
  // Storable auto-harvest also removed — deferred to POI screen
  if (poiData.kind === "food") {
    if (!hasEquippedTail(player, "eq_chomper")) eventsOut.push("ev_need_chomper");
    if (!hasEquippedTail(player, "eq_sticky_scoop")) {
      if (!eventsOut.includes("ev_need_scoop_for_rations")) eventsOut.push("ev_need_scoop_for_rations");
    }
  }

  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";

  return {
    mode: preview.mode,
    steps: steps + extraSteps,
    surfacedEvents: eventsOut,
    eventEffects,
    hungerDelta,
    fatigueDelta: fatigueDelta - recovered,
    poi,
    gained,
    foodConsumed,
    softSapEaten,
    blot: preview.blot,
    outcome,
  };
}

export function methodsAvailableFromEquipment(player: PlayerState): HarvestMethodId[] {
  const ids = player.equipment.tailSlots.filter(Boolean) as ItemId[];
  const methods = ids.map((id) => ITEMS[id]?.harvestingMethod).filter(Boolean) as HarvestMethodId[];
  return Array.from(new Set(methods));
}

export function recommendedMethod(poiId: PoiId): HarvestMethodId | null {
  const r = POIS[poiId].methodRank;
  if (!r) return null;
  const entries = Object.entries(r) as [HarvestMethodId, string][];
  const best = entries.find(([, v]) => v === "best");
  return best ? best[0] : entries[0]?.[0] ?? null;
}

export function makeHarvestPreview(player: PlayerState, poiId: PoiId, method: HarvestMethodId, chomperAutoEnabled = true): HarvestPreview {
  const poi = POIS[poiId];
  const tuning = poi.methodTuning?.[method];
  if (!tuning || !poi.resourceId || !poi.baseYieldRange || !poi.methodRank || !poi.efficiencyMultipliers) {
    return { poiId, method, periodsRange: [8, 10], hungerIncreaseRange: [8, 10], fatigueIncreaseRange: [8, 10], yieldRange: [1, 2], estFoodConsumed: [], efficiencyLabel: "ok" };
  }

  const periodsRange = tuning.periodsRange;
  const hungerPerPeriod = 10;
  const fatiguePerPeriod = tuning.fatiguePerPeriod;

  const hungerIncreaseRange: [number, number] = [periodsRange[0] * hungerPerPeriod, periodsRange[1] * hungerPerPeriod];
  const curlerCount = countEquippedTail(player, "eq_tail_curler");
  const tailCurlerRec = curlerCount * (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0);
  const fatigueIncreaseRange: [number, number] = [
    Math.max(0, periodsRange[0] * fatiguePerPeriod - tailCurlerRec * periodsRange[0]),
    Math.max(0, periodsRange[1] * fatiguePerPeriod - tailCurlerRec * periodsRange[1]),
  ];

  const effLabel = poi.methodRank[method];
  const eff = poi.efficiencyMultipliers[effLabel] ?? 1;
  const base = poi.baseYieldRange;
  const yieldRange: [number, number] = [Math.max(1, Math.floor(base[0] * eff)), Math.max(1, Math.floor(base[1] * eff + 0.5))];

  const chomperCount = countEquippedTail(player, "eq_chomper");
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  if (chomperCount > 0 && chomperAutoEnabled) {
    const storableIds = Array.from(new Set(
      player.inventory
        .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
        .map((s) => s.id as FoodId)
    ));
    for (const id of storableIds) {
      const maxUnits = Math.min(periodsRange[1] * chomperCount, invGet(player.inventory, id)?.qty ?? 0);
      estFoodConsumed.push({ foodId: id, unitsRange: [0, maxUnits] });
    }
  }

  return { poiId, method, periodsRange, hungerIncreaseRange, fatigueIncreaseRange, yieldRange, estFoodConsumed, efficiencyLabel: effLabel };
}

export function resolveHarvest(player: PlayerState, preview: HarvestPreview, chomperAutoEnabled = true): HarvestResult {
  const poi = POIS[preview.poiId];
  if (poi.kind !== "harvest" || !poi.resourceId || !poi.methodTuning || !poi.methodRank || !poi.efficiencyMultipliers) {
    return { poiId: preview.poiId, method: preview.method, periods: 0, hungerDelta: 0, fatigueDelta: 0, gained: [], xpGained: 0, foodConsumed: [], outcome: "ok", message: "Nothing to harvest here." };
  }

  const tuning = poi.methodTuning[preview.method];
  const periods = randInt(tuning.periodsRange[0], tuning.periodsRange[1]);

  const hungerPerPeriod = 10;
  const fatiguePerPeriod = tuning.fatiguePerPeriod;
  const hungerDelta = periods * hungerPerPeriod;
  const fatigueDelta = periods * fatiguePerPeriod;

  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  player.stats.fatigue = clamp(player.stats.fatigue + fatigueDelta, 0, player.stats.maxFatigue);

  applyFatigueRecovery(player, periods);
  const foodConsumed = autoConsumeStorableFood(player, periods, chomperAutoEnabled);

  const effLabel = poi.methodRank[preview.method];
  const eff = poi.efficiencyMultipliers[effLabel] ?? 1;
  const base = poi.baseYieldRange!;
  const raw = randInt(base[0], base[1]);
  const skill = 1 + (skillLevel(player.xp[preview.method] ?? 0) - 1) * 0.08;
  const qty = Math.max(1, Math.floor(raw * eff * skill));

  invAdd(player.inventory, poi.resourceId, qty);
  const gained = [{ id: poi.resourceId, qty }];

  const xpGained = Math.max(4, Math.floor(periods * 1.25));
  player.xp[preview.method] = (player.xp[preview.method] ?? 0) + xpGained;

  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";
  return { poiId: preview.poiId, method: preview.method, periods, hungerDelta, fatigueDelta, gained, xpGained, foodConsumed, outcome };
}

export function canCraft(player: PlayerState) {
  return player.stats.fatigue < player.stats.maxFatigue && player.stats.hunger < player.stats.maxHunger;
}

export function listUnlockedRecipes(player: PlayerState): string[] {
  const hasTinker = hasEquippedTail(player, "eq_tinker_shaft");
  return Object.keys(RECIPES).filter((id) => {
    const r = RECIPES[id];
    if (r.requiresTinker && !hasTinker) return false;
    return true;
  });
}

export function makeCraftPreview(player: PlayerState, recipeId: string, chomperAutoEnabled = true): CraftPreview {
  const r = RECIPES[recipeId];
  const chomperCount = countEquippedTail(player, "eq_chomper");
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  if (chomperCount > 0 && chomperAutoEnabled) {
    const storableIds = Array.from(new Set(
      player.inventory
        .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
        .map((s) => s.id as FoodId)
    ));
    for (const id of storableIds) {
      const maxUnits = Math.min(r.craftPeriods * chomperCount, invGet(player.inventory, id)?.qty ?? 0);
      estFoodConsumed.push({ foodId: id, unitsRange: [0, maxUnits] });
    }
  }
  const curlerCount = countEquippedTail(player, "eq_tail_curler");
  const craftTailCurlerRec = curlerCount * (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0);
  return {
    recipeId,
    craftPeriods: r.craftPeriods,
    hungerIncrease: r.craftPeriods * r.hungerPerPeriod,
    fatigueIncrease: Math.max(0, r.craftPeriods * r.fatiguePerPeriod - craftTailCurlerRec * r.craftPeriods),
    estFoodConsumed,
  };
}

export function resolveCraft(player: PlayerState, preview: CraftPreview, chomperAutoEnabled = true): CraftResult {
  const r = RECIPES[preview.recipeId];
  for (const need of r.inputs) {
    const have = invGet(player.inventory, need.id)?.qty ?? 0;
    if (have < need.qty) return { recipeId: preview.recipeId, success: false, failReason: "missing_resources", hungerDelta: 0, fatigueDelta: 0, foodConsumed: [] };
  }
  for (const need of r.inputs) invRemove(player.inventory, need.id, need.qty);

  const hungerDelta = r.craftPeriods * r.hungerPerPeriod;
  const fatigueDelta = r.craftPeriods * r.fatiguePerPeriod;

  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  player.stats.fatigue = clamp(player.stats.fatigue + fatigueDelta, 0, player.stats.maxFatigue);

  applyFatigueRecovery(player, r.craftPeriods);
  const foodConsumed = autoConsumeStorableFood(player, r.craftPeriods, chomperAutoEnabled);

  if (player.stats.hunger >= player.stats.maxHunger) return { recipeId: preview.recipeId, success: false, failReason: "dead", hungerDelta, fatigueDelta, foodConsumed };
  if (player.stats.fatigue >= player.stats.maxFatigue) return { recipeId: preview.recipeId, success: false, failReason: "exhausted", hungerDelta, fatigueDelta, foodConsumed };

  invAdd(player.inventory, r.output.itemId, r.output.qty);
  return { recipeId: preview.recipeId, success: true, hungerDelta, fatigueDelta, foodConsumed, crafted: { itemId: r.output.itemId, qty: r.output.qty } };
}

export function recoverPreview(player: PlayerState, chomperAutoEnabled = true) {
  const periods = 8;
  const hungerDelta = periods * 10;
  const curlerCount = countEquippedTail(player, "eq_tail_curler");
  const baseRecovery = ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0;
  // 1.5x per curler when resting, stacked
  const fatigueRecovered = curlerCount > 0 ? baseRecovery * 1.5 * curlerCount * periods : 0;
  const chomperCount = countEquippedTail(player, "eq_chomper");
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  if (chomperCount > 0 && chomperAutoEnabled) {
    const storableIds = Array.from(new Set(
      player.inventory
        .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
        .map((s) => s.id as FoodId)
    ));
    for (const id of storableIds) {
      const maxUnits = Math.min(periods * chomperCount, invGet(player.inventory, id)?.qty ?? 0);
      estFoodConsumed.push({ foodId: id, unitsRange: [0, maxUnits] });
    }
  }
  return { periods, hungerDeltaRange: [hungerDelta, hungerDelta] as [number, number], fatigueRecoveredRange: [0, fatigueRecovered] as [number, number], estFoodConsumed };
}

export function resolveRecover(player: PlayerState, periods: number, chomperAutoEnabled = true) {
  const hungerDelta = periods * 10;
  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  const before = player.stats.fatigue;
  applyFatigueRecovery(player, periods, true);
  const recovered = before - player.stats.fatigue;
  const foodConsumed = autoConsumeStorableFood(player, periods, chomperAutoEnabled);
  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";
  return { periods, hungerDelta, fatigueRecovered: recovered, foodConsumed, outcome };
}

export function eatSapAtBlot(player: PlayerState, blot: BlotState): EatSapResult {
  // Dual Chompers don't give more sap — sap is limited on location, biteSize stays the same
  const biteSize = ITEMS.eq_chomper.effects?.chomper?.biteSize ?? 1;
  const available = blot.sapRemaining ?? 0;
  const toEat = Math.min(biteSize, available);
  const fatigueCostPerUnit = 20;
  let hungerRestored = 0;
  let unitsEaten = 0;
  for (let i = 0; i < toEat; i++) {
    if (player.stats.fatigue >= player.stats.maxFatigue) break;
    const red = FOODS["food_soft_sap"].hungerReduction;
    const before = player.stats.hunger;
    player.stats.hunger = clamp(player.stats.hunger - red, 0, player.stats.maxHunger);
    hungerRestored += before - player.stats.hunger;
    player.stats.fatigue = clamp(player.stats.fatigue + fatigueCostPerUnit, 0, player.stats.maxFatigue);
    applyFatigueRecovery(player, 1);
    blot.sapRemaining = (blot.sapRemaining ?? 1) - 1;
    unitsEaten++;
  }
  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";
  return { unitsEaten, hungerRestored, fatigueCost: unitsEaten * fatigueCostPerUnit, outcome };
}

export function harvestStorableAtBlot(player: PlayerState, blot: BlotState): HarvestStorableResult {
  const food = blot.storableFood!;
  const poiData = POIS[blot.poiId];
  const spec = poiData.foodSpec!;
  const hungerCost = spec.forageHungerPerPeriod;
  const fatigueCost = spec.forageFatiguePerPeriod;
  player.stats.hunger = clamp(player.stats.hunger + hungerCost, 0, player.stats.maxHunger);
  player.stats.fatigue = clamp(player.stats.fatigue + fatigueCost, 0, player.stats.maxFatigue);
  applyFatigueRecovery(player, 1);
  const foodConsumed = autoConsumeStorableFood(player, 1);
  const fr = FOODS[food].freshnessRange!;
  const freshness = [randInt(fr[0], fr[1])];
  invAdd(player.inventory, food, 1, freshness);
  blot.storableRemaining = (blot.storableRemaining ?? 1) - 1;
  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";
  return { foodId: food, qty: 1, freshness, hungerCost, fatigueCost, foodConsumed, outcome };
}

export function prettyEvent(e: EventId) { return EVENTS[e]; }
export function prettyPoi(poiId: PoiId) { return POIS[poiId]; }
export function prettyRecipe(recipeId: string) { return RECIPES[recipeId]; }
