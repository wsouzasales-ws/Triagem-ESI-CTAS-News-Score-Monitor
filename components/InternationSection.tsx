import React, { useState, useEffect, useMemo } from 'react';
import { User, CalendarDays, Clock, Activity, Save, Printer, BedDouble, Stethoscope, FileText, ChevronDown, ChevronUp, Brain, Zap, Check, MessageSquare, Droplet, Heart, Thermometer, Wind, Smile, Meh, Frown, RefreshCw, Search, AlertTriangle, RefreshCcw, Flame } from 'lucide-react';
import { PatientData, VitalSigns, NewsResult } from '../types';
import { calculateNEWS } from '../utils/newsCalculator';
import { evaluateProtocols } from '../utils/protocolEngine';
import { fetchWithRetry } from '../utils/api'; 

interface Props {
  scriptUrl: string;
  handleSyncFromSheet?: () => void;
  currentUser?: { name: string, email: string } | null;
}

// Mapeamento de Sintomas para Labels
const SYMPTOM_LABELS: Record<string, string> = {
    'neuro_cefaleia': 'Cefaleia Súbita',
    'neuro_rima': 'Desvio de Rima Labial',
    'neuro_vertigem': 'Vertigem Súbita Intensa',
    'neuro_forca': 'Perda de Força/Formigamento',
    'neuro_fala': 'Alteração de Fala',
    'neuro_visual': 'Alteração Visual Súbita',
    'neuro_marcha': 'Alteração de Marcha',
    'neuro_consciencia': 'Rebaixamento Súbito Consciência',
    
    // Protocolo SCA - Dor Torácica
    'sca_a_tipica': 'Dor Torácica Típica (A)',
    'sca_a_bracos': 'Irradiação Braços (A)',
    'sca_a_pescoco': 'Irradiação Pescoço/Mandíbula (A)',
    'sca_b_estomago': 'Dor Epigástrica (B)',
    'sca_b_costas': 'Dor Dorsal (B)',
    'sca_c_dispneia': 'Falta de Ar / Dispneia (C)',
    'sca_c_sudorese': 'Suor Frio / Sudorese (C)',
    'sca_c_palpitacao': 'Palpitação (C)',
    'sca_c_malsubito': 'Mal Súbito / Náusea (C)',
    
    'inf_infeccao': 'Infecção Suspeita/Confirmada',
    'inf_oliguria': 'Redução de Diurese'
};

interface InternationHistory {
    lastDate?: string;
    lastTime?: string;
    name: string;
    dob: string;
    sector?: string;
    bed?: string;
    lastVitals?: {
        pas: string; pad: string; fc: string; fr: string;
        temp: string; spo2: string; consc: string; o2: string; pain: string;
    };
    newsScore?: string;
    riskText?: string;
}

