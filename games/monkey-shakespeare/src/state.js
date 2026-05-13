import {
  QUALITY_TIERS, DISTRIBUTION_TIERS, BANANA_TIERS,
  WORDS_PER_PIECE, BANANA_CONSUMPTION_INTERVAL, OFFLINE_CAP_SECONDS,
  MANUAL_PIECE_PRICE, getProductionTicks, getQualityTier,
} from './economy.js';

const SAVE_KEY = 'monkey_shakespeare_v1';

export const INITIAL_STATE = {
  money: 0,
  bananas: 20,
  monkeys: 0,
  speedMultiplier: 1,
  educationCapacity: 0,
  bananaTier: 0,
  distributionTier: 0,
  totalWords: 0,
  totalPieces: 0,
  productionProgress: 0,
  bananaTick: 0,
  bananaAutoTick: 0,
  saveTick: 0,
  monkeysStalled: false,
  purchased: [],
  manualProgress: 0,
  pendingPieces: 0,
  lastSave: Date.now(),
  gameWon: false,
};

let _saveWarningShown = false;

export function saveGame(state) {
  const payload = { ...state, lastSave: Date.now() };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    if (!_saveWarningShown) {
      _saveWarningShown = true;
      const el = document.getElementById('save-warning');
      if (el) { el.hidden = false; }
    }
  }
}

export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);

    const elapsedSeconds = Math.min(
      (Date.now() - (save.lastSave ?? Date.now())) / 1000,
      OFFLINE_CAP_SECONDS,
    );

    if (elapsedSeconds > 10 && save.monkeys > 0 && !save.monkeysStalled) {
      applyOfflineProgress(save, Math.floor(elapsedSeconds));
    }

    // Merge with INITIAL_STATE to fill any missing fields from older saves.
    // Always reset pendingPieces — offline progress is handled separately.
    return { ...INITIAL_STATE, ...save, pendingPieces: 0 };
  } catch {
    return null;
  }
}

function applyOfflineProgress(state, ticks) {
  const prodTicks = getProductionTicks(state.speedMultiplier ?? 1);
  const cycles = Math.floor(ticks / prodTicks);
  if (cycles === 0) return;

  const edCap = state.educationCapacity ?? 0;
  const educationRatio = state.monkeys > 0 ? Math.min(edCap, state.monkeys) / state.monkeys : 0;
  const qualityIndex = getQualityTier(educationRatio);
  const pricePerPiece = QUALITY_TIERS[qualityIndex].basePrice * DISTRIBUTION_TIERS[state.distributionTier ?? 0].multiplier;
  const totalPieces = cycles * state.monkeys;

  state.money = (state.money ?? 0) + pricePerPiece * totalPieces;
  state.totalWords = (state.totalWords ?? 0) + totalPieces * WORDS_PER_PIECE;
  state.totalPieces = (state.totalPieces ?? 0) + totalPieces;

  const bananaTier = BANANA_TIERS[state.bananaTier ?? 0];
  if (!bananaTier?.infinite) {
    const consumeEvents = Math.floor(ticks / BANANA_CONSUMPTION_INTERVAL);
    const consumed = consumeEvents * state.monkeys;
    let autoBought = 0;
    if (bananaTier?.auto && bananaTier.tickInterval) {
      autoBought = Math.floor(ticks / bananaTier.tickInterval) * bananaTier.amount;
    }
    state.bananas = Math.max(0, (state.bananas ?? 0) + autoBought - consumed);
    state.monkeysStalled = state.bananas === 0;
  }
}
