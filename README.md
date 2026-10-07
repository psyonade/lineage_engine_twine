# The Lineage Engine

A SugarCube and Twine inspired generational life simulation. Start as a founder, travel and meet people, build relationships, raise or adopt children, and continue the family story through succession. The world, chronicle, family tree, house relations, and NPC memories preserve the consequences of play.

## Run locally

Install Node.js, then run:

```sh
npm ci
npm run build
```

Open `dist/index.html` in a browser. `npm test` runs the Vitest simulation, genetics, and family-tree suites. `npm run test:e2e` builds the game and runs a Playwright smoke test in a browser; on Windows it uses Microsoft Edge by default. On other systems, install the Playwright Chromium browser with `npx playwright install chromium` or set `PLAYWRIGHT_BROWSER_PATH` to a compatible browser executable.

## Play

- Create a founder, choose an origin, appearance, traits, and dynasty seed. Reusing the same seed and founder choices reproduces the same generated world.
- Spend four action points each season on travel, local activities, exploration, relationships, quests, and family.
- Adult characters can attempt seduction without prior courtship or marriage, choosing a sincere, playful, or bold approach. Reciprocation odds respond to compatibility, rapport, traits, and character stats; failure spends an AP and records rejection. After a successful female/male pairing, conception has a separate 45% chance. Successful conception records co-parents without forcing a marriage, and NPCs do not autonomously conceive with the player character.
- Coast to advance time and let NPCs move, form unions, have children, age, and die.
- Use the family tree to inspect ancestry, descendants, adoption links, portraits, and recorded shared history.
- Save into one of five manual slots; export any occupied slot as JSON or import a JSON export into a chosen manual slot. The game also refreshes its autosave after UI updates and when the page closes. Reloading restores the autosave when one exists. Use Save / Load Manager → Start New Dynasty to clear the autosave and return to founder creation while keeping manual slots. If browser storage fills up, the game offers to delete the oldest manual save before retrying.

## Code layout

- `src/scripts/stateSchema.js` defines serializable state, actor records, memories, chronicle entries, and save migration.
- `src/scripts/rng.js`, `genetics.js`, and `simulation.js` contain deterministic randomness, inheritance, relationships, aging, pregnancy, adoption, and succession.
- `src/scripts/familyTree.js` computes the dynasty layout and lineage highlights.
- `src/scripts/index.js` connects the systems to the browser UI.
- `src/twee/` contains SugarCube passage sources; `scripts/build.js` packages the browser build.
