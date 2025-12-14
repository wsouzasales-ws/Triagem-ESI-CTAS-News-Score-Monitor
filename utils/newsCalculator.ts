import { VitalSigns, NewsResult } from '../types';

export const calculateNEWS = (vitals: VitalSigns): NewsResult => {
  let score = 0;
  let hasRedScore = false; // Parâmetro individual com pontuação 3

  const pas = parseInt(vitals.pas) || 0;
  const fc = parseInt(vitals.fc) || 0;
  const fr = parseInt(vitals.fr) || 0;
  // Substitui vírgula por ponto para parsear corretamente
  const temp = parseFloat(vitals.temp.replace(',', '.')) || 0;
  const spo2 = parseInt(vitals.spo2) || 0;
  
  // Se não houver dados preenchidos, retorna estado inicial
  if (!vitals.pas && !vitals.fc && !vitals.fr) {
    return { score: 0, riskText: 'AGUARDANDO DADOS', riskClass: 'low' };
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
  // Conforme imagem HPM PC020:
  // <= 40 (3) | 41-50 (2) | 51-90 (1) | 91-110 (0) | 111-130 (1) | >= 131 (3)
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
  // Alerta(0), Confuso(1), Resp. Dor(2), Inconsciente(3)
  if (vitals.consciousness === 'Confused') { // Confuso
    score += 1;
  } else if (vitals.consciousness === 'Pain') { // Resp. Dor
    score += 2;
  } else if (vitals.consciousness === 'Unresponsive') { // Inconsciente
    score += 3;
    hasRedScore = true;
  }
  // 'Alert' = 0

  // --- 7. O2 Suplementar ---
  // Conforme imagem HPM PC020: "Sim" está na coluna 1 (Amarelo).
  if (vitals.o2Sup) score += 1;


  // --- INTERPRETAÇÃO ---
  // Pontuação >= 5 ou qualquer parâmetro com 3 gera alerta.
  let riskText = "SEM DETERIORAÇÃO CLÍNICA";
  let riskClass: 'low' | 'medium' | 'high' = 'low';

  if (score >= 5 || hasRedScore) {
    riskText = "POSSÍVEL DETERIORAÇÃO CLÍNICA";
    riskClass = 'high';
  } else if (score > 0) {
    // Definindo um intermediário apenas para visualização
    riskText = "MONITORAR (SCORE BAIXO)";
    riskClass = 'medium';
  }

  return { score, riskText, riskClass };
};