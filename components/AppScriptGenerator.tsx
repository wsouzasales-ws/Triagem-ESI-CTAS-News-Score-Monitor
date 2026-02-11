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

  // Script Backend v62.2 - Mesclado (Login/Auth + HGT Support)
  const scriptCode = `
// =================================================================
// CÓDIGO PARA GOOGLE APPS SCRIPT (ARQUIVO Código.gs)
// NÃO COPIE CÓDIGO REACT/TYPESCRIPT PARA O APPS SCRIPT
// =================================================================

// --- CONFIGURAÇÕES GERAIS ---
var APP_NAME = "Triagem Híbrida ESI + CTAS";
var SCRIPT_VERSION = "v62.2";

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
  // Adicionado coluna HGT no final (index 23)
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
  // Adicionado coluna HGT no final (index 23)
  var headersInternation = [
      "Data/Hora Registro", "Data Avaliação", "Hora Avaliação", "Nome", "Prontuário", 
      "Data Nascimento", "Setor", "Leito", "Reavaliação?",
      "PAS", "PAD", "FC", "FR", "Temp", "SpO2", "Consciencia", "O2 Suplementar", "Dor",
      "Obs", "NEWS Score", "Risco NEWS", "Usuário Resp.", "Status", "HGT"
  ];
  ensureHeader(sheetInternation, headersInternation, "#9fc5e8");

  return "Estrutura v62.2 OK.";
}

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet(); 
    
    if (!action) {
       setupStructure();
       return jsonResponse({ "result": "success", "message": "Script v62.2 Online" });
    }

    if (action === 'diagnostic') {
       var diag = { email: false, sheets: false, version: SCRIPT_VERSION, remainingEmails: 0 };
       try { diag.remainingEmails = MailApp.getRemainingDailyQuota(); diag.email = true; } catch(e) {}
       try { ss.getSheets()[0].getName(); diag.sheets = true; } catch(e) {}
       return jsonResponse({ "result": "success", "data": diag });
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
                dob: row[20], 
                status: row[22] || '',
                vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14], hgt: row[23] || '' }
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
                   name: rowI[3], medicalRecord: rowI[4], dob: rowI[5], 
                   sector: rowI[6], bed: rowI[7], isReevaluation: rowI[8],
                   newsScore: rowI[19], riskText: rowI[20], observations: rowI[18],
                   status: rowI[22] || '',
                   vitals: { pas: rowI[9], pad: rowI[10], fc: rowI[11], fr: rowI[12], temp: rowI[13], spo2: rowI[14], consc: rowI[15], o2: rowI[16], pain: rowI[17], hgt: rowI[23] || '' }
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
           esiLevel: row[15], triageTitle: row[16], discriminators: row[19], 
           dob: row[20], 
           status: row[22] || '',
           vitals: { pa: row[8], fc: row[9], fr: row[10], temp: row[11], spo2: row[12], pain: row[14], hgt: row[23] || '' }
         };
       });
       return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 5000) });
    }

    if (action === 'getAllInternation') {
      var sheetInt = ss.getSheetByName("Pacientes internados");
      if (!sheetInt) return jsonResponse({ "result": "success", "data": [] });
      var values = sheetInt.getDataRange().getDisplayValues();
      if (values.length <= 1) return jsonResponse({ "result": "success", "data": [] });
      var rows = values.slice(1).map(function(row) {
        return {
          systemTimestamp: row[0], evaluationDate: row[1], evaluationTime: row[2], name: row[3], medicalRecord: row[4], dob: row[5], sector: row[6], bed: row[7], isReevaluation: row[8],
          vitals: { pas: row[9], pad: row[10], fc: row[11], fr: row[12], temp: row[13], spo2: row[14], consciousness: row[15], o2Sup: row[16], painLevel: row[17], hgt: row[23] || '' },
          observations: row[18], newsScore: row[19], riskText: row[20], status: row[22] || ''
        };
      });
      return jsonResponse({ "result": "success", "data": rows.reverse().slice(0, 5000) }); 
    }

    if (action === 'search') {
      var recordToFind = e.parameter.medicalRecord;
      var sheet = ss.getSheets()[0];
      var values = sheet.getDataRange().getDisplayValues();
      for (var i = values.length - 1; i >= 1; i--) {
        if (String(values[i][4]).trim() === String(recordToFind).trim()) {
          // Busca HGT da coluna 23 se existir
          var hgtVal = values[i][23] || '';
          return jsonResponse({ "result": "found", "history": { 
              "name": values[i][3], "lastDate": values[i][1], "lastTime": values[i][2], "ageString": values[i][6], "dob": values[i][20], "lastEsi": values[i][15], 
              "lastVitals": { pa: values[i][8], fc: values[i][9], fr: values[i][10], temp: values[i][11], spo2: values[i][12], gcs: values[i][13], pain: values[i][14], hgt: hgtVal } 
          } });
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
               var hgtVal = vals[i][23] || '';
               return jsonResponse({ "result": "found", "source": "internation", "history": { 
                   "name": vals[i][3], "dob": vals[i][5], "sector": vals[i][6], "bed": vals[i][7], "lastDate": vals[i][1], "lastTime": vals[i][2], "newsScore": vals[i][19], 
                   "lastVitals": { pas: vals[i][9], pad: vals[i][10], fc: vals[i][11], fr: vals[i][12], temp: vals[i][13], spo2: vals[i][14], consc: vals[i][15], o2: vals[i][16], pain: vals[i][17], hgt: hgtVal }
               } });
            }
         }
      }
      // Fallback para buscar na triagem se não achar na internação
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
       // Adicionado HGT no final
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
      // Adicionado HGT no final
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

    if (data.action === 'recoverPassword') {
        var sheetUsers = ss.getSheetByName("Usuários");
        var users = sheetUsers.getDataRange().getDisplayValues();
        for (var i = 1; i < users.length; i++) {
            if (String(users[i][2]).toLowerCase().trim() === String(data.email).toLowerCase().trim()) {
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