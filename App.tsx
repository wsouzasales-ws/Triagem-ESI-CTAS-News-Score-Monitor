import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Activity, HelpCircle, LogOut, LayoutDashboard, Monitor, FileClock, BedDouble, BarChart2
} from 'lucide-react';
import { PatientData, VitalSigns, CtasDiscriminators, PatientHistory, SheetRowData, InternationSheetRowData } from './types';
import { calculateTriage } from './utils/esiCtasEngine';
import { fetchWithRetry } from './utils/api';
import { PrintableReport } from './components/PrintableReport';

const Login = React.lazy(() => import('./components/Login').then(module => ({ default: module.Login })));
const TechnicalSheetModal = React.lazy(() => import('./components/TechnicalSheetModal').then(module => ({ default: module.TechnicalSheetModal })));
const AppScriptGenerator = React.lazy(() => import('./components/AppScriptGenerator').then(module => ({ default: module.AppScriptGenerator })));
const HistorySection = React.lazy(() => import('./components/HistorySection').then(module => ({ default: module.HistorySection })));
const InternationSection = React.lazy(() => import('./components/InternationSection').then(module => ({ default: module.InternationSection })));
const InternationReportsSection = React.lazy(() => import('./components/InternationReportsSection'));
const TriageSection = React.lazy(() => import('./components/TriageSection'));
const DashboardSection = React.lazy(() => import('./components/DashboardSection'));
const ReportsSection = React.lazy(() => import('./components/ReportsSection'));

const DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbypWWb0HcWJx4e52LEGAsK-zQJhC6TOofvZKS8FEGGdfGccZQUXKo8GudbUQFW7QTY4/exec';

