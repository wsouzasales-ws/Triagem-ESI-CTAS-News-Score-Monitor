import React, { useState, useEffect, useMemo } from 'react';
import { Search, Printer, CalendarDays, User, Clock, Filter, List, BedDouble, Activity, FileSpreadsheet, Trash2, AlertCircle, CheckSquare, Square, Sun, Moon, LayoutGrid, FileText } from 'lucide-react';
import { fetchWithRetry } from '../utils/api';
import { PrintableReport } from './PrintableReport';

interface Props {
  scriptUrl: string;
}

type OriginFilter = 'all' | 'triage' | 'internation';
type ShiftFilter = 'all' | 'day' | 'night';

const TriageHybridLogo = () => (
  <div className="flex items-center gap-2">
    <svg width="45" height="45" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M76.8 256h76.8l51.2-153.6 102.4 307.2 51.2-153.6h76.8" stroke="#e11d48" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <div className="flex flex-col leading-none" style={{ textAlign: 'left' }}>
      <span className="text-[16px] font-black text-slate-800 uppercase tracking-tight">Triagem Híbrida <span className="text-rose-600">ESI + CTAS</span></span>
      <span className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase mt-1">+ NEWS SCORE MONITORAMENTO</span>
    </div>
  </div>
);

const SaoMateusLogo = () => (
  <div className="flex items-center gap-2">
    <div className="flex flex-col items-end leading-none" style={{ textAlign: 'right' }}>
      <div className="flex items-center gap-1 mb-0.5">
        <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 80L40 20L60 60L80 20" stroke="#1e293b" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M40 20L55 80L70 40" stroke="#be123c" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[20px] font-bold text-[#1e293b] tracking-tight">São Mateus</span>
      </div>
      <span className="text-[11px] text-slate-400 font-medium tracking-widest uppercase">Kora Saúde</span>
    </div>
  </div>
);

