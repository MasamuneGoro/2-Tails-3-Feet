import React, { useMemo, useState } from "react";
import type { BlotState, CraftPreview, CraftResult, EatSapResult, HarvestMethodId, HarvestPreview, HarvestResult, HarvestStorableResult, JourneyPreview, JourneyResult, PlayerState, PoiId, Screen } from "./types";
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

function formatConsumed(consumed: { foodId: import("./types").FoodId; units: number }[]) {
  if (!consumed.length) return "None";
  return consumed.map((c) => `${FOODS[c.foodId].name} ×${c.units}`).join(", ");
}

function formatConsumedRange(consumed: { foodId: import("./types").FoodId; unitsRange: [number, number] }[]) {
  if (!consumed.length) return "";
  return consumed.map((c) => `${FOODS[c.foodId].name} ×${c.unitsRange[0]}–${c.unitsRange[1]}`).join(", ");
}

function StatBar({ value, max, kind }: { value: number; max: number; kind: "hunger" | "fatigue" }) {
  const ratio = value / max;
  let color: string;
  if (kind === "hunger") {
    color = ratio < 0.5 ? "#4caf50" : ratio < 0.75 ? "#f5c842" : "#e53935";
  } else {
    // fatigue: amber -> burnt orange -> deep sienna
    color = ratio < 0.5 ? "#c8a96e" : ratio < 0.75 ? "#cc6b1a" : "#8b2500";
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", opacity: 0.7 }}>
        <span>{kind === "hunger" ? "Hunger" : "Fatigue"}</span>
        <span>{value}/{max}</span>
      </div>
      <div style={{ width: "100%", background: "#2a2a2a", borderRadius: 6, height: 12 }}>
        <div style={{ width: `${Math.min(100, ratio * 100)}%`, height: "100%", background: color, borderRadius: 6, transition: "width 0.3s, background 0.3s" }} />
      </div>
    </div>
  );
}

