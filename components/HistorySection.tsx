import React, { useState, useRef } from 'react';
import { Search, FileText, Printer, CalendarDays, User, Clock, AlertCircle, AlertTriangle } from 'lucide-react';
import { SheetRowData } from '../types';

interface Props {
  scriptUrl: string;
}

export const HistorySection: React.FC<Props> = ({ scriptUrl }) => {
  const [searchId, setSearchId] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [historyData, setHistoryData] = useState<SheetRowData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [searched, setSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const printRef = useRef<HTMLDivElement>(null);

  const handleSearch = async () => {
    if (!searchId && !searchDate) {
      alert("Por favor, preencha o Nº Prontuário ou a Data para buscar.");
      return;
    }

    setIsLoading(true);
    setSearched(false);
    setErrorMessage('');
    setHistoryData([]);

    try {
      const timestamp = new Date().getTime();
      const queryParams = new URLSearchParams({
        action: 'filterHistory',
        medicalRecord: searchId.trim(),
        date: searchDate,
        _: String(timestamp)
      });

      const response = await fetch(`${scriptUrl}?${queryParams.toString()}`);
      const data = await response.json();

      if (data.result === 'success') {
        if (Array.isArray(data.data)) {
            setHistoryData(data.data);
        } else {
            setHistoryData([]);
        }
      } else {
        // Tratamento de erro específico para script desatualizado
        if (data.message && (data.message.includes('Action not supported') || data.message.includes('Unknown Action'))) {
            setErrorMessage("VERSÃO INCOMPATÍVEL: O Script no Google Sheets está desatualizado. Por favor, vá em Configurações (Engrenagem) > Copie o código v45 > Faça uma NOVA implantação no Apps Script.");
        } else {
            setErrorMessage(data.message || "Erro desconhecido ao buscar dados na planilha.");
        }
      }
    } catch (error) {
      console.error("Erro ao buscar histórico:", error);
      setErrorMessage("Erro de Conexão. Verifique se a URL do Script está correta e acessível.");
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
    XLSX.writeFile(wb, `Historico_${searchId || 'Geral'}_${searchDate || ''}.xlsx`);
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

  return (
    <div className="space-y-6 animate-fade-in pb-20">
       
       {/* PDF GENERATION OVERLAY */}
       {isGeneratingPdf && (
        <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center text-white">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mb-6"></div>
          <h2 className="text-2xl font-bold">Gerando PDF do Histórico...</h2>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Clock className="text-teal-600" /> Filtros de Histórico
        </h2>
        <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1">Nº <span className="font-black text-slate-800">PRONTUÁRIO</span> (Exato)</label>
                <div className="relative">
                    <User className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="text" 
                        value={searchId}
                        onChange={(e) => setSearchId(e.target.value)}
                        className="w-full pl-10 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                        placeholder="Digite o número..."
                    />
                </div>
            </div>
            <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1">Data do Registro</label>
                <div className="relative">
                    <CalendarDays className="absolute left-3 top-2.5 text-slate-400" size={18}/>
                    <input 
                        type="date" 
                        value={searchDate}
                        onChange={(e) => setSearchDate(e.target.value)}
                        className="w-full pl-10 p-2 border border-slate-300 rounded focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                </div>
            </div>
            <button 
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded flex items-center gap-2 transition-colors disabled:opacity-50 h-[42px]"
            >
                {isLoading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Search size={20} />}
                BUSCAR
            </button>
        </div>
      </div>

      {/* ERROR MESSAGE DISPLAY */}
      {errorMessage && (
        <div className="bg-rose-50 border-l-4 border-rose-600 p-4 rounded shadow-sm flex items-start gap-3">
             <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20}/>
             <div>
                <h3 className="text-rose-900 font-bold text-sm">Erro na Busca</h3>
                <p className="text-rose-800 text-xs mt-1">{errorMessage}</p>
             </div>
        </div>
      )}

      {/* RESULTS HEADER & ACTIONS */}
      {searched && !errorMessage && (
        <div className="flex justify-between items-center">
             <h3 className="font-bold text-slate-700 flex items-center gap-2">
                Resultados Encontrados: <span className="bg-slate-200 px-2 rounded text-slate-900">{historyData.length}</span>
             </h3>
             <div className="flex gap-2">
                 <button 
                    onClick={handleExportPdf}
                    disabled={historyData.length === 0}
                    className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded font-bold text-sm disabled:opacity-50"
                 >
                    <Printer size={16}/> PDF
                 </button>
                 <button 
                    onClick={handleExportExcel}
                    disabled={historyData.length === 0}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-bold text-sm disabled:opacity-50"
                 >
                    <FileText size={16}/> Excel
                 </button>
             </div>
        </div>
      )}

      {/* SCREEN TABLE (SCROLLABLE) */}
      {!errorMessage && (
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-x-auto">
             <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-xs">
                    <tr>
                        <th className="p-3 border-b">Data/Hora Sistema</th>
                        <th className="p-3 border-b">Data/Hora Avaliação</th>
                        <th className="p-3 border-b">Prontuário</th>
                        <th className="p-3 border-b">Paciente</th>
                        <th className="p-3 border-b text-center">Classificação</th>
                        <th className="p-3 border-b">Sinais Vitais</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {historyData.length > 0 ? historyData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-500 font-mono text-xs">{row.systemTimestamp}</td>
                            <td className="p-3 font-medium text-slate-700">{row.evaluationDate} {row.evaluationTime}</td>
                            <td className="p-3 font-bold text-slate-700">{row.medicalRecord}</td>
                            <td className="p-3">
                                <div className="font-bold">{row.name}</div>
                                <div className="text-xs text-slate-400 truncate max-w-[200px]">{row.complaint}</div>
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
                                <td colSpan={6} className="p-8 text-center text-slate-400">
                                    <AlertCircle className="inline-block mb-2" size={24}/>
                                    <p>Nenhum registro encontrado para os filtros informados.</p>
                                </td>
                            </tr>
                        )
                    )}
                </tbody>
             </table>
        </div>
      )}

      {/* PRINTABLE CONTAINER (HIDDEN UNLESS PRINTING) */}
      <div className={`fixed top-0 left-0 bg-white z-[50] ${isGeneratingPdf ? 'block' : 'hidden'}`}>
         <div ref={printRef} style={{ width: '280mm', padding: '10mm', backgroundColor: 'white' }}>
            
            {/* Print Header */}
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-center text-black">
                <div>
                    <h1 className="text-2xl font-black uppercase tracking-wide">Hospital São Mateus Cuiabá</h1>
                    <h2 className="text-lg font-bold">Relatório de Histórico de Triagem</h2>
                </div>
                <div className="text-right text-sm">
                    <p><strong>Filtro Prontuário:</strong> {searchId || 'Todos'}</p>
                    <p><strong>Filtro Data:</strong> {searchDate ? new Date(searchDate).toLocaleDateString('pt-BR') : 'Todas'}</p>
                    <p><strong>Emissão:</strong> {new Date().toLocaleString('pt-BR')}</p>
                </div>
            </div>

            {/* Print Table */}
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
                                    <span className="text-[10px] italic">{row.age} anos</span>
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