import React, { useCallback } from 'react';
import { 
  User, RefreshCw, Search, CalendarDays, Clock, Flame, 
  Activity, Stethoscope, Baby, Printer, Save, AlertTriangle, 
  Smile, Meh, Frown 
} from 'lucide-react';
import { PatientData, VitalSigns, CtasDiscriminators, TriageResult, PatientHistory } from '../types';

interface Props {
  patient: PatientData;
  setPatient: React.Dispatch<React.SetStateAction<PatientData>>;
  vitals: VitalSigns;
  setVitals: React.Dispatch<React.SetStateAction<VitalSigns>>;
  discriminators: CtasDiscriminators;
  setDiscriminators: React.Dispatch<React.SetStateAction<CtasDiscriminators>>;
  triageResult: TriageResult;
  isSubmitting: boolean;
  handleSubmit: () => void;
  handlePrint: () => void;
  fetchPatientHistory: (recordId: string) => void;
  isSearchingHistory: boolean;
  patientHistory: PatientHistory | null;
}

const TriageSection: React.FC<Props> = React.memo(({
  patient, setPatient, vitals, setVitals, discriminators, setDiscriminators,
  triageResult, isSubmitting, handleSubmit, handlePrint, fetchPatientHistory,
  isSearchingHistory, patientHistory
}) => {

  const updateDisc = useCallback((category: keyof CtasDiscriminators, field: string, val: boolean) => {
    setDiscriminators(prev => {
      const catVal = prev[category];
      if (typeof catVal === 'object' && catVal !== null) {
        return { ...prev, [category]: { ...catVal, [field]: val } };
      }
      return { ...prev, [category]: val } as CtasDiscriminators;
    });
  }, [setDiscriminators]);

  const getPainConfig = (level: number) => {
    if (level === 0) return { label: 'SEM DOR', color: 'bg-emerald-400', hover: 'hover:bg-emerald-500', icon: Smile, text: 'text-emerald-500' };
    if (level <= 3) return { label: 'DOR LEVE', color: 'bg-emerald-400', hover: 'hover:bg-emerald-500', icon: Smile, text: 'text-emerald-500' };
    if (level <= 6) return { label: 'DOR MODERADA', color: 'bg-yellow-400', hover: 'hover:bg-yellow-500', icon: Meh, text: 'text-yellow-500' };
    if (level <= 9) return { label: 'DOR FORTE', color: 'bg-orange-500', hover: 'hover:bg-orange-600', icon: Frown, text: 'text-orange-500' };
    return { label: 'DOR INSUPORTÁVEL', color: 'bg-rose-500', hover: 'hover:bg-rose-600', icon: Frown, text: 'text-rose-500' };
  };

  const currentPainLevel = vitals.painLevel !== '' ? (vitals.painLevel as number) : null;
  const painConfig = currentPainLevel !== null ? getPainConfig(currentPainLevel) : null;
  const PainIcon = painConfig ? painConfig.icon : Smile;

  const handleNameBlur = () => {
    const raw = patient.name.replace(/[^A-Z]/g, '');
    if (raw.length > 0) {
      const formatted = raw.split('').join('.') + '.';
      setPatient(prev => ({...prev, name: formatted}));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. DADOS DO PACIENTE */}
      <section className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-2 mb-4 gap-4">
            <h2 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
                <User size={16}/> Identificação
            </h2>
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100 p-1.5 rounded border border-slate-200 transition-colors">
                    <input type="checkbox" className="w-4 h-4 accent-teal-600" checked={patient.isReevaluation} onChange={e => setPatient(prev => ({...prev, isReevaluation: e.target.checked}))} />
                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700 uppercase"><RefreshCw size={12} className={patient.isReevaluation ? "text-teal-600" : "text-slate-400"} /><span>É Reavaliação?</span></div>
                </label>
                {patient.isReevaluation && <button onClick={() => fetchPatientHistory(patient.medicalRecord)} disabled={isSearchingHistory || !patient.medicalRecord} className={`text-xs text-white px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-50 transition-colors ${isSearchingHistory ? 'bg-slate-400' : 'bg-teal-600 hover:bg-teal-700'}`}>{isSearchingHistory ? 'Buscando...' : <><Search size={12}/> Buscar Histórico</>}</button>}
            </div>
          </div>
          {patient.isReevaluation && patientHistory && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded p-3 flex flex-col gap-3 animate-fade-in">
                <div className="flex items-start gap-3"><AlertTriangle className="text-amber-600 mt-0.5" size={20}/><div className="w-full"><h4 className="text-sm font-bold text-amber-800">Histórico Encontrado (Reavaliação)</h4><div className="text-xs text-amber-900 mt-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1"><p><strong>Última Avaliação:</strong> {patientHistory.lastDate} às {patientHistory.lastTime}</p><p><strong>Classificação Anterior:</strong> ESI {patientHistory.lastEsi}</p><p className="col-span-1 md:col-span-2"><strong>Queixa Anterior:</strong> {patientHistory.lastComplaint}</p></div></div></div>
                {patientHistory.lastVitals && <div className="bg-white/60 p-2 rounded border border-amber-100 text-xs"><strong className="text-amber-800 block mb-1 uppercase">Sinais Vitais Anteriores:</strong><div className="grid grid-cols-4 md:grid-cols-7 gap-2 font-mono text-slate-700"><div className="bg-white p-1 rounded border text-center"><span className="text-[10px] text-slate-400 block">PA</span>{patientHistory.lastVitals.pa || '-'}</div><div className="bg-white p-1 rounded border text-center"><span className="text-[10px] text-slate-400 block">FC</span>{patientHistory.lastVitals.fc || '-'}</div><div className="bg-white p-1 rounded border text-center"><span className="text-[10px] text-slate-400 block">FR</span>{patientHistory.lastVitals.fr || '-'}</div><div className="bg-white p-1 rounded border text-center"><span className="text-[10px] text-slate-400 block">SpO2</span>{patientHistory.lastVitals.spo2 || '-'}%</div><div className="bg-white p-1 rounded border text-center"><span className="text-[10px] text-slate-400 block">Temp</span>{patientHistory.lastVitals.temp || '-'}°</div><div className="bg-white p-1 rounded border text-center"><span className="text-[10px] text-slate-400 block">Dor</span>{patientHistory.lastVitals.pain || '-'}</div><div className="bg-white p-1 rounded border text-center"><span className="text-[10px] text-slate-400 block">GCS</span>{patientHistory.lastVitals.gcs || '-'}</div></div></div>}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-800 mb-1">Paciente <span className="text-red-500">*</span> <span className="text-[10px] font-normal text-slate-500 ml-1">(LGPD)</span></label><input type="text" className="w-full p-2 border border-slate-600 bg-slate-800 rounded text-white font-medium focus:ring-2 focus:ring-teal-500 outline-none placeholder-slate-400" value={patient.name} placeholder="Iniciais do paciente ex: W.S.S." onChange={e => setPatient(prev => ({...prev, name: e.target.value.toUpperCase()}))} onBlur={handleNameBlur} /></div>
            <div><label className="block text-xs font-bold text-slate-800 mb-1">Nascimento ({patient.age} {patient.ageUnit === 'months' ? 'meses' : 'anos'})</label><input type="date" style={{ colorScheme: 'dark' }} className="w-full p-2 border border-slate-600 bg-slate-800 rounded text-white font-medium focus:ring-2 focus:ring-teal-500 outline-none" value={patient.dob} onChange={e => setPatient(prev => ({...prev, dob: e.target.value}))} /></div>
            <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Nº <span className="font-black text-slate-900">PRONTUÁRIO</span> <span className="text-red-500">*</span></label>
                <input 
                    type="text" 
                    className="w-full p-2 border border-slate-600 bg-slate-800 rounded text-white font-medium focus:ring-2 focus:ring-teal-500 outline-none" 
                    value={patient.medicalRecord} 
                    onChange={e => setPatient(prev => ({...prev, medicalRecord: e.target.value.replace(/\D/g, '')}))} 
                />
            </div>
            <div><label className={`block text-xs font-bold mb-1 flex items-center gap-1 ${patient.isReevaluation ? 'text-slate-500' : 'text-teal-700'}`}><CalendarDays size={12}/> {patient.isReevaluation ? 'Data 1º Acolhimento' : 'Data Avaliação'}</label><input type="date" className={`w-full p-2 border rounded font-medium outline-none ${patient.isReevaluation ? 'border-slate-300 bg-slate-100 text-slate-500' : 'border-teal-200 bg-teal-50 text-slate-900 focus:ring-2 focus:ring-teal-500'}`} value={patient.evaluationDate} onChange={e => setPatient(prev => ({...prev, evaluationDate: e.target.value}))} readOnly={patient.isReevaluation} /></div>
            <div><label className={`block text-xs font-bold mb-1 flex items-center gap-1 ${patient.isReevaluation ? 'text-slate-500' : 'text-teal-700'}`}><Clock size={12}/> {patient.isReevaluation ? 'Hora 1º Acolhimento' : 'Hora Avaliação'}</label><input type="time" className={`w-full p-2 border rounded font-medium outline-none ${patient.isReevaluation ? 'border-slate-300 bg-slate-100 text-slate-500' : 'border-teal-200 bg-teal-50 text-slate-900 focus:ring-2 focus:ring-teal-500'}`} value={patient.evaluationTime} onChange={e => setPatient(prev => ({...prev, evaluationTime: e.target.value}))} readOnly={patient.isReevaluation} /></div>
            {patient.isReevaluation && (<><div className="md:col-start-3 md:col-end-4 animate-fade-in"><label className="block text-xs font-bold text-teal-700 mb-1 flex items-center gap-1"><CalendarDays size={12}/> Data Reavaliação</label><input type="date" style={{ colorScheme: 'dark' }} className="w-full p-2 border border-slate-600 bg-slate-800 rounded text-white font-medium focus:ring-2 focus:ring-teal-500 outline-none" value={patient.reevaluationDate || ''} onChange={e => setPatient(prev => ({...prev, reevaluationDate: e.target.value}))} /></div><div className="md:col-start-4 md:col-end-5 animate-fade-in"><label className="block text-xs font-bold text-teal-700 mb-1 flex items-center gap-1"><Clock size={12}/> Hora Reavaliação</label><input type="time" style={{ colorScheme: 'dark' }} className="w-full p-2 border border-slate-600 bg-slate-800 rounded text-white font-medium focus:ring-2 focus:ring-teal-500 outline-none" value={patient.reevaluationTime || ''} onChange={e => setPatient(prev => ({...prev, reevaluationTime: e.target.value}))} /></div></>)}
            <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-800 mb-1">Queixa Principal</label><input type="text" className="w-full p-2 border border-slate-600 bg-slate-800 rounded text-white font-medium focus:ring-2 focus:ring-teal-500 outline-none placeholder-slate-400" placeholder="Ex: Dor no peito, Febre..." value={patient.complaint} onChange={e => setPatient(prev => ({...prev, complaint: e.target.value}))} /></div>
          </div>
      </section>
      
      <section className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-rose-900 font-bold text-lg flex items-center gap-2"><Flame className="animate-pulse" /> ETAPA 1: Ameaça Imediata à Vida?</h2><p className="text-rose-800 text-sm font-medium">Instabilidade de Via Aérea, Respiração ou Circulação.</p></div><label className="flex items-center gap-3 bg-white px-4 py-2 rounded border border-rose-300 cursor-pointer hover:bg-rose-100 transition shadow-sm"><input type="checkbox" className="w-6 h-6 accent-rose-600" checked={discriminators.abcUnstable} onChange={e => setDiscriminators(prev => ({...prev, abcUnstable: e.target.checked}))} /><span className="font-bold text-rose-900">SIM, INSTÁVEL (ESI 1)</span></label></div></section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-700 uppercase mb-4 border-b pb-2 flex items-center gap-2"><Activity size={16}/> Sinais Vitais (CTAS)</h2>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-800 block mb-1">PA Sistólica</label><input type="number" className="w-full p-2 border border-slate-600 bg-slate-800 rounded font-mono text-lg text-white font-bold" value={vitals.pas} onChange={e => setVitals(prev => ({...prev, pas: e.target.value}))} /></div><div><label className="text-xs font-bold text-slate-800 block mb-1">PA Diastólica</label><input type="number" className="w-full p-2 border border-slate-600 bg-slate-800 rounded font-mono text-lg text-white font-bold" value={vitals.pad} onChange={e => setVitals(prev => ({...prev, pad: e.target.value}))} /></div></div>
                <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-800 block mb-1">F. Cardíaca</label><input type="number" className="w-full p-2 border border-slate-600 bg-slate-800 rounded font-mono text-lg text-white font-bold" value={vitals.fc} onChange={e => setVitals(prev => ({...prev, fc: e.target.value}))} /></div><div><label className="text-xs font-bold text-slate-800 block mb-1">F. Respiratória</label><input type="number" className="w-full p-2 border border-slate-600 bg-slate-800 rounded font-mono text-lg text-white font-bold" value={vitals.fr} onChange={e => setVitals(prev => ({...prev, fr: e.target.value}))} /></div></div>
                <div className="grid grid-cols-2 gap-3"><div><label className="text-xs font-bold text-slate-800 block mb-1">SpO2</label><input type="number" className="w-full p-2 border border-slate-600 bg-slate-800 rounded font-mono text-lg text-white font-bold" value={vitals.spo2} onChange={e => setVitals(prev => ({...prev, spo2: e.target.value}))} /></div><div><label className="text-xs font-bold text-slate-800 block mb-1">Temperatura</label><input type="text" className="w-full p-2 border border-slate-600 bg-slate-800 rounded font-mono text-lg text-white font-bold" value={vitals.temp} onChange={e => setVitals(prev => ({...prev, temp: e.target.value}))} /></div></div>
                <div className="border-t border-slate-200 pt-3"><label className="text-xs font-bold text-slate-800 block mb-1">Glasgow</label><div className="flex items-center gap-3"><div className="flex-1"><input type="range" min="3" max="15" className="w-full h-2 bg-slate-200 rounded-lg accent-teal-600" value={vitals.gcs} onChange={e => setVitals(prev => ({...prev, gcs: parseInt(e.target.value)}))} /></div><span className="font-mono font-bold text-xl w-10 text-center bg-slate-800 text-white rounded py-1">{vitals.gcs}</span></div></div>
                <div className="border-t border-slate-200 pt-3"><label className="text-xs font-bold text-slate-800 block mb-3 uppercase">Dor</label><div className="flex items-center justify-between mb-3 h-10">{painConfig ? (<div className="flex items-center gap-3"><div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md ${painConfig.color}`}>{currentPainLevel}</div><span className="font-bold text-slate-700 text-base uppercase">{painConfig.label}</span></div>) : (<span className="text-sm text-slate-400 font-medium italic">Selecione o nível de dor</span>)}<PainIcon size={32} strokeWidth={2.5} className={painConfig ? painConfig.text : 'text-slate-300'} /></div><div className="flex gap-1 h-10 w-full">{Array.from({ length: 11 }, (_, i) => i).map((level) => { const cfg = getPainConfig(level); const isSelected = vitals.painLevel === level; return (<button key={level} onClick={() => setVitals(prev => ({...prev, painLevel: level}))} className={`flex-1 rounded-md text-white font-bold text-sm transition-all shadow-sm ${cfg.color} ${isSelected ? 'ring-4 ring-offset-2 ring-slate-300 scale-110 z-10' : 'opacity-40 hover:opacity-100 hover:scale-105'}`}>{level}</button>); })}</div></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-700 uppercase mb-4 border-b pb-2 flex items-center gap-2"><Clock size={16}/> Etapa 2: Algoritmo ESI</h2>
            <div className="space-y-6">
                <div className="bg-orange-50 p-3 rounded border border-orange-200"><label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-orange-600 rounded" checked={discriminators.highRiskSituation} onChange={e => setDiscriminators(prev => ({...prev, highRiskSituation: e.target.checked}))} /><div><span className="font-bold text-slate-900 text-sm block">Situação de Alto Risco?</span><span className="text-xs text-orange-800 block mt-1">Paciente confuso, letárgico ou intoxicação exógena</span></div></label></div>
                <div><label className="block text-xs font-bold text-slate-800 mb-2">Quantos Recursos serão necessários?</label><div className="space-y-2"><button onClick={() => setDiscriminators(prev => ({...prev, resources: 'none'}))} className={`w-full text-left p-3 rounded border text-sm transition ${discriminators.resources === 'none' ? 'bg-blue-100 border-blue-600 ring-1 ring-blue-600 text-blue-900' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}><span className="font-bold block">NENHUM (ESI 5)</span><span className="block text-xs font-normal opacity-75 mt-0.5">Consulta, Receita, Atestado, Curativo</span></button><button onClick={() => setDiscriminators(prev => ({...prev, resources: 'one'}))} className={`w-full text-left p-3 rounded border text-sm transition ${discriminators.resources === 'one' ? 'bg-green-100 border-green-600 ring-1 ring-green-600 text-green-900' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}><span className="font-bold block">UM RECURSO (ESI 4)</span><span className="block text-xs font-normal opacity-75 mt-0.5">1 Exame (Raio-X/Lab) ou 1 Medicação (VO/IM)</span></button><button onClick={() => setDiscriminators(prev => ({...prev, resources: 'many'}))} className={`w-full text-left p-3 rounded border text-sm transition ${discriminators.resources === 'many' ? 'bg-yellow-100 border-yellow-600 ring-1 ring-yellow-600 text-yellow-900' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}><span className="font-bold block">DOIS OU MAIS (ESI 3)</span><span className="block text-xs font-normal opacity-75 mt-0.5">Exames (Lab + Imagem), Medicação IV, Fluidos</span></button></div></div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-col h-full">
            <h2 className="text-sm font-bold text-slate-700 uppercase mb-4 border-b pb-2 flex items-center gap-2"><Stethoscope size={16}/> Etapa 3: CTAS</h2>
            <div className="flex-1 overflow-y-auto max-h-[500px] space-y-5 pr-1">
                <div className="space-y-1"><h3 className="text-xs font-bold text-slate-600 uppercase">Neurológico</h3>
                  <label className="flex items-center gap-2 text-sm p-1 hover:bg-slate-50 rounded cursor-pointer"><input type="checkbox" className="w-4 h-4" checked={discriminators.neuro.acuteConfusion} onChange={e => updateDisc('neuro', 'acuteConfusion', e.target.checked)}/> <span className="text-slate-800">Alt. Aguda Consciência / Delírium</span></label>
                  <label className="flex items-center gap-2 text-sm p-1 hover:bg-slate-50 rounded cursor-pointer"><input type="checkbox" className="w-4 h-4" checked={discriminators.neuro.severeHeadache} onChange={e => updateDisc('neuro', 'severeHeadache', e.target.checked)}/> <span className="text-slate-800">Cefaleia Súbita Intensa</span></label>
                </div>
                <div className="space-y-1"><h3 className="text-xs font-bold text-slate-600 uppercase">Infeccioso / Sepse</h3>
                  <label className="flex items-center gap-2 text-sm p-1 hover:bg-slate-50 rounded cursor-pointer"><input type="checkbox" className="w-4 h-4" checked={discriminators.sepsis.suspectedInfection} onChange={e => updateDisc('sepsis', 'suspectedInfection', e.target.checked)}/> <span className="text-slate-800">Infecção Suspeita / Confirmada</span></label>
                  <label className="flex items-center gap-2 text-sm p-1 hover:bg-slate-50 rounded cursor-pointer"><input type="checkbox" className="w-4 h-4" checked={discriminators.sepsis.immunosuppressed} onChange={e => updateDisc('sepsis', 'immunosuppressed', e.target.checked)}/> <span className="text-slate-800">Imunossupressão / Neutropenia</span></label>
                  <label className="flex items-center gap-2 text-sm p-1 hover:bg-slate-50 rounded cursor-pointer"><input type="checkbox" className="w-4 h-4" checked={discriminators.sepsis.perfursionIssues} onChange={e => updateDisc('sepsis', 'perfursionIssues', e.target.checked)}/> <span className="text-slate-800">Má Perfusão</span></label>
                </div>
                
                {/* --- RED FLAGS ATUALIZADO --- */}
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-slate-600 uppercase">Red Flags</h3>
                  
                  {/* Novo Discriminador 1 */}
                  <label className="flex items-start gap-2 text-xs p-2 bg-rose-50 border border-rose-100 rounded cursor-pointer hover:bg-rose-100 transition-colors">
                    <input type="checkbox" className="w-4 h-4 mt-0.5 accent-rose-600" checked={discriminators.cardio.chestPainTypical} onChange={e => updateDisc('cardio', 'chestPainTypical', e.target.checked)}/> 
                    <span className="text-slate-800 font-medium">Dor torácica típica (aperto, peso, ardência, irradiando para Braços ou pescoço)</span>
                  </label>

                  {/* Novo Discriminador 2 */}
                  <label className="flex items-start gap-2 text-xs p-2 bg-rose-50 border border-rose-100 rounded cursor-pointer hover:bg-rose-100 transition-colors">
                    <input type="checkbox" className="w-4 h-4 mt-0.5 accent-rose-600" checked={discriminators.cardio.chestPainAtypicalCombined} onChange={e => updateDisc('cardio', 'chestPainAtypicalCombined', e.target.checked)}/> 
                    <span className="text-slate-800 font-medium">Dor no estômago ou costas + Falta de Ar e/ou Suor Frio e/ou Mal súbito/Angústia intensa e/ou Palpitação / Taquicardia</span>
                  </label>

                  <label className="flex items-center gap-2 text-sm p-1 hover:bg-slate-50 rounded cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" checked={discriminators.respiratory.dyspneaRisk} onChange={e => updateDisc('respiratory', 'dyspneaRisk', e.target.checked)}/> 
                    <span className="text-slate-800">Dispneia Idoso/DPOC</span>
                  </label>
                </div>

                {patient.age < 14 && (
                  <div className="bg-sky-50 p-3 rounded border border-sky-200 space-y-2">
                      <h3 className="text-xs font-bold text-sky-700 uppercase flex items-center gap-1"><Baby size={12}/> Pediatria</h3>
                      <label className="flex items-center gap-2 text-sm p-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-sky-600" checked={discriminators.pediatric.feverRisk} onChange={e => updateDisc('pediatric', 'feverRisk', e.target.checked)}/> <span className="text-sky-900">Febre &lt; 3m</span></label>
                      <label className="flex items-center gap-2 text-sm p-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-sky-600" checked={discriminators.pediatric.dehydration} onChange={e => updateDisc('pediatric', 'dehydration', e.target.checked)}/> <span className="text-sky-900">Desidratação Grave</span></label>
                      <label className="flex items-center gap-2 text-sm p-1 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-sky-600" checked={discriminators.pediatric.lethargy} onChange={e => updateDisc('pediatric', 'lethargy', e.target.checked)}/> <span className="text-sky-900">Letargia</span></label>
                  </div>
                )}
            </div>
          </div>
      </div>

      <section className="bg-white p-6 rounded-lg shadow-md border border-slate-200 mt-6"><div className="flex flex-col md:flex-row items-center justify-between gap-6"><div className="flex-1 space-y-2"><h3 className="text-sm font-bold text-slate-700 uppercase">Classificação Final</h3><div className="text-sm text-slate-800"><strong>Justificativa:</strong><ul className="list-disc list-inside mt-1 text-slate-700">{triageResult.justification.map((j, i) => <li key={i}>{j}</li>)}{triageResult.justification.length === 0 && <li>Triagem padrão baseada em recursos.</li>}</ul></div><div className="flex items-center gap-2 mt-2 text-xs font-mono bg-slate-100 text-slate-900 p-2 rounded inline-block font-bold"><span>Tempo Alvo: {triageResult.maxWaitTime}</span></div></div><div className="flex gap-4"><button onClick={handlePrint} className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-lg shadow flex items-center gap-2"><Printer size={20} /> PDF</button><button onClick={handleSubmit} disabled={isSubmitting} className="bg-rose-700 hover:bg-rose-800 disabled:bg-rose-400 text-white font-bold py-3 px-8 rounded-lg shadow flex items-center gap-2">{isSubmitting ? 'Salvando...' : <><Save size={20} /> FINALIZAR</>}</button></div></div></section>
    </div>
  );
});

export default TriageSection;