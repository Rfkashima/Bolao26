const DATA = window.BOLAO_DATA;
const STORE_KEY = "bolao-copa-2026-picks-v1";
const DRAFT_KEY = "bolao-copa-2026-drafts-v1";

const state = {
  view: "inicio",
  picks: {},
  drafts: {},
  stats: {},
  videos: [],
  scorebat: {},
  youtube: {},
  dataSource: {},
  selectedPlayer: localStorage.getItem("bolao-player") || "",
  playerCode: localStorage.getItem("bolao-player-code") || "",
  betRound: localStorage.getItem("bolao-bet-round") || "Rodada 1",
  picksRound: localStorage.getItem("bolao-picks-round") || "Rodada 1",
  gamesRound: localStorage.getItem("bolao-games-round") || "Rodada 1",
  loadedBackend: false
};

const $ = (selector) => document.querySelector(selector);
const app = $("#app");
let backendRefreshTimer = null;
const rounds = [...new Set(DATA.matches.map((m) => m.round))];
const groupStageRounds = ["Rodada 1", "Rodada 2", "Rodada 3"];

const ROUND_LABELS = {
  "Rodada 1": "Rodada 1",
  "Rodada 2": "Rodada 2",
  "Rodada 3": "Rodada 3",
  "Rodada 4": "Mata-mata · 32 avos",
  "Rodada 5": "Oitavas de final",
  "Rodada 6": "Quartas de final",
  "Rodada 7": "Semifinais",
  "Rodada 8": "Final e 3º lugar"
};

const SHORT_COUNTRY_NAMES = {
  "República Tcheca": "Rep. Tcheca",
  "África do Sul": "África Sul",
  "Coreia do Sul": "Coreia Sul",
  "Estados Unidos": "EUA",
  "Costa do Marfim": "C. do Marfim",
  "Arábia Saudita": "Arábia Saud.",
  "Nova Zelândia": "N. Zelândia"
};

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
  "Escócia": "🏴",
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
  "Inglaterra": "🏴",
  "Panamá": "🇵🇦"
};

const FLAG_SVG_CODES = {
  "Escócia": "1f3f4-e0067-e0062-e0073-e0063-e0074-e007f",
  "Inglaterra": "1f3f4-e0067-e0062-e0065-e006e-e0067-e007f"
};

function init() {
  state.view = "inicio";
  localStorage.setItem("bolao-view", "inicio");
  $("#site-title").textContent = DATA.settings.title;
  injectHeaderSponsor();
  bindHeaderSponsorLink();
  state.stats = DATA.stats || {};
  mergePicks(DATA.initialPicks || []);
  loadLocalPicks();
  loadDrafts();
  bindMainTabs();
  loadBackendState();
  setupAutoRefresh();
  render();
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
}



function bindHeaderSponsorLink() {
  const hero = document.querySelector(".hero");

  if (!hero || hero.dataset.sponsorLinkReady === "1") {
    return;
  }

  hero.dataset.sponsorLinkReady = "1";
  hero.setAttribute("role", "link");
  hero.setAttribute("tabindex", "0");
  hero.setAttribute("aria-label", "Abrir site da IA Pro Contato");

  const openSponsor = () => {
    window.open("https://www.iaprocontato.com.br/", "_blank", "noopener,noreferrer");
  };

  hero.addEventListener("click", openSponsor);
  hero.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openSponsor();
    }
  });
}

function injectHeaderSponsor() {
  const topbar = document.querySelector(".topbar");
  const hero = document.querySelector(".hero");

  if (!topbar || !hero || topbar.querySelector(".header-sponsor-row")) {
    return;
  }

  const sponsor = document.createElement("div");
  sponsor.className = "header-sponsor-row";
  sponsor.innerHTML = `
    <div class="header-sponsor">
      <img src="logo-ia-pro-contato.png" alt="IA Pro Contato">
      <span><small>Patrocinado por</small><strong>IA Pro Contato</strong><em>Atendimento automatizado e ERP</em></span>
    </div>
  `;

  hero.insertAdjacentElement("afterend", sponsor);
}

function bindMainTabs() {
  document.querySelectorAll(".main-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      localStorage.setItem("bolao-view", state.view);
      render();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
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

function loadDrafts() {
  try {
    state.drafts = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
  } catch (_) {
    state.drafts = {};
  }
}

function saveDrafts() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(state.drafts || {}));
}

function getDraftPick(playerId, round, matchId) {
  return state.drafts?.[playerId]?.[round]?.[matchId] || null;
}

function setDraftPick(playerId, round, matchId, g1, g2) {
  if (!playerId || !round || !matchId) return;
  if (!state.drafts[playerId]) state.drafts[playerId] = {};
  if (!state.drafts[playerId][round]) state.drafts[playerId][round] = {};

  state.drafts[playerId][round][matchId] = {
    g1,
    g2,
    updatedAt: new Date().toISOString()
  };

  saveDrafts();
}