// Interface atualizada para conter o setor/função
interface UserSession {
  name: string;
  email: string;
  sector?: string;
}

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [scriptUrl, setScriptUrl] = useState<string>(() => (localStorage.getItem('appScriptUrl') || DEFAULT_SCRIPT_URL).trim());
  const [activeTab, setActiveTab] = useState<'triage' | 'internation' | 'reports' | 'internationReports' | 'dashboard' | 'history'>('triage');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [isTechSheetOpen, setIsTechSheetOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSearchingHistory, setIsSearchingHistory] = useState(false);
  const [patientHistory, setPatientHistory] = useState<PatientHistory | null>(null);
  const [reportData, setReportData] = useState<SheetRowData[]>([]);
  const [internationReportData, setInternationReportData] = useState<InternationSheetRowData[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [lastDashboardUpdate, setLastDashboardUpdate] = useState<Date | null>(null);

  // Regra de Bloqueio Visual solicitada
  const isTechnicianRestricted = useMemo(() => {
    return currentUser?.sector === "Unidade de Internação - Téc. de Enfermagem";
  }, [currentUser]);

  const [patient, setPatient] = useState<PatientData>({
    name: '', medicalRecord: '', dob: '', serviceTimestamp: '', evaluationDate: '', evaluationTime: '',
    isReevaluation: false, age: 0, ageUnit: 'years', gender: 'M', complaint: '', reevaluationDate: '', reevaluationTime: ''
  });

  const [vitals, setVitals] = useState<VitalSigns>({
    pas: '', pad: '', fc: '', fr: '', temp: '', spo2: '', gcs: 15, painLevel: ''
  });

  const [discriminators, setDiscriminators] = useState<CtasDiscriminators>({
    abcUnstable: false,
    highRiskSituation: false,
    resources: 'none',
    neuro: { gcsLow: false, acuteConfusion: false, headTrauma: false, severeHeadache: false },
    sepsis: { suspectedInfection: false, immunosuppressed: false, perfursionIssues: false },
    cardio: { chestPainRisk: false, chestPainTypical: false, chestPainAtypicalCombined: false, severePainWithVitals: false },
    respiratory: { dyspneaRisk: false, respiratoryDistress: false },
    pediatric: { dehydration: false, feverRisk: false, lethargy: false }
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('appUserSession');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user && user.email) {
          setCurrentUser(user);
          setIsAuthenticated(true);
          // Se o usuário já estiver logado e for restrito, garante que ele não comece na aba de triagem
          if (user.sector === "Unidade de Internação - Téc. de Enfermagem") {
             setActiveTab('internation');
          }
        }
      } catch (e) {
        localStorage.removeItem('appUserSession');
      }
    }
  }, []);

  useEffect(() => {
    if (patient.dob) {
      const birthDate = new Date(patient.dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      if (age === 0) {
        let months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
        if (today.getDate() < birthDate.getDate()) months--;
        setPatient(prev => ({ ...prev, age: months, ageUnit: 'months' }));
      } else {
        setPatient(prev => ({ ...prev, age: age, ageUnit: 'years' }));
      }
    }
  }, [patient.dob]);

  useEffect(() => {
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    setPatient(prev => ({ 
      ...prev, 
      serviceTimestamp: currentTime,
      evaluationDate: currentDate,
      evaluationTime: currentTime,
      reevaluationDate: currentDate,
      reevaluationTime: currentTime 
    }));
  }, []);

  const fetchPatientHistory = useCallback(async (recordId: string) => {
    if (!recordId) {
       setNotification({ msg: 'Informe o Nº de Atendimento para buscar.', type: 'error' });
       setTimeout(() => setNotification(null), 3000);
       return;
    }
    setIsSearchingHistory(true);
    setPatientHistory(null);
    try {
      const timestamp = new Date().getTime();
      const data = await fetchWithRetry(`${scriptUrl.trim()}?action=search&medicalRecord=${encodeURIComponent(recordId)}&_=${timestamp}`, { method: 'GET' });
      if (data.result === 'found') {
          setPatientHistory(data.history);
          let foundAge = 0;
          let foundUnit: 'years' | 'months' = 'years';
          if (data.history.ageString) {
             const match = data.history.ageString.match(/(\d+)\s*(years|anos|months|meses)/i);
             if (match) {
                foundAge = parseInt(match[1]);
                if (match[2].toLowerCase().includes('month') || match[2].toLowerCase().includes('mes')) {
                   foundUnit = 'months';
                }
             }
          }
          const now = new Date();
          const currentReevalDate = now.toISOString().split('T')[0];
          const currentReevalTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          setPatient(prev => ({
             ...prev,
             name: data.history.name || prev.name, 
             age: foundAge > 0 ? foundAge : prev.age,
             ageUnit: foundUnit,
             dob: data.history.dob || prev.dob,
             evaluationDate: data.history.lastDate || prev.evaluationDate,
             evaluationTime: data.history.lastTime || prev.evaluationTime,
             reevaluationDate: currentReevalDate,
             reevaluationTime: currentReevalTime
          }));
          setNotification({ msg: 'Histórico carregado! Dados preenchidos.', type: 'success' });
      } else {
          setNotification({ msg: 'Nenhum histórico encontrado para este número.', type: 'error' });
      }
    } catch (e) {
      setNotification({ msg: 'Erro na busca. Verifique conexão.', type: 'error' });
    } finally {
        setIsSearchingHistory(false);
        setTimeout(() => setNotification(null), 3000);
    }
  }, [scriptUrl]);

  const handleSyncFromSheet = useCallback(() => {
    setIsLoadingReports(true);
    const timestamp = new Date().getTime();
    fetchWithRetry(`${scriptUrl.trim()}?action=getAll&_=${timestamp}`, { method: 'GET' })
    .then(data => {
        if (data.result === 'success' && Array.isArray(data.data)) {
            setReportData(data.data);
            setLastDashboardUpdate(new Date());
        } else {
            setReportData([]); 
        }
    })
    .catch(err => {
        setReportData([]);
        setNotification({ msg: 'Erro de Sincronização.', type: 'error' });
    })
    .finally(() => setIsLoadingReports(false));
  }, [scriptUrl]);

  const handleSyncInternation = useCallback(() => {
    const timestamp = new Date().getTime();
    fetchWithRetry(`${scriptUrl.trim()}?action=getAllInternation&_=${timestamp}`, { method: 'GET' })
    .then(data => {
        if (data.result === 'success' && Array.isArray(data.data)) {
            setInternationReportData(data.data);
        } else {
            setInternationReportData([]); 
        }
    })
    .catch(err => {
        setInternationReportData([]);
    });
  }, [scriptUrl]);

  useEffect(() => {
    if (isAuthenticated) {
        if (activeTab === 'reports' || activeTab === 'dashboard') handleSyncFromSheet();
        if (activeTab === 'internationReports' || activeTab === 'dashboard') handleSyncInternation();
    }
  }, [activeTab, isAuthenticated, handleSyncFromSheet, handleSyncInternation]);

  useEffect(() => {
    let interval: any;
    if (isAuthenticated && activeTab === 'dashboard') {
      interval = setInterval(() => {
        handleSyncFromSheet();
        handleSyncInternation();
      }, 30 * 1000);
    }
    return () => clearInterval(interval);
  }, [activeTab, isAuthenticated, handleSyncFromSheet, handleSyncInternation]);

  const triageResult = useMemo(() => calculateTriage(patient, vitals, discriminators), [patient, vitals, discriminators]);

  const handlePrint = useCallback(() => {
    window.scrollTo(0, 0);
    setIsGeneratingPdf(true);
    setTimeout(() => {
      const element = document.getElementById('report-content');
      if (element) {
        // @ts-ignore
        window.html2pdf().set({
          margin: 0,
          filename: `Triagem_${patient.name || 'Paciente'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).from(element).save().then(() => setIsGeneratingPdf(false));
      }
    }, 500);
  }, [patient.name]);

  const handleSubmit = useCallback(async () => {
    if (!patient.name || !patient.medicalRecord) { 
      setNotification({ msg: 'Preencha o Nome e o Número de Atendimento.', type: 'error' }); 
      return; 
    }
    setIsSubmitting(true);
    const finalEvaluationDate = (patient.isReevaluation && patient.reevaluationDate) ? patient.reevaluationDate : patient.evaluationDate;
    const finalEvaluationTime = (patient.isReevaluation && patient.reevaluationTime) ? patient.reevaluationTime : patient.evaluationTime;
    const safePayload = {
      action: 'save',
      patient: { ...patient, evaluationDate: finalEvaluationDate, evaluationTime: finalEvaluationTime, age: String(patient.age), isReevaluation: !!patient.isReevaluation, dob: patient.dob },
      vitals: { ...vitals, painLevel: String(vitals.painLevel), gcs: String(vitals.gcs) },
      triage: { level: String(triageResult.level), title: triageResult.title, maxWaitTime: triageResult.maxWaitTime, justification: triageResult.justification, discriminators: triageResult.discriminators },
      discriminators,
      user: currentUser?.name ? `${currentUser.name}` : (currentUser?.email || 'Desconhecido')
    };
    try {
      await fetchWithRetry(scriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(safePayload)
      });
      setNotification({ msg: 'Dados enviados para a planilha!', type: 'success' });
      const now = new Date();
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      setPatient({ name: '', medicalRecord: '', dob: '', serviceTimestamp: currentTime, evaluationDate: currentDate, evaluationTime: currentTime, isReevaluation: false, age: 0, ageUnit: 'years', gender: 'M', complaint: '', reevaluationDate: currentDate, reevaluationTime: currentTime });
      setVitals({ pas: '', pad: '', fc: '', fr: '', temp: '', spo2: '', gcs: 15, painLevel: '' });
      setDiscriminators({ abcUnstable: false, highRiskSituation: false, resources: 'none', neuro: { gcsLow: false, acuteConfusion: false, headTrauma: false, severeHeadache: false }, sepsis: { suspectedInfection: false, immunosuppressed: false, perfursionIssues: false }, cardio: { chestPainRisk: false, chestPainTypical: false, chestPainAtypicalCombined: false, severePainWithVitals: false }, respiratory: { dyspneaRisk: false, respiratoryDistress: false }, pediatric: { dehydration: false, feverRisk: false, lethargy: false } });
      setPatientHistory(null);
    } catch (e: any) {
      setNotification({ msg: 'Erro ao salvar.', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setNotification(null), 4000);
    }
  }, [patient, vitals, discriminators, triageResult, scriptUrl, currentUser]);

  const handleExportExcel = useCallback((worsened: any[], month: string) => {
    if (worsened.length === 0) return;
    // @ts-ignore
    if (typeof XLSX === 'undefined') return;
    const dataToExport = worsened.map(item => ({ 'Nome do Paciente': item.name, 'Nº Atendimento (AT)': item.id, 'Classificação Anterior': `ESI ${item.oldLevel}`, 'Classificação Atual': `ESI ${item.newLevel}`, 'Data da Reavaliação': new Date(item.date).toLocaleDateString('pt-BR') }));
    // @ts-ignore
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    // @ts-ignore
    const wb = XLSX.utils.book_new();
    // @ts-ignore
    XLSX.utils.book_append_sheet(wb, ws, "Piora Clínica");
    // @ts-ignore
    XLSX.writeFile(wb, `Relatorio_Piora_Clinica_${month}.xlsx`);
  }, []);

  const handleLogin = (userData: UserSession) => {
    setCurrentUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('appUserSession', JSON.stringify(userData));
    // Redireciona usuários restritos após o login
    if (userData.sector === "Unidade de Internação - Téc. de Enfermagem") {
       setActiveTab('internation');
    } else {
       setActiveTab('triage');
    }
  };

  const handleLogout = () => { setIsAuthenticated(false); setCurrentUser(null); localStorage.removeItem('appUserSession'); };
  
  if (!isAuthenticated) return <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-100">Carregando Login...</div>}><Login onLogin={handleLogin} scriptUrl={scriptUrl.trim()} /></React.Suspense>;

  return (
    <>
      {isGeneratingPdf && <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center text-white"><div className="animate-spin rounded-full h-16 w-16 border-4 border-teal-500 border-t-transparent mb-6"></div><h2 className="text-2xl font-bold">Gerando Relatório...</h2></div>}
      {isGeneratingPdf && activeTab === 'triage' && (
        <div className="fixed top-0 left-0 w-full h-full bg-white z-[50] flex justify-center items-start overflow-auto">
          <div id="report-content" style={{ width: '794px', backgroundColor: 'white' }}>
            <PrintableReport patient={patient} vitals={vitals} triageResult={triageResult} discriminators={discriminators} />
          </div>
        </div>
      )}
      <div className={`min-h-screen bg-slate-100 font-sans pb-20 ${isGeneratingPdf ? 'hidden' : 'block'}`}>
        {notification && <div className={`fixed top-4 right-4 p-4 rounded-md shadow-lg text-white font-medium z-50 animate-bounce ${notification.type === 'success' ? 'bg-teal-600' : 'bg-rose-600'}`}>{notification.msg}</div>}
        <header className="bg-white border-b border-slate-300 shadow-sm sticky top-0 z-20"><div className="max-w-6xl mx-auto px-4 py-3"><div className="flex flex-col md:flex-row md:justify-between items-center mb-4 gap-4"><div className="flex items-center justify-between w-full md:w-auto"><div className="flex items-center gap-3"><Activity className="text-rose-600 shrink-0" size={28} /><div className="flex flex-col"><h1 className="text-lg font-bold text-slate-800 uppercase tracking-tight leading-none">TRIAGEM HÍBRIDA <span className="text-rose-600">ESI + CTAS</span></h1><span className="text-[10px] font-bold text-emerald-600 tracking-widest uppercase mt-0.5">+ NEWS Score Monitoramento</span></div></div><button onClick={handleLogout} className="md:hidden text-slate-400 hover:text-rose-600"><LogOut size={20} /></button></div><div className="flex items-center gap-4">{activeTab === 'triage' && <div className={`px-4 py-2 rounded font-bold text-white shadow-sm transition-colors uppercase tracking-wider text-sm ${triageResult.color}`}>{triageResult.title}</div>}<div className="hidden md:flex items-center gap-3 pl-4 border-l border-slate-200"><div className="text-right"><p className="text-sm font-bold text-slate-700">{currentUser?.name}</p><p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{currentUser?.sector}</p></div><button onClick={handleLogout} className="bg-slate-100 p-2 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-colors" title="Sair"><LogOut size={18} /></button></div></div></div><div className="flex space-x-4 border-b border-slate-200 overflow-x-auto">
          
          {/* BLOQUEIO VISUAL DA ABA NOVA TRIAGEM */}
          {!isTechnicianRestricted && (
            <button onClick={() => setActiveTab('triage')} className={`pb-2 px-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'triage' ? 'border-rose-600 text-rose-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Nova Triagem</button>
          )}

          <button onClick={() => setActiveTab('internation')} className={`pb-2 px-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'internation' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><BedDouble size={16}/> Pacientes Internados</button>
          <button onClick={() => setActiveTab('dashboard')} className={`pb-2 px-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><Monitor size={16}/> Painel de Gestão (TV)</button>
          <button onClick={() => setActiveTab('reports')} className={`pb-2 px-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'reports' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><LayoutDashboard size={16}/> Indicadores</button>
          <button onClick={() => setActiveTab('internationReports')} className={`pb-2 px-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'internationReports' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><BarChart2 size={16}/> Indicadores Internação</button>
          <button onClick={() => setActiveTab('history')} className={`pb-2 px-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'history' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}><FileClock size={16}/> Histórico</button>
        </div></div></header>
        <main className="max-w-6xl mx-auto px-4 py-6 space-y-6"><React.Suspense fallback={<div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-4 border-teal-500 border-t-transparent"></div></div>}>{activeTab === 'triage' && !isTechnicianRestricted && <TriageSection patient={patient} setPatient={setPatient} vitals={vitals} setVitals={setVitals} discriminators={discriminators} setDiscriminators={setDiscriminators} triageResult={triageResult} isSubmitting={isSubmitting} handleSubmit={handleSubmit} handlePrint={handlePrint} fetchPatientHistory={fetchPatientHistory} isSearchingHistory={isSearchingHistory} patientHistory={patientHistory} />}{activeTab === 'internation' && <InternationSection scriptUrl={scriptUrl.trim()} handleSyncFromSheet={handleSyncInternation} currentUser={currentUser} />}{activeTab === 'internationReports' && <InternationReportsSection reportData={internationReportData} handleSyncFromSheet={handleSyncInternation} isLoadingReports={isLoadingReports} />}{activeTab === 'dashboard' && <DashboardSection reportData={reportData} internationData={internationReportData} lastDashboardUpdate={lastDashboardUpdate} handleSyncFromSheet={handleSyncFromSheet} isLoadingReports={isLoadingReports} />}{activeTab === 'reports' && <ReportsSection reportData={reportData} handleSyncFromSheet={handleSyncFromSheet} isLoadingReports={isLoadingReports} handleExportExcel={handleExportExcel} />}{activeTab === 'history' && <HistorySection scriptUrl={scriptUrl.trim()} />}</React.Suspense></main>
        {/* Habilitando o Gerador de Script para todos os usuários temporariamente para facilitar a configuração */}
        <React.Suspense fallback={null}><AppScriptGenerator currentUrl={scriptUrl.trim()} onSaveUrl={(url) => setScriptUrl(url.trim())} /></React.Suspense>
        <button onClick={() => setIsTechSheetOpen(true)} className="fixed bottom-20 right-4 p-3 bg-slate-700 hover:bg-slate-800 rounded-full text-white shadow-lg z-10"><HelpCircle size={24} /></button>
        {isTechSheetOpen && <React.Suspense fallback={null}><TechnicalSheetModal isOpen={isTechSheetOpen} onClose={() => setIsTechSheetOpen(false)} /></React.Suspense>}
      </div>
    </>
  );
};

export default App;