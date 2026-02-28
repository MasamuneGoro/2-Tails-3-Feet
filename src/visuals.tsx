import React, { useEffect, useRef } from "react";
import type { ItemId, PoiId } from "./types";

// ─── ITEM ICONS ──────────────────────────────────────────────────────────────
// 24×24 viewBox, strokeWidth 2, linecap/linejoin round
// Harvesting tools:  amber   #c8a96e  (pointed twig, hammerhead, fiber comb, hand drill, sticky scoop)
// Recovery tools:    blue    #7eaac8  (tail curler)
// Crafting tools:    purple  #a07ed4  (tinker shaft)
// Eating/utility:    green   #6dbf82  (chomper)
// Resources:  varied per resource
// Foods:      teal   #26c6da / green #4caf50

const ICON_DEFS: Record<string, { color: string; paths: string }> = {
  // ── Equipment — amber #c8a96e, strokeWidth 2.5 main / 1.8 detail ─────────
  eq_tail_curler: {
    color: "#7eaac8",
    paths: `
      <path d="M12 20 C6 20 2.5 16 2.5 11.5 C2.5 7 5.5 4 9 4 C12.5 4 15 6.5 15 10 C15 13 12.5 15 10 15 C8.5 15 7 14 7 12.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="7" cy="12.5" r="1.5" fill="currentColor"/>
      <path d="M15 10 L21 10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M18.5 7.5 L21 10 L18.5 12.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 4 C9 4 8 2.5 10 2 C12 2.5 11 4 11 4" fill="currentColor" opacity="0.5"/>
    `,
  },
  eq_chomper: {
    color: "#6dbf82",
    paths: `
      <path d="M3 9 L21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
      <path d="M3 15 L21 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.3"/>
      <path d="M3 9 L3 6 L6 9" fill="currentColor" opacity="0.9"/>
      <path d="M7.5 9 L7.5 5 L10.5 9" fill="currentColor" opacity="0.9"/>
      <path d="M12 9 L12 5 L15 9" fill="currentColor" opacity="0.9"/>
      <path d="M16.5 9 L16.5 6 L19.5 9" fill="currentColor" opacity="0.9"/>
      <path d="M3 15 L3 18 L6 15" fill="currentColor" opacity="0.9"/>
      <path d="M7.5 15 L7.5 19 L10.5 15" fill="currentColor" opacity="0.9"/>
      <path d="M12 15 L12 19 L15 15" fill="currentColor" opacity="0.9"/>
      <path d="M16.5 15 L16.5 18 L19.5 15" fill="currentColor" opacity="0.9"/>
    `,
  },
  eq_tinker_shaft: {
    color: "#a07ed4",
    paths: `
      <path d="M4.5 20 L14.5 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <circle cx="17.5" cy="7" r="3.5" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <circle cx="17.5" cy="7" r="1.2" fill="currentColor"/>
      <path d="M14.8 4.3 L20.2 9.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
      <path d="M2.5 20 L4.5 22" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M7 17 L9 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.35"/>
      <path d="M11 13 L13 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.35"/>
    `,
  },
  eq_pointed_twig: {
    color: "#c8a96e",
    paths: `
      <path d="M4.5 20 L16.5 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M16.5 8 L20 4.5 L17.5 9.5 L21.5 7.5 L16.5 12.5" fill="currentColor"/>
      <path d="M7.5 17 C9.5 13.5 13 12.5 14.5 10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.5"/>
      <path d="M5.5 19 C7.5 16.5 10 16 11.5 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.3"/>
      <circle cx="10.5" cy="15" r="1" fill="currentColor" opacity="0.3"/>
    `,
  },
  eq_crude_hammerhead: {
    color: "#c8a96e",
    paths: `
      <path d="M4.5 20 L14 10.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <rect x="13.5" y="2.5" width="8" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <path d="M14 10.5 L16 8.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.5"/>
      <line x1="15.5" y1="5"   x2="20"   y2="5"   stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
      <line x1="15.5" y1="7.5" x2="20"   y2="7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
      <line x1="15.5" y1="10"  x2="20"   y2="10"  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
      <rect x="14" y="2.5" width="2.5" height="10" rx="0" fill="currentColor" opacity="0.12"/>
    `,
  },
  eq_fiber_comb: {
    color: "#c8a96e",
    paths: `
      <path d="M3 8 L21 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M5.5 8 L5.5 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M9 8 L9 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M12.5 8 L12.5 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M16 8 L16 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M19.5 8 L19.5 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <path d="M2.5 5 L21.5 5 L21.5 8 L2.5 8 Z" fill="currentColor" opacity="0.15"/>
      <path d="M3 5.5 L21 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
      <path d="M3 5 L21 5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    `,
  },
  eq_hand_drill: {
    color: "#c8a96e",
    paths: `
      <path d="M12 21 L12 11" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <path d="M8 11 L16 11 L14.5 6.5 L9.5 6.5 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M12 6.5 L12 3.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M9 3.5 L15 3.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M9.5 21 L14.5 21" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line x1="10.5" y1="8.5" x2="13.5" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
      <path d="M11.5 11 L11 14 M12.5 11 L13 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.3"/>
    `,
  },
  eq_sticky_scoop: {
    color: "#c8a96e",
    paths: `
      <path d="M4.5 17 C4.5 11.5 7.5 7.5 12 7.5 C16.5 7.5 19.5 11.5 19.5 17" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="4.5" y1="17" x2="19.5" y2="17" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M12 17 L12 22" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <circle cx="8.5"  cy="13" r="1.3" fill="currentColor" opacity="0.6"/>
      <circle cx="15.5" cy="13" r="1.3" fill="currentColor" opacity="0.6"/>
      <circle cx="12"   cy="11" r="1.3" fill="currentColor" opacity="0.45"/>
      <path d="M7 17 C7 14 9 12 12 12 C15 12 17 14 17 17" fill="currentColor" opacity="0.1"/>
    `,
  },
  eq_standard_shoe: {
    color: "#9a9080",
    paths: `
      <path d="M2.5 15.5 C2.5 15.5 5.5 13 10 13 L18.5 13 C20.5 13 21.5 14 21.5 15.5 L21.5 18.5 L2.5 18.5 Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M10 13 L10 7.5 C10 6.5 11 5.5 12.5 5.5 L14.5 5.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M7  18.5 L7  15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
      <path d="M11 18.5 L11 15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
      <path d="M15 18.5 L15 15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.45"/>
      <path d="M10 9.5 L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.3"/>
    `,
  },

  eq_bouncy_shoe: {
    color: "#5cb88e",   // springy mint-green
    paths: `
      <path d="M3 17.5 Q4.5 16.5 6 17.5 Q7.5 16.5 9 17.5 Q10.5 16.5 12 17.5 Q13.5 16.5 15 17.5 Q16.5 16.5 18 17.5 Q19.5 16.5 21 17.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.8"/>
      <rect x="2.5" y="17.5" width="19" height="3.5" rx="1.75" fill="currentColor" opacity="0.35"/>
      <rect x="2.5" y="17.5" width="19" height="3.5" rx="1.75" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <path d="M2.5 17 L2.5 10 Q2.5 6.5 7 6 L15 6 Q19.5 6 19.5 10 L19.5 15.5 Q19.5 17 17 17 Z" fill="currentColor" opacity="0.2"/>
      <path d="M2.5 17 L2.5 10 Q2.5 6.5 7 6 L15 6 Q19.5 6 19.5 10 L19.5 15.5 Q19.5 17 17 17 Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
      <ellipse cx="6" cy="14" rx="4" ry="3.5" fill="currentColor" opacity="0.25"/>
      <ellipse cx="6" cy="14" rx="4" ry="3.5" stroke="currentColor" stroke-width="1.3" fill="none"/>
      <ellipse cx="5" cy="12.5" rx="1.5" ry="0.9" fill="currentColor" opacity="0.4"/>
      <circle cx="10.5" cy="9" r="0.9" fill="currentColor" opacity="0.7"/>
      <circle cx="13"   cy="8.5" r="0.9" fill="currentColor" opacity="0.7"/>
      <circle cx="15.5" cy="8.5" r="0.9" fill="currentColor" opacity="0.7"/>
      <path d="M10.5 9 Q12 7.8 13 8.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.9"/>
      <path d="M13 8.5 Q14.25 7.8 15.5 8.5" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.9"/>
      <path d="M0.5 11 L1.2 9 L1.9 11 L-0.1 10.3 L1.9 10.3 Z" fill="currentColor" opacity="0.75"/>
      <circle cx="0.8" cy="13.5" r="0.8" fill="currentColor" opacity="0.5"/>
    `,
  },
  eq_stompy_shoe: {
    color: "#8b5e3c",   // warm dark leather brown
    paths: `
      <rect x="2" y="19" width="20" height="3.5" rx="1.5" fill="currentColor" opacity="0.5"/>
      <rect x="2" y="19" width="20" height="3.5" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <line x1="5"  y1="19" x2="5"  y2="22.5" stroke="currentColor" stroke-width="1" opacity="0.5"/>
      <line x1="8.5" y1="19" x2="8.5" y2="22.5" stroke="currentColor" stroke-width="1" opacity="0.5"/>
      <line x1="12" y1="19" x2="12" y2="22.5" stroke="currentColor" stroke-width="1" opacity="0.5"/>
      <line x1="15.5" y1="19" x2="15.5" y2="22.5" stroke="currentColor" stroke-width="1" opacity="0.5"/>
      <line x1="19" y1="19" x2="19" y2="22.5" stroke="currentColor" stroke-width="1" opacity="0.5"/>
      <rect x="2.5" y="16" width="19" height="3.5" rx="1" fill="currentColor" opacity="0.3"/>
      <rect x="2.5" y="16" width="19" height="3.5" rx="1" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <path d="M2.5 15.5 L2.5 7.5 Q2.5 4 8 4 L17 4 Q21.5 4 21.5 8 L21.5 14 Q21.5 15.5 19 15.5 Z" fill="currentColor" opacity="0.2"/>
      <path d="M2.5 15.5 L2.5 7.5 Q2.5 4 8 4 L17 4 Q21.5 4 21.5 8 L21.5 14 Q21.5 15.5 19 15.5 Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
      <rect x="2" y="10.5" width="7.5" height="5.5" rx="2" fill="currentColor" opacity="0.25"/>
      <rect x="2" y="10.5" width="7.5" height="5.5" rx="2" stroke="currentColor" stroke-width="1.2" fill="none"/>
      <rect x="2.5" y="11.5" width="4" height="1.5" rx="0.75" fill="currentColor" opacity="0.35"/>
      <circle cx="12"  cy="7.5" r="1.3" stroke="currentColor" stroke-width="1" fill="none" opacity="0.8"/>
      <circle cx="15.5" cy="7" r="1.3" stroke="currentColor" stroke-width="1" fill="none" opacity="0.8"/>
      <circle cx="19" cy="7.5" r="1.3" stroke="currentColor" stroke-width="1" fill="none" opacity="0.8"/>
      <path d="M12 7.5 Q13.75 6.2 15.5 7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.9"/>
      <path d="M15.5 7 Q17.25 6.2 19 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.9"/>
      <path d="M0.5 20 L2 22" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      <path d="M23.5 20 L22 22" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
    `,
  },

  // ── Resources — each a distinct colour ───────────────────────────────────
  resin_glob: {
    color: "#d4820a",   // warm amber-orange
    paths: `
      <ellipse cx="12" cy="14.5" rx="6.5" ry="7" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <path d="M12 7.5 C12 7.5 9 4.5 11.5 2.5 C13 2 15 3 12 7.5" fill="currentColor"/>
      <ellipse cx="9" cy="11.5" rx="1.8" ry="3" fill="currentColor" opacity="0.28" transform="rotate(-20 9 11.5)"/>
      <path d="M15.5 11.5 C17 12.5 17 15 15.5 16.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.45"/>
      <circle cx="13.5" cy="19" r="1.2" fill="currentColor" opacity="0.5"/>
    `,
  },
  fiber_clump: {
    color: "#7db840",   // fresh green (distinct from resin amber and stone blue)
    paths: `
      <path d="M6 20 C7 11 9.5 7.5 12.5 5.5"   stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M10 20 C9.5 12 12 8.5 14 7"     stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M14 20 C13 13 15.5 9.5 17 8"    stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>
      <path d="M4.5 17.5 C7 16 11.5 16 16 16 C18.5 16 20 17 19 18.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M7 20 C8.5 18.5 11 18.5 13 18.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.5"/>
      <circle cx="12.5" cy="5.5" r="1.2" fill="currentColor" opacity="0.6"/>
      <circle cx="14"   cy="7"   r="1"   fill="currentColor" opacity="0.5"/>
      <circle cx="17"   cy="8"   r="1"   fill="currentColor" opacity="0.5"/>
    `,
  },
  brittle_stone: {
    color: "#6b8fac",   // slate blue (cool, distinct from the warm amber/green)
    paths: `
      <polygon points="12,2.5 20.5,8.5 18.5,19.5 5.5,19.5 3.5,8.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M12 2.5 L16.5 12.5 L8 15.5"  stroke="currentColor" stroke-width="1.8" fill="none" opacity="0.55"/>
      <path d="M16.5 12.5 L18.5 19.5"       stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.4"/>
      <path d="M8 15.5 L5.5 19.5"           stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.4"/>
      <circle cx="14.5" cy="6.5" r="1.3" fill="currentColor" opacity="0.45"/>
      <circle cx="9"    cy="14"  r="0.9" fill="currentColor" opacity="0.35"/>
    `,
  },

  // ── Combat materials ──────────────────────────────────────────────────────
  mat_wing_membrane: {
    color: "#8ecfde",   // translucent blue-grey
    paths: `
      <path d="M12 20 C5 18 2 12 3 6 C6 4 10 5 12 8 C14 5 18 4 21 6 C22 12 19 18 12 20Z" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M12 8 L12 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
      <path d="M3 6 C6 9 9 10 12 10 C15 10 18 9 21 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.35"/>
      <path d="M4 11 C7 13 10 13.5 12 13.5 C14 13.5 17 13 20 11" stroke="currentColor" stroke-width="1" stroke-linecap="round" fill="none" opacity="0.25"/>
      <ellipse cx="9" cy="9" rx="2" ry="1.2" fill="currentColor" opacity="0.18" transform="rotate(-20 9 9)"/>
      <ellipse cx="15" cy="9" rx="2" ry="1.2" fill="currentColor" opacity="0.18" transform="rotate(20 15 9)"/>
    `,
  },
  mat_crystallised_wax: {
    color: "#c0d8f0",   // cold white-blue
    paths: `
      <polygon points="12,2 17,7.5 15,14 9,14 7,7.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <polygon points="12,2 17,7.5 15,14 9,14 7,7.5" fill="currentColor" opacity="0.08"/>
      <path d="M12 2 L12 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.4"/>
      <path d="M7 7.5 L17 7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.4"/>
      <path d="M9 14 L11 20 L13 20 L15 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="0.7"/>
      <circle cx="12" cy="8" r="1.5" fill="currentColor" opacity="0.6"/>
      <circle cx="10" cy="5" r="0.8" fill="currentColor" opacity="0.45"/>
      <circle cx="14.5" cy="5.5" r="0.7" fill="currentColor" opacity="0.35"/>
    `,
  },

  // ── Combat foods ──────────────────────────────────────────────────────────
  food_moth_flesh: {
    color: "#d4c4a8",   // pale off-white with warm tinge
    paths: `
      <ellipse cx="12" cy="13" rx="8" ry="7" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <ellipse cx="12" cy="13" rx="8" ry="7" fill="currentColor" opacity="0.08"/>
      <ellipse cx="9.5" cy="10.5" rx="3" ry="2" fill="currentColor" opacity="0.2" transform="rotate(-15 9.5 10.5)"/>
      <path d="M6.5 14 C8 16 11 17 14 16.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.45"/>
      <path d="M9 11 C10.5 12 13.5 12 15 11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.35"/>
      <circle cx="14" cy="10" r="1" fill="currentColor" opacity="0.3"/>
      <circle cx="10" cy="15" r="0.8" fill="currentColor" opacity="0.25"/>
    `,
  },
  food_moth_paste: {
    color: "#a09480",   // dull grey-beige, murkier than flesh
    paths: `
      <ellipse cx="12" cy="14" rx="8.5" ry="5.5" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <ellipse cx="12" cy="14" rx="8.5" ry="5.5" fill="currentColor" opacity="0.1"/>
      <path d="M5 12 C7 10.5 10 10 12 10 C14 10 17 10.5 19 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.35"/>
      <path d="M6 15 C8 16.5 10.5 17 13 16.5 C15.5 16 17.5 15 18 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.3"/>
      <circle cx="9" cy="13.5" r="1.2" fill="currentColor" opacity="0.25"/>
      <circle cx="14" cy="14.5" r="0.9" fill="currentColor" opacity="0.2"/>
      <circle cx="12" cy="12.5" r="0.7" fill="currentColor" opacity="0.2"/>
    `,
  },
  food_gloop_wax: {
    color: "#d4920a",   // warm amber, softer than resin_glob
    paths: `
      <ellipse cx="12" cy="15" rx="7" ry="5.5" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <ellipse cx="12" cy="15" rx="7" ry="5.5" fill="currentColor" opacity="0.12"/>
      <path d="M12 9.5 C12 9.5 10 6 12 4 C14 6 12 9.5 12 9.5Z" fill="currentColor" opacity="0.7"/>
      <path d="M12 9.5 L12 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M10 13 C11 14.5 13 14.5 14 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.5"/>
      <circle cx="9.5" cy="16" r="1" fill="currentColor" opacity="0.4"/>
      <circle cx="14.5" cy="15" r="0.8" fill="currentColor" opacity="0.35"/>
    `,
  },
  food_soft_sap: {
    color: "#4cba55",   // green
    paths: `
      <path d="M6.5 18 C6.5 12.5 9 8 12 7 C15 8 17.5 12.5 17.5 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M6.5 18 Q12 22 17.5 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
      <path d="M9.5 12.5 Q12 15.5 14.5 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6"/>
      <path d="M12 7 L12 3.5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M9.5 5 L12 3.5 L14.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="12" cy="15" r="1.2" fill="currentColor" opacity="0.4"/>
    `,
  },
  food_resin_chew: {
    color: "#26c6da",   // teal
    paths: `
      <rect x="3.5" y="8" width="17" height="10" rx="4" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <line x1="3.5" y1="13" x2="20.5" y2="13" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>
      <line x1="8"  y1="8"  x2="8"  y2="18" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
      <line x1="16" y1="8"  x2="16" y2="18" stroke="currentColor" stroke-width="1.5" opacity="0.35"/>
      <circle cx="12" cy="10.5" r="1.2" fill="currentColor" opacity="0.55"/>
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" opacity="0.55"/>
      <circle cx="5.5"  cy="10.5" r="0.8" fill="currentColor" opacity="0.3"/>
      <circle cx="18.5" cy="15.5" r="0.8" fill="currentColor" opacity="0.3"/>
    `,
  },
  food_dense_ration: {
    color: "#26c6da",   // teal
    paths: `
      <rect x="2.5" y="6.5" width="19" height="13" rx="2.5" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="currentColor" stroke-width="2"   opacity="0.5"/>
      <line x1="9.5" y1="6.5" x2="9.5" y2="19.5" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <line x1="16"  y1="6.5" x2="16"  y2="12"   stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <rect x="4"  y="8.5"  width="4"  height="2.5" rx="0.8" fill="currentColor" opacity="0.3"/>
      <rect x="11" y="8.5"  width="3.5" height="2.5" rx="0.8" fill="currentColor" opacity="0.3"/>
      <rect x="4"  y="13.5" width="4.5" height="2.5" rx="0.8" fill="currentColor" opacity="0.3"/>
      <rect x="11" y="13.5" width="8"  height="2.5" rx="0.8" fill="currentColor" opacity="0.3"/>
      <rect x="17.5" y="8.5" width="2" height="2.5" rx="0.8" fill="currentColor" opacity="0.2"/>
    `,
  },

  // ── Markers — small gems/shards, each with category colour ───────────────
  marker_exploration: {
    color: "#f4a840",   // amber-orange
    paths: `
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.25"/>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor" opacity="0.7"/>
      <path d="M12 5 L12 7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
      <path d="M12 16.5 L12 19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
      <path d="M5 12 L7.5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
      <path d="M16.5 12 L19 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
    `,
  },
  marker_harvesting: {
    color: "#66bb6a",   // green
    paths: `
      <polygon points="12,4 16,10 14.5,19 9.5,19 8,10" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
      <path d="M8 10 L16 10" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
      <circle cx="12" cy="13" r="1.2" fill="currentColor" opacity="0.6"/>
    `,
  },
  marker_crafting: {
    color: "#9e9e9e",   // grey
    paths: `
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2"/>
      <path d="M7 12 L17 12" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
      <path d="M12 7 L12 17" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>
    `,
  },
  marker_survival: {
    color: "#ef5350",   // red
    paths: `
      <ellipse cx="12" cy="12.5" rx="5" ry="6" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2"/>
      <ellipse cx="10.5" cy="10.5" rx="1.5" ry="2" fill="currentColor" opacity="0.3" transform="rotate(-15 10.5 10.5)"/>
      <circle cx="12" cy="14" r="1.2" fill="currentColor" opacity="0.55"/>
    `,
  },
  marker_combat: {
    color: "#ab47bc",   // violet
    paths: `
      <polygon points="12,3.5 15,10 22,10 16.5,14.5 18.5,21 12,17 5.5,21 7.5,14.5 2,10 9,10" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="12" cy="12.5" r="1.5" fill="currentColor" opacity="0.6"/>
    `,
  },
  marker_loot: {
    color: "#ffd54f",   // yellow
    paths: `
      <polygon points="12,3 15.5,8.5 21.5,10 17,15 18,21 12,18 6,21 7,15 2.5,10 8.5,8.5" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
      <circle cx="12" cy="13" r="2" fill="currentColor" opacity="0.5"/>
    `,
  },

  // ── Trophies — lens/prism shapes, brighter than markers ──────────────────
  trophy_exploration: {
    color: "#f4a840",
    paths: `
      <ellipse cx="12" cy="13" rx="7.5" ry="8.5" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2.5"/>
      <path d="M4.5 13 C4.5 8.5 7.5 5 12 5 C16.5 5 19.5 8.5 19.5 13" fill="currentColor" opacity="0.2"/>
      <ellipse cx="10" cy="10" rx="2.5" ry="3.5" fill="currentColor" opacity="0.2" transform="rotate(-20 10 10)"/>
      <path d="M8 16 C9.5 18 14.5 18 16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.5"/>
    `,
  },
  trophy_harvesting: {
    color: "#66bb6a",
    paths: `
      <polygon points="12,2.5 20,8 18,20 6,20 4,8" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M4 8 L20 8" stroke="currentColor" stroke-width="1.5" opacity="0.45"/>
      <path d="M12 2.5 L18 8 L16 20" stroke="currentColor" stroke-width="1.2" opacity="0.3" fill="none"/>
      <circle cx="12" cy="14" r="2" fill="currentColor" opacity="0.5"/>
    `,
  },
  trophy_crafting: {
    color: "#9e9e9e",
    paths: `
      <polygon points="12,2.5 19.5,7 19.5,17 12,21.5 4.5,17 4.5,7" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M4.5 7 L19.5 17" stroke="currentColor" stroke-width="1.2" opacity="0.35" fill="none"/>
      <path d="M19.5 7 L4.5 17" stroke="currentColor" stroke-width="1.2" opacity="0.35" fill="none"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.5"/>
    `,
  },
  trophy_survival: {
    color: "#ef5350",
    paths: `
      <ellipse cx="12" cy="13" rx="7" ry="9" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2.5"/>
      <path d="M12 4 L12 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
      <ellipse cx="9.5" cy="10" rx="2.5" ry="3.5" fill="currentColor" opacity="0.2" transform="rotate(-20 9.5 10)"/>
      <path d="M8 16 C9.5 18.5 14.5 18.5 16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.55"/>
    `,
  },
  trophy_combat: {
    color: "#ab47bc",
    paths: `
      <polygon points="12,2 17,8.5 15.5,15.5 9,18 4.5,12.5 7,5.5" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M7 5.5 L15.5 15.5" stroke="currentColor" stroke-width="1.2" opacity="0.3" fill="none"/>
      <path d="M17 8.5 L4.5 12.5" stroke="currentColor" stroke-width="1.2" opacity="0.3" fill="none"/>
      <circle cx="12" cy="11" r="2.5" fill="currentColor" opacity="0.5"/>
    `,
  },
  trophy_loot: {
    color: "#ffd54f",
    paths: `
      <polygon points="12,2 17.5,7 20.5,13 17.5,19 6.5,19 3.5,13 6.5,7" fill="currentColor" opacity="0.12" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M6.5 7 L17.5 19" stroke="currentColor" stroke-width="1.2" opacity="0.3" fill="none"/>
      <path d="M17.5 7 L6.5 19" stroke="currentColor" stroke-width="1.2" opacity="0.3" fill="none"/>
      <circle cx="12" cy="13" r="2.5" fill="currentColor" opacity="0.55"/>
    `,
  },

  // ── Gem Trophies — studded versions, richer shapes ────────────────────────
  gem_trophy_exploration: {
    color: "#f4a840",
    paths: `
      <ellipse cx="12" cy="13" rx="7.5" ry="8.5" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2.5"/>
      <path d="M4.5 13 C4.5 8.5 7.5 5 12 5 C16.5 5 19.5 8.5 19.5 13" fill="currentColor" opacity="0.2"/>
      <circle cx="7.5"  cy="9.5"  r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="12"   cy="6"    r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="16.5" cy="9.5"  r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="12"   cy="20"   r="1.2" fill="currentColor" opacity="0.6"/>
    `,
  },
  gem_trophy_harvesting: {
    color: "#66bb6a",
    paths: `
      <polygon points="12,2.5 20,8 18,20 6,20 4,8" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M4 8 L20 8" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <circle cx="8"  cy="5.5" r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="12" cy="4"   r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="16" cy="5.5" r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="12" cy="14"  r="2"   fill="currentColor" opacity="0.6"/>
    `,
  },
  gem_trophy_crafting: {
    color: "#9e9e9e",
    paths: `
      <polygon points="12,2.5 19.5,7 19.5,17 12,21.5 4.5,17 4.5,7" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="12"   cy="2.5"  r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="19.5" cy="7"    r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="19.5" cy="17"   r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="12"   cy="21.5" r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="4.5"  cy="17"   r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="4.5"  cy="7"    r="1.5" fill="currentColor" opacity="0.75"/>
    `,
  },
  gem_trophy_survival: {
    color: "#ef5350",
    paths: `
      <ellipse cx="12" cy="13" rx="7" ry="9" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2.5"/>
      <path d="M12 4 L12 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
      <circle cx="7"  cy="8"    r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="17" cy="8"    r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="5"  cy="15"   r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="19" cy="15"   r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="12" cy="21.5" r="1.5" fill="currentColor" opacity="0.75"/>
    `,
  },
  gem_trophy_combat: {
    color: "#ab47bc",
    paths: `
      <polygon points="12,2 17,8.5 15.5,15.5 9,18 4.5,12.5 7,5.5" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="12"  cy="2"    r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="17"  cy="8.5"  r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="9"   cy="18"   r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="4.5" cy="12.5" r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="7"   cy="5.5"  r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="12"  cy="10"   r="2"   fill="currentColor" opacity="0.6"/>
    `,
  },
  gem_trophy_loot: {
    color: "#ffd54f",
    paths: `
      <polygon points="12,2 17.5,7 20.5,13 17.5,19 6.5,19 3.5,13 6.5,7" fill="currentColor" opacity="0.15" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="12"  cy="2"    r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="17.5" cy="7"   r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="6.5" cy="7"    r="1.5" fill="currentColor" opacity="0.75"/>
      <circle cx="12"  cy="13"   r="2.5" fill="currentColor" opacity="0.6"/>
    `,
  },
};
interface ItemIconProps {
  id: string;
  size?: number;
  style?: React.CSSProperties;
}

