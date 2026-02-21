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
  CraftPreview,
  CraftResult,
  EventId,
  FoodId,
  HarvestMethodId,
  HarvestPreview,
  HarvestResult,
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
  // L1: mostly common
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

export function getItemName(id: ItemId) {
  return ITEMS[id]?.name ?? id;
}
export function getResourceName(id: ResourceId) {
  return RESOURCES[id]?.name ?? id;
}
export function getFoodName(id: FoodId) {
  return FOODS[id]?.name ?? id;
}

export function invGet(stack: InventoryStack[], id: InventoryStack["id"]) {
  return stack.find((s) => s.id === id);
}

export function invAdd(stack: InventoryStack[], id: InventoryStack["id"], qty: number, freshness?: number[]) {
  const s = invGet(stack, id);
  if (!s) {
    stack.push({ id, qty, freshness });
    return;
  }
  s.qty += qty;
  if (freshness && freshness.length) {
    s.freshness = (s.freshness ?? []).concat(freshness);
  }
}

export function invRemove(stack: InventoryStack[], id: InventoryStack["id"], qty: number) {
  const s = invGet(stack, id);
  if (!s) return false;
  if (s.qty < qty) return false;
  s.qty -= qty;
  if (s.freshness) {
    s.freshness = s.freshness.slice(0, s.qty);
  }
  if (s.qty <= 0) {
    const idx = stack.indexOf(s);
    stack.splice(idx, 1);
  }
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
  // each "period" decrements freshness by 1 for storable foods; when 0 -> rot (remove that unit)
  for (const s of [...stack]) {
    if (typeof s.id === "string" && (s.id as string).startsWith("food_")) {
      const food = FOODS[s.id as FoodId];
      if (food?.storable && s.freshness && s.freshness.length) {
        s.freshness = s.freshness.map((v) => v - 1);
        const remaining: number[] = [];
        for (const v of s.freshness) {
          if (v > 0) remaining.push(v);
        }
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

export function autoConsumeStorableFood(player: PlayerState, periods: number) {
  if (!hasEquippedTail(player, "eq_chomper")) {
    // still rot storable food over time
    for (let i = 0; i < periods; i++) rotStorableFoodOneCharge(player.inventory);
    return [];
  }
  // Chomper auto-consumes at most 1 unit per period if hunger > 0
  const consumed: { foodId: FoodId; units: number }[] = [];
  for (let i = 0; i < periods; i++) {
    // rot tick still happens even if we also consume
    rotStorableFoodOneCharge(player.inventory);

    if (player.stats.hunger <= 0) continue;
    // pick first storable food stack
    const storable = player.inventory.find((s) => {
      const id = s.id;
      return typeof id === "string" && id.startsWith("food_") && FOODS[id as FoodId]?.storable && s.qty > 0;
    });
    if (!storable) continue;
    const foodId = storable.id as FoodId;

    // consume one unit
    if (storable.freshness && storable.freshness.length) {
      invRemoveFreshnessUnits(player.inventory, foodId, 1);
    } else {
      invRemove(player.inventory, foodId, 1);
    }
    const red = FOODS[foodId].hungerReduction;
    player.stats.hunger = clamp(player.stats.hunger - red, 0, player.stats.maxHunger);
    const rec = consumed.find((c) => c.foodId === foodId);
    if (rec) rec.units += 1;
    else consumed.push({ foodId, units: 1 });
  }
  return consumed;
}

export function applyFatigueRecovery(player: PlayerState, periods: number) {
  // Tail Curler only works when equipped; numbers remain hidden from UI
  if (!hasEquippedTail(player, "eq_tail_curler")) return 0;
  const per = ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0;
  if (per <= 0) return 0;
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
  // de-dupe for readability
  return Array.from(new Set(out)).slice(0, prof.surfacedEventsMax);
}

export function makeJourneyPreview(player: PlayerState, mode: "explore" | "findFood"): JourneyPreview {
  const stepsRange = mode === "explore" ? BIOME_LEVEL.exploreStepsRange : BIOME_LEVEL.foodStepsRange;

  const poiId = pickWeighted(mode === "explore" ? BIOME_LEVEL.poiWeightsExplore : BIOME_LEVEL.poiWeightsFood);
  const quality = qualityRoll();
  const events = rollEvents(mode);

  // Base travel cost
  const baseHungerIncreaseRange: [number, number] = [stepsRange[0] * BIOME_LEVEL.hungerPerStep, stepsRange[1] * BIOME_LEVEL.hungerPerStep];
  const baseFatigueIncreaseRange: [number, number] = [stepsRange[0] * BIOME_LEVEL.fatiguePerStep, stepsRange[1] * BIOME_LEVEL.fatiguePerStep];

  // If the rolled POI is a food source, add the foraging cost range too (Bug C)
  const poiData = POIS[poiId];
  let hungerIncreaseRange = baseHungerIncreaseRange;
  let fatigueIncreaseRange = baseFatigueIncreaseRange;
  let foragePeriodsRange: [number, number] | null = null;

  if (poiData.kind === "food" && poiData.foodSpec) {
    foragePeriodsRange = poiData.foodSpec.foragePeriodsRange;
    hungerIncreaseRange = [
      baseHungerIncreaseRange[0] + foragePeriodsRange[0] * poiData.foodSpec.forageHungerPerPeriod,
      baseHungerIncreaseRange[1] + foragePeriodsRange[1] * poiData.foodSpec.forageHungerPerPeriod,
    ];
    fatigueIncreaseRange = [
      baseFatigueIncreaseRange[0] + foragePeriodsRange[0] * poiData.foodSpec.forageFatiguePerPeriod,
      baseFatigueIncreaseRange[1] + foragePeriodsRange[1] * poiData.foodSpec.forageFatiguePerPeriod,
    ];
  }

  // Subtract Tail Curler recovery from gross fatigue to show net cost
  const tailCurlerRecoveryPerPeriod = hasEquippedTail(player, "eq_tail_curler")
    ? (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0)
    : 0;
  const totalPeriodsLower = stepsRange[0] + (foragePeriodsRange ? foragePeriodsRange[0] : 0);
  const totalPeriodsUpper2 = stepsRange[1] + (foragePeriodsRange ? foragePeriodsRange[1] : 0);
  fatigueIncreaseRange = [
    Math.max(0, fatigueIncreaseRange[0] - tailCurlerRecoveryPerPeriod * totalPeriodsLower),
    Math.max(0, fatigueIncreaseRange[1] - tailCurlerRecoveryPerPeriod * totalPeriodsUpper2),
  ];

  // Estimate storable food consumption via Chomper (auto) only if Chomper is equipped
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  const totalPeriodsUpper = stepsRange[1] + (foragePeriodsRange ? foragePeriodsRange[1] : 0);

  if (hasEquippedTail(player, "eq_chomper")) {
    const storableIds = Array.from(
      new Set(
        player.inventory
          .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
          .map((s) => s.id as FoodId)
      )
    );
    for (const id of storableIds) {
      estFoodConsumed.push({ foodId: id, unitsRange: [0, Math.min(totalPeriodsUpper, invGet(player.inventory, id)?.qty ?? 0)] });
    }
  }

  return {
    mode,
    stepsRange,
    hungerIncreaseRange,
    fatigueIncreaseRange,
    estFoodConsumed,
    poi: { id: poiId, quality },
    surfacedEvents: events,
  };
}

export function resolveJourney(player: PlayerState, preview: JourneyPreview): JourneyResult {
  const steps = randInt(preview.stepsRange[0], preview.stepsRange[1]);
  const eventsOut: EventId[] = [...preview.surfacedEvents];

  // apply time passing: each step is 1 period
  const hungerDelta = steps * BIOME_LEVEL.hungerPerStep;
  const fatigueDelta = steps * BIOME_LEVEL.fatiguePerStep;

  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  player.stats.fatigue = clamp(player.stats.fatigue + fatigueDelta, 0, player.stats.maxFatigue);

  // passive recovery
  const recovered = applyFatigueRecovery(player, steps);

  // auto consume storable food & rot
  const foodConsumed = autoConsumeStorableFood(player, steps);

  // apply events: lightweight effects; keep hidden numbers, but still meaningful
  for (const e of eventsOut) {
    switch (e) {
      case "ev_minor_recovery":
      case "ev_second_wind":
        applyFatigueRecovery(player, 2);
        break;
      case "ev_efficient_path":
        player.stats.fatigue = clamp(player.stats.fatigue - 1, 0, player.stats.maxFatigue);
        break;
      case "ev_sticky_snare":
        player.stats.fatigue = clamp(player.stats.fatigue + 2, 0, player.stats.maxFatigue);
        break;
      case "ev_edible_scrap":
        player.stats.hunger = clamp(player.stats.hunger - 5, 0, player.stats.maxHunger);
        break;
    }
  }

  // if POI is food source, resolve immediate (findFood always forages; explore may or may not)
  const poi = preview.poi;
  const poiData = POIS[poi.id];
  const gained: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[] = [];
  let softSapEaten: { hungerRestored: number } | undefined;
  if (poiData.kind === "food") {
    const spec = poiData.foodSpec!;
    const periods = randInt(spec.foragePeriodsRange[0], spec.foragePeriodsRange[1]);
    // time passes during foraging
    player.stats.hunger = clamp(player.stats.hunger + periods * spec.forageHungerPerPeriod, 0, player.stats.maxHunger);
    player.stats.fatigue = clamp(player.stats.fatigue + periods * spec.forageFatiguePerPeriod, 0, player.stats.maxFatigue);

    applyFatigueRecovery(player, periods);
    const extraConsumed = autoConsumeStorableFood(player, periods);
    for (const c of extraConsumed) {
      const rec = foodConsumed.find((x) => x.foodId === c.foodId);
      if (rec) rec.units += c.units;
      else foodConsumed.push(c);
    }

    // Soft Sap is always available at a food blot — eat it if Chomper is equipped
    if (hasEquippedTail(player, "eq_chomper")) {
      const red = FOODS["food_soft_sap"].hungerReduction;
      const before = player.stats.hunger;
      player.stats.hunger = clamp(player.stats.hunger - red, 0, player.stats.maxHunger);
      softSapEaten = { hungerRestored: before - player.stats.hunger };
      gained.push({ id: "food_soft_sap", qty: 1 });
    } else {
      eventsOut.push("ev_need_chomper");
    }

    // Storable food is also available if Sticky Scoop is equipped
    // Roll weighted by hunger band for storable food type
    let storableGained: { foodId: FoodId; qty: number; freshness: number[] } | undefined;
    if (hasEquippedTail(player, "eq_sticky_scoop")) {
      const band = hungerBand(player.stats.hunger, player.stats.maxHunger);
      const storableWeights: Record<FoodId, number> = preview.mode === "findFood"
        ? spec.findFoodDropByBand[band]
        : spec.exploreDropWeights;
      // only pick storable foods from weights
      const storableOnly: Partial<Record<FoodId, number>> = {};
      for (const [k, v] of Object.entries(storableWeights) as [FoodId, number][]) {
        if (FOODS[k].storable) storableOnly[k] = v;
      }
      const total = Object.values(storableOnly).reduce((a, b) => a + b, 0);
      if (total > 0) {
        const food = pickWeighted(storableOnly as Record<FoodId, number>);
        const fr = FOODS[food].freshnessRange!;
        const unitFreshness = Array.from({ length: 1 }, () => randInt(fr[0], fr[1]));
        invAdd(player.inventory, food, 1, unitFreshness);
        gained.push({ id: food, qty: 1, freshness: unitFreshness });
        storableGained = { foodId: food, qty: 1, freshness: unitFreshness };
      }
    } else {
      eventsOut.push("ev_need_scoop_for_rations");
    }
  }

  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";

  return {
    mode: preview.mode,
    steps,
    surfacedEvents: eventsOut,
    hungerDelta,
    fatigueDelta: fatigueDelta - recovered,
    poi,
    gained,
    foodConsumed,
    softSapEaten,
    outcome,
  };
}

export function methodsAvailableFromEquipment(player: PlayerState): HarvestMethodId[] {
  const ids = player.equipment.tailSlots.filter(Boolean) as ItemId[];
  const methods = ids
    .map((id) => ITEMS[id]?.harvestingMethod)
    .filter(Boolean) as HarvestMethodId[];
  return Array.from(new Set(methods));
}

export function recommendedMethod(poiId: PoiId): HarvestMethodId | null {
  const r = POIS[poiId].methodRank;
  if (!r) return null;
  const entries = Object.entries(r) as [HarvestMethodId, string][];
  const best = entries.find(([, v]) => v === "best");
  return best ? best[0] : entries[0]?.[0] ?? null;
}

export function makeHarvestPreview(player: PlayerState, poiId: PoiId, method: HarvestMethodId): HarvestPreview {
  const poi = POIS[poiId];
  const tuning = poi.methodTuning?.[method];
  if (!tuning || !poi.resourceId || !poi.baseYieldRange || !poi.methodRank || !poi.efficiencyMultipliers) {
    // fallback
    return {
      poiId,
      method,
      periodsRange: [8, 10],
      hungerIncreaseRange: [8, 10],
      fatigueIncreaseRange: [8, 10],
      yieldRange: [1, 2],
      estFoodConsumed: [],
    };
  }

  const periodsRange = tuning.periodsRange;
  const hungerPerPeriod = 1;
  const fatiguePerPeriod = tuning.fatiguePerPeriod;

  const hungerIncreaseRange: [number, number] = [periodsRange[0] * hungerPerPeriod, periodsRange[1] * hungerPerPeriod];
  const tailCurlerRec = hasEquippedTail(player, "eq_tail_curler")
    ? (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0)
    : 0;
  const fatigueIncreaseRange: [number, number] = [
    Math.max(0, periodsRange[0] * fatiguePerPeriod - tailCurlerRec * periodsRange[0]),
    Math.max(0, periodsRange[1] * fatiguePerPeriod - tailCurlerRec * periodsRange[1]),
  ];

  const effLabel = poi.methodRank[method];
  const eff = poi.efficiencyMultipliers[effLabel] ?? 1;

  const base = poi.baseYieldRange;
  const yieldRange: [number, number] = [Math.max(1, Math.floor(base[0] * eff)), Math.max(1, Math.floor(base[1] * eff + 0.5))];

  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  if (hasEquippedTail(player, "eq_chomper")) {
    const storableIds = Array.from(
      new Set(
        player.inventory
          .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
          .map((s) => s.id as FoodId)
      )
    );
    for (const id of storableIds) estFoodConsumed.push({ foodId: id, unitsRange: [0, Math.min(periodsRange[1], invGet(player.inventory, id)?.qty ?? 0)] });
  }

  return { poiId, method, periodsRange, hungerIncreaseRange, fatigueIncreaseRange, yieldRange, estFoodConsumed };
}

export function resolveHarvest(player: PlayerState, preview: HarvestPreview): HarvestResult {
  const poi = POIS[preview.poiId];
  if (poi.kind !== "harvest" || !poi.resourceId || !poi.methodTuning || !poi.methodRank || !poi.efficiencyMultipliers) {
    return { poiId: preview.poiId, method: preview.method, periods: 0, hungerDelta: 0, fatigueDelta: 0, gained: [], xpGained: 0, foodConsumed: [], outcome: "ok", message: "Nothing to harvest here." };
  }

  const tuning = poi.methodTuning[preview.method];
  const periods = randInt(tuning.periodsRange[0], tuning.periodsRange[1]);

  // apply time
  const hungerPerPeriod = 1;
  const fatiguePerPeriod = tuning.fatiguePerPeriod;

  const hungerDelta = periods * hungerPerPeriod;
  const fatigueDelta = periods * fatiguePerPeriod;

  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  player.stats.fatigue = clamp(player.stats.fatigue + fatigueDelta, 0, player.stats.maxFatigue);

  applyFatigueRecovery(player, periods);
  const foodConsumed = autoConsumeStorableFood(player, periods);

  // yield with skill multiplier
  const effLabel = poi.methodRank[preview.method];
  const eff = poi.efficiencyMultipliers[effLabel] ?? 1;
  const base = poi.baseYieldRange!;
  const raw = randInt(base[0], base[1]);
  const skill = 1 + (skillLevel(player.xp[preview.method] ?? 0) - 1) * 0.08; // +8% yield per level
  const qty = Math.max(1, Math.floor(raw * eff * skill));

  invAdd(player.inventory, poi.resourceId, qty);
  const gained = [{ id: poi.resourceId, qty }];

  const xpGained = Math.max(4, Math.floor(periods * 1.25));
  player.xp[preview.method] = (player.xp[preview.method] ?? 0) + xpGained;

  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";
  return {
    poiId: preview.poiId,
    method: preview.method,
    periods,
    hungerDelta,
    fatigueDelta,
    gained,
    xpGained,
    foodConsumed,
    outcome,
  };
}

export function canCraft(player: PlayerState) {
  // crafting disabled when exhausted
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

export function makeCraftPreview(player: PlayerState, recipeId: string): CraftPreview {
  const r = RECIPES[recipeId];
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  if (hasEquippedTail(player, "eq_chomper")) {
    const storableIds = Array.from(
      new Set(
        player.inventory
          .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
          .map((s) => s.id as FoodId)
      )
    );
    for (const id of storableIds) estFoodConsumed.push({ foodId: id, unitsRange: [0, Math.min(r.craftPeriods, invGet(player.inventory, id)?.qty ?? 0)] });
  }
  const craftTailCurlerRec = hasEquippedTail(player, "eq_tail_curler")
    ? (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0)
    : 0;
  return {
    recipeId,
    craftPeriods: r.craftPeriods,
    hungerIncrease: r.craftPeriods * r.hungerPerPeriod,
    fatigueIncrease: Math.max(0, r.craftPeriods * r.fatiguePerPeriod - craftTailCurlerRec * r.craftPeriods),
    estFoodConsumed,
  };
}

export function resolveCraft(player: PlayerState, preview: CraftPreview): CraftResult {
  const r = RECIPES[preview.recipeId];
  // check materials
  for (const need of r.inputs) {
    const have = invGet(player.inventory, need.id)?.qty ?? 0;
    if (have < need.qty) {
      return { recipeId: preview.recipeId, success: false, failReason: "missing_resources", hungerDelta: 0, fatigueDelta: 0, foodConsumed: [] };
    }
  }

  // consume inputs
  for (const need of r.inputs) invRemove(player.inventory, need.id, need.qty);

  // apply time
  const hungerDelta = r.craftPeriods * r.hungerPerPeriod;
  const fatigueDelta = r.craftPeriods * r.fatiguePerPeriod;

  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  player.stats.fatigue = clamp(player.stats.fatigue + fatigueDelta, 0, player.stats.maxFatigue);

  applyFatigueRecovery(player, r.craftPeriods);
  const foodConsumed = autoConsumeStorableFood(player, r.craftPeriods);

  if (player.stats.hunger >= player.stats.maxHunger) return { recipeId: preview.recipeId, success: false, failReason: "dead", hungerDelta, fatigueDelta, foodConsumed };
  if (player.stats.fatigue >= player.stats.maxFatigue) return { recipeId: preview.recipeId, success: false, failReason: "exhausted", hungerDelta, fatigueDelta, foodConsumed };

  invAdd(player.inventory, r.output.itemId, r.output.qty);
  return {
    recipeId: preview.recipeId,
    success: true,
    hungerDelta,
    fatigueDelta,
    foodConsumed,
    crafted: { itemId: r.output.itemId, qty: r.output.qty },
  };
}

export function recoverPreview(player: PlayerState) {
  // fixed recover block (immediate), simple MVP: 8 periods
  const periods = 8;
  const hungerDelta = periods * 1;
  const fatigueRecovered = hasEquippedTail(player, "eq_tail_curler") ? (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0) * periods : 0;
  // estimation for auto consume - only if Chomper is equipped
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  if (hasEquippedTail(player, "eq_chomper")) {
    const storableIds = Array.from(
      new Set(
        player.inventory
          .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
          .map((s) => s.id as FoodId)
      )
    );
    for (const id of storableIds) estFoodConsumed.push({ foodId: id, unitsRange: [0, Math.min(periods, invGet(player.inventory, id)?.qty ?? 0)] });
  }

  return { periods, hungerDeltaRange: [hungerDelta, hungerDelta] as [number, number], fatigueRecoveredRange: [0, fatigueRecovered] as [number, number], estFoodConsumed };
}

export function resolveRecover(player: PlayerState, periods: number) {
  const hungerDelta = periods * 1;
  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  const before = player.stats.fatigue;
  applyFatigueRecovery(player, periods);
  const recovered = before - player.stats.fatigue;
  const foodConsumed = autoConsumeStorableFood(player, periods);
  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";
  return { periods, hungerDelta, fatigueRecovered: recovered, foodConsumed, outcome };
}

export function prettyEvent(e: EventId) {
  return EVENTS[e];
}

export function prettyPoi(poiId: PoiId) {
  return POIS[poiId];
}

export function prettyRecipe(recipeId: string) {
  return RECIPES[recipeId];
}
