import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Monitor, Info, Volume2, VolumeX, RefreshCw, User, BedDouble, AlertTriangle, Clock } from 'lucide-react';
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
  
  const notifiedPatientsRef = useRef<Set<string> | null>(null);
  const sessionKnownIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  
  if (notifiedPatientsRef.current === null) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_NOTIFIED);
        notifiedPatientsRef.current = stored ? new Set(JSON.parse(stored)) : new Set();
      } catch (e) {
        notifiedPatientsRef.current = new Set();
      }
  }

  const markAsNotified = (id: string) => {
      const currentSet = notifiedPatientsRef.current;
      if (!currentSet) return;
      
      currentSet.add(id);
      try {
          const arrayData = Array.from(currentSet);
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
     const now = new Date();
     const msInHour = 60 * 60 * 1000;
     const standardWindow = 12 * msInHour; 
     const extendedWindow = 24 * msInHour;
     const TIMEZONE_BUFFER = 5 * msInHour; 

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

     // @ts-ignore
     let triageFiltered = validTriageRows.filter(r => {
        // @ts-ignore
        const diff = now.getTime() - r._parsedDate.getTime();
        return diff <= standardWindow && diff >= -TIMEZONE_BUFFER;
     });
     
     // @ts-ignore
     let internationFiltered = validInternationRows.filter(r => {
        // @ts-ignore
        const diff = now.getTime() - r._parsedDate.getTime();
        return diff <= standardWindow && diff >= -TIMEZONE_BUFFER;
     });

     let extended = false;

     if (triageFiltered.length === 0 && validTriageRows.length > 0) {
        // @ts-ignore
        const ext = validTriageRows.filter(r => {
             // @ts-ignore
             const diff = now.getTime() - r._parsedDate.getTime();
             return diff <= extendedWindow && diff >= -TIMEZONE_BUFFER;
        });
        
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

  const getProtocolsFromObs = (obs: string) => {
    if (!obs) return [];
    const matches = obs.match(/\[PROTOCOLO\s+([^\]]+)\]/g);
    if (!matches) return [];
    return matches.map(m => m.replace('[PROTOCOLO ', '').replace(']', ''));
  };

  const detectTriageProtocolName = (discriminators: string) => {
    const d = (discriminators || '').toUpperCase();
    if (d.includes('SEPSE') || d.includes('INFECCAO') || d.includes('SIRS')) return 'Sepse';
    if (d.includes('DOR TORACICA') || d.includes('TORÁCICA') || d.includes('SCA')) return 'Dor Torácica';
    if (d.includes('AVC') || d.includes('NEURO')) return 'AVC';
    if (d.includes('DOR INTENSA') || d.includes('DOR SEVERA')) return 'Dor Intensa';
    return null;
  };

  useEffect(() => {
    if (isAudioAlertEnabled) {
        if (!silentAudioRef.current) {
            const audio = new Audio(SILENT_AUDIO_URI);
            audio.loop = true;
            audio.volume = 0.01;
            silentAudioRef.current = audio;
        }
        const playPromise = silentAudioRef.current.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.warn("Autoplay bloqueado.", error);
            });
        }
    } else {
        if (silentAudioRef.current) {
            silentAudioRef.current.pause();
        }
    }
    return () => {
        if (silentAudioRef.current) silentAudioRef.current.pause();
    };
  }, [isAudioAlertEnabled]);

  useEffect(() => {
    const combinedPatients = [
        ...triageList.map(p => ({ ...p, type: 'TRIAGE' })),
        ...internationList.map(p => ({ ...p, type: 'INTERNATION' }))
    ];

    if (combinedPatients.length === 0) return;

    combinedPatients.sort((a, b) => {
        // @ts-ignore
        return b._parsedDate.getTime() - a._parsedDate.getTime();
    });

    const topCandidates = combinedPatients.slice(0, 2);

    if (isFirstLoadRef.current) {
        topCandidates.forEach(patient => {
            // @ts-ignore
            const rawId = patient.medicalRecord;
            // @ts-ignore
            const uniqueId = patient.type === 'INTERNATION' ? rawId + '_INT' : rawId;
            sessionKnownIdsRef.current.add(uniqueId);
        });
        isFirstLoadRef.current = false;
        return;
    }

    if (!isAudioAlertEnabled) return;

    const notifiedSet = notifiedPatientsRef.current;
    if (!notifiedSet) return;

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'pt-BR';
            window.speechSynthesis.speak(utterance);
        }
    };

    topCandidates.forEach(patient => {
         // @ts-ignore
         const rawId = patient.medicalRecord;
         // @ts-ignore
         const uniqueId = patient.type === 'INTERNATION' ? rawId + '_INT' : rawId;
         
         if (notifiedSet.has(uniqueId)) return;
         if (sessionKnownIdsRef.current.has(uniqueId)) return;

         let alertMessage = '';
         let shouldNotify = false;

         // @ts-ignore
         if (patient.type === 'TRIAGE') {
             // @ts-ignore
             const protocolName = detectTriageProtocolName(patient.discriminators || '');
             if (protocolName) {
                 // @ts-ignore
                 alertMessage = `Atenção. Paciente ${patient.name}. Possível protocolo de ${protocolName}.`;
                 shouldNotify = true;
             } else {
                 // @ts-ignore
                 const esiStr = String(patient.esiLevel).replace(/\D/g, '');
                 const esi = parseInt(esiStr);
                 if (esi === 1 || esi === 2) {
                     // @ts-ignore
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
                 // @ts-ignore
                 alertMessage = `Atenção. Paciente ${patient.name}. Possível protocolo de ${protoName}.`;
                 shouldNotify = true;
             } else {
                 // @ts-ignore
                 const score = parseInt(patient.newsScore) || 0;
                 if (score >= 5) {
                     // @ts-ignore
                     alertMessage = `Atenção. Paciente ${patient.name}. Deterioração Clínica identificada.`;
                     shouldNotify = true;
                 }
             }
         }

         if (shouldNotify && alertMessage) {
             speak(alertMessage);
             markAsNotified(uniqueId);
             sessionKnownIdsRef.current.add(uniqueId);
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

  const getNewsBadgeColor = (scoreStr: any) => {
    const score = parseInt(scoreStr) || 0;
    if (score >= 7) return 'bg-rose-500 text-white'; // Critical
    if (score >= 5) return 'bg-amber-400 text-slate-900'; // High/Medium High (Yellow/Gold in image)
    if (score >= 1) return 'bg-yellow-200 text-yellow-800'; // Medium
    return 'bg-emerald-500 text-white'; // Low
  };

  const getDiscriminatorList = (discStr: string) => {
    if (!discStr) return [];
    return discStr.split(';').map(s => s.trim()).filter(s => s.length > 0);
  };

  const VitalItem = ({ label, value, unit, alert = false }: { label: string, value: string, unit?: string, alert?: boolean }) => (
    <div className={`bg-white rounded p-1.5 shadow-sm flex flex-col justify-center items-center border ${alert ? 'border-rose-300 bg-rose-50' : 'border-slate-100'}`}>
        <span className="block text-[9px] text-slate-400 font-bold uppercase leading-tight">{label}</span>
        <span className={`leading-tight font-bold text-sm ${alert ? 'text-rose-700' : 'text-slate-700'}`}>{value || '-'}</span>
        {unit && <span className="block text-[8px] text-slate-400 font-normal leading-tight">{unit}</span>}
    </div>
  );

  // New Component to match the skeleton image for Internation Vitals
  const VitalBox = ({ label, value, unit, className = '' }: { label: string, value: string | React.ReactNode, unit?: string, className?: string }) => (
    <div className={`flex flex-col items-center justify-center bg-white border border-slate-100 rounded-md p-2 h-20 shadow-sm ${className}`}>
        <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">{label}</span>
        <div className="font-bold text-xl text-slate-800 leading-none mb-1">
             {value || '-'}
        </div>
        <span className="text-[10px] text-slate-400 font-medium">{unit}</span>
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
                                                {String(row.isReevaluation).toUpperCase() === 'SIM' && (
                                                    <span className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-bold flex items-center gap-1">
                                                        <RefreshCw size={10} /> REAVALIAÇÃO
                                                    </span>
                                                )}
                                            </h3>
                                            <p className="text-xs text-slate-500 font-mono mt-0.5">PRONT: {row.medicalRecord} • <span className="font-bold text-slate-700">{row.evaluationTime}</span></p>
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
                                            <span className="uppercase whitespace-normal break-words leading-tight">{row.complaint}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* COLUNA DIREITA: INTERNAÇÃO (Design Atualizado Conforme Imagem) */}
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
                             const score = parseInt(row.newsScore) || 0;
                             const isHighRisk = score >= 5 || (row.riskText || '').toUpperCase().includes('POSSÍVEL DETERIORAÇÃO');

                             return (
                                <div key={i} className={`bg-white rounded-lg shadow-md border ${isHighRisk ? 'border-l-4 border-l-rose-500' : 'border border-slate-200'} overflow-hidden relative font-sans`}>
                                    
                                    <div className="p-4">
                                        {/* Header Row: Name, Pront, Time, Badge */}
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1">
                                                    {row.name}
                                                </h3>
                                                <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                                                    <span>PRONT: {row.medicalRecord}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{row.evaluationTime}</span>
                                                </div>
                                            </div>
                                            
                                            {/* NEWS Badge (Top Right) */}
                                            <div className={`px-3 py-2 rounded-md shadow-sm flex flex-col items-center justify-center min-w-[60px] ${getNewsBadgeColor(row.newsScore)}`}>
                                                <span className="text-[10px] font-bold uppercase leading-none opacity-80">NEWS</span>
                                                <span className="text-2xl font-black leading-none">{row.newsScore}</span>
                                            </div>
                                        </div>

                                        {/* Location Pill */}
                                        {(row.sector || row.bed) && (
                                            <div className="mb-4 inline-block">
                                                <div className="bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1.5 rounded-md text-xs font-bold uppercase flex items-center gap-1.5 shadow-sm">
                                                    <BedDouble size={14}/>
                                                    {row.sector || 'SETOR'} {row.bed ? `• LEITO ${row.bed}` : ''}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Vitals Grid (Box Style) */}
                                        {row.vitals ? (
                                            <div className="grid grid-cols-6 gap-2 mb-4">
                                                <VitalBox label="PA" value={`${row.vitals.pas}x${row.vitals.pad}`} unit="" className="col-span-1" />
                                                <VitalBox label="FC" value={row.vitals.fc} unit="bpm" />
                                                <VitalBox label="FR" value={row.vitals.fr} unit="irpm" />
                                                <VitalBox label="TEMP" value={row.vitals.temp} unit="°C" />
                                                <VitalBox label="SPO2" value={row.vitals.spo2} unit="%" />
                                                <VitalBox label="O2" value={row.vitals.o2Sup} unit="" />
                                            </div>
                                        ) : <div className="text-xs text-slate-400 italic mb-2">Sinais vitais não registrados</div>}
                                        
                                        {/* Alert Banner (Full Width) */}
                                        {isHighRisk && (
                                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 flex items-center gap-3 mb-2 animate-pulse">
                                                <AlertTriangle className="text-yellow-600 shrink-0" size={20} />
                                                <span className="text-sm font-bold text-yellow-800 uppercase tracking-wide">
                                                    POSSÍVEL DETERIORAÇÃO CLÍNICA
                                                </span>
                                            </div>
                                        )}

                                        {/* Observations (Bottom Italic) */}
                                        {row.observations && (
                                            <div className="text-[11px] text-slate-500 italic mt-1 leading-tight">
                                                Obs: {row.observations.replace(/\[.*?\]/g, '').trim()}
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