export function ItemIcon({ id, size = 18, style }: ItemIconProps) {
  const def = ICON_DEFS[id];
  if (!def) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ color: def.color, flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: def.paths }}
    />
  );
}

// ─── POI CANVAS ILLUSTRATIONS ────────────────────────────────────────────────
// 5 variants per POI: 0,1,2 = common; 3,4 = uncommon (visually distinct — richer, brighter, gold trim)

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, variant: number) => void;

const POI_DRAW: Record<string, DrawFn> = {

  poi_resin_node(ctx, w, h, v) {
    const uncommon = v >= 3;
    // Background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, uncommon ? "#221508" : "#1a1208");
    bg.addColorStop(1, uncommon ? "#120a02" : "#0e0a04");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // Ground shadow
    ctx.fillStyle = uncommon ? "#281a06" : "#1e1508";
    ctx.beginPath();
    ctx.ellipse(w * 0.45, h * 0.88, w * 0.5, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Variant offsets
    const offsets = [[-5, 0], [5, -3], [0, 4], [-3, -5], [6, 2]];
    const [ox, oy] = offsets[v] ?? [0, 0];

    // Main blob
    ctx.fillStyle = uncommon ? "#7a4400" : "#6b3d00";
    ctx.beginPath();
    ctx.ellipse(w * 0.42 + ox, h * 0.6 + oy, w * (uncommon ? 0.21 : 0.18), h * (uncommon ? 0.32 : 0.28), -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Amber blobs — more/brighter for uncommon
    const baseBlobs: [number,number,number,number,string][] = [
      [w*0.38+ox, h*0.46+oy, w*0.11, h*0.19, uncommon ? "#e09000" : "#c87800"],
      [w*0.49+ox, h*0.55+oy, w*0.08, h*0.13, uncommon ? "#f0a820" : "#e8a020"],
      [w*0.35+ox, h*0.58+oy, w*0.06, h*0.09, uncommon ? "#ffe050" : "#f0b840"],
    ];
    if (uncommon) {
      baseBlobs.push([w*0.52+ox, h*0.48+oy, w*0.05, h*0.08, "#ffd060"]);
      baseBlobs.push([w*0.4+ox, h*0.38+oy, w*0.04, h*0.06, "#fff0a0"]);
    }
    baseBlobs.forEach(([x, y, rx, ry, col]) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); ctx.fill();
    });

    // Drip
    ctx.strokeStyle = uncommon ? "#e09000" : "#c87800";
    ctx.lineWidth = uncommon ? 3.5 : 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(w * 0.5 + ox, h * 0.72 + oy);
    ctx.bezierCurveTo(w * 0.52 + ox, h * 0.78 + oy, w * 0.5 + ox, h * 0.84 + oy, w * 0.51 + ox, h * 0.89 + oy);
    ctx.stroke();

    // Extra drip for uncommon
    if (uncommon) {
      ctx.strokeStyle = "#ffd060";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w * 0.44 + ox, h * 0.68 + oy);
      ctx.bezierCurveTo(w * 0.43, h * 0.76, w * 0.42, h * 0.82, w * 0.41, h * 0.87);
      ctx.stroke();
    }

    // Glow
    const glow = ctx.createRadialGradient(w * 0.42 + ox, h * 0.5 + oy, 0, w * 0.42 + ox, h * 0.5 + oy, w * (uncommon ? 0.38 : 0.3));
    glow.addColorStop(0, uncommon ? "rgba(255,180,0,0.22)" : "rgba(200,120,0,0.15)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    // Uncommon: golden sparkle dots
    if (uncommon) {
      ctx.fillStyle = "rgba(255,240,100,0.7)";
      [[w*0.3,h*0.3],[w*0.65,h*0.25],[w*0.72,h*0.45],[w*0.22,h*0.5]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Background rocks
    ctx.fillStyle = uncommon ? "#301e08" : "#2a1c08";
    [[w*0.72, h*0.72, 8, 5],[w*0.2, h*0.76, 6, 4],[w*0.82, h*0.62, 5, 3]].forEach(([x,y,rx,ry]) => {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    });
  },

  poi_fiber_patch(ctx, w, h, v) {
    const uncommon = v >= 3;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, uncommon ? "#101508" : "#0e1108");
    bg.addColorStop(1, uncommon ? "#060a04" : "#080d05");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = uncommon ? "#1a2210" : "#141a0e";
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // Variant horizontal offsets for stalks
    const variantXShift = [0, 12, -10, 5, -8][v] ?? 0;

    const stalks = [
      [w*0.2+variantXShift, h*0.72, w*0.22+variantXShift, h*0.22, -0.35],
      [w*0.32+variantXShift, h*0.72, w*0.34+variantXShift, h*0.16, 0.1],
      [w*0.44+variantXShift, h*0.72, w*0.46+variantXShift, h*0.1, -0.05],
      [w*0.56+variantXShift, h*0.72, w*0.58+variantXShift, h*0.18, 0.2],
      [w*0.68+variantXShift, h*0.72, w*0.70+variantXShift, h*0.25, -0.15],
      [w*0.12+variantXShift, h*0.72, w*0.14+variantXShift, h*0.38, 0.28],
      [w*0.8+variantXShift,  h*0.72, w*0.82+variantXShift, h*0.38, -0.1],
    ];
    // Uncommon adds extra tall stalks
    if (uncommon) {
      stalks.push([w*0.38, h*0.72, w*0.36, h*0.06, 0.05]);
      stalks.push([w*0.62, h*0.72, w*0.64, h*0.08, -0.08]);
    }
    stalks.forEach(([x1,y1,x2,y2,lean]) => {
      const alpha = uncommon ? 0.6 + Math.random() * 0.35 : 0.35 + Math.random() * 0.35;
      const col = uncommon ? `rgba(180,220,100,${alpha})` : `rgba(140,170,80,${alpha})`;
      ctx.strokeStyle = col;
      ctx.lineWidth = uncommon ? 2 : 1.5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1+lean*30, y1-(y1-y2)*0.4, x2+lean*20, y1-(y1-y2)*0.7, x2, y2);
      ctx.stroke();
      // Tips
      ctx.lineWidth = 1;
      ctx.strokeStyle = uncommon ? "rgba(230,255,160,0.8)" : "rgba(200,220,140,0.6)";
      ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2-8,y2-8); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2+6,y2-10); ctx.stroke();
      if (uncommon) {
        ctx.beginPath(); ctx.moveTo(x2,y2); ctx.lineTo(x2+2,y2-12); ctx.stroke();
      }
    });

    // Uncommon: scattered seed dots
    if (uncommon) {
      ctx.fillStyle = "rgba(220,255,150,0.5)";
      [[w*0.3,h*0.4],[w*0.5,h*0.3],[w*0.65,h*0.38],[w*0.18,h*0.45]].forEach(([x,y]) => {
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI*2); ctx.fill();
      });
    }

    const glow = ctx.createRadialGradient(w/2, h*0.5, 0, w/2, h*0.5, w * (uncommon ? 0.5 : 0.4));
    glow.addColorStop(0, uncommon ? "rgba(140,220,60,0.12)" : "rgba(100,160,50,0.08)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  },

  poi_stone_node(ctx, w, h, v) {
    const uncommon = v >= 3;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, uncommon ? "#10101a" : "#0f0f12");
    bg.addColorStop(1, "#080808");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#0a0a0c";
    ctx.beginPath();
    ctx.ellipse(w * 0.45, h * 0.9, w * 0.28, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    const variantOffset = [[0,0],[-8,3],[6,-4],[-4,-6],[8,2]][v] ?? [0,0];
    const [ox, oy] = variantOffset;

    const rocks = uncommon
      ? [
          { x: w*0.42+ox, y: h*0.55+oy, rx: w*0.21, ry: h*0.26, rot: 0.1, col: "#32324a", hi: "#4a4a62" },
          { x: w*0.62+ox, y: h*0.68+oy, rx: w*0.11, ry: h*0.14, rot: 0.4, col: "#28283c", hi: "#3c3c54" },
          { x: w*0.26+ox, y: h*0.70+oy, rx: w*0.09, ry: h*0.11, rot: -0.3, col: "#242234", hi: "#343248" },
          { x: w*0.55+ox, y: h*0.42+oy, rx: w*0.07, ry: h*0.09, rot: 0.6, col: "#2a2a40", hi: "#42425a" },
        ]
      : [
          { x: w*0.42+ox, y: h*0.55+oy, rx: w*0.18, ry: h*0.22, rot: 0.1, col: "#2e2e38", hi: "#3e3e4a" },
          { x: w*0.6+ox,  y: h*0.68+oy, rx: w*0.10, ry: h*0.13, rot: 0.4, col: "#252530", hi: "#343440" },
          { x: w*0.28+ox, y: h*0.70+oy, rx: w*0.08, ry: h*0.10, rot: -0.3, col: "#222228", hi: "#30303c" },
        ];

    rocks.forEach(r => {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      ctx.fillStyle = r.col;
      ctx.beginPath(); ctx.ellipse(0, 0, r.rx, r.ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = r.hi;
      ctx.beginPath(); ctx.ellipse(-r.rx*0.2, -r.ry*0.3, r.rx*0.4, r.ry*0.25, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    // Cracks
    ctx.strokeStyle = uncommon ? "#16162a" : "#1a1a22";
    ctx.lineWidth = 1; ctx.lineCap = "round";
    [[w*0.38+ox,h*0.43+oy,w*0.52+ox,h*0.62+oy],[w*0.52+ox,h*0.62+oy,w*0.44+ox,h*0.74+oy],[w*0.52+ox,h*0.62+oy,w*0.6+ox,h*0.67+oy]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });

    // Uncommon: blue-white vein lines
    if (uncommon) {
      ctx.strokeStyle = "rgba(140,160,220,0.35)";
      ctx.lineWidth = 1.2;
      [[w*0.4+ox,h*0.5+oy,w*0.52+ox,h*0.65+oy],[w*0.44+ox,h*0.48+oy,w*0.38+ox,h*0.6+oy]].forEach(([x1,y1,x2,y2]) => {
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      });
      ctx.fillStyle = "rgba(180,200,255,0.6)";
      [[w*0.46+ox,h*0.46+oy,2],[w*0.5+ox,h*0.58+oy,1.5],[w*0.38+ox,h*0.6+oy,1.5]].forEach(([x,y,r]) => {
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
      });
    }

    // Dust particles
    ctx.fillStyle = uncommon ? "rgba(180,190,255,0.18)" : "rgba(180,180,200,0.12)";
    [[w*0.56,h*0.38,3],[w*0.34,h*0.42,2],[w*0.66,h*0.55,2],[w*0.28,h*0.58,1.5]].forEach(([x,y,r]) => {
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    });
  },

  poi_sap_weep(ctx, w, h, v) {
    const uncommon = v >= 3;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, uncommon ? "#0e1508" : "#0e1208");
    bg.addColorStop(1, "#060a04");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    const pool = ctx.createRadialGradient(w*0.45, h*0.84, 0, w*0.45, h*0.84, w * (uncommon ? 0.4 : 0.32));
    pool.addColorStop(0, uncommon ? "rgba(100,180,40,0.4)" : "rgba(80,140,40,0.35)");
    pool.addColorStop(0.5, "rgba(50,100,20,0.15)");
    pool.addColorStop(1, "transparent");
    ctx.fillStyle = pool; ctx.fillRect(0, 0, w, h);

    // Ground cracks vary by variant
    const crackSets = [
      [[w*0.3,h*0.65,w*0.6,h*0.7],[w*0.45,h*0.6,w*0.55,h*0.8],[w*0.2,h*0.72,w*0.45,h*0.68]],
      [[w*0.25,h*0.67,w*0.55,h*0.72],[w*0.5,h*0.62,w*0.58,h*0.78],[w*0.3,h*0.74,w*0.5,h*0.70]],
      [[w*0.35,h*0.63,w*0.65,h*0.69],[w*0.4,h*0.58,w*0.52,h*0.82],[w*0.18,h*0.70,w*0.42,h*0.66]],
      [[w*0.2,h*0.60,w*0.7,h*0.67],[w*0.45,h*0.55,w*0.6,h*0.80],[w*0.15,h*0.68,w*0.5,h*0.65],[w*0.55,h*0.62,w*0.8,h*0.70]],
      [[w*0.28,h*0.62,w*0.72,h*0.70],[w*0.42,h*0.56,w*0.56,h*0.82],[w*0.1,h*0.70,w*0.4,h*0.65],[w*0.6,h*0.60,w*0.85,h*0.68]],
    ];
    const cracks = crackSets[v] ?? crackSets[0];
    ctx.strokeStyle = uncommon ? "#2e5018" : "#2a4018";
    ctx.lineWidth = uncommon ? 2 : 1.5;
    cracks.forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });

    // Drips
    const dripCounts = [4,5,4,7,8][v] ?? 4;
    const dripBase = [[w*0.38,h*0.55],[w*0.5,h*0.48],[w*0.6,h*0.58],[w*0.44,h*0.62],[w*0.32,h*0.52],[w*0.68,h*0.50],[w*0.55,h*0.44],[w*0.25,h*0.58]];
    for (let i = 0; i < dripCounts && i < dripBase.length; i++) {
      const [x, y] = dripBase[i];
      ctx.strokeStyle = uncommon ? "rgba(120,240,70,0.6)" : "rgba(100,200,60,0.5)";
      ctx.lineWidth = uncommon ? 2.5 : 2;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+2, y+14); ctx.stroke();
      ctx.fillStyle = uncommon ? "rgba(150,255,80,0.5)" : "rgba(120,220,70,0.4)";
      ctx.beginPath(); ctx.ellipse(x+2, y+17, uncommon ? 4 : 3, uncommon ? 5 : 4, 0, 0, Math.PI*2); ctx.fill();
    }

    const glow = ctx.createRadialGradient(w*0.45, h*0.65, 0, w*0.45, h*0.65, w * (uncommon ? 0.5 : 0.4));
    glow.addColorStop(0, uncommon ? "rgba(100,240,50,0.16)" : "rgba(80,200,40,0.12)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  },

  poi_resin_hollow(ctx, w, h, v) {
    const uncommon = v >= 3;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, uncommon ? "#180e06" : "#120d06");
    bg.addColorStop(1, "#0a0704");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    const hollowOffsets = [[0,0],[10,-5],[-8,4],[5,-8],[-6,6]][v] ?? [0,0];
    const [ox, oy] = hollowOffsets;

    // Cavity
    ctx.fillStyle = "#060402";
    ctx.beginPath();
    ctx.ellipse(w*0.45+ox, h*0.62+oy, w*(uncommon?0.28:0.24), h*(uncommon?0.35:0.30), 0.1, 0, Math.PI*2);
    ctx.fill();

    // Rim
    ctx.strokeStyle = uncommon ? "#7a4a00" : "#5a3800";
    ctx.lineWidth = uncommon ? 5 : 4;
    ctx.beginPath();
    ctx.ellipse(w*0.45+ox, h*0.62+oy, w*(uncommon?0.28:0.24), h*(uncommon?0.35:0.30), 0.1, 0, Math.PI*2);
    ctx.stroke();

    // Uncommon: second outer rim glow
    if (uncommon) {
      ctx.strokeStyle = "rgba(255,180,0,0.15)";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.ellipse(w*0.45+ox, h*0.62+oy, w*0.32, h*0.38, 0.1, 0, Math.PI*2);
      ctx.stroke();
    }

    // Chunks — more and brighter for uncommon
    const chunkDefs = uncommon
      ? [[w*0.34+ox,h*0.68+oy,8,"#a05400"],[w*0.46+ox,h*0.72+oy,11,"#e08000"],[w*0.54+ox,h*0.62+oy,8,"#ffb020"],[w*0.38+ox,h*0.58+oy,6,"#c06000"],[w*0.52+ox,h*0.72+oy,5,"#ffd060"],[w*0.40+ox,h*0.75+oy,4,"#ffe090"]]
      : [[w*0.36+ox,h*0.68+oy,7,"#8b4800"],[w*0.48+ox,h*0.72+oy,9,"#c87000"],[w*0.54+ox,h*0.62+oy,6,"#e09020"],[w*0.38+ox,h*0.58+oy,5,"#a05000"]];
    chunkDefs.forEach(([x,y,r,col]) => {
      ctx.fillStyle = col as string;
      ctx.beginPath(); ctx.arc(x as number, y as number, r as number, 0, Math.PI*2); ctx.fill();
    });

    // Inner glow
    const innerGlow = ctx.createRadialGradient(w*0.45+ox, h*0.65+oy, 0, w*0.45+ox, h*0.65+oy, w*(uncommon?0.25:0.2));
    innerGlow.addColorStop(0, uncommon ? "rgba(255,160,0,0.3)" : "rgba(200,120,0,0.2)");
    innerGlow.addColorStop(1, "transparent");
    ctx.fillStyle = innerGlow; ctx.fillRect(0, 0, w, h);

    // Bark lines
    ctx.strokeStyle = uncommon ? "#38200a" : "#2a1800";
    ctx.lineWidth = 1;
    [[w*0.15,h*0.28,w*0.2,h*0.55],[w*0.72,h*0.28,w*0.74,h*0.58],[w*0.1,h*0.54,w*0.16,h*0.80]].forEach(([x1,y1,x2,y2]) => {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.bezierCurveTo(x1+15,y1+15,x2-15,y2-15,x2,y2); ctx.stroke();
    });
  },

  poi_dense_pocket(ctx, w, h, v) {
    const uncommon = v >= 3;
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, uncommon ? "#0c1218" : "#0c0f14");
    bg.addColorStop(1, "#060809");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    const massOffsets = [[0,0],[8,-4],[-6,5],[4,-8],[-5,6]][v] ?? [0,0];
    const [ox, oy] = massOffsets;

    // Dense mass
    ctx.fillStyle = uncommon ? "#1e2d3c" : "#1a2530";
    ctx.beginPath();
    ctx.ellipse(w*0.44+ox, h*0.6+oy, w*(uncommon?0.27:0.24), h*(uncommon?0.33:0.30), 0, 0, Math.PI*2);
    ctx.fill();

    // Strata layers
    const strataCount = uncommon ? 8 : 6;
    for (let i = 0; i < strataCount; i++) {
      const y = h*0.36 + i * (h*0.38/strataCount);
      const xOff = Math.sin(i*0.8) * (uncommon ? 10 : 8);
      ctx.strokeStyle = `rgba(${uncommon?80:60},${uncommon?120:100},${uncommon?180:140},${0.12+i*0.06})`;
      ctx.lineWidth = uncommon ? 2.5 : 2;
      ctx.beginPath();
      ctx.moveTo(w*0.18+xOff+ox, y+oy);
      ctx.bezierCurveTo(w*0.3, y-5+i+oy, w*0.62, y+5-i+oy, w*0.70+xOff+ox, y+oy);
      ctx.stroke();
    }

    // Packed blocks
    const blockPositions = uncommon
      ? [[w*0.30+ox,h*0.60+oy],[w*0.42+ox,h*0.58+oy],[w*0.54+ox,h*0.62+oy],[w*0.34+ox,h*0.68+oy],[w*0.48+ox,h*0.67+oy],[w*0.58+ox,h*0.52+oy]]
      : [[w*0.34+ox,h*0.60+oy],[w*0.44+ox,h*0.58+oy],[w*0.54+ox,h*0.62+oy],[w*0.38+ox,h*0.68+oy],[w*0.50+ox,h*0.67+oy]];
    blockPositions.forEach(([x,y]) => {
      ctx.fillStyle = uncommon ? "rgba(100,160,220,0.28)" : "rgba(80,130,180,0.2)";
      ctx.strokeStyle = uncommon ? "rgba(100,160,220,0.55)" : "rgba(80,130,180,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x-7,y-5,14,9,2);
      ctx.fill(); ctx.stroke();
    });

    // Uncommon: bright teal accents on blocks
    if (uncommon) {
      ctx.fillStyle = "rgba(38,198,218,0.25)";
      blockPositions.slice(0,3).forEach(([x,y]) => {
        ctx.beginPath(); ctx.roundRect(x-5,y-3,10,6,1); ctx.fill();
      });
    }

    const glow = ctx.createRadialGradient(w*0.44+ox, h*0.6+oy, 0, w*0.44+ox, h*0.6+oy, w * (uncommon ? 0.42 : 0.35));
    glow.addColorStop(0, uncommon ? "rgba(38,198,218,0.16)" : "rgba(38,198,218,0.10)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  },
};

// ─── FilamentGateImage component ─────────────────────────────────────────────
export function FilamentGateImage({ width = 440, height = 160 }: { width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background gradient - deep purple-black
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0a0612");
    bg.addColorStop(0.5, "#080410");
    bg.addColorStop(1, "#050208");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    // Subtle ground plane
    const ground = ctx.createLinearGradient(0, h * 0.72, 0, h);
    ground.addColorStop(0, "transparent");
    ground.addColorStop(1, "rgba(40,20,60,0.4)");
    ctx.fillStyle = ground; ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // Arch frame — two side pillars
    const pillarW = w * 0.04;
    const archTop = h * 0.08;
    const archBase = h * 0.78;
    const leftX = w * 0.28;
    const rightX = w * 0.72;

    // Pillar glow halos
    const glowL = ctx.createRadialGradient(leftX, h*0.45, 0, leftX, h*0.45, w*0.12);
    glowL.addColorStop(0, "rgba(120,80,200,0.18)"); glowL.addColorStop(1, "transparent");
    ctx.fillStyle = glowL; ctx.fillRect(0,0,w,h);
    const glowR = ctx.createRadialGradient(rightX, h*0.45, 0, rightX, h*0.45, w*0.12);
    glowR.addColorStop(0, "rgba(120,80,200,0.18)"); glowR.addColorStop(1, "transparent");
    ctx.fillStyle = glowR; ctx.fillRect(0,0,w,h);

    // Left pillar
    const lpGrad = ctx.createLinearGradient(leftX - pillarW, 0, leftX + pillarW, 0);
    lpGrad.addColorStop(0, "#1a0e2e"); lpGrad.addColorStop(0.5, "#2e1a4a"); lpGrad.addColorStop(1, "#1a0e2e");
    ctx.fillStyle = lpGrad;
    ctx.beginPath(); ctx.roundRect(leftX - pillarW, archTop, pillarW*2, archBase - archTop, 3); ctx.fill();
    ctx.strokeStyle = "rgba(160,100,220,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();

    // Right pillar
    const rpGrad = ctx.createLinearGradient(rightX - pillarW, 0, rightX + pillarW, 0);
    rpGrad.addColorStop(0, "#1a0e2e"); rpGrad.addColorStop(0.5, "#2e1a4a"); rpGrad.addColorStop(1, "#1a0e2e");
    ctx.fillStyle = rpGrad;
    ctx.beginPath(); ctx.roundRect(rightX - pillarW, archTop, pillarW*2, archBase - archTop, 3); ctx.fill();
    ctx.strokeStyle = "rgba(160,100,220,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();

    // Arch crown curved top beam
    ctx.beginPath();
    ctx.moveTo(leftX - pillarW, archTop + 8);
    ctx.bezierCurveTo(leftX, archTop - h*0.06, rightX, archTop - h*0.06, rightX + pillarW, archTop + 8);
    ctx.strokeStyle = "rgba(180,120,255,0.7)"; ctx.lineWidth = 4; ctx.stroke();

    // Glowing filaments hanging from arch
    const filamentPositions = [0.38, 0.47, 0.53, 0.62].map(f => w * f);
    const socketY = h * 0.52;
    filamentPositions.forEach((fx, i) => {
      const filamentTopY = archTop + 14;
      const fGrad = ctx.createLinearGradient(fx, filamentTopY, fx, socketY - 10);
      fGrad.addColorStop(0, "rgba(160,100,220,0.6)"); fGrad.addColorStop(1, "rgba(120,60,180,0.9)");
      ctx.strokeStyle = fGrad; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx, filamentTopY); ctx.lineTo(fx, socketY - 10); ctx.stroke();

      const sGlow = ctx.createRadialGradient(fx, socketY, 0, fx, socketY, i < 3 ? 10 : 6);
      sGlow.addColorStop(0, i < 3 ? "rgba(220,160,255,0.6)" : "rgba(80,40,100,0.3)"); sGlow.addColorStop(1, "transparent");
      ctx.fillStyle = sGlow; ctx.beginPath(); ctx.arc(fx, socketY, i < 3 ? 10 : 6, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = i < 3 ? "rgba(200,140,255,0.9)" : "rgba(100,60,140,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(fx, socketY, 5, 0, Math.PI*2); ctx.stroke();
      if (i < 3) { ctx.fillStyle = "rgba(200,140,255,0.4)"; ctx.beginPath(); ctx.arc(fx, socketY, 3, 0, Math.PI*2); ctx.fill(); }
    });

    // Hungry mouth protruding from the arch (lower-left section)
    const mouthX = w * 0.36, mouthY = h * 0.67, mouthW = w * 0.07, mouthH = h * 0.055;
    ctx.fillStyle = "#2a1640"; ctx.strokeStyle = "rgba(140,80,180,0.6)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(mouthX, mouthY, mouthW, mouthH, 0, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(220,180,255,0.55)";
    for (let t = -2; t <= 2; t++) {
      const tx = mouthX + t * (mouthW * 0.35);
      ctx.beginPath(); ctx.moveTo(tx - mouthW*0.1, mouthY - mouthH*0.2);
      ctx.lineTo(tx, mouthY - mouthH*0.78); ctx.lineTo(tx + mouthW*0.1, mouthY - mouthH*0.2);
      ctx.closePath(); ctx.fill();
    }

    // Ambient glow in center
    const centerGlow = ctx.createRadialGradient(w*0.5, h*0.45, 0, w*0.5, h*0.45, w*0.22);
    centerGlow.addColorStop(0, "rgba(100,60,180,0.15)"); centerGlow.addColorStop(1, "transparent");
    ctx.fillStyle = centerGlow; ctx.fillRect(0,0,w,h);

    // Floating dust particles
    ctx.fillStyle = "rgba(200,160,255,0.4)";
    [[w*0.35,h*0.35,1.5],[w*0.52,h*0.25,2],[w*0.65,h*0.38,1.2],[w*0.42,h*0.28,1.8],[w*0.6,h*0.22,1.4]].forEach(([x,y,r]) => {
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    });
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", lineHeight: 0 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: height / 2, display: "block", borderRadius: "10px 10px 0 0" }}
      />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
        background: "linear-gradient(to bottom, transparent, #111)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// ─── PoiImage component ───────────────────────────────────────────────────────
interface PoiImageProps {
  poiId: PoiId;
  variant: number;
  width?: number;
  height?: number;
}

export function PoiImage({ poiId, variant, width = 440, height = 140 }: PoiImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawFn = POI_DRAW[poiId];
    if (!drawFn) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFn(ctx, canvas.width, canvas.height, variant);
  }, [poiId, variant]);

  return (
    <div style={{ position: "relative", width: "100%", lineHeight: 0 }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: height / 2, display: "block", borderRadius: "10px 10px 0 0" }}
      />
      {/* Gradient fade into card background */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "50%",
        background: "linear-gradient(to bottom, transparent, #111)",
        pointerEvents: "none",
        borderRadius: "0 0 0 0",
      }} />
    </div>
  );
}

