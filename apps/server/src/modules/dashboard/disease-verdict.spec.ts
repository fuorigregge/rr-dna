import { describe, it, expect } from 'vitest';
import { classifyDiseaseFinding, type DiseaseVerdictInput } from './disease-verdict';

// Default: chiamata standard, nessun segnale particolare.
function input(over: Partial<DiseaseVerdictInput>): DiseaseVerdictInput {
  return {
    significance: 'PATHOGENIC', stars: 2, lowConfidence: false,
    vaf: 0.5, zygosity: 'HETEROZYGOUS', populationAf: null, ...over,
  };
}

describe('classifyDiseaseFinding', () => {
  it('flag 0★ ClinVar come probabile falso positivo (annotazione)', () => {
    const r = classifyDiseaseFinding(input({ stars: 0, zygosity: 'HOMOZYGOUS', vaf: 1 }));
    expect(r.verdict).toBe('likely_false_positive');
    expect(r.reason).toMatch(/0★/);
  });

  it('flag chiamata a bassa confidenza come probabile falso positivo (chiamata)', () => {
    // 2★ ma VAF 0.17 su eterozigote (chiamata dubbia) -> falso positivo
    const r = classifyDiseaseFinding(input({ lowConfidence: true, vaf: 0.17 }));
    expect(r.verdict).toBe('likely_false_positive');
    expect(r.reason).toMatch(/VAF 17%/);
    expect(r.reason).toMatch(/atteso ~50%/);
  });

  it('la qualità della chiamata prevale sulle stelle alte', () => {
    const r = classifyDiseaseFinding(input({ stars: 4, lowConfidence: true, vaf: 0.1 }));
    expect(r.verdict).toBe('likely_false_positive');
  });

  it('considera solido un reperto ≥2★ raro con chiamata standard', () => {
    const r = classifyDiseaseFinding(input({ stars: 2, vaf: 0.52, populationAf: 0.0001 }));
    expect(r.verdict).toBe('solid');
    expect(r.reason).toMatch(/rara/);
  });

  it('ACMG BS1: variante comune declassata a falso positivo (AF 75%)', () => {
    const r = classifyDiseaseFinding(input({ significance: 'LIKELY_PATHOGENIC', stars: null, populationAf: 0.7477 }));
    expect(r.verdict).toBe('likely_false_positive');
    expect(r.reason).toMatch(/gnomAD 75%/);
    expect(r.reason).toMatch(/BS1/);
  });

  it('ACMG BS1: 0★ comune con motivazione di frequenza (AF 85%)', () => {
    const r = classifyDiseaseFinding(input({ stars: 0, populationAf: 0.85, zygosity: 'HOMOZYGOUS', vaf: 1 }));
    expect(r.verdict).toBe('likely_false_positive');
    expect(r.reason).toMatch(/85%/);
  });

  it('frequenza moltо alta declassa anche un 2★ (troppo comune per essere causale)', () => {
    const r = classifyDiseaseFinding(input({ stars: 2, populationAf: 0.39 }));
    expect(r.verdict).toBe('likely_false_positive');
    expect(r.reason).toMatch(/Troppo comune/);
  });

  it('2★ con frequenza moderata (5-25%) → da verificare, non declassato del tutto', () => {
    const r = classifyDiseaseFinding(input({ stars: 2, populationAf: 0.08 }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toMatch(/incoerenza|penetranza/);
  });

  it('senza AF, il likely-pathogenic senza rating resta da verificare', () => {
    const r = classifyDiseaseFinding(input({ significance: 'LIKELY_PATHOGENIC', stars: null, populationAf: null }));
    expect(r.verdict).toBe('review');
  });

  it('marca da verificare le VUS indipendentemente dalle stelle', () => {
    const r = classifyDiseaseFinding(input({ significance: 'UNCERTAIN', stars: 2 }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toMatch(/VUS/);
  });

  it('VUS comune: review con nota che è verosimilmente benigna', () => {
    const r = classifyDiseaseFinding(input({ significance: 'UNCERTAIN', stars: 1, populationAf: 0.5 }));
    expect(r.verdict).toBe('review');
    expect(r.reason).toMatch(/benigna/);
  });

  it('marca da verificare 1★ ClinVar', () => {
    const r = classifyDiseaseFinding(input({ stars: 1 }));
    expect(r.verdict).toBe('review');
  });

  it('una VUS con chiamata inaffidabile resta probabile falso positivo', () => {
    const r = classifyDiseaseFinding(input({ significance: 'UNCERTAIN', stars: 1, lowConfidence: true, vaf: 0.12 }));
    expect(r.verdict).toBe('likely_false_positive');
  });
});
