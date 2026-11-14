
"use strict";

const STORAGE_KEY = "kickoff_tournaments_v3";
const HISTORY_KEY = "kickoff_champions";

let tournaments = loadData(STORAGE_KEY, []);
let champions = loadData(HISTORY_KEY, []);
let currentTournamentId = null;
let pendingDeleteId = null;
let pendingTie = null;
let toastTimer = null;

function loadData(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(champions));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fa(value) {
  return Number(value || 0).toLocaleString("fa-IR");
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function icon(name, size = 24) {
  const paths = {
    ball: '<circle cx="12" cy="12" r="9" fill="none"/><path d="m12 3 2.2 3.4-1 3.7 3.7 2.7M4.2 8.2l4 .2 3.3-2.2M5 16.8l3-2.8 3.8.4 2.5 3.7M19.2 6.8l-1.8 4 1.1 3.8M8 21l.4-4.3" fill="none"/><path d="m12 8.2 3.2 2.2-1.2 3.8H10l-1.2-3.8L12 8.2Z" fill="currentColor" stroke="none" opacity=".18"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M9 4V2h6v2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    stadium: '<path d="M3 10 12 4l9 6v10H3V10Z"/><path d="M7 20v-6h10v6M7 10h.01M12 10h.01M17 10h.01"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1V10Z"/>',
    cup: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v6M8 21h8M9 19h6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    medal: '<circle cx="12" cy="14" r="6"/><path d="m8 3 4 5 4-5M8 3H5l2 7M16 3h3l-2 7"/>'
  };

  return `<svg class="app-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.ball}</svg>`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function getTournament(id = currentTournamentId) {
  return tournaments.find(t => t.id === id);
}

function typeName(type) {
  return ({
    groups: "مرحله گروهی",
    league: "لیگ",
    knockout: "حذفی",
    combined: "گروهی + حذفی"
  })[type] || "تورنمنت";
}

function openModal(id) {
  document.getElementById(id)?.classList.add("show");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("show");
}

function cardValue(match, key) {
  return Math.max(0, Number(match?.[key]) || 0);
}

function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

  document.getElementById(page + "Page")?.classList.add("active");
  document.querySelector(`[data-page="${page}"]`)?.classList.add("active");

  const titles = {
    home: "داشبورد",
    tournaments: "تورنمنت‌ها",
    history: "تالار قهرمانان"
  };

  document.getElementById("pageTitle").textContent = titles[page] || "KICKOFF";

  if (page === "home") renderHome();
  if (page === "tournaments") renderTournaments();
  if (page === "history") renderHistory();
}

function renderPlayerFields() {
  const count = Number(document.getElementById("playerCount").value);
  const teamCount = Number(document.getElementById("teamsPerPlayer").value);
  const container = document.getElementById("playersFields");

  container.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="player-form-card">
      <h4>بازیکن ${fa(i + 1)}</h4>
      <label>
        نام بازیکن
        <input required maxlength="35" data-player-name="${i}" placeholder="نام بازیکن ${fa(i + 1)}">
      </label>
      ${Array.from({ length: teamCount }, (_, j) => `
        <label>
          تیم ${fa(j + 1)}
          <input required maxlength="35" data-player-team="${i}" data-team-index="${j}" placeholder="نام تیم ${fa(j + 1)}">
        </label>
      `).join("")}
    </div>
  `).join("");

  updateFormOptions();
}

function updateFormOptions() {
  const type = document.getElementById("tournamentType").value;
  const isGroups = type === "groups" || type === "combined";
  const isLeague = type === "league";

  document.getElementById("qualifyField").style.display = isGroups ? "grid" : "none";
  document.getElementById("winPointsField").style.display = (isGroups || isLeague) ? "grid" : "none";
  document.getElementById("drawPointsField").style.display = (isGroups || isLeague) ? "grid" : "none";
}

function roundRobin(teams, prefix) {
  const list = [...teams];
  if (list.length < 2) return [];
  if (list.length % 2 !== 0) list.push(null);

  const size = list.length;
  const rounds = size - 1;
  const half = size / 2;
  const matches = [];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = list[i];
      const away = list[size - 1 - i];

      if (home && away) {
        matches.push({
          id: uid(),
          prefix,
          round: round + 1,
          home: home.id,
          away: away.id,
          homeScore: null,
          awayScore: null,
          homeYellow: 0,
          awayYellow: 0,
          homeRed: 0,
          awayRed: 0,
          winner: null,
          played: false
        });
      }
    }

    const fixed = list[0];
    const rotating = list.slice(1);
    rotating.unshift(rotating.pop());
    list.splice(0, list.length, fixed, ...rotating);
  }

  return matches;
}

function createGroups(players) {
  const teamCount = players[0].teams.length;
  const groups = [];

  for (let i = 0; i < teamCount; i++) {
    const groupTeams = players.map(player => player.teams[i]);
    groups.push({
      id: uid(),
      name: String.fromCharCode(65 + i),
      teams: groupTeams.map(t => t.id),
      matches: roundRobin(groupTeams, "group-" + i)
    });
  }

  return groups;
}

function allTeams(tournament) {
  return tournament.players.flatMap(player => player.teams);
}

function teamById(tournament, id) {
  return allTeams(tournament).find(team => team.id === id);
}

/* نمایش نام تیم همراه نام بازیکن */
function displayTeamName(tournament, teamId, fallback = "در انتظار تیم") {
  if (!teamId) return fallback;

  const team = teamById(tournament, teamId);
  if (!team) return fallback;

  const playerName = team.playerName || "بدون بازیکن";
  return `${team.name} (${playerName})`;
}

function createTournament(event) {
  event.preventDefault();

  const name = document.getElementById("tournamentName").value.trim();
  const type = document.getElementById("tournamentType").value;
  const playerCount = Number(document.getElementById("playerCount").value);
  const teamCount = Number(document.getElementById("teamsPerPlayer").value);

  if (!name) {
    showToast("نام تورنمنت را وارد کن.");
    return;
  }

  const players = [];

  for (let i = 0; i < playerCount; i++) {
    const nameInput = document.querySelector(`[data-player-name="${i}"]`);
    const playerName = nameInput?.value.trim();

    if (!playerName) {
      showToast(`نام بازیکن ${fa(i + 1)} را وارد کن.`);
      nameInput?.focus();
      return;
    }

    const teams = [];

    for (let j = 0; j < teamCount; j++) {
      const input = document.querySelector(`[data-player-team="${i}"][data-team-index="${j}"]`);
      const teamName = input?.value.trim();

      if (!teamName) {
        showToast(`نام تیم ${fa(j + 1)} بازیکن ${fa(i + 1)} را وارد کن.`);
        input?.focus();
        return;
      }

      teams.push({
        id: uid(),
        name: teamName,
        playerId: "player-" + i,
        playerName
      });
    }

    players.push({ id: "player-" + i, name: playerName, teams });
  }

  const teams = players.flatMap(player => player.teams);

  const tournament = {
    id: uid(),
    name,
    type,
    players,
    createdAt: new Date().toISOString(),
    status: "active",
    winPoints: Number(document.getElementById("winPoints").value) || 3,
    drawPoints: Number(document.getElementById("drawPoints").value) || 1,
    qualifyCount: Number(document.getElementById("qualifyCount").value) || 2,
    groups: [],
    leagueMatches: [],
    knockoutRounds: [],
    champion: null,
    runnerUp: null,
    finishedAt: null
  };

  if (type === "groups" || type === "combined") {
    tournament.groups = createGroups(players);
  }

  if (type === "league") {
    tournament.leagueMatches = roundRobin(teams, "league");
  }

  if (type === "knockout") {
    tournament.knockoutRounds = [createKnockoutRound(teams)];
    advanceByes(tournament);
  }

  tournaments.unshift(tournament);
  saveData();
  closeModal("createModal");
  document.getElementById("tournamentForm").reset();
  currentTournamentId = tournament.id;
  renderAll();
  showDetail(tournament.id);
  showToast("تورنمنت با موفقیت ساخته شد.");
}

function createKnockoutRound(teams) {
  const list = [...teams];

  if (list.length < 2) {
    return { name: "فینال", matches: [] };
  }

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(list.length)));
  const byeCount = bracketSize - list.length;
  const ordered = [];
  const owners = [...new Set(list.map(t => t.playerId))];
  let remaining = [...list];

  while (remaining.length) {
    let added = false;
    for (const owner of owners) {
      const index = remaining.findIndex(team => team.playerId === owner);
      if (index !== -1) {
        ordered.push(remaining.splice(index, 1)[0]);
        added = true;
      }
    }
    if (!added) break;
  }

  const slots = Array(bracketSize).fill(null);

  for (let i = 0; i < byeCount; i++) {
    const position = Math.floor(i * bracketSize / byeCount);
    slots[position] = ordered[i];
  }

  const unplaced = ordered.slice(byeCount);
  const freePositions = slots.map((value, index) => value === null ? index : -1).filter(index => index >= 0);

  freePositions.forEach((position, index) => {
    slots[position] = unplaced[index] || null;
  });

  const matches = [];

  for (let i = 0; i < bracketSize; i += 2) {
    const home = slots[i];
    const away = slots[i + 1];

    matches.push({
      id: uid(),
      home: home?.id || null,
      away: away?.id || null,
      homeScore: null,
      awayScore: null,
      homeYellow: 0,
      awayYellow: 0,
      homeRed: 0,
      awayRed: 0,
      winner: null,
      played: false,
      bye: !home || !away
    });
  }

  return { name: roundName(bracketSize), matches };
}

function roundName(size) {
  if (size === 2) return "فینال";
  if (size === 4) return "نیمه‌نهایی";
  if (size === 8) return "یک‌چهارم نهایی";
  if (size === 16) return "یک‌هشتم نهایی";
  return "مرحله " + size + " تیمی";
}

function advanceByes(tournament) {
  const round = tournament.knockoutRounds[0];
  if (!round) return;

  round.matches.forEach(match => {
    if (match.bye && (match.home || match.away)) {
      match.winner = match.home || match.away;
      match.played = true;
    }
  });

  buildNextRound(tournament);
}

function buildNextRound(tournament) {
  const rounds = tournament.knockoutRounds;
  const last = rounds[rounds.length - 1];

  if (!last || !last.matches.length || !last.matches.every(match => match.played)) return;

  const winners = last.matches.map(match => match.winner).filter(Boolean);

  if (winners.length === 1) {
    const finalMatch = last.matches.length === 1 ? last.matches[0] : null;
    const runnerUpId = finalMatch
      ? (finalMatch.home === winners[0] ? finalMatch.away : finalMatch.home)
      : null;

    finishTournament(tournament, winners[0], runnerUpId);
    return;
  }

  if (winners.length < 2 || last.matches.length === 1) return;

  const nextMatches = [];

  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({
      id: uid(),
      home: winners[i],
      away: winners[i + 1] || null,
      homeScore: null,
      awayScore: null,
      homeYellow: 0,
      awayYellow: 0,
      homeRed: 0,
      awayRed: 0,
      winner: winners[i + 1] ? null : winners[i],
      played: !winners[i + 1],
      bye: !winners[i + 1]
    });
  }

  rounds.push({ name: roundName(winners.length), matches: nextMatches });

  if (nextMatches.every(match => match.played)) buildNextRound(tournament);
}

function readMatchCards(matchId) {
  const read = key => {
    const input = document.querySelector(`[data-card-${key}="${matchId}"]`);
    const value = input ? Number(input.value || 0) : 0;

    if (!Number.isInteger(value) || value < 0 || value > 20) return null;
    return value;
  };

  const cards = {
    homeYellow: read("home-yellow"),
    awayYellow: read("away-yellow"),
    homeRed: read("home-red"),
    awayRed: read("away-red")
  };

  if (Object.values(cards).some(value => value === null)) {
    showToast("تعداد کارت باید عددی بین صفر تا ۲۰ باشد.");
    return null;
  }

  return cards;
}

function saveMatchCards(match, cards) {
  match.homeYellow = cards.homeYellow;
  match.awayYellow = cards.awayYellow;
  match.homeRed = cards.homeRed;
  match.awayRed = cards.awayRed;
}

function renderCardInputs(match, disabled = false) {
  const lock = disabled ? "disabled" : "";

  return `
    <div class="match-cards">
      <div class="team-card-inputs">
        <span class="card-team-label">کارت تیم اول</span>
        <label>
          <span class="card-dot yellow-dot" title="کارت زرد"></span>
          <input type="number" min="0" max="20" inputmode="numeric" aria-label="کارت زرد تیم اول" data-card-home-yellow="${match.id}" value="${cardValue(match, "homeYellow")}" ${lock}>
        </label>
        <label>
          <span class="card-dot red-dot" title="کارت قرمز"></span>
          <input type="number" min="0" max="20" inputmode="numeric" aria-label="کارت قرمز تیم اول" data-card-home-red="${match.id}" value="${cardValue(match, "homeRed")}" ${lock}>
        </label>
      </div>

      <div class="team-card-inputs">
        <span class="card-team-label">کارت تیم دوم</span>
        <label>
          <span class="card-dot yellow-dot" title="کارت زرد"></span>
          <input type="number" min="0" max="20" inputmode="numeric" aria-label="کارت زرد تیم دوم" data-card-away-yellow="${match.id}" value="${cardValue(match, "awayYellow")}" ${lock}>
        </label>
        <label>
          <span class="card-dot red-dot" title="کارت قرمز"></span>
          <input type="number" min="0" max="20" inputmode="numeric" aria-label="کارت قرمز تیم دوم" data-card-away-red="${match.id}" value="${cardValue(match, "awayRed")}" ${lock}>
        </label>
      </div>
    </div>
  `;
}

function getStandings(tournament, teamIds, matches) {
  const teams = allTeams(tournament);

  const rows = teamIds.map(id => {
    const team = teams.find(t => t.id === id);
    return {
      id,
      name: team?.name || "تیم",
      playerName: team?.playerName || "",
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      gf: 0,
      ga: 0,
      points: 0,
      yellow: 0,
      red: 0
    };
  });

  matches.forEach(match => {
    if (!match.played || match.homeScore === null || match.awayScore === null) return;

    const home = rows.find(t => t.id === match.home);
    const away = rows.find(t => t.id === match.away);
    if (!home || !away) return;

    const hs = Number(match.homeScore);
    const as = Number(match.awayScore);

    home.played++;
    away.played++;
    home.gf += hs;
    home.ga += as;
    away.gf += as;
    away.ga += hs;

    home.yellow += cardValue(match, "homeYellow");
    away.yellow += cardValue(match, "awayYellow");
    home.red += cardValue(match, "homeRed");
    away.red += cardValue(match, "awayRed");

    if (hs > as) {
      home.win++;
      away.loss++;
      home.points += tournament.winPoints;
    } else if (hs < as) {
      away.win++;
      home.loss++;
      away.points += tournament.winPoints;
    } else {
      home.draw++;
      away.draw++;
      home.points += tournament.drawPoints;
      away.points += tournament.drawPoints;
    }
  });

  rows.forEach(team => team.diff = team.gf - team.ga);

  return rows.sort((a, b) =>
    b.points - a.points ||
    b.diff - a.diff ||
    b.gf - a.gf ||
    a.red - b.red ||
    a.yellow - b.yellow ||
    a.name.localeCompare(b.name, "fa")
  );
}

function renderStandings(tournament, teamIds, matches, qualify = 0) {
  const rows = getStandings(tournament, teamIds, matches);

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th><th>تیم</th><th>بازی</th><th>برد</th><th>مساوی</th>
            <th>باخت</th><th>گل زده</th><th>تفاضل</th><th>امتیاز</th>
            <th><span class="card-dot yellow-dot"></span></th>
            <th><span class="card-dot red-dot"></span></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row, i) => `
            <tr class="${qualify && i < qualify ? "qualified" : ""}">
              <td>${fa(i + 1)}</td>
              <td class="team-name">${escapeHTML(row.name)}</td>
              <td>${fa(row.played)}</td>
              <td>${fa(row.win)}</td>
              <td>${fa(row.draw)}</td>
              <td>${fa(row.loss)}</td>
              <td>${fa(row.gf)}</td>
              <td>${fa(row.diff)}</td>
              <td><b>${fa(row.points)}</b></td>
              <td>${fa(row.yellow)}</td>
              <td>${fa(row.red)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    <p class="mini-note">ترتیب رتبه‌بندی: امتیاز، تفاضل گل، گل زده، کارت قرمز کمتر و سپس کارت زرد کمتر.</p>
  `;
}

function findMatch(tournament, matchId) {
  for (const group of tournament.groups || []) {
    const match = group.matches.find(m => m.id === matchId);
    if (match) return { match, group, stage: "group" };
  }

  const league = (tournament.leagueMatches || []).find(m => m.id === matchId);
  if (league) return { match: league, stage: "league" };

  for (const round of tournament.knockoutRounds || []) {
    const match = round.matches.find(m => m.id === matchId);
    if (match) return { match, round, stage: "knockout" };
  }

  return null;
}

function saveMatchScore(matchId) {
  const tournament = getTournament();
  if (!tournament) return;

  const found = findMatch(tournament, matchId);
  if (!found) return;

  const homeInput = document.querySelector(`[data-score-home="${matchId}"]`);
  const awayInput = document.querySelector(`[data-score-away="${matchId}"]`);
  if (!homeInput || !awayInput) return;

  const homeScore = Number(homeInput.value);
  const awayScore = Number(awayInput.value);

  if (
    homeInput.value === "" || awayInput.value === "" ||
    !Number.isInteger(homeScore) || !Number.isInteger(awayScore) ||
    homeScore < 0 || awayScore < 0 || homeScore > 99 || awayScore > 99
  ) {
    showToast("نتیجه معتبر وارد کن.");
    return;
  }

  const match = found.match;
  if (!match.home || !match.away) {
    showToast("این مسابقه هنوز دو تیم ندارد.");
    return;
  }

  const cards = readMatchCards(matchId);
  if (!cards) return;

  const isKnockoutMatch = found.stage === "knockout";

  if (isKnockoutMatch && homeScore === awayScore) {
    pendingTie = { matchId, homeScore, awayScore, cards };
    showWinnerChoices(tournament, match);
    return;
  }

  if (isKnockoutMatch) {
    match.winner = homeScore > awayScore ? match.home : match.away;
  }

  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.played = true;
  saveMatchCards(match, cards);

  if (isKnockoutMatch) buildNextRound(tournament);

  saveData();
  renderDetail(tournament);
  showToast("نتیجه و کارت‌های مسابقه ثبت شد.");
}

function showWinnerChoices(tournament, match) {
  document.getElementById("winnerChoices").innerHTML = `
    <button data-tie-winner="${match.home}">${escapeHTML(displayTeamName(tournament, match.home, "تیم اول"))}</button>
    <button data-tie-winner="${match.away}">${escapeHTML(displayTeamName(tournament, match.away, "تیم دوم"))}</button>
  `;

  openModal("winnerModal");
}

function chooseTieWinner(winnerId) {
  if (!pendingTie) return;

  const tournament = getTournament();
  if (!tournament) return;

  const found = findMatch(tournament, pendingTie.matchId);
  if (!found || found.stage !== "knockout") return;

  if (winnerId !== found.match.home && winnerId !== found.match.away) return;

  found.match.homeScore = pendingTie.homeScore;
  found.match.awayScore = pendingTie.awayScore;
  found.match.winner = winnerId;
  found.match.played = true;

  saveMatchCards(found.match, pendingTie.cards);
  pendingTie = null;
  closeModal("winnerModal");

  buildNextRound(tournament);
  saveData();
  renderDetail(tournament);
  showToast("برنده و کارت‌های مسابقه ثبت شدند.");
}

function startKnockoutFromGroups() {
  const tournament = getTournament();
  if (!tournament) return;

  if (tournament.status === "done") {
    showToast("این تورنمنت به پایان رسیده است.");
    return;
  }

  if (!tournament.groups.length) return;

  const allPlayed = tournament.groups.every(group =>
    group.matches.every(match => match.played)
  );

  if (!allPlayed) {
    showToast("ابتدا تمام مسابقات گروهی را انجام بده.");
    return;
  }

  if (tournament.knockoutRounds.length) {
    showToast("مرحله حذفی قبلاً شروع شده است.");
    return;
  }

  const qualified = [];

  tournament.groups.forEach(group => {
    const standings = getStandings(tournament, group.teams, group.matches);
    standings.slice(0, tournament.qualifyCount).forEach(team => {
      const found = teamById(tournament, team.id);
      if (found) qualified.push(found);
    });
  });

  if (qualified.length < 2) {
    showToast("تعداد تیم‌های صعودکننده کافی نیست.");
    return;
  }

  tournament.knockoutRounds = [createKnockoutRound(qualified)];
  advanceByes(tournament);

  saveData();
  renderDetail(tournament);
  showToast("مرحله حذفی آغاز شد.");
}

function finishTournament(tournament, championId, runnerUpId) {
  if (tournament.status === "done") return;

  const champion = teamById(tournament, championId);
  const runnerUp = runnerUpId ? teamById(tournament, runnerUpId) : null;
  if (!champion) return;

  tournament.champion = {
    teamId: champion.id,
    teamName: champion.name,
    playerName: champion.playerName
  };

  tournament.runnerUp = runnerUp ? {
    teamId: runnerUp.id,
    teamName: runnerUp.name,
    playerName: runnerUp.playerName
  } : null;

  tournament.status = "done";
  tournament.finishedAt = new Date().toISOString();

  champions.unshift({
    id: uid(),
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    champion: champion.name,
    playerName: champion.playerName,
    runnerUp: runnerUp?.name || "",
    runnerUpPlayer: runnerUp?.playerName || "",
    date: tournament.finishedAt
  });

  saveData();
}

function renderMatch(match, tournament) {
  const homeName = displayTeamName(tournament, match.home, "استراحت");
  const awayName = displayTeamName(tournament, match.away, "استراحت");

  if (match.bye) {
    return `
      <div class="match-card">
        <div class="match-team">${escapeHTML(homeName)}</div>
        <div class="match-status">صعود مستقیم</div>
        <div class="match-team">${escapeHTML(awayName)}</div>
        <span class="match-status">BYE</span>
      </div>
    `;
  }

  const disabled = tournament.status === "done" ? "disabled" : "";

  return `
    <div class="match-card">
      <div class="match-team">${escapeHTML(homeName)}</div>
      <div class="score-inputs">
        <input type="number" min="0" max="99" inputmode="numeric" aria-label="گل ${escapeHTML(homeName)}" data-score-home="${match.id}" value="${match.homeScore ?? ""}" ${disabled}>
        <span>:</span>
        <input type="number" min="0" max="99" inputmode="numeric" aria-label="گل ${escapeHTML(awayName)}" data-score-away="${match.id}" value="${match.awayScore ?? ""}" ${disabled}>
      </div>
      <div class="match-team">${escapeHTML(awayName)}</div>
      ${renderCardInputs(match, tournament.status === "done")}
      ${tournament.status === "done"
        ? `<span class="match-status">پایان‌یافته</span>`
        : `<button class="save-score" data-save-match="${match.id}">ثبت نتیجه و کارت‌ها</button>`
      }
    </div>
  `;
}

function renderGroupSection(tournament) {
  return `
    <h3 class="subheading">جدول گروه‌ها</h3>
    <div class="group-grid">
      ${tournament.groups.map(group => `
        <div class="group-card">
          <div class="group-title">
            <h3>گروه ${escapeHTML(group.name)}</h3>
            <small>${fa(group.teams.length)} تیم</small>
          </div>
          ${renderStandings(tournament, group.teams, group.matches, tournament.qualifyCount)}
        </div>
      `).join("")}
    </div>

    ${tournament.groups.map(group => `
      <h3 class="subheading">مسابقات گروه ${escapeHTML(group.name)}</h3>
      <div class="match-list">
        ${group.matches.map(match => renderMatch(match, tournament)).join("")}
      </div>
    `).join("")}

    ${tournament.type === "combined" ? `
      <div class="form-section">
        <h3 class="subheading">مرحله حذفی</h3>
        ${tournament.knockoutRounds.length
          ? renderBracket(tournament)
          : `<p class="mini-note">بعد از پایان تمام مسابقات گروهی، تیم‌های برتر هر گروه به مرحله حذفی صعود می‌کنند.</p>`
        }
        ${tournament.status !== "done" && !tournament.knockoutRounds.length
          ? `<button class="primary-btn" id="startKnockoutBtn">شروع مرحله حذفی ←</button>`
          : ""
        }
      </div>
    ` : ""}
  `;
}

function renderLeagueSection(tournament) {
  const ids = allTeams(tournament).map(team => team.id);

  return `
    <h3 class="subheading">جدول لیگ</h3>
    ${renderStandings(tournament, ids, tournament.leagueMatches)}
    <h3 class="subheading">برنامه مسابقات</h3>
    <div class="match-list">
      ${tournament.leagueMatches.map(match => `
        <div>
          <div class="match-status">هفته ${fa(match.round)}</div>
          ${renderMatch(match, tournament)}
        </div>
      `).join("")}
    </div>
  `;
}

function renderBracket(tournament) {
  if (!tournament.knockoutRounds.length) {
    return `<div class="empty-state">هنوز مرحله حذفی ساخته نشده است.</div>`;
  }

  return `
    <div class="bracket-shell">
      <div class="bracket-heading">
        <div>
          <span class="eyebrow">KNOCKOUT STAGE</span>
          <h3>مسیر رسیدن به قهرمانی</h3>
        </div>
        <span class="bracket-round-count">${fa(tournament.knockoutRounds.length)} مرحله</span>
      </div>

      <div class="bracket-scroll">
        <div class="bracket">
          ${tournament.knockoutRounds.map((round, roundIndex) => `
            <section class="bracket-round ${round.name === "فینال" ? "final-round" : ""}">
              <div class="round-heading">
                <span class="round-index">${fa(roundIndex + 1)}</span>
                <h3>${escapeHTML(round.name)}</h3>
              </div>

              <div class="round-matches">
                ${round.matches.map((match, matchIndex) => {
                  const home = teamById(tournament, match.home);
                  const away = teamById(tournament, match.away);
                  const homeWinner = match.winner === match.home && !!match.winner;
                  const awayWinner = match.winner === match.away && !!match.winner;
                  const homeName = displayTeamName(tournament, match.home, "در انتظار تیم");
                  const awayName = displayTeamName(tournament, match.away, match.bye ? "استراحت" : "در انتظار تیم");

                  return `
                    <article class="bracket-match ${match.played ? "is-played" : ""} ${match.bye ? "is-bye" : ""}">
                      <div class="bracket-match-top">
                        <span>بازی ${fa(matchIndex + 1)}</span>
                        ${match.played ? `<span class="match-complete">ثبت‌شده</span>` : `<span class="match-pending">در انتظار</span>`}
                      </div>

                      <div class="bracket-team ${homeWinner ? "winner" : ""}">
                        <span class="team-name-wrap">
                          <i class="team-indicator"></i>
                          <span>${escapeHTML(homeName)}</span>
                        </span>
                        <b>${match.played ? fa(match.homeScore ?? 0) : "—"}</b>
                      </div>

                      <div class="bracket-team ${awayWinner ? "winner" : ""}">
                        <span class="team-name-wrap">
                          <i class="team-indicator"></i>
                          <span>${escapeHTML(awayName)}</span>
                        </span>
                        <b>${match.played ? fa(match.awayScore ?? 0) : "—"}</b>
                      </div>

                      ${!match.played && !match.bye && tournament.status !== "done" && match.home && match.away ? `
                        <div class="bracket-input-area">
                          <div class="bracket-actions">
                            <input type="number" min="0" max="99" inputmode="numeric" placeholder="گل تیم اول" data-score-home="${match.id}">
                            <input type="number" min="0" max="99" inputmode="numeric" placeholder="گل تیم دوم" data-score-away="${match.id}">
                          </div>
                          ${renderCardInputs(match)}
                          <button class="save-score bracket-save" data-save-match="${match.id}">ثبت نتیجه بازی</button>
                        </div>
                      ` : ""}

                      ${match.bye ? `<div class="bye-note">صعود مستقیم</div>` : ""}

                      ${match.played && !match.bye ? `
                        <div class="match-card-summary">
                          <span><i class="card-dot yellow-dot"></i>${fa(cardValue(match, "homeYellow"))} - ${fa(cardValue(match, "awayYellow"))}</span>
                          <span><i class="card-dot red-dot"></i>${fa(cardValue(match, "homeRed"))} - ${fa(cardValue(match, "awayRed"))}</span>
                        </div>
                      ` : ""}
                    </article>
                  `;
                }).join("")}
              </div>
            </section>
          `).join("")}
        </div>
      </div>
      <p class="bracket-hint">برای دیدن تمام مراحل، جدول را به چپ و راست بکش.</p>
    </div>
  `;
}

function renderDetail(tournament) {
  const container = document.getElementById("tournamentDetail");
  if (!tournament) return;

  const isGroup = tournament.type === "groups" || tournament.type === "combined";
  const isLeague = tournament.type === "league";
  const isKnockout = tournament.type === "knockout";

  let content = "";

  if (isGroup) {
    content = `<div class="detail-section active" id="tabGroups">${renderGroupSection(tournament)}</div>`;
  } else if (isLeague) {
    content = `<div class="detail-section active" id="tabLeague">${renderLeagueSection(tournament)}</div>`;
  } else if (isKnockout) {
    content = `<div class="detail-section active" id="tabKnockout">${renderBracket(tournament)}</div>`;
  }

  if (tournament.champion) {
    content += `
      <div class="champion-banner">
        <div class="champion-trophy-icon">${icon("trophy", 48)}</div>
        <div class="eyebrow">TOURNAMENT CHAMPION</div>
        <h2>${escapeHTML(tournament.champion.teamName)}</h2>
        <p>قهرمان: ${escapeHTML(tournament.champion.playerName)}</p>
        ${tournament.runnerUp ? `<p>نایب‌قهرمان: ${escapeHTML(tournament.runnerUp.teamName)} (${escapeHTML(tournament.runnerUp.playerName)})</p>` : ""}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="detail-hero">
      <div class="eyebrow">${escapeHTML(typeName(tournament.type))}</div>
      <h2>${escapeHTML(tournament.name)}</h2>
      <p>
        ${fa(tournament.players.length)} بازیکن ·
        ${fa(allTeams(tournament).length)} تیم ·
        ${tournament.status === "done" ? "به پایان رسیده" : "در حال برگزاری"}
      </p>
    </div>

    <div class="detail-tabs">
      ${isGroup ? `<button class="detail-tab active" data-detail-tab="tabGroups">گروه‌ها و مسابقات</button>` : ""}
      ${isLeague ? `<button class="detail-tab active" data-detail-tab="tabLeague">جدول و مسابقات لیگ</button>` : ""}
      ${isKnockout ? `<button class="detail-tab active" data-detail-tab="tabKnockout">جدول حذفی</button>` : ""}
    </div>
    ${content}
  `;
}

function showDetail(id) {
  currentTournamentId = id;

  document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
  document.getElementById("detailPage").classList.add("active");

  document.querySelectorAll(".nav-item").forEach(button => button.classList.remove("active"));
  document.getElementById("pageTitle").textContent = "جزئیات تورنمنت";

  renderDetail(getTournament(id));
}

function renderTournamentCard(tournament) {
  const championText = tournament.champion ? `
    <div class="card-champion">
      ${icon("trophy", 15)}
      <span>${escapeHTML(tournament.champion.teamName)}</span>
    </div>
  ` : "";

  return `
    <article class="tournament-card">
      <div class="card-top">
        <span class="type-pill">${escapeHTML(typeName(tournament.type))}</span>
        <span class="card-icon">${icon("ball", 25)}</span>
      </div>

      <h3>${escapeHTML(tournament.name)}</h3>

      <div class="card-meta">
        <span>${icon("user", 14)} ${fa(tournament.players.length)} بازیکن</span>
        <span>${icon("stadium", 14)} ${fa(allTeams(tournament).length)} تیم</span>
      </div>

      <div class="card-status-row">
        <span class="status-pill ${tournament.status === "done" ? "done" : ""}">
          ${tournament.status === "done" ? "پایان‌یافته" : "در حال برگزاری"}
        </span>
      </div>

      ${championText}

      <div class="card-actions">
        <button class="open-btn" data-open-tournament="${tournament.id}">مشاهده تورنمنت</button>
        <button class="delete-btn" data-delete-tournament="${tournament.id}">حذف</button>
      </div>
    </article>
  `;
}

function renderHome() {
  const totalPlayers = tournaments.reduce((sum, tournament) => sum + tournament.players.length, 0);

  const playedMatches = tournaments.reduce((sum, t) => {
    const groupMatches = (t.groups || []).flatMap(group => group.matches);
    const leagueMatches = t.leagueMatches || [];
    const knockoutMatches = (t.knockoutRounds || []).flatMap(round => round.matches);

    return sum + [...groupMatches, ...leagueMatches, ...knockoutMatches].filter(match => match.played).length;
  }, 0);

  document.getElementById("statTournaments").textContent = fa(tournaments.length);
  document.getElementById("statPlayers").textContent = fa(totalPlayers);
  document.getElementById("statMatches").textContent = fa(playedMatches);
  document.getElementById("statChampions").textContent = fa(champions.length);

  const recent = tournaments.slice(0, 3);

  document.getElementById("recentTournaments").innerHTML = recent.length
    ? recent.map(renderTournamentCard).join("")
    : `<div class="empty-state"><b class="empty-icon">${icon("trophy", 38)}</b>هنوز تورنمنتی نساختی.<br>اولین رقابتت را شروع کن!</div>`;
}

function renderTournaments() {
  document.getElementById("allTournaments").innerHTML = tournaments.length
    ? tournaments.map(renderTournamentCard).join("")
    : `<div class="empty-state"><b class="empty-icon">${icon("ball", 38)}</b>هنوز تورنمنتی وجود ندارد.<br>با ساخت تورنمنت جدید شروع کن.</div>`;
}

function renderHistory() {
  document.getElementById("championList").innerHTML = champions.length
    ? champions.map(item => `
      <article class="champion-card">
        <div class="champion-cup">${icon("trophy", 29)}</div>
        <div>
          <h3>${escapeHTML(item.champion)}</h3>
          <p>بازیکن: ${escapeHTML(item.playerName)} · ${escapeHTML(item.tournamentName)}</p>
          ${item.runnerUp ? `<p>نایب‌قهرمان: ${escapeHTML(item.runnerUp)}${item.runnerUpPlayer ? ` · ${escapeHTML(item.runnerUpPlayer)}` : ""}</p>` : ""}
        </div>
        <div class="champion-date">${new Date(item.date).toLocaleDateString("fa-IR")}</div>
      </article>
    `).join("")
    : `<div class="empty-state"><b class="empty-icon">${icon("medal", 38)}</b>هنوز قهرمانی ثبت نشده است.<br>بعد از پایان اولین تورنمنت، قهرمان اینجا نمایش داده می‌شود.</div>`;
}

function renderAll() {
  renderHome();
  renderTournaments();
  renderHistory();
}

function askDelete(id) {
  pendingDeleteId = id;
  const tournament = getTournament(id);

  document.getElementById("confirmTitle").textContent = "حذف تورنمنت";
  document.getElementById("confirmMessage").textContent =
    `آیا از حذف تورنمنت «${tournament?.name || ""}» مطمئنی؟ این عملیات قابل بازگشت نیست.`;

  openModal("confirmModal");
}

function confirmDelete() {
  if (!pendingDeleteId) return;

  const id = pendingDeleteId;
  tournaments = tournaments.filter(tournament => tournament.id !== id);
  champions = champions.filter(champion => champion.tournamentId !== id);

  if (currentTournamentId === id) currentTournamentId = null;

  pendingDeleteId = null;
  saveData();
  closeModal("confirmModal");
  renderAll();
  navigate("tournaments");
  showToast("تورنمنت حذف شد.");
}

/* رویدادها */

document.getElementById("newTournamentBtn").addEventListener("click", () => {
  renderPlayerFields();
  openModal("createModal");
});

document.getElementById("heroNewBtn").addEventListener("click", () => {
  renderPlayerFields();
  openModal("createModal");
});

document.getElementById("listNewBtn").addEventListener("click", () => {
  renderPlayerFields();
  openModal("createModal");
});

document.getElementById("playerCount").addEventListener("change", renderPlayerFields);
document.getElementById("teamsPerPlayer").addEventListener("change", renderPlayerFields);
document.getElementById("tournamentType").addEventListener("change", updateFormOptions);
document.getElementById("tournamentForm").addEventListener("submit", createTournament);

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.page));
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => closeModal(button.dataset.close));
});

document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => navigate(button.dataset.goto));
});

document.getElementById("backToTournaments").addEventListener("click", () => navigate("tournaments"));
document.getElementById("confirmAction").addEventListener("click", confirmDelete);

document.addEventListener("click", event => {
  const openButton = event.target.closest("[data-open-tournament]");
  if (openButton) {
    showDetail(openButton.dataset.openTournament);
    return;
  }

  const deleteButton = event.target.closest("[data-delete-tournament]");
  if (deleteButton) {
    askDelete(deleteButton.dataset.deleteTournament);
    return;
  }

  const scoreButton = event.target.closest("[data-save-match]");
  if (scoreButton) {
    saveMatchScore(scoreButton.dataset.saveMatch);
    return;
  }

  const winnerButton = event.target.closest("[data-tie-winner]");
  if (winnerButton) {
    chooseTieWinner(winnerButton.dataset.tieWinner);
    return;
  }

  const tabButton = event.target.closest("[data-detail-tab]");
  if (tabButton) {
    document.querySelectorAll(".detail-tab").forEach(button => button.classList.remove("active"));
    tabButton.classList.add("active");

    document.querySelectorAll(".detail-section").forEach(section => section.classList.remove("active"));
    document.getElementById(tabButton.dataset.detailTab)?.classList.add("active");
    return;
  }

  if (event.target.id === "startKnockoutBtn") {
    startKnockoutFromGroups();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-backdrop.show").forEach(modal => modal.classList.remove("show"));
  }
});

renderPlayerFields();
updateFormOptions();
renderAll();
