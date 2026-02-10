import React, { useState, useEffect, useMemo } from 'react';
import { User, Activity, Save, Printer, BedDouble, Stethoscope, FileText, ChevronDown, ChevronUp, Check, Search, RefreshCcw, Heart, Brain, Thermometer, AlertCircle } from 'lucide-react';
import { PatientData, VitalSigns } from '../types';
import { calculateNEWS, NewsResultExtended } from '../utils/newsCalculator';
import { evaluateProtocols } from '../utils/protocolEngine';
import { fetchWithRetry } from '../utils/api'; 
import { PrintableReport } from './PrintableReport';

interface Props {
  scriptUrl: string;
  handleSyncFromSheet?: () => void;
  currentUser?: { name: string, email: string } | null;
}

const SYMPTOM_LABELS: Record<string, string> = {
    'neuro_rima': 'Desvio de Rima Labial',
    'neuro_forca': 'Perda de Força/Formigamento',
    'neuro_fala': 'Alteração de Fala',
    'neuro_cefaleia': 'Cefaleia Súbita',
    'neuro_vertigem': 'Vertigem Súbita Intensa',
    'neuro_visual': 'Alteração Visual Súbita',
    
    'sca_a_tipica': 'Dor Torácica Típica (A)',
    'sca_a_bracos': 'Irradiação Braços (A)',
    'sca_a_pescoco': 'Irradiação Pescoço/Mandíbula (A)',
    'sca_b_estomago': 'Dor Epigástrica (B)',
    'sca_b_costas': 'Dor Dorsal (B)',
    'sca_c_dispneia': 'Falta de Ar / Dispneia (C)',
    'sca_c_sudorese': 'Suor Frio / Sudorese (C)',
    'sca_c_palpitacao': 'Palpitação (C)',
    'sca_c_malsubito': 'Mal Súbito / Náusea (C)',
    
    'inf_infeccao': 'Infecção Suspeita/Confirmada',
    'inf_oliguria': 'Redução de Diurese'
};

interface InternationHistory {
    lastDate?: string; lastTime?: string; name: string; dob: string; sector?: string; bed?: string;
    lastVitals?: { pas: string; pad: string; fc: string; fr: string; temp: string; spo2: string; consc: string; o2: string; pain: string; };
    newsScore?: string; riskText?: string;
}

