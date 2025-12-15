import React, { useState, useMemo } from 'react';
import { BedDouble, RefreshCw, FileText, Brain, Flame, Heart, Zap, Activity, AlertTriangle, AlertCircle, TrendingUp, FileSpreadsheet } from 'lucide-react';
import { InternationSheetRowData } from '../types';

interface Props {
  reportData: InternationSheetRowData[];
  handleSyncFromSheet: () => void;
  isLoadingReports: boolean;
}

export const InternationReportsSection: React.FC<Props> = React.memo(({
  reportData,
  handleSyncFromSheet,
  isLoadingReports
}) => {
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const processedReports = useMemo(() => {
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
        return { 
            total: 0, 
            highRisk: 0, 
            protocolCounts: { avc: 0, sepse: 0, dorToracica: 0, dorIntensa: 0 }, 
            riskCounts: { low: 0, medium: 0, high: 0 },
            highRiskList: []
        };
    }

    const filtered = reportData.filter(row => {
        const dateStr = row.evaluationDate ? String(row.evaluationDate) : '';
        // Converte para formato comparável (YYYY-MM) se necessário
        let rowMonth = "";
        if(dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            rowMonth = `${y}-${m}`;
        } else if(dateStr.includes('-')) {
            rowMonth = dateStr.slice(0,7);
        }
        return rowMonth === reportMonth;
    });

    const protocolCounts = { avc: 0, sepse: 0, dorToracica: 0, dorIntensa: 0 };
    const riskCounts = { low: 0, medium: 0, high: 0 };
    let highRiskTotal = 0;
    const highRiskList: InternationSheetRowData[] = [];

    filtered.forEach(row => {
        // Contagem de Protocolos via Observações
        const obs = (row.observations || '').toLowerCase();
        if (obs.includes('protocolo avc') || obs.includes('avc')) protocolCounts.avc++;
        if (obs.includes('protocolo sepse') || obs.includes('sepse')) protocolCounts.sepse++;
        if (obs.includes('protocolo dor torácica') || obs.includes('dor torácica') || obs.includes('sca')) protocolCounts.dorToracica++;
        if (obs.includes('protocolo dor') || obs.includes('dor intensa') || obs.includes('dor >')) protocolCounts.dorIntensa++;

        // Contagem de Risco NEWS
        const score = parseInt(row.newsScore) || 0;
        const riskText = (row.riskText || '').toUpperCase();
        
        let isHighRisk = false;
        if (score >= 5 || riskText.includes('POSSÍVEL DETERIORAÇÃO') || riskText.includes('HIGH')) {
            riskCounts.high++;
            highRiskTotal++;
            isHighRisk = true;
        } else if (score > 0) {
            riskCounts.medium++;
        } else {
            riskCounts.low++;
        }

        if (isHighRisk) {
            highRiskList.push(row);
        }
    });

    // Ordenar lista de alto risco pela data (mais recente primeiro)
    highRiskList.sort((a, b) => {
        const dateA = (a.evaluationDate || '') + (a.evaluationTime || '');
        const dateB = (b.evaluationDate || '') + (b.evaluationTime || '');
        return dateB.localeCompare(dateA);
    });

    return { total: filtered.length, highRisk: highRiskTotal, protocolCounts, riskCounts, highRiskList };
  }, [reportData, reportMonth]);

  const handleExportHighRiskExcel = () => {
    if (processedReports.highRiskList.length === 0) {
        alert("Não há dados de deterioração para exportar neste mês.");
        return;
    }
    // @ts-ignore
    if (typeof XLSX === 'undefined') {
        alert('Biblioteca Excel não carregada.');
        return;
    }

    const dataToExport = processedReports.highRiskList.map(item => ({
        'Paciente': item.name,
        'Nº Prontuário': item.medicalRecord,
        'NEWS Score': item.newsScore,
        'Risco': item.riskText,
        'Data Avaliação': item.evaluationDate,
        'Hora': item.evaluationTime,
        'Setor': item.sector,
        'Leito': item.bed,
        'Observações': item.observations
    }));

    // @ts-ignore
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    // @ts-ignore
    const wb = XLSX.utils.book_new();
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, ws, "Deterioracoes_Clinicas");
    // @ts-ignore
    XLSX.writeFile(wb, `Relatorio_Deterioracao_NEWS_${reportMonth}.xlsx`);
  };

  return (
    <div className="animate-fade-in pb-10 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-emerald-800 flex items-center gap-2"><BedDouble className="text-emerald-600"/> Indicadores de Internação (NEWS)</h2>
                <p className="text-xs text-slate-500">Filtrar por mês de referência</p>
              </div>
              <input 
                type="month" 
                value={reportMonth} 
                onChange={e => setReportMonth(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="border border-slate-600 bg-slate-800 text-white p-2 rounded font-bold outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            
            <button 
                onClick={handleSyncFromSheet} 
                disabled={isLoadingReports}
                className="flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded font-bold text-sm transition-colors border border-emerald-300"
            >
                <RefreshCw size={16} className={isLoadingReports ? "animate-spin" : ""} /> Atualizar Dados
            </button>
        </div>

        {/* KPI CARDS BASICOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Total Avaliações</p>
              <p className="text-3xl font-black text-slate-800">{processedReports.total}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Alto Risco (NEWS ≥ 5)</p>
              <p className={`text-3xl font-black ${processedReports.highRisk > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{processedReports.highRisk}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Alertas de Protocolo</p>
              <p className="text-3xl font-black text-indigo-600">
                  {processedReports.protocolCounts.avc + processedReports.protocolCounts.sepse + processedReports.protocolCounts.dorToracica + processedReports.protocolCounts.dorIntensa}
              </p>
            </div>
        </div>

        {/* PROTOCOL BREAKDOWN */}
        <h3 className="text-sm font-bold text-slate-700 uppercase mt-4">Detalhamento de Protocolos</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-indigo-50 p-4 rounded-lg shadow-sm border border-indigo-100 text-center hover:shadow-md transition-shadow">
              <p className="text-xs font-bold text-indigo-800 uppercase mb-2">Protocolo AVC</p>
              <div className="flex flex-col items-center">
                <Brain size={24} className="text-indigo-600 mb-1" />
                <p className="text-2xl font-black text-indigo-900">{processedReports.protocolCounts.avc}</p>
              </div>
            </div>
            <div className="bg-rose-50 p-4 rounded-lg shadow-sm border border-rose-100 text-center hover:shadow-md transition-shadow">
              <p className="text-xs font-bold text-rose-800 uppercase mb-2">Protocolo Sepse</p>
              <div className="flex flex-col items-center">
                <Flame size={24} className="text-rose-600 mb-1" />
                <p className="text-2xl font-black text-rose-900">{processedReports.protocolCounts.sepse}</p>
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-100 text-center hover:shadow-md transition-shadow">
              <p className="text-xs font-bold text-red-800 uppercase mb-2">Dor Torácica</p>
              <div className="flex flex-col items-center">
                <Heart size={24} className="text-red-600 mb-1" />
                <p className="text-2xl font-black text-red-900">{processedReports.protocolCounts.dorToracica}</p>
              </div>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg shadow-sm border border-amber-100 text-center hover:shadow-md transition-shadow">
              <p className="text-xs font-bold text-amber-800 uppercase mb-2">Dor Intensa</p>
              <div className="flex flex-col items-center">
                <Zap size={24} className="text-amber-600 mb-1" />
                <p className="text-2xl font-black text-amber-900">{processedReports.protocolCounts.dorIntensa}</p>
              </div>
            </div>
        </div>

        {/* --- NOVA SEÇÃO DE MONITORAMENTO DE DETERIORAÇÃO --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            
            {/* Card Esquerda: Contador Visual */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden relative flex flex-col p-6 min-h-[220px]">
               <div className="absolute left-0 top-0 bottom-0 w-2 bg-rose-600"></div>
               <div className="flex justify-between items-start mb-4">
                   <h3 className="font-bold text-rose-800 text-sm uppercase max-w-[70%]">Possível Deterioração (NEWS Alto)</h3>
                   <div className="p-2 bg-rose-50 rounded-lg">
                       <AlertCircle className="text-rose-600" size={24} />
                   </div>
               </div>
               <div className="mt-2">
                   <span className="text-6xl font-black text-rose-700 leading-none">{processedReports.highRiskList.length}</span>
               </div>
               <div className="mt-auto pt-4 text-xs font-bold text-rose-400">
                   {processedReports.total > 0 ? ((processedReports.highRiskList.length / processedReports.total) * 100).toFixed(1) : '0.0'}% do total de atendimentos
               </div>
            </div>

            {/* Card Direita: Lista */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[220px]">
               <div className="p-4 border-b border-rose-100 bg-rose-50 flex justify-between items-center">
                   <h3 className="font-bold text-rose-900 text-sm flex items-center gap-2">
                       <TrendingUp size={18} /> Últimas Deteriorações
                   </h3>
                   <button 
                    onClick={handleExportHighRiskExcel} 
                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors border border-emerald-200"
                    title="Exportar Lista"
                   >
                       <FileSpreadsheet size={14} /> XLSX
                   </button>
               </div>
               <div className="flex-1 overflow-y-auto max-h-[250px] p-0 custom-scrollbar">
                   {processedReports.highRiskList.length === 0 ? (
                       <div className="h-full flex items-center justify-center p-6 text-slate-400 text-sm italic">
                           Nenhuma deterioração registrada neste período.
                       </div>
                   ) : (
                       <table className="w-full text-left text-sm">
                           <thead className="bg-white sticky top-0 z-10 text-slate-500 font-bold text-xs uppercase border-b shadow-sm">
                               <tr>
                                   <th className="p-3 bg-white pl-4">Paciente</th>
                                   <th className="p-3 bg-white text-center">NEWS</th>
                                   <th className="p-3 bg-white text-right pr-4">Data</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                               {processedReports.highRiskList.map((item, idx) => (
                                   <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                       <td className="p-3 pl-4">
                                           <div className="font-bold text-slate-700">{item.name}</div>
                                           <div className="text-xs text-slate-400">{item.medicalRecord}</div>
                                       </td>
                                       <td className="p-3 text-center">
                                           <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-bold text-sm shadow-sm border border-rose-200">
                                               {item.newsScore}
                                           </span>
                                       </td>
                                       <td className="p-3 text-right pr-4 text-slate-500 text-xs font-mono">
                                           {item.evaluationDate ? new Date(item.evaluationDate).toLocaleDateString('pt-BR') : '-'}
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   )}
               </div>
            </div>
        </div>
        
        {/* RISK DISTRIBUTION CHART */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-4">Distribuição de Risco (NEWS Score)</h3>
            <div className="flex items-end h-40 gap-4 justify-around px-10">
                {[
                    { label: 'Baixo Risco (0-4)', count: processedReports.riskCounts.low, color: 'bg-emerald-500' },
                    { label: 'Médio Risco', count: processedReports.riskCounts.medium, color: 'bg-yellow-400' },
                    { label: 'Alto Risco (≥5)', count: processedReports.riskCounts.high, color: 'bg-rose-600' }
                ].map((item, i) => {
                    const max = Math.max(processedReports.riskCounts.low, processedReports.riskCounts.medium, processedReports.riskCounts.high, 1);
                    const height = (item.count / max) * 100;
                    
                    return (
                    <div key={i} className="flex flex-col items-center w-full group relative">
                        <span className="mb-1 font-bold text-slate-700 text-sm opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6">{item.count}</span>
                        <div className={`w-full max-w-[80px] rounded-t ${item.color} transition-all duration-500`} style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}></div>
                        <span className="mt-2 text-xs font-bold text-slate-500 uppercase">{item.label}</span>
                    </div>
                    );
                })}
            </div>
        </div>
    </div>
  );
});

export default InternationReportsSection;