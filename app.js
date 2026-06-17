const DATA = window.BOLAO_DATA;
const DRAFT_KEY = "bolao-copa-2026-drafts-v1";
const BACKEND_TIMEOUT_MS = 15000;
const LIVE_REFRESH_MS = 15000;
const IDLE_REFRESH_MS = 120000;
const UPCOMING_FEATURE_WINDOW_MS = 30 * 60 * 1000;
const ACTIVE_MATCH_GRACE_MS = 4 * 60 * 60 * 1000;

const state = {
  view: "inicio",
  picks: {},
  drafts: {},
  stats: {},
  statsLoaded: false,
  statsLoading: false,
  selectedPlayer: localStorage.getItem("bolao-player") || "",
  playerCode: localStorage.getItem("bolao-player-code") || "",
  betRound: localStorage.getItem("bolao-bet-round") || "Rodada 1",
  picksRound: localStorage.getItem("bolao-picks-round") || "Rodada 1",
  loadedBackend: false,
  saveInFlight: false
};

const $ = (selector) => document.querySelector(selector);
const app = $("#app");
let backendRefreshTimer = null;
let homeMatchTransitionTimer = null;
let backendRequestPromise = null;
let statsRequestPromise = null;
let deferredBackendRender = false;
let lastBackendVisualSignature = "";
let picksWriteRevision = 0;
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




function init() {
  state.view = "inicio";
  localStorage.setItem("bolao-view", "inicio");
  $("#site-title").textContent = DATA.settings.title;
  bindHeaderSponsorLink();
  state.stats = DATA.stats || {};
  state.statsLoaded = Boolean(
    (state.stats.scorers || state.stats.artilharia || []).length ||
    (state.stats.assists || state.stats.assistencias || []).length
  );
  mergePicks(DATA.initialPicks || []);
  loadDrafts();
  bindMainTabs();
  setupAutoRefresh();
  render();
  scheduleInitialBackendLoad();
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

function scheduleInitialBackendLoad() {
  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      loadBackendState(false, "initial").catch(() => {});
    }, 0);
  });
}

function hasLiveMatches() {
  return DATA.matches.some((match) => isLiveMatch(match));
}

function hasPotentiallyActiveMatch() {
  const now = Date.now();

  return DATA.matches.some((match) => {
    if (!match || isFinishedStatus(match)) return false;

    const kickoff = makeDate(match).getTime();
    return Number.isFinite(kickoff) &&
      now >= kickoff &&
      now <= kickoff + ACTIVE_MATCH_GRACE_MS;
  });
}

function shouldUseLiveRefresh() {
  return hasLiveMatches() || hasPotentiallyActiveMatch();
}

