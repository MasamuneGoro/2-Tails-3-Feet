import React, { useEffect, useMemo, useState } from "react";
import type { BlotMarkCategory, BlotMarkId, BlotMarkState, BlotState, CraftPreview, CraftResult, EatSapResult, HarvestMethodId, HarvestPreview, HarvestResult, HarvestStorableResult, JourneyPreview, JourneyResult, PlayerState, PoiId, Screen, GemTrophyItemId, TrophyItemId, MarkerItemId } from "./types";
import { playSfx, unlockAudio, preloadAll } from "./sound";
import { startBattle, getAvailableMoves, executeMove, resolveBattle } from "./combat";
import type { BattleState, BattleResult, CreatureId } from "./types";
import { CreatureIcon, ItemIcon, PoiImage, PoiIcon } from "./visuals";
import { BIOME_LEVEL, CREATURES, EVENTS, FOODS, ITEMS, MOVES, POIS, RECIPES, RESOURCES, SITUATION_TEXT, getSituationText, MARKERS, TROPHIES, GEM_TROPHIES, BIOMASS_ITEM, CATEGORY_MARKER, CATEGORY_TROPHY, TROPHY_TO_GEM, CATEGORY_GATE_MARK, GEM_TROPHY_RECIPES, GATE_REQUIRED_GEM_TROPHIES, BIOMASS_VALUES } from "./gameData";
import {
  canCraft, getFoodName, getItemName, getResourceName, listUnlockedRecipes,
  makeCraftPreview, makeHarvestPreview, makeJourneyPreview, methodsAvailableFromEquipment,
  prettyEvent, prettyPoi, prettyRecipe,
  resolveCraft, resolveHarvest, resolveJourney, recoverPreview, resolveRecover,
  invAdd, invGet, invRemove, clamp,
  skillLevel, skillXpToNextLevel, skillXpForLevel, SKILL_MAX_LEVEL, SKILL_XP_PER_LEVEL,
  generateBlot, eatSapAtBlot, harvestStorableAtBlot, hasEquippedTail, countEquippedTail,
} from "./engine";

function pct(n: number, d: number) { return Math.round((n / d) * 100); }

// ─── Blot Marks ──────────────────────────────────────────────────────────────

import type { BlotMark } from "./types";

const BLOT_MARKS: Record<BlotMarkId, BlotMark> = {
  mark_first_journey:      { id: "mark_first_journey",      category: "Exploration", title: "First Steps Out",          flavour: "You went out and came back. That's how it starts." },
  mark_first_find_food:    { id: "mark_first_find_food",    category: "Exploration", title: "Belly Before Pride",       flavour: "You went looking for something edible. Smart." },
  mark_visit_all_poi:      { id: "mark_visit_all_poi",      category: "Exploration", title: "Full Survey",              flavour: "Every corner of the resin field, mapped in your head." },
  mark_first_harvest:      { id: "mark_first_harvest",      category: "Harvesting",  title: "First Poke",               flavour: "You touched the world and it gave something back." },
  mark_all_methods:        { id: "mark_all_methods",        category: "Harvesting",  title: "Five Ways In",             flavour: "Every surface gives eventually, if you know how to ask." },
  mark_harvest_proficiency:{ id: "mark_harvest_proficiency",category: "Harvesting",  title: "Getting Good at This",     flavour: "The motion is starting to feel like yours." },
  mark_all_proficiency:    { id: "mark_all_proficiency",    category: "Harvesting",  title: "Nothing Stumps You",       flavour: "You've stopped guessing." },
  mark_first_craft:        { id: "mark_first_craft",        category: "Crafting",    title: "Tinkered",                 flavour: "You made something. It probably works." },
  mark_craft_all_tools:    { id: "mark_craft_all_tools",    category: "Crafting",    title: "Full Kit",                 flavour: "You don't need to improvise anymore." },
  mark_craft_equipment:    { id: "mark_craft_equipment",    category: "Crafting",    title: "Quality of Life",          flavour: "You stopped just surviving and started planning." },
  mark_first_recover:      { id: "mark_first_recover",      category: "Survival",    title: "Knew Your Limits",         flavour: "Resting isn't giving up." },
  mark_low_satiety_survive:{ id: "mark_low_satiety_survive",category: "Survival",    title: "Running on Nothing",       flavour: "You were close. You didn't need to be, but here you are." },
  mark_eat_on_site:        { id: "mark_eat_on_site",        category: "Survival",    title: "Straight from the Source", flavour: "Why carry it when you can just eat it there?" },
  mark_first_encounter:    { id: "mark_first_encounter",    category: "Combat",      title: "Something Out There",      flavour: "You spotted it before it spotted you. Maybe." },
  mark_first_hunt:         { id: "mark_first_hunt",         category: "Combat",      title: "Didn't Run",               flavour: "You could have walked away. You didn't." },
  mark_first_win:          { id: "mark_first_win",          category: "Combat",      title: "It Went Down",             flavour: "You stood your ground and it worked." },
  mark_use_combo:          { id: "mark_use_combo",          category: "Combat",      title: "Double-Handed",            flavour: "Two tools, one move. That takes practice." },
  mark_novelty_2:          { id: "mark_novelty_2",          category: "Combat",      title: "Kept It Interesting",      flavour: "You surprised the moth. A little." },
  mark_novelty_4:          { id: "mark_novelty_4",          category: "Combat",      title: "Unpredictable",            flavour: "Even you didn't know what you'd do next." },
  mark_drill_resonance:    { id: "mark_drill_resonance",    category: "Combat",      title: "Resonance",                flavour: "The sound it made. You'll remember it." },
  mark_high_integrity_win: { id: "mark_high_integrity_win", category: "Combat",      title: "Careful Hands",            flavour: "You took what you needed without breaking everything else." },
  mark_avoid_moth:         { id: "mark_avoid_moth",         category: "Combat",      title: "Not Today",                flavour: "Wisdom, or just stamina math. Either way, smart." },
  mark_first_wing_membrane:{ id: "mark_first_wing_membrane",category: "Loot",        title: "Delicate Thing",           flavour: "Light. Strange. You're not sure what it's for yet." },
  mark_first_crystallised_wax:{ id: "mark_first_crystallised_wax", category: "Loot", title: "Something Crystallised",  flavour: "It's solid. Warm. You'll figure out what it does." },
  mark_full_corpse:        { id: "mark_full_corpse",        category: "Loot",        title: "Clean Harvest",            flavour: "Nothing wasted. Every part counted." },
};

const BLOT_MARK_HOW: Record<BlotMarkId, string> = {
  mark_first_journey:       "Complete any journey by pressing Explore or Find Food.",
  mark_first_find_food:     "Choose Find Food on a journey — it targets food locations directly.",
  mark_visit_all_poi:       "Visit all six location types: Resin Node, Resin Hollow, Sap Weep, Fiber Patch, Stone Node, and Dense Pocket.",
  mark_first_harvest:       "Arrive at a location and harvest using any available method.",
  mark_all_methods:         "Use all five harvest methods: Poke, Smash, Tease, Drill, and Scoop. Requires all five tools crafted and equipped.",
  mark_harvest_proficiency: "Reach level 3 in any single harvest method by repeating it.",
  mark_all_proficiency:     "Reach level 3 in all five harvest methods: Poke, Smash, Tease, Drill, and Scoop.",
  mark_first_craft:         "Craft any item using the Tinker Shaft.",
  mark_craft_all_tools:     "Craft all five harvesting tools: Pointed Twig, Crude Hammerhead, Fiber Comb, Hand Drill, and Sticky Scoop.",
  mark_craft_equipment:     "Craft a Chomper or a Tail Curler.",
  mark_first_recover:       "Use Lay Down to rest and recover stamina.",
  mark_low_satiety_survive: "Survive with your satiety at 120 or below.",
  mark_eat_on_site:         "Travel to a Sap Weep location and eat the soft sap directly on site.",
  mark_first_encounter:     "Encounter a Gloop Moth during a journey to a resin location. They appear at Resin Nodes, Resin Hollows, and Sap Weeps.",
  mark_first_hunt:          "When a creature appears at the end of a journey, choose to hunt it instead of avoiding it.",
  mark_first_win:           "Win a creature encounter by reducing the creature's composure to zero.",
  mark_use_combo:           "Execute a combo move using two tools at once in battle.",
  mark_novelty_2:           "Use 2 or 3 distinct moves in a single battle.",
  mark_novelty_4:           "Use 4 or more distinct moves, or land any combo, in a single battle.",
  mark_drill_resonance:     "Execute the Drill Resonance combo: first open the thorax with Drill alone, then use the Twig + Drill combo.",
  mark_high_integrity_win:  "Win a battle with the creature's integrity at 80 or above. Avoid Smash moves — they deal heavy integrity damage.",
  mark_avoid_moth:          "When a creature appears at the end of a journey, choose to avoid it.",
  mark_first_wing_membrane: "Obtain a Wing Membrane drop from a Gloop Moth. Win with high integrity, or use the Expose and Strike combo.",
  mark_first_crystallised_wax: "Obtain Crystallised Wax by executing the Drill Resonance combo mid-battle.",
  mark_full_corpse:         "Win a battle with the creature's integrity at 80–100 to get the best possible corpse drops.",
};

const BLOT_MARK_ORDER: BlotMarkId[] = [
  "mark_first_journey","mark_first_find_food","mark_visit_all_poi",
  "mark_first_harvest","mark_all_methods","mark_harvest_proficiency","mark_all_proficiency",
  "mark_first_craft","mark_craft_all_tools","mark_craft_equipment",
  "mark_first_recover","mark_low_satiety_survive","mark_eat_on_site",
  "mark_first_encounter","mark_first_hunt","mark_first_win","mark_use_combo",
  "mark_novelty_2","mark_novelty_4","mark_drill_resonance","mark_high_integrity_win","mark_avoid_moth",
  "mark_first_wing_membrane","mark_first_crystallised_wax","mark_full_corpse",
];

const HARVESTING_TOOLS: string[] = ["eq_pointed_twig","eq_crude_hammerhead","eq_fiber_comb","eq_hand_drill","eq_sticky_scoop"];

function makeInitialMarkState(): BlotMarkState {
  return {
    earned: {},
    revealed: {},
    poisVisited: new Set(),
    distinctMethodsUsed: new Set(),
    lowestSatietySeen: Infinity,
    hasSeenLowSatiety: false,
    toolsCrafted: new Set(),
    claimedMarkers: {},
    gateDiscovered: false,
    gateUnlocked: false,
    gateSlottedTrophies: [],
  };
}

/** Returns which marks should now be revealed given current tracking state */
function computeRevealedMarks(ms: BlotMarkState, player: PlayerState): Set<BlotMarkId> {
  const e = ms.earned;
  const revealed = new Set<BlotMarkId>();

  // Always visible
  revealed.add("mark_first_journey");
  revealed.add("mark_first_harvest");
  revealed.add("mark_first_craft");
  revealed.add("mark_first_recover");
  revealed.add("mark_first_encounter");

  if (e.mark_first_journey) revealed.add("mark_first_find_food");
  if (ms.poisVisited.size >= 3) revealed.add("mark_visit_all_poi");
  if (ms.distinctMethodsUsed.size >= 2) revealed.add("mark_all_methods");
  if (Object.values(player.xp).some(x => x >= 200)) revealed.add("mark_harvest_proficiency"); // level 2
  if (e.mark_harvest_proficiency) revealed.add("mark_all_proficiency");
  if (ms.toolsCrafted.size >= 2) revealed.add("mark_craft_all_tools");
  if (e.mark_craft_all_tools) revealed.add("mark_craft_equipment");
  if (ms.hasSeenLowSatiety) revealed.add("mark_low_satiety_survive"); // satiety dropped below 30% (300)
  if (ms.poisVisited.has("poi_sap_weep")) revealed.add("mark_eat_on_site");
  if (e.mark_first_encounter) {
    revealed.add("mark_first_hunt");
    revealed.add("mark_avoid_moth");
  }
  if (e.mark_first_hunt) revealed.add("mark_first_win");
  if (e.mark_first_win) {
    revealed.add("mark_use_combo");
    revealed.add("mark_novelty_2");
    revealed.add("mark_high_integrity_win");
  }
  if (e.mark_novelty_2) revealed.add("mark_novelty_4");
  if (e.mark_use_combo) revealed.add("mark_drill_resonance");
  if (e.mark_drill_resonance) revealed.add("mark_first_crystallised_wax");
  // Loot
  if (e.mark_first_win) revealed.add("mark_first_wing_membrane");
  if (e.mark_first_win) revealed.add("mark_full_corpse");

  return revealed;
}

