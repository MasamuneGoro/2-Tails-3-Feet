import React, { useMemo, useState } from "react";
import type { BlotState, CraftPreview, CraftResult, EatSapResult, HarvestMethodId, HarvestPreview, HarvestResult, HarvestStorableResult, JourneyPreview, JourneyResult, PlayerState, PoiId, Screen } from "./types";
import { ItemIcon, PoiImage, PoiIcon } from "./visuals";
import { BIOME_LEVEL, EVENTS, FOODS, ITEMS, POIS, RECIPES, RESOURCES } from "./gameData";
import {
  canCraft, getFoodName, getItemName, getResourceName, listUnlockedRecipes,
  makeCraftPreview, makeHarvestPreview, makeJourneyPreview, methodsAvailableFromEquipment,
  prettyEvent, prettyPoi, prettyRecipe, recommendedMethod,
  resolveCraft, resolveHarvest, resolveJourney, recoverPreview, resolveRecover,
  invAdd, invGet, invRemove, clamp,
  skillLevel, skillXpToNextLevel, skillXpForLevel, SKILL_MAX_LEVEL, SKILL_XP_PER_LEVEL,
  generateBlot, eatSapAtBlot, harvestStorableAtBlot, hasEquippedTail, countEquippedTail,
} from "./engine";

function pct(n: number, d: number) { return Math.round((n / d) * 100); }

function FadeIn({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  return (
    <div style={{ animation: "fadeSlideIn 380ms cubic-bezier(0.25, 0.1, 0.25, 1) both", animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function FlyToInventory({ id, delay = 0 }: { id: string; delay?: number }) {
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, pointerEvents: "none",
        animation: `flyToInventory 700ms ease-in both`,
        animationDelay: `${delay}ms`,
        zIndex: 50,
      }}>
        <ItemIcon id={id} size={28} />
      </div>
    </div>
  );
}

function MiniXPBar({ method, xpBefore, xpAfter }: {
  method: import("./types").HarvestMethodId;
  xpBefore: number;
  xpAfter: number;
}) {
  const toolIds: Record<import("./types").HarvestMethodId, string> = {
    poke: "eq_pointed_twig", smash: "eq_crude_hammerhead",
    tease: "eq_fiber_comb", drill: "eq_hand_drill", scoop: "eq_sticky_scoop",
  };
  const methodNames: Record<import("./types").HarvestMethodId, string> = {
    poke: "Poke", smash: "Smash", tease: "Tease", drill: "Drill", scoop: "Scoop",
  };
  const level = Math.min(10, Math.floor(xpAfter / 100) + 1);
  const xpForLevel = (Math.floor(xpAfter / 100)) * 100;
  const isMax = level >= 10;
  const pctBefore = isMax ? 100 : Math.min(100, ((xpBefore - xpForLevel) / 100) * 100);
  const pctAfter = isMax ? 100 : Math.min(100, ((xpAfter - xpForLevel) / 100) * 100);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.width = `${pctBefore}%`;
    const t = setTimeout(() => { el.style.width = `${pctAfter}%`; }, 80);
    return () => clearTimeout(t);
  }, [pctBefore, pctAfter]);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ItemIcon id={toolIds[method]} size={14} />
        <div style={{ flex: 1, background: "#0e0e0e", borderRadius: 3, height: 5, overflow: "hidden" }}>
          <div ref={ref} style={{
            height: "100%", background: isMax ? "#c8a96e" : "#4caf50",
            borderRadius: 3, transition: "width 0.6s ease",
          }} />
        </div>
        <div style={{ fontSize: "0.68rem", opacity: 0.5, whiteSpace: "nowrap" }}>
          Lv {level}{isMax ? " MAX" : ` · +${xpAfter - xpBefore} xp`}
        </div>
      </div>
      <div style={{ fontSize: "0.65rem", opacity: 0.35, marginTop: 3, paddingLeft: 22 }}>
        {methodNames[method]} proficiency
      </div>
    </div>
  );
}

function CraftSuccessFlash({ itemId, origin, onDone }: { itemId: string; origin: { x: number; y: number } | null; onDone: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Inventory button is in sidebar top-right area — estimate fixed position
    const targetX = window.innerWidth - 60;
    const targetY = 60;
    const startX = origin ? origin.x : window.innerWidth * 0.5;
    const startY = origin ? origin.y : window.innerHeight * 0.5;
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.transform = "translate(-50%, -50%) scale(1)";
    el.style.opacity = "1";
    const frame = requestAnimationFrame(() => {
      el.style.transition = "left 650ms ease-in, top 650ms ease-in, transform 650ms ease-in, opacity 300ms ease-in 400ms";
      el.style.left = `${targetX}px`;
      el.style.top = `${targetY}px`;
      el.style.transform = "translate(-50%, -50%) scale(0.25)";
      el.style.opacity = "0";
    });
    const t = setTimeout(onDone, 750);
    return () => { cancelAnimationFrame(frame); clearTimeout(t); };
  }, [origin, onDone]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none" }}>
      <div ref={ref} style={{ position: "absolute", willChange: "left, top, transform, opacity" }}>
        <ItemIcon id={itemId} size={56} />
      </div>
    </div>
  );
}

function formatConsumed(consumed: { foodId: import("./types").FoodId; units: number }[]) {
  if (!consumed.length) return "None";
  return consumed.map((c) => `${FOODS[c.foodId].name} ×${c.units}`).join(", ");
}

function StaminaRecoveryLine({ raw, recovery }: { raw: number; recovery: import("./types").StaminaRecoveryEntry[] }) {
  if (recovery.length === 0) return <>−{raw}</>;
  const totalRecovered = recovery.reduce((s, e) => s + e.recovered, 0);
  const net = Math.max(0, raw - totalRecovered);
  const parts = recovery.map(e => `+${e.recovered} ${e.name}`).join(", ");
  return <span>−{raw} <span style={{ opacity: 0.6, fontSize: "0.85em" }}>({parts})</span> = −{net}</span>;
}

function SatietyLine({ raw, restored }: { raw: number; restored: number }) {
  if (restored === 0) return <>−{raw}</>;
  const net = Math.max(0, raw - restored);
  return <span>−{raw} <span style={{ opacity: 0.6, fontSize: "0.85em" }}>(+{restored} Chomper)</span> = −{net}</span>;
}

function SatietyRangeLine({ raw, restoredRange }: { raw: [number, number]; restoredRange: [number, number] }) {
  if (restoredRange[1] === 0) return <span>−{raw[0]} to −{raw[1]}</span>;
  const netLo = Math.max(0, raw[0] - restoredRange[1]);
  const netHi = Math.max(0, raw[1] - restoredRange[1]);
  return <span>−{raw[0]} to −{raw[1]} <span style={{ opacity: 0.6, fontSize: "0.85em" }}>(+up to {restoredRange[1]} Chomper)</span> = −{netLo} to −{netHi}</span>;
}

function StaminaRangeLine({ raw, recoveryRange }: { raw: [number, number]; recoveryRange: [number, number] }) {
  if (recoveryRange[1] === 0) return <span>−{raw[0]} to −{raw[1]}</span>;
  const netLo = Math.max(0, raw[0] - recoveryRange[1]);
  const netHi = Math.max(0, raw[1] - recoveryRange[1]);
  return <span>−{raw[0]} to −{raw[1]} <span style={{ opacity: 0.6, fontSize: "0.85em" }}>(+up to {recoveryRange[1]} Tail Curler)</span> = −{netLo} to −{netHi}</span>;
}

function formatConsumedRange(consumed: { foodId: import("./types").FoodId; unitsRange: [number, number] }[]) {
  if (!consumed.length) return "";
  return consumed.map((c) => {
    const [lo, hi] = c.unitsRange;
    const qty = lo === hi ? `×${lo}` : `×${lo} to ${hi}`;
    return `${FOODS[c.foodId].name} ${qty}`;
  }).join(", ");
}

interface StatBarProps {
  value: number;
  max: number;
  kind: "satiety" | "stamina";
  netRange?: [number, number]; // [worst-case remaining, best-case remaining]
}

