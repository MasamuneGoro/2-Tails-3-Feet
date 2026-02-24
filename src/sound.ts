// ─── Sound Manager ────────────────────────────────────────────────────────────
const SFX_IDS = [
  "sfx_click",
  "sfx_transition",
  "sfx_journey_start",
  "sfx_journey_arrive",
  "sfx_event_good",
  "sfx_event_bad",
  "sfx_item_pickup",
  "sfx_item_fly",
  "sfx_harvest_poke",
  "sfx_harvest_smash",
  "sfx_harvest_tease",
  "sfx_harvest_drill",
  "sfx_harvest_scoop",
  "sfx_craft_open",
  "sfx_craft_start",
  "sfx_craft_success",
  "sfx_craft_fail",
  "sfx_flop_down",
  "sfx_wake_up",
  "sfx_chomp",
  "sfx_eat_sap",
  "sfx_hunger_warning",
  "sfx_inventory_open",
  "sfx_food_expiring",
  "sfx_exhausted",
  "sfx_dead",
  "sfx_level_up",
  "sfx_marker_claim",
  "sfx_trophy_earned",
  "sfx_gate_slot",
  "sfx_gate_activate",
] as const;

export type SfxId = typeof SFX_IDS[number];

const cache = new Map<SfxId, HTMLAudioElement>();
let unlocked = false;

// Track the journey_start instance so we can truncate it
let journeyStartInstance: HTMLAudioElement | null = null;

// Track whether any non-click sound is currently playing, to suppress sfx_click
let nonClickPlaying = false;
let nonClickTimer: ReturnType<typeof setTimeout> | null = null;

function markNonClickPlaying(durationMs: number) {
  nonClickPlaying = true;
  if (nonClickTimer) clearTimeout(nonClickTimer);
  nonClickTimer = setTimeout(() => { nonClickPlaying = false; }, durationMs);
}

export function unlockAudio() {
  unlocked = true;
}

function getAudio(id: SfxId): HTMLAudioElement {
  if (!cache.has(id)) {
    const audio = new Audio(`/sfx/${id}.mp3`);
    audio.preload = "auto";
    cache.set(id, audio);
  }
  return cache.get(id)!;
}

export function preloadAll() {
  for (const id of SFX_IDS) getAudio(id);
}

// Durations in ms (approximate, used for click suppression window)
const DURATIONS: Partial<Record<SfxId, number>> = {
  sfx_journey_start:  5060,
  sfx_journey_arrive: 2060,
  sfx_transition:     2060,
  sfx_event_good:      650,
  sfx_event_bad:       650,
  sfx_item_pickup:     650,
  sfx_item_fly:        940,
  sfx_harvest_poke:   1250,
  sfx_harvest_smash:  1250,
  sfx_harvest_tease:  1250,
  sfx_harvest_drill:  1250,
  sfx_harvest_scoop:  1250,
  sfx_craft_open:     1250,
  sfx_craft_start:    1250,
  sfx_craft_success:  1250,
  sfx_craft_fail:     1250,
  sfx_flop_down:      1250,
  sfx_wake_up:        1250,
  sfx_chomp:          1250,
  sfx_eat_sap:         940,
  sfx_hunger_warning:  940,
  sfx_inventory_open:  940,
  sfx_food_expiring:   940,
  sfx_exhausted:       940,
  sfx_dead:           1540,
  sfx_level_up:       1540,
  sfx_marker_claim:    650,
  sfx_trophy_earned:  1540,
  sfx_gate_slot:       940,
  sfx_gate_activate:  2500,
};

export function playSfx(id: SfxId, delayMs = 0) {
  if (!unlocked) return;

  // Mark non-click sounds as "coming" immediately so the simultaneous sfx_click
  // is suppressed even before the delayed sound actually plays.
  if (id !== "sfx_click") {
    markNonClickPlaying((DURATIONS[id] ?? 1500) + delayMs);
  }

  setTimeout(() => {
    // Suppress click if any non-click sound is active
    if (id === "sfx_click" && nonClickPlaying) return;

    // Truncate journey_start if a new non-click sound fires
    if (id !== "sfx_click" && journeyStartInstance) {
      journeyStartInstance.pause();
      journeyStartInstance.currentTime = 0;
      journeyStartInstance = null;
    }

    const audio = getAudio(id);
    const instance = audio.cloneNode() as HTMLAudioElement;
    instance.volume = VOLUMES[id] ?? 1.0;
    instance.play().catch(() => {});

    if (id === "sfx_journey_start") {
      journeyStartInstance = instance;
      instance.addEventListener("ended", () => { journeyStartInstance = null; });
    }
  }, delayMs);
}

