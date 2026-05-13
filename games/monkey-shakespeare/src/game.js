import {
  UPGRADES, QUALITY_TIERS, DISTRIBUTION_TIERS, BANANA_TIERS,
  WORDS_PER_PIECE, BANANA_CONSUMPTION_INTERVAL, SAVE_INTERVAL,
  MANUAL_CLICKS_PER_PIECE, MANUAL_PIECE_PRICE,
  getProductionTicks, getQualityTier, getLitMultiplier, getShakespeareChance,
  SHAKESPEARE_WORDS_THRESHOLD, formatExpectedTime, chanceInWindow,
} from './economy.js';

const WORD_MILESTONES = [
  { words: SHAKESPEARE_WORDS_THRESHOLD * 0.10, label: '10% of the way to Shakespeare — keep going!' },
  { words: SHAKESPEARE_WORDS_THRESHOLD * 0.25, label: '25% there — your monkeys are finding their rhythm.' },
  { words: SHAKESPEARE_WORDS_THRESHOLD * 0.50, label: 'Halfway! 500,000 words typed.' },
  { words: SHAKESPEARE_WORDS_THRESHOLD * 0.75, label: '75% — the Bard is within reach.' },
  { words: SHAKESPEARE_WORDS_THRESHOLD,        label: '1,000,000 words! Peak Shakespeare probability unlocked.' },
];
// Called by scene when player sells to an NPC. Sells all pending pieces at once.
export function sellOnePiece() {
  if (!state || state.pendingPieces <= 0 || state.gameWon) return 0;
  const edRatio = state.monkeys > 0
    ? Math.min(state.educationCapacity, state.monkeys) / state.monkeys
    : 0;
  const qi = getQualityTier(edRatio);
  const quality = QUALITY_TIERS[qi];
  const price = quality.basePrice * DISTRIBUTION_TIERS[state.distributionTier].multiplier;
  const count = state.pendingPieces;
  state.pendingPieces = 0;
  state.money += price * count;
  addFeedEntry(quality.name, price, count, false);
  updateStats(state);
  return price * count;
}

import { INITIAL_STATE, saveGame, loadGame, deleteSave } from './state.js?v=3';
import { updateStats, renderUpgrades, addFeedEntry, showWinScreen, showOfflineBanner, showQualityBanner, showMilestoneBanner } from './ui.js?v=3';
import { initScene } from './scene.js?v=3';

// --- State ---

let state = null;

function initState() {
  const moneyBefore = 0;
  const saved = loadGame();

  if (saved) {
    const secondsAway = Math.min(
      (Date.now() - (saved.lastSave ?? Date.now())) / 1000,
      8 * 3600,
    );
    state = saved;
    if (state.gameWon) {
      showWinScreen(state);
      return;
    }
    if (secondsAway > 60 && state.monkeys > 0) {
      showOfflineBanner(secondsAway, Math.max(0, state.money - moneyBefore));
    }
  } else {
    state = { ...INITIAL_STATE, lastSave: Date.now() };
  }
}

// --- Game loop (1 tick = 1 second) ---

const SAVE_INTERVAL_TICKS = 10;

function tick() {
  if (state.gameWon) return;

  // 1. Banana consumption every 10 ticks
  if (state.monkeys > 0) {
    state.bananaTick++;
    if (state.bananaTick >= BANANA_CONSUMPTION_INTERVAL) {
      state.bananaTick = 0;
      const tier = BANANA_TIERS[state.bananaTier];
      if (tier?.infinite) {
        state.monkeysStalled = false;
      } else if (state.bananas >= state.monkeys) {
        state.bananas -= state.monkeys;
        state.monkeysStalled = false;
      } else {
        state.bananas = 0;
        state.monkeysStalled = true;
      }
    }

    // Auto banana buy
    if (state.bananaTier > 0) {
      const tier = BANANA_TIERS[state.bananaTier];
      if (tier && !tier.infinite && tier.tickInterval) {
        state.bananaAutoTick++;
        if (state.bananaAutoTick >= tier.tickInterval) {
          state.bananaAutoTick = 0;
          state.bananas += tier.amount;
        }
      }
    }
  }

  // 2. Monkey production
  if (state.monkeys > 0 && !state.monkeysStalled) {
    state.productionProgress++;
    const prodTicks = getProductionTicks(state.speedMultiplier);
    if (state.productionProgress >= prodTicks) {
      state.productionProgress = 0;
      completePieces(state.monkeys, false);
    }
  }

  // 3. Shakespeare roll (once per second)
  const litMult = getLitMultiplier(state.purchased);
  const chance = getShakespeareChance(state.totalWords, state.monkeys, state.educationCapacity, litMult);
  if (chance > 0 && Math.random() < chance) {
    state.gameWon = true;
    triggerShakespeare();
    saveGame(state);
    return;
  }

  // 4. Auto-save every 10 ticks
  state.saveTick++;
  if (state.saveTick >= SAVE_INTERVAL_TICKS) {
    state.saveTick = 0;
    saveGame(state);
  }

  // 5. Quality tier change detection
  if (state.monkeys > 0) {
    const edRatio = Math.min(state.educationCapacity, state.monkeys) / state.monkeys;
    const currentTier = getQualityTier(edRatio);
    if (state._lastQualityTier === undefined) state._lastQualityTier = currentTier;
    if (currentTier > state._lastQualityTier) {
      showQualityBanner(QUALITY_TIERS[state._lastQualityTier].name, QUALITY_TIERS[currentTier].name);
      state._lastQualityTier = currentTier;
    }
  }

  // 6. Word milestone detection
  if (state._lastMilestoneIdx === undefined) {
    state._lastMilestoneIdx = WORD_MILESTONES.filter(m => state.totalWords >= m.words).length - 1;
  }
  const nextMilestone = WORD_MILESTONES[state._lastMilestoneIdx + 1];
  if (nextMilestone && state.totalWords >= nextMilestone.words) {
    state._lastMilestoneIdx++;
    showMilestoneBanner(nextMilestone.label);
  }

  updateStats(state);
  renderUpgrades(state);
}

