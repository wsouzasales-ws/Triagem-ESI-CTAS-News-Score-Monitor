import React, { useState } from 'react';
import { Copy, Settings, Check, AlertTriangle, Mail, RotateCcw, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { fetchWithRetry } from '../utils/api';

interface Props {
  currentUrl: string;
  onSaveUrl: (url: string) => void;
}

// URL da Imagem v53 (Garantida como fallback)
const DEFAULT_HARDCODED_URL = "https://script.google.com/macros/s/AKfycbypWWb0HcWJx4e52LEGAsK-zQJhC6TOofvZKS8FEGGdfGccZQUXKo8GudbUQFW7QTY4/exec";

export const AppScriptGenerator: React.FC<Props> = ({ currentUrl, onSaveUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [copied, setCopied] = useState(false);
  
  // Estados do Teste de Conexão
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Script v45 (Mantido idêntico para garantir compatibilidade)
  const scriptCode = `
// --- CONFIGURAÇÕES GERAIS ---
var APP_NAME = "Triagem Híbrida ESI + CTAS";

function getSafe(obj, path, defaultValue) {
  try {
    if (!obj) return defaultValue;
    var keys = path.split('.');
    var current = obj;
    for (var i = 0; i < keys.length; i++) {
      if (current === undefined || current === null) return defaultValue;
      current = current[keys[i]];
    }
    if (Array.isArray(current)) return current.join("; ");
    return (current === undefined || current === null) ? defaultValue : String(current);
  } catch (e) {
    return defaultValue;
  }
}

// Helper: Organiza Headers e Formatação
function ensureHeader(sheet, headers, color) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(headers);
    formatHeaderRow(sheet, headers.length, color);
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.length < headers.length) {
       sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
       formatHeaderRow(sheet, headers.length, color);
    }
  }
}

function formatHeaderRow(sheet, columns, color) {
    var range = sheet.getRange(1, 1, 1, columns);
    range.setFontWeight("bold").setBackground(color).setHorizontalAlignment("center").setBorder(true, true, true, true, null, null);
    sheet.setFrozenRows(1);
}

function sendEmailRobust(to, subject, body, ss) {
  logError(ss, "INFO: Tentando enviar email", "Para: " + to);
  try {
    MailApp.sendEmail({to: to, subject: subject, body: body, name: APP_NAME, noReply: true});
    return true;
  } catch (e) {
    try {
      MailApp.sendEmail({to: to, subject: subject, body: body, name: APP_NAME});
      return true;
    } catch (e2) {
      logError(ss, "ERRO FATAL EMAIL", e2.toString());
      throw e2;
    }
  }
}

function setupStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheetPatients = ss.getSheets()[0];
  if (sheetPatients.getName() !== "Pacientes") sheetPatients.setName("Pacientes");
  
  var headersPatients = [
      "Data/Hora Registro", "Data Avaliação", "Hora Avaliação", "Nome", "Prontuário", 
      "Reavaliação?", "Idade", "Queixa", "PA", "FC", "FR", "Temp", "SpO2", "GCS", "Dor", 
      "ESI Level", "Classificação", "Tempo Alvo", "Justificativa", "Discriminadores", "Data Nascimento", "Usuário Resp."
  ];
  ensureHeader(sheetPatients, headersPatients, "#d9ead3");

  var sheetUsers = ss.getSheetByName("Usuários");
  if (!sheetUsers) sheetUsers = ss.insertSheet("Usuários");
  var headersUsers = ["Data Cadastro", "Nome", "Email", "Setor", "Senha"];
  ensureHeader(sheetUsers, headersUsers, "#cfe2f3");

  var sheetErrors = ss.getSheetByName("ERROS_SISTEMA");
  if (!sheetErrors) sheetErrors = ss.insertSheet("ERROS_SISTEMA");
  var headersErrors = ["Data", "Mensagem", "Detalhes"];
  ensureHeader(sheetErrors, headersErrors, "#f4cccc");
  
  var sheetInternation = ss.getSheetByName("Pacientes internados");
  if (!sheetInternation) sheetInternation = ss.insertSheet("Pacientes internados");
  var headersInternation = [
      "Data/Hora Registro", "Data Avaliação", "Hora Avaliação", "Nome", "Prontuário", 
      "Data Nascimento", "Setor", "Leito", "Reavaliação?",
      "PAS", "PAD", "FC", "FR", "Temp", "SpO2", "Consciencia", "O2 Suplementar", "Dor",
      "Obs", "NEWS Score", "Risco NEWS", "Usuário Resp."
  ];
  ensureHeader(sheetInternation, headersInternation, "#9fc5e8");

  return "Estrutura Organizada (v45): Headers Prontuário + FilterHistory Fix.";
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet(); 
    
    if (!action) {
       var lock = LockService.getScriptLock();
       if (lock.tryLock(5000)) { 
          try { setupStructure(); } finally { lock.releaseLock(); }
       }
       return jsonResponse({ "result": "success", "message": "Script v45 Online" });
    }

    var sheet = ss.getSheets()[0];

    if (action === 'search' || action === 'searchInternation' || action === 'getAll' || action === 'getAllInternation' || action === 'filterHistory') {
      return handleReadActions(action, e, ss, sheet);
    }
    
    return jsonResponse({ "result": "error", "message": "Action not supported" });
  } catch (err) {
    return jsonResponse({ "result": "error", "message": err.toString() });
  }
}

function handleReadActions(action, e, ss, sheet) {
    if (action === 'search') {
      var recordToFind = e.parameter.medicalRecord;
      if (!recordToFind) return jsonResponse({ "result": "error", "message": "No ID" });
      var values = sheet.getDataRange().getDisplayValues();
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][4]).trim() === String(recordToFind).trim()) {
          return jsonResponse({
            "result": "found",
            "history": {
              "lastDate": values[i][1] || values[i][0].split(' ')[0],
              "lastTime": values[i][2] || "00:00",
              "name": values[i][3] || "", 
              "ageString": values[i][6] || "",
              "lastComplaint": values[i][7] || "",      
              "lastEsi": String(values[i][15] || "").replace("'", ""), 
              "triageTitle": values[i][16] || "",   
              "dob": values[i][20] || "", 
              "lastVitals": { 
                  pa: values[i][8] || "", fc: values[i][9] || "", fr: values[i][10] || "", 
                  temp: values[i][11] || "", spo2: values[i][12] || "", gcs: values[i][13] || "", pain: values[i][14] || "" 
              }
            }
          });
        }
      }
      return jsonResponse({ "result": "not_found" });
    }

    if (action === 'searchInternation') {
      var recordToFind = e.parameter.medicalRecord;
      if (!recordToFind) return jsonResponse({ "result": "error", "message": "No ID" });
      var sheetInt = ss.getSheetByName("Pacientes internados");
      if (sheetInt) {
        var values = sheetInt.getDataRange().getDisplayValues();
        for (var i = values.length - 1; i >= 1; i--) {
          if (String(values[i][4]).trim() === String(recordToFind).trim()) {
            return jsonResponse({
              "result": "found",
              "source": "internation",
              "history": {
                "lastDate": values[i][1] || values[i][0].split(' ')[0],
                "lastTime": values[i][2] || "00:00",
                "name": values[i][3] || "",
                "dob": values[i][5] || "",
                "sector": values[i][6] || "",
                "bed": values[i][7] || "",
                "lastVitals": {
                   pas: values[i][9] || "", pad: values[i][10] || "", fc: values[i][11] || "", fr: values[i][12] || "",
                   temp: values[i][13] || "", spo2: values[i][14] || "", consc: values[i][15] || "", o2: values[i][16] || "", pain: values[i][17] || ""
                },
                "newsScore": values[i][19] || "0", "riskText": values[i][20] || ""
              }
            });
          }
        }
      }
      var valuesTriage = sheet.getDataRange().getDisplayValues();
      for (var i = valuesTriage.length - 1; i >= 1; i--) {
         if (String(valuesTriage[i][4]).trim() === String(recordToFind).trim()) {
             return jsonResponse({ "result": "found", "source": "triage", "history": { "name": valuesTriage[i][3] || "", "dob": valuesTriage[i][20] || "", "lastVitals": null } });
         }
      }
      return jsonResponse({ "result": "not_found" });
    }

    if (action === 'filterHistory') {
       var searchId = e.parameter.medicalRecord ? String(e.parameter.medicalRecord).trim() : "";
       var searchDate = e.parameter.date ? String(e.parameter.date).trim() : "";
       
       var values = sheet.getDataRange().getDisplayValues();
       var resultRows = [];
       
       for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var rowId = String(row[4] || "").trim(); // Prontuário
          var rowDate = String(row[1] || "").trim(); // Data Avaliação
          var rowSystemDate = String(row[0] || "").split(' ')[0].trim(); // Data Sistema
          
          var matchId = true;
          if (searchId) {
             matchId = (rowId === searchId);
          }
          
          var matchDate = true;
          if (searchDate) {
             var dParts = rowDate.includes('/') ? rowDate.split('/') : rowDate.split('-');
             var isoDate = "";
             if (dParts.length === 3) {
                if (dParts[0].length === 4) isoDate = dParts.join('-'); // Já é ISO
                else isoDate = dParts[2] + '-' + dParts[1] + '-' + dParts[0]; // BR para ISO
             }
             
             if (!isoDate && rowSystemDate) {
                 var sParts = rowSystemDate.includes('/') ? rowSystemDate.split('/') : rowSystemDate.split('-');
                 if (sParts.length === 3) {
                    if (sParts[0].length === 4) isoDate = sParts.join('-');
                    else isoDate = sParts[2] + '-' + sParts[1] + '-' + sParts[0];
                 }
             }

             if (isoDate !== searchDate) matchDate = false;
          }
          
          if (matchId && matchDate) {
             resultRows.push({
                systemTimestamp: row[0],
                evaluationDate: row[1] || row[0].split(' ')[0], 
                evaluationTime: row[2], 
                name: row[3], 
                medicalRecord: row[4],
                isReevaluation: row[5], 
                age: row[6], 
                complaint: row[7], 
                esiLevel: row[15], 
                triageTitle: row[16],
                discriminators: row[19],
                vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14] }
             });
          }
       }
       return jsonResponse({ "result": "success", "data": resultRows.reverse() });
    }

    if (action === 'getAllInternation') {
      var sheetInt = ss.getSheetByName("Pacientes internados");
      if (!sheetInt) return jsonResponse({ "result": "success", "data": [] });
      var values = sheetInt.getDataRange().getDisplayValues();
      if (values.length <= 1) return jsonResponse({ "result": "success", "data": [] });
      var rows = values.slice(1).map(function(row) {
        return {
          systemTimestamp: row[0], evaluationDate: row[1], evaluationTime: row[2], name: row[3], medicalRecord: row[4], dob: row[5], sector: row[6], bed: row[7], isReevaluation: row[8],
          vitals: { pas: row[9], pad: row[10], fc: row[11], fr: row[12], temp: row[13], spo2: row[14], consciousness: row[15], o2Sup: row[16], painLevel: row[17] },
          observations: row[18], newsScore: row[19], riskText: row[20]
        };
      });
      return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 500) }); 
    }

    if (action === 'getAll') {
      var values = sheet.getDataRange().getDisplayValues();
      if (values.length <= 1) return jsonResponse({ "result": "success", "data": [] });
      var rows = values.slice(1).map(function(row) {
        return {
          systemTimestamp: row[0], evaluationDate: row[1] || row[0].split(' ')[0], evaluationTime: row[2], name: row[3], medicalRecord: row[4], isReevaluation: row[5], age: row[6], complaint: row[7], 
          esiLevel: row[15], triageTitle: row[16], discriminators: row[19],
          vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14] }
        };
      });
      return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 100) });
    }
    
    return jsonResponse({ "result": "success", "data": [] });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); 
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var rawData = e.postData.contents;
    var data;
    try { data = JSON.parse(rawData); } catch(e) { return jsonResponse({"result":"error", "message":"JSON Invalido: " + e.toString()}); }

    // --- SAVE INTERNATION ---
    if (data.action === 'saveInternation') {
       var sheetInternation = ss.getSheetByName("Pacientes internados");
       if (!sheetInternation) { setupStructure(); sheetInternation = ss.getSheetByName("Pacientes internados"); }
       
       var nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
       var rowData = [
          nowFormatted, getSafe(data, 'patient.evaluationDate', ''), getSafe(data, 'patient.evaluationTime', ''), getSafe(data, 'patient.name', ''), getSafe(data, 'patient.medicalRecord', ''),
          getSafe(data, 'patient.dob', ''), getSafe(data, 'patient.sector', ''), getSafe(data, 'patient.bed', ''), data.patient && data.patient.isReevaluation ? "SIM" : "NÃO",
          getSafe(data, 'vitals.pas', ''), getSafe(data, 'vitals.pad', ''), getSafe(data, 'vitals.fc', ''), getSafe(data, 'vitals.fr', ''), getSafe(data, 'vitals.temp', ''), getSafe(data, 'vitals.spo2', ''),
          getSafe(data, 'vitals.consciousness', ''), data.vitals && data.vitals.o2Sup ? "Sim" : "Não", getSafe(data, 'vitals.painLevel', ''), getSafe(data, 'observations', ''),
          getSafe(data, 'news.score', ''), getSafe(data, 'news.riskText', ''), getSafe(data, 'user', 'Sistema')
       ];
       sheetInternation.appendRow(rowData);
       SpreadsheetApp.flush(); 
       return jsonResponse({ "result": "success" });
    }

    // --- SAVE TRIAGE ---
    if (!data.action || data.action === 'save') {
      var sheet = ss.getSheets()[0]; 
      setupStructure();
      var nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
      var rowData = [
        nowFormatted, getSafe(data, 'patient.evaluationDate', ''), getSafe(data, 'patient.evaluationTime', ''), getSafe(data, 'patient.name', ''), getSafe(data, 'patient.medicalRecord', ''), 
        data.patient && data.patient.isReevaluation ? "SIM" : "NÃO", getSafe(data, 'patient.age', '0') + " " + getSafe(data, 'patient.ageUnit', ''), getSafe(data, 'patient.complaint', ''), 
        getSafe(data, 'vitals.pas', '') + "x" + getSafe(data, 'vitals.pad', ''), getSafe(data, 'vitals.fc', ''), getSafe(data, 'vitals.fr', ''), getSafe(data, 'vitals.temp', ''), 
        getSafe(data, 'vitals.spo2', ''), getSafe(data, 'vitals.gcs', ''), getSafe(data, 'vitals.painLevel', ''), "'" + getSafe(data, 'triage.level', ''), 
        getSafe(data, 'triage.title', ''), getSafe(data, 'triage.maxWaitTime', ''), getSafe(data, 'triage.justification', ''), getSafe(data, 'triage.discriminators', ''),
        getSafe(data, 'patient.dob', ''), getSafe(data, 'user', 'Sistema')
      ];
      sheet.appendRow(rowData);
      SpreadsheetApp.flush(); 
      return jsonResponse({ "result": "success" });
    }
    
    // --- USERS ---
    if (data.action === 'registerUser') {
      var sheetUsers = ss.getSheetByName("Usuários");
      if (!sheetUsers) { setupStructure(); sheetUsers = ss.getSheetByName("Usuários"); }
      var users = sheetUsers.getDataRange().getDisplayValues();
      var newEmail = String(data.email || "").toLowerCase().trim(); 
      for (var i = 1; i < users.length; i++) {
        if (String(users[i][2]).toLowerCase().trim() === newEmail) return jsonResponse({ "result": "error", "message": "E-mail já cadastrado." });
      }
      sheetUsers.appendRow([new Date(), data.name, newEmail, data.sector, data.password]);
      SpreadsheetApp.flush();
      try { sendEmailRobust(newEmail, "Acesso Liberado - " + APP_NAME, "Cadastro realizado.", ss); } catch(e) {}
      return jsonResponse({ "result": "success" });
    }
    
    if (data.action === 'login') {
       var sheetUsers = ss.getSheetByName("Usuários");
       if (!sheetUsers) { setupStructure(); sheetUsers = ss.getSheetByName("Usuários"); }
       var users = sheetUsers.getDataRange().getDisplayValues();
       var loginEmail = String(data.email || "").toLowerCase().trim();
       for (var i = 1; i < users.length; i++) {
          if (String(users[i][2]).toLowerCase().trim() === loginEmail) {
             if (String(users[i][4]).trim() === String(data.password).trim()) return jsonResponse({ "result": "success", "user": { "name": users[i][1], "email": users[i][2], "sector": users[i][3] } });
             return jsonResponse({ "result": "error", "message": "Senha incorreta." });
          }
       }
       return jsonResponse({ "result": "error", "message": "E-mail não encontrado." });
    }
    return jsonResponse({ "result": "error", "message": "Unknown Action" });
  } catch(e) {
    logError(ss, "Erro Geral: " + e.toString(), "");
    return jsonResponse({ "result": "error", "message": "Erro Crítico: " + e.toString() });
  } finally {
    lock.releaseLock();
  }
}

function logError(ss, msg, data) {
  try {
    var sheetError = ss.getSheetByName("ERROS_SISTEMA");
    if (!sheetError) sheetError = ss.insertSheet("ERROS_SISTEMA");
    sheetError.appendRow([new Date(), msg, data]);
  } catch(e) {}
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = async () => {
      setTestStatus('testing');
      setTestMessage('Testando conexão...');
      const trimmedUrl = urlInput.trim();

      if (!trimmedUrl.includes('script.google.com')) {
          setTestStatus('error');
          setTestMessage('URL inválida. Deve ser um script do Google.');
          return;
      }

      try {
          const timestamp = new Date().getTime();
          const response = await fetchWithRetry(`${trimmedUrl}?action=search&medicalRecord=TEST_PING_${timestamp}`, { method: 'GET' });
          
          if (response.result === 'not_found' || response.result === 'found') {
              setTestStatus('success');
              setTestMessage('CONEXÃO SUCESSO! A URL está correta e acessível.');
          } else {
              setTestStatus('error');
              setTestMessage(`Erro de resposta: ${response.message || 'Desconhecido'}`);
          }
      } catch (e: any) {
          setTestStatus('error');
          setTestMessage(`FALHA: ${e.message || 'Erro de Rede/CORS'}. Verifique se a implantação está como "QUALQUER PESSOA".`);
      }
  };

  const handleResetUrl = () => {
      const trimmedDefault = DEFAULT_HARDCODED_URL.trim();
      setUrlInput(trimmedDefault);
      onSaveUrl(trimmedDefault);
      localStorage.setItem('appScriptUrl', trimmedDefault);
      alert('URL restaurada para o padrão (v53). Conexão deve voltar a funcionar.');
      setIsOpen(false);
      window.location.reload(); 
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="fixed bottom-4 right-4 p-3 bg-teal-600 hover:bg-teal-700 rounded-full text-white shadow-lg z-10 transition-colors"
        title="Configurar Integração Planilha"
      >
        <Settings size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
             <div className="p-6 border-b flex justify-between items-center bg-teal-50">
               <div>
                 <h2 className="text-xl font-bold text-teal-900 flex items-center gap-2">
                   <Mail size={20}/> Configuração Backend (v45)
                 </h2>
                 <p className="text-xs text-teal-700 mt-1">
                   Atualização: Habilita busca por data e número de atendimento.
                 </p>
               </div>
               <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><Settings size={20}/></button>
             </div>
             
             <div className="p-6 overflow-y-auto space-y-6">
                
                {/* INSTRUÇÕES CRÍTICAS SOBRE PERMISSÃO */}
                <div className="bg-rose-50 border border-rose-200 p-4 rounded text-sm text-rose-900">
                  <strong className="flex items-center gap-2 mb-2 text-rose-700"><AlertTriangle size={18}/> MOTIVO DO ERRO "FAILED TO FETCH"</strong>
                  <p className="mb-2">Se você está vendo erros de rede, é 99% de certeza que a implantação está incorreta.</p>
                  <p className="font-bold">SIGA ESTES PASSOS EXATOS NO GOOGLE APPS SCRIPT:</p>
                  <ol className="list-decimal list-inside space-y-2 font-medium mt-2 bg-white p-3 rounded border border-rose-100">
                    <li>Copie o código abaixo.</li>
                    <li>No Editor, clique em <strong>Implantar (Deploy)</strong> &gt; <strong>Nova implantação</strong>.</li>
                    <li><span className="text-blue-600">Descrição:</span> Coloque "v54".</li>
                    <li><span className="text-blue-600">Executar como:</span> <strong>Eu (seu e-mail)</strong>.</li>
                    <li className="bg-yellow-200 px-1 py-0.5 rounded text-black font-black border border-yellow-400">
                        Quem pode acessar: QUALQUER PESSOA (ANYONE)
                    </li>
                    <li className="text-xs text-slate-500 ml-5">Não use "Conta Google" nem "Apenas Eu". Tem que ser "Qualquer Pessoa".</li>
                    <li>Clique em <strong>Implantar</strong> e copie a <strong>URL do App da Web</strong>.</li>
                  </ol>
                </div>

                <div className="bg-slate-900 text-slate-100 p-4 rounded text-xs font-mono overflow-auto h-48 relative border border-slate-700">
                   <button 
                    onClick={handleCopy} 
                    className="absolute top-3 right-3 flex items-center gap-1 bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-teal-400 transition-colors border border-slate-600"
                   >
                    {copied ? <Check size={14}/> : <Copy size={14}/>}
                    {copied ? 'Copiado!' : 'Copiar Código'}
                   </button>
                   <pre>{scriptCode}</pre>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-700">Nova URL da Implantação (Web App URL):</label>
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={urlInput} 
                        onChange={(e) => {
                            setUrlInput(e.target.value);
                            setTestStatus('idle'); // Reseta teste ao digitar
                            setTestMessage('');
                        }} 
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-teal-500 outline-none font-mono text-xs text-slate-600 bg-gray-50" 
                        placeholder="https://script.google.com/macros/s/..."
                      />
                      <button 
                        onClick={handleTestConnection}
                        disabled={testStatus === 'testing'}
                        className={`px-4 py-2 rounded font-bold text-xs flex items-center gap-2 border transition-colors whitespace-nowrap ${
                             testStatus === 'success' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 
                             testStatus === 'error' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                             'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                        }`}
                      >
                         {testStatus === 'testing' ? <div className="animate-spin w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full"></div> : 
                          testStatus === 'success' ? <Wifi size={16}/> : 
                          testStatus === 'error' ? <WifiOff size={16}/> : 
                          <ExternalLink size={16}/>}
                         {testStatus === 'testing' ? 'Testando...' : 'Testar Conexão'}
                      </button>
                  </div>
                  
                  {testMessage && (
                      <div className={`text-xs font-bold p-2 rounded ${testStatus === 'success' ? 'text-emerald-700 bg-emerald-50' : testStatus === 'error' ? 'text-rose-700 bg-rose-50' : 'text-slate-500'}`}>
                          {testMessage}
                      </div>
                  )}

                  <p className="text-[10px] text-slate-400">Verifique se não há espaços no final.</p>
                </div>
             </div>
             <div className="p-4 border-t flex justify-between gap-2 bg-gray-50 rounded-b-lg">
                <button 
                  onClick={handleResetUrl}
                  className="px-4 py-2 text-rose-600 border border-rose-200 hover:bg-rose-50 rounded font-bold text-xs flex items-center gap-2"
                  title="Usa a URL da Imagem v53"
                >
                    <RotateCcw size={14}/> Restaurar URL da Imagem (v53)
                </button>
                <div className="flex gap-2">
                    <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancelar</button>
                    <button 
                    onClick={() => { 
                        const trimmed = urlInput.trim();
                        onSaveUrl(trimmed); 
                        localStorage.setItem('appScriptUrl', trimmed); 
                        setIsOpen(false); 
                    }} 
                    className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 font-medium shadow-sm"
                    >
                    Salvar Configuração
                    </button>
                </div>
             </div>
          </div>
        </div>
      )}
    </>
  );
};