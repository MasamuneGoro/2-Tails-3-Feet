# 2 Tails 3 Feet — Design Log

## Project Overview

A sticky survival game. The player is a small creature navigating a resin-and-fiber biome, managing two stats (Satiety and Stamina), harvesting resources, crafting tools, and now hunting creatures.

**Stack:** TypeScript, React, Vite. Deployed on Cloudflare Pages via `npm run build` → `dist/`.

**Source files:** `App.tsx`, `engine.ts`, `gameData.ts`, `combat.ts`, `types.ts`, `visuals.tsx`, `sound.ts`, `styles.css`

---

## Current State (as of Feb 2026)

### Core loop (complete)
- Journey (Explore / Find Food) → Scout Ahead preview → What Happened Out There summary → Arrive at POI
- Harvest at POI with 5 methods: poke, smash, tease, drill, scoop
- Craft using Tinker Shaft
- Recovery (Lay Down / Keep Flopping)
- Satiety and Stamina stats with visual bars, cost preview overlays, range display
- Chomper auto-eat equipment, Tail Curler stamina recovery equipment
- Proficiency / XP system per harvest method
- Food freshness and decay alerts
- 31 SFX wired throughout

### Combat system (complete, Gloop Moth only)
- No-HP combat using composure (creature mental stability) and integrity (body condition)
- Composure → 0 ends battle. Integrity affects drop quality.
- Tool-based moves — harvesting tools double as weapons
- Double-tool combos available
- Proficiency scales composure damage
- Novelty system: using varied/unique moves refunds stamina (30% for 2–3 unique, 60% for 4+ or any combo)
- Mid-battle consumption: eat raw wax for stamina restore, eat soft tissue for satiety
- Counterattacks triggered by specific player mistakes
- Flee always available (costs 15 stamina)
- Moth encountered during Explore/Find Food journeys to resin POIs (35% common, 70% uncommon)
- After journey resolves: Hunt Creature (purple) or Avoid Creature (−20 stamina) buttons
- After battle: returns to journey summary. Win shows "remains" line, then Arrive. Flee shows Arrive immediately.

---

## Creatures

### Gloop Moth (`creature_gloop_moth`)
- Composure: 100, Integrity: 100
- Initial situation: `moth_hovering`, initial flags: `[wax_intact]`
- Appears at: `poi_resin_node`, `poi_resin_hollow`, `poi_sap_weep`

**Situations** (each has 2–4 text variants, cycled by turn number):
`moth_hovering` → `moth_descending` → `moth_wax_pooling` → `moth_startled` → `moth_hovering`
`moth_depleted` → `moth_thrashing` (stays)

**Moves:**
| ID | Tools | Composure Δ | Integrity Δ | Stamina | Notes |
|---|---|---|---|---|---|
| `jab_wing` | Twig | −15–25 | −8 | 12 | Sets `wing_torn` |
| `comb_glands` | Comb | −5 | 0 | 8 | Sets `wax_drained`, drops Wax ×2 |
| `scoop_pooled` | Scoop | 0 | 0 | 6 | Req situation `wax_pooling`, drops Wax ×3 |
| `smash_body` | Hammer | −35–45 | −30 | 18 | Counterattack if `wax_intact` (−20 stamina, food contaminated) |
| `drill_thorax` | Drill | −25–35 | −20 | 15 | Req situation `descending`, sets `thorax_open` |
| `lace_twig` | Scoop+Twig | 0 | 0 | 5 | Req `wax_drained`, sets `wax_laced` (COMBO) |
| `laced_jab` | Twig | −40–55 | −8 | 10 | Req `wax_laced`, clears it |
| `expose_and_strike` | Comb+Hammer | −45–60 | −12 | 20 | Drops Wing Membrane ×1 mid-battle (COMBO) |
| `drill_resonance` | Twig+Drill | −50–70 | −25 | 22 | Req `thorax_open`, drops Crystallised Wax ×1 (COMBO) |
| `eat_wax_raw` | — | 0 | 0 | −25 restore | Req `wax_drained`, one use per battle |
| `eat_soft_tissue` | — | −10 | −20 | −15/+40 satiety | Req `thorax_open` |
| `flee` | — | 0 | 0 | 15 | Always available |

**Drop table (corpse):**

| Integrity | `wax_drained` | Wing drop (`wing_torn`) | Flesh/food |
|---|---|---|---|
| 80–100 | Wax ×4–5 | Membrane ×1–2 | Moth Flesh ×3–4 |
| 60–79 | Wax ×3–4 | Membrane ×1 | Moth Flesh ×2–3 |
| 40–59 | Wax ×1–2 | None | Moth Flesh ×2 |
| 20–39 | None | None | Moth Paste ×1–2 |
| 0–19 | None | None | Nothing |

`mat_crystallised_wax` drops mid-battle from `drill_resonance`, not in drop table.

