const DATA = window.BOLAO_DATA;
const STORE_KEY = "bolao-copa-2026-picks-v1";

const state = {
  view: localStorage.getItem("bolao-view") || "inicio",
  picks: {},
  selectedPlayer: localStorage.getItem("bolao-player") || "",
  playerCode: localStorage.getItem("bolao-player-code") || "",
  betRound: localStorage.getItem("bolao-bet-round") || "Rodada 1",
  picksRound: localStorage.getItem("bolao-picks-round") || "Rodada 1",
  gamesRound: localStorage.getItem("bolao-games-round") || "Rodada 1",
  loadedBackend: false
};

const $ = (selector) => document.querySelector(selector);
const app = $("#app");
const rounds = [...new Set(DATA.matches.map((m) => m.round))];
const groupStageRounds = ["Rodada 1", "Rodada 2", "Rodada 3"];

const FLAGS = {
  "África do Sul": "🇿🇦",
  "Coreia do Sul": "🇰🇷",
  "México": "🇲🇽",
  "República Tcheca": "🇨🇿",
  "Bósnia": "🇧🇦",
  "Canadá": "🇨🇦",
  "Catar": "🇶🇦",
  "Suíça": "🇨🇭",
  "Brasil": "🇧🇷",
  "Escócia": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Haiti": "🇭🇹",
  "Marrocos": "🇲🇦",
  "Austrália": "🇦🇺",
  "Estados Unidos": "🇺🇸",
  "Paraguai": "🇵🇾",
  "Turquia": "🇹🇷",
  "Alemanha": "🇩🇪",
  "Costa do Marfim": "🇨🇮",
  "Curaçao": "🇨🇼",
  "Equador": "🇪🇨",
  "Holanda": "🇳🇱",
  "Japão": "🇯🇵",
  "Suécia": "🇸🇪",
  "Tunísia": "🇹🇳",
  "Bélgica": "🇧🇪",
  "Egito": "🇪🇬",
  "Irã": "🇮🇷",
  "Nova Zelândia": "🇳🇿",
  "Arábia Saudita": "🇸🇦",
  "Cabo Verde": "🇨🇻",
  "Espanha": "🇪🇸",
  "Uruguai": "🇺🇾",
  "França": "🇫🇷",
  "Iraque": "🇮🇶",
  "Noruega": "🇳🇴",
  "Senegal": "🇸🇳",
  "Argélia": "🇩🇿",
  "Argentina": "🇦🇷",
  "Áustria": "🇦🇹",
  "Jordânia": "🇯🇴",
  "Colômbia": "🇨🇴",
  "RD Congo": "🇨🇩",
  "Portugal": "🇵🇹",
  "Uzbequistão": "🇺🇿",
  "Croácia": "🇭🇷",
  "Gana": "🇬🇭",
  "Inglaterra": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Panamá": "🇵🇦"
};

function init() {
  $("#site-title").textContent = DATA.settings.title;
  mergePicks(DATA.initialPicks || []);
  loadLocalPicks();
  bindMainTabs();
  loadBackendState();
  render();
}

function bindMainTabs() {
  document.querySelectorAll(".main-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      localStorage.setItem("bolao-view", state.view);
      render();
    });
  });
}

function setActiveTab() {
  document.querySelectorAll(".main-tabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.view);
  });
}

function loadLocalPicks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    mergePicks(saved);
  } catch (_) {}
}

function saveLocalPicks() {
  localStorage.setItem(STORE_KEY, JSON.stringify(flattenPicks()));
}

function mergePicks(list) {
  list.forEach((pick) => {
    if (!pick || !pick.playerId || !pick.matchId) return;
    if (!state.picks[pick.playerId]) state.picks[pick.playerId] = {};
    state.picks[pick.playerId][pick.matchId] = {
      g1: Number(pick.g1 ?? pick.goals1),
      g2: Number(pick.g2 ?? pick.goals2),
      submittedAt: pick.submittedAt || pick.updatedAt || new Date().toISOString(),
      updatedAt: pick.updatedAt || pick.submittedAt || ""
    };
  });
}

function flattenPicks() {
  const rows = [];
  Object.entries(state.picks).forEach(([playerId, picks]) => {
    Object.entries(picks).forEach(([matchId, pick]) => {
      rows.push({ playerId, matchId, g1: pick.g1, g2: pick.g2, submittedAt: pick.submittedAt, updatedAt: pick.updatedAt });
    });
  });
  return rows;
}

