import React, { useState, useEffect } from 'react';
import { Search, Printer, CalendarDays, User, Clock, Filter, List, BedDouble, Activity, FileSpreadsheet, Trash2, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { fetchWithRetry } from '../utils/api';

interface Props {
  scriptUrl: string;
}

export const HistorySection: React.FC<Props> = ({ scriptUrl }) => {
  const [filterMode, setFilterMode] = useState<'24h' | 'range' | 'all'>('24h');
  const [searchId, setSearchId] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isInvalidating, setIsInvalidating] = useState(false);

  const getRowKey = (row: any) => `${row.systemTimestamp}-${row.medicalRecord}`;

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
      } else if (dateStr.includes(' ')) {
          const timePart = dateStr.split(' ')[1];
          const timeParts = timePart.split(':');
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
    if (filterMode === 'range' && (!dateRange.start || !dateRange.end)) {
      alert("Selecione a Data Inicial e Final.");
      return;
    }

    setIsLoading(true);
    setSearched(false);
    setErrorMessage('');
    setSelectedItems(new Set()); 
    
    try {
      const timestamp = new Date().getTime();
      const params = new URLSearchParams({
        action: 'filterHistory',
        medicalRecord: searchId.trim(),
        // Para range, enviamos data vazia para pegar tudo e filtrar no cliente
        // Isso evita ter que atualizar o backend com uma nova lógica complexa
        date: '', 
        _: String(timestamp)
      });

      const data = await fetchWithRetry(`${scriptUrl}?${params.toString()}`, { method: 'GET' });

      if (data.result === 'success') {
        let rows = Array.isArray(data.data) ? data.data : [];
        
        // ORDENAÇÃO CLIENT-SIDE (Mais Recente Primeiro)
        rows.sort((a, b) => {
            const dateA = parseDateRobust(a.systemTimestamp || `${a.evaluationDate} ${a.evaluationTime}`);
            const dateB = parseDateRobust(b.systemTimestamp || `${b.evaluationDate} ${b.evaluationTime}`);
            if (!dateA || !dateB) return 0;
            return dateB.getTime() - dateA.getTime();
        });

        // FILTRAGEM CLIENT-SIDE
        const now = new Date();
        
        if (filterMode === '24h') {
            rows = rows.filter(row => {
                const rowDate = parseDateRobust(row.systemTimestamp || row.evaluationDate, row.evaluationTime);
                if (!rowDate) return false;
                const diff = now.getTime() - rowDate.getTime();
                // 24h passadas + buffer futuro
                return (diff >= 0 && diff <= 86400000) || (diff < 0 && diff >= -86400000);
            });
        } 
        else if (filterMode === 'range') {
            const start = new Date(`${dateRange.start}T00:00:00`);
            const end = new Date(`${dateRange.end}T23:59:59`);
            
            rows = rows.filter(row => {
                const rowDate = parseDateRobust(row.systemTimestamp || row.evaluationDate, row.evaluationTime);
                if (!rowDate) return false;
                return rowDate >= start && rowDate <= end;
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

  useEffect(() => {
      // Auto-busca apenas se não for Range (para não buscar sem datas)
      if (filterMode !== 'range') {
          handleSearch();
      }
  }, [filterMode]);

  const toggleSelectAll = () => {
    if (selectedItems.size === historyData.length && historyData.length > 0) {
      setSelectedItems(new Set());
    } else {
      const allKeys = historyData.map(row => getRowKey(row));
      setSelectedItems(new Set(allKeys));
    }
  };

  const toggleSelectItem = (key: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedItems(newSet);
  };

  const handleInvalidateBatch = () => {
     setShowDeleteModal(false);
     setIsInvalidating(true); 

     const itemsToInvalidate = historyData
       .filter(row => selectedItems.has(getRowKey(row)))
       .map(row => ({
          systemTimestamp: row.systemTimestamp,
          medicalRecord: row.medicalRecord,
          source: row.source 
       }));

     const updatedData = historyData.map(row => {
        if (selectedItems.has(getRowKey(row))) {
            return { ...row, status: 'INVALIDADO' };
        }
        return row;
     });
     setHistoryData(updatedData);
     setSelectedItems(new Set()); 

     fetchWithRetry(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
            action: 'invalidateBatch',
            items: itemsToInvalidate
        })
     }).catch(err => console.error("Erro ao invalidar em background:", err))
       .finally(() => setIsInvalidating(false));
  };

  const handleExportExcel = () => {
    if (historyData.length === 0) return;
    // @ts-ignore
    if (typeof XLSX === 'undefined') return alert('Biblioteca Excel não carregada.');

    const dataToExport = historyData.map(row => ({
      'Origem': row.source === 'internation' ? 'INTERNAÇÃO' : 'TRIAGEM',
      'Status': row.status === 'INVALIDADO' ? 'INVALIDADO' : 'ATIVO',
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
    <div className="space-y-6 animate-fade-in pb-20 relative">
      
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
           <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full p-6 animate-fade-in">
              <div className="flex items-center gap-3 text-rose-600 mb-4">
                 <div className="bg-rose-100 p-2 rounded-full"><AlertCircle size={24}/></div>
                 <h3 className="text-lg font-bold">Confirmar Invalidação</h3>
              </div>
              <p className="text-sm text-slate-600 mb-6">
                 Você está prestes a invalidar <strong>{selectedItems.size}</strong> registros. 
                 Eles não serão apagados permanentemente, mas marcados como "INVALIDADO" no sistema.
              </p>
              <div className="flex justify-end gap-3">
                 <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded">Cancelar</button>
                 <button onClick={handleInvalidateBatch} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded shadow-sm">Sim, Invalidar</button>
              </div>
           </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Filter className="text-teal-600" /> Histórico Unificado
            </h2>
            <div className="flex gap-2 w-full md:w-auto">
                {selectedItems.size > 0 && (
                    <button 
                      onClick={() => setShowDeleteModal(true)} 
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded font-bold text-xs shadow-sm transition-colors animate-fade-in"
                    >
                        <Trash2 size={16} /> INVALIDAR ({selectedItems.size})
                    </button>
                )}
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
            <button onClick={() => setFilterMode('24h')} className={`py-3 px-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${filterMode === '24h' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'}`}>
                <Clock size={18} /> Últimas 24h
            </button>
            <button onClick={() => setFilterMode('range')} className={`py-3 px-2 rounded-md font-bold text-sm flex items-center justify-center gap-2 transition-all ${filterMode === 'range' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-600 hover:bg-white'}`}>
                <CalendarDays size={18} /> Por Período
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

            {filterMode === 'range' && (
                <div className="flex-1 w-full flex gap-2 animate-fade-in">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Início</label>
                        <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({...prev, start: e.target.value}))} className="w-full p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none font-bold"/>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Fim</label>
                        <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({...prev, end: e.target.value}))} className="w-full p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none font-bold"/>
                    </div>
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
                        <th className="p-3 border-b text-center w-10">
                            <div className="cursor-pointer" onClick={toggleSelectAll}>
                                {historyData.length > 0 && selectedItems.size === historyData.length ? <CheckSquare size={16} className="text-teal-600"/> : <Square size={16} className="text-slate-400"/>}
                            </div>
                        </th>
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
                    {historyData.length > 0 ? historyData.map((row, idx) => {
                        const isInvalid = row.status === 'INVALIDADO';
                        const isSelected = selectedItems.has(getRowKey(row));
                        
                        return (
                          <tr key={idx} className={`transition-colors ${isInvalid ? 'bg-slate-100/50 opacity-60 grayscale' : 'hover:bg-slate-50'} ${isSelected ? 'bg-teal-50' : ''}`}>
                              <td className="p-3 text-center">
                                  <div className="cursor-pointer" onClick={() => toggleSelectItem(getRowKey(row))}>
                                      {isSelected ? <CheckSquare size={16} className="text-teal-600"/> : <Square size={16} className="text-slate-300"/>}
                                  </div>
                              </td>
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
                              <td className={`p-3 text-[10px] font-medium font-mono ${isInvalid ? 'text-slate-500 line-through' : 'text-slate-400'}`}>
                                  {row.systemTimestamp || '-'}
                              </td>
                              <td className={`p-3 font-bold text-slate-700 ${isInvalid ? 'line-through' : ''}`}>
                                  {row.evaluationDate} {row.evaluationTime}
                              </td>
                              <td className={`p-3 font-bold text-slate-700 ${isInvalid ? 'line-through' : ''}`}>{row.medicalRecord}</td>
                              <td className={`p-3 font-bold text-slate-700 ${isInvalid ? 'line-through' : ''}`}>
                                  {row.name}
                                  {row.sector && <span className="block text-[10px] font-normal text-slate-400 uppercase tracking-tighter">{row.sector} - {row.bed}</span>}
                                  {isInvalid && <span className="block text-[10px] font-black text-rose-600 uppercase mt-1 flex items-center gap-1"><Trash2 size={10}/> REGISTRO INVALIDADO</span>}
                              </td>
                              <td className="p-3 text-center">
                                  {row.source === 'internation' ? (
                                      <span className={`px-2 py-1 rounded text-[10px] font-black ${getNewsBadge(row.newsScore)} ${isInvalid ? 'opacity-50' : ''}`}>NEWS {row.newsScore}</span>
                                  ) : (
                                      <span className={`px-2 py-1 rounded text-[10px] font-black ${getEsiColor(row.esiLevel)} ${isInvalid ? 'opacity-50' : ''}`}>ESI {String(row.esiLevel).replace(/\D/g,'')}</span>
                                  )}
                              </td>
                              <td className={`p-3 text-[10px] font-mono text-slate-600 leading-relaxed ${isInvalid ? 'line-through opacity-70' : ''}`}>
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
                              <td className={`p-3 text-xs text-slate-500 max-w-[200px] truncate whitespace-normal ${isInvalid ? 'line-through' : ''}`} title={row.source === 'internation' ? row.observations : row.complaint}>
                                  {row.source === 'internation' ? row.observations : row.complaint}
                              </td>
                          </tr>
                        );
                    }) : searched && (
                        <tr><td colSpan={9} className="p-10 text-center text-slate-400 italic">Nenhum registro encontrado.</td></tr>
                    )}
                </tbody>
             </table>
        </div>
    </div>
  );
};