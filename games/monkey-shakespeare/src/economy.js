// economy.js — Pure game data and math functions. No DOM, no state mutation.
// TODO: integrate break_infinity.js for very large number precision in production

export const WORDS_PER_PIECE = 1000;
export const BANANA_CONSUMPTION_INTERVAL = 10; // ticks between consumption events
export const SAVE_INTERVAL = 10;               // ticks between auto-saves
export const OFFLINE_CAP_SECONDS = 8 * 3600;  // max offline credit: 8 hours
export const SHAKESPEARE_BASE_CHANCE = 0.0001;
export const SHAKESPEARE_WORDS_THRESHOLD = 1_000_000;
export const MANUAL_CLICKS_PER_PIECE = 10;
export const MANUAL_PIECE_PRICE = 1.00; // "Simple Paragraph" quality

export const QUALITY_TIERS = [
  { name: 'Gibberish',          threshold: 0,    basePrice: 1.00,      sample: 'asdfkj qqpwle xmzv rtyuiop...' },
  { name: 'Word Salad',         threshold: 0.10, basePrice: 0.50,      sample: 'The monkey run fast sky purple...' },
  { name: 'Basic Sentences',    threshold: 0.20, basePrice: 2.50,      sample: 'The monkey ran across the green field.' },
  { name: 'Simple Paragraph',   threshold: 0.30, basePrice: 10.00,     sample: 'The monkey sat at the old typewriter, thinking...' },
  { name: 'Bad Short Story',    threshold: 0.40, basePrice: 50.00,     sample: 'Chapter One: The Great Banana Heist...' },
  { name: 'Decent Short Story', threshold: 0.50, basePrice: 250.00,    sample: '"Call me Ishmael," said the monkey, adjusting his spectacles...' },
  { name: 'Novella',            threshold: 0.60, basePrice: 1_000,     sample: 'It was the best of times, it was the worst of times...' },
  { name: 'Bad Novel',          threshold: 0.70, basePrice: 5_000,     sample: 'A tale of two monkeys, set against the backdrop of revolution...' },
  { name: 'Good Novel',         threshold: 0.80, basePrice: 50_000,    sample: 'The old monkey and the typewriter — a story of quiet perseverance...' },
  { name: 'Bestseller',         threshold: 0.90, basePrice: 500_000,   sample: 'To be, or not to be... the monkey paused, reading what it had typed.' },
  { name: 'Classic Literature', threshold: 1.0,  basePrice: 5_000_000, sample: "Whether 'tis nobler in the mind to suffer the slings and arrows..." },
];

export const DISTRIBUTION_TIERS = [
  { name: 'Street Corner',          multiplier: 1 },
  { name: 'Folding Table',          multiplier: 2 },
  { name: 'Kiosk',                  multiplier: 5 },
  { name: 'Bookstore',              multiplier: 15 },
  { name: 'Small Publisher',        multiplier: 50 },
  { name: 'Mid-Size Publisher',     multiplier: 200 },
  { name: 'National Publisher',     multiplier: 1_000 },
  { name: 'Global Publishing Empire', multiplier: 10_000 },
];

// tickInterval = ticks between auto-purchases; infinite = never runs out
export const BANANA_TIERS = [
  { name: 'Manual',            auto: false, tickInterval: null, amount: 0 },
  { name: 'Banana Buyer',      auto: true,  tickInterval: 30,   amount: 100 },
  { name: '2nd Banana Buyer',  auto: true,  tickInterval: 15,   amount: 150 },
  { name: 'Banana Team',       auto: true,  tickInterval: 5,    amount: 150 },
  { name: 'Banana Truck',      auto: true,  tickInterval: 1,    amount: 200 },
  { name: 'Banana Fleet',      auto: true,  tickInterval: 1,    amount: 500 },
  { name: 'Banana Warehouse',  auto: true,  tickInterval: 1,    amount: 2000 },
  { name: 'Conveyor Belt',     auto: true,  infinite: true },
  { name: 'Banana Plantation', auto: true,  infinite: true },
];