function loadBackendState() {
  if (!DATA.settings.apiUrl) {
    setBackendStatus("Modo local", "");
    return;
  }

  setBackendStatus("Conectando...", "warning");

  jsonp(`${DATA.settings.apiUrl}?action=state`)
    .then((payload) => {
      if (!payload || payload.ok === false) throw new Error(payload?.error || "Falha ao carregar.");
      mergePicks(payload.picks || []);
      state.loadedBackend = true;
      setBackendStatus("Online", "success");
      render();
    })
    .catch(() => setBackendStatus("Falha no backend", "danger"));
}

function setBackendStatus(text, type) {
  const el = $("#backend-status");
  if (!el) return;
  el.textContent = DATA.settings.apiUrl ? text : "Modo local";
  el.className = `status-pill ${type || ""}`;
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `bolaoCallback_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement("script");
    const sep = url.includes("?") ? "&" : "?";

    window[callbackName] = (payload) => {
      delete window[callbackName];
      script.remove();
      resolve(payload);
    };

    script.onerror = () => {
      delete window[callbackName];
      script.remove();
      reject(new Error("Erro ao carregar dados."));
    };

    script.src = `${url}${sep}callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

function submitBackend(payload) {
  if (!DATA.settings.apiUrl) return Promise.resolve({ ok: true });

  const compact = {
    action: payload.action,
    playerId: payload.playerId,
    playerCode: payload.playerCode,
    round: payload.round,
    picks: payload.picks.map((pick) => ({
      m: pick.matchId,
      a: pick.g1,
      b: pick.g2
    }))
  };

  const url = `${DATA.settings.apiUrl}?action=savePicks&payload=${encodeURIComponent(JSON.stringify(compact))}`;
  return jsonp(url);
}

function render() {
  setActiveTab();

  if (state.view === "oficial") {
    renderOfficial();
    return;
  }

  if (state.view === "palpites") {
    renderPicksArea();
    return;
  }

  renderHome();
}

function renderHome() {
  const potential = DATA.players.length * DATA.settings.entryFee;

  app.innerHTML = `
    <div class="stack">
      <section class="card">
        <div class="title-row">
          <h2>🏆 Ranking dos players</h2>
          <span class="kicker">Desempate: exatos</span>
        </div>
        ${rankingTable(calculateRanking())}
      </section>

      <section class="grid two">
        <div class="card">
          <div class="title-row">
            <h2>📌 Regras</h2>
            <span class="kicker">Pontuação</span>
          </div>
          <ul class="list">
            <li>🎯 Placar exato: <strong>${DATA.settings.exactScorePoints} pontos</strong>.</li>
            <li>✅ Resultado correto: <strong>${DATA.settings.resultPoints} ponto</strong>.</li>
            <li>⏰ Palpites fecham <strong>${DATA.settings.lockHoursBeforeRound}h antes</strong> do primeiro jogo da rodada.</li>
            <li>🥇 Desempate: maior número de placares exatos.</li>
          </ul>
        </div>

        <div class="card">
          <div class="title-row">
            <h2>💰 Premiação</h2>
            <span class="kicker">Total: ${money(potential)}</span>
          </div>
          <ul class="list">
            <li>🥇 1º lugar: <strong>R$ 100,00</strong>.</li>
            <li>🥈 2º lugar: <strong>R$ 60,00</strong>.</li>
            <li>🥉 3º lugar: <strong>R$ 40,00</strong>.</li>
            <li>🎟️ 4º lugar: <strong>R$ 20,00</strong>, inscrição de volta.</li>
          </ul>
        </div>
      </section>

      <section class="card">
        <div class="title-row">
          <h2>⏳ Fechamento</h2>
          <span class="kicker">Por rodada</span>
        </div>
        <div class="deadline-list">
          ${rounds.slice(0, 4).map(roundDeadlineCard).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderOfficial() {
  app.innerHTML = `
    <div class="stack">
      ${renderGroupsSection()}
      ${renderGamesSection()}
    </div>
  `;
  bindEvents();
}

function renderPicksArea() {
  app.innerHTML = `
    <div class="stack">
      ${renderBetSection()}
      ${renderPicksSection()}
    </div>
  `;
  bindEvents();
}

function renderGroupsSection() {
  const standings = calculateGroupStandings();

  return `
    <section>
      <div class="title-row">
        <h2>🌎 Grupos</h2>
        <span class="kicker">Oficial</span>
      </div>
      <div class="group-grid">
        ${DATA.groups.map((group) => groupCard(group, standings[group.id] || [])).join("")}
      </div>
    </section>
  `;
}

function groupCard(group, rows) {
  return `
    <div class="card group-card">
      <div class="group-head">
        <h3>${group.name}</h3>
      </div>
      <div class="group-teams">
        ${rows.map((row, index) => `
          <div class="group-team">
            <span>${index + 1}. ${country(row.team)}</span>
            <span>${row.pts} pts</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderGamesSection() {
  const round = rounds.includes(state.gamesRound) ? state.gamesRound : rounds[0];
  const matches = DATA.matches.filter((m) => m.round === round);

  return `
    <section class="card">
      <div class="title-row">
        <h2>📅 Resultados oficiais</h2>
        <span class="kicker">Jogos</span>
      </div>

      <div class="toolbar">
        <div class="field">
          <label>Rodada</label>
          <select id="gamesRoundSelect">
            ${rounds.map((r) => `<option value="${r}" ${r === round ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="games-list">
        ${matches.map((m) => `
          <div class="game-card">
            <div class="game-top">
              <span>${m.group} · Jogo ${m.number}</span>
              <span>${formatDate(m.date)} · ${m.time}</span>
            </div>
            <div class="game-line">
              <span>${country(m.team1)}</span>
              <span>${matchResultInline(m)}</span>
              <span>${country(m.team2)}</span>
            </div>
            <div class="muted" style="font-size:11px;margin-top:5px">${m.venue}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderBetSection() {
  const round = rounds.includes(state.betRound) ? state.betRound : rounds[0];
  const playerId = state.selectedPlayer;
  const locked = isRoundLocked(round);
  const matches = DATA.matches.filter((m) => m.round === round);

  return `
    <section class="card">
      <div class="title-row">
        <h2>✍️ Enviar palpites</h2>
        <span class="kicker">Pode editar até fechar</span>
      </div>

      <div class="toolbar">
        <div class="field">
          <label>Jogador</label>
          <select id="playerSelect">
            <option value="">Selecione</option>
            ${DATA.players.map((p) => `<option value="${p.id}" ${p.id === playerId ? "selected" : ""}>${p.name}</option>`).join("")}
          </select>
        </div>

        <div class="field">
          <label>Senha/código</label>
          <input id="playerCodeInput" type="password" value="${state.playerCode}" autocomplete="off" placeholder="Código do jogador">
        </div>

        <div class="field">
          <label>Rodada</label>
          <select id="betRoundSelect">
            ${rounds.map((r) => `<option value="${r}" ${r === round ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>

        <button class="btn" id="savePicks" ${locked ? "disabled" : ""}>Salvar</button>
      </div>

      ${locked
        ? `<div class="notice danger">🔒 ${round} fechada. Prazo: ${formatDateTime(roundDeadline(round))}.</div>`
        : `<div class="notice">⏰ ${round} fecha em ${formatDateTime(roundDeadline(round))}. O último salvamento sobrescreve o anterior.</div>`
      }

      <div class="bet-list">
        ${matches.map((m) => betRow(m, playerId, locked)).join("")}
      </div>
    </section>
  `;
}

function betRow(match, playerId, locked) {
  const pick = state.picks[playerId]?.[match.id] || {};

  return `
    <div class="bet-row">
      <div class="bet-meta">
        <span>${match.group} · Jogo ${match.number}</span>
        <span>${formatDate(match.date)} · ${match.time}</span>
      </div>

      <div class="bet-line">
        <span class="team">${country(match.team1)}</span>
        <input type="number" min="0" max="99" data-match="${match.id}" data-side="g1" value="${pick.g1 ?? ""}" ${locked ? "disabled" : ""}>
        <span class="x">X</span>
        <input type="number" min="0" max="99" data-match="${match.id}" data-side="g2" value="${pick.g2 ?? ""}" ${locked ? "disabled" : ""}>
        <span class="team">${country(match.team2)}</span>
      </div>
    </div>
  `;
}

function renderPicksSection() {
  const round = rounds.includes(state.picksRound) ? state.picksRound : rounds[0];
  const matches = DATA.matches.filter((m) => m.round === round);
  const shouldHide = !DATA.settings.showPicksBeforeDeadline && !isRoundLocked(round);

  return `
    <section class="card">
      <div class="title-row">
        <h2>👀 Palpites enviados</h2>
        <span class="kicker">Por rodada</span>
      </div>

      <div class="toolbar">
        <div class="field">
          <label>Rodada</label>
          <select id="picksRoundSelect">
            ${rounds.map((r) => `<option value="${r}" ${r === round ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="picks-list">
        ${matches.map((match) => `
          <div class="pick-card">
            <div class="pick-top">
              <span>${match.group} · Jogo ${match.number}</span>
              <span>${formatDate(match.date)} · ${match.time}</span>
            </div>
            <div class="pick-match-line">
              <span>${country(match.team1)}</span>
              <span>x</span>
              <span>${country(match.team2)}</span>
            </div>
            <div class="player-picks">
              ${DATA.players.map((player) => {
                const pick = state.picks[player.id]?.[match.id];
                return `
                  <div class="player-pick">
                    <span class="player-pick-name">${player.name}</span>
                    <span class="player-pick-score">${shouldHide ? "Oculto" : formatPick(pick)}</span>
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function bindEvents() {
  const playerSelect = $("#playerSelect");
  const playerCodeInput = $("#playerCodeInput");
  const betRoundSelect = $("#betRoundSelect");
  const picksRoundSelect = $("#picksRoundSelect");
  const gamesRoundSelect = $("#gamesRoundSelect");
  const saveButton = $("#savePicks");

  if (playerSelect) {
    playerSelect.addEventListener("change", (e) => {
      state.selectedPlayer = e.target.value;
      localStorage.setItem("bolao-player", state.selectedPlayer);
      render();
    });
  }

  if (playerCodeInput) {
    playerCodeInput.addEventListener("input", (e) => {
      state.playerCode = e.target.value.trim();
      localStorage.setItem("bolao-player-code", state.playerCode);
    });
  }

  if (betRoundSelect) {
    betRoundSelect.addEventListener("change", (e) => {
      state.betRound = e.target.value;
      localStorage.setItem("bolao-bet-round", state.betRound);
      render();
    });
  }

  if (picksRoundSelect) {
    picksRoundSelect.addEventListener("change", (e) => {
      state.picksRound = e.target.value;
      localStorage.setItem("bolao-picks-round", state.picksRound);
      render();
    });
  }

  if (gamesRoundSelect) {
    gamesRoundSelect.addEventListener("change", (e) => {
      state.gamesRound = e.target.value;
      localStorage.setItem("bolao-games-round", state.gamesRound);
      render();
    });
  }

  if (saveButton) {
    saveButton.addEventListener("click", () => saveRoundPicks(state.betRound));
  }
}

function saveRoundPicks(round) {
  if (!state.selectedPlayer) {
    alert("Selecione o jogador antes de salvar.");
    return;
  }

  if (!state.playerCode) {
    alert("Informe a senha/código do jogador.");
    return;
  }

  if (isRoundLocked(round)) {
    alert("Rodada fechada para palpites.");
    return;
  }

  const matches = DATA.matches.filter((m) => m.round === round);
  const newPicks = [];

  for (const match of matches) {
    const g1 = document.querySelector(`input[data-match="${match.id}"][data-side="g1"]`)?.value || "";
    const g2 = document.querySelector(`input[data-match="${match.id}"][data-side="g2"]`)?.value || "";

    if (g1 === "" || g2 === "") {
      alert("Preencha todos os jogos da rodada antes de salvar.");
      return;
    }

    newPicks.push({
      playerId: state.selectedPlayer,
      matchId: match.id,
      g1: Number(g1),
      g2: Number(g2),
      submittedAt: new Date().toISOString()
    });
  }

  submitBackend({
    action: "savePicks",
    playerId: state.selectedPlayer,
    playerCode: state.playerCode,
    round,
    picks: newPicks
  }).then((response) => {
    if (!response || response.ok === false) {
      throw new Error(response?.error || "Não foi possível salvar.");
    }

    mergePicks(response.picks || newPicks);
    saveLocalPicks();
    alert("Palpites salvos.");
    render();
  }).catch((error) => {
    alert(error.message || "Erro ao salvar os palpites.");
  });
}

function rankingTable(ranking) {
  return `
    <div class="table-wrap rank-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th class="center">Pts</th>
            <th class="center">Exatos</th>
            <th class="center">Resultados</th>
          </tr>
        </thead>
        <tbody>
          ${ranking.map((row, index) => `
            <tr>
              <td class="strong">${index + 1}</td>
              <td>${row.name}</td>
              <td class="center strong">${row.points}</td>
              <td class="center">${row.exacts}</td>
              <td class="center">${row.results}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function calculateRanking() {
  return DATA.players.map((player) => {
    let points = 0;
    let exacts = 0;
    let results = 0;

    DATA.matches.forEach((match) => {
      const scored = scorePick(state.picks[player.id]?.[match.id], match);
      points += scored.points;
      exacts += scored.exact ? 1 : 0;
      results += scored.result ? 1 : 0;
    });

    return { id: player.id, name: player.name, points, exacts, results };
  }).sort((a, b) => b.points - a.points || b.exacts - a.exacts || a.name.localeCompare(b.name));
}

function scorePick(pick, match) {
  if (!pick || match.score1 === null || match.score2 === null) {
    return { points: 0, exact: false, result: false };
  }

  if (pick.g1 === match.score1 && pick.g2 === match.score2) {
    return { points: DATA.settings.exactScorePoints, exact: true, result: false };
  }

  if (outcome(pick.g1, pick.g2) === outcome(match.score1, match.score2)) {
    return { points: DATA.settings.resultPoints, exact: false, result: true };
  }

  return { points: 0, exact: false, result: false };
}

function outcome(a, b) {
  if (a > b) return 1;
  if (a < b) return -1;
  return 0;
}

function calculateGroupStandings() {
  const standings = {};

  DATA.groups.forEach((group) => {
    standings[group.id] = group.teams.map((team) => ({
      team,
      pts: 0,
      j: 0,
      v: 0,
      e: 0,
      d: 0,
      gp: 0,
      gc: 0,
      sg: 0
    }));
  });

  DATA.matches
    .filter((m) => groupStageRounds.includes(m.round) && m.score1 !== null && m.score2 !== null)
    .forEach((m) => {
      const groupId = String(m.group || "").replace("Grupo ", "");
      const table = standings[groupId];
      if (!table) return;

      const a = table.find((r) => r.team === m.team1);
      const b = table.find((r) => r.team === m.team2);
      if (!a || !b) return;

      a.j++;
      b.j++;
      a.gp += m.score1;
      a.gc += m.score2;
      a.sg = a.gp - a.gc;
      b.gp += m.score2;
      b.gc += m.score1;
      b.sg = b.gp - b.gc;

      if (m.score1 > m.score2) {
        a.v++;
        b.d++;
        a.pts += 3;
      } else if (m.score1 < m.score2) {
        b.v++;
        a.d++;
        b.pts += 3;
      } else {
        a.e++;
        b.e++;
        a.pts++;
        b.pts++;
      }
    });

  Object.keys(standings).forEach((key) => {
    standings[key].sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp || a.team.localeCompare(b.team));
  });

  return standings;
}

function roundDeadline(round) {
  const first = DATA.matches
    .filter((m) => m.round === round)
    .sort((a, b) => makeDate(a) - makeDate(b))[0];

  const date = makeDate(first);
  date.setHours(date.getHours() - DATA.settings.lockHoursBeforeRound);
  return date;
}

function isRoundLocked(round) {
  return new Date() >= roundDeadline(round);
}

function makeDate(match) {
  return new Date(`${match.date}T${match.time}:00`);
}

function roundDeadlineCard(round) {
  const locked = isRoundLocked(round);
  return `
    <div class="deadline-box ${locked ? "danger" : ""}">
      <strong>${locked ? "🔒" : "⏰"} ${round}</strong><br>
      ${locked ? "Fechada em" : "Fecha em"} ${formatDateTime(roundDeadline(round))}
    </div>
  `;
}

function kpi(label, value) {
  return `
    <div class="card">
      <div class="kpi-label">${label}</div>
      <div class="kpi-value">${value}</div>
    </div>
  `;
}

function country(name) {
  const flag = FLAGS[name] || "🏳️";
  return `<span class="country"><span class="flag">${flag}</span><span>${name}</span></span>`;
}

function formatPick(pick) {
  if (!pick || Number.isNaN(pick.g1) || Number.isNaN(pick.g2)) return "-";
  return `${pick.g1} x ${pick.g2}`;
}

function matchResultInline(match) {
  if (match.score1 === null || match.score2 === null) return "x";
  return `${match.score1} x ${match.score2}`;
}

function formatResult(match) {
  if (match.score1 === null || match.score2 === null) return "-";
  return `${match.score1} x ${match.score2}`;
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(date) {
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

init();
