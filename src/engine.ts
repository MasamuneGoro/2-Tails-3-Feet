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

export function satietyBand(satiety: number, maxSatiety: number): "comfort" | "concern" | "desperation" {
  const ratio = satiety / maxSatiety;
  if (ratio > 0.5) return "comfort";
  if (ratio > 0.2) return "concern";
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

export function autoConsumeStorableFood(player: PlayerState, periods: number, chomperAutoEnabled = true): { consumed: { foodId: FoodId; units: number }[]; satietyRestored: number } {
  const chomperCount = countEquippedTail(player, "eq_chomper");
  if (chomperCount === 0 || !chomperAutoEnabled) {
    for (let i = 0; i < periods; i++) rotStorableFoodOneCharge(player.inventory);
    return { consumed: [], satietyRestored: 0 };
  }
  const consumed: { foodId: FoodId; units: number }[] = [];
  let satietyRestored = 0;
  for (let i = 0; i < periods; i++) {
    rotStorableFoodOneCharge(player.inventory);
    for (let c = 0; c < chomperCount; c++) {
      if (player.stats.satiety >= player.stats.maxSatiety) break;
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
      const restored = FOODS[foodId].satietyRestored;
      const before = player.stats.satiety;
      player.stats.satiety = clamp(player.stats.satiety + restored, 0, player.stats.maxSatiety);
      satietyRestored += player.stats.satiety - before;
      const rec = consumed.find((x) => x.foodId === foodId);
      if (rec) rec.units += 1;
      else consumed.push({ foodId, units: 1 });
    }
  }
  return { consumed, satietyRestored };
}

export function applyStaminaRecovery(player: PlayerState, periods: number, context: "normal" | "resting" | "working" = "normal"): import("./types").StaminaRecoveryEntry[] {
  const breakdown: import("./types").StaminaRecoveryEntry[] = [];
  const slots = player.equipment.tailSlots;
  for (const itemId of slots) {
    if (!itemId) continue;
    const item = ITEMS[itemId];
    const base = item.effects?.staminaRecoveryPerPeriod ?? 0;
    if (base <= 0) continue;
    const perPeriod = context === "resting" ? base * 1.5
      : context === "working" ? (item.effects?.staminaRecoveryPerPeriodWorking ?? base)
      : base;
    const total = perPeriod * periods;
    const before = player.stats.stamina;
    player.stats.stamina = clamp(player.stats.stamina + total, 0, player.stats.maxStamina);
    const actual = player.stats.stamina - before;
    if (actual > 0) breakdown.push({ itemId, name: item.name, recovered: actual });
  }
  return breakdown;
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

  const baseSatietyCostRange: [number, number] = [stepsRange[0] * BIOME_LEVEL.satietyPerStep, stepsRange[1] * BIOME_LEVEL.satietyPerStep];
  const baseStaminaCostRange: [number, number] = [stepsRange[0] * BIOME_LEVEL.staminaPerStep, stepsRange[1] * BIOME_LEVEL.staminaPerStep];

  const curlerCount = countEquippedTail(player, "eq_tail_curler");
  const tailCurlerRecoveryPerPeriod = curlerCount * (ITEMS.eq_tail_curler.effects?.staminaRecoveryPerPeriod ?? 0);
  const journeyPeriods = (n: number) => Math.floor(n / 20);

  const satietyCostRange = baseSatietyCostRange;
  const staminaCostRange = baseStaminaCostRange;

  const staminaRecoveryPerPeriodRange: [number, number] = [
    tailCurlerRecoveryPerPeriod * journeyPeriods(stepsRange[0]),
    tailCurlerRecoveryPerPeriod * journeyPeriods(stepsRange[1]),
  ];

  const chomperCount = countEquippedTail(player, "eq_chomper");
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  let satietyRestoredRange: [number, number] = [0, 0];
  const totalPeriodsUpper = stepsRange[1];

  if (chomperCount > 0 && chomperAutoEnabled) {
    const storableIds = Array.from(new Set(
      player.inventory
        .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
        .map((s) => s.id as FoodId)
    ));
    let maxSatietyPerPeriod = 0;
    for (const id of storableIds) {
      const maxUnits = Math.min(totalPeriodsUpper * chomperCount, invGet(player.inventory, id)?.qty ?? 0);
      estFoodConsumed.push({ foodId: id, unitsRange: [0, maxUnits] });
      maxSatietyPerPeriod += FOODS[id].satietyRestored * Math.min(chomperCount, invGet(player.inventory, id)?.qty ?? 0);
    }
    const maxRestored = Math.min(baseSatietyCostRange[1], maxSatietyPerPeriod);
    satietyRestoredRange = [0, maxRestored];
  }

  const blot = generateBlot(poiId, quality);
  return { mode, stepsRange, satietyCostRange, satietyRestoredRange, staminaCostRange, staminaRecoveryPerPeriodRange, estFoodConsumed, poi: { id: poiId, quality }, surfacedEvents: events, blot };
}

export function generateBlot(poiId: PoiId, quality: Quality): BlotState {
  const poiData = POIS[poiId];
  const variant = quality === "uncommon" ? 3 + randInt(0, 1) : randInt(0, 2);
  if (poiData.kind === "harvest") {
    const base = quality === "uncommon" ? 4 : 3;
    const harvestCharges = randInt(base, base + 2);
    return { poiId, quality, variant, harvestCharges, maxHarvestCharges: harvestCharges };
  } else {
    const spec = poiData.foodSpec!;
    const sapRemaining = randInt(spec.sapQtyRange[0], spec.sapQtyRange[1]);
    const storableRemaining = randInt(spec.storableQtyRange[0], spec.storableQtyRange[1]);
    return { poiId, quality, variant, sapRemaining, storableRemaining, storableFood: spec.storableFood };
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
    const satietyBefore = player.stats.satiety;
    const staminaBefore = player.stats.stamina;
    const gained: { id: ResourceId | FoodId; qty: number }[] = [];

    switch (e) {
      case "ev_sticky_drag":
        extraSteps += 20;
        player.stats.satiety = clamp(player.stats.satiety - 20 * BIOME_LEVEL.satietyPerStep, 0, player.stats.maxSatiety);
        player.stats.stamina = clamp(player.stats.stamina - 20 * BIOME_LEVEL.staminaPerStep, 0, player.stats.maxStamina);
        applyStaminaRecovery(player, Math.floor(20 / 20));
        if (countEquippedTail(player, "eq_chomper") > 0 && chomperAutoEnabled) {
          const { consumed: fc } = autoConsumeStorableFood(player, 2, chomperAutoEnabled);
          for (const c of fc) {
            const r = foodConsumed.find(x => x.foodId === c.foodId);
            if (r) r.units += c.units; else foodConsumed.push({ ...c });
          }
        }
        break;
      case "ev_resin_smear":
        player.stats.satiety = clamp(player.stats.satiety + 30, 0, player.stats.maxSatiety);
        break;
      case "ev_slow_going":
        player.stats.stamina = clamp(player.stats.stamina - 20, 0, player.stats.maxStamina);
        break;
      case "ev_loose_fibers":
        invAdd(player.inventory, "fiber_clump", 1);
        gained.push({ id: "fiber_clump", qty: 1 });
        break;
      case "ev_minor_recovery":
        player.stats.stamina = clamp(player.stats.stamina + 20, 0, player.stats.maxStamina);
        break;
      case "ev_rich_vein_hint":
        invAdd(player.inventory, "resin_glob", 1);
        gained.push({ id: "resin_glob", qty: 1 });
        break;
      case "ev_sticky_snare":
        player.stats.stamina = clamp(player.stats.stamina - 30, 0, player.stats.maxStamina);
        break;
      case "ev_edible_scrap":
        player.stats.satiety = clamp(player.stats.satiety + 80, 0, player.stats.maxSatiety);
        break;
      case "ev_efficient_path":
        player.stats.stamina = clamp(player.stats.stamina + 30, 0, player.stats.maxStamina);
        break;
      case "ev_muscle_pull":
        player.stats.stamina = clamp(player.stats.stamina - 20, 0, player.stats.maxStamina);
        player.stats.satiety = clamp(player.stats.satiety - 20, 0, player.stats.maxSatiety);
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
        player.stats.stamina = clamp(player.stats.stamina + 60, 0, player.stats.maxStamina);
        break;
      case "ev_need_chomper":
      case "ev_need_scoop_for_rations":
        break;
    }

    eventEffects[e] = {
      satietyDelta: player.stats.satiety - satietyBefore,
      staminaDelta: player.stats.stamina - staminaBefore,
      gained,
    };
  }

  return { eventEffects, extraSteps, foodConsumed };
}

export function resolveJourney(player: PlayerState, preview: JourneyPreview, chomperAutoEnabled = true): JourneyResult {
  const steps = randInt(preview.stepsRange[0], preview.stepsRange[1]);
  const eventsOut: EventId[] = [...preview.surfacedEvents];

  const satietyDelta = steps * BIOME_LEVEL.satietyPerStep;
  const staminaDelta = steps * BIOME_LEVEL.staminaPerStep;

  player.stats.satiety = clamp(player.stats.satiety - satietyDelta, 0, player.stats.maxSatiety);
  player.stats.stamina = clamp(player.stats.stamina - staminaDelta, 0, player.stats.maxStamina);

  const staminaRecovery = applyStaminaRecovery(player, Math.floor(steps / 20));

  const { consumed: foodConsumed, satietyRestored: satietyRestoredByChomper } = autoConsumeStorableFood(player, steps, chomperAutoEnabled);

  const { eventEffects, extraSteps, foodConsumed: eventFood } = applyEvents(player, eventsOut, chomperAutoEnabled);
  for (const c of eventFood) {
    const r = foodConsumed.find(x => x.foodId === c.foodId);
    if (r) r.units += c.units; else foodConsumed.push({ ...c });
  }

  const poi = preview.poi;
  const poiData = POIS[poi.id];
  const gained: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[] = [];
  for (const eff of Object.values(eventEffects)) {
    for (const g of eff.gained) {
      const existing = gained.find(x => x.id === g.id);
      if (existing) existing.qty += g.qty; else gained.push({ ...g });
    }
  }

  let softSapEaten: { satietyRestored: number; units: number } | undefined;

  // Death check BEFORE food blot resolution
  if (player.stats.satiety <= 0) {
    return {
      mode: preview.mode, steps: steps + extraSteps, surfacedEvents: eventsOut, eventEffects,
      satietyDelta, satietyRestoredByChomper, staminaDelta, staminaRecovery, poi, gained, foodConsumed, blot: preview.blot, outcome: "dead",
    };
  }

  if (poiData.kind === "food") {
    if (!hasEquippedTail(player, "eq_chomper")) eventsOut.push("ev_need_chomper");
    if (!hasEquippedTail(player, "eq_sticky_scoop")) {
      if (!eventsOut.includes("ev_need_scoop_for_rations")) eventsOut.push("ev_need_scoop_for_rations");
    }
  }

  const outcome = player.stats.satiety <= 0 ? "dead" : player.stats.stamina <= 0 ? "exhausted" : "ok";

  return {
    mode: preview.mode,
    steps: steps + extraSteps,
    surfacedEvents: eventsOut,
    eventEffects,
    satietyDelta,
    satietyRestoredByChomper,
    staminaDelta,
    staminaRecovery,
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
    return { poiId, method, periodsRange: [8, 10], satietyCostRange: [8, 10], satietyRestoredRange: [0, 0], staminaCostRange: [8, 10], staminaRecoveryPerPeriodRange: [0, 0], yieldRange: [1, 2], estFoodConsumed: [], efficiencyLabel: "ok" };
  }

  const periodsRange = tuning.periodsRange;
  const satietyPerPeriod = 10;
  const staminaPerPeriod = tuning.staminaPerPeriod;

  const satietyCostRange: [number, number] = [periodsRange[0] * satietyPerPeriod, periodsRange[1] * satietyPerPeriod];
  const curlerCount = countEquippedTail(player, "eq_tail_curler");
  const tailCurlerRec = curlerCount * (ITEMS.eq_tail_curler.effects?.staminaRecoveryPerPeriodWorking ?? ITEMS.eq_tail_curler.effects?.staminaRecoveryPerPeriod ?? 0);
  const staminaCostRange: [number, number] = [periodsRange[0] * staminaPerPeriod, periodsRange[1] * staminaPerPeriod];
  const staminaRecoveryPerPeriodRange: [number, number] = [tailCurlerRec * periodsRange[0], tailCurlerRec * periodsRange[1]];

  const effLabel = poi.methodRank[method];
  const eff = poi.efficiencyMultipliers[effLabel] ?? 1;
  const base = poi.baseYieldRange;
  // Count how many tools providing this method are equipped
  const toolIds = Object.keys(ITEMS) as ItemId[];
  const toolForMethod = toolIds.find(id => ITEMS[id].harvestingMethod === method);
  const toolCount = toolForMethod ? countEquippedTail(player, toolForMethod) : 1;
  const yieldRange: [number, number] = [
    Math.max(1, Math.floor(base[0] * eff)) * Math.max(1, toolCount),
    Math.max(1, Math.floor(base[1] * eff + 0.5)) * Math.max(1, toolCount),
  ];

  const chomperCount = countEquippedTail(player, "eq_chomper");
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  let satietyRestoredRange: [number, number] = [0, 0];
  if (chomperCount > 0 && chomperAutoEnabled) {
    const storableIds = Array.from(new Set(
      player.inventory
        .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
        .map((s) => s.id as FoodId)
    ));
    let maxSatietyRestored = 0;
    for (const id of storableIds) {
      const maxUnits = Math.min(periodsRange[1] * chomperCount, invGet(player.inventory, id)?.qty ?? 0);
      estFoodConsumed.push({ foodId: id, unitsRange: [0, maxUnits] });
      maxSatietyRestored += FOODS[id].satietyRestored * maxUnits;
    }
    satietyRestoredRange = [0, Math.min(satietyCostRange[1], maxSatietyRestored)];
  }

  return { poiId, method, periodsRange, satietyCostRange, satietyRestoredRange, staminaCostRange, staminaRecoveryPerPeriodRange, yieldRange, estFoodConsumed, efficiencyLabel: effLabel };
}

export function resolveHarvest(player: PlayerState, preview: HarvestPreview, chomperAutoEnabled = true): HarvestResult {
  const poi = POIS[preview.poiId];
  if (poi.kind !== "harvest" || !poi.resourceId || !poi.methodTuning || !poi.methodRank || !poi.efficiencyMultipliers) {
    return { poiId: preview.poiId, method: preview.method, periods: 0, satietyDelta: 0, satietyRestoredByChomper: 0, staminaDelta: 0, staminaRecovery: [], gained: [], xpGained: 0, foodConsumed: [], outcome: "ok", message: "Nothing to harvest here." };
  }

  const tuning = poi.methodTuning[preview.method];
  const periods = randInt(tuning.periodsRange[0], tuning.periodsRange[1]);

  const satietyPerPeriod = 10;
  const staminaPerPeriod = tuning.staminaPerPeriod;
  const satietyDelta = periods * satietyPerPeriod;
  const staminaDelta = periods * staminaPerPeriod;

  player.stats.satiety = clamp(player.stats.satiety - satietyDelta, 0, player.stats.maxSatiety);
  player.stats.stamina = clamp(player.stats.stamina - staminaDelta, 0, player.stats.maxStamina);

  const staminaRecovery = applyStaminaRecovery(player, periods, "working");
  const { consumed: foodConsumed, satietyRestored: satietyRestoredByChomper } = autoConsumeStorableFood(player, periods, chomperAutoEnabled);

  const effLabel = poi.methodRank[preview.method];
  const eff = poi.efficiencyMultipliers[effLabel] ?? 1;
  const base = poi.baseYieldRange!;
  const raw = randInt(base[0], base[1]);
  const skill = 1 + (skillLevel(player.xp[preview.method] ?? 0) - 1) * 0.08;

  // Count how many tools providing this method are equipped — each swings independently
  const toolIds = Object.keys(ITEMS) as ItemId[];
  const toolForMethod = toolIds.find(id => ITEMS[id].harvestingMethod === preview.method);
  const toolCount = toolForMethod ? countEquippedTail(player, toolForMethod) : 1;
  const qty = Math.max(1, Math.floor(raw * eff * skill)) * Math.max(1, toolCount);

  invAdd(player.inventory, poi.resourceId, qty);
  const gained = [{ id: poi.resourceId, qty }];

  const xpGained = Math.max(4, Math.floor(periods * 1.25));
  player.xp[preview.method] = (player.xp[preview.method] ?? 0) + xpGained;

  const outcome = player.stats.satiety <= 0 ? "dead" : player.stats.stamina <= 0 ? "exhausted" : "ok";
  return { poiId: preview.poiId, method: preview.method, periods, satietyDelta, satietyRestoredByChomper, staminaDelta, staminaRecovery, gained, xpGained, foodConsumed, outcome };
}

export function canCraft(player: PlayerState) {
  return player.stats.stamina > 0 && player.stats.satiety > 0;
}

export function listUnlockedRecipes(player: PlayerState): string[] {
  const hasTinker = hasEquippedTail(player, "eq_tinker_shaft");
  if (!hasTinker) return [];
  return Object.keys(RECIPES);
}

export function makeCraftPreview(player: PlayerState, recipeId: string, chomperAutoEnabled = true): CraftPreview {
  const r = RECIPES[recipeId];
  const chomperCount = countEquippedTail(player, "eq_chomper");
  const estFoodConsumed: { foodId: FoodId; unitsRange: [number, number] }[] = [];
  let satietyRestoredRange: [number, number] = [0, 0];
  if (chomperCount > 0 && chomperAutoEnabled) {
    const storableIds = Array.from(new Set(
      player.inventory
        .filter((s) => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as FoodId]?.storable && s.qty > 0)
        .map((s) => s.id as FoodId)
    ));
    let maxSatietyRestored = 0;
    for (const id of storableIds) {
      const maxUnits = Math.min(r.craftPeriods * chomperCount, invGet(player.inventory, id)?.qty ?? 0);
      estFoodConsumed.push({ foodId: id, unitsRange: [0, maxUnits] });
      maxSatietyRestored += FOODS[id].satietyRestored * maxUnits;
    }
    const rawSatiety = r.craftPeriods * r.satietyPerPeriod;
    satietyRestoredRange = [0, Math.min(rawSatiety, maxSatietyRestored)];
  }
  const curlerCount = countEquippedTail(player, "eq_tail_curler");
  const staminaRecoveryTotal = curlerCount * (ITEMS.eq_tail_curler.effects?.staminaRecoveryPerPeriodWorking ?? ITEMS.eq_tail_curler.effects?.staminaRecoveryPerPeriod ?? 0) * r.craftPeriods;
  return {
    recipeId,
    craftPeriods: r.craftPeriods,
    satietyCost: r.craftPeriods * r.satietyPerPeriod,
    satietyRestoredRange,
    staminaCost: r.craftPeriods * r.staminaPerPeriod,
    staminaRecoveryTotal,
    estFoodConsumed,
  };
}