function clearDraftRound(playerId, round) {
  if (!state.drafts?.[playerId]?.[round]) return;
  delete state.drafts[playerId][round];
  saveDrafts();
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

function mergeMatches(list) {
  if (!Array.isArray(list)) return;

  list.forEach((remote) => {
    const match = DATA.matches.find((item) => item.id === remote.id || item.id === remote.matchId);
    if (!match) return;

    if (remote.score1 !== undefined) match.score1 = remote.score1 === null || remote.score1 === "" ? null : Number(remote.score1);
    if (remote.score2 !== undefined) match.score2 = remote.score2 === null || remote.score2 === "" ? null : Number(remote.score2);
    if (remote.status !== undefined) match.status = remote.status;
    if (remote.elapsed !== undefined) match.elapsed = remote.elapsed;
    if (remote.homeScorers !== undefined) match.homeScorers = remote.homeScorers;
    if (remote.awayScorers !== undefined) match.awayScorers = remote.awayScorers;
    if (remote.events !== undefined) match.events = remote.events;
    if (remote.injuryTime !== undefined) match.injuryTime = remote.injuryTime;
    if (remote.source !== undefined) match.source = remote.source;
    if (remote.sourceStatus !== undefined) match.sourceStatus = remote.sourceStatus;
    if (remote.sourceUpdatedAt !== undefined) match.sourceUpdatedAt = remote.sourceUpdatedAt;
  });
}

function loadBackendState(silent = false) {
  if (!DATA.settings.apiUrl) {
    setBackendStatus("Modo local", "");
    return;
  }

  if (!silent) setBackendStatus("Conectando...", "warning");

  jsonp(`${DATA.settings.apiUrl}?action=state`)
    .then((payload) => {
      if (!payload || payload.ok === false) throw new Error(payload?.error || "Falha ao carregar.");
      if (Array.isArray(payload.picks)) {
        state.picks = {};
        mergePicks(payload.picks);
        saveLocalPicks();
      }
      mergeMatches(payload.matches || []);
      state.stats = payload.stats || state.stats || {};
      state.videos = payload.videos || state.videos || [];
      state.youtube = payload.youtube || state.youtube || {};
      state.dataSource = payload.dataSource || state.dataSource || {};
      state.loadedBackend = true;
      setBackendStatus("Online", "success");
      render();
    })
    .catch(() => { if (!silent) setBackendStatus("Falha no backend", "danger"); });
}


function setupAutoRefresh() {
  if (backendRefreshTimer) {
    return;
  }

  backendRefreshTimer = window.setInterval(() => {
    loadBackendState(true);
  }, 60000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      loadBackendState(true);
    }
  });
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
    action: "savePicks",
    playerId: payload.playerId,
    playerCode: payload.playerCode,
    round: payload.round,
    picks: payload.picks.map((pick) => ({
      m: pick.matchId,
      a: pick.g1,
      b: pick.g2
    }))
  };

  const url = `${DATA.settings.apiUrl}?payload=${encodeURIComponent(JSON.stringify(compact))}`;
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
      ${renderLiveSection()}
      ${renderUpcomingGamesSection()}
      ${renderLatestVideosSection()}

      <section class="card">
        <div class="title-row">
          <h2>🏆 Ranking dos players</h2>
          <span class="kicker">Exatos no ranking</span>
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

      ${renderSponsorBlock()}
    </div>
  `;
}

function renderLiveSection() {
  const liveMatches = DATA.matches
    .filter((match) => isLiveMatch(match))
    .sort((a, b) => makeDate(a) - makeDate(b));

  if (!liveMatches.length) {
    const lastMatch = getLastFinishedMatch();

    if (!lastMatch) {
      return `
        <section class="card live-empty-card">
          <div class="live-empty-line">
            <h2>🔴 Ao vivo</h2>
            <span>Nenhum jogo agora</span>
          </div>
        </section>
      `;
    }

    return renderLastFinishedMatch(lastMatch);
  }

  const liveVideo = findYouTubeLiveForMatches(liveMatches);
  const source = currentFootballSourceLabel();

  return `
    <section class="card live-section">
      <div class="title-row">
        <h2>🔴 Ao vivo</h2>
        <span class="live-pill">${escapeHtml(source)}</span>
      </div>

      <div class="games-list">
        ${liveMatches.map(gameCard).join("")}
      </div>

      ${liveVideo ? renderLiveYouTubeStream(liveVideo) : ""}
    </section>
  `;
}

function getLastFinishedMatch() {
  const now = new Date();

  return DATA.matches
    .filter((match) => {
      const status = String(match.status || "").toLowerCase();
      const start = makeDate(match);

      return status.includes("final") ||
        (start < now && !isLiveMatch(match));
    })
    .sort((a, b) => makeDate(b) - makeDate(a))[0] || null;
}

function getFinishedMatchCount() {
  const now = new Date();

  return DATA.matches.filter((match) => {
    const status = String(match.status || "").toLowerCase();
    const start = makeDate(match);

    return status.includes("final") ||
      (start < now && !isLiveMatch(match));
  }).length;
}

function renderLastFinishedMatch(match) {
  const goals = liveGoals(match);
  const cards = matchCards(match);

  return `
    <section class="card last-match-section">
      <div class="title-row">
        <h2>✅ Último jogo</h2>
        <span class="finished-pill">Jogo encerrado</span>
      </div>

      <div class="last-match-card">
        <div class="last-match-meta">
          <span>${displayRound(match.round)} · Jogo ${match.number}</span>
          <span>${formatDate(match.date)} · ${match.time}</span>
        </div>

        <div class="last-match-line">
          <div class="last-team">${country(match.team1)}</div>
          <strong class="last-score">${matchResultInline(match)}</strong>
          <div class="last-team last-team-right">${country(match.team2)}</div>
        </div>

        ${goals.length ? `
          <div class="finished-events-title">Gols</div>
          <div class="finished-goals">
            ${goals.map((goal) => `
              <div class="finished-goal">
                <span>${goal.minute ? `${goal.minute}'` : "Gol"}</span>
                <div class="event-person">
                  <strong>⚽ ${escapeHtml(goal.player || "Gol")}</strong>
                  ${goal.assist ? `<small>Assistência: ${escapeHtml(goal.assist)}</small>` : ""}
                </div>
                <em>${escapeHtml(goal.team || "")}</em>
              </div>
            `).join("")}
          </div>
        ` : ""}

        ${cards.length ? `
          <div class="finished-events-title">Cartões</div>
          <div class="finished-cards">
            ${cards.map((card) => `
              <div class="finished-card">
                <span>${card.minute ? `${card.minute}'` : ""}</span>
                <div class="event-person">
                  <strong>${card.icon} ${escapeHtml(card.player || card.label)}</strong>
                  <small>${escapeHtml(card.label)}</small>
                </div>
                <em>${escapeHtml(card.team || "")}</em>
              </div>
            `).join("")}
          </div>
        ` : ""}

        <div class="last-match-footer">
          <span>${escapeHtml(match.venue || "")}</span>
          <span>${escapeHtml(match.source || currentFootballSourceLabel())}</span>
        </div>
      </div>
    </section>
  `;
}

function findYouTubeLiveForMatches(matches) {
  const youtube = state.youtube || {};
  const candidates = [];

  if (youtube.live) {
    candidates.push(youtube.live);
  }

  (Array.isArray(youtube.videos) ? youtube.videos : [])
    .filter((video) => video && video.liveState === "live")
    .forEach((video) => candidates.push(video));

  return candidates.find((video) => {
    return matches.some((match) => youtubeVideoMatchesMatch(video, match));
  }) || null;
}

function youtubeVideoMatchesMatch(video, match) {
  const title = normalizeVideoText(
    video && video.title || ""
  );

  return videoTextContainsTeam(title, match.team1) &&
    videoTextContainsTeam(title, match.team2);
}

function videoTextContainsTeam(text, team) {
  const normalizedText = ` ${normalizeVideoText(text)} `;
  const aliases = [
    team,
    SHORT_COUNTRY_NAMES[team] || "",
    countryCode(team)
  ];

  const extraAliases = {
    "Estados Unidos": ["EUA", "USA", "United States"],
    "República Tcheca": ["Rep Tcheca", "Tchéquia", "Czechia"],
    "África do Sul": ["Africa do Sul", "South Africa"],
    "Coreia do Sul": ["Coreia Sul", "South Korea"],
    "Costa do Marfim": ["Costa Marfim", "Ivory Coast"],
    "Arábia Saudita": ["Arabia Saudita", "Saudi Arabia"],
    "Nova Zelândia": ["Nova Zelandia", "New Zealand"],
    "RD Congo": ["Congo DR", "República Democrática do Congo"],
    "Curaçao": ["Curacao"]
  };

  return aliases
    .concat(extraAliases[team] || [])
    .map(normalizeVideoText)
    .filter((alias) => alias.length >= 3)
    .some((alias) => normalizedText.includes(` ${alias} `));
}

function normalizeVideoText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderLiveYouTubeStream(video) {
  if (!video.embeddable) {
    return `
      <div class="live-stream-block">
        <div class="live-stream-title">
          <strong>📺 Transmissão CazéTV</strong>
          <span>Ao vivo</span>
        </div>
        <a class="live-stream-open" href="${video.url}" target="_blank" rel="noopener noreferrer">
          Assistir à transmissão no YouTube
        </a>
      </div>
    `;
  }

  return `
    <div class="live-stream-block">
      <div class="live-stream-title">
        <strong>📺 Transmissão CazéTV</strong>
        <span>Ao vivo</span>
      </div>

      <div class="youtube-embed live-youtube-embed">
        <iframe
          src="${video.embedUrl}"
          title="${escapeHtml(video.title || "Transmissão CazéTV")}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>

      <a class="live-stream-open" href="${video.url}" target="_blank" rel="noopener noreferrer">
        Abrir no YouTube
      </a>
    </div>
  `;
}

function currentFootballSourceLabel() {
  const source = state.dataSource || {};
  const name = String(source.name || "").trim();

  if (!name) {
    return "Fonte aguardando sincronização";
  }

  if (name === "Football-Data.org") {
    return "Football-Data.org · dados com atraso";
  }

  if (source.mode === "fallback") {
    return `${name} · fonte alternativa`;
  }

  return name;
}

function renderUpcomingGamesSection() {
  const now = new Date();
  const upcoming = DATA.matches
    .filter((match) => makeDate(match) > now)
    .sort((a, b) => makeDate(a) - makeDate(b))
    .slice(0, 2);

  const upcomingVideo = state.youtube && state.youtube.upcoming
    ? state.youtube.upcoming
    : null;

  return `
    <section class="card upcoming-card">
      <div class="title-row">
        <h2>⏭️ Próximos jogos</h2>
        <span class="kicker">2 próximos</span>
      </div>

      ${upcoming.length
        ? `<div class="compact-games">${upcoming.map(compactGameCard).join("")}</div>`
        : `<div class="info-box">Sem próximos jogos cadastrados.</div>`
      }

      ${upcomingVideo ? renderUpcomingYouTubeStream(upcomingVideo) : ""}
    </section>
  `;
}

function renderUpcomingYouTubeStream(video) {
  const when = formatYouTubeDate(video.scheduledStartTime);

  if (!video.embeddable) {
    return `
      <div class="upcoming-stream-block">
        <div class="upcoming-stream-head">
          <strong>📺 Transmissão do próximo jogo</strong>
          <span>${when || "Agendada"}</span>
        </div>

        <a
          class="upcoming-stream-link"
          href="${video.url}"
          target="_blank"
          rel="noopener noreferrer"
        >
          ${escapeHtml(video.title || "Abrir transmissão da CazéTV")}
        </a>
      </div>
    `;
  }

  return `
    <div class="upcoming-stream-block">
      <div class="upcoming-stream-head">
        <strong>📺 Transmissão do próximo jogo</strong>
        <span>${when || "Agendada"}</span>
      </div>

      <div class="youtube-embed upcoming-youtube-embed">
        <iframe
          src="${video.embedUrl}"
          title="${escapeHtml(video.title || "Próxima transmissão da CazéTV")}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>

      <a
        class="upcoming-stream-link"
        href="${video.url}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Abrir transmissão no YouTube
      </a>
    </div>
  `;
}

function compactGameCard(match) {
  return `
    <div class="compact-game">
      <div class="compact-game-main">
        <span>${compactCountry(match.team1)}</span>
        <strong>${matchResultInline(match)}</strong>
        <span>${compactCountry(match.team2)}</span>
      </div>
      <div class="compact-game-meta">
        <span>${formatDate(match.date)} · ${match.time}</span>
        <span>${compactVenue(match.venue)}</span>
      </div>
    </div>
  `;
}


function renderLatestVideosSection() {
  const youtube = state.youtube || {};
  const highlights = Array.isArray(youtube.highlights)
    ? youtube.highlights.slice(0, 3)
    : youtube.highlight
      ? [youtube.highlight]
      : [];

  if (!highlights.length) {
    return `
      <section class="card video-status-card">
        <div class="title-row">
          <h2>🎬 Melhores momentos</h2>
          <span class="kicker">CazéTV</span>
        </div>

        <div class="scorebat-empty">
          <strong>Nenhum melhores momentos dos últimos jogos disponível agora.</strong>
          <span>${escapeHtml(youtube.message || "Aguardando publicação no canal da CazéTV.")}</span>
        </div>
      </section>
    `;
  }

  return `
    <section class="card youtube-section">
      <div class="title-row">
        <h2>🎬 Melhores momentos</h2>
        <span class="kicker">Últimos ${highlights.length}</span>
      </div>

      <div class="youtube-title-list">
        ${highlights.map((video, index) => youtubeTitleRow(video, index)).join("")}
      </div>

      <div class="youtube-auto-note">
        Um vídeo para cada um dos últimos jogos encerrados.
      </div>
    </section>
  `;
}

function youtubeTitleRow(video, index) {
  return `
    <a
      class="youtube-title-row"
      href="${video.url}"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span>${index + 1}</span>
      <strong>${escapeHtml(video.title || "Melhores momentos")}</strong>
      <em>▶</em>
    </a>
  `;
}

function youtubeFeaturedCard(video) {
  const isLive = video.liveState === "live";
  const label = isLive ? "AO VIVO" : "AGENDADO";
  const when = formatYouTubeDate(video.actualStartTime || video.scheduledStartTime);

  if (video.embeddable) {
    return `
      <article class="youtube-featured-card">
        <div class="youtube-card-head">
          <span class="youtube-live-label ${isLive ? "is-live" : ""}">${label}</span>
          <strong>${escapeHtml(video.title || "Transmissão CazéTV")}</strong>
        </div>
        <div class="youtube-embed">
          <iframe
            src="${video.embedUrl}"
            title="${escapeHtml(video.title || "Transmissão CazéTV")}"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
          ></iframe>
        </div>
        <a class="youtube-open-link" href="${video.url}" target="_blank" rel="noopener noreferrer">
          ${isLive ? "Assistir no YouTube" : `Abrir transmissão${when ? ` · ${when}` : ""}`}
        </a>
      </article>
    `;
  }

  return youtubeLinkCard(video, label, when);
}

function youtubeHighlightCard(video) {
  return `
    <article class="youtube-highlight-card">
      <a href="${video.url}" target="_blank" rel="noopener noreferrer">
        <div class="youtube-thumb">
          ${video.thumbnail
            ? `<img src="${video.thumbnail}" alt="${escapeHtml(video.title || "Melhores momentos")}">`
            : `<div class="video-thumb-empty">▶</div>`
          }
          <span>▶ Melhores momentos</span>
        </div>
        <div class="youtube-highlight-body">
          <strong>${escapeHtml(video.title || "Último vídeo")}</strong>
          <em>${formatYouTubeDate(video.publishedAt)}</em>
        </div>
      </a>
    </article>
  `;
}

function youtubeLinkCard(video, label, when) {
  return `
    <article class="youtube-highlight-card">
      <a href="${video.url}" target="_blank" rel="noopener noreferrer">
        <div class="youtube-thumb">
          ${video.thumbnail
            ? `<img src="${video.thumbnail}" alt="${escapeHtml(video.title || "Vídeo CazéTV")}">`
            : `<div class="video-thumb-empty">▶</div>`
          }
          <span>${label}</span>
        </div>
        <div class="youtube-highlight-body">
          <strong>${escapeHtml(video.title || "Vídeo CazéTV")}</strong>
          <em>${when || "Abrir no YouTube"}</em>
        </div>
      </a>
    </article>
  `;
}

function formatYouTubeDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function videoCard(video) {
  const title = escapeHtml(video.title || "Vídeo");
  const competition = escapeHtml(video.competition || "Futebol");
  const date = escapeHtml(video.date || "");
  const thumbnail = video.thumbnail ? `<img src="${video.thumbnail}" alt="${title}">` : `<div class="video-thumb-empty">▶</div>`;

  return `
    <article class="video-card">
      <a href="${video.url || "#"}" target="_blank" rel="noopener">
        <div class="video-thumb">${thumbnail}</div>
        <div class="video-body">
          <strong>${title}</strong>
          <span>${competition}${date ? ` · ${date}` : ""}</span>
        </div>
      </a>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderOfficial() {
  app.innerHTML = `
    <div class="stack">
      ${renderGroupsSection()}
      ${renderKnockoutSection()}
      ${renderStatsSection()}
      ${renderSponsorBlock(true)}
    </div>
  `;
  bindEvents();
}