**Novelty refund:**
- 0–1 unique moves: 0% — *"You did what worked and nothing else..."*
- 2–3 unique moves: 30% — *"Keeping it interesting helped..."*
- 4+ unique or any combo: 60% + satiety bonus — *"You surprised yourself out there..."*

---

## Items & Foods

### Equipment
| ID | Slot | Effect |
|---|---|---|
| `eq_pointed_twig` | Tail | Poke harvest method |
| `eq_crude_hammerhead` | Tail | Smash harvest method |
| `eq_fiber_comb` | Tail | Tease harvest method |
| `eq_hand_drill` | Tail | Drill harvest method |
| `eq_sticky_scoop` | Tail | Scoop harvest method |
| `eq_chomper` | Tail | Auto-eats food each period |
| `eq_tail_curler` | Tail | Stamina recovery each period |
| `eq_tinker_shaft` | Tail | Required for crafting |
| `eq_standard_shoe` | Shoe | No stat effect currently |

### Foods
| ID | Satiety/unit | Freshness | Source |
|---|---|---|---|
| `food_soft_sap` | 150 | Not storable | POI sap weep (eat on site) |
| `food_resin_chew` | 1 | 100–136 periods | POI harvest |
| `food_dense_ration` | 4 | 156–236 periods | POI harvest |
| `food_moth_flesh` | 35 | 40–70 periods | Combat drop |
| `food_moth_paste` | 14 | 25–45 periods | Combat drop (low integrity) |
| `food_gloop_wax` | 18 | 80–140 periods | Combat drop / mid-battle |

### Resources
| ID | Use |
|---|---|
| `resin_glob` | Crafting |
| `fiber_clump` | Crafting |
| `brittle_stone` | Crafting |
| `mat_wing_membrane` | Future crafting (recipe deferred) |
| `mat_crystallised_wax` | Future crafting (recipe deferred) |

Wing Membrane and Crystallised Wax drop but have no recipes yet — intentional, creates player curiosity.

---

## POIs

| ID | Harvest yields | Moth encounter |
|---|---|---|
| `poi_resin_node` | `resin_glob` | 35% common, 70% uncommon |
| `poi_resin_hollow` | `food_resin_chew` (storable) | 35% / 70% |
| `poi_sap_weep` | `food_soft_sap` (eat on site) + `food_resin_chew` | 35% / 70% |
| `poi_fiber_patch` | `fiber_clump` | No |
| `poi_stone_node` | `brittle_stone` | No |
| `poi_dense_pocket` | `food_dense_ration` (storable) | No |

---

## Deferred / Next Up

- **Moth encounter trigger:** currently rolled on `genJourney`. Future: could also trigger at POI arrival or as journey event.
- **Wing Membrane recipes:** Membrane Wrap (shoe, −0.4 stamina/step), Wax-Sealed Membrane (crafting input)
- **Crystallised Wax recipes:** Paralysis Lure (−20 composure at battle start), Resonance Drill Tip (removes situation requirement from drill moves)
- **Combat sounds:** 9 sounds needed — `sfx_battle_start`, `sfx_composure_hit_light/heavy`, `sfx_counterattack`, `sfx_wax_splatter`, `sfx_battle_win`, `sfx_battle_flee`, `sfx_rare_drop`, `sfx_mid_battle_eat`. Generate after combat playtesting.
- **Second creature:** Ridge Snapper, Sap Lurker, Bristle Hopper all designed (see design notes below)
- **BGM / looping audio:** `sfx_curler_hum` deferred to BGM phase
- **Standard Shoe buff:** currently no stat effect, should be differentiated from Membrane Wrap when that's added

---

## Other Creatures (designed, not implemented)

### Ridge Snapper
Armoured crustacean, charges and retreats. Timing-based deflect mechanic. Punishes misreading charge state. Comb is useless (punishes Comb-heavy kits).

### Sap Lurker
Translucent slug in sap pools. Must drain sap layer before effective attacks. Stamina tax from sap splatter. Slow, rarely counterattacks.

### Bristle Hopper
Nervous fast creature with quills. Flees at low composure if no finishing move — takes loot with it. Punishes greed.

---

## Key Design Decisions (rationale)

- **No HP in combat** — composure + integrity instead. Composure ends battle, integrity affects drops. Separates "win condition" from "harvest quality."
- **Tools double as weapons** — no separate combat equipment. Loadout choices have weight before you encounter anything.
- **Integrity hints in summary** — flavour text at 5 tiers hints that higher integrity = better drops, teaches without tutorials.
- **Novelty refund** — rewards varied play without punishing safe play. Zero-refund tier has its own flavour ("Effective. Efficient. Exactly as exhausting as it sounds.")
- **Moth in journey flow** — not a hub button. Encounter is discovered, not scheduled. Avoid costs stamina to make the choice meaningful.
- **Deferred recipes for new materials** — Wing Membrane and Crystallised Wax drop now but have no use yet. Creates anticipation rather than clutter.
