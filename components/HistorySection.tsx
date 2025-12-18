import React, { useState } from 'react';
import { Search, FileText, Printer, CalendarDays, User, Clock, Filter, List, BedDouble, Activity, FileSpreadsheet, Download } from 'lucide-react';
import { fetchWithRetry } from '../utils/api';

interface Props {
  scriptUrl: string;
}

export const HistorySection: React.FC<Props> = ({ scriptUrl }) => {
  const [filterMode, setFilterMode] = useState<'12h' | 'date' | 'all'>('date');
  const [searchId, setSearchId] = useState('');
  const [searchDate, setSearchDate] = useState('');
  
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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
      let hours = 0, minutes = 0;
      if (timeStr) {
        const timeParts = timeStr.replace(/[^\d:]/g, '').split(':');
        if (timeParts.length >= 2) {
           hours = parseInt(timeParts[0]);
           minutes = parseInt(timeParts[1]);
        }
      }
      const d = new Date(year, month, day, hours, minutes);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) { return null; }
  };

  const handleSearch = async () => {
    if (filterMode === 'date' && !searchDate && !searchId) {
      alert("Selecione uma data ou digite o prontuário.");
      return;
    }

    setIsLoading(true);
    setSearched(false);
    setErrorMessage('');
    
    try {
      const timestamp = new Date().getTime();
      const params = new URLSearchParams({
        action: 'filterHistory',
        medicalRecord: searchId.trim(),
        date: filterMode === 'date' ? searchDate : '',
        _: String(timestamp)
      });

      const data = await fetchWithRetry(`${scriptUrl}?${params.toString()}`, { method: 'GET' });

      if (data.result === 'success') {
        let rows = Array.isArray(data.data) ? data.data : [];
        if (filterMode === '12h') {
            const now = new Date();
            rows = rows.filter(row => {
                const rowDate = parseDateRobust(row.evaluationDate, row.evaluationTime);
                if (!rowDate) return false;
                const diff = now.getTime() - rowDate.getTime();
                return Math.abs(diff) <= (12 * 60 * 60 * 1000);
            });
        }
        setHistoryData(rows);
      } else {
        setErrorMessage(data.message || "Erro ao buscar dados.");
      }
    } catch (error) {
      setErrorMessage("Erro de Conexão com o Backend.");
    } finally {
      setIsLoading(false);
      setSearched(true);
    }
  };

  const handleExportExcel = () => {
    if (historyData.length === 0) return;
    // @ts-ignore
    if (typeof XLSX === 'undefined') return alert('Biblioteca Excel não carregada.');

    const dataToExport = historyData.map(row => ({
      'Origem': row.source === 'internation' ? 'INTERNAÇÃO' : 'TRIAGEM',
      'Inclusão Sistema': row.systemTimestamp,
      'Data Avaliação': row.evaluationDate,
      'Hora Avaliação': row.evaluationTime,
      'Prontuário': row.medicalRecord,
      'Paciente': row.name,
      'Setor/Leito': row.sector ? `${row.sector} - ${row.bed}` : '-',
      'Classificação': row.source === 'internation' ? `NEWS ${row.newsScore}` : `ESI ${row.esiLevel}`,
      'SSVV': row.source === 'internation' 
        ? `PA: ${row.vitals?.pas}x${row.vitals?.pad} | FC: ${row.vitals?.fc} | FR: ${row.vitals?.fr} | T: ${row.vitals?.temp} | SpO2: ${row.vitals?.spo2}`
        : `PA: ${row.vitals?.pa} | FC: ${row.vitals?.fc} | FR: ${row.vitals?.fr} | T: ${row.vitals?.temp} | SpO2: ${row.vitals?.spo2}`,
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
    if (historyData.length === 0) return;
    const element = document.getElementById('history-table-container');
    if (!element) return;

    const opt = {
      margin: 10,
      filename: `Relatorio_Historico_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };
    // @ts-ignore
    window.html2pdf().set(opt).from(element).save();
  };

  const getEsiColor = (levelStr: any) => {
    const level = String(levelStr).replace(/\D/g, '');
    switch(level) {
      case '1': return 'bg-red-600 text-white';
      case '2': return 'bg-orange-500 text-white';
      case '3': return 'bg-yellow-400 text-black';
      case '4': return 'bg-green-600 text-white';
      case '5': return 'bg-blue-500 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const getNewsBadge = (scoreStr: any) => {
    const score = parseInt(scoreStr) || 0;
    if (score >= 5) return 'bg-rose-600 text-white';
    if (score >= 1) return 'bg-yellow-400 text-black';
    return 'bg-emerald-600 text-white';
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Filter className="text-teal-600" /> Histórico Unificado
            </h2>
            <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={handleExportExcel} 
                  disabled={historyData.length === 0}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-bold text-xs disabled:opacity-50 transition-colors"
                >
                    <FileSpreadsheet size={16} /> EXCEL
                </button>
                <button 
                  onClick={handleExportPDF} 
                  disabled={historyData.length === 0}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded font-bold text-xs disabled:opacity-50 transition-colors"
                >
                    <Printer size={16} /> PDF
                </button>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-6 bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setFilterMode('12h')} className={`py-3 px-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${filterMode === '12h' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'}`}>
                <Clock size={18} /> Últimas 12h
            </button>
            <button onClick={() => setFilterMode('date')} className={`py-3 px-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${filterMode === 'date' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'}`}>
                <CalendarDays size={18} /> Data Específica
            </button>
            <button onClick={() => setFilterMode('all')} className={`py-3 px-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${filterMode === 'all' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'}`}>
                <List size={18} /> Todo o Histórico
            </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded border border-slate-200">
            <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Nº Prontuário</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-slate-400" size={16}/>
                  <input type="text" value={searchId} onChange={(e) => setSearchId(e.target.value)} className="w-full pl-10 p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none font-bold" placeholder="Digite o prontuário..."/>
                </div>
            </div>

            {filterMode === 'date' && (
                <div className="flex-1 w-full animate-fade-in">
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Data</label>
                    <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="w-full p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none font-bold"/>
                </div>
            )}

            <button onClick={handleSearch} disabled={isLoading} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded flex items-center gap-2 transition-colors disabled:opacity-50 h-[45px] shadow-sm w-full md:w-auto justify-center">
                {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Search size={20} />}
                BUSCAR
            </button>
        </div>
      </div>

      <div id="history-table-container" className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-widest">
                    <tr>
                        <th className="p-3 border-b">Origem</th>
                        <th className="p-3 border-b">Inclusão (Sistema)</th>
                        <th className="p-3 border-b">Avaliação</th>
                        <th className="p-3 border-b">Prontuário</th>
                        <th className="p-3 border-b">Paciente</th>
                        <th className="p-3 border-b text-center">Classificação</th>
                        <th className="p-3 border-b">SSVV</th>
                        <th className="p-3 border-b">Obs / Queixa</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {historyData.length > 0 ? historyData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3">
                                {row.source === 'internation' ? (
                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100">
                                        <BedDouble size={12}/> INTERNAÇÃO
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1.5 text-[10px] font-black text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                        <Activity size={12}/> TRIAGEM
                                    </span>
                                )}
                            </td>
                            <td className="p-3 text-[10px] font-medium text-slate-400 font-mono">
                                {row.systemTimestamp || '-'}
                            </td>
                            <td className="p-3 font-bold text-slate-700">
                                {row.evaluationDate} {row.evaluationTime}
                            </td>
                            <td className="p-3 font-bold text-slate-700">{row.medicalRecord}</td>
                            <td className="p-3 font-bold text-slate-700">
                                {row.name}
                                {row.sector && <span className="block text-[10px] font-normal text-slate-400 uppercase tracking-tighter">{row.sector} - {row.bed}</span>}
                            </td>
                            <td className="p-3 text-center">
                                {row.source === 'internation' ? (
                                    <span className={`px-2 py-1 rounded text-[10px] font-black ${getNewsBadge(row.newsScore)}`}>NEWS {row.newsScore}</span>
                                ) : (
                                    <span className={`px-2 py-1 rounded text-[10px] font-black ${getEsiColor(row.esiLevel)}`}>ESI {String(row.esiLevel).replace(/\D/g,'')}</span>
                                )}
                            </td>
                            <td className="p-3 text-[10px] font-mono text-slate-600 leading-relaxed">
                                {row.source === 'internation' ? (
                                    <div className="flex flex-col">
                                        <span>PA: {row.vitals?.pas}x{row.vitals?.pad} | FC: {row.vitals?.fc} | FR: {row.vitals?.fr}</span>
                                        <span>T: {row.vitals?.temp}ºC | SpO2: {row.vitals?.spo2}% | Dor: {row.vitals?.pain}</span>
                                        {row.vitals?.consc && <span className="text-[9px] text-slate-400 italic">Nível: {row.vitals.consc}</span>}
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        <span>PA: {row.vitals?.pa} | FC: {row.vitals?.fc} | FR: {row.vitals?.fr}</span>
                                        <span>T: {row.vitals?.temp}ºC | SpO2: {row.vitals?.spo2}% | Dor: {row.vitals?.pain}</span>
                                    </div>
                                )}
                            </td>
                            <td className="p-3 text-xs text-slate-500 max-w-[200px] truncate whitespace-normal" title={row.source === 'internation' ? row.observations : row.complaint}>
                                {row.source === 'internation' ? row.observations : row.complaint}
                            </td>
                        </tr>
                    )) : searched && (
                        <tr><td colSpan={8} className="p-10 text-center text-slate-400 italic">Nenhum registro encontrado.</td></tr>
                    )}
                </tbody>
             </table>
        </div>
    </div>
  );
};