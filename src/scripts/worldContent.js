export const LOCATIONS = {
  tavern: {
    id: 'tavern',
    name: 'The Crossroads Tavern',
    description: 'A warm hearth filled with the scent of roasted meats, pipe smoke, and quiet whispers. Bards, wanderers, and weary mercenaries gather here to trade stories and rumor.',
    activities: [
      { id: 'rest_tavern', name: 'Rest at the Hearth', costAp: 1, goldCost: 5, healthGain: 15, desc: 'Spend a cozy evening recovering your health (+15 HP, -5 Gold).' }
    ]
  },
  market: {
    id: 'market',
    name: 'Oakhaven Market',
    description: 'Bustling merchant stalls under colorful canvas tents. Craftsmen offer polished goods while peddlers hawk relics from across the realms.',
    activities: [
      { id: 'trade_market', name: 'Work / Trade Stalls', costAp: 1, goldGain: 20, desc: 'Spend a day trading or assisting merchants (+20 Gold).' }
    ]
  },
  woods: {
    id: 'woods',
    name: 'The Whispering Woods',
    description: 'An ancient, untamed forest where sunlight filters through dense emerald canopies. Hunters and hermits walk these quiet paths.',
    activities: [
      { id: 'forage_woods', name: 'Forage & Hunt', costAp: 1, healthGain: 5, goldGain: 10, desc: 'Gather wild game and rare herbs (+10 Gold, +5 HP).' }
    ]
  },
  ruins: {
    id: 'ruins',
    name: 'Sunken Aether Ruins',
    description: 'Crumbled stone pillars half-submerged in glowing mist. Ancient runes hum with residual magic, guarding secrets of forgotten bloodlines.',
    activities: [
      { id: 'delve_ruins', name: 'Delve Ancient Vaults', costAp: 1, desc: 'Search for coin caches and rune fragments while risking injury or an unsafe passage.' }
    ]
  },
  shrine: {
    id: 'shrine',
    name: "Wayfarer's Shrine",
    description: 'A serene sanctuary built beside a crystal spring. Gentle elders and devoted healers offer sanctuary to travelers in need.',
    activities: [
      { id: 'heal_shrine', name: 'Meditate & Heal', costAp: 1, healthGain: 25, desc: 'Receive blessings from the shrine healers (+25 HP).' }
    ]
  },
  keep: {
    id: 'keep',
    name: 'Highcrest Keep',
    description: 'The imposing stone seat of regional power. Knights train in the courtyard while ambitious nobles weave intrigues in grand halls.',
    activities: [
      { id: 'train_keep', name: 'Spar with Knights', costAp: 1, statGain: 'martial', desc: 'Train in the courtyard to hone your Martial skills (+2 Martial).' }
    ]
  }
};