function currentBackendMode() {
  return shouldUseLiveRefresh() ? "live" : "fast";
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

function setDraftRoundPicks(playerId, round, picks) {
  if (!playerId || !round || !Array.isArray(picks)) return;
  if (!state.drafts[playerId]) state.drafts[playerId] = {};
  if (!state.drafts[playerId][round]) state.drafts[playerId][round] = {};

  const updatedAt = new Date().toISOString();

  picks.forEach((pick) => {
    if (!pick || !pick.matchId) return;

    state.drafts[playerId][round][pick.matchId] = {
      g1: String(pick.g1 ?? ""),
      g2: String(pick.g2 ?? ""),
      updatedAt
    };
  });

  saveDrafts();
}

function clearDraftRound(playerId, round) {
  if (!state.drafts?.[playerId]?.[round]) return;
  delete state.drafts[playerId][round];
  saveDrafts();
}

function mergePicks(list) {
  list.forEach((pick) => {
    if (!pick) return;

    const compact = Array.isArray(pick);
    const playerId = compact ? pick[0] : (pick.playerId || pick.p);
    const matchId = compact ? pick[1] : (pick.matchId || pick.m);
    const rawG1 = compact ? pick[2] : (pick.g1 ?? pick.goals1 ?? pick.a);
    const rawG2 = compact ? pick[3] : (pick.g2 ?? pick.goals2 ?? pick.b);
    const submittedAt = compact ? pick[4] : (pick.submittedAt || pick.createdAt);
    const updatedAt = compact ? pick[5] : pick.updatedAt;

    if (!playerId || !matchId) return;
    if (!state.picks[playerId]) state.picks[playerId] = {};

    state.picks[playerId][matchId] = {
      g1: Number(rawG1),
      g2: Number(rawG2),
      submittedAt: submittedAt || updatedAt || new Date().toISOString(),
      updatedAt: updatedAt || submittedAt || ""
    };
  });
}

function mergeMatches(list) {
  if (!Array.isArray(list)) return;

  list.forEach((remote) => {
    const match = DATA.matches.find((item) => {
      return item.id === remote.id || item.id === remote.matchId;
    });

    if (!match) return;

    const sourceStatus = String(remote.sourceStatus || '').toLowerCase();
    const status = String(remote.status || '').toLowerCase();
    const elapsed = String(remote.elapsed || '').toLowerCase();
    const notStarted = status.includes('pendente') ||
      status.includes('scheduled') ||
      status.includes('timed') ||
      sourceStatus.includes('not_started') ||
      sourceStatus.includes('not started') ||
      sourceStatus.includes('scheduled') ||
      sourceStatus.includes('timed') ||
      elapsed === 'notstarted' ||
      elapsed === 'not_started' ||
      elapsed === 'scheduled' ||
      elapsed === 'ns';

    match.score1 = notStarted || remote.score1 === null || remote.score1 === ''
      ? null
      : remote.score1 !== undefined
        ? Number(remote.score1)
        : match.score1;
    match.score2 = notStarted || remote.score2 === null || remote.score2 === ''
      ? null
      : remote.score2 !== undefined
        ? Number(remote.score2)
        : match.score2;

    if (remote.status !== undefined) match.status = remote.status;
    if (remote.elapsed !== undefined) match.elapsed = notStarted ? '' : remote.elapsed;
    if (remote.homeScorers !== undefined) match.homeScorers = remote.homeScorers;
    if (remote.awayScorers !== undefined) match.awayScorers = remote.awayScorers;
    if (remote.events !== undefined) match.events = remote.events;
    if (remote.injuryTime !== undefined) match.injuryTime = remote.injuryTime;
    if (remote.source !== undefined) match.source = remote.source;
    if (remote.sourceStatus !== undefined) match.sourceStatus = remote.sourceStatus;
    if (remote.sourceUpdatedAt !== undefined) match.sourceUpdatedAt = remote.sourceUpdatedAt;
  });
}

function loadBackendState(silent = false, mode = "auto") {
  if (!DATA.settings.apiUrl) {
    setBackendStatus("Modo local", "");
    return Promise.resolve(null);
  }

  if (backendRequestPromise) {
    return backendRequestPromise;
  }

  if (!silent) setBackendStatus("Atualizando...", "warning");

  const requestPicksRevision = picksWriteRevision;
  const resolvedMode = mode === "auto"
    ? currentBackendMode()
    : mode;
  let action = "statefast";

  if (resolvedMode === "initial") {
    action = `statehome&freshLive=${shouldUseLiveRefresh() ? "1" : "0"}`;
  } else if (resolvedMode === "live") {
    action = "live";
  }

  backendRequestPromise = jsonp(`${DATA.settings.apiUrl}?action=${action}`)
    .then((payload) => {
      if (!payload || payload.ok === false) {
        throw new Error(payload?.error || "Falha ao carregar.");
      }

      persistFocusedBetDraft();

      const visualSignature = backendVisualSignature(payload);
      const shouldRender = !state.loadedBackend || visualSignature !== lastBackendVisualSignature;

      if (
        Array.isArray(payload.picks) &&
        requestPicksRevision === picksWriteRevision
      ) {
        state.picks = {};
        mergePicks(payload.picks);
      }

      mergeMatches(payload.matches || []);
      if (payload.stats) {
        state.stats = payload.stats;
        state.statsLoaded = true;
      }
      state.loadedBackend = true;
      lastBackendVisualSignature = visualSignature;
      setBackendStatus("Online", "success");

      if (shouldRender) {
        if (isBetInputFocused()) {
          deferredBackendRender = true;
        } else {
          deferredBackendRender = false;
          render();
        }
      }

      scheduleNextBackendRefresh();
      return payload;
    })
    .catch((error) => {
      if (!silent) setBackendStatus("Falha no backend", "danger");
      scheduleNextBackendRefresh();
      throw error;
    })
    .finally(() => {
      backendRequestPromise = null;
    });

  return backendRequestPromise;
}

function loadStatsState() {
  if (
    state.statsLoaded ||
    state.statsLoading ||
    !DATA.settings.apiUrl
  ) {
    return statsRequestPromise || Promise.resolve(null);
  }

  state.statsLoading = true;
  statsRequestPromise = jsonp(`${DATA.settings.apiUrl}?action=stats`)
    .then((payload) => {
      if (!payload || payload.ok === false) {
        throw new Error(payload?.error || "Falha ao carregar estatísticas.");
      }

      state.stats = payload.stats || {};
      state.statsLoaded = true;

      if (state.view === "oficial") {
        renderOfficial();
      }

      return payload;
    })
    .catch(() => null)
    .finally(() => {
      state.statsLoading = false;
      statsRequestPromise = null;
    });

  return statsRequestPromise;
}

function backendVisualSignature(payload) {
  const signature = {};

  if (Array.isArray(payload.matches)) {
    signature.matches = payload.matches.map((match) => ({
      id: match.id || match.matchId || "",
      score1: match.score1 ?? null,
      score2: match.score2 ?? null,
      status: match.status || "",
      elapsed: match.elapsed || "",
      injuryTime: match.injuryTime || "",
      homeScorers: match.homeScorers || [],
      awayScorers: match.awayScorers || [],
      events: match.events || []
    }));
  }

  if (Array.isArray(payload.picks)) signature.picks = payload.picks;
  if (payload.stats) signature.stats = payload.stats;

  return JSON.stringify(signature);
}

function isBetInputFocused() {
  return state.view === "palpites" &&
    document.activeElement instanceof HTMLInputElement &&
    document.activeElement.matches('input[data-match][data-side]');
}

function persistFocusedBetDraft() {
  if (!isBetInputFocused() || !state.selectedPlayer) return;

  const activeInput = document.activeElement;
  const matchId = activeInput.dataset.match;
  const g1 = document.querySelector(`input[data-match="${matchId}"][data-side="g1"]`)?.value ?? "";
  const g2 = document.querySelector(`input[data-match="${matchId}"][data-side="g2"]`)?.value ?? "";

  setDraftPick(state.selectedPlayer, state.betRound, matchId, g1, g2);
}

function flushDeferredBackendRender() {
  window.setTimeout(() => {
    if (!deferredBackendRender || isBetInputFocused()) return;
    deferredBackendRender = false;
    render();
  }, 0);
}

function setupAutoRefresh() {
  scheduleNextBackendRefresh();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (backendRefreshTimer) {
        window.clearTimeout(backendRefreshTimer);
        backendRefreshTimer = null;
      }
      return;
    }

    loadBackendState(true, currentBackendMode()).catch(() => {});
  });

  window.addEventListener("pagehide", persistFocusedBetDraft);
}

