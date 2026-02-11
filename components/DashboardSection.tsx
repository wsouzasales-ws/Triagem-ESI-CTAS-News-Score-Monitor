
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Monitor, Info, Volume2, VolumeX, RefreshCw, User, BedDouble, AlertTriangle, FileText } from 'lucide-react';
import { SheetRowData, InternationSheetRowData } from '../types';

interface Props {
  reportData: SheetRowData[];
  internationData?: InternationSheetRowData[];
  lastDashboardUpdate: Date | null;
  handleSyncFromSheet: () => void;
  isLoadingReports: boolean;
}

const STORAGE_KEY_NOTIFIED = 'app_notified_patients_v1';
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
      } catch (e) { console.error("Erro ao salvar notificação local", e); }
  };

  const formatDateDisplay = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) {
            const [y, m, d] = parts;
            return `${d}/${m}/${y}`;
        }
    }
    return dateStr;
  };

  const parseDateRobust = (dateStr: string | undefined, timeStr?: string) => {
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
      let hours = 0, minutes = 0;
      if (timeStr) {
        const timeParts = timeStr.trim().replace(/[^\d:]/g, '').split(':');
        if (timeParts.length >= 2) {
           hours = parseInt(timeParts[0]);
           minutes = parseInt(timeParts[1]);
        }
      } else if (dateStr.includes(' ')) {
          const timePart = dateStr.split(' ')[1];
          const t = timePart.split(':');
          if (t.length >= 2) {
             hours = parseInt(t[0]);
             minutes = parseInt(t[1]);
          }
      }
      const d = new Date(year, month, day, hours, minutes);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
  };

  const { triageList, internationList, isExtendedView } = useMemo(() => {
     const now = new Date();
     const msInHour = 60 * 60 * 1000;
     const standardWindow = 12 * msInHour; 
     const extendedWindow = 24 * msInHour;
     const TIMEZONE_BUFFER = 5 * msInHour; 

     const validTriageRows = reportData.map(row => ({ ...row, _parsedDate: parseDateRobust(row.systemTimestamp) || parseDateRobust(row.evaluationDate, row.evaluationTime) })).filter(r => r._parsedDate !== null);
     const validInternationRows = internationData.map(row => ({ ...row, _parsedDate: parseDateRobust(row.systemTimestamp) || parseDateRobust(row.evaluationDate, row.evaluationTime) })).filter(r => r._parsedDate !== null);
     const sortFn = (a: any, b: any) => (b._parsedDate?.getTime() || 0) - (a._parsedDate?.getTime() || 0);

     let triageFiltered = validTriageRows.filter(r => {
        const diff = now.getTime() - (r._parsedDate?.getTime() || 0);
        return diff <= standardWindow && diff >= -TIMEZONE_BUFFER;
     });
     let internationFiltered = validInternationRows.filter(r => {
        const diff = now.getTime() - (r._parsedDate?.getTime() || 0);
        return diff <= standardWindow && diff >= -TIMEZONE_BUFFER;
     });
     let extended = false;
     if (triageFiltered.length === 0 && validTriageRows.length > 0) {
        const ext = validTriageRows.filter(r => {
             const diff = now.getTime() - (r._parsedDate?.getTime() || 0);
             return diff <= extendedWindow && diff >= -TIMEZONE_BUFFER;
        });
        if (ext.length > 0) { triageFiltered = ext; extended = true; }
     }
     return { triageList: triageFiltered.sort(sortFn), internationList: internationFiltered.sort(sortFn), isExtendedView: extended };
  }, [reportData, internationData, lastDashboardUpdate]);

  const getProtocolsFromObs = (obs: string) => {
    if (!obs) return [];
    const matches = obs.match(/\[PROTOCOLO\s+([^\]]+)\]/g);
    return matches ? matches.map(m => m.replace('[PROTOCOLO ', '').replace(']', '')) : [];
  };

  const cleanObservations = (obs: string, hgt?: string) => {
      let clean = obs ? obs.replace(/\[PROTOCOLO[^\]]+\]/g, '').trim() : '';
      if (hgt && hgt.trim()) {
          const hgtText = `DEXTRO: ${hgt.trim()} mg/dL`;
          clean = clean ? `${clean} | ${hgtText}` : hgtText;
      }
      return clean;
  };

  const detectTriageProtocolName = (discriminators: string) => {
    const d = (discriminators || '').toUpperCase();
    if (d.includes('SEPSE')) return 'Sepse';
    if (d.includes('TORACICA')) return 'Dor Torácica';
    if (d.includes('AVC')) return 'AVC';
    if (d.includes('DOR INTENSA')) return 'Dor Intensa';
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
        silentAudioRef.current.play().catch(() => {});
    } else if (silentAudioRef.current) silentAudioRef.current.pause();
  }, [isAudioAlertEnabled]);

  useEffect(() => {
    const combined = [...triageList.map(p => ({ ...p, type: 'TRIAGE' })), ...internationList.map(p => ({ ...p, type: 'INTERNATION' }))];
    if (combined.length === 0) return;
    combined.sort((a, b) => (b._parsedDate?.getTime() || 0) - (a._parsedDate?.getTime() || 0));
    const topCandidates = combined.slice(0, 2);
    if (isFirstLoadRef.current) {
        topCandidates.forEach(p => sessionKnownIdsRef.current.add(p.type === 'INTERNATION' ? p.medicalRecord + '_INT' : p.medicalRecord));
        isFirstLoadRef.current = false;
        return;
    }
    if (!isAudioAlertEnabled) return;
    const speak = (text: string) => { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; window.speechSynthesis.speak(u); } };
    topCandidates.forEach(p => {
         const uniqueId = p.type === 'INTERNATION' ? p.medicalRecord + '_INT' : p.medicalRecord;
         if (notifiedPatientsRef.current?.has(uniqueId) || sessionKnownIdsRef.current.has(uniqueId)) return;
         let msg = '';
         if (p.type === 'TRIAGE') {
             const triageItem = p as any;
             const proto = detectTriageProtocolName(triageItem.discriminators || '');
             if (proto) msg = `Atenção. Paciente ${p.name}. Possível protocolo de ${proto}.`;
             else if (parseInt(String(triageItem.esiLevel).replace(/\D/g,'')) <= 2) msg = `Atenção. Paciente ${p.name}. Classificação Crítica.`;
         } else if (p.type === 'INTERNATION') {
             const internationItem = p as any;
             const protos = getProtocolsFromObs(internationItem.observations || '');
             if (protos.length > 0) msg = `Atenção. Paciente ${p.name}. Possível protocolo de ${protos[0]}.`;
             else if (parseInt(internationItem.newsScore) >= 5) msg = `Atenção. Paciente ${p.name}. Deterioração Clínica.`;
         }
         if (msg) { speak(msg); markAsNotified(uniqueId); sessionKnownIdsRef.current.add(uniqueId); }
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

  const getNewsBadge = (scoreStr: any) => {
    const score = parseInt(scoreStr) || 0;
    if (score >= 7) return 'bg-red-800 text-white animate-pulse';
    if (score >= 5) return 'bg-red-600 text-white';
    if (score >= 1) return 'bg-yellow-400 text-slate-900';
    return 'bg-emerald-600 text-white';
  };

  const VitalItem = ({ label, value, unit, alert = false }: { label: string, value: string, unit?: string, alert?: boolean }) => (
    <div className={`bg-white rounded p-1.5 shadow-sm flex flex-col justify-center items-center border ${alert ? 'border-red-400 bg-red-50' : 'border-slate-100'}`}>
        <span className="block text-[9px] text-slate-400 font-bold uppercase leading-tight">{label}</span>
        <span className={`leading-tight font-bold text-sm ${alert ? 'text-red-700' : 'text-slate-900'}`}>{value || '-'}</span>
        {unit && <span className="block text-[8px] text-slate-500 font-normal leading-tight">{unit}</span>}
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in pb-10 h-full flex flex-col">
        <div className="bg-indigo-900 text-white p-3 rounded-lg shadow-md flex justify-between items-center shrink-0">
            <div>
                <h2 className="text-xl font-bold flex items-center gap-3"><Monitor className="text-teal-400"/> GESTÃO À VISTA</h2>
                <div className="flex items-center gap-2">
                    <p className="text-indigo-200 text-xs">Monitoramento em Tempo Real</p>
                    {isExtendedView && <span className="bg-yellow-400 text-indigo-900 px-2 py-0.5 rounded font-bold text-[10px]">24h</span>}
                </div>
            </div>
            <div className="text-right flex items-center gap-4">
                 <button onClick={() => setIsAudioAlertEnabled(!isAudioAlertEnabled)} className={`p-2 rounded-full transition-all shadow-sm border ${isAudioAlertEnabled ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : 'bg-indigo-800 border-indigo-700 text-indigo-300 hover:bg-indigo-700'}`}>
                      {isAudioAlertEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </button>
                <button onClick={handleSyncFromSheet} disabled={isLoadingReports} className="text-indigo-300 hover:text-white transition-colors">
                    <RefreshCw size={20} className={isLoadingReports ? "animate-spin" : ""} />
                </button>
                <div className="border-l border-indigo-700 pl-4"><p className="font-mono text-2xl font-bold leading-none">{lastDashboardUpdate ? lastDashboardUpdate.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--'}</p></div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 overflow-hidden min-h-[600px]">
            <div className="bg-slate-200/50 p-2 rounded-lg border border-slate-300 flex flex-col h-full overflow-hidden">
                <div className="bg-orange-600 text-white p-2 rounded-t-lg font-bold text-center uppercase text-sm flex items-center justify-center gap-2 shrink-0 shadow-sm"><User size={16}/> TRIAGEM</div>
                <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                    {triageList.map((row, i) => {
                        const level = parseInt(String(row.esiLevel).replace(/\D/g,'')) || 5;
                        const isCritical = level <= 2;
                        const dob = row.dob; 
                        const obsDisplay = cleanObservations(row.complaint, row.vitals?.hgt);

                        return (
                            <div key={i} className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative border-l-[6px] ${isCritical ? 'border-l-red-600 ring-2 ring-red-100' : 'border-l-orange-400'}`}>
                                <div className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <h3 className="font-bold text-slate-900 text-base leading-tight flex items-center gap-2 truncate">
                                                {row.name}
                                                {String(row.isReevaluation).toUpperCase() === 'SIM' && <span className="bg-purple-600 text-white text-[8px] px-1.5 py-0.5 rounded-sm font-bold flex items-center gap-1 shrink-0"><RefreshCw size={10} /> REAVALIAÇÃO</span>}
                                            </h3>
                                            <div className="text-[10px] text-slate-500 font-mono flex flex-col gap-0.5 mt-1 leading-tight">
                                                <span>PRONT: <strong className="text-slate-700">{row.medicalRecord}</strong></span>
                                                {dob && <span>NASC: <strong className="text-slate-700">{formatDateDisplay(dob)}</strong></span>}
                                                {!dob && row.age && <span>IDADE: <strong className="text-slate-700">{row.age}</strong></span>}
                                                <span>AVAL: <strong className="text-slate-700">{row.evaluationTime}</strong></span>
                                            </div>
                                        </div>
                                        <div className={`w-10 h-10 flex flex-col items-center justify-center rounded border shadow-sm shrink-0 ${getEsiColor(row.esiLevel)}`}><span className="text-[8px] font-bold uppercase leading-none mt-0.5">ESI</span><span className="text-xl font-black leading-none">{String(row.esiLevel).replace("'","")}</span></div>
                                    </div>
                                    {row.vitals && <div className="grid grid-cols-6 gap-1 bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                                        <VitalItem label="PA" value={row.vitals.pa} />
                                        <VitalItem label="FC" value={row.vitals.fc} unit="bpm" />
                                        <VitalItem label="FR" value={row.vitals.fr} unit="irpm" />
                                        <VitalItem label="TEMP" value={row.vitals.temp} unit="°C" />
                                        <VitalItem label="SPO2" value={row.vitals.spo2} unit="%" />
                                        <VitalItem label="DOR" value={row.vitals.pain} />
                                    </div>}
                                    {obsDisplay && (
                                        <div className="mt-2 bg-yellow-50 text-yellow-900 p-1.5 rounded border border-yellow-200 text-[10px] font-bold uppercase flex items-center gap-1.5">
                                            <Info size={12} className="shrink-0 text-yellow-600"/> 
                                            <span className="truncate">{obsDisplay}</span>
                                        </div>
                                    )}
                                    {row.discriminators && <div className="mt-1.5 flex flex-wrap gap-1.5">
                                        {row.discriminators.split(';').filter(Boolean).map((disc: string, idx: number) => (
                                            <span key={idx} className="bg-red-700 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase inline-flex items-center gap-1 border border-red-800 shadow-sm">{disc.trim()}</span>
                                        ))}
                                    </div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-200/50 p-2 rounded-lg border border-slate-300 flex flex-col h-full overflow-hidden">
                <div className="bg-emerald-600 text-white p-2 rounded-t-lg font-bold text-center uppercase text-sm flex items-center justify-center gap-2 shrink-0 shadow-sm"><BedDouble size={16}/> INTERNAÇÃO</div>
                <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
                    {internationList.map((row, i) => {
                        const protocols = getProtocolsFromObs(row.observations || '');
                        const score = parseInt(row.newsScore) || 0;
                        const isDeteriorating = score >= 5 || (row.riskText || '').toUpperCase().includes('POSSÍVEL');
                        const obsDisplay = cleanObservations(row.observations || '', row.vitals?.hgt);

                        return (
                            <div key={i} className={`bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative border-l-[6px] ${isDeteriorating ? 'border-l-red-600 ring-2 ring-red-100 bg-red-50/20' : 'border-l-emerald-500'}`}>
                                <div className="p-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <h3 className="font-bold text-slate-900 text-base leading-tight truncate" title={row.name}>{row.name}</h3>
                                            
                                            <div className="mt-1 flex flex-col gap-0.5">
                                                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-tight truncate">
                                                    {row.sector} {row.bed ? `- ${row.bed}` : ''}
                                                </span>
                                                <div className="text-[10px] text-slate-500 font-mono flex flex-col leading-tight">
                                                    <span>PRONT: <strong className="text-slate-700">{row.medicalRecord}</strong></span>
                                                    {row.dob && <span>NASC: <strong className="text-slate-700">{formatDateDisplay(row.dob)}</strong></span>}
                                                    <span className="mt-0.5 text-[9px] text-slate-400">
                                                        AVAL: <strong className="text-slate-600">{row.evaluationTime}</strong>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`w-10 h-10 flex flex-col items-center justify-center rounded border shadow-md shrink-0 ${getNewsBadge(row.newsScore)}`}><span className="text-[8px] font-bold uppercase leading-none mt-0.5 opacity-80">NEWS</span><span className="text-xl font-black leading-none">{row.newsScore}</span></div>
                                    </div>
                                    {row.vitals && <div className="grid grid-cols-6 gap-1 bg-slate-50 p-2 rounded border border-slate-100 mb-2">
                                        <VitalItem label="PA" value={`${row.vitals.pas}x${row.vitals.pad}`} alert={isDeteriorating && score >= 7}/>
                                        <VitalItem label="FC" value={row.vitals.fc} unit="bpm" alert={isDeteriorating && score >= 7}/>
                                        <VitalItem label="FR" value={row.vitals.fr} unit="irpm" alert={isDeteriorating && score >= 7}/>
                                        <VitalItem label="TEMP" value={row.vitals.temp} unit="°C" />
                                        <VitalItem label="SPO2" value={row.vitals.spo2} unit="%" alert={parseInt(row.vitals.spo2) < 92}/>
                                        <VitalItem label="O2" value={row.vitals.o2Sup ? 'SIM' : 'NÃO'} alert={row.vitals.o2Sup === 'SIM'}/>
                                    </div>}
                                    <div className={`text-[10px] p-2 rounded flex items-start gap-1 font-black uppercase shadow-sm ${isDeteriorating ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-50 text-emerald-900 border border-emerald-100'}`}>
                                        <Info size={12} className="shrink-0 mt-0.5"/><span>{row.riskText}</span>
                                    </div>
                                    {obsDisplay && (
                                        <div className="mt-2 bg-yellow-50 text-yellow-900 p-1.5 rounded border border-yellow-200 text-[10px] font-bold uppercase flex items-center gap-1.5">
                                            <FileText size={12} className="shrink-0 text-yellow-600"/> 
                                            <span className="truncate">{obsDisplay}</span>
                                        </div>
                                    )}
                                    {protocols.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">
                                        {protocols.map((p, idx) => (
                                            <span key={idx} className="bg-red-800 text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase inline-flex items-center gap-1 border border-red-900 shadow-md"><AlertTriangle size={10} className="text-white shrink-0"/>{p.toUpperCase()}</span>
                                        ))}
                                    </div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    </div>
  );
});

export default DashboardSection;
