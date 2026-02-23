import type {
  BattleEndReason,
  BattleFlag,
  BattleResult,
  BattleState,
  CreatureId,
  FoodId,
  HarvestMethodId,
  MoveId,
  PlayerState,
  ResourceId,
  SituationId,
} from "./types";
import {
  CREATURES,
  MOVES,
  SITUATION_TRANSITIONS,
  type DropCondition,
} from "./gameData";

// ─── Initialise a new battle ──────────────────────────────────────────────────
export function startBattle(creatureId: CreatureId): BattleState {
  const creature = CREATURES[creatureId];
  return {
    creatureId,
    composure: creature.composureMax,
    integrity: creature.integrityMax,
    flags: [...creature.initialFlags],
    situation: creature.initialSituation,
    turn: 1,
    movesUsed: [],
    doubleCombosLanded: 0,
    staminaCostAccrued: 0,
    midBattleDrops: [],
    midBattleSatietyRestored: 0,
    midBattleStaminaRestored: 0,
  };
}

// ─── Get available moves this turn ───────────────────────────────────────────
export function getAvailableMoves(state: BattleState, player: PlayerState): MoveId[] {
  const creature = CREATURES[state.creatureId];
  const equippedTools = player.equipment.tailSlots.filter(Boolean) as string[];

  return creature.availableMoves.filter((moveId) => {
    const move = MOVES[moveId];

    // Check required flags
    if (move.requiredFlags?.some((f) => !state.flags.includes(f))) return false;

    // Check forbidden flags
    if (move.forbiddenFlags?.some((f) => state.flags.includes(f))) return false;

    // Check required situation
    if (move.requiredSituation && move.requiredSituation !== state.situation) return false;

    // Check tools equipped — all required tools must be equipped
    if (move.tools.length > 0) {
      const needed = [...move.tools] as string[];
      const available = [...equippedTools];
      for (const tool of needed) {
        const idx = available.indexOf(tool);
        if (idx === -1) return false;
        available.splice(idx, 1); // consume slot so same tool can't satisfy two requirements
      }
    }

    return true;
  });
}

// ─── Proficiency scaling ──────────────────────────────────────────────────────
// XP 0–99 = level 1, 100–199 = level 2, ... 900+ = level 10
// Composure damage scales linearly: level 1 = base min, level 10 = base max
function scaleComposure(base: [number, number], method: HarvestMethodId | undefined, player: PlayerState): number {
  const [min, max] = base;
  if (!method || min === max) return min + Math.floor(Math.random() * (max - min + 1));
  const xp = player.xp[method] ?? 0;
  const level = Math.min(10, Math.floor(xp / 100) + 1);
  const t = (level - 1) / 9; // 0 at level 1, 1 at level 10
  const scaled = min + t * (max - min);
  // Add small random variance (±10% of range)
  const variance = (max - min) * 0.1;
  return Math.round(scaled + (Math.random() * 2 - 1) * variance);
}

// ─── Execute a single player move ────────────────────────────────────────────
export function executeMove(
  state: BattleState,
  moveId: MoveId,
  player: PlayerState
): { nextState: BattleState; log: string[] } {
  const move = MOVES[moveId];
  const effect = move.effect;
  const log: string[] = [];
  let next: BattleState = {
    ...state,
    flags: [...state.flags],
    movesUsed: [...state.movesUsed],
    midBattleDrops: [...state.midBattleDrops],
  };

  // Flee is handled separately
  if (moveId === "flee") {
    return { nextState: next, log: ["You back away."] };
  }

  // Composure damage
  const composureDmg = scaleComposure(effect.composureDelta, effect.proficiencyMethod, player);
  next.composure = Math.max(0, next.composure - composureDmg);
  if (composureDmg > 0) log.push(`Composure −${composureDmg}`);

  // Integrity damage
  if (effect.integrityDelta < 0) {
    next.integrity = Math.max(0, next.integrity + effect.integrityDelta);
    log.push(`Integrity ${effect.integrityDelta}`);
  }

  // Stamina cost
  next.staminaCostAccrued += effect.staminaCost;

  // Stamina restore (mid-battle stimulant)
  if (effect.staminaRestore) {
    next.midBattleStaminaRestored += effect.staminaRestore;
    log.push(`Stamina +${effect.staminaRestore} (stimulant)`);
  }

  // Satiety restore (mid-battle eat)
  if (effect.satietyRestore) {
    next.midBattleSatietyRestored += effect.satietyRestore;
    log.push(`Satiety +${effect.satietyRestore}`);
  }

  // Flags
  if (effect.setsFlags) {
    for (const f of effect.setsFlags) {
      if (!next.flags.includes(f)) next.flags.push(f);
    }
  }
  if (effect.clearsFlags) {
    next.flags = next.flags.filter((f) => !effect.clearsFlags!.includes(f));
  }

  // Mid-battle drop
  if (effect.midBattleDrop) {
    const { id, qty } = effect.midBattleDrop;
    const existing = next.midBattleDrops.find((d) => d.id === id);
    if (existing) existing.qty += qty;
    else next.midBattleDrops.push({ id, qty });
    log.push(`Collected: ${id} ×${qty}`);
  }

  // Counterattack
  if (effect.counterattack) {
    const ca = effect.counterattack;
    if (next.flags.includes(ca.triggerFlag)) {
      next.staminaCostAccrued += ca.staminaPenalty;
      log.push(`Counterattack! ${ca.flavor} (−${ca.staminaPenalty} stamina)`);
      // Food contamination is flagged in BattleResult, tracked here
      if (ca.contaminatesFood) {
        if (!next.flags.includes("wax_intact")) next.flags.push("wax_intact"); // keep intact flag if not cleared
        // We use a special ephemeral flag to signal contamination occurred
        if (!next.flags.includes("wax_drained")) {
          // contamination only happens while wax is still intact
          (next as any)._foodContaminated = true;
        }
      }
    }
  }

  // Novelty: track move and double combos
  if (!next.movesUsed.includes(moveId)) next.movesUsed.push(moveId);
  if (move.tools.length === 2) next.doubleCombosLanded += 1;

  // Advance situation
  if (effect.situationNext !== null) {
    next.situation = effect.situationNext;
  } else {
    // Creature advances on its own schedule
    next.situation = SITUATION_TRANSITIONS[next.situation];
  }

  next.turn += 1;
  return { nextState: next, log };
}