function scheduleNextBackendRefresh() {
  if (backendRefreshTimer) {
    window.clearTimeout(backendRefreshTimer);
  }

  const delay = shouldUseLiveRefresh() ? LIVE_REFRESH_MS : IDLE_REFRESH_MS;

  backendRefreshTimer = window.setTimeout(() => {
    backendRefreshTimer = null;

    if (document.hidden) {
      scheduleNextBackendRefresh();
      return;
    }

    loadBackendState(true, currentBackendMode()).catch(() => {});
  }, delay);
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
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    };

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };

    const timeoutId = window.setTimeout(() => {
      finish(reject, new Error("Tempo limite excedido ao carregar dados."));
    }, BACKEND_TIMEOUT_MS);

    window[callbackName] = (payload) => {
      finish(resolve, payload);
    };

    script.async = true;
    script.onerror = () => {
      finish(reject, new Error("Erro ao carregar dados."));
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
    loadStatsState();
    return;
  }

  if (state.view === "palpites") {
    renderPicksArea();
    return;
  }

  renderHome();
}

function renderHome() {
  app.innerHTML = `
    <div class="stack">
      ${renderLiveSection()}
      ${renderHomeMatchPicksSection()}
      <div class="home-dashboard-grid">
        ${renderUpcomingGamesSection()}

        <section class="card home-ranking-card">
          <div class="title-row">
            <h2>🏆 Ranking dos players</h2>
            <span class="kicker">Classificação atual</span>
          </div>
          ${rankingTable(calculateRanking())}
        </section>
      </div>

    </div>
  `;

  scheduleHomeMatchTransition();
}

function getNextScheduledMatch() {
  const now = Date.now();

  return DATA.matches
    .filter((match) => isFutureScheduledMatch(match) && makeDate(match).getTime() > now)
    .sort((a, b) => makeDate(a) - makeDate(b))[0] || null;
}

function getImminentUpcomingMatch() {
  const nextMatch = getNextScheduledMatch();

  if (!nextMatch) {
    return null;
  }

  const timeUntilKickoff = makeDate(nextMatch).getTime() - Date.now();

  return timeUntilKickoff >= 0 && timeUntilKickoff <= UPCOMING_FEATURE_WINDOW_MS
    ? nextMatch
    : null;
}

function scheduleHomeMatchTransition() {
  if (homeMatchTransitionTimer) {
    window.clearTimeout(homeMatchTransitionTimer);
    homeMatchTransitionTimer = null;
  }

  const nextMatch = getNextScheduledMatch();

  if (!nextMatch || hasLiveMatches()) {
    return;
  }

  const now = Date.now();
  const kickoffAt = makeDate(nextMatch).getTime();
  const featureAt = kickoffAt - UPCOMING_FEATURE_WINDOW_MS;
  const transitionAt = now < featureAt ? featureAt : kickoffAt;
  const delay = transitionAt - now;

  if (delay <= 0) {
    return;
  }

  homeMatchTransitionTimer = window.setTimeout(() => {
    homeMatchTransitionTimer = null;

    if (Date.now() >= kickoffAt) {
      loadBackendState(true, "live").catch(() => {});
    } else if (state.view === "inicio") {
      render();
    }

    scheduleHomeMatchTransition();
  }, Math.min(delay, 2147483647));
}

function getHomeReferenceMatch() {
  const liveMatch = DATA.matches
    .filter((match) => isLiveMatch(match))
    .sort((a, b) => makeDate(a) - makeDate(b))[0];

  return liveMatch || getImminentUpcomingMatch() || getLastFinishedMatch();
}

