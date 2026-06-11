const SHEETS = {
  JOGADORES: 'JOGADORES',
  JOGOS: 'JOGOS',
  PALPITES: 'PALPITES',
  LOG: 'LOG'
};

function doGet(e) {
  try {
    const action = String(e.parameter.action || 'state');

    if (action === 'state') {
      return jsonp_(e, {
        ok: true,
        picks: readPicks_(),
        matches: readMatches_(),
        stats: readStats_()
      });
    }

    if (action === 'savePicks') {
      const payload = JSON.parse(String(e.parameter.payload || '{}'));
      const saved = savePicks_(payload);

      return jsonp_(e, {
        ok: true,
        picks: saved
      });
    }

    return jsonp_(e, {
      ok: false,
      error: 'Ação inválida.'
    });
  } catch (err) {
    log_('ERRO', String(err));

    return jsonp_(e, {
      ok: false,
      error: String(err.message || err)
    });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const saved = savePicks_(payload);

    return json_({
      ok: true,
      picks: saved
    });
  } catch (err) {
    log_('ERRO', String(err));

    return json_({
      ok: false,
      error: String(err.message || err)
    });
  }
}

function savePicks_(payload) {
  const playerId = String(payload.playerId || '').trim();
  const playerCode = String(payload.playerCode || '').trim();
  const round = String(payload.round || '').trim();
  const picks = Array.isArray(payload.picks) ? payload.picks : [];

  if (!playerId || !playerCode || !round || !picks.length) {
    throw new Error('Jogador, código, rodada e palpites são obrigatórios.');
  }

  validatePlayer_(playerId, playerCode);

  if (isRoundLocked_(round)) {
    throw new Error(`${round} já está fechada para edição.`);
  }

  const sheet = getSheet_(SHEETS.PALPITES);
  ensurePicksHeader_(sheet);

  const values = sheet.getDataRange().getValues();
  const index = new Map();

  for (let i = 1; i < values.length; i++) {
    const key = `${values[i][0]}||${values[i][1]}`;
    index.set(key, i + 1);
  }

  const now = new Date();
  const saved = [];

  picks.forEach((pick) => {
    const matchId = String(pick.matchId || pick.m || '').trim();
    const g1 = Number(pick.g1 ?? pick.a);
    const g2 = Number(pick.g2 ?? pick.b);

    if (!matchId || !Number.isInteger(g1) || !Number.isInteger(g2) || g1 < 0 || g2 < 0) {
      return;
    }

    const key = `${playerId}||${matchId}`;
    const existingRow = index.get(key);
    let createdAt = now;

    if (existingRow) {
      const oldCreatedAt = sheet.getRange(existingRow, 6).getValue();
      createdAt = oldCreatedAt || now;
    }

    const row = [
      playerId,
      matchId,
      g1,
      g2,
      round,
      createdAt,
      now
    ];

    if (existingRow) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    saved.push({
      playerId,
      matchId,
      g1,
      g2,
      round,
      submittedAt: toIso_(createdAt),
      updatedAt: now.toISOString()
    });
  });

  log_('SALVAR_PALPITES', `${playerId} - ${round} - ${saved.length} jogos - ${now.toISOString()}`);

  return saved;
}

function readPicks_() {
  const sheet = getSheet_(SHEETS.PALPITES);
  ensurePicksHeader_(sheet);

  const values = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < values.length; i++) {
    if (!values[i][0] || !values[i][1]) {
      continue;
    }

    rows.push({
      playerId: String(values[i][0]),
      matchId: String(values[i][1]),
      g1: Number(values[i][2]),
      g2: Number(values[i][3]),
      round: String(values[i][4] || ''),
      submittedAt: toIso_(values[i][5]),
      updatedAt: toIso_(values[i][6] || values[i][5])
    });
  }

  return rows;
}

function readMatches_() {
  const sheet = getSheet_(SHEETS.JOGOS);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((item) => String(item || '').trim().toLowerCase());
  const idCol = findHeader_(headers, ['id_jogo', 'matchid', 'id']);
  const score1Col = findHeader_(headers, ['gols_mandante', 'score1', 'g1']);
  const score2Col = findHeader_(headers, ['gols_visitante', 'score2', 'g2']);
  const statusCol = findHeader_(headers, ['status']);

  const rows = [];

  for (let i = 1; i < values.length; i++) {
    if (!values[i][idCol]) {
      continue;
    }

    rows.push({
      id: String(values[i][idCol]),
      score1: values[i][score1Col] === '' ? null : values[i][score1Col],
      score2: values[i][score2Col] === '' ? null : values[i][score2Col],
      status: statusCol === -1 ? '' : String(values[i][statusCol] || '')
    });
  }

  return rows;
}

function readStats_() {
  return {
    scorers: readStatSheet_('ARTILHARIA'),
    assists: readStatSheet_('ASSISTENCIAS'),
    yellowCards: readStatSheet_('CARTOES_AMARELOS'),
    redCards: readStatSheet_('CARTOES_VERMELHOS')
  };
}

