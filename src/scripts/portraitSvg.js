import { getLifeStage, getActorAge } from './simulation.js';

function getSkinColors(skinToneVal) {
  const t = skinToneVal / 100;
  if (t < 0.33) {
    return { fill: '#fcd5ce', shadow: '#e8a598', highlight: '#ffe5df' };
  } else if (t < 0.66) {
    return { fill: '#d4a373', shadow: '#b37d46', highlight: '#e2b88b' };
  } else {
    return { fill: '#6c462f', shadow: '#4a2c1a', highlight: '#8c5d41' };
  }
}

function getHairColors(hairColorVal, age, traits = []) {
  if (traits.includes('Dragon Blood') || traits.includes('Aether Sight')) {
    if (hairColorVal > 80) return { fill: '#e2e8f0', shadow: '#cbd5e1', highlight: '#ffffff' };
  }

  let fill, shadow;
  const t = hairColorVal / 100;

  if (t < 0.25) {
    fill = '#2b2d42'; shadow = '#1a1b29';
  } else if (t < 0.50) {
    fill = '#6b4226'; shadow = '#472a17';
  } else if (t < 0.75) {
    fill = '#d4a359'; shadow = '#a67c38';
  } else {
    fill = '#9e2a2b'; shadow = '#6e191a';
  }

  if (age >= 55) {
    const grayFactor = Math.min((age - 50) / 25, 1);
    if (grayFactor > 0.6) {
      fill = '#94a3b8'; shadow = '#64748b';
    } else if (grayFactor > 0.3) {
      fill = '#8d8d92'; shadow = '#5a5a60';
    }
  }

  return { fill, shadow };
}

function getEyeColors(eyeColorVal, traits = []) {
  if (traits.includes('Dragon Blood')) return { fill: '#f59e0b', pupil: '#000000', glow: '#fef08a' };
  if (traits.includes('Aether Sight')) return { fill: '#8b5cf6', pupil: '#1e1b4b', glow: '#ddd6fe' };

  const t = eyeColorVal / 100;
  if (t < 0.30) return { fill: '#3d2612', pupil: '#000000', glow: '#6b4522' };
  if (t < 0.60) return { fill: '#2563eb', pupil: '#000000', glow: '#60a5fa' };
  if (t < 0.85) return { fill: '#16a34a', pupil: '#000000', glow: '#4ade80' };
  return { fill: '#78716c', pupil: '#000000', glow: '#a8a29e' };
}

function getGarbColors(houseName = '') {
  let hash = 0;
  for (let i = 0; i < houseName.length; i++) hash += houseName.charCodeAt(i);
  const hue = hash % 360;
  return {
    fill: `hsl(${hue}, 45%, 28%)`,
    trim: `hsl(${hue}, 65%, 48%)`,
    shadow: `hsl(${hue}, 45%, 18%)`,
  };
}