function renderPicksArea() {
  app.innerHTML = `
    <div class="stack">
      ${renderBetSection()}
      ${renderPicksSection()}
      ${renderSponsorBlock(true)}
    </div>
  `;
  bindEvents();
}

function renderSponsorBlock(compact = false) {
  return `
    <a
      class="card sponsor-card sponsor-card-link ${compact ? "compact" : ""}"
      href="https://www.iaprocontato.com.br/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir site da IA Pro Contato"
    >
      <div class="sponsor-wrap">
        <div class="sponsor-logo"><img src="logo-ia-pro-contato.png" alt="IA Pro Contato"></div>
        <div class="sponsor-text">
          <div class="sponsor-label">Patrocínio</div>
          <div class="sponsor-name">IA Pro Contato</div>
          <div class="sponsor-copy">Atendimento automatizado e ERP</div>
        </div>
      </div>
      <div class="data-provider-credit">
        Dados de futebol fornecidos pela API Football-Data.org.
        <span>${escapeHtml(currentFootballSourceLabel())}</span>
      </div>
    </a>
  `;
}

function renderGroupsSection() {
  const standings = calculateGroupStandings();

  return `
    <section>
      <div class="title-row">
        <h2>🌎 Grupos</h2>
        <span class="kicker">Tabela + jogos</span>
      </div>
      <div class="group-grid">
        ${DATA.groups.map((group) => groupCard(group, standings[group.id] || [])).join("")}
      </div>
    </section>
  `;
}

