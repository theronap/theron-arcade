import {
  UPGRADES, QUALITY_TIERS, DISTRIBUTION_TIERS, BANANA_TIERS,
  WORDS_PER_PIECE, BANANA_CONSUMPTION_INTERVAL, SAVE_INTERVAL,
  MANUAL_CLICKS_PER_PIECE, MANUAL_PIECE_PRICE,
  getProductionTicks, getQualityTier, getLitMultiplier, getShakespeareChance,
  SHAKESPEARE_WORDS_THRESHOLD, formatExpectedTime, chanceInWindow,
} from './economy.js?v=6';

const WORD_MILESTONES = [
  { words: SHAKESPEARE_WORDS_THRESHOLD * 0.10, label: '10% of the way to Shakespeare — keep going!' },
  { words: SHAKESPEARE_WORDS_THRESHOLD * 0.25, label: '25% there — your monkeys are finding their rhythm.' },
  { words: SHAKESPEARE_WORDS_THRESHOLD * 0.50, label: 'Halfway! 500,000 words typed.' },
  { words: SHAKESPEARE_WORDS_THRESHOLD * 0.75, label: '75% — the Bard is within reach.' },
  { words: SHAKESPEARE_WORDS_THRESHOLD,        label: '1,000,000 words! Peak Shakespeare probability unlocked.' },
];
// Professor Pemberton fires one dialogue per id, checked each tick and on upgrade purchase.
const PROFESSOR_DIALOGUES = [
  {
    id: 'reality_check',
    check: (st) => st.totalWords >= SHAKESPEARE_WORDS_THRESHOLD * 0.10 && st.monkeys > 0,
    text: (st) => `"Do you have any idea what you're attempting? Producing all of Hamlet by random keystrokes — 130,000 characters — requires roughly 1 in 10^186,000 attempts. Your ${st.monkeys} monkey${st.monkeys !== 1 ? 's' : ''} would need approximately 10^185,990 years. The observable universe is only 10^10 years old. This... is not going to work."`,
  },
  {
    id: 'edu_pivot',
    check: (st) => st.educationCapacity > 0,
    text: () => `"Wait. I've been thinking about this wrong. What if instead of random characters the monkeys only typed real English words? Hamlet uses roughly 5,000 distinct words. Each keystroke is a word, not a letter. The search space drops from 27^130,000 to 5,000^30,000. That's still 10^113,000 years — but it's 73,000 orders of magnitude better. We might actually have a strategy here."`,
  },
  {
    id: 'words_halfway',
    check: (st) => st.totalWords >= SHAKESPEARE_WORDS_THRESHOLD * 0.50 && st.educationCapacity > 0,
    text: () => `"The monkeys are reading. Writing. Improving. The Shakespeare probability is climbing toward something real — not guaranteed, but finite. For the first time in this enterprise, I am not completely certain this is a fool's errand."`,
  },
  {
    id: 'words_peak',
    check: (st) => st.totalWords >= SHAKESPEARE_WORDS_THRESHOLD,
    text: () => `"One million words. The system is primed. Maximum Shakespeare probability is now in effect. Every second, every keystroke — it could happen. The Bard is within statistical reach."`,
  },
  {
    id: 'first_building',
    check: (st) => st.monkeys >= 10,
    text: (st) => `"Ten monkeys. At this rate — one key per second each — you'd need roughly 10^185,000 years to produce Hamlet by chance. The heat death of the universe is in 10^14 years. I came here to tell you this is futile, but I notice I cannot stop watching."`,
  },
  {
    id: 'edu_classroom_bought',
    check: (st) => st.purchased.includes('edu_classroom'),
    text: () => `"A classroom. You're actually teaching them. If we constrain output to real English words — 170,000 in the language — instead of random characters, each keystroke selects a word. Hamlet is roughly 30,000 words. That's 170,000^30,000 combinations. Still 10^150,000. But we've cut the exponent by 35,000 orders. Progress."`,
  },
  {
    id: 'sub_literature_bought',
    check: (st) => st.purchased.includes('sub_literature'),
    text: (st) => `"Literature Studies. The monkeys are reading the source material. They're not random anymore — they're approximating it. ${st.monkeys} educated primates studying Shakespeare, then typing Shakespeare. I begin to think this might actually... no. No, I won't say it yet."`,
  },
  {
    id: 'quantum_keyboard',
    check: (st) => st.purchased.includes('typewriter_quantum'),
    text: () => `"A quantum keyboard. At this typing speed we're rolling the dice thousands of times per second. The probability is still infinitesimal, but it is no longer zero per human lifetime. I owe you an apology, I think. Don't tell anyone I said that."`,
  },
  {
    id: 'big_publisher',
    check: (st) => st.distributionTier >= 4,
    text: () => `"A publisher. You've turned a probability experiment into a business. I came here to study the infinite monkey theorem. Instead I find myself peer-reviewing manuscripts written by chimpanzees. My colleagues will never believe this."`,
  },
];

function checkProfessorDialogues() {
  if (!state || state.gameWon) return;
  if (!state.shownDialogues) state.shownDialogues = [];
  for (const dlg of PROFESSOR_DIALOGUES) {
    if (!state.shownDialogues.includes(dlg.id) && dlg.check(state)) {
      state.shownDialogues.push(dlg.id);
      showProfessorDialogue(dlg.text(state));
      triggerProfApproach();
      return; // one at a time
    }
  }
}

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

import { INITIAL_STATE, saveGame, loadGame, deleteSave } from './state.js?v=6';
import { updateStats, renderUpgrades, addFeedEntry, showWinScreen, showOfflineBanner, showQualityBanner, showMilestoneBanner, showProfessorDialogue } from './ui.js?v=6';
import { initScene, triggerProfApproach } from './scene.js?v=6';

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

  // 7. Professor dialogue triggers
  checkProfessorDialogues();

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

  checkProfessorDialogues();
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
