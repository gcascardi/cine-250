const PROGRESS_SHEET = 'movie_progress';
const REQUIRED_HEADERS = [
  'movie_id',
  'watched_guilherme',
  'watched_gisele',
  'rewatch_guilherme',
  'rewatch_gisele',
  'updated_at',
];

function doGet(e) {
  try {
    authorize_(e.parameter.token);
    const action = e.parameter.action || 'list';

    if (action !== 'list') {
      throw new Error('Ação inválida.');
    }

    return jsonResponse_({ ok: true, data: readRows_() });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    authorize_(payload.token);
    lock.waitLock(10000);

    if (payload.action !== 'upsert' || !Array.isArray(payload.records)) {
      throw new Error('Payload inválido.');
    }

    upsertRows_(payload.records);
    return jsonResponse_({ ok: true, saved: payload.records.length });
  } catch (error) {
    return jsonResponse_({ ok: false, error: error.message });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function migrateFromSupabase() {
  const properties = PropertiesService.getScriptProperties();
  const supabaseUrl = properties.getProperty('SUPABASE_URL');
  const supabaseAnonKey = properties.getProperty('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_ANON_KEY nas propriedades do script.');
  }

  const response = UrlFetchApp.fetch(
    supabaseUrl.replace(/\/$/, '') + '/rest/v1/movie_progress?select=*',
    {
      method: 'get',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: 'Bearer ' + supabaseAnonKey,
      },
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() >= 300) {
    throw new Error('Falha ao ler o Supabase: ' + response.getContentText());
  }

  const records = JSON.parse(response.getContentText());
  replaceRows_(records);
  console.log(records.length + ' registros migrados.');
}

function replaceRows_(records) {
  const sheet = getProgressSheet_();
  const headers = unique_(REQUIRED_HEADERS.concat(
    records.flatMap(function (record) { return Object.keys(record); }),
  ));

  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (records.length) {
    const values = records.map(function (record) {
      return headers.map(function (header) { return serialize_(record[header]); });
    });
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }

  sheet.setFrozenRows(1);
}

function readRows_() {
  const sheet = getProgressSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0].map(String);
  return values.slice(1)
    .filter(function (row) { return row.some(function (value) { return value !== ''; }); })
    .map(function (row) {
      return headers.reduce(function (record, header, index) {
        record[header] = deserialize_(header, row[index]);
        return record;
      }, {});
    });
}

function upsertRows_(records) {
  if (!records.length) return;

  const sheet = getProgressSheet_();
  let values = sheet.getDataRange().getValues();
  let headers = values.length ? values[0].map(String) : REQUIRED_HEADERS.slice();
  const newHeaders = unique_(headers.concat(
    records.flatMap(function (record) { return Object.keys(record); }),
  ));

  if (newHeaders.length !== headers.length) {
    headers = newHeaders;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    values = sheet.getDataRange().getValues();
  }

  if (!values.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    values = [headers];
  }

  const movieIdColumn = headers.indexOf('movie_id');
  const rowByMovieId = new Map();

  values.slice(1).forEach(function (row, index) {
    rowByMovieId.set(String(row[movieIdColumn]), index + 2);
  });

  records.forEach(function (record) {
    if (record.movie_id === undefined || record.movie_id === null) {
      throw new Error('movie_id é obrigatório.');
    }

    const existingRow = rowByMovieId.get(String(record.movie_id));
    const currentRow = existingRow
      ? sheet.getRange(existingRow, 1, 1, headers.length).getValues()[0]
      : [];
    const row = headers.map(function (header, index) {
      return Object.prototype.hasOwnProperty.call(record, header)
        ? serialize_(record[header])
        : (currentRow[index] === undefined ? '' : currentRow[index]);
    });

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, headers.length).setValues([row]);
    } else {
      sheet.appendRow(row);
      rowByMovieId.set(String(record.movie_id), sheet.getLastRow());
    }
  });
}

function getProgressSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(PROGRESS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(PROGRESS_SHEET);
    sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function authorize_(providedToken) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty('API_TOKEN');

  if (expectedToken && providedToken !== expectedToken) {
    throw new Error('Não autorizado.');
  }
}

function serialize_(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value) || typeof value === 'object') return JSON.stringify(value);
  return value;
}

function deserialize_(header, value) {
  if (header === 'movie_id') return Number(value);
  if (header.indexOf('watched_') === 0 || header.indexOf('rewatch_') === 0) {
    return value === true || String(value).toLowerCase() === 'true';
  }
  return value;
}

function unique_(values) {
  return values.filter(function (value, index) { return values.indexOf(value) === index; });
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
