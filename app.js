const DATA = window.BOLAO_DATA;
const STORE_KEY = "bolao-copa-2026-picks-v1";
const state = {
  page: "inicio",
  picks: {},
  selectedPlayer: localStorage.getItem("bolao-player") || "",
  selectedRound: "Rodada 1",
  loadedBackend: false
};

const $ = (selector) => document.querySelector(selector);
const app = $("#app");
const rounds = [...new Set(DATA.matches.map((m) => m.round))];
const groupStageRounds = ["Rodada 1", "Rodada 2", "Rodada 3"];

function init() {
  $("#site-title").textContent = DATA.settings.title;
  mergePicks(DATA.initialPicks || []);
  loadLocalPicks();
  bindNavigation();
  loadBackendState();
  render();
}

function bindNavigation() {
  document.querySelectorAll(".tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.page = button.dataset.page;
      document.querySelectorAll(".tabs button").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });
}

function loadLocalPicks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    mergePicks(saved);
  } catch (_) {}
}

function saveLocalPicks() {
  const flat = flattenPicks();
  localStorage.setItem(STORE_KEY, JSON.stringify(flat));
}

function mergePicks(list) {
  list.forEach((pick) => {
    if (!pick || !pick.playerId || !pick.matchId) return;
    if (!state.picks[pick.playerId]) state.picks[pick.playerId] = {};
    state.picks[pick.playerId][pick.matchId] = {
      g1: Number(pick.g1 ?? pick.goals1),
      g2: Number(pick.g2 ?? pick.goals2),
      submittedAt: pick.submittedAt || new Date().toISOString()
    };
  });
}

function flattenPicks() {
  const rows = [];
  Object.entries(state.picks).forEach(([playerId, picks]) => {
    Object.entries(picks).forEach(([matchId, pick]) => {
      rows.push({ playerId, matchId, g1: pick.g1, g2: pick.g2, submittedAt: pick.submittedAt });
    });
  });
  return rows;
}

function loadBackendState() {
  if (!DATA.settings.apiUrl) return;
  setBackendStatus("Conectando...", "warning");
  jsonp(`${DATA.settings.apiUrl}?action=state`).then((payload) => {
    mergePicks(payload.picks || []);
    state.loadedBackend = true;
    setBackendStatus("Online", "success");
    render();
  }).catch(() => {
    setBackendStatus("Falha no backend", "danger");
  });
}

function setBackendStatus(text, type) {
  const el = $("#backend-status");
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
  if (!DATA.settings.apiUrl) return Promise.resolve();
  return fetch(DATA.settings.apiUrl, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify(payload)
  });
}

function render() {
  const pages = {
    inicio: renderHome,
    palpitar: renderBetPage,
    ranking: renderRankingPage,
    palpites: renderPicksPage,
    jogos: renderGamesPage,
    grupos: renderGroupsPage,
    regras: renderRulesPage,
    premiacao: renderPrizePage
  };
  pages[state.page]();
}

function renderHome() {
  const paid = DATA.players.filter((p) => p.paid).length;
  const ranking = calculateRanking();
  app.innerHTML = `
    <section class="grid cards">
      ${kpi("Jogadores", DATA.players.length)}
      ${kpi("Jogos", DATA.matches.length)}
      ${kpi("Valor", money(DATA.settings.entryFee))}
      ${kpi("Pagos", `${paid}/${DATA.players.length}`)}
    </section>
    <section class="grid two" style="margin-top:16px">
      <div class="card">
        <h2>Próximos fechamentos</h2>
        ${rounds.slice(0, 3).map(roundDeadlineCard).join("")}
      </div>
      <div class="card">
        <h2>Ranking parcial</h2>
        ${rankingTable(ranking.slice(0, 8))}
      </div>
    </section>
  `;
}

