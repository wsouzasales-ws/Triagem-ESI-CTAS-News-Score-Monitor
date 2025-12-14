import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Monitor, Info, Volume2, VolumeX, RefreshCw, User, BedDouble, AlertTriangle } from 'lucide-react';
import { SheetRowData, InternationSheetRowData } from '../types';

interface Props {
  reportData: SheetRowData[];
  internationData?: InternationSheetRowData[];
  lastDashboardUpdate: Date | null;
  handleSyncFromSheet: () => void;
  isLoadingReports: boolean;
}

const STORAGE_KEY_NOTIFIED = 'app_notified_patients_v1';

// Arquivo de áudio WAV minúsculo e silencioso em Base64 para manter a thread de áudio ativa
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

const DashboardSection: React.FC<Props> = React.memo(({
  reportData,
  internationData = [],
  lastDashboardUpdate,
  handleSyncFromSheet,
  isLoadingReports
}) => {
  const [isAudioAlertEnabled, setIsAudioAlertEnabled] = useState(false);
  
  // CORREÇÃO: Inicialização Lazy do useRef para persistência
  const notifiedPatientsRef = useRef<Set<string> | null>(null);
  
  // NOVO: Ref para controlar IDs vistos nesta sessão (para evitar falar no Load)
  const sessionKnownIdsRef = useRef<Set<string>>(new Set());
  // NOVO: Ref para identificar a primeira carga de dados válida
  const isFirstLoadRef = useRef(true);
  // NOVO: Ref para o áudio silencioso (Keep Alive)
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  if (notifiedPatientsRef.current === null) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_NOTIFIED);
        notifiedPatientsRef.current = stored ? new Set(JSON.parse(stored)) : new Set();
      } catch (e) {
        notifiedPatientsRef.current = new Set();
      }
  }

  // Função auxiliar para salvar no navegador quem já foi anunciado
  const markAsNotified = (id: string) => {
      const currentSet = notifiedPatientsRef.current;
      if (!currentSet) return;
      
      currentSet.add(id);
      try {
          const arrayData = Array.from(currentSet);
          // Limita o histórico para não estourar a memória do navegador (mantém os últimos 500)
          if (arrayData.length > 500) {
              const trimmed = arrayData.slice(-500);
              notifiedPatientsRef.current = new Set(trimmed);
              localStorage.setItem(STORAGE_KEY_NOTIFIED, JSON.stringify(trimmed));
          } else {
              localStorage.setItem(STORAGE_KEY_NOTIFIED, JSON.stringify(arrayData));
          }
      } catch (e) {
          console.error("Erro ao salvar notificação local", e);
      }
  };

  // PARSER DE DATA REFORÇADO v27 + v28 (System Timestamp)
  const parseDateRobust = (dateStr: string, timeStr?: string) => {
    try {
      if (!dateStr) return null;
      let day = 0, month = 0, year = 0;
      
      const cleanDate = String(dateStr).trim().split(' ')[0];

      if (cleanDate.includes('/')) {
         const parts = cleanDate.split('/');
         day = parseInt(parts[0]);
         month = parseInt(parts[1]) - 1; 
         year = parseInt(parts[2]);
      } else if (cleanDate.includes('-')) {
         const parts = cleanDate.split('-');
         if (parts[0].length === 4) { 
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            day = parseInt(parts[2]);
         } else { 
            day = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            year = parseInt(parts[2]);
         }
      }

      if (year > 0 && year < 100) year += 2000;
      if (year === 0 || month < 0 || day === 0) return null;

      let hours = 0, minutes = 0, seconds = 0;

      if (timeStr) {
        const cleanTime = String(timeStr).trim();
        const isPM = cleanTime.toLowerCase().includes('pm');
        const isAM = cleanTime.toLowerCase().includes('am');
        const simpleTime = cleanTime.replace(/[^\d:]/g, '');
        const timeParts = simpleTime.split(':');
        
        if (timeParts.length >= 2) {
           hours = parseInt(timeParts[0]);
           minutes = parseInt(timeParts[1]);
           if (isPM && hours < 12) hours += 12;
           if (isAM && hours === 12) hours = 0;
        }
      } else if (dateStr.includes(' ')) {
          const timePart = dateStr.split(' ')[1];
          if (timePart) {
             const t = timePart.split(':');
             if (t.length >= 2) {
                hours = parseInt(t[0]);
                minutes = parseInt(t[1]);
                if (t.length > 2) seconds = parseInt(t[2]);
             }
          }
      }
      
      const d = new Date(year, month, day, hours, minutes, seconds);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      return null;
    }
  };

  const { triageList, internationList, isExtendedView } = useMemo(() => {
     // 1. Process Triage Data
     const now = new Date();
     const msInHour = 60 * 60 * 1000;
     const standardWindow = 12 * msInHour; 
     const extendedWindow = 24 * msInHour;

     const validTriageRows = reportData.map(row => {
        const parsedSystem = row.systemTimestamp ? parseDateRobust(row.systemTimestamp) : null;
        const parsedManual = parseDateRobust(row.evaluationDate, row.evaluationTime);
        const finalDate = parsedSystem || parsedManual;
        return { ...row, _parsedDate: finalDate };
     }).filter(r => r._parsedDate !== null);

     const validInternationRows = internationData.map(row => {
        const parsedSystem = row.systemTimestamp ? parseDateRobust(row.systemTimestamp) : null;
        const parsedManual = parseDateRobust(row.evaluationDate, row.evaluationTime);
        const finalDate = parsedSystem || parsedManual;
        return { ...row, _parsedDate: finalDate };
     }).filter(r => r._parsedDate !== null);

     const sortFn = (a: any, b: any) => {
        // @ts-ignore
        return b._parsedDate.getTime() - a._parsedDate.getTime();
     };

     // Filter Logic
     // @ts-ignore
     let triageFiltered = validTriageRows.filter(r => (now.getTime() - r._parsedDate.getTime()) <= standardWindow && (now.getTime() - r._parsedDate.getTime()) >= 0);
     // @ts-ignore
     let internationFiltered = validInternationRows.filter(r => (now.getTime() - r._parsedDate.getTime()) <= standardWindow && (now.getTime() - r._parsedDate.getTime()) >= 0);

     let extended = false;

     if (triageFiltered.length === 0 && validTriageRows.length > 0) {
        // @ts-ignore
        const ext = validTriageRows.filter(r => (now.getTime() - r._parsedDate.getTime()) <= extendedWindow);
        if (ext.length > 0) {
            triageFiltered = ext;
            extended = true;
        }
     }

     return { 
         triageList: triageFiltered.sort(sortFn), 
         internationList: internationFiltered.sort(sortFn),
         isExtendedView: extended 
     };

  }, [reportData, internationData, lastDashboardUpdate]);

  // Helper para extrair Protocolos da string de observação (Internação)
  const getProtocolsFromObs = (obs: string) => {
    if (!obs) return [];
    const matches = obs.match(/\[PROTOCOLO\s+([^\]]+)\]/g);
    if (!matches) return [];
    return matches.map(m => m.replace('[PROTOCOLO ', '').replace(']', ''));
  };

  // Helper para detectar Protocolo na Triagem via discriminadores
  const detectTriageProtocolName = (discriminators: string) => {
    const d = (discriminators || '').toUpperCase();
    if (d.includes('SEPSE') || d.includes('INFECCAO') || d.includes('SIRS')) return 'Sepse';
    if (d.includes('DOR TORACICA') || d.includes('TORÁCICA') || d.includes('SCA')) return 'Dor Torácica';
    if (d.includes('AVC') || d.includes('NEURO')) return 'AVC';
    if (d.includes('DOR INTENSA') || d.includes('DOR SEVERA')) return 'Dor Intensa';
    return null;
  };

  // --- EFEITO: KEEP ALIVE AUDIO (BACKGROUND MODE) ---
  useEffect(() => {
    if (isAudioAlertEnabled) {
        // Cria e toca um áudio silencioso em loop infinito.
        // Isso força o navegador a tratar a aba como "Reproduzindo Mídia" (Igual YouTube),
        // impedindo o congelamento da aba e da API de Voz (SpeechSynthesis) quando minimizado.
        if (!silentAudioRef.current) {
            const audio = new Audio(SILENT_AUDIO_URI);
            audio.loop = true;
            audio.volume = 0.01; // Volume mínimo para ser considerado "ativo" pelo sistema
            silentAudioRef.current = audio;
        }
        
        const playPromise = silentAudioRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Autoplay bloqueado. O usuário precisa interagir com a página primeiro.", error);
            });
        }
    } else {
        // Se desativar o alerta, pausa o Keep Alive para economizar recursos
        if (silentAudioRef.current) {
            silentAudioRef.current.pause();
        }
    }

    return () => {
        if (silentAudioRef.current) {
            silentAudioRef.current.pause();
        }
    };
  }, [isAudioAlertEnabled]);

  // --- ALERTA SONORO INTELIGENTE (LIMITADO AOS 2 ÚLTIMOS + IGNORA LOAD INICIAL) ---
  useEffect(() => {
    // 1. COMBINAR AS LISTAS E ORDENAR POR DATA (Mais recentes primeiro)
    const combinedPatients = [
        ...triageList.map(p => ({ ...p, type: 'TRIAGE' })),
        ...internationList.map(p => ({ ...p, type: 'INTERNATION' }))
    ];

    // Se não há pacientes, não faz nada
    if (combinedPatients.length === 0) return;

    // Ordenação Decrescente de Data (Newest First)
    combinedPatients.sort((a, b) => {
        // @ts-ignore
        return b._parsedDate.getTime() - a._parsedDate.getTime();
    });

    // 2. PEGAR APENAS OS TOP 2 (Evita falar todo mundo que está na tela)
    const topCandidates = combinedPatients.slice(0, 2);

    // --- LÓGICA DE PRIMEIRA CARGA (SILENCIOSA) ---
    if (isFirstLoadRef.current) {
        // Registra os pacientes iniciais como "já conhecidos nesta sessão" para não falar
        topCandidates.forEach(patient => {
            // @ts-ignore
            const rawId = patient.medicalRecord;
            // @ts-ignore
            const uniqueId = patient.type === 'INTERNATION' ? rawId + '_INT' : rawId;
            sessionKnownIdsRef.current.add(uniqueId);
        });
        
        // Marca que a primeira carga já aconteceu
        isFirstLoadRef.current = false;
        return; // ENCERRA AQUI PARA NÃO FALAR
    }

    if (!isAudioAlertEnabled) return;

    const notifiedSet = notifiedPatientsRef.current;
    if (!notifiedSet) return;

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            // Não cancela aqui para permitir fila se houver múltiplos alertas
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'pt-BR';
            window.speechSynthesis.speak(utterance);
        }
    };

    topCandidates.forEach(patient => {
         // ID único para controle
         // @ts-ignore
         const rawId = patient.medicalRecord;
         // @ts-ignore
         const uniqueId = patient.type === 'INTERNATION' ? rawId + '_INT' : rawId;
         
         // 1. SE JÁ FOI NOTIFICADO NO PASSADO (localStorage), PULA
         if (notifiedSet.has(uniqueId)) return;

         // 2. SE JÁ ESTAVA PRESENTE NO INICIO DA SESSÃO (Load Inicial), PULA
         if (sessionKnownIdsRef.current.has(uniqueId)) return;

         let alertMessage = '';
         let shouldNotify = false;

         // Lógica Específica por Tipo
         // @ts-ignore
         if (patient.type === 'TRIAGE') {
             // Check Protocolo (Prioridade)
             // @ts-ignore
             const protocolName = detectTriageProtocolName(patient.discriminators || '');
             if (protocolName) {
                 alertMessage = `Atenção. Paciente ${patient.name}. Possível protocolo de ${protocolName}.`;
                 shouldNotify = true;
             } else {
                 // Check ESI Critico
                 // @ts-ignore
                 const esiStr = String(patient.esiLevel).replace(/\D/g, '');
                 const esi = parseInt(esiStr);
                 if (esi === 1 || esi === 2) {
                     alertMessage = `Atenção. Paciente ${patient.name}. Classificação ESI ${esi}.`;
                     shouldNotify = true;
                 }
             }
         } 
         // @ts-ignore
         else if (patient.type === 'INTERNATION') {
             // @ts-ignore
             const protocols = getProtocolsFromObs(patient.observations || '');
             if (protocols.length > 0) {
                 const protoName = protocols[0].toLowerCase();
                 alertMessage = `Atenção. Paciente ${patient.name}. Possível protocolo de ${protoName}.`;
                 shouldNotify = true;
             } else {
                 // Check NEWS Alto
                 // @ts-ignore
                 const score = parseInt(patient.newsScore) || 0;
                 if (score >= 5) {
                     alertMessage = `Atenção. Paciente ${patient.name}. Deterioração Clínica identificada.`;
                     shouldNotify = true;
                 }
             }
         }

         if (shouldNotify && alertMessage) {
             speak(alertMessage);
             markAsNotified(uniqueId); // Salva no localStorage (Global)
             sessionKnownIdsRef.current.add(uniqueId); // Salva na Sessão (Local)
         }
    });

  }, [triageList, internationList, isAudioAlertEnabled]);

  const getEsiColor = (levelStr: any) => {
    const level = String(levelStr).replace(/['"]/g, '').trim();
    switch(level) {
      case '1': return 'bg-red-600 text-white border-red-700';
      case '2': return 'bg-orange-500 text-white border-orange-600';
      case '3': return 'bg-yellow-400 text-slate-900 border-yellow-500';
      case '4': return 'bg-green-600 text-white border-green-700';
      case '5': return 'bg-blue-500 text-white border-blue-600';
      default: return 'bg-slate-200 text-slate-700 border-slate-300';
    }
  };

  const getNewsColor = (scoreStr: any) => {
     const score = parseInt(scoreStr) || 0;
     if (score >= 5) return 'bg-rose-100 text-rose-700 border-rose-200';
     if (score > 0) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
     return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const getNewsBadge = (scoreStr: any) => {
    const score = parseInt(scoreStr) || 0;
    if (score >= 7) return 'bg-rose-600 text-white'; // Critical
    if (score >= 5) return 'bg-rose-500 text-white'; // High
    if (score >= 1) return 'bg-yellow-400 text-slate-900'; // Medium
    return 'bg-emerald-500 text-white'; // Low
  };

  // Formata o nome do protocolo para exibição amigável
  const formatProtocolName = (rawName: string) => {
    const n = rawName.toUpperCase().trim();
    if (n === 'DORTORACICA') return 'DOR TORÁCICA';
    if (n === 'DOR') return 'DOR INTENSA';
    return n;
  };

  // Helper para separar discriminadores (string única separada por ;)
  const getDiscriminatorList = (discStr: string) => {
    if (!discStr) return [];
    // Separa por ; e remove espaços extras
    return discStr.split(';').map(s => s.trim()).filter(s => s.length > 0);
  };

  // --- SUB-COMPONENT: Vital Grid Item ---
  const VitalItem = ({ label, value, unit, alert = false }: { label: string, value: string, unit?: string, alert?: boolean }) => (
    <div className={`bg-white rounded p-1.5 shadow-sm flex flex-col justify-center items-center border ${alert ? 'border-rose-300 bg-rose-50' : 'border-slate-100'}`}>
        <span className="block text-[9px] text-slate-400 font-bold uppercase leading-tight">{label}</span>
        <span className={`leading-tight font-bold text-sm ${alert ? 'text-rose-700' : 'text-slate-700'}`}>{value || '-'}</span>
        {unit && <span className="block text-[8px] text-slate-400 font-normal leading-tight">{unit}</span>}
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in pb-10 h-full flex flex-col">
        {/* HEADER BAR */}
        <div className="bg-indigo-900 text-white p-3 rounded-lg shadow-md flex justify-between items-center shrink-0">
            <div>
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Monitor className="text-teal-400"/> GESTÃO À VISTA
                </h2>
                <div className="flex items-center gap-2">
                    <p className="text-indigo-200 text-xs">
                    Monitoramento em Tempo Real (Últimas 12h)
                    </p>
                    {isExtendedView && (
                        <span className="bg-yellow-400 text-indigo-900 px-2 py-0.5 rounded font-bold text-[10px] flex items-center gap-1">
                            <Info size={10}/> 24h
                        </span>
                    )}
                </div>
                <p className="text-[9px] text-indigo-300 italic">
                  * Filtro base: Horário de Inclusão no sistema | Ordenação: Data/Hora Clínica
                </p>
            </div>
            <div className="text-right flex items-center gap-4">
                 <button 
                      onClick={() => setIsAudioAlertEnabled(!isAudioAlertEnabled)}
                      className={`p-2 rounded-full transition-all shadow-sm border ${
                        isAudioAlertEnabled 
                        ? 'bg-rose-600 border-rose-500 text-white animate-pulse' 
                        : 'bg-indigo-800 border-indigo-700 text-indigo-300 hover:bg-indigo-700'
                      }`}
                      title={isAudioAlertEnabled ? "Desativar Alerta Sonoro" : "Ativar Alerta Sonoro"}
                    >
                      {isAudioAlertEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button onClick={handleSyncFromSheet} disabled={isLoadingReports} className="text-indigo-300 hover:text-white transition-colors">
                    <RefreshCw size={20} className={isLoadingReports ? "animate-spin" : ""} />
                </button>
                <div className="border-l border-indigo-700 pl-4">
                    <p className="font-mono text-2xl font-bold leading-none">{lastDashboardUpdate ? lastDashboardUpdate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p>
                </div>
            </div>
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-[600px]">
            
            {/* COLUNA ESQUERDA: ACOLHIMENTO (TRIAGEM) */}
            <div className="bg-slate-200/50 p-2 rounded-lg border border-slate-300 flex flex-col h-full overflow-hidden">
                <div className="bg-orange-600 text-white p-2 rounded-t-lg font-bold text-center uppercase tracking-wide text-sm flex items-center justify-center gap-2 shrink-0 shadow-sm">
                    <User size={16}/> TRIAGEM
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                    {triageList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
                           <User size={32} className="mb-2 opacity-20"/>
                           Sem pacientes em triagem
                        </div>
                    ) : (
                        triageList.map((row, i) => (
                            <div key={i} className="bg-white rounded-lg shadow-sm border-l-4 border-l-orange-500 border border-slate-200 overflow-hidden relative">
                                <div className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-lg leading-tight flex items-center gap-2">
                                                {row.name}
                                                {/* FLAG DE REAVALIAÇÃO */}
                                                {String(row.isReevaluation).toUpperCase() === 'SIM' && (
                                                    <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-bold flex items-center gap-1">
                                                        <RefreshCw size={10} /> REAVALIAÇÃO
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">AT: {row.medicalRecord} • <span className="font-bold text-slate-700">{row.evaluationTime}</span></p>
                                        </div>
                                        <div className={`w-12 h-12 flex flex-col items-center justify-center rounded border ${getEsiColor(row.esiLevel)}`}>
                                            <span className="text-[9px] font-bold uppercase leading-none mt-1">ESI</span>
                                            <span className="text-2xl font-black leading-none">{String(row.esiLevel).replace("'","")}</span>
                                        </div>
                                    </div>
                                    
                                    {row.vitals ? (
                                        <div className="grid grid-cols-6 gap-1 bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                                            <VitalItem label="PA" value={row.vitals.pa} unit="" />
                                            <VitalItem label="FC" value={row.vitals.fc} unit="bpm" />
                                            <VitalItem label="FR" value={row.vitals.fr} unit="irpm" />
                                            <VitalItem label="TEMP" value={row.vitals.temp} unit="°C" />
                                            <VitalItem label="SPO2" value={row.vitals.spo2} unit="%" />
                                            <VitalItem label="DOR" value={row.vitals.pain} />
                                        </div>
                                    ) : <div className="text-xs text-slate-400 italic mb-2">Sinais vitais não registrados</div>}
                                    
                                    {/* ALERTS SECTION (Discriminators - Flag Preto) */}
                                    {row.discriminators && (
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                            {getDiscriminatorList(row.discriminators).map((disc, idx) => (
                                                <span key={idx} className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold uppercase inline-flex items-center gap-1.5 animate-pulse border border-slate-700 shadow-sm max-w-full">
                                                    <AlertTriangle size={12} className="text-yellow-400 shrink-0"/>
                                                    <span className="whitespace-normal text-left leading-tight">{disc}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {row.complaint && !row.discriminators && (
                                         <div className="bg-yellow-50 text-yellow-800 border border-yellow-100 text-[10px] p-1.5 rounded flex items-start gap-1 mt-1">
                                            <Info size={12} className="shrink-0 mt-0.5"/>
                                            <span className="uppercase line-clamp-1">{row.complaint}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* COLUNA DIREITA: INTERNAÇÃO */}
            <div className="bg-slate-200/50 p-2 rounded-lg border border-slate-300 flex flex-col h-full overflow-hidden">
                <div className="bg-emerald-600 text-white p-2 rounded-t-lg font-bold text-center uppercase tracking-wide text-sm flex items-center justify-center gap-2 shrink-0 shadow-sm">
                    <BedDouble size={16}/> INTERNAÇÃO
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                    {internationList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
                           <BedDouble size={32} className="mb-2 opacity-20"/>
                           Sem pacientes internados avaliados
                        </div>
                    ) : (
                         internationList.map((row, i) => {
                             const protocols = getProtocolsFromObs(row.observations || '');
                             
                             return (
                                <div key={i} className="bg-white rounded-lg shadow-sm border-l-4 border-l-emerald-500 border border-slate-200 overflow-hidden relative">
                                    <div className="p-3">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-lg leading-tight flex items-center gap-2">
                                                    {row.name}
                                                    {/* FLAG DE REAVALIAÇÃO */}
                                                    {String(row.isReevaluation).toUpperCase() === 'SIM' && (
                                                        <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-bold flex items-center gap-1">
                                                            <RefreshCw size={10} /> REAVALIAÇÃO
                                                        </span>
                                                    )}
                                                </h3>
                                                <p className="text-xs text-slate-500 font-mono mt-0.5">
                                                    AT: {row.medicalRecord} • <span className="font-bold text-slate-700">{row.evaluationTime}</span>
                                                </p>
                                                
                                                {/* LOCALIZAÇÃO (SETOR / LEITO) EM DESTAQUE */}
                                                {(row.sector || row.bed) && (
                                                    <div className="mt-1.5 mb-0.5">
                                                        <span className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">
                                                            <BedDouble size={14} className="text-blue-600"/>
                                                            {row.sector} &nbsp;•&nbsp; LEITO {row.bed}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className={`w-12 h-12 flex flex-col items-center justify-center rounded border shadow-sm ${getNewsBadge(row.newsScore)}`}>
                                                <span className="text-[8px] font-bold uppercase leading-none mt-1 opacity-80">NEWS</span>
                                                <span className="text-2xl font-black leading-none">{row.newsScore}</span>
                                            </div>
                                        </div>
                                        
                                        {row.vitals ? (
                                            <div className="grid grid-cols-6 gap-1 bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                                                <VitalItem label="PA" value={`${row.vitals.pas}x${row.vitals.pad}`} unit="" />
                                                <VitalItem label="FC" value={row.vitals.fc} unit="bpm" />
                                                <VitalItem label="FR" value={row.vitals.fr} unit="irpm" />
                                                <VitalItem label="TEMP" value={row.vitals.temp} unit="°C" />
                                                <VitalItem label="SPO2" value={row.vitals.spo2} unit="%" />
                                                <VitalItem label="O2" value={row.vitals.o2Sup} />
                                            </div>
                                        ) : <div className="text-xs text-slate-400 italic mb-2">Sinais vitais não registrados</div>}
                                        
                                        {/* ALERTS SECTION (NEWS Risk) */}
                                        <div className={`text-[10px] p-1.5 rounded flex items-start gap-1 font-bold uppercase ${getNewsColor(row.newsScore)}`}>
                                            <Info size={12} className="shrink-0 mt-0.5"/>
                                            <span>{row.riskText || 'Sem Classificação'}</span>
                                        </div>
                                        
                                        {/* PROTOCOLS SECTION (Flags Pretas) - COM PISCA PISCA */}
                                        {protocols.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                {protocols.map((p, idx) => (
                                                    <span key={idx} className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded font-bold uppercase inline-flex items-center gap-1.5 animate-pulse border border-slate-700 shadow-sm max-w-full">
                                                        <AlertTriangle size={12} className="text-yellow-400 shrink-0"/>
                                                        <span className="whitespace-normal text-left leading-tight">{formatProtocolName(p)}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Observações relevantes - QUEBRA DE TEXTO ATIVADA */}
                                        {row.observations && (
                                            <div className="mt-1 text-[9px] text-slate-500 italic border-t border-slate-100 pt-1 whitespace-normal break-words leading-tight">
                                                Obs: {row.observations}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

        </div>
    </div>
  );
});

export default DashboardSection;