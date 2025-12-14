
import { Symptom } from './types';

// Limites de Sinais Vitais para CTAS (Baseado no PDF Pág 9 e 16 e Print fornecido)
export const VITALS_THRESHOLDS = {
  adult: {
    fc: { min: 50, max: 130 },
    fr: { min: 10, max: 30 },
    pas: { min: 90 }, // Sistólica Mínima
    spo2: { min: 92 }
  },
  // Faixas etárias baseadas na imagem fornecida
  pediatric: [
    { maxAgeMonths: 12, maxFc: 160, minFc: 100, maxFr: 50, label: 'Lactente (1-12 meses)' },
    { maxAgeMonths: 36, maxFc: 150, minFc: 90, maxFr: 30, label: 'Pré-escolar (1-3 anos)' },
    { maxAgeMonths: 144, maxFc: 120, minFc: 70, maxFr: 20, label: 'Escolar (6-12 anos)' },
    { maxAgeMonths: 216, maxFc: 130, minFc: 50, maxFr: 30, label: 'Adolescente (12-18 anos)' }
  ]
};

export const ESI_DESCRIPTIONS = {
  1: { title: 'ESI 1 - RESSUSCITAÇÃO', color: 'bg-red-600', wait: 'IMEDIATO' },
  2: { title: 'ESI 2 - EMERGÊNCIA', color: 'bg-orange-500', wait: '≤ 10 minutos' },
  3: { title: 'ESI 3 - URGÊNCIA', color: 'bg-yellow-400', wait: '≤ 30 minutos' },
  4: { title: 'ESI 4 - MENOS URGENTE', color: 'bg-green-600', wait: '≤ 60 minutos' },
  5: { title: 'ESI 5 - NÃO URGENTE', color: 'bg-blue-500', wait: '≤ 120 minutos' }
};

export const RESOURCES_EXAMPLES = [
  "NENHUM: Consulta, Receita, Atestado",
  "UM: 1 Exame (Raio-X), 1 Medicação VO/IM",
  "DOIS OU MAIS: Exames Lab + Imagem, Medicação IV, Procedimentos"
];

export const SYMPTOMS_AVC: Symptom[] = [
  { id: 'avc_face', label: 'Assimetria Facial' },
  { id: 'avc_arm', label: 'Fraqueza em Braço/Perna' },
  { id: 'avc_speech', label: 'Fala Anormal' },
  { id: 'avc_visual', label: 'Alteração Visual Súbita' }
];

export const SYMPTOMS_DT_GROUP_A: Symptom[] = [
  { id: 'dt_retro', label: 'Dor Retroesternal' },
  { id: 'dt_precordial', label: 'Dor Precordial Opressiva' },
  { id: 'dt_radiation', label: 'Irradiação para MSE/Mandíbula' }
];

export const SYMPTOMS_DT_GROUP_B: Symptom[] = [
  { id: 'dt_sweat', label: 'Sudorese Fria' },
  { id: 'dt_nausea', label: 'Náuseas/Vômitos' },
  { id: 'dt_dyspnea', label: 'Dispneia' }
];

export const SYMPTOMS_DT_GROUP_C: Symptom[] = [
  { id: 'dt_risk_age', label: 'Idade > 55 (H) ou > 65 (M)' },
  { id: 'dt_risk_comorb', label: 'Comorbidades (DM, HAS, Tabagismo)' }
];

export const CHECKLIST_SEPSE: Symptom[] = [
  { id: 'sepse_infeccao', label: 'Foco Infeccioso Suspeito/Confirmado' },
  { id: 'sepse_diurese', label: 'Oligúria (Diurese reduzida)' },
  { id: 'sepse_mental', label: 'Alteração do Estado Mental' }
];