// ─── BGM Manager ──────────────────────────────────────────────────────────────

export type BgmTrack = "hub" | "journey" | "battle";

const BATTLE_VARIANTS = ["battle_1", "battle_2", "battle_3", "battle_4"] as const;

let bgmCurrent: BgmTrack | null = null;
let bgmElement: HTMLAudioElement | null = null;
let bgmVolume = 0.35; // default BGM volume (lower than SFX)
let bgmFadeTimer: ReturnType<typeof setTimeout> | null = null;

function getBgmSrc(track: BgmTrack): string {
  if (track === "battle") {
    const variant = BATTLE_VARIANTS[Math.floor(Math.random() * BATTLE_VARIANTS.length)];
    return `/bgm/${variant}.mp3`;
  }
  return `/bgm/${track}.mp3`;
}

function fadeOutAndStop(el: HTMLAudioElement, onDone?: () => void) {
  const step = el.volume / 20;
  const interval = setInterval(() => {
    if (el.volume <= step) {
      el.pause();
      el.volume = 0;
      clearInterval(interval);
      onDone?.();
    } else {
      el.volume = Math.max(0, el.volume - step);
    }
  }, 25);
}

export function setBgmVolume(v: number) {
  bgmVolume = Math.max(0, Math.min(1, v));
  if (bgmElement && !bgmElement.paused) {
    bgmElement.volume = bgmVolume;
  }
}

export function getBgmVolume(): number {
  return bgmVolume;
}

export function playBgm(track: BgmTrack) {
  if (!unlocked) return;
  if (bgmCurrent === track && bgmElement && !bgmElement.paused) return;

  if (bgmFadeTimer) { clearTimeout(bgmFadeTimer); bgmFadeTimer = null; }

  const startNew = () => {
    bgmCurrent = track;
    const el = new Audio(getBgmSrc(track));
    el.loop = true;
    el.volume = 0;
    el.preload = "auto";
    bgmElement = el;
    el.play().then(() => {
      // Fade in
      const target = bgmVolume;
      const step = target / 20;
      const interval = setInterval(() => {
        if (el.volume >= target - step) {
          el.volume = target;
          clearInterval(interval);
        } else {
          el.volume = Math.min(target, el.volume + step);
        }
      }, 25);
    }).catch(() => {});
  };

  if (bgmElement && !bgmElement.paused) {
    const old = bgmElement;
    bgmElement = null;
    bgmCurrent = null;
    fadeOutAndStop(old, startNew);
  } else {
    startNew();
  }
}

export function stopBgm() {
  if (bgmElement && !bgmElement.paused) {
    const old = bgmElement;
    bgmElement = null;
    bgmCurrent = null;
    fadeOutAndStop(old);
  }
}

// ─── SFX Volumes ──────────────────────────────────────────────────────────────

const VOLUMES: Partial<Record<SfxId, number>> = {
  sfx_click:          0.5,
  sfx_transition:     0.4,
  sfx_journey_start:  0.7,
  sfx_journey_arrive: 0.6,
  sfx_event_good:     0.6,
  sfx_event_bad:      0.6,
  sfx_item_pickup:    0.5,
  sfx_item_fly:       0.4,
  sfx_harvest_poke:   0.65,
  sfx_harvest_smash:  0.7,
  sfx_harvest_tease:  0.6,
  sfx_harvest_drill:  0.65,
  sfx_harvest_scoop:  0.65,
  sfx_craft_open:     0.55,
  sfx_craft_start:    0.6,
  sfx_craft_success:  0.7,
  sfx_craft_fail:     0.6,
  sfx_flop_down:      0.7,
  sfx_wake_up:        0.65,
  sfx_chomp:          0.5,
  sfx_eat_sap:        0.55,
  sfx_hunger_warning: 0.6,
  sfx_inventory_open: 0.45,
  sfx_food_expiring:  0.5,
  sfx_exhausted:      0.75,
  sfx_dead:           0.8,
  sfx_level_up:       0.75,
  sfx_marker_claim:   0.6,
  sfx_trophy_earned:  0.8,
  sfx_gate_slot:      0.65,
  sfx_gate_activate:  0.9,
};
