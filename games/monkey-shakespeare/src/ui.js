import {
  QUALITY_TIERS, DISTRIBUTION_TIERS, BANANA_TIERS, UPGRADES,
  formatMoney, formatNumber, getShakespeareChance, getLitMultiplier,
  MANUAL_CLICKS_PER_PIECE, SHAKESPEARE_WORDS_THRESHOLD,
  formatExpectedTime, chanceInWindow,
} from './economy.js?v=6';

const MAX_FEED_ENTRIES = 12;

export function updateStats(state) {
  setText('stat-money', formatMoney(state.money));
  setText('stat-bananas', formatNumber(state.bananas));
  setText('stat-monkeys', formatNumber(state.monkeys));
  setText('stat-pending', formatNumber(state.pendingPieces ?? 0));
  setText('stat-words', formatNumber(state.totalWords));
  setText('stat-pieces', formatNumber(state.totalPieces));

  const litMult = getLitMultiplier(state.purchased);
  const chance = getShakespeareChance(state.totalWords, state.monkeys, state.educationCapacity, litMult);
  const pct = (chance * 100).toFixed(6);
  setText('stat-shakespeare', `${pct}%`);
  setText('stat-expected-time', formatExpectedTime(chance));
  setText('stat-hour-chance', `${(chanceInWindow(chance, 3600) * 100).toFixed(6)}%`);

  const wordsProgress = Math.min(100, (state.totalWords / SHAKESPEARE_WORDS_THRESHOLD) * 100);
  setProgress('words-progress', wordsProgress);

  const edRatio = state.monkeys > 0
    ? Math.min(state.educationCapacity, state.monkeys) / state.monkeys
    : 0;
  const qualityIndex = getQualityTierIndex(edRatio);
  const distMult = DISTRIBUTION_TIERS[state.distributionTier].multiplier;
  const pricePerPiece = QUALITY_TIERS[qualityIndex].basePrice * distMult;

  setText('monkey-quality', QUALITY_TIERS[qualityIndex].name);
  setText('monkey-price', formatMoney(pricePerPiece) + ' / piece');
  setText('dist-name', DISTRIBUTION_TIERS[state.distributionTier].name);
  setText('banana-tier-name', BANANA_TIERS[state.bananaTier].name);

  const manualDistMult = DISTRIBUTION_TIERS[state.distributionTier].multiplier;
  setText('manual-price', formatMoney(1.00 * manualDistMult));

  const stallEl = document.getElementById('stall-warning');
  if (stallEl) stallEl.hidden = !state.monkeysStalled;

  const prodProgress = state.monkeys > 0 && !state.monkeysStalled
    ? (state.productionProgress / Math.max(1, 60 / state.speedMultiplier)) * 100
    : 0;
  setProgress('production-progress', prodProgress);

  setProgress('manual-progress-bar', (state.manualProgress / MANUAL_CLICKS_PER_PIECE) * 100);
}

export function renderUpgrades(state) {
  const trees = ['production', 'education', 'banana', 'distribution'];
  for (const tree of trees) {
    const container = document.getElementById(`upgrades-${tree}`);
    if (!container) continue;
    container.innerHTML = '';

    const treeUpgrades = UPGRADES.filter(u => u.tree === tree);
    let anyVisible = false;
    let anyAffordable = false;

    for (const upg of treeUpgrades) {
      if (state.purchased.includes(upg.id)) continue;
      const prereqMet = !upg.requires || state.purchased.includes(upg.requires);
      if (!prereqMet) continue;

      anyVisible = true;
      const canAfford = state.money >= upg.cost;
      if (canAfford) anyAffordable = true;
      const btn = document.createElement('button');
      btn.className = `upgrade-btn${canAfford ? '' : ' locked'}`;
      btn.dataset.id = upg.id;
      btn.innerHTML = `
        <span class="upg-name">${upg.name}</span>
        <span class="upg-cost">${formatMoney(upg.cost)}</span>
        <span class="upg-desc">${upg.description}</span>
      `;
      btn.disabled = !canAfford;
      container.appendChild(btn);
    }

    if (!anyVisible) {
      const done = document.createElement('p');
      done.className = 'tree-done';
      done.textContent = treeUpgrades.every(u => state.purchased.includes(u.id))
        ? '✓ All upgrades purchased'
        : '— unlock more upgrades to continue —';
      container.appendChild(done);
    }

    // Badge on the tab button when affordable upgrades are available
    const tabBtn = document.querySelector(`.tab-btn[data-tree="${tree}"]`);
    if (tabBtn) {
      if (anyAffordable) {
        tabBtn.classList.add('has-affordable');
      } else {
        tabBtn.classList.remove('has-affordable');
      }
    }
  }
}