export function resolveCraft(player: PlayerState, preview: CraftPreview, chomperAutoEnabled = true): CraftResult {
  const r = RECIPES[preview.recipeId];
  for (const need of r.inputs) {
    const have = invGet(player.inventory, need.id)?.qty ?? 0;
    if (have < need.qty) return { recipeId: preview.recipeId, success: false, failReason: "missing_resources", satietyDelta: 0, satietyRestoredByChomper: 0, staminaDelta: 0, staminaRecovery: [], foodConsumed: [] };
  }
  for (const need of r.inputs) invRemove(player.inventory, need.id, need.qty);

  const satietyDelta = r.craftPeriods * r.satietyPerPeriod;
  const staminaDelta = r.craftPeriods * r.staminaPerPeriod;

  player.stats.satiety = clamp(player.stats.satiety - satietyDelta, 0, player.stats.maxSatiety);
  player.stats.stamina = clamp(player.stats.stamina - staminaDelta, 0, player.stats.maxStamina);

  const staminaRecovery = applyStaminaRecovery(player, r.craftPeriods, "working");
  const { consumed: foodConsumed, satietyRestored: satietyRestoredByChomper } = autoConsumeStorableFood(player, r.craftPeriods, chomperAutoEnabled);

  if (player.stats.satiety <= 0) return { recipeId: preview.recipeId, success: false, failReason: "dead", satietyDelta, satietyRestoredByChomper, staminaDelta, staminaRecovery, foodConsumed };
  if (player.stats.stamina <= 0) return { recipeId: preview.recipeId, success: false, failReason: "exhausted", satietyDelta, satietyRestoredByChomper, staminaDelta, staminaRecovery, foodConsumed };

  invAdd(player.inventory, r.output.itemId, r.output.qty);
  return { recipeId: preview.recipeId, success: true, satietyDelta, satietyRestoredByChomper, staminaDelta, staminaRecovery, foodConsumed, crafted: { itemId: r.output.itemId, qty: r.output.qty } };
}