function completePieces(count, isManual) {
  state.totalWords += count * WORDS_PER_PIECE;
  state.totalPieces += count;

  if (isManual) {
    // Manual typing: sell immediately (player is right there)
    const distMult = DISTRIBUTION_TIERS[state.distributionTier].multiplier;
    const price = MANUAL_PIECE_PRICE * distMult;
    state.money += price * count;
    addFeedEntry('Simple Paragraph', price, count, true);
  } else {
    // Monkey production: queue for NPC selling via scene callback
    state.pendingPieces += count;
  }
}

// --- Win ---

function triggerShakespeare() {
  showWinScreen(state);
}

// --- Player actions ---

export function manualType() {
  if (state.gameWon) return;
  state.manualProgress++;
  if (state.manualProgress >= MANUAL_CLICKS_PER_PIECE) {
    state.manualProgress = 0;
    completePieces(1, true);
  }
  updateStats(state);
  renderUpgrades(state);
}

export function manualBuyBananas() {
  const cost = 0.50;
  const amount = 500;
  if (state.money < cost) return;
  state.money -= cost;
  state.bananas += amount;
  if (state.monkeysStalled && state.bananas >= state.monkeys) {
    state.monkeysStalled = false;
  }
  updateStats(state);
}

export function purchaseUpgrade(id) {
  const upg = UPGRADES.find(u => u.id === id);
  if (!upg) return;
  if (state.purchased.includes(id)) return;
  if (upg.requires && !state.purchased.includes(upg.requires)) return;
  if (state.money < upg.cost) return;

  state.money -= upg.cost;
  state.purchased.push(id);

  const eff = upg.effect;
  if (eff.addMonkeys)        state.monkeys += eff.addMonkeys;
  if (eff.speedMultiplier)   state.speedMultiplier = eff.speedMultiplier;
  if (eff.educationCapacity) state.educationCapacity = Math.max(state.educationCapacity, eff.educationCapacity);
  if (eff.bananaTier != null)       state.bananaTier = eff.bananaTier;
  if (eff.distributionTier != null) state.distributionTier = eff.distributionTier;
  // litBonus upgrades are computed dynamically via getLitMultiplier()

  updateStats(state);
  renderUpgrades(state);
}

export function resetGame() {
  deleteSave();
  state = { ...INITIAL_STATE, lastSave: Date.now() };
  const feed = document.getElementById('output-feed');
  if (feed) feed.innerHTML = '';
  const win = document.getElementById('win-overlay');
  if (win) win.hidden = true;
  updateStats(state);
  renderUpgrades(state);
}

// --- Boot ---

export function init() {
  initState();
  updateStats(state);
  renderUpgrades(state);

  // Upgrade click delegation
  document.getElementById('upgrade-panel')?.addEventListener('click', e => {
    const btn = e.target.closest('.upgrade-btn');
    if (btn?.dataset.id) purchaseUpgrade(btn.dataset.id);
  });

  document.getElementById('type-btn')?.addEventListener('click', manualType);
  document.getElementById('buy-bananas-btn')?.addEventListener('click', manualBuyBananas);
  document.getElementById('reset-btn')?.addEventListener('click', () => {
    if (confirm('Reset all progress?')) resetGame();
  });

  document.getElementById('win-reset-btn')?.addEventListener('click', () => {
    if (confirm('Start a new game?')) resetGame();
  });

  // Tab switching
  document.getElementById('upgrade-panel')?.addEventListener('click', e => {
    const tab = e.target.closest('.tab-btn');
    if (!tab) return;
    const tree = tab.dataset.tree;
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.upgrade-tree').forEach(t => t.hidden = true);
    tab.classList.add('active');
    const treeEl = document.getElementById(`upgrades-${tree}`);
    if (treeEl) treeEl.hidden = false;
  });

  setInterval(tick, 1000);
  initScene(() => state, sellOnePiece);
}
