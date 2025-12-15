import React, { useState, useEffect, useMemo } from 'react';
import { User, CalendarDays, Clock, Activity, Save, Printer, BedDouble, Stethoscope, FileText, ChevronDown, ChevronUp, Brain, Zap, Check, MessageSquare, Droplet, Heart, Thermometer, Wind, Smile, Meh, Frown, RefreshCw, Search, AlertTriangle, RefreshCcw } from 'lucide-react';
import { PatientData, VitalSigns, NewsResult } from '../types';
import { calculateNEWS } from '../utils/newsCalculator';
import { evaluateProtocols } from '../utils/protocolEngine';
import { fetchWithRetry } from '../utils/api'; // NOVO IMPORT

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
    'sca_a_tipica': 'Dor Torácica Típica (A)',
    'sca_a_bracos': 'Irradiação Braços (A)',
    'sca_a_pescoco': 'Irradiação Pescoço (A)',
    'sca_b_estomago': 'Dor Estômago (B)',
    'sca_b_costas': 'Dor Costas (B)',
    'sca_c_dispneia': 'Falta de Ar (C)',
    'sca_c_sudorese': 'Suor Frio (C)',
    'sca_c_palpitacao': 'Palpitação (C)',
    'sca_c_malsubito': 'Mal Súbito (C)',
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
        setNotification({ msg: 'Digite o Nº Atendimento para buscar.', type: 'error' });
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
        const response = await fetch(`${scriptUrl}?action=searchInternation&medicalRecord=${encodeURIComponent(patient.medicalRecord)}&_=${timestamp}`);
        const data = await response.json();

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
        setNotification({ msg: 'Preencha Nome (Iniciais) e Atendimento.', type: 'error' });
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
        // USO DE FETCH ROBUSTO COM RETRY
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

  const SymptomCheck = ({ id, label }: { id: string, label: string }) => (
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
               <label className="block text-xs font-bold text-slate-700 mb-1">Nº Atendimento</label>
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
                            <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-700 uppercase leading-none">
                                <RefreshCw size={10} className={patient.isReevaluation ? "text-teal-600" : "text-slate-400"} />
                                <span>Reavaliação?</span>
                            </div>
                         </label>
                         {/* Botão de Busca SEMPRE VISÍVEL se tiver ID */}
                         <button 
                             onClick={handleSearchHistory}
                             disabled={isSearchingHistory || !patient.medicalRecord}
                             className={`ml-auto px-2 py-1 rounded transition-colors flex items-center gap-1 ${isSyncing ? 'bg-amber-500 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white'}`}
                             title="Sincronizar e Buscar"
                         >
                             {isSyncing ? <RefreshCcw size={14} className="animate-spin"/> : <Search size={14}/>}
                         </button>
                     </div>
                 </div>
             </div>
         </div>
      </div>
      
      {/* HISTÓRICO ENCONTRADO (INTERNAÇÃO) */}
      {internationHistory && (
        <div className="bg-amber-50 border border-amber-200 rounded p-4 flex flex-col gap-3 animate-fade-in shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-amber-600 mt-0.5" size={20}/>
              <div className="w-full">
                <h4 className="text-sm font-bold text-amber-800">Histórico de Internação Encontrado</h4>
                <div className="text-xs text-amber-900 mt-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
                    <p><strong>Última Avaliação:</strong> {internationHistory.lastDate} às {internationHistory.lastTime}</p>
                    <p><strong>Score NEWS Anterior:</strong> {internationHistory.newsScore} ({internationHistory.riskText})</p>
                    <p><strong>Setor/Leito Anterior:</strong> {internationHistory.sector} / {internationHistory.bed}</p>
                </div>
              </div>
            </div>
            
            {internationHistory.lastVitals && (
              <div className="bg-white/60 p-2 rounded border border-amber-100 text-xs">
                <strong className="text-amber-800 block mb-1 uppercase">Sinais Vitais Anteriores:</strong>
                <div className="grid grid-cols-4 md:grid-cols-8 gap-2 font-mono text-slate-700">
                    <div className="bg-white p-1 rounded border text-center"><span className="text-[9px] text-slate-400 block">PA</span>{internationHistory.lastVitals.pas}x{internationHistory.lastVitals.pad}</div>
                    <div className="bg-white p-1 rounded border text-center"><span className="text-[9px] text-slate-400 block">FC</span>{internationHistory.lastVitals.fc}</div>
                    <div className="bg-white p-1 rounded border text-center"><span className="text-[9px] text-slate-400 block">FR</span>{internationHistory.lastVitals.fr}</div>
                    <div className="bg-white p-1 rounded border text-center"><span className="text-[9px] text-slate-400 block">SpO2</span>{internationHistory.lastVitals.spo2}%</div>
                    <div className="bg-white p-1 rounded border text-center"><span className="text-[9px] text-slate-400 block">Temp</span>{internationHistory.lastVitals.temp}°</div>
                    <div className="bg-white p-1 rounded border text-center"><span className="text-[9px] text-slate-400 block">Dor</span>{internationHistory.lastVitals.pain}</div>
                    <div className="bg-white p-1 rounded border text-center"><span className="text-[9px] text-slate-400 block">Consc</span>{internationHistory.lastVitals.consc}</div>
                    <div className="bg-white p-1 rounded border text-center"><span className="text-[9px] text-slate-400 block">O2</span>{internationHistory.lastVitals.o2}</div>
                </div>
              </div>
            )}
        </div>
      )}

      {/* CAMPOS ADICIONAIS DE INTERNAÇÃO (Continuando o Grid) */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Data Avaliação (Red) */}
             <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><CalendarDays size={12}/> Data Avaliação</label>
                <input 
                    type="date" 
                    value={patient.evaluationDate}
                    onChange={e => setPatient(prev => ({...prev, evaluationDate: e.target.value}))}
                    className="w-full p-2.5 bg-rose-700 border border-rose-800 rounded text-white font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                    style={{ colorScheme: 'dark' }}
                />
             </div>
             
             {/* Hora Avaliação (Red) */}
             <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1"><Clock size={12}/> Horário Avaliação</label>
                <input 
                    type="time" 
                    value={patient.evaluationTime}
                    onChange={e => setPatient(prev => ({...prev, evaluationTime: e.target.value}))}
                    className="w-full p-2.5 bg-rose-700 border border-rose-800 rounded text-white font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                    style={{ colorScheme: 'dark' }}
                />
             </div>

             {/* Setor (Green Border) */}
             <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Setor</label>
                <input 
                    type="text" 
                    value={patient.sector || ''}
                    onChange={e => setPatient(prev => ({...prev, sector: e.target.value}))}
                    placeholder="Ex: UTI 1"
                    className="w-full p-2.5 bg-emerald-50 border border-emerald-400 rounded text-emerald-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none placeholder-emerald-300"
                />
             </div>

             {/* Leito (Green Border) */}
             <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Leito</label>
                <input 
                    type="text" 
                    value={patient.bed || ''}
                    onChange={e => setPatient(prev => ({...prev, bed: e.target.value}))}
                    placeholder="Ex: 05"
                    className="w-full p-2.5 bg-emerald-50 border border-emerald-400 rounded text-emerald-900 font-bold focus:ring-2 focus:ring-emerald-500 outline-none placeholder-emerald-300"
                />
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SINAIS VITAIS */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
             <h3 className="text-sm font-bold text-teal-800 uppercase flex items-center gap-2 mb-4 border-b pb-2">
                 <Activity size={18} /> Sinais Vitais
             </h3>
             
             <div className="grid grid-cols-2 gap-4 mb-4">
                 {renderVitalInput("Pressão Sistólica", "pas", "mmHg")}
                 {renderVitalInput("Pressão Diastólica", "pad", "mmHg")}
                 
                 {renderVitalInput(
                     "SATURAÇÃO (SPO2)", 
                     "spo2", 
                     "%", 
                     <Droplet size={12} className="text-cyan-500 fill-cyan-500" />
                 )}
                 
                 {renderVitalInput(
                     "FREQ. CARDÍACA", 
                     "fc", 
                     "bpm", 
                     <Heart size={12} className="text-rose-500" />
                 )}
                 
                 {renderVitalInput(
                     "TEMPERATURA", 
                     "temp", 
                     "°C", 
                     <Thermometer size={12} className="text-orange-500" />,
                     0.1 // Step decimal
                 )}
                 
                 {renderVitalInput(
                     "FREQ. RESPIRATÓRIA", 
                     "fr", 
                     "irpm", 
                     <Wind size={12} className="text-slate-500" />
                 )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                 <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Nível de Consciência</label>
                    <select 
                        value={vitals.consciousness}
                        onChange={e => setVitals(prev => ({...prev, consciousness: e.target.value as any}))}
                        className="w-full p-2 bg-white border border-slate-300 rounded font-bold text-sm focus:ring-2 focus:ring-teal-500 outline-none text-slate-700 h-[42px]"
                    >
                        <option value="Alert">Alerta (0)</option>
                        <option value="Confused">Confuso (1)</option>
                        <option value="Pain">Dor (2)</option>
                        <option value="Unresponsive">Não Responde (3)</option>
                    </select>
                 </div>
                 <div>
                     <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">O2 Suplementar?</label>
                     <div className="flex rounded overflow-hidden border border-slate-300 h-[42px]">
                        <button 
                           onClick={() => setVitals(prev => ({...prev, o2Sup: true}))}
                           className={`flex-1 text-xs font-bold transition-colors ${vitals.o2Sup ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >Sim</button>
                        <button 
                           onClick={() => setVitals(prev => ({...prev, o2Sup: false}))}
                           className={`flex-1 text-xs font-bold transition-colors ${!vitals.o2Sup ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                        >Não</button>
                     </div>
                 </div>
             </div>

             {/* DOR (ATUALIZADA) */}
             <div className="mb-4">
                 <label className="text-xs font-bold text-slate-800 block mb-3 uppercase">Dor</label>
                 <div className="flex items-center justify-between mb-3 h-10">
                    {painConfig ? (
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-md ${painConfig.color}`}>
                                {currentPainLevel}
                            </div>
                            <span className="font-bold text-slate-700 text-base uppercase">{painConfig.label}</span>
                        </div>
                    ) : (
                        <span className="text-sm text-slate-400 font-medium italic">Selecione o nível de dor</span>
                    )}
                    <PainIcon size={32} strokeWidth={2.5} className={painConfig ? painConfig.text : 'text-slate-300'} />
                 </div>
                 <div className="flex gap-1 h-10 w-full">
                     {Array.from({ length: 11 }, (_, i) => i).map((level) => {
                         const cfg = getPainConfig(level);
                         const isSelected = currentPainLevel === level;
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
             </div>
             
             {/* Observações */}
             <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700 uppercase mb-2">
                    <MessageSquare size={18} className="text-indigo-600" /> Observações Gerais
                </h3>
                <textarea 
                    value={observations}
                    onChange={e => setObservations(e.target.value)}
                    placeholder="Ex: Horário do ECG, Alergias, DPOC, etc..."
                    className="w-full bg-slate-800 border border-slate-700 rounded text-white text-sm p-3 focus:ring-2 focus:ring-teal-500 outline-none h-24 resize-none placeholder-slate-500"
                />
             </div>

          </div>

          {/* COLUNA DIREITA */}
          <div className="flex flex-col gap-6">
              
              {/* Avaliação de Sintomas (Collapsible) */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                 <button 
                    onClick={() => setIsSymptomsOpen(!isSymptomsOpen)}
                    className="w-full flex justify-between items-center p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                 >
                     <h3 className="text-sm font-bold text-rose-800 uppercase flex items-center gap-2">
                        <Stethoscope size={18} /> Avaliação de Sintomas
                     </h3>
                     {isSymptomsOpen ? <ChevronUp size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
                 </button>
                 
                 {isSymptomsOpen && (
                     <div className="p-4 bg-white h-96 overflow-y-auto custom-scrollbar">
                         
                         {/* SINAIS NEUROLÓGICOS */}
                         <div className="mb-5">
                            <h4 className="text-xs font-bold text-rose-700 uppercase mb-2 flex items-center gap-1 border-b border-rose-100 pb-1">
                                <Brain size={14}/> Sinais Neurológicos
                            </h4>
                            <div className="pl-1">
                                <SymptomCheck id="neuro_cefaleia" label='Cefaleia Súbita ("a mais forte da vida")' />
                                <SymptomCheck id="neuro_rima" label='Desvio de rima labial (boca torta)' />
                                <SymptomCheck id="neuro_vertigem" label='Vertigem súbita intensa ( Tontura )' />
                                <SymptomCheck id="neuro_forca" label='Perda de Força / Formigamento (Uni ou Bilateral)' />
                                <SymptomCheck id="neuro_fala" label='Alteração de fala (embolada, afasia)' />
                                <SymptomCheck id="neuro_visual" label='Alteração Visual Súbita (diplopia, turva)' />
                                <SymptomCheck id="neuro_marcha" label='Alteração de marcha / Desequilíbrio' />
                                <SymptomCheck id="neuro_consciencia" label='Rebaixamento súbito de consciência' />
                            </div>
                         </div>

                         {/* DOR TORÁCICA / SCA */}
                         <div className="mb-5">
                            <h4 className="text-xs font-bold text-rose-700 uppercase mb-2 flex items-center gap-1 border-b border-rose-100 pb-1">
                                <Activity size={14}/> Dor Torácica / SCA
                            </h4>
                            
                            {/* Grupo A */}
                            <div className="bg-rose-50 p-2 rounded mb-3 border border-rose-100">
                                <h5 className="text-[10px] font-bold text-rose-800 mb-2 uppercase">Sintomas Maiores (Grupo A)</h5>
                                <SymptomCheck id="sca_a_tipica" label='Dor torácica típica (aperto, peso, ardência)' />
                                <SymptomCheck id="sca_a_bracos" label='Dor irradiando para Braços (MMSS)' />
                                <SymptomCheck id="sca_a_pescoco" label='Dor irradiando para pescoço/mandíbula' />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h5 className="text-[10px] font-bold text-slate-500 mb-2 uppercase">Condicionais (Grupo B)</h5>
                                    <SymptomCheck id="sca_b_estomago" label='Dor no estômago (epigastralgia)' />
                                    <SymptomCheck id="sca_b_costas" label='Dor nas costas (interescapular)' />
                                </div>
                                <div>
                                    <h5 className="text-[10px] font-bold text-slate-500 mb-2 uppercase">Associados (Grupo C)</h5>
                                    <SymptomCheck id="sca_c_dispneia" label='Falta de Ar (Dispneia)' />
                                    <SymptomCheck id="sca_c_sudorese" label='Suor Frio (Sudorese)' />
                                    <SymptomCheck id="sca_c_palpitacao" label='Palpitação / Taquicardia' />
                                    <SymptomCheck id="sca_c_malsubito" label='Mal súbito / Angústia intensa' />
                                </div>
                            </div>
                         </div>

                         {/* INFECÇÃO / OUTROS */}
                         <div className="mb-2">
                            <h4 className="text-xs font-bold text-rose-700 uppercase mb-2 flex items-center gap-1 border-b border-rose-100 pb-1">
                                <Zap size={14}/> Infecção / Outros
                            </h4>
                            <div className="pl-1">
                                <SymptomCheck id="inf_infeccao" label='Infecção suspeita ou confirmada' />
                                <SymptomCheck id="inf_oliguria" label='Redução de diurese (Oligúria)' />
                            </div>
                         </div>

                     </div>
                 )}
              </div>
              
              {/* ALERTAS DE PROTOCOLO ATIVOS (Cartões Vermelhos) */}
              {activeProtocols.length > 0 ? (
                 <div className="space-y-3 animate-fade-in">
                   <h3 className="text-xs font-bold text-slate-400 uppercase">Alertas de Protocolo Ativos</h3>
                   {activeProtocols.map((alert, idx) => (
                     <div key={idx} className="bg-rose-600 text-white p-4 rounded-lg shadow-md border-l-4 border-rose-800 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                           <h4 className="font-black text-sm uppercase flex items-center gap-2 mb-2">
                              <AlertTriangle size={18} className="text-white fill-rose-600" />
                              POSSÍVEL PROTOCOLO DE {alert.type === 'dorToracica' ? 'DOR TORÁCICA' : alert.type.toUpperCase()}
                           </h4>
                           <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold border border-white/30">PRIORIDADE</span>
                        </div>
                        <ul className="list-disc list-inside text-xs font-medium space-y-0.5 opacity-90">
                           {alert.reason.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                     </div>
                   ))}
                 </div>
              ) : (
                <div className="bg-slate-50 border border-slate-100 p-4 rounded text-center text-xs text-slate-400 italic">
                  Nenhum protocolo de emergência detectado.
                </div>
              )}

              {/* RESULTADO NEWS (Footer in design) */}
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 flex-1 flex flex-col justify-end">
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">RESULTADO NEWS</h3>
                  
                  <div className={`p-6 rounded-lg text-center mb-2 transition-colors ${newsResult.riskClass === 'high' ? 'bg-rose-100 border border-rose-300' : newsResult.riskClass === 'medium' ? 'bg-yellow-100 border border-yellow-300' : 'bg-emerald-100 border border-emerald-300'}`}>
                      <h2 className={`text-2xl font-black uppercase ${newsResult.riskClass === 'high' ? 'text-rose-800' : newsResult.riskClass === 'medium' ? 'text-yellow-800' : 'text-emerald-800'}`}>
                          {newsResult.riskText}
                      </h2>
                      {newsResult.riskText !== 'AGUARDANDO DADOS' && (
                        <div className={`mt-3 pt-3 border-t ${newsResult.riskClass === 'high' ? 'border-rose-200 text-rose-900' : newsResult.riskClass === 'medium' ? 'border-yellow-200 text-yellow-900' : 'border-emerald-200 text-emerald-900'}`}>
                            <p className="font-bold text-lg leading-tight animate-fade-in">
                                {getNewsActionMessage(newsResult.score)}
                            </p>
                        </div>
                      )}
                  </div>
                  
                  <div className="text-center text-[10px] text-slate-400 font-mono mb-6">
                      Score: {newsResult.score}
                  </div>

                  <div className="flex gap-3">
                      <button 
                         onClick={handlePrint}
                         className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 px-4 rounded shadow flex items-center gap-2 text-sm"
                      >
                          <Printer size={18} /> Baixar PDF
                      </button>
                      <button 
                         onClick={handleSubmit}
                         disabled={isSubmitting}
                         className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-400 text-white font-bold py-3 px-4 rounded shadow flex items-center justify-center gap-2 text-sm uppercase transition-colors"
                      >
                         {isSubmitting ? 'Salvando...' : <><Save size={18} /> SALVAR AVALIAÇÃO INTERNAÇÃO</>}
                      </button>
                  </div>
              </div>

          </div>
      </div>
    </div>
  );
};