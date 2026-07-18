const TIMELOG_DB_CACHE = {};
const TIMELOG_SHEET_CACHE = {};
const TIMELOG_HEADER_CACHE = {};


/* =========================
   WORKSPACE RESOLVER
========================= */

function getTimelogDb(workspace_id) {

  const normalizedWorkspaceId =
    normalize(
      "workspace_id",
      workspace_id
    );


  if (!normalizedWorkspaceId) {
    throw new Error(
      "workspace_id is required"
    );
  }


  if (TIMELOG_DB_CACHE[normalizedWorkspaceId]) {
    return TIMELOG_DB_CACHE[normalizedWorkspaceId];
  }


  const workspace =
    getWorkspace(
      normalizedWorkspaceId
    );


  if (
    !workspace ||
    !workspace.timelog_spreadsheet_id
  ) {
    throw new Error(
      `TimeLog DB missing for workspace: ${normalizedWorkspaceId}`
    );
  }


  const db =
    SpreadsheetApp.openById(
      workspace.timelog_spreadsheet_id
    );


  TIMELOG_DB_CACHE[normalizedWorkspaceId] = db;


  return db;
}



/* =========================
   VALIDATION
========================= */

function assertInsertableTimeLog(log) {

  if (!log) {
    throw new Error(
      "Invalid timelog payload"
    );
  }


  if (!log.workspace_id) {
    throw new Error(
      "workspace_id is required"
    );
  }


  if (!log.email) {
    throw new Error(
      "email is required"
    );
  }


  if (!log.action) {
    throw new Error(
      "action is required"
    );
  }


  if (!log.timestamp) {
    throw new Error(
      "timestamp is required"
    );
  }


  if (!log.date) {
    throw new Error(
      "date is required"
    );
  }


  return true;
}



/* =========================
   SHEET LOADER
========================= */

function getTimeLogSheet(db) {

  if (!db) {
    throw new Error(
      "Invalid spreadsheet instance"
    );
  }


  const key =
    db.getId();


  if (
    TIMELOG_SHEET_CACHE[key]
  ) {
    return TIMELOG_SHEET_CACHE[key];
  }


  const sheet =
    db.getSheetByName(
      TIMELOG_SHEET_NAME
    );


  if (!sheet) {
    throw new Error(
      `${TIMELOG_SHEET_NAME} sheet not found`
    );
  }


  if (
    sheet.getLastColumn() === 0
  ) {
    throw new Error(
      `${TIMELOG_SHEET_NAME} sheet is not initialized`
    );
  }


  TIMELOG_SHEET_CACHE[key] = sheet;


  return sheet;
}



/* =========================
   HEADER LOADER
========================= */

function getTimeLogHeaders(sheet) {

  if (!sheet) {
    throw new Error(
      "sheet is required"
    );
  }


  const key =
    sheet.getSheetId();


  if (
    TIMELOG_HEADER_CACHE[key]
  ) {
    return TIMELOG_HEADER_CACHE[key];
  }


  const lastCol =
    sheet.getLastColumn();


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastCol
      )
      .getValues()[0]
      .map(function(header){

        return String(
          header || ""
        ).trim();

      });


  TIMELOG_HEADER_CACHE[key] =
    headers;


  return headers;
}



function assertTimeLogHeaders(headers) {

  const list =
    Array.isArray(headers)
      ? headers
      : [];


  const required =
    getRequiredTimeLogHeaders();


  const missing =
    required.filter(function(key){

      return !list.includes(key);

    });


  if (missing.length) {

    throw new Error(
      `TIME_LOGS sheet missing required headers: ${missing.join(", ")}`
    );

  }


  return true;
}



/* =========================
   INSERT ONE
========================= */

