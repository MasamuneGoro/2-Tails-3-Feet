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
  ShoeRequirement,
} from "./types";
import {
  CREATURES,
  MOVES,
} from "./gameData";

// ─── Grounding helpers ────────────────────────────────────────────────────────
export function isMothGrounded(flags: BattleFlag[]): boolean {
  return flags.includes("wing_torn") || flags.includes("thorax_open") || flags.includes("stomped");
}

// ─── Shoe counting ────────────────────────────────────────────────────────────
function countShoes(player: PlayerState): { bouncy: number; stompy: number } {
  let bouncy = 0, stompy = 0;
  for (const shoe of player.equipment.footSlots) {
    if (shoe === "eq_bouncy_shoe") bouncy++;
    else if (shoe === "eq_stompy_shoe") stompy++;
  }
  return { bouncy, stompy };
}

function shoesOk(req: ShoeRequirement, player: PlayerState): boolean {
  const { bouncy, stompy } = countShoes(player);
  return bouncy >= req.bouncy && stompy >= req.stompy;
}

// ─── Move availability ────────────────────────────────────────────────────────
export function getAvailableMoves(state: BattleState, player: PlayerState): MoveId[] {
  const creature = CREATURES[state.creatureId];
  const grounded = isMothGrounded(state.flags);

  return creature.availableMoves.filter((moveId) => {
    const move = MOVES[moveId];
    if (moveId === "flee") return true;
    if (move.requiresAirborne && grounded) return false;
    if (move.requiredFlags?.some(f => !state.flags.includes(f))) return false;
    if (move.forbiddenFlags?.some(f => state.flags.includes(f))) return false;
    if (move.tools && move.tools.length > 0) {
      const equipped = [...player.equipment.tailSlots.filter(Boolean)] as string[];
      const needed = [...move.tools] as string[];
      for (const tool of needed) {
        const idx = equipped.indexOf(tool);
        if (idx === -1) return false;
        equipped.splice(idx, 1);
      }
    }
    if (move.shoes && !shoesOk(move.shoes, player)) return false;
    return true;
  });
}

// ─── Move visibility for UI ───────────────────────────────────────────────────
export type MoveUIState = { moveId: MoveId; active: boolean; greyedReason?: string };

export function getMovesForUI(state: BattleState, player: PlayerState): MoveUIState[] {
  const creature = CREATURES[state.creatureId];
  const grounded = isMothGrounded(state.flags);
  const activeMoves = new Set(getAvailableMoves(state, player));
  const result: MoveUIState[] = [];

  for (const moveId of creature.availableMoves) {
    const move = MOVES[moveId];

    if (moveId === "flee") { result.push({ moveId, active: true }); continue; }

    if (move.requiresAirborne && grounded) continue;

    // Hidden moves — hide if flag conditions not met
    if (move.hiddenWhenUnavailable) {
      if (move.requiredFlags?.some(f => !state.flags.includes(f))) continue;
      if (move.forbiddenFlags?.some(f => state.flags.includes(f))) continue;
    }

    // Harvest group: hide until thorax_open
    if (move.group === "harvest" && !state.flags.includes("thorax_open")) continue;

    // Check flag conditions for non-hidden moves (stop them from showing grey when they shouldn't appear)
    if (!move.hiddenWhenUnavailable) {
      if (move.requiredFlags?.some(f => !state.flags.includes(f))) continue;
      if (move.forbiddenFlags?.some(f => state.flags.includes(f))) continue;
    }

    if (activeMoves.has(moveId)) {
      result.push({ moveId, active: true });
    } else {
      // Compute grey reason from tool/shoe deficit
      let greyedReason = "";
      const equipped = [...player.equipment.tailSlots.filter(Boolean)] as string[];

      if (move.shoes) {
        const { bouncy, stompy } = countShoes(player);
        const missingBouncy = Math.max(0, move.shoes.bouncy - bouncy);
        const missingStompy = Math.max(0, move.shoes.stompy - stompy);
        const totalMissing = missingBouncy + missingStompy;
        greyedReason = totalMissing > 0
          ? `${totalMissing} shoe${totalMissing > 1 ? "s" : ""} required for combo`
          : "Shoe combo required";
      } else if (move.tools && move.tools.length > 0) {
        const needed = [...move.tools] as string[];
        const avail = [...equipped];
        let missing = 0;
        for (const tool of needed) {
          const idx = avail.indexOf(tool);
          if (idx === -1) missing++;
          else avail.splice(idx, 1);
        }
        if (needed.length === 2) {
          greyedReason = missing === 2 ? "Combo required"
            : missing === 1 ? "2nd tail tool required for combo"
            : "Tail tool required";
        } else {
          greyedReason = "Tail tool required";
        }
      }

      result.push({ moveId, active: false, greyedReason });
    }
  }

  return result;
}

