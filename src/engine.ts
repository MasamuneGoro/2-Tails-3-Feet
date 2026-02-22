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

export function applyFatigueRecovery(player: PlayerState, periods: number, isResting = false) {
  // Tail Curler only works when equipped; numbers remain hidden from UI
  // When resting (belly down), Tail Curler is 1.5x more effective
  if (!hasEquippedTail(player, "eq_tail_curler")) return 0;
  const base = ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0;
  if (base <= 0) return 0;
  const per = isResting ? base * 1.5 : base;
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

export function makeJourneyPreview(player: PlayerState, mode: "explore" | "findFood", chomperAutoEnabled = true): JourneyPreview {
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
  // Food blot costs are handled interactively at the blot, not during travel

  // Subtract Tail Curler recovery from gross fatigue to show net cost
  const tailCurlerRecoveryPerPeriod = hasEquippedTail(player, "eq_tail_curler")
    ? (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0)
    : 0;
  fatigueIncreaseRange = [
    Math.max(0, fatigueIncreaseRange[0] - tailCurlerRecoveryPerPeriod * stepsRange[0]),
    Math.max(0, fatigueIncreaseRange[1] - tailCurlerRecoveryPerPeriod * stepsRange[1]),
  ];

  // Estimate storable food consumption via Chomper (auto) only if Chomper is equipped
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  const totalPeriodsUpper = stepsRange[1];

  if (hasEquippedTail(player, "eq_chomper") && chomperAutoEnabled) {
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

  // Generate blot state
  const blot = generateBlot(poiId, quality);

  return {
    mode,
    stepsRange,
    hungerIncreaseRange,
    fatigueIncreaseRange,
    estFoodConsumed,
    poi: { id: poiId, quality },
    surfacedEvents: events,
    blot,
  };
}

export function generateBlot(poiId: PoiId, quality: Quality): import("./types").BlotState {
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

export function resolveJourney(player: PlayerState, preview: JourneyPreview, chomperAutoEnabled = true): JourneyResult {
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
  const foodConsumed = chomperAutoEnabled ? autoConsumeStorableFood(player, steps) : ((() => { for (let i=0;i<steps;i++) rotStorableFoodOneCharge(player.inventory); return []; })());

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
  let softSapEaten: { hungerRestored: number; units: number } | undefined;

  // Check death BEFORE food blot resolution
  if (player.stats.hunger >= player.stats.maxHunger) {
    const outcome = "dead";
    return {
      mode: preview.mode, steps, surfacedEvents: eventsOut,
      hungerDelta, fatigueDelta: fatigueDelta - recovered,
      poi, gained, foodConsumed, blot: preview.blot, outcome,
    };
  }

  if (poiData.kind === "food") {
    const spec = poiData.foodSpec!;
    const blot = preview.blot;

    // Soft Sap — Chomper eats up to biteSize units, costs fatigue per unit eaten
    if (hasEquippedTail(player, "eq_chomper")) {
      const biteSize = ITEMS.eq_chomper.effects?.chomper?.biteSize ?? 1;
      const available = blot.sapRemaining ?? 0;
      const toEat = Math.min(biteSize, available);
      if (toEat > 0) {
        let totalHungerRestored = 0;
        const fatigueCostPerUnit = 2;
        for (let i = 0; i < toEat; i++) {
          if (player.stats.fatigue >= player.stats.maxFatigue) break;
          const red = FOODS["food_soft_sap"].hungerReduction;
          const before = player.stats.hunger;
          player.stats.hunger = clamp(player.stats.hunger - red, 0, player.stats.maxHunger);
          totalHungerRestored += before - player.stats.hunger;
          player.stats.fatigue = clamp(player.stats.fatigue + fatigueCostPerUnit, 0, player.stats.maxFatigue);
          applyFatigueRecovery(player, 1);
          gained.push({ id: "food_soft_sap", qty: 1 });
          blot.sapRemaining = (blot.sapRemaining ?? 0) - 1;
        }
        softSapEaten = { hungerRestored: totalHungerRestored, units: toEat };
      }
    } else {
      eventsOut.push("ev_need_chomper");
    }

    // Storable food — Sticky Scoop harvests, costs hunger + fatigue per unit
    if (hasEquippedTail(player, "eq_sticky_scoop")) {
      const available = blot.storableRemaining ?? 0;
      const food = blot.storableFood;
      if (available > 0 && food) {
        const hungerCostPerUnit = spec.forageHungerPerPeriod;
        const fatigueCostPerUnit = spec.forageFatiguePerPeriod;
        // harvest 1 unit
        player.stats.hunger = clamp(player.stats.hunger + hungerCostPerUnit, 0, player.stats.maxHunger);
        player.stats.fatigue = clamp(player.stats.fatigue + fatigueCostPerUnit, 0, player.stats.maxFatigue);
        applyFatigueRecovery(player, 1);
        const extraConsumed = autoConsumeStorableFood(player, 1);
        for (const c of extraConsumed) {
          const rec = foodConsumed.find((x) => x.foodId === c.foodId);
          if (rec) rec.units += c.units;
          else foodConsumed.push(c);
        }
        if (player.stats.hunger < player.stats.maxHunger) {
          const fr = FOODS[food].freshnessRange!;
          const unitFreshness = [randInt(fr[0], fr[1])];
          invAdd(player.inventory, food, 1, unitFreshness);
          gained.push({ id: food, qty: 1, freshness: unitFreshness });
          blot.storableRemaining = (blot.storableRemaining ?? 0) - 1;
        }
      }
    } else if (!hasEquippedTail(player, "eq_sticky_scoop")) {
      if (!eventsOut.includes("ev_need_scoop_for_rations")) eventsOut.push("ev_need_scoop_for_rations");
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
    blot: preview.blot,
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

export function makeHarvestPreview(player: PlayerState, poiId: PoiId, method: HarvestMethodId, chomperAutoEnabled = true): HarvestPreview {
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
      efficiencyLabel: "ok",
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
  if (hasEquippedTail(player, "eq_chomper") && chomperAutoEnabled) {
    const storableIds = Array.from(
      new Set(
        player.inventory
          .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
          .map((s) => s.id as FoodId)
      )
    );
    for (const id of storableIds) estFoodConsumed.push({ foodId: id, unitsRange: [0, Math.min(periodsRange[1], invGet(player.inventory, id)?.qty ?? 0)] });
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

  // apply time
  const hungerPerPeriod = 1;
  const fatiguePerPeriod = tuning.fatiguePerPeriod;

  const hungerDelta = periods * hungerPerPeriod;
  const fatigueDelta = periods * fatiguePerPeriod;

  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  player.stats.fatigue = clamp(player.stats.fatigue + fatigueDelta, 0, player.stats.maxFatigue);

  applyFatigueRecovery(player, periods);
  const foodConsumed = chomperAutoEnabled ? autoConsumeStorableFood(player, periods) : ((() => { for (let i=0;i<periods;i++) rotStorableFoodOneCharge(player.inventory); return []; })());

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

export function makeCraftPreview(player: PlayerState, recipeId: string, chomperAutoEnabled = true): CraftPreview {
  const r = RECIPES[recipeId];
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  if (hasEquippedTail(player, "eq_chomper") && chomperAutoEnabled) {
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

export function resolveCraft(player: PlayerState, preview: CraftPreview, chomperAutoEnabled = true): CraftResult {
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
  const foodConsumed = chomperAutoEnabled ? autoConsumeStorableFood(player, r.craftPeriods) : ((() => { for (let i=0;i<r.craftPeriods;i++) rotStorableFoodOneCharge(player.inventory); return []; })());

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

export function recoverPreview(player: PlayerState, chomperAutoEnabled = true) {
  const periods = 8;
  const hungerDelta = periods * 1;
  // 1.5x multiplier when resting
  const baseRecovery = ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0;
  const fatigueRecovered = hasEquippedTail(player, "eq_tail_curler") ? baseRecovery * 1.5 * periods : 0;
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  if (hasEquippedTail(player, "eq_chomper") && chomperAutoEnabled) {
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

export function resolveRecover(player: PlayerState, periods: number, chomperAutoEnabled = true) {
  const hungerDelta = periods * 1;
  player.stats.hunger = clamp(player.stats.hunger + hungerDelta, 0, player.stats.maxHunger);
  const before = player.stats.fatigue;
  // isResting = true gives 1.5x tail curler recovery
  applyFatigueRecovery(player, periods, true);
  const recovered = before - player.stats.fatigue;
  const foodConsumed = chomperAutoEnabled ? autoConsumeStorableFood(player, periods) : [];
  if (!chomperAutoEnabled) {
    // still rot food even if chomper auto is off
    for (let i = 0; i < periods; i++) rotStorableFoodOneCharge(player.inventory);
  }
  const outcome = player.stats.hunger >= player.stats.maxHunger ? "dead" : player.stats.fatigue >= player.stats.maxFatigue ? "exhausted" : "ok";
  return { periods, hungerDelta, fatigueRecovered: recovered, foodConsumed, outcome };
}

export function eatSapAtBlot(player: PlayerState, blot: BlotState): EatSapResult {
  const biteSize = ITEMS.eq_chomper.effects?.chomper?.biteSize ?? 1;
  const available = blot.sapRemaining ?? 0;
  const toEat = Math.min(biteSize, available);
  const fatigueCostPerUnit = 2;
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

export function prettyEvent(e: EventId) {
  return EVENTS[e];
}

export function prettyPoi(poiId: PoiId) {
  return POIS[poiId];
}

export function prettyRecipe(recipeId: string) {
  return RECIPES[recipeId];
}
