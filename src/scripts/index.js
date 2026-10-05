import {
  createInitialGameState,
  createActorDTO,
  createUnionDTO,
  addChronicleEntry,
  generateActorId,
  resetIdCounters,
  clampStats,
  clampRelationship,
} from './stateSchema.js';
import {
  generateRandomGenetics,
  generateOffspringGenetics,
  inheritTraits,
  calculateCompatibility,
  LEGENDARY_TRAITS,
  STANDARD_TRAITS,
} from './genetics.js';
import {
  advanceSeason,
  getLifeStage,
  getActorAge,
  getEligibleHeirs,
  switchPlayerCharacter,
  killActor,
  formUnion,
  produceOffspring,
  generateUniqueName,
} from './simulation.js';
import { renderPortraitSVG } from './portraitSvg.js';
import { computeFamilyTreeLayout, getLineageSets } from './familyTree.js';

const LineageEngine = {
  createInitialGameState,
  createActorDTO,
  createUnionDTO,
  addChronicleEntry,
  generateRandomGenetics,
  generateOffspringGenetics,
  inheritTraits,
  calculateCompatibility,
  LEGENDARY_TRAITS,
  STANDARD_TRAITS,
  advanceSeason,
  getLifeStage,
  getActorAge,
  getEligibleHeirs,
  switchPlayerCharacter,
  killActor,
  formUnion,
  produceOffspring,
  renderPortraitSVG,
  computeFamilyTreeLayout,
  getLineageSets,

  initGameWorld: function (state, founderParams = {}) {
    const founderId = generateActorId(); // generate char_1 safely
    const founder = createActorDTO({
      id: founderId,
      name: founderParams.name || 'Lord Alistair',
      gender: founderParams.gender || 'male',
      birthYear: -25,
      house: founderParams.house || 'Pendelton',
      genetics: founderParams.genetics || generateRandomGenetics(),
      traits: founderParams.traits || ['Strong', 'Charming'],
    });

    state.$actors[founder.id] = founder;
    state.$playerId = founder.id;
    state.$world.dynastyName = founder.house;

    const houses = ['Vane', 'Aethelgard', 'Draven', 'Valerius'];

    houses.forEach((houseName) => {
      const fatherName = generateUniqueName(state, 'male', houseName);
      const father = createActorDTO({
        name: fatherName,
        gender: 'male',
        birthYear: -45,
        house: houseName,
        genetics: generateRandomGenetics(),
        traits: ['Resilient'],
      });
      state.$actors[father.id] = father;

      const motherName = generateUniqueName(state, 'female', houseName);
      const mother = createActorDTO({
        name: motherName,
        gender: 'female',
        birthYear: -42,
        house: houseName,
        genetics: generateRandomGenetics(),
        traits: ['Charming'],
      });
      state.$actors[mother.id] = mother;

      const u = createUnionDTO({
        partners: [father.id, mother.id],
        formedYear: -20,
      });
      father.spouseId = mother.id;
      mother.spouseId = father.id;
      father.unions.push(u.id);
      mother.unions.push(u.id);
      state.$unions[u.id] = u;

      const sonName = generateUniqueName(state, 'male', houseName);
      const son = createActorDTO({
        name: sonName,
        gender: 'male',
        birthYear: -22,
        house: houseName,
        parents: [father.id, mother.id],
        genetics: generateOffspringGenetics(father, mother),
        traits: inheritTraits(father, mother),
      });
      state.$actors[son.id] = son;

      const daughterName = generateUniqueName(state, 'female', houseName);
      const daughter = createActorDTO({
        name: daughterName,
        gender: 'female',
        birthYear: -20,
        house: houseName,
        parents: [father.id, mother.id],
        genetics: generateOffspringGenetics(father, mother),
        traits: inheritTraits(father, mother),
      });
      state.$actors[daughter.id] = daughter;

      u.children.push(son.id, daughter.id);
      father.children.push(son.id, daughter.id);
      mother.children.push(son.id, daughter.id);
    });

    addChronicleEntry(
      state,
      `House ${founder.house} was established under the rule of ${founder.name}.`,
      'dynasty_start',
      [founder.id]
    );

    return state;
  },

  renderSidebar: function (containerEl, state, onNavigate) {
    if (!containerEl || !state) return;

    const player = state.$actors?.[state.$playerId];
    const world = state.$world || {};

    const age = player ? getActorAge(player, world.year) : 0;
    const stage = player ? getLifeStage(age) : '';
    const portraitSvg = player ? renderPortraitSVG(player, 140, world.year) : '';
    const stats = player?.stats || { martial: 50, diplomacy: 50, stewardship: 50, intrigue: 50, learning: 50 };
    const eligibleHeirs = getEligibleHeirs(state, state.$playerId);

    containerEl.innerHTML = `
      <div class="lineage-sidebar">
        <div class="sidebar-portrait-container">
          ${portraitSvg}
        </div>
        <div class="sidebar-ruler-info">
          <div class="sidebar-ruler-name">${player ? player.name : 'Unknown'}</div>
          <div class="sidebar-ruler-details">House ${player ? player.house : ''} | ${stage} (${age})</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.4rem; display:grid; grid-template-columns:1fr 1fr; gap:0.2rem 0.5rem;">
            <span>MAR: ${stats.martial}</span>
            <span>DIP: ${stats.diplomacy}</span>
            <span>STE: ${stats.stewardship}</span>
            <span>INT: ${stats.intrigue}</span>
            <span style="grid-column: span 2;">LEA: ${stats.learning}</span>
          </div>
          <div class="badge-list" style="margin-top:0.5rem;">
            ${(player?.traits || []).map(t => `<span class="badge">${t}</span>`).join('')}
          </div>
        </div>

        <div class="sidebar-world-box">
          <div class="sidebar-season-title">${world.season || 'Spring'}, Year ${world.year || 1}</div>
        </div>

        <div class="sidebar-nav-buttons">
          <button class="lineage-btn lineage-btn-primary" id="btn-adv-season">Advance Season</button>
          <button class="lineage-btn" id="btn-nav-hub">Court & Hub</button>
          <button class="lineage-btn" id="btn-nav-tree">Family Tree</button>
          <button class="lineage-btn" id="btn-nav-chronicle">Chronicle</button>
          <button class="lineage-btn" id="btn-save-game" style="margin-top:0.5rem;">Save Game</button>
          <button class="lineage-btn" id="btn-load-game">Load Game</button>
          <button class="lineage-btn" id="btn-reset-save">Reset Save</button>
          ${eligibleHeirs.length > 0 ? `<button class="lineage-btn" id="btn-abdicate" style="margin-top:0.5rem; border-color:var(--accent-gold); color:var(--accent-gold);">Abdicate Throne</button>` : ''}
          <button class="lineage-btn" id="btn-nav-debug" style="margin-top:0.5rem; border-color:#e11d48; color:#fda4af;">Debug Inspector</button>
        </div>
      </div>
    `;

    containerEl.querySelector('#btn-adv-season')?.addEventListener('click', () => onNavigate('advance_season'));
    containerEl.querySelector('#btn-nav-hub')?.addEventListener('click', () => onNavigate('hub'));
    containerEl.querySelector('#btn-nav-tree')?.addEventListener('click', () => onNavigate('family_tree'));
    containerEl.querySelector('#btn-nav-chronicle')?.addEventListener('click', () => onNavigate('chronicle'));
    containerEl.querySelector('#btn-save-game')?.addEventListener('click', () => onNavigate('save_game'));
    containerEl.querySelector('#btn-load-game')?.addEventListener('click', () => onNavigate('load_game'));
    containerEl.querySelector('#btn-reset-save')?.addEventListener('click', () => onNavigate('reset_save'));
    containerEl.querySelector('#btn-abdicate')?.addEventListener('click', () => onNavigate('abdicate'));
    containerEl.querySelector('#btn-nav-debug')?.addEventListener('click', () => onNavigate('debug_modal'));
  },

  renderFounderCreationView: function (containerEl, onComplete) {
    let name = 'Alistair';
    let house = 'Pendelton';
    let gender = 'male';
    let traits = ['Strong', 'Charming'];
    let genetics = generateRandomGenetics();

    const render = () => {
      const previewActor = createActorDTO({
        id: 'preview_founder',
        name,
        gender,
        house,
        birthYear: -25,
        genetics,
        traits,
      });

      containerEl.innerHTML = `
        <div style="max-width:700px; margin:2rem auto; background:var(--bg-card); padding:2rem; border-radius:12px; border:2px solid var(--border-gold);">
          <h2 style="color:var(--accent-gold-bright); text-align:center; margin-top:0;">Establish Your Dynasty</h2>
          <p style="color:var(--text-muted); text-align:center;">Customize your Founder or quick-start with a randomized character.</p>

          <div style="display:flex; gap:2rem; margin-top:1.5rem; align-items:center;">
            <div>
              ${renderPortraitSVG(previewActor, 180, 1)}
              <button class="lineage-btn" id="btn-randomize-genetics" style="margin-top:0.75rem; width:100%; font-size:0.8rem;">Randomize Appearance</button>
            </div>

            <div style="flex:1; display:flex; flex-direction:column; gap:1rem;">
              <div>
                <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Founder Name</label>
                <input type="text" id="input-name" value="${name}" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px; box-sizing:border-box;"/>
              </div>

              <div>
                <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">House / Dynasty Name</label>
                <input type="text" id="input-house" value="${house}" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px; box-sizing:border-box;"/>
              </div>

              <div>
                <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Gender</label>
                <select id="select-gender" style="width:100%; padding:0.5rem; background:#0f172a; border:1px solid var(--border-subtle); color:#fff; border-radius:6px;">
                  <option value="male" ${gender === 'male' ? 'selected' : ''}>Male</option>
                  <option value="female" ${gender === 'female' ? 'selected' : ''}>Female</option>
                </select>
              </div>

              <div>
                <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.25rem;">Starting Traits</label>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                  ${STANDARD_TRAITS.slice(0, 5).map(t => `
                    <label style="font-size:0.8rem; background:#0f172a; padding:0.3rem 0.6rem; border-radius:4px; border:1px solid var(--border-subtle); cursor:pointer;">
                      <input type="checkbox" class="chk-trait" value="${t}" ${traits.includes(t) ? 'checked' : ''}/> ${t}
                    </label>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <div style="display:flex; gap:1rem; margin-top:2rem; justify-content:center;">
            <button class="lineage-btn" id="btn-quick-start">Randomize / Quick Start</button>
            <button class="lineage-btn lineage-btn-primary" id="btn-confirm-founder">Found Dynasty</button>
          </div>
        </div>
      `;

      containerEl.querySelector('#input-name')?.addEventListener('input', (e) => { name = e.target.value; });
      containerEl.querySelector('#input-house')?.addEventListener('input', (e) => { house = e.target.value; });
      containerEl.querySelector('#select-gender')?.addEventListener('change', (e) => {
        gender = e.target.value;
        render();
      });

      containerEl.querySelectorAll('.chk-trait').forEach(chk => {
        chk.addEventListener('change', () => {
          traits = Array.from(containerEl.querySelectorAll('.chk-trait:checked')).map(c => c.value);
        });
      });

      containerEl.querySelector('#btn-randomize-genetics')?.addEventListener('click', () => {
        genetics = generateRandomGenetics();
        render();
      });

      containerEl.querySelector('#btn-quick-start')?.addEventListener('click', () => {
        genetics = generateRandomGenetics();
        name = gender === 'male' ? 'Alistair' : 'Aurelia';
        house = 'Pendelton';
        traits = ['Strong', 'Charming'];
        onComplete({ name, house, gender, traits, genetics });
      });

      containerEl.querySelector('#btn-confirm-founder')?.addEventListener('click', () => {
        onComplete({ name, house, gender, traits, genetics });
      });
    };

    render();
  },

  initStandaloneApp: function () {
    let state = null;
    let activeView = 'founder_creation';
    let selectedInteractionActorId = null;

    const renderApp = () => {
      const body = document.body;
      let appContainer = document.querySelector('.lineage-app-container');

      if (!appContainer) {
        body.innerHTML = `
          <div class="lineage-app-container">
            <div id="sidebar-slot"></div>
            <div class="lineage-main-viewport" id="viewport-slot"></div>
          </div>
          <div id="modal-slot"></div>
        `;
        appContainer = document.querySelector('.lineage-app-container');
      }

      const sidebarSlot = document.getElementById('sidebar-slot');
      const viewportSlot = document.getElementById('viewport-slot');

      if (activeView === 'founder_creation') {
        sidebarSlot.innerHTML = '';
        LineageEngine.renderFounderCreationView(viewportSlot, (founderParams) => {
          state = createInitialGameState(founderParams.house);
          state = LineageEngine.initGameWorld(state, founderParams);
          activeView = 'hub';
          renderApp();
        });
        return;
      }

      const player = state.$actors[state.$playerId];
      if (player && !player.isAlive && activeView !== 'succession') {
        activeView = 'succession';
      }

      LineageEngine.renderSidebar(sidebarSlot, state, (action) => {
        if (action === 'advance_season') {
          advanceSeason(state);
          renderApp();
        } else if (action === 'debug_modal') {
          LineageEngine.openDebugModal(state, renderApp);
        } else if (action === 'save_game') {
          LineageEngine.saveGame(state);
        } else if (action === 'load_game') {
          const loadedState = LineageEngine.loadGame();
          if (loadedState) {
            state = loadedState;
            renderApp();
          }
        } else if (action === 'reset_save') {
          LineageEngine.resetSave();
        } else if (action === 'abdicate') {
          const heirs = getEligibleHeirs(state, state.$playerId);
          if (heirs.length > 0) {
            killActor(state, state.$playerId, 'voluntary abdication of the throne');
            activeView = 'succession';
            renderApp();
          }
        } else {
          activeView = action;
          renderApp();
        }
      });

      if (activeView === 'hub') {
        LineageEngine.renderHubView(viewportSlot, state, (targetActorId) => {
          selectedInteractionActorId = targetActorId;
          activeView = 'interaction';
          renderApp();
        });
      } else if (activeView === 'interaction') {
        LineageEngine.renderInteractionView(viewportSlot, state, selectedInteractionActorId, () => {
          activeView = 'hub';
          renderApp();
        });
      } else if (activeView === 'family_tree') {
        LineageEngine.renderFamilyTreeVR(viewportSlot, state, (targetActorId) => {
          selectedInteractionActorId = targetActorId;
          activeView = 'interaction';
          renderApp();
        });
      } else if (activeView === 'chronicle') {
        LineageEngine.renderChronicleView(viewportSlot, state);
      } else if (activeView === 'succession') {
        LineageEngine.renderSuccessionView(viewportSlot, state, (action) => {
          if (action === 'restart') {
            state = null;
            activeView = 'founder_creation';
          } else {
            activeView = 'hub';
          }
          renderApp();
        });
      }
    };

    if (typeof window !== 'undefined') {
      window.SugarCube = window.SugarCube || {};
      window.SugarCube.State = window.SugarCube.State || {};
      Object.defineProperty(window.SugarCube.State, 'variables', {
        get() { return state; },
        set(v) { state = v; },
        configurable: true,
        enumerable: true
      });
      window.SugarCube.Engine = window.SugarCube.Engine || {
        play(viewName) {
          if (viewName === 'founder_creation' || viewName === 'Hub' || viewName === 'hub') activeView = 'hub';
          else if (viewName === 'FamilyTree' || viewName === 'family_tree') activeView = 'family_tree';
          else if (viewName === 'Interaction' || viewName === 'interaction') activeView = 'interaction';
          else if (viewName === 'Succession' || viewName === 'succession') activeView = 'succession';
          else if (viewName === 'DebugModal' || viewName === 'debug_modal') activeView = 'debug_modal';
          else activeView = viewName;
          renderApp();
        }
      };
      window.State = window.SugarCube.State;
    }

    renderApp();
  },

  saveGame: function (state) {
    if (!state || typeof localStorage === 'undefined') return false;
    try {
      localStorage.setItem('lineage_save_game', JSON.stringify(state));
      alert('Game Saved Successfully!');
      return true;
    } catch (e) {
      console.error('Failed to save game:', e);
      return false;
    }
  },

  loadGame: function () {
    if (typeof localStorage === 'undefined') return null;
    try {
      const json = localStorage.getItem('lineage_save_game');
      if (!json) {
        alert('No saved game found.');
        return null;
      }
      const loadedState = JSON.parse(json);

      let maxActorNum = 0;
      if (loadedState.$actors) {
        Object.keys(loadedState.$actors).forEach(id => {
          const num = parseInt(id.replace('char_', ''), 10);
          if (!isNaN(num) && num > maxActorNum) maxActorNum = num;
        });
      }

      let maxUnionNum = 0;
      if (loadedState.$unions) {
        Object.keys(loadedState.$unions).forEach(id => {
          const num = parseInt(id.replace('union_', ''), 10);
          if (!isNaN(num) && num > maxUnionNum) maxUnionNum = num;
        });
      }

      resetIdCounters(maxActorNum, maxUnionNum);
      alert('Game Loaded Successfully!');
      return loadedState;
    } catch (e) {
      console.error('Failed to load game:', e);
      alert('Failed to load saved game.');
      return null;
    }
  },

  resetSave: function () {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('lineage_save_game');
      alert('Save Data Reset.');
    }
  },

  renderHubView: function (containerEl, state, onSelectNPC) {
    const player = state.$actors[state.$playerId];
    let currentFilter = 'all';

    const render = () => {
      let actors = Object.values(state.$actors).filter(a => a.id !== state.$playerId && a.isAlive);

      if (currentFilter === 'kin') {
        actors = actors.filter(a => a.house === player.house || (player.children && player.children.includes(a.id)) || (player.parents && player.parents.includes(a.id)));
      } else if (currentFilter === 'court') {
        actors = actors.filter(a => a.house !== player.house);
      } else if (currentFilter === 'candidates') {
        actors = actors.filter(a => {
          const age = getActorAge(a, state.$world.year);
          return age >= 16 && age <= 50 && !a.spouseId;
        });
      }

      containerEl.innerHTML = `
        <h2 style="color:var(--accent-gold-bright); margin-top:0;">Dynastic Court & Realms</h2>
        <p style="color:var(--text-muted);">Interact with Court Members, Rivals, and Kin to build alliances or produce heirs.</p>

        <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem; flex-wrap:wrap;">
          <button class="lineage-btn ${currentFilter === 'all' ? 'lineage-btn-primary' : ''}" id="tab-all">All</button>
          <button class="lineage-btn ${currentFilter === 'kin' ? 'lineage-btn-primary' : ''}" id="tab-kin">Family & Kin</button>
          <button class="lineage-btn ${currentFilter === 'court' ? 'lineage-btn-primary' : ''}" id="tab-court">Court & Houses</button>
          <button class="lineage-btn ${currentFilter === 'candidates' ? 'lineage-btn-primary' : ''}" id="tab-candidates">Marriage Candidates</button>
        </div>

        <div class="character-grid">
          ${actors.map(actor => {
            const age = getActorAge(actor, state.$world.year);
            const stage = getLifeStage(age);
            const compat = player ? calculateCompatibility(player, actor) : 50;

            return `
              <div class="character-card" data-actor-id="${actor.id}">
                ${renderPortraitSVG(actor, 120, state.$world.year)}
                <div class="character-card-name">${actor.name}</div>
                <div class="character-card-meta">House ${actor.house} | ${stage} (${age})</div>
                <div class="character-card-meta" style="color:var(--accent-gold);">Compat: ${compat}%</div>
                <div class="badge-list">
                  ${actor.traits.map(t => `<span class="badge">${t}</span>`).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      containerEl.querySelector('#tab-all')?.addEventListener('click', () => { currentFilter = 'all'; render(); });
      containerEl.querySelector('#tab-kin')?.addEventListener('click', () => { currentFilter = 'kin'; render(); });
      containerEl.querySelector('#tab-court')?.addEventListener('click', () => { currentFilter = 'court'; render(); });
      containerEl.querySelector('#tab-candidates')?.addEventListener('click', () => { currentFilter = 'candidates'; render(); });

      containerEl.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-actor-id');
          onSelectNPC(id);
        });
      });
    };

    render();
  },

  renderInteractionView: function (containerEl, state, targetActorId, onBack) {
    const player = state.$actors[state.$playerId];
    const target = state.$actors[targetActorId];

    if (!target) {
      containerEl.innerHTML = `<p>Character not found. <button class="lineage-btn" id="btn-back">Back</button></p>`;
      containerEl.querySelector('#btn-back')?.addEventListener('click', onBack);
      return;
    }

    if (!player.relationships) player.relationships = {};
    if (!player.relationships[target.id]) {
      player.relationships[target.id] = clampRelationship({});
    }
    if (!target.relationships) target.relationships = {};
    if (!target.relationships[player.id]) {
      target.relationships[player.id] = clampRelationship({});
    }

    const relPtoT = player.relationships[target.id];
    const relTtoP = target.relationships[player.id];

    const age = getActorAge(target, state.$world.year);
    const compat = calculateCompatibility(player, target);
    const isChildOrYouth = age < 16;

    const render = () => {
      const curRelP = clampRelationship(player.relationships[target.id]);
      const curRelT = clampRelationship(target.relationships[player.id]);
      const tStats = clampStats(target.stats);

      containerEl.innerHTML = `
        <button class="lineage-btn" id="btn-back" style="margin-bottom:1rem;">&larr; Back to Court</button>
        <div style="display:flex; gap:2rem; background:var(--bg-card); padding:1.5rem; border-radius:10px; border:1px solid var(--border-subtle);">
          <div>
            ${renderPortraitSVG(target, 180, state.$world.year)}
            <div style="margin-top:1rem; background:#0f172a; padding:0.75rem; border-radius:6px; border:1px solid var(--border-subtle); font-size:0.85rem;">
              <div style="font-weight:bold; color:var(--accent-gold); margin-bottom:0.4rem;">Attributes</div>
              <div>Martial: ${tStats.martial}</div>
              <div>Diplomacy: ${tStats.diplomacy}</div>
              <div>Stewardship: ${tStats.stewardship}</div>
              <div>Intrigue: ${tStats.intrigue}</div>
              <div>Learning: ${tStats.learning}</div>
            </div>
          </div>
          <div style="flex:1;">
            <h2 style="color:var(--accent-gold-bright); margin-top:0;">${target.name}</h2>
            <p style="color:var(--text-muted);">House ${target.house} | ${target.gender} | Age ${age}</p>
            <p><strong>Compatibility Rating:</strong> <span style="color:var(--accent-gold);">${compat}%</span></p>

            <div style="background:#0f172a; padding:0.75rem; border-radius:6px; margin:1rem 0; border:1px solid var(--border-subtle);">
              <div style="font-weight:bold; color:var(--accent-gold); margin-bottom:0.4rem;">Relationships with ${target.name}</div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; font-size:0.85rem;">
                <div><strong>Affinity:</strong> ${curRelP.affinity}</div>
                <div><strong>Romance:</strong> ${curRelP.romance}</div>
                <div><strong>Respect:</strong> ${curRelP.respect}</div>
              </div>
            </div>

            <div style="margin:1rem 0;">
              <strong>Traits:</strong>
              <div class="badge-list" style="justify-content:flex-start; margin-top:0.4rem;">
                ${target.traits.map(t => `<span class="badge">${t}</span>`).join('')}
              </div>
            </div>

            <div id="interaction-feedback" style="margin:1rem 0; color:var(--accent-gold); min-height:1.5rem;"></div>

            <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1.5rem;">
              <button class="lineage-btn" id="act-converse">Converse</button>
              <button class="lineage-btn" id="act-flirt">Flirt / Court</button>
              <button class="lineage-btn" id="act-spar">Spar / Rival</button>
              ${isChildOrYouth ? `<button class="lineage-btn" id="act-mentor">Mentor Child</button>` : ''}
              ${(!player.spouseId && !target.spouseId && !isChildOrYouth) ? `<button class="lineage-btn lineage-btn-primary" id="act-propose">Propose Union</button>` : ''}
              ${(player.spouseId === target.id) ? `<button class="lineage-btn lineage-btn-primary" id="act-offspring">Try for Offspring</button>` : ''}
            </div>
          </div>
        </div>
      `;

      const feedbackEl = containerEl.querySelector('#interaction-feedback');
      containerEl.querySelector('#btn-back')?.addEventListener('click', onBack);

      containerEl.querySelector('#act-converse')?.addEventListener('click', () => {
        const affInc = Math.floor(Math.random() * 8) + 8; // +8 to +15
        const respInc = 5;
        curRelP.affinity += affInc;
        curRelP.respect += respInc;
        curRelT.affinity += affInc;
        curRelT.respect += respInc;
        player.relationships[target.id] = clampRelationship(curRelP);
        target.relationships[player.id] = clampRelationship(curRelT);
        render();
        const fb = containerEl.querySelector('#interaction-feedback');
        if (fb) fb.innerText = `You conversed with ${target.name}. (Affinity +${affInc}, Respect +${respInc})`;
      });

      containerEl.querySelector('#act-flirt')?.addEventListener('click', () => {
        if (compat >= 45) {
          const romInc = Math.floor(Math.random() * 11) + 10; // +10 to +20
          const affInc = 5;
          curRelP.romance += romInc;
          curRelP.affinity += affInc;
          curRelT.romance += romInc;
          curRelT.affinity += affInc;
          player.relationships[target.id] = clampRelationship(curRelP);
          target.relationships[player.id] = clampRelationship(curRelT);
          render();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${target.name} reciprocated your courtship warmly! (Romance +${romInc}, Affinity +${affInc})`;
        } else {
          curRelP.affinity -= 5;
          curRelT.affinity -= 5;
          player.relationships[target.id] = clampRelationship(curRelP);
          target.relationships[player.id] = clampRelationship(curRelT);
          render();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${target.name} seemed distant and unimpressed by your flirtations. (Affinity -5)`;
        }
      });

      containerEl.querySelector('#act-spar')?.addEventListener('click', () => {
        const pMar = player.stats?.martial ?? 50;
        const tMar = target.stats?.martial ?? 50;
        if (pMar >= tMar) {
          curRelP.respect += 10;
          curRelT.respect += 10;
          curRelP.affinity -= 5;
          curRelT.affinity -= 5;
          if (!curRelP.flags.includes('rival')) curRelP.flags.push('rival');
          if (!curRelT.flags.includes('rival')) curRelT.flags.push('rival');
          player.relationships[target.id] = clampRelationship(curRelP);
          target.relationships[player.id] = clampRelationship(curRelT);
          render();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `You bested ${target.name} in a martial bout! (Respect +10, Affinity -5, Rivalry established)`;
        } else {
          curRelP.respect += 5;
          curRelT.respect += 15;
          curRelP.affinity -= 10;
          curRelT.affinity -= 5;
          player.relationships[target.id] = clampRelationship(curRelP);
          target.relationships[player.id] = clampRelationship(curRelT);
          render();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${target.name} defeated you in the spar. (Target Respect +15, Affinity -10)`;
        }
      });

      containerEl.querySelector('#act-mentor')?.addEventListener('click', () => {
        const newStats = clampStats({
          martial: (target.stats?.martial ?? 50) + 3,
          diplomacy: (target.stats?.diplomacy ?? 50) + 3,
          stewardship: (target.stats?.stewardship ?? 50) + 3,
          intrigue: (target.stats?.intrigue ?? 50) + 3,
          learning: (target.stats?.learning ?? 50) + 3,
        });
        target.stats = newStats;
        curRelP.affinity += 10;
        curRelT.affinity += 10;
        player.relationships[target.id] = clampRelationship(curRelP);
        target.relationships[player.id] = clampRelationship(curRelT);
        render();
        const fb = containerEl.querySelector('#interaction-feedback');
        if (fb) fb.innerText = `You mentored young ${target.name}, honing their skills. (Stats +3, Affinity +10)`;
      });

      containerEl.querySelector('#act-propose')?.addEventListener('click', () => {
        if (compat >= 45 && (curRelP.affinity >= 20 || curRelP.romance >= 20)) {
          formUnion(state, player.id, target.id);
          render();
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `Proposal accepted! ${target.name} is now your betrothed spouse.`;
        } else {
          const fb = containerEl.querySelector('#interaction-feedback');
          if (fb) fb.innerText = `${target.name} rejected your marriage proposal. (Requires compatibility >= 45% and Affinity or Romance >= 20)`;
        }
      });

      containerEl.querySelector('#act-offspring')?.addEventListener('click', () => {
        const uId = player.unions[0];
        if (uId) {
          const child = produceOffspring(state, uId);
          if (child) {
            render();
            const fb = containerEl.querySelector('#interaction-feedback');
            if (fb) fb.innerText = `A newborn child, ${child.name}, has been born to your house!`;
          } else {
            const fb = containerEl.querySelector('#interaction-feedback');
            if (fb) fb.innerText = `Conception attempt was unsuccessful this season.`;
          }
        }
      });
    };

    render();
  },

  renderFamilyTreeVR: function (containerEl, state, onSelectActor) {
    const layout = computeFamilyTreeLayout(state, state.$playerId);
    let selectedNodeId = state.$playerId;
    let zoomLevel = 1.0;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0, startY = 0;

    const renderTreeContent = () => {
      const lineage = getLineageSets(state, selectedNodeId);
      const selectedActor = state.$actors[selectedNodeId];

      const nodesHtml = layout.nodes.map(node => {
        if (node.type === 'actor') {
          const actor = state.$actors[node.actorId];
          if (!actor) return '';

          const isAncestor = lineage.ancestors.has(actor.id);
          const isDescendant = lineage.descendants.has(actor.id);
          const isSelected = selectedNodeId === actor.id;
          const isDimmed = selectedNodeId && !isAncestor && !isDescendant && !isSelected;

          let highlightClass = '';
          if (isSelected) highlightClass = 'highlight-path';
          else if (isAncestor) highlightClass = 'highlight-ancestor';
          else if (isDescendant) highlightClass = 'highlight-descendant';

          return `
            <div class="tree-node-card ${highlightClass} ${isDimmed ? 'dimmed' : ''}"
                 style="left:${node.x}px; top:${node.y}px;"
                 data-actor-id="${actor.id}">
              ${renderPortraitSVG(actor, 65, state.$world.year)}
              <div style="font-weight:bold; font-size:0.75rem; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${actor.name}</div>
              <div style="font-size:0.65rem; color:var(--text-muted);">${actor.isAlive ? `Age ${getActorAge(actor, state.$world.year)}` : 'Deceased'}</div>
            </div>
          `;
        } else if (node.type === 'union') {
          return `
            <div class="tree-node-union-junction" style="left:${node.x}px; top:${node.y}px;">&infin;</div>
          `;
        }
      }).join('');

      const svgPathsHtml = layout.connections.map(conn => {
        const isFromHighlight = lineage.ancestors.has(conn.fromId) || lineage.descendants.has(conn.fromId);
        const isToHighlight = lineage.ancestors.has(conn.toId) || lineage.descendants.has(conn.toId);
        const isHighlighted = isFromHighlight && isToHighlight;

        return `<path class="tree-connector-path ${isHighlighted ? 'highlight-path' : 'dimmed-path'}" d="${conn.pathD}"/>`;
      }).join('');

      let inspectorHtml = '';
      if (selectedActor) {
        const age = getActorAge(selectedActor, state.$world.year);
        const stage = getLifeStage(age);
        const gen = selectedActor.genetics || {};
        const stats = clampStats(selectedActor.stats);
        const canInteract = selectedActor.isAlive && selectedActor.id !== state.$playerId;

        inspectorHtml = `
          <div style="margin-top:1.5rem; background:var(--bg-card); padding:1.25rem; border-radius:10px; border:1px solid var(--border-gold); display:flex; gap:1.5rem; align-items:center;">
            <div>
              ${renderPortraitSVG(selectedActor, 120, state.$world.year)}
            </div>
            <div style="flex:1;">
              <h3 style="color:var(--accent-gold-bright); margin:0 0 0.25rem 0;">${selectedActor.name}</h3>
              <p style="color:var(--text-muted); margin:0 0 0.5rem 0; font-size:0.9rem;">House ${selectedActor.house} | ${stage} (${age}) | ${selectedActor.isAlive ? 'Living' : 'Deceased'}</p>

              <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:0.5rem; font-size:0.8rem; background:#0f172a; padding:0.6rem; border-radius:6px; border:1px solid var(--border-subtle); margin-bottom:0.75rem;">
                <div><strong>Martial:</strong> ${stats.martial}</div>
                <div><strong>Diplomacy:</strong> ${stats.diplomacy}</div>
                <div><strong>Stewardship:</strong> ${stats.stewardship}</div>
                <div><strong>Intrigue:</strong> ${stats.intrigue}</div>
                <div><strong>Learning:</strong> ${stats.learning}</div>
                <div><strong>Skin/Hair/Eye:</strong> ${gen.skinTone ?? 50}/${gen.hairColor ?? 50}/${gen.eyeColor ?? 50}</div>
              </div>

              <div class="badge-list" style="justify-content:flex-start;">
                ${selectedActor.traits.map(t => `<span class="badge">${t}</span>`).join('')}
              </div>
            </div>
            ${canInteract ? `
              <div>
                <button class="lineage-btn lineage-btn-primary" id="btn-tree-interact">Interact / Visit</button>
              </div>
            ` : ''}
          </div>
        `;
      }

      containerEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div>
            <h2 style="color:var(--accent-gold-bright); margin:0;">Dynasty Family Tree</h2>
            <span style="color:var(--text-muted); font-size:0.85rem;">Click any character to highlight direct bloodline paths.</span>
          </div>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <button class="lineage-btn" id="btn-zoom-in">+</button>
            <button class="lineage-btn" id="btn-zoom-out">-</button>
            <button class="lineage-btn" id="btn-zoom-reset">Reset / Center</button>
          </div>
        </div>

        <div class="family-tree-viewport" id="tree-viewport" style="overflow:hidden; cursor:grab; position:relative;">
          <div id="tree-content-container" style="transform: translate(${panX}px, ${panY}px) scale(${zoomLevel}); transform-origin: 0 0; position:relative; width:${layout.bounds.width}px; height:${layout.bounds.height}px;">
            <svg class="family-tree-svg-canvas" width="${layout.bounds.width}" height="${layout.bounds.height}">
              ${svgPathsHtml}
            </svg>
            ${nodesHtml}
          </div>
        </div>

        ${inspectorHtml}
      `;

      const viewportEl = containerEl.querySelector('#tree-viewport');

      containerEl.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
        zoomLevel = Math.min(zoomLevel + 0.15, 2.0);
        renderTreeContent();
      });

      containerEl.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
        zoomLevel = Math.max(zoomLevel - 0.15, 0.4);
        renderTreeContent();
      });

      containerEl.querySelector('#btn-zoom-reset')?.addEventListener('click', () => {
        zoomLevel = 1.0;
        panX = 0;
        panY = 0;
        renderTreeContent();
      });

      if (viewportEl) {
        viewportEl.addEventListener('mousedown', (e) => {
          if (e.target.closest('.tree-node-card')) return;
          isDragging = true;
          startX = e.clientX - panX;
          startY = e.clientY - panY;
          viewportEl.style.cursor = 'grabbing';
        });

        viewportEl.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          panX = e.clientX - startX;
          panY = e.clientY - startY;
          const content = containerEl.querySelector('#tree-content-container');
          if (content) {
            content.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
          }
        });

        viewportEl.addEventListener('mouseup', () => {
          isDragging = false;
          if (viewportEl) viewportEl.style.cursor = 'grab';
        });

        viewportEl.addEventListener('mouseleave', () => {
          isDragging = false;
          if (viewportEl) viewportEl.style.cursor = 'grab';
        });
      }

      containerEl.querySelectorAll('.tree-node-card').forEach(card => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = card.getAttribute('data-actor-id');
          selectedNodeId = id;
          renderTreeContent();
        });
      });

      containerEl.querySelector('#btn-tree-interact')?.addEventListener('click', () => {
        if (selectedNodeId && onSelectActor) {
          onSelectActor(selectedNodeId);
        }
      });
    };

    renderTreeContent();
  },

  renderChronicleView: function (containerEl, state) {
    const entries = state.$chronicle || [];

    containerEl.innerHTML = `
      <h2 style="color:var(--accent-gold-bright); margin-top:0;">Dynasty Chronicle</h2>
      <p style="color:var(--text-muted);">Historical records of births, marriages, successions, and key events.</p>

      <div style="display:flex; flex-direction:column; gap:0.75rem; margin-top:1.5rem;">
        ${entries.slice().reverse().map(e => `
          <div style="background:var(--bg-card); padding:1rem; border-radius:8px; border-left:4px solid var(--accent-gold);">
            <div style="font-size:0.8rem; color:var(--text-muted);">${e.season}, Year ${e.year}</div>
            <div style="margin-top:0.25rem; font-size:0.95rem;">${e.description}</div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderSuccessionView: function (containerEl, state, onContinuation) {
    const deceased = state.$actors[state.$playerId];
    const heirs = getEligibleHeirs(state, state.$playerId);

    if (heirs.length === 0) {
      containerEl.innerHTML = `
        <div style="text-align:center; padding:3rem 1rem;">
          <h1 style="color:#ef4444; font-size:2.5rem;">DYNASTY EXTINGUISHED</h1>
          <p style="color:var(--text-muted); font-size:1.1rem; max-width:500px; margin:1rem auto;">
            Lord ${deceased ? deceased.name : ''} has died without leaving any living bloodline heirs. House ${deceased ? deceased.house : ''} fades into legend.
          </p>
          <button class="lineage-btn lineage-btn-primary" id="btn-restart" style="margin-top:1.5rem;">Start New Dynasty</button>
        </div>
      `;

      containerEl.querySelector('#btn-restart')?.addEventListener('click', () => {
        onContinuation('restart');
      });
      return;
    }

    containerEl.innerHTML = `
      <div style="text-align:center; margin-bottom:2rem;">
        <h1 style="color:var(--accent-gold-bright); margin-bottom:0.5rem;">THE RULER HAS FALLEN</h1>
        <p style="color:var(--text-muted);">${deceased ? deceased.name : ''} has passed away. Select an heir to continue the dynasty lineage.</p>
      </div>

      <div class="character-grid">
        ${heirs.map((candidate, idx) => {
          const heirActor = candidate.actor;
          const isPrimary = idx === 0;

          return `
            <div class="character-card" data-heir-id="${heirActor.id}" style="${isPrimary ? 'border-color:var(--accent-gold);' : ''}">
              ${isPrimary ? `<span class="badge" style="background:var(--accent-gold); color:#000; font-weight:bold;">PRIMARY HEIR</span>` : ''}
              ${renderPortraitSVG(heirActor, 120, state.$world.year)}
              <div class="character-card-name">${heirActor.name}</div>
              <div class="character-card-meta">${candidate.relationshipLabel} | Age ${candidate.age}</div>
              <button class="lineage-btn lineage-btn-primary" style="margin-top:1rem; width:100%;">Ascend as Head</button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    containerEl.querySelectorAll('.character-card').forEach(card => {
      card.addEventListener('click', () => {
        const heirId = card.getAttribute('data-heir-id');
        switchPlayerCharacter(state, heirId);
        onContinuation();
      });
    });
  },

  openDebugModal: function (state, onUpdate) {
    const modalSlot = document.getElementById('modal-slot');
    if (!modalSlot) return;

    modalSlot.innerHTML = `
      <div class="lineage-modal-overlay">
        <div class="lineage-modal-content">
          <div class="lineage-modal-header">
            <span>God-Mode Debug Inspector</span>
            <button class="lineage-btn" id="btn-close-debug" style="padding:0.2rem 0.6rem;">&times;</button>
          </div>
          <p style="color:var(--text-muted); font-size:0.85rem;">Instantly trigger state mutations or stress-test dynastic generational growth.</p>

          <div class="debug-actions-grid">
            <button class="lineage-btn" id="dbg-plus-1">+1 Season</button>
            <button class="lineage-btn" id="dbg-plus-20">+5 Years (20 Seasons)</button>
            <button class="lineage-btn" id="dbg-force-offspring">Force Offspring</button>
            <button class="lineage-btn" id="dbg-add-trait">Add Legendary Trait</button>
            <button class="lineage-btn" id="dbg-heal-stats">Max Out Stats</button>
            <button class="lineage-btn lineage-btn-primary" id="dbg-stress-test">Stress Test (4 Gens)</button>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      modalSlot.innerHTML = '';
      onUpdate();
    };

    modalSlot.querySelector('#btn-close-debug')?.addEventListener('click', closeModal);

    modalSlot.querySelector('#dbg-plus-1')?.addEventListener('click', () => {
      advanceSeason(state);
      closeModal();
    });

    modalSlot.querySelector('#dbg-plus-20')?.addEventListener('click', () => {
      for (let i = 0; i < 20; i++) advanceSeason(state);
      closeModal();
    });

    modalSlot.querySelector('#dbg-force-offspring')?.addEventListener('click', () => {
      const player = state.$actors[state.$playerId];
      if (player && player.unions && player.unions.length > 0) {
        produceOffspring(state, player.unions[0]);
      }
      closeModal();
    });

    modalSlot.querySelector('#dbg-add-trait')?.addEventListener('click', () => {
      const player = state.$actors[state.$playerId];
      if (player && !player.traits.includes('Dragon Blood')) {
        player.traits.push('Dragon Blood');
      }
      closeModal();
    });

    modalSlot.querySelector('#dbg-heal-stats')?.addEventListener('click', () => {
      const player = state.$actors[state.$playerId];
      if (player) {
        player.stats = { martial: 100, diplomacy: 100, stewardship: 100, intrigue: 100, learning: 100 };
      }
      closeModal();
    });

    modalSlot.querySelector('#dbg-stress-test')?.addEventListener('click', () => {
      for (let i = 0; i < 120; i++) {
        advanceSeason(state);
      }
      closeModal();
    });
  }
};

if (typeof window !== 'undefined') {
  window.setup = window.setup || {};
  window.setup.Lineage = LineageEngine;
}

export default LineageEngine;