// ─── Initialise a new battle ──────────────────────────────────────────────────
export function startBattle(creatureId: CreatureId): BattleState {
  const creature = CREATURES[creatureId];
  return {
    creatureId,
    composure: creature.composureMax,
    integrity: creature.integrityMax,
    flags: [...creature.initialFlags],
    situation: creature.initialSituation,
    secretionCounter: 0,
    stompedClearsNextTurn: false,
    turn: 1,
    movesUsed: [],
    staminaCostAccrued: 0,
    midBattleDrops: [],
    midBattleSatietyRestored: 0,
    scoopedFleshQty: 0,
  };
}

// ─── Proficiency scaling ──────────────────────────────────────────────────────
function scaleComposure(base: [number, number], methods: HarvestMethodId[] | undefined, player: PlayerState): number {
  const [min, max] = base;
  if (!methods || methods.length === 0 || min === max) {
    return min === max ? min : min + Math.floor(Math.random() * (max - min + 1));
  }
  let bestXp = 0;
  for (const m of methods) bestXp = Math.max(bestXp, player.xp[m] ?? 0);
  const level = Math.min(10, Math.floor(bestXp / 100) + 1);
  const t = (level - 1) / 9;
  const scaled = min + t * (max - min);
  const variance = (max - min) * 0.1;
  return Math.round(scaled + (Math.random() * 2 - 1) * variance);
}

// ─── Execute a single player move ────────────────────────────────────────────
export type MoveExecuteResult = {
  nextState: BattleState;
  log: string[];
  foodContaminated: boolean;
};

export function executeMove(
  state: BattleState,
  moveId: MoveId,
  player: PlayerState
): MoveExecuteResult {
  const move = MOVES[moveId];
  const effect = move.effect;
  const log: string[] = [];
  let foodContaminated = false;

  let next: BattleState = {
    ...state,
    flags: [...state.flags],
    movesUsed: [...state.movesUsed],
    midBattleDrops: [...state.midBattleDrops],
  };

  // Clear stomped if flagged to clear this turn
  if (next.stompedClearsNextTurn) {
    next.flags = next.flags.filter(f => f !== "stomped");
    next.stompedClearsNextTurn = false;
  }

  // Flee
  if (moveId === "flee") {
    next.staminaCostAccrued += effect.staminaCost;
    return { nextState: next, log: ["You back away."], foodContaminated: false };
  }

  const grounded = isMothGrounded(next.flags);

  // Composure damage
  const composureBase = (grounded && effect.composureDeltaGrounded)
    ? effect.composureDeltaGrounded
    : effect.composureDelta;
  const composureDmg = scaleComposure(composureBase, effect.proficiencyGrants, player);
  next.composure = Math.max(0, next.composure - composureDmg);
  if (composureDmg > 0) log.push(`Composure −${composureDmg}`);

  // Integrity damage
  if (effect.integrityDelta < 0) {
    next.integrity = Math.max(0, next.integrity + effect.integrityDelta);
    log.push(`Integrity ${effect.integrityDelta}`);
  }

  // Stamina cost
  next.staminaCostAccrued += effect.staminaCost;

  // Satiety restore
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
    next.flags = next.flags.filter(f => !effect.clearsFlags!.includes(f));
  }

  // Stomp It Down: mark stomped to clear next turn
  if (moveId === "stomp_it_down") {
    next.stompedClearsNextTurn = true;
  }

  // Secretion counter: increment only if moth was airborne BEFORE this move
  if (moveId === "stomp_it_down") {
    next.secretionCounter = 0;
  } else if (!grounded) {
    next.secretionCounter += 1;
  }

  // Mid-battle drop
  if (effect.midBattleDrop) {
    const { id, qtyMin, qtyMax } = effect.midBattleDrop;
    const qty = qtyMin + Math.floor(Math.random() * (qtyMax - qtyMin + 1));
    if (qty > 0) {
      if (id === "food_moth_flesh") next.scoopedFleshQty += qty;
      const existing = next.midBattleDrops.find(d => d.id === id);
      if (existing) existing.qty += qty;
      else next.midBattleDrops.push({ id, qty });
      log.push(`Collected: ${id} ×${qty}`);
    }
  }

  // Smash body food contamination if wax not harvested
  if (effect.foodContaminationIfNotHarvested && !next.flags.includes("wax_harvested")) {
    next.staminaCostAccrued += 20;
    foodContaminated = true;
    log.push("Wax splatters. Food contaminated. −20 stamina");
  }

  // Novelty tracking
  if (!next.movesUsed.includes(moveId)) next.movesUsed.push(moveId);

  // Update situation
  next.situation = isMothGrounded(next.flags) ? "moth_grounded" : "moth_airborne";

  next.turn += 1;

  return { nextState: next, log, foodContaminated };
}

// ─── Secretion check ──────────────────────────────────────────────────────────
export function checkSecretion(state: BattleState): { fires: boolean; cleanFlee: boolean } {
  if (isMothGrounded(state.flags)) return { fires: false, cleanFlee: false };
  if (state.secretionCounter < 3) return { fires: false, cleanFlee: false };
  return { fires: true, cleanFlee: state.flags.includes("wax_harvested") };
}

