import { VitalSigns, NewsResult } from '../types';

export interface NewsResultExtended extends NewsResult {
  conduct: string;
  isNEWS2?: boolean;
}

export const calculateNEWS = (vitals: VitalSigns): NewsResultExtended => {
  let score = 0;
  let hasRedScore = false; // Parâmetro individual com pontuação 3 (Escore Vermelho)

  const pas = parseInt(vitals.pas) || 0;
  const fc = parseInt(vitals.fc) || 0;
  const fr = parseInt(vitals.fr) || 0;
  const temp = parseFloat(vitals.temp.replace(',', '.')) || 0;
  const spo2 = parseInt(vitals.spo2) || 0;
  const isCopd = !!vitals.isCopd; // Escala 2 do NEWS 2 (DPOC / Insuficiência Respiratória Hipercápnica)
  const o2Sup = !!vitals.o2Sup;
  
  // Se não houver dados essenciais preenchidos, retorna estado inicial
  if (!vitals.pas && !vitals.fc && !vitals.fr && !vitals.temp && !vitals.spo2) {
    return { score: 0, riskText: 'AGUARDANDO DADOS (NEWS 2)', riskClass: 'low', conduct: 'Aferir SSVV a cada 12 Horas', isNEWS2: true };
  }

  // --- 1. Frequência Respiratória (FR) ---
  if (fr > 0) {
      if (fr <= 8) { score += 3; hasRedScore = true; }
      else if (fr >= 9 && fr <= 11) score += 1;
      else if (fr >= 12 && fr <= 20) score += 0;
      else if (fr >= 21 && fr <= 24) score += 2;
      else if (fr >= 25) { score += 3; hasRedScore = true; }
  }

  // --- 2. Saturação de Oxigênio (SpO2) - NEWS 2 Escala 1 vs Escala 2 ---
  if (spo2 > 0) {
      if (isCopd) {
          // Escala 2 de SpO2 do NEWS 2 (Pacientes com Alvo de SpO2 88-92% / DPOC / Hipercápnicos)
          if (spo2 <= 83) { score += 3; hasRedScore = true; }
          else if (spo2 >= 84 && spo2 <= 85) score += 2;
          else if (spo2 >= 86 && spo2 <= 87) score += 1;
          else if (spo2 >= 88 && spo2 <= 92) score += 0;
          else if (spo2 >= 93 && spo2 <= 94) {
              score += o2Sup ? 1 : 0;
          }
          else if (spo2 >= 95 && spo2 <= 96) {
              score += o2Sup ? 2 : 0;
          }
          else if (spo2 >= 97) {
              if (o2Sup) { score += 3; hasRedScore = true; }
              else score += 0;
          }
      } else {
          // Escala 1 de SpO2 do NEWS 2 (Padrão)
          if (spo2 <= 91) { score += 3; hasRedScore = true; }
          else if (spo2 >= 92 && spo2 <= 93) score += 2;
          else if (spo2 >= 94 && spo2 <= 95) score += 1;
          else if (spo2 >= 96) score += 0;
      }
  }

  // --- 3. O2 Suplementar (Air or Oxygen) ---
  // No NEWS 2: Ar Ambiente = 0, O2 Suplementar = 2 pontos
  if (o2Sup) {
      score += 2;
  }

  // --- 4. Pressão Arterial Sistólica (PAS) ---
  if (pas > 0) {
      if (pas <= 90) { score += 3; hasRedScore = true; }
      else if (pas >= 91 && pas <= 100) score += 2;
      else if (pas >= 101 && pas <= 110) score += 1;
      else if (pas >= 111 && pas <= 219) score += 0;
      else if (pas >= 220) { score += 3; hasRedScore = true; }
  }

  // --- 5. Frequência Cardíaca (FC) ---
  if (fc > 0) {
      if (fc <= 40) { score += 3; hasRedScore = true; }
      else if (fc >= 41 && fc <= 50) score += 1; // No NEWS 2: FC 41-50 bpm = 1 ponto
      else if (fc >= 51 && fc <= 90) score += 0;
      else if (fc >= 91 && fc <= 110) score += 1;
      else if (fc >= 111 && fc <= 130) score += 2;
      else if (fc >= 131) { score += 3; hasRedScore = true; }
  }

  // --- 6. Consciência (Escala ACVPU do NEWS 2) ---
  // A = Alerta (0)
  // C = Nova Confusão Mental (3)
  // V = Responde à Voz (3)
  // P = Responde à Dor (3)
  // U = Inconsciente (3)
  if (vitals.consciousness && vitals.consciousness !== 'Alert') {
      score += 3;
      hasRedScore = true;
  }

  // --- 7. Temperatura ---
  if (temp > 0) {
      if (temp <= 35.0) { score += 3; hasRedScore = true; }
      else if (temp >= 35.1 && temp <= 36.0) score += 1;
      else if (temp >= 36.1 && temp <= 38.0) score += 0;
      else if (temp >= 38.1 && temp <= 39.0) score += 1;
      else if (temp >= 39.1) score += 2;
  }

  // --- INTERPRETAÇÃO E CONDUTA CONFORME PROTOCOLO NEWS 2 (RCP 2017) ---
  let riskText = "RISCO BAIXO";
  let riskClass: 'low' | 'medium' | 'high' = 'low';
  let conduct = "Aferir SSVV a cada 12 Horas";

  if (score === 0) {
      riskText = "RISCO BAIXO (SCORE 0)";
      riskClass = 'low';
      conduct = "Aferir SSVV a cada 12 Horas";
  } else if (score >= 1 && score <= 4) {
      if (hasRedScore) {
          riskText = "RISCO BAIXO-MÉDIO (SCORE VERMELHO INDIVIDUAL)";
          riskClass = 'medium';
          conduct = "Aferir SSVV a cada 1 Hora e Avaliação Urgente por Enfermeiro/Equipe Médica";
      } else {
          riskText = "RISCO BAIXO (SCORE 1-4)";
          riskClass = 'medium';
          conduct = "Aferir SSVV a cada 4-6 Horas";
      }
  } else if (score === 5 || score === 6) {
      riskText = "RISCO MÉDIO (SCORE 5-6)";
      riskClass = 'high';
      conduct = "Aferir SSVV a cada 1 Hora e Acionamento Urgente da Equipe Médica";
  } else if (score >= 7) {
      riskText = "RISCO ALTO (SCORE ≥ 7)";
      riskClass = 'high';
      conduct = "Monitoramento Contínuo e Acionamento Imediato da Equipe de Resposta Rápida (ERR)";
  }

  return { score, riskText, riskClass, conduct, isNEWS2: true };
};