/** Compute which marks should now be earned */
function computeEarnedMarks(ms: BlotMarkState, player: PlayerState, context: {
  justJourneyed?: "explore" | "findFood";
  justHarvested?: { methods: HarvestMethodId[] };
  justCrafted?: { itemId: string };
  justRecovered?: boolean;
  justEncountered?: boolean;
  justHunted?: boolean;
  justWon?: { integrity: number; movesUsed: import("./types").MoveId[]; combos: number; uniqueMoves: number };
  justAvoided?: boolean;
  justAte?: { onSite: boolean };
  justDropped?: { ids: string[] };
}): BlotMarkId[] {
  const { earned } = ms;
  const newlyEarned: BlotMarkId[] = [];

  function tryEarn(id: BlotMarkId, condition: boolean) {
    if (!earned[id] && condition) newlyEarned.push(id);
  }

  if (context.justJourneyed) {
    tryEarn("mark_first_journey", true);
    tryEarn("mark_first_find_food", context.justJourneyed === "findFood");
    tryEarn("mark_visit_all_poi", ms.poisVisited.size >= 6);
  }

  if (context.justHarvested) {
    tryEarn("mark_first_harvest", true);
    tryEarn("mark_all_methods", ms.distinctMethodsUsed.size >= 5);
    const level3Methods = Object.values(player.xp).filter(x => x >= 300).length; // level 3 = 300xp
    tryEarn("mark_harvest_proficiency", level3Methods >= 1);
    tryEarn("mark_all_proficiency", level3Methods >= 5);
  }

  if (context.justCrafted) {
    tryEarn("mark_first_craft", true);
    tryEarn("mark_craft_all_tools", ms.toolsCrafted.size >= 5);
    const isEquipment = context.justCrafted.itemId === "eq_chomper" || context.justCrafted.itemId === "eq_tail_curler";
    tryEarn("mark_craft_equipment", isEquipment);
  }

  if (context.justRecovered) {
    tryEarn("mark_first_recover", true);
  }

  if (player.stats.satiety <= 120 && ms.hasSeenLowSatiety) {
    tryEarn("mark_low_satiety_survive", true);
  }

  if (context.justAte?.onSite) {
    tryEarn("mark_eat_on_site", true);
  }

  if (context.justEncountered) {
    tryEarn("mark_first_encounter", true);
  }

  if (context.justHunted) {
    tryEarn("mark_first_hunt", true);
  }

  if (context.justAvoided) {
    tryEarn("mark_avoid_moth", true);
  }

  if (context.justWon) {
    const { integrity, movesUsed, combos, uniqueMoves } = context.justWon;
    tryEarn("mark_first_win", true);
    tryEarn("mark_use_combo", combos > 0);
    tryEarn("mark_novelty_2", uniqueMoves >= 2);
    tryEarn("mark_novelty_4", uniqueMoves >= 4 || combos > 0);
    tryEarn("mark_drill_resonance", movesUsed.includes("drill_resonance"));
    tryEarn("mark_high_integrity_win", integrity >= 80);
  }

  if (context.justDropped) {
    tryEarn("mark_first_wing_membrane", context.justDropped.ids.includes("mat_wing_membrane"));
    tryEarn("mark_first_crystallised_wax", context.justDropped.ids.includes("mat_crystallised_wax"));
    tryEarn("mark_full_corpse", false); // handled in justWon
  }

  return newlyEarned;
}

// Category icons as SVG strings
function BlotMarkCategoryIcon({ category, size = 22 }: { category: BlotMarkCategory; size?: number }) {
  const s = size;
  const c = s / 2;
  const svgProps = { width: s, height: s, viewBox: `0 0 ${s} ${s}`, fill: "none" as const };
  switch (category) {
    case "Exploration":
      // Footprint: two oval shapes
      return <svg {...svgProps}>
        <ellipse cx={c * 0.7} cy={c * 1.3} rx={c * 0.35} ry={c * 0.5} fill="currentColor" opacity="0.9" transform={`rotate(-15, ${c * 0.7}, ${c * 1.3})`} />
        <ellipse cx={c * 1.3} cy={c * 0.7} rx={c * 0.35} ry={c * 0.5} fill="currentColor" opacity="0.55" transform={`rotate(-15, ${c * 1.3}, ${c * 0.7})`} />
      </svg>;
    case "Harvesting":
      // Three radial lines from center
      return <svg {...svgProps}>
        {[0, 120, 240].map((deg, i) => {
          const r = deg * Math.PI / 180;
          const x1 = c + Math.cos(r) * c * 0.28;
          const y1 = c + Math.sin(r) * c * 0.28;
          const x2 = c + Math.cos(r) * c * 0.82;
          const y2 = c + Math.sin(r) * c * 0.82;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={c * 0.22} strokeLinecap="round" opacity={i === 0 ? 0.9 : 0.55} />;
        })}
        <circle cx={c} cy={c} r={c * 0.2} fill="currentColor" />
      </svg>;
    case "Crafting":
      // Interlocked rings
      return <svg {...svgProps}>
        <circle cx={c * 0.72} cy={c} r={c * 0.52} stroke="currentColor" strokeWidth={c * 0.22} opacity="0.9" />
        <circle cx={c * 1.28} cy={c} r={c * 0.52} stroke="currentColor" strokeWidth={c * 0.22} opacity="0.6" />
      </svg>;
    case "Survival":
      // Coiled tail / spiral
      return <svg {...svgProps}>
        <path d={`M ${c} ${c * 0.35} A ${c * 0.65} ${c * 0.65} 0 1 1 ${c * 0.5} ${c * 1.5}`} stroke="currentColor" strokeWidth={c * 0.22} strokeLinecap="round" fill="none" opacity="0.9" />
        <circle cx={c * 0.5} cy={c * 1.5} r={c * 0.18} fill="currentColor" opacity="0.7" />
      </svg>;
    case "Combat":
      // Torn wing / diagonal slash marks
      return <svg {...svgProps}>
        <line x1={c * 0.3} y1={c * 0.5} x2={c * 1.7} y2={c * 1.5} stroke="currentColor" strokeWidth={c * 0.22} strokeLinecap="round" opacity="0.9" />
        <line x1={c * 0.6} y1={c * 0.3} x2={c * 1.4} y2={c * 1.7} stroke="currentColor" strokeWidth={c * 0.18} strokeLinecap="round" opacity="0.5" />
      </svg>;
    case "Loot":
      // Crystal facet / diamond
      return <svg {...svgProps}>
        <polygon points={`${c},${c * 0.2} ${c * 1.7},${c} ${c},${c * 1.8} ${c * 0.3},${c}`} stroke="currentColor" strokeWidth={c * 0.15} fill="currentColor" opacity="0.25" />
        <polygon points={`${c},${c * 0.2} ${c * 1.7},${c} ${c},${c * 1.8} ${c * 0.3},${c}`} stroke="currentColor" strokeWidth={c * 0.15} fill="none" opacity="0.9" />
        <line x1={c * 0.3} y1={c} x2={c * 1.7} y2={c} stroke="currentColor" strokeWidth={c * 0.12} opacity="0.4" />
      </svg>;
  }
}

const CATEGORY_COLOR: Record<BlotMarkCategory, string> = {
  Exploration: "#7ecba1",
  Harvesting:  "#c8a96e",
  Crafting:    "#7eb8cb",
  Survival:    "#f5c842",
  Combat:      "#ce93d8",
  Loot:        "#80cbc4",
};

function getNudgeText(ms: BlotMarkState, player: PlayerState, atPoi: boolean): string | null {
  const e = ms.earned;
  const hasTinkerShaft = player.inventory.some(s => s.id === "eq_tinker_shaft" && s.qty > 0);
  const toolsOwned = HARVESTING_TOOLS.filter(t => player.inventory.some(s => s.id === t && s.qty > 0));
  const toolsEquipped = player.equipment.tailSlots.filter(Boolean).length;
  const staminaPct = player.stats.stamina / player.stats.maxStamina;
  const hasResources = player.inventory.some(s =>
    (s.id === "resin_glob" || s.id === "fiber_clump" || s.id === "brittle_stone") && s.qty > 0
  );
  const visitedResin = ms.poisVisited.has("poi_resin_node") || ms.poisVisited.has("poi_resin_hollow") || ms.poisVisited.has("poi_sap_weep");

  // Priority 1 — first journey
  if (!e.mark_first_journey) return "Try exploring — head out and see what's nearby.";

  // Priority 2 — first harvest (context-sensitive)
  if (!e.mark_first_harvest) {
    if (atPoi) return "You've arrived somewhere. Try harvesting.";
    return "After a journey, you'll arrive somewhere you can harvest.";
  }

  // Priority 6 — low stamina (urgent, jumps queue)
  if (!e.mark_first_recover && staminaPct < 0.6) return "You're getting tired. Try Lay Down to recover stamina.";

  // Priority 3 — first craft
  if (!e.mark_first_craft) {
    if (hasTinkerShaft) return "You can craft tools. Open the Tinker Shaft to start.";
    return "Gather resin and fiber to craft your first tool.";
  }

  // Priority 4 — first recover (if not yet done and not already shown by stamina gate)
  if (!e.mark_first_recover) return "If stamina gets low, use Lay Down to rest.";

  // Priority 5 — find food
  if (!e.mark_first_find_food) return "Try Find Food on your next journey — it targets food locations.";

  // Priority 7 — craft more tools
  if (!e.mark_craft_all_tools) {
    if (toolsOwned.length >= 2 && hasResources) return "You have resources. Craft more harvesting tools to unlock new methods.";
    if (toolsOwned.length < 5) return "Craft the remaining harvesting tools to unlock all five harvest methods.";
  }

  // Priority 8 — use different methods
  if (!e.mark_all_methods && toolsEquipped >= 2) return "Try using different harvest methods at your next location.";

  // Priority 9 — craft equipment
  if (!e.mark_craft_equipment && e.mark_craft_all_tools) return "All tools crafted. Try making a Chomper or Tail Curler next.";

  // Priority 10 — proficiency
  if (!e.mark_harvest_proficiency) return "Keep harvesting with the same method to build proficiency.";

  // Priority 11 — sap weep
  if (!e.mark_eat_on_site && ms.poisVisited.has("poi_sap_weep")) return "At a Sap Weep, you can eat the soft sap directly on site.";

  // Priority 12–13 — encounter discovery
  if (!e.mark_first_encounter && visitedResin) return "Resin locations sometimes have creatures. Head out and explore.";
  if (e.mark_first_encounter && !e.mark_first_hunt) return "You spotted something out there. Next time, try hunting it.";
  if (e.mark_first_hunt && !e.mark_first_win) return "Keep at it — creatures go down if you stay in the fight.";

  // Priority 14–20 — combat chain
  if (e.mark_first_win && !e.mark_use_combo) return "In battle, you can combine two tools into a single combo move.";
  if (e.mark_first_win && !e.mark_novelty_2) return "In battle, try using different moves instead of repeating one.";
  if (e.mark_novelty_2 && !e.mark_novelty_4) return "Push further — use four or more different moves in one battle.";
  if (e.mark_use_combo && !e.mark_drill_resonance) return "Try the Drill Resonance combo: open the thorax first, then use Twig + Drill.";
  if (e.mark_drill_resonance && !e.mark_first_crystallised_wax) return "Drill Resonance can drop Crystallised Wax. Aim for a clean hit.";
  if (e.mark_first_win && !e.mark_high_integrity_win) return "Try winning a battle without smashing — keep the creature's integrity high.";
  if (e.mark_first_win && !e.mark_full_corpse) return "A clean win with high integrity gives the best corpse drops.";
  if (e.mark_first_win && !e.mark_first_wing_membrane) return "Wing Membranes drop from moths at high integrity. Use precise moves.";

  // Priority 21 — long haul
  if (!e.mark_visit_all_poi && ms.poisVisited.size >= 3) return "You've found most location types. Keep exploring to find the rest.";
  if (e.mark_harvest_proficiency && !e.mark_all_proficiency) return "One method mastered. Bring all five to level 3.";

  return null; // all done
}

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
  const [showPop, setShowPop] = React.useState(false);
  const xpGained = xpAfter - xpBefore;
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.width = `${pctBefore}%`;
    const t1 = setTimeout(() => { el.style.width = `${pctAfter}%`; }, 80);
    const t2 = setTimeout(() => setShowPop(true), 200);
    const t3 = setTimeout(() => setShowPop(false), 1400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pctBefore, pctAfter]);
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ItemIcon id={toolIds[method]} size={14} />
        <div style={{ position: "relative", flex: 1, background: "#0e0e0e", borderRadius: 3, height: 5, overflow: "visible" }}>
          <div style={{ position: "absolute", inset: 0, borderRadius: 3, overflow: "hidden" }}>
            <div ref={ref} style={{
              height: "100%", background: isMax ? "#c8a96e" : "#4caf50",
              borderRadius: 3, transition: "width 0.6s ease",
            }} />
          </div>
          {xpGained > 0 && (
            <div style={{
              position: "absolute", right: 0, top: -18,
              fontSize: "0.7rem", fontWeight: 600, color: "#4caf50",
              opacity: showPop ? 1 : 0,
              transform: showPop ? "translateY(-4px)" : "translateY(0px)",
              transition: showPop
                ? "opacity 0.18s ease, transform 0.4s ease"
                : "opacity 0.3s ease 0.1s, transform 0.3s ease 0.1s",
              pointerEvents: "none", whiteSpace: "nowrap",
            }}>
              +{xpGained} xp
            </div>
          )}
        </div>
        <div style={{ fontSize: "0.68rem", opacity: 0.5, whiteSpace: "nowrap" }}>
          Lv {level}{isMax ? " MAX" : ""}
        </div>
      </div>
      <div style={{ fontSize: "0.65rem", opacity: 0.35, marginTop: 3, paddingLeft: 22 }}>
        {methodNames[method]} proficiency
      </div>
    </div>
  );
}

