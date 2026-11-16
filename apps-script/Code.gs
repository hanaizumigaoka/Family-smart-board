/**
 * FAMILY SMART BOARD - SAKURA GMAIL SYNC + PRIVATE DRIVE ATTACHMENTS
 *
 * 1) Run initializeProject() once from the Apps Script editor.
 * 2) Copy the API Token printed in the execution log. Do not publish it.
 * 3) Deploy as Web app: Execute as "Me"; access "Anyone".
 * 4) Paste the Web App URL and token into the board Settings.
 *
 * Private attachments are stored in your Drive folder. Do NOT change their
 * sharing to "Anyone". The iPad/browser must be signed into the same Google account.
 */

const CONFIG = {
  SPREADSHEET_ID: "1xsei3koVHnfFG8T2it9BlpUe5ahwYY9FP8Kt5ot",
  SHEET_NAME: "SakuraInbox",
  GMAIL_QUERY: "from:sakura@school-i.net",
  DRIVE_FOLDER_NAME: "Family Smart Board - Sakura Attachments",
  MAX_THREADS_PER_SYNC: 100
};

const HEADERS = [
  "Message ID", "日付/送信日", "sender", "subject", "body", "attachment", "status"
];

function initializeProject() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty("FAMILY_BOARD_API_TOKEN");
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    props.setProperty("FAMILY_BOARD_API_TOKEN", token);
  }

  let folderId = props.getProperty("FAMILY_BOARD_DRIVE_FOLDER_ID");
  if (!folderId) {
    const folder = DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
    folderId = folder.getId();
    props.setProperty("FAMILY_BOARD_DRIVE_FOLDER_ID", folderId);
  }

  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  else ensureHeaders_(sheet);

  // Create one 15-minute trigger for incoming Sakura messages.
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "syncSakuraEmails")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncSakuraEmails").timeBased().everyMinutes(15).create();

  Logger.log("SETUP COMPLETE");
  Logger.log("API TOKEN (copy this privately into the Family Board Settings): " + token);
  Logger.log("DRIVE FOLDER: https://drive.google.com/drive/folders/" + folderId);
  Logger.log("Next: Deploy > New deployment > Web app. Execute as Me; Who has access: Anyone.");
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || "");
  const token = String(params.token || "");
  const action = String(params.action || "getNotices");

  const validCallback = /^[A-Za-z_$][0-9A-Za-z_$]*(\.[A-Za-z_$][0-9A-Za-z_$]*)*$/.test(callback);
  const expected = PropertiesService.getScriptProperties().getProperty("FAMILY_BOARD_API_TOKEN");
  let result;

  if (!expected || !constantTimeEquals_(token, expected)) {
    result = {ok:false, error:"Unauthorized: API token không đúng."};
  } else if (action === "ping") {
    result = {ok:true, message:"Family Smart Board API is ready."};
  } else if (action === "getNotices") {
    const limit = Math.min(Math.max(parseInt(params.limit || "60", 10) || 60, 1), 100);
    result = {ok:true, notices:getNotices_(limit)};
  } else {
    result = {ok:false, error:"Action không được hỗ trợ."};
  }

  const json = JSON.stringify(result);
  if (validCallback) {
    return ContentService.createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function syncSakuraEmails() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  ensureHeaders_(sheet);

  const lastRow = sheet.getLastRow();
  const existingRows = new Map();
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    existing.forEach((row, i) => {
      if (row[0]) existingRows.set(String(row[0]), {rowNumber:i + 2, attachmentValue:row[5]});
    });
  }

  const folder = getAttachmentFolder_();
  const threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, CONFIG.MAX_THREADS_PER_SYNC);
  const rowsToAppend = [];
  let repairedAttachments = 0;

  threads.forEach(thread => {
    thread.getMessages().forEach(message => {
      const messageId = message.getId();
      const existing = existingRows.get(messageId);

      // Existing rows are checked for missing attachment metadata too.
      // This repairs older Sakura rows that were imported before Drive attachment sync.
      if (existing) {
        let alreadyHasAttachments = false;
        try {
          const parsed = typeof existing.attachmentValue === "string"
            ? JSON.parse(existing.attachmentValue || "[]")
            : existing.attachmentValue;
          alreadyHasAttachments = Array.isArray(parsed) && parsed.length > 0;
        } catch (_) {}
        if (alreadyHasAttachments) return;

        const repaired = saveMessageAttachments_(message, folder);
        if (repaired.length) {
          sheet.getRange(existing.rowNumber, 6).setValue(JSON.stringify(repaired));
          repairedAttachments += repaired.length;
        }
        return;
      }

      const attachments = saveMessageAttachments_(message, folder);
      rowsToAppend.push([
        messageId,
        message.getDate(),
        message.getFrom(),
        message.getSubject() || "(No subject)",
        message.getPlainBody() || "",
        JSON.stringify(attachments),
        "NEW"
      ]);
      existingRows.set(messageId, {rowNumber:-1, attachmentValue:JSON.stringify(attachments)});
    });
  });

  if (rowsToAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, HEADERS.length).setValues(rowsToAppend);
  }
  Logger.log("Sakura messages added: " + rowsToAppend.length);
  Logger.log("Legacy attachments repaired: " + repairedAttachments);
  return {added:rowsToAppend.length, repairedAttachments:repairedAttachments};
}

