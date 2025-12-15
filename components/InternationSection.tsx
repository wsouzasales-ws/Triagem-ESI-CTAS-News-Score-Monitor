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
                            <div className="flex items-center gap-0.5 text-[10px] font-bold text-slate-700