export const HistorySection: React.FC<Props> = ({ scriptUrl }) => {
  const [filterMode, setFilterMode] = useState<'24h' | 'range' | 'all'>('24h');
  const [searchId, setSearchId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('all');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isInvalidating, setIsInvalidating] = useState(false);
  const [isGeneratingListPdf, setIsGeneratingListPdf] = useState(false);
  const [printingRow, setPrintingRow] = useState<any | null>(null);

  const getRowKey = (row: any) => `${row.systemTimestamp}-${row.medicalRecord}`;

  const formatDate = (dateStr: any) => {
    if (!dateStr || dateStr === '-') return '-';
    const s = String(dateStr).trim();
    if (s.includes('/') && s.split('/').length === 3) return s;
    if (s.includes('-') && s.split('-').length === 3) {
      const parts = s.split('-');
      if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return s;
  };

  const parseDateRobust = (dateStr: string, timeStr?: string) => {
    try {
      if (!dateStr) return null;
      let day = 0, month = 0, year = 0;
      const cleanDate = String(dateStr).trim().split(' ')[0];
      if (cleanDate.includes('/')) {
         const parts = cleanDate.split('/');
         day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
      } else if (cleanDate.includes('-')) {
         const parts = cleanDate.split('-');
         if (parts[0].length === 4) { 
            year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]);
         } else { 
            day = parseInt(parts[0]); month = parseInt(parts[1]) - 1; year = parseInt(parts[2]);
         }
      }
      if (year > 0 && year < 100) year += 2000;
      let hours = 0, minutes = 0;
      if (timeStr) {
        const timeParts = timeStr.replace(/[^\d:]/g, '').split(':');
        if (timeParts.length >= 2) { hours = parseInt(timeParts[0]); minutes = parseInt(timeParts[1]); }
      }
      const d = new Date(year, month, day, hours, minutes);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
  };

  const checkShift = (timeStr: string, shift: ShiftFilter) => {
    if (shift === 'all' || !timeStr) return true;
    try {
      const hours = parseInt(timeStr.split(':')[0]);
      if (shift === 'day') return hours >= 7 && hours < 19;
      if (shift === 'night') return hours >= 19 || hours < 7;
    } catch (e) { return true; }
    return true;
  };

  const handleSearch = async () => {
    setIsLoading(true);
    setSearched(false);
    setErrorMessage('');
    setSelectedItems(new Set());
    
    try {
      const timestamp = Date.now();
      const [triageRes, internationRes] = await Promise.all([
        fetchWithRetry(`${scriptUrl}?action=getAll&_=${timestamp}`, { method: 'GET' }),
        fetchWithRetry(`${scriptUrl}?action=getAllInternation&_=${timestamp}`, { method: 'GET' })
      ]);

      let allRows: any[] = [];
      if (triageRes.result === 'success') {
        allRows = [...allRows, ...triageRes.data.map((r: any) => ({ ...r, source: 'triage' }))];
      }
      if (internationRes.result === 'success') {
        allRows = [...allRows, ...internationRes.data.map((r: any) => ({ ...r, source: 'internation' }))];
      }

      if (searchId.trim()) {
        allRows = allRows.filter(r => String(r.medicalRecord).trim() === searchId.trim());
      }

      const now = new Date();
      if (filterMode === '24h') {
        allRows = allRows.filter(r => {
          const d = parseDateRobust(r.systemTimestamp || r.evaluationDate, r.evaluationTime);
          return d && (now.getTime() - d.getTime() <= 86400000);
        });
      } else if (filterMode === 'range' && dateRange.start && dateRange.end) {
        const start = new Date(`${dateRange.start}T00:00:00`);
        const end = new Date(`${dateRange.end}T23:59:59`);
        allRows = allRows.filter(r => {
          const d = parseDateRobust(r.systemTimestamp || r.evaluationDate, r.evaluationTime);
          return d && d >= start && d <= end;
        });
      }

      allRows.sort((a, b) => {
        const dA = parseDateRobust(a.systemTimestamp || a.evaluationDate, a.evaluationTime);
        const dB = parseDateRobust(b.systemTimestamp || b.evaluationDate, b.evaluationTime);
        return (dB?.getTime() || 0) - (dA?.getTime() || 0);
      });

      setHistoryData(allRows);
    } catch (error) {
      setErrorMessage("Erro ao carregar histórico unificado.");
    } finally {
      setIsLoading(false);
      setSearched(true);
    }
  };

  const filteredData = useMemo(() => {
    return historyData.filter(row => {
      const matchesOrigin = originFilter === 'all' ? true : (originFilter === 'internation' ? row.source === 'internation' : row.source === 'triage');
      const matchesShift = checkShift(row.evaluationTime, shiftFilter);
      return matchesOrigin && matchesShift;
    });
  }, [historyData, originFilter, shiftFilter]);

  useEffect(() => { if (filterMode !== 'range') handleSearch(); }, [filterMode]);

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredData.length && filteredData.length > 0) setSelectedItems(new Set());
    else setSelectedItems(new Set(filteredData.map(row => getRowKey(row))));
  };

  const toggleSelectItem = (key: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
    setSelectedItems(newSet);
  };

  const handleInvalidateBatch = () => {
     setShowDeleteModal(false);
     setIsInvalidating(true); 
     const itemsToInvalidate = filteredData.filter(row => selectedItems.has(getRowKey(row))).map(row => ({ systemTimestamp: row.systemTimestamp, medicalRecord: row.medicalRecord, source: row.source }));
     const updatedData = historyData.map(row => selectedItems.has(getRowKey(row)) ? { ...row, status: 'INVALIDADO' } : row);
     setHistoryData(updatedData);
     setSelectedItems(new Set()); 
     fetchWithRetry(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'invalidateBatch', items: itemsToInvalidate }) }).catch(err => console.error("Erro ao invalidar:", err)).finally(() => setIsInvalidating(false));
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;
    // @ts-ignore
    if (typeof XLSX === 'undefined') return alert('Biblioteca Excel não carregada.');
    const dataToExport = filteredData.map(row => ({ 
      'Origem': row.source === 'internation' ? 'INTERNAÇÃO' : 'TRIAGEM', 
      'Status': row.status === 'INVALIDADO' ? 'INVALIDADO' : 'ATIVO', 
      'Data Nasc.': formatDate(row.dob),
      'Prontuário': row.medicalRecord, 
      'Paciente': row.name, 
      'Avaliação': `${row.evaluationDate} ${row.evaluationTime}`,
      'Classificação': row.source === 'internation' ? `NEWS ${row.newsScore}` : `ESI ${row.esiLevel}`,
      'Obs/Queixa': row.source === 'internation' ? row.observations : row.complaint 
    }));
    // @ts-ignore
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    // @ts-ignore
    const wb = XLSX.utils.book_new();
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, ws, "Histórico");
    // @ts-ignore
    XLSX.writeFile(wb, `Historico_Acolhimento_${new Date().getTime()}.xlsx`);
  };

  const handleExportPDF = () => {
    if (filteredData.length === 0) return;
    setIsGeneratingListPdf(true);
    // Usamos timeout para garantir que o React sincronizou o DOM no container oculto
    setTimeout(() => {
      const element = document.getElementById('history-pdf-content');
      if (!element) {
        setIsGeneratingListPdf(false);
        return;
      }
      const opt = { 
          margin: [10, 5, 10, 5], 
          filename: `Relatorio_Historico_${new Date().getTime()}.pdf`, 
          image: { type: 'jpeg', quality: 0.98 }, 
          html2canvas: { scale: 2, useCORS: true, scrollY: 0, backgroundColor: '#ffffff', logging: false }, 
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };
      // @ts-ignore
      window.html2pdf().set(opt).from(element).save().then(() => setIsGeneratingListPdf(false)).catch(() => setIsGeneratingListPdf(false));
    }, 1200);
  };

  const handlePrintIndividual = (row: any) => {
      const mappedPatient = {
          name: row.name, medicalRecord: row.medicalRecord, dob: row.dob || '', age: 0, ageUnit: 'years' as any, gender: 'M' as any,
          complaint: row.source === 'internation' ? row.observations : row.complaint, serviceTimestamp: '',
          evaluationDate: row.evaluationDate, evaluationTime: row.evaluationTime, isReevaluation: false, sector: row.sector, bed: row.bed
      };
      const mappedVitals = row.source === 'internation' 
        ? { pas: row.vitals?.pas, pad: row.vitals?.pad, fc: row.vitals?.fc, fr: row.vitals?.fr, temp: row.vitals?.temp, spo2: row.vitals?.spo2, gcs: 15, painLevel: row.vitals?.painLevel }
        : { pas: row.vitals?.pa?.split('x')[0] || '', pad: row.vitals?.pa?.split('x')[1] || '', fc: row.vitals?.fc, fr: row.vitals?.fr, temp: row.vitals?.temp, spo2: row.vitals?.spo2, gcs: 15, painLevel: row.vitals?.pain };
      const mappedResult = {
          level: (parseInt(row.esiLevel) || 5) as any, color: row.source === 'internation' ? 'bg-slate-800' : '',
          score: row.newsScore, riskText: row.riskText, title: row.source === 'internation' ? `NEWS ${row.newsScore}` : row.triageTitle || `ESI ${row.esiLevel}`,
          maxWaitTime: row.source === 'internation' ? '-' : '', justification: [], discriminators: []
      };
      setPrintingRow({ patient: mappedPatient, vitals: mappedVitals, triageResult: mappedResult, source: row.source });
      setTimeout(() => {
          const element = document.getElementById('history-individual-print');
          if (element) {
              // @ts-ignore
              window.html2pdf().set({ margin: 0, filename: `Relatorio_${row.name}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save().then(() => setPrintingRow(null));
          }
      }, 500);
  };

  const getEsiColor = (levelStr: any) => {
    const level = String(levelStr).replace(/\D/g, '');
    switch(level) {
      case '1': return 'bg-red-600 text-white';
      case '2': return 'bg-orange-500 text-white';
      case '3': return 'bg-yellow-400 text-black';
      case '4': return 'bg-green-600 text-white';
      case '5': return 'bg-blue-500 text-white';
      default: return 'bg-slate-200 text-slate-700';
    }
  };

  const getNewsBadge = (scoreStr: any) => {
    const score = parseInt(scoreStr) || 0;
    if (score >= 7) return 'bg-red-800 text-white animate-pulse';
    if (score >= 5) return 'bg-red-600 text-white';
    if (score >= 1) return 'bg-yellow-400 text-black';
    return 'bg-emerald-600 text-white';
  };

  // Cores hexadecimais explícitas para garantir compatibilidade com html2canvas
  const getBadgeColorHex = (row: any) => {
      if (row.source === 'internation') {
          const score = parseInt(row.newsScore) || 0;
          if (score >= 7) return '#991b1b'; // Dark Red
          if (score >= 5) return '#dc2626'; // Red
          if (score >= 1) return '#facc15'; // Yellow
          return '#10b981'; // Green
      } else {
          const level = String(row.esiLevel).replace(/\D/g, '');
          switch(level) {
              case '1': return '#dc2626';
              case '2': return '#f97316';
              case '3': return '#facc15';
              case '4': return '#16a34a';
              case '5': return '#3b82f6';
              default: return '#e2e8f0';
          }
      }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20 relative">
      {isGeneratingListPdf && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mb-4"></div>
            <h2 className="text-xl font-bold uppercase tracking-widest">Sincronizando dados no PDF...</h2>
            <p className="text-slate-400 text-xs mt-2">Aguarde a geração do arquivo consolidado.</p>
        </div>
      )}

      {printingRow && (
          <div className="fixed top-0 left-0 w-full h-full bg-white z-[100] flex justify-center items-start overflow-auto">
              <div id="history-individual-print" style={{ width: '794px', backgroundColor: 'white' }}>
                  <PrintableReport patient={printingRow.patient} vitals={printingRow.vitals} triageResult={printingRow.triageResult} source={printingRow.source} />
              </div>
          </div>
      )}

      {/* PDF LISTA CONTAINER - MELHORADO: Posicionamento fixo com visibilidade total para captura */}
      <div style={{ position: 'fixed', left: '-5000px', top: 0, width: '1060px', backgroundColor: 'white', zIndex: -500 }}>
        <div id="history-pdf-content" style={{ width: '1060px', backgroundColor: 'white', padding: '30px' }}>
             <div className="flex justify-between items-center border-b-4 border-slate-100 pb-4 mb-6">
                <TriageHybridLogo />
                <div className="text-center">
                    <h2 className="text-[26px] font-black text-slate-800 uppercase tracking-[0.2em] mb-1">HISTÓRICO DE ATENDIMENTO</h2>
                    <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Relatório Consolidado • Hospital São Mateus</div>
                </div>
                <SaoMateusLogo />
             </div>
             
             <table className="w-full text-left text-[10px] border-collapse" style={{ tableLayout: 'auto' }}>
                <thead className="bg-slate-100 text-slate-900 font-black uppercase">
                    <tr>
                        <th className="p-2 border border-slate-300 w-[80px]">Origem</th>
                        <th className="p-2 border border-slate-300 w-[110px]">Data Nasc.</th>
                        <th className="p-2 border border-slate-300 w-[80px]">Pront.</th>
                        <th className="p-2 border border-slate-300">Paciente</th>
                        <th className="p-2 border border-slate-300 w-[100px]">Avaliação</th>
                        <th className="p-2 border border-slate-300 text-center w-[85px]">Classif.</th>
                        <th className="p-2 border border-slate-300 w-[180px]">SSVV</th>
                        <th className="p-2 border border-slate-300 w-[240px]">Obs / Queixa</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredData.map((row, idx) => {
                      const badgeColor = getBadgeColorHex(row);
                      const vitalsStr = row.source === 'internation' 
                          ? `PA: ${row.vitals?.pas}x${row.vitals?.pad} | FC: ${row.vitals?.fc} | FR: ${row.vitals?.fr} | T: ${row.vitals?.temp} | SpO2: ${row.vitals?.spo2}% | Dor: ${row.vitals?.painLevel || '-'}`
                          : `PA: ${row.vitals?.pa} | FC: ${row.vitals?.fc} | FR: ${row.vitals?.fr} | T: ${row.vitals?.temp} | SpO2: ${row.vitals?.spo2}% | Dor: ${row.vitals?.pain || '-'}`;
                      
                      return (
                        <tr key={idx} className={row.status === 'INVALIDADO' ? 'opacity-30' : ''}>
                            <td className="p-2 border border-slate-200 font-bold text-slate-800">{row.source === 'internation' ? 'INTERN.' : 'TRIAGEM'}</td>
                            <td className="p-2 border border-slate-200 text-slate-800">{formatDate(row.dob)}</td>
                            <td className="p-2 border border-slate-200 font-mono font-bold text-slate-800">{row.medicalRecord}</td>
                            <td className="p-2 border border-slate-200 font-bold uppercase text-slate-900">{row.name}</td>
                            <td className="p-2 border border-slate-200 text-slate-800">{row.evaluationDate} {row.evaluationTime}</td>
                            <td className="p-2 border border-slate-200 text-center">
                                <div style={{ backgroundColor: badgeColor, color: (badgeColor === '#facc15' ? '#000' : '#fff'), padding: '4px 2px', borderRadius: '4px', fontWeight: '900', fontSize: '9px', width: '70px', margin: '0 auto' }}>
                                    {row.source === 'internation' ? `NEWS ${row.newsScore}` : `ESI ${String(row.esiLevel).replace(/\D/g,'')}`}
                                </div>
                            </td>
                            <td className="p-2 border border-slate-200 font-mono text-[8px] leading-tight text-slate-700">{vitalsStr}</td>
                            <td className="p-2 border border-slate-200 text-[8px] leading-tight text-slate-600 italic">{row.source === 'internation' ? row.observations : row.complaint}</td>
                        </tr>
                      );
                    })}
                </tbody>
             </table>
             <div className="mt-8 flex justify-between items-end border-t pt-4">
                 <div className="text-[8px] text-slate-400 font-bold uppercase">
                     Relatório gerado em: {new Date().toLocaleString('pt-BR')} | Hospital São Mateus Cuiabá
                 </div>
                 <div className="text-center">
                     <div className="w-52 border-b border-slate-400 mb-1"></div>
                     <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Assinatura do Profissional</div>
                 </div>
             </div>
        </div>
      </div>

      {/* UI PRINCIPAL */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Filter className="text-teal-600" /> Histórico Unificado
            </h2>
            <div className="flex gap-2 w-full md:w-auto">
                {selectedItems.size > 0 && <button onClick={() => setShowDeleteModal(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-bold text-xs shadow-sm transition-all"><Trash2 size={16} /> INVALIDAR ({selectedItems.size})</button>}
                <button onClick={handleExportExcel} disabled={filteredData.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-bold text-xs shadow-sm transition-all"><FileSpreadsheet size={16} /> EXCEL</button>
                <button onClick={handleExportPDF} disabled={filteredData.length === 0} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded font-bold text-xs shadow-sm transition-all"><Printer size={16} /> PDF LISTA</button>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setFilterMode('24h')} className={`py-3 px-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${filterMode === '24h' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}><Clock size={18} /> Últimas 24h</button>
            <button onClick={() => setFilterMode('range')} className={`py-3 px-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${filterMode === 'range' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}><CalendarDays size={18} /> Período</button>
            <button onClick={() => setFilterMode('all')} className={`py-3 px-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${filterMode === 'all' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'}`}><List size={18} /> Todo Histórico</button>
        </div>

        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded border border-slate-200">
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Nº Prontuário</label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                      <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} className="w-full pl-10 p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none font-bold text-slate-800" placeholder="Filtrar por prontuário..."/>
                    </div>
                </div>
                {filterMode === 'range' && (
                    <div className="flex-1 w-full flex gap-2">
                        <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Início</label><input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full p-2.5 border border-slate-300 rounded font-bold text-slate-800"/></div>
                        <div className="flex-1"><label className="block text-xs font-bold text-slate-600 mb-1">Fim</label><input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full p-2.5 border border-slate-300 rounded font-bold text-slate-800"/></div>
                    </div>
                )}
                <button onClick={handleSearch} disabled={isLoading} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded flex items-center gap-2 h-[45px] w-full md:w-auto justify-center shadow-md active:scale-95 transition-all">
                    {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Search size={20} />} BUSCAR
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded border border-slate-200">
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center gap-1"><LayoutGrid size={14}/> Filtrar por Origem</label>
                    <div className="flex gap-2">
                        <button onClick={() => setOriginFilter('all')} className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${originFilter === 'all' ? 'bg-teal-600 text-white border-teal-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>TODOS</button>
                        <button onClick={() => setOriginFilter('triage')} className={`flex-1 py-2 rounded text-xs font-bold border flex items-center justify-center gap-1 transition-all ${originFilter === 'triage' ? 'bg-orange-600 text-white border-orange-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}><Activity size={12}/> TRIAGEM</button>
                        <button onClick={() => setOriginFilter('internation')} className={`flex-1 py-2 rounded text-xs font-bold border flex items-center justify-center gap-1 transition-all ${originFilter === 'internation' ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}><BedDouble size={12}/> INTERNAÇÃO</button>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded border border-slate-200">
                    <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wider flex items-center gap-1"><Clock size={14}/> Filtrar por Turno</label>
                    <div className="flex gap-2">
                        <button onClick={() => setShiftFilter('all')} className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${shiftFilter === 'all' ? 'bg-teal-600 text-white border-teal-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>AMBOS</button>
                        <button onClick={() => setShiftFilter('day')} className={`flex-1 py-2 rounded text-xs font-bold border flex items-center justify-center gap-1 transition-all ${shiftFilter === 'day' ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}><Sun size={12}/> DIURNO</button>
                        <button onClick={() => setShiftFilter('night')} className={`flex-1 py-2 rounded text-xs font-bold border flex items-center justify-center gap-1 transition-all ${shiftFilter === 'night' ? 'bg-indigo-700 text-white border-indigo-800 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}><Moon size={12}/> NOTURNO</button>
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-widest">
                    <tr>
                        <th className="p-3 border-b text-center w-10">
                            <div className="cursor-pointer" onClick={toggleSelectAll}>
                                {filteredData.length > 0 && selectedItems.size === filteredData.length ? <CheckSquare size={16} className="text-teal-600"/> : <Square size={16} className="text-slate-400"/>}
                            </div>
                        </th>
                        <th className="p-3 border-b">Origem</th>
                        <th className="p-3 border-b">Avaliação / Registro</th>
                        <th className="p-3 border-b">Turno</th>
                        <th className="p-3 border-b">Prontuário</th>
                        <th className="p-3 border-b">Data Nasc.</th>
                        <th className="p-3 border-b">Paciente</th>
                        <th className="p-3 border-b text-center">Classificação</th>
                        <th className="p-3 border-b">SSVV</th>
                        <th className="p-3 border-b">Obs / Queixa</th>
                        <th className="p-3 border-b text-center">Ações</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredData.length > 0 ? filteredData.map((row, idx) => {
                        const isInvalid = row.status === 'INVALIDADO';
                        const isSelected = selectedItems.has(getRowKey(row));
                        const isDayShift = checkShift(row.evaluationTime, 'day');
                        return (
                          <tr key={idx} className={`transition-colors ${isInvalid ? 'bg-slate-100/50 opacity-60 grayscale' : 'hover:bg-slate-50'} ${isSelected ? 'bg-teal-50' : ''}`}>
                              <td className="p-3 text-center">
                                  <div className="cursor-pointer" onClick={() => toggleSelectItem(getRowKey(row))}>
                                      {isSelected ? <CheckSquare size={16} className="text-teal-600"/> : <Square size={16} className="text-slate-300"/>}
                                  </div>
                              </td>
                              <td className="p-3">
                                  {row.source === 'internation' ? <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 shadow-sm uppercase tracking-tighter">INTERNAÇÃO</span> : <span className="text-[10px] font-black text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-100 shadow-sm uppercase tracking-tighter">TRIAGEM</span>}
                              </td>
                              <td className={`p-3 ${isInvalid ? 'line-through' : ''}`}>
                                  <div className="text-[13px] font-bold text-slate-700">{row.evaluationDate} <span className="text-blue-600">{row.evaluationTime}</span></div>
                                  <div className="text-[9px] text-slate-400 font-medium italic mt-0.5 flex items-center gap-1"><Clock size={10}/> Reg: {row.systemTimestamp}</div>
                              </td>
                              <td className="p-3">
                                  {isDayShift ? <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">DIURNO</span> : <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">NOTURNO</span>}
                              </td>
                              <td className={`p-3 font-bold text-slate-700 ${isInvalid ? 'line-through' : ''}`}>{row.medicalRecord}</td>
                              <td className={`p-3 font-bold text-slate-600 ${isInvalid ? 'line-through' : ''}`}>{formatDate(row.dob)}</td>
                              <td className={`p-3 font-bold text-slate-700 ${isInvalid ? 'line-through' : ''}`}>
                                  <div className="text-slate-800 uppercase tracking-tight">{row.name}</div>
                                  {row.sector && <div className="text-[9px] font-normal text-slate-400 uppercase mt-1 italic">{row.sector} {row.bed ? `- ${row.bed}` : ''}</div>}
                              </td>
                              <td className="p-3 text-center">
                                  {row.source === 'internation' ? <span className={`px-2 py-1 rounded text-[10px] font-black shadow-sm ${getNewsBadge(row.newsScore)}`}>NEWS {row.newsScore}</span> : <span className={`px-2 py-1 rounded text-[10px] font-black shadow-sm ${getEsiColor(row.esiLevel)}`}>ESI {String(row.esiLevel).replace(/\D/g,'')}</span>}
                              </td>
                              <td className={`p-3 text-[10px] font-mono text-slate-600 leading-tight ${isInvalid ? 'line-through opacity-70' : ''}`}>
                                  {row.source === 'internation' ? (
                                      <>
                                        <div>PA: {row.vitals?.pas}x{row.vitals?.pad} | FC: {row.vitals?.fc}</div>
                                        <div className="mt-0.5">FR: {row.vitals?.fr} | T: {row.vitals?.temp} | SpO2: {row.vitals?.spo2}</div>
                                        <div className="mt-0.5 font-bold">Dor: {row.vitals?.painLevel || '-'}</div>
                                      </>
                                  ) : (
                                      <>
                                        <div>PA: {row.vitals?.pa} | FC: {row.vitals?.fc}</div>
                                        <div className="mt-0.5">FR: {row.vitals?.fr} | T: {row.vitals?.temp} | SpO2: {row.vitals?.spo2}</div>
                                        <div className="mt-0.5 font-bold">Dor: {row.vitals?.pain || '-'}</div>
                                      </>
                                  )}
                              </td>
                              <td className={`p-3 text-xs text-slate-500 max-w-[200px] truncate whitespace-normal ${isInvalid ? 'line-through' : ''}`}>
                                  {row.source === 'internation' ? row.observations : row.complaint}
                              </td>
                              <td className="p-3 text-center">
                                  <button onClick={() => handlePrintIndividual(row)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors shadow-sm" title="Imprimir Relatório Individual">
                                      <Printer size={14}/>
                                  </button>
                              </td>
                          </tr>
                        );
                    }) : searched && <tr><td colSpan={11} className="p-10 text-center text-slate-400 italic">Nenhum registro encontrado. Tente buscar pelo prontuário ou mudar o período.</td></tr>}
                </tbody>
             </table>
        </div>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
             <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 animate-scale-up">
                <div className="flex items-center gap-3 text-rose-600 mb-4 border-b border-rose-100 pb-3">
                   <div className="bg-rose-100 p-2 rounded-full"><AlertCircle size={24}/></div>
                   <h3 className="text-lg font-black uppercase tracking-tight">Confirmar Invalidação</h3>
                </div>
                <p className="text-sm text-slate-600 mb-6 font-medium">Os registros selecionados serão marcados como <strong>INVALIDADOS</strong> no sistema e na planilha principal. Esta ação não pode ser desfeita facilmente.</p>
                <div className="flex justify-end gap-3">
                   <button onClick={() => setShowDeleteModal(false)} className="px-5 py-2.5 text-slate-500 font-bold hover:bg-slate-100 rounded text-xs uppercase tracking-widest">Cancelar</button>
                   <button onClick={handleInvalidateBatch} className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-md text-xs uppercase tracking-widest">Confirmar</button>
                </div>
             </div>
          </div>
        )}
    </div>
  );
};