function saveMessageAttachments_(message, folder) {
  const attachments = [];
  message.getAttachments({includeInlineImages:false, includeAttachments:true}).forEach(blob => {
    const name = blob.getName() || "attachment";
    const file = folder.createFile(blob.copyBlob()).setName(
      Utilities.formatDate(message.getDate(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss") + "_" + sanitizeFilename_(name)
    );
    attachments.push({
      id:file.getId(),
      name:name,
      mimeType:blob.getContentType() || file.getMimeType(),
      size:blob.getBytes().length
    });
  });
  return attachments;
}

function getNotices_(limit) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const index = {};
  headers.forEach((h, i) => index[String(h).trim()] = i);
  const col = (names) => {
    for (const name of names) if (index[name] !== undefined) return index[name];
    return -1;
  };
  const cId = col(["Message ID", "messageId"]);
  const cDate = col(["日付/送信日", "date", "Date"]);
  const cSender = col(["sender", "送信者", "from"]);
  const cSubject = col(["subject", "件名"]);
  const cBody = col(["body", "本文"]);
  const cAttachment = col(["attachment", "添付ファイル(JSON)", "attachments"]);
  const cStatus = col(["status", "状態"]);
  if (cId < 0) throw new Error("SakuraInbox không có cột Message ID.");

  const rows = values.slice(1).filter(row => row[cId]);
  rows.sort((a,b) => new Date(b[cDate]).getTime() - new Date(a[cDate]).getTime());

  return rows.slice(0, limit).map(row => {
    let attachments = [];
    try {
      const raw = cAttachment >= 0 ? row[cAttachment] : "[]";
      attachments = typeof raw === "string" ? JSON.parse(raw || "[]") : (raw || []);
    } catch (_) {}
    attachments = (Array.isArray(attachments) ? attachments : []).map(a => ({
      id:a.id || a.fileId || "",
      name:a.name || a.filename || "Tệp đính kèm",
      mimeType:a.mimeType || a.contentType || "",
      url:a.id ? "https://drive.google.com/file/d/" + encodeURIComponent(a.id) + "/view" : (a.url || "")
    }));
    const date = cDate >= 0 ? row[cDate] : "";
    return {
      id:String(row[cId]),
      date:date instanceof Date
        ? Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm")
        : String(date || ""),
      sender:cSender >= 0 ? String(row[cSender] || "") : "",
      subject:cSubject >= 0 ? String(row[cSubject] || "") : "",
      body:cBody >= 0 ? String(row[cBody] || "") : "",
      attachments:attachments,
      status:cStatus >= 0 ? String(row[cStatus] || "NEW") : "NEW"
    };
  });
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    return;
  }
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
  const hasMessageId = current.indexOf("Message ID") >= 0;
  if (!hasMessageId) {
    // Do not overwrite existing data. Add a new header row only to an empty sheet.
    throw new Error("SakuraInbox header không đúng. Hãy kiểm tra sheet trước khi chạy.");
  }
}

function getAttachmentFolder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("FAMILY_BOARD_DRIVE_FOLDER_ID");
  if (!id) throw new Error("Chưa chạy initializeProject().");
  return DriveApp.getFolderById(id);
}

function constantTimeEquals_(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function sanitizeFilename_(name) {
  return String(name).replace(/[\\/:*?"<>|]/g, "_").slice(0, 150);
}

/** Manual test: run this after authorizing Gmail and Drive access. */
function testSyncNow() {
  return syncSakuraEmails();
}

/** Manual diagnostic: logs the spreadsheet and attachment folder locations. */
function showProjectInfo() {
  const props = PropertiesService.getScriptProperties();
  Logger.log("Spreadsheet: " + CONFIG.SPREADSHEET_ID);
  Logger.log("Sheet: " + CONFIG.SHEET_NAME);
  Logger.log("Attachment folder: " + props.getProperty("FAMILY_BOARD_DRIVE_FOLDER_ID"));
  Logger.log("API token exists: " + Boolean(props.getProperty("FAMILY_BOARD_API_TOKEN")));
}
