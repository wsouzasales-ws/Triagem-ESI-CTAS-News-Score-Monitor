
import React, { useState } from 'react';
import { Copy, Settings, Check, AlertTriangle, TableProperties, Database, Mail, Play } from 'lucide-react';

interface Props {
  currentUrl: string;
  onSaveUrl: (url: string) => void;
}

export const AppScriptGenerator: React.FC<Props> = ({ currentUrl, onSaveUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [copied, setCopied] = useState(false);

  // Script v32: Adicionado filterHistory para a aba Histórico
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
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight("bold").setBackground(color).setHorizontalAlignment("center");
    sheet.setFrozenRows(1);
  } else {
    // Verifica se o primeiro header bate, se não, atualiza linha 1
    var firstCell = sheet.getRange(1, 1).getValue();
    if (firstCell !== headers[0]) {
       sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
       sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground(color).setHorizontalAlignment("center");
    }
  }
}

// Helper: Enviar Email com Tentativas e Logs
function sendEmailRobust(to, subject, body, ss) {
  logError(ss, "INFO: Tentando enviar email", "Para: " + to);
  try {
    MailApp.sendEmail({
       to: to,
       subject: subject,
       body: body,
       name: APP_NAME,
       noReply: true
    });
    logError(ss, "SUCESSO: Email enviado (noReply)", "Para: " + to);
    return true;
  } catch (e) {
    logError(ss, "AVISO: Falha com noReply, tentando simples", e.toString());
    try {
      MailApp.sendEmail({
         to: to,
         subject: subject,
         body: body,
         name: APP_NAME
      });
      logError(ss, "SUCESSO: Email enviado (Simples)", "Para: " + to);
      return true;
    } catch (e2) {
      logError(ss, "ERRO FATAL EMAIL", e2.toString());
      throw e2;
    }
  }
}

function setupStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. ABA PACIENTES (Index 0)
  var sheetPatients = ss.getSheets()[0];
  if (sheetPatients.getName() !== "Pacientes") sheetPatients.setName("Pacientes");
  
  var headersPatients = [
      "Data/Hora Registro", "Data Avaliação", "Hora Avaliação", "Nome", "Atendimento", 
      "Reavaliação?", "Idade", "Queixa", "PA", "FC", "FR", "Temp", "SpO2", "GCS", "Dor", 
      "ESI Level", "Classificação", "Tempo Alvo", "Justificativa", "Discriminadores", "Data Nascimento"
  ];
  ensureHeader(sheetPatients, headersPatients, "#d9ead3"); // Verde Claro

  // 2. ABA USUÁRIOS
  var sheetUsers = ss.getSheetByName("Usuários");
  if (!sheetUsers) sheetUsers = ss.insertSheet("Usuários");
  
  var headersUsers = ["Data Cadastro", "Nome", "Email", "Setor", "Senha"];
  ensureHeader(sheetUsers, headersUsers, "#cfe2f3"); // Azul Claro

  // 3. ABA ERROS_SISTEMA
  var sheetErrors = ss.getSheetByName("ERROS_SISTEMA");
  if (!sheetErrors) sheetErrors = ss.insertSheet("ERROS_SISTEMA");
  
  var headersErrors = ["Data", "Mensagem", "Detalhes"];
  ensureHeader(sheetErrors, headersErrors, "#f4cccc"); // Vermelho Claro
  
  return "Estrutura Organizada (v32): Abas configuradas com sucesso.";
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet(); 
    
    // Auto-setup se chamado sem ação ou apenas ping
    if (!action) {
       setupStructure();
       return jsonResponse({ "result": "success", "message": "Script v32 Online" });
    }

    var sheet = ss.getSheets()[0]; // Pacientes

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
                  pa: values[i][8] || "", 
                  fc: values[i][9] || "", 
                  fr: values[i][10] || "", 
                  temp: values[i][11] || "", 
                  spo2: values[i][12] || "", 
                  gcs: values[i][13] || "", 
                  pain: values[i][14] || "" 
              }
            }
          });
        }
      }
      return jsonResponse({ "result": "not_found" });
    }

    if (action === 'filterHistory') {
       var searchId = e.parameter.medicalRecord ? String(e.parameter.medicalRecord).trim() : "";
       var searchDate = e.parameter.date ? String(e.parameter.date).trim() : "";
       
       var values = sheet.getDataRange().getDisplayValues();
       var resultRows = [];
       
       // Formato Data Esperado na Planilha: DD/MM/YYYY ou YYYY-MM-DD
       // Se o usuario mandou searchDate (YYYY-MM-DD), tentamos comparar
       
       for (var i = 1; i < values.length; i++) {
          var row = values[i];
          var rowId = String(row[4] || "").trim();
          var rowDate = String(row[1] || "").trim(); // Data Avaliação
          var rowSystemDate = String(row[0] || "").split(' ')[0].trim(); // Data Sistema
          
          var matchId = true;
          if (searchId) {
             matchId = (rowId === searchId);
          }
          
          var matchDate = true;
          if (searchDate) {
             // Tenta converter para comparavel YYYY-MM-DD
             // Formatos possíveis na planilha: 25/02/2025 ou 2025-02-25
             var dParts = rowDate.includes('/') ? rowDate.split('/') : rowDate.split('-');
             var isoDate = "";
             if (dParts.length === 3) {
                if (dParts[0].length === 4) isoDate = dParts.join('-'); // Já é ISO
                else isoDate = dParts[2] + '-' + dParts[1] + '-' + dParts[0]; // BR para ISO
             }
             
             // Também verifica System Timestamp se data avaliação estiver vazia
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
       
       // Retorna ordenado por data mais recente
       return jsonResponse({ "result": "success", "data": resultRows.reverse() });
    }

    if (action === 'getAll') {
      var values = sheet.getDataRange().getDisplayValues();
      if (values.length <= 1) return jsonResponse({ "result": "success", "data": [] });

      var rows = values.slice(1).map(function(row) {
        return {
          systemTimestamp: row[0], // Coluna A: Data/Hora real do registro
          evaluationDate: row[1] || row[0].split(' ')[0], 
          evaluationTime: row[2], 
          name: row[3], 
          medicalRecord: row[4],
          isReevaluation: row[5], 
          age: row[6], 
          complaint: row[7], 
          esiLevel: row[15], 
          triageTitle: row[16],
          discriminators: row[19], // Coluna T: Discriminadores para Indicadores
          vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14] }
        };
      });
      return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 100) });
    }
    
    return jsonResponse({ "result": "error", "message": "Action not supported" });
    
  } catch (err) {
    return jsonResponse({ "result": "error", "message": err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); 

  var ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    var rawData = e.postData.contents;
    var data;
    try { data = JSON.parse(rawData); } catch(e) { return jsonResponse({"result":"error", "message":"JSON Invalido: " + e.toString()}); }

    if (!data.action || data.action === 'save') {
      var sheet = ss.getSheets()[0]; 
      
      // Auto-Correction Headers Main Sheet
      if (sheet.getLastRow() === 0 || sheet.getRange(1,1).getValue() !== "Data/Hora Registro") {
          setupStructure(); // Chama a função de organização se detectar algo errado
          sheet = ss.getSheets()[0]; // Recarrega ref
      }

      var nowFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");

      var rowData = [
        nowFormatted, 
        getSafe(data, 'patient.evaluationDate', ''), 
        getSafe(data, 'patient.evaluationTime', ''), 
        getSafe(data, 'patient.name', ''),
        getSafe(data, 'patient.medicalRecord', ''), 
        data.patient && data.patient.isReevaluation ? "SIM" : "NÃO", 
        getSafe(data, 'patient.age', '0') + " " + getSafe(data, 'patient.ageUnit', ''),
        getSafe(data, 'patient.complaint', ''), 
        getSafe(data, 'vitals.pas', '') + "x" + getSafe(data, 'vitals.pad', ''), 
        getSafe(data, 'vitals.fc', ''), 
        getSafe(data, 'vitals.fr', ''),
        getSafe(data, 'vitals.temp', ''), 
        getSafe(data, 'vitals.spo2', ''), 
        getSafe(data, 'vitals.gcs', ''), 
        getSafe(data, 'vitals.painLevel', ''), 
        "'" + getSafe(data, 'triage.level', ''), 
        getSafe(data, 'triage.title', ''), 
        getSafe(data, 'triage.maxWaitTime', ''), 
        getSafe(data, 'triage.justification', ''), 
        getSafe(data, 'triage.discriminators', ''),
        getSafe(data, 'patient.dob', '') 
      ];

      sheet.appendRow(rowData);
      return jsonResponse({ "result": "success" });
    }

    // --- REGISTER USER V30 ---
    if (data.action === 'registerUser') {
      var sheetUsers = ss.getSheetByName("Usuários");
      if (!sheetUsers) { setupStructure(); sheetUsers = ss.getSheetByName("Usuários"); }
      
      var users = sheetUsers.getDataRange().getDisplayValues();
      var newEmail = String(data.email || "").toLowerCase().trim(); 
      var newPass = String(data.password || "").trim();
      
      if (!newEmail || !newPass) {
         return jsonResponse({ "result": "error", "message": "Email ou senha inválidos." });
      }

      for (var i = 1; i < users.length; i++) {
        var row = users[i];
        if (!row || row.length < 3) continue; 
        
        var existingEmail = String(row[2] || "").toLowerCase().trim();
        if (existingEmail === newEmail) {
           return jsonResponse({ "result": "error", "message": "E-mail já cadastrado." });
        }
      }

      sheetUsers.appendRow([new Date(), data.name, newEmail, data.sector, newPass]);

      try {
         sendEmailRobust(
           newEmail,
           "Acesso Liberado - " + APP_NAME,
           "Olá " + data.name + ",\\n\\nSeu cadastro foi realizado com sucesso.\\n\\n--- Credenciais ---\\nLogin: " + newEmail + "\\nSenha: " + newPass + "\\n\\nAtenciosamente,\\n" + APP_NAME,
           ss
         );
      } catch (e) {
         return jsonResponse({ "result": "success", "warning": "Usuário criado, mas erro no envio de email. Verifique a aba ERROS_SISTEMA." });
      }

      return jsonResponse({ "result": "success" });
    }

    // --- LOGIN V30 ---
    if (data.action === 'login') {
       var sheetUsers = ss.getSheetByName("Usuários");
       if (!sheetUsers) { setupStructure(); sheetUsers = ss.getSheetByName("Usuários"); }
       
       var users = sheetUsers.getDataRange().getDisplayValues();
       
       var loginEmail = String(data.email || "").toLowerCase().trim();
       var loginPassClean = String(data.password || "").replace(/\s/g, ""); 

       for (var i = 1; i < users.length; i++) {
          var row = users[i];
          if (!row || row.length < 5) continue; 

          var rowEmail = String(row[2] || "").toLowerCase().trim();
          var rowPassClean = String(row[4] || "").replace(/\s/g, ""); 
          
          if (rowEmail === loginEmail) {
             if (rowPassClean === loginPassClean) {
                return jsonResponse({ "result": "success", "user": { "name": row[1], "email": row[2], "sector": row[3] } });
             } else {
                 logError(ss, "FALHA LOGIN: Senha incorreta", "Email: " + loginEmail);
                 return jsonResponse({ "result": "error", "message": "Senha incorreta.", "debug": "Encontrado email, mas senha não bate." });
             }
          }
       }
       
       logError(ss, "FALHA LOGIN: Email inexistente", "Tentativa: " + loginEmail);
       return jsonResponse({ "result": "error", "message": "E-mail não encontrado." });
    }

    // --- RECOVER PASSWORD V30 ---
    if (data.action === 'recoverPassword') {
       var sheetUsers = ss.getSheetByName("Usuários");
       if (!sheetUsers) return jsonResponse({ "result": "error", "message": "Base de dados indisponível." });
       
       var users = sheetUsers.getDataRange().getDisplayValues();
       var targetEmail = String(data.email || "").toLowerCase().trim();
       
       var masterEmail = "wanderson.sales@redemedical.com.br";
       var masterPass = "Ellen1221";

       for (var i = 1; i < users.length; i++) {
          var row = users[i];
          if (!row || row.length < 5) continue;

          var rowEmail = String(row[2] || "").toLowerCase().trim();
          if (rowEmail === targetEmail) {
             var userName = row[1];
             var userPass = row[4]; 
             
             try {
               sendEmailRobust(
                 targetEmail,
                 "Recuperação de Senha - " + APP_NAME,
                 "Olá " + userName + ",\\n\\nRecebemos uma solicitação de recuperação de acesso.\\n\\nSua senha atual é: " + userPass + "\\n\\nSe você não solicitou isso, informe a gerência.\\n\\nAtenciosamente,\\n" + APP_NAME,
                 ss
               );
               return jsonResponse({ "result": "success" });
             } catch (mailErr) {
               return jsonResponse({ "result": "error", "message": "Erro ao enviar e-mail. Verifique Logs." });
             }
          }
       }
       
       if (targetEmail === masterEmail) {
           sheetUsers.appendRow([new Date(), "Wanderson Admin", masterEmail, "TI/Master", masterPass]);
           try {
             sendEmailRobust(
                 masterEmail,
                 "Recuperação de Senha (Auto-Restore)",
                 "Olá Wanderson,\\n\\nConta admin restaurada.\\nSenha: " + masterPass,
                 ss
             );
             return jsonResponse({ "result": "success", "message": "Conta admin restaurada e enviada." });
           } catch(e) {
             return jsonResponse({ "result": "error", "message": "Conta restaurada, mas erro no envio de email." });
           }
       }

       return jsonResponse({ "result": "error", "message": "E-mail não encontrado na base." });
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
    if (!sheetError) {
       // Cria se não existir e já formata
       sheetError = ss.insertSheet("ERROS_SISTEMA");
       var headers = ["Data", "Mensagem", "Detalhes"];
       sheetError.appendRow(headers);
       sheetError.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#f4cccc");
       sheetError.setFrozenRows(1);
    }
    sheetError.appendRow([new Date(), msg, data]);
  } catch(e) {
    // Fail silently in logger
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
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
             <div className="p-6 border-b flex justify-between items-center bg-teal-50">
               <div>
                 <h2 className="text-xl font-bold text-teal-900 flex items-center gap-2">
                   <Mail size={20}/> Configuração Backend (v32 - Filtro Histórico)
                 </h2>
                 <p className="text-xs text-teal-700 mt-1">
                   Atualização: Habilita busca por data e número de atendimento.
                 </p>
               </div>
               <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><Settings size={20}/></button>
             </div>
             
             <div className="p-6 overflow-y-auto space-y-6">
                
                <div className="bg-amber-50 border border-amber-200 p-4 rounded text-sm text-amber-900">
                  <strong className="flex items-center gap-2 mb-2"><AlertTriangle size={16}/> ATENÇÃO: ATUALIZAÇÃO REQUERIDA</strong>
                  <ol className="list-decimal list-inside space-y-2 font-medium mt-2">
                    <li>Copie o código v32 abaixo.</li>
                    <li>No Google Apps Script, substitua TUDO e clique em <span className="bg-blue-100 px-2 py-0.5 rounded text-blue-800 font-bold">Implantar &gt; Nova implantação</span>.</li>
                    <li>Sem isso, a aba "Histórico" não encontrará os registros.</li>
                    <li className="text-emerald-700 font-bold">Cole a NOVA URL abaixo e salve.</li>
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

                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">Nova URL da Implantação:</label>
                  <input 
                    type="text" 
                    value={urlInput} 
                    onChange={(e) => setUrlInput(e.target.value)} 
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-teal-500 outline-none font-mono text-xs text-slate-600 bg-gray-50" 
                    placeholder="https://script.google.com/macros/s/..."
                  />
                </div>
             </div>
             <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-lg">
                <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium">Cancelar</button>
                <button 
                  onClick={() => { onSaveUrl(urlInput); localStorage.setItem('appScriptUrl', urlInput); setIsOpen(false); }} 
                  className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 font-medium shadow-sm"
                >
                  Salvar Nova Configuração
                </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};
