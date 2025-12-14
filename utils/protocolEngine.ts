import { VitalSigns, ProtocolAlert } from '../types';

export const evaluateProtocols = (
  vitals: VitalSigns,
  selectedSymptoms: string[] // IDs dos sintomas selecionados (ex: 'neuro_rima', 'sca_a_tipica')
): ProtocolAlert[] => {
  const alerts: ProtocolAlert[] = [];

  // --- 1. PROTOCOLO DE AVC ---
  // Gatilho: Qualquer sintoma neuro_* selecionado
  const avcSymptoms = selectedSymptoms.filter(id => id.startsWith('neuro_'));
  
  // Mapeamento para textos legíveis
  const avcReasonMap: Record<string, string> = {
      'neuro_cefaleia': 'Cefaleia Súbita',
      'neuro_rima': 'Desvio de Rima Labial',
      'neuro_vertigem': 'Vertigem Súbita',
      'neuro_forca': 'Perda de Força',
      'neuro_fala': 'Alteração de Fala',
      'neuro_visual': 'Alteração Visual',
      'neuro_marcha': 'Alt. Marcha',
      'neuro_consciencia': 'Rebaixamento Consciência'
  };

  if (avcSymptoms.length > 0) {
    alerts.push({
      type: 'avc',
      triggered: true,
      reason: avcSymptoms.map(id => avcReasonMap[id] || 'Sintoma Neurológico Agudo')
    });
  }

  // --- 2. PROTOCOLO DE DOR TORÁCICA (SCA) ---
  const groupA = selectedSymptoms.filter(id => id.startsWith('sca_a_'));
  const groupB = selectedSymptoms.filter(id => id.startsWith('sca_b_'));
  const groupC = selectedSymptoms.filter(id => id.startsWith('sca_c_'));

  // Mapeamento de sintomas SCA para exibição no card
  const scaReasonMap: Record<string, string> = {
    'sca_a_tipica': 'Dor Torácica Típica (A)',
    'sca_a_bracos': 'Irradiação Braços (A)',
    'sca_a_pescoco': 'Irradiação Pescoço (A)',
    'sca_b_estomago': 'Dor Estômago (B)',
    'sca_b_costas': 'Dor Costas (B)',
    'sca_c_dispneia': 'Falta de Ar (C)',
    'sca_c_sudorese': 'Suor Frio (C)',
    'sca_c_palpitacao': 'Palpitação (C)',
    'sca_c_malsubito': 'Mal Súbito (C)'
  };

  let dtTriggered = false;
  let dtReason: string[] = [];

  // Regra: (>=1 Grupo A) OU (>=1 Grupo B E >=1 Grupo C)
  if (groupA.length > 0) {
    dtTriggered = true;
  } else if (groupB.length > 0 && groupC.length > 0) {
    dtTriggered = true;
  }

  if (dtTriggered) {
    // Coleta todos os sintomas selecionados de SCA para exibir no card
    const allScaSymptoms = [...groupA, ...groupB, ...groupC];
    dtReason = allScaSymptoms.map(id => scaReasonMap[id] || id);

    alerts.push({
      type: 'dorToracica',
      triggered: true,
      reason: dtReason
    });
  }

  // --- 3. PROTOCOLO DE SEPSE ---
  // Critérios Numéricos
  // Substitui vírgula por ponto para parsear corretamente
  const temp = parseFloat(vitals.temp.replace(',', '.')) || 0;
  const fc = parseInt(vitals.fc) || 0;
  const fr = parseInt(vitals.fr) || 0;
  const pas = parseInt(vitals.pas) || 0;
  const spo2 = parseInt(vitals.spo2) || 0;
  
  const hasInfection = selectedSymptoms.includes('inf_infeccao');
  const hasOliguria = selectedSymptoms.includes('inf_oliguria');
  const alteredMental = vitals.consciousness !== 'Alert'; // Confused, Pain, Unresponsive

  // Definição SIRS (>= 2 critérios)
  // Temp >= 37.8 ou < 35
  // FC > 90
  // FR > 20
  let sirsCount = 0;
  const sirsReasons: string[] = [];

  if (temp > 0 && (temp >= 37.8 || temp < 35.0)) { 
    sirsCount++; 
    sirsReasons.push(`Temp ${temp}ºC`); 
  }
  if (fc > 90) { 
    sirsCount++; 
    sirsReasons.push(`FC ${fc} bpm`); 
  }
  if (fr > 20) { 
    sirsCount++; 
    sirsReasons.push(`FR ${fr} irpm`); 
  }

  // Definição DISFUNÇÃO (>= 1 critério)
  // PAS < 90
  // SpO2 < 94 ou O2 Sup
  // Alt. Consciência
  // Oligúria
  let dysfunctionFound = false;
  const dysfunctionReasons: string[] = [];

  if (pas > 0 && pas < 90) { 
    dysfunctionFound = true; 
    dysfunctionReasons.push(`PAS ${pas} (<90)`); 
  }
  if ((spo2 > 0 && spo2 < 94) || vitals.o2Sup) { 
    dysfunctionFound = true; 
    dysfunctionReasons.push(`SpO2 ${spo2}% / O2 Sup`); 
  }
  if (alteredMental) { 
    dysfunctionFound = true; 
    dysfunctionReasons.push('Alt. Consciência'); 
  }
  if (hasOliguria) { 
    dysfunctionFound = true; 
    dysfunctionReasons.push('Oligúria'); 
  }

  // Gatilhos de SEPSE
  let sepseTriggered = false;
  const sepseFinalReason: string[] = [];

  // 1. Infecção + (SIRS >= 2 OU Disfunção >= 1)
  if (hasInfection && (sirsCount >= 2 || dysfunctionFound)) {
      sepseTriggered = true;
      sepseFinalReason.push("Infecção + Critérios Clínicos");
  }
  // 2. SIRS >= 2 + Alt. Consciência (Segurança)
  else if (sirsCount >= 2 && alteredMental) {
      sepseTriggered = true;
      sepseFinalReason.push("SIRS + Alt. Consciência (Suspeita Séptica)");
  }
  // 3. SIRS >= 2 + O2 Suplementar (Segurança)
  else if (sirsCount >= 2 && vitals.o2Sup) {
      sepseTriggered = true;
      sepseFinalReason.push("SIRS + O2 Suplementar (Suspeita Séptica)");
  }

  if (sepseTriggered) {
      if (hasInfection) sepseFinalReason.push("Infecção Suspeita/Confirmada");
      if (sirsCount >= 2) sepseFinalReason.push(`SIRS: ${sirsReasons.join(', ')}`);
      if (dysfunctionFound) sepseFinalReason.push(`Disfunção: ${dysfunctionReasons.join(', ')}`);

      alerts.push({
          type: 'sepse',
          triggered: true,
          reason: sepseFinalReason
      });
  }

  // --- 4. PROTOCOLO DE DOR INTENSA ---
  // Regra 1: Dor >= 8
  const painVal = typeof vitals.painLevel === 'number' ? vitals.painLevel : -1;
  const pad = parseInt(vitals.pad) || 0;

  if (painVal >= 8) {
    alerts.push({
      type: 'dor',
      triggered: true,
      reason: [`Dor Intensa (Nível ${painVal})`]
    });
  } 
  // Regra 2: Dor == 7 E Alteração SSVV
  // PAS > 150, PAD > 95, SpO2 < 94, FC > 90, FR > 22
  else if (painVal === 7) {
    const alterations: string[] = [];
    if (pas > 150) alterations.push(`PAS ${pas}`);
    if (pad > 95) alterations.push(`PAD ${pad}`);
    if (spo2 > 0 && spo2 < 94) alterations.push(`SpO2 ${spo2}%`);
    if (fc > 90) alterations.push(`FC ${fc}`);
    if (fr > 22) alterations.push(`FR ${fr}`);

    if (alterations.length > 0) {
      alerts.push({
        type: 'dor',
        triggered: true,
        reason: [`Dor 7 + Alteração Vital: ${alterations.join(', ')}`]
      });
    }
  }

  return alerts;
};