import { VitalSigns, NewsResult } from '../types';

export interface NewsResultExtended extends NewsResult {
  conduct: string;
}

export const calculateNEWS = (vitals: VitalSigns): NewsResultExtended => {
  let score = 0;
  let hasRedScore = false; // Parâmetro individual com pontuação 3

  const pas = parseInt(vitals.pas) || 0;
  const fc = parseInt(vitals.fc) || 0;
  const fr = parseInt(vitals.fr) || 0;
  const temp = parseFloat(vitals.temp.replace(',', '.')) || 0;
  const spo2 = parseInt(vitals.spo2) || 0;
  
  // Se não houver dados preenchidos, retorna estado inicial
  if (!vitals.pas && !vitals.fc && !vitals.fr) {
    return { score: 0, riskText: 'AGUARDANDO DADOS', riskClass: 'low', conduct: 'Aferir SSVV a cada 12 Horas' };
  }

  // --- 1. Pressão Sistólica (PAS) ---
  if (pas > 0) {
      if (pas <= 90) { score += 3; hasRedScore = true; }
      else if (pas >= 91 && pas <= 100) score += 2;
      else if (pas >= 101 && pas <= 110) score += 1;
      else if (pas >= 111 && pas <= 219) score += 0;
      else if (pas >= 220) { score += 3; hasRedScore = true; }
  }

  // --- 2. Frequência Cardíaca (FC) ---
  if (fc > 0) {
      if (fc <= 40) { score += 3; hasRedScore = true; }
      else if (fc >= 41 && fc <= 50) score += 2;
      else if (fc >= 51 && fc <= 90) score += 1;
      else if (fc >= 91 && fc <= 110) score += 0;
      else if (fc >= 111 && fc <= 130) score += 1;
      else if (fc >= 131) { score += 3; hasRedScore = true; }
  }

  // --- 3. Frequência Respiratória (FR) ---
  if (fr > 0) {
      if (fr <= 8) { score += 3; hasRedScore = true; }
      else if (fr >= 9 && fr <= 11) score += 1;
      else if (fr >= 12 && fr <= 20) score += 0;
      else if (fr >= 21 && fr <= 24) score += 2;
      else if (fr >= 25) { score += 3; hasRedScore = true; }
  }

  // --- 4. Temperatura ---
  if (temp > 0) {
      if (temp <= 35.0) { score += 3; hasRedScore = true; }
      else if (temp >= 35.1 && temp <= 36.0) score += 1;
      else if (temp >= 36.1 && temp <= 38.0) score += 0;
      else if (temp >= 38.1 && temp <= 39.0) score += 1;
      else if (temp >= 39.1) score += 2;
  }

  // --- 5. SpO2 ---
  if (spo2 > 0) {
      if (spo2 <= 91) { score += 3; hasRedScore = true; }
      else if (spo2 >= 92 && spo2 <= 93) score += 2;
      else if (spo2 >= 94 && spo2 <= 95) score += 1;
      else if (spo2 >= 96) score += 0;
  }

  // --- 6. Consciência ---
  if (vitals.consciousness === 'Confused') score += 1;
  else if (vitals.consciousness === 'Pain') score += 2;
  else if (vitals.consciousness === 'Unresponsive') { score += 3; hasRedScore = true; }

  // --- 7. O2 Suplementar ---
  if (vitals.o2Sup) score += 1;

  // --- INTERPRETAÇÃO E CONDUTA ---
  let riskText = "SEM DETERIORAÇÃO CLÍNICA";
  let riskClass: 'low' | 'medium' | 'high' = 'low';
  let conduct = "Aferir SSVV a cada 12 Horas";

  if (score === 0) {
      conduct = "Aferir SSVV a cada 12 Horas";
  } else if (score >= 1 && score <= 4) {
      riskText = "MONITORAR (SCORE BAIXO)";
      riskClass = 'medium';
      conduct = "Aferir SSVV a cada 4-6 Horas";
  }

  if (score >= 5 || hasRedScore) {
    riskText = "POSSÍVEL DETERIORAÇÃO CLÍNICA";
    riskClass = 'high';
    conduct = "Aferir SSVV a cada 1 Hora e Acionar Equipe Médica";
  }

  if (score >= 7) {
    conduct = "Monitoramento Contínuo e Acionamento de Resposta Rápida";
  }

  return { score, riskText, riskClass, conduct };
};