export const INITIAL_QUESTS = {
  whispering_beast: {
    id: 'whispering_beast',
    title: 'The Whispering Beast',
    location: 'woods',
    stage: 0,
    maxStage: 3,
    status: 'available', // available, active, completed, failed
    description: 'Villagers at the Tavern speak of a rogue shadow beast terrorizing the Whispering Woods.',
    stages: [
      { text: 'Investigate reports at The Crossroads Tavern.', location: 'tavern' },
      { text: 'Track the beast through The Whispering Woods.', location: 'woods' },
      { text: 'Confront the beast or soothe its ancient spirit.', location: 'woods' }
    ],
    outcomes: [
      { id: 'soothe', label: 'Soothe the spirit', description: 'Calm the old guardian and keep it from the nearby farms.', consequences: { gold: 15, health: 10, houseRenown: 6, worldFlags: { beastPacified: true }, houseRelations: [{ a: 'Vane', b: 'Draven', delta: 8 }] } },
      { id: 'slay', label: 'Slay the beast', description: 'End the threat and claim the bounty.', consequences: { gold: 45, stats: { martial: 2 }, houseRenown: 4, worldFlags: { beastSlain: true }, houseRelations: [{ a: 'Vane', b: 'Draven', delta: -5 }] } },
    ]
  },
  relic_bloodline: {
    id: 'relic_bloodline',
    title: 'Relic of the First Bloodline',
    location: 'ruins',
    stage: 0,
    maxStage: 3,
    status: 'available',
    description: 'A scholar at Wayfarer Shrine mentioned an heirloom from an ancient lineage hidden in Sunken Aether Ruins.',
    stages: [
      { text: 'Consult the scholar at Wayfarer Shrine.', location: 'shrine' },
      { text: 'Explore the Sunken Aether Ruins for the sealed vault.', location: 'ruins' },
      { text: 'Unseal the vault using your wisdom or force.', location: 'ruins' }
    ],
    outcomes: [
      { id: 'donate', label: 'Give the relic to the shrine', description: 'Let the scholars study it for the common good.', consequences: { gold: 20, stats: { learning: 3 }, houseRenown: 8, worldFlags: { firstBloodlineRelic: 'shrine' }, houseRelations: [{ a: 'Aethelgard', b: 'Valerius', delta: 10 }] } },
      { id: 'keep', label: 'Keep the relic for your house', description: 'Preserve the heirloom and its secrets for your descendants.', consequences: { gold: 10, houseRenown: 6, worldFlags: { firstBloodlineRelic: 'dynasty' }, houseRelations: [{ a: 'Aethelgard', b: 'Valerius', delta: -5 }] } },
    ]
  },
  divided_heart: {
    id: 'divided_heart',
    title: 'A Divided Heart',
    location: 'market',
    stage: 0,
    maxStage: 3,
    status: 'available',
    description: 'Two merchant families at Oakhaven Market are locked in a bitter dispute that threatens local trade.',
    stages: [
      { text: 'Hear the grievances at Oakhaven Market.', location: 'market' },
      { text: 'Gather secrets or evidence at Highcrest Keep.', location: 'keep' },
      { text: 'Broker a pact or expose the deceit.', location: 'market' }
    ],
    outcomes: [
      { id: 'broker', label: 'Broker a pact', description: 'Restore trade and bring the two houses back to the table.', consequences: { gold: 25, stats: { diplomacy: 2 }, houseRenown: 8, houseRelations: [{ a: 'Oakhaven Guild', b: 'Marlowe Guild', delta: 30 }] } },
      { id: 'expose', label: 'Expose the deception', description: 'Reveal who profited from the dispute, even if trade suffers.', consequences: { gold: 40, stats: { intrigue: 2 }, houseRenown: 6, houseRelations: [{ a: 'Oakhaven Guild', b: 'Marlowe Guild', delta: -25 }] } },
    ]
  },
  debt_of_blade: {
    id: 'debt_of_blade',
    title: 'Debt of the Blade',
    location: 'keep',
    stage: 0,
    maxStage: 3,
    status: 'available',
    description: 'A veteran sellsword commander at Highcrest Keep seeks worthy allies for a dangerous mercenary contract.',
    stages: [
      { text: 'Speak with the Commander at Highcrest Keep.', location: 'keep' },
      { text: 'Prove your martial prowess in combat.', location: 'keep' },
      { text: 'Fulfill the high-stakes contract.', location: 'woods' }
    ],
    outcomes: [
      { id: 'fulfill', label: 'Fulfill the contract', description: 'Complete the dangerous work and honor your word.', consequences: { gold: 60, stats: { martial: 2 }, houseRenown: 8, worldFlags: { bladeContract: 'fulfilled' } } },
      { id: 'withdraw', label: 'Withdraw and warn the commander', description: 'Refuse the risk, but give the keep time to prepare.', consequences: { gold: 10, stats: { diplomacy: 1 }, houseRenown: 3, worldFlags: { bladeContract: 'withdrawn' } } },
    ]
  }
};

export const BLOODLINE_LEGACY_QUEST = {
  id: 'bloodline_legacy',
  title: 'The Name Beneath the Seal',
  location: 'shrine',
  stage: 0,
  maxStage: 3,
  status: 'available',
  description: 'The First Bloodline relic your ancestor kept bears an inscription that may change how your house understands its past.',
  stages: [
    { text: 'Ask the scholars at the Wayfarer Shrine about the relic’s seal.', location: 'shrine' },
    { text: 'Bring the scholar’s notes to the Sunken Aether Ruins.', location: 'ruins' },
    { text: 'Decide what your house will do with the recovered truth.', location: 'ruins' },
  ],
  outcomes: [
    { id: 'translate', label: 'Translate and share the inscription', description: 'Reveal the relic’s history to the region and preserve the discovery in the chronicle.', consequences: { stats: { learning: 3 }, houseRenown: 10, worldFlags: { bloodlineTruth: 'shared' }, houseRelations: [{ a: 'Aethelgard', b: 'Valerius', delta: 8 }] } },
    { id: 'guard', label: 'Keep the truth within the family', description: 'Protect the knowledge as a private legacy for your descendants.', consequences: { houseRenown: 8, worldFlags: { bloodlineTruth: 'guarded' }, houseRelations: [{ a: 'Aethelgard', b: 'Valerius', delta: -3 }] } },
  ],
};

