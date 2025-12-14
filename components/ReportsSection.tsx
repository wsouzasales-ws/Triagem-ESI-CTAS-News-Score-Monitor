import React, { useState, useMemo } from 'react';
import { FileSpreadsheet, RefreshCw, FileText, Brain, Flame, Heart, Zap, TrendingDown } from 'lucide-react';
import { SheetRowData } from '../types';

interface Props {
  reportData: SheetRowData[];
  handleSyncFromSheet: () => void;
  isLoadingReports: boolean;
  handleExportExcel: (worsened: any[], month: string) => void;
}

const ReportsSection: React.FC<Props> = React.memo(({
  reportData,
  handleSyncFromSheet,
  isLoadingReports,
  handleExportExcel
}) => {
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  const processedReports = useMemo(() => {
    if (!reportData || !Array.isArray(reportData) || reportData.length === 0) {
        return { total: 0, reevaluations: 0, worsened: [], esiCounts: [0,0,0,0,0], protocolCounts: { avc: 0, sepse: 0, dorToracica: 0, dorIntensa: 0 } };
    }

    const getEsi = (val: any) => {
        if (!val) return 0;
        const strVal = String(val).replace(/['"]/g, '').trim();
        const num = parseInt(strVal, 10);
        return isNaN(num) ? 0 : num;
    };

    const filtered = reportData.filter(row => {
        const dateStr = row.evaluationDate ? String(row.evaluationDate) : '';
        return dateStr.startsWith(reportMonth);
    });

    const grouped: Record<string, SheetRowData[]> = {};
    const protocolCounts = { avc: 0, sepse: 0, dorToracica: 0, dorIntensa: 0 };

    filtered.forEach(row => {
        if (row.medicalRecord) {
            if (!grouped[row.medicalRecord]) grouped[row.medicalRecord] = [];
            grouped[row.medicalRecord].push(row);
        }

        const disc = (row.discriminators || '').toLowerCase();
        if (disc.includes('assimetria') || disc.includes('fala') || disc.includes('fraqueza') || disc.includes('visual')) protocolCounts.avc++;
        if (disc.includes('sepse') || disc.includes('infecção') || disc.includes('sirs')) protocolCounts.sepse++;
        if (disc.includes('torácica') || disc.includes('toracica')) protocolCounts.dorToracica++;
        if (disc.includes('dor severa') || disc.includes('dor intensa') || disc.includes('dor >')) protocolCounts.dorIntensa++;
    });

    const worsenedList: { id: string, name: string, oldLevel: number, newLevel: number, date: string }[] = [];
    
    Object.values(grouped).forEach(group => {
       if (group.length > 1) {
          group.sort((a, b) => {
             const tA = (a.evaluationDate || '') + (a.evaluationTime || '');
             const tB = (b.evaluationDate || '') + (b.evaluationTime || '');
             return tA.localeCompare(tB);
          });

          for (let i = 1; i < group.length; i++) {
             const prev = group[i-1];
             const curr = group[i];
             
             const prevLevel = getEsi(prev.esiLevel);
             const currLevel = getEsi(curr.esiLevel);
             const currDate = curr.evaluationDate ? String(curr.evaluationDate) : '';

             if (currLevel > 0 && prevLevel > 0 && currLevel < prevLevel && currDate.startsWith(reportMonth)) {
                worsenedList.push({
                   id: curr.medicalRecord,
                   name: curr.name,
                   oldLevel: prevLevel,
                   newLevel: currLevel,
                   date: currDate
                });
             }
          }
       }
    });

    const reevalCount = filtered.filter(r => r.isReevaluation === 'SIM').length;
    const esiCounts = [0,0,0,0,0];
    
    filtered.forEach(r => {
        const level = getEsi(r.esiLevel);
        if (level >= 1 && level <= 5) esiCounts[level - 1]++;
    });

    return { total: filtered.length, reevaluations: reevalCount, worsened: worsenedList, esiCounts, protocolCounts };
  }, [reportData, reportMonth]);

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
    <div className="animate-fade-in pb-10 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2"><FileSpreadsheet className="text-teal-600"/> Indicadores Mensais</h2>
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
            
            <div className="flex gap-2">
              <button 
                onClick={handleSyncFromSheet} 
                disabled={isLoadingReports}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded font-bold text-sm transition-colors border border-slate-300"
              >
                <RefreshCw size={16} className={isLoadingReports ? "animate-spin" : ""} /> Sincronizar Dados
              </button>
              <button 
                onClick={() => handleExportExcel(processedReports.worsened, reportMonth)}
                disabled={processedReports.worsened.length === 0}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-400 text-white px-4 py-2 rounded font-bold text-sm transition-colors shadow-sm"
              >
                <FileText size={16} /> Exportar Piora Clínica
              </button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Total Atendimentos</p>
              <p className="text-3xl font-black text-slate-800">{processedReports.total}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Reavaliações</p>
              <p className="text-3xl font-black text-teal-600">{processedReports.reevaluations}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Piora Clínica (ESI)</p>
              <p className={`text-3xl font-black ${processedReports.worsened.length > 0 ? 'text-rose-600' : 'text-slate-300'}`}>{processedReports.worsened.length}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-400 uppercase">Alta Prioridade (ESI 1+2)</p>
              <p className="text-3xl font-black text-orange-600">{processedReports.esiCounts[0] + processedReports.esiCounts[1]}</p>
            </div>
        </div>

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
              <p className="text-xs font-bold text-amber-800 uppercase mb-2">Dor Intensa (≥8)</p>
              <div className="flex flex-col items-center">
                <Zap size={24} className="text-amber-600 mb-1" />
                <p className="text-2xl font-black text-amber-900">{processedReports.protocolCounts.dorIntensa}</p>
              </div>
            </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold text-slate-700 uppercase mb-4">Distribuição por Classificação (ESI)</h3>
            <div className="flex items-end h-40 gap-2 md:gap-4 justify-around">
              {[1,2,3,4,5].map((level, i) => {
                  const count = processedReports.esiCounts[i];
                  const max = Math.max(...processedReports.esiCounts, 1);
                  const height = (count / max) * 100;
                  const colors = ['bg-red-600', 'bg-orange-500', 'bg-yellow-400', 'bg-green-600', 'bg-blue-500'];
                  
                  return (
                    <div key={level} className="flex flex-col items-center w-full group relative">
                      <span className="mb-1 font-bold text-slate-700 text-sm opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6">{count}</span>
                      <div className={`w-full max-w-[60px] rounded-t ${colors[i]} transition-all duration-500`} style={{ height: `${height}%`, minHeight: count > 0 ? '4px' : '0' }}></div>
                      <span className="mt-2 text-xs font-bold text-slate-500 uppercase">ESI {level}</span>
                    </div>
                  );
              })}
            </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-rose-50 p-3 border-b border-rose-100 flex justify-between items-center">
              <h3 className="text-rose-800 font-bold text-sm flex items-center gap-2">
                  <TrendingDown size={16}/> Monitoramento de Piora Clínica (Reavaliações)
              </h3>
            </div>
            {processedReports.worsened.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic text-sm">Nenhum caso de piora de classificação registrado neste mês.</div>
            ) : (
              <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                    <tr>
                        <th className="p-3">Data</th>
                        <th className="p-3">Paciente (AT)</th>
                        <th className="p-3 text-center">Classificação Anterior</th>
                        <th className="p-3 text-center">Nova Classificação</th>
                        <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {processedReports.worsened.map((item, idx) => (
                        <tr key={idx} className="hover:bg-rose-50/30">
                          <td className="p-3 text-slate-600">{new Date(item.date).toLocaleDateString('pt-BR')}</td>
                          <td className="p-3 font-medium text-slate-800">{item.name} <span className="text-xs text-slate-400">({item.id})</span></td>
                          <td className="p-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">ESI {item.oldLevel}</span>
                          </td>
                          <td className="p-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${getEsiColor(item.newLevel)}`}>ESI {item.newLevel}</span>
                          </td>
                          <td className="p-3 text-center text-rose-600 font-bold text-xs flex justify-center items-center gap-1">
                              <TrendingDown size={14} /> PIORA
                          </td>
                        </tr>
                    ))}
                  </tbody>
              </table>
            )}
        </div>
    </div>
  );
});

export default ReportsSection;
