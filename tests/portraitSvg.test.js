import { describe, expect, it } from 'vitest';
import { renderPortraitSVG } from '../src/scripts/portraitSvg.js';

describe('SVG character portraits', () => {
  it('renders complete, deterministic portraits when old saves lack new appearance genes', () => {
    const actor = { id: 'legacy-1', name: 'Legacy', gender: 'female', birthYear: 1, house: 'Aethergard', traits: [], genetics: { skinTone: 42, hairColor: 68, eyeColor: 30 } };
    const first = renderPortraitSVG(actor, 140, 22);
    expect(first).toBe(renderPortraitSVG(actor, 140, 22));
    expect(first).toContain('<svg');
    expect(first).toContain('</svg>');
    expect(first).not.toMatch(/NaN|undefined/);
    expect(first).toContain('Portrait of Legacy');
  });

  it('never renders facial hair on a female character', () => {
    const actor = { id: 'female-beard', name: 'Asha', gender: 'female', birthYear: 1, traits: [], genetics: { facialHair: 100, hairLength: 40, hairStyle: 25 } };
    const svg = renderPortraitSVG(actor, 140, 30);
    expect(svg).not.toContain('Q93 123');
  });

  it('supports inherited visible facial hair on adult male characters', () => {
    const actor = { id: 'male-beard', name: 'Tarin', gender: 'male', birthYear: 1, traits: [], genetics: { facialHair: 65 } };
    const svg = renderPortraitSVG(actor, 140, 30);
    expect(svg).toContain('Q93 123');
  });

  it('uses unique definition ids when portraits are placed together in a grid', () => {
    const a = renderPortraitSVG({ id: 'one', name: 'One', gender: 'male', birthYear: 1, traits: [] });
    const b = renderPortraitSVG({ id: 'two', name: 'Two', gender: 'female', birthYear: 1, traits: [] });
    expect(a).toContain('portrait-bg-one');
    expect(b).toContain('portrait-bg-two');
  });

  it('joins the shorter neck to the clothing collar and draws a shaped, compact mouth', () => {
    const actor = { id: 'face-detail', name: 'Mira', gender: 'female', birthYear: 1, traits: ['Charming'], genetics: {} };
    const svg = renderPortraitSVG(actor, 140, 22);
    expect(svg).toContain('M85 137 L85 157 Q100 165 115 157');
    expect(svg).not.toContain('Q100 181');
    expect(svg).toContain('class="portrait-mouth-lower"');
  });

  it('visibly varies eyes, face shape, inherited hairstyle, and mouth from their genes', () => {
    const base = { id: 'variation', name: 'Gene', gender: 'male', birthYear: 1, house: 'Pendelton', traits: [] };
    const soft = renderPortraitSVG({ ...base, genetics: { faceShape: 5, jawWidth: 15, cheekbones: 5, eyeShape: 5, eyeSpacing: 5, mouthShape: 5, hairStyle: 5, hairLength: 5, hairTexture: 5 } }, 140, 25);
    const bold = renderPortraitSVG({ ...base, genetics: { faceShape: 95, jawWidth: 90, cheekbones: 95, eyeShape: 95, eyeSpacing: 95, mouthShape: 95, hairStyle: 95, hairLength: 95, hairTexture: 95 } }, 140, 25);
    expect(soft).not.toBe(bold);
    expect(soft).not.toContain('circle cx="100" cy="41"');
    expect(bold).toContain('circle cx="100" cy="41"');
    expect(soft).toContain('class="portrait-mouth-lower"');
    expect(bold).toContain('class="portrait-mouth-lower"');
  });

  it('provides distinct hair silhouettes across the cut gene range', () => {
    const base = { id: 'cuts', name: 'Cuts', gender: 'female', birthYear: 1, traits: [], genetics: { hairLength: 25, hairTexture: 20, hairPart: 80 } };
    const cuts = [3, 17, 31, 44, 58, 71, 84, 97].map(hairStyle => renderPortraitSVG({ ...base, genetics: { ...base.genetics, hairStyle } }, 140, 25));
    expect(new Set(cuts).size).toBeGreaterThanOrEqual(7);
  });
});
