"use strict";

/* KICKOFF - Tournament Manager */

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

function showToast(message) {
  const toast = document.getElementById("toast");
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

function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

  const pageElement = document.getElementById(page + "Page");
  if (pageElement) pageElement.classList.add("active");

  const nav = document.querySelector(`[data-page="${page}"]`);
  if (nav) nav.classList.add("active");

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

/* ساخت فرم بازیکنان */

function renderPlayerFields() {
  const count = Number(document.getElementById("playerCount").value);
  const teamCount = Number(document.getElementById("teamsPerPlayer").value);
  const container = document.getElementById("playersFields");

  container.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="player-form-card">
      <h4>بازیکن ${fa(i + 1)}</h4>
      <label>نام بازیکن
        <input required maxlength="35" data-player-name="${i}" placeholder="نام بازیکن ${fa(i + 1)}">
      </label>
      ${Array.from({ length: teamCount }, (_, j) => `
        <label>تیم ${fa(j + 1)}
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

  document.getElementById("qualifyField").style.display = isGroups ? "grid" : "none";
  document.getElementById("winPointsField").style.display =
    (type === "groups" || type === "combined" || type === "league") ? "grid" : "none";
  document.getElementById("drawPointsField").style.display =
    (type === "groups" || type === "combined" || type === "league") ? "grid" : "none";
}

/* برنامه مسابقات دوره‌ای */

function roundRobin(teams, prefix) {
  const list = [...teams];
  if (list.length < 2) return [];

  if (list.length % 2 !== 0) list.push(null);

  const size = list.length;
  const rounds = size - 1;
  const half = size / 2;
  const matches = [];
  let matchNumber = 0;

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < half; i++) {
      const home = list[i];
      const away = list[size - 1 - i];

      if (home && away) {
        matches.push({
          id: uid(),
          prefix,
          round: round + 1,
          number: ++matchNumber,
          home: home.id,
          away: away.id,
          homeScore: null,
          awayScore: null,
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
      const input = document.querySelector(
        `[data-player-team="${i}"][data-team-index="${j}"]`
      );
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

    players.push({
      id: "player-" + i,
      name: playerName,
      teams
    });
  }

  const teams = players.flatMap(p => p.teams);

  if (type === "knockout" && teams.length < 2) {
    showToast("برای مسابقات حذفی حداقل دو تیم لازم است.");
    return;
  }

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

/* سیستم حذفی */

function createKnockoutRound(teams) {
  const list = [...teams];
  const matches = [];
  const size = list.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(size)));
  const byeCount = bracketSize - size;

  // برای جلوگیری از برخورد زودهنگام تیم‌های یک بازیکن،
  // تیم‌ها ابتدا بر اساس صاحب تیم مرتب می‌شوند.
  const ordered = [];
  const owners = [...new Set(list.map(t => t.playerId))];

  let remaining = [...list];

  while (remaining.length) {
    let added = false;
    for (const owner of owners) {
      const index = remaining.findIndex(t => t.playerId === owner);
      if (index !== -1) {
        ordered.push(remaining.splice(index, 1)[0]);
        added = true;
      }
    }
    if (!added) break;
  }

  // تیم‌های دارای BYE در جایگاه‌های ابتدایی قرار می‌گیرند.
  const seeded = [];
  const normalCount = size - byeCount;

  for (let i = 0; i < byeCount; i++) {
    seeded.push({ team: ordered[i], bye: true });
  }
  for (let i = byeCount; i < ordered.length; i++) {
    seeded.push({ team: ordered[i], bye: false });
  }

  // چینش جایگاه‌ها برای توزیع BYE
  const slots = Array(bracketSize).fill(null);
  const byeSlots = [0, bracketSize - 1];

  let slotIndex = 0;
  for (let i = 0; i < byeCount; i++) {
    const position = Math.floor(i * bracketSize / byeCount);
    slots[position] = ordered[i];
  }

  const unplaced = ordered.slice(byeCount);
  const freePositions = slots.map((v, i) => v === null ? i : -1).filter(i => i >= 0);

  freePositions.forEach((position, i) => {
    slots[position] = unplaced[i] || null;
  });

  for (let i = 0; i < bracketSize; i += 2) {
    const home = slots[i];
    const away = slots[i + 1];

    matches.push({
      id: uid(),
      home: home?.id || null,
      away: away?.id || null,
      homeScore: null,
      awayScore: null,
      winner: null,
      played: false,
      bye: !home || !away
    });
  }

  return {
    name: roundName(bracketSize),
    matches
  };
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

  if (!last || !last.matches.every(m => m.played)) return;

  const winners = last.matches.map(m => m.winner).filter(Boolean);

  if (winners.length === 1) {
    finishTournament(tournament, winners[0], null);
    return;
  }

  if (winners.length < 2) return;
  if (rounds.length > 0 && rounds[rounds.length - 1].matches.length === 1) return;

  const alreadyCreated = rounds.length > 1 &&
    rounds[rounds.length - 1].matches.every(m => m.played);

  if (alreadyCreated && rounds.length > 1) return;

  const nextMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({
      id: uid(),
      home: winners[i],
      away: winners[i + 1] || null,
      homeScore: null,
      awayScore: null,
      winner: winners[i + 1] ? null : winners[i],
      played: !winners[i + 1],
      bye: !winners[i + 1]
    });
  }

  const nextSize = winners.length;
  rounds.push({
    name: roundName(nextSize),
    matches: nextMatches
  });

  if (nextMatches.every(m => m.played)) {
    buildNextRound(tournament);
  }
}

/* جدول لیگ و گروه */

function getStandings(tournament, teamIds, matches) {
  const teams = allTeams(tournament);
  const rows = teamIds.map(id => {
    const team = teams.find(t => t.id === id);
    return {
      id,
      name: team?.name || "تیم حذف‌شده",
      playerName: team?.playerName || "",
      played: 0,
      win: 0,
      draw: 0,
      loss: 0,
      gf: 0,
      ga: 0,
      points: 0
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

  rows.forEach(t => t.diff = t.gf - t.ga);

  return rows.sort((a, b) =>
    b.points - a.points ||
    b.diff - a.diff ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name, "fa")
  );
}

function teamById(tournament, id) {
  return allTeams(tournament).find(t => t.id === id);
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
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* ثبت نتیجه مسابقه */

function findMatch(tournament, matchId) {
  for (const group of tournament.groups || []) {
    const match = group.matches.find(m => m.id === matchId);
    if (match) return { match, group };
  }

  const league = (tournament.leagueMatches || []).find(m => m.id === matchId);
  if (league) return { match: league, group: null };

  for (const round of tournament.knockoutRounds || []) {
    const match = round.matches.find(m => m.id === matchId);
    if (match) return { match, round };
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
    homeInput.value === "" ||
    awayInput.value === "" ||
    !Number.isInteger(homeScore) ||
    !Number.isInteger(awayScore) ||
    homeScore < 0 ||
    awayScore < 0 ||
    homeScore > 99 ||
    awayScore > 99
  ) {
    showToast("نتیجه معتبر وارد کن.");
    return;
  }

  const match = found.match;

  if (match.home === null || match.away === null) {
    showToast("این مسابقه هنوز دو تیم ندارد.");
    return;
  }

  if (match.round !== undefined || tournament.type === "knockout") {
    if (homeScore === awayScore) {
      pendingTie = { matchId, homeScore, awayScore };
      showWinnerChoices(tournament, match);
      return;
    }

    match.winner = homeScore > awayScore ? match.home : match.away;
  }

  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.played = true;

  if (tournament.type === "knockout") {
    buildNextRound(tournament);
  }

  saveData();
  renderDetail(tournament);
  showToast("نتیجه مسابقه ثبت شد.");
}

function showWinnerChoices(tournament, match) {
  const home = teamById(tournament, match.home);
  const away = teamById(tournament, match.away);

  document.getElementById("winnerChoices").innerHTML = `
    <button data-tie-winner="${match.home}">${escapeHTML(home?.name || "تیم اول")}</button>
    <button data-tie-winner="${match.away}">${escapeHTML(away?.name || "تیم دوم")}</button>
  `;

  openModal("winnerModal");
}

function chooseTieWinner(winnerId) {
  if (!pendingTie) return;

  const tournament = getTournament();
  if (!tournament) return;

  const found = findMatch(tournament, pendingTie.matchId);
  if (!found) return;

  found.match.homeScore = pendingTie.homeScore;
  found.match.awayScore = pendingTie.awayScore;
  found.match.winner = winnerId;
  found.match.played = true;

  pendingTie = null;
  closeModal("winnerModal");

  buildNextRound(tournament);
  saveData();
  renderDetail(tournament);
  showToast("برنده مسابقه مشخص شد.");
}

/* صعود از گروه‌ها به حذفی */

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

  const qualified = [];

  tournament.groups.forEach(group => {
    const standings = getStandings(tournament, group.teams, group.matches);
    standings.slice(0, tournament.qualifyCount).forEach(team => {
      qualified.push(teamById(tournament, team.id));
    });
  });

  if (qualified.length < 2) {
    showToast("تعداد تیم‌های صعودکننده کافی نیست.");
    return;
  }

  tournament.knockoutRounds = [createKnockoutRound(qualified)];
  tournament.status = "active";
  advanceByes(tournament);

  saveData();
  renderDetail(tournament);
  showToast("مرحله حذفی آغاز شد.");
}

/* پایان تورنمنت */

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

/* نمایش مسابقات */

function renderMatch(match, tournament, knockout = false) {
  const home = teamById(tournament, match.home);
  const away = teamById(tournament, match.away);

  const homeName = home?.name || "استراحت";
  const awayName = away?.name || "استراحت";

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

  return `
    <div class="match-card">
      <div class="match-team">${escapeHTML(homeName)}</div>
      <div class="score-inputs">
        <input type="number" min="0" max="99" inputmode="numeric"
          aria-label="گل ${escapeHTML(homeName)}"
          data-score-home="${match.id}"
          value="${match.homeScore ?? ""}"
          ${tournament.status === "done" ? "disabled" : ""}>
        <span>:</span>
        <input type="number" min="0" max="99" inputmode="numeric"
          aria-label="گل ${escapeHTML(awayName)}"
          data-score-away="${match.id}"
          value="${match.awayScore ?? ""}"
          ${tournament.status === "done" ? "disabled" : ""}>
      </div>
      <div class="match-team">${escapeHTML(awayName)}</div>
      ${tournament.status === "done"
        ? `<span class="match-status">پایان‌یافته</span>`
        : `<button class="save-score" data-save-match="${match.id}">ثبت نتیجه</button>`}
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
          ${renderStandings(
            tournament,
            group.teams,
            group.matches,
            tournament.qualifyCount
          )}
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
          : `<p class="mini-note">پس از ثبت تمام نتایج گروهی، مرحله حذفی را شروع کن.</p>`}
        ${tournament.status !== "done" && !tournament.knockoutRounds.length
          ? `<button class="primary-btn" id="startKnockoutBtn">شروع مرحله حذفی ←</button>`
          : ""}
      </div>
    ` : ""}
  `;
}

function renderLeagueSection(tournament) {
  const ids = allTeams(tournament).map(t => t.id);
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
    <div class="bracket-scroll">
      <div class="bracket">
        ${tournament.knockoutRounds.map(round => `
          <div class="bracket-round">
            <h3>${escapeHTML(round.name)}</h3>
            ${round.matches.map(match => {
              const home = teamById(tournament, match.home);
              const away = teamById(tournament, match.away);
              const homeWinner = match.winner === match.home;
              const awayWinner = match.winner === match.away;

              return `
                <div class="bracket-match">
                  <div class="bracket-team ${homeWinner ? "winner" : ""}">
                    <span>${escapeHTML(home?.name || "استراحت")}</span>
                    ${match.played ? `<b>${fa(match.homeScore ?? 0)}</b>` : ""}
                  </div>
                  <div class="bracket-team ${awayWinner ? "winner" : ""}">
                    <span>${escapeHTML(away?.name || "استراحت")}</span>
                    ${match.played ? `<b>${fa(match.awayScore ?? 0)}</b>` : ""}
                  </div>
                  ${!match.played && tournament.status !== "done" && match.home && match.away ? `
                    <div class="bracket-actions">
                      <input type="number" min="0" max="99" inputmode="numeric"
                        placeholder="گل ۱" data-score-home="${match.id}">
                      <input type="number" min="0" max="99" inputmode="numeric"
                        placeholder="گل ۲" data-score-away="${match.id}">
                      <button class="save-score" data-save-match="${match.id}">ثبت</button>
                    </div>
                  ` : ""}
                  ${match.bye ? `<small class="match-status">صعود مستقیم</small>` : ""}
                </div>
              `;
            }).join("")}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* صفحه جزئیات */

function renderDetail(tournament) {
  const container = document.getElementById("tournamentDetail");
  if (!tournament) return;

  const isGroup = tournament.type === "groups" || tournament.type === "combined";
  const isLeague = tournament.type === "league";
  const isKnockout = tournament.type === "knockout";

  let content = "";

  if (isGroup) {
    content = `
      <div class="detail-section active" id="tabGroups">
        ${renderGroupSection(tournament)}
      </div>
    `;
  } else if (isLeague) {
    content = `
      <div class="detail-section active" id="tabLeague">
        ${renderLeagueSection(tournament)}
      </div>
    `;
  } else {
    content = `
      <div class="detail-section active" id="tabKnockout">
        ${renderBracket(tournament)}
      </div>
    `;
  }

  if (tournament.champion) {
    content += `
      <div class="champion-banner">
        <div class="trophy">🏆</div>
        <div class="eyebrow">TOURNAMENT CHAMPION</div>
        <h2>${escapeHTML(tournament.champion.teamName)}</h2>
        <p>قهرمان: ${escapeHTML(tournament.champion.playerName)}</p>
        ${tournament.runnerUp ? `
          <p>نایب‌قهرمان: ${escapeHTML(tournament.runnerUp.teamName)}</p>
        ` : ""}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="detail-hero">
      <div class="eyebrow">${escapeHTML(typeName(tournament.type))}</div>
      <h2>${escapeHTML(tournament.name)}</h2>
      <p>
        ${fa(tournament.players.length)} بازیکن
        · ${fa(allTeams(tournament).length)} تیم
        · ${tournament.status === "done" ? "به پایان رسیده" : "در حال برگزاری"}
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
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("detailPage").classList.add("active");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.getElementById("pageTitle").textContent = "جزئیات تورنمنت";
  renderDetail(getTournament(id));
}

function renderTournamentCard(tournament) {
  const championText = tournament.champion
    ? `<div class="card-champion">🏆 ${escapeHTML(tournament.champion.teamName)}</div>`
    : "";

  return `
    <article class="tournament-card">
      <div class="card-top">
        <span class="type-pill">${escapeHTML(typeName(tournament.type))}</span>
        <span class="card-icon">⚽</span>
      </div>
      <h3>${escapeHTML(tournament.name)}</h3>
      <div class="card-meta">
        <span>👤 ${fa(tournament.players.length)} بازیکن</span>
        <span>🏟 ${fa(allTeams(tournament).length)} تیم</span>
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
  const totalPlayers = tournaments.reduce((sum, t) => sum + t.players.length, 0);
  const playedMatches = tournaments.reduce((sum, t) => {
    const groupMatches = (t.groups || []).flatMap(g => g.matches);
    const leagueMatches = t.leagueMatches || [];
    const knockoutMatches = (t.knockoutRounds || []).flatMap(r => r.matches);
    return sum + [...groupMatches, ...leagueMatches, ...knockoutMatches].filter(m => m.played).length;
  }, 0);

  document.getElementById("statTournaments").textContent = fa(tournaments.length);
  document.getElementById("statPlayers").textContent = fa(totalPlayers);
  document.getElementById("statMatches").textContent = fa(playedMatches);
  document.getElementById("statChampions").textContent = fa(champions.length);

  const recent = tournaments.slice(0, 3);
  document.getElementById("recentTournaments").innerHTML = recent.length
    ? recent.map(renderTournamentCard).join("")
    : `<div class="empty-state"><b>🏆</b>هنوز تورنمنتی نساختی.<br>اولین رقابتت را شروع کن!</div>`;
}

function renderTournaments() {
  document.getElementById("allTournaments").innerHTML = tournaments.length
    ? tournaments.map(renderTournamentCard).join("")
    : `<div class="empty-state"><b>⚽</b>هنوز تورنمنتی وجود ندارد.<br>با ساخت تورنمنت جدید شروع کن.</div>`;
}

function renderHistory() {
  document.getElementById("championList").innerHTML = champions.length
    ? champions.map(item => `
      <article class="champion-card">
        <div class="champion-cup">🏆</div>
        <div>
          <h3>${escapeHTML(item.champion)}</h3>
          <p>بازیکن: ${escapeHTML(item.playerName)} · ${escapeHTML(item.tournamentName)}</p>
          ${item.runnerUp ? `<p>نایب‌قهرمان: ${escapeHTML(item.runnerUp)}</p>` : ""}
        </div>
        <div class="champion-date">${new Date(item.date).toLocaleDateString("fa-IR")}</div>
      </article>
    `).join("")
    : `<div class="empty-state"><b>♛</b>هنوز قهرمانی ثبت نشده است.<br>بعد از پایان اولین تورنمنت، قهرمان اینجا نمایش داده می‌شود.</div>`;
}

function renderAll() {
  renderHome();
  renderTournaments();
  renderHistory();
}

/* حذف تورنمنت */

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
  tournaments = tournaments.filter(t => t.id !== id);
  champions = champions.filter(c => c.tournamentId !== id);

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

document.getElementById("backToTournaments").addEventListener("click", () => {
  navigate("tournaments");
});

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
    document.querySelectorAll(".detail-tab").forEach(b => b.classList.remove("active"));
    tabButton.classList.add("active");
    document.querySelectorAll(".detail-section").forEach(s => s.classList.remove("active"));
    document.getElementById(tabButton.dataset.detailTab)?.classList.add("active");
    return;
  }

  if (event.target.id === "startKnockoutBtn") {
    startKnockoutFromGroups();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-backdrop.show").forEach(modal => {
      modal.classList.remove("show");
    });
  }
});

/* راه‌اندازی اولیه */

renderPlayerFields();
updateFormOptions();
renderAll();
