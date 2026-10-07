import { getLifeStage, getActorAge } from './simulation.js';

const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : 50));
const mix = (a, b, t) => a + (b - a) * t;

function seededVariation(actor, key) {
  const source = `${actor?.id || ''}|${actor?.name || ''}|${key}|${Object.values(actor?.genetics || {}).join(',')}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return (hash >>> 0) % 101;
}

function gene(actor, key, actorLookup = {}, depth = 0) {
  const value = actor?.genetics?.[key];
  if (value != null && Number.isFinite(Number(value))) return clamp(value);
  const parentActors = (actor?.parents || []).map(id => actorLookup[id]).filter(Boolean);
  if (parentActors.length && depth < 4) {
    const inherited = parentActors.reduce((sum, parent) => sum + gene(parent, key, actorLookup, depth + 1), 0) / parentActors.length;
    const variation = seededVariation(actor, `${key}-mutation`) % 13 - 6;
    return clamp(Math.round(inherited + variation));
  }
  return seededVariation(actor, key);
}

function skinColors(value) {
  const palettes = [
    ['#f8d8c7', '#dba892', '#ffe8dc'], ['#e9b995', '#bb8665', '#f4cfb3'],
    ['#c98f68', '#976247', '#dfa981'], ['#9b6447', '#70452f', '#b77d5e'],
    ['#684432', '#452b20', '#82583f'],
  ];
  const position = clamp(value) / 100 * (palettes.length - 1);
  const index = Math.min(palettes.length - 2, Math.floor(position));
  const blend = (hexA, hexB, t) => {
    const c = [1, 3, 5].map(i => Math.round(mix(parseInt(hexA.slice(i, i + 2), 16), parseInt(hexB.slice(i, i + 2), 16), t)));
    return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
  };
  const t = position - index;
  return { fill: blend(palettes[index][0], palettes[index + 1][0], t), shadow: blend(palettes[index][1], palettes[index + 1][1], t), light: blend(palettes[index][2], palettes[index + 1][2], t) };
}

function hairColors(value, age, traits) {
  if ((traits.includes('Dragon Blood') || traits.includes('Aether Sight')) && value > 80) return { fill: '#e8e6f4', shadow: '#aaa5c5', light: '#ffffff' };
  const palette = [
    ['#211b26', '#100e16', '#514459'], ['#493024', '#291b16', '#79543e'],
    ['#78502e', '#49301e', '#b08553'], ['#c69a55', '#886531', '#f1d38a'],
    ['#9b3d38', '#612323', '#d67562'], ['#ddd2bd', '#9f9686', '#fff4df'],
  ];
  const p = clamp(value) / 100 * (palette.length - 1);
  const i = Math.min(palette.length - 2, Math.floor(p)); const t = p - i;
  const blend = (a, b) => `#${[1, 3, 5].map(k => Math.round(mix(parseInt(a.slice(k, k + 2), 16), parseInt(b.slice(k, k + 2), 16), t)).toString(16).padStart(2, '0')).join('')}`;
  let colors = { fill: blend(palette[i][0], palette[i + 1][0]), shadow: blend(palette[i][1], palette[i + 1][1]), light: blend(palette[i][2], palette[i + 1][2]) };
  if (age >= 55) {
    const gray = Math.min(0.8, (age - 48) / 35);
    const silver = { fill: '#aaa9b1', shadow: '#696a75', light: '#e2dfe5' };
    const mixHex = (a, b) => `#${[1, 3, 5].map(k => Math.round(mix(parseInt(a.slice(k, k + 2), 16), parseInt(b.slice(k, k + 2), 16), gray)).toString(16).padStart(2, '0')).join('')}`;
    colors = Object.fromEntries(Object.keys(colors).map(key => [key, mixHex(colors[key], silver[key])]));
  }
  return colors;
}

function eyeColor(value, traits) {
  if (traits.includes('Dragon Blood')) return '#e5a91a';
  if (traits.includes('Aether Sight')) return '#9b77dc';
  const colors = ['#49351f', '#73909a', '#467e68', '#6686bc', '#79664f'];
  return colors[Math.min(colors.length - 1, Math.floor(clamp(value) / 20))];
}

function houseColors(house = '') {
  let hash = 0; for (const char of house) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return { fill: `hsl(${hue} 37% 27%)`, shade: `hsl(${hue} 38% 18%)`, trim: `hsl(${hue} 53% 49%)` };
}