export function addFeedEntry(qualityName, pricePerPiece, count, isManual = false) {
  const feed = document.getElementById('output-feed');
  if (!feed) return;

  const entry = document.createElement('div');
  entry.className = 'feed-entry';

  const source = isManual ? 'You' : `${count} monkey${count !== 1 ? 's' : ''}`;
  const tier = QUALITY_TIERS.find(t => t.name === qualityName);
  const sample = tier ? tier.sample : '...';

  entry.innerHTML = `
    <span class="feed-source">${source}</span>
    <span class="feed-quality">${qualityName}</span>
    <span class="feed-sample">"${sample}"</span>
    <span class="feed-price">${formatMoney(pricePerPiece * count)}</span>
  `;
  feed.prepend(entry);

  // Trim feed to max entries
  while (feed.children.length > MAX_FEED_ENTRIES) {
    feed.removeChild(feed.lastChild);
  }
}

const WIN_QUOTE = `"To be, or not to be, that is the question:\nWhether 'tis nobler in the mind to suffer\nThe slings and arrows of outrageous fortune…"`;

export function showWinScreen(state) {
  const overlay = document.getElementById('win-overlay');
  if (!overlay) return;

  setText('win-pieces', formatNumber(state.totalPieces));
  setText('win-words', formatNumber(state.totalWords));
  setText('win-monkeys', formatNumber(state.monkeys));
  setText('win-money', formatMoney(state.money));
  overlay.hidden = false;

  const quoteEl = document.getElementById('win-quote-text');
  const cursorEl = document.getElementById('win-cursor');
  const attrEl = document.getElementById('win-attribution');
  const pembertonEl = document.getElementById('win-pemberton');
  if (!quoteEl) return;

  quoteEl.textContent = '';
  if (cursorEl) cursorEl.hidden = false;
  if (attrEl) attrEl.hidden = true;
  if (pembertonEl) pembertonEl.hidden = true;

  let idx = 0;
  const timer = setInterval(() => {
    quoteEl.textContent = WIN_QUOTE.slice(0, idx + 1);
    idx++;
    if (idx >= WIN_QUOTE.length) {
      clearInterval(timer);
      if (cursorEl) cursorEl.hidden = true;
      if (attrEl) attrEl.hidden = false;
      if (pembertonEl) setTimeout(() => { pembertonEl.hidden = false; }, 1200);
    }
  }, 40);
}

export function showMilestoneBanner(text) {
  const el = document.getElementById('milestone-banner');
  if (!el) return;
  document.getElementById('milestone-text').textContent = text;
  el.hidden = false;
  el.classList.remove('quality-banner-fade');
  void el.offsetWidth;
  el.classList.add('quality-banner-fade');
  setTimeout(() => { el.hidden = true; }, 4000);
}

export function showQualityBanner(oldTierName, newTierName) {
  const el = document.getElementById('quality-banner');
  if (!el) return;
  document.getElementById('quality-banner-old').textContent = oldTierName;
  document.getElementById('quality-banner-new').textContent = newTierName;
  el.hidden = false;
  el.classList.remove('quality-banner-fade');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add('quality-banner-fade');
  setTimeout(() => { el.hidden = true; }, 4000);
}

export function showProfessorDialogue(text, durationMs = 10000) {
  const box = document.getElementById('professor-dialogue');
  if (!box) return;
  document.getElementById('prof-text').textContent = text;
  box.hidden = false;
  box.classList.remove('prof-fade');
  void box.offsetWidth;
  box.classList.add('prof-fade');
  setTimeout(() => { box.hidden = true; }, durationMs);
}

export function showOfflineBanner(secondsAway, earned) {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  const hours = Math.floor(secondsAway / 3600);
  const mins = Math.floor((secondsAway % 3600) / 60);
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  setText('offline-time', timeStr);
  setText('offline-earned', formatMoney(earned));
  banner.hidden = false;
  setTimeout(() => { banner.hidden = true; }, 6000);
}

// --- helpers ---

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setProgress(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function getQualityTierIndex(educationRatio) {
  for (let i = QUALITY_TIERS.length - 1; i >= 0; i--) {
    if (educationRatio >= QUALITY_TIERS[i].threshold) return i;
  }
  return 0;
}
