import React from 'react';
import { PatientData, VitalSigns, CtasDiscriminators, TriageResult } from '../types';

interface Props {
  patient: PatientData;
  vitals: VitalSigns;
  triageResult: TriageResult;
  discriminators: CtasDiscriminators;
}

export const PrintableReport: React.FC<Props> = ({ patient, vitals, triageResult, discriminators }) => {
  const blackStyle = { color: '#000000' };

  // Formatar data manual para exibição BR
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const [y, m, d] = dateString.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="bg-white text-black text-sm font-sans w-full h-full flex flex-col">
      {/* Header */}
      <div className="border-b-2 border-black pb-2 mb-4 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold uppercase text-gray-900" style={blackStyle}>Hospital São Mateus Cuiabá</h1>
          <h2 className="text-base font-medium text-gray-700" style={blackStyle}>Triagem Híbrida ESI + CTAS</h2>
        </div>
        <div className="text-right text-xs" style={blackStyle}>
          <p>Data Avaliação: {formatDate(patient.evaluationDate)}</p>
          <p>Hora Avaliação: {patient.evaluationTime}</p>
        </div>
      </div>

      {/* Identificação */}
      <section className="mb-4 border border-gray-400 rounded p-3 bg-gray-50">
        <div className="grid grid-cols-2 gap-y-1 gap-x-4 text-xs text-black" style={blackStyle}>
          <div className="col-span-2"><span className="font-bold">Nome:</span> {patient.name}</div>
          <div><span className="font-bold">Idade:</span> {patient.age} {patient.ageUnit === 'months' ? 'meses' : 'anos'}</div>
          <div><span className="font-bold">Nascimento:</span> {patient.dob ? new Date(patient.dob).toLocaleDateString('pt-BR') : '-'}</div>
          <div><span className="font-bold">Nº Prontuário:</span> {patient.medicalRecord}</div>
          <div><span className="font-bold">Data/Hora Reg:</span> {formatDate(patient.evaluationDate)} às {patient.evaluationTime}</div>
          <div className="col-span-2 flex items-center gap-2">
            <span className="font-bold">Tipo:</span> 
            <span className={`px-1 rounded border border-black ${patient.isReevaluation ? 'font-black uppercase' : ''}`}>
              {patient.isReevaluation ? 'REAVALIAÇÃO' : 'Acolhimento Inicial'}
            </span>
          </div>
          <div className="col-span-2 mt-1 pt-1 border-t border-gray-300"><span className="font-bold">Queixa Principal:</span> {patient.complaint}</div>
        </div>
      </section>

      {/* Etapas de Decisão */}
      <div className="grid grid-cols-2 gap-4 mb-4">
         {/* Sinais Vitais */}
         <section className="border border-gray-400 p-2 rounded">
            <h3 className="font-bold border-b border-black mb-2 uppercase text-xs">Sinais Vitais</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
               <div>PA: <strong>{vitals.pas || '-'} x {vitals.pad || '-'}</strong></div>
               <div>FC: <strong>{vitals.fc || '-'}</strong> bpm</div>
               <div>FR: <strong>{vitals.fr || '-'}</strong> irpm</div>
               <div>Temp: <strong>{vitals.temp || '-'}</strong> °C</div>
               <div>SpO2: <strong>{vitals.spo2 || '-'}</strong> %</div>
               <div>Dor: <strong>{vitals.painLevel || '-'}</strong> /10</div>
               <div className="col-span-2">Glasgow: <strong>{vitals.gcs}</strong></div>
            </div>
         </section>

         {/* Critérios ESI Base */}
         <section className="border border-gray-400 p-2 rounded">
            <h3 className="font-bold border-b border-black mb-2 uppercase text-xs">Avaliação ESI Base</h3>
            <ul className="text-xs list-disc list-inside">
               <li>Instabilidade ABC: <strong>{discriminators.abcUnstable ? 'SIM' : 'NÃO'}</strong></li>
               <li>Alto Risco Clínico: <strong>{discriminators.highRiskSituation ? 'SIM' : 'NÃO'}</strong></li>
               <li>Recursos Estimados: <strong>{discriminators.resources === 'none' ? '0' : discriminators.resources === 'one' ? '1' : '≥ 2'}</strong></li>
            </ul>
         </section>
      </div>

      {/* Discriminadores CTAS */}
      <section className="mb-4 border border-gray-400 p-2 rounded bg-gray-50">
         <h3 className="font-bold border-b border-black mb-2 uppercase text-xs">Discriminadores CTAS (Safety Net)</h3>
         <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
            {triageResult.discriminators.length > 0 ? (
               triageResult.discriminators.map((d, i) => (
                  <div key={i} className="flex items-center gap-1 font-semibold text-rose-700">
                     • {d}
                  </div>
               ))
            ) : (
               <span className="text-gray-500 italic">Nenhum discriminador positivo identificado.</span>
            )}
         </div>
      </section>

      {/* Resultado Final */}
      <section className="mt-4 mb-8 border-2 border-black p-4 rounded text-center">
         <h3 className="text-sm font-bold uppercase mb-2">Classificação Final</h3>
         <div className={`text-3xl font-black mb-1 p-2 inline-block rounded text-white print:text-black print:border print:border-black ${triageResult.color}`}>
            {triageResult.title}
         </div>
         <p className="text-xs mt-2 font-mono">Tempo Alvo Atendimento: {triageResult.maxWaitTime}</p>
         <div className="mt-4 text-xs text-left border-t border-gray-300 pt-2">
            <strong>Justificativa do Sistema:</strong> {triageResult.justification.join('; ')}
         </div>
      </section>

      {/* Assinatura */}
      <section className="mt-16 flex justify-center text-black flex-1 items-end pb-8">
        <div className="text-center w-64">
          <div className="border-t border-black pt-2 text-xs font-bold uppercase" style={blackStyle}>
            Assinatura do Profissional
          </div>
        </div>
      </section>
    </div>
  );
};