export const PROCEDURAL_ENCOUNTERS = [
  {
    id: 'traveler_in_distress',
    locations: ['tavern', 'market', 'keep'],
    title: 'Distressed Traveler',
    text: 'You come across a noble traveler whose carriage wheel has shattered along a rocky incline.',
    choices: [
      {
        text: 'Help repair the wheel [Martial]',
        check: 'martial',
        dc: 40,
        successText: 'Using your strength and practical mind, you swiftly repair the carriage. The grateful noble rewards you with 30 Gold.',
        successGold: 30,
        failText: 'You struggle with the heavy timber, spraining your shoulder in the process.',
        failHp: -15
      },
      {
        text: 'Escort them safely to the nearest tavern [Diplomacy]',
        check: 'diplomacy',
        dc: 35,
        successText: 'Your charming company keeps spirits high during the walk. They share valuable trade insights (+2 Stewardship, +15 Gold).',
        successGold: 15,
        successStat: { stewardship: 2 },
        failText: 'The walk is tedious and daylight fades, leaving you tired.',
        failHp: -10
      }
    ]
  },
  {
    id: 'mystic_shrine_encounter',
    locations: ['shrine', 'ruins'],
    title: 'Ancient Shrine Runes',
    text: 'A weathered stone monolith glows softly with faded arcane symbols.',
    choices: [
      {
        text: 'Decipher the inscription [Learning]',
        check: 'learning',
        dc: 45,
        successText: 'The ancient words illuminate your mind with forgotten wisdom (+3 Learning, +10 HP).',
        successStat: { learning: 3 },
        successHp: 10,
        failText: 'The strange runes trigger a mild mental headache.',
        failHp: -10
      },
      {
        text: 'Place an offering of 10 Gold',
        costGold: 10,
        successText: 'A soothing warmth bathes you as the shrine responds to your devotion (+20 HP).',
        successHp: 20
      }
    ]
  },
  {
    id: 'ambush_in_shadows',
    locations: ['woods'],
    title: 'Roadside Ambush',
    text: 'Shifty figures spring from the treeline with drawn blades demanding your purse!',
    choices: [
      {
        text: 'Stand and fight! [Martial]',
        check: 'martial',
        dc: 50,
        successText: 'You draw your steel and drive off the bandits, taking 25 Gold from their dropped loot.',
        successGold: 25,
        failText: 'The bandits overwhelm you before fleeing, leaving you wounded.',
        failHp: -25,
        failGold: -10
      },
      {
        text: 'Outsmart them / Slip away [Intrigue]',
        check: 'intrigue',
        dc: 40,
        successText: 'You throw a smoke pouch and melt into the foliage unnoticed.',
        failText: 'They catch you as you run and snatch some coin.',
        failGold: -15,
        failHp: -10
      }
    ]
  }
];