// ─── PoiIcon component ────────────────────────────────────────────────────────
interface PoiIconProps {
  poiId: PoiId;
  quality?: "common" | "uncommon";
  size?: number;
}

export function PoiIcon({ poiId, quality = "common", size = 80 }: PoiIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const variant = quality === "uncommon" ? 3 : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawFn = POI_DRAW[poiId];
    if (!drawFn) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFn(ctx, canvas.width, canvas.height, variant);
  }, [poiId, variant]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{
        width: size,
        height: size,
        display: "block",
        borderRadius: 10,
        border: quality === "uncommon" ? "1px solid rgba(200,169,110,0.35)" : "1px solid rgba(255,255,255,0.07)",
      }}
    />
  );
}

// ─── Creature canvas illustrations ───────────────────────────────────────────
const CREATURE_DRAW: Record<string, (ctx: CanvasRenderingContext2D, w: number, h: number) => void> = {
  creature_gloop_moth(ctx, w, h) {
    // Dark background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#0e0810");
    bg.addColorStop(1, "#06040a");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

    const cx = w * 0.5, cy = h * 0.5;

    // Soft purple ambient glow behind moth
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.45);
    glow.addColorStop(0, "rgba(140,80,180,0.18)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    // Left wing
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(160,110,200,0.22)";
    ctx.strokeStyle = "rgba(180,130,220,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-w*0.12, -h*0.28, -w*0.42, -h*0.32, -w*0.46, -h*0.08);
    ctx.bezierCurveTo(-w*0.44, h*0.1, -w*0.22, h*0.18, 0, h*0.06);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Wing vein
    ctx.strokeStyle = "rgba(200,160,240,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-w*0.2, -h*0.12, -w*0.38, -h*0.14, -w*0.42, -h*0.04); ctx.stroke();

    // Right wing (mirror)
    ctx.fillStyle = "rgba(160,110,200,0.22)";
    ctx.strokeStyle = "rgba(180,130,220,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(w*0.12, -h*0.28, w*0.42, -h*0.32, w*0.46, -h*0.08);
    ctx.bezierCurveTo(w*0.44, h*0.1, w*0.22, h*0.18, 0, h*0.06);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "rgba(200,160,240,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(w*0.2, -h*0.12, w*0.38, -h*0.14, w*0.42, -h*0.04); ctx.stroke();

    // Lower left wing
    ctx.fillStyle = "rgba(130,85,170,0.18)";
    ctx.strokeStyle = "rgba(160,110,200,0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, h*0.04);
    ctx.bezierCurveTo(-w*0.1, h*0.16, -w*0.3, h*0.26, -w*0.28, h*0.18);
    ctx.bezierCurveTo(-w*0.22, h*0.24, -w*0.08, h*0.2, 0, h*0.12);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Lower right wing
    ctx.beginPath();
    ctx.moveTo(0, h*0.04);
    ctx.bezierCurveTo(w*0.1, h*0.16, w*0.3, h*0.26, w*0.28, h*0.18);
    ctx.bezierCurveTo(w*0.22, h*0.24, w*0.08, h*0.2, 0, h*0.12);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // Body
    ctx.fillStyle = "#3a2450";
    ctx.strokeStyle = "rgba(180,140,220,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, h*0.05, w*0.055, h*0.18, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();

    // Head
    ctx.fillStyle = "#4a2e60";
    ctx.beginPath();
    ctx.ellipse(0, -h*0.14, w*0.06, h*0.07, 0, 0, Math.PI*2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = "rgba(200,160,240,0.6)";
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-w*0.02, -h*0.19); ctx.bezierCurveTo(-w*0.08, -h*0.3, -w*0.18, -h*0.34, -w*0.22, -h*0.32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w*0.02, -h*0.19); ctx.bezierCurveTo(w*0.08, -h*0.3, w*0.18, -h*0.34, w*0.22, -h*0.32); ctx.stroke();
    // Antennae tips (knobs)
    ctx.fillStyle = "rgba(220,180,255,0.7)";
    ctx.beginPath(); ctx.arc(-w*0.22, -h*0.32, w*0.018, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(w*0.22, -h*0.32, w*0.018, 0, Math.PI*2); ctx.fill();

    // Wax drip from underside
    ctx.strokeStyle = "rgba(200,160,60,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-w*0.015, h*0.22); ctx.bezierCurveTo(-w*0.015, h*0.28, -w*0.01, h*0.32, -w*0.01, h*0.36); ctx.stroke();
    ctx.fillStyle = "rgba(210,170,50,0.55)";
    ctx.beginPath(); ctx.ellipse(-w*0.01, h*0.37, w*0.018, h*0.02, 0, 0, Math.PI*2); ctx.fill();

    ctx.restore();
  },
};

// ─── CreatureIcon component ───────────────────────────────────────────────────
interface CreatureIconProps {
  creatureId: string;
  size?: number;
}

export function CreatureIcon({ creatureId, size = 72 }: CreatureIconProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawFn = CREATURE_DRAW[creatureId];
    if (!drawFn) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawFn(ctx, canvas.width, canvas.height);
  }, [creatureId]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{
        width: size,
        height: size,
        display: "block",
        borderRadius: 10,
        border: "1px solid rgba(140,80,180,0.35)",
      }}
    />
  );
}