export const UPGRADES = [
  // PRODUCTION
  { id: 'typewriter',           tree: 'production',   name: 'Typewriter',              cost: 10,          requires: null,               description: 'Required for monkeys to type.',              effect: { speedMultiplier: 1 } },
  { id: 'monkey_1',             tree: 'production',   name: 'First Monkey',            cost: 25,          requires: 'typewriter',        description: 'Your first typing assistant. Eats bananas.', effect: { addMonkeys: 1 } },
  { id: 'monkey_2',             tree: 'production',   name: '2nd Monkey',              cost: 50,          requires: 'monkey_1',          description: 'Another monkey joins the team.',             effect: { addMonkeys: 1 } },
  { id: 'monkey_3',             tree: 'production',   name: '3rd Monkey',              cost: 100,         requires: 'monkey_2',          description: 'The gang grows.',                            effect: { addMonkeys: 1 } },
  { id: 'monkey_pack',          tree: 'production',   name: 'Monkey Pack',             cost: 400,         requires: 'monkey_3',          description: '+5 more monkeys.',                           effect: { addMonkeys: 5 } },
  { id: 'typewriter_electric',  tree: 'production',   name: 'Electric Typewriter',     cost: 500,         requires: 'monkey_1',          description: '2× typing speed.',                          effect: { speedMultiplier: 2 } },
  { id: 'monkey_troop',         tree: 'production',   name: 'Monkey Troop',            cost: 2_000,       requires: 'monkey_pack',       description: '+10 more monkeys.',                          effect: { addMonkeys: 10 } },
  { id: 'typewriter_processor', tree: 'production',   name: 'Word Processor',          cost: 5_000,       requires: 'typewriter_electric', description: '5× typing speed.',                        effect: { speedMultiplier: 5 } },
  { id: 'monkey_colony',        tree: 'production',   name: 'Monkey Colony',           cost: 15_000,      requires: 'monkey_troop',      description: '+25 more monkeys.',                          effect: { addMonkeys: 25 } },
  { id: 'typewriter_computer',  tree: 'production',   name: 'Computer Terminal',       cost: 50_000,      requires: 'typewriter_processor', description: '10× typing speed.',                      effect: { speedMultiplier: 10 } },
  { id: 'monkey_farm',          tree: 'production',   name: 'Monkey Farm',             cost: 100_000,     requires: 'monkey_colony',     description: '+50 more monkeys.',                          effect: { addMonkeys: 50 } },
  { id: 'monkey_sanctuary',     tree: 'production',   name: 'Monkey Sanctuary',        cost: 1_000_000,   requires: 'monkey_farm',       description: '+100 more monkeys.',                         effect: { addMonkeys: 100 } },
  { id: 'typewriter_quantum',   tree: 'production',   name: 'Quantum Keyboard',        cost: 10_000_000,  requires: 'typewriter_computer', description: '100× typing speed.',                      effect: { speedMultiplier: 100 } },
  { id: 'monkey_complex',       tree: 'production',   name: 'Industrial Complex',      cost: 25_000_000,  requires: 'monkey_sanctuary',  description: '+500 more monkeys.',                         effect: { addMonkeys: 500 } },
  { id: 'monkey_network',       tree: 'production',   name: 'Global Monkey Network',   cost: 1_000_000_000, requires: 'monkey_complex',  description: '+5,000 more monkeys.',                       effect: { addMonkeys: 5000 } },

  // EDUCATION
  { id: 'edu_tutor',      tree: 'education', name: 'Private Tutor',              cost: 200,         requires: 'monkey_1',        description: '1 monkey gets tutored.',                  effect: { educationCapacity: 1 } },
  { id: 'edu_classroom',  tree: 'education', name: 'Classroom',                  cost: 2_000,       requires: 'edu_tutor',       description: 'Up to 8 monkeys educated.',               effect: { educationCapacity: 8 } },
  { id: 'sub_typing',     tree: 'education', name: 'Typing Curriculum',          cost: 5_000,       requires: 'edu_classroom',   description: 'Improves Shakespeare probability.',       effect: { litBonus: 1 } },
  { id: 'edu_small',      tree: 'education', name: 'Small School',               cost: 20_000,      requires: 'edu_classroom',   description: 'Up to 30 monkeys educated.',              effect: { educationCapacity: 30 } },
  { id: 'sub_vocab',      tree: 'education', name: 'Vocabulary Expansion',       cost: 15_000,      requires: 'sub_typing',      description: 'Monkeys learn more words.',               effect: { litBonus: 2 } },
  { id: 'edu_large',      tree: 'education', name: 'Large School',               cost: 200_000,     requires: 'edu_small',       description: 'Up to 100 monkeys educated.',             effect: { educationCapacity: 100 } },
  { id: 'sub_grammar',    tree: 'education', name: 'Grammar Lessons',            cost: 50_000,      requires: 'sub_vocab',       description: 'Monkeys form coherent sentences.',        effect: { litBonus: 3 } },
  { id: 'sub_literature', tree: 'education', name: 'Literature Studies',         cost: 200_000,     requires: 'sub_grammar',     description: 'Shakespeare probability ×5.',             effect: { litBonus: 5 } },
  { id: 'edu_district',   tree: 'education', name: 'School District',            cost: 5_000_000,   requires: 'edu_large',       description: 'Up to 500 monkeys educated.',             effect: { educationCapacity: 500 } },
  { id: 'sub_creative',   tree: 'education', name: 'Advanced Creative Writing',  cost: 1_000_000,   requires: 'sub_literature',  description: 'Shakespeare probability ×10.',            effect: { litBonus: 10 } },
  { id: 'edu_university', tree: 'education', name: 'University',                 cost: 100_000_000, requires: 'edu_district',    description: 'All monkeys can be educated.',            effect: { educationCapacity: 999_999_999 } },

  // BANANA SUPPLY
  { id: 'banana_buyer',     tree: 'banana', name: 'Banana Buyer',      cost: 150,         requires: 'monkey_1',        description: 'Auto-buys bananas every 30s.',            effect: { bananaTier: 1 } },
  { id: 'banana_buyer2',    tree: 'banana', name: '2nd Banana Buyer',  cost: 300,         requires: 'banana_buyer',    description: 'Buys bananas every 15s.',                 effect: { bananaTier: 2 } },
  { id: 'banana_team',      tree: 'banana', name: 'Banana Team',       cost: 1_000,       requires: 'banana_buyer2',   description: 'Buys bananas every 5s.',                  effect: { bananaTier: 3 } },
  { id: 'banana_truck',     tree: 'banana', name: 'Banana Truck',      cost: 10_000,      requires: 'banana_team',     description: 'Bulk delivery every second.',             effect: { bananaTier: 4 } },
  { id: 'banana_fleet',     tree: 'banana', name: 'Banana Fleet',      cost: 75_000,      requires: 'banana_truck',    description: 'Continuous banana supply.',               effect: { bananaTier: 5 } },
  { id: 'banana_warehouse', tree: 'banana', name: 'Banana Warehouse',  cost: 500_000,     requires: 'banana_fleet',    description: 'Massive stockpile. Rarely runs out.',     effect: { bananaTier: 6 } },
  { id: 'banana_conveyor',  tree: 'banana', name: 'Banana Conveyor Belt', cost: 10_000_000, requires: 'banana_warehouse', description: 'Infinite bananas. Monkeys never stop.', effect: { bananaTier: 7 } },
  { id: 'banana_plantation',tree: 'banana', name: 'Banana Plantation', cost: 500_000_000, requires: 'banana_conveyor', description: 'You own the supply chain.',               effect: { bananaTier: 8 } },

  // DISTRIBUTION
  { id: 'dist_table',   tree: 'distribution', name: 'Folding Table',          cost: 100,         requires: 'banana_buyer',   description: '2× revenue per piece.',      effect: { distributionTier: 1 } },
  { id: 'dist_kiosk',   tree: 'distribution', name: 'Kiosk',                  cost: 1_000,       requires: 'dist_table',     description: '5× revenue per piece.',      effect: { distributionTier: 2 } },
  { id: 'dist_bookstore',tree: 'distribution', name: 'Bookstore',             cost: 15_000,      requires: 'dist_kiosk',     description: '15× revenue per piece.',     effect: { distributionTier: 3 } },
  { id: 'dist_small_pub',tree: 'distribution', name: 'Small Publisher',       cost: 200_000,     requires: 'dist_bookstore', description: '50× revenue per piece.',     effect: { distributionTier: 4 } },
  { id: 'dist_mid_pub', tree: 'distribution', name: 'Mid-Size Publisher',     cost: 2_000_000,   requires: 'dist_small_pub', description: '200× revenue per piece.',    effect: { distributionTier: 5 } },
  { id: 'dist_national',tree: 'distribution', name: 'National Publisher',     cost: 20_000_000,  requires: 'dist_mid_pub',   description: '1,000× revenue per piece.',  effect: { distributionTier: 6 } },
  { id: 'dist_global',  tree: 'distribution', name: 'Global Publishing Empire', cost: 500_000_000, requires: 'dist_national', description: '10,000× revenue per piece.', effect: { distributionTier: 7 } },
];

