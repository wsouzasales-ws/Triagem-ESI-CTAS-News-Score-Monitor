import React from 'react';
import { PatientData, VitalSigns, CtasDiscriminators, TriageResult } from '../types';

interface Props {
  patient: PatientData;
  vitals: VitalSigns;
  triageResult: any; // Pode ser TriageResult ou NewsResult formatado
  discriminators?: CtasDiscriminators;
  source?: 'triage' | 'internation';
}

// Logo 1: Triagem Híbrida (Batimento + Texto)
const TriageHybridLogo = () => (
  <div className="flex items-center gap-2">
    <svg width="35" height="35" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M76.8 256h76.8l51.2-153.6 102.4 307.2 51.2-153.6h76.8" stroke="#e11d48" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <div className="flex flex-col leading-none" style={{ textAlign: 'left' }}>
      <span className="text-[13px] font-black text-slate-800 uppercase tracking-tight">Triagem Híbrida <span className="text-rose-600">ESI + CTAS</span></span>
      <span className="text-[8px] font-bold text-emerald-600 tracking-widest uppercase mt-1">+ NEWS SCORE MONITORAMENTO</span>
    </div>
  </div>
);

// Logo 2: São Mateus Kora Saúde
const SaoMateusLogo = () => (
  <div className="flex items-center gap-2">
    <div className="flex flex-col items-end leading-none" style={{ textAlign: 'right' }}>
      <div className="flex items-center gap-1 mb-0.5">
        <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 80L40 20L60 60L80 20" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M40 20L55 80L70 40" stroke="#be123c" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[16px] font-bold text-[#1e293b] tracking-tight">São Mateus</span>
      </div>
      <span className="text-[9px] text-slate-400 font-medium tracking-widest uppercase">Kora Saúde</span>
    </div>
  </div>
);

export const PrintableReport: React.FC<Props> = ({ patient, vitals, triageResult, discriminators, source = 'triage' }) => {
  const isInternation = source === 'internation';

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    if (dateString.includes('/')) return dateString;
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateString;
  };

  const getBadgeColor = () => {
    if (isInternation) {
        const score = parseInt(triageResult.score) || 0;
        const riskText = (triageResult.riskText || '').toUpperCase();
        if (score >= 5 || riskText.includes('POSSÍVEL')) return '#dc2626'; // Vermelho vivo
        if (score >= 1) return '#eab308'; // Amarelo
        return '#10b981'; // Verde
    }
    // ESI Colors
    switch(triageResult.level) {
      case 1: return '#dc2626';
      case 2: return '#f97316';
      case 3: return '#eab308';
      case 4: return '#10b981';
      case 5: return '#3b82f6';
      default: return '#1e293b';
    }
  };

  return (
    <div className="bg-white text-slate-900 font-sans w-full p-8 block" style={{ backgroundColor: 'white' }}>
      {/* CABEÇALHO */}
      <header className="flex justify-between items-center border-b-2 border-slate-100 pb-4 mb-6">
        <TriageHybridLogo />
        <div className="text-center">
            <h2 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                {isInternation ? 'Relatório NEWS de Internação' : 'Relatório de Classificação ESI'}
            </h2>
            <div className={`h-0.5 w-12 mx-auto ${isInternation ? 'bg-emerald-500' : 'bg-rose-600'}`}></div>
        </div>
        <SaoMateusLogo />
      </header>

      {/* BLOCO: IDENTIFICAÇÃO */}
      <section className="mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-5" style={{ backgroundColor: '#f8fafc' }}>
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isInternation ? 'bg-emerald-500' : 'bg-rose-500'}`}></div> Dados do Paciente
          </h3>
          <div className="grid grid-cols-4 gap-y-4 gap-x-6 text-sm">
            <div className="col-span-2">
              <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Iniciais do Paciente</span>
              <span className="font-black text-xl text-slate-800 tracking-tight">{patient.name || 'NÃO INFORMADO'}</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Nº Prontuário</span>
              <span className="font-mono font-black text-xl text-slate-800">{patient.medicalRecord || '---'}</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Avaliado em:</span>
              <span className="font-bold text-slate-700">{formatDate(patient.evaluationDate)} <span className="text-teal-600 ml-1">{patient.evaluationTime}</span></span>
            </div>
            {isInternation ? (
                <>
                    <div className="col-span-2">
                        <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Unidade / Setor</span>
                        <span className="font-black text-slate-700 uppercase">{patient.sector || '-'}</span>
                    </div>
                    <div>
                        <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Leito</span>
                        <span className="font-black text-slate-700">{patient.bed || '-'}</span>
                    </div>
                    {patient.dob && (
                        <div>
                            <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Data Nasc.</span>
                            <span className="font-bold text-slate-700">{formatDate(patient.dob)}</span>
                        </div>
                    )}
                </>
            ) : (
                <>
                    <div>
                        <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Data Nasc.</span>
                        <span className="font-bold text-slate-700">{formatDate(patient.dob)}</span>
                    </div>
                    <div>
                        <span className="block text-[9px] text-slate-400 uppercase font-bold mb-0.5">Idade</span>
                        <span className="font-bold text-slate-700">{patient.age} {patient.ageUnit === 'months' ? 'meses' : 'anos'}</span>
                    </div>
                    <div className="col-span-1"></div>
                </>
            )}
          </div>
        </div>
      </section>

      {/* BLOCO: SINAIS VITAIS */}
      <section className="mb-6 grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div> Parâmetros Vitais
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100">PA: <strong className="text-slate-900 text-base">{vitals.pas || '-'} x {vitals.pad || '-'}</strong> <span className="text-[9px] text-slate-400">mmHg</span></div>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100">FC: <strong className="text-slate-900 text-base">{vitals.fc || '-'}</strong> <span className="text-[9px] text-slate-400">bpm</span></div>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100">FR: <strong className="text-slate-900 text-base">{vitals.fr || '-'}</strong> <span className="text-[9px] text-slate-400">irpm</span></div>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100">Temp: <strong className="text-slate-900 text-base">{vitals.temp || '-'}</strong> <span className="text-[9px] text-slate-400">°C</span></div>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100">SpO2: <strong className="text-slate-900 text-base">{vitals.spo2 || '-'}</strong> <span className="text-[9px] text-slate-400">%</span></div>
            <div className="bg-slate-50 p-2.5 rounded border border-slate-100">Dor: <strong className="text-slate-900 text-base">{vitals.painLevel ?? '-'}</strong> <span className="text-[9px] text-slate-400">/10</span></div>
            
            <div className="col-span-2 bg-slate-100 p-2.5 rounded flex justify-between items-center border border-slate-200">
              <span className="uppercase font-black text-[9px] text-slate-500">
                {isInternation ? 'Oxigênio Suplementar:' : 'Escala de Glasgow:'}
              </span>
              <strong className="text-xl text-slate-900">
                {isInternation ? (vitals.o2Sup ? 'SIM' : 'NÃO') : (vitals.gcs || 15)}
              </strong>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div> Observações do Profissional
          </h3>
          <div className="p-2 min-h-[140px] text-sm text-slate-700 italic leading-relaxed bg-slate-50/50 rounded border border-dashed border-slate-200">
            {isInternation ? (patient.complaint || 'Nenhuma observação registrada.') : (patient.complaint || 'Nenhuma queixa registrada.')}
          </div>
        </div>
      </section>

      {/* BLOCO: RESULTADO FINAL (NEWS / ESI) */}
      <section className="mb-8">
        <div className="bg-slate-900 rounded-2xl p-8 text-center shadow-xl relative overflow-hidden" style={{ backgroundColor: '#0f172a' }}>
          {/* Decoração de fundo */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
          
          <h3 className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] mb-6">
            {isInternation ? 'Escore NEWS (Deterioração Clínica)' : 'Classificação de Risco Institucional'}
          </h3>
          
          <div className="flex flex-col items-center justify-center gap-4">
              <div 
                className={`inline-flex items-center justify-center px-12 py-5 rounded-xl text-white font-black shadow-2xl border-4 border-white/20`}
                style={{ backgroundColor: getBadgeColor(), fontSize: isInternation ? '42px' : '28px', lineHeight: '1' }}
              >
                {isInternation ? `NEWS ${triageResult.score}` : triageResult.title}
              </div>

              <div className="w-full max-w-md bg-white/5 backdrop-blur-md rounded-lg p-4 border border-white/10 mt-2">
                <div className="flex justify-center items-center gap-12 text-white">
                    <div className="text-left border-l-4 border-teal-500 pl-4">
                      <span className="block text-[9px] uppercase font-bold opacity-50 tracking-widest">Status do Risco</span>
                      <span className="text-2xl font-black uppercase tracking-tight">
                        {isInternation ? triageResult.riskText : triageResult.title.split('-')[1]?.trim() || 'ESTÁVEL'}
                      </span>
                    </div>
                    {!isInternation && (
                        <div className="text-left border-l-4 border-rose-500 pl-4">
                            <span className="block text-[9px] uppercase font-bold opacity-50 tracking-widest">Tempo de Espera</span>
                            <span className="text-2xl font-black uppercase tracking-tight">{triageResult.maxWaitTime}</span>
                        </div>
                    )}
                </div>
              </div>
          </div>

          <div className="mt-10 pt-8 border-t border-white/10 text-left">
            <span className="block text-[9px] text-white/30 uppercase font-black mb-3 tracking-[0.2em]">
                {isInternation ? 'Protocolo de Monitoramento' : 'Justificativa e Discriminadores'}
            </span>
            <p className="text-white/80 text-sm leading-relaxed font-semibold">
               {isInternation 
                 ? "A frequência de aferição de sinais vitais e o acionamento da equipe médica devem seguir rigorosamente o protocolo NEWS institucional conforme a pontuação obtida."
                 : (triageResult.justification ? triageResult.justification.join(' • ') : 'Critérios ESI padrão.')
               }
            </p>
          </div>
        </div>
      </section>

      {/* RODAPÉ */}
      <footer className="pt-8 border-t border-slate-100 flex flex-col items-center gap-8">
        {/* Caixa de Autenticação Eletrônica Solicitada */}
        <div className="bg-slate-50 border border-slate-200 px-8 py-2 rounded-lg">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                AUTENTICAÇÃO ELETRÔNICA - HOSPITAL SÃO MATEUS
            </span>
        </div>

        <div className="w-full flex justify-between items-end">
            <div className="text-[8px] text-slate-400 max-w-[400px] leading-tight">
                Este documento é parte integrante do prontuário do paciente e foi gerado pelo sistema de Triagem Híbrida do Hospital São Mateus Cuiabá. 
                <br/><strong>Gerado em:</strong> {new Date().toLocaleString('pt-BR')}
            </div>
            
            <div className="flex flex-col items-center">
                <div className="w-64 border-b border-slate-400 mb-2"></div>
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em]">Assinatura e Carimbo do Profissional</span>
            </div>
        </div>
      </footer>
    </div>
  );
};