function insertTimeLog(workspace_id, payload) {

  const normalizedWorkspaceId =
    normalize(
      "workspace_id",
      workspace_id
    );


  if (!normalizedWorkspaceId) {
    throw new Error(
      "workspace_id is required"
    );
  }


  const db =
    getTimelogDb(
      normalizedWorkspaceId
    );


  const sheet =
    getTimeLogSheet(db);


  const headers =
    getTimeLogHeaders(sheet);


  assertTimeLogHeaders(headers);



  const log =
    normalizeTimeLog(
      payload,
      normalizedWorkspaceId
    );


  assertInsertableTimeLog(log);



  const row =
    buildTimeLogRow(
      headers,
      log
    );


  const nextRow =
    sheet.getLastRow() + 1;


  sheet
    .getRange(
      nextRow,
      1,
      1,
      row.length
    )
    .setValues([
      row
    ]);



  return {

    success:true,

    message:
      buildActionMessage(
        log.action
      ),

    log_id:
      log.log_id,

    workspace_id:
      normalizedWorkspaceId,

    timestamp:
      log.timestamp,

    shift_id:
      log.shift_id,

    work_date:
      log.date

  };

}



/* =========================
   INSERT MANY
========================= */

function insertManyTimeLogs(workspace_id, logs) {

  const normalizedWorkspaceId =
    normalize(
      "workspace_id",
      workspace_id
    );


  const db =
    getTimelogDb(
      normalizedWorkspaceId
    );


  const sheet =
    getTimeLogSheet(db);


  const headers =
    getTimeLogHeaders(sheet);


  assertTimeLogHeaders(headers);



  const normalizedLogs =
    logs.map(function(log){

      const normalized =
        normalizeTimeLog(
          log,
          normalizedWorkspaceId
        );


      normalized.date =
        getShiftWorkDate(
          normalizedWorkspaceId,
          normalized.shift_id,
          normalized.timestamp
        );


      assertInsertableTimeLog(
        normalized
      );


      return normalized;

    });



  const rows =
    normalizedLogs.map(function(log){

      return buildTimeLogRow(
        headers,
        log
      );

    });



  sheet
    .getRange(
      sheet.getLastRow()+1,
      1,
      rows.length,
      headers.length
    )
    .setValues(rows);



  return {

    success:true,

    message:
      "Batch insert completed",

    inserted:
      rows.length,

    workspace_id:
      normalizedWorkspaceId

  };

}



/* =========================
   ROW BUILDER
========================= */

function buildTimeLogRow(headers, log) {

  return headers.map(function(header){

    return (
      log[header] !== undefined &&
      log[header] !== null
    )
      ? log[header]
      : "";

  });

}



/* =========================
   FIND LOGS OPTIMIZED
========================= */

function findTimeLogs(workspace_id, filters) {


  const normalizedWorkspaceId =
    normalize(
      "workspace_id",
      workspace_id
    );


  const db =
    getTimelogDb(
      normalizedWorkspaceId
    );


  const sheet =
    getTimeLogSheet(db);


  const headers =
    getTimeLogHeaders(sheet);


  const normalizedFilters =
    normalizeTimeLogFilters(
      filters || {}
    );


  const lastRow =
    sheet.getLastRow();


  if (lastRow < 2) {
    return [];
  }



  let rows = [];



  const email =
    normalizedFilters.email;



  if (email) {


    const emailIndex =
      headers.indexOf(
        "email"
      );



    if (emailIndex === -1) {
      throw new Error(
        "email column missing"
      );
    }



    const emailValues =
      sheet
        .getRange(
          2,
          emailIndex + 1,
          lastRow - 1,
          1
        )
        .getValues();



    emailValues.forEach(function(row,index){


      if (
        String(row[0])
        ===
        String(email)
      ) {


        rows.push(
          sheet
            .getRange(
              index + 2,
              1,
              1,
              headers.length
            )
            .getValues()[0]
        );


      }


    });



  } else {


    rows =
      sheet
        .getRange(
          2,
          1,
          lastRow - 1,
          headers.length
        )
        .getValues();


  }




  return rows

    .map(function(row){

      return normalizeTimeLogRecord(
        rowToObject(
          headers,
          row
        )
      );

    })


    .filter(function(record){

      return matchesTimeLogFilters(
        record,
        normalizedFilters
      );

    })


    .sort(function(a,b){

      return (
        new Date(a.timestamp)
        -
        new Date(b.timestamp)
      );

    });

}



/* =========================
   FIND ONE
========================= */

function findOneTimeLog(workspace_id, filters) {

  const logs =
    findTimeLogs(
      workspace_id,
      filters || {}
    );


  return logs.length
    ? logs[0]
    : null;

}