// ─── Player Character Equipment (image + overlay) ────────────────────────────

export interface EquipmentOption {
  id: ItemId;
  label: string;
}

interface PlayerCharacterEquipmentProps {
  tailSlots: [ItemId | null, ItemId | null];
  footSlots: [ItemId | null, ItemId | null, ItemId | null];
  tailOptions: [EquipmentOption[], EquipmentOption[]];
  footOptions: [EquipmentOption[], EquipmentOption[], EquipmentOption[]];
  itemLabel: (id: ItemId | null) => string;
  onEquip: (slot: "tail0" | "tail1" | "foot0" | "foot1" | "foot2", itemId: ItemId | null) => void;
}

// Slot zones as percentages of the container
const SLOT_ZONES = {
  tail0: { left: "12%", top: "18%", width: "22%", height: "30%", label: "Left tail"   },
  tail1: { left: "66%", top: "18%", width: "22%", height: "30%", label: "Right tail"  },
  foot0: { left: "22%", top: "66%", width: "18%", height: "22%", label: "Left foot"   },
  foot1: { left: "41%", top: "68%", width: "18%", height: "22%", label: "Centre foot" },
  foot2: { left: "60%", top: "66%", width: "18%", height: "22%", label: "Right foot"  },
} as const;

type SlotKey = keyof typeof SLOT_ZONES;