// ─── Novelty tier ─────────────────────────────────────────────────────────────
export function computeNoveltyTier(uniqueMoveCount: number): 0 | 1 | 2 | 3 {
  if (uniqueMoveCount >= 7) return 3;
  if (uniqueMoveCount >= 6) return 2;
  if (uniqueMoveCount >= 4) return 1;
  return 0;
}

export function noveltyRefundPct(tier: 0 | 1 | 2 | 3): number {
  return [0, 0.30, 0.60, 0.90][tier];
}

export const NOVELTY_FLAVOUR: Record<0 | 1 | 2 | 3, string | null> = {
  0: null,
  1: "You kept it varied. Your body found a second gear.",
  2: "A proper flurry. You're breathing hard but somehow feel better for it.",
  3: "That was something. You're not tired — you're thrilled.",
};

export const NOVELTY_STAMINA_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "",
  1: "momentum carried you",
  2: "the flurry restored you",
  3: "the fight energised you completely",
};

// ─── Compute corpse drops ─────────────────────────────────────────────────────
function computeCorpseDrops(state: BattleState, endReason: BattleEndReason) {
  if (endReason === "fled") return [];
  const creature = CREATURES[state.creatureId];
  const drops: { id: ResourceId | FoodId; qty: number; freshness?: number[] }[] = [];

  for (const cond of creature.dropTable) {
    if (cond.integrityMin !== undefined && state.integrity < cond.integrityMin) continue;
    if (cond.integrityMax !== undefined && state.integrity > cond.integrityMax) continue;
    if (cond.requiredFlags?.some(f => !state.flags.includes(f))) continue;
    if (cond.endReasons && !cond.endReasons.includes(endReason)) continue;

    const [min, max] = cond.qtyRange;
    let qty = min + Math.floor(Math.random() * (max - min + 1));

    // Scoop deduction for moth flesh
    if (cond.id === "food_moth_flesh") {
      qty = Math.max(0, qty - state.scoopedFleshQty);
    }

    if (qty <= 0) continue;

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
  secretionFled: boolean,
  foodContaminated: boolean,
  player: PlayerState
): { result: BattleResult; updatedPlayer: PlayerState } {
  const next = structuredClone(player);

  const uniqueMoveCount = state.movesUsed.length;
  const tier = computeNoveltyTier(uniqueMoveCount);
  const refundPct = noveltyRefundPct(tier);
  const noveltyStaminaRestored = Math.round(state.staminaCostAccrued * refundPct);
  const netStaminaCost = state.staminaCostAccrued - noveltyStaminaRestored;

  next.stats.stamina = Math.max(0, Math.min(
    next.stats.maxStamina,
    next.stats.stamina - netStaminaCost
  ));

  next.stats.satiety = Math.max(0, Math.min(
    next.stats.maxSatiety,
    next.stats.satiety + state.midBattleSatietyRestored
  ));

  // Secretion fled without wax: 200 stamina penalty
  if (secretionFled && !state.flags.includes("wax_harvested")) {
    next.stats.stamina = Math.max(0, next.stats.stamina - 200);
  }

  const corpseDrops = computeCorpseDrops(state, endReason);

  if (foodContaminated) {
    for (const stack of next.inventory) {
      if (typeof stack.id === "string" && stack.id.startsWith("food_") && stack.freshness) {
        (stack as import("./types").InventoryStack).freshness =
          (stack as import("./types").InventoryStack).freshness!.map(f => Math.max(0, Math.round(f * 0.7)));
      }
    }
  }

  for (const drop of state.midBattleDrops) {
    addToInventory(next, drop.id, drop.qty, undefined);
  }
  for (const drop of corpseDrops) {
    addToInventory(next, drop.id, drop.qty, drop.freshness);
  }

  // XP grants
  for (const moveId of state.movesUsed) {
    const move = MOVES[moveId];
    if (move.effect.proficiencyGrants) {
      for (const method of move.effect.proficiencyGrants) {
        next.xp[method] = (next.xp[method] ?? 0) + 10;
      }
    }
  }

  const result: BattleResult = {
    creatureId: state.creatureId,
    endReason,
    finalComposure: state.composure,
    finalIntegrity: state.integrity,
    flags: [...state.flags],
    movesUsed: [...state.movesUsed],
    uniqueMoveCount,
    noveltyTier: tier,
    noveltyStaminaRestored,
    netStaminaCost,
    satietyRestoredMidBattle: state.midBattleSatietyRestored,
    midBattleDrops: [...state.midBattleDrops],
    corpseDrops,
    foodContaminated,
    secretionFled,
  };

  return { result, updatedPlayer: next };
}

// ─── Inventory helper ─────────────────────────────────────────────────────────
function addToInventory(player: PlayerState, id: ResourceId | FoodId, qty: number, freshness?: number[]) {
  const existing = player.inventory.find(s => s.id === id);
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
