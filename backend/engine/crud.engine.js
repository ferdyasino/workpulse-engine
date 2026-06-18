function insert(dbRef, table, data, schema = null) {
  data = normalizeRecord(data);
  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(table.sheet);

  if (!sheet) throw new Error(`Sheet not found: ${table.sheet}`);

  const headers = schema || getHeaders(sheet);

  // SAFE: only map known headers (prevents schema pollution)
  const row = headers.map(h => {
    const val = data?.[h];

    // preserve falsy-but-valid values (0, false)
    return val === undefined ? "" : val;
  });

  sheet.appendRow(row);

  return { success: true };
}



function find(dbRef, table, filters = {}) {
  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(table.sheet);
  if (!sheet) throw new Error(`Sheet not found: ${table.sheet}`);

  const values = sheet.getDataRange().getValues();
  const headers = values.shift();

  return values
    .map(row => rowToObject(headers, row))
    .filter(record => {
      return Object.entries(filters).every(([k, v]) => record[k] === v);
    });
}



function findOne(dbRef, table, filters = {}) {
  return find(dbRef, table, filters)[0] || null;
}



function update(dbRef, table, id, updates) {
  updates = normalizeRecord(updates);

  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(table.sheet);

  if (!sheet) throw new Error(`Sheet not found: ${table.sheet}`);

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const pkIndex = headers.indexOf(table.pk);

  if (pkIndex === -1) {
    throw new Error(`PK "${table.pk}" not found in ${table.sheet}`);
  }

  for (let r = 1; r < values.length; r++) {
    if (values[r][pkIndex] !== id) continue;

    let updated = false;

    Object.keys(updates).forEach(key => {
      const colIndex = headers.indexOf(key);

      if (colIndex !== -1) {
        values[r][colIndex] = updates[key];
        updated = true;
      }
    });

    // only write if something changed (reduces quota usage)
    if (updated) {
      sheet.getRange(r + 1, 1, 1, headers.length)
        .setValues([values[r]]);
    }

    return true;
  }

  return false;
}


function remove(dbRef, table, id) {
  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(table.sheet);

  if (!sheet) throw new Error(`Sheet not found: ${table.sheet}`);

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const pkIndex = headers.indexOf(table.pk);

  if (pkIndex === -1) {
    throw new Error(`PK "${table.pk}" not found in ${table.sheet}`);
  }

  for (let r = 1; r < values.length; r++) {
    if (values[r][pkIndex] === id) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }

  return false;
}