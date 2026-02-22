import React, { useMemo, useState } from "react";
import type { BlotState, CraftPreview, CraftResult, EatSapResult, HarvestMethodId, HarvestPreview, HarvestResult, HarvestStorableResult, JourneyPreview, JourneyResult, PlayerState, PoiId, Screen } from "./types";
import { BIOME_LEVEL, FOODS, ITEMS, POIS, RECIPES, RESOURCES } from "./gameData";
import {
  canCraft,
  getFoodName,
  getItemName,
  getResourceName,
  listUnlockedRecipes,
  makeCraftPreview,
  makeHarvestPreview,
  makeJourneyPreview,
  methodsAvailableFromEquipment,
  prettyEvent,
  prettyPoi,
  prettyRecipe,
  recommendedMethod,
  resolveCraft,
  resolveHarvest,
  resolveJourney,
  recoverPreview,
  resolveRecover,
  invAdd,
  invGet,
  invRemove,
  clamp,
  skillLevel,
  skillXpToNextLevel,
  skillXpForLevel,
  SKILL_MAX_LEVEL,
  SKILL_XP_PER_LEVEL,
  generateBlot,
  eatSapAtBlot,
  harvestStorableAtBlot,
  hasEquippedTail,
} from "./engine";

function pct(n: number, d: number) {
  return Math.round((n / d) * 100);
}

function pill(text: string) {
  return <span className="pill">{text}</span>;
}

function formatConsumed(consumed: { foodId: import("./types").FoodId; units: number }[]) {
  if (!consumed.length) return "None";
  return consumed.map((c) => `${FOODS[c.foodId].name} ×${c.units}`).join(", ");
}

function formatConsumedRange(consumed: { foodId: import("./types").FoodId; unitsRange: [number, number] }[]) {
  if (!consumed.length) return "None";
  return consumed.map((c) => `${FOODS[c.foodId].name} ×${c.unitsRange[0]}–${c.unitsRange[1]}`).join(", ");
}

