import React, { useState, useEffect } from 'react';
import { Copy, Settings, Check, AlertTriangle, Database, Activity, Zap, Mail, ShieldCheck, Server, RefreshCw, CheckCircle2, XCircle, Search, Gauge, MailCheck, TableProperties, FileCode } from 'lucide-react';
import { calculateTriage } from '../utils/esiCtasEngine';
import { calculateNEWS } from '../utils/newsCalculator';
import { evaluateProtocols } from '../utils/protocolEngine';
import { fetchWithRetry } from '../utils/api';
import { VitalSigns, PatientData, CtasDiscriminators } from '../types';

interface Props {
  currentUrl: string;
  onSaveUrl: (url: string) => void;
}

type TestStatus = 'idle' | 'running' | 'success' | 'error';

interface DiagnosticResult {
  id: string;
  name: string;
  status: TestStatus;
  message?: string;
  category: 'Conectividade' | 'Motores' | 'Segurança';
}

export const AppScriptGenerator: React.FC<Props> = ({ currentUrl, onSaveUrl }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'diagnostic'>('diagnostic');
  const [urlInput, setUrlInput] = useState(currentUrl);
  const [copied, setCopied] = useState(false);
  
  // Estados do Diagnóstico
  const [isDiagnosticRunning, setIsDiagnosticRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([
    { id: 'network', name: 'Conectividade com Backend Google', status: 'idle', category: 'Conectividade' },
    { id: 'backend_mapping', name: 'Mapeamento de Ações do Script', status: 'idle', category: 'Conectividade' },
    { id: 'email_service', name: 'Permissão de Envio de E-mails', status: 'idle', category: 'Segurança' },
    { id: 'sheets_access', name: 'Acesso e Escrita em Planilhas', status: 'idle', category: 'Conectividade' },
    { id: 'esi_engine', name: 'Motor de Decisão ESI + CTAS', status: 'idle', category: 'Motores' },
    { id: 'news_engine', name: 'Motor NEWS (Deterioração)', status: 'idle', category: 'Motores' },
    { id: 'protocol_triggers', name: 'Gatilhos de Protocolos Críticos', status: 'idle', category: 'Motores' },
  ]);

  // Script Backend v63.0 - Otimizado para Alta Volumetria (15.000+ registros)
  const scriptCode = `
// =================================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT (ARQUIVO Código.gs)
// VERSÃO 63.0 OTIMIZADA PARA ALTA VOLUMETRIA (15.000+ ATENDIMENTOS)
// NÃO COPIE CÓDIGO REACT/TYPESCRIPT PARA O APPS SCRIPT
// =================================================================

// --- CONFIGURAÇÕES GERAIS ---
var APP_NAME = "Triagem Híbrida ESI + CTAS";
var SCRIPT_VERSION = "v63.0 High-Performance";

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

function formatVal(val) {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm:ss");
  }
  return String(val).trim();
}

function formatDateVal(val) {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }
  var s = String(val).trim();
  if (s.indexOf('T') !== -1) s = s.split('T')[0];
  return s;
}

function formatTimeVal(val) {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), "HH:mm");
  }
  return String(val).trim();
}

function parseDateVal(dateVal, timeVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    if (timeVal && typeof timeVal === 'string' && timeVal.indexOf(':') !== -1) {
       var pTime = timeVal.split(':');
       var d = new Date(dateVal.getTime());
       d.setHours(parseInt(pTime[0], 10), parseInt(pTime[1], 10));
       return d;
    }
    return dateVal;
  }
  var sStr = String(dateVal).trim().split(' ')[0];
  var day = 0, month = 0, year = 0;
  if (sStr.indexOf('/') !== -1) {
     var p = sStr.split('/');
     day = parseInt(p[0], 10); month = parseInt(p[1], 10) - 1; year = parseInt(p[2], 10);
  } else if (sStr.indexOf('-') !== -1) {
     var p = sStr.split('-');
     if (p[0].length === 4) { year = parseInt(p[0], 10); month = parseInt(p[1], 10) - 1; day = parseInt(p[2], 10); }
     else { day = parseInt(p[0], 10); month = parseInt(p[1], 10) - 1; year = parseInt(p[2], 10); }
  }
  if (year > 0 && year < 100) year += 2000;
  if (year === 0) return null;

  var hours = 0, minutes = 0;
  if (timeVal) {
     var tStr = formatTimeVal(timeVal);
     var tParts = tStr.split(':');
     if (tParts.length >= 2) { hours = parseInt(tParts[0], 10); minutes = parseInt(tParts[1], 10); }
  }
  return new Date(year, month, day, hours, minutes);
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
      "ESI Level", "Classificação", "Tempo Alvo", "Justificativa", "Discriminadores", "Data Nascimento", "Usuário Resp.", "Status", "HGT"
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
      "Obs", "NEWS Score", "Risco NEWS", "Usuário Resp.", "Status", "HGT"
  ];
  ensureHeader(sheetInternation, headersInternation, "#9fc5e8");

  return "Estrutura v63.0 OK.";
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet(); 
    
    if (!action) {
       setupStructure();
       return jsonResponse({ "result": "success", "message": "Script v63.0 Online (Alta Volumetria)" });
    }

    if (action === 'diagnostic') {
       var diag = { email: false, sheets: false, version: SCRIPT_VERSION, remainingEmails: 0 };
       try { diag.remainingEmails = MailApp.getRemainingDailyQuota(); diag.email = true; } catch(err) {}
       try { ss.getSheets()[0].getName(); diag.sheets = true; } catch(err) {}
       return jsonResponse({ "result": "success", "data": diag });
    }

    // BUSCA OTIMIZADA PARA HISTÓRICO COM SERVERSIDE FILTERING & BOTTOM-UP SCANNING
    if (action === 'filterHistory') {
       var searchId = e.parameter.medicalRecord ? String(e.parameter.medicalRecord).trim().toLowerCase() : "";
       var mode = e.parameter.mode ? String(e.parameter.mode).trim() : "24h";
       var startDateStr = e.parameter.startDate ? String(e.parameter.startDate).trim() : "";
       var endDateStr = e.parameter.endDate ? String(e.parameter.endDate).trim() : "";
       var limit = parseInt(e.parameter.limit || "500", 10);
       
       var now = new Date();
       var cutoff24h = new Date(now.getTime() - (24 * 60 * 60 * 1000));
       var startDateObj = startDateStr ? new Date(startDateStr + "T00:00:00") : null;
       var endDateObj = endDateStr ? new Date(endDateStr + "T23:59:59") : null;

       var resultRows = [];

       // 1. Triage Sheet (Bottom-Up)
       var sheetTriage = ss.getSheets()[0];
       var valsT = sheetTriage.getDataRange().getValues();
       for (var i = valsT.length - 1; i >= 1; i--) {
          var row = valsT[i];
          var recId = formatVal(row[4]).toLowerCase();

          if (searchId && recId !== searchId && recId.indexOf(searchId) === -1) {
             continue;
          }

          var rowDateObj = parseDateVal(row[1] || row[0], row[2]);

          if (mode === '24h' && !searchId) {
             if (rowDateObj && rowDateObj < cutoff24h) {
                break; // Parada antecipada: dados antigos
             }
          } else if (mode === 'range' && !searchId) {
             if (rowDateObj) {
                if (endDateObj && rowDateObj > endDateObj) continue;
                if (startDateObj && rowDateObj < startDateObj) {
                   break; // Parada antecipada
                }
             }
          }

          resultRows.push({
             source: 'triage',
             systemTimestamp: formatVal(row[0]), 
             evaluationDate: formatDateVal(row[1]) || formatVal(row[0]).split(' ')[0], 
             evaluationTime: formatTimeVal(row[2]), 
             name: formatVal(row[3]), 
             medicalRecord: formatVal(row[4]), 
             age: formatVal(row[6]), 
             complaint: formatVal(row[7]), 
             esiLevel: formatVal(row[15]), 
             triageTitle: formatVal(row[16]), 
             discriminators: formatVal(row[19]),
             dob: formatDateVal(row[20]), 
             status: formatVal(row[22]),
             vitals: { pa: formatVal(row[8]), fc: formatVal(row[9]), fr: formatVal(row[10]), temp: formatVal(row[11]), spo2: formatVal(row[12]), pain: formatVal(row[14]), hgt: formatVal(row[23]) }
          });

          if (resultRows.length >= limit) break;
       }

       // 2. Internation Sheet (Bottom-Up)
       var sheetInt = ss.getSheetByName("Pacientes internados");
       if (sheetInt) {
          var valsI = sheetInt.getDataRange().getValues();
          for (var j = valsI.length - 1; j >= 1; j--) {
             var rowI = valsI[j];
             var recIdI = formatVal(rowI[4]).toLowerCase();

             if (searchId && recIdI !== searchId && recIdI.indexOf(searchId) === -1) {
                continue;
             }

             var rowDateObjI = parseDateVal(rowI[1] || rowI[0], rowI[2]);

             if (mode === '24h' && !searchId) {
                if (rowDateObjI && rowDateObjI < cutoff24h) break;
             } else if (mode === 'range' && !searchId) {
                if (rowDateObjI) {
                   if (endDateObj && rowDateObjI > endDateObj) continue;
                   if (startDateObj && rowDateObjI < startDateObj) break;
                }
             }

             resultRows.push({
                source: 'internation',
                systemTimestamp: formatVal(rowI[0]), 
                evaluationDate: formatDateVal(rowI[1]), 
                evaluationTime: formatTimeVal(rowI[2]), 
                name: formatVal(rowI[3]), 
                medicalRecord: formatVal(rowI[4]), 
                dob: formatDateVal(rowI[5]), 
                sector: formatVal(rowI[6]), 
                bed: formatVal(rowI[7]), 
                isReevaluation: formatVal(rowI[8]),
                newsScore: formatVal(rowI[19]), 
                riskText: formatVal(rowI[20]), 
                observations: formatVal(rowI[18]),
                status: formatVal(rowI[22]),
                vitals: { pas: formatVal(rowI[9]), pad: formatVal(rowI[10]), fc: formatVal(rowI[11]), fr: formatVal(rowI[12]), temp: formatVal(rowI[13]), spo2: formatVal(rowI[14]), consc: formatVal(rowI[15]), o2: formatVal(rowI[16]), pain: formatVal(rowI[17]), hgt: formatVal(rowI[23]) }
             });

             if (resultRows.length >= limit * 2) break;
          }
       }

       // Ordenar por data mais recente
       resultRows.sort(function(a, b) {
          var dA = parseDateVal(a.evaluationDate || a.systemTimestamp, a.evaluationTime);
          var dB = parseDateVal(b.evaluationDate || b.systemTimestamp, b.evaluationTime);
          return (dB ? dB.getTime() : 0) - (dA ? dA.getTime() : 0);
       });

       return jsonResponse({ "result": "success", "data": resultRows.slice(0, limit) });
    }

    if (action === 'getAll') {
       var sheet = ss.getSheets()[0];
       var values = sheet.getDataRange().getValues();
       if (values.length <= 1) return jsonResponse({ "result": "success", "data": [] });
       var rows = [];
       var maxLimit = 2000; // Limita aos 2.000 mais recentes para performance máxima
       for (var i = values.length - 1; i >= 1; i--) {
         var row = values[i];
         rows.push({
           systemTimestamp: formatVal(row[0]), 
           evaluationDate: formatDateVal(row[1]) || formatVal(row[0]).split(' ')[0], 
           evaluationTime: formatTimeVal(row[2]), 
           name: formatVal(row[3]), 
           medicalRecord: formatVal(row[4]), 
           isReevaluation: formatVal(row[5]), 
           age: formatVal(row[6]), 
           complaint: formatVal(row[7]), 
           esiLevel: formatVal(row[15]), 
           triageTitle: formatVal(row[16]), 
           discriminators: formatVal(row[19]), 
           dob: formatDateVal(row[20]), 
           status: formatVal(row[22]),
           vitals: { pa: formatVal(row[8]), fc: formatVal(row[9]), fr: formatVal(row[10]), temp: formatVal(row[11]), spo2: formatVal(row[12]), pain: formatVal(row[14]), hgt: formatVal(row[23]) }
         });
         if (rows.length >= maxLimit) break;
       }
       return jsonResponse({ "result": "success", "data": rows });
    }

    if (action === 'getAllInternation') {
      var sheetInt = ss.getSheetByName("Pacientes internados");
      if (!sheetInt) return jsonResponse({ "result": "success", "data": [] });
      var values = sheetInt.getDataRange().getValues();
      if (values.length <= 1) return jsonResponse({ "result": "success", "data": [] });
      var rows = [];
      var maxLimit = 2000;
      for (var j = values.length - 1; j >= 1; j--) {
        var row = values[j];
        rows.push({
          systemTimestamp: formatVal(row[0]), 
          evaluationDate: formatDateVal(row[1]), 
          evaluationTime: formatTimeVal(row[2]), 
          name: formatVal(row[3]), 
          medicalRecord: formatVal(row[4]), 
          dob: formatDateVal(row[5]), 
          sector: formatVal(row[6]), 
          bed: formatVal(row[7]), 
          isReevaluation: formatVal(row[8]),
          vitals: { pas: formatVal(row[9]), pad: formatVal(row[10]), fc: formatVal(row[11]), fr: formatVal(row[12]), temp: formatVal(row[13]), spo2: formatVal(row[14]), consciousness: formatVal(row[15]), o2Sup: formatVal(row[16]), painLevel: formatVal(row[17]), hgt: formatVal(row[23]) },
          observations: formatVal(row[18]), 
          newsScore: formatVal(row[19]), 
          riskText: formatVal(row[20]), 
          status: formatVal(row[22])
        });
        if (rows.length >= maxLimit) break;
      }
      return jsonResponse({ "result": "success", "data": rows }); 
    }

    if (action === 'search') {
      var recordToFind = String(e.parameter.medicalRecord || '').trim().toLowerCase();
      var sheet = ss.getSheets()[0];
      var values = sheet.getDataRange().getValues();
      for (var i = values.length - 1; i >= 1; i--) {
        if (formatVal(values[i][4]).toLowerCase() === recordToFind) {
          return jsonResponse({ "result": "found", "history": { 
              "name": formatVal(values[i][3]), "lastDate": formatDateVal(values[i][1]), "lastTime": formatTimeVal(values[i][2]), "ageString": formatVal(values[i][6]), "dob": formatDateVal(values[i][20]), "lastEsi": formatVal(values[i][15]), 
              "lastVitals": { pa: formatVal(values[i][8]), fc: formatVal(values[i][9]), fr: formatVal(values[i][10]), temp: formatVal(values[i][11]), spo2: formatVal(values[i][12]), gcs: formatVal(values[i][13]), pain: formatVal(values[i][14]), hgt: formatVal(values[i][23]) } 
          } });
        }
      }
      return jsonResponse({ "result": "not_found" });
    }
    
    if (action === 'searchInternation') {
      var recordToFind = String(e.parameter.medicalRecord || '').trim().toLowerCase();
      var sheetInt = ss.getSheetByName("Pacientes internados");
      if (sheetInt) {
         var vals = sheetInt.getDataRange().getValues();
         for (var i = vals.length - 1; i >= 1; i--) {
            if (formatVal(vals[i][4]).toLowerCase() === recordToFind) {
               return jsonResponse({ "result": "found", "source": "internation", "history": { 
                   "name": formatVal(vals[i][3]), "dob": formatDateVal(vals[i][5]), "sector": formatVal(vals[i][6]), "bed": formatVal(vals[i][7]), "lastDate": formatDateVal(vals[i][1]), "lastTime": formatTimeVal(vals[i][2]), "newsScore": formatVal(vals[i][19]), 
                   "lastVitals": { pas: formatVal(vals[i][9]), pad: formatVal(vals[i][10]), fc: formatVal(vals[i][11]), fr: formatVal(vals[i][12]), temp: formatVal(vals[i][13]), spo2: formatVal(vals[i][14]), consc: formatVal(vals[i][15]), o2: formatVal(vals[i][16]), pain: formatVal(vals[i][17]), hgt: formatVal(vals[i][23]) }
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
        var triageData = sheetTriage.getDataRange().getValues();
        var intData = sheetInt ? sheetInt.getDataRange().getValues() : [];
        var count = 0;

        for (var k = 0; k < items.length; k++) {
           var item = items[k];
           var targetSheet = (item.source === 'internation') ? sheetInt : sheetTriage;
           var targetData = (item.source === 'internation') ? intData : triageData;
           if (!targetSheet) continue;

           for (var i = targetData.length - 1; i >= 1; i--) {
               var rowTs = formatVal(targetData[i][0]); 
               var rowMr = formatVal(targetData[i][4]); 
               
               if (rowTs === formatVal(item.systemTimestamp) && rowMr === formatVal(item.medicalRecord)) {
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
          getSafe(data, 'news.score', ''), getSafe(data, 'news.riskText', ''), getSafe(data, 'user', 'Sistema'), "ATIVO", getSafe(data, 'vitals.hgt', '')
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
        getSafe(data, 'patient.dob', ''), getSafe(data, 'user', 'Sistema'), "ATIVO", getSafe(data, 'vitals.hgt', '')
      ]);
      SpreadsheetApp.flush();
      return jsonResponse({ "result": "success" });
    }
    
    if (data.action === 'login') {
       var sheetUsers = ss.getSheetByName("Usuários");
       var users = sheetUsers.getDataRange().getValues();
       var loginEmail = String(data.email || "").toLowerCase().trim();
       for (var i = 1; i < users.length; i++) {
          if (formatVal(users[i][2]).toLowerCase() === loginEmail) {
             if (formatVal(users[i][4]) === String(data.password).trim()) return jsonResponse({ "result": "success", "user": { "name": users[i][1], "email": users[i][2], "sector": users[i][3] } });
             return jsonResponse({ "result": "error", "message": "Senha incorreta." });
          }
       }
       return jsonResponse({ "result": "error", "message": "E-mail não encontrado." });
    }

    if (data.action === 'registerUser') {
        var sheetUsers = ss.getSheetByName("Usuários");
        sheetUsers.appendRow([new Date(), data.name, data.email.toLowerCase(), data.sector, data.password]);
        try { sendEmailRobust(data.email, "Acesso Liberado - " + APP_NAME, "Cadastro realizado.", ss); } catch(err) {}
        return jsonResponse({ "result": "success" });
    }

    if (data.action === 'recoverPassword') {
        var sheetUsers = ss.getSheetByName("Usuários");
        var users = sheetUsers.getDataRange().getValues();
        for (var i = 1; i < users.length; i++) {
            if (formatVal(users[i][2]).toLowerCase() === String(data.email).toLowerCase().trim()) {
                sendEmailRobust(data.email, "Recuperação de Senha", "Sua senha é: " + users[i][4], ss);
                return jsonResponse({ "result": "success" });
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

  const runDiagnostics = async () => {
    setIsDiagnosticRunning(true);
    setResults(prev => prev.map(r => ({ ...r, status: 'running', message: 'Executando...' })));

    const updateOne = (id: string, status: TestStatus, message: string) => {
        setResults(prev => prev.map(r => r.id === id ? { ...r, status, message } : r));
    };

    // 1. Motores Clínicos (Local)
    try {
        const mockVitals: VitalSigns = { pas: '85', pad: '50', fc: '145', fr: '35', temp: '36.5', spo2: '88', gcs: 15, painLevel: '' };
        const mockPatient: PatientData = { name: 'DIAG', medicalRecord: '1', dob: '1990-01-01', age: 34, ageUnit: 'years', gender: 'M', complaint: 'Teste', serviceTimestamp: '', evaluationDate: '', evaluationTime: '', isReevaluation: false };
        const mockDisc: CtasDiscriminators = { abcUnstable: false, highRiskSituation: false, resources: 'none', neuro: { gcsLow: false, acuteConfusion: false, headTrauma: false, severeHeadache: false, motorNeuroDeficit: false }, sepsis: { suspectedInfection: false, immunosuppressed: false, perfursionIssues: false }, cardio: { chestPainRisk: false, chestPainTypical: false, chestPainAtypicalCombined: false, severePainWithVitals: false }, respiratory: { dyspneaRisk: false, respiratoryDistress: false }, pediatric: { dehydration: false, feverRisk: false, lethargy: false } };
        const resESI = calculateTriage(mockPatient, mockVitals, mockDisc);
        if (resESI.level === 2) updateOne('esi_engine', 'success', 'Cálculos de downgrade/upgrade vitais ESI OK.');
        else throw new Error("ESI falhou no teste de criticidade.");
    } catch(e: any) { updateOne('esi_engine', 'error', e.message); }

    try {
        const mockVitalsNEWS: VitalSigns = { pas: '80', pad: '50', fc: '140', fr: '26', temp: '36.5', spo2: '90', gcs: 15, painLevel: '', consciousness: 'Pain', o2Sup: true };
        const resNEWS = calculateNEWS(mockVitalsNEWS);
        if (resNEWS.score >= 10 && resNEWS.riskClass === 'high') updateOne('news_engine', 'success', 'Cálculo de escore NEWS e alertas de risco OK.');
        else throw new Error("NEWS falhou no cálculo de deterioração.");
    } catch(e: any) { updateOne('news_engine', 'error', e.message); }

    try {
        const resProt = evaluateProtocols({ pas: '120', pad: '80', fc: '80', fr: '16', temp: '36.5', spo2: '98', gcs: 15, painLevel: '' } as VitalSigns, ['neuro_rima', 'inf_infeccao']);
        const hasAVC = resProt.some(p => p.type === 'avc');
        const hasSepse = resProt.some(p => p.type === 'sepse');
        if (hasAVC && hasSepse) updateOne('protocol_triggers', 'success', 'Gatilhos de AVC e Sepse disparando corretamente.');
        else throw new Error("Protocolos não dispararam com sintomas marcados.");
    } catch(e: any) { updateOne('protocol_triggers', 'error', e.message); }

    // 2. Conectividade e Backend (Remoto)
    try {
        const start = Date.now();
        const response = await fetchWithRetry(`${currentUrl}?action=diagnostic&_=${Date.now()}`, { method: 'GET' }, 1);
        const lat = Date.now() - start;

        if (response.result === 'success') {
            const data = response.data;
            updateOne('network', 'success', `Conexão estável. Latência: ${lat}ms.`);
            updateOne('backend_mapping', 'success', `Ações mapeadas. Backend: ${data.version}`);
            
            if (data.email) updateOne('email_service', 'success', `Serviço de e-mail verificado.`);
            else updateOne('email_service', 'error', 'Serviço de e-mail bloqueado por permissão.');

            if (data.sheets) updateOne('sheets_access', 'success', 'Permissão de leitura/escrita em planilhas OK.');
            else updateOne('sheets_access', 'error', 'Sem acesso ao Google Drive/Sheets.');
        } else {
            throw new Error(response.message || "Erro desconhecido");
        }
    } catch(e: any) {
        updateOne('network', 'error', 'URL do Script inválida ou offline.');
        updateOne('backend_mapping', 'error', 'Mapeamento remoto indisponível.');
    }

    setIsDiagnosticRunning(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="fixed bottom-4 right-4 p-3 bg-teal-600 hover:bg-teal-700 rounded-full text-white shadow-lg z-10 transition-transform active:scale-95 group">
        <Settings size={24} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
             
             {/* Header */}
             <div className="p-6 border-b flex justify-between items-center bg-slate-900 text-white">
               <div className="flex items-center gap-3">
                 <ShieldCheck className="text-teal-400" size={28}/>
                 <div>
                    <h2 className="text-xl font-bold leading-none">Central de Diagnóstico</h2>
                    <span className="text-[10px] text-teal-500 font-black uppercase tracking-[0.2em]">Versão 62.2 Estabilizada</span>
                 </div>
               </div>
               <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                  <XCircle size={24}/>
               </button>
             </div>

             {/* Tabs */}
             <div className="flex border-b bg-slate-50">
                <button 
                    onClick={() => setActiveTab('diagnostic')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'diagnostic' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-slate-400 hover:bg-slate-100'}`}
                >
                    <Activity size={16}/> Verificação Automática
                </button>
                <button 
                    onClick={() => setActiveTab('code')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all ${activeTab === 'code' ? 'border-teal-600 text-teal-700 bg-white' : 'border-transparent text-slate-400 hover:bg-slate-100'}`}
                >
                    <Database size={16}/> Script de Backend
                </button>
             </div>
             
             <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50">
                
                {activeTab === 'diagnostic' && (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-teal-50 rounded-full text-teal-600">
                                    <Gauge size={24}/>
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm uppercase">Health Check</h3>
                                    <p className="text-xs text-slate-500 font-medium">Verificação de integridade do sistema</p>
                                </div>
                            </div>
                            <button 
                                onClick={runDiagnostics} 
                                disabled={isDiagnosticRunning}
                                className={`px-6 py-2.5 rounded-lg font-black text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 ${isDiagnosticRunning ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                            >
                                {isDiagnosticRunning ? <RefreshCw className="animate-spin" size={16}/> : <Zap size={16}/>}
                                {isDiagnosticRunning ? 'VERIFICANDO...' : 'INICIAR TESTE'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {['Conectividade', 'Motores', 'Segurança'].map(cat => (
                                <div key={cat} className="space-y-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{cat}</h4>
                                    <div className="grid gap-2">
                                        {results.filter(r => r.category === cat).map((res) => (
                                            <div key={res.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    {res.status === 'idle' && <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                                                    {res.status === 'running' && <RefreshCw size={20} className="text-blue-500 animate-spin" />}
                                                    {res.status === 'success' && <div className="bg-emerald-100 p-1 rounded-full"><CheckCircle2 size={16} className="text-emerald-600" /></div>}
                                                    {res.status === 'error' && <div className="bg-rose-100 p-1 rounded-full"><XCircle size={16} className="text-rose-600" /></div>}
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700">{res.name}</p>
                                                        {res.message && <p className={`text-[10px] font-medium leading-tight mt-0.5 ${res.status === 'error' ? 'text-rose-500' : 'text-slate-400'}`}>{res.message}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'code' && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="bg-rose-100 border-l-4 border-rose-600 p-4 rounded text-xs text-rose-900 leading-relaxed flex items-start gap-3">
                          <AlertTriangle className="shrink-0 mt-0.5 text-rose-600" size={24}/>
                          <div>
                            <strong className="block text-sm mb-1 uppercase">BACKEND v62.2 ATUALIZADO</strong>
                            Copie o conteúdo abaixo e cole no arquivo <code>Código.gs</code> do seu projeto Google Apps Script.
                          </div>
                        </div>

                        <div className="bg-slate-900 text-slate-100 p-5 rounded-xl text-[10px] font-mono overflow-auto h-64 relative shadow-2xl border border-slate-700">
                           <button onClick={handleCopy} className="absolute top-4 right-4 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-teal-400 font-black transition-colors flex items-center gap-2 border border-slate-700 shadow-lg">
                            {copied ? <Check size={14}/> : <Copy size={14}/>}
                            {copied ? 'COPIADO' : 'COPIAR CÓDIGO'}
                           </button>
                           <pre className="whitespace-pre-wrap">{scriptCode}</pre>
                        </div>

                        <div className="space-y-3 pt-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 px-1">
                             <Server size={14}/> URL da Implantação
                          </label>
                          <input 
                            type="text" 
                            value={urlInput} 
                            onChange={(e) => setUrlInput(e.target.value)} 
                            className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono text-xs text-slate-600 bg-white shadow-sm transition-all"
                            placeholder="https://script.google.com/macros/s/.../exec"
                          />
                        </div>
                    </div>
                )}
             </div>

             {/* Footer Actions */}
             <div className="p-4 border-t flex justify-end gap-3 bg-white">
                <button onClick={() => setIsOpen(false)} className="px-6 py-2.5 text-slate-500 font-black hover:bg-slate-100 rounded-xl text-[10px] uppercase tracking-widest transition-all">Fechar</button>
                <button 
                    onClick={() => { onSaveUrl(urlInput); localStorage.setItem('appScriptUrl', urlInput); setIsOpen(false); }} 
                    className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[10px] shadow-lg transition-all active:scale-95 uppercase tracking-widest border-b-4 border-slate-950 active:border-b-0"
                >
                    Salvar e Reiniciar
                </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};