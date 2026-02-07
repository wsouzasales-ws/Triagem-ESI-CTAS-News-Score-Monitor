
export interface VitalSigns {
  pas: string;
  pad: string;
  fc: string;
  fr: string;
  temp: string;
  spo2: string;
  gcs: number;
  painLevel: number | '';
  o2Sup?: boolean;
  consciousness?: 'Alert' | 'Confused' | 'Pain' | 'Unresponsive';
}

export interface PatientData {
  name: string;
  medicalRecord: string;
  dob: string;
  age: number;
  ageUnit: 'years' | 'months';
  gender: 'M' | 'F';
  complaint: string;
  serviceTimestamp: string;
  evaluationDate: string;
  evaluationTime: string;
  isReevaluation: boolean;
  reevaluationDate?: string;
  reevaluationTime?: string;
  sector?: string;
  bed?: string;
}

export type EsiLevel = 1 | 2 | 3 | 4 | 5;

export interface TriageResult {
  level: EsiLevel;
  color: string;
  title: string;
  maxWaitTime: string;
  justification: string[];
  discriminators: string[];
}

export interface CtasDiscriminators {
  abcUnstable: boolean;
  highRiskSituation: boolean;
  resources: 'none' | 'one' | 'many';
  
  neuro: {
    gcsLow: boolean;
    acuteConfusion: boolean;
    headTrauma: boolean;
    severeHeadache: boolean;
  };
  sepsis: {
    // Fixed typo: renamed from scuspectedInfection to suspectedInfection
    suspectedInfection: boolean;
    immunosuppressed: boolean;
    perfursionIssues: boolean;
  };
  cardio: {
    chestPainRisk: boolean;
    chestPainTypical: boolean; // Novo: Dor Típica
    chestPainAtypicalCombined: boolean; // Novo: Dor Atípica + Sintomas
    severePainWithVitals: boolean;
  };
  respiratory: {
    dyspneaRisk: boolean;
    respiratoryDistress: boolean;
  };
  pediatric: {
    dehydration: boolean;
    feverRisk: boolean;
    lethargy: boolean;
  };
}

export interface NewsResult {
  score: number;
  riskText: string;
  riskClass: 'low' | 'medium' | 'high';
}

export interface ProtocolDefinition {
  name: string;
  criteria: string[];
}

export interface ProtocolAlert {
  type: string;
  triggered: boolean;
  reason: string[];
}

export interface Symptom {
  id: string;
  label: string;
}

export interface SheetRowData {
  systemTimestamp?: string;
  evaluationDate: string;
  evaluationTime: string;
  name: string;
  medicalRecord: string;
  isReevaluation: string;
  age: string;
  complaint: string;
  esiLevel: number;
  triageTitle: string;
  discriminators?: string;
  status?: string;
  // Adicionando dob para evitar erros de tipo no Dashboard
  dob?: string;
  vitals?: {
    pa: string;
    fc: string;
    fr: string;
    temp: string;
    spo2: string;
    pain: string;
  };
}

export interface InternationSheetRowData {
  systemTimestamp: string;
  evaluationDate: string;
  evaluationTime: string;
  name: string;
  medicalRecord: string;
  sector: string;
  bed: string;
  isReevaluation?: string;
  newsScore: string;
  riskText: string;
  observations: string;
  status?: string;
  // Adicionando dob para evitar erros de tipo no Dashboard
  dob?: string;
  vitals?: {
      pas: string; pad: string; fc: string; fr: string; 
      temp: string; spo2: string; consciousness: string; 
      o2Sup: string; painLevel: string;
  }
}

export interface PatientHistory {
  lastDate: string;
  lastTime: string;
  lastEsi: number;
  lastComplaint: string;
  name?: string;
  ageString?: string;
  dob?: string;
  lastVitals: {
    pa: string;
    fc: string;
    fr: string;
    temp: string;
    spo2: string;
    gcs: string;
    pain: string;
  };
}
