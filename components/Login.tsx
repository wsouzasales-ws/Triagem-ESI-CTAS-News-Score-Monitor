import React, { useState } from 'react';
import { Activity, User, Mail, Lock, KeyRound, CheckCircle2, AlertTriangle, Settings, X, Database } from 'lucide-react';
import { fetchWithRetry } from '../utils/api'; // Novo Import

interface LoginProps {
  onLogin: (userData: { name: string; email: string }) => void;
  scriptUrl: string;
}

export const Login: React.FC<LoginProps> = ({ onLogin, scriptUrl: initialScriptUrl }) => {
  const [view, setView] = useState<'login' | 'register' | 'recover'>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register State
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  
  // Novos estados separados para Setor e Função
  const [registerSector, setRegisterSector] = useState('');
  const [registerRole, setRegisterRole] = useState('');
  
  const [registerPassword, setRegisterPassword] = useState('');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Helper para tratar mensagens de erro técnicas
  const formatError = (msg: string) => {
    if (!msg) return "Erro desconhecido. Contate o administrador.";
    if (msg.includes('MailApp') || msg.includes('permission')) {
       return "Erro de configuração do servidor de e-mail.";
    }
    return msg;
  };

  // --- LOGIN ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // --- CREDENCIAL HARDCODED (BYPASS) ---
    if (email.trim().toLowerCase() === 'wanderson.sales@redemedical.com.br' && password === 'Ellen1221') {
        setTimeout(() => {
            onLogin({
                name: 'Wanderson de Souza Sales',
                email: 'wanderson.sales@redemedical.com.br'
            });
        }, 1000); 
        return;
    }
    // -------------------------------------

    try {
      // Uso de Retry
      const data = await fetchWithRetry(initialScriptUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ 
            action: 'login', 
            email: email.trim(), 
            password: password.trim() 
        })
      });
      
      if (data.result === 'success') {
         onLogin(data.user);
         return;
      } else {
         const debugInfo = data.message ? data.message : `Erro Servidor (Raw): ${JSON.stringify(data)}`;
         setError(debugInfo);
      }
    } catch (err: any) {
      console.error("Erro no login:", err);
      const errMsg = err.message ? err.message : 'Erro de conexão';
      setError(`Falha ao conectar: ${errMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- CADASTRO ---
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    // Combina Setor e Função para enviar ao backend
    const combinedSectorInfo = `${registerSector} - ${registerRole}`;

    try {
      const data = await fetchWithRetry(initialScriptUrl.trim(), {
         method: 'POST',
         headers: { 'Content-Type': 'text/plain;charset=utf-8' },
         body: JSON.stringify({
            action: 'registerUser',
            name: registerName,
            email: registerEmail.trim(),
            sector: combinedSectorInfo,
            password: registerPassword.trim()
         })
      });
      
      if (data.result === 'success') {
         if (data.warning) {
            setSuccessMsg(data.warning);
         } else {
            setSuccessMsg('Conta criada! Verifique seu e-mail (Inclusive Spam).');
         }
         
         setRegisterName('');
         setRegisterEmail('');
         setRegisterSector('');
         setRegisterRole('');
         setRegisterPassword('');
         setTimeout(() => {
           setSuccessMsg('');
           setView('login');
         }, 8000);
      } else {
         const debugMsg = data.message ? data.message : `Erro Backend: ${JSON.stringify(data)}`;
         setError(debugMsg);
      }

    } catch (e: any) {
       setError(`Erro: ${e.message || 'Falha na conexão'}`);
    } finally {
       setIsLoading(false);
    }
  };

  // --- RECUPERAR SENHA ---
  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const data = await fetchWithRetry(initialScriptUrl.trim(), {
         method: 'POST',
         headers: { 'Content-Type': 'text/plain;charset=utf-8' },
         body: JSON.stringify({
            action: 'recoverPassword',
            email: email.trim()
         })
      });
      
      if (data.result === 'success') {
         setSuccessMsg('Sucesso! Verifique seu e-mail (e a caixa de Spam).');
         setTimeout(() => {
            setSuccessMsg('');
            setView('login');
         }, 5000);
      } else {
         setError(data.message || 'E-mail não encontrado.');
      }
    } catch (err: any) {
       setError(`Erro: ${err.message}`);
    } finally {
       setIsLoading(false);
    }
  };

  // Componentes Visuais Comuns
  const LogoHeader = () => (
    <div className="flex flex-col items-center mb-8">
      <div className="w-20 h-20 bg-slate-50 border-2 border-slate-200 rounded-full flex items-center justify-center mb-4 shadow-sm">
        <Activity size={40} className="text-rose-600" />
      </div>
      <h1 className="text-2xl font-bold text-slate-800 uppercase tracking-wide text-center flex flex-col items-center gap-1">
        <span>Triagem Híbrida <span className="text-rose-600">ESI + CTAS</span></span>
        <span className="text-xs bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full font-black tracking-widest border border-emerald-200">
           + NEWS Score
        </span>
      </h1>
      <p className="text-slate-400 text-sm mt-3 font-medium">Sistema de Acolhimento e Classificação de Risco</p>
    </div>
  );

  // Exibe parte da URL para debug
  const truncatedUrl = initialScriptUrl.length > 50 
    ? initialScriptUrl.substring(0, 45) + '...' 
    : initialScriptUrl;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans relative">
      
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border-t-4 border-rose-600 flex flex-col">
        <div className="p-8 flex-1">
          <LogoHeader />

          {successMsg && (
             <div className="bg-emerald-50 border border-emerald-200 p-3 rounded text-emerald-800 text-sm font-bold text-center mb-4 flex items-center justify-center gap-2 animate-fade-in">
                <CheckCircle2 size={18} /> {successMsg}
             </div>
          )}

          {/* VIEW: LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email Profissional</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-slate-700 pl-10 bg-slate-50 focus:bg-white transition-colors"
                    placeholder="nome@hospital.com"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-bold text-slate-700">Senha</label>
                  <button type="button" onClick={() => { setEmail(''); setError(''); setSuccessMsg(''); setView('recover'); }} className="text-xs text-rose-600 hover:text-rose-800 font-medium">Esqueci minha senha</button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none text-slate-700 pl-10 bg-slate-50 focus:bg-white tracking-widest transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 p-3 rounded border border-red-100 text-center font-bold flex items-start gap-2 break-all justify-center">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>{formatError(error)}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-70 uppercase tracking-wide text-sm"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    Acessar Sistema
                  </>
                )}
              </button>

              <div className="pt-6 text-center border-t border-slate-100">
                <span className="text-sm text-slate-500">Novo colaborador? </span>
                <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setView('register'); }} className="text-sm font-bold text-teal-600 hover:text-teal-700 hover:underline">
                  Criar Conta
                </button>
              </div>
            </form>
          )}

          {/* VIEW: RECOVER */}
          {view === 'recover' && (
            <form onSubmit={handleRecoverSubmit} className="space-y-5 animate-fade-in">
              <div className="text-center mb-4">
                 <h3 className="font-bold text-slate-700">Recuperação de Acesso</h3>
                 <p className="text-xs text-slate-500">O sistema enviará sua senha atual para o e-mail cadastrado.</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email Cadastrado</label>
                <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 outline-none pl-10"
                    placeholder="nome@hospital.com"
                  />
                </div>
              </div>

              {error && (
                <div className="text-xs text-red-600 bg-red-50 p-3 rounded border border-red-100 text-center font-bold flex items-start gap-2 justify-center">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>{formatError(error)}</div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 uppercase text-sm"
              >
                 {isLoading ? 'Enviando...' : <><KeyRound size={18} /> Recuperar Senha</>}
              </button>

              <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setView('login'); }} className="w-full text-sm text-slate-500 hover:text-slate-700 mt-2 block text-center font-medium">
                Voltar para Login
              </button>
            </form>
          )}

          {/* VIEW: REGISTER */}
          {view === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-fade-in">
              <div className="text-center mb-2">
                 <h3 className="font-bold text-slate-700">Solicitação de Acesso</h3>
                 <p className="text-xs text-slate-500">Seus dados de acesso serão enviados por e-mail.</p>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Nome Completo</label>
                <input 
                  type="text" 
                  required 
                  value={registerName}
                  onChange={e => setRegisterName(e.target.value)}
                  className="w-full p-2.5 border border-slate-600 bg-slate-700 text-white rounded focus:ring-2 focus:ring-rose-500 outline-none text-sm placeholder-slate-400" 
                  placeholder="Digite seu nome completo" 
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Email Profissional</label>
                <input 
                  type="email" 
                  required 
                  value={registerEmail}
                  onChange={e => setRegisterEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-600 bg-slate-700 text-white rounded focus:ring-2 focus:ring-rose-500 outline-none text-sm placeholder-slate-400" 
                  placeholder="nome@hospital.com" 
                />
              </div>

              {/* SELEÇÃO DE SETOR E FUNÇÃO DIVIDIDA */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Setor</label>
                  <select
                    required
                    value={registerSector}
                    onChange={e => setRegisterSector(e.target.value)}
                    className="w-full p-2.5 border border-slate-600 bg-slate-700 text-white rounded focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                  >
                    <option value="" disabled className="text-slate-400">Selecione...</option>
                    <option value="Pronto Atendimento">Pronto Atendimento</option>
                    <option value="Unidade de Internação">Unidade de Internação</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Função</label>
                  <select
                    required
                    value={registerRole}
                    onChange={e => setRegisterRole(e.target.value)}
                    className="w-full p-2.5 border border-slate-600 bg-slate-700 text-white rounded focus:ring-2 focus:ring-rose-500 outline-none text-sm"
                  >
                    <option value="" disabled className="text-slate-400">Selecione...</option>
                    <option value="Téc. de Enfermagem">Téc. de Enfermagem</option>
                    <option value="Enfermeiro">Enfermeiro</option>
                    <option value="Médico">Médico</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">Definir Senha</label>
                <input 
                  type="password" 
                  required 
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
                  className="w-full p-2.5 border border-slate-600 bg-slate-700 text-white rounded focus:ring-2 focus:ring-rose-500 outline-none text-sm placeholder-slate-400" 
                  placeholder="••••••••" 
                />
              </div>
              
              {error && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded font-bold text-center flex items-center justify-center gap-2 break-all">
                   <AlertTriangle size={14} className="shrink-0" /> {formatError(error)}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 mt-4 uppercase text-sm"
              >
                 {isLoading ? 'Processando...' : <><User size={18} /> Criar Conta</>}
              </button>

              <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setView('login'); }} className="w-full text-sm text-slate-500 hover:text-slate-700 mt-3 block text-center font-medium">
                Já possuo cadastro
              </button>
            </form>
          )}
        </div>
        
        {/* FOOTER DIAGNOSTICO */}
        <div className="bg-slate-50 p-2 text-center border-t border-slate-200">
           <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 font-mono" title={initialScriptUrl}>
              <Database size={10} /> Conectado a: {truncatedUrl}
           </div>
           <p className="text-[9px] text-slate-300 uppercase tracking-wider font-bold mt-1">Uso Exclusivo Interno</p>
        </div>
      </div>
    </div>
  );
};