function hairShapes(style, length, texture, part, colors, female) {
  const long = length >= 68;
  const medium = length >= 36 && !long;
  const curly = texture >= 68;
  const wavy = texture >= 34 && !curly;
  const back = long
    ? `<path d="M58 91 Q51 75 62 55 Q77 37 100 39 Q126 37 140 57 Q149 75 142 104 L148 158 Q138 166 130 151 L126 127 L74 127 L70 151 Q62 166 52 158 L58 105Z" fill="${colors.shadow}"/><path d="M66 101 Q60 128 64 149 M134 101 Q140 128 136 149" fill="none" stroke="${colors.fill}" stroke-width="5" opacity=".8"/>`
    : medium
      ? `<path d="M58 91 Q51 75 62 55 Q77 37 100 39 Q126 37 140 57 Q149 75 142 104 L143 137 Q132 145 125 127 L75 127 Q68 145 57 137Z" fill="${colors.shadow}"/>`
      : '';
  let cap = '';
  let front = '';
  if (style < 12) {
    cap = `<path d="M59 91 Q55 58 78 47 Q101 36 125 47 Q146 59 141 92 Q128 77 118 70 Q99 78 82 69 Q70 72 59 91Z" fill="${colors.fill}"/>`;
    front = `<path d="M59 82 Q69 58 91 54 Q117 49 138 72 Q123 64 112 68 Q100 72 89 66 Q72 67 59 87Z" fill="${colors.fill}"/><path d="M64 78 Q82 57 108 58" fill="none" stroke="${colors.light}" stroke-width="2" stroke-linecap="round" opacity=".3"/>`;
  } else if (style < 25) {
    cap = `<path d="M57 94 Q53 58 77 46 Q103 34 128 48 Q148 62 142 96 Q127 77 111 72 Q88 66 57 94Z" fill="${colors.fill}"/>`;
    front = `<path d="M58 88 Q72 63 102 57 Q120 55 137 72 Q116 66 99 74 Q80 82 58 88Z" fill="${colors.fill}"/><path d="M65 81 Q90 59 119 62" fill="none" stroke="${colors.light}" stroke-width="2" opacity=".32"/>`;
  } else if (style < 38) {
    cap = `<path d="M56 96 Q52 58 76 45 Q101 33 127 47 Q150 62 143 98 Q130 79 115 67 Q96 61 78 76 Q67 83 56 96Z" fill="${colors.fill}"/>`;
    front = `<path d="M57 86 Q73 66 98 60 Q121 54 141 73 Q126 70 112 76 Q91 87 75 91 Q65 92 57 99Z" fill="${colors.fill}"/>`;
  } else if (style < 51) {
    cap = `<path d="M57 93 Q52 60 76 46 Q101 34 125 47 Q148 60 143 94 Q131 82 125 70 Q111 81 97 70 Q77 69 57 93Z" fill="${colors.fill}"/>`;
    front = `<path d="M59 77 Q75 68 88 72 Q100 76 112 71 Q126 67 140 76 L138 86 Q123 80 111 85 Q99 89 86 84 Q73 79 59 88Z" fill="${colors.fill}"/>`;
  } else if (style < 64) {
    cap = `<path d="M56 96 Q52 59 77 45 Q102 33 128 47 Q150 62 143 98 Q132 82 125 68 Q108 78 96 64 Q78 63 56 96Z" fill="${colors.fill}"/>`;
    front = `<path d="M58 82 Q69 62 89 62 Q105 62 117 70 Q131 76 141 88 Q122 81 109 78 Q91 74 77 88 L64 91Z" fill="${colors.fill}"/>`;
  } else if (style < 77) {
    cap = `<path d="M58 95 Q55 62 79 47 Q101 37 123 47 Q146 60 142 95 Q129 79 118 69 Q103 62 90 71 Q75 78 58 95Z" fill="${colors.fill}"/>`;
    front = `<path d="M59 83 Q73 66 89 66 Q96 67 100 77 Q104 67 112 66 Q129 67 141 84 Q124 78 113 82 Q104 86 100 92 Q94 85 85 82 Q72 78 59 91Z" fill="${colors.fill}"/>`;
  } else if (style < 90) {
    cap = `<path d="M57 93 Q53 57 77 45 Q101 33 126 46 Q148 60 143 95 Q130 78 118 69 Q100 62 83 71 Q70 77 57 93Z" fill="${colors.fill}"/>`;
    front = `<path d="M59 80 Q73 63 88 64 Q97 65 100 80 Q103 65 113 64 Q129 63 141 81 Q125 75 113 84 Q104 91 100 98 Q95 91 86 84 Q74 76 59 89Z" fill="${colors.fill}"/>`;
  } else {
    cap = `<path d="M57 93 Q53 58 77 46 Q101 34 125 47 Q147 59 143 94 Q130 75 116 67 Q100 61 84 70 Q70 77 57 93Z" fill="${colors.fill}"/><circle cx="100" cy="41" r="12" fill="${colors.shadow}"/><path d="M68 57 Q77 43 91 48 M109 48 Q124 43 132 58" fill="none" stroke="${colors.light}" stroke-width="2.2" opacity=".34"/>`;
    front = `<path d="M58 83 Q71 67 88 68 Q96 69 100 79 Q103 69 112 68 Q130 68 142 84 Q124 80 113 86 Q105 88 100 91 Q94 88 85 86 Q73 81 58 90Z" fill="${colors.fill}"/>`;
  }
  if (curly) {
    cap = `<path d="M63 67 Q62 48 77 46 Q82 34 94 42 Q102 32 113 42 Q129 37 136 52 Q148 59 143 80 Q132 68 124 67 Q112 76 100 68 Q84 79 73 69Z" fill="${colors.fill}"/><path d="M70 54 Q76 45 83 49 M93 46 Q100 39 107 47 M117 47 Q126 44 131 54" fill="none" stroke="${colors.light}" stroke-width="2.2" stroke-linecap="round" opacity=".34"/>${style >= 80 ? `<circle cx="100" cy="41" r="12" fill="${colors.shadow}"/>` : ''}`;
    if (style >= 38 && style < 77) front = `<path d="M61 72 Q69 62 77 72 Q83 61 91 72 Q99 60 107 71 Q115 61 123 72 Q132 62 140 75 L137 86 Q126 78 117 88 Q106 78 98 89 Q87 78 77 88 Q68 79 60 88Z" fill="${colors.fill}"/>`;
  }
  const sideLocks = medium || long
    ? `<path d="M60 81 Q56 105 65 128 L73 132 Q68 105 75 83Z M140 81 Q144 105 135 128 L127 132 Q132 105 125 83Z" fill="${colors.fill}"/>`
    : female
      ? `<path d="M61 83 Q56 103 64 121 L72 124 Q68 102 74 84Z M139 83 Q144 103 136 121 L128 124 Q132 102 126 84Z" fill="${colors.fill}"/>`
      : '';
  // Every head shape can use every cut; gender affects only styling details, not access to length.
  if (wavy && style >= 12 && style < 38) front += `<path d="M62 86 Q66 95 61 102 M138 86 Q134 95 139 102" fill="none" stroke="${colors.shadow}" stroke-width="2" opacity=".65"/>`;
  // Keep the crown in front of the face silhouette. Drawing it behind the face
  // erased most of the cap and left only isolated locks or buns visible.
  const parted = style >= 12 && style < 38 && part < 50;
  const frontTransform = parted ? 'translate(200 0) scale(-1 1)' : '';
  return { back: `${back}${sideLocks}`, front: `<g transform="${frontTransform}">${cap}${front}</g>` };
}