function groupCard(group, rows) {
  const matches = DATA.matches.filter((match) => match.group === group.name && groupStageRounds.includes(match.round));

  return `
    <div class="card group-card">
      <div class="group-head">
        <h3>${group.name}</h3>
      </div>

      <div class="table-wrap group-table">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th class="center">Pts</th>
              <th class="center">V</th>
              <th class="center">E</th>
              <th class="center">D</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${country(row.team)}</td>
                <td class="center strong">${row.pts}</td>
                <td class="center">${row.v}</td>
                <td class="center">${row.e}</td>
                <td class="center">${row.d}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="group-games">
        ${matches.map(groupGameCard).join("")}
      </div>
    </div>
  `;
}

function groupGameCard(match) {
  return `
    <div class="game-card">
      <div class="game-top">
        <span>${displayRound(match.round)} · Jogo ${match.number}</span>
        <span>${formatDate(match.date)} · ${match.time}</span>
      </div>
      ${matchLine(match)}
    </div>
  `;
}

function renderKnockoutSection() {
  const matches = DATA.matches.filter((match) => !groupStageRounds.includes(match.round));

  if (!matches.length) {
    return "";
  }

  return `
    <section class="card">
      <div class="title-row">
        <h2>⚔️ Mata-mata</h2>
        <span class="kicker">Jogos eliminatórios</span>
      </div>
      <div class="games-list">
        ${matches.map(gameCard).join("")}
      </div>
    </section>
  `;
}

