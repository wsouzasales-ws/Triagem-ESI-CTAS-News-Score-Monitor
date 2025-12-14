
import { VitalSigns, PatientData, CtasDiscriminators, TriageResult } from '../types';
import { VITALS_THRESHOLDS, ESI_DESCRIPTIONS } from '../constants';

export const calculateTriage = (
  patient: PatientData,
  vitals: VitalSigns,
  discriminators: CtasDiscriminators
): TriageResult => {
  const justification: string[] = [];
  const positiveDiscriminators: string[] = [];
  let esiLevel: 1 | 2 | 3 | 4 | 5 = 5; // Default start

  // --- ETAPA 1: AVALIAÇÃO ABC (ESI 1) ---
  if (discriminators.abcUnstable) {
    justification.push("Instabilidade ABC (Via aérea/Respiração/Circulação) ou Risco Iminente de Morte.");
    return buildResult(1, justification, ["Instabilidade ABC"]);
  }
  
  // Checagem automática de sinais vitais extremos (Compatível com ESI 1/CTAS 1)
  const spo2 = parseInt(vitals.spo2) || 100;
  if (spo2 < 85) { // PDF Pag 6
    justification.push(`SpO2 Crítica (${spo2}%)`);
    return buildResult(1, justification, ["Hipóxia Grave"]);
  }


  // --- ETAPA 2: ALGORITMO ESI BASE (Definição Inicial) ---
  
  // 2.1 Situação de Alto Risco?
  if (discriminators.highRiskSituation) {
    esiLevel = 2;
    justification.push("Situação de Alto Risco identificada (Critério subjetivo/clínico).");
  } else {
    // 2.2 Recursos
    switch (discriminators.resources) {
      case 'many':
        esiLevel = 3;
        justification.push("Necessidade de ≥ 2 Recursos.");
        break;
      case 'one':
        esiLevel = 4;
        justification.push("Necessidade de 1 Recurso.");
        break;
      case 'none':
        esiLevel = 5;
        justification.push("Nenhum recurso previsto.");
        break;
    }
  }

  // --- ETAPA 3: DISCRIMINADORES CTAS (Hibridização) ---
  // Se qualquer discriminador for positivo -> Reclassifica para ESI 2 (Se já não for 1)
  
  let ctasPositive = false;

  // 3.1 Sinais Vitais Críticos (Adulto e Pediátrico)
  const fc = parseInt(vitals.fc) || 0;
  const fr = parseInt(vitals.fr) || 0;
  const pas = parseInt(vitals.pas) || 0;
  const temp = parseFloat(vitals.temp.replace(',', '.')) || 0;

  // Lógica Pediátrica vs Adulto
  let isPediatric = patient.age < 18; // Assumindo anos na interface principal, mas tratando meses internamente
  let vitalAlert = false;
  
  if (!isPediatric) {
    // Adultos (Pag 9 PDF)
    if (fc > 130 || fc < 50) { vitalAlert = true; positiveDiscriminators.push(`FC Crítica (${fc})`); }
    if (fr > 30 || fr < 10) { vitalAlert = true; positiveDiscriminators.push(`FR Crítica (${fr})`); }
    if (pas > 0 && pas < 90) { vitalAlert = true; positiveDiscriminators.push(`PAS Crítica (${pas})`); }
    if (spo2 < 92) { vitalAlert = true; positiveDiscriminators.push(`SpO2 Crítica (${spo2}%)`); }
  } else {
    // Pediatria (Lógica simplificada baseada nas faixas do PDF)
    const ageMonths = patient.ageUnit === 'months' ? patient.age : patient.age * 12;
    const rules = VITALS_THRESHOLDS.pediatric.find(r => ageMonths <= r.maxAgeMonths) || VITALS_THRESHOLDS.pediatric[3];
    
    if (fc > rules.maxFc || fc < rules.minFc) { vitalAlert = true; positiveDiscriminators.push(`FC Pediátrica Crítica (${fc})`); }
    if (fr > rules.maxFr) { vitalAlert = true; positiveDiscriminators.push(`FR Pediátrica Crítica (${fr})`); }
  }

  if (vitalAlert) ctasPositive = true;

  // 3.2 Nível de Consciência (GCS < 15 ou Alteração Aguda)
  // Alterado conforme solicitação: Glasgow < 15 já pontua para ESI 2
  if (vitals.gcs < 15) {
    ctasPositive = true;
    positiveDiscriminators.push(`Glasgow < 15 (${vitals.gcs})`);
  }
  if (discriminators.neuro.acuteConfusion) {
    ctasPositive = true;
    positiveDiscriminators.push("Alteração Aguda da Consciência / Delírium");
  }
  if (discriminators.neuro.severeHeadache) {
    ctasPositive = true;
    positiveDiscriminators.push("Cefaleia 'Thunderclap' / Súbita Intensa");
  }

  // 3.3 Sepse (SIRS + Infecção ou Imuno)
  // SIRS >= 2 critérios
  let sirsCount = 0;
  if (temp > 38 || temp < 36) sirsCount++;
  if (fc > 90) sirsCount++;
  if (fr > 20) sirsCount++;
  // Leucocitos nao temos aqui, assumimos clínico
  
  if (sirsCount >= 2 && discriminators.sepsis.suspectedInfection) {
    ctasPositive = true;
    positiveDiscriminators.push("Sepse Provável (SIRS + Infecção)");
  }
  if (discriminators.sepsis.immunosuppressed && temp > 38) {
    ctasPositive = true;
    positiveDiscriminators.push("Neutropenia Febril / Imunossupressão");
  }
  if (discriminators.sepsis.perfursionIssues) {
    ctasPositive = true;
    positiveDiscriminators.push("Sinais de Má Perfusão / Sepse Oculta");
  }

  // 3.4 Red Flags (Dor e Queixas)
  const pain = typeof vitals.painLevel === 'number' ? vitals.painLevel : 0;
  
  // REGRA ATUALIZADA: Dor > 7 (8, 9, 10) -> ESI 2 independente de SSVV
  if (pain > 7) { 
     ctasPositive = true;
     positiveDiscriminators.push(`Dor Severa (${pain}/10)`);
  } 
  // Regra antiga para Dor = 7 mantida (precisa de SSVV)
  else if (pain === 7 && vitalAlert) { 
     ctasPositive = true;
     positiveDiscriminators.push("Dor Intensa (7/10) + SSVV Anormais");
  }

  if (discriminators.cardio.chestPainRisk) {
     ctasPositive = true;
     positiveDiscriminators.push("Dor Torácica de Alto Risco");
  }
  // CORREÇÃO: Dispneia em grupo de risco pontua ESI 2 mesmo sem hipóxia atual
  if (discriminators.respiratory.dyspneaRisk) {
     ctasPositive = true;
     positiveDiscriminators.push("Dispneia Moderada (Idoso/DPOC/ICC)");
  }

  // 3.5 Pediatria Específico
  if (discriminators.pediatric.dehydration) {
    ctasPositive = true;
    positiveDiscriminators.push("Desidratação Grave");
  }
  if (discriminators.pediatric.lethargy) {
    ctasPositive = true;
    positiveDiscriminators.push("Letargia / Irritabilidade Pediátrica");
  }
  if (discriminators.pediatric.feverRisk) {
    ctasPositive = true;
    positiveDiscriminators.push("Febre em < 3 meses ou Petéquias");
  }
  if (discriminators.respiratory.respiratoryDistress) {
    ctasPositive = true;
    positiveDiscriminators.push("Desconforto Respiratório Importante");
  }


  // --- ETAPA 4: DECISÃO FINAL ---
  
  if (ctasPositive && esiLevel > 2) {
    esiLevel = 2; // Upgrade mandatório pelo CTAS
    justification.push("Reclassificado para ESI 2 devido a Discriminadores CTAS positivos.");
  }

  // Prepara justificativa final
  if (positiveDiscriminators.length > 0) {
    justification.push(`Discriminadores: ${positiveDiscriminators.join(', ')}`);
  }

  return buildResult(esiLevel, justification, positiveDiscriminators);
};

const buildResult = (level: 1|2|3|4|5, justification: string[], discriminators: string[]): TriageResult => {
  const info = ESI_DESCRIPTIONS[level];
  return {
    level,
    title: info.title,
    color: info.color,
    maxWaitTime: info.wait,
    justification,
    discriminators
  };
};