export const InternationSection: React.FC<Props> = ({ scriptUrl, handleSyncFromSheet, currentUser }) => {
  const [patient, setPatient] = useState<PatientData>({
    name: '', medicalRecord: '', dob: '', serviceTimestamp: '',
    evaluationDate: '', evaluationTime: '', isReevaluation: false,
    age: 0, ageUnit: 'years', gender: 'M', complaint: '',
    sector: '', bed: ''
  });

  const [vitals, setVitals] = useState<VitalSigns>({
    pas: '', pad: '', fc: '', fr: '', temp: '', spo2: '', gcs: 15, painLevel: '',
    o2Sup: false, consciousness: 'Alert'
  });

  const [observations, setObservations] = useState('');
  const [isSymptomsOpen, setIsSymptomsOpen] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newsResult, setNewsResult] = useState<NewsResult>({ score: 0, riskText: 'AGUARDANDO DADOS', riskClass: 'low' });
  const [notification, setNotification] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [internationHistory, setInternationHistory] = useState<InternationHistory | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setPatient(prev => ({ ...prev, evaluationDate: dateStr, evaluationTime: timeStr }));
  }, []);

  useEffect(() => {
    const result = calculateNEWS(vitals);
    setNewsResult(result);
  }, [vitals]);

  const activeProtocols = useMemo(() => {
      return evaluateProtocols(vitals, selectedSymptoms);
  }, [vitals, selectedSymptoms]);

  const handleNameBlur = () => {
    const raw = patient.name.replace(/[^A-Z]/g, '');
    if (raw.length > 0) {
      const formatted = raw.split('').join('.') + '.';
      setPatient(prev => ({...prev, name: formatted}));
    }
  };

  const toggleSymptom = (id: string) => {
     setSelectedSymptoms(prev => 
        prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
     );
  };

  const handleSearchHistory = async () => {
     if (!patient.medicalRecord) {
        setNotification({ msg: 'Digite o Nº Prontuário para buscar.', type: 'error' });
        setTimeout(() => setNotification(null), 3000);
        return;
     }

     setIsSearchingHistory(true);
     setInternationHistory(null);

     if (handleSyncFromSheet) {
        setIsSyncing(true);
        handleSyncFromSheet();
     }

     try {
        const timestamp = new Date().getTime();
        // Uso de fetchWithRetry
        const data = await fetchWithRetry(`${scriptUrl}?action=searchInternation&medicalRecord=${encodeURIComponent(patient.medicalRecord)}&_=${timestamp}`, {
            method: 'GET'
        });

        setIsSyncing(false);

        if (data.result === 'found') {
            const hist = data.history as InternationHistory;
            const isFromTriage = data.source === 'triage';

            if (isFromTriage) {
                setInternationHistory(null);
                setPatient(prev => ({
                    ...prev,
                    name: hist.name || prev.name,
                    dob: hist.dob || prev.dob,
                }));
                setNotification({ msg: 'Paciente encontrado na Triagem! Dados carregados.', type: 'success' });
            } else {
                setInternationHistory(hist);
                setPatient(prev => ({
                    ...prev,
                    name: hist.name || prev.name,
                    dob: hist.dob || prev.dob,
                    sector: hist.sector || prev.sector,
                    bed: hist.bed || prev.bed
                }));
                setNotification({ msg: 'Histórico de Internação encontrado!', type: 'success' });
            }
            
        } else {
            setNotification({ msg: 'Paciente não encontrado (Triagem ou Internação).', type: 'error' });
        }
     } catch (e) {
        setNotification({ msg: 'Erro ao buscar. Tente novamente.', type: 'error' });
     } finally {
        setIsSearchingHistory(false);
        setIsSyncing(false);
        setTimeout(() => setNotification(null), 3000);
     }
  };

  const handleSubmit = async () => {
    if (!patient.name || !patient.medicalRecord) {
        setNotification({ msg: 'Preencha Nome (Iniciais) e Prontuário.', type: 'error' });
        return;
    }

    setIsSubmitting(true);
    
    const symptomsText = selectedSymptoms.map(id => SYMPTOM_LABELS[id]).join(', ');
    const protocolsText = activeProtocols.length > 0 
        ? activeProtocols.map(p => `PROTOCOLO ${p.type.toUpperCase()}`).join(', ') 
        : '';

    let finalObservations = observations;
    if (protocolsText) finalObservations = `[${protocolsText}] ` + finalObservations;
    if (symptomsText) finalObservations = `[SINTOMAS: ${symptomsText}] \n` + finalObservations;

    const payload = {
        action: 'saveInternation',
        patient: {
            ...patient,
            age: String(patient.age),
            isReevaluation: !!patient.isReevaluation
        },
        vitals: {
            ...vitals,
            painLevel: String(vitals.painLevel),
            gcs: String(vitals.gcs)
        },
        news: newsResult,
        observations: finalObservations,
        user: currentUser?.name ? `${currentUser.name}` : (currentUser?.email || 'Desconhecido')
    };

    try {
        await fetchWithRetry(scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        
        setNotification({ msg: 'Avaliação de Internação Salva!', type: 'success' });
        
        const now = new Date();
        setVitals({ pas: '', pad: '', fc: '', fr: '', temp: '', spo2: '', gcs: 15, painLevel: '', o2Sup: false, consciousness: 'Alert' });
        setPatient(prev => ({
            ...prev,
            serviceTimestamp: now.toLocaleTimeString(),
            evaluationDate: now.toISOString().split('T')[0],
            evaluationTime: now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
        }));
        setObservations('');
        setSelectedSymptoms([]);
        setInternationHistory(null);

    } catch (e: any) {
        const errMsg = e.message ? e.message : 'Erro desconhecido';
        setNotification({ msg: `Erro ao salvar: ${errMsg}`, type: 'error' });
    } finally {
        setIsSubmitting(false);
        setTimeout(() => setNotification(null), 4000);
    }
  };

  const handlePrint = () => {
     window.print();
  };

  const getPainConfig = (level: number) => {
    if (level === 0) return { label: 'SEM DOR', color: 'bg-emerald-400', hover: 'hover:bg-emerald-500', icon: Smile, text: 'text-emerald-500' };
    if (level <= 3) return { label: 'DOR LEVE', color: 'bg-emerald-400', hover: 'hover:bg-emerald-500', icon: Smile, text: 'text-emerald-500' };
    if (level <= 6) return { label: 'DOR MODERADA', color: 'bg-yellow-400', hover: 'hover:bg-yellow-500', icon: Meh, text: 'text-yellow-500' };
    if (level <= 9) return { label: 'DOR FORTE', color: 'bg-orange-500', hover: 'hover:bg-orange-600', icon: Frown, text: 'text-orange-500' };
    return { label: 'DOR INSUPORTÁVEL', color: 'bg-rose-500', hover: 'hover:bg-rose-600', icon: Frown, text: 'text-rose-500' };
  };

  const getNewsActionMessage = (score: number) => {
      if (score === 0) return "Aferir SSVV a cada 12 Horas";
      if (score >= 1 && score <= 3) return "Aferir SSVV a cada 6 Horas";
      if (score === 4) return "Aferir SSVV a cada 4 Horas • Comunicar Enfermeiro";
      if (score >= 5 && score <= 6) return "Aferir SSVV a cada 1 Hora • Comunicar Médico"; 
      if (score >= 7) return "Acionar TRR e Transferir para UTI";
      return "";
  };

  const currentPainLevel = vitals.painLevel !== '' ? Number(vitals.painLevel) : null;
  const painConfig = currentPainLevel !== null ? getPainConfig(currentPainLevel) : null;
  const PainIcon = painConfig ? painConfig.icon : Smile;

  const SymptomCheck: React.FC<{ id: string; label: string }> = ({ id, label }) => (
    <div 
        onClick={() => toggleSymptom(id)}
        className="flex items-start gap-2 mb-2 cursor-pointer group select-none"
    >
        <div className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-colors shrink-0 ${selectedSymptoms.includes(id) ? 'bg-slate-700 border-slate-700' : 'bg-white border-slate-400 group-hover:border-slate-600'}`}>
            {selectedSymptoms.includes(id) && <Check size={12} className="text-white"/>}
        </div>
        <span className={`text-xs ${selectedSymptoms.includes(id) ? 'text-slate-900 font-bold' : 'text-slate-600'}`}>{label}</span>
    </div>
  );

  const renderVitalInput = (
    label: string, 
    field: keyof VitalSigns, 
    unit: string, 
    icon?: React.ReactNode, 
    step: number = 1
  ) => {
    const handleAdjust = (amount: number) => {
       setVitals(prev => {
          const currentVal = prev[field];
          const numVal = currentVal === '' ? 0 : parseFloat(String(currentVal).replace(',', '.'));
          const newVal = numVal + amount;
          const formatted = step % 1 !== 0 ? newVal.toFixed(1) : String(Math.round(newVal));
          return { ...prev, [field]: formatted };
       });
    };

    return (
        <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                {icon} {label}
            </label>
            <div className="relative flex items-center bg-slate-800 border border-slate-700 rounded h-[42px] overflow-hidden">
                <input 
                    type="number"
                    step={step}
                    value={vitals[field] as string}
                    onChange={e => setVitals(prev => ({...prev, [field]: e.target.value}))}
                    className="w-full bg-transparent text-white font-bold text-lg px-3 focus:outline-none appearance-none"
                    style={{ MozAppearance: 'textfield' }} 
                />
                <span className="text-[10px] text-slate-500 mr-2 shrink-0">{unit}</span>
                <div className="flex flex-col h-full border-l border-slate-600 shrink-0 w-8">
                    <button 
                        onClick={() => handleAdjust(step)}
                        className="flex-1 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center border-b border-slate-600 active:bg-slate-600"
                        tabIndex={-1}
                    >
                        <ChevronUp size={14} />
                    </button>
                    <button 
                        onClick={() => handleAdjust(-step)}
                        className="flex-1 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center active:bg-slate-600"
                        tabIndex={-1}
                    >
                        <ChevronDown size={14} />
                    </button>
                </div>
            </div>
            <style>{`
                input[type=number]::-webkit-inner-spin-button, 
                input[type=number]::-webkit-outer-spin-button { 
                    -webkit-appearance: none; 
                    margin: 0; 
                }
            `}</style>
        </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {notification && (
        <div className={`fixed top-4 right-4 p-4 rounded shadow-lg text-white font-bold z-50 animate-bounce ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {notification.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="text-center">
        <h2 className="text-2xl font-black text-teal-800 uppercase tracking-wide">NEWS UNIDADE DE INTERNAÇÃO</h2>
      </div>

      {/* INFO BOX */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
         <BedDouble className="text-emerald-600 shrink-0 mt-1" />
         <div>
            <h3 className="font-bold text-emerald-900 text-sm uppercase">Avaliação de Pacientes Internados</h3>
            <p className="text-xs text-emerald-700">Os dados serão salvos na aba "Pacientes internados" e exibidos na coluna direita da TV.</p>
         </div>
      </div>

      {/* IDENTIFICAÇÃO */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
         <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            
            {/* Nome - Dark */}
            <div className="md:col-span-5">
               <label className="block text-xs font-bold text-slate-700 mb-1">Paciente</label>
               <div className="relative">
                 <User className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                 <input 
                    type="text" 
                    value={patient.name}
                    onChange={e => setPatient(prev => ({...prev, name: e.target.value.toUpperCase()}))}
                    onBlur={handleNameBlur}
                    placeholder="INICIAIS DO PACIENTE EX: W.S.S."
                    className="w-full pl-10 p-2.5 bg-slate-800 border border-slate-700 rounded text-white font-bold placeholder-slate-500 focus:ring-2 focus:ring-teal-500 outline-none uppercase"
                 />
               </div>
            </div>

            {/* Atendimento - Dark */}
            <div className="md:col-span-3">
               <label className="block text-xs font-bold text-slate-700 mb-1">Nº <span className="font-black text-slate-900">PRONTUÁRIO</span></label>
               <div className="relative">
                 <FileText className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                 <input 
                    type="text" 
                    value={patient.medicalRecord}
                    onChange={e => setPatient(prev => ({...prev, medicalRecord: e.target.value}))}
                    placeholder="000000"
                    className="w-full pl-10 p-2.5 bg-slate-800 border border-slate-700 rounded text-white font-bold placeholder-slate-500 focus:ring-2 focus:ring-teal-500 outline-none"
                 />
               </div>
            </div>

            {/* Data Nascimento e Reavaliação */}
             <div className="md:col-span-4 grid grid-cols-2 gap-2">
                 <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Data de Nascimento</label>
                    <input 
                        type="date"
                        value={patient.dob}
                        onChange={e => setPatient(prev => ({...prev, dob: e.target.value}))}
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded text-white text-xs font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                        style={{ colorScheme: 'dark' }}
                    />
                 </div>
                 
                 {/* Reavaliação Checkbox + Button (Estilo Triage) */}
                 <div className="flex flex-col justify-end">
                     <div className="flex items-center gap-2 h-[42px] bg-slate-50 border border-slate-200 rounded px-2">
                         <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-teal-600"
                                checked={patient.isReevaluation}
                                onChange={e => setPatient(prev => ({...prev, isReevaluation: e.target.checked}))}
                            />
                            <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-700">
                                <RefreshCw size={10} className={patient.isReevaluation ? "text-teal-600" : "text-slate-400"} />
                                <span>REAVALIAÇÃO?</span>
                            </div>
                         </label>
                         
                         {patient.isReevaluation && (
                             <button 
                               onClick={handleSearchHistory}
                               disabled={isSearchingHistory || isSyncing}
                               className="ml-auto bg-teal-600 hover:bg-teal-700 text-white p-1.5 rounded disabled:opacity-50 transition-colors"
                               title="Buscar Histórico Anterior"
                             >
                                 {isSearchingHistory ? <RefreshCcw className="animate-spin" size={16}/> : <Search size={16}/>}
                             </button>
                         )}
                     </div>
                 </div>
             </div>
         </div>

         {/* Localização (Setor/Leito) */}
         <div className="grid grid-cols-2 gap-4 mt-4">
             <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Setor</label>
                <select 
                    value={patient.sector}
                    onChange={e => setPatient(prev => ({...prev, sector: e.target.value}))}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-teal-500"
                >
                    <option value="">Selecione...</option>
                    <option value="Clínica Médica">Clínica Médica</option>
                    <option value="Clínica Cirúrgica">Clínica Cirúrgica</option>
                    <option value="UTI Geral">UTI Geral</option>
                    <option value="UTI Coronariana">UTI Coronariana</option>
                    <option value="Emergência">Emergência</option>
                </select>
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Leito</label>
                <input 
                    type="text" 
                    value={patient.bed}
                    onChange={e => setPatient(prev => ({...prev, bed: e.target.value}))}
                    placeholder="Ex: 204-A"
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-teal-500 uppercase"
                />
             </div>
         </div>
      </div>

      {/* ALERTA SE PACIENTE ENCONTRADO */}
      {internationHistory && (
          <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded shadow-sm">
              <div className="flex justify-between items-start">
                  <div>
                      <h4 className="text-indigo-900 font-bold text-sm mb-1 flex items-center gap-2">
                          <Activity size={16}/> Última Avaliação Encontrada
                      </h4>
                      <p className="text-xs text-indigo-700">
                          Data: <strong>{internationHistory.lastDate} às {internationHistory.lastTime}</strong>
                      </p>
                      {internationHistory.newsScore && (
                          <div className="mt-2 inline-flex items-center gap-2 bg-white px-2 py-1 rounded border border-indigo-100">
                              <span className="text-[10px] font-bold text-slate-500">NEWS ANTERIOR:</span>
                              <span className={`text-sm font-black ${parseInt(internationHistory.newsScore) >= 5 ? 'text-rose-600' : 'text-slate-800'}`}>
                                  {internationHistory.newsScore}
                              </span>
                          </div>
                      )}
                  </div>
                  {internationHistory.lastVitals && (
                      <div className="text-right hidden md:block">
                          <div className="text-[10px] text-indigo-400 uppercase font-bold mb-1">Sinais Vitais Anteriores</div>
                          <div className="grid grid-cols-4 gap-1 text-xs text-slate-600 font-mono">
                              <span className="bg-white px-1 rounded">PA: {internationHistory.lastVitals.pas}x{internationHistory.lastVitals.pad}</span>
                              <span className="bg-white px-1 rounded">FC: {internationHistory.lastVitals.fc}</span>
                              <span className="bg-white px-1 rounded">Spo2: {internationHistory.lastVitals.spo2}%</span>
                              <span className="bg-white px-1 rounded">Temp: {internationHistory.lastVitals.temp}</span>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* SINAIS VITAIS - INPUTS */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
              <h3 className="font-bold text-slate-700 text-sm uppercase flex items-center gap-2">
                  <Stethoscope className="text-teal-600"/> Sinais Vitais
              </h3>
              <div className="text-xs text-slate-400">Preenchimento Obrigatório</div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {renderVitalInput('PA Sistólica', 'pas', 'mmHg', <Activity size={12}/>, 1)}
              {renderVitalInput('PA Diastólica', 'pad', 'mmHg', <Activity size={12}/>, 1)}
              {renderVitalInput('Freq. Cardíaca', 'fc', 'bpm', <Heart size={12}/>, 1)}
              {renderVitalInput('Freq. Resp.', 'fr', 'irpm', <Wind size={12}/>, 1)}
              {renderVitalInput('Temperatura', 'temp', '°C', <Thermometer size={12}/>, 0.1)}
              {renderVitalInput('Saturação O2', 'spo2', '%', <Droplet size={12}/>, 1)}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-4 border-t border-slate-100">
              {/* O2 SUPLEMENTAR */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase">Uso de O2 Suplementar?</span>
                  <div className="flex gap-2">
                      <button 
                        onClick={() => setVitals(prev => ({...prev, o2Sup: false}))}
                        className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${!vitals.o2Sup ? 'bg-slate-600 text-white shadow-sm' : 'bg-white text-slate-500 border hover:bg-slate-100'}`}
                      >
                          NÃO
                      </button>
                      <button 
                        onClick={() => setVitals(prev => ({...prev, o2Sup: true}))}
                        className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${vitals.o2Sup ? 'bg-rose-600 text-white shadow-sm' : 'bg-white text-slate-500 border hover:bg-slate-100'}`}
                      >
                          SIM
                      </button>
                  </div>
              </div>

              {/* NIVEL CONSCIENCIA */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded border border-slate-200">
                  <span className="text-xs font-bold text-slate-700 uppercase">Nível Consciência</span>
                  <select 
                    value={vitals.consciousness}
                    onChange={e => setVitals(prev => ({...prev, consciousness: e.target.value as any}))}
                    className={`p-1.5 rounded text-xs font-bold outline-none border-2 cursor-pointer ${vitals.consciousness === 'Alert' ? 'border-emerald-200 text-emerald-800 bg-emerald-50' : 'border-rose-200 text-rose-800 bg-rose-50'}`}
                  >
                      <option value="Alert">Alerta (A)</option>
                      <option value="Confused">Confuso (C)</option>
                      <option value="Pain">Resp. Dor (P)</option>
                      <option value="Unresponsive">Inconsciente (U)</option>
                  </select>
              </div>
          </div>

          {/* ESCALA DE DOR */}
          <div className="mt-6">
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1">
                  <Activity size={12}/> Escala de Dor
              </label>
              <div className="flex gap-1 h-12 w-full">
                  {Array.from({ length: 11 }, (_, i) => i).map((level) => {
                    const cfg = getPainConfig(level);
                    const isSelected = vitals.painLevel === level;
                    return (
                        <button 
                            key={level} 
                            onClick={() => setVitals(prev => ({...prev, painLevel: level}))} 
                            className={`flex-1 rounded-md text-white font-bold text-sm transition-all shadow-sm ${cfg.color} ${isSelected ? 'ring-4 ring-offset-2 ring-slate-300 scale-110 z-10' : 'opacity-40 hover:opacity-100 hover:scale-105'}`}
                        >
                            {level}
                        </button>
                    );
                  })}
              </div>
              <div className="flex justify-between items-center mt-2 h-6">
                 {painConfig ? (
                     <span className={`text-xs font-bold px-2 py-0.5 rounded ${painConfig.color.replace('bg-', 'text-').replace('400','600').replace('500','700')}`}>
                         {painConfig.label}
                     </span>
                 ) : <span></span>}
                 <PainIcon size={24} className={painConfig ? painConfig.text : 'text-slate-300'} />
              </div>
          </div>
      </div>

      {/* RESULTADO NEWS */}
      <div className={`rounded-lg shadow-md border-l-8 overflow-hidden transition-all duration-500 ${newsResult.score >= 5 ? 'bg-rose-50 border-rose-600' : newsResult.score >= 1 ? 'bg-yellow-50 border-yellow-500' : 'bg-emerald-50 border-emerald-500'}`}>
          <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black shadow-inner bg-white ${newsResult.score >= 5 ? 'text-rose-600' : newsResult.score >= 1 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                      {newsResult.score}
                  </div>
                  <div>
                      <h3 className="text-sm font-bold opacity-60 uppercase mb-1">Pontuação NEWS</h3>
                      <div className={`text-xl font-black uppercase leading-none ${newsResult.score >= 5 ? 'text-rose-800' : newsResult.score >= 1 ? 'text-yellow-800' : 'text-emerald-800'}`}>
                          {newsResult.riskText}
                      </div>
                  </div>
              </div>
              
              <div className="w-full md:w-1/2 bg-white/60 p-3 rounded-lg border border-black/5">
                  <h4 className="text-[10px] font-bold uppercase text-slate-500 mb-1 flex items-center gap-1">
                      <Activity size={10}/> Conduta Recomendada
                  </h4>
                  <p className="text-sm font-bold text-slate-800">
                      {getNewsActionMessage(newsResult.score)}
                  </p>
              </div>
          </div>
      </div>

      {/* SINTOMAS E OBSERVACAO */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          
          {/* Alertas de Protocolo Ativos */}
          {activeProtocols.length > 0 && (
              <div className="mb-6 space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Protocolos Detectados</h4>
                  {activeProtocols.map((alert, idx) => (
                      <div key={idx} className="bg-slate-900 text-white p-3 rounded shadow-sm border border-slate-700 animate-pulse flex items-start gap-3">
                          <AlertTriangle className="text-yellow-400 shrink-0 mt-0.5" size={18} />
                          <div>
                              <strong className="block text-sm uppercase text-yellow-400">PROTOCOLO {alert.type.toUpperCase()}</strong>
                              <p className="text-xs opacity-80">{alert.reason.join(', ')}</p>
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {/* Accordion Sintomas */}
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
              <button 
                onClick={() => setIsSymptomsOpen(!isSymptomsOpen)}
                className="w-full bg-slate-50 p-3 flex justify-between items-center text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                  <span className="flex items-center gap-2"><Check size={14}/> Checklist de Sintomas (Opcional)</span>
                  {isSymptomsOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              </button>
              
              {isSymptomsOpen && (
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white animate-fade-in">
                      {/* Neuro */}
                      <div>
                          <h5 className="text-[10px] font-bold text-indigo-600 uppercase mb-2 border-b border-indigo-100 pb-1 flex items-center gap-1"><Brain size={10}/> Neurológico</h5>
                          {['neuro_rima', 'neuro_forca', 'neuro_fala', 'neuro_cefaleia', 'neuro_vertigem', 'neuro_visual'].map(id => (
                              <SymptomCheck key={id} id={id} label={SYMPTOM_LABELS[id]} />
                          ))}
                      </div>
                      {/* Toracica */}
                      <div>
                          <h5 className="text-[10px] font-bold text-red-600 uppercase mb-2 border-b border-red-100 pb-1 flex items-center gap-1"><Heart size={10}/> Dor Torácica</h5>
                          {[
                              'sca_a_tipica', 'sca_a_bracos', 'sca_a_pescoco', 
                              'sca_b_estomago', 'sca_b_costas', 
                              'sca_c_dispneia', 'sca_c_sudorese', 'sca_c_palpitacao', 'sca_c_malsubito'
                          ].map(id => (
                              <SymptomCheck key={id} id={id} label={SYMPTOM_LABELS[id]} />
                          ))}
                      </div>
                      {/* Infeccao */}
                      <div>
                          <h5 className="text-[10px] font-bold text-orange-600 uppercase mb-2 border-b border-orange-100 pb-1 flex items-center gap-1"><Flame size={10}/> Infeccioso</h5>
                          {['inf_infeccao', 'inf_oliguria'].map(id => (
                              <SymptomCheck key={id} id={id} label={SYMPTOM_LABELS[id]} />
                          ))}
                      </div>
                  </div>
              )}
          </div>

          <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                  <MessageSquare size={14}/> Observações Gerais
              </label>
              <textarea 
                  className="w-full p-3 border border-slate-300 rounded bg-slate-50 text-sm focus:bg-white focus:ring-2 focus:ring-teal-500 outline-none transition-colors"
                  rows={3}
                  placeholder="Descreva queixas adicionais ou detalhes relevantes..."
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
              />
          </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="flex items-center justify-end gap-3 mt-6">
          <button 
            onClick={handlePrint}
            className="px-6 py-3 bg-slate-700 text-white font-bold rounded shadow hover:bg-slate-800 transition-colors flex items-center gap-2"
          >
              <Printer size={18}/> PDF
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-8 py-3 bg-teal-600 text-white font-bold rounded shadow hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
              {isSubmitting ? 'Salvando...' : <><Save size={18}/> FINALIZAR AVALIAÇÃO</>}
          </button>
      </div>

    </div>
  );
};