function renderStatsSection() {
  const source = state.stats.source || 'Football-Data.org';

  return `
    <section class="card">
      <div class="title-row">
        <h2>📊 Estatísticas</h2>
        <span class="kicker">${escapeHtml(source)}</span>
      </div>

      <div class="stat-grid">
        ${statCard("⚽ Artilharia", state.stats.scorers || state.stats.artilharia || [])}
        ${statCard("🅰️ Assistências", state.stats.assists || state.stats.assistencias || [])}
        ${statCard("🟨 Amarelos", state.stats.yellowCards || state.stats.amarelos || [])}
        ${statCard("🟥 Vermelhos", state.stats.redCards || state.stats.vermelhos || [])}
      </div>
    </section>
  `;
}

function statCard(title, rows) {
  const cleanRows = Array.isArray(rows) ? rows.filter(Boolean).slice(0, 10) : [];

  return `
    <div class="stat-card">
      <h3>${title}</h3>
      ${cleanRows.length ? cleanRows.map((row) => `
        <div class="stat-row">
          <span>${row.player || row.nome || "-"}</span>
          <span>${row.team ? country(row.team) : ""} ${row.total ?? row.value ?? row.qtd ?? 0}</span>
        </div>
      `).join("") : `<div class="muted" style="font-size:13px">Aguardando dados oficiais.</div>`}
    </div>
  `;
}