export function getDialogueGreeting(npc, player, actorMap = {}, houses = {}, config = {}, worldFlags = {}) {
  const traits = npc.traits || [];
  const rel = player.relationships?.[npc.id]?.affinity ?? 50;
  const memory = (npc.memories || []).slice().reverse().find(item => item.actorIds?.includes(player.id));
  const ancestors = new Set();
  const queue = [...(player.parents || [])];
  while (queue.length) {
    const id = queue.shift();
    if (ancestors.has(id)) continue;
    ancestors.add(id);
    queue.push(...(actorMap[id]?.parents || []));
  }
  const ancestralMemory = (npc.memories || []).slice().reverse().find(item => (item.actorIds || []).some(id => ancestors.has(id)));
  const houseKey = name => String(name || 'Commoner').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const playerHouse = houses[houseKey(player.house)];
  const inheritedHouseStanding = player.house !== npc.house
    ? (playerHouse?.relations?.[houseKey(npc.house)] ?? houses[houseKey(npc.house)]?.relations?.[houseKey(player.house)] ?? 0)
    : 0;
  const inheritedRenown = playerHouse?.renown ?? 0;

  if (memory?.type === 'rescued') return `"I still remember your kindness in ${memory.location || 'the old days'}. What can I do for you?"`;
  if (memory?.type === 'mentored') return `"I learned much from you. I hope I have made you proud."`;
  if (memory?.type === 'rejection') return `"After what passed between us, I would rather keep this brief."`;
  if (memory?.type === 'house_feud') return `"The feud between our houses has cost my family much. Can I trust you?"`;
  if (memory?.type === 'family_feud') return `"Our families were caught between that old feud. I hope we can choose our own peace."`;
  if (memory?.type === 'child_question') return `"I still remember the story you shared about your family. What else have you learned?"`;
  if (memory?.type === 'marriage' || memory?.type === 'child') return `"Our family has weathered much together. It is good to see you."`;
  if (ancestralMemory) {
    const ancestorId = ancestralMemory.actorIds.find(id => ancestors.has(id));
    const ancestor = actorMap[ancestorId];
    return `"I remember your ancestor ${ancestor?.name || 'from your family'}: ${ancestralMemory.context}"`;
  }
  if (inheritedHouseStanding <= -40) {
    return `"Your house has brought ours grief for generations. Why should I trust you, ${player.name}?"`;
  }
  if (inheritedHouseStanding <= -15) {
    return `"The old rivalry between our houses still casts a shadow. Let us speak carefully."`;
  }
  if (inheritedHouseStanding >= 30) {
    return `"Your house has stood with ours through difficult years. You are welcome here, ${player.name}."`;
  }
  if (worldFlags.beastPacified && (npc.location === 'woods' || ['Vane', 'Draven'].includes(npc.house))) {
    return `"The guardian in the Whispering Woods no longer threatens the farms. Your family brought that peace."`;
  }
  if (worldFlags.beastSlain && (npc.location === 'woods' || ['Vane', 'Draven'].includes(npc.house))) {
    return `"People still speak of the beast your family killed in the Whispering Woods."`;
  }
  if (worldFlags.firstBloodlineRelic === 'dynasty') {
    return `"Your house still guards the First Bloodline relic. I wonder what its secrets will mean for your heirs."`;
  }
  if (worldFlags.firstBloodlineRelic === 'shrine' && (npc.location === 'shrine' || ['Aethelgard', 'Valerius'].includes(npc.house))) {
    return `"The scholars still study the First Bloodline relic your ancestor entrusted to the shrine."`;
  }
  if (worldFlags.bloodlineTruth === 'shared' && (npc.location === 'shrine' || npc.location === 'ruins')) {
    return `"Your descendant brought the First Bloodline inscription into the light. Scholars here still discuss the discovery."`;
  }
  if (worldFlags.bloodlineTruth === 'guarded' && (npc.location === 'shrine' || npc.location === 'ruins')) {
    return `"The First Bloodline inscription remains a guarded family secret. I wonder what your heirs will make of it."`;
  }
  if (worldFlags.bladeContract === 'fulfilled' && (npc.location === 'keep' || npc.location === 'woods')) {
    return `"Your family honored the old contract when others might have fled. The keep remembers."`;
  }
  if (worldFlags.bladeContract === 'withdrawn' && npc.location === 'keep') {
    return `"Your ancestor warned the keep before withdrawing from the contract. Some call it caution; others still question the choice."`;
  }
  if (inheritedRenown >= (config.HOUSE_RENOWN_REPUTED ?? 25)) {
    return `"The name of House ${player.house} is known here. I would hear what you have to say, ${player.name}."`;
  }
  if (rel >= 70) {
    return `"Ah, my dear friend! It warms my heart to see you again. What brings you to my side today?"`;
  }
  if (rel <= 30) {
    return `"State your business quickly. I have little patience for idle chatter."`;
  }
  if (traits.includes('Fierce')) {
    return `"Hold your head high. Out with it—what do you seek from me?"`;
  }
  if (traits.includes('Melancholic')) {
    return `"Ah... life moves on, cold and unrelenting. What is on your mind?"`;
  }
  if (traits.includes('Charming') || traits.includes('Silver-Tongued')) {
    return `"Well met, traveler! A bright smile makes any encounter a pleasure. How may I be of service?"`;
  }
  if (traits.includes('Stoic')) {
    return `"Greetings. I am listening."`;
  }
  return `"Greetings, friend. How fare your travels in these lands?"`;
}