function renderBetPage() {
  const round = state.selectedRound || rounds[0];
  const playerId = state.selectedPlayer;
  const locked = isRoundLocked(round);
  const matches = DATA.matches.filter((m) => m.round === round);
  app.innerHTML = `
    <section class="card">
      <h2>Enviar palpites</h2>
      <div class="toolbar">
        <div class="field">
          <label>Jogador</label>
          <select id="playerSelect">
            <option value="">Selecione</option>
            ${DATA.players.map((p) => `<option value="${p.id}" ${p.id === playerId ? "selected" : ""}>${p.name}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>Rodada</label>
          <select id="roundSelect">
            ${rounds.map((r) => `<option value="${r}" ${r === round ? "selected" : ""}>${r}</option>`).join("")}
          </select>
        </div>
        <button class="btn" id="savePicks" ${locked ? "disabled" : ""}>Salvar palpites</button>
      </div>
      ${locked ? `<div class="notice danger">${round} fechada. O prazo era ${formatDateTime(roundDeadline(round))}.</div>` : `<div class="notice">${round} fecha em ${formatDateTime(roundDeadline(round))}. Prazo: 2h antes do primeiro jogo da rodada.</div>`}
      ${betTable(matches, playerId, locked)}
    </section>
  `;
  $("#playerSelect").addEventListener("change", (e) => {
    state.selectedPlayer = e.target.value;
    localStorage.setItem("bolao-player", state.selectedPlayer);
    renderBetPage();
  });
  $("#roundSelect").addEventListener("change", (e) => {
    state.selectedRound = e.target.value;
    renderBetPage();
  });
  $("#savePicks").addEventListener("click", () => saveRoundPicks(round));
}

function betTable(matches, playerId, locked) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Jogo</th><th>Data</th><th>Local</th><th class="center">Palpite</th></tr></thead>
        <tbody>
          ${matches.map((m) => {
            const pick = state.picks[playerId]?.[m.id] || {};
            return `<tr>
              <td>${matchTitle(m)}</td>
              <td>${formatDate(m.date)} às ${m.time}</td>
              <td>${m.venue}</td>
              <td class="center"><span class="score-cell">
                <input type="number" min="0" max="99" data-match="${m.id}" data-side="g1" value="${pick.g1 ?? ""}" ${locked ? "disabled" : ""}>
                <span>X</span>
                <input type="number" min="0" max="99" data-match="${m.id}" data-side="g2" value="${pick.g2 ?? ""}" ${locked ? "disabled" : ""}>
              </span></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function saveRoundPicks(round) {
  if (!state.selectedPlayer) {
    alert("Selecione o jogador antes de salvar.");
    return;
  }
  if (isRoundLocked(round)) {
    alert("Rodada fechada para palpites.");
    return;
  }
  const matches = DATA.matches.filter((m) => m.round === round);
  const newPicks = [];
  for (const match of matches) {
    const g1 = $(`input[data-match="${match.id}"][data-side="g1"]`).value;
    const g2 = $(`input[data-match="${match.id}"][data-side="g2"]`).value;
    if (g1 === "" || g2 === "") {
      alert("Preencha todos os jogos da rodada antes de salvar.");
      return;
    }
    newPicks.push({ playerId: state.selectedPlayer, matchId: match.id, g1: Number(g1), g2: Number(g2), submittedAt: new Date().toISOString() });
  }
  mergePicks(newPicks);
  saveLocalPicks();
  submitBackend({ action: "savePicks", playerId: state.selectedPlayer, round, picks: newPicks }).finally(() => {
    alert("Palpites salvos.");
    renderBetPage();
  });
}

function renderRankingPage() {
  app.innerHTML = `<section class="card"><h2>Ranking dos jogadores</h2>${rankingTable(calculateRanking())}</section>`;
}

function rankingTable(ranking) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>Posição</th><th>Jogador</th><th class="center">Pontos</th><th class="center">Placares exatos</th><th class="center">Resultados</th></tr></thead>
    <tbody>${ranking.map((row, index) => `<tr><td class="strong">${index + 1}º</td><td>${row.name}</td><td class="center strong">${row.points}</td><td class="center">${row.exacts}</td><td class="center">${row.results}</td></tr>`).join("")}</tbody>
  </table></div>`;
}

function renderPicksPage() {
  const round = state.selectedRound || rounds[0];
  const matches = DATA.matches.filter((m) => m.round === round);
  const shouldHide = !DATA.settings.showPicksBeforeDeadline && !isRoundLocked(round);
  app.innerHTML = `
    <section class="card">
      <h2>Palpites enviados</h2>
      <div class="toolbar"><div class="field"><label>Rodada</label><select id="roundSelect">${rounds.map((r) => `<option value="${r}" ${r === round ? "selected" : ""}>${r}</option>`).join("")}</select></div></div>
      ${shouldHide ? `<div class="notice warning">Os palpites desta rodada ficam ocultos até o fechamento.</div>` : ""}
      <div class="table-wrap"><table>
        <thead><tr><th>Jogo</th>${DATA.players.map((p) => `<th class="center">${p.name}</th>`).join("")}</tr></thead>
        <tbody>${matches.map((m) => `<tr><td>${matchTitle(m)}</td>${DATA.players.map((p) => `<td class="center score-text">${shouldHide ? "Oculto" : formatPick(state.picks[p.id]?.[m.id])}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
    </section>
  `;
  $("#roundSelect").addEventListener("change", (e) => {
    state.selectedRound = e.target.value;
    renderPicksPage();
  });
}

function renderGamesPage() {
  const round = state.selectedRound || rounds[0];
  const matches = DATA.matches.filter((m) => m.round === round);
  app.innerHTML = `
    <section class="card">
      <h2>Jogos</h2>
      <div class="toolbar"><div class="field"><label>Rodada</label><select id="roundSelect">${rounds.map((r) => `<option value="${r}" ${r === round ? "selected" : ""}>${r}</option>`).join("")}</select></div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nº</th><th>Jogo</th><th>Data</th><th>Local</th><th class="center">Resultado</th></tr></thead>
        <tbody>${matches.map((m) => `<tr><td>${m.number}</td><td>${matchTitle(m)}</td><td>${formatDate(m.date)} às ${m.time}</td><td>${m.venue}</td><td class="center score-text">${formatResult(m)}</td></tr>`).join("")}</tbody>
      </table></div>
    </section>
  `;
  $("#roundSelect").addEventListener("change", (e) => {
    state.selectedRound = e.target.value;
    renderGamesPage();
  });
}

function renderGroupsPage() {
  const standings = calculateGroupStandings();
  app.innerHTML = `<section class="group-grid">${DATA.groups.map((g) => groupCard(g, standings[g.id] || [])).join("")}</section>`;
}

function groupCard(group, rows) {
  return `<div class="card group-card"><h3>${group.name}<span class="pill">${group.teams.length} times</span></h3><div class="table-wrap"><table>
    <thead><tr><th>Pos</th><th>País</th><th class="center">Pts</th><th class="center">J</th><th class="center">SG</th></tr></thead>
    <tbody>${rows.map((r, index) => `<tr><td>${index + 1}</td><td>${r.team}</td><td class="center strong">${r.pts}</td><td class="center">${r.j}</td><td class="center">${r.sg}</td></tr>`).join("")}</tbody>
  </table></div></div>`;
}

function renderRulesPage() {
  app.innerHTML = `
    <section class="card">
      <h2>Regras do bolão</h2>
      <ul class="list">
        <li>Placar exato vale <strong>${DATA.settings.exactScorePoints} pontos</strong>.</li>
        <li>Resultado correto, sem acertar o placar, vale <strong>${DATA.settings.resultPoints} ponto</strong>.</li>
        <li>Exemplo: resultado oficial Brasil 2 x 1 Marrocos. Palpite 2 x 1 soma 3 pontos. Palpite 1 x 0 soma 1 ponto.</li>
        <li>Os palpites fecham <strong>${DATA.settings.lockHoursBeforeRound}h antes do primeiro jogo da rodada</strong>.</li>
        <li>Critério de desempate: maior número de placares exatos.</li>
        <li>O último premiado recebe a inscrição grátis no próximo bolão, conforme regra original da planilha.</li>
      </ul>
    </section>
  `;
}

function renderPrizePage() {
  const paid = DATA.players.filter((p) => p.paid).length;
  const potential = DATA.players.length * DATA.settings.entryFee;
  const collected = paid * DATA.settings.entryFee;
  app.innerHTML = `
    <section class="grid cards">
      ${kpi("Inscrição", money(DATA.settings.entryFee))}
      ${kpi("Participantes", DATA.players.length)}
      ${kpi("Arrecadado", money(collected))}
      ${kpi("Potencial", money(potential))}
    </section>
    <section class="card" style="margin-top:16px">
      <h2>Premiação</h2>
      <p>Quantidade de premiados configurada: <strong>${DATA.settings.prizeWinners}</strong>.</p>
      <p>Regra registrada na planilha: último premiado recebe inscrição grátis. Demais premiados: rateio escalonado.</p>
    </section>
  `;
}

function calculateRanking() {
  return DATA.players.map((player) => {
    let points = 0, exacts = 0, results = 0;
    DATA.matches.forEach((match) => {
      const pick = state.picks[player.id]?.[match.id];
      const scored = scorePick(pick, match);
      points += scored.points;
      exacts += scored.exact ? 1 : 0;
      results += scored.result ? 1 : 0;
    });
    return { id: player.id, name: player.name, points, exacts, results };
  }).sort((a, b) => b.points - a.points || b.exacts - a.exacts || a.name.localeCompare(b.name));
}

function scorePick(pick, match) {
  if (!pick || match.score1 === null || match.score2 === null) return { points: 0, exact: false, result: false };
  if (pick.g1 === match.score1 && pick.g2 === match.score2) return { points: DATA.settings.exactScorePoints, exact: true, result: false };
  if (outcome(pick.g1, pick.g2) === outcome(match.score1, match.score2)) return { points: DATA.settings.resultPoints, exact: false, result: true };
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
    standings[group.id] = group.teams.map((team) => ({ team, pts: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, sg: 0 }));
  });
  DATA.matches.filter((m) => groupStageRounds.includes(m.round) && m.score1 !== null && m.score2 !== null).forEach((m) => {
    const groupId = String(m.group || "").replace("Grupo ", "");
    const table = standings[groupId];
    if (!table) return;
    const a = table.find((r) => r.team === m.team1);
    const b = table.find((r) => r.team === m.team2);
    if (!a || !b) return;
    a.j++; b.j++;
    a.gp += m.score1; a.gc += m.score2; a.sg = a.gp - a.gc;
    b.gp += m.score2; b.gc += m.score1; b.sg = b.gp - b.gc;
    if (m.score1 > m.score2) { a.v++; b.d++; a.pts += 3; }
    else if (m.score1 < m.score2) { b.v++; a.d++; b.pts += 3; }
    else { a.e++; b.e++; a.pts++; b.pts++; }
  });
  Object.keys(standings).forEach((key) => {
    standings[key].sort((a, b) => b.pts - a.pts || b.sg - a.sg || b.gp - a.gp || a.team.localeCompare(b.team));
  });
  return standings;
}

function roundDeadline(round) {
  const first = DATA.matches.filter((m) => m.round === round).sort((a, b) => makeDate(a) - makeDate(b))[0];
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
  return `<div class="notice ${locked ? "danger" : ""}"><strong>${round}</strong><br>${locked ? "Fechada em" : "Fecha em"} ${formatDateTime(roundDeadline(round))}</div>`;
}

function kpi(label, value) {
  return `<div class="card"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div></div>`;
}

function matchTitle(match) {
  return `<div class="match-title"><span class="teams">${match.team1} x ${match.team2}</span><span class="meta">${match.group} · Jogo ${match.number}</span></div>`;
}

function formatPick(pick) {
  if (!pick || Number.isNaN(pick.g1) || Number.isNaN(pick.g2)) return "-";
  return `${pick.g1} x ${pick.g2}`;
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
