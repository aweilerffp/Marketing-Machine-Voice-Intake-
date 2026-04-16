import { ACCENT, GREEN, AMBER } from '../components/design-tokens';

export const PHASES = [
  'WELCOME',
  'SA_INT', 'SA_GEN', 'SA_REV',
  'SB_INT', 'SB_GEN', 'SB_REV',
  'SC_INT', 'SC_GEN', 'SC_REV',
  'COMPLETE',
];

export const SECTIONS = {
  A: {
    key: 'a',
    label: 'Brand Voice',
    color: ACCENT,
    icon: '\uD83C\uDFA4',
    deliv: 'Brand Voice Guide',
    stateKey: 'sectionA',
  },
  B: {
    key: 'b',
    label: 'Ideal Customer',
    color: GREEN,
    icon: '\uD83C\uDFAF',
    deliv: 'ICP Profile',
    stateKey: 'sectionB',
  },
  C: {
    key: 'c',
    label: 'Channels & Marketing',
    color: AMBER,
    icon: '\uD83D\uDCE1',
    deliv: 'Channel Strategy',
    stateKey: 'sectionC',
  },
};

export function currentSectionFromPhase(phase) {
  if (phase.startsWith('SA')) return 'A';
  if (phase.startsWith('SB')) return 'B';
  if (phase.startsWith('SC')) return 'C';
  return null;
}

export function phaseType(phase) {
  if (phase === 'WELCOME' || phase === 'COMPLETE') return phase;
  if (phase.endsWith('_INT')) return 'INTERVIEW';
  if (phase.endsWith('_GEN')) return 'GENERATING';
  if (phase.endsWith('_REV')) return 'REVIEW';
  return null;
}
