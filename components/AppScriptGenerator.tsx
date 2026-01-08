import React, { useState } from 'react';
import { Copy, Settings, Check, AlertTriangle, Mail, RotateCcw, Wifi, WifiOff, ExternalLink, Database } from 'lucide-react';
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
  
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Script v58: Increased Limit to 3000 records for Reporting
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

function ensureHeader(sheet, headers, color) {
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) {
    sheet.appendRow(headers);
    formatHeaderRow(sheet, headers.length, color);
  } else {
    var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (currentHeaders.length < headers.length) {
       var startCol = currentHeaders.length + 1;
       var numColsToAdd = headers.length - currentHeaders.length;
       var headersToAdd = headers.slice(currentHeaders.length);
       sheet.getRange(1, startCol, 1, numColsToAdd).setValues([headersToAdd]);
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
  try {
    MailApp.sendEmail({to: to, subject: subject, body: body, name: APP_NAME, noReply: true});
    return true;
  } catch (e) {
    return false;
  }
}

function setupStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var sheetPatients = ss.getSheets()[0];
  if (sheetPatients.getName() !== "Pacientes") sheetPatients.setName("Pacientes");
  var headersPatients = [
      "Data/Hora Registro", "Data Avaliação", "Hora Avaliação", "Nome", "Prontuário", 
      "Reavaliação?", "Idade", "Queixa", "PA", "FC", "FR", "Temp", "SpO2", "GCS", "Dor", 
      "ESI Level", "Classificação", "Tempo Alvo", "Justificativa", "Discriminadores", "Data Nascimento", "Usuário Resp.", "Status"
  ];
  ensureHeader(sheetPatients, headersPatients, "#d9ead3");

  var sheetUsers = ss.getSheetByName("Usuários");
  if (!sheetUsers) sheetUsers = ss.insertSheet("Usuários");
  var headersUsers = ["Data Cadastro", "Nome", "Email", "Setor", "Senha"];
  ensureHeader(sheetUsers, headersUsers, "#cfe2f3");
  
  var sheetInternation = ss.getSheetByName("Pacientes internados");
  if (!sheetInternation) sheetInternation = ss.insertSheet("Pacientes internados");
  var headersInternation = [
      "Data/Hora Registro", "Data Avaliação", "Hora Avaliação", "Nome", "Prontuário", 
      "Data Nascimento", "Setor", "Leito", "Reavaliação?",
      "PAS", "PAD", "FC", "FR", "Temp", "SpO2", "Consciencia", "O2 Suplementar", "Dor",
      "Obs", "NEWS Score", "Risco NEWS", "Usuário Resp.", "Status"
  ];
  ensureHeader(sheetInternation, headersInternation, "#9fc5e8");

  return "Estrutura v58 OK.";
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet(); 
    
    if (!action) {
       setupStructure();
       return jsonResponse({ "result": "success", "message": "Script v58 Online" });
    }

    if (action === 'filterHistory') {
       var searchId = e.parameter.medicalRecord ? String(e.parameter.medicalRecord).trim() : "";
       var searchDate = e.parameter.date ? String(e.parameter.date).trim() : "";
       var resultRows = [];
       
       var sheetTriage = ss.getSheets()[0];
       var valsT = sheetTriage.getDataRange().getDisplayValues();
       for (var i = 1; i < valsT.length; i++) {
          var row = valsT[i];
          if (matchFilter(row[4], row[1], row[0], searchId, searchDate)) {
             resultRows.push({
                source: 'triage',
                systemTimestamp: row[0], evaluationDate: row[1] || row[0].split(' ')[0], evaluationTime: row[2], 
                name: row[3], medicalRecord: row[4], age: row[6], complaint: row[7], 
                esiLevel: row[15], triageTitle: row[16], discriminators: row[19],
                status: row[22] || '',
                vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14] }
             });
          }
       }

       var sheetInt = ss.getSheetByName("Pacientes internados");
       if (sheetInt) {
          var valsI = sheetInt.getDataRange().getDisplayValues();
          for (var j = 1; j < valsI.length; j++) {
             var rowI = valsI[j];
             if (matchFilter(rowI[4], rowI[1], rowI[0], searchId, searchDate)) {
                resultRows.push({
                   source: 'internation',
                   systemTimestamp: rowI[0], evaluationDate: rowI[1], evaluationTime: rowI[2], 
                   name: rowI[3], medicalRecord: rowI[4], sector: rowI[6], bed: rowI[7], isReevaluation: rowI[8],
                   newsScore: rowI[19], riskText: rowI[20], observations: rowI[18],
                   status: rowI[22] || '',
                   vitals: { pas: rowI[9], pad: rowI[10], fc: rowI[11], fr: rowI[12], temp: rowI[13], spo2: rowI[14], consc: rowI[15], o2: rowI[16], pain: rowI[17] }
                });
             }
          }
       }
       return jsonResponse({ "result": "success", "data": resultRows.reverse() });
    }

    if (action === 'getAll') {
       var sheet = ss.getSheets()[0];
       var values = sheet.getDataRange().getDisplayValues();
       if (values.length <= 1) return jsonResponse({ "result": "success", "data": [] });
       var rows = values.slice(1).map(function(row) {
         return {
           systemTimestamp: row[0], evaluationDate: row[1] || row[0].split(' ')[0], evaluationTime: row[2], name: row[3], medicalRecord: row[4], isReevaluation: row[5], age: row[6], complaint: row[7], 
           esiLevel: row[15], triageTitle: row[16], discriminators: row[19], status: row[22] || '',
           vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14] }
         };
       });
       // AUMENTADO DE 100 PARA 3000
       return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 3000) });
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
          observations: row[18], newsScore: row[19], riskText: row[20], status: row[22] || ''
        };
      });
      // AUMENTADO DE 100 PARA 3000
      return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 3000) }); 
    }

    if (action === 'search') {
      var recordToFind = e.parameter.medicalRecord;
      var sheet = ss.getSheets()[0];
      var values = sheet.getDataRange().getDisplayValues();
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][4]).trim() === String(recordToFind).trim()) {
          return jsonResponse({ "result": "found", "history": { "name": values[i][3], "lastDate": values[i][1], "lastTime": values[i][2], "ageString": values[i][6], "dob": values[i][20], "lastEsi": values[i][15], "lastVitals": { pa: values[i][8], fc: values[i][9], fr: values[i][10], temp: values[i][11], spo2: values[i][12], gcs: values[i][13], pain: values[i][14] } } });
        }
      }
      return jsonResponse({ "result": "not_found" });
    }
    
    if (action === 'searchInternation') {
      var recordToFind = e.parameter.medicalRecord;
      var sheetInt = ss.getSheetByName("Pacientes internados");
      if (sheetInt) {
         var vals = sheetInt.getDataRange().getDisplayValues();
         for (var i = vals.length - 1; i >= 1; i--) {
            if (String(vals[i][4]).trim() === String(recordToFind).trim()) {
               return jsonResponse({ "result": "found", "source": "internation", "history": { "name": vals[i][3], "dob": vals[i][5], "sector": vals[i][6], "bed": vals[i][7], "lastDate": vals[i][1], "lastTime": vals[i][2], "newsScore": vals[i][19], 
               "lastVitals": { pas: vals[i][9], pad: vals[i][10], fc: vals[i][11], fr: vals[i][12], temp: vals[i][13], spo2: vals[i][14], consc: vals[i][15], o2: vals[i][16], pain: vals[i][17] }
               } });
            }
         }
      }
      return doGet({ parameter: { action: 'search', medicalRecord: recordToFind } });
    }

    return jsonResponse({ "result": "error", "message": "Action not mapped: " + action });
  } catch (err) {
    return jsonResponse({ "result": "error", "message": err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function matchFilter(rowId, rowDate, rowSystemDate, searchId, searchDate) {
    var matchId = !searchId || String(rowId).trim() === searchId;
    var matchDate = true;
    if (searchDate) {
        var dParts = String(rowDate).includes('/') ? rowDate.split('/') : rowDate.split('-');
        var isoDate = (dParts.length === 3) ? (dParts[0].length === 4 ? dParts.join('-') : dParts[2] + '-' + dParts[1] + '-' + dParts[0]) : "";
        
        if ((!isoDate || isoDate.length < 10) && rowSystemDate) {
            var sParts = String(rowSystemDate).split(' ')[0].split(rowSystemDate.includes('/') ? '/' : '-');
            isoDate = (sParts.length === 3) ? (sParts[0].length === 4 ? sParts.join('-') : sParts[2] + '-' + sParts[1] + '-' + sParts[0]) : "";
        }
        matchDate = (isoDate === searchDate);
    }
    return matchId && matchDate;
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); 
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  try {
    var data = JSON.parse(e.postData.contents);
    var nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

    if (data.action === 'invalidateBatch') {
        var items = data.items; 
        if (!items || items.length === 0) return jsonResponse({ "result": "success", "count": 0 });

        var sheetTriage = ss.getSheets()[0];
        var sheetInt = ss.getSheetByName("Pacientes internados");
        var triageData = sheetTriage.getDataRange().getDisplayValues();
        var intData = sheetInt ? sheetInt.getDataRange().getDisplayValues() : [];
        var count = 0;

        for (var k = 0; k < items.length; k++) {
           var item = items[k];
           var targetSheet = (item.source === 'internation') ? sheetInt : sheetTriage;
           var targetData = (item.source === 'internation') ? intData : triageData;
           if (!targetSheet) continue;

           for (var i = 1; i < targetData.length; i++) {
               var rowTs = String(targetData[i][0]).trim(); 
               var rowMr = String(targetData[i][4]).trim(); 
               
               if (rowTs === String(item.systemTimestamp).trim() && rowMr === String(item.medicalRecord).trim()) {
                   targetSheet.getRange(i + 1, 23).setValue("INVALIDADO");
                   count++;
                   break; 
               }
           }
        }
        SpreadsheetApp.flush();
        return jsonResponse({ "result": "success", "count": count });
    }

    if (data.action === 'saveInternation') {
       var sheetInt = ss.getSheetByName("Pacientes internados");
       sheetInt.appendRow([
          nowFormatted, getSafe(data, 'patient.evaluationDate', ''), getSafe(data, 'patient.evaluationTime', ''), getSafe(data, 'patient.name', ''), getSafe(data, 'patient.medicalRecord', ''),
          getSafe(data, 'patient.dob', ''), getSafe(data, 'patient.sector', ''), getSafe(data, 'patient.bed', ''), data.patient && data.patient.isReevaluation ? "SIM" : "NÃO",
          getSafe(data, 'vitals.pas', ''), getSafe(data, 'vitals.pad', ''), getSafe(data, 'vitals.fc', ''), getSafe(data, 'vitals.fr', ''), getSafe(data, 'vitals.temp', ''), getSafe(data, 'vitals.spo2', ''),
          getSafe(data, 'vitals.consciousness', ''), data.vitals && data.vitals.o2Sup ? "Sim" : "Não", getSafe(data, 'vitals.painLevel', ''), getSafe(data, 'observations', ''),
          getSafe(data, 'news.score', ''), getSafe(data, 'news.riskText', ''), getSafe(data, 'user', 'Sistema'), "ATIVO"
       ]);
       SpreadsheetApp.flush();
       return jsonResponse({ "result": "success" });
    }

    if (!data.action || data.action === 'save') {
      var sheet = ss.getSheets()[0]; 
      sheet.appendRow([
        nowFormatted, getSafe(data, 'patient.evaluationDate', ''), getSafe(data, 'patient.evaluationTime', ''), getSafe(data, 'patient.name', ''), getSafe(data, 'patient.medicalRecord', ''), 
        data.patient && data.patient.isReevaluation ? "SIM" : "NÃO", getSafe(data, 'patient.age', '0') + " " + getSafe(data, 'patient.ageUnit', ''), getSafe(data, 'patient.complaint', ''), 
        getSafe(data, 'vitals.pas', '') + "x" + getSafe(data, 'vitals.pad', ''), getSafe(data, 'vitals.fc', ''), getSafe(data, 'vitals.fr', ''), getSafe(data, 'vitals.temp', ''), 
        getSafe(data, 'vitals.spo2', ''), getSafe(data, 'vitals.gcs', ''), getSafe(data, 'vitals.painLevel', ''), "'" + getSafe(data, 'triage.level', ''), 
        getSafe(data, 'triage.title', ''), getSafe(data, 'triage.maxWaitTime', ''), getSafe(data, 'triage.justification', ''), getSafe(data, 'triage.discriminators', ''),
        getSafe(data, 'patient.dob', ''), getSafe(data, 'user', 'Sistema'), "ATIVO"
      ]);
      SpreadsheetApp.flush();
      return jsonResponse({ "result": "success" });
    }
    
    if (data.action === 'login') {
       var sheetUsers = ss.getSheetByName("Usuários");
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

    if (data.action === 'registerUser') {
        var sheetUsers = ss.getSheetByName("Usuários");
        sheetUsers.appendRow([new Date(), data.name, data.email.toLowerCase(), data.sector, data.password]);
        try { sendEmailRobust(data.email, "Acesso Liberado - " + APP_NAME, "Cadastro realizado.", ss); } catch(e) {}
        return jsonResponse({ "result": "success" });
    }
    
    return jsonResponse({ "result": "error", "message": "Ação POST não mapeada: " + data.action });
  } catch(e) {
    return jsonResponse({ "result": "error", "message": e.toString() });
  } finally {
    lock.releaseLock();
  }
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
      alert('URL restaurada. Conexão deve voltar a funcionar.');
      setIsOpen(false);
      window.location.reload(); 
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)} 
        className="fixed bottom-4 right-4 p-3 bg-teal-600 hover:bg-teal-700 rounded-full text-white shadow-lg z-10 transition-colors"
      >
        <Settings size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
             <div className="p-6 border-b flex justify-between items-center bg-teal-50">
               <h2 className="text-xl font-bold text-teal-900 flex items-center gap-2">
                 <Database size={20}/> Backend v58 (Limite 3000 Rows)
               </h2>
               <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><Settings size={20}/></button>
             </div>
             
             <div className="p-6 overflow-y-auto space-y-6">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded text-sm text-emerald-900">
                  <strong>ATUALIZAÇÃO CRÍTICA v58:</strong> Aumenta o limite de busca para 3000 registros para corrigir o problema de dados incompletos nos relatórios mensais.
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
                  <label className="text-sm font-bold text-gray-700">URL da Implantação (Web App URL):</label>
                  <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={urlInput} 
                        onChange={(e) => {
                            setUrlInput(e.target.value);
                            setTestStatus('idle');
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
                         {testStatus === 'testing' ? 'Testando...' : 'Testar'}
                      </button>
                  </div>
                  
                  {testMessage && (
                      <div className={`text-xs font-bold p-2 rounded ${testStatus === 'success' ? 'text-emerald-700 bg-emerald-50' : testStatus === 'error' ? 'text-rose-700 bg-rose-50' : 'text-slate-500'}`}>
                          {testMessage}
                      </div>
                  )}
                </div>
             </div>
             <div className="p-4 border-t flex justify-between gap-2 bg-gray-50 rounded-b-lg">
                <button 
                  onClick={handleResetUrl}
                  className="px-4 py-2 text-rose-600 border border-rose-200 hover:bg-rose-50 rounded font-bold text-xs flex items-center gap-2"
                >
                    <RotateCcw size={14}/> Restaurar Padrão
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