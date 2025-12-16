import React, { useState, useRef } from 'react';
import { Search, FileText, Printer, CalendarDays, User, Clock, AlertCircle, AlertTriangle, Filter, History, List } from 'lucide-react';
import { SheetRowData } from '../types';
import { fetchWithRetry } from '../utils/api';

interface Props {
  scriptUrl: string;
}

export const HistorySection: React.FC<Props> = ({ scriptUrl }) => {
  const [filterMode, setFilterMode] = useState<'12h' | 'date' | 'all'>('date');
  const [searchId, setSearchId] = useState('');
  const [searchDate, setSearchDate] = useState('');
  
  const [historyData, setHistoryData] = useState<SheetRowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  // Parser de Data Robusto (Mesma lógica do Dashboard para garantir Fuso Horário)
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

      let hours = 0, minutes = 0;

      if (timeStr) {
        const cleanTime = String(timeStr).trim();
        const simpleTime = cleanTime.replace(/[^\d:]/g, '');
        const timeParts = simpleTime.split(':');
        
        if (timeParts.length >= 2) {
           hours = parseInt(timeParts[0]);
           minutes = parseInt(timeParts[1]);
        }
      }
      
      const d = new Date(year, month, day, hours, minutes);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      return null;
    }
  };

  const handleSearch = async () => {
    // Validação de entrada dependendo do modo
    if (filterMode === 'date' && !searchDate && !searchId) {
      alert("Para busca por Data Específica, selecione uma data ou digite o prontuário.");
      return;
    }

    setIsLoading(true);
    setSearched(false);
    setErrorMessage('');
    setHistoryData([]);

    try {
      const timestamp = new Date().getTime();
      const params: any = {
        action: 'filterHistory',
        medicalRecord: searchId.trim(),
        _: String(timestamp)
      };

      // Se o modo for DATA, enviamos a data para o backend filtrar.
      // Se for 12h ou ALL, não enviamos data (trazemos tudo e filtramos aqui se necessário para 12h)
      if (filterMode === 'date' && searchDate) {
          params.date = searchDate;
      }

      const queryParams = new URLSearchParams(params);

      // Uso de fetchWithRetry
      const data = await fetchWithRetry(`${scriptUrl}?${queryParams.toString()}`, { method: 'GET' });

      if (data.result === 'success') {
        let rows = Array.isArray(data.data) ? data.data : [];

        // --- FILTRO CLIENT-SIDE PARA ÚLTIMAS 12H ---
        if (filterMode === '12h') {
            const now = new Date();
            const msInHour = 60 * 60 * 1000;
            // Buffer de 5h para compensar Fuso Horário (Cuiabá GMT-4 vs Server GMT-3)
            // Permite registros "no futuro" até 5h e "no passado" até 12h
            rows = rows.filter(row => {
                const rowDate = parseDateRobust(row.evaluationDate, row.evaluationTime);
                if (!rowDate) return false;
                
                const diff = now.getTime() - rowDate.getTime();
                // Diff negativo = Futuro (Server timezone > Local timezone)
                // Diff positivo = Passado
                return diff >= -(5 * msInHour) && diff <= (12 * msInHour);
            });
        }

        setHistoryData(rows);
      } else {
        if (data.message && (data.message.includes('Action not supported') || data.message.includes('Unknown Action'))) {
            setErrorMessage("VERSÃO INCOMPATÍVEL: O Script no Google Sheets está desatualizado. Atualize para v45+.");
        } else {
            setErrorMessage(data.message || "Erro desconhecido ao buscar dados.");
        }
      }
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      setErrorMessage("Erro de Conexão. Verifique a internet e a URL do Script.");
    } finally {
      setIsLoading(false);
      setSearched(true);
    }
  };

  const handleExportExcel = () => {
    if (historyData.length === 0) return;
    
    // @ts-ignore
    if (typeof XLSX === 'undefined') {
      alert('Biblioteca Excel não carregada.');
      return;
    }

    const dataToExport = historyData.map(row => ({
        'Data Sistema': row.systemTimestamp,
        'Data Avaliação': row.evaluationDate,
        'Hora Avaliação': row.evaluationTime,
        'Paciente': row.name,
        'Nº Prontuário': row.medicalRecord,
        'Idade': row.age,
        'Classificação': `ESI ${row.esiLevel}`,
        'PA': row.vitals?.pa,
        'FC': row.vitals?.fc,
        'FR': row.vitals?.fr,
        'SpO2': row.vitals?.spo2,
        'Temp': row.vitals?.temp,
        'Dor': row.vitals?.pain,
        'Queixa': row.complaint
    }));

    // @ts-ignore
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    // @ts-ignore
    const wb = XLSX.utils.book_new();
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, ws, "Historico_Pacientes");
    // @ts-ignore
    XLSX.writeFile(wb, `Historico_${searchId || 'Geral'}_${searchDate || 'Recente'}.xlsx`);
  };

  const handleExportPdf = () => {
    if (historyData.length === 0 || !printRef.current) return;
    
    window.scrollTo(0,0);
    setIsGeneratingPdf(true);

    setTimeout(() => {
        const element = printRef.current;
        const opt = {
            margin: 5,
            filename: `Historico_${searchId || 'Busca'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };

        // @ts-ignore
        window.html2pdf().set(opt).from(element).save().then(() => {
            setIsGeneratingPdf(false);
        });
    }, 500);
  };

  const getEsiColor = (levelStr: any) => {
    const level = String(levelStr).replace(/['"]/g, '').trim();
    switch(level) {
      case '1': return 'bg-red-600 text-white';
      case '2': return 'bg-orange-500 text-white';
      case '3': return 'bg-yellow-400 text-black';
      case '4': return 'bg-green-600 text-white';
      case '5': return 'bg-blue-500 text-white';
      default: return 'bg-gray-200 text-gray-700';
    }
  };

  const formatDateRaw = (dateString: string) => {
     if (!dateString) return 'Período Selecionado';
     const parts = dateString.split('-');
     if (parts.length === 3) {
         return `${parts[2]}/${parts[1]}/${parts[0]}`;
     }
     return dateString;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
       
       {isGeneratingPdf && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mb-6"></div>
          <h2 className="text-2xl font-bold">Gerando PDF do Histórico...</h2>
        </div>
      )}

      {/* PAINEL DE FILTROS */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2">
            <Filter className="text-teal-600" /> Filtros de Histórico
        </h2>

        {/* 1. SELETOR DE MODO (TABS GRANDES) */}
        <div className="grid grid-cols-3 gap-2 mb-6 bg-slate-100 p-1 rounded-lg">
            <button
                onClick={() => setFilterMode('12h')}
                className={`py-3 px-2 rounded-md font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all ${
                    filterMode === '12h' 
                    ? 'bg-teal-600 text-white shadow-md' 
                    : 'text-slate-600 hover:bg-white hover:shadow-sm'
                }`}
            >
                <Clock size={18} /> Últimas 12h
            </button>
            <button
                onClick={() => setFilterMode('date')}
                className={`py-3 px-2 rounded-md font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all ${
                    filterMode === 'date' 
                    ? 'bg-teal-600 text-white shadow-md' 
                    : 'text-slate-600 hover:bg-white hover:shadow-sm'
                }`}
            >
                <CalendarDays size={18} /> Data Específica
            </button>
            <button
                onClick={() => setFilterMode('all')}
                className={`py-3 px-2 rounded-md font-bold text-sm md:text-base flex items-center justify-center gap-2 transition-all ${
                    filterMode === 'all' 
                    ? 'bg-teal-600 text-white shadow-md' 
                    : 'text-slate-600 hover:bg-white hover:shadow-sm'
                }`}
            >
                <List size={18} /> Todo o Histórico
            </button>
        </div>

        {/* 2. CAMPOS DE BUSCA */}
        <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded border border-slate-200">
            
            {/* PRONTUÁRIO (Sempre visível) */}
            <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1">Nº <span className="font-black text-slate-800">PRONTUÁRIO</span> (Opcional)</label>
                <div className="relative">
                    <User className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        className="w-full pl-10 p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 font-bold"
                        placeholder="Digite para filtrar..."
                    />
                </div>
            </div>

            {/* DATA (Só visível se modo == date) */}
            {filterMode === 'date' && (
                <div className="flex-1 w-full animate-fade-in">
                    <label className="block text-xs font-bold text-slate-600 mb-1">Data do Registro <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <CalendarDays className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                        <input 
                            type="date" 
                            value={searchDate}
                            onChange={(e) => setSearchDate(e.target.value)}
                            className="w-full pl-10 p-2.5 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none text-slate-900 font-bold"
                        />
                    </div>
                </div>
            )}

            <button 
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-6 rounded flex items-center gap-2 transition-colors disabled:opacity-50 h-[45px] shadow-sm w-full md:w-auto justify-center"
            >
                {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Search size={20} />}
                BUSCAR
            </button>
        </div>
        
        {/* LEGENDA DE MODO */}
        <div className="mt-2 text-xs text-slate-500 italic text-center">
            {filterMode === '12h' && "Mostrando registros das últimas 12 horas (Plantão Atual)."}
            {filterMode === 'date' && "Buscando registros da data selecionada."}
            {filterMode === 'all' && "Buscando todos os registros disponíveis na planilha (Pode demorar)."}
        </div>
      </div>

      {errorMessage && (
        <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded shadow-sm flex items-start gap-3">
             <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20}/>
             <div>
                <h3 className="text-rose-900 font-bold text-sm">Erro na Busca</h3>
                <p className="text-rose-800 text-xs mt-1">{errorMessage}</p>
             </div>
        </div>
      )}

      {searched && !errorMessage && (
        <div className="flex justify-between items-center bg-slate-100 p-3 rounded border border-slate-200">
             <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm md:text-base">
                <History className="text-slate-500" /> Resultados: <span className="bg-white px-2 py-0.5 rounded text-slate-900 border border-slate-300">{historyData.length}</span>
             </h3>
             <div className="flex gap-2">
                 <button 
                    onClick={handleExportPdf}
                    disabled={historyData.length === 0}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded font-bold text-xs md:text-sm disabled:opacity-50 transition-colors shadow-sm"
                 >
                    <Printer size={16}/> PDF
                 </button>
                 <button 
                    onClick={handleExportExcel}
                    disabled={historyData.length === 0}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-bold text-xs md:text-sm disabled:opacity-50 transition-colors shadow-sm"
                 >
                    <FileText size={16}/> Excel
                 </button>
             </div>
        </div>
      )}

      {!errorMessage && (
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs">
                    <tr>
                        <th className="p-3 border-b">Data/Hora Sistema</th>
                        <th className="p-3 border-b">Data/Hora Avaliação</th>
                        <th className="p-3 border-b">Prontuário</th>
                        <th className="p-3 border-b">Paciente</th>
                        <th className="p-3 border-b">Queixa / Obs</th>
                        <th className="p-3 border-b text-center">Classificação</th>
                        <th className="p-3 border-b">Sinais Vitais</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {historyData.length > 0 ? historyData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-slate-500 font-mono text-xs">{row.systemTimestamp}</td>
                            <td className="p-3 font-bold text-slate-700">{row.evaluationDate} <span className="text-slate-400 font-normal">às</span> {row.evaluationTime}</td>
                            <td className="p-3 font-bold text-slate-700">{row.medicalRecord}</td>
                            <td className="p-3 font-bold text-slate-700">
                                {row.name}
                                <span className="block text-[10px] font-normal text-slate-400">{row.age}</span>
                            </td>
                            <td className="p-3 text-xs text-slate-500 max-w-[200px] truncate" title={row.complaint}>
                                {row.complaint}
                            </td>
                            <td className="p-3 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${getEsiColor(row.esiLevel)}`}>
                                    ESI {String(row.esiLevel).replace("'","")}
                                </span>
                            </td>
                            <td className="p-3 text-xs font-mono text-slate-600">
                                {row.vitals ? (
                                    <div className="grid grid-cols-2 gap-x-2 w-48">
                                    <span>PA: {row.vitals.pa}</span>
                                    <span>FC: {row.vitals.fc}</span>
                                    <span>SpO2: {row.vitals.spo2}%</span>
                                    <span>Temp: {row.vitals.temp}</span>
                                    </div>
                                ) : '-'}
                            </td>
                        </tr>
                    )) : (
                        searched && (
                            <tr>
                                <td colSpan={7} className="p-10 text-center text-slate-400">
                                    <AlertCircle className="inline-block mb-2 text-slate-300" size={32}/>
                                    <p className="text-lg font-medium text-slate-500">Nenhum registro encontrado.</p>
                                    <p className="text-xs">Tente alterar os filtros ou o período de busca.</p>
                                </td>
                            </tr>
                        )
                    )}
                </tbody>
             </table>
        </div>
      )}

      {/* PRINTABLE CONTAINER */}
      <div className={`fixed top-0 left-0 bg-white z-[50] ${isGeneratingPdf ? 'block' : 'hidden'}`}>
         <div ref={printRef} style={{ width: '280mm', padding: '10mm', backgroundColor: 'white' }}>
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-center text-black">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-wide">Hospital São Mateus Cuiabá</h1>
                    <h2 className="text-lg font-bold">Relatório de Histórico de Triagem</h2>
                </div>
                <div className="text-right text-sm">
                    <p><strong>Filtro:</strong> {filterMode === '12h' ? 'Últimas 12h' : filterMode === 'all' ? 'Completo' : formatDateRaw(searchDate)}</p>
                    <p><strong>Emissão:</strong> {new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>
            <table className="w-full table-fixed text-xs border-collapse text-black bg-white">
                <thead>
                    <tr className="bg-gray-100 border-b-2 border-black uppercase text-center">
                        <th className="p-2 border border-gray-300 w-24">Data/Hora<br/>Registro</th>
                        <th className="p-2 border border-gray-300 w-24">Data/Hora<br/>Aferição</th>
                        <th className="p-2 border border-gray-300 w-20">Prontuário</th>
                        <th className="p-2 border border-gray-300 w-48 text-left">Paciente</th>
                        <th className="p-2 border border-gray-300 w-16">ESI</th>
                        <th className="p-2 border border-gray-300">Sinais Vitais / Observações</th>
                    </tr>
                </thead>
                <tbody>
                    {historyData.map((row, i) => {
                        const vitalsText = row.vitals 
                            ? `PA: ${row.vitals.pa} | FC: ${row.vitals.fc} | FR: ${row.vitals.fr} | SpO2: ${row.vitals.spo2}% | T: ${row.vitals.temp}°C | Dor: ${row.vitals.pain}`
                            : 'Dados não disponíveis';
                        return (
                            <tr key={i} className="border-b border-gray-300" style={{ pageBreakInside: 'avoid' }}>
                                <td className="p-2 border-r border-gray-300 text-center font-mono">{row.systemTimestamp?.split(' ')[0]}<br/>{row.systemTimestamp?.split(' ')[1]}</td>
                                <td className="p-2 border-r border-gray-300 text-center font-mono">{row.evaluationDate}<br/>{row.evaluationTime}</td>
                                <td className="p-2 border-r border-gray-300 text-center font-bold">{row.medicalRecord}</td>
                                <td className="p-2 border-r border-gray-300 text-left">
                                    <span className="font-bold block uppercase truncate">{row.name}</span>
                                    <span className="text-[10px] italic">{row.age}</span>
                                </td>
                                <td className="p-2 border-r border-gray-300 text-center font-black text-sm">
                                    {String(row.esiLevel).replace("'","")}
                                </td>
                                <td className="p-2 text-left">
                                    <div className="font-mono font-bold mb-1 border-b border-gray-200 pb-1">{vitalsText}</div>
                                    <div className="italic text-[10px] leading-tight">{row.complaint}</div>
                                    {row.discriminators && <div className="text-[9px] mt-1 text-gray-600">Disc: {row.discriminators}</div>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};