export function recoverPreview(player: PlayerState, chomperAutoEnabled = true) {
  const periods = 8;
  const satietyCost = periods * 10;
  const curlerCount = countEquippedTail(player, "eq_tail_curler");
  const baseRecovery = ITEMS.eq_tail_curler.effects?.staminaRecoveryPerPeriod ?? 0;
  const staminaRecovered = curlerCount > 0 ? baseRecovery * 1.5 * curlerCount * periods : 0;
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
  return { periods, satietyCostRange: [satietyCost, satietyCost] as [number, number], staminaRecoveryRange: [0, staminaRecovered] as [number, number], estFoodConsumed };
}

export function resolveRecover(player: PlayerState, periods: number, chomperAutoEnabled = true) {
  const satietyCost = periods * 10;
  player.stats.satiety = clamp(player.stats.satiety - satietyCost, 0, player.stats.maxSatiety);
  const before = player.stats.stamina;
  applyStaminaRecovery(player, periods, "resting");
  const staminaRecovered = player.stats.stamina - before;
  const { consumed: foodConsumed } = autoConsumeStorableFood(player, periods, chomperAutoEnabled);
  const outcome = player.stats.satiety <= 0 ? "dead" : player.stats.stamina <= 0 ? "exhausted" : "ok";
  return { periods, satietyCost, staminaRecovered, foodConsumed, outcome };
}