export const InternationSection: React.FC<Props> = ({ scriptUrl, handleSyncFromSheet, currentUser }) => {
  const [patient, setPatient] = useState<PatientData>({
    name: '', medicalRecord: '', dob: '', serviceTimestamp: '', evaluationDate: '', evaluationTime: '', isReevaluation: false, age: 0, ageUnit: 'years', gender: 'M', complaint: '', sector: '', bed: ''
  });

  const [vitals, setVitals] = useState<VitalSigns>({
    pas: '', pad: '', fc: '', fr: '', temp: '', spo2: '', gcs: 15, painLevel: '', o2Sup: false, consciousness: 'Alert'
  });

  const [observations, setObservations] = useState('');
  const [isSymptomsOpen, setIsSymptomsOpen] = useState(true);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newsResult, setNewsResult] = useState<NewsResultExtended>({ score: 0, riskText: 'AGUARDANDO DADOS', riskClass: 'low', conduct: 'Aferir SSVV a cada 12 Horas' });
  const [notification, setNotification] = useState<{msg: string, type: 'success'|'error'} | null>(null);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [internationHistory, setInternationHistory] = useState<InternationHistory | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  useEffect(() => {
    const now = new Date();
    setPatient(prev => ({ ...prev, evaluationDate: now.toISOString().split('T')[0], evaluationTime: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }));
  }, []);

  useEffect(() => setNewsResult(calculateNEWS(vitals)), [vitals]);

  const activeProtocols = useMemo(() => evaluateProtocols(vitals, selectedSymptoms), [vitals, selectedSymptoms]);

  const handleNameBlur = () => {
    const formatted = patient.name.replace(/[^A-Z]/g, '').split('').join('.') + (patient.name.length > 0 ? '.' : '');
    if (formatted !== '.') setPatient(prev => ({...prev, name: formatted}));
  };

  const handleSearchHistory = async () => {
     if (!patient.medicalRecord) return setNotification({ msg: 'Digite o Prontuário.', type: 'error' });
     setIsSearchingHistory(true); setInternationHistory(null);
     try {
        const data = await fetchWithRetry(`${scriptUrl}?action=searchInternation&medicalRecord=${encodeURIComponent(patient.medicalRecord)}&_=${Date.now()}`, { method: 'GET' });
        if (data.result === 'found') {
            const hist = data.history as InternationHistory;
            setInternationHistory(data.source === 'internation' ? hist : null);
            setPatient(prev => ({ ...prev, name: hist.name || prev.name, dob: hist.dob || prev.dob, sector: hist.sector || prev.sector, bed: hist.bed || prev.bed }));
            setNotification({ msg: 'Dados carregados!', type: 'success' });
        } else setNotification({ msg: 'Não encontrado.', type: 'error' });
     } catch (e) { setNotification({ msg: 'Erro de busca.', type: 'error' }); }
     finally { setIsSearchingHistory(false); setTimeout(() => setNotification(null), 3000); }
  };

  const handleSubmit = async () => {
    if (!patient.name || !patient.medicalRecord) return setNotification({ msg: 'Preencha Nome e Prontuário.', type: 'error' });
    setIsSubmitting(true);
    const symptomsText = selectedSymptoms.map(id => SYMPTOM_LABELS[id]).join(', ');
    const protocolsText = activeProtocols.map(p => `PROTOCOLO ${p.type.toUpperCase()}`).join(', ');
    let finalObs = observations;
    if (protocolsText) finalObs = `[${protocolsText}] ` + finalObs;
    if (symptomsText) finalObs = `[SINTOMAS: ${symptomsText}] \n` + finalObs;
    try {
        await fetchWithRetry(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'saveInternation', patient: {...patient, isReevaluation: !!patient.isReevaluation}, vitals: {...vitals, painLevel: String(vitals.painLevel), gcs: String(vitals.gcs)}, news: newsResult, observations: finalObs, user: currentUser?.name || 'Desconhecido' }) });
        setNotification({ msg: 'Salvo com sucesso!', type: 'success' });
        setVitals({ pas: '', pad: '', fc: '', fr: '', temp: '', spo2: '', gcs: 15, painLevel: '', o2Sup: false, consciousness: 'Alert' });
        setObservations(''); setSelectedSymptoms([]); setInternationHistory(null);
    } catch (e: any) { setNotification({ msg: `Erro: ${e.message}`, type: 'error' }); }
    finally { setIsSubmitting(false); setTimeout(() => setNotification(null), 4000); }
  };

  const handlePrintPdf = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      const element = document.getElementById('internation-report-content');
      if (element) {
        // @ts-ignore
        window.html2pdf().set({ margin: 0, filename: `NEWS_${patient.name || 'Paciente'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, scrollY: 0 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save().then(() => setIsGeneratingPdf(false));
      }
    }, 500);
  };

  const renderVitalInput = (label: string, field: keyof VitalSigns, unit: string) => (
    <div className="flex flex-col">
        <label className="text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
            <Activity size={12}/> {label}
        </label>
        <div className="relative flex items-center bg-[#2d3748] border border-slate-700 rounded overflow-hidden">
            <input 
                type="number" 
                value={vitals[field] as string} 
                onChange={e => setVitals(prev => ({...prev, [field]: e.target.value}))} 
                className="w-full bg-transparent text-white font-bold text-xl px-3 py-2 focus:outline-none" 
            />
            <div className="absolute right-8 text-[9px] text-slate-500 font-bold uppercase pointer-events-none">{unit}</div>
            <div className="flex flex-col border-l border-slate-600 w-8">
                <button onClick={() => setVitals(p => ({...p, [field]: String((parseFloat(String(p[field]))||0) + 1)}))} className="h-[21px] hover:bg-slate-700 text-slate-400 flex items-center justify-center border-b border-slate-600"><ChevronUp size={12} /></button>
                <button onClick={() => setVitals(p => ({...p, [field]: String((parseFloat(String(p[field]))||0) - 1)}))} className="h-[21px] hover:bg-slate-700 text-slate-400 flex items-center justify-center"><ChevronDown size={12} /></button>
            </div>
        </div>
    </div>
  );

  const painColors = ['#99f6e4', '#79f1da', '#5eead4', '#2dd4bf', '#fbdf9d', '#facc15', '#f87171', '#f87171', '#fca5a5', '#fca5a5', '#fecaca'];

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {isGeneratingPdf && <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white"><div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mb-4"></div><h2 className="text-xl font-bold">Processando Relatório NEWS...</h2></div>}
      
      <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none"><div id="internation-report-content" style={{ width: '794px', backgroundColor: 'white' }}><PrintableReport patient={{...patient, complaint: observations}} vitals={vitals} triageResult={newsResult} source="internation" /></div></div>

      <div className="text-center"><h2 className="text-2xl font-black text-[#0d9488] uppercase tracking-wide">NEWS UNIDADE DE INTERNAÇÃO</h2></div>
      
      {/* SEÇÃO IDENTIFICAÇÃO */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center gap-3 mb-6 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
            <BedDouble className="text-[#0d9488]" size={24} />
            <div>
                <h3 className="font-black text-[#0d9488] text-sm uppercase">AVALIAÇÃO DE PACIENTES INTERNADOS</h3>
                <p className="text-[10px] text-slate-500 font-medium">Os dados serão salvos na aba "Pacientes internados" e exibidos na coluna direita da TV.</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5">
            <label className="block text-xs font-bold text-slate-700 mb-1">Paciente</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={18}/>
              <input type="text" value={patient.name} onChange={e => setPatient(prev => ({...prev, name: e.target.value.toUpperCase()}))} onBlur={handleNameBlur} placeholder="INICIAIS DO PACIENTE EX: W.S.S." className="w-full pl-10 p-3 bg-[#2d3748] border border-slate-700 rounded text-white font-bold outline-none placeholder:text-slate-500" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-tighter">Nº PRONTUÁRIO</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-slate-400" size={18}/>
              <input 
                type="text" 
                value={patient.medicalRecord} 
                onChange={e => setPatient(prev => ({...prev, medicalRecord: e.target.value.replace(/\D/g, '')}))} 
                placeholder="000000" 
                className="w-full pl-10 p-3 bg-[#2d3748] border border-slate-700 rounded text-white font-bold outline-none placeholder:text-slate-500" 
              />
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-slate-700 mb-1">Data de Nascimento</label>
            <input type="date" value={patient.dob} onChange={e => setPatient(prev => ({...prev, dob: e.target.value}))} className="w-full p-3 bg-[#2d3748] border border-slate-700 rounded text-white font-bold outline-none" style={{ colorScheme: 'dark' }} />
          </div>
          <div className="md:col-span-2 flex items-end">
            <div className="flex items-center gap-2 h-[50px] bg-slate-50 border border-slate-200 rounded px-3 w-full">
                <input type="checkbox" className="w-5 h-5 accent-[#0d9488]" checked={patient.isReevaluation} onChange={e => setPatient(prev => ({...prev, isReevaluation: e.target.checked}))} />
                <span className="text-[10px] font-bold text-slate-700 uppercase">REAVALIAÇÃO?</span>
                {patient.isReevaluation && <button onClick={handleSearchHistory} disabled={isSearchingHistory} className="ml-auto text-[#0d9488] p-1">{isSearchingHistory ? <RefreshCcw className="animate-spin" size={18}/> : <Search size={18}/>}</button>}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Setor</label>
            <select value={patient.sector} onChange={e => setPatient(prev => ({...prev, sector: e.target.value}))} className="w-full p-3 bg-white border border-slate-300 rounded text-sm text-slate-900 font-bold focus:ring-2 focus:ring-teal-500 outline-none">
              <option value="">Selecione...</option>
              <option value="Clínica Médica">Clínica Médica</option>
              <option value="Clínica Cirúrgica">Clínica Cirúrgica</option>
              <option value="UTI Geral">UTI Geral</option>
              <option value="Emergência">Emergência</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Leito</label>
            <input type="text" value={patient.bed} onChange={e => setPatient(prev => ({...prev, bed: e.target.value}))} placeholder="EX: 204-A" className="w-full p-3 bg-white border border-slate-300 rounded text-sm uppercase text-slate-900 font-bold focus:ring-2 focus:ring-teal-500 outline-none"/>
          </div>
        </div>
      </div>

      {/* BLOCO DE HISTÓRICO RESTAURADO */}
      {internationHistory && (
        <div className="bg-[#f0f9ff] border-l-4 border-indigo-600 rounded-lg p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3">
               <div className="bg-white p-2 rounded-full border border-indigo-100"><Activity className="text-indigo-600" size={20}/></div>
               <div>
                   <h4 className="text-sm font-bold text-indigo-900">Última Avaliação Encontrada</h4>
                   <p className="text-xs text-indigo-700 font-medium">Data: <span className="font-bold">{internationHistory.lastDate} às {internationHistory.lastTime}</span></p>
                   <div className="mt-1 inline-flex items-center gap-2 bg-white px-2 py-1 rounded border border-indigo-100 shadow-sm">
                       <span className="text-[10px] font-black text-slate-500 uppercase">NEWS ANTERIOR:</span>
                       <span className="text-lg font-black text-indigo-700 leading-none">{internationHistory.newsScore || '0'}</span>
                   </div>
               </div>
            </div>
            
            <div className="w-full md:w-auto bg-white/60 p-3 rounded-lg border border-indigo-100">
               <span className="block text-[9px] font-bold text-indigo-400 uppercase mb-1 text-center md:text-right">SINAIS VITAIS ANTERIORES</span>
               <div className="flex gap-4 text-xs font-mono font-bold text-slate-700 justify-center md:justify-end">
                   <span>PA: {internationHistory.lastVitals?.pas || 'x'}x{internationHistory.lastVitals?.pad || 'x'}</span>
                   <span>FC: {internationHistory.lastVitals?.fc || '-'}</span>
                   <span>SpO2: {internationHistory.lastVitals?.spo2 || '-'}%</span>
                   <span>Temp: {internationHistory.lastVitals?.temp || '-'}</span>
               </div>
            </div>
        </div>
      )}

      {/* SEÇÃO SINAIS VITAIS */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-2">
            <h3 className="font-black text-[#0d9488] text-sm uppercase flex items-center gap-2"><Stethoscope size={18}/> SINAIS VITAIS</h3>
            <span className="text-[10px] text-slate-400 font-bold uppercase">Preenchimento Obrigatório</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          {renderVitalInput('PA SISTÓLICA', 'pas', 'mmHg')}
          {renderVitalInput('PA DIASTÓLICA', 'pad', 'mmHg')}
          {renderVitalInput('FREQ. CARDÍACA', 'fc', 'bpm')}
          {renderVitalInput('FREQ. RESP.', 'fr', 'irpm')}
          {renderVitalInput('TEMPERATURA', 'temp', '°C')}
          {renderVitalInput('SATURAÇÃO O2', 'spo2', '%')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase">USO DE O2 SUPLEMENTAR?</span>
            <div className="flex bg-slate-200 p-1 rounded-lg gap-1">
              <button onClick={() => setVitals(p => ({...p, o2Sup: false}))} className={`px-6 py-2 rounded-md text-xs font-bold transition-all ${!vitals.o2Sup ? 'bg-[#2d3748] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>NÃO</button>
              <button onClick={() => setVitals(p => ({...p, o2Sup: true}))} className={`px-6 py-2 rounded-md text-xs font-bold transition-all ${vitals.o2Sup ? 'bg-[#0d9488] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>SIM</button>
            </div>
          </div>
          <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-700 uppercase">NÍVEL CONSCIÊNCIA</span>
            <select value={vitals.consciousness} onChange={e => setVitals(p => ({...p, consciousness: e.target.value as any}))} className="p-2.5 rounded-lg text-sm font-bold outline-none border-2 border-emerald-500 text-emerald-900 bg-white">
              <option value="Alert">Alerta (A)</option>
              <option value="Confused">Confuso (C)</option>
              <option value="Pain">Dor (P)</option>
              <option value="Unresponsive">Inconsciente (U)</option>
            </select>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-100 pt-6">
            <label className="text-[10px] font-bold text-slate-600 uppercase mb-3 flex items-center gap-1"><Activity size={12}/> ESCALA DE DOR</label>
            <div className="flex w-full h-10 gap-1">
                {Array.from({length: 11}, (_, i) => (
                    <button 
                        key={i} 
                        onClick={() => setVitals(p => ({...p, painLevel: i}))}
                        className={`flex-1 rounded transition-all flex items-center justify-center font-bold text-sm ${vitals.painLevel === i ? 'ring-4 ring-offset-2 ring-slate-300 scale-110 z-10 text-slate-900' : 'text-slate-600'}`}
                        style={{ backgroundColor: painColors[i] }}
                    >
                        {i}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* CARD NEWS RESULTADO */}
      <div className="bg-white rounded-xl shadow-lg border-l-[8px] border-[#0d9488] p-6 overflow-hidden">
        <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-100 flex items-center justify-center">
                    <span className="text-3xl font-black text-[#0d9488]">{newsResult.score}</span>
                </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PONTUAÇÃO NEWS</h3>
                <div className={`text-2xl font-black uppercase tracking-tight ${newsResult.riskClass === 'high' ? 'text-red-600' : 'text-[#0d9488]'}`}>
                    {newsResult.riskText}
                </div>
            </div>

            <div className="hidden md:block w-px h-12 bg-slate-100"></div>

            <div className="flex-1 text-center md:text-left">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center md:justify-start gap-1">
                    <Activity size={12}/> CONDUTA RECOMENDADA
                </h3>
                <div className="text-base font-bold text-slate-700">
                    {newsResult.conduct}
                </div>
            </div>
        </div>
      </div>

      {/* CHECKLIST DE SINTOMAS - VISUAL RESTAURADO CONFORME PRINT */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <button 
            onClick={() => setIsSymptomsOpen(!isSymptomsOpen)} 
            className="w-full bg-slate-50 p-4 flex justify-between items-center text-xs font-bold uppercase text-slate-700 border-b border-slate-200"
          >
            <span className="flex items-center gap-2">
                <Check size={16} className="text-slate-500" /> Checklist de Sintomas (Opcional)
            </span>
            {isSymptomsOpen ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
          </button>
          
          {isSymptomsOpen && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8 bg-white animate-fade-in">
                {/* COLUNA NEUROLÓGICO */}
                <div className="space-y-3">
                    <h5 className="text-[11px] font-black text-indigo-700 uppercase flex items-center gap-2 border-b border-indigo-100 pb-2 mb-4 tracking-wider">
                        <Brain size={16} /> NEUROLÓGICO
                    </h5>
                    {['neuro_rima', 'neuro_forca', 'neuro_fala', 'neuro_cefaleia', 'neuro_vertigem', 'neuro_visual'].map(id => (
                        <div 
                            key={id} 
                            onClick={() => toggleSymptom(id)} 
                            className="flex items-start gap-3 group cursor-pointer"
                        >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5 ${selectedSymptoms.includes(id) ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'bg-white border-slate-300 group-hover:border-indigo-400'}`}>
                                {selectedSymptoms.includes(id) && <Check size={12} className="text-white font-bold" />}
                            </div>
                            <span className={`text-[12px] leading-tight transition-colors ${selectedSymptoms.includes(id) ? 'text-indigo-900 font-bold' : 'text-slate-600 font-medium'}`}>
                                {SYMPTOM_LABELS[id]}
                            </span>
                        </div>
                    ))}
                </div>

                {/* COLUNA DOR TORÁCICA */}
                <div className="space-y-3">
                    <h5 className="text-[11px] font-black text-rose-700 uppercase flex items-center gap-2 border-b border-rose-100 pb-2 mb-4 tracking-wider">
                        <Heart size={16} /> DOR TORÁCICA
                    </h5>
                    {['sca_a_tipica', 'sca_a_bracos', 'sca_a_pescoco', 'sca_b_estomago', 'sca_b_costas', 'sca_c_dispneia', 'sca_c_sudorese', 'sca_c_palpitacao', 'sca_c_malsubito'].map(id => (
                        <div 
                            key={id} 
                            onClick={() => toggleSymptom(id)} 
                            className="flex items-start gap-3 group cursor-pointer"
                        >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5 ${selectedSymptoms.includes(id) ? 'bg-rose-600 border-rose-600 shadow-sm' : 'bg-white border-slate-300 group-hover:border-rose-400'}`}>
                                {selectedSymptoms.includes(id) && <Check size={12} className="text-white font-bold" />}
                            </div>
                            <span className={`text-[12px] leading-tight transition-colors ${selectedSymptoms.includes(id) ? 'text-rose-900 font-bold' : 'text-slate-600 font-medium'}`}>
                                {SYMPTOM_LABELS[id]}
                            </span>
                        </div>
                    ))}
                </div>

                {/* COLUNA INFECCIOSO */}
                <div className="space-y-3">
                    <h5 className="text-[11px] font-black text-orange-700 uppercase flex items-center gap-2 border-b border-orange-100 pb-2 mb-4 tracking-wider">
                        <Activity size={16} /> INFECCIOSO
                    </h5>
                    {['inf_infeccao', 'inf_oliguria'].map(id => (
                        <div 
                            key={id} 
                            onClick={() => toggleSymptom(id)} 
                            className="flex items-start gap-3 group cursor-pointer"
                        >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5 ${selectedSymptoms.includes(id) ? 'bg-orange-600 border-orange-600 shadow-sm' : 'bg-white border-slate-300 group-hover:border-orange-400'}`}>
                                {selectedSymptoms.includes(id) && <Check size={12} className="text-white font-bold" />}
                            </div>
                            <span className={`text-[12px] leading-tight transition-colors ${selectedSymptoms.includes(id) ? 'text-orange-900 font-bold' : 'text-slate-600 font-medium'}`}>
                                {SYMPTOM_LABELS[id]}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
          )}
      </div>

      {/* CAMPO DE OBSERVAÇÕES */}
      <div className="space-y-3">
          <label className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2 px-1">
              <FileText size={18} className="text-slate-500" /> Observações Gerais
          </label>
          <textarea 
            className="w-full p-4 border border-slate-300 rounded-lg bg-white text-sm text-slate-800 font-medium outline-none focus:ring-2 focus:ring-teal-500 transition-all shadow-sm" 
            rows={4} 
            placeholder="Descreva queixas adicionais ou detalhes relevantes da avaliação..." 
            value={observations} 
            onChange={e => setObservations(e.target.value)} 
          />
      </div>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex items-center justify-end gap-4 mt-8">
          <button onClick={handlePrintPdf} className="px-6 py-3 bg-slate-700 text-white font-bold rounded-lg shadow-md flex items-center gap-2 transition-all hover:bg-slate-800 border-b-4 border-slate-900 active:border-b-0 active:translate-y-1">
            <Printer size={18}/> PDF
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting} 
            className="px-8 py-3 bg-[#0d9488] hover:bg-[#0b7a6f] text-white font-bold rounded-lg shadow-md flex items-center gap-2 disabled:opacity-50 transition-all border-b-4 border-[#096a61] active:border-b-0 active:translate-y-1 uppercase tracking-wide text-sm"
          >
            {isSubmitting ? 'Salvando...' : <><Save size={18}/> FINALIZAR AVALIAÇÃO</>}
          </button>
      </div>
    </div>
  );
};