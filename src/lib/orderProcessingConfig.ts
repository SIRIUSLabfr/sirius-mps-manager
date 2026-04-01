// Steps configuration for order processing
export interface StepDef {
  key: string;
  label: string;
}

export interface GroupDef {
  key: string;
  label: string;
  steps: StepDef[];
}

export const STEP_GROUPS: GroupDef[] = [
  {
    key: 'planung',
    label: 'Planung & Vorbereitung',
    steps: [
      { key: 'it_begehung', label: 'IT-Begehung' },
      { key: 'rollout_planung', label: 'Rollout-Planung' },
      { key: 'rolloutliste_erstellen', label: 'Rolloutliste erstellen' },
      { key: 'freigabe_rolloutliste', label: 'Freigabe Rolloutliste' },
      { key: 'lagerliste', label: 'Lagerliste' },
    ],
  },
  {
    key: 'sop_geraete',
    label: 'SOP & Geräte',
    steps: [
      { key: 'sop', label: 'SOP erstellt' },
      { key: 'geraete_liste', label: 'Geräteliste' },
      { key: 'gebraucht_geraete', label: 'Gebrauchtgeräteliste' },
      { key: 'software', label: 'Software' },
    ],
  },
  {
    key: 'lieferung_rollout',
    label: 'Lieferung & Rollout',
    steps: [
      { key: 'liefertermin', label: 'Liefertermin' },
      { key: 'lieferschein', label: 'Lieferschein' },
      { key: 'uebergabetermin', label: 'Übergabetermin' },
      { key: 'rolloutbesprechung', label: 'Rolloutbesprechung' },
      { key: 'endkontrolle', label: 'Endkontrolle' },
      { key: 'nachbesprechung', label: 'Nachbesprechung' },
    ],
  },
  {
    key: 'altgeraete',
    label: 'Altgeräte',
    steps: [
      { key: 'altgeraete_abholen', label: 'Altgeräte abholen' },
      { key: 'altgeraet_rueckbuchen', label: 'Altgerät rückbuchen' },
      { key: 'abloese_altvertrag', label: 'Ablöse Altvertrag' },
      { key: 'endabrechnung_altvertrag', label: 'Endabrechnung Altvertrag' },
    ],
  },
  {
    key: 'vertrag_finanzen',
    label: 'Vertrag & Finanzen',
    steps: [
      { key: 'vertraege_versendet', label: 'Verträge versendet' },
      { key: 'sx_vertrag', label: 'SX-Vertrag' },
      { key: 're_bank', label: 'RE Bank' },
      { key: 're_kunde', label: 'RE Kunde' },
      { key: 're_edv', label: 'RE EDV' },
      { key: 're_abh_dl', label: 'RE ABH/DL' },
      { key: 're_uhg', label: 'RE UHG' },
      { key: 'geldeingang', label: 'Geldeingang' },
      { key: 'zahlungseingang_notiert', label: 'Zahlungseingang notiert' },
    ],
  },
  {
    key: 'fleet_garantie',
    label: 'Fleet & Garantie',
    steps: [
      { key: 'fleet_ticket', label: 'Fleet Ticket' },
      { key: 'epp_info_epson', label: 'EPP Info an Epson' },
      { key: 'epp_eintrag_fleet', label: 'EPP Eintrag in Fleet' },
      { key: 'garantien_gebucht', label: 'Garantien gebucht' },
      { key: 'gutschrift_koop', label: 'Gutschrift Koop' },
      { key: 'koop_partner_info', label: 'Koop-Partner Info' },
    ],
  },
];

// Which groups are relevant per project type
export const STEPS_CONFIG: Record<string, string[]> = {
  project: ['planung', 'sop_geraete', 'lieferung_rollout', 'altgeraete', 'vertrag_finanzen', 'fleet_garantie'],
  daily: ['sop_geraete', 'lieferung_rollout', 'vertrag_finanzen'],
};

// Generate empty steps object
export function generateEmptySteps(projectType: string = 'project'): Record<string, Record<string, { done: boolean; note: string }>> {
  const allowedGroups = STEPS_CONFIG[projectType] || STEPS_CONFIG.project;
  const steps: Record<string, Record<string, { done: boolean; note: string }>> = {};
  for (const group of STEP_GROUPS) {
    if (!allowedGroups.includes(group.key)) continue;
    steps[group.key] = {};
    for (const step of group.steps) {
      steps[group.key][step.key] = { done: false, note: '' };
    }
  }
  return steps;
}

// Get groups for a project type
export function getGroupsForType(projectType: string): GroupDef[] {
  const allowed = STEPS_CONFIG[projectType] || STEPS_CONFIG.project;
  return STEP_GROUPS.filter(g => allowed.includes(g.key));
}

// Count steps
export function countSteps(steps: any, groups: GroupDef[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const group of groups) {
    const groupSteps = steps?.[group.key] || {};
    for (const step of group.steps) {
      total++;
      if (groupSteps[step.key]?.done) done++;
    }
  }
  return { total, done };
}

export function countGroupSteps(steps: any, group: GroupDef): { total: number; done: number } {
  let total = 0;
  let done = 0;
  const groupSteps = steps?.[group.key] || {};
  for (const step of group.steps) {
    total++;
    if (groupSteps[step.key]?.done) done++;
  }
  return { total, done };
}

// Status config
export const STATUS_OPTIONS = [
  { value: 'offen', label: 'Offen', color: 'bg-muted text-muted-foreground' },
  { value: 'in_bearbeitung', label: 'In Bearbeitung', color: 'bg-blue-100 text-blue-800' },
  { value: 'bereit', label: 'Bereit', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'abgeschlossen', label: 'Abgeschlossen', color: 'bg-green-100 text-green-800' },
] as const;