function renderHomeMatchPicksSection() {
  const match = getHomeReferenceMatch();

  if (!match) {
    return "";
  }

  const isLive = isLiveMatch(match);
  const isUpcoming = !isLive && isFutureScheduledMatch(match);

  return `
    <section class="card home-match-picks-section">
      <div class="title-row">
        <h2>🎯 Palpites dos jogadores</h2>
        <span class="kicker">${isLive ? "Jogo ao vivo" : isUpcoming ? "Próximo jogo" : "Último jogo"}</span>
      </div>

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
                <span class="player-pick-score">${formatPick(pick)}</span>
                <span class="player-pick-date">${formatPickLastSaved(pick)}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderLiveSection() {
  const liveMatches = DATA.matches
    .filter((match) => isLiveMatch(match))
    .sort((a, b) => makeDate(a) - makeDate(b));

  if (!liveMatches.length) {
    const upcomingMatch = getImminentUpcomingMatch();

    if (upcomingMatch) {
      return renderImminentUpcomingMatch(upcomingMatch);
    }

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

  return `
    <section class="card live-section">
      <div class="title-row">
        <h2>🔴 Ao vivo</h2>
      </div>

      <div class="games-list">
        ${liveMatches.map(liveGameCard).join("")}
      </div>
    </section>
  `;
}

function renderImminentUpcomingMatch(match) {
  return `
    <section class="card live-section upcoming-featured-section">
      <div class="title-row">
        <h2>⏳ Próximo jogo</h2>
        <span class="kicker">Começa em até 30 minutos</span>
      </div>

      <div class="games-list">
        <div class="game-card live-game-card upcoming-featured-card">
          <div class="game-top">
            <span>${displayRound(match.round)} · Jogo ${match.number}</span>
            <span>${formatDate(match.date)} · ${match.time}</span>
          </div>

          ${matchLine(match)}

          <div class="muted live-venue">${escapeHtml(match.venue || "")}</div>
        </div>
      </div>
    </section>
  `;
}

function liveGameCard(match) {
  return `
    <div class="game-card live-game-card">
      <div class="game-top">
        <span>${displayRound(match.round)} · Jogo ${match.number}</span>
        <span>${formatDate(match.date)} · ${match.time}</span>
      </div>

      ${liveMatchLine(match)}
      ${liveMatchDetails(match)}

      <div class="muted live-venue">${escapeHtml(match.venue || "")}</div>
    </div>
  `;
}

function liveMatchLine(match) {
  const clock = getLiveClock(match);
  const homeScore = match.score1 === null || match.score1 === undefined
    ? "0"
    : String(match.score1);
  const awayScore = match.score2 === null || match.score2 === undefined
    ? "0"
    : String(match.score2);
  const center = clock
    ? `<div class="live-score-clock">${escapeHtml(clock)}</div>`
    : '<div class="live-score-divider" aria-hidden="true">×</div>';

  return `
    <div class="live-scoreboard">
      <div class="live-score-team live-score-home">
        ${country(match.team1)}
      </div>

      <strong class="live-score-number">${homeScore}</strong>

      ${center}

      <strong class="live-score-number">${awayScore}</strong>

      <div class="live-score-team live-score-away">
        ${country(match.team2)}
      </div>
    </div>
  `;
}

function getLastFinishedMatch() {
  return DATA.matches
    .filter((match) => isFinishedStatus(match))
    .sort((a, b) => makeDate(b) - makeDate(a))[0] || null;
}

function renderLastFinishedMatch(match) {
  const goals = liveGoals(match);

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
          <div class="live-event-list finished-goals-aligned">
            ${goals.map((goal) => {
              const side = eventTeamSide(goal.team, match);
              const teamName = side === "away" ? match.team2 : match.team1;
              const player = cleanGoalPlayer(goal.player) || `Gol do ${teamName}`;

              return liveEventRow({
                kind: "goal",
                icon: "⚽",
                player,
                assist: goal.assist || "",
                minute: cleanGoalMinute(goal.minute),
                team: teamName,
                goalType: goal.goalType || ""
              }, match);
            }).join("")}
          </div>
        ` : ""}

        <div class="last-match-footer">
          <span>${escapeHtml(match.venue || "")}</span>
          <span>${escapeHtml(match.source || 'worldcup26.ir')}</span>
        </div>
      </div>
    </section>
  `;
}

function renderUpcomingGamesSection() {
  const upcoming = DATA.matches
    .filter((match) => isFutureScheduledMatch(match))
    .sort((a, b) => makeDate(a) - makeDate(b))
    .slice(0, 5);

  return `
    <section class="card upcoming-card">
      <div class="title-row">
        <h2>⏭️ Próximos jogos</h2>
        <span class="kicker">5 próximos</span>
      </div>

      ${upcoming.length
        ? `<div class="compact-games">${upcoming.map(compactGameCard).join("")}</div>`
        : `<div class="info-box">Sem próximos jogos cadastrados.</div>`
      }
    </section>
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
        <div class="sponsor-logo"><img src="logo-ia-pro-contato.webp" alt="IA Pro Contato" width="768" height="256" decoding="async"></div>
        <div class="sponsor-text">
          <div class="sponsor-label">Patrocínio</div>
          <div class="sponsor-name">IA Pro Contato</div>
          <div class="sponsor-copy">Atendimento automatizado e ERP</div>
        </div>
      </div>
      <div class="data-provider-credit">
        Dados de futebol: worldcup26.ir e Football-Data.org.
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

  if (!state.statsLoaded) {
    return `
      <section class="card">
        <div class="title-row">
          <h2>📊 Estatísticas</h2>
          <span class="kicker">Carregando sob demanda</span>
        </div>
        <div class="muted stat-empty">Carregando estatísticas oficiais...</div>
      </section>
    `;
  }

  return `
    <section class="card">
      <div class="title-row">
        <h2>📊 Estatísticas</h2>
        <span class="kicker">${escapeHtml(source)}</span>
      </div>

      <div class="stat-grid">
        ${statCard('⚽ Artilharia', state.stats.scorers || state.stats.artilharia || [])}
        ${statCard('🅰️ Assistências', state.stats.assists || state.stats.assistencias || [])}
      </div>
    </section>
  `;
}

function statCard(title, rows) {
  const cleanRows = Array.isArray(rows)
    ? rows.filter(Boolean).slice(0, 10)
    : [];

  return `
    <div class="stat-card">
      <h3>${title}</h3>

      ${cleanRows.length
        ? cleanRows.map((row) => {
            const player = escapeHtml(row.player || row.nome || "-");
            const team = String(row.team || "");
            const total = row.total ?? row.value ?? row.qtd ?? 0;

            return `
              <div class="stat-row">
                <div class="stat-player-side">
                  ${team ? flagMarkup(team) : ""}
                  <strong>${player}</strong>
                </div>

                <strong class="stat-quantity">${total}</strong>
              </div>
            `;
          }).join("")
        : `<div class="muted stat-empty">Aguardando dados oficiais.</div>`
      }
    </div>
  `;
}

