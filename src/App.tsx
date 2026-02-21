import React, { useMemo, useState } from "react";
import type { CraftPreview, CraftResult, HarvestMethodId, HarvestPreview, HarvestResult, JourneyPreview, JourneyResult, PlayerState, PoiId, Screen } from "./types";
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
    maxFatigue: 60,
  },
  equipment: {
    tailSlots: [null, null],
    shoe: "eq_standard_shoe",
  },
  inventory: [
    { id: "eq_tinker_shaft", qty: 1 },
    { id: "eq_tail_curler", qty: 1 },
    { id: "eq_chomper", qty: 1 },
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

  const [harvestPreview, setHarvestPreview] = useState<HarvestPreview | null>(null);
  const [harvestResult, setHarvestResult] = useState<HarvestResult | null>(null);

  const [craftPreview, setCraftPreview] = useState<CraftPreview | null>(null);
  const [craftResult, setCraftResult] = useState<CraftResult | null>(null);

  const [recoverState, setRecoverState] = useState<{ periods: number } | null>(null);
  const [recoverSummary, setRecoverSummary] = useState<any>(null);

  const exhausted = player.stats.fatigue >= player.stats.maxFatigue;
  const dead = player.stats.hunger >= player.stats.maxHunger;

  const unlockedRecipes = useMemo(() => listUnlockedRecipes(player), [player]);

  function reset() {
    setPlayer(structuredClone(START_PLAYER));
    setScreen("HUB");
    setJourneyPreview(null);
    setJourneyResult(null);
    setActivePoi(null);
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
    setScreen("INVENTORY");
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
    setScreen("POI");
  }

  function chooseMethod(method: HarvestMethodId) {
    if (!activePoi) return;
    const pv = makeHarvestPreview(player, activePoi.id, method);
    setHarvestPreview(pv);
    setHarvestResult(null);
    setScreen("PREVIEW_HARVEST");
  }

  function proceedHarvest() {
    if (!harvestPreview) return;
    const next = structuredClone(player);
    const res = resolveHarvest(next, harvestPreview);
    setPlayer(next);
    setHarvestResult(res);
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

  function availableTailToolIds(): import("./types").ItemId[] {
    // list items in inventory that are tail tools, excluding passive tools
    const ids = player.inventory
      .filter((st): st is { id: import("./types").ItemId; qty: number } => typeof st.id === "string" && (st.id as string).startsWith("eq_") && st.qty > 0)
      .map((st) => st.id)
      .filter((id) => canEquipItem(id));
    return Array.from(new Set(ids));
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

  const sidebar = (
    <div className="sidebar">
      <button className="hotbtn" onClick={openInventory}>Inventory</button>
      <button className="hotbtn" onClick={gotoHub}>Hub</button>
    </div>
  );

  const hub = (
    <div className="card">
      <h2>Hub</h2>
      <p className="small">
        All actions resolve instantly. Equip tools in your tail slots to unlock abilities —
        use <span className="mono">Chomper</span> to eat food you find, and <span className="mono">Tail Curler</span> to recover fatigue faster.
      </p>
      <div className="row">
        <button className="btn" onClick={() => genJourney("explore")} disabled={dead || exhausted}>Explore</button>
        <button className="btn" onClick={() => genJourney("findFood")} disabled={dead || exhausted}>Find Food</button>
        <button className="btn" onClick={openCraft} disabled={dead || exhausted}>Craft</button>
        <button className="btn" onClick={previewRecover} disabled={dead}>Recover</button>
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
      <h2>Exhausted</h2>
      <p>You’ve hit max fatigue. No actions except recovery.</p>
      <div className="row">
        <button className="btn" onClick={previewRecover} disabled={dead}>Recover</button>
        <button className="btn" onClick={openInventory}>Inventory</button>
      </div>
    </div>
  );

  const deadScreen = (
    <div className="card">
      <h2>Dead</h2>
      <p>Your hunger reached the limit. Reset to try again.</p>
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
                {availableTailToolIds().map((id) => (
                  <option key={id} value={id}>{getItemName(id)}</option>
                ))}
              </select>
            </div>
            <div>Tail B</div>
            <div>
              <select value={player.equipment.tailSlots[1] ?? ""} onChange={(e) => equipTail(1, (e.target.value || null) as any)}>
                <option value="">— Empty —</option>
                {availableTailToolIds().map((id) => (
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

      <div className="row">
        <button className="btn" onClick={gotoHub}>Back</button>
      </div>
    </div>
  );

  const journeyPreviewScreen = journeyPreview && (
    <div className="card">
      <h2>{journeyPreview.mode === "explore" ? "Explore" : "Find Food"} — Projected Cost Preview</h2>
      <div className="kv">
        <div>Steps to PoI</div>
        <div>{journeyPreview.stepsRange[0]}–{journeyPreview.stepsRange[1]}</div>
        <div>Projected Hunger</div>
        <div>+{journeyPreview.hungerIncreaseRange[0]}–{journeyPreview.hungerIncreaseRange[1]}</div>
        <div>Projected Fatigue</div>
        <div>+{journeyPreview.fatigueIncreaseRange[0]}–{journeyPreview.fatigueIncreaseRange[1]}</div>
        <div>PoI</div>
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
        <button className="btn" onClick={gotoHub}>Ignore</button>
      </div>
    </div>
  );

  const journeySummaryScreen = journeyResult && (
    <div className="card">
      <h2>Journey Summary</h2>
      <p className="small">
        You travel {journeyResult.steps} steps and reach: <b>{prettyPoi(journeyResult.poi.id).name}</b> ({journeyResult.poi.quality})
      </p>

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

      <div className="card">
        <h3>Chomper Consumption</h3>
        <p className="small">{formatConsumed(journeyResult.foodConsumed)}</p>
      </div>

      {journeyResult.gained.length > 0 && (
        <div className="card">
          <h3>Gained</h3>
          <ul>
            {journeyResult.gained.map((g, i) => (
              <li key={i} className="small">
                {(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : (g.id as string).startsWith("eq_") ? getItemName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}
                {g.freshness?.length ? ` (freshness: ${g.freshness.join(", ")})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="row">
        <button className="btn" onClick={enterPoi} disabled={journeyResult.outcome !== "ok"}>Enter PoI</button>
        <button className="btn" onClick={gotoHub}>Back to Hub</button>
      </div>

      {journeyResult.outcome !== "ok" && (
        <div className="notice">
          <b>Outcome:</b> {journeyResult.outcome.toUpperCase()}
          <div className="small">
            {journeyResult.outcome === "exhausted" ? "You can only recover now." : "Reset to try again."}
          </div>
        </div>
      )}
    </div>
  );

  const poiScreen = activePoi && (
    <div className="card">
      <h2>Point of Interest</h2>
      <h3>{prettyPoi(activePoi.id).name} ({activePoi.quality})</h3>
      <p className="small">{prettyPoi(activePoi.id).flavor}</p>

      {POIS[activePoi.id].kind === "harvest" ? (
        <>
          <div className="card">
            <h3>Harvest</h3>
            <p className="small">
              Recommended (no numbers):{" "}
              {(() => {
                const rec = recommendedMethod(activePoi.id);
                if (!rec) return "—";
                const tool = Object.values(ITEMS).find((it) => it.harvestingMethod === rec);
                return tool ? tool.name : rec;
              })()}
            </p>

            <p className="small">Available methods depend on your equipped tail tools.</p>
            <div className="row">
              {methodsAvailableFromEquipment(player).length ? (
                methodsAvailableFromEquipment(player).map((m) => {
                  const tool = Object.values(ITEMS).find((it) => it.harvestingMethod === m);
                  return (
                    <button key={m} className="btn" onClick={() => chooseMethod(m)}>
                      {tool ? tool.name : m}
                    </button>
                  );
                })
              ) : (
                <span className="small">No harvesting tools equipped. Open Inventory to equip one.</span>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <h3>Food</h3>
          <p className="small">
            You already foraged this food source during travel. (In later versions, you can interact again here.)
          </p>
        </div>
      )}

      <div className="row">
        <button className="btn" onClick={openInventory}>Adjust Equipment</button>
        <button className="btn" onClick={gotoHub}>Back</button>
      </div>
    </div>
  );

  const harvestPreviewScreen = harvestPreview && (
    <div className="card">
      <h2>Harvest — Projected Cost Preview</h2>
      <div className="kv">
        <div>Method</div>
        <div>{harvestPreview.method.toUpperCase()}</div>
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
        <button className="btn" onClick={() => setScreen("POI")}>Ignore</button>
      </div>
    </div>
  );

  const harvestSummaryScreen = harvestResult && (
    <div className="card">
      <h2>Harvest Summary</h2>
      <p className="small">Time: {harvestResult.periods} periods · XP gained: +{harvestResult.xpGained} ({harvestResult.method.toUpperCase()})</p>

      <div className="card">
        <h3>Gained</h3>
        <ul>
          {harvestResult.gained.map((g, i) => (
            <li key={i} className="small">
              {(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}
              {g.freshness?.length ? ` (freshness: ${g.freshness.join(", ")})` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>Chomper Consumption</h3>
        <p className="small">{formatConsumed(harvestResult.foodConsumed)}</p>
      </div>

      <div className="row">
        <button className="btn" onClick={gotoHub}>Back to Hub</button>
        <button className="btn" onClick={() => setScreen("POI")}>Back to PoI</button>
      </div>

      {harvestResult.outcome !== "ok" && (
        <div className="notice">
          <b>Outcome:</b> {harvestResult.outcome.toUpperCase()}
          <div className="small">
            {harvestResult.outcome === "exhausted" ? "You can only recover now." : "Reset to try again."}
          </div>
        </div>
      )}
    </div>
  );

  const craftMenuScreen = (
    <div className="card">
      <h2>Craft</h2>
      <p className="small">
        You can craft if you have <b>{ITEMS.eq_tinker_shaft.name}</b> equipped in a tail slot. Crafting consumes time instantly and can kill you if hunger hits max.
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
          {!unlockedRecipes.length && <tr><td colSpan={4} className="small">No recipes unlocked.</td></tr>}
        </tbody>
      </table>

      <div className="row">
        <button className="btn" onClick={gotoHub}>Back</button>
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
        <button className="btn" onClick={() => setScreen("CRAFT_MENU")}>Ignore</button>
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
        <button className="btn" onClick={() => setScreen("CRAFT_MENU")}>Back to Craft</button>
        <button className="btn" onClick={gotoHub}>Back to Hub</button>
      </div>

      {!craftResult.success && craftResult.failReason === "missing_resources" && (
        <div className="notice">
          Missing resources. Go harvest more.
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
      <h2>Recover — Projected Cost Preview</h2>
      <p className="small">
        Recovery resolves instantly. Equip Tail Curler to recover fatigue — its exact amount is hidden, but your body will show the truth.
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
            <div className="small">{player.equipment.tailSlots.includes("eq_tail_curler") ? "Should decrease (exact amount hidden)" : "Tail Curler not equipped — fatigue will not recover"}</div>
            <div>Chomper (auto)</div>
            <div>{formatConsumedRange(pv.estFoodConsumed)}</div>
          </div>
        );
      })()}
      <div className="row">
        <button className="btn" onClick={proceedRecover} disabled={dead}>Proceed</button>
        <button className="btn" onClick={openInventory}>Inventory</button>
        <button className="btn" onClick={gotoHub}>Back</button>
      </div>
    </div>
  );

  const recoverSummaryScreen = recoverSummary && (
    <div className="card">
      <h2>Recovery Summary</h2>
      <p className="small">Time: {recoverSummary.periods} periods</p>
      <div className="card">
        <h3>Chomper Consumption</h3>
        <p className="small">{formatConsumed(recoverSummary.foodConsumed)}</p>
      </div>
      <div className="row">
        <button className="btn" onClick={gotoHub}>Back to Hub</button>
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
      "INVENTORY",
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
      case "INVENTORY": body = inventoryScreen; break;
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
      {sidebar}
      <div className="main">
        <h1 style={{letterSpacing:"0.08em"}}>2 Tails 3 Feet</h1>
        <div style={{opacity:0.7,fontSize:14,marginBottom:10}}>Sticky Survival Prototype</div>
        {hud}
        {body}
        <div className="card">
          <h3>MVP Notes</h3>
          <ul className="small">
            <li>1 biome, level 1: Sticky.</li>
            <li>3 resources: Resin, Fiber, Stone.</li>
            <li>5 harvesting methods/tools: Poke, Smash, Tease, Drill, Scoop.</li>
            <li>3 foods: Soft Sap (instant), Resin Chew (storable), Dense Ration (storable).</li>
            <li>Chomper (must be equipped) auto-consumes storable food as time passes, and is required to eat non-storable food found on journeys. Storable food also rots as time passes.</li>
            <li>Events show flavor text (not IDs). PoIs show a “recommended” method hint without numbers.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