function BlotMarkFlyIn({ category, color, onDone }: { category: BlotMarkCategory; color: string; onDone: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Start near bottom-center (where toast is), fly to top-left sidebar button area
    const startX = window.innerWidth * 0.5;
    const startY = window.innerHeight - 110;
    // Marks button in sidebar — approximately x=110, y=220 (rough estimate, works for sidebar layout)
    const targetX = 110;
    const targetY = 220;
    el.style.left = `${startX}px`;
    el.style.top = `${startY}px`;
    el.style.opacity = "1";
    el.style.transform = "translate(-50%, -50%) scale(1)";
    const frame = requestAnimationFrame(() => {
      el.style.transition = "left 700ms cubic-bezier(0.4,0,0.2,1), top 700ms cubic-bezier(0.4,0,0.2,1), transform 700ms ease-in, opacity 250ms ease-in 500ms";
      el.style.left = `${targetX}px`;
      el.style.top = `${targetY}px`;
      el.style.transform = "translate(-50%, -50%) scale(0.2)";
      el.style.opacity = "0";
    });
    const t = setTimeout(onDone, 800);
    return () => { cancelAnimationFrame(frame); clearTimeout(t); };
  }, [onDone]);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, pointerEvents: "none" }}>
      <div ref={ref} style={{ position: "absolute", willChange: "left, top, transform, opacity", color }}>
        <BlotMarkCategoryIcon category={category} size={36} />
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
  const netLo = netRange ? Math.max(0, Math.min(max, netRange[0])) : null;
  const netHi = netRange ? Math.max(0, Math.min(max, netRange[1])) : null;
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
  toolDiscovery: {},
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

  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([]);  // last move's log lines

  const [markState, setMarkState] = useState<BlotMarkState>(() => makeInitialMarkState());
  const [marksViewed, setMarksViewed] = useState(false); // true after panel opened this "session"
  const [toastQueue, setToastQueue] = useState<BlotMarkId[]>([]);
  const [activeToast, setActiveToast] = useState<BlotMarkId | null>(null);
  const [toastDismissing, setToastDismissing] = useState(false);
  const [flyingMarkCategory, setFlyingMarkCategory] = useState<{ category: BlotMarkCategory; key: number } | null>(null);
  const [newRevealIds, setNewRevealIds] = useState<BlotMarkId[]>([]); // IDs newly revealed, for shimmer

  // Gate state
  const [gateEncounterPending, setGateEncounterPending] = useState(false); // set during journey if gate should trigger
  const [biomassTotal, setBiomassTotal] = useState(0); // accumulated biomass (not in player inventory — tracked separately)

  const [returnScreen, setReturnScreen] = useState<Screen>("HUB");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [expandedMark, setExpandedMark] = useState<BlotMarkId | null>(null);
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
      setJourneyPreview({ ...pv, poi: journeyPreview.poi, surfacedEvents: journeyPreview.surfacedEvents, mothEncountered: journeyPreview.mothEncountered });
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
    setMarkState(makeInitialMarkState());
    setMarksViewed(false);
    setToastQueue([]);
    setActiveToast(null);
    setToastDismissing(false);
    if (toastTimerRef.current) { clearTimeout(toastTimerRef.current); toastTimerRef.current = null; }
    setFlyingMarkCategory(null);
    setNewRevealIds([]);
    setGateEncounterPending(false);
    setBiomassTotal(0);
  }

  /** Snapshot qty of each storable food stack before an action */

  // Unlock audio on first interaction and preload all sounds
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      unlockAudio();
      preloadAll();
      // Play click sound for any button press
      if ((e.target as HTMLElement)?.closest("button, select")) {
        playSfx("sfx_click");
      }
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, []);

  // Hunger warning — fire once when satiety crosses below 25%
  const satietyPct = player.stats.satiety / player.stats.maxSatiety;
  const prevSatietyPctRef = React.useRef(satietyPct);
  useEffect(() => {
    if (prevSatietyPctRef.current >= 0.25 && satietyPct < 0.25) {
      playSfx("sfx_hunger_warning");
    }
    prevSatietyPctRef.current = satietyPct;
  }, [satietyPct]);

  // Food expiring alert sound
  const [prevDecayAlert, setPrevDecayAlert] = useState<string | null>(null);
  useEffect(() => {
    if (decayedFoodAlert && decayedFoodAlert !== prevDecayAlert) {
      playSfx("sfx_food_expiring");
      setPrevDecayAlert(decayedFoodAlert);
    }
  }, [decayedFoodAlert]);

  // Journey summary: staggered event and item sounds
  useEffect(() => {
    if (!journeyResult || screen !== "SUMMARY_JOURNEY") return;
    const displayable = journeyResult.surfacedEvents.filter(e => !["ev_need_chomper","ev_need_scoop_for_rations"].includes(e));
    displayable.forEach((e, i) => {
      const effects = journeyResult.eventEffects?.[e];
      const net = effects ? (effects.satietyDelta + effects.staminaDelta) : 0;
      playSfx(net >= 0 ? "sfx_event_good" : "sfx_event_bad", 270 + i * 200);
    });
    journeyResult.gained.forEach((_, i) => {
      playSfx("sfx_item_pickup", 360 + i * 150);
      playSfx("sfx_item_fly", 440 + i * 150);
    });
    if (journeyResult.foodConsumed.length > 0) {
      playSfx("sfx_chomp", 450);
    }
    if (journeyResult.outcome === "exhausted") playSfx("sfx_exhausted", 600);
    if (journeyResult.outcome === "dead") playSfx("sfx_dead", 600);
  }, [journeyResult]);

  // Harvest summary: level up + chomp
  useEffect(() => {
    if (!multiHarvestResults.length || screen !== "SUMMARY_HARVEST") return;
    multiHarvestResults.forEach((res) => {
      const xpBefore = harvestXpBefore[res.method] ?? 0;
      const levelBefore = Math.floor(xpBefore / 100);
      const levelAfter = Math.floor((xpBefore + res.xpGained) / 100);
      if (levelAfter > levelBefore) playSfx("sfx_level_up", 400);
      if (res.foodConsumed.length > 0) playSfx("sfx_chomp", 300);
      if (res.outcome === "exhausted") playSfx("sfx_exhausted", 500);
      if (res.outcome === "dead") playSfx("sfx_dead", 500);
    });
  }, [multiHarvestResults]);

  // Scoop storable: chomp if food consumed
  useEffect(() => {
    if (!lastStorableResult) return;
    if (lastStorableResult.foodConsumed?.length > 0) playSfx("sfx_chomp", 350);
  }, [lastStorableResult]);

  // Wake up sound fires on "Get up" button click, not on summary mount
  useEffect(() => {
    if (screen === "SUMMARY_RECOVER" && recoverSummary) {
      if (recoverSummary.foodConsumed?.length > 0) playSfx("sfx_chomp", 600);
    }
  }, [recoverSummary]);

  // Craft summary: level up if applicable
  useEffect(() => {
    if (!craftResult || screen !== "SUMMARY_CRAFT") return;
    if (craftResult.foodConsumed?.length > 0) playSfx("sfx_chomp", 300);
  }, [craftResult]);

  // Death/exhaustion screens
  useEffect(() => {
    if (screen === "DEAD") playSfx("sfx_dead");
    if (screen === "EXHAUSTED") playSfx("sfx_exhausted");
  }, [screen]);
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

  // ── Blot Mark helpers ─────────────────────────────────────────────────────
  function cloneMarkState(ms: BlotMarkState): BlotMarkState {
    const next = structuredClone(ms) as BlotMarkState;
    next.poisVisited = new Set(ms.poisVisited);
    next.distinctMethodsUsed = new Set(ms.distinctMethodsUsed);
    next.toolsCrafted = new Set(ms.toolsCrafted);
    next.claimedMarkers = { ...ms.claimedMarkers };
    next.gateSlottedTrophies = [...(ms.gateSlottedTrophies ?? [])];
    return next;
  }

  function triggerMarks(
    updatedPlayer: PlayerState,
    updatedMarkState: BlotMarkState,
    context: Parameters<typeof computeEarnedMarks>[2]
  ): BlotMarkState {
    const ms = structuredClone(updatedMarkState) as BlotMarkState;
    // Serialize Sets properly after structuredClone
    ms.poisVisited = new Set(updatedMarkState.poisVisited);
    ms.distinctMethodsUsed = new Set(updatedMarkState.distinctMethodsUsed);
    ms.toolsCrafted = new Set(updatedMarkState.toolsCrafted);
    ms.claimedMarkers = { ...updatedMarkState.claimedMarkers };
    ms.gateSlottedTrophies = [...(updatedMarkState.gateSlottedTrophies ?? [])];

    const newlyEarned = computeEarnedMarks(ms, updatedPlayer, context);
    for (const id of newlyEarned) ms.earned[id] = true;

    const newRevealed: BlotMarkId[] = [];
    const computedRevealed = computeRevealedMarks(ms, updatedPlayer);
    for (const id of computedRevealed) {
      if (!ms.revealed[id]) {
        ms.revealed[id] = true;
        newRevealed.push(id);
      }
    }

    if (newRevealed.length > 0) {
      setNewRevealIds(prev => [...prev, ...newRevealed]);
      setMarksViewed(false); // badge for new reveals too
    }

    if (newlyEarned.length > 0) {
      setToastQueue(prev => [...prev, ...newlyEarned]);
      setMarksViewed(false);
    }

    return ms;
  }

  // Toast queue processor
  const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (activeToast !== null) return; // already showing one
    if (toastQueue.length === 0) return;
    const next = toastQueue[0];
    setToastQueue(prev => prev.slice(1));
    setToastDismissing(false);
    setActiveToast(next);
    // Start fly-in
    const mark = BLOT_MARKS[next];
    setFlyingMarkCategory({ category: mark.category, key: Date.now() });
    // Begin dismiss animation at 2.8s, clear at 3.2s
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastDismissing(true);
      toastTimerRef.current = setTimeout(() => {
        setActiveToast(null);
        setToastDismissing(false);
        toastTimerRef.current = null;
      }, 400);
    }, 2800);
  }, [activeToast, toastQueue]);



  function openMetaScreen(target: "INVENTORY" | "SKILLS" | "MARKS") {
    setDecayedFoodAlert(null);
    // Re-clicking the active screen closes it
    if (screen === target) {
      playSfx("sfx_transition");
      setScreen(returnScreen);
      return;
    }
    if (target === "INVENTORY") playSfx("sfx_inventory_open");
    else playSfx("sfx_transition");
    // Only store return point when first leaving main flow
    if (screen !== "INVENTORY" && screen !== "SKILLS" && screen !== "MARKS") setReturnScreen(screen);
    setExpandedItem(null);
    if (target === "MARKS") {
      setMarksViewed(true);
      setNewRevealIds([]);
      setExpandedMark(null);
    }
    setScreen(target);
  }

  function backFromMeta() {
    setDecayedFoodAlert(null);
    playSfx("sfx_transition");
    setScreen(returnScreen);
  }

  // ── Journey ───────────────────────────────────────────────────────────────
  function rollMothEncounter(pv: JourneyPreview): JourneyPreview {
    const mothPois: PoiId[] = ["poi_resin_node", "poi_resin_hollow", "poi_sap_weep"];
    const isResin = mothPois.includes(pv.poi.id);
    const chance = isResin ? (pv.poi.quality === "uncommon" ? 0.70 : 0.35) : 0;
    return { ...pv, mothEncountered: Math.random() < chance };
  }

  function genJourney(mode: "explore" | "findFood") {
    setDecayedFoodAlert(null);
    const saved = mode === "explore" ? savedExploreRoll : savedFoodRoll;
    let pv = saved ?? rollMothEncounter(makeJourneyPreview(player, mode, chomperAutoEnabled));
    if (!saved) {
      if (mode === "explore") setSavedExploreRoll(pv);
      else setSavedFoodRoll(pv);
    }
    setJourneyPreview(pv); setJourneyResult(null);
    setScreen("PREVIEW_JOURNEY");
  }
  function proceedJourney() {
    if (!journeyPreview) return;
    playSfx("sfx_journey_start");
    const snap = snapshotStorableQty(player.inventory);
    const next = structuredClone(player);
    const res = resolveJourney(next, journeyPreview, chomperAutoEnabled);
    const resWithMoth = { ...res, mothEncountered: journeyPreview.mothEncountered ?? false };
    setPlayer(next); setJourneyResult(resWithMoth);
    checkDecayAlert(snap, next.inventory, res.foodConsumed);
    setActivePoi(null); setActiveBlot(null);
    setLastEatResult(null); setLastStorableResult(null);
    setScoopExpanded(false);
    if (journeyPreview.mode === "explore") setSavedExploreRoll(null);
    else setSavedFoodRoll(null);

    // Track blot marks
    const ms = cloneMarkState(markState);
    ms.poisVisited.add(journeyPreview.poi.id);
    // Track low satiety
    if (next.stats.satiety < next.stats.maxSatiety * 0.3) ms.hasSeenLowSatiety = true;
    ms.lowestSatietySeen = Math.min(ms.lowestSatietySeen, next.stats.satiety);
    const newMs = triggerMarks(next, ms, {
      justJourneyed: journeyPreview.mode,
    });
    // Check moth encounter
    if (resWithMoth.mothEncountered) {
      const ms2 = triggerMarks(next, newMs, { justEncountered: true });
      setMarkState(ms2);
    } else {
      setMarkState(newMs);
    }

    // Gate discovery: if gate not yet discovered, count trophies in inventory (raw + gem-embedded)
    if (!newMs.gateDiscovered && journeyPreview.mode === "explore") {
      const trophyCount = countTrophiesInInventory(next.inventory);
      if (trophyCount >= 3 && Math.random() < 0.30) {
        setGateEncounterPending(true);
      }
    }

    setScreen("SUMMARY_JOURNEY");
  }
  function sniffAgain() {
    setDecayedFoodAlert(null);
    if (!journeyPreview) return;
    const next = structuredClone(player);
    next.stats.satiety = clamp(next.stats.satiety - 20, 0, next.stats.maxSatiety);
    next.stats.stamina = clamp(next.stats.stamina - 20, 0, next.stats.maxStamina);
    setPlayer(next);
    const pv = rollMothEncounter(makeJourneyPreview(next, journeyPreview.mode, chomperAutoEnabled));
    if (journeyPreview.mode === "explore") setSavedExploreRoll(pv);
    else setSavedFoodRoll(pv);
    setJourneyPreview(pv);
  }
  function enterPoi() {
    playSfx("sfx_journey_arrive");
    setDecayedFoodAlert(null);
    if (!journeyResult) return;
    setActivePoi(journeyResult.poi);
    setActiveBlot(journeyResult.blot);
    setLastEatResult(null); setLastStorableResult(null);
    setMultiHarvestResults([]);
    setScoopExpanded(false);
    setScreen("HUB");
  }

  function avoidCreature() {
    if (!journeyResult) return;
    // 20 stamina cost to slip past
    const next = structuredClone(player);
    next.stats.stamina = clamp(next.stats.stamina - 20, 0, next.stats.maxStamina);
    setPlayer(next);
    const ms = cloneMarkState(markState);
    setMarkState(triggerMarks(next, ms, { justAvoided: true }));
    enterPoi();
  }

  // ── Gate helpers ──────────────────────────────────────────────────────────
  function countTrophiesInInventory(inv: typeof player.inventory): number {
    let count = 0;
    for (const s of inv) {
      const id = s.id as string;
      if (id.startsWith("trophy_") || id.startsWith("gem_trophy_")) count += s.qty;
    }
    return count;
  }

  function hasGateAccess(ms: BlotMarkState): boolean {
    return ms.gateDiscovered;
  }

  function claimMarker(markId: BlotMarkId) {
    const mark = BLOT_MARKS[markId];
    const cat = mark.category;
    const gateMarkId = CATEGORY_GATE_MARK[cat] as BlotMarkId;
    const isGateMark = markId === gateMarkId;

    const ms = cloneMarkState(markState);
    ms.claimedMarkers[markId] = true;

    const next = structuredClone(player);
    if (isGateMark) {
      // Give Trophy
      const trophyId = CATEGORY_TROPHY[cat];
      invAdd(next.inventory, trophyId, 1);
      playSfx("sfx_trophy_earned");
    } else {
      // Give Marker
      const markerId = CATEGORY_MARKER[cat];
      invAdd(next.inventory, markerId, 1);
      playSfx("sfx_marker_claim");
    }
    setPlayer(next);
    setMarkState(ms);
  }

  function craftGemTrophy(gemId: GemTrophyItemId) {
    const recipe = GEM_TROPHY_RECIPES[gemId];
    const next = structuredClone(player);
    // Check requirements
    const trophyQty = invGet(next.inventory, recipe.trophyInput)?.qty ?? 0;
    const markerQty = invGet(next.inventory, recipe.markerInput)?.qty ?? 0;
    const resinQty = invGet(next.inventory, "resin_glob")?.qty ?? 0;
    const hasTinker = hasEquippedTail(player, "eq_tinker_shaft");
    if (trophyQty < 1 || markerQty < recipe.markerQty || resinQty < recipe.resinQty || !hasTinker) return;
    invRemove(next.inventory, recipe.trophyInput, 1);
    invRemove(next.inventory, recipe.markerInput, recipe.markerQty);
    invRemove(next.inventory, "resin_glob", recipe.resinQty);
    invAdd(next.inventory, recipe.output, 1);
    setPlayer(next);
    playSfx("sfx_craft_success");
  }

  function canCraftGemTrophy(gemId: GemTrophyItemId): boolean {
    const recipe = GEM_TROPHY_RECIPES[gemId];
    const trophyQty = invGet(player.inventory, recipe.trophyInput)?.qty ?? 0;
    const markerQty = invGet(player.inventory, recipe.markerInput)?.qty ?? 0;
    const resinQty = invGet(player.inventory, "resin_glob")?.qty ?? 0;
    const hasTinker = hasEquippedTail(player, "eq_tinker_shaft");
    return trophyQty >= 1 && markerQty >= recipe.markerQty && resinQty >= recipe.resinQty && hasTinker;
  }

  function slotGemTrophy(gemId: GemTrophyItemId) {
    const next = structuredClone(player);
    const qty = invGet(next.inventory, gemId)?.qty ?? 0;
    if (qty < 1) return;
    invRemove(next.inventory, gemId, 1);
    const ms = cloneMarkState(markState);
    if (!ms.gateSlottedTrophies.includes(gemId)) ms.gateSlottedTrophies.push(gemId);
    // Check if gate now unlocked (all 3 required trophies slotted)
    const allRequired = GATE_REQUIRED_GEM_TROPHIES.every(id => ms.gateSlottedTrophies.includes(id));
    if (allRequired) {
      ms.gateUnlocked = true;
      playSfx("sfx_gate_activate");
    } else {
      playSfx("sfx_gate_slot");
    }
    setPlayer(next);
    setMarkState(ms);
  }

  function discoverGate() {
    const ms = cloneMarkState(markState);
    ms.gateDiscovered = true;
    setMarkState(ms);
    setGateEncounterPending(false);
    setScreen("GATE");
  }

  function ignorePendingGate() {
    setGateEncounterPending(false);
    // Proceed to enterPoi — caller must call enterPoi after
  }

  function liquidateItem(itemId: string, qty: number) {
    const value = BIOMASS_VALUES[itemId];
    if (!value) return;
    const next = structuredClone(player);
    const available = invGet(next.inventory, itemId as import("./types").ResourceId)?.qty ?? 0;
    const actualQty = Math.min(qty, available);
    if (actualQty <= 0) return;
    invRemove(next.inventory, itemId as import("./types").ResourceId, actualQty);
    setBiomassTotal(prev => prev + value * actualQty);
    setPlayer(next);
  }

  function liquidateAll() {
    const next = structuredClone(player);
    let gained = 0;
    for (const [itemId, value] of Object.entries(BIOMASS_VALUES)) {
      if (!value) continue;
      const qty = invGet(next.inventory, itemId as import("./types").ResourceId)?.qty ?? 0;
      if (qty > 0) {
        invRemove(next.inventory, itemId as import("./types").ResourceId, qty);
        gained += value * qty;
      }
    }
    setBiomassTotal(prev => prev + gained);
    setPlayer(next);
  }

  function huntCreatureFromJourney() {
    if (!journeyResult) return;
    // Enter battle; on finish, return to journey summary with mothDefeated flag
    const state = startBattle("creature_gloop_moth");
    setBattleState(state);
    setBattleResult(null);
    setBattleLog([]);
    // Mark that we came from journey summary so we know where to go back
    setReturnScreen("SUMMARY_JOURNEY");
    // Wire blot mark for choosing to hunt
    const ms = cloneMarkState(markState);
    setMarkState(triggerMarks(player, ms, { justHunted: true }));
    setScreen("BATTLE");
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
    const methodSfx: Record<string, "sfx_harvest_poke"|"sfx_harvest_smash"|"sfx_harvest_tease"|"sfx_harvest_drill"|"sfx_harvest_scoop"> = {
      poke: "sfx_harvest_poke", smash: "sfx_harvest_smash",
      tease: "sfx_harvest_tease", drill: "sfx_harvest_drill", scoop: "sfx_harvest_scoop",
    };
    if (methodSfx[harvestPreview.method]) playSfx(methodSfx[harvestPreview.method]);
    const snap = snapshotStorableQty(player.inventory);
    const xpBefore = { [harvestPreview.method]: player.xp[harvestPreview.method] ?? 0 };
    const next = structuredClone(player);
    const res = resolveHarvest(next, harvestPreview, chomperAutoEnabled);
    setPlayer(next); setHarvestResult(res);
    setHarvestXpBefore(xpBefore);
    checkDecayAlert(snap, next.inventory, res.foodConsumed);
    if (activeBlot && activeBlot.harvestCharges !== undefined)
      setActiveBlot({ ...activeBlot, harvestCharges: Math.max(0, activeBlot.harvestCharges - 1) });

    // Track blot marks
    const ms = cloneMarkState(markState);
    ms.distinctMethodsUsed.add(harvestPreview.method);
    if (next.stats.satiety < next.stats.maxSatiety * 0.3) ms.hasSeenLowSatiety = true;
    setMarkState(triggerMarks(next, ms, { justHarvested: { methods: [harvestPreview.method] } }));

    setScreen("SUMMARY_HARVEST");
  }
  function doMultiHarvest() {
    if (!activePoi || !activeBlot) return;
    const methods = methodsAvailableFromEquipment(player);
    if (!methods.length) return;
    // Play the first method's tool sound
    const methodSfx: Record<string, "sfx_harvest_poke"|"sfx_harvest_smash"|"sfx_harvest_tease"|"sfx_harvest_drill"|"sfx_harvest_scoop"> = {
      poke: "sfx_harvest_poke", smash: "sfx_harvest_smash",
      tease: "sfx_harvest_tease", drill: "sfx_harvest_drill", scoop: "sfx_harvest_scoop",
    };
    if (methods[0] && methodSfx[methods[0]]) playSfx(methodSfx[methods[0]]);
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
    // Record which methods were used at this POI
    const poiId = activePoi.id;
    setPlayer(prev => {
      const disc = { ...prev.toolDiscovery };
      const existing = new Set(disc[poiId] ?? []);
      for (const res of results) existing.add(res.method);
      disc[poiId] = Array.from(existing);
      return { ...prev, toolDiscovery: disc };
    });
    const allConsumed = results.flatMap(r => r.foodConsumed);
    checkDecayAlert(snap, next.inventory, allConsumed);

    // Track blot marks
    const ms = cloneMarkState(markState);
    for (const m of methods) ms.distinctMethodsUsed.add(m);
    if (next.stats.satiety < next.stats.maxSatiety * 0.3) ms.hasSeenLowSatiety = true;
    setMarkState(triggerMarks(next, ms, { justHarvested: { methods } }));

    setScreen("SUMMARY_HARVEST");
  }

  // ── Food blot ─────────────────────────────────────────────────────────────
  function doEatSap() {
    setDecayedFoodAlert(null);
    if (!activeBlot) return;
    playSfx("sfx_eat_sap");
    const next = structuredClone(player);
    const blotCopy = structuredClone(activeBlot);
    const result = eatSapAtBlot(next, blotCopy);
    setPlayer(next); setActiveBlot(blotCopy); setLastEatResult(result);
    // Track eat on site
    const ms = cloneMarkState(markState);
    setMarkState(triggerMarks(next, ms, { justAte: { onSite: true } }));
  }
  function doHarvestStorable() {
    if (!activeBlot) return;
    playSfx("sfx_harvest_scoop");
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
    playSfx("sfx_craft_open");
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
    playSfx("sfx_craft_start");
    const snap = snapshotStorableQty(player.inventory);
    const next = structuredClone(player);
    const res = resolveCraft(next, craftPreview, chomperAutoEnabled);
    setPlayer(next); setCraftResult(res);
    if (res.success && res.crafted) {
      playSfx("sfx_craft_success", 300);
      const btn = craftButtonRef.current;
      const rect = btn?.getBoundingClientRect();
      setCraftFlashOrigin(rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null);
      setCraftFlashItem(res.crafted.itemId);

      // Track blot marks for crafting
      const ms = cloneMarkState(markState);
      if (HARVESTING_TOOLS.includes(res.crafted.itemId)) ms.toolsCrafted.add(res.crafted.itemId);
      if (next.stats.satiety < next.stats.maxSatiety * 0.3) ms.hasSeenLowSatiety = true;
      setMarkState(triggerMarks(next, ms, { justCrafted: { itemId: res.crafted.itemId } }));
    } else {
      playSfx("sfx_craft_fail", 200);
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
    playSfx("sfx_flop_down");
    const periods = 7 + Math.floor(Math.random() * 6); // 7–12
    const snap = snapshotStorableQty(player.inventory);
    const next = structuredClone(player);
    const res = resolveRecover(next, periods, chomperAutoEnabled);
    setPlayer(next); setRecoverSummary(res);
    checkDecayAlert(snap, next.inventory, res.foodConsumed);
    const ms = cloneMarkState(markState);
    setMarkState(triggerMarks(next, ms, { justRecovered: true }));
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

  // ── Combat ────────────────────────────────────────────────────────────────
  function enterBattle(creatureId: CreatureId) {
    const state = startBattle(creatureId);
    setBattleState(state);
    setBattleResult(null);
    setBattleLog([]);
    setScreen("BATTLE");
  }

  function doMove(moveId: import("./types").MoveId) {
    if (!battleState) return;
    if (moveId === "flee") {
      const fleeCost = MOVES["flee"].effect.staminaCost;
      const stateWithFleeCost = { ...battleState, staminaCostAccrued: battleState.staminaCostAccrued + fleeCost };
      const { updatedPlayer } = resolveBattle(stateWithFleeCost, "fled", player);
      setPlayer(updatedPlayer);
      setBattleState(null);
      if (returnScreen === "SUMMARY_JOURNEY" && journeyResult) {
        // Fled: moth is still there — clear mothEncountered so Arrive is available, no defeated line
        setJourneyResult({ ...journeyResult, mothEncountered: false, mothDefeated: false });
        setReturnScreen("HUB");
        setScreen("SUMMARY_JOURNEY");
      } else {
        setBattleResult(null);
        setScreen("HUB");
      }
      return;
    }
    const { nextState, log } = executeMove(battleState, moveId, player);
    setBattleLog(log);
    if (nextState.composure <= 0) {
      const precisionMoves: import("./types").MoveId[] = ["comb_glands", "laced_jab", "drill_resonance", "eat_wax_raw", "eat_soft_tissue"];
      const precisionCount = nextState.movesUsed.filter(m => precisionMoves.includes(m)).length;
      const endReason = precisionCount >= 2 ? "disarmed" : "collapsed";
      const { result, updatedPlayer } = resolveBattle(nextState, endReason, player);
      setPlayer(updatedPlayer);
      setBattleState(null);

      // Wire blot marks for combat win
      const ms = cloneMarkState(markState);
      const uniqueMoves = new Set(nextState.movesUsed).size;
      const allDropIds = [...result.midBattleDrops, ...result.corpseDrops].map(d => d.id as string);
      let ms2 = triggerMarks(updatedPlayer, ms, {
        justWon: {
          integrity: result.finalIntegrity,
          movesUsed: nextState.movesUsed,
          combos: nextState.doubleCombosLanded,
          uniqueMoves,
        }
      });
      ms2 = triggerMarks(updatedPlayer, ms2, { justDropped: { ids: allDropIds } });
      // High integrity (80+) full corpse check
      if (result.finalIntegrity >= 80) {
        ms2 = triggerMarks(updatedPlayer, ms2, { justWon: { integrity: result.finalIntegrity, movesUsed: nextState.movesUsed, combos: nextState.doubleCombosLanded, uniqueMoves } });
      }
      setMarkState(ms2);

      if (returnScreen === "SUMMARY_JOURNEY" && journeyResult) {
        setJourneyResult({ ...journeyResult, mothEncountered: false, mothDefeated: true });
        // Show battle summary first; "Back to it" will then return to journey summary
        setBattleResult(result);
        // returnScreen stays "SUMMARY_JOURNEY" so the Back button knows where to go
        setScreen("SUMMARY_BATTLE");
      } else {
        setBattleResult(result);
        setScreen("SUMMARY_BATTLE");
      }
    } else {
      setBattleState(nextState);
    }
  }

  // ── Chomper toggle ────────────────────────────────────────────────────────
  function toggleChomper() {
    const newVal = !chomperAutoEnabled;
    setChomperAutoEnabled(newVal);
    // Refresh active preview
    if (screen === "PREVIEW_JOURNEY" && journeyPreview) {
      const pv = makeJourneyPreview(player, journeyPreview.mode, newVal);
      setJourneyPreview({ ...pv, poi: journeyPreview.poi, surfacedEvents: journeyPreview.surfacedEvents, mothEncountered: journeyPreview.mothEncountered });
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
        {/* Blot Marks button */}
        {(() => {
          const hasNewEarned = toastQueue.length > 0 || (activeToast !== null);
          const hasNewReveal = newRevealIds.length > 0;
          const hasPending = !marksViewed && (hasNewEarned || hasNewReveal);
          const earnedCount = Object.keys(markState.earned).length;
          const glowStyle = hasPending ? (hasNewEarned
            ? { boxShadow: "0 0 0 2px #ce93d8, 0 0 12px 2px #ce93d840", animation: "markBtnPulse 1.1s ease-in-out infinite", border: "1px solid #ce93d8" }
            : { boxShadow: "0 0 0 1px #7ecba150, 0 0 8px 1px #7ecba120", animation: "markBtnPulseSubtle 2.2s ease-in-out infinite", border: "1px solid #7ecba150" }
          ) : {};
          return (
            <div style={{ position: "relative" }}>
              <button
                className="btn"
                style={{
                  width: "100%", fontSize: "0.88rem",
                  background: screen === "MARKS" ? "#1a1a2e" : undefined,
                  border: screen === "MARKS" ? "1px solid #ce93d8" : undefined,
                  color: screen === "MARKS" ? "#ce93d8" : undefined,
                  ...glowStyle,
                }}
                onClick={() => openMetaScreen("MARKS")}
              >
                Blot Marks
              </button>
              {hasPending && (
                <div style={{
                  position: "absolute", top: -4, right: -4,
                  width: 10, height: 10, borderRadius: "50%",
                  background: hasNewEarned ? "#ce93d8" : "#7ecba1",
                  border: "2px solid #0e0e0e",
                  boxShadow: `0 0 6px ${hasNewEarned ? "#ce93d8" : "#7ecba1"}`,
                }} />
              )}
              {earnedCount > 0 && !hasPending && (
                <div style={{
                  position: "absolute", top: -5, right: -5,
                  fontSize: "0.6rem", fontWeight: 700, lineHeight: 1,
                  background: "#2a1a3a", color: "#ce93d870", border: "1px solid #3a2a4a",
                  borderRadius: 8, padding: "2px 5px",
                }}>
                  {earnedCount}/{BLOT_MARK_ORDER.length}
                </div>
              )}
            </div>
          );
        })()}
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
      // staminaRecoveryPerPeriodRange is already total recovery (rate × periods computed in engine)
      return {
        satiety: [sat - pv.satietyCostRange[1] + pv.satietyRestoredRange[0], sat - pv.satietyCostRange[0] + pv.satietyRestoredRange[1]] as [number, number],
        stamina: [sta - pv.staminaCostRange[1] + pv.staminaRecoveryPerPeriodRange[0], sta - pv.staminaCostRange[0] + pv.staminaRecoveryPerPeriodRange[1]] as [number, number],
      };
    }
    if (screen === "PREVIEW_HARVEST" && harvestPreview) {
      const pv = harvestPreview;
      // staminaRecoveryPerPeriodRange is already total recovery (rate × periods computed in engine)
      return {
        satiety: [sat - pv.satietyCostRange[1] + pv.satietyRestoredRange[0], sat - pv.satietyCostRange[0] + pv.satietyRestoredRange[1]] as [number, number],
        stamina: [sta - pv.staminaCostRange[1] + pv.staminaRecoveryPerPeriodRange[0], sta - pv.staminaCostRange[0] + pv.staminaRecoveryPerPeriodRange[1]] as [number, number],
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
  function hubBtnStyle(kind: "explore" | "findFood" | "layDown" | "craft" | "fight"): React.CSSProperties {
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
    if (kind === "fight") {
      return { ...base, background: "#1a0a1a", border: "1px solid #9c27b0", color: "#ce93d8" };
    }
    return base;
  }

  const hub = (
    <div className="card">
      {/* Nudge bar — shows on HUB only, guides player to next action */}
      {(() => {
        const nudge = getNudgeText(markState, player, !!(activePoi && activeBlot));
        if (!nudge) return null;
        return (
          <div
            onClick={() => openMetaScreen("MARKS")}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#0e1218", border: "1px solid #2a3a2a",
              borderLeft: "3px solid #7ecba160",
              borderRadius: 9, padding: "9px 12px", marginBottom: 14,
              cursor: "pointer", transition: "border-color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderLeftColor = "#7ecba1aa")}
            onMouseLeave={e => (e.currentTarget.style.borderLeftColor = "#7ecba160")}
          >
            <span style={{ fontSize: "0.75rem", opacity: 0.45, flexShrink: 0 }}>▸</span>
            <span style={{ fontSize: "0.82rem", color: "#b0d4b8", flex: 1, lineHeight: 1.4 }}>{nudge}</span>
            <span style={{ fontSize: "0.68rem", opacity: 0.3, flexShrink: 0, letterSpacing: "0.06em" }}>MARKS</span>
          </div>
        );
      })()}
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
                // Tool ranking display
                const poiMethodRank = POIS[activePoi.id].methodRank ?? {};
                const tierOrder = ["best", "good", "ok", "weak", "veryWeak", "wasteful"];
                const tierLabels: Record<string, string> = { best: "Best", good: "Good", ok: "Ok", weak: "Weak", veryWeak: "Very Weak", wasteful: "Wasteful" };
                const tierColors: Record<string, string> = { best: "#7ecba1", good: "#a8d4a8", ok: "#c8c8a0", weak: "#c8a96e", veryWeak: "#c87850", wasteful: "#a05040" };
                const discoveredMethods = new Set(player.toolDiscovery[activePoi.id] ?? []);
                // All tiers that exist at this POI, sorted by tier order
                const rankedEntries = tierOrder
                  .flatMap(tier => {
                    const entries = (Object.entries(poiMethodRank) as [HarvestMethodId, string][]).filter(([, v]) => v === tier);
                    return entries.map(([method]) => {
                      const tool = Object.values(ITEMS).find(it => it.harvestingMethod === method);
                      const discovered = discoveredMethods.has(method);
                      return { tier, method, tool, discovered };
                    });
                  })
                  .filter(Boolean) as { tier: string; method: HarvestMethodId; tool: { name: string; id: string } | undefined; discovered: boolean }[];
                return (
                  <>
                    <p className="small" style={{ marginBottom: 8, fontStyle: "italic" }}>{depletionFlavour}</p>
                    {charges > 0 && (
                      <>
                        {rankedEntries.length > 0 && (
                          <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 3 }}>
                            {rankedEntries.map(({ tier, tool, discovered }) => (
                              <div key={tier} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.78rem" }}>
                                <span style={{ width: 64, textAlign: "right", opacity: discovered ? 1 : 0.35, color: discovered ? tierColors[tier] : "#888", fontWeight: 600 }}>
                                  {discovered ? tierLabels[tier] : "???"}
                                </span>
                                <span style={{ opacity: 0.25, fontSize: "0.65rem" }}>▸</span>
                                <span style={{ opacity: discovered ? 0.85 : 0.3, fontStyle: discovered ? "normal" : "italic" }}>
                                  {discovered ? (tool?.name ?? "—") : "not yet tried"}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
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
      {markState.gateDiscovered && (
        <div className="row" style={{ marginTop: 8 }}>
          <button
            style={{
              padding: "10px 18px", borderRadius: 10, fontSize: "0.9rem", fontWeight: 600,
              border: markState.gateUnlocked ? "1px solid #7ecba1" : "1px solid #3a2a4a",
              background: markState.gateUnlocked ? "#0a1a14" : "#120d1a",
              color: markState.gateUnlocked ? "#7ecba1" : "#9e8ab0",
              cursor: "pointer",
            }}
            onClick={() => setScreen("GATE")}
          >
            {markState.gateUnlocked ? "⊳ The Filament Gate (Open)" : "⊳ The Filament Gate"}
          </button>
        </div>
      )}

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
          {journeyPreview.mothEncountered && <>
            <div>Wild Creature</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CreatureIcon creatureId="creature_gloop_moth" size={28} />
              <span style={{ color: "#ce93d8" }}>Gloop Moth spotted</span>
            </div>
          </>}
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

      {/* Moth encounter line */}
      {(journeyResult.mothEncountered || journeyResult.mothDefeated) && (
        <FadeIn delay={510}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: journeyResult.mothDefeated ? "#0a120a" : "#0e0814", border: `1px solid ${journeyResult.mothDefeated ? "#2e5c2e" : "#4a1e6a"}`, borderRadius: 10, padding: "10px 14px" }}>
            <CreatureIcon creatureId="creature_gloop_moth" size={36} />
            <div>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: journeyResult.mothDefeated ? "#81c784" : "#ce93d8" }}>
                {journeyResult.mothDefeated ? "Wild Creature — remains left behind" : "Wild Creature encountered!"}
              </div>
              <div style={{ fontSize: "0.75rem", opacity: 0.55, marginTop: 2 }}>
                {journeyResult.mothDefeated ? "Something was here. It isn't anymore." : "A Gloop Moth is feeding nearby."}
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={540}>
        {journeyResult.mothEncountered && journeyResult.outcome === "ok" ? (
          <>
            <div className="row" style={{ marginTop: 12 }}>
              <button
                className="btn"
                style={{ background: "#1a0a1a", border: "2px solid #9c27b0", color: "#ce93d8", fontWeight: 700, padding: "12px 22px" }}
                onClick={huntCreatureFromJourney}
              >Hunt Creature</button>
              <button
                className="btn"
                style={{ opacity: 0.7, padding: "12px 22px" }}
                onClick={avoidCreature}
              >Avoid Creature</button>
            </div>
            <div style={{ marginTop: 6, fontSize: "0.73rem", opacity: 0.38, textAlign: "center" }}>
              Avoiding costs −20 stamina
            </div>
          </>
        ) : (
          <div style={{ marginTop: 12 }}>
            {/* Gate encounter pending */}
            {gateEncounterPending && !markState.gateDiscovered && (
              <div style={{ background: "#0d0d18", border: "1px solid #3a2a5a", borderLeft: "3px solid #7b5ea7", borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: "0.68rem", opacity: 0.5, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Something unusual</div>
                <p style={{ fontStyle: "italic", opacity: 0.85, marginBottom: 10, fontSize: "0.9rem" }}>
                  On the way back, you sense something you haven't before — thin vertical structures in the resin, arranged in an arch. Filaments, ending in hollow sockets. The smell is unlike anything here.
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    style={{ padding: "9px 16px", borderRadius: 9, fontSize: "0.88rem", fontWeight: 700, border: "1px solid #7b5ea7", background: "#1a0d2e", color: "#c8a8e8", cursor: "pointer" }}
                    onClick={discoverGate}
                  >
                    Investigate the arch
                  </button>
                  <button
                    style={{ padding: "9px 16px", borderRadius: 9, fontSize: "0.88rem", border: "1px solid #333", background: "#141414", color: "#888", cursor: "pointer" }}
                    onClick={() => { setGateEncounterPending(false); }}
                  >
                    Keep moving
                  </button>
                </div>
              </div>
            )}
            <div className="row">
              <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={enterPoi} disabled={journeyResult.outcome !== "ok"}>Arrive</button>
            </div>
          </div>
        )}

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
              {/* Header: tool name + flavour */}
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>{tool ? tool.name : res.method}</h3>
                <p className="small" style={{ margin: 0, opacity: 0.55 }}>{flavour[effLabel] ?? ""}</p>
              </div>

              {/* Section: Harvest */}
              <p className="small" style={{ margin: "0 0 4px", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.62rem" }}>Harvest</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
                {res.gained.length > 0 ? res.gained.map((g, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ position: "relative" }}>
                      <ItemIcon id={g.id as string} size={18} />
                      {j === 0 && <FlyToInventory id={g.id as string} delay={300 + i * 100} />}
                    </div>
                    <span className="small">{(g.id as string).startsWith("food_") ? getFoodName(g.id as any) : getResourceName(g.id as any)} ×{g.qty}</span>
                  </div>
                )) : <span className="small" style={{ opacity: 0.4 }}>Nothing gained</span>}
              </div>

              {/* Section: Proficiency */}
              <p className="small" style={{ margin: "0 0 4px", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.62rem" }}>Proficiency</p>
              <div style={{ marginBottom: 12 }}>
                <MiniXPBar method={res.method} xpBefore={xpBefore} xpAfter={xpAfter} />
              </div>

              {/* Section: Cost */}
              <p className="small" style={{ margin: "0 0 4px", opacity: 0.4, textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.62rem" }}>Cost</p>
              {res.foodConsumed.length > 0 && (
                <p className="small" style={{ marginBottom: 2 }}>Chomper snacked: {formatConsumed(res.foodConsumed)}</p>
              )}
              <div>
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
      {/* ── Gem-Embedded Trophy crafting ── */}
      {markState.gateDiscovered && (() => {
        const gemIds = Object.keys(GEM_TROPHY_RECIPES) as GemTrophyItemId[];
        const availableGems = gemIds.filter(gemId => {
          const recipe = GEM_TROPHY_RECIPES[gemId];
          return (invGet(player.inventory, recipe.trophyInput)?.qty ?? 0) >= 1;
        });
        if (availableGems.length === 0) return null;
        return (
          <div style={{ marginTop: 16, borderTop: "1px solid #2a2a2a", paddingTop: 14 }}>
            <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Passage Trophies</div>
            <p className="small" style={{ opacity: 0.5, marginBottom: 10 }}>Embed your trophies and markers into passage-worthy gems. Requires Resin Glob per marker embedded.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {availableGems.map(gemId => {
                const recipe = GEM_TROPHY_RECIPES[gemId];
                const cat = recipe.category;
                const catColor = CATEGORY_COLOR[cat];
                const can = canCraftGemTrophy(gemId);
                const hasTinker = hasEquippedTail(player, "eq_tinker_shaft");
                const alreadyHave = (invGet(player.inventory, gemId)?.qty ?? 0) > 0;
                return (
                  <div key={gemId} style={{ background: "#161616", borderRadius: 10, border: `1px solid ${can ? catColor + "40" : "#1e1e1e"}`, borderLeft: `3px solid ${can ? catColor : "#333"}`, padding: "12px 14px", opacity: alreadyHave ? 0.5 : can ? 1 : 0.6 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.92rem", color: catColor, marginBottom: 4 }}>{GEM_TROPHIES[gemId].name}</div>
                    <div style={{ fontSize: "0.75rem", opacity: 0.55, marginBottom: 8, fontStyle: "italic" }}>{GEM_TROPHIES[gemId].flavor}</div>
                    <div style={{ fontSize: "0.72rem", opacity: 0.6, marginBottom: 8 }}>
                      Needs: {TROPHIES[recipe.trophyInput].name} ×1 · {MARKERS[recipe.markerInput].name} ×{recipe.markerQty} · Resin Glob ×{recipe.resinQty} · Tinker Shaft equipped
                      <span style={{ marginLeft: 8, color: (invGet(player.inventory, recipe.trophyInput)?.qty ?? 0) >= 1 ? catColor : "#666" }}>
                        Trophy: {invGet(player.inventory, recipe.trophyInput)?.qty ?? 0}
                      </span>
                      <span style={{ marginLeft: 6, color: (invGet(player.inventory, recipe.markerInput)?.qty ?? 0) >= recipe.markerQty ? catColor : "#666" }}>
                        Markers: {invGet(player.inventory, recipe.markerInput)?.qty ?? 0}/{recipe.markerQty}
                      </span>
                      <span style={{ marginLeft: 6, color: (invGet(player.inventory, "resin_glob")?.qty ?? 0) >= recipe.resinQty ? catColor : "#666" }}>
                        Resin: {invGet(player.inventory, "resin_glob")?.qty ?? 0}/{recipe.resinQty}
                      </span>
                      <span style={{ marginLeft: 6, color: hasTinker ? catColor : "#666" }}>
                        {hasTinker ? "✓ Tinker Shaft" : "✗ Tinker Shaft"}
                      </span>
                    </div>
                    {alreadyHave ? (
                      <div style={{ fontSize: "0.78rem", color: catColor, opacity: 0.6 }}>✓ Already crafted</div>
                    ) : (
                      <button
                        disabled={!can}
                        onClick={() => craftGemTrophy(gemId)}
                        style={{ padding: "8px 18px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, border: can ? `1px solid ${catColor}` : "1px solid #333", background: can ? catColor + "18" : "#141414", color: can ? catColor : "#444", cursor: can ? "pointer" : "not-allowed" }}
                      >
                        {can ? "Embed" : "Missing materials"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
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
        <button ref={craftButtonRef} className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px", boxShadow: "0 0 10px rgba(78,200,120,0.35), 0 0 3px rgba(78,200,120,0.2)" }} onClick={proceedCraft} disabled={dead || exhausted}>Yes!</button>
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
          <button className="btn" onClick={() => { playSfx("sfx_wake_up"); gotoHub(); }}>Get up</button>
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
                const toolType = item.slot === "tail"
                  ? (item.harvestingMethod ? "Harvesting Type"
                    : id === "eq_tail_curler" ? "Recovery Type"
                    : id === "eq_chomper" ? "Consumption Type"
                    : id === "eq_tinker_shaft" ? "Crafting Type"
                    : null)
                  : null;
                const equipped = player.equipment.tailSlots.includes(id) || player.equipment.shoe === id;
                const subtitle = [slot, toolType, equipped ? "equipped" : null].filter(Boolean).join(" · ");
                return (
                  <div key={id} style={{ background: "#161616", borderRadius: 10, border: "1px solid #2a2a2a", borderLeft: "3px solid #c8a96e", marginBottom: 6, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }} onClick={() => setExpandedItem(isExpanded ? null : id)}>
                      <ItemIcon id={id} size={20} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{item.name}</div>
                        <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: 2 }}>{subtitle}</div>
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
          const resources = player.inventory.filter(s => {
            const sid = s.id as string;
            return !(sid.startsWith("eq_") || sid.startsWith("food_") || sid.startsWith("trophy_") || sid.startsWith("marker_") || sid.startsWith("gem_trophy_"));
          });
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

        {/* Trophies & Markers */}
        {(() => {
          const progressionItems = player.inventory.filter(s => {
            const sid = s.id as string;
            return sid.startsWith("trophy_") || sid.startsWith("marker_") || sid.startsWith("gem_trophy_");
          });
          if (!progressionItems.length) return null;
          return (
            <div>
              <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Trophies & Markers</div>
              {progressionItems.map(s => {
                const sid = s.id as string;
                const isExpanded = expandedItem === sid;
                let itemDef: import("./gameData").ProgressionItemDef | undefined;
                let catColor = "#888";
                if (sid.startsWith("gem_trophy_")) {
                  itemDef = GEM_TROPHIES[sid as import("./types").GemTrophyItemId];
                } else if (sid.startsWith("trophy_")) {
                  itemDef = TROPHIES[sid as import("./types").TrophyItemId];
                } else if (sid.startsWith("marker_")) {
                  itemDef = MARKERS[sid as import("./types").MarkerItemId];
                }
                if (itemDef?.category) catColor = CATEGORY_COLOR[itemDef.category] ?? "#888";
                const isTrophy = sid.startsWith("trophy_");
                const isGem = sid.startsWith("gem_trophy_");
                const accentColor = isGem ? catColor : isTrophy ? catColor : catColor + "bb";
                const borderLeft = isGem ? `3px solid ${catColor}` : isTrophy ? `3px solid ${catColor}80` : `3px solid ${catColor}50`;
                return (
                  <div key={sid} style={{ background: "#161616", borderRadius: 10, border: `1px solid ${catColor}30`, borderLeft, marginBottom: 6, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", cursor: "pointer" }} onClick={() => setExpandedItem(isExpanded ? null : sid)}>
                      <ItemIcon id={sid} size={20} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: accentColor }}>{itemDef?.name ?? sid}</div>
                        <div style={{ fontSize: "0.72rem", opacity: 0.45, marginTop: 2 }}>
                          {isGem ? "Gem Trophy · " : isTrophy ? "Trophy · " : "Marker · "}{itemDef?.category}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.5, padding: "3px 8px", background: "#1e1e1e", borderRadius: 6 }}>×{s.qty}</div>
                      <div style={{ fontSize: "0.7rem", opacity: 0.35 }}>{isExpanded ? "▲" : "▼"}</div>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: "0 14px 12px", fontSize: "0.82rem", opacity: 0.65, fontStyle: "italic", borderTop: "1px solid #1e1e1e", paddingTop: 10, color: accentColor }}>
                        {itemDef?.flavor}
                      </div>
                    )}
                  </div>
                );
              })}
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

  // ── Blot Marks screen ────────────────────────────────────────────────────
  const marksScreen = (() => {
    const categories: BlotMarkCategory[] = ["Exploration", "Harvesting", "Crafting", "Survival", "Combat", "Loot"];
    const earnedCount = Object.keys(markState.earned).length;

    return (
      <div style={{ background: "#111", borderRadius: 14, border: "1px solid #2a2a2a", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid #2a2a2a", background: "#0e0e0e" }}>
          <button onClick={backFromMeta} style={{ background: "none", border: "none", color: "#ce93d8", cursor: "pointer", fontSize: "0.9rem", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>← Back</button>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, letterSpacing: "0.05em" }}>Blot Marks</div>
          <div style={{ marginLeft: "auto", fontSize: "0.78rem", opacity: 0.4 }}>{earnedCount} / {BLOT_MARK_ORDER.length}</div>
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 18 }}>
          {categories.map(cat => {
            const catMarks = BLOT_MARK_ORDER.filter(id => BLOT_MARKS[id].category === cat);
            const catColor = CATEGORY_COLOR[cat];
            return (
              <div key={cat}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ color: catColor, opacity: 0.85 }}>
                    <BlotMarkCategoryIcon category={cat} size={16} />
                  </div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: catColor, opacity: 0.7 }}>{cat}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {catMarks.map(id => {
                    const isEarned = !!markState.earned[id];
                    const isRevealed = !!markState.revealed[id];
                    const isNewReveal = newRevealIds.includes(id);
                    const isExpanded = expandedMark === id;
                    const hasUnclaimed = isEarned && !markState.claimedMarkers?.[id];

                    if (!isRevealed) {
                      return (
                        <div key={id} style={{
                          display: "flex", alignItems: "center", gap: 10,
                          background: "#0e0e0e", borderRadius: 9, border: "1px solid #1e1e1e",
                          padding: "10px 14px", opacity: 0.35,
                        }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: "0.9rem", opacity: 0.4 }}>?</span>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.03em", color: "#444" }}>???</div>
                            <div style={{ fontSize: "0.68rem", color: catColor, opacity: 0.4, marginTop: 1 }}>{cat}</div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={id} style={{
                        background: isEarned ? "#0e1a0e" : "#131313",
                        borderRadius: 9,
                        border: `1px solid ${isEarned ? catColor + "50" : "#252525"}`,
                        borderLeft: `3px solid ${isEarned ? catColor : isExpanded ? "#555" : "#2a2a2a"}`,
                        transition: "border-color 0.2s, box-shadow 0.2s",
                        overflow: "hidden",
                        animation: isNewReveal ? "markRevealFadeIn 0.6s ease both" : undefined,
                        boxShadow: hasUnclaimed ? `0 0 8px ${catColor}40, 0 0 2px ${catColor}30` : undefined,
                      }}>
                        {/* Clickable header row */}
                        <div
                          onClick={() => setExpandedMark(isExpanded ? null : id)}
                          style={{
                            display: "flex", alignItems: "flex-start", gap: 10,
                            padding: "10px 14px", cursor: "pointer",
                          }}
                        >
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                            background: isEarned ? catColor + "22" : "#1a1a1a",
                            border: `1px solid ${isEarned ? catColor + "80" : "#2a2a2a"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: isEarned ? catColor : "#444",
                          }}>
                            {isEarned
                              ? <BlotMarkCategoryIcon category={cat} size={15} />
                              : <span style={{ fontSize: "0.75rem", opacity: 0.4 }}>○</span>
                            }
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.88rem", fontWeight: 700, color: isEarned ? catColor : "#888", marginBottom: 2 }}>
                              {BLOT_MARKS[id].title}
                            </div>
                            <div style={{ fontSize: "0.75rem", opacity: isEarned ? 0.65 : 0.4, fontStyle: "italic", lineHeight: 1.4 }}>
                              {BLOT_MARKS[id].flavour}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginTop: 4 }}>
                            {isEarned && <span style={{ fontSize: "0.75rem", color: catColor, opacity: 0.6, fontWeight: 700 }}>✓</span>}
                            <span style={{
                              fontSize: "0.7rem", opacity: 0.3, transition: "transform 0.2s",
                              display: "inline-block", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                            }}>▶</span>
                          </div>
                        </div>

                        {/* Expandable how-to section */}
                        {isExpanded && (
                          <div style={{
                            padding: "0 14px 12px 52px",
                            animation: "markRevealFadeIn 0.2s ease both",
                          }}>
                            <div style={{
                              fontSize: "0.78rem", color: isEarned ? catColor : "#aaa",
                              opacity: isEarned ? 0.85 : 0.7,
                              lineHeight: 1.55,
                              borderTop: `1px solid ${isEarned ? catColor + "20" : "#2a2a2a"}`,
                              paddingTop: 10,
                            }}>
                              {isEarned
                                ? <span style={{ opacity: 0.5, marginRight: 6 }}>✓ Earned —</span>
                                : null
                              }
                              {BLOT_MARK_HOW[id]}
                            </div>
                            {/* Claim button */}
                            {isEarned && !markState.claimedMarkers?.[id] && (() => {
                              const gateMarkId = CATEGORY_GATE_MARK[cat] as BlotMarkId;
                              const isTrophy = id === gateMarkId;
                              return (
                                <button
                                  onClick={(e) => { e.stopPropagation(); claimMarker(id); }}
                                  style={{
                                    marginTop: 10,
                                    padding: "7px 14px", borderRadius: 8, fontSize: "0.8rem",
                                    border: `1px solid ${isTrophy ? catColor : catColor + "80"}`,
                                    background: isTrophy ? catColor + "22" : catColor + "11",
                                    color: catColor, cursor: "pointer", fontWeight: 600,
                                    display: "flex", alignItems: "center", gap: 6,
                                  }}
                                >
                                  <span>{isTrophy ? "🏆" : "◆"}</span>
                                  <span>{isTrophy ? `Claim ${TROPHIES[CATEGORY_TROPHY[cat]].name}` : `Claim ${MARKERS[CATEGORY_MARKER[cat]].name}`}</span>
                                </button>
                              );
                            })()}
                            {isEarned && markState.claimedMarkers?.[id] && (() => {
                              const gateMarkId = CATEGORY_GATE_MARK[cat] as BlotMarkId;
                              const isTrophy = id === gateMarkId;
                              return (
                                <div style={{ marginTop: 8, fontSize: "0.75rem", opacity: 0.4, fontStyle: "italic" }}>
                                  {isTrophy ? "Trophy collected." : "Marker collected."}
                                </div>
                              );
                            })()}
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
      </div>
    );
  })();

  // ── Battle screen ─────────────────────────────────────────────────────────
  const battleScreen = battleState && (() => {
    const creature = CREATURES[battleState.creatureId];
    const availableMoveIds = getAvailableMoves(battleState, player);
    const composurePct = (battleState.composure / creature.composureMax) * 100;
    const integrityPct = (battleState.integrity / creature.integrityMax) * 100;

    return (
      <div className="card">
        <FadeIn delay={0}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0 }}>{creature.name}</h2>
              <div style={{ fontSize: "0.8rem", opacity: 0.5, marginTop: 2 }}>Turn {battleState.turn}</div>
            </div>
            <div style={{ fontSize: "0.75rem", opacity: 0.4 }}>
              Moves used: {battleState.movesUsed.length} unique
              {battleState.doubleCombosLanded > 0 && <span style={{ color: "#ce93d8", marginLeft: 8 }}>✦ {battleState.doubleCombosLanded} combo</span>}
            </div>
          </div>
        </FadeIn>

        {/* Creature status bars */}
        <FadeIn delay={60}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
              <span style={{ opacity: 0.6 }}>Composure</span>
              <span>{battleState.composure} / {creature.composureMax}</span>
            </div>
            <div style={{ height: 10, background: "#111", borderRadius: 5, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: `${composurePct}%`, background: composurePct > 50 ? "#7c4dff" : composurePct > 25 ? "#ff9800" : "#f44336", borderRadius: 5, transition: "width 0.4s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4 }}>
              <span style={{ opacity: 0.6 }}>Integrity</span>
              <span>{battleState.integrity} / {creature.integrityMax}</span>
            </div>
            <div style={{ height: 6, background: "#111", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${integrityPct}%`, background: integrityPct > 60 ? "#4caf50" : integrityPct > 30 ? "#ff9800" : "#f44336", borderRadius: 3, transition: "width 0.4s ease" }} />
            </div>
          </div>
        </FadeIn>

        {/* Situation hint */}
        <FadeIn delay={120}>
          <div style={{ background: "#0e0e0e", border: "1px solid #2a2a2a", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: "0.68rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Situation</div>
            <div style={{ fontStyle: "italic", opacity: 0.85 }}>{getSituationText(battleState.situation, battleState.turn)}</div>
          </div>
        </FadeIn>

        {/* Active flags */}
        {battleState.flags.filter(f => f !== "wax_intact").length > 0 && (
          <FadeIn delay={150}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {battleState.flags.filter(f => f !== "wax_intact").map(f => (
                <span key={f} style={{ fontSize: "0.7rem", padding: "3px 8px", background: "#1a1020", border: "1px solid #4a2060", borderRadius: 20, color: "#ce93d8", opacity: 0.85 }}>
                  {f.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Last move log */}
        {battleLog.length > 0 && (
          <FadeIn delay={100}>
            <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: 12, fontStyle: "italic" }}>
              {battleLog.join(" · ")}
            </div>
          </FadeIn>
        )}

        {/* Move buttons */}
        <FadeIn delay={180}>
          <div style={{ fontSize: "0.68rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Your move</div>
          {/* Hint if no harvesting tools equipped */}
          {availableMoveIds.filter(m => MOVES[m].tools.length > 0).length === 0 && (
            <div style={{ background: "#1a1208", border: "1px solid #5c4000", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: "0.82rem", color: "#c8a96e", fontStyle: "italic" }}>
              No harvesting tools equipped. The ones you use out there — twig, comb, scoop — they work here too. Equip something before you hunt.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {availableMoveIds.map((moveId) => {
              const move = MOVES[moveId];
              const isDouble = move.tools.length === 2;
              const isFlee = moveId === "flee";
              const isConsume = moveId === "eat_wax_raw" || moveId === "eat_soft_tissue";
              const borderColor = isFlee ? "#555" : isDouble ? "#9c27b0" : isConsume ? "#2e7d32" : "#2a2a2a";
              const bgColor = isFlee ? "#111" : isDouble ? "#1a0a1a" : isConsume ? "#0a1a0a" : "#161616";
              const textColor = isFlee ? "#888" : isDouble ? "#ce93d8" : isConsume ? "#81c784" : "#eaeaea";
              return (
                <button
                  key={moveId}
                  onClick={() => doMove(moveId)}
                  style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 10, color: textColor, padding: "10px 14px", cursor: "pointer", textAlign: "left", fontSize: "0.9rem" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{move.label}</span>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {move.tools.map((t, i) => <ItemIcon key={i} id={t} size={16} />)}
                      {isDouble && <span style={{ fontSize: "0.65rem", color: "#9c27b0", marginLeft: 2 }}>COMBO</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.72rem", opacity: 0.5, marginTop: 3 }}>
                    {move.effect.staminaRestore ? `+${move.effect.staminaRestore} stamina` :
                     move.effect.satietyRestore ? `+${move.effect.satietyRestore} satiety` :
                     move.effect.staminaCost > 0 ? `−${move.effect.staminaCost} stamina` : "no stamina cost"}
                    {move.effect.composureDelta[0] > 0 && ` · −${move.effect.composureDelta[0]}–${move.effect.composureDelta[1]} composure`}
                    {move.effect.integrityDelta < 0 && ` · ${move.effect.integrityDelta} integrity`}
                  </div>
                </button>
              );
            })}
          </div>
        </FadeIn>

        {/* Mid-battle drops so far */}
        {battleState.midBattleDrops.length > 0 && (
          <FadeIn delay={240}>
            <div style={{ marginTop: 16, background: "#0a120a", border: "1px solid #1e3a1e", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: "0.68rem", opacity: 0.5, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Collected so far</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {battleState.midBattleDrops.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <ItemIcon id={d.id} size={18} />
                    <span style={{ fontSize: "0.82rem" }}>
                      {d.id.startsWith("food_") ? FOODS[d.id as import("./types").FoodId]?.name : RESOURCES[d.id as import("./types").ResourceId]?.name} ×{d.qty}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}
      </div>
    );
  })();

  // ── Battle summary screen ──────────────────────────────────────────────────
  const battleSummaryScreen = battleResult && (() => {
    const creature = CREATURES[battleResult.creatureId];
    const noveltyRefundPct = battleResult.doubleCombosLanded > 0 || battleResult.movesUsed.length >= 4 ? 60 : battleResult.movesUsed.length >= 2 ? 30 : 0;
    const endLabels: Record<string, string> = { collapsed: "Collapsed", disarmed: "Disarmed", fled: "You fled" };

    // Novelty flavour — explains the stamina refund in-world
    const noveltyFlavour =
      (battleResult.doubleCombosLanded > 0 || battleResult.movesUsed.length >= 4)
        ? "You surprised yourself out there. The variety, the combos — something clicked. You feel more alive than tired."
        : battleResult.movesUsed.length >= 2
        ? "Keeping it interesting helped. You're not as worn out as you might've been."
        : battleResult.endReason !== "fled"
        ? "You did what worked and nothing else. Effective. Efficient. Exactly as exhausting as it sounds."
        : null;

    // Net stamina label — show gain if stamina refund exceeded cost
    const staminaGain = battleResult.netStaminaCost <= 0;

    // Integrity body description — hints at drop quality and what higher integrity would have given
    const integ = battleResult.finalIntegrity;
    const integrityFlavour =
      battleResult.endReason === "fled"
        ? null
        : integ >= 80
        ? "The body is remarkably intact. You were precise. Everything worth taking is still here."
        : integ >= 60
        ? "Mostly intact. A little rough around the edges, but the good parts survived."
        : integ >= 40
        ? "It's seen better moments. Some of what you could've taken is gone. More care might have kept it."
        : integ >= 20
        ? "Not much left to work with. The body took a beating — whatever was harvestable didn't make it. A gentler approach would have mattered."
        : "Almost nothing salvageable. What was once harvestable is now just mess. The moth deserved better, and so did you.";

    return (
      <div className="card">
        <FadeIn delay={0}>
          <h2 style={{ marginBottom: 4 }}>
            {battleResult.endReason === "fled" ? "You got out." : `${creature.name} — ${endLabels[battleResult.endReason]}`}
          </h2>
          <div style={{ fontSize: "0.8rem", opacity: 0.5 }}>
            {noveltyRefundPct === 0 && battleResult.endReason !== "fled" && (
              <>{battleResult.movesUsed.length} unique move{battleResult.movesUsed.length !== 1 ? "s" : ""}
              {battleResult.doubleCombosLanded > 0 && ` · ${battleResult.doubleCombosLanded} combo${battleResult.doubleCombosLanded > 1 ? "s" : ""} landed`}</>
            )}
          </div>
        </FadeIn>

        {/* Novelty flavour + stamina result */}
        {noveltyFlavour && (
          <FadeIn delay={60}>
            <div style={{
              background: noveltyRefundPct > 0 ? "#120a1a" : "#0e0e0e",
              border: `1px solid ${noveltyRefundPct > 0 ? "#4a1e6a" : "#222"}`,
              borderRadius: 10, padding: "12px 16px", marginTop: 12, marginBottom: 4
            }}>
              <div style={{ fontStyle: "italic", fontSize: "0.85rem", color: noveltyRefundPct > 0 ? "#ce93d8" : "#666", marginBottom: noveltyRefundPct > 0 ? 8 : 0 }}>
                {noveltyFlavour}
              </div>
              {noveltyRefundPct > 0 && (
                <div style={{ fontSize: "0.78rem", color: "#ce93d8", opacity: 0.8, marginTop: 8 }}>
                  {battleResult.movesUsed.length} unique move{battleResult.movesUsed.length !== 1 ? "s" : ""}
                  {battleResult.doubleCombosLanded > 0 && ` · ${battleResult.doubleCombosLanded} combo${battleResult.doubleCombosLanded > 1 ? "s" : ""}`}
                  {" · "}{noveltyRefundPct}% stamina refunded
                </div>
              )}
            </div>
          </FadeIn>
        )}

        {/* Final creature state */}
        <FadeIn delay={90}>
          <div className="kv" style={{ marginBottom: 4, marginTop: 12 }}>
            <div style={{ opacity: 0.6 }}>Net stamina</div>
            <div style={{ color: staminaGain ? "#81c784" : "#ff8a80", fontWeight: 600 }}>
              {staminaGain ? `+${Math.abs(battleResult.netStaminaCost)} recovered` : `−${battleResult.netStaminaCost}`}
            </div>
            {battleResult.satietyRestoredMidBattle > 0 && <>
              <div style={{ opacity: 0.6 }}>Satiety mid-battle</div>
              <div style={{ color: "#7ecba1" }}>+{battleResult.satietyRestoredMidBattle}</div>
            </>}
            {battleResult.staminaRestoredMidBattle > 0 && <>
              <div style={{ opacity: 0.6 }}>Stamina mid-battle</div>
              <div style={{ color: "#7ecba1" }}>+{battleResult.staminaRestoredMidBattle}</div>
            </>}
          </div>
        </FadeIn>

        {battleResult.foodContaminated && (
          <FadeIn delay={150}>
            <div style={{ background: "#1f0a0a", border: "1px solid #b71c1c", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: "0.82rem", color: "#ff8a80" }}>
              Wax splattered on your food stores. Freshness reduced.
            </div>
          </FadeIn>
        )}

        {/* Mid-battle drops */}
        {battleResult.midBattleDrops.length > 0 && (
          <FadeIn delay={210}>
            <div className="card" style={{ marginBottom: 10 }}>
              <h3>Collected mid-battle</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {battleResult.midBattleDrops.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                      <ItemIcon id={d.id} size={22} />
                      <FlyToInventory id={d.id} delay={300 + i * 100} />
                    </div>
                    <span className="small">
                      {d.id.startsWith("food_") ? FOODS[d.id as import("./types").FoodId]?.name : RESOURCES[d.id as import("./types").ResourceId]?.name} ×{d.qty}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}

        {/* Corpse drops */}
        {battleResult.corpseDrops.length > 0 && (
          <FadeIn delay={300}>
            <div className="card" style={{ marginBottom: 10 }}>
              <h3>From the corpse</h3>
              {integrityFlavour && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontStyle: "italic", fontSize: "0.82rem", opacity: 0.65, marginBottom: 4 }}>
                    {integrityFlavour}
                  </div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.35, marginBottom: 8 }}>
                    Integrity {battleResult.finalIntegrity} / {creature.integrityMax}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {battleResult.corpseDrops.map((d, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ position: "relative" }}>
                      <ItemIcon id={d.id} size={22} />
                      <FlyToInventory id={d.id} delay={500 + i * 100} />
                    </div>
                    <span className="small">
                      {d.id.startsWith("food_") ? FOODS[d.id as import("./types").FoodId]?.name : RESOURCES[d.id as import("./types").ResourceId]?.name} ×{d.qty}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}

        {/* Nothing dropped */}
        {battleResult.midBattleDrops.length === 0 && battleResult.corpseDrops.length === 0 && (
          <FadeIn delay={210}>
            <div style={{ opacity: 0.5, fontStyle: "italic", fontSize: "0.85rem", marginBottom: 12 }}>Nothing to show for it.</div>
          </FadeIn>
        )}

        <FadeIn delay={400}>
          <div className="row">
            <button className="btn" style={{ background: "#1a2e1a", border: "1px solid #4caf50", color: "#7ecba1", fontWeight: 600, padding: "12px 22px" }} onClick={() => {
              if (returnScreen === "SUMMARY_JOURNEY" && journeyResult) {
                setJourneyResult({ ...journeyResult, mothEncountered: false, mothDefeated: true });
                setBattleResult(null);
                setReturnScreen("HUB");
                setScreen("SUMMARY_JOURNEY");
              } else {
                setBattleResult(null);
                gotoHub();
              }
            }}>Back to it</button>
          </div>
        </FadeIn>
      </div>
    );
  })();

  // ── Screen routing ────────────────────────────────────────────────────────

  // ── Gate screen ───────────────────────────────────────────────────────────
  const gateScreen = (() => {
    const slotted = markState.gateSlottedTrophies ?? [];
    const required = GATE_REQUIRED_GEM_TROPHIES;
    const allRequired = required.every(id => slotted.includes(id));

    const liquidatableItems = Object.keys(BIOMASS_VALUES).filter(id => {
      const qty = invGet(player.inventory, id as import("./types").ResourceId)?.qty ?? 0;
      return qty > 0;
    });

    return (
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={() => setScreen("HUB")} style={{ background: "none", border: "none", color: "#9e8ab0", cursor: "pointer", fontSize: "0.9rem", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>← Back</button>
          <h2 style={{ margin: 0 }}>The Filament Gate</h2>
        </div>

        <div style={{ background: "#0d0d18", border: "1px solid #3a2a5a", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontStyle: "italic", opacity: 0.8, margin: 0, lineHeight: 1.6, fontSize: "0.9rem" }}>
            Thin upright filaments in an arch, each ending in a socket. Three sockets glow faintly. It doesn't fit the biome. It releases pheromones you can smell from anywhere.
          </p>
        </div>

        {/* Trophy slots — required 3 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Required Sockets</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {required.map(gemId => {
              const isSlotted = slotted.includes(gemId);
              const recipe = GEM_TROPHY_RECIPES[gemId];
              const catColor = CATEGORY_COLOR[recipe.category];
              const hasInInventory = (invGet(player.inventory, gemId)?.qty ?? 0) >= 1;
              return (
                <div key={gemId} style={{
                  background: isSlotted ? catColor + "12" : "#111",
                  border: `1px solid ${isSlotted ? catColor + "60" : "#2a2a2a"}`,
                  borderLeft: `3px solid ${isSlotted ? catColor : "#333"}`,
                  borderRadius: 10, padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: isSlotted ? catColor : "#888", fontSize: "0.92rem", marginBottom: 2 }}>
                      {GEM_TROPHIES[gemId].name}
                    </div>
                    {isSlotted ? (
                      <div style={{ fontSize: "0.75rem", color: catColor, opacity: 0.7 }}>✓ Seated in the socket</div>
                    ) : hasInInventory ? (
                      <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>In your inventory — ready to slot</div>
                    ) : (
                      <div style={{ fontSize: "0.75rem", opacity: 0.4, fontStyle: "italic" }}>
                        {(invGet(player.inventory, recipe.trophyInput)?.qty ?? 0) === 0
                          ? `Earn the gate mark: ${recipe.category} category`
                          : `Craft via Craft menu — needs markers + resin`
                        }
                      </div>
                    )}
                  </div>
                  {!isSlotted && hasInInventory && (
                    <button
                      onClick={() => slotGemTrophy(gemId)}
                      style={{ padding: "8px 16px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, border: `1px solid ${catColor}`, background: catColor + "18", color: catColor, cursor: "pointer" }}
                    >
                      Seat it
                    </button>
                  )}
                  {isSlotted && <span style={{ fontSize: "1.2rem" }}>◆</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional trophy slots */}
        {(() => {
          const optional = Object.keys(GEM_TROPHIES).filter(id => !required.includes(id as GemTrophyItemId)) as GemTrophyItemId[];
          const hasAny = optional.some(id => (invGet(player.inventory, id)?.qty ?? 0) >= 1 || slotted.includes(id));
          if (!hasAny) return null;
          return (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Optional Sockets</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {optional.map(gemId => {
                  const isSlotted = slotted.includes(gemId);
                  const recipe = GEM_TROPHY_RECIPES[gemId];
                  const catColor = CATEGORY_COLOR[recipe.category];
                  const hasInInventory = (invGet(player.inventory, gemId)?.qty ?? 0) >= 1;
                  if (!hasInInventory && !isSlotted) return null;
                  return (
                    <div key={gemId} style={{
                      background: isSlotted ? catColor + "12" : "#111",
                      border: `1px solid ${isSlotted ? catColor + "60" : "#2a2a2a"}`,
                      borderLeft: `3px solid ${isSlotted ? catColor : "#333"}`,
                      borderRadius: 10, padding: "12px 14px",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: isSlotted ? catColor : "#888", fontSize: "0.92rem", marginBottom: 2 }}>{GEM_TROPHIES[gemId].name}</div>
                        {isSlotted ? (
                          <div style={{ fontSize: "0.75rem", color: catColor, opacity: 0.7 }}>✓ Seated</div>
                        ) : (
                          <div style={{ fontSize: "0.75rem", opacity: 0.5 }}>Optional — rewards deferred</div>
                        )}
                      </div>
                      {!isSlotted && hasInInventory && (
                        <button
                          onClick={() => slotGemTrophy(gemId)}
                          style={{ padding: "8px 16px", borderRadius: 8, fontSize: "0.85rem", fontWeight: 700, border: `1px solid ${catColor}`, background: catColor + "18", color: catColor, cursor: "pointer" }}
                        >
                          Seat it
                        </button>
                      )}
                      {isSlotted && <span style={{ fontSize: "1.2rem" }}>◆</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Activation — if all required slotted */}
        {allRequired && !markState.gateUnlocked && (
          <div style={{ background: "#0a1a14", border: "1px solid #3a5a3a", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <p style={{ fontStyle: "italic", opacity: 0.85, margin: 0, marginBottom: 12, lineHeight: 1.6, fontSize: "0.9rem" }}>
              The filaments retract into the resin. The sockets invert — they push rather than receive. A tone you feel in your back legs. The arch is open. It was waiting for proof, not permission.
            </p>
          </div>
        )}

        {allRequired && (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => setScreen("PHASE_COMPLETE")}
              style={{
                width: "100%", padding: "16px 24px", borderRadius: 12, fontSize: "1.1rem", fontWeight: 700,
                border: "2px solid #7ecba1", background: "linear-gradient(160deg, #0a2a1a 0%, #081410 100%)",
                color: "#7ecba1", cursor: "pointer", letterSpacing: "0.05em",
                boxShadow: "0 0 20px #7ecba120",
              }}
            >
              Pass through the arch
            </button>
          </div>
        )}

        {/* Biomass liquidation */}
        <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: "0.7rem", opacity: 0.4, letterSpacing: "0.12em", textTransform: "uppercase" }}>Liquidate</div>
            <div style={{ fontSize: "0.88rem", color: "#7ecba1", fontWeight: 700 }}>Biomass: {biomassTotal}</div>
          </div>
          <p className="small" style={{ opacity: 0.45, marginBottom: 10 }}>
            The Gate doesn't eat — it renders. Push items into the side channel. Comes out the other end as Biomass. You don't know why yet.
          </p>
          {liquidatableItems.length === 0 ? (
            <p className="small" style={{ opacity: 0.35, fontStyle: "italic" }}>Nothing liquidatable in inventory.</p>
          ) : (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
                {liquidatableItems.map(id => {
                  const qty = invGet(player.inventory, id as import("./types").ResourceId)?.qty ?? 0;
                  const val = BIOMASS_VALUES[id] ?? 0;
                  const name = id.startsWith("eq_") ? (ITEMS[id]?.name ?? id)
                    : id.startsWith("mat_") || id === "resin_glob" || id === "fiber_clump" || id === "brittle_stone"
                    ? (RESOURCES[id as import("./types").ResourceId]?.name ?? id) : id;
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", background: "#0e0e0e", borderRadius: 8 }}>
                      <span style={{ flex: 1, fontSize: "0.85rem" }}>{name} ×{qty}</span>
                      <span style={{ fontSize: "0.75rem", opacity: 0.5 }}>{val} each</span>
                      <button onClick={() => liquidateItem(id, 1)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: "0.75rem", border: "1px solid #3a3a3a", background: "#1a1a1a", color: "#aaa", cursor: "pointer" }}>×1 → {val}</button>
                      <button onClick={() => liquidateItem(id, qty)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: "0.75rem", border: "1px solid #3a5a3a", background: "#0e1a0e", color: "#7ecba1", cursor: "pointer" }}>All → {val * qty}</button>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={liquidateAll}
                style={{ padding: "9px 18px", borderRadius: 9, fontSize: "0.85rem", fontWeight: 600, border: "1px solid #4a4a4a", background: "#1a1a1a", color: "#ccc", cursor: "pointer" }}
              >
                Liquidate everything → +{liquidatableItems.reduce((s, id) => s + (BIOMASS_VALUES[id] ?? 0) * (invGet(player.inventory, id as import("./types").ResourceId)?.qty ?? 0), 0)} Biomass
              </button>
            </div>
          )}
        </div>
      </div>
    );
  })();

  // ── Phase Complete screen ─────────────────────────────────────────────────
  const phaseCompleteScreen = (
    <div className="card" style={{ textAlign: "center", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ fontSize: "0.75rem", opacity: 0.35, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 24 }}>Biome 2</div>
      <p style={{ fontStyle: "italic", opacity: 0.65, lineHeight: 1.8, marginBottom: 12, fontSize: "0.95rem" }}>
        The arch closes behind you.
      </p>
      <p style={{ fontStyle: "italic", opacity: 0.65, lineHeight: 1.8, marginBottom: 24, fontSize: "0.95rem" }}>
        The air here is different. You don't know what's ahead.
      </p>
      <p style={{ fontStyle: "italic", opacity: 0.4, lineHeight: 1.8, marginBottom: 32, fontSize: "0.95rem" }}>
        Neither do we — yet.
      </p>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: "1.4rem", marginBottom: 8 }}>You've completed Phase 1 of 2 Tails 3 Feet.</h2>
        <p style={{ opacity: 0.6, lineHeight: 1.7, marginBottom: 8, fontSize: "0.9rem" }}>
          This is as far as the game goes for now.
        </p>
        <p style={{ opacity: 0.6, lineHeight: 1.7, fontSize: "0.9rem" }}>
          If you made it here, you did something most players won't.
        </p>
      </div>
      <div style={{ background: "#0e1218", border: "1px solid #2a3a4a", borderRadius: 12, padding: "16px 20px", marginBottom: 32 }}>
        <p style={{ opacity: 0.8, fontWeight: 600, marginBottom: 4 }}>Contact the creator to claim your reward.</p>
        <p style={{ opacity: 0.4, fontSize: "0.85rem", fontStyle: "italic" }}>[contact detail placeholder]</p>
      </div>
      <button
        onClick={reset}
        style={{ padding: "14px 36px", borderRadius: 12, background: "#141414", border: "1px solid #3a3a3a", color: "#888", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}
      >
        Return to Start
      </button>
    </div>
  );

  // ── Screen routing ────────────────────────────────────────────────────────
  let body: React.ReactNode = null;
  if (dead) body = deadScreen;
  else if (exhausted && !["SUMMARY_JOURNEY","SUMMARY_HARVEST","SUMMARY_CRAFT","SUMMARY_RECOVER","PREVIEW_RECOVER","BATTLE","SUMMARY_BATTLE"].includes(screen))
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
      case "MARKS": body = marksScreen; break;
      case "BATTLE": body = battleScreen; break;
      case "SUMMARY_BATTLE": body = battleSummaryScreen; break;
      case "GATE": body = gateScreen; break;
      case "PHASE_COMPLETE": body = phaseCompleteScreen; break;
      default: body = hub;
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {sidebar}
      <div style={{ flex: 1, padding: 22, maxWidth: 820 }}>
        <h1 style={{ letterSpacing: "0.08em", marginBottom: 4 }}>2 Tails 3 Feet</h1>
        <div style={{ opacity: 0.55, fontSize: 15, marginBottom: 12, fontStyle: "italic" }}>Hunger ends you. Fatigue stops you. The sticky world clings on.</div>
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
        {/* Blot Mark toast */}
        {activeToast && (() => {
          const mark = BLOT_MARKS[activeToast];
          const catColor = CATEGORY_COLOR[mark.category];
          return (
            <div style={{
              position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
              zIndex: 300, pointerEvents: "none",
              animation: toastDismissing
                ? "markToastOut 0.4s cubic-bezier(0.4,0,1,1) both"
                : "markToastIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
            }}>
              <div style={{
                background: "#141414", border: `1px solid ${catColor}60`,
                borderLeft: `3px solid ${catColor}`,
                borderRadius: 12, padding: "12px 18px",
                display: "flex", alignItems: "center", gap: 12,
                boxShadow: `0 4px 24px #00000080, 0 0 12px ${catColor}20`,
                minWidth: 260, maxWidth: 340,
              }}>
                <div style={{ color: catColor, flexShrink: 0 }}>
                  <BlotMarkCategoryIcon category={mark.category} size={28} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: catColor, opacity: 0.7, marginBottom: 2 }}>Blot Mark · {mark.category}</div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 700, color: catColor }}>{mark.title}</div>
                  <div style={{ fontSize: "0.75rem", opacity: 0.6, fontStyle: "italic", marginTop: 2, lineHeight: 1.4 }}>{mark.flavour}</div>
                </div>
              </div>
            </div>
          );
        })()}
        {/* Fly-in to marks button */}
        {flyingMarkCategory && (() => {
          const catColor = CATEGORY_COLOR[flyingMarkCategory.category];
          return (
            <BlotMarkFlyIn
              key={flyingMarkCategory.key}
              category={flyingMarkCategory.category}
              color={catColor}
              onDone={() => setFlyingMarkCategory(null)}
            />
          );
        })()}
      </div>
    </div>
  );
}