function liveMatchDetails(match) {
  const goals = liveGoals(match);

  if (!goals.length) {
    return '';
  }

  return `
    <div class="live-event-list">
      ${goals.map((event) => {
        return liveEventRow(Object.assign({}, event, {
          kind: 'goal',
          icon: '⚽'
        }), match);
      }).join('')}
    </div>
  `;
}

function liveEventRow(event, match) {
  const side = eventTeamSide(event.team, match);
  const minute = event.minute
    ? `${escapeHtml(String(event.minute))}'`
    : "";
  let content = "";

  if (event.kind === "substitution") {
    content = `
      <div class="live-event-person">
        <strong>🔄 ${escapeHtml(event.playerIn || event.player || "")}</strong>
        <small>Saiu: ${escapeHtml(event.playerOut || "")}</small>
      </div>
    `;
  } else {
    const ownGoal = String(event.goalType || "") === "own_goal"
      ? " (GC)"
      : "";

    content = `
      <div class="live-event-person">
        <strong>${event.icon || ""} ${escapeHtml(event.player || event.label || "")}${ownGoal}</strong>
        ${event.assist
          ? `<small>Assistência: ${escapeHtml(event.assist)}</small>`
          : event.label && event.kind === "card"
            ? `<small>${escapeHtml(event.label)}</small>`
            : ""
        }
      </div>
    `;
  }

  return `
    <div class="live-event-row live-event-${side}">
      <div class="live-event-home">${side === "home" ? content : ""}</div>
      <span class="live-event-minute">${minute}</span>
      <div class="live-event-away">${side === "away" ? content : ""}</div>
    </div>
  `;
}

function eventTeamSide(team, match) {
  const eventName = normalizeEventTeamName(team);

  if (!eventName) {
    return 'home';
  }

  const homeAliases = eventTeamAliases(match.team1);
  const awayAliases = eventTeamAliases(match.team2);

  if (
    awayAliases.some((alias) => {
      return eventName === alias ||
        eventName.includes(alias) ||
        alias.includes(eventName);
    })
  ) {
    return 'away';
  }

  if (
    homeAliases.some((alias) => {
      return eventName === alias ||
        eventName.includes(alias) ||
        alias.includes(eventName);
    })
  ) {
    return 'home';
  }

  return 'home';
}

function eventTeamAliases(team) {
  const extras = {
    "Bósnia": ["bosnia", "bosniaeherzegovina", "bosniaandherzegovina"],
    "República Tcheca": ["republicatcheca", "tchequia", "czechia", "czechrepublic"],
    "Coreia do Sul": ["coreiadosul", "southkorea", "korearepublic"],
    "África do Sul": ["africadosul", "southafrica"],
    "Estados Unidos": ["estadosunidos", "usa", "unitedstates"],
    "Costa do Marfim": ["costadomarfim", "ivorycoast", "cotedivoire"],
    "RD Congo": ["rdcongo", "congodr", "democraticrepublicofthecongo"]
  };

  return [team]
    .concat(extras[team] || [])
    .map(normalizeEventTeamName)
    .filter(Boolean);
}

function normalizeEventTeamName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function isLiveDataStale(match) {
  const updatedAt = String(match && match.sourceUpdatedAt || '').trim();

  if (!updatedAt) {
    return false;
  }

  const timestamp = new Date(updatedAt).getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp > 4 * 60 * 1000;
}

function getLiveClock(match) {
  if (isLiveDataStale(match)) {
    return "";
  }

  const sourceStatus = String(match.sourceStatus || '').toUpperCase();
  const elapsed = String(match.elapsed || '').toUpperCase();

  if (sourceStatus === 'PAUSED' || elapsed === 'INTERVALO') {
    return 'INTERVALO';
  }

  return formatElapsed(match.elapsed);
}

function liveGoals(match) {
  const homeGoals = uniqueGoalsForSide(
    normalizeGoalList(
      match.homeScorers,
      match.team1
    ).map((goal) => {
      return Object.assign({}, goal, {
        team: match.team1
      });
    }),
    "home"
  ).slice(0, matchScoreForSide(match, "home"));

  const awayGoals = uniqueGoalsForSide(
    normalizeGoalList(
      match.awayScorers,
      match.team2
    ).map((goal) => {
      return Object.assign({}, goal, {
        team: match.team2
      });
    }),
    "away"
  ).slice(0, matchScoreForSide(match, "away"));

  /*
   * A fonte única já separa os gols por lado.
   * Não usa match.events junto com homeScorers/awayScorers,
   * evitando duplicação e inversão do time.
   */
  return homeGoals
    .concat(awayGoals)
    .sort((a, b) => {
      return goalMinuteSortValue(a.minute) -
        goalMinuteSortValue(b.minute);
    });
}

function matchScoreForSide(match, side) {
  if (isFutureScheduledMatch(match)) {
    return 0;
  }

  const value = side === 'home' ? match.score1 : match.score2;
  const score = Number(value);

  return Number.isFinite(score) && score > 0 ? score : 0;
}

function uniqueGoalsForSide(list, side) {
  const byMinute = new Map();
  const withoutMinute = new Map();

  (Array.isArray(list) ? list : []).forEach((goal) => {
    const player = cleanGoalPlayer(
      goal.player ||
      goal.label ||
      ""
    );
    const minute = cleanGoalMinute(goal.minute);
    const normalized = Object.assign({}, goal, {
      player,
      minute
    });

    if (!player && !minute) {
      return;
    }

    if (minute) {
      const key = `minute:${minute}`;
      const current = byMinute.get(key);

      if (
        !current ||
        goalPlayerNameRank(player) >
          goalPlayerNameRank(current.player)
      ) {
        byMinute.set(key, normalized);
      }

      return;
    }

    const key = `player:${normalizeEventTeamName(player)}`;

    if (!withoutMinute.has(key)) {
      withoutMinute.set(key, normalized);
    }
  });

  return Array.from(byMinute.values())
    .concat(Array.from(withoutMinute.values()))
    .sort((a, b) => {
      return goalMinuteSortValue(a.minute) -
        goalMinuteSortValue(b.minute);
    });
}