export function eatSapAtBlot(player: PlayerState, blot: BlotState): EatSapResult {
  const biteSize = ITEMS.eq_chomper.effects?.chomper?.biteSize ?? 1;
  const available = blot.sapRemaining ?? 0;
  const toEat = Math.min(biteSize, available);
  const staminaCostPerUnit = 20;
  let satietyRestored = 0;
  let unitsEaten = 0;
  for (let i = 0; i < toEat; i++) {
    if (player.stats.stamina <= 0) break;
    const restored = FOODS["food_soft_sap"].satietyRestored;
    const before = player.stats.satiety;
    player.stats.satiety = clamp(player.stats.satiety + restored, 0, player.stats.maxSatiety);
    satietyRestored += player.stats.satiety - before;
    player.stats.stamina = clamp(player.stats.stamina - staminaCostPerUnit, 0, player.stats.maxStamina);
    applyStaminaRecovery(player, 1, "working");
    blot.sapRemaining = (blot.sapRemaining ?? 1) - 1;
    unitsEaten++;
  }
  const outcome = player.stats.satiety <= 0 ? "dead" : player.stats.stamina <= 0 ? "exhausted" : "ok";
  return { unitsEaten, satietyRestored, staminaCost: unitsEaten * staminaCostPerUnit, outcome };
}

