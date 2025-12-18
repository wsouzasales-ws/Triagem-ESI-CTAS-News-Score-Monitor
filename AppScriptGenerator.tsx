import React, { useState } from 'react';
import { Copy, Settings, Check, AlertTriangle, Database, Mail } from 'lucide-react';

interface Props {
  currentUrl: string;
  onSaveUrl: (url: string) => void;
}

export const AppScriptGenerator: React.FC<Props> = ({ currentUrl, onSaveUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [copied, setCopied] = useState(false);

  // Script v48: Mapeamento COMPLETO de vitais no filterHistory
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

function setupStructure() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPatients = ss.getSheets()[0];
  if (sheetPatients.getName() !== "Pacientes") sheetPatients.setName("Pacientes");
  
  var sheetInternation = ss.getSheetByName("Pacientes internados");
  if (!sheetInternation) sheetInternation = ss.insertSheet("Pacientes internados");
  
  var sheetUsers = ss.getSheetByName("Usuários");
  if (!sheetUsers) sheetUsers = ss.insertSheet("Usuários");

  return "Estrutura v48 OK.";
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet(); 
    
    if (!action) {
       setupStructure();
       return jsonResponse({ "result": "success", "message": "Script v48 Online" });
    }

    if (action === 'filterHistory') {
       var searchId = e.parameter.medicalRecord ? String(e.parameter.medicalRecord).trim() : "";
       var searchDate = e.parameter.date ? String(e.parameter.date).trim() : "";
       var resultRows = [];
       
       // Triagem
       var sheetTriage = ss.getSheets()[0];
       var valsT = sheetTriage.getDataRange().getDisplayValues();
       for (var i = 1; i < valsT.length; i++) {
          var row = valsT[i];
          if (matchFilter(row[4], row[1], row[0], searchId, searchDate)) {
             resultRows.push({
                source: 'triage',
                systemTimestamp: row[0], evaluationDate: row[1] || row[0].split(' ')[0], evaluationTime: row[2], 
                name: row[3], medicalRecord: row[4], age: row[6], complaint: row[7], 
                esiLevel: row[15], triageTitle: row[16],
                vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14] }
             });
          }
       }

       // Internação
       var sheetInt = ss.getSheetByName("Pacientes internados");
       if (sheetInt) {
          var valsI = sheetInt.getDataRange().getDisplayValues();
          for (var j = 1; j < valsI.length; j++) {
             var rowI = valsI[j];
             if (matchFilter(rowI[4], rowI[1], rowI[0], searchId, searchDate)) {
                resultRows.push({
                   source: 'internation',
                   systemTimestamp: rowI[0], evaluationDate: rowI[1], evaluationTime: rowI[2], 
                   name: rowI[3], medicalRecord: rowI[4], sector: rowI[6], bed: rowI[7],
                   newsScore: rowI[19], riskText: rowI[20], observations: rowI[18],
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
           systemTimestamp: row[0], evaluationDate: row[1] || row[0].split(' ')[0], evaluationTime: row[2], name: row[3], medicalRecord: row[4], age: row[6], complaint: row[7], 
           esiLevel: row[15], triageTitle: row[16],
           vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14] }
         };
       });
       return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 100) });
    }

    if (action === 'getAllInternation') {
      var sheetInt = ss.getSheetByName("Pacientes internados");
      if (!sheetInt) return jsonResponse({ "result": "success", "data": [] });
      var values = sheetInt.getDataRange().getDisplayValues();
      if (values.length <= 1) return jsonResponse({ "result": "success", "data": [] });
      var rows = values.slice(1).map(function(row) {
        return {
          systemTimestamp: row[0], evaluationDate: row[1], evaluationTime: row[2], name: row[3], medicalRecord: row[4], dob: row[5], sector: row[6], bed: row[7],
          vitals: { pas: row[9], pad: row[10], fc: row[11], fr: row[12], temp: row[13], spo2: row[14], consciousness: row[15], o2Sup: row[16], painLevel: row[17] },
          observations: row[18], newsScore: row[19], riskText: row[20]
        };
      });
      return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 100) }); 
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

    return jsonResponse({ "result": "error", "message": "Ação não mapeada em doGet: " + action });
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
        if (!isoDate && rowSystemDate) {
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

    if (data.action === 'saveInternation') {
       var sheetInt = ss.getSheetByName("Pacientes internados");
       sheetInt.appendRow([
          nowFormatted, getSafe(data, 'patient.evaluationDate', ''), getSafe(data, 'patient.evaluationTime', ''), getSafe(data, 'patient.name', ''), getSafe(data, 'patient.medicalRecord', ''),
          getSafe(data, 'patient.dob', ''), getSafe(data, 'patient.sector', ''), getSafe(data, 'patient.bed', ''), data.patient && data.patient.isReevaluation ? "SIM" : "NÃO",
          getSafe(data, 'vitals.pas', ''), getSafe(data, 'vitals.pad', ''), getSafe(data, 'vitals.fc', ''), getSafe(data, 'vitals.fr', ''), getSafe(data, 'vitals.temp', ''), getSafe(data, 'vitals.spo2', ''),
          getSafe(data, 'vitals.consciousness', ''), data.vitals && data.vitals.o2Sup ? "Sim" : "Não", getSafe(data, 'vitals.painLevel', ''), getSafe(data, 'observations', ''),
          getSafe(data, 'news.score', ''), getSafe(data, 'news.riskText', ''), getSafe(data, 'user', 'Sistema')
       ]);
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
        getSafe(data, 'patient.dob', ''), getSafe(data, 'user', 'Sistema')
      ]);
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

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="fixed bottom-4 right-4 p-3 bg-teal-600 hover:bg-teal-700 rounded-full text-white shadow-lg z-10 transition-colors">
        <Settings size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
             <div className="p-6 border-b flex justify-between items-center bg-teal-50">
               <h2 className="text-xl font-bold text-teal-900 flex items-center gap-2">
                 <Database size={20}/> Backend v48 (Vitals Completos)
               </h2>
               <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600"><Settings size={20}/></button>
             </div>
             
             <div className="p-6 overflow-y-auto space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded text-xs text-emerald-900">
                  <strong>IMPORTANTE:</strong> Atualize o código no Google Apps Script para a <strong>Versão 48</strong> para que o Histórico exiba todos os sinais vitais (Temperatura, FR, SpO2 e Dor).
                </div>

                <div className="bg-slate-900 text-slate-100 p-4 rounded text-xs font-mono overflow-auto h-48 relative">
                   <button onClick={handleCopy} className="absolute top-3 right-3 bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-teal-400">
                    {copied ? <Check size={14}/> : 'Copiar Código'}
                   </button>
                   <pre>{scriptCode}</pre>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-700">URL da Implantação:</label>
                  <input type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="w-full p-2 border rounded focus:ring-2 focus:ring-teal-500 outline-none font-mono text-xs text-slate-600 bg-gray-50"/>
                </div>
             </div>
             <div className="p-4 border-t flex justify-end gap-2 bg-gray-50">
                <button onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600">Cancelar</button>
                <button onClick={() => { onSaveUrl(urlInput); localStorage.setItem('appScriptUrl', urlInput); setIsOpen(false); }} className="px-4 py-2 bg-teal-600 text-white rounded font-bold">Salvar e Reiniciar</button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};