function goalMinuteSortValue(value) {
  const raw = cleanGoalMinute(value);
  const match = raw.match(/^(\d{1,3})(?:\+(\d{1,2}))?$/);

  if (!match) {
    return 999;
  }

  return Number(match[1]) +
    Number(match[2] || 0) / 100;
}

function goalPlayerNameRank(value) {
  const text = String(value || "");
  const latin = (text.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const nonLatin = (text.match(/[^\x00-\x7F]/g) || []).length;

  return latin * 10 - nonLatin;
}

function normalizeGoalList(value, team) {
  if (!value) return [];

  let list = value;

  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch (_) {
      list = parseGoalArrayText(list);
    }
  }

  if (!Array.isArray(list)) {
    list = [list];
  }

  return list.map((item) => {
    if (typeof item === "string") {
      return parseGoalText(item, team);
    }

    if (!item || typeof item !== "object") {
      return null;
    }

    const keys = Object.keys(item);
    const fallbackKey = keys.length === 1 ? keys[0] : "";
    const rawPlayer = item.player ||
      item.name ||
      item.scorer ||
      fallbackKey ||
      "";
    const parsed = parseGoalText(
      rawPlayer,
      item.team || team || ""
    );
    const explicitMinute = cleanGoalMinute(
      item.minute ||
      item.time ||
      item.elapsed ||
      ""
    );

    return {
      type: item.type || "Gol",
      goalType: item.goalType ||
        item.goal_type ||
        parsed && parsed.goalType ||
        "",
      player: parsed
        ? parsed.player
        : cleanGoalPlayer(rawPlayer),
      playerIn: item.playerIn || "",
      playerOut: item.playerOut || "",
      assist: item.assist || item.assistant || "",
      minute: explicitMinute ||
        parsed && parsed.minute ||
        "",
      injuryTime: item.injuryTime || "",
      team: item.team ||
        parsed && parsed.team ||
        team ||
        "",
      card: item.card || ""
    };
  }).filter((item) => {
    return item && (
      item.player ||
      item.playerIn ||
      item.playerOut ||
      item.minute
    );
  });
}