const START_PLAYER: PlayerState = {
  biomeLevelId: "sticky_l1",
  stats: { hunger: 200, fatigue: 0, maxHunger: 1000, maxFatigue: 1000 },
  equipment: { tailSlots: [null, null], shoe: "eq_standard_shoe" },
  inventory: [
    { id: "eq_tinker_shaft", qty: 1 },
    { id: "eq_tail_curler", qty: 1 },
    { id: "eq_chomper", qty: 1 },
    { id: "eq_pointed_twig", qty: 1 },
    { id: "food_resin_chew", qty: 1, freshness: [3] },
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
  const [multiHarvestResults, setMultiHarvestResults] = useState<HarvestResult[]>([]);

  const [harvestPreview, setHarvestPreview] = useState<HarvestPreview | null>(null);
  const [harvestResult, setHarvestResult] = useState<HarvestResult | null>(null);

  const [craftPreview, setCraftPreview] = useState<CraftPreview | null>(null);
  const [craftResult, setCraftResult] = useState<CraftResult | null>(null);

  const [recoverState, setRecoverState] = useState<{ periods: number } | null>(null);
  const [recoverSummary, setRecoverSummary] = useState<any>(null);

  const [returnScreen, setReturnScreen] = useState<Screen>("HUB");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [scoopExpanded, setScoopExpanded] = useState(false);
  const [chomperAutoEnabled, setChomperAutoEnabled] = useState(true);

  const exhausted = player.stats.fatigue >= player.stats.maxFatigue;
  const dead = player.stats.hunger >= player.stats.maxHunger;

  const hungerRatio = player.stats.hunger / player.stats.maxHunger;
  const fatigueRatio = player.stats.fatigue / player.stats.maxFatigue;
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
    setMultiHarvestResults([]);
    setHarvestPreview(null); setHarvestResult(null);
    setCraftPreview(null); setCraftResult(null);
    setRecoverState(null); setRecoverSummary(null);
    setScoopExpanded(false);
    setChomperAutoEnabled(true);
  }

  function gotoHub() {
    if (dead) setScreen("DEAD");
    else if (exhausted) setScreen("EXHAUSTED");
    else setScreen("HUB");
  }

  function openMetaScreen(target: "INVENTORY" | "SKILLS") {
    // Only store return point when first leaving main flow
    if (screen !== "INVENTORY" && screen !== "SKILLS") setReturnScreen(screen);
    setExpandedItem(null);
    setScreen(target);
  }

  function backFromMeta() {
    setScreen(returnScreen);
  }

  // ── Journey ───────────────────────────────────────────────────────────────
  function genJourney(mode: "explore" | "findFood") {
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
    const next = structuredClone(player);
    const res = resolveJourney(next, journeyPreview, chomperAutoEnabled);
    setPlayer(next); setJourneyResult(res);
    // Clear current location — you've left
    setActivePoi(null); setActiveBlot(null);
    setLastEatResult(null); setLastStorableResult(null);
    setScoopExpanded(false);
    // Clear the saved roll for this mode now that it's been used
    if (journeyPreview.mode === "explore") setSavedExploreRoll(null);
    else setSavedFoodRoll(null);
    setScreen("SUMMARY_JOURNEY");
  }
  function sniffAgain() {
    if (!journeyPreview) return;
    const next = structuredClone(player);
    next.stats.hunger = clamp(next.stats.hunger + 20, 0, next.stats.maxHunger);
    next.stats.fatigue = clamp(next.stats.fatigue + 20, 0, next.stats.maxFatigue);
    setPlayer(next);
    const pv = makeJourneyPreview(next, journeyPreview.mode, chomperAutoEnabled);
    if (journeyPreview.mode === "explore") setSavedExploreRoll(pv);
    else setSavedFoodRoll(pv);
    setJourneyPreview(pv);
  }
  function enterPoi() {
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
    if (!activePoi) return;
    setHarvestPreview(makeHarvestPreview(player, activePoi.id, method, chomperAutoEnabled));
    setHarvestResult(null);
    setScreen("PREVIEW_HARVEST");
  }
  function proceedHarvest() {
    if (!harvestPreview) return;
    const next = structuredClone(player);
    const res = resolveHarvest(next, harvestPreview, chomperAutoEnabled);
    setPlayer(next); setHarvestResult(res);
    if (activeBlot && activeBlot.harvestCharges !== undefined)
      setActiveBlot({ ...activeBlot, harvestCharges: Math.max(0, activeBlot.harvestCharges - 1) });
    setScreen("SUMMARY_HARVEST");
  }
  function doMultiHarvest() {
    if (!activePoi || !activeBlot) return;
    const methods = methodsAvailableFromEquipment(player);
    if (!methods.length) return;
    let next = structuredClone(player);
    let blotCopy = structuredClone(activeBlot);
    const results: HarvestResult[] = [];
    for (const method of methods) {
      if (blotCopy.harvestCharges !== undefined && blotCopy.harvestCharges <= 0) break;
      if (next.stats.hunger >= next.stats.maxHunger || next.stats.fatigue >= next.stats.maxFatigue) break;
      const pv = makeHarvestPreview(next, activePoi.id, method, chomperAutoEnabled);
      const res = resolveHarvest(next, pv, chomperAutoEnabled);
      results.push(res);
      if (blotCopy.harvestCharges !== undefined) blotCopy.harvestCharges = Math.max(0, blotCopy.harvestCharges - 1);
      if (res.outcome !== "ok") break;
    }
    setPlayer(next); setActiveBlot(blotCopy); setMultiHarvestResults(results);
    setScreen("SUMMARY_HARVEST");
  }

  // ── Food blot ─────────────────────────────────────────────────────────────
  function doEatSap() {
    if (!activeBlot) return;
    const next = structuredClone(player);
    const blotCopy = structuredClone(activeBlot);
    const result = eatSapAtBlot(next, blotCopy);
    setPlayer(next); setActiveBlot(blotCopy); setLastEatResult(result);
  }
  function doHarvestStorable() {
    if (!activeBlot) return;
    const next = structuredClone(player);
    const blotCopy = structuredClone(activeBlot);
    const result = harvestStorableAtBlot(next, blotCopy);
    setPlayer(next); setActiveBlot(blotCopy); setLastStorableResult(result);
  }

  // ── Craft ─────────────────────────────────────────────────────────────────
  function openCraft() {
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
    const next = structuredClone(player);
    const res = resolveCraft(next, craftPreview, chomperAutoEnabled);
    setPlayer(next); setCraftResult(res);
    setScreen("SUMMARY_CRAFT");
  }

  // ── Recover ───────────────────────────────────────────────────────────────
  function previewRecover() {
    const pv = recoverPreview(player, chomperAutoEnabled);
    setRecoverState({ periods: pv.periods });
    setRecoverSummary(null);
    setScreen("PREVIEW_RECOVER");
  }
  function proceedRecover() {
    const periods = recoverState?.periods ?? 8;
    const next = structuredClone(player);
    const res = resolveRecover(next, periods, chomperAutoEnabled);
    setPlayer(next); setRecoverSummary(res);
    setScreen("SUMMARY_RECOVER");
  }
  function keepFlopping() {
    const periods = recoverState?.periods ?? 8;
    const next = structuredClone(player);
    const res = resolveRecover(next, periods, chomperAutoEnabled);
    setPlayer(next); setRecoverSummary(res);
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

      {([0, 1] as (0 | 1)[]).map((slotIdx) => (
        <div key={slotIdx}>
          <div style={{ fontSize: "0.78rem", opacity: 0.6, marginBottom: 3 }}>Tail {slotIdx === 0 ? "A" : "B"}</div>
          <select
            style={tailSelectStyle}
            value={player.equipment.tailSlots[slotIdx] ?? ""}
            onChange={(e) => equipTail(slotIdx, (e.target.value || null) as any)}
          >
            <option value="">— empty —</option>
            {availableTailToolIds(slotIdx).map((id) => (
              <option key={id} value={id}>{getItemName(id)}</option>
            ))}
          </select>
        </div>
      ))}

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

      <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn" style={{ width: "100%", fontSize: "0.88rem", background: screen === "INVENTORY" ? "#1a2e1a" : undefined, border: screen === "INVENTORY" ? "1px solid #4caf50" : undefined, color: screen === "INVENTORY" ? "#7ecba1" : undefined }} onClick={() => openMetaScreen("INVENTORY")}>
          Inventory
        </button>
        <button className="btn" style={{ width: "100%", fontSize: "0.88rem", background: screen === "SKILLS" ? "#1a2e1a" : undefined, border: screen === "SKILLS" ? "1px solid #4caf50" : undefined, color: screen === "SKILLS" ? "#7ecba1" : undefined }} onClick={() => openMetaScreen("SKILLS")}>
          Skills
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
  const hud = (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14, padding: "10px 0" }}>
      <StatBar value={player.stats.hunger} max={player.stats.maxHunger} kind="hunger" />
      <StatBar value={player.stats.fatigue} max={player.stats.maxFatigue} kind="fatigue" />
      <span style={{ fontSize: "0.8rem", opacity: 0.45 }}>{BIOME_LEVEL.name}</span>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // HUB — context-sensitive accented buttons
  // ─────────────────────────────────────────────────────────────────────────
  function hubBtnStyle(kind: "explore" | "findFood" | "layDown" | "craft"): React.CSSProperties {
    const base: React.CSSProperties = { padding: "12px 18px", borderRadius: 12, border: "1px solid #2a2a2a", background: "#1a1a1a", color: "#eaeaea", cursor: "pointer", fontSize: "1rem", fontWeight: 400, transition: "all 0.2s" };

    if (kind === "explore" && hungerRatio < 0.5 && fatigueRatio < 0.5) {
      return { ...base, padding: "14px 24px", background: "#1a2e1a", border: "2px solid #4caf50", color: "#7ecba1", fontWeight: 700, fontSize: "1.1rem", boxShadow: "0 0 12px #4caf5044" };
    }
    if (kind === "findFood" && hungerRatio >= 0.5 && hungerRatio < 0.75) {
      return { ...base, background: "#2e2600", border: "1px solid #f5c842", color: "#f5e07a", fontWeight: 600 };
    }
    if (kind === "findFood" && hungerRatio >= 0.75) {
      return { ...base, padding: "14px 22px", background: "#2e1010", border: "2px solid #e53935", color: "#ff8a80", fontWeight: 700, fontSize: "1.05rem", boxShadow: "0 0 10px #e5393544" };
    }
    if (kind === "layDown" && fatigueRatio >= 0.5 && fatigueRatio < 0.75) {
      return { ...base, background: "#2a1c0a", border: "1px solid #cc6b1a", color: "#e8a05a", fontWeight: 600 };
    }
    if (kind === "layDown" && fatigueRatio >= 0.75) {
      return { ...base, padding: "14px 22px", background: "#1e1008", border: "2px solid #8b2500", color: "#ff8c60", fontWeight: 700, fontSize: "1.05rem", boxShadow: "0 0 10px #8b250044" };
    }
    return base;
  }

  const hub = (
    <div className="card">
      {/* Location header */}
      {activePoi && activeBlot ? (
        <>
          <h2>{prettyPoi(activePoi.id).name} <span style={{opacity:0.5, fontSize:"0.9rem"}}>({activePoi.quality})</span></h2>
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
                      <b>−{lastEatResult.hungerRestored} hunger</b> • <b>+{lastEatResult.fatigueCost} fatigue</b>.
                      {lastEatResult.hungerRestored === 0 ? " (Not hungry enough.)" : " Warm. Gloopy. Worth it."}
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
                        <p className="small" style={{ opacity: 0.8, margin: 0 }}>
                          Scooped 1 {FOODS[lastStorableResult.foodId].name}.{" "}
                          <b>+{lastStorableResult.hungerCost} hunger</b> • <b>+{lastStorableResult.fatigueCost} fatigue</b>.{" "}
                          {lastStorableResult.outcome !== "ok" ? <b>{lastStorableResult.outcome.toUpperCase()}</b> : "Stashed."}
                        </p>
                      )}
                    </>
                  ) : (
                    <div style={{ background: "#141414", borderRadius: 10, padding: "12px 14px", width: "100%" }}>
                      <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Scoop preview — {FOODS[activeBlot.storableFood].name}</div>
                      <div className="kv" style={{ marginBottom: 10 }}>
                        <div>Hunger cost</div><div style={{ color: "#e8a05a" }}>+{POIS[activePoi.id].foodSpec?.forageHungerPerPeriod ?? 1} per unit</div>
                        <div>Fatigue cost</div><div style={{ color: "#cc6b1a" }}>+{POIS[activePoi.id].foodSpec?.forageFatiguePerPeriod ?? 1} per unit</div>
                        {curlerCount > 0 && (
                          <>
                            <div>Net fatigue (Tail Curler)</div>
                            <div style={{ color: "#7ecba1" }}>+{Math.max(0, (POIS[activePoi.id].foodSpec?.forageFatiguePerPeriod ?? 1) - curlerCount * (ITEMS.eq_tail_curler.effects?.fatigueRecoveryPerPeriod ?? 0))} per unit</div>
                          </>
                        )}
                        <div>Freshness on harvest</div><div style={{ opacity: 0.8 }}>{FOODS[activeBlot.storableFood].freshnessRange?.[0]}–{FOODS[activeBlot.storableFood].freshnessRange?.[1]} periods</div>
                        <div>Chomper</div><div style={{ opacity: 0.8 }}>{!chomperEquipped ? "No Chomper" : !chomperAutoEnabled ? "Off" : "May snack"}</div>
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
        <span className="small">Hunger max → death. Fatigue max → exhausted (recover only).</span>
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
        sub="What It'll Cost You"
      />

      {/* Cost block */}
      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Cost</div>
        <div className="kv">
          <div>Hunger</div><div style={{ color: "#e8a05a" }}>+{journeyPreview.hungerIncreaseRange[0]}–{journeyPreview.hungerIncreaseRange[1]}</div>
          <div>Fatigue</div><div style={{ color: "#cc6b1a" }}>+{journeyPreview.fatigueIncreaseRange[0]}–{journeyPreview.fatigueIncreaseRange[1]}</div>
          <div>Steps</div><div style={{ opacity: 0.8 }}>{journeyPreview.stepsRange[0]}–{journeyPreview.stepsRange[1]}</div>
        </div>
      </div>

      {/* Outcome block */}
      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Outcome</div>
        <div className="kv">
          <div>Destination</div><div>{prettyPoi(journeyPreview.poi.id).name} <span style={{ opacity: 0.5, fontSize: "0.85rem" }}>({journeyPreview.poi.quality})</span></div>
          <div>Chomper chomp</div><div style={{ opacity: 0.8 }}>{chomperDisplay(journeyPreview.estFoodConsumed)}</div>
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
        <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={proceedJourney} disabled={dead || exhausted}>Set off</button>
        <button className="btn" onClick={gotoHub}>Head back</button>
        <button className="btn" style={{ opacity: 0.7 }} onClick={sniffAgain} disabled={dead || exhausted}>Sniff In Another Direction</button>
      </div>
      <div style={{ marginTop: 8, fontSize: "0.75rem", opacity: 0.4, textAlign: "center" }}>
        Sniff Again costs −20 hunger, −20 fatigue
      </div>
    </div>
  );

  // ── Journey summary ───────────────────────────────────────────────────────
  const journeySummaryScreen = journeyResult && (
    <div className="card">
      <h2>What happened out there</h2>
      <div className="kv" style={{ marginBottom: 12 }}>
        <div>Found</div><div><b>{prettyPoi(journeyResult.poi.id).name}</b> <span style={{opacity:0.6}}>({journeyResult.poi.quality})</span></div>
        <div>Steps taken</div><div>{journeyResult.steps}</div>
        <div>Hunger cost</div><div>+{journeyResult.hungerDelta}</div>
        <div>Fatigue cost</div><div>+{Math.max(0, journeyResult.fatigueDelta)}</div>
      </div>

      {journeyResult.surfacedEvents.filter(e => !["ev_need_chomper","ev_need_scoop_for_rations"].includes(e)).length > 0 && (
        <div className="card">
          <h3>Events</h3>
          <EventList events={journeyResult.surfacedEvents} effects={journeyResult.eventEffects} />
        </div>
      )}

      {journeyResult.gained.length > 0 && (
        <div className="card">
          <h3>Collected along the way</h3>
          <ul>
            {journeyResult.gained.map((g, i) => (
              <li key={i} className="small">
                {(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}
              </li>
            ))}
          </ul>
        </div>
      )}

      {journeyResult.foodConsumed.length > 0 && (
        <div className="card">
          <h3>Chomper snacked</h3>
          <p className="small">{formatConsumed(journeyResult.foodConsumed)}</p>
        </div>
      )}

      <div className="row">
        <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={enterPoi} disabled={journeyResult.outcome !== "ok"}>Arrive</button>
      </div>

      {journeyResult.outcome !== "ok" && (
        <div className="notice">
          <b>Outcome:</b> {journeyResult.outcome.toUpperCase()}
          <div className="small">{journeyResult.outcome === "exhausted" ? "Your tails have given up. Lay down." : "Hunger won. Reset to try again."}</div>
        </div>
      )}
    </div>
  );

  // ── Harvest preview ───────────────────────────────────────────────────────
  const harvestPreviewScreen = harvestPreview && (
    <div className="card">
      <PreviewTitle main="Dig In" sub="What It'll Cost You" />

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
          <div>Hunger</div><div style={{ color: "#e8a05a" }}>+{harvestPreview.hungerIncreaseRange[0]}–{harvestPreview.hungerIncreaseRange[1]}</div>
          <div>Fatigue</div><div style={{ color: "#cc6b1a" }}>+{harvestPreview.fatigueIncreaseRange[0]}–{harvestPreview.fatigueIncreaseRange[1]}</div>
          <div>Time</div><div style={{ opacity: 0.8 }}>{harvestPreview.periodsRange[0]}–{harvestPreview.periodsRange[1]} periods</div>
        </div>
      </div>

      {/* Outcome block */}
      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Outcome</div>
        <div className="kv">
          <div>Yield</div><div style={{ opacity: 0.8 }}>{getResourceName(POIS[harvestPreview.poiId].resourceId as any)} ×{harvestPreview.yieldRange[0]}–{harvestPreview.yieldRange[1]}</div>
          <div>Chomper chomp</div><div style={{ opacity: 0.8 }}>{chomperDisplay(harvestPreview.estFoodConsumed)}</div>
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
      <h2>Haul report</h2>
      <p className="small">
        {multiHarvestResults.length === 2 ? "Both tools took a swing." : "One pass done."}{" "}
        Total: {multiHarvestResults.reduce((s, r) => s + r.periods, 0)} periods.
      </p>
      {multiHarvestResults.map((res, i) => {
        const tool = Object.values(ITEMS).find(it => it.harvestingMethod === res.method);
        const flavour: Record<string, string> = { best: "Clean and efficient.", good: "Solid work.", ok: "Got something out of it.", weak: "Slow going, but you persisted.", veryWeak: "That hurt more than it helped.", wasteful: "Half of it crumbled away." };
        const effLabel = POIS[res.poiId].methodRank?.[res.method] ?? "ok";
        return (
          <div className="card" key={i}>
            <h3>{tool ? tool.name : res.method} pass</h3>
            <p className="small">{flavour[effLabel] ?? ""}</p>
            <ul>{res.gained.map((g, j) => <li key={j} className="small">{(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}</li>)}</ul>
            <p className="small">→ +{res.hungerDelta} hunger · +{Math.max(0, res.fatigueDelta)} fatigue · +{res.xpGained} XP</p>
            {res.foodConsumed.length > 0 && <p className="small">Chomper snacked: {formatConsumed(res.foodConsumed)}</p>}
          </div>
        );
      })}
      <div className="row">
        <button className="btn" onClick={() => { setMultiHarvestResults([]); setScreen("HUB"); }}>Back to it</button>
      </div>
      {multiHarvestResults[multiHarvestResults.length - 1]?.outcome !== "ok" && (
        <div className="notice">
          <b>Outcome:</b> {multiHarvestResults[multiHarvestResults.length - 1]?.outcome.toUpperCase()}
          <div className="small">{multiHarvestResults[multiHarvestResults.length - 1]?.outcome === "exhausted" ? "Lay down." : "Hunger won."}</div>
        </div>
      )}
    </div>
  );

  // ── Craft screens ─────────────────────────────────────────────────────────
  const craftMenuScreen = (
    <div className="card">
      <h2>Craft</h2>
      <p className="small">Some recipes need the <b>{ITEMS.eq_tinker_shaft.name}</b> equipped. Equip it from the sidebar.</p>
      <table className="table">
        <thead><tr><th>Recipe</th><th>Inputs</th><th>Output</th><th></th></tr></thead>
        <tbody>
          {unlockedRecipes.map((rid) => {
            const r = prettyRecipe(rid);
            const can = r.inputs.every((inp) => (player.inventory.find((s) => s.id === inp.id)?.qty ?? 0) >= inp.qty);
            return (
              <tr key={rid}>
                <td><b>{r.name}</b></td>
                <td className="small">{r.inputs.map((i) => `${getResourceName(i.id)}×${i.qty}`).join(", ")}</td>
                <td className="small">{getItemName(r.output.itemId)}×{r.output.qty}</td>
                <td><button className="btn" onClick={() => chooseRecipe(rid)} disabled={!can}>Preview</button></td>
              </tr>
            );
          })}
          {!unlockedRecipes.length && <tr><td colSpan={4} className="small">Nothing to make. Equip the Tinker Shaft from the sidebar.</td></tr>}
        </tbody>
      </table>
      <div className="row"><button className="btn" onClick={gotoHub}>Put it down</button></div>
    </div>
  );

  const craftPreviewScreen = craftPreview && (
    <div className="card">
      <PreviewTitle main="Tinker" sub="What It'll Cost You" />

      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Cost</div>
        <div className="kv">
          <div>Hunger</div><div style={{ color: "#e8a05a" }}>+{craftPreview.hungerIncrease}</div>
          <div>Fatigue</div><div style={{ color: "#cc6b1a" }}>+{craftPreview.fatigueIncrease}</div>
          <div>Time</div><div style={{ opacity: 0.8 }}>{craftPreview.craftPeriods} periods</div>
        </div>
      </div>

      <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Outcome</div>
        <div className="kv">
          <div>Making</div><div style={{ opacity: 0.8 }}>{prettyRecipe(craftPreview.recipeId).name}</div>
          <div>Chomper chomp</div><div style={{ opacity: 0.8 }}>{chomperDisplay(craftPreview.estFoodConsumed)}</div>
        </div>
      </div>

      <div className="row">
        <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={proceedCraft} disabled={dead || exhausted}>Make it</button>
        <button className="btn" onClick={() => setScreen("CRAFT_MENU")}>Put it down</button>
      </div>
    </div>
  );

  const craftSummaryScreen = craftResult && (
    <div className="card">
      <h2>Craft Summary</h2>
      <div className="card">
        <h3>Result</h3>
        {craftResult.success
          ? <p className="small">Crafted: <b>{getItemName(craftResult.crafted!.itemId)}</b> ×{craftResult.crafted!.qty}</p>
          : <p className="small">Failed: <b>{craftResult.failReason}</b></p>}
      </div>
      {craftResult.foodConsumed.length > 0 && (
        <div className="card"><h3>Chomper Consumption</h3><p className="small">{formatConsumed(craftResult.foodConsumed)}</p></div>
      )}
      <div className="row">
        <button className="btn" onClick={() => setScreen("CRAFT_MENU")}>Keep tinkering</button>
        <button className="btn" onClick={gotoHub}>Head back</button>
      </div>
      {!craftResult.success && <div className="notice">Outcome: {craftResult.failReason?.toUpperCase()}</div>}
    </div>
  );

  // ── Recover screens ───────────────────────────────────────────────────────
  const recoverPreviewScreen = (
    <div className="card">
      <PreviewTitle main="Belly Down" sub="What It'll Cost You" />
      <p className="small" style={{ textAlign: "center", marginBottom: 14, opacity: 0.7 }}>
        {curlerCount > 0
          ? `The Tail Curler${curlerCount === 2 ? "s work" : " works"} harder when you're horizontal — 1.5× recovery${curlerCount === 2 ? ", doubled for two curlers" : ""}. You'll unwind faster lying still.`
          : "No Tail Curler equipped — you'll just lie there getting hungrier. Bold strategy."}
      </p>
      {(() => {
        const pv = recoverPreview(player, chomperAutoEnabled);
        return (
          <>
            <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Cost</div>
              <div className="kv">
                <div>Hunger</div><div style={{ color: "#e8a05a" }}>+{pv.hungerDeltaRange[0]}</div>
                <div>Time</div><div style={{ opacity: 0.8 }}>{pv.periods} periods</div>
              </div>
            </div>
            <div style={{ background: "#0e0e0e", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
              <div style={{ fontSize: "0.7rem", opacity: 0.45, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Outcome</div>
              <div className="kv">
                <div>Fatigue</div><div style={{ color: "#7ecba1" }}>{curlerCount > 0 ? `−${Math.round(pv.fatigueRecoveredRange[1])} (est.)` : "No change"}</div>
                <div>Chomper chomp</div><div style={{ opacity: 0.8 }}>{chomperDisplay(pv.estFoodConsumed)}</div>
              </div>
            </div>
          </>
        );
      })()}
      <div className="row">
        <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={proceedRecover} disabled={dead}>Flop down</button>
        <button className="btn" onClick={gotoHub}>Stay upright</button>
      </div>
    </div>
  );

  const recoverSummaryScreen = recoverSummary && (
    <div className="card">
      <h2>Back on your feet (sort of)</h2>
      <p className="small">You spent {recoverSummary.periods} periods horizontal. Fatigue recovered: <b>{Math.round(recoverSummary.fatigueRecovered)}</b>.</p>
      {recoverSummary.foodConsumed.length > 0 && (
        <div className="card"><h3>Chomper Snacked</h3><p className="small">{formatConsumed(recoverSummary.foodConsumed)}</p></div>
      )}
      <div className="row">
        <button className="btn" onClick={keepFlopping} disabled={dead}>Keep flopping</button>
        <button className="btn" onClick={gotoHub}>Get up</button>
      </div>
      {recoverSummary.outcome !== "ok" && (
        <div className="notice"><b>Outcome:</b> {recoverSummary.outcome.toUpperCase()}</div>
      )}
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
    <div className="card">
      <h2>Very Dead</h2>
      <p>Hunger won. Dust yourself off.</p>
      <div className="row"><button className="btn" onClick={reset}>Reset Run</button></div>
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
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{food.name}</div>
                        <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                          {freshness.map((f, i) => {
                            const ratio = f / maxFresh;
                            const col = ratio > 0.6 ? "#26c6da" : ratio > 0.3 ? "#f5c842" : "#e53935";
                            return (
                              <div key={i} title={`${f} periods left`} style={{ display: "flex", gap: 2 }}>
                                {Array.from({ length: maxFresh }).map((_, pip) => (
                                  <div key={pip} style={{ width: 6, height: 6, borderRadius: 2, background: pip < f ? col : "#2a2a2a" }} />
                                ))}
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
              <p className="small" style={{ opacity: 0.4, marginTop: 4 }}>Each pip = 1 period of freshness remaining.</p>
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
          <ul className="small" style={{ lineHeight: 1.9 }}>
            <li>Equip tail tools using the sidebar dropdowns. Changes take effect immediately on any open preview.</li>
            <li>3 resources: Resin Glob, Fiber Clump, Brittle Stone.</li>
            <li>5 harvesting methods, each with its own skill — check Skills in the sidebar.</li>
            <li>3 foods: Soft Sap (eat on spot with Chomper), Resin Chew + Dense Ration (storable, rot over time).</li>
            <li>Dual Tail Curlers stack recovery. Dual Chompers eat 2 units per period from stores (sap limit unchanged).</li>
          </ul>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setHowItWorksOpen(false)}>Got it</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Skills screen ─────────────────────────────────────────────────────────
  const skillsScreen = (
    <div style={{ background: "#111", borderRadius: 14, border: "1px solid #2a2a2a", overflow: "hidden" }}>
      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid #2a2a2a", background: "#0e0e0e" }}>
        <button onClick={backFromMeta} style={{ background: "none", border: "none", color: "#7ecba1", cursor: "pointer", fontSize: "0.9rem", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>← Back</button>
        <div style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em" }}>Skills</div>
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
          const toolName: Record<import("./types").HarvestMethodId, string> = { poke: "Pointed Twig", smash: "Crude Hammerhead", tease: "Fiber Comb", drill: "Hand Drill", scoop: "Sticky Scoop" };
          const isMax = level >= SKILL_MAX_LEVEL;
          return (
            <div key={method} style={{ background: "#161616", borderRadius: 10, border: "1px solid #2a2a2a", borderLeft: "3px solid #c8a96e", padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
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
        {body}
        {howItWorksModal}
      </div>
    </div>
  );
}