export function PlayerCharacterEquipment({
  tailSlots, footSlots, tailOptions, footOptions, itemLabel, onEquip,
}: PlayerCharacterEquipmentProps) {
  const [hovered, setHovered] = React.useState<SlotKey | null>(null);
  const [openSlot, setOpenSlot] = React.useState<SlotKey | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close popover on outside click
  React.useEffect(() => {
    if (!openSlot) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenSlot(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openSlot]);

  const slotItems: Record<SlotKey, ItemId | null> = {
    tail0: tailSlots[0], tail1: tailSlots[1],
    foot0: footSlots[0], foot1: footSlots[1], foot2: footSlots[2],
  };

  const slotOptions: Record<SlotKey, EquipmentOption[]> = {
    tail0: tailOptions[0], tail1: tailOptions[1],
    foot0: footOptions[0], foot1: footOptions[1], foot2: footOptions[2],
  };

  function handleZoneClick(key: SlotKey) {
    setOpenSlot(prev => prev === key ? null : key);
  }

  function handleEquip(key: SlotKey, itemId: ItemId | null) {
    onEquip(key, itemId);
    setOpenSlot(null);
  }

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", maxWidth: 180, aspectRatio: "1 / 1" }}>
      {/* Creature image */}
      <img
        src="/creature.jpg"
        alt="Your creature"
        style={{ width: "100%", height: "100%", display: "block", borderRadius: 8 }}
        draggable={false}
      />

      {/* Slot overlay zones */}
      {(Object.keys(SLOT_ZONES) as SlotKey[]).map((key) => {
        const zone = SLOT_ZONES[key];
        const item = slotItems[key];
        const isHovered = hovered === key;
        const isOpen = openSlot === key;
        const options = slotOptions[key];

        return (
          <div key={key} style={{ position: "absolute", left: zone.left, top: zone.top, width: zone.width, height: zone.height }}>
            {/* Clickable zone */}
            <div
              title={zone.label}
              onClick={() => handleZoneClick(key)}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                width: "100%",
                height: "100%",
                cursor: "pointer",
                borderRadius: 6,
                border: isOpen
                  ? "2px solid rgba(200,169,110,1)"
                  : isHovered
                  ? "2px solid rgba(200,169,110,0.85)"
                  : item
                  ? "2px solid rgba(200,169,110,0.4)"
                  : "2px dashed rgba(255,255,255,0.2)",
                background: isOpen
                  ? "rgba(200,169,110,0.2)"
                  : isHovered
                  ? "rgba(200,169,110,0.15)"
                  : item
                  ? "rgba(200,169,110,0.08)"
                  : "transparent",
                transition: "border 0.12s, background 0.12s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {item ? (
                <div style={{
                  background: "rgba(0,0,0,0.65)",
                  borderRadius: "50%",
                  width: 22, height: 22,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}>
                  <ItemIcon id={item} size={14} />
                </div>
              ) : (
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: isOpen || isHovered ? "rgba(200,169,110,0.7)" : "rgba(255,255,255,0.2)",
                  transition: "background 0.12s",
                }} />
              )}
            </div>

            {/* Popover — drops down from zone */}
            {isOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: (key === "tail0" || key === "foot0") ? "0" : key === "tail1" || key === "foot2" ? "auto" : "50%",
                right: (key === "tail1" || key === "foot2") ? "0" : "auto",
                transform: (key === "tail0" || key === "foot0" || key === "tail1" || key === "foot2") ? "none" : "translateX(-50%)",
                minWidth: 150,
                background: "#1a1a1a",
                border: "1px solid #3a3a2a",
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0,0,0,0.7)",
                zIndex: 200,
                overflow: "hidden",
              }}>
                {/* Slot label header */}
                <div style={{
                  fontSize: "0.68rem", opacity: 0.45,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  padding: "6px 10px 4px",
                  borderBottom: "1px solid #2a2a2a",
                }}>
                  {zone.label}
                </div>

                {/* Empty option */}
                <div
                  onClick={() => handleEquip(key, null)}
                  style={{
                    padding: "8px 10px",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    opacity: item ? 0.45 : 0.7,
                    borderBottom: "1px solid #222",
                    background: !item ? "rgba(255,255,255,0.04)" : "transparent",
                    display: "flex", alignItems: "center", gap: 6,
                    minHeight: 36,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
                  onMouseLeave={e => (e.currentTarget.style.background = !item ? "rgba(255,255,255,0.04)" : "transparent")}
                >
                  {!item && <span style={{ color: "rgba(200,169,110,0.8)", fontSize: "0.7rem" }}>✓</span>}
                  <span>— empty —</span>
                </div>

                {/* Available items */}
                {options.length === 0 ? (
                  <div style={{ padding: "8px 10px", fontSize: "0.78rem", opacity: 0.35, fontStyle: "italic" }}>
                    Nothing available
                  </div>
                ) : (
                  options.map((opt) => {
                    const isEquipped = item === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleEquip(key, opt.id)}
                        style={{
                          padding: "8px 10px",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          display: "flex", alignItems: "center", gap: 8,
                          background: isEquipped ? "rgba(200,169,110,0.1)" : "transparent",
                          borderBottom: "1px solid #1e1e1e",
                          minHeight: 36,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = isEquipped ? "rgba(200,169,110,0.18)" : "rgba(255,255,255,0.07)")}
                        onMouseLeave={e => (e.currentTarget.style.background = isEquipped ? "rgba(200,169,110,0.1)" : "transparent")}
                      >
                        <ItemIcon id={opt.id} size={14} />
                        <span style={{ flex: 1 }}>{opt.label}</span>
                        {isEquipped && <span style={{ color: "rgba(200,169,110,0.8)", fontSize: "0.7rem" }}>✓</span>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PLAYER SPRITE ───────────────────────────────────────────────────────────
// Spritesheet: creature_spritefile.jpg — 2000×2000px, 6 cols × 6 rows, 36 frames
// Place the jpg at: public/creature_spritefile.jpg
// Frame size: 333.333px — animated at ~22fps

const SPRITE_COLS = 6;
const SPRITE_ROWS = 6;
const SPRITE_FRAME_W = 2000 / SPRITE_COLS;
const SPRITE_FRAME_H = 2000 / SPRITE_ROWS;
const SPRITE_FPS = 22;
const SPRITE_TOTAL = SPRITE_COLS * SPRITE_ROWS;

export function PlayerSprite({ size = 120 }: { size?: number }) {
  const scale = size / SPRITE_FRAME_W;
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      frameRef.current = (frameRef.current + 1) % SPRITE_TOTAL;
      const col = frameRef.current % SPRITE_COLS;
      const row = Math.floor(frameRef.current / SPRITE_COLS);
      if (containerRef.current) {
        containerRef.current.style.backgroundPosition =
          `${-col * SPRITE_FRAME_W * scale}px ${-row * SPRITE_FRAME_H * scale}px`;
      }
    }, 1000 / SPRITE_FPS);
    return () => clearInterval(interval);
  }, [scale]);

  return (
    <div
      ref={containerRef}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(/creature_spritefile.jpg)`,
        backgroundSize: `${2000 * scale}px ${2000 * scale}px`,
        backgroundPosition: "0px 0px",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        flexShrink: 0,
      }}
    />
  );
}
