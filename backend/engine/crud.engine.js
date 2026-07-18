function insert(dbRef, table, data, schema = null) {
  data = normalizeRecord(data);

  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(table.sheet);

  if (!sheet) {
    throw new Error(`Sheet not found: ${table.sheet}`);
  }

  const headers = schema || getHeaders(sheet);

  const row = headers.map((h) => {
    const value = serializeSheetValue(data?.[h]);
    return value === undefined ? "" : value;
  });


  const nextRow = sheet.getLastRow() + 1;

  sheet
    .getRange(nextRow, 1, 1, headers.length)
    .setValues([row]);


  return {
    success: true,
  };
}


function find(dbRef, table, filters = {}, options = {}) {

  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(table.sheet);

  if (!sheet) {
    throw new Error(`Sheet not found: ${table.sheet}`);
  }


  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();


  if (lastRow < 2) {
    return [];
  }


  const values = sheet
    .getRange(
      1,
      1,
      lastRow,
      lastColumn
    )
    .getDisplayValues();


  const headers = values.shift();


  let records = values
    .map((row) => rowToObject(headers, row))
    .filter((record) => {

      return Object.entries(filters)
        .every(([key, value]) => {

          return String(record[key]) === String(value);

        });

    });


  if (options.sortBy) {

    const field = options.sortBy;

    records.sort((a,b)=>{

      return new Date(a[field]) -
             new Date(b[field]);

    });

  }


  if (options.limit) {
    records = records.slice(
      0,
      options.limit
    );
  }


  return records;
}


function findOne(dbRef, table, filters = {}) {

  const result = find(
    dbRef,
    table,
    filters,
    {
      limit:1,
    }
  );


  return result[0] || null;
}


function update(dbRef, table, id, updates) {

  updates = normalizeRecord(updates);

  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(table.sheet);


  if (!sheet) {
    throw new Error(`Sheet not found: ${table.sheet}`);
  }


  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();


  if(lastRow < 2){
    return false;
  }


  const range = sheet.getRange(
    1,
    1,
    lastRow,
    lastColumn
  );


  const values = range.getValues();

  const headers = values[0];


  const pkIndex = headers.indexOf(table.pk);


  if(pkIndex === -1){
    throw new Error(
      `PK "${table.pk}" not found in ${table.sheet}`
    );
  }


  for(let r = 1; r < values.length; r++){

    if(values[r][pkIndex] !== id){
      continue;
    }


    let changed = false;


    Object.keys(updates)
      .forEach((key)=>{

        const colIndex = headers.indexOf(key);


        if(colIndex !== -1){

          let value = updates[key];


          if(Array.isArray(value)){
            value = JSON.stringify(value);
          }


          if(values[r][colIndex] !== value){

            values[r][colIndex] = value;
            changed = true;

          }

        }

      });


    if(changed){

      sheet
        .getRange(
          r + 1,
          1,
          1,
          headers.length
        )
        .setValues([
          values[r]
        ]);

    }


    return true;

  }


  return false;
}


function remove(dbRef, table, id) {

  const db = resolveDb(dbRef);
  const sheet = db.getSheetByName(table.sheet);


  if (!sheet) {
    throw new Error(`Sheet not found: ${table.sheet}`);
  }


  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();


  if(lastRow < 2){
    return false;
  }


  const values = sheet
    .getRange(
      1,
      1,
      lastRow,
      lastColumn
    )
    .getValues();


  const headers = values[0];


  const pkIndex = headers.indexOf(table.pk);


  if(pkIndex === -1){
    throw new Error(
      `PK "${table.pk}" not found in ${table.sheet}`
    );
  }


  for(let r = 1; r < values.length; r++){

    if(values[r][pkIndex] === id){

      sheet.deleteRow(r + 1);

      return true;
    }

  }


  return false;
}