export function renderPortraitSVG(actor, size = 160) {
  if (!actor) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="220" fill="#1e293b"/></svg>`;
  }

  const age = getActorAge(actor, actor._currentYear || 1);
  const lifeStage = getLifeStage(age);
  const genetics = actor.genetics || {};
  const traits = actor.traits || [];

  const skin = getSkinColors(genetics.skinTone ?? 50);
  const hair = getHairColors(genetics.hairColor ?? 50, age, traits);
  const eye = getEyeColors(genetics.eyeColor ?? 50, traits);
  const garb = getGarbColors(actor.house);

  const isChild = lifeStage === 'Child';
  const isYouth = lifeStage === 'Youth';
  const isElder = lifeStage === 'Elder';

  const jawWidth = genetics.jawWidth ?? 50;
  const jawOffset = (jawWidth - 50) * 0.3;

  const chinY = 155 + (isChild ? -8 : 0);

  let auraBg = '';
  if (traits.includes('Dragon Blood')) {
    auraBg = `<circle cx="100" cy="100" r="85" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6,4" opacity="0.6"/>`;
  } else if (traits.includes('Sun-Kissed')) {
    auraBg = `<circle cx="100" cy="90" r="80" fill="#fef08a" opacity="0.15"/>`;
  } else if (traits.includes('Aether Sight')) {
    auraBg = `<circle cx="100" cy="100" r="85" fill="none" stroke="#a855f7" stroke-width="2" opacity="0.5"/>`;
  }

  let wrinklePaths = '';
  if (isElder) {
    wrinklePaths = `
      <path d="M 80 82 Q 100 80 120 82" fill="none" stroke="${skin.shadow}" stroke-width="1.5" opacity="0.7"/>
      <path d="M 83 87 Q 100 85 117 87" fill="none" stroke="${skin.shadow}" stroke-width="1.2" opacity="0.5"/>
      <path d="M 72 118 Q 78 126 75 135" fill="none" stroke="${skin.shadow}" stroke-width="1.2" opacity="0.6"/>
      <path d="M 128 118 Q 122 126 125 135" fill="none" stroke="${skin.shadow}" stroke-width="1.2" opacity="0.6"/>
    `;
  }

  const isCharming = traits.includes('Charming');
  const mouthPath = isCharming
    ? `M 88 152 Q 100 160 112 152`
    : `M 88 154 Q 100 156 112 154`;

  const isFierce = traits.includes('Fierce');
  const browLeft = isFierce ? `M 70 102 L 92 108` : `M 70 106 Q 81 102 92 105`;
  const browRight = isFierce ? `M 108 108 L 130 102` : `M 108 105 Q 119 102 130 106`;

  const isMale = actor.gender === 'male';
  let backHair = '';
  let frontHair = '';

  if (isMale) {
    frontHair = `
      <path d="M 60 95 Q 100 65 140 95 Q 125 70 100 68 Q 75 70 60 95 Z" fill="${hair.fill}"/>
      <path d="M 60 95 Q 80 75 100 75 Q 80 82 60 95 Z" fill="${hair.shadow}"/>
    `;
  } else {
    backHair = `
      <path d="M 50 100 Q 40 160 55 190 L 145 190 Q 160 160 150 100 Z" fill="${hair.shadow}"/>
    `;
    frontHair = `
      <path d="M 55 100 Q 100 50 145 100 Q 125 75 100 73 Q 75 75 55 100 Z" fill="${hair.fill}"/>
      <path d="M 55 100 Q 75 125 65 150 Q 80 120 75 95 Z" fill="${hair.fill}"/>
      <path d="M 145 100 Q 125 125 135 150 Q 120 120 125 95 Z" fill="${hair.fill}"/>
    `;
  }

  const svg = `
<svg width="${size}" height="${size}" viewBox="0 0 200 220" xmlns="http://www.w3.org/2000/svg" style="background:#0f172a; border-radius:8px; overflow:hidden;">
  <rect width="200" height="220" fill="#1e293b"/>
  ${auraBg}
  ${backHair}
  <path d="M 30 220 Q 40 170 80 165 L 120 165 Q 160 170 170 220 Z" fill="${garb.fill}"/>
  <path d="M 80 165 L 100 195 L 120 165 Z" fill="${garb.trim}"/>
  <path d="M 30 220 Q 40 170 80 165 L 90 220 Z" fill="${garb.shadow}" opacity="0.4"/>
  <path d="M 82 140 L 82 170 L 118 170 L 118 140 Z" fill="${skin.fill}"/>
  <path d="M 82 140 L 82 170 L 98 170 L 90 140 Z" fill="${skin.shadow}"/>
  <circle cx="${68 - jawOffset * 0.2}" cy="120" r="10" fill="${skin.fill}"/>
  <circle cx="${132 + jawOffset * 0.2}" cy="120" r="10" fill="${skin.fill}"/>
  <path d="M ${68 - jawOffset} 100 Q 100 60 ${132 + jawOffset} 100 Q ${132 + jawOffset} 135 100 ${chinY} Q ${68 - jawOffset} 135 ${68 - jawOffset} 100 Z" fill="${skin.fill}"/>
  <path d="M ${68 - jawOffset} 100 Q 88 120 100 ${chinY} Q ${68 - jawOffset} 135 ${68 - jawOffset} 100 Z" fill="${skin.shadow}" opacity="0.35"/>
  <ellipse cx="82" cy="115" rx="9" ry="6" fill="#ffffff"/>
  <circle cx="82" cy="115" r="4.5" fill="${eye.fill}"/>
  <circle cx="82" cy="115" r="2" fill="${eye.pupil}"/>
  <circle cx="80" cy="113" r="1.2" fill="#ffffff"/>
  <ellipse cx="118" cy="115" rx="9" ry="6" fill="#ffffff"/>
  <circle cx="118" cy="115" r="4.5" fill="${eye.fill}"/>
  <circle cx="118" cy="115" r="2" fill="${eye.pupil}"/>
  <circle cx="116" cy="113" r="1.2" fill="#ffffff"/>
  <path d="${browLeft}" fill="none" stroke="${hair.shadow}" stroke-width="3" stroke-linecap="round"/>
  <path d="${browRight}" fill="none" stroke="${hair.shadow}" stroke-width="3" stroke-linecap="round"/>
  <path d="M 100 112 L 97 132 L 103 132 Z" fill="${skin.shadow}"/>
  <path d="${mouthPath}" fill="none" stroke="#7f1d1d" stroke-width="2.5" stroke-linecap="round"/>
  ${wrinklePaths}
  ${frontHair}
</svg>
  `.trim();

  return svg;
}
