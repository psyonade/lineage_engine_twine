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
      { id: 'delve_ruins', name: 'Delve Ancient Vaults', costAp: 1, desc: 'Search deep inside dangerous ruins (High risk, chance for rare relics or legendary traits).' }
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
    ]
  }
};

export const PROCEDURAL_ENCOUNTERS = [
  {
    id: 'traveler_in_distress',
    title: 'Distressed Traveler',
    text: 'You come across a noble traveler whose carriage wheel has shattered along a rocky incline.',
    choices: [
      {
        text: 'Help repair the wheel [Martial / Stewardship]',
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

export function getDialogueGreeting(npc, player) {
  const traits = npc.traits || [];
  const rel = player.relationships?.[npc.id]?.affinity ?? 50;

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