// --- Pure functions ---

export function getQualityTier(educationRatio) {
  for (let i = QUALITY_TIERS.length - 1; i >= 0; i--) {
    if (educationRatio >= QUALITY_TIERS[i].threshold) return i;
  }
  return 0;
}

// Ticks per production cycle, floored at 1
export function getProductionTicks(speedMultiplier) {
  return Math.max(1, Math.floor(10 / speedMultiplier));
}

// Sum of litBonus values for all purchased sub-upgrades, minimum 1
export function getLitMultiplier(purchased) {
  const litIds = ['sub_typing', 'sub_vocab', 'sub_grammar', 'sub_literature', 'sub_creative'];
  let bonus = 0;
  for (const id of litIds) {
    if (purchased.includes(id)) {
      bonus += UPGRADES.find(u => u.id === id).effect.litBonus;
    }
  }
  return Math.max(1, bonus);
}

// Highest education capacity from purchased school upgrades
export function getEducationCapacity(purchased) {
  const eduIds = ['edu_tutor', 'edu_classroom', 'edu_small', 'edu_large', 'edu_district', 'edu_university'];
  let capacity = 0;
  for (const id of eduIds) {
    if (purchased.includes(id)) {
      capacity = Math.max(capacity, UPGRADES.find(u => u.id === id).effect.educationCapacity);
    }
  }
  return capacity;
}

// Per-tick Shakespeare roll probability.
// Formula: min(1, words/threshold) × (educated/total) × litMult × base
// Returns 0 if monkeys === 0 (NaN guard).
export function getShakespeareChance(totalWords, monkeys, educationCapacity, litMultiplier) {
  if (monkeys === 0 || educationCapacity === 0) return 0;
  const wordsRatio = Math.min(1, totalWords / SHAKESPEARE_WORDS_THRESHOLD);
  const educationRatio = Math.min(educationCapacity, monkeys) / monkeys;
  return wordsRatio * educationRatio * litMultiplier * SHAKESPEARE_BASE_CHANCE;
}

export function formatMoney(n) {
  if (n < 0.01) return '$0.00';
  if (n < 1000) return `$${n.toFixed(2)}`;
  if (n < 1_000_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n < 1_000_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  return `$${(n / 1_000_000_000_000).toFixed(2)}T`;
}

export function formatNumber(n) {
  if (n < 1000) return String(Math.floor(n));
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}