function StatBar({ value, max, kind, netRange }: StatBarProps) {
  const ratio = value / max;
  let fillColor: string;
  if (kind === "satiety") {
    fillColor = ratio > 0.5 ? "#4caf50" : ratio > 0.25 ? "#f5c842" : "#e53935";
  } else {
    fillColor = ratio > 0.5 ? "#c8a96e" : ratio > 0.25 ? "#cc6b1a" : "#8b2500";
  }

  const fillPct = Math.min(100, ratio * 100);
  const netLo = netRange?.[0] ?? null;
  const netHi = netRange?.[1] ?? null;
  const netLoPct = netLo !== null ? Math.max(0, Math.min(100, (netLo / max) * 100)) : null;
  const netHiPct = netHi !== null ? Math.max(0, Math.min(100, (netHi / max) * 100)) : null;
  const wouldDie = netLo !== null && netLo <= 0;
  const costZoneLeft = netLoPct !== null ? netLoPct : fillPct;
  const costZoneWidth = fillPct - costZoneLeft;
  const hasCost = costZoneWidth > 0.1;
  const tickColor = kind === "satiety" ? "#7dff8a" : "#ffe566";

  let rangeLabel: string | null = null;
  if (netLo !== null && netHi !== null) {
    const lo = Math.max(0, Math.round(netLo));
    const hi = Math.max(0, Math.round(netHi));
    rangeLabel = lo === hi ? `→ ${lo}` : `→ ${lo} to ${hi}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", opacity: 0.7 }}>
        <span>{kind === "satiety" ? "Satiety" : "Stamina"}</span>
        <span>
          {value}/{max}
          {rangeLabel && (
            <span style={{ marginLeft: 8, color: wouldDie ? "#ff5252" : tickColor, opacity: 0.9 }}>
              {rangeLabel}
            </span>
          )}
        </span>
      </div>
      <div style={{ position: "relative", width: "100%", background: "#2a2a2a", borderRadius: 6, height: 14, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${fillPct}%`, background: fillColor, borderRadius: 6, transition: "width 0.3s, background 0.3s" }} />
        {hasCost && (
          <div style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${costZoneLeft}%`, width: `${costZoneWidth}%`,
            background: wouldDie
              ? "linear-gradient(to right, rgba(180,20,20,0.75), rgba(0,0,0,0.08))"
              : "linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.08))",
          }} />
        )}
        {netLoPct !== null && (
          <div style={{
            position: "absolute", top: 0, bottom: 0, width: 2,
            left: `calc(${netLoPct}% - 1px)`,
            background: wouldDie ? "#ff5252" : tickColor, opacity: 0.9,
          }} />
        )}
        {netHiPct !== null && netHiPct !== netLoPct && (
          <div style={{
            position: "absolute", top: 0, bottom: 0, width: 2,
            left: `calc(${netHiPct}% - 1px)`,
            background: tickColor, opacity: 0.4,
          }} />
        )}
      </div>
    </div>
  );
}


const START_PLAYER: PlayerState = {
  biomeLevelId: "sticky_l1",
  stats: { satiety: 800, stamina: 1000, maxSatiety: 1000, maxStamina: 1000 },
  equipment: { tailSlots: [null, null], shoe: "eq_standard_shoe" },
  inventory: [
    { id: "eq_tinker_shaft", qty: 1 },
    { id: "eq_tail_curler", qty: 1 },
    { id: "eq_chomper", qty: 1 },
    { id: "eq_pointed_twig", qty: 1 },
    { id: "food_resin_chew", qty: 30, freshness: Array.from({ length: 30 }, () => 136) },
  ],
  xp: { poke: 0, smash: 0, tease: 0, drill: 0, scoop: 0 },
};

export default function App() {
  const [player, setPlayer] = useState<PlayerState>(() => structuredClone(START_PLAYER));
  const [screen, setScreen] = useState<Screen>("HUB");

  const [journeyPreview, setJourneyPreview] = useState<JourneyPreview | null>(null);
  const [journeyResult, setJourneyResult] = useState<JourneyResult | null>(null);
  const [savedExploreRoll, setSavedExploreRoll] = useState<JourneyPreview | null>(null);
  const [savedFoodRoll, setSavedFoodRoll] = useState<JourneyPreview | null>(null);

  const [activePoi, setActivePoi] = useState<{ id: PoiId; quality: "common" | "uncommon" } | null>(null);
  const [activeBlot, setActiveBlot] = useState<BlotState | null>(null);
  const [lastEatResult, setLastEatResult] = useState<EatSapResult | null>(null);
  const [lastStorableResult, setLastStorableResult] = useState<HarvestStorableResult | null>(null);
  const [scoopXpBefore, setScoopXpBefore] = useState<number>(0);
  const [multiHarvestResults, setMultiHarvestResults] = useState<HarvestResult[]>([]);
  const [harvestXpBefore, setHarvestXpBefore] = useState<Partial<Record<import("./types").HarvestMethodId, number>>>({});

  const [harvestPreview, setHarvestPreview] = useState<HarvestPreview | null>(null);
  const [harvestResult, setHarvestResult] = useState<HarvestResult | null>(null);

  const [craftPreview, setCraftPreview] = useState<CraftPreview | null>(null);
  const [craftResult, setCraftResult] = useState<CraftResult | null>(null);
  const [craftFlashItem, setCraftFlashItem] = useState<string | null>(null);
  const [craftFlashOrigin, setCraftFlashOrigin] = useState<{ x: number; y: number } | null>(null);
  const craftButtonRef = React.useRef<HTMLButtonElement>(null);

  const [recoverState, setRecoverState] = useState<{ periods: number } | null>(null);
  const [recoverSummary, setRecoverSummary] = useState<any>(null);

  const [returnScreen, setReturnScreen] = useState<Screen>("HUB");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [scoopExpanded, setScoopExpanded] = useState(false);
  const [chomperAutoEnabled, setChomperAutoEnabled] = useState(true);
  const [decayedFoodAlert, setDecayedFoodAlert] = useState<string | null>(null); // food name that just fully rotted

  const exhausted = player.stats.stamina <= 0;
  const dead = player.stats.satiety <= 0;

  const satietyRatio = player.stats.satiety / player.stats.maxSatiety;
  const staminaRatio = player.stats.stamina / player.stats.maxStamina;
  const chomperEquipped = countEquippedTail(player, "eq_chomper") > 0;
  const curlerCount = countEquippedTail(player, "eq_tail_curler");

  const unlockedRecipes = useMemo(() => listUnlockedRecipes(player), [player]);

  // ── Equipment helpers ─────────────────────────────────────────────────────
  function isItemId(x: unknown): x is import("./types").ItemId {
    return typeof x === "string" && Object.prototype.hasOwnProperty.call(ITEMS, x);
  }
  function canEquipItem(itemId: unknown) {
    if (!isItemId(itemId)) return false;
    return ITEMS[itemId].slot === "tail";
  }
  function availableTailToolIds(slotIdx: 0 | 1): import("./types").ItemId[] {
    const otherSlot = player.equipment.tailSlots[slotIdx === 0 ? 1 : 0];
    return player.inventory
      .filter((st): st is { id: import("./types").ItemId; qty: number } =>
        typeof st.id === "string" && (st.id as string).startsWith("eq_") && st.qty > 0 && canEquipItem(st.id))
      .filter((st) => { if (st.id === otherSlot) return st.qty > 1; return true; })
      .map((st) => st.id);
  }
  function equipTail(slotIdx: 0 | 1, itemId: import("./types").ItemId | null) {
    const next = structuredClone(player);
    next.equipment.tailSlots[slotIdx] = itemId;
    setPlayer(next);
    // Regenerate any active preview with new equipment
    if (screen === "PREVIEW_JOURNEY" && journeyPreview) {
      const pv = makeJourneyPreview(next, journeyPreview.mode, chomperAutoEnabled);
      setJourneyPreview({ ...pv, poi: journeyPreview.poi, surfacedEvents: journeyPreview.surfacedEvents });
    } else if (screen === "PREVIEW_HARVEST" && harvestPreview) {
      setHarvestPreview(makeHarvestPreview(next, harvestPreview.poiId, harvestPreview.method, chomperAutoEnabled));
    } else if (screen === "PREVIEW_CRAFT" && craftPreview) {
      setCraftPreview(makeCraftPreview(next, craftPreview.recipeId, chomperAutoEnabled));
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function reset() {
    setPlayer(structuredClone(START_PLAYER));
    setScreen("HUB");
    setJourneyPreview(null); setJourneyResult(null);
    setSavedExploreRoll(null); setSavedFoodRoll(null);
    setActivePoi(null); setActiveBlot(null);
    setLastEatResult(null); setLastStorableResult(null);
    setMultiHarvestResults([]); setHarvestXpBefore({});
    setHarvestPreview(null); setHarvestResult(null);
    setCraftPreview(null); setCraftResult(null);
    setRecoverState(null); setRecoverSummary(null);
    setScoopExpanded(false);
    setChomperAutoEnabled(true);
    setDecayedFoodAlert(null);
  }

  /** Snapshot qty of each storable food stack before an action */
  function snapshotStorableQty(inv: typeof player.inventory): Record<string, number> {
    const snap: Record<string, number> = {};
    for (const s of inv) {
      if (typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as import("./types").FoodId]?.storable) {
        snap[s.id as string] = s.qty;
      }
    }
    return snap;
  }

  /** After an action, compare snapshot to current inv; alert if any storable food qty dropped to 0 due to rot (not chomper) */
  function checkDecayAlert(before: Record<string, number>, afterInv: typeof player.inventory, chomperConsumed: { foodId: import("./types").FoodId; units: number }[] = []) {
    const afterQty: Record<string, number> = {};
    for (const s of afterInv) afterQty[s.id as string] = s.qty;
    const chomperIds = new Set(chomperConsumed.map(c => c.foodId as string));
    for (const [id, qty] of Object.entries(before)) {
      if (qty > 0 && (afterQty[id] ?? 0) === 0 && !chomperIds.has(id)) {
        const name = FOODS[id as import("./types").FoodId]?.name ?? id;
        setDecayedFoodAlert(name);
        return;
      }
    }
  }

  function gotoHub() {
    setDecayedFoodAlert(null);
    if (dead) setScreen("DEAD");
    else if (exhausted) setScreen("EXHAUSTED");
    else setScreen("HUB");
  }

  function openMetaScreen(target: "INVENTORY" | "SKILLS") {
    setDecayedFoodAlert(null);
    // Only store return point when first leaving main flow
    if (screen !== "INVENTORY" && screen !== "SKILLS") setReturnScreen(screen);
    setExpandedItem(null);
    setScreen(target);
  }

  function backFromMeta() {
    setDecayedFoodAlert(null);
    setScreen(returnScreen);
  }

  // ── Journey ───────────────────────────────────────────────────────────────
  function genJourney(mode: "explore" | "findFood") {
    setDecayedFoodAlert(null);
    const saved = mode === "explore" ? savedExploreRoll : savedFoodRoll;
    const pv = saved ?? makeJourneyPreview(player, mode, chomperAutoEnabled);
    if (!saved) {
      if (mode === "explore") setSavedExploreRoll(pv);
      else setSavedFoodRoll(pv);
    }
    setJourneyPreview(pv); setJourneyResult(null);
    setScreen("PREVIEW_JOURNEY");
  }
  function proceedJourney() {
    if (!journeyPreview) return;
    const snap = snapshotStorableQty(player.inventory);
    const next = structuredClone(player);
    const res = resolveJourney(next, journeyPreview, chomperAutoEnabled);
    setPlayer(next); setJourneyResult(res);
    checkDecayAlert(snap, next.inventory, res.foodConsumed);
    setActivePoi(null); setActiveBlot(null);
    setLastEatResult(null); setLastStorableResult(null);
    setScoopExpanded(false);
    if (journeyPreview.mode === "explore") setSavedExploreRoll(null);
    else setSavedFoodRoll(null);
    setScreen("SUMMARY_JOURNEY");
  }
  function sniffAgain() {
    setDecayedFoodAlert(null);
    if (!journeyPreview) return;
    const next = structuredClone(player);
    next.stats.satiety = clamp(next.stats.satiety - 20, 0, next.stats.maxSatiety);
    next.stats.stamina = clamp(next.stats.stamina - 20, 0, next.stats.maxStamina);
    setPlayer(next);
    const pv = makeJourneyPreview(next, journeyPreview.mode, chomperAutoEnabled);
    if (journeyPreview.mode === "explore") setSavedExploreRoll(pv);
    else setSavedFoodRoll(pv);
    setJourneyPreview(pv);
  }
  function enterPoi() {
    setDecayedFoodAlert(null);
    if (!journeyResult) return;
    setActivePoi(journeyResult.poi);
    setActiveBlot(journeyResult.blot);
    setLastEatResult(null); setLastStorableResult(null);
    setMultiHarvestResults([]);
    setScoopExpanded(false);
    setScreen("HUB");
  }

  // ── Harvest ───────────────────────────────────────────────────────────────
  function chooseMethod(method: HarvestMethodId) {
    setDecayedFoodAlert(null);
    if (!activePoi) return;
    setHarvestPreview(makeHarvestPreview(player, activePoi.id, method, chomperAutoEnabled));
    setHarvestResult(null);
    setScreen("PREVIEW_HARVEST");
  }
  function proceedHarvest() {
    if (!harvestPreview) return;
    const snap = snapshotStorableQty(player.inventory);
    const xpBefore = { [harvestPreview.method]: player.xp[harvestPreview.method] ?? 0 };
    const next = structuredClone(player);
    const res = resolveHarvest(next, harvestPreview, chomperAutoEnabled);
    setPlayer(next); setHarvestResult(res);
    setHarvestXpBefore(xpBefore);
    checkDecayAlert(snap, next.inventory, res.foodConsumed);
    if (activeBlot && activeBlot.harvestCharges !== undefined)
      setActiveBlot({ ...activeBlot, harvestCharges: Math.max(0, activeBlot.harvestCharges - 1) });
    setScreen("SUMMARY_HARVEST");
  }
  function doMultiHarvest() {
    if (!activePoi || !activeBlot) return;
    const methods = methodsAvailableFromEquipment(player);
    if (!methods.length) return;
    const snap = snapshotStorableQty(player.inventory);
    const xpBefore: Partial<Record<import("./types").HarvestMethodId, number>> = {};
    for (const m of methods) xpBefore[m] = player.xp[m] ?? 0;
    let next = structuredClone(player);
    let blotCopy = structuredClone(activeBlot);
    const results: HarvestResult[] = [];
    for (const method of methods) {
      if (blotCopy.harvestCharges !== undefined && blotCopy.harvestCharges <= 0) break;
      if (next.stats.satiety <= 0 || next.stats.stamina <= 0) break;
      const pv = makeHarvestPreview(next, activePoi.id, method, chomperAutoEnabled);
      const res = resolveHarvest(next, pv, chomperAutoEnabled);
      results.push(res);
      if (blotCopy.harvestCharges !== undefined) blotCopy.harvestCharges = Math.max(0, blotCopy.harvestCharges - 1);
      if (res.outcome !== "ok") break;
    }
    setPlayer(next); setActiveBlot(blotCopy); setMultiHarvestResults(results);
    setHarvestXpBefore(xpBefore);
    const allConsumed = results.flatMap(r => r.foodConsumed);
    checkDecayAlert(snap, next.inventory, allConsumed);
    setScreen("SUMMARY_HARVEST");
  }

  // ── Food blot ─────────────────────────────────────────────────────────────
  function doEatSap() {
    setDecayedFoodAlert(null);
    if (!activeBlot) return;
    const next = structuredClone(player);
    const blotCopy = structuredClone(activeBlot);
    const result = eatSapAtBlot(next, blotCopy);
    setPlayer(next); setActiveBlot(blotCopy); setLastEatResult(result);
  }
  function doHarvestStorable() {
    if (!activeBlot) return;
    const snap = snapshotStorableQty(player.inventory);
    const xpBefore = player.xp["scoop"] ?? 0;
    const next = structuredClone(player);
    const blotCopy = structuredClone(activeBlot);
    const result = harvestStorableAtBlot(next, blotCopy);
    setScoopXpBefore(xpBefore);
    setPlayer(next); setActiveBlot(blotCopy); setLastStorableResult(result);
    checkDecayAlert(snap, next.inventory, result.foodConsumed);
  }

  // ── Craft ─────────────────────────────────────────────────────────────────
  function openCraft() {
    setDecayedFoodAlert(null);
    if (!canCraft(player)) { setScreen("EXHAUSTED"); return; }
    setScreen("CRAFT_MENU");
  }
  function chooseRecipe(recipeId: string) {
    setCraftPreview(makeCraftPreview(player, recipeId, chomperAutoEnabled));
    setCraftResult(null);
    setScreen("PREVIEW_CRAFT");
  }
  function proceedCraft() {
    if (!craftPreview) return;
    const snap = snapshotStorableQty(player.inventory);
    const next = structuredClone(player);
    const res = resolveCraft(next, craftPreview, chomperAutoEnabled);
    setPlayer(next); setCraftResult(res);
    if (res.success && res.crafted) {
      const btn = craftButtonRef.current;
      const rect = btn?.getBoundingClientRect();
      setCraftFlashOrigin(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null);
      setCraftFlashItem(res.crafted.itemId);
    }
    checkDecayAlert(snap, next.inventory, res.foodConsumed);
    setScreen("SUMMARY_CRAFT");
  }

  // ── Recover ───────────────────────────────────────────────────────────────
  function previewRecover() {
    setDecayedFoodAlert(null);
    setRecoverSummary(null);
    setScreen("PREVIEW_RECOVER");
  }
  function proceedRecover() {
    const periods = 7 + Math.floor(Math.random() * 6); // 7–12
    const snap = snapshotStorableQty(player.inventory);
    const next = structuredClone(player);
    const res = resolveRecover(next, periods, chomperAutoEnabled);
    setPlayer(next); setRecoverSummary(res);
    checkDecayAlert(snap, next.inventory, res.foodConsumed);
    setScreen("SUMMARY_RECOVER");
  }
  function keepFlopping() {
    const periods = 7 + Math.floor(Math.random() * 6); // 7–12
    const snap = snapshotStorableQty(player.inventory);
    const next = structuredClone(player);
    const res = resolveRecover(next, periods, chomperAutoEnabled);
    setPlayer(next); setRecoverSummary(res);
    checkDecayAlert(snap, next.inventory, res.foodConsumed);
    // stay on SUMMARY_RECOVER
  }

  // ── Chomper toggle ────────────────────────────────────────────────────────
  function toggleChomper() {
    const newVal = !chomperAutoEnabled;
    setChomperAutoEnabled(newVal);
    // Refresh active preview
    if (screen === "PREVIEW_JOURNEY" && journeyPreview) {
      const pv = makeJourneyPreview(player, journeyPreview.mode, newVal);
      setJourneyPreview({ ...pv, poi: journeyPreview.poi, surfacedEvents: journeyPreview.surfacedEvents });
    } else if (screen === "PREVIEW_HARVEST" && harvestPreview) {
      setHarvestPreview(makeHarvestPreview(player, harvestPreview.poiId, harvestPreview.method, newVal));
    } else if (screen === "PREVIEW_CRAFT" && craftPreview) {
      setCraftPreview(makeCraftPreview(player, craftPreview.recipeId, newVal));
    }
  }

  // ── Chomper display helper ────────────────────────────────────────────────
  function chomperDisplay(consumed: { foodId: import("./types").FoodId; unitsRange: [number, number] }[]) {
    if (!chomperEquipped) return "No Chomper";
    if (!chomperAutoEnabled) return "Off";
    const s = formatConsumedRange(consumed);
    return s || "None";
  }

  // ── Preview title helper ─────────────────────────────────────────────────
  function PreviewTitle({ main, sub }: { main: string; sub: string }) {
    return (
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <div style={{ fontSize: "1.6rem", fontWeight: 700, letterSpacing: "0.03em" }}>{main}</div>
        <div style={{ fontSize: "1.15rem", fontWeight: 500, opacity: 0.7, marginTop: 3 }}>{sub}</div>
      </div>
    );
  }

  // ── Efficiency badge helper ───────────────────────────────────────────────
  function EffBadge({ label }: { label: string }) {
    const cfg: Record<string, { color: string; bg: string; text: string }> = {
      best:    { color: "#4caf50", bg: "#1a2e1a", text: "Best match" },
      good:    { color: "#26c6da", bg: "#0d2426", text: "Good match" },
      ok:      { color: "#888",    bg: "#1e1e1e", text: "Workable" },
      weak:    { color: "#f5c842", bg: "#2a2200", text: "Weak match" },
      veryWeak:{ color: "#ff8a65", bg: "#2a1500", text: "Very weak" },
      wasteful:{ color: "#e53935", bg: "#2a0e0e", text: "Wasteful" },
    };
    const c = cfg[label] ?? cfg.ok;
    return (
      <span style={{
        fontSize: "0.78rem", padding: "3px 9px", borderRadius: 999,
        border: `1px solid ${c.color}`, background: c.bg, color: c.color,
        fontWeight: 600, letterSpacing: "0.04em",
      }}>{c.text}</span>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PERSISTENT SIDEBAR — tail slots + chomper toggle + inventory/skills btns
  // ─────────────────────────────────────────────────────────────────────────
  const tailSelectStyle: React.CSSProperties = {
    background: "#1e1e1e", border: "1px solid #3a3a3a", borderRadius: 8,
    color: "#eaeaea", padding: "6px 8px", fontSize: "0.9rem", width: "100%",
  };

  const sidebar = (
    <div style={{
      width: 200, minWidth: 180, flexShrink: 0,
      display: "flex", flexDirection: "column", gap: 12,
      padding: "16px 14px",
      background: "#0e0e0e", borderRight: "1px solid #2a2a2a",
      minHeight: "100vh",
    }}>
      <div style={{ fontSize: "0.75rem", opacity: 0.5, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Equipment</div>

      {([0, 1] as (0 | 1)[]).map((slotIdx) => {
        const equipped = player.equipment.tailSlots[slotIdx];
        return (
          <div key={slotIdx}>
            <div style={{ fontSize: "0.78rem", opacity: 0.6, marginBottom: 3 }}>Tail {slotIdx === 0 ? "A" : "B"}</div>
            {equipped && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, opacity: 0.85 }}>
                <ItemIcon id={equipped} size={16} />
                <span style={{ fontSize: "0.78rem" }}>{getItemName(equipped)}</span>
              </div>
            )}
            <select
              style={tailSelectStyle}
              value={equipped ?? ""}
              onChange={(e) => equipTail(slotIdx, (e.target.value || null) as any)}
            >
              <option value="">— empty —</option>
              {availableTailToolIds(slotIdx).map((id) => (
                <option key={id} value={id}>{getItemName(id)}</option>
              ))}
            </select>
          </div>
        );
      })}

      {chomperEquipped && (
        <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 10 }}>
          <div style={{ fontSize: "0.78rem", opacity: 0.6, marginBottom: 6 }}>Chomper chomp</div>
          <button
            style={{
              width: "100%", padding: "7px 8px", borderRadius: 8, fontSize: "0.82rem",
              border: `1px solid ${chomperAutoEnabled ? "#4a7a4a" : "#555"}`,
              background: chomperAutoEnabled ? "#1a2e1a" : "#1e1e1e",
              color: chomperAutoEnabled ? "#7ecba1" : "#aaa",
              cursor: "pointer",
            }}
            onClick={toggleChomper}
          >
            {chomperAutoEnabled ? "ON — going wild" : "OFF — sitting still"}
          </button>
        </div>
      )}

      {/* ── Storable food panel ── */}
      {(() => {
        const foods = player.inventory.filter(
          s => typeof s.id === "string" && s.id.startsWith("food_") && FOODS[s.id as import("./types").FoodId]?.storable && s.qty > 0
        );
        if (!foods.length) return null;

        // Find the worst (lowest) freshness value across all units of all stacks
        const allFreshness = foods.flatMap(s => s.freshness ?? []);
        const minFresh = allFreshness.length ? Math.min(...allFreshness) : Infinity;
        const WARNING_THRESHOLD = 25; // periods
        const isExpiring = minFresh <= WARNING_THRESHOLD && !(chomperEquipped && chomperAutoEnabled);

        return (
          <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 7,
            }}>
              <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Food
              </div>
              {isExpiring && (
                <div style={{
                  fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em",
                  color: "#e53935", textTransform: "uppercase", animation: "pulse 1.4s ease-in-out infinite",
                }}>
                  ⚠ Spoiling
                </div>
              )}
            </div>
            {isExpiring && !chomperEquipped && (
              <div style={{ fontSize: "0.66rem", color: "#a05555", marginBottom: 7, lineHeight: 1.4 }}>
                Equip a Chomper to auto-eat during the next period.
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {foods.map(s => {
                const id = s.id as import("./types").FoodId;
                const food = FOODS[id];
                const freshness = s.freshness ?? [];
                const maxFresh = food.freshnessRange?.[1] ?? 1;
                const worstUnit = freshness.length ? Math.min(...freshness) : maxFresh;
                const ratio = worstUnit / maxFresh;
                const unitExpiring = worstUnit <= WARNING_THRESHOLD;

                // freshness bar: shows worst unit's ratio as a thin bar
                const barCol = ratio > 0.5 ? "#26c6da" : ratio > 0.2 ? "#f5c842" : "#e53935";

                return (
                  <div key={id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 7px", borderRadius: 7,
                    background: unitExpiring ? "#1f0e0e" : "#161616",
                    border: `1px solid ${unitExpiring ? "#5a1a1a" : "#2a2a2a"}`,
                  }}>
                    <ItemIcon id={id} size={18} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "0.78rem", opacity: 0.85, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {food.name}
                        </span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 700, opacity: 0.9, marginLeft: 6, flexShrink: 0 }}>
                          ×{s.qty}
                        </span>
                      </div>
                      {/* freshness bar — only shown when expiring */}
                      {unitExpiring && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ height: 3, borderRadius: 2, background: "#2a2a2a", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${ratio * 100}%`, background: barCol, borderRadius: 2, transition: "width 0.3s" }} />
                          </div>
                          <div style={{ fontSize: "0.65rem", color: barCol, marginTop: 2, opacity: 0.85 }}>
                            {worstUnit} period{worstUnit !== 1 ? "s" : ""} left
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn" style={{ width: "100%", fontSize: "0.88rem", background: screen === "INVENTORY" ? "#1a2e1a" : undefined, border: screen === "INVENTORY" ? "1px solid #4caf50" : undefined, color: screen === "INVENTORY" ? "#7ecba1" : undefined }} onClick={() => openMetaScreen("INVENTORY")}>
          Inventory
        </button>
        <button className="btn" style={{ width: "100%", fontSize: "0.88rem", background: screen === "SKILLS" ? "#1a2e1a" : undefined, border: screen === "SKILLS" ? "1px solid #4caf50" : undefined, color: screen === "SKILLS" ? "#7ecba1" : undefined }} onClick={() => openMetaScreen("SKILLS")}>
          Proficiency
        </button>
      </div>

      <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 10 }}>
        <button className="btn" style={{ width: "100%", fontSize: "0.8rem", opacity: 0.6 }} onClick={reset}>
          Reset Run
        </button>
      </div>

      <div style={{ marginTop: "auto", paddingTop: 10 }}>
        <button
          style={{
            width: "100%", padding: "7px 8px", borderRadius: 8, fontSize: "0.8rem",
            border: "1px solid #2a2a2a", background: "#141414", color: "#666",
            cursor: "pointer",
          }}
          onClick={() => setHowItWorksOpen(true)}
        >
          ? How it works
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // HUD — stat bars only
  // ─────────────────────────────────────────────────────────────────────────
  // Derive preview overlay values from active screen
  // net = value - cost + recovery; [worst, best] = [value - costMax + recMin, value - costMin + recMax]
  const previewOverlay = (() => {
    const sat = player.stats.satiety;
    const sta = player.stats.stamina;

    if (screen === "PREVIEW_JOURNEY" && journeyPreview) {
      const pv = journeyPreview;
      const avgPeriods = Math.round((Math.floor(pv.stepsRange[0] / 5) + Math.floor(pv.stepsRange[1] / 5)) / 2);
      const staRecovLo = pv.staminaRecoveryPerPeriodRange[0] * avgPeriods;
      const staRecovHi = pv.staminaRecoveryPerPeriodRange[1] * avgPeriods;
      return {
        satiety: [sat - pv.satietyCostRange[1] + pv.satietyRestoredRange[0], sat - pv.satietyCostRange[0] + pv.satietyRestoredRange[1]] as [number, number],
        stamina: [sta - pv.staminaCostRange[1] + staRecovLo, sta - pv.staminaCostRange[0] + staRecovHi] as [number, number],
      };
    }
    if (screen === "PREVIEW_HARVEST" && harvestPreview) {
      const pv = harvestPreview;
      const avgPeriods = (pv.periodsRange[0] + pv.periodsRange[1]) / 2;
      const staRecovLo = pv.staminaRecoveryPerPeriodRange[0] * avgPeriods;
      const staRecovHi = pv.staminaRecoveryPerPeriodRange[1] * avgPeriods;
      return {
        satiety: [sat - pv.satietyCostRange[1] + pv.satietyRestoredRange[0], sat - pv.satietyCostRange[0] + pv.satietyRestoredRange[1]] as [number, number],
        stamina: [sta - pv.staminaCostRange[1] + staRecovLo, sta - pv.staminaCostRange[0] + staRecovHi] as [number, number],
      };
    }
    if (screen === "PREVIEW_CRAFT" && craftPreview) {
      const pv = craftPreview;
      const satNet = sat - pv.satietyCost + pv.satietyRestoredRange[1];
      const staNet = sta - pv.staminaCost + pv.staminaRecoveryTotal;
      return {
        satiety: [satNet, satNet] as [number, number],
        stamina: [staNet, staNet] as [number, number],
      };
    }
    if (screen === "PREVIEW_RECOVER") {
      const pv = recoverPreview(player, chomperAutoEnabled);
      return {
        satiety: [sat - pv.satietyCostRange[1], sat - pv.satietyCostRange[0]] as [number, number],
        stamina: [sta + pv.staminaRecoveryRange[0], sta + pv.staminaRecoveryRange[1]] as [number, number],
      };
    }
    return null;
  })();

  const hud = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14, padding: "10px 0" }}>
      <StatBar value={player.stats.satiety} max={player.stats.maxSatiety} kind="satiety" netRange={previewOverlay?.satiety} />
      <StatBar value={player.stats.stamina} max={player.stats.maxStamina} kind="stamina" netRange={previewOverlay?.stamina} />
      <span style={{ fontSize: "0.8rem", opacity: 0.45 }}>{BIOME_LEVEL.name}</span>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // HUB — context-sensitive accented buttons
  // ─────────────────────────────────────────────────────────────────────────
  function hubBtnStyle(kind: "explore" | "findFood" | "layDown" | "craft"): React.CSSProperties {
    const base: React.CSSProperties = { padding: "12px 18px", borderRadius: 12, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#eaeaea", cursor: "pointer", fontSize: "1rem", fontWeight: 400, transition: "all 0.2s" };

    if (kind === "explore" && satietyRatio > 0.5 && staminaRatio > 0.5) {
      return { ...base, padding: "14px 24px", background: "#1a2e1a", border: "2px solid #4caf50", color: "#7ecba1", fontWeight: 700, fontSize: "1.1rem", boxShadow: "0 0 12px #4caf5044" };
    }
    if (kind === "findFood" && satietyRatio <= 0.5 && satietyRatio > 0.25) {
      return { ...base, background: "#2e2600", border: "1px solid #f5c842", color: "#f5e07a", fontWeight: 600 };
    }
    if (kind === "findFood" && satietyRatio <= 0.25) {
      return { ...base, padding: "14px 22px", background: "#2e1010", border: "2px solid #e53935", color: "#ff8a80", fontWeight: 700, fontSize: "1.05rem", boxShadow: "0 0 10px #e5393544" };
    }
    if (kind === "layDown" && staminaRatio <= 0.5 && staminaRatio > 0.25) {
      return { ...base, background: "#2a1c0a", border: "1px solid #cc6b1a", color: "#e8a05a", fontWeight: 600 };
    }
    if (kind === "layDown" && staminaRatio <= 0.25) {
      return { ...base, padding: "14px 22px", background: "#1e1008", border: "2px solid #8b2500", color: "#ff8c60", fontWeight: 700, fontSize: "1.05rem", boxShadow: "0 0 10px #8b250044" };
    }
    return base;
  }

  const hub = (
    <div className="card">
      {/* Location header */}
      {activePoi && activeBlot ? (
        <>
          <PoiImage poiId={activePoi.id} variant={activeBlot.variant} />
          <h2 style={{ marginTop: 10 }}>{prettyPoi(activePoi.id).name} <span style={{opacity:0.5, fontSize:"0.9rem"}}>({activePoi.quality})</span></h2>
          <p className="small" style={{marginBottom:12, opacity:0.7}}>{prettyPoi(activePoi.id).flavor}</p>

          {/* POI content — harvest */}
          {POIS[activePoi.id].kind === "harvest" ? (
            <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
              {(() => {
                const charges = activeBlot.harvestCharges ?? 0;
                const max = activeBlot.maxHarvestCharges ?? 1;
                const ratio = charges / max;
                const depletionFlavour = charges === 0 ? "The ground has given everything it had. Nothing left to take."
                  : ratio <= 0.25 ? "The blot looks thin. Nearly gone."
                  : ratio <= 0.6 ? "You've made a dent. Still something left."
                  : "The blot looks untouched. Rich, heavy, ready to give.";
                const methods = methodsAvailableFromEquipment(player);
                const tools = methods.map(m => Object.values(ITEMS).find(it => it.harvestingMethod === m)).filter(Boolean);
                const recMethod = recommendedMethod(activePoi.id);
                const recTool = recMethod ? Object.values(ITEMS).find(it => it.harvestingMethod === recMethod) : null;
                return (
                  <>
                    <p className="small" style={{ marginBottom: 8, fontStyle: "italic" }}>{depletionFlavour}</p>
                    {charges > 0 && (
                      <>
                        <p className="small">Best tool here: <b>{recTool ? recTool.name : "—"}</b></p>
                        {(() => {
                          const methodVerbs: Record<string, string> = {
                            poke:  "Poke at it",
                            smash: "Smash it open",
                            tease: "Tease it out",
                            drill: "Drill in",
                            scoop: "Scoop it up",
                          };
                          const hasTools = tools.length > 0;
                          const label = hasTools
                            ? tools.length === 2
                              ? `${methodVerbs[methods[0]] ?? "Harvest"} + ${methodVerbs[methods[1]] ?? "Harvest"}`
                              : (methodVerbs[methods[0]] ?? "Harvest")
                            : "Harvest";
                          return (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 4 }}>
                              {hasTools && (
                                <p className="small" style={{ opacity: 0.6, margin: 0 }}>
                                  {tools.map((t, i) => <span key={t!.id}><b>{t!.name}</b>{i < tools.length - 1 ? " + " : ""}</span>)}
                                  {tools.length === 2 ? " — both swing" : ""}
                                </p>
                              )}
                              <button
                                onClick={doMultiHarvest}
                                disabled={!hasTools || dead || exhausted}
                                style={{
                                  padding: "16px 36px",
                                  fontSize: "1.15rem",
                                  fontWeight: 700,
                                  borderRadius: 14,
                                  cursor: hasTools && !dead && !exhausted ? "pointer" : "not-allowed",
                                  border: hasTools ? "2px solid #c8a96e" : "2px dashed #3a3a3a",
                                  background: hasTools ? "linear-gradient(160deg, #2a1e0a 0%, #1a1200 100%)" : "#141414",
                                  color: hasTools ? "#e8c97a" : "#444",
                                  boxShadow: hasTools ? "0 0 18px #c8a96e33, inset 0 1px 0 #c8a96e22" : "none",
                                  letterSpacing: "0.04em",
                                  transition: "all 0.2s",
                                  opacity: (dead || exhausted) && hasTools ? 0.5 : 1,
                                }}
                              >
                                {label}
                              </button>
                              {!hasTools && (
                                <p className="small" style={{ opacity: 0.45, margin: 0 }}>Equip a harvesting tool in the sidebar</p>
                              )}
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            /* POI content — food blot */
            <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Food Blot</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
                {activeBlot.sapRemaining !== undefined && (
                  <div style={{ padding: "8px 14px", background: "#1a1a1a", borderRadius: 10, border: "1px solid #2a2a2a" }}>
                    <div style={{ fontSize: "0.78rem", opacity: 0.55 }}>Soft Sap</div>
                    <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>{activeBlot.sapRemaining ?? 0}</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>units</div>
                  </div>
                )}
                {activeBlot.storableFood && (
                  <div style={{ padding: "8px 14px", background: "#1a1a1a", borderRadius: 10, border: "1px solid #2a2a2a" }}>
                    <div style={{ fontSize: "0.78rem", opacity: 0.55 }}>{FOODS[activeBlot.storableFood].name}</div>
                    <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>{activeBlot.storableRemaining ?? 0}</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>units</div>
                  </div>
                )}
              </div>

              {/* Soft Sap */}
              {(activeBlot.sapRemaining ?? 0) > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  {chomperEquipped && (
                    <p className="small" style={{ opacity: 0.6, margin: 0 }}><b>Chomper</b> — eats sap on contact</p>
                  )}
                  <button
                    onClick={doEatSap}
                    disabled={!chomperEquipped || dead || exhausted}
                    style={{
                      padding: "16px 36px",
                      fontSize: "1.15rem",
                      fontWeight: 700,
                      borderRadius: 14,
                      cursor: chomperEquipped && !dead && !exhausted ? "pointer" : "not-allowed",
                      border: chomperEquipped ? "2px solid #4caf50" : "2px dashed #3a3a3a",
                      background: chomperEquipped ? "linear-gradient(160deg, #0e2e14 0%, #071a09 100%)" : "#141414",
                      color: chomperEquipped ? "#7ecba1" : "#444",
                      boxShadow: chomperEquipped ? "0 0 18px #4caf5033, inset 0 1px 0 #4caf5022" : "none",
                      letterSpacing: "0.04em",
                      transition: "all 0.2s",
                      opacity: (dead || exhausted) && chomperEquipped ? 0.5 : 1,
                    }}
                  >
                    Chow Down
                  </button>
                  {!chomperEquipped && (
                    <p className="small" style={{ opacity: 0.45, margin: 0 }}>Equip a Chomper to eat soft sap</p>
                  )}
                  {lastEatResult && chomperEquipped && (
                    <p className="small" style={{ opacity: 0.8, margin: 0 }}>
                      Ate {lastEatResult.unitsEaten} unit{lastEatResult.unitsEaten !== 1 ? "s" : ""}.{" "}
                      <b>+{lastEatResult.satietyRestored} satiety</b> • <b>−{lastEatResult.staminaCost} stamina</b>.
                      {lastEatResult.satietyRestored === 0 ? " (Already full.)" : " Warm. Gloopy. Worth it."}
                    </p>
                  )}
                </div>
              ) : (
                <p className="small" style={{ opacity: 0.5, marginBottom: 8 }}>All sap eaten.</p>
              )}

              {/* Storable */}
              {activeBlot.storableFood && (activeBlot.storableRemaining ?? 0) > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  {hasEquippedTail(player, "eq_sticky_scoop") && !scoopExpanded && (
                    <p className="small" style={{ opacity: 0.6, margin: 0 }}><b>Sticky Scoop</b> — {FOODS[activeBlot.storableFood].name}</p>
                  )}
                  {!scoopExpanded ? (
                    <>
                      <button
                        onClick={() => setScoopExpanded(true)}
                        disabled={!hasEquippedTail(player, "eq_sticky_scoop") || dead || exhausted}
                        style={{
                          padding: "16px 36px",
                          fontSize: "1.15rem",
                          fontWeight: 700,
                          borderRadius: 14,
                          cursor: hasEquippedTail(player, "eq_sticky_scoop") && !dead && !exhausted ? "pointer" : "not-allowed",
                          border: hasEquippedTail(player, "eq_sticky_scoop") ? "2px solid #26c6da" : "2px dashed #3a3a3a",
                          background: hasEquippedTail(player, "eq_sticky_scoop") ? "linear-gradient(160deg, #082428 0%, #051518 100%)" : "#141414",
                          color: hasEquippedTail(player, "eq_sticky_scoop") ? "#5dd8e8" : "#444",
                          boxShadow: hasEquippedTail(player, "eq_sticky_scoop") ? "0 0 18px #26c6da33, inset 0 1px 0 #26c6da22" : "none",
                          letterSpacing: "0.04em",
                          transition: "all 0.2s",
                          opacity: (dead || exhausted) && hasEquippedTail(player, "eq_sticky_scoop") ? 0.5 : 1,
                        }}
                      >
                        Gather {FOODS[activeBlot.storableFood].name}
                      </button>
                      {!hasEquippedTail(player, "eq_sticky_scoop") && (
                        <p className="small" style={{ opacity: 0.45, margin: 0 }}>Equip a Sticky Scoop to gather this</p>
                      )}
                      {lastStorableResult && hasEquippedTail(player, "eq_sticky_scoop") && (
                        <div className="card" style={{ marginTop: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <div style={{ position: "relative" }}>
                              <ItemIcon id={lastStorableResult.foodId} size={32} />
                              <FlyToInventory id={lastStorableResult.foodId} delay={200} />
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>Scooped up</div>
                              <div style={{ fontSize: "0.8rem", opacity: 0.5 }}>Sticky Scoop pass</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                            <ItemIcon id={lastStorableResult.foodId} size={14} />
                            <span className="small">{FOODS[lastStorableResult.foodId].name} ×{lastStorableResult.qty}</span>
                          </div>
                          <p className="small" style={{ marginBottom: 2 }}>
                            <span style={{ opacity: 0.6 }}>XP</span>{" "}+{lastStorableResult.xpGained}
                          </p>
                          <MiniXPBar method="scoop" xpBefore={scoopXpBefore} xpAfter={player.xp["scoop"] ?? 0} />
                          {lastStorableResult.foodConsumed.length > 0 && (
                            <p className="small" style={{ marginTop: 8 }}>Chomper snacked: {formatConsumed(lastStorableResult.foodConsumed)}</p>
                          )}
                          <p className="small" style={{ marginTop: 8 }}>
                            <span style={{ opacity: 0.6 }}>Satiety</span>{" "}<SatietyLine raw={lastStorableResult.satietyCost} restored={lastStorableResult.foodConsumed.reduce((s, c) => s + FOODS[c.foodId].satietyRestored * c.units, 0)} />
                          </p>
                          <p className="small">
                            <span style={{ opacity: 0.6 }}>Stamina</span>{" "}<StaminaRecoveryLine raw={lastStorableResult.staminaCost} recovery={lastStorableResult.staminaRecovery ?? []} />
                          </p>
                          {lastStorableResult.outcome !== "ok" && <p className="small"><b>{lastStorableResult.outcome.toUpperCase()}</b></p>}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ background: "#141414", borderRadius: 10, padding: "12px 14px", width: "100%" }}>
                      <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Scoop preview — {FOODS[activeBlot.storableFood].name}</div>
                      <div className="kv" style={{ marginBottom: 10 }}>
                        <div>Satiety</div><div style={{ color: "#e8a05a" }}>−{POIS[activePoi.id].foodSpec?.forageSatietyCostPerPeriod ?? 1} per unit</div>
                        <div>Stamina</div><div style={{ color: "#cc6b1a" }}><StaminaRangeLine raw={[POIS[activePoi.id].foodSpec?.forageStaminaCostPerPeriod ?? 1, POIS[activePoi.id].foodSpec?.forageStaminaCostPerPeriod ?? 1]} recoveryRange={[curlerCount * (ITEMS.eq_tail_curler.effects?.staminaRecoveryPerPeriodWorking ?? 0), curlerCount * (ITEMS.eq_tail_curler.effects?.staminaRecoveryPerPeriodWorking ?? 0)]} /></div>
                        <div>Freshness on gather</div><div style={{ opacity: 0.8 }}>{FOODS[activeBlot.storableFood].freshnessRange?.[0]} to {FOODS[activeBlot.storableFood].freshnessRange?.[1]} periods</div>
                      </div>
                      <div className="row">
                        <button className="btn" style={{ background: "#082428", border: "1px solid #26c6da", color: "#5dd8e8", fontWeight: 600 }} onClick={() => { setScoopExpanded(false); doHarvestStorable(); }} disabled={dead || exhausted}>Confirm scoop</button>
                        <button className="btn" onClick={() => setScoopExpanded(false)}>Never mind</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeBlot.storableFood ? (
                <p className="small" style={{ opacity: 0.5 }}>All {FOODS[activeBlot.storableFood].name} gathered.</p>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <>
          <h2>Here you are.</h2>
          <p className="small">Equip tools in your tail slots to unlock their tricks. The world is sticky and not entirely on your side.</p>
        </>
      )}

      {/* Action buttons — always present */}
      <div className="row" style={{ marginTop: 12 }}>
        <button style={hubBtnStyle("explore")} onClick={() => genJourney("explore")} disabled={dead || exhausted}>Explore</button>
        <button style={hubBtnStyle("findFood")} onClick={() => genJourney("findFood")} disabled={dead || exhausted}>Find Food</button>
        <button style={hubBtnStyle("craft")} onClick={openCraft} disabled={dead || exhausted}>Craft</button>
        <button style={hubBtnStyle("layDown")} onClick={previewRecover} disabled={dead}>Lay Down</button>
      </div>
      <div className="notice" style={{ marginTop: 12 }}>
        <span className="small">Hunger ends you. Fatigue stops you. The sticky world clings on.</span>
      </div>
    </div>
  );

  // ── Event display helper ──────────────────────────────────────────────────
  function EventList({ events, effects }: { events: import("./types").EventId[]; effects?: JourneyResult["eventEffects"] }) {
    const displayable = events.filter(e => !["ev_need_chomper", "ev_need_scoop_for_rations"].includes(e));
    const tips = events.filter(e => ["ev_need_chomper", "ev_need_scoop_for_rations"].includes(e));
    return (
      <div>
        {displayable.map((e) => {
          const ev = prettyEvent(e);
          const netEffect = effects?.[e];
          return (
            <div key={e} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #222" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <b style={{ fontSize: "0.95rem" }}>{ev.name}</b>
                <span style={{
                  fontSize: "0.78rem", fontFamily: "monospace", padding: "2px 7px",
                  borderRadius: 6, background: "#1e1e1e", border: "1px solid #333", opacity: 0.9, whiteSpace: "nowrap",
                }}>{ev.netEffect}</span>
              </div>
              <div className="small" style={{ opacity: 0.7, marginTop: 2 }}>{ev.text}</div>
              {netEffect && netEffect.gained.length > 0 && (
                <div className="small" style={{ opacity: 0.8, marginTop: 2 }}>
                  Gained: {netEffect.gained.map(g => {
                    const name = (g.id as string).startsWith("food_") ? getFoodName(g.id as any) : getResourceName(g.id as any);
                    return `${name} ×${g.qty}`;
                  }).join(", ")}
                </div>
              )}
            </div>
          );
        })}
        {tips.map((e) => (
          <div key={e} className="small" style={{ opacity: 0.6, fontStyle: "italic", marginTop: 4 }}>
            {prettyEvent(e).text}
          </div>
        ))}
        {displayable.length === 0 && tips.length === 0 && <span className="small">None.</span>}
      </div>
    );
  }

  // ── Journey preview ───────────────────────────────────────────────────────
  const journeyPreviewScreen = journeyPreview && (
    <div className="card">
      <PreviewTitle
        main={journeyPreview.mode === "explore" ? "Scout Ahead" : "Sniff Around"}
        sub="What Might Happen"
      />

      {/* Cost block */}
      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Cost</div>
        <div className="kv">
          <div>Satiety</div><div style={{ color: "#e8a05a" }}><SatietyRangeLine raw={journeyPreview.satietyCostRange} restoredRange={journeyPreview.satietyRestoredRange} /></div>
          <div>Stamina</div><div style={{ color: "#cc6b1a" }}><StaminaRangeLine raw={journeyPreview.staminaCostRange} recoveryRange={journeyPreview.staminaRecoveryPerPeriodRange} /></div>
          <div>Steps</div><div style={{ opacity: 0.8 }}>{journeyPreview.stepsRange[0]} to {journeyPreview.stepsRange[1]}</div>
        </div>
      </div>

      {/* Outcome block */}
      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Outcome</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <PoiIcon poiId={journeyPreview.poi.id} quality={journeyPreview.poi.quality} size={72} />
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem" }}>{prettyPoi(journeyPreview.poi.id).name}</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.5, marginTop: 2 }}>{journeyPreview.poi.quality}</div>
          </div>
        </div>
        <div className="kv">
          {journeyPreview.estFoodConsumed.length > 0 && <>
            <div>Food chomped</div><div style={{ opacity: 0.8 }}>{chomperDisplay(journeyPreview.estFoodConsumed)}</div>
          </>}
          <div>Events</div>
          <div style={{ opacity: 0.7 }}>
            {(() => {
              const n = journeyPreview.surfacedEvents.filter(e => !["ev_need_chomper","ev_need_scoop_for_rations"].includes(e)).length;
              return n === 0 ? "None expected" : n === 1 ? "1 event may occur" : `${n} events may occur`;
            })()}
          </div>
        </div>
      </div>

      <div className="row">
        <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={proceedJourney} disabled={dead || exhausted}>Let's go there!</button>
        <button className="btn" onClick={gotoHub}>Head back</button>
        <button className="btn" style={{ opacity: 0.7 }} onClick={sniffAgain} disabled={dead || exhausted}>Sniff In Another Direction</button>
      </div>
      <div style={{ marginTop: 8, fontSize: "0.75rem", opacity: 0.4, textAlign: "center" }}>
        Sniff Again costs −20 satiety, −20 stamina
      </div>
    </div>
  );

  // ── Journey summary ───────────────────────────────────────────────────────
  const journeySummaryScreen = journeyResult && (
    <div className="card">
      <FadeIn delay={0}><h2>What happened out there</h2></FadeIn>
      <FadeIn delay={90}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
          <PoiIcon poiId={journeyResult.poi.id} quality={journeyResult.poi.quality} size={80} />
          <div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{prettyPoi(journeyResult.poi.id).name}</div>
            <div style={{ fontSize: "0.8rem", opacity: 0.5, marginTop: 2 }}>{journeyResult.poi.quality}</div>
          </div>
        </div>
      </FadeIn>
      <FadeIn delay={180}>
        <div className="kv" style={{ marginBottom: 12 }}>
          <div>Steps taken</div><div>{journeyResult.steps}</div>
          <div>Satiety cost</div><div><SatietyLine raw={journeyResult.satietyDelta} restored={journeyResult.satietyRestoredByChomper} /></div>
          <div>Stamina cost</div><div><StaminaRecoveryLine raw={journeyResult.staminaDelta} recovery={journeyResult.staminaRecovery} /></div>
        </div>
      </FadeIn>

      {journeyResult.surfacedEvents.filter(e => !["ev_need_chomper","ev_need_scoop_for_rations"].includes(e)).length > 0 && (
        <FadeIn delay={270}>
          <div className="card">
            <h3>Events</h3>
            <EventList events={journeyResult.surfacedEvents} effects={journeyResult.eventEffects} />
          </div>
        </FadeIn>
      )}

      {journeyResult.gained.length > 0 && (
        <FadeIn delay={360}>
          <div className="card">
            <h3>Collected along the way</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {journeyResult.gained.map((g, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ position: "relative" }}>
                    <ItemIcon id={g.id as string} size={22} />
                    <FlyToInventory id={g.id as string} delay={500 + i * 80} />
                  </div>
                  <span className="small">
                    {(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      )}

      {journeyResult.foodConsumed.length > 0 && (
        <FadeIn delay={450}>
          <div className="card">
            <h3>Chomper snacked</h3>
            <p className="small">{formatConsumed(journeyResult.foodConsumed)}</p>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={540}>
        <div className="row">
          <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={enterPoi} disabled={journeyResult.outcome !== "ok"}>Arrive</button>
        </div>

        {journeyResult.outcome !== "ok" && (
          <div className="notice">
            <b>Outcome:</b> {journeyResult.outcome.toUpperCase()}
            <div className="small">{journeyResult.outcome === "exhausted" ? "Your tails have given up. Lay down." : "Satiety hit zero. Reset to try again."}</div>
          </div>
        )}
      </FadeIn>
    </div>
  );

  // ── Harvest preview ───────────────────────────────────────────────────────
  const harvestPreviewScreen = harvestPreview && (
    <div className="card">
      <PreviewTitle main="Dig In" sub="What Might Happen" />

      {/* Tool + efficiency */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontWeight: 600 }}>
          {Object.values(ITEMS).find(it => it.harvestingMethod === harvestPreview.method)?.name ?? harvestPreview.method}
        </span>
        <EffBadge label={harvestPreview.efficiencyLabel} />
      </div>

      {/* Cost block */}
      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Cost</div>
        <div className="kv">
          <div>Satiety</div><div style={{ color: "#e8a05a" }}><SatietyRangeLine raw={harvestPreview.satietyCostRange} restoredRange={harvestPreview.satietyRestoredRange} /></div>
          <div>Stamina</div><div style={{ color: "#cc6b1a" }}><StaminaRangeLine raw={harvestPreview.staminaCostRange} recoveryRange={harvestPreview.staminaRecoveryPerPeriodRange} /></div>
          <div>Time</div><div style={{ opacity: 0.8 }}>{harvestPreview.periodsRange[0]} to {harvestPreview.periodsRange[1]} periods</div>
        </div>
      </div>

      {/* Outcome block */}
      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Outcome</div>
        <div className="kv">
          <div>Yield</div><div style={{ opacity: 0.8 }}>{getResourceName(POIS[harvestPreview.poiId].resourceId as any)} ×{harvestPreview.yieldRange[0]} to {harvestPreview.yieldRange[1]}</div>
          {harvestPreview.estFoodConsumed.length > 0 && <>
            <div>Food chomped</div><div style={{ opacity: 0.8 }}>{chomperDisplay(harvestPreview.estFoodConsumed)}</div>
          </>}
        </div>
      </div>

      <div className="row">
        <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={proceedHarvest} disabled={dead || exhausted}>Dig in</button>
        <button className="btn" onClick={() => setScreen("HUB")}>Leave it</button>
      </div>
    </div>
  );

  // ── Harvest summary ───────────────────────────────────────────────────────
  const harvestSummaryScreen = multiHarvestResults.length > 0 && (
    <div className="card">
      <FadeIn delay={0}><h2>Haul report</h2></FadeIn>
      <FadeIn delay={60}>
        <p className="small">
          {multiHarvestResults.length === 2 ? "Both tools took a swing." : "One pass done."}{" "}
          Total: {multiHarvestResults.reduce((s, r) => s + r.periods, 0)} periods.
        </p>
      </FadeIn>
      {multiHarvestResults.map((res, i) => {
        const tool = Object.values(ITEMS).find(it => it.harvestingMethod === res.method);
        const flavour: Record<string, string> = { best: "Clean and efficient.", good: "Solid work.", ok: "Got something out of it.", weak: "Slow going, but you persisted.", veryWeak: "That hurt more than it helped.", wasteful: "Half of it crumbled away." };
        const effLabel = POIS[res.poiId].methodRank?.[res.method] ?? "ok";
        const xpBefore = harvestXpBefore[res.method] ?? 0;
        const xpAfter = player.xp[res.method] ?? 0;
        return (
          <FadeIn key={i} delay={140 + i * 100}>
            <div className="card">
              {/* Header: tool icon + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                {res.gained.length > 0 && (() => {
                  const g = res.gained[0];
                  return (
                    <div style={{ position: "relative" }}>
                      <ItemIcon id={g.id as string} size={36} />
                      <FlyToInventory id={g.id as string} delay={300 + i * 100} />
                    </div>
                  );
                })()}
                <div>
                  <h3 style={{ margin: 0 }}>{tool ? tool.name : res.method} pass</h3>
                  <p className="small" style={{ margin: 0, opacity: 0.55 }}>{flavour[effLabel] ?? ""}</p>
                </div>
              </div>

              {/* Harvested items — icon inline, no bullet */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                {res.gained.map((g, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <ItemIcon id={g.id as string} size={16} />
                    <span className="small">{(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}</span>
                  </div>
                ))}
              </div>

              {/* XP */}
              <p className="small" style={{ marginBottom: 2 }}>
                <span style={{ opacity: 0.6 }}>XP</span>{" "}+{res.xpGained}
              </p>
              <MiniXPBar method={res.method} xpBefore={xpBefore} xpAfter={xpAfter} />

              {/* Chomper */}
              {res.foodConsumed.length > 0 && (
                <p className="small" style={{ marginTop: 10 }}>Chomper snacked: {formatConsumed(res.foodConsumed)}</p>
              )}

              {/* Cost */}
              <div style={{ marginTop: res.foodConsumed.length > 0 ? 4 : 10 }}>
                <p className="small">
                  <span style={{ opacity: 0.6 }}>Satiety</span>{" "}<SatietyLine raw={res.satietyDelta} restored={res.satietyRestoredByChomper} />
                </p>
                <p className="small">
                  <span style={{ opacity: 0.6 }}>Stamina</span>{" "}<StaminaRecoveryLine raw={res.staminaDelta} recovery={res.staminaRecovery} />
                </p>
              </div>
            </div>
          </FadeIn>
        );
      })}
      <FadeIn delay={multiHarvestResults.length > 1 ? 360 : 260}>
        <div className="row">
          <button className="btn" onClick={() => { setMultiHarvestResults([]); setScreen("HUB"); }}>Back to it</button>
        </div>
        {multiHarvestResults[multiHarvestResults.length - 1]?.outcome !== "ok" && (
          <div className="notice">
            <b>Outcome:</b> {multiHarvestResults[multiHarvestResults.length - 1]?.outcome.toUpperCase()}
            <div className="small">{multiHarvestResults[multiHarvestResults.length - 1]?.outcome === "exhausted" ? "Lay down." : "Satiety hit zero."}</div>
          </div>
        )}
      </FadeIn>
    </div>
  );

  // ── Craft screens ─────────────────────────────────────────────────────────
  const CRAFT_TIERS: { label: string; ids: string[] }[] = [
    { label: "Bare Minimum", ids: ["rcp_fiber_comb", "rcp_sticky_scoop"] },
    { label: "Getting Somewhere", ids: ["rcp_crude_hammerhead", "rcp_hand_drill"] },
    { label: "Now We're Talking", ids: ["rcp_chomper", "rcp_tail_curler"] },
  ];

  const craftMenuScreen = (
    <div className="card">
      <h2>Craft</h2>
      <p className="small" style={{ opacity: 0.6, marginBottom: 14 }}>Requires the <b>{ITEMS.eq_tinker_shaft.name}</b> equipped.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {unlockedRecipes.length === 0 && (
          <p className="small" style={{ opacity: 0.45 }}>Nothing to make. Equip the Tinker Shaft from the sidebar.</p>
        )}
        {CRAFT_TIERS.map(tier => {
          const tierRecipes = tier.ids.filter(id => unlockedRecipes.includes(id));
          if (!tierRecipes.length) return null;
          return (
            <div key={tier.label}>
              <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>{tier.label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {tierRecipes.map((rid) => {
                  const r = prettyRecipe(rid);
                  const recipe = RECIPES[rid];
                  const outputItem = ITEMS[recipe.output.itemId];
                  const can = r.inputs.every((inp) => (player.inventory.find((s) => s.id === inp.id)?.qty ?? 0) >= inp.qty);
                  const isExpanded = expandedItem === rid;
                  return (
                    <div key={rid} style={{ background: "#161616", borderRadius: 10, border: `1px solid ${can ? "#2a2a2a" : "#1e1e1e"}`, borderLeft: `3px solid ${can ? "#c8a96e" : "#333"}`, overflow: "hidden", opacity: can ? 1 : 0.55 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer" }} onClick={() => setExpandedItem(isExpanded ? null : rid)}>
                        <ItemIcon id={recipe.output.itemId} size={20} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{r.name}</div>
                          <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            {r.inputs.map((inp) => (
                              <span key={inp.id} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <ItemIcon id={inp.id} size={12} />
                                {getResourceName(inp.id)} ×{inp.qty}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize: "0.7rem", opacity: 0.35 }}>{isExpanded ? "▲" : "▼"}</div>
                      </div>
                      {isExpanded && (
                        <div style={{ borderTop: "1px solid #1e1e1e", padding: "12px 14px", background: "#121212" }}>
                          <p className="small" style={{ fontStyle: "italic", opacity: 0.6, marginBottom: 12 }}>{outputItem.flavor}</p>
                          <button
                            onClick={() => { chooseRecipe(rid); setExpandedItem(null); }}
                            disabled={!can}
                            style={{
                              padding: "12px 28px",
                              fontSize: "1rem",
                              fontWeight: 700,
                              borderRadius: 10,
                              cursor: can ? "pointer" : "not-allowed",
                              border: can ? "2px solid #c8a96e" : "2px dashed #333",
                              background: can ? "linear-gradient(160deg, #2a1e0a 0%, #1a1200 100%)" : "#141414",
                              color: can ? "#e8c97a" : "#444",
                              boxShadow: can ? "0 0 14px #c8a96e22, inset 0 1px 0 #c8a96e22" : "none",
                              letterSpacing: "0.04em",
                              transition: "all 0.2s",
                            }}
                          >
                            {can ? "Make it!" : "Not enough materials"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        {(() => {
          const anyCraftable = unlockedRecipes.some(rid =>
            RECIPES[rid].inputs.every(inp => (player.inventory.find(s => s.id === inp.id)?.qty ?? 0) >= inp.qty)
          );
          const nothingSelected = expandedItem === null || !unlockedRecipes.includes(expandedItem);
          const accent = !anyCraftable || nothingSelected;
          return (
            <button
              className="btn"
              onClick={gotoHub}
              style={accent ? { border: "1px solid #4a4a4a", color: "#aaa", background: "#1e1e1e" } : undefined}
            >
              Put it down
            </button>
          );
        })()}
      </div>
    </div>
  );

  const craftPreviewScreen = craftPreview && (
    <div className="card">
      <PreviewTitle main="Tinker" sub="What Might Happen" />

      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Cost</div>
        <div className="kv">
          <div>Satiety</div><div style={{ color: "#e8a05a" }}><SatietyRangeLine raw={[craftPreview.satietyCost, craftPreview.satietyCost]} restoredRange={craftPreview.satietyRestoredRange} /></div>
          <div>Stamina</div><div style={{ color: "#cc6b1a" }}><StaminaRangeLine raw={[craftPreview.staminaCost, craftPreview.staminaCost]} recoveryRange={[craftPreview.staminaRecoveryTotal, craftPreview.staminaRecoveryTotal]} /></div>
          <div>Time</div><div style={{ opacity: 0.8 }}>{craftPreview.craftPeriods} periods</div>
        </div>
      </div>

      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Outcome</div>
        <div className="kv">
          <div>Making</div><div style={{ opacity: 0.8 }}>{prettyRecipe(craftPreview.recipeId).name}</div>
          {craftPreview.estFoodConsumed.length > 0 && <>
            <div>Food chomped</div><div style={{ opacity: 0.8 }}>{chomperDisplay(craftPreview.estFoodConsumed)}</div>
          </>}
        </div>
      </div>

      <div className="row">
        <button ref={craftButtonRef} className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={proceedCraft} disabled={dead || exhausted}>Make it</button>
        <button className="btn" onClick={() => setScreen("CRAFT_MENU")}>Put it down</button>
      </div>
    </div>
  );

  const craftSummaryScreen = craftResult && (
    <div className="card">
      <FadeIn delay={0}><h2>Craft Summary</h2></FadeIn>
      <FadeIn delay={80}>
        <div className="card">
          <h3>Result</h3>
          {craftResult.success
            ? <p className="small">Crafted: <b>{getItemName(craftResult.crafted!.itemId)}</b> ×{craftResult.crafted!.qty}</p>
            : <p className="small">Failed: <b>{craftResult.failReason}</b></p>}
          <p className="small" style={{ marginTop: 6 }}><SatietyLine raw={craftResult.satietyDelta} restored={craftResult.satietyRestoredByChomper} /> satiety · <StaminaRecoveryLine raw={craftResult.staminaDelta} recovery={craftResult.staminaRecovery} /> stamina</p>
        </div>
      </FadeIn>
      {craftResult.foodConsumed.length > 0 && (
        <FadeIn delay={160}>
          <div className="card"><h3>Chomper Consumption</h3><p className="small">{formatConsumed(craftResult.foodConsumed)}</p></div>
        </FadeIn>
      )}
      <FadeIn delay={craftResult.foodConsumed.length > 0 ? 240 : 160}>
        <div className="row">
          <button className="btn" onClick={() => setScreen("CRAFT_MENU")}>Keep tinkering</button>
          <button className="btn" onClick={gotoHub}>Done</button>
        </div>
        {!craftResult.success && <div className="notice">Outcome: {craftResult.failReason?.toUpperCase()}</div>}
      </FadeIn>
    </div>
  );

  // ── Recover screens ───────────────────────────────────────────────────────
  const recoverPreviewScreen = (() => {
    const pv = recoverPreview(player, chomperAutoEnabled);
    return (
      <div className="card">
        <PreviewTitle main="Belly Down" sub="What Might Happen" />
        <p className="small" style={{ textAlign: "center", marginBottom: 14, opacity: 0.7 }}>
          {curlerCount > 0
            ? `The Tail Curler${curlerCount === 2 ? "s tick" : " ticks"} faster while you're horizontal — napping gives the best recovery rate${curlerCount === 2 ? ", and two curlers stack" : ""}. You'll unwind faster lying still.`
            : null}
        </p>
        <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Cost</div>
          <div className="kv">
            <div>Satiety</div><div style={{ color: "#e8a05a" }}>−{pv.satietyCostRange[0]} to −{pv.satietyCostRange[1]}</div>
            <div>Time</div><div style={{ opacity: 0.8 }}>{pv.periodsMin} to {pv.periodsMax} periods</div>
          </div>
        </div>
        <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Outcome</div>
          <div className="kv">
            <div>Stamina</div><div style={{ color: curlerCount > 0 ? "#7ecba1" : "#c0504a" }}>
              {curlerCount > 0
                ? `+${pv.staminaRecoveryRange[0]} to +${pv.staminaRecoveryRange[1]} (est.)`
                : <><b style={{ color: "#e05a54" }}>No Tail Curler equipped.</b> Stamina: no change.</>}
            </div>
            {curlerCount === 0 && (
              <><div style={{ gridColumn: "1 / -1", fontSize: "0.78rem", color: "#a05050", marginTop: 4, lineHeight: 1.5 }}>
                You'll just lie there getting hungrier. Equip one if you'd like this to do anything at all.
              </div></>
            )}
            {pv.estFoodConsumed.length > 0 && <>
              <div>Food chomped</div><div style={{ opacity: 0.8 }}>{chomperDisplay(pv.estFoodConsumed)}</div>
            </>}
          </div>
        </div>
        <div className="row">
          <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={proceedRecover} disabled={dead}>Flop down</button>
          <button className="btn" onClick={gotoHub}>Stay upright</button>
        </div>
      </div>
    );
  })();

  const recoverSummaryScreen = recoverSummary && (
    <div className="card">
      <FadeIn delay={0}><h2>Back on your feet (sort of)</h2></FadeIn>
      <FadeIn delay={80}>
        <p className="small">You spent {recoverSummary.periods} periods horizontal. Stamina recovered: <b>{Math.round(recoverSummary.staminaRecovered)}</b>.</p>
        {Math.round(recoverSummary.staminaRecovered) === 0 && (
          <p className="small" style={{ marginTop: 6, color: "#a06060", fontStyle: "italic" }}>
            That accomplished nothing except making you hungrier. A Tail Curler would help. Just saying.
          </p>
        )}
      </FadeIn>
      {recoverSummary.foodConsumed.length > 0 && (
        <FadeIn delay={160}>
          <div className="card"><h3>Chomper Snacked</h3><p className="small">{formatConsumed(recoverSummary.foodConsumed)}</p></div>
        </FadeIn>
      )}
      <FadeIn delay={recoverSummary.foodConsumed.length > 0 ? 240 : 160}>
        <div className="row">
          <button className="btn" onClick={keepFlopping} disabled={dead}>Keep flopping</button>
          <button className="btn" onClick={gotoHub}>Get up</button>
        </div>
        {recoverSummary.outcome !== "ok" && (
          <div className="notice"><b>Outcome:</b> {recoverSummary.outcome.toUpperCase()}</div>
        )}
      </FadeIn>
    </div>
  );

  // ── Exhausted / Dead ──────────────────────────────────────────────────────
  const exhaustedScreen = (
    <div className="card">
      <h2>Completely Boneless</h2>
      <p>Your tails have staged a protest. You can only lie down now.</p>
      <div className="row"><button className="btn" onClick={previewRecover} disabled={dead}>Lay Down</button></div>
    </div>
  );
  const deadScreen = (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "radial-gradient(ellipse at center, #2a0a0a 0%, #0c0000 70%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      gap: 24,
    }}>
      <div style={{ fontSize: "0.8rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "#8b2020", opacity: 0.8 }}>
        — satiety depleted —
      </div>
      <h1 style={{
        fontSize: "clamp(2.8rem, 8vw, 5rem)", fontWeight: 900, letterSpacing: "0.04em",
        color: "#e53935", textShadow: "0 0 60px #e5393588, 0 0 120px #e5393533",
        margin: 0, lineHeight: 1,
      }}>
        Very Dead
      </h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.55, margin: 0, letterSpacing: "0.05em" }}>
        Hunger won. Dust yourself off.
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 12, padding: "14px 36px", borderRadius: 12,
          background: "#1a0505", border: "2px solid #e53935",
          color: "#ff8a80", fontSize: "1rem", fontWeight: 700,
          cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase",
          boxShadow: "0 0 20px #e5393544",
        }}
      >
        Reset Run
      </button>
    </div>
  );

  // ── Inventory modal ───────────────────────────────────────────────────────
  // ── Inventory screen ──────────────────────────────────────────────────────
  const inventoryScreen = (
    <div style={{ background: "#111", borderRadius: 14, border: "1px solid #2a2a2a", overflow: "hidden" }}>
      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid #2a2a2a", background: "#0e0e0e" }}>
        <button onClick={backFromMeta} style={{ background: "none", border: "none", color: "#7ecba1", cursor: "pointer", fontSize: "0.9rem", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>← Back</button>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em" }}>Inventory</div>
        <div style={{ marginLeft: "auto", fontSize: "0.78rem", opacity: 0.4 }}>{player.inventory.length} stacks</div>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Equipment */}
        {(() => {
          const equip = player.inventory.filter(s => (s.id as string).startsWith("eq_"));
          if (!equip.length) return null;
          return (
            <div>
              <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Equipment</div>
              {equip.map(s => {
                const id = s.id as import("./types").ItemId;
                const item = ITEMS[id];
                const isExpanded = expandedItem === id;
                const slot = item.slot === "tail" ? "Tail tool" : "Shoe";
                const equipped = player.equipment.tailSlots.includes(id) || player.equipment.shoe === id;
                return (
                  <div key={id} style={{ background: "#161616", borderRadius: 10, border: "1px solid #2a2a2a", borderLeft: "3px solid #c8a96e", marginBottom: 6, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }} onClick={() => setExpandedItem(isExpanded ? null : id)}>
                      <ItemIcon id={id} size={20} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{item.name}</div>
                        <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: 2 }}>{slot}{equipped ? " · equipped" : ""}</div>
                      </div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.5, padding: "3px 8px", background: "#1e1e1e", borderRadius: 6 }}>×{s.qty}</div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.35 }}>{isExpanded ? "▲" : "▼"}</div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: "0 14px 12px", fontSize: "0.82rem", opacity: 0.65, fontStyle: "italic", borderTop: "1px solid #1e1e1e", paddingTop: 10 }}>
                        {item.flavor}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Storable food */}
        {(() => {
          const foods = player.inventory.filter(s => (s.id as string).startsWith("food_") && FOODS[s.id as import("./types").FoodId]?.storable);
          if (!foods.length) return null;
          return (
            <div>
              <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Storable Food</div>
              {foods.map(s => {
                const id = s.id as import("./types").FoodId;
                const food = FOODS[id];
                const isExpanded = expandedItem === id;
                const freshness = s.freshness ?? [];
                const maxFresh = food.freshnessRange?.[1] ?? 1;
                return (
                  <div key={id} style={{ background: "#161616", borderRadius: 10, border: "1px solid #2a2a2a", borderLeft: "3px solid #26c6da", marginBottom: 6, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }} onClick={() => setExpandedItem(isExpanded ? null : id)}>
                      <ItemIcon id={id} size={20} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{food.name}</div>
                        <div style={{ display: "flex", gap: 3, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                          {freshness.map((f, i) => {
                            const ratio = f / maxFresh;
                            const col = ratio > 0.6 ? "#26c6da" : ratio > 0.3 ? "#f5c842" : "#e53935";
                            return (
                              <div key={i} title={`${f} periods left`} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                                <div style={{ width: 28, height: 5, borderRadius: 2, background: "#2a2a2a", overflow: "hidden" }}>
                                  <div style={{ width: `${ratio * 100}%`, height: "100%", background: col, borderRadius: 2 }} />
                                </div>
                                <span style={{ fontSize: "0.6rem", opacity: 0.5, minWidth: 14 }}>{f}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.5, padding: "3px 8px", background: "#1e1e1e", borderRadius: 6 }}>×{s.qty}</div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.35 }}>{isExpanded ? "▲" : "▼"}</div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: "0 14px 12px", fontSize: "0.82rem", opacity: 0.65, fontStyle: "italic", borderTop: "1px solid #1e1e1e", paddingTop: 10 }}>
                        {food.flavor}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="small" style={{ opacity: 0.4, marginTop: 4 }}>Each bar = one unit. Number = periods of freshness remaining.</p>
            </div>
          );
        })()}

        {/* Resources */}
        {(() => {
          const resources = player.inventory.filter(s => !((s.id as string).startsWith("eq_") || (s.id as string).startsWith("food_")));
          if (!resources.length) return null;
          return (
            <div>
              <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Resources</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {resources.map(s => (
                  <div key={s.id as string} style={{ background: "#161616", borderRadius: 10, border: "1px solid #2a2a2a", padding: "10px 16px", minWidth: 90, textAlign: "center" }}>
                    <ItemIcon id={s.id as string} size={22} style={{ margin: "0 auto 4px" }} />
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{getResourceName(s.id as any)}</div>
                    <div style={{ fontSize: "1.4rem", fontWeight: 700, margin: "4px 0", opacity: 0.9 }}>{s.qty}</div>
                    <div style={{ fontSize: "0.72rem", opacity: 0.4 }}>units</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {player.inventory.length === 0 && (
          <p className="small" style={{ opacity: 0.4, textAlign: "center", marginTop: 20 }}>Nothing here yet.</p>
        )}
      </div>
    </div>
  );

  // ── How It Works modal ───────────────────────────────────────────────────
  const howItWorksModal = howItWorksOpen && (
    <div className="modal-overlay" onClick={() => setHowItWorksOpen(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="card">
          <h2>How it works</h2>

          <p className="small" style={{ lineHeight: 1.8, marginBottom: 14 }}>
            The world is sticky and doesn't hand things over easily. Everything you do — walking, harvesting, crafting, resting — takes <b>periods</b>. A period is the basic unit of time out here. Things happen once per period, whether you like it or not.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
            <div style={{ background: "#161616", borderRadius: 8, padding: "10px 14px", borderLeft: "3px solid #c8a96e" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: 5 }}>Each period that passes</div>
              <ul className="small" style={{ lineHeight: 1.9, margin: 0, paddingLeft: 16, opacity: 0.85 }}>
                <li>Carried food loses one freshness — it rots whether you eat it or not</li>
                <li>The <b>Chomper</b> eats one unit from your stock first, before rot sets in</li>
                <li>The <b>Tail Curler</b> recovers a little stamina each period — least while walking, more while working, most while napping</li>
                <li>Satiety drains — journeys cost one per step, harvesting and crafting cost more</li>
              </ul>
            </div>

            <div style={{ background: "#161616", borderRadius: 8, padding: "10px 14px", borderLeft: "3px solid #26c6da" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: 5 }}>Gathering</div>
              <p className="small" style={{ lineHeight: 1.8, margin: 0, opacity: 0.85 }}>
                Three things to find out there: <b>Resin Glob</b>, <b>Fiber Clump</b>, <b>Brittle Stone</b>. Five methods to get them — each tool in your tail unlocks one. Using a method builds proficiency in it, which improves yield over time. Equip two of the same tool and it swings twice.
              </p>
            </div>

            <div style={{ background: "#161616", borderRadius: 8, padding: "10px 14px", borderLeft: "3px solid #7ecba1" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: 5 }}>Food</div>
              <p className="small" style={{ lineHeight: 1.8, margin: 0, opacity: 0.85 }}>
                <b>Soft Sap</b> is eaten on the spot with the Chomper — costs stamina to bite. <b>Resin Chew</b> and <b>Dense Ration</b> can be carried and stored, but both rot with time. Without a Chomper, they just get older. With one, they get eaten automatically each period before decay takes hold.
              </p>
            </div>
          </div>

          <div className="row" style={{ marginTop: 4 }}>
            <button className="btn" onClick={() => setHowItWorksOpen(false)}>Got it</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Proficiency screen ────────────────────────────────────────────────────
  const skillsScreen = (
    <div style={{ background: "#111", borderRadius: 14, border: "1px solid #2a2a2a", overflow: "hidden" }}>
      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid #2a2a2a", background: "#0e0e0e" }}>
        <button onClick={backFromMeta} style={{ background: "none", border: "none", color: "#7ecba1", cursor: "pointer", fontSize: "0.9rem", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>← Back</button>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em" }}>Proficiency</div>
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="small" style={{ opacity: 0.5, marginBottom: 4 }}>Each harvesting method levels up independently. +8% yield per level.</p>
        {(["poke", "smash", "tease", "drill", "scoop"] as import("./types").HarvestMethodId[]).map((method) => {
          const xp = player.xp[method] ?? 0;
          const level = skillLevel(xp);
          const xpForThis = skillXpForLevel(level);
          const xpForNext = level >= SKILL_MAX_LEVEL ? xpForThis + SKILL_XP_PER_LEVEL : skillXpForLevel(level + 1);
          const progress = level >= SKILL_MAX_LEVEL ? 100 : Math.round(((xp - xpForThis) / (xpForNext - xpForThis)) * 100);
          const methodNames: Record<import("./types").HarvestMethodId, string> = { poke: "Poke", smash: "Smash", tease: "Tease", drill: "Drill", scoop: "Scoop" };
          const toolIds: Record<import("./types").HarvestMethodId, string> = { poke: "eq_pointed_twig", smash: "eq_crude_hammerhead", tease: "eq_fiber_comb", drill: "eq_hand_drill", scoop: "eq_sticky_scoop" };
          const toolName: Record<import("./types").HarvestMethodId, string> = { poke: "Pointed Twig", smash: "Crude Hammerhead", tease: "Fiber Comb", drill: "Hand Drill", scoop: "Sticky Scoop" };
          const isMax = level >= SKILL_MAX_LEVEL;
          return (
            <div key={method} style={{ background: "#161616", borderRadius: 10, border: "1px solid #2a2a2a", borderLeft: "3px solid #c8a96e", padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <ItemIcon id={toolIds[method]} size={18} />
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{methodNames[method]}</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.45 }}>{toolName[method]}</div>
                <div style={{ marginLeft: "auto", fontSize: "0.82rem", fontWeight: 600, color: isMax ? "#c8a96e" : "#7ecba1" }}>
                  Lv {level}{isMax ? " · MAX" : ""}
                </div>
              </div>
              <div style={{ background: "#0e0e0e", borderRadius: 4, height: 8, width: "100%", overflow: "hidden" }}>
                <div style={{ background: isMax ? "#c8a96e" : "#4caf50", borderRadius: 4, height: 8, width: `${progress}%`, transition: "width 0.4s" }} />
              </div>
              {!isMax && (
                <div style={{ fontSize: "0.72rem", opacity: 0.35, marginTop: 5, textAlign: "right" }}>
                  {xp - xpForThis} / {xpForNext - xpForThis} XP to next level
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Screen routing ────────────────────────────────────────────────────────
  let body: React.ReactNode = null;
  if (dead) body = deadScreen;
  else if (exhausted && !["SUMMARY_JOURNEY","SUMMARY_HARVEST","SUMMARY_CRAFT","SUMMARY_RECOVER","PREVIEW_RECOVER"].includes(screen))
    body = exhaustedScreen;

  if (!body) {
    switch (screen) {
      case "HUB": body = hub; break;
      case "EXHAUSTED": body = exhaustedScreen; break;
      case "DEAD": body = deadScreen; break;
      case "PREVIEW_JOURNEY": body = journeyPreviewScreen; break;
      case "SUMMARY_JOURNEY": body = journeySummaryScreen; break;
      case "PREVIEW_HARVEST": body = harvestPreviewScreen; break;
      case "SUMMARY_HARVEST": body = harvestSummaryScreen; break;
      case "CRAFT_MENU": body = craftMenuScreen; break;
      case "PREVIEW_CRAFT": body = craftPreviewScreen; break;
      case "SUMMARY_CRAFT": body = craftSummaryScreen; break;
      case "PREVIEW_RECOVER": body = recoverPreviewScreen; break;
      case "SUMMARY_RECOVER": body = recoverSummaryScreen; break;
      case "INVENTORY": body = inventoryScreen; break;
      case "SKILLS": body = skillsScreen; break;
      default: body = hub;
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {sidebar}
      <div style={{ flex: 1, padding: 22, maxWidth: 820 }}>
        <h1 style={{ letterSpacing: "0.08em", marginBottom: 4 }}>2 Tails 3 Feet</h1>
        <div style={{ opacity: 0.5, fontSize: 13, marginBottom: 12 }}>Sticky Survival Prototype</div>
        {hud}
        {decayedFoodAlert && (
          <div style={{
            marginBottom: 12, padding: "10px 14px", borderRadius: 10,
            background: "#1f0505", border: "1px solid #c62828",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: "1rem" }}>💀</span>
            <span style={{ flex: 1, fontSize: "0.88rem", color: "#ff8a80" }}>
              <b>{decayedFoodAlert}</b> fully rotted and was lost.
            </span>
            <button
              onClick={() => setDecayedFoodAlert(null)}
              style={{ background: "none", border: "none", color: "#ff8a80", cursor: "pointer", fontSize: "1rem", opacity: 0.7, padding: "0 4px" }}
            >✕</button>
          </div>
        )}
        {body}
        {howItWorksModal}
        {craftFlashItem && (
          <CraftSuccessFlash itemId={craftFlashItem} origin={craftFlashOrigin} onDone={() => { setCraftFlashItem(null); setCraftFlashOrigin(null); }} />
        )}
      </div>
    </div>
  );
}