const START_PLAYER: PlayerState = {
  biomeLevelId: "sticky_l1",
  stats: {
    hunger: 20,
    fatigue: 0,
    maxHunger: 100,
    maxFatigue: 100,
  },
  equipment: {
    tailSlots: [null, null],
    shoe: "eq_standard_shoe",
  },
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
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const exhausted = player.stats.fatigue >= player.stats.maxFatigue;
  const dead = player.stats.hunger >= player.stats.maxHunger;

  const unlockedRecipes = useMemo(() => listUnlockedRecipes(player), [player]);

  function reset() {
    setPlayer(structuredClone(START_PLAYER));
    setScreen("HUB");
    setJourneyPreview(null);
    setJourneyResult(null);
    setActivePoi(null);
    setActiveBlot(null);
    setLastEatResult(null);
    setLastStorableResult(null);
    setMultiHarvestResults([]);
    setHarvestPreview(null);
    setHarvestResult(null);
    setCraftPreview(null);
    setCraftResult(null);
    setRecoverState(null);
    setRecoverSummary(null);
  }

  function gotoHub() {
    if (dead) setScreen("DEAD");
    else if (exhausted) setScreen("EXHAUSTED");
    else setScreen("HUB");
  }

  function openInventory() {
    setInventoryOpen(true);
  }

  function closeInventory() {
    setInventoryOpen(false);
    // Regenerate whichever preview is active so equipment changes are reflected
    if (screen === "PREVIEW_JOURNEY" && journeyPreview) {
      const pv = makeJourneyPreview(player, journeyPreview.mode);
      // preserve the same poi/events roll — only recalc costs and food estimates
      setJourneyPreview({ ...pv, poi: journeyPreview.poi, surfacedEvents: journeyPreview.surfacedEvents });
    } else if (screen === "PREVIEW_HARVEST" && harvestPreview) {
      const pv = makeHarvestPreview(player, harvestPreview.poiId, harvestPreview.method);
      setHarvestPreview(pv);
    } else if (screen === "PREVIEW_CRAFT" && craftPreview) {
      const pv = makeCraftPreview(player, craftPreview.recipeId);
      setCraftPreview(pv);
    } else if (screen === "PREVIEW_RECOVER") {
      const pv = recoverPreview(player);
      setRecoverState({ periods: pv.periods });
    }
  }

  function genJourney(mode: "explore" | "findFood") {
    const pv = makeJourneyPreview(player, mode);
    setJourneyPreview(pv);
    setJourneyResult(null);
    setScreen("PREVIEW_JOURNEY");
  }

  function proceedJourney() {
    if (!journeyPreview) return;
    const next = structuredClone(player);
    const res = resolveJourney(next, journeyPreview);
    setPlayer(next);
    setJourneyResult(res);
    setScreen("SUMMARY_JOURNEY");
  }

  function enterPoi() {
    if (!journeyResult) return;
    setActivePoi(journeyResult.poi);
    setActiveBlot(journeyResult.blot);
    setLastEatResult(null);
    setLastStorableResult(null);
    setMultiHarvestResults([]);
    setScreen("POI");
  }

  function chooseMethod(method: HarvestMethodId) {
    if (!activePoi) return;
    const pv = makeHarvestPreview(player, activePoi.id, method);
    setHarvestPreview(pv);
    setHarvestResult(null);
    setScreen("PREVIEW_HARVEST");
  }

  function doEatSap() {
    if (!activeBlot) return;
    const next = structuredClone(player);
    const blotCopy = structuredClone(activeBlot);
    const result = eatSapAtBlot(next, blotCopy);
    setPlayer(next);
    setActiveBlot(blotCopy);
    setLastEatResult(result);
  }

  function doHarvestStorable() {
    if (!activeBlot) return;
    const next = structuredClone(player);
    const blotCopy = structuredClone(activeBlot);
    const result = harvestStorableAtBlot(next, blotCopy);
    setPlayer(next);
    setActiveBlot(blotCopy);
    setLastStorableResult(result);
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
      const pv = makeHarvestPreview(next, activePoi.id, method);
      const res = resolveHarvest(next, pv);
      results.push(res);
      if (blotCopy.harvestCharges !== undefined) {
        blotCopy.harvestCharges = Math.max(0, blotCopy.harvestCharges - 1);
      }
      if (res.outcome !== "ok") break;
    }
    setPlayer(next);
    setActiveBlot(blotCopy);
    setMultiHarvestResults(results);
    setScreen("SUMMARY_HARVEST");
  }

  function proceedHarvest() {
    if (!harvestPreview) return;
    const next = structuredClone(player);
    const res = resolveHarvest(next, harvestPreview);
    setPlayer(next);
    setHarvestResult(res);
    // Decrement blot charges
    if (activeBlot && activeBlot.harvestCharges !== undefined) {
      setActiveBlot({ ...activeBlot, harvestCharges: Math.max(0, activeBlot.harvestCharges - 1) });
    }
    setScreen("SUMMARY_HARVEST");
  }

  function openCraft() {
    if (!canCraft(player)) {
      setScreen("EXHAUSTED");
      return;
    }
    setScreen("CRAFT_MENU");
  }

  function chooseRecipe(recipeId: string) {
    const pv = makeCraftPreview(player, recipeId);
    setCraftPreview(pv);
    setCraftResult(null);
    setScreen("PREVIEW_CRAFT");
  }

  function proceedCraft() {
    if (!craftPreview) return;
    const next = structuredClone(player);
    const res = resolveCraft(next, craftPreview);
    setPlayer(next);
    setCraftResult(res);
    setScreen("SUMMARY_CRAFT");
  }

  function previewRecover() {
    const pv = recoverPreview(player);
    setRecoverState({ periods: pv.periods });
    setRecoverSummary(null);
    setScreen("PREVIEW_RECOVER");
  }

  function proceedRecover() {
    const periods = recoverState?.periods ?? 8;
    const next = structuredClone(player);
    const res = resolveRecover(next, periods);
    setPlayer(next);
    setRecoverSummary(res);
    setScreen("SUMMARY_RECOVER");
  }

  // --- Inventory actions (equip / unequip tools)
  function equipTail(slotIdx: 0 | 1, itemId: import("./types").ItemId | null) {
    const next = structuredClone(player);
    next.equipment.tailSlots[slotIdx] = itemId;
    setPlayer(next);
  }

  function isItemId(x: unknown): x is import("./types").ItemId {
    return typeof x === "string" && Object.prototype.hasOwnProperty.call(ITEMS, x);
  }

  function canEquipItem(itemId: unknown) {
    if (!isItemId(itemId)) return false;
    const item = ITEMS[itemId];
    return item.slot === "tail";
  }

  function availableTailToolIds(slotIdx: 0 | 1): import("./types").ItemId[] {
    const otherSlot = player.equipment.tailSlots[slotIdx === 0 ? 1 : 0];
    return player.inventory
      .filter((st): st is { id: import("./types").ItemId; qty: number } =>
        typeof st.id === "string" &&
        (st.id as string).startsWith("eq_") &&
        st.qty > 0 &&
        canEquipItem(st.id)
      )
      .filter((st) => {
        // exclude item already equipped in the other slot, unless qty > 1
        if (st.id === otherSlot) return st.qty > 1;
        return true;
      })
      .map((st) => st.id);
  }

  // --- rendering helpers
  const hud = (
    <div className="topbar">
      {pill(`Biome: ${BIOME_LEVEL.name}`)}
      {pill(`Hunger: ${player.stats.hunger}/${player.stats.maxHunger} (${pct(player.stats.hunger, player.stats.maxHunger)}%)`)}
      {pill(`Fatigue: ${player.stats.fatigue}/${player.stats.maxFatigue} (${pct(player.stats.fatigue, player.stats.maxFatigue)}%)`)}
      <span className="pill">Tail Slots: [{player.equipment.tailSlots[0] ? getItemName(player.equipment.tailSlots[0]) : "—"}] [{player.equipment.tailSlots[1] ? getItemName(player.equipment.tailSlots[1]) : "—"}]</span>
      <button className="btn" onClick={reset}>Reset</button>
    </div>
  );



  const hub = (
    <div className="card">
      <h2>Here you are.</h2>
      <p className="small">
        Equip tools in your tail slots to unlock their tricks — Chomper eats things, Tail Curler uncoils your tired bits.
        The world is sticky and not entirely on your side. Good luck.
      </p>
      <div className="row">
        <button className="btn" onClick={() => genJourney("explore")} disabled={dead || exhausted}>Explore</button>
        <button className="btn" onClick={() => genJourney("findFood")} disabled={dead || exhausted}>Find Food</button>
        <button className="btn" onClick={openCraft} disabled={dead || exhausted}>Craft</button>
        <button className="btn" onClick={previewRecover} disabled={dead}>Lay on your belly</button>
        <button className="btn" onClick={openInventory}>Inventory</button>
      </div>
      <div className="notice">
        <div className="small">
          Rules: If hunger reaches max → death. If fatigue reaches max → exhausted (you can only recover).
        </div>
      </div>
    </div>
  );

  const exhaustedScreen = (
    <div className="card">
      <h2>Completely Boneless</h2>
      <p>Your tails have staged a protest. All you can do right now is lie down and hope for the best.</p>
      <div className="row">
        <button className="btn" onClick={previewRecover} disabled={dead}>Lay on your belly</button>
        <button className="btn" onClick={openInventory}>Inventory</button>
      </div>
    </div>
  );

  const deadScreen = (
    <div className="card">
      <h2>Very Dead</h2>
      <p>Hunger won. It usually does. Dust yourself off and try again.</p>
      <div className="row">
        <button className="btn" onClick={reset}>Reset Run</button>
      </div>
    </div>
  );

  const inventoryScreen = (
    <div className="card">
      <h2>Inventory</h2>
      <div className="grid2">
        <div className="card">
          <h3>Equipment</h3>
          <p className="small">You have 2 tails → 2 equip slots. Equip items from your inventory to activate their abilities.</p>
          <div className="kv">
            <div>Tail A</div>
            <div>
              <select value={player.equipment.tailSlots[0] ?? ""} onChange={(e) => equipTail(0, (e.target.value || null) as any)}>
                <option value="">— Empty —</option>
                {availableTailToolIds(0).map((id) => (
                  <option key={id} value={id}>{getItemName(id)}</option>
                ))}
              </select>
            </div>
            <div>Tail B</div>
            <div>
              <select value={player.equipment.tailSlots[1] ?? ""} onChange={(e) => equipTail(1, (e.target.value || null) as any)}>
                <option value="">— Empty —</option>
                {availableTailToolIds(1).map((id) => (
                  <option key={id} value={id}>{getItemName(id)}</option>
                ))}
              </select>
            </div>
            <div>Shoe (×3 feet)</div>
            <div>{getItemName(player.equipment.shoe)}</div>
          </div>

        </div>

        <div className="card">
          <h3>Stacks</h3>
          <table className="table">
            <thead><tr><th>Item</th><th>Qty</th><th>Notes</th></tr></thead>
            <tbody>
              {player.inventory.length === 0 ? (
                <tr><td colSpan={3} className="small">Empty.</td></tr>
              ) : (
                player.inventory.map((s) => {
                  const id = s.id as any;
                  const name =
                    (id.startsWith?.("eq_") ? getItemName(id) : id.startsWith?.("food_") ? getFoodName(id) : getResourceName(id));
                  const note =
                    id.startsWith?.("food_") && FOODS[id as import("./types").FoodId]?.storable
                      ? `Freshness: ${s.freshness?.join(", ") ?? "?"}`
                      : "";
                  return (
                    <tr key={id}>
                      <td>{name}</td>
                      <td>{s.qty}</td>
                      <td className="small">{note}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <p className="small">
            Storable food slowly rots as time passes. With Chomper equipped, it will auto-consume storable food during actions.
          </p>
        </div>
      </div>

      <div className="card">
        <h3>Skills</h3>
        <p className="small">Each harvesting method levels up independently. Higher levels mean better yields.</p>
        <table className="table">
          <thead><tr><th>Method</th><th>Level</th><th>Progress</th><th>XP</th></tr></thead>
          <tbody>
            {(["poke", "smash", "tease", "drill", "scoop"] as import("./types").HarvestMethodId[]).map((method) => {
              const xp = player.xp[method] ?? 0;
              const level = skillLevel(xp);
              const xpForThis = skillXpForLevel(level);
              const xpForNext = level >= SKILL_MAX_LEVEL ? xpForThis + SKILL_XP_PER_LEVEL : skillXpForLevel(level + 1);
              const progress = level >= SKILL_MAX_LEVEL ? 100 : Math.round(((xp - xpForThis) / (xpForNext - xpForThis)) * 100);
              const methodNames: Record<import("./types").HarvestMethodId, string> = {
                poke: "Poke", smash: "Smash", tease: "Tease", drill: "Drill", scoop: "Scoop",
              };
              return (
                <tr key={method}>
                  <td>{methodNames[method]}</td>
                  <td>Lv {level}{level >= SKILL_MAX_LEVEL ? " (max)" : ""}</td>
                  <td>
                    <div style={{background:"#333",borderRadius:4,height:8,width:120,display:"inline-block",verticalAlign:"middle"}}>
                      <div style={{background:"#7ecba1",borderRadius:4,height:8,width:`${progress}%`}} />
                    </div>
                  </td>
                  <td className="small">{level >= SKILL_MAX_LEVEL ? "MAX" : `${xp - xpForThis} / ${xpForNext - xpForThis}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="row">
        <button className="btn" onClick={closeInventory}>Close</button>
      </div>
    </div>
  );

  const journeyPreviewScreen = journeyPreview && (
    <div className="card">
      <h2>{journeyPreview.mode === "explore" ? "Scout Ahead" : "Sniff Around"} — what it might cost</h2>
      <div className="kv">
        <div>Steps to Blot</div>
        <div>{journeyPreview.stepsRange[0]}–{journeyPreview.stepsRange[1]}</div>
        <div>Projected Hunger</div>
        <div>+{journeyPreview.hungerIncreaseRange[0]}–{journeyPreview.hungerIncreaseRange[1]}</div>
        <div>Projected Fatigue</div>
        <div>+{journeyPreview.fatigueIncreaseRange[0]}–{journeyPreview.fatigueIncreaseRange[1]}</div>
        <div>Blot</div>
        <div>{prettyPoi(journeyPreview.poi.id).name} ({journeyPreview.poi.quality})</div>
        <div>Chomper (auto)</div>
        <div>{formatConsumedRange(journeyPreview.estFoodConsumed)}</div>
        <div>Surfaced Events</div>
        <div>
          {journeyPreview.surfacedEvents.length ? (
            <ul>
              {journeyPreview.surfacedEvents.map((e) => {
                const ev = prettyEvent(e);
                return <li key={e}><b>{ev.name}</b>: <span className="small">{ev.text}</span></li>;
              })}
            </ul>
          ) : (
            <span className="small">None.</span>
          )}
        </div>
      </div>

      <div className="row">
        <button className="btn" onClick={proceedJourney} disabled={dead || exhausted}>Proceed</button>
        <button className="btn" onClick={openInventory}>Adjust Equipment</button>
        <button className="btn" onClick={gotoHub}>Stay put</button>
      </div>
    </div>
  );

  const journeySummaryScreen = journeyResult && (
    <div className="card">
      <h2>What happened out there</h2>
      <div className="kv" style={{marginBottom:12}}>
        <div>Blundered into</div>
        <div><b>{prettyPoi(journeyResult.poi.id).name}</b> — {journeyResult.poi.quality} Blot, {journeyResult.steps} steps away</div>
        <div>Hunger cost</div>
        <div>+{journeyResult.hungerDelta}</div>
        <div>Fatigue cost</div>
        <div>+{Math.max(0, journeyResult.fatigueDelta)}</div>
      </div>

      {!!journeyResult.surfacedEvents.length && (
        <div className="card">
          <h3>Events</h3>
          <ul>
            {journeyResult.surfacedEvents.map((e) => {
              const ev = prettyEvent(e);
              return <li key={e}><b>{ev.name}</b>: <span className="small">{ev.text}</span></li>;
            })}
          </ul>
        </div>
      )}

      {journeyResult.softSapEaten && (
        <div className="card">
          <h3>Ate Something</h3>
          <p className="small">
            You inhale the soft sap before it has time to reconsider.{" "}
            <b>−{journeyResult.softSapEaten.hungerRestored} hunger.</b>{" "}
            Warm, gloopy, and entirely worth it.
          </p>
        </div>
      )}

      {journeyResult.foodConsumed.length > 0 && (
        <div className="card">
          <h3>Chomper Snacked</h3>
          <p className="small">{formatConsumed(journeyResult.foodConsumed)}</p>
        </div>
      )}

      {journeyResult.gained.filter(g => !(g.id as string).startsWith("food_soft_sap")).length > 0 && (
        <div className="card">
          <h3>Gathered</h3>
          <ul>
            {journeyResult.gained.filter(g => (g.id as string) !== "food_soft_sap").map((g, i) => (
              <li key={i} className="small">
                {(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : (g.id as string).startsWith("eq_") ? getItemName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}
                {g.freshness?.length ? ` (freshness: ${g.freshness.join(", ")})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="row">
        {POIS[journeyResult.poi.id].kind === "harvest" && (
          <button className="btn" onClick={enterPoi} disabled={journeyResult.outcome !== "ok"}>Check it out</button>
        )}
        <button className="btn" onClick={gotoHub}>Head back</button>
      </div>

      {journeyResult.outcome !== "ok" && (
        <div className="notice">
          <b>Outcome:</b> {journeyResult.outcome.toUpperCase()}
          <div className="small">
            {journeyResult.outcome === "exhausted" ? "Your tails have given up. Time to belly down." : "Hunger won. Reset to try again."}
          </div>
        </div>
      )}
    </div>
  );

  const poiScreen = activePoi && activeBlot && (
    <div className="card">
      <h2>You found a Blot</h2>
      <h3>{prettyPoi(activePoi.id).name} — {activePoi.quality}</h3>
      <p className="small">{prettyPoi(activePoi.id).flavor}</p>

      {POIS[activePoi.id].kind === "harvest" ? (
        <>
          <div className="card">
            {(() => {
              const charges = activeBlot.harvestCharges ?? 0;
              const max = activeBlot.maxHarvestCharges ?? 1;
              const ratio = charges / max;
              const depletionFlavour = charges === 0
                ? "The ground has given everything it had. There’s nothing left to take."
                : ratio <= 0.25
                ? "The blot looks thin. Whatever was here is nearly gone."
                : ratio <= 0.6
                ? "You’ve made a dent. Still something left, but it won’t last."
                : "The blot looks untouched. Rich, heavy, ready to give.";
              const methods = methodsAvailableFromEquipment(player);
              const tools = methods.map(m => Object.values(ITEMS).find(it => it.harvestingMethod === m)).filter(Boolean);
              const recMethod = recommendedMethod(activePoi.id);
              const recTool = recMethod ? Object.values(ITEMS).find(it => it.harvestingMethod === recMethod) : null;
              return (
                <>
                  <p className="small" style={{marginBottom:8}}><i>{depletionFlavour}</i></p>
                  {charges > 0 ? (
                    <>
                      <p className="small">Best tool here: <b>{recTool ? recTool.name : "—"}</b></p>
                      {tools.length > 0 ? (
                        <>
                          <p className="small" style={{marginBottom:4}}>
                            You’ve got:{" "}
                            {tools.map((t, i) => (
                              <span key={t!.id}><b>{t!.name}</b>{i < tools.length - 1 ? " + " : ""}</span>
                            ))}
                          </p>
                          <p className="small" style={{marginBottom:8, opacity:0.7}}>
                            {tools.length === 2
                              ? "Both tools will take a swing. Two harvests, one blot."
                              : "One tool, one pass."}
                          </p>
                          <button className="btn" style={{fontSize:"1.1rem"}} onClick={doMultiHarvest} disabled={dead || exhausted}>
                            Dig in!
                          </button>
                        </>
                      ) : (
                        <p className="small">No harvesting tools equipped. Open Inventory to equip one.</p>
                      )}
                    </>
                  ) : null}
                </>
              );
            })()}
          </div>
        </>
      ) : (
        <div className="card">
          <h3>Food Blot</h3>
          <p className="small">The ground here smells edible. Suspicious, but promising.</p>

          {/* Soft Sap section */}
          <div style={{marginBottom:12}}>
            <p className="small"><b>Soft Sap</b> — {(() => {
              const r = activeBlot.sapRemaining ?? 0;
              const max = journeyResult?.blot.sapRemaining ?? r;
              return r === 0 ? "all gone" : r <= 1 ? "last drop" : r <= 2 ? "a little left" : "plenty here";
            })()}</p>
            {activeBlot.sapRemaining !== undefined && activeBlot.sapRemaining > 0 ? (
              hasEquippedTail(player, "eq_chomper") ? (
                <div>
                  <button className="btn" onClick={doEatSap} disabled={dead || exhausted}>
                    SCOFF IT
                  </button>
                  {lastEatResult && (
                    <p className="small" style={{marginTop:6}}>
                      You inhale {lastEatResult.unitsEaten} unit{lastEatResult.unitsEaten !== 1 ? "s" : ""} of sap before it has time to reconsider.{" "}
                      <b>−{lastEatResult.hungerRestored} hunger</b> • <b>+{lastEatResult.fatigueCost} fatigue</b>.
                      {lastEatResult.hungerRestored === 0 ? " (You weren’t hungry enough to benefit.)" : " Warm. Gloopy. Worth it."}
                    </p>
                  )}
                </div>
              ) : (
                <p className="small">No Chomper equipped — the sap just sits there, judging you.</p>
              )
            ) : (
              <p className="small">All the sap is gone. You ate it all. No regrets.</p>
            )}
          </div>

          {/* Storable food section */}
          {activeBlot.storableFood && (
            <div>
              <p className="small"><b>{FOODS[activeBlot.storableFood].name}</b> — {(() => {
                const r = activeBlot.storableRemaining ?? 0;
                return r === 0 ? "all gathered" : r === 1 ? "one unit left" : r <= 2 ? "a few left" : "a good stash";
              })()}</p>
              {activeBlot.storableRemaining !== undefined && activeBlot.storableRemaining > 0 ? (
                hasEquippedTail(player, "eq_sticky_scoop") ? (
                  <div>
                    <p className="small" style={{opacity:0.7,marginBottom:4}}>
                      Costs {POIS[activePoi.id].foodSpec?.forageHungerPerPeriod ?? 1} hunger + {POIS[activePoi.id].foodSpec?.forageFatiguePerPeriod ?? 1} fatigue per unit.
                    </p>
                    <button className="btn" onClick={doHarvestStorable} disabled={dead || exhausted}>
                      Scoop it up
                    </button>
                    {lastStorableResult && (
                      <p className="small" style={{marginTop:6}}>
                        Scooped 1 {FOODS[lastStorableResult.foodId].name}. Costs <b>+{lastStorableResult.hungerCost} hunger</b> • <b>+{lastStorableResult.fatigueCost} fatigue</b>.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="small">No Sticky Scoop — the {FOODS[activeBlot.storableFood].name} sits just out of reach.</p>
                )
              ) : (
                <p className="small">All {FOODS[activeBlot.storableFood].name} has been gathered.</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="row">
        <button className="btn" onClick={openInventory}>Adjust Equipment</button>
        <button className="btn" onClick={gotoHub}>Move on</button>
      </div>
    </div>
  );

  const harvestPreviewScreen = harvestPreview && (
    <div className="card">
      <h2>Dig in — what it might cost</h2>
      <div className="kv">
        <div>Method</div>
        <div>
          {(() => {
            const tool = Object.values(ITEMS).find((it) => it.harvestingMethod === harvestPreview.method);
            const flavour: Record<string, string> = {
              best: "This tool was made for this. Clean, fast, satisfying.",
              good: "A solid approach. Not perfect, but it gets the job done.",
              ok: "Workable. You\'ll get something out of it.",
              weak: "This tool isn\'t really suited here. Progress will be slow.",
              veryWeak: "A bad match. You\'ll be here a while for very little.",
              wasteful: "Wrong tool entirely. Half of what you gather just falls away.",
            };
            return (
              <span>
                {tool ? tool.name : harvestPreview.method}{" "}
                <span className="small" style={{opacity:0.7}}>— {flavour[harvestPreview.efficiencyLabel] ?? ""}</span>
              </span>
            );
          })()}
        </div>
        <div>Projected Time (periods)</div>
        <div>{harvestPreview.periodsRange[0]}–{harvestPreview.periodsRange[1]}</div>
        <div>Projected Hunger</div>
        <div>+{harvestPreview.hungerIncreaseRange[0]}–{harvestPreview.hungerIncreaseRange[1]}</div>
        <div>Projected Fatigue</div>
        <div>+{harvestPreview.fatigueIncreaseRange[0]}–{harvestPreview.fatigueIncreaseRange[1]}</div>
        <div>Projected Yield</div>
        <div>{getResourceName(POIS[harvestPreview.poiId].resourceId as any)} ×{harvestPreview.yieldRange[0]}–{harvestPreview.yieldRange[1]}</div>
        <div>Chomper (auto)</div>
        <div>{formatConsumedRange(harvestPreview.estFoodConsumed)}</div>
      </div>
      <div className="row">
        <button className="btn" onClick={proceedHarvest} disabled={dead || exhausted}>Proceed</button>
        <button className="btn" onClick={openInventory}>Adjust Equipment</button>
        <button className="btn" onClick={() => setScreen("POI")}>Leave it</button>
      </div>
    </div>
  );

  const harvestSummaryScreen = multiHarvestResults.length > 0 && (
    <div className="card">
      <h2>Haul report</h2>
      <p className="small">
        {multiHarvestResults.length === 2 ? "Both tools took a swing." : "One pass done."}{" "}
        Total: {multiHarvestResults.reduce((s, r) => s + r.periods, 0)} periods.
      </p>

      {multiHarvestResults.map((res, i) => {
        const tool = Object.values(ITEMS).find(it => it.harvestingMethod === res.method);
        const flavour: Record<string, string> = {
          best: "Clean and efficient.",
          good: "Solid work.",
          ok: "Got something out of it.",
          weak: "Slow going, but you persisted.",
          veryWeak: "That hurt more than it helped.",
          wasteful: "Half of it crumbled away.",
        };
        return (
          <div className="card" key={i}>
            <h3>{tool ? tool.name : res.method} pass</h3>
            <p className="small">{flavour[harvestPreview?.efficiencyLabel ?? "ok"] ?? ""}</p>
            <ul>
              {res.gained.map((g, j) => (
                <li key={j} className="small">
                  {(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}
                </li>
              ))}
            </ul>
            <p className="small">→ +{res.hungerDelta} hunger · +{Math.max(0, res.fatigueDelta)} fatigue · +{res.xpGained} XP</p>
            {res.foodConsumed.length > 0 && (
              <p className="small">Chomper snacked: {formatConsumed(res.foodConsumed)}</p>
            )}
          </div>
        );
      })}

      <div className="row">
        <button className="btn" onClick={() => { setMultiHarvestResults([]); setScreen("POI"); }}>Stay at Blot</button>
        <button className="btn" onClick={gotoHub}>Head back</button>
      </div>

      {multiHarvestResults[multiHarvestResults.length - 1]?.outcome !== "ok" && (
        <div className="notice">
          <b>Outcome:</b> {multiHarvestResults[multiHarvestResults.length - 1]?.outcome.toUpperCase()}
          <div className="small">
            {multiHarvestResults[multiHarvestResults.length - 1]?.outcome === "exhausted"
              ? "Your tails have given up. Time to belly down."
              : "Hunger won. Reset to try again."}
          </div>
        </div>
      )}
    </div>
  );

  const craftMenuScreen = (
    <div className="card">
      <h2>Craft</h2>
      <p className="small">
        Some recipes just need patience — others need the <b>{ITEMS.eq_tinker_shaft.name}</b> equipped.
        Either way, crafting eats time and hunger, so don’t get greedy.
      </p>

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
          {!unlockedRecipes.length && <tr><td colSpan={4} className="small">Nothing to make right now. Try equipping the Tinker Shaft.</td></tr>}
        </tbody>
      </table>

      <div className="row">
        <button className="btn" onClick={gotoHub}>Put it down</button>
      </div>
    </div>
  );

  const craftPreviewScreen = craftPreview && (
    <div className="card">
      <h2>Craft — Projected Cost Preview</h2>
      <div className="kv">
        <div>Recipe</div>
        <div>{prettyRecipe(craftPreview.recipeId).name}</div>
        <div>Time (periods)</div>
        <div>{craftPreview.craftPeriods}</div>
        <div>Projected Hunger</div>
        <div>+{craftPreview.hungerIncrease}</div>
        <div>Projected Fatigue</div>
        <div>+{craftPreview.fatigueIncrease}</div>
        <div>Chomper (auto)</div>
        <div>{formatConsumedRange(craftPreview.estFoodConsumed)}</div>
      </div>

      <div className="row">
        <button className="btn" onClick={proceedCraft} disabled={dead || exhausted}>Proceed</button>
        <button className="btn" onClick={openInventory}>Adjust Equipment</button>
        <button className="btn" onClick={() => setScreen("CRAFT_MENU")}>Put it down</button>
      </div>
    </div>
  );

  const craftSummaryScreen = craftResult && (
    <div className="card">
      <h2>Craft Summary</h2>

      <div className="card">
        <h3>Result</h3>
        {craftResult.success ? (
          <p className="small">Crafted: <b>{getItemName(craftResult.crafted!.itemId)}</b> ×{craftResult.crafted!.qty}</p>
        ) : (
          <p className="small">Failed: <b>{craftResult.failReason}</b></p>
        )}
      </div>

      <div className="card">
        <h3>Chomper Consumption</h3>
        <p className="small">{formatConsumed(craftResult.foodConsumed)}</p>
      </div>

      <div className="row">
        <button className="btn" onClick={() => setScreen("CRAFT_MENU")}>Keep tinkering</button>
        <button className="btn" onClick={gotoHub}>Head back</button>
      </div>

      {!craftResult.success && craftResult.failReason === "missing_resources" && (
        <div className="notice">
          Not enough stuff. Go get more.
        </div>
      )}
      {!craftResult.success && (craftResult.failReason === "exhausted" || craftResult.failReason === "dead") && (
        <div className="notice">
          Outcome: {craftResult.failReason?.toUpperCase()}
        </div>
      )}
    </div>
  );

  const recoverPreviewScreen = (
    <div className="card">
      <h2>Belly Down — Projected Cost Preview</h2>
      <p className="small">
        You flop down and let the ground do the work. It makes you hungrier (lying around is surprisingly taxing)
        but a Tail Curler will slowly unwind the fatigue. The exact amount is a mystery — your body will figure it out.
      </p>
      {(() => {
        const pv = recoverPreview(player);
        return (
          <div className="kv">
            <div>Time (periods)</div>
            <div>{pv.periods}</div>
            <div>Projected Hunger</div>
            <div>+{pv.hungerDeltaRange[0]}</div>
            <div>Projected Fatigue Change</div>
            <div className="small">{player.equipment.tailSlots.includes("eq_tail_curler") ? "Should decrease (the curling is doing something)" : "Tail Curler not equipped — you’ll just get hungrier for nothing"}</div>
            <div>Chomper (auto)</div>
            <div>{formatConsumedRange(pv.estFoodConsumed)}</div>
          </div>
        );
      })()}
      <div className="row">
        <button className="btn" onClick={proceedRecover} disabled={dead}>Flop down</button>
        <button className="btn" onClick={openInventory}>Inventory</button>
        <button className="btn" onClick={gotoHub}>Get up</button>
      </div>
    </div>
  );

  const recoverSummaryScreen = recoverSummary && (
    <div className="card">
      <h2>Back on your feet (sort of)</h2>
      <p className="small">You spent {recoverSummary.periods} periods horizontal. Worth it? Probably.</p>
      <div className="card">
        <h3>Chomper Consumption</h3>
        <p className="small">{formatConsumed(recoverSummary.foodConsumed)}</p>
      </div>
      <div className="row">
        <button className="btn" onClick={gotoHub}>Get up</button>
      </div>
      {recoverSummary.outcome !== "ok" && (
        <div className="notice">
          Outcome: {recoverSummary.outcome.toUpperCase()}
        </div>
      )}
    </div>
  );

  let body: React.ReactNode = null;
  if (dead) body = deadScreen;
  else if (
    exhausted &&
    ![
      "SUMMARY_JOURNEY",
      "SUMMARY_HARVEST",
      "SUMMARY_CRAFT",
      "SUMMARY_RECOVER",
      "PREVIEW_RECOVER",
    ].includes(screen)
  ) body = exhaustedScreen;

  if (!body) {
    switch (screen) {
      case "HUB": body = hub; break;
      case "EXHAUSTED": body = exhaustedScreen; break;
      case "DEAD": body = deadScreen; break;
      case "PREVIEW_JOURNEY": body = journeyPreviewScreen; break;
      case "SUMMARY_JOURNEY": body = journeySummaryScreen; break;
      case "POI": body = poiScreen; break;
      case "CHOOSE_METHOD": body = poiScreen; break;
      case "PREVIEW_HARVEST": body = harvestPreviewScreen; break;
      case "SUMMARY_HARVEST": body = harvestSummaryScreen; break;
      case "CRAFT_MENU": body = craftMenuScreen; break;
      case "PREVIEW_CRAFT": body = craftPreviewScreen; break;
      case "SUMMARY_CRAFT": body = craftSummaryScreen; break;
      case "PREVIEW_RECOVER": body = recoverPreviewScreen; break;
      case "SUMMARY_RECOVER": body = recoverSummaryScreen; break;
      default: body = hub;
    }
  }

  return (
    <div className="app">
      <div className="main">
        <h1 style={{letterSpacing:"0.08em"}}>2 Tails 3 Feet</h1>
        <div style={{opacity:0.7,fontSize:14,marginBottom:10}}>Sticky Survival Prototype</div>
        {hud}
        {body}
        <div className="card">
          <h3>How it works</h3>
          <ul className="small">
            <li>Biome: Sticky (L1). Everything clings. You persist.</li>
            <li>3 resources: Resin Glob, Fiber Clump, Brittle Stone.</li>
            <li>5 harvesting methods, each with its own skill level — check the Inventory screen.</li>
            <li>3 foods: Soft Sap (eat on the spot), Resin Chew + Dense Ration (storable, but they rot).</li>
            <li>Chomper must be equipped to eat food you find — and it snacks on your stores during actions.</li>
            <li>Tail Curler must be equipped to recover fatigue when you belly down.</li>
            <li>Tier 1 recipes need no special tool. Tier 2 + utility recipes need the Tinker Shaft equipped.</li>
          </ul>
        </div>
      {inventoryOpen && (
        <div className="modal-overlay" onClick={closeInventory}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {inventoryScreen}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