export function renderPortraitSVG(actor, size = 160, currentYear = null, config = {}) {
  const numericSize = Math.max(1, Number(size) || 160);
  if (!actor) return `<svg width="${numericSize}" height="${numericSize}" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Empty portrait"><rect width="200" height="220" fill="#1e293b"/></svg>`;
  const year = currentYear ?? actor._currentYear ?? (typeof window !== 'undefined' ? window.SugarCube?.State?.variables?.$world?.year : null) ?? 1;
  const svgId = String(actor.id || actor.name || 'portrait').replace(/[^a-zA-Z0-9_-]/g, '_');
  const computedAge = getActorAge(actor, year);
  const age = Number.isFinite(computedAge) ? Math.max(0, computedAge) : Math.max(0, Number(year) - (Number(actor.birthYear) || 1));
  const stage = getLifeStage(age, config);
  const traits = Array.isArray(actor.traits) ? actor.traits : [];
  const female = String(actor.gender || '').toLowerCase() === 'female';
  const actorLookup = typeof window !== 'undefined' ? window.SugarCube?.State?.variables?.$actors || {} : {};
  const getGene = key => gene(actor, key, actorLookup);
  const skin = skinColors(getGene('skinTone'));
  const hair = hairColors(getGene('hairColor'), age, traits);
  const eye = eyeColor(getGene('eyeColor'), traits);
  const clothes = houseColors(actor.house);
  const childScale = stage === 'Child' ? 0.88 : stage === 'Youth' ? 0.94 : 1;
  const headWidth = 28 + getGene('faceShape') * 0.1;
  const jawWidth = headWidth * (0.64 + getGene('jawWidth') * 0.003);
  const cheekWidth = headWidth * (0.89 + getGene('cheekbones') * 0.0022);
  const chin = 143 + getGene('faceLength') * 0.1;
  const left = 100 - headWidth; const right = 100 + headWidth;
  const shoulder = 53 + getGene('bodyFrame') * 0.14;
  const nose = getGene('noseShape');
  const nosePath = nose < 34 ? 'M100 103 Q94 120 96 123 Q100 126 104 123' : nose > 68 ? 'M100 103 Q101 116 105 123 Q101 126 94 124' : 'M100 103 Q99 117 95 123 Q100 126 105 123';
  const eyeY = 94 + (getGene('eyeSlant') - 50) * 0.045;
  const eyeShape = getGene('eyeShape');
  const eyeRx = 6.2 + eyeShape * 0.036;
  const eyeRy = 2.8 + eyeShape * 0.033;
  const eyeGap = 30 + getGene('eyeSpacing') * 0.08;
  const eyeLeft = 100 - eyeGap / 2;
  const eyeRight = 100 + eyeGap / 2;
  const hairSvg = hairShapes(getGene('hairStyle'), getGene('hairLength'), getGene('hairTexture'), getGene('hairPart'), hair, female);
  const facialHairGene = getGene('facialHair');
  const facialHair = !female && age >= 16 && facialHairGene > 70
    ? facialHairGene > 90
      ? `<path d="M${left + 11} 116 Q100 124 ${right - 11} 116 Q${right - 17} 139 100 ${chin + 1} Q${left + 17} 139 ${left + 11} 116Z" fill="${hair.fill}"/>`
      : `<path d="M91 137 Q100 141 109 137 L106 144 Q100 ${chin + 1} 94 144Z" fill="${hair.fill}"/>`
    : !female && age >= 16 && facialHairGene > 55
      ? `<path d="M87 127 Q93 123 99 127 Q100 128 101 127 Q107 123 113 127 Q110 133 100 130 Q90 133 87 127Z" fill="${hair.fill}"/>`
      : '';
  const brow = traits.includes('Fierce') ? 'M74 85 L91 90 M109 90 L126 85' : 'M74 88 Q82 84 91 88 M109 88 Q118 84 126 88';
  const mouthWidth = 7.5 + getGene('mouthShape') * 0.045;
  const mouthY = 132 + (getGene('mouthShape') > 66 ? 1 : 0);
  const mouthSmile = traits.includes('Charming') ? 3.4 : 0.8 + getGene('mouthShape') * 0.012;
  const mouth = `M${100 - mouthWidth} ${mouthY} Q100 ${mouthY + mouthSmile} ${100 + mouthWidth} ${mouthY}`;
  const lowerLip = `M${100 - mouthWidth * 0.72} ${mouthY + 1} Q100 ${mouthY + mouthSmile + 2.2} ${100 + mouthWidth * 0.72} ${mouthY + 1}`;
  const facePath = `M${100 - headWidth} 89 Q${100 - headWidth - 5} 67 77 58 Q100 44 ${right - 2} 58 Q${100 + headWidth + 5} 67 ${right} 89 L${100 + cheekWidth} 107 Q${100 + cheekWidth * 0.96} 131 ${100 + jawWidth * 0.9} 137 Q100 ${chin} ${100 - jawWidth * 0.9} 137 Q${100 - cheekWidth * 0.96} 131 ${100 - cheekWidth} 107Z`;
  const freckles = getGene('freckles') > 68
    ? `<g fill="${skin.shadow}" opacity=".52"><circle cx="${eyeLeft + 7}" cy="116" r=".85"/><circle cx="${eyeLeft + 12}" cy="119" r=".7"/><circle cx="${eyeLeft + 17}" cy="117" r=".65"/><circle cx="${eyeRight - 7}" cy="116" r=".85"/><circle cx="${eyeRight - 12}" cy="119" r=".7"/><circle cx="${eyeRight - 17}" cy="117" r=".65"/></g>`
    : '';
  const ageDetails = age >= 55 ? `<path d="M76 108 Q81 114 79 120 M124 108 Q119 114 121 120 M82 78 Q100 75 118 78" fill="none" stroke="${skin.shadow}" stroke-width="1.2" opacity=".55"/>` : '';
  const collar = getGene('bodyFrame') > 50
    ? `<path d="M83 158 L100 177 L117 158 L126 171 L100 202 L74 171Z" fill="${clothes.trim}"/><path d="M90 160 L100 174 L110 160" fill="none" stroke="${skin.light}" stroke-width="3"/>`
    : `<path d="M80 161 L100 181 L120 161 L114 154 L86 154Z" fill="${clothes.trim}"/><path d="M100 178 L100 216" stroke="${clothes.trim}" stroke-width="3"/>`;
  const aura = traits.includes('Dragon Blood') ? '<circle cx="100" cy="100" r="91" fill="none" stroke="#e5a91a" stroke-width="2" stroke-dasharray="5 7" opacity=".55"/>' : traits.includes('Aether Sight') ? '<circle cx="100" cy="100" r="91" fill="none" stroke="#a78bfa" stroke-width="2" opacity=".5"/>' : '';
  const body = `<path d="M${100 - shoulder} 224 Q${100 - shoulder + 3} 177 78 158 L89 152 L111 152 L122 158 Q${100 + shoulder - 3} 177 ${100 + shoulder} 224Z" fill="${clothes.fill}"/><path d="M${100 - shoulder} 224 Q${100 - shoulder + 5} 179 79 159 L91 170 L86 224Z" fill="${clothes.shade}" opacity=".7"/>`;
  const neck = `<path d="M85 137 L85 157 Q100 165 115 157 L115 137Z" fill="${skin.fill}"/><path d="M85 141 L93 147 L93 161 Q88 160 85 157Z" fill="${skin.shadow}" opacity=".28"/>`;
  const lipColor = '#8c4f52';
  const ageTransform = `translate(100 0) scale(${childScale} 1) translate(-100 0)`;
  return `<svg width="${numericSize}" height="${numericSize}" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Portrait of ${String(actor.name || 'character').replace(/[&<>"']/g, '')}" style="display:block;background:#172033;border-radius:8px;overflow:hidden">
<defs><linearGradient id="portrait-bg-${svgId}" x2="0" y2="1"><stop stop-color="#26334a"/><stop offset="1" stop-color="#172033"/></linearGradient><radialGradient id="face-light-${svgId}" cx="35%" cy="25%"><stop stop-color="${skin.light}" stop-opacity=".38"/><stop offset="1" stop-color="${skin.fill}" stop-opacity="0"/></radialGradient></defs>
<rect width="200" height="220" fill="url(#portrait-bg-${svgId})"/>${aura}<ellipse cx="100" cy="222" rx="83" ry="25" fill="#0b1220" opacity=".45"/>${body}
<g transform="${ageTransform}">${hairSvg.back}${neck}${collar}
<path d="${facePath}" fill="${skin.fill}"/><path d="${facePath}" fill="url(#face-light-${svgId})"/>${hairSvg.front}${freckles}
<ellipse cx="${100 - cheekWidth}" cy="103" rx="5" ry="8" fill="${skin.fill}"/><ellipse cx="${100 + cheekWidth}" cy="103" rx="5" ry="8" fill="${skin.fill}"/><path d="M${eyeLeft - eyeRx} ${eyeY} Q${eyeLeft} ${eyeY - eyeRy} ${eyeLeft + eyeRx} ${eyeY} Q${eyeLeft} ${eyeY + eyeRy} ${eyeLeft - eyeRx} ${eyeY}Z M${eyeRight - eyeRx} ${eyeY} Q${eyeRight} ${eyeY - eyeRy} ${eyeRight + eyeRx} ${eyeY} Q${eyeRight} ${eyeY + eyeRy} ${eyeRight - eyeRx} ${eyeY}Z" fill="#fffaf2"/><ellipse cx="${eyeLeft}" cy="${eyeY}" rx="${Math.min(3.3, eyeRx * 0.38)}" ry="${Math.min(4, eyeRy * 0.75)}" fill="${eye}"/><ellipse cx="${eyeRight}" cy="${eyeY}" rx="${Math.min(3.3, eyeRx * 0.38)}" ry="${Math.min(4, eyeRy * 0.75)}" fill="${eye}"/><circle cx="${eyeLeft}" cy="${eyeY}" r="1.7" fill="#17151a"/><circle cx="${eyeRight}" cy="${eyeY}" r="1.7" fill="#17151a"/><circle cx="${eyeLeft - 1}" cy="${eyeY - 1.5}" r="1" fill="white"/><circle cx="${eyeRight - 1}" cy="${eyeY - 1.5}" r="1" fill="white"/>
<path d="${brow}" fill="none" stroke="${hair.shadow}" stroke-width="2.6" stroke-linecap="round"/><path d="${nosePath}" fill="none" stroke="${skin.shadow}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${facialHair}<path d="${mouth}" fill="none" stroke="${lipColor}" stroke-width="1.6" stroke-linecap="round"/><path d="${lowerLip}" class="portrait-mouth-lower" fill="none" stroke="${lipColor}" stroke-width="1.1" stroke-linecap="round" opacity=".78"/>${ageDetails}</g>
</svg>`;
}