function liveMatchDetails(match) {
  const goals = liveGoals(match);
  const cards = matchCards(match);
  const elapsed = formatElapsed(match.elapsed);
  const hasScore = match.score1 !== null &&
    match.score1 !== undefined &&
    match.score2 !== null &&
    match.score2 !== undefined;
  const status = liveStatusLabel(match);

  if (!goals.length && !cards.length && !elapsed && !hasScore) {
    return `
      <div class="live-details live-details-clean">
        <div class="live-meta">
          <span class="live-dot"></span>
          <strong>Em andamento</strong>
          <span>Aguardando atualização da API</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="live-details ${(goals.length || cards.length) ? "" : "live-details-clean"}">
      <div class="live-meta">
        <span class="live-dot"></span>
        <strong>${elapsed ? `${elapsed} de jogo` : status}</strong>
        <span>${goals.length || cards.length ? "Eventos confirmados" : "Aguardando eventos"}</span>
      </div>

      ${goals.length ? `
        <div class="goal-list">
          ${goals.map((goal) => `
            <div class="goal-item">
              <span>${goal.minute ? `${goal.minute}'` : "Gol"}</span>
              <div class="event-person">
                <strong>⚽ ${escapeHtml(goal.player || "Gol")}</strong>
                ${goal.assist ? `<small>Assistência: ${escapeHtml(goal.assist)}</small>` : ""}
              </div>
              <em>${escapeHtml(goal.team || "")}</em>
            </div>
          `).join("")}
        </div>
      ` : ""}

      ${cards.length ? `
        <div class="card-event-list">
          ${cards.map((card) => `
            <div class="card-event-item">
              <span>${card.minute ? `${card.minute}'` : ""}</span>
              <div class="event-person">
                <strong>${card.icon} ${escapeHtml(card.player || card.label)}</strong>
                <small>${escapeHtml(card.label)}</small>
              </div>
              <em>${escapeHtml(card.team || "")}</em>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function liveStatusLabel(match) {
  const status = String(match.status || "").toLowerCase();

  if (status.includes("final")) {
    return "Finalizado";
  }

  return "Em andamento";
}

function liveGoals(match) {
  const home = normalizeGoalList(match.homeScorers, match.team1);
  const away = normalizeGoalList(match.awayScorers, match.team2);
  const events = normalizeGoalList(match.events, "");

  const merged = home.concat(away);

  events.forEach((event) => {
    const type = String(event.type || "").toLowerCase();
    if (type.includes("gol") || type.includes("goal")) {
      merged.push(event);
    }
  });

  const seen = new Set();

  return merged
    .filter((goal) => {
      const key = `${goal.player || ""}|${goal.minute || ""}|${goal.team || ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return goal.player || goal.minute;
    })
    .sort((a, b) => Number(a.minute || 999) - Number(b.minute || 999));
}


function matchCards(match) {
  const events = normalizeGoalList(match.events, "");

  return events
    .filter((event) => {
      const type = String(event.type || "").toLowerCase();
      const card = String(event.card || "").toLowerCase();

      return type.includes("cartão") ||
        type.includes("cartao") ||
        type.includes("card") ||
        card.includes("yellow") ||
        card.includes("red");
    })
    .map((event) => {
      const type = String(event.type || "");
      const card = String(event.card || "").toUpperCase();
      const isRed = card === "RED" ||
        card === "YELLOW_RED" ||
        type.toLowerCase().includes("vermelho");

      return Object.assign({}, event, {
        label: isRed ? "Cartão vermelho" : "Cartão amarelo",
        icon: isRed ? "🟥" : "🟨"
      });
    })
    .sort((a, b) => Number(a.minute || 999) - Number(b.minute || 999));
}

function normalizeGoalList(value, team) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return parseGoalText(item, team);

      return {
        type: item.type || "Gol",
        goalType: item.goalType || "",
        player: item.player || item.name || item.scorer || "Gol",
        assist: item.assist || item.assistant || "",
        minute: item.minute || item.time || item.elapsed || "",
        injuryTime: item.injuryTime || "",
        team: item.team || team || "",
        card: item.card || ""
      };
    }).filter(Boolean);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return normalizeGoalList(parsed, team);
    } catch (_) {
      return value.split(/[,;|]/).map((item) => parseGoalText(item, team)).filter(Boolean);
    }
  }

  return [];
}

function parseGoalText(text, team) {
  const raw = String(text || "").trim();
  if (!raw || raw.toLowerCase() === "null") return null;

  const match = raw.match(/^(.*?)\s*(?:[-–(]\s*)?(\d{1,3}(?:\+\d{1,2})?)['’]?\)?$/);

  if (match && match[1].trim()) {
    return { player: match[1].trim(), minute: match[2].trim(), team };
  }

  return { player: raw, minute: "", team };
}

function formatElapsed(value) {
  const raw = String(value || "").trim();

  if (!raw || raw.toLowerCase() === "notstarted") return "";

  if (/^\d/.test(raw)) return `${raw.replace(/['’]/g, "")}'`;

  return raw.toUpperCase();
}


function gameCard(match) {
  return `
    <div class="game-card">
      <div class="game-top">
        <span>${displayRound(match.round)} · Jogo ${match.number}</span>
        <span>${formatDate(match.date)} · ${match.time}</span>
      </div>
      ${matchLine(match)}
      ${isLiveMatch(match) ? liveMatchDetails(match) : ""}
      <div class="muted" style="font-size:11px;margin-top:5px">${match.venue}</div>
    </div>
  `;
}

function matchLine(match) {
  return `
    <div class="match-line">
      <div class="match-left">${country(match.team1)}</div>
      <div class="match-score">${matchResultInline(match)}</div>
      <div class="match-right">${country(match.team2)}</div>
    </div>
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
            ${rounds.map((r) => `<option value="${r}" ${r === round ? "selected" : ""}>${displayRound(r)}</option>`).join("")}
          </select>
        </div>

        <button class="btn" id="savePicks" ${locked ? "disabled" : ""}>Salvar</button>
      </div>

      ${locked
        ? `<div class="notice danger">🔒 ${displayRound(round)} fechada. Prazo: ${formatDateTime(roundDeadline(round))}.</div>`
        : `<div class="notice">⏰ ${displayRound(round)} fecha em ${formatDateTime(roundDeadline(round))}. O último salvamento sobrescreve o anterior.</div>`
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
        <span class="kicker">Por fase/rodada</span>
      </div>

      <div class="toolbar">
        <div class="field">
          <label>Rodada/fase</label>
          <select id="picksRoundSelect">
            ${rounds.map((r) => `<option value="${r}" ${r === round ? "selected" : ""}>${displayRound(r)}</option>`).join("")}
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
            ${matchLine(match)}
            <div class="player-picks">
              ${DATA.players.map((player) => {
                const pick = state.picks[player.id]?.[match.id];
                return `
                  <div class="player-pick">
                    <span class="player-pick-name">${player.name}</span>
                    <span class="player-pick-score">${shouldHide ? "Oculto" : formatPick(pick)}</span>
                    <span class="player-pick-date">${formatPickLastSaved(pick)}</span>
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

  document.querySelectorAll("input[data-match][data-side]").forEach((input) => {
    input.addEventListener("input", () => {
      const matchId = input.dataset.match;
      const g1 = document.querySelector(`input[data-match="${matchId}"][data-side="g1"]`)?.value || "";
      const g2 = document.querySelector(`input[data-match="${matchId}"][data-side="g2"]`)?.value || "";

      setDraftPick(state.selectedPlayer, state.betRound, matchId, g1, g2);
    });
  });

  const saveButton = $("#savePicks");
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

  mergePicks(newPicks);
  saveLocalPicks();
  clearDraftRound(state.selectedPlayer, round);

  submitBackend({
    action: "savePicks",
    playerId: state.selectedPlayer,
    playerCode: state.playerCode,
    round,
    picks: newPicks
  }).then((response) => {
    if (!response || response.ok === false) {
      throw new Error(response?.error || "Não foi possível salvar no Google Sheets.");
    }

    mergePicks(response.picks || newPicks);
    saveLocalPicks();
    alert("Palpites salvos.");
    render();
  }).catch((error) => {
    alert(`Palpites guardados neste aparelho, mas não enviados ao Google Sheets: ${error.message || "erro no backend"}`);
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
          </tr>
        </thead>
        <tbody>
          ${ranking.map((row, index) => `
            <tr>
              <td>
                <div class="rank-position-cell">
                  <strong>${index + 1}</strong>
                  ${rankingMovement(row.movement)}
                </div>
              </td>
              <td>${row.name}</td>
              <td class="center strong">${row.points}</td>
              <td class="center">${row.exacts}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function rankingMovement(movement) {
  const value = Number(movement || 0);

  if (value > 0) {
    return `
      <span
        class="rank-movement rank-movement-up"
        title="Subiu ${value} posição${value === 1 ? "" : "ões"}"
      >
        ▲${value > 1 ? ` +${value}` : ""}
      </span>
    `;
  }

  if (value < 0) {
    const amount = Math.abs(value);

    return `
      <span
        class="rank-movement rank-movement-down"
        title="Caiu ${amount} posição${amount === 1 ? "" : "ões"}"
      >
        ▼${amount > 1 ? ` -${amount}` : ""}
      </span>
    `;
  }

  return `<span class="rank-movement rank-movement-same" title="Manteve a posição">−</span>`;
}

function calculateRanking() {
  const currentRanking = buildRanking();
  const latestMatch = getLastRankedMatch();

  if (!latestMatch) {
    return currentRanking.map((row) => Object.assign({}, row, { movement: 0 }));
  }

  const previousRanking = buildRanking(latestMatch.id);
  const previousPositions = new Map(
    previousRanking.map((row, index) => [row.id, index + 1])
  );

  return currentRanking.map((row, index) => {
    const currentPosition = index + 1;
    const previousPosition = previousPositions.get(row.id) || currentPosition;

    return Object.assign({}, row, {
      movement: previousPosition - currentPosition
    });
  });
}

function buildRanking(excludedMatchId = "") {
  return DATA.players.map((player) => {
    let points = 0;
    let exacts = 0;
    let results = 0;

    DATA.matches.forEach((match) => {
      if (excludedMatchId && match.id === excludedMatchId) {
        return;
      }

      const scored = scorePick(state.picks[player.id]?.[match.id], match);
      points += scored.points;
      exacts += scored.exact ? 1 : 0;
      results += scored.result ? 1 : 0;
    });

    return {
      id: player.id,
      name: player.name,
      points,
      exacts,
      results
    };
  }).sort((a, b) => {
    return b.points - a.points ||
      b.exacts - a.exacts ||
      a.name.localeCompare(b.name);
  });
}

function getLastRankedMatch() {
  return DATA.matches
    .filter((match) => {
      return match.score1 !== null &&
        match.score1 !== undefined &&
        match.score2 !== null &&
        match.score2 !== undefined;
    })
    .sort((a, b) => makeDate(b) - makeDate(a))[0] || null;
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

function isLiveMatch(match) {
  const status = String(match.status || "").toLowerCase();
  const elapsed = String(match.elapsed || "").toLowerCase();

  if (status.includes("vivo") || status.includes("live") || status.includes("andamento")) {
    return true;
  }

  if (elapsed && !["notstarted", "not_started", "scheduled", "ns"].includes(elapsed) && !elapsed.includes("final") && elapsed !== "ft") {
    return true;
  }

  if (status.includes("final")) {
    return false;
  }

  const start = makeDate(match);
  const end = new Date(start.getTime() + 2.5 * 60 * 60 * 1000);
  const now = new Date();

  return now >= start && now <= end;
}

function makeDate(match) {
  return new Date(`${match.date}T${match.time}:00`);
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function roundDeadlineCard(round) {
  const locked = isRoundLocked(round);
  return `
    <div class="deadline-box ${locked ? "danger" : ""}">
      <strong>${locked ? "🔒" : "⏰"} ${displayRound(round)}</strong><br>
      ${locked ? "Fechada em" : "Fecha em"} ${formatDateTime(roundDeadline(round))}
    </div>
  `;
}

function country(name) {
  const label = SHORT_COUNTRY_NAMES[name] || name;
  return `<span class="country">${flagMarkup(name)}<span>${label}</span></span>`;
}

function compactCountry(name) {
  return `<span class="compact-country">${flagMarkup(name)}<span>${countryCode(name)}</span></span>`;
}

function flagMarkup(name) {
  const flag = FLAGS[name] || "🏳️";
  const code = FLAG_SVG_CODES[name] || emojiToTwemojiCode(flag);

  if (!code) {
    return `<span class="flag-fallback">${flag}</span>`;
  }

  return `<img class="flag-img" src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg" alt="${escapeHtml(flag)}" loading="lazy" decoding="async">`;
}

function emojiToTwemojiCode(value) {
  return Array.from(String(value || ""))
    .map((char) => char.codePointAt(0).toString(16))
    .join("-");
}

function countryCode(name) {
  const codes = {
    "África do Sul": "RSA",
    "Coreia do Sul": "KOR",
    "México": "MEX",
    "República Tcheca": "CZE",
    "Bósnia": "BIH",
    "Canadá": "CAN",
    "Catar": "QAT",
    "Suíça": "SUI",
    "Brasil": "BRA",
    "Escócia": "SCO",
    "Haiti": "HAI",
    "Marrocos": "MAR",
    "Austrália": "AUS",
    "Estados Unidos": "USA",
    "Paraguai": "PAR",
    "Turquia": "TUR",
    "Alemanha": "GER",
    "Costa do Marfim": "CIV",
    "Curaçao": "CUW",
    "Equador": "ECU",
    "Holanda": "NED",
    "Japão": "JPN",
    "Suécia": "SWE",
    "Tunísia": "TUN",
    "Bélgica": "BEL",
    "Egito": "EGY",
    "Irã": "IRN",
    "Nova Zelândia": "NZL",
    "Arábia Saudita": "KSA",
    "Cabo Verde": "CPV",
    "Espanha": "ESP",
    "Uruguai": "URU",
    "França": "FRA",
    "Iraque": "IRQ",
    "Noruega": "NOR",
    "Senegal": "SEN",
    "Argélia": "ALG",
    "Argentina": "ARG",
    "Áustria": "AUT",
    "Jordânia": "JOR",
    "Colômbia": "COL",
    "RD Congo": "COD",
    "Portugal": "POR",
    "Uzbequistão": "UZB",
    "Croácia": "CRO",
    "Gana": "GHA",
    "Inglaterra": "ENG",
    "Panamá": "PAN"
  };

  return codes[name] || String(name || "").slice(0, 3).toUpperCase();
}

function compactVenue(venue) {
  const text = String(venue || "");
  const parts = text.split(" - ");
  if (parts.length >= 2) return parts[1];
  return text.replace("Estadio ", "").replace("Stadium", "").trim();
}

function displayRound(round) {
  return ROUND_LABELS[round] || round;
}


function formatPickLastSaved(pick) {
  const value = pick?.updatedAt || pick?.submittedAt;

  if (!value) {
    return "Não enviado";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Salvo";
  }

  return `Salvo ${date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  })}`;
}

function formatPick(pick) {
  if (!pick || Number.isNaN(pick.g1) || Number.isNaN(pick.g2)) return "-";
  return `${pick.g1} x ${pick.g2}`;
}

function matchResultInline(match) {
  if (match.score1 === null || match.score2 === null) {
    return isLiveMatch(match) ? "AO VIVO" : "x";
  }

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