// ─── Novelty refund ───────────────────────────────────────────────────────────
function computeNoveltyRefund(state: BattleState, baseCost: number): number {
  const uniqueMoves = state.movesUsed.length;
  const hasDoubleCombo = state.doubleCombosLanded > 0;

  let refundPct = 0;
  if (uniqueMoves >= 4 || hasDoubleCombo) refundPct = 0.6;
  else if (uniqueMoves >= 2) refundPct = 0.3;

  return Math.round(baseCost * refundPct);
}

// ─── Compute corpse drops ─────────────────────────────────────────────────────
function computeCorpseDrops(
  state: BattleState,
  endReason: BattleEndReason
): { id: ResourceId | FoodId; qty: number; freshness?: number[] }[] {
  if (endReason === "fled") return []; // no corpse

  const creature = CREATURES[state.creatureId];
  const drops: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[] = [];

  for (const cond of creature.dropTable) {
    // Integrity check
    if (cond.integrityMin !== undefined && state.integrity < cond.integrityMin) continue;
    if (cond.integrityMax !== undefined && state.integrity > cond.integrityMax) continue;

    // Flag check
    if (cond.requiredFlags?.some((f) => !state.flags.includes(f))) continue;

    // End reason check
    if (cond.endReasons && !cond.endReasons.includes(endReason)) continue;

    // Roll quantity
    const [min, max] = cond.qtyRange;
    const qty = min + Math.floor(Math.random() * (max - min + 1));
    if (qty <= 0) continue;

    // Freshness array if applicable
    let freshness: number[] | undefined;
    if (cond.freshnessRange) {
      const [fMin, fMax] = cond.freshnessRange;
      freshness = Array.from({ length: qty }, () => fMin + Math.floor(Math.random() * (fMax - fMin + 1)));
    }

    drops.push({ id: cond.id, qty, freshness });
  }

  return drops;
}

// ─── Resolve battle end ───────────────────────────────────────────────────────
export function resolveBattle(
  state: BattleState,
  endReason: BattleEndReason,
  player: PlayerState
): { result: BattleResult; updatedPlayer: PlayerState } {
  const next = structuredClone(player);

  // Novelty refund
  const refund = computeNoveltyRefund(state, state.staminaCostAccrued);
  const netStaminaCost = state.staminaCostAccrued - refund;

  // Apply stamina cost net of refund and mid-battle restores
  next.stats.stamina = Math.max(0, Math.min(
    next.stats.maxStamina,
    next.stats.stamina - netStaminaCost + state.midBattleStaminaRestored
  ));

  // Apply satiety restores
  next.stats.satiety = Math.max(0, Math.min(
    next.stats.maxSatiety,
    next.stats.satiety + state.midBattleSatietyRestored
  ));

  // Corpse drops
  const corpseDrops = computeCorpseDrops(state, endReason);

  // Food contamination (freshness penalty)
  const foodContaminated = !!(state as any)._foodContaminated;
  if (foodContaminated) {
    for (const stack of next.inventory) {
      if (typeof stack.id === "string" && stack.id.startsWith("food_") && stack.freshness) {
        stack.freshness = stack.freshness.map((f) => Math.max(0, Math.round(f * 0.7)));
      }
    }
  }

  // Add all drops to inventory (mid-battle + corpse)
  const allDrops = [...state.midBattleDrops.map(d => ({ ...d, freshness: undefined as number[] | undefined })), ...corpseDrops];
  for (const drop of allDrops) {
    addToInventory(next, drop.id, drop.qty, drop.freshness);
  }

  // Satiety bonus for high novelty
  if (state.doubleCombosLanded > 0 || state.movesUsed.length >= 4) {
    next.stats.satiety = Math.min(next.stats.maxSatiety, next.stats.satiety + 20);
  }

  const result: BattleResult = {
    creatureId: state.creatureId,
    endReason,
    finalComposure: state.composure,
    finalIntegrity: state.integrity,
    flags: [...state.flags],
    movesUsed: [...state.movesUsed],
    doubleCombosLanded: state.doubleCombosLanded,
    netStaminaCost,
    satietyRestoredMidBattle: state.midBattleSatietyRestored,
    staminaRestoredMidBattle: state.midBattleStaminaRestored,
    midBattleDrops: [...state.midBattleDrops],
    corpseDrops,
    foodContaminated,
  };

  return { result, updatedPlayer: next };
}

// ─── Inventory helper ─────────────────────────────────────────────────────────
function addToInventory(
  player: PlayerState,
  id: ResourceId | FoodId,
  qty: number,
  freshness?: number[]
) {
  const existing = player.inventory.find((s) => s.id === id);
  if (existing) {
    existing.qty += qty;
    if (freshness && (existing as import("./types").InventoryStack).freshness) {
      (existing as import("./types").InventoryStack).freshness!.push(...freshness);
    } else if (freshness) {
      (existing as import("./types").InventoryStack).freshness = freshness;
    }
  } else {
    const stack: import("./types").InventoryStack = { id, qty };
    if (freshness) stack.freshness = freshness;
    player.inventory.push(stack);
  }
}