function parseGoalArrayText(value) {
  const text = String(value || "").trim();

  if (text.startsWith("{") && text.endsWith("}")) {
    const inner = text.slice(1, -1);
    const items = [];
    const regex = /"((?:\\.|[^"\\])*)"/g;
    let match;

    while ((match = regex.exec(inner)) !== null) {
      items.push(
        match[1]
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
      );
    }

    if (items.length) {
      return items;
    }
  }

  return text
    .split(/[,;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanGoalPlayer(value) {
  let text = String(value || "")
    .replace(/\\"/g, '"')
    .trim();

  for (let index = 0; index < 5; index++) {
    const previous = text;

    if (
      (text.startsWith("{") && text.endsWith("}")) ||
      (text.startsWith("[") && text.endsWith("]"))
    ) {
      text = text.slice(1, -1).trim();
    }

    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim();
    }

    if (text === previous) {
      break;
    }
  }

  return text
    .replace(/^[{[\s"']+/, "")
    .replace(/[}\]\s"']+$/, "")
    .replace(/^gol\s+(?:de|do|da)\s+/i, "")
    .trim();
}

function cleanGoalMinute(value) {
  const raw = String(value || "").trim();

  const added = raw.match(
    /(\d{1,3})\s*['’]?\s*\+\s*(\d{1,2})/
  );

  if (added) {
    return `${Number(added[1])}+${Number(added[2])}`;
  }

  const normal = raw.match(/\d{1,3}/);
  return normal ? String(Number(normal[0])) : "";
}

function parseGoalText(text, team) {
  let raw = cleanGoalPlayer(text);

  if (
    !raw ||
    raw.toLowerCase() === "null"
  ) {
    return null;
  }

  let goalType = "";

  if (
    /\((?:og|gc|own\s*goal|gol\s*contra)\)\s*$/i.test(raw) ||
    /\b(?:og|gc)\s*$/i.test(raw)
  ) {
    goalType = "own_goal";
    raw = raw
      .replace(/\s*\((?:og|gc|own\s*goal|gol\s*contra)\)\s*$/i, "")
      .replace(/\s+\b(?:og|gc)\s*$/i, "")
      .trim();
  }

  const match = raw.match(
    /^(.*?)\s+(\d{1,3})\s*['’]?\s*(?:\+\s*(\d{1,2})\s*['’]?)?\s*$/
  );

  if (match && match[1].trim()) {
    return {
      player: cleanGoalPlayer(match[1]),
      minute: match[3]
        ? `${Number(match[2])}+${Number(match[3])}`
        : String(Number(match[2])),
      team,
      goalType
    };
  }

  return {
    player: cleanGoalPlayer(raw),
    minute: "",
    team,
    goalType
  };
}

function formatElapsed(value) {
  const raw = String(value || "").trim();
  const normalized = raw.toUpperCase();

  if (
    !raw ||
    normalized === "NOTSTARTED" ||
    normalized === "LIVE" ||
    normalized === "AO VIVO" ||
    normalized === "IN PLAY" ||
    normalized === "IN_PLAY"
  ) {
    return "";
  }

  if (/^\d{1,3}:\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{1,3}(?:\+\d{1,2})?$/.test(raw.replace(/['’]/g, ""))) {
    return `${raw.replace(/['’]/g, "")}'`;
  }

  if (
    normalized === "INTERVALO" ||
    normalized === "PRORROGAÇÃO" ||
    normalized === "PÊNALTIS"
  ) {
    return normalized;
  }

  return "";
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
  const saving = Boolean(state.saveInFlight);
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

        <button class="btn" id="savePicks" ${locked || saving ? "disabled" : ""}>${saving ? "Salvando..." : "Salvar"}</button>
      </div>

      ${locked
        ? `<div class="notice danger">🔒 ${displayRound(round)} fechada. Prazo: ${formatDateTime(roundDeadline(round))}.</div>`
        : `<div class="notice">⏰ ${displayRound(round)} fecha em ${formatDateTime(roundDeadline(round))}. As alterações ficam protegidas neste aparelho até o salvamento ser concluído.</div>`
      }

      <div class="bet-list">
        ${matches.map((m) => betRow(m, playerId, locked)).join("")}
      </div>
    </section>
  `;
}

function betRow(match, playerId, locked) {
  const savedPick = state.picks[playerId]?.[match.id] || null;
  const draftPick = getDraftPick(playerId, match.round, match.id);
  const pick = draftPick || savedPick || {};

  return `
    <div class="bet-row">
      <div class="bet-meta">
        <span>${match.group} · Jogo ${match.number}</span>
        <span>${formatDate(match.date)} · ${match.time}</span>
      </div>

      <div class="bet-line">
        <span class="team">${country(match.team1)}</span>
        <input
          type="number"
          min="0"
          max="99"
          step="1"
          inputmode="numeric"
          autocomplete="off"
          data-match="${match.id}"
          data-side="g1"
          aria-label="Palpite para ${escapeHtml(match.team1)}"
          value="${pick.g1 ?? ""}"
          ${locked ? "disabled" : ""}
        >
        <span class="x">X</span>
        <input
          type="number"
          min="0"
          max="99"
          step="1"
          inputmode="numeric"
          autocomplete="off"
          data-match="${match.id}"
          data-side="g2"
          aria-label="Palpite para ${escapeHtml(match.team2)}"
          value="${pick.g2 ?? ""}"
          ${locked ? "disabled" : ""}
        >
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
    playerSelect.addEventListener("change", (event) => {
      persistFocusedBetDraft();
      state.selectedPlayer = event.target.value;
      localStorage.setItem("bolao-player", state.selectedPlayer);
      render();
    });
  }

  if (playerCodeInput) {
    playerCodeInput.addEventListener("input", (event) => {
      state.playerCode = event.target.value.trim();
      localStorage.setItem("bolao-player-code", state.playerCode);
    });
  }

  if (betRoundSelect) {
    betRoundSelect.addEventListener("change", (event) => {
      persistFocusedBetDraft();
      state.betRound = event.target.value;
      localStorage.setItem("bolao-bet-round", state.betRound);
      render();
    });
  }

  if (picksRoundSelect) {
    picksRoundSelect.addEventListener("change", (event) => {
      state.picksRound = event.target.value;
      localStorage.setItem("bolao-picks-round", state.picksRound);
      render();
    });
  }

  const scoreInputs = [...document.querySelectorAll("input[data-match][data-side]")];

  scoreInputs.forEach((input, index) => {
    const replaceCurrentValue = (value) => {
      input.value = String(value || "").replace(/\D/g, "").slice(0, 2);
      input.dataset.replaceOnNextInput = "0";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    input.addEventListener("focus", () => {
      input.dataset.replaceOnNextInput = input.value === "" ? "0" : "1";
      window.requestAnimationFrame(() => input.select());
    });

    input.addEventListener("mouseup", (event) => {
      event.preventDefault();
      input.select();
    });

    input.addEventListener("beforeinput", (event) => {
      if (input.dataset.replaceOnNextInput !== "1") return;

      if (
        event.inputType === "deleteContentBackward" ||
        event.inputType === "deleteContentForward"
      ) {
        event.preventDefault();
        replaceCurrentValue("");
        return;
      }

      const inserted = String(event.data || "").replace(/\D/g, "");

      if (event.inputType.startsWith("insert") && inserted) {
        event.preventDefault();
        replaceCurrentValue(inserted);
      }
    });

    input.addEventListener("input", () => {
      input.dataset.replaceOnNextInput = "0";
      const matchId = input.dataset.match;
      const g1 = document.querySelector(`input[data-match="${matchId}"][data-side="g1"]`)?.value ?? "";
      const g2 = document.querySelector(`input[data-match="${matchId}"][data-side="g2"]`)?.value ?? "";

      setDraftPick(state.selectedPlayer, state.betRound, matchId, g1, g2);
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const nextInput = scoreInputs[index + 1];

        if (nextInput) {
          nextInput.focus();
        } else {
          $("#savePicks")?.focus();
        }
        return;
      }

      if (input.dataset.replaceOnNextInput !== "1") return;

      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        replaceCurrentValue(event.key);
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        replaceCurrentValue("");
      }
    });

    input.addEventListener("blur", () => {
      input.dataset.replaceOnNextInput = "0";
      flushDeferredBackendRender();
    });
  });

  const saveButton = $("#savePicks");
  if (saveButton) {
    saveButton.addEventListener("click", () => saveRoundPicks(state.betRound));
  }
}

function setSaveButtonBusy(busy) {
  const saveButton = $("#savePicks");
  if (!saveButton) return;

  saveButton.disabled = busy || isRoundLocked(state.betRound);
  saveButton.textContent = busy ? "Salvando..." : "Salvar";
}

function saveRoundPicks(round) {
  if (state.saveInFlight) {
    return;
  }

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

  const matches = DATA.matches.filter((match) => match.round === round);
  const newPicks = [];

  for (const match of matches) {
    const g1 = document.querySelector(`input[data-match="${match.id}"][data-side="g1"]`)?.value ?? "";
    const g2 = document.querySelector(`input[data-match="${match.id}"][data-side="g2"]`)?.value ?? "";

    if (g1 === "" || g2 === "") {
      alert("Preencha todos os jogos da rodada antes de salvar.");
      return;
    }

    const goals1 = Number(g1);
    const goals2 = Number(g2);

    if (
      !Number.isInteger(goals1) ||
      !Number.isInteger(goals2) ||
      goals1 < 0 ||
      goals2 < 0 ||
      goals1 > 99 ||
      goals2 > 99
    ) {
      alert(`Informe um placar válido para ${match.team1} x ${match.team2}.`);
      return;
    }

    newPicks.push({
      playerId: state.selectedPlayer,
      matchId: match.id,
      g1: goals1,
      g2: goals2,
      submittedAt: new Date().toISOString()
    });
  }

  setDraftRoundPicks(state.selectedPlayer, round, newPicks);
  mergePicks(newPicks);

  state.saveInFlight = true;
  picksWriteRevision += 1;
  setSaveButtonBusy(true);

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
    clearDraftRound(state.selectedPlayer, round);
    lastBackendVisualSignature = "";
    alert("Palpites salvos.");
    render();
  }).catch((error) => {
    alert(`Os palpites continuam protegidos neste aparelho, mas não foram enviados ao Google Sheets: ${error.message || "erro no backend"}`);
  }).finally(() => {
    state.saveInFlight = false;
    setSaveButtonBusy(false);
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
      return !isFutureScheduledMatch(match) &&
        match.score1 !== null &&
        match.score1 !== undefined &&
        match.score2 !== null &&
        match.score2 !== undefined;
    })
    .sort((a, b) => makeDate(b) - makeDate(a))[0] || null;
}

function scorePick(pick, match) {
  if (!pick ||
    isFutureScheduledMatch(match) ||
    match.score1 === null ||
    match.score1 === undefined ||
    match.score2 === null ||
    match.score2 === undefined) {
    return { points: 0, exact: false, result: false };
  }

  if (pick.g1 === match.score1 && pick.g2 === match.score2) {
    return { points: 3, exact: true, result: true };
  }

  if (outcome(pick.g1, pick.g2) === outcome(match.score1, match.score2)) {
    return { points: 1, exact: false, result: true };
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
    .filter((m) => groupStageRounds.includes(m.round) && !isFutureScheduledMatch(m) && m.score1 !== null && m.score2 !== null)
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
  const status = String(match && match.status || '').toLowerCase();
  const sourceStatus = String(match && match.sourceStatus || '').toLowerCase();
  const elapsed = String(match && match.elapsed || '').toLowerCase();

  if (isFinishedStatus(match)) {
    return false;
  }

  if (
    status.includes('vivo') ||
    status.includes('live') ||
    status.includes('andamento') ||
    sourceStatus.includes('in_play') ||
    sourceStatus.includes('in play') ||
    sourceStatus.includes('paused') ||
    sourceStatus.includes('extra_time') ||
    sourceStatus.includes('penalty')
  ) {
    return true;
  }

  return /^\d{1,3}(?:\+\d{1,2})?$/.test(
    elapsed.replace(/['’]/g, '')
  ) || [
    'intervalo',
    'prorrogação',
    'penaltis',
    'pênaltis'
  ].includes(elapsed);
}

function makeDate(match) {
  return new Date(`${match.date}T${match.time}:00`);
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
  return `<span class="flag-native" role="img" aria-label="${escapeHtml(name)}">${flag}</span>`;
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

function isFutureScheduledMatch(match) {
  if (!match || isLiveMatch(match) || isFinishedStatus(match)) {
    return false;
  }

  const text = [
    match.status,
    match.sourceStatus,
    match.elapsed
  ].join(' ').toLowerCase();

  if (
    text.includes('pendente') ||
    text.includes('notstarted') ||
    text.includes('not_started') ||
    text.includes('not started') ||
    text.includes('scheduled') ||
    text.includes('timed') ||
    text.includes(' ns ')
  ) {
    return true;
  }

  const hasScore = match.score1 !== null &&
    match.score1 !== undefined &&
    match.score2 !== null &&
    match.score2 !== undefined;

  return !hasScore && makeDate(match).getTime() > Date.now();
}

function isFinishedStatus(match) {
  const text = [
    match && match.status,
    match && match.sourceStatus,
    match && match.elapsed
  ].join(' ').toLowerCase();

  return text.includes('final') ||
    text.includes('finished') ||
    text.includes('encerrado') ||
    text.includes('ft');
}

function matchResultInline(match) {
  if (isFutureScheduledMatch(match)) {
    return "x";
  }

  if (match.score1 === null ||
    match.score1 === undefined ||
    match.score2 === null ||
    match.score2 === undefined) {
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


init();