export function harvestStorableAtBlot(player: PlayerState, blot: BlotState): HarvestStorableResult {
  const food = blot.storableFood!;
  const poiData = POIS[blot.poiId];
  const spec = poiData.foodSpec!;
  const satietyCost = spec.forageSatietyCostPerPeriod;
  const staminaCost = spec.forageStaminaCostPerPeriod;
  player.stats.satiety = clamp(player.stats.satiety - satietyCost, 0, player.stats.maxSatiety);
  player.stats.stamina = clamp(player.stats.stamina - staminaCost, 0, player.stats.maxStamina);
  const staminaRecovery = applyStaminaRecovery(player, 1, "working");
  const { consumed: foodConsumed } = autoConsumeStorableFood(player, 1);
  const fr = FOODS[food].freshnessRange!;
  // Each equipped sticky scoop harvests one unit — cap at what's remaining
  const scoopCount = countEquippedTail(player, "eq_sticky_scoop");
  const available = blot.storableRemaining ?? 1;
  const qty = Math.min(scoopCount, available);
  const freshness: number[] = [];
  for (let i = 0; i < qty; i++) freshness.push(randInt(fr[0], fr[1]));
  invAdd(player.inventory, food, qty, freshness);
  blot.storableRemaining = available - qty;
  const outcome = player.stats.satiety <= 0 ? "dead" : player.stats.stamina <= 0 ? "exhausted" : "ok";
  return { foodId: food, qty, freshness, satietyCost, staminaCost, staminaRecovery, foodConsumed, outcome };
}

export function prettyEvent(e: EventId) { return EVENTS[e]; }
export function prettyPoi(poiId: PoiId) { return POIS[poiId]; }
export function prettyRecipe(recipeId: string) { return RECIPES[recipeId]; }