function readStatSheet_(sheetName) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    return [];
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((item) => String(item || '').trim().toLowerCase());
  const playerCol = findHeader_(headers, ['jogador', 'player', 'nome']);
  const teamCol = findHeader_(headers, ['time', 'team', 'pais', 'país']);
  const totalCol = findHeader_(headers, ['total', 'qtd', 'quantidade', 'gols', 'assistencias', 'assistências', 'cartoes', 'cartões']);

  const rows = [];

  for (let i = 1; i < values.length; i++) {
    if (!values[i][playerCol]) {
      continue;
    }

    rows.push({
      player: String(values[i][playerCol]),
      team: teamCol === -1 ? '' : String(values[i][teamCol] || ''),
      total: totalCol === -1 ? 0 : Number(values[i][totalCol] || 0)
    });
  }

  rows.sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));

  return rows;
}

function validatePlayer_(playerId, playerCode) {
  const sheet = getSheet_(SHEETS.JOGADORES);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Aba JOGADORES vazia.');
  }

  const headers = values[0].map((item) => String(item || '').trim().toLowerCase());
  const idCol = findHeader_(headers, ['id_jogador', 'playerid', 'id']);
  const codeCol = findHeader_(headers, ['codigo', 'código', 'code', 'senha']);
  const activeCol = findHeader_(headers, ['ativo', 'active']);

  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][idCol] || '').trim();
    const code = String(values[i][codeCol] || '').trim();
    const active = activeCol === -1 ? true : values[i][activeCol];

    if (id === playerId) {
      if (active === false || String(active).toLowerCase() === 'false') {
        throw new Error('Jogador inativo.');
      }

      if (code !== playerCode) {
        throw new Error('Código do jogador inválido.');
      }

      return true;
    }
  }

  throw new Error('Jogador não encontrado.');
}

function isRoundLocked_(round) {
  const sheet = getSheet_(SHEETS.JOGOS);
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return false;
  }

  const headers = values[0].map((item) => String(item || '').trim().toLowerCase());
  const roundCol = findHeader_(headers, ['rodada', 'round']);
  const dateCol = findHeader_(headers, ['data', 'date']);
  const timeCol = findHeader_(headers, ['hora', 'time']);

  let firstDate = null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][roundCol] || '').trim() !== round) {
      continue;
    }

    const matchDate = buildDate_(values[i][dateCol], values[i][timeCol]);

    if (!matchDate) {
      continue;
    }

    if (!firstDate || matchDate < firstDate) {
      firstDate = matchDate;
    }
  }

  if (!firstDate) {
    return false;
  }

  firstDate.setHours(firstDate.getHours() - 2);

  return new Date() >= firstDate;
}

function buildDate_(dateValue, timeValue) {
  if (!dateValue) {
    return null;
  }

  const date = dateValue instanceof Date ? new Date(dateValue) : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const timeText = timeValue instanceof Date
    ? Utilities.formatDate(timeValue, Session.getScriptTimeZone(), 'HH:mm')
    : String(timeValue || '00:00');

  const parts = timeText.split(':');
  const hour = Number(parts[0] || 0);
  const minute = Number(parts[1] || 0);

  date.setHours(hour, minute, 0, 0);

  return date;
}

function getSheet_(name) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  return sheet;
}

function ensurePicksHeader_(sheet) {
  const header = sheet.getRange(1, 1, 1, 7).getValues()[0];
  const hasNewHeader = header[0] === 'playerId' && header[1] === 'matchId' && header[5] === 'createdAt' && header[6] === 'updatedAt';

  if (hasNewHeader) {
    return;
  }

  const oldValues = sheet.getDataRange().getValues();

  sheet.clear();
  sheet.getRange(1, 1, 1, 7).setValues([[
    'playerId',
    'matchId',
    'g1',
    'g2',
    'round',
    'createdAt',
    'updatedAt'
  ]]);
  sheet.setFrozenRows(1);

  const rows = [];

  for (let i = 1; i < oldValues.length; i++) {
    if (!oldValues[i][0] || !oldValues[i][1]) {
      continue;
    }

    rows.push([
      oldValues[i][0],
      oldValues[i][1],
      oldValues[i][2],
      oldValues[i][3],
      oldValues[i][4],
      oldValues[i][5] || '',
      oldValues[i][6] || oldValues[i][5] || ''
    ]);
  }

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }
}

function findHeader_(headers, options) {
  for (let i = 0; i < options.length; i++) {
    const index = headers.indexOf(options[i]);

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}

function log_(action, details) {
  const sheet = getSheet_(SHEETS.LOG);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 3).setValues([[
      'data',
      'acao',
      'detalhes'
    ]]);
    sheet.setFrozenRows(1);
  }

  sheet.appendRow([
    new Date(),
    action,
    details
  ]);
}

function toIso_(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value || '');
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(e, payload) {
  const callback = String(e.parameter.callback || '').replace(/[^a-zA-Z0-9_.$]/g, '');

  if (!callback) {
    return json_(payload);
  }

  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(payload)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
