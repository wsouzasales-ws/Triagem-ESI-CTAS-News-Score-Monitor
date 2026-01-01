

export interface VitalSigns {
  pas: string; // Pressão Arterial Sistólica
  pad: string; // Pressão Arterial Diastólica
  fc: string; // Frequência Cardíaca
  fr: string; // Frequência Respiratória
  temp: string; // Temperatura
  spo2: string; // Saturação O2
  gcs: number; // Glasgow Coma Scale (3-15)
  painLevel: number | ''; // Escala de Dor 0-10
  o2Sup?: boolean; // Suporte de O2
  consciousness?: 'Alert' | 'Confused' | 'Pain' | 'Unresponsive'; // Nível de Consciência
}

export interface PatientData {
  name: string;
  medicalRecord: string; // Nº Prontuário
  dob: string; // Date of Birth
  age: number; // Idade calculada em anos (ou meses se < 1 ano, tratado na lógica)
  ageUnit: 'years' | 'months';
  gender: 'M' | 'F';
  complaint: string; // Queixa principal
  serviceTimestamp: string; // Timestamp de exibição (mantido para compatibilidade)
  evaluationDate: string; // Data da Avaliação (Manual/Retroativa)
  evaluationTime: string; // Hora da Avaliação (Manual/Retroativa)
  isReevaluation: boolean; // Indica se é uma reavaliação
  reevaluationDate?: string; // Data da Reavaliação (Novo)
  reevaluationTime?: string; // Hora da Reavaliação (Novo)
  sector?: string; // Novo: Setor (Internação)
  bed?: string; // Novo: Leito (Internação)
}

export type EsiLevel = 1 | 2 | 3 | 4 | 5;

export interface TriageResult {
  level: EsiLevel;
  color: string;
  title: string;
  maxWaitTime: string;
  justification: string[]; // Lista de razões para a classificação
  discriminators: string[]; // Discriminadores CTAS positivos
}

// Discriminadores baseados no PDF
export interface CtasDiscriminators {
  abcUnstable: boolean; // Etapa 1: Ameaça à vida
  highRiskSituation: boolean; // Etapa 2: Situação de Alto Risco (ESI)
  resources: 'none' | 'one' | 'many'; // Etapa 2: Recursos
  
  // Etapa 3: Discriminadores CTAS
  neuro: {
    gcsLow: boolean; // GCS < 14
    acuteConfusion: boolean; // Delirium / Mudança comportamento
    headTrauma: boolean; // Trauma cranio recente
    severeHeadache: boolean; // Cefaleia súbita intensa
  };
  sepsis: {
    suspectedInfection: boolean;
    immunosuppressed: boolean; // Febre + Imuno
    perfursionIssues: boolean; // Extremidades frias/Pele moteada
  };
  cardio: {
    chestPainRisk: boolean; // Dor torácica + Fatores risco/Idade
    severePainWithVitals: boolean; // Dor >= 7 + SSVV anormais
  };
  respiratory: {
    dyspneaRisk: boolean; // Dispneia idoso/DPOC
    respiratoryDistress: boolean; // Tiragem, batimento asa nasal (Pediatria)
  };
  pediatric: {
    dehydration: boolean; // Fontanela deprimida, sem lagrimas
    feverRisk: boolean; // Febre em < 3 meses ou Petéquias
    lethargy: boolean; // Hipoativo/Irritado
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

// Tipos para o Histórico e Relatórios
export interface SheetRowData {
  systemTimestamp?: string; // Novo: Data real do registro (Coluna A)
  evaluationDate: string;
  evaluationTime: string;
  name: string;
  medicalRecord: string;
  isReevaluation: string;
  age: string;
  complaint: string;
  esiLevel: number;
  triageTitle: string;
  discriminators?: string; // Coluna T (Index 19)
  status?: string; // Novo: Controle de Invalidação
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
  status?: string; // Novo: Controle de Invalidação
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
  name?: string; // Novo: Recuperar nome
  ageString?: string; // Novo: Recuperar idade salva
  dob?: string; // Novo: Recuperar data nascimento
  // Sinais Vitais Anteriores
  lastVitals: {
    pa: string; // PASxPAD
    fc: string;
    fr: string;
    temp: string;
    spo2: string;
    gcs: string;
    pain: string;
  };
}