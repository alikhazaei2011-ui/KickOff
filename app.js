
"use strict";

/* =====================================
   KICKOFF - Tournament Manager
   Yellow & Red Cards Update
===================================== */

const STORAGE_KEY = "kickoff_tournaments_v3";
const HISTORY_KEY = "kickoff_champions";

let tournaments = loadData(STORAGE_KEY, []);
let champions = loadData(HISTORY_KEY, []);
let currentTournamentId = null;
let pendingDeleteId = null;
let pendingTie = null;
let toastTimer = null;

/* =====================================
   ابزارهای عمومی
===================================== */

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
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
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

/* =====================================
   منوی صفحات
===================================== */

function navigate(page) {
  document.querySelectorAll(".page").forEach(p => {
    p.classList.remove("active");
  });

  document.querySelectorAll(".nav-item").forEach(b => {
    b.classList.remove("active");
  });

  const pageElement = document.getElementById(page + "Page");

  if (pageElement) {
    pageElement.classList.add("active");
  }

  const nav = document.querySelector(`[data-page="${page}"]`);

  if (nav) {
    nav.classList.add("active");
  }

  const titles = {
    home: "داشبورد",
    tournaments: "تورنمنت‌ها",
    history: "تالار قهرمانان"
  };

  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle) {
    pageTitle.textContent = titles[page] || "KICKOFF";
  }

  if (page === "home") renderHome();
  if (page === "tournaments") renderTournaments();
  if (page === "history") renderHistory();
}

/* =====================================
   فرم ساخت تورنمنت
===================================== */

function renderPlayerFields() {
  const count = Number(document.getElementById("playerCount").value);
  const teamCount = Number(document.getElementById("teamsPerPlayer").value);

  const container = document.getElementById("playersFields");

  container.innerHTML = Array.from({ length: count }, (_, i) => `
    <div class="player-form-card">
      <h4>بازیکن ${fa(i + 1)}</h4>

      <label>
        نام بازیکن
        <input
          required
          maxlength="35"
          data-player-name="${i}"
          placeholder="نام بازیکن ${fa(i + 1)}"
        >
      </label>

      ${Array.from({ length: teamCount }, (_, j) => `
        <label>
          تیم ${fa(j + 1)}
          <input
            required
            maxlength="35"
            data-player-team="${i}"
            data-team-index="${j}"
            placeholder="نام تیم ${fa(j + 1)}"
          >
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

  document.getElementById("qualifyField").style.display =
    isGroups ? "grid" : "none";

  document.getElementById("winPointsField").style.display =
    (isGroups || isLeague) ? "grid" : "none";

  document.getElementById("drawPointsField").style.display =
    (isGroups || isLeague) ? "grid" : "none";
}

/* =====================================
   ساخت برنامه مسابقات
===================================== */

function roundRobin(teams, prefix) {
  const list = [...teams];

  if (list.length < 2) return [];

  if (list.length % 2 !== 0) {
    list.push(null);
  }

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

/* =====================================
   گروه‌بندی خودکار
   هر گروه یک تیم از هر بازیکن دارد
===================================== */

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

/* =====================================
   ساخت تورنمنت
===================================== */

function createTournament(event) {
  event.preventDefault();

  const name = document.getElementById("tournamentName").value.trim();
  const type = document.getElementById("tournamentType").value;

  const playerCount = Number(
    document.getElementById("playerCount").value
  );

  const teamCount = Number(
    document.getElementById("teamsPerPlayer").value
  );

  if (!name) {
    showToast("نام تورنمنت را وارد کن.");
    return;
  }

  const players = [];

  for (let i = 0; i < playerCount; i++) {
    const nameInput = document.querySelector(
      `[data-player-name="${i}"]`
    );

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
        showToast(
          `نام تیم ${fa(j + 1)} بازیکن ${fa(i + 1)} را وارد کن.`
        );

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

  const teams = players.flatMap(player => player.teams);

  const tournament = {
    id: uid(),
    name,
    type,
    players,
    createdAt: new Date().toISOString(),
    status: "active",

    winPoints: Number(
      document.getElementById("winPoints").value
    ) || 3,

    drawPoints: Number(
      document.getElementById("drawPoints").value
    ) || 1,

    qualifyCount: Number(
      document.getElementById("qualifyCount").value
    ) || 2,

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
    tournament.knockoutRounds = [
      createKnockoutRound(teams)
    ];

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

/* =====================================
   سیستم حذفی
===================================== */

function createKnockoutRound(teams) {
  const list = [...teams];

  if (list.length < 2) {
    return {
      name: "فینال",
      matches: []
    };
  }

  const bracketSize = Math.pow(
    2,
    Math.ceil(Math.log2(list.length))
  );

  const byeCount = bracketSize - list.length;

  const ordered = [];
  const owners = [...new Set(list.map(t => t.playerId))];
  let remaining = [...list];

  while (remaining.length) {
    let added = false;

    for (const owner of owners) {
      const index = remaining.findIndex(
        team => team.playerId === owner
      );

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

  const freePositions = slots
    .map((value, index) => value === null ? index : -1)
    .filter(index => index >= 0);

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

  if (!last || !last.matches.every(match => match.played)) {
    return;
  }

  const winners = last.matches
    .map(match => match.winner)
    .filter(Boolean);

  if (winners.length === 1) {
    finishTournament(tournament, winners[0], null);
    return;
  }

  if (winners.length < 2) return;

  if (last.matches.length === 1) return;

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

  rounds.push({
    name: roundName(winners.length),
    matches: nextMatches
  });

  if (nextMatches.every(match => match.played)) {
    buildNextRound(tournament);
  }
}

/* =====================================
   سیستم کارت‌ها
===================================== */

function readMatchCards(matchId) {
  const read = key => {
    const input = document.querySelector(
      `[data-card-${key}="${matchId}"]`
    );

    const value = input ? Number(input.value || 0) : 0;

    if (
      !Number.isInteger(value) ||
      value < 0 ||
      value > 20
    ) {
      return null;
    }

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
          🟨
          <input
            type="number"
            min="0"
            max="20"
            inputmode="numeric"
            aria-label="کارت زرد تیم اول"
            data-card-home-yellow="${match.id}"
            value="${cardValue(match, "homeYellow")}"
            ${lock}
          >
        </label>

        <label>
          🟥
          <input
            type="number"
            min="0"
            max="20"
            inputmode="numeric"
            aria-label="کارت قرمز تیم اول"
            data-card-home-red="${match.id}"
            value="${cardValue(match, "homeRed")}"
            ${lock}
          >
        </label>
      </div>

      <div class="team-card-inputs">
        <span class="card-team-label">کارت تیم دوم</span>

        <label>
          🟨
          <input
            type="number"
            min="0"
            max="20"
            inputmode="numeric"
            aria-label="کارت زرد تیم دوم"
            data-card-away-yellow="${match.id}"
            value="${cardValue(match, "awayYellow")}"
            ${lock}
          >
        </label>

        <label>
          🟥
          <input
            type="number"
            min="0"
            max="20"
            inputmode="numeric"
            aria-label="کارت قرمز تیم دوم"
            data-card-away-red="${match.id}"
            value="${cardValue(match, "awayRed")}"
            ${lock}
          >
        </label>
      </div>

    </div>
  `;
}

/* =====================================
   جدول امتیازات
===================================== */

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
    if (
      !match.played ||
      match.homeScore === null ||
      match.awayScore === null
    ) {
      return;
    }

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

    // جمع کارت‌های هر تیم
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
      // مساوی در گروهی و لیگ مجاز است.
      home.draw++;
      away.draw++;

      home.points += tournament.drawPoints;
      away.points += tournament.drawPoints;
    }
  });

  rows.forEach(team => {
    team.diff = team.gf - team.ga;
  });

  return rows.sort((a, b) =>
    b.points - a.points ||
    b.diff - a.diff ||
    b.gf - a.gf ||
    a.red - b.red ||
    a.yellow - b.yellow ||
    a.name.localeCompare(b.name, "fa")
  );
}

function renderStandings(
  tournament,
  teamIds,
  matches,
  qualify = 0
) {
  const rows = getStandings(tournament, teamIds, matches);

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>تیم</th>
            <th>بازی</th>
            <th>برد</th>
            <th>مساوی</th>
            <th>باخت</th>
            <th>گل زده</th>
            <th>تفاضل</th>
            <th>امتیاز</th>
            <th>🟨</th>
            <th>🟥</th>
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

    <p class="mini-note">
      ترتیب رتبه‌بندی: امتیاز، تفاضل گل، گل زده،
      کارت قرمز کمتر و سپس کارت زرد کمتر.
    </p>
  `;
}

/* =====================================
   پیدا کردن مسابقه
===================================== */

function findMatch(tournament, matchId) {
  for (const group of tournament.groups || []) {
    const match = group.matches.find(
      m => m.id === matchId
    );

    if (match) {
      return {
        match,
        group,
        stage: "group"
      };
    }
  }

  const league = (tournament.leagueMatches || []).find(
    m => m.id === matchId
  );

  if (league) {
    return {
      match: league,
      stage: "league"
    };
  }

  for (const round of tournament.knockoutRounds || []) {
    const match = round.matches.find(
      m => m.id === matchId
    );

    if (match) {
      return {
        match,
        round,
        stage: "knockout"
      };
    }
  }

  return null;
}

/* =====================================
   ثبت نتیجه مسابقه
===================================== */

function saveMatchScore(matchId) {
  const tournament = getTournament();

  if (!tournament) return;

  const found = findMatch(tournament, matchId);

  if (!found) return;

  const homeInput = document.querySelector(
    `[data-score-home="${matchId}"]`
  );

  const awayInput = document.querySelector(
    `[data-score-away="${matchId}"]`
  );

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

  if (!match.home || !match.away) {
    showToast("این مسابقه هنوز دو تیم ندارد.");
    return;
  }

  const cards = readMatchCards(matchId);

  if (!cards) return;

  const isKnockoutMatch = found.stage === "knockout";

  if (isKnockoutMatch && homeScore === awayScore) {
    pendingTie = {
      matchId,
      homeScore,
      awayScore,
      cards
    };

    showWinnerChoices(tournament, match);
    return;
  }

  if (isKnockoutMatch) {
    match.winner =
      homeScore > awayScore
        ? match.home
        : match.away;
  }

  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.played = true;

  saveMatchCards(match, cards);

  if (isKnockoutMatch) {
    buildNextRound(tournament);
  }

  saveData();

  renderDetail(tournament);

  showToast("نتیجه و کارت‌های مسابقه ثبت شد.");
}

/* =====================================
   انتخاب برنده پنالتی
===================================== */

function showWinnerChoices(tournament, match) {
  const home = teamById(tournament, match.home);
  const away = teamById(tournament, match.away);

  document.getElementById("winnerChoices").innerHTML = `
    <button data-tie-winner="${match.home}">
      ${escapeHTML(home?.name || "تیم اول")}
    </button>

    <button data-tie-winner="${match.away}">
      ${escapeHTML(away?.name || "تیم دوم")}
    </button>
  `;

  openModal("winnerModal");
}

function chooseTieWinner(winnerId) {
  if (!pendingTie) return;

  const tournament = getTournament();

  if (!tournament) return;

  const found = findMatch(
    tournament,
    pendingTie.matchId
  );

  if (!found || found.stage !== "knockout") return;

  if (
    winnerId !== found.match.home &&
    winnerId !== found.match.away
  ) {
    return;
  }

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

/* =====================================
   شروع مرحله حذفی در تورنمنت ترکیبی
===================================== */

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
    const standings = getStandings(
      tournament,
      group.teams,
      group.matches
    );

    standings
      .slice(0, tournament.qualifyCount)
      .forEach(team => {
        qualified.push(teamById(tournament, team.id));
      });
  });

  if (qualified.length < 2) {
    showToast("تعداد تیم‌های صعودکننده کافی نیست.");
    return;
  }

  tournament.knockoutRounds = [
    createKnockoutRound(qualified)
  ];

  advanceByes(tournament);

  saveData();

  renderDetail(tournament);

  showToast("مرحله حذفی آغاز شد.");
}

/* =====================================
   ثبت قهرمان
===================================== */

function finishTournament(
  tournament,
  championId,
  runnerUpId
) {
  if (tournament.status === "done") return;

  const champion = teamById(tournament, championId);

  const runnerUp = runnerUpId
    ? teamById(tournament, runnerUpId)
    : null;

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

/* =====================================
   نمایش مسابقات
===================================== */

function renderMatch(match, tournament) {
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

  const disabled = tournament.status === "done"
    ? "disabled"
    : "";

  return `
    <div class="match-card">

      <div class="match-team">
        ${escapeHTML(homeName)}
      </div>

      <div class="score-inputs">
        <input
          type="number"
          min="0"
          max="99"
          inputmode="numeric"
          aria-label="گل ${escapeHTML(homeName)}"
          data-score-home="${match.id}"
          value="${match.homeScore ?? ""}"
          ${disabled}
        >

        <span>:</span>

        <input
          type="number"
          min="0"
          max="99"
          inputmode="numeric"
          aria-label="گل ${escapeHTML(awayName)}"
          data-score-away="${match.id}"
          value="${match.awayScore ?? ""}"
          ${disabled}
        >
      </div>

      <div class="match-team">
        ${escapeHTML(awayName)}
      </div>

      ${renderCardInputs(match, tournament.status === "done")}

      ${tournament.status === "done"
        ? `<span class="match-status">پایان‌یافته</span>`
        : `<button class="save-score" data-save-match="${match.id}">
            ثبت نتیجه و کارت‌ها
          </button>`
      }

    </div>
  `;
}

/* =====================================
   نمایش گروه‌ها
===================================== */

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
      <h3 class="subheading">
        مسابقات گروه ${escapeHTML(group.name)}
      </h3>

      <div class="match-list">
        ${group.matches.map(match =>
          renderMatch(match, tournament)
        ).join("")}
      </div>
    `).join("")}

    ${tournament.type === "combined" ? `

      <div class="form-section">

        <h3 class="subheading">مرحله حذفی</h3>

        ${tournament.knockoutRounds.length
          ? renderBracket(tournament)
          : `
            <p class="mini-note">
              بعد از پایان تمام مسابقات گروهی،
              تیم‌های برتر هر گروه به مرحله حذفی صعود می‌کنند.
            </p>
          `
        }

        ${tournament.status !== "done" &&
          !tournament.knockoutRounds.length
          ? `
            <button
              class="primary-btn"
              id="startKnockoutBtn"
            >
              شروع مرحله حذفی ←
            </button>
          `
          : ""
        }

      </div>

    ` : ""}
  `;
}

/* =====================================
   نمایش لیگ
===================================== */

function renderLeagueSection(tournament) {
  const ids = allTeams(tournament).map(team => team.id);

  return `
    <h3 class="subheading">جدول لیگ</h3>

    ${renderStandings(
      tournament,
      ids,
      tournament.leagueMatches
    )}

    <h3 class="subheading">برنامه مسابقات</h3>

    <div class="match-list">

      ${tournament.leagueMatches.map(match => `
        <div>
          <div class="match-status">
            هفته ${fa(match.round)}
          </div>

          ${renderMatch(match, tournament)}
        </div>
      `).join("")}

    </div>
  `;
}

/* =====================================
   نمایش جدول حذفی
===================================== */

function renderBracket(tournament) {
  if (!tournament.knockoutRounds.length) {
    return `
      <div class="empty-state">
        هنوز مرحله حذفی ساخته نشده است.
      </div>
    `;
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
                    <span>
                      ${escapeHTML(home?.name || "استراحت")}
                    </span>

                    ${match.played
                      ? `<b>${fa(match.homeScore ?? 0)}</b>`
                      : ""
                    }
                  </div>

                  <div class="bracket-team ${awayWinner ? "winner" : ""}">
                    <span>
                      ${escapeHTML(away?.name || "استراحت")}
                    </span>

                    ${match.played
                      ? `<b>${fa(match.awayScore ?? 0)}</b>`
                      : ""
                    }
                  </div>

                  ${!match.played &&
                    tournament.status !== "done" &&
                    match.home &&
                    match.away
                    ? `
                      <div class="bracket-actions">

                        <input
                          type="number"
                          min="0"
                          max="99"
                          inputmode="numeric"
                          placeholder="گل ۱"
                          data-score-home="${match.id}"
                        >

                        <input
                          type="number"
                          min="0"
                          max="99"
                          inputmode="numeric"
                          placeholder="گل ۲"
                          data-score-away="${match.id}"
                        >

                      </div>

                      ${renderCardInputs(match)}

                      <button
                        class="save-score"
                        data-save-match="${match.id}"
                      >
                        ثبت نتیجه و کارت‌ها
                      </button>
                    `
                    : ""
                  }

                  ${match.bye
                    ? `<small class="match-status">صعود مستقیم</small>`
                    : ""
                  }

                  ${match.played && !match.bye ? `
                    <div class="match-card-summary">
                      🟨 ${fa(cardValue(match, "homeYellow"))}
                      /
                      ${fa(cardValue(match, "awayYellow"))}
                      &nbsp;&nbsp;
                      🟥 ${fa(cardValue(match, "homeRed"))}
                      /
                      ${fa(cardValue(match, "awayRed"))}
                    </div>
                  ` : ""}

                </div>
              `;
            }).join("")}

          </div>

        `).join("")}

      </div>
    </div>
  `;
}

/* =====================================
   صفحه جزئیات تورنمنت
===================================== */

function renderDetail(tournament) {
  const container = document.getElementById("tournamentDetail");

  if (!tournament) return;

  const isGroup =
    tournament.type === "groups" ||
    tournament.type === "combined";

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
  } else if (isKnockout) {
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

        <div class="eyebrow">
          TOURNAMENT CHAMPION
        </div>

        <h2>
          ${escapeHTML(tournament.champion.teamName)}
        </h2>

        <p>
          قهرمان:
          ${escapeHTML(tournament.champion.playerName)}
        </p>

        ${tournament.runnerUp ? `
          <p>
            نایب‌قهرمان:
            ${escapeHTML(tournament.runnerUp.teamName)}
          </p>
        ` : ""}

      </div>
    `;
  }

  container.innerHTML = `
    <div class="detail-hero">

      <div class="eyebrow">
        ${escapeHTML(typeName(tournament.type))}
      </div>

      <h2>${escapeHTML(tournament.name)}</h2>

      <p>
        ${fa(tournament.players.length)} بازیکن
        ·
        ${fa(allTeams(tournament).length)} تیم
        ·
        ${tournament.status === "done"
          ? "به پایان رسیده"
          : "در حال برگزاری"
        }
      </p>

    </div>

    <div class="detail-tabs">

      ${isGroup
        ? `<button class="detail-tab active" data-detail-tab="tabGroups">
            گروه‌ها و مسابقات
          </button>`
        : ""
      }

      ${isLeague
        ? `<button class="detail-tab active" data-detail-tab="tabLeague">
            جدول و مسابقات لیگ
          </button>`
        : ""
      }

      ${isKnockout
        ? `<button class="detail-tab active" data-detail-tab="tabKnockout">
            جدول حذفی
          </button>`
        : ""
      }

    </div>

    ${content}
  `;
}

function showDetail(id) {
  currentTournamentId = id;

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active");
  });

  document.getElementById("detailPage").classList.add("active");

  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.remove("active");
  });

  document.getElementById("pageTitle").textContent =
    "جزئیات تورنمنت";

  renderDetail(getTournament(id));
}

/* =====================================
   کارت تورنمنت
===================================== */

function renderTournamentCard(tournament) {
  const championText = tournament.champion
    ? `
      <div class="card-champion">
        🏆 ${escapeHTML(tournament.champion.teamName)}
      </div>
    `
    : "";

  return `
    <article class="tournament-card">

      <div class="card-top">

        <span class="type-pill">
          ${escapeHTML(typeName(tournament.type))}
        </span>

        <span class="card-icon">⚽</span>

      </div>

      <h3>${escapeHTML(tournament.name)}</h3>

      <div class="card-meta">
        <span>👤 ${fa(tournament.players.length)} بازیکن</span>
        <span>🏟 ${fa(allTeams(tournament).length)} تیم</span>
      </div>

      ${championText}

      <div class="card-actions">

        <button
          class="open-btn"
          data-open-tournament="${tournament.id}"
        >
          مشاهده تورنمنت
        </button>

        <button
          class="delete-btn"
          data-delete-tournament="${tournament.id}"
        >
          حذف
        </button>

      </div>

    </article>
  `;
}

/* =====================================
   داشبورد
===================================== */

function renderHome() {
  const totalPlayers = tournaments.reduce(
    (sum, tournament) => sum + tournament.players.length,
    0
  );

  const playedMatches = tournaments.reduce((sum, t) => {
    const groupMatches = (t.groups || []).flatMap(
      group => group.matches
    );

    const leagueMatches = t.leagueMatches || [];

    const knockoutMatches = (t.knockoutRounds || []).flatMap(
      round => round.matches
    );

    return sum + [
      ...groupMatches,
      ...leagueMatches,
      ...knockoutMatches
    ].filter(match => match.played).length;

  }, 0);

  document.getElementById("statTournaments").textContent =
    fa(tournaments.length);

  document.getElementById("statPlayers").textContent =
    fa(totalPlayers);

  document.getElementById("statMatches").textContent =
    fa(playedMatches);

  document.getElementById("statChampions").textContent =
    fa(champions.length);

  const recent = tournaments.slice(0, 3);

  document.getElementById("recentTournaments").innerHTML =
    recent.length
      ? recent.map(renderTournamentCard).join("")
      : `
        <div class="empty-state">
          <b>🏆</b>
          هنوز تورنمنتی نساختی.
          <br>
          اولین رقابتت را شروع کن!
        </div>
      `;
}

/* =====================================
   لیست تورنمنت‌ها
===================================== */

function renderTournaments() {
  document.getElementById("allTournaments").innerHTML =
    tournaments.length
      ? tournaments.map(renderTournamentCard).join("")
      : `
        <div class="empty-state">
          <b>⚽</b>
          هنوز تورنمنتی وجود ندارد.
          <br>
          با ساخت تورنمنت جدید شروع کن.
        </div>
      `;
}

/* =====================================
   تالار قهرمانان
===================================== */

function renderHistory() {
  document.getElementById("championList").innerHTML =
    champions.length
      ? champions.map(item => `
        <article class="champion-card">

          <div class="champion-cup">🏆</div>

          <div>

            <h3>${escapeHTML(item.champion)}</h3>

            <p>
              بازیکن:
              ${escapeHTML(item.playerName)}
              ·
              ${escapeHTML(item.tournamentName)}
            </p>

            ${item.runnerUp ? `
              <p>
                نایب‌قهرمان:
                ${escapeHTML(item.runnerUp)}
              </p>
            ` : ""}

          </div>

          <div class="champion-date">
            ${new Date(item.date).toLocaleDateString("fa-IR")}
          </div>

        </article>
      `).join("")
      : `
        <div class="empty-state">
          <b>♛</b>
          هنوز قهرمانی ثبت نشده است.
          <br>
          بعد از پایان اولین تورنمنت،
          قهرمان اینجا نمایش داده می‌شود.
        </div>
      `;
}

/* =====================================
   به‌روزرسانی کل اپ
===================================== */

function renderAll() {
  renderHome();
  renderTournaments();
  renderHistory();
}

/* =====================================
   حذف تورنمنت
===================================== */

function askDelete(id) {
  pendingDeleteId = id;

  const tournament = getTournament(id);

  document.getElementById("confirmTitle").textContent =
    "حذف تورنمنت";

  document.getElementById("confirmMessage").textContent =
    `آیا از حذف تورنمنت «${tournament?.name || ""}» مطمئنی؟ این عملیات قابل بازگشت نیست.`;

  openModal("confirmModal");
}

function confirmDelete() {
  if (!pendingDeleteId) return;

  const id = pendingDeleteId;

  tournaments = tournaments.filter(
    tournament => tournament.id !== id
  );

  champions = champions.filter(
    champion => champion.tournamentId !== id
  );

  if (currentTournamentId === id) {
    currentTournamentId = null;
  }

  pendingDeleteId = null;

  saveData();

  closeModal("confirmModal");

  renderAll();

  navigate("tournaments");

  showToast("تورنمنت حذف شد.");
}

/* =====================================
   رویدادهای دکمه‌ها
===================================== */

document.getElementById("newTournamentBtn")
  .addEventListener("click", () => {
    renderPlayerFields();
    openModal("createModal");
  });

document.getElementById("heroNewBtn")
  .addEventListener("click", () => {
    renderPlayerFields();
    openModal("createModal");
  });

document.getElementById("listNewBtn")
  .addEventListener("click", () => {
    renderPlayerFields();
    openModal("createModal");
  });

document.getElementById("playerCount")
  .addEventListener("change", renderPlayerFields);

document.getElementById("teamsPerPlayer")
  .addEventListener("change", renderPlayerFields);

document.getElementById("tournamentType")
  .addEventListener("change", updateFormOptions);

document.getElementById("tournamentForm")
  .addEventListener("submit", createTournament);

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.page);
  });
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
  });
});

document.querySelectorAll("[data-goto]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.goto);
  });
});

document.getElementById("backToTournaments")
  .addEventListener("click", () => {
    navigate("tournaments");
  });

document.getElementById("confirmAction")
  .addEventListener("click", confirmDelete);

/* =====================================
   کلیک‌های داخل صفحه
===================================== */

document.addEventListener("click", event => {

  const openButton = event.target.closest(
    "[data-open-tournament]"
  );

  if (openButton) {
    showDetail(openButton.dataset.openTournament);
    return;
  }

  const deleteButton = event.target.closest(
    "[data-delete-tournament]"
  );

  if (deleteButton) {
    askDelete(deleteButton.dataset.deleteTournament);
    return;
  }

  const scoreButton = event.target.closest(
    "[data-save-match]"
  );

  if (scoreButton) {
    saveMatchScore(scoreButton.dataset.saveMatch);
    return;
  }

  const winnerButton = event.target.closest(
    "[data-tie-winner]"
  );

  if (winnerButton) {
    chooseTieWinner(winnerButton.dataset.tieWinner);
    return;
  }

  const tabButton = event.target.closest(
    "[data-detail-tab]"
  );

  if (tabButton) {
    document.querySelectorAll(".detail-tab").forEach(button => {
      button.classList.remove("active");
    });

    tabButton.classList.add("active");

    document.querySelectorAll(".detail-section").forEach(section => {
      section.classList.remove("active");
    });

    document.getElementById(
      tabButton.dataset.detailTab
    )?.classList.add("active");

    return;
  }

  if (event.target.id === "startKnockoutBtn") {
    startKnockoutFromGroups();
  }

});

/* =====================================
   بستن پنجره‌ها با Escape
===================================== */

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-backdrop.show")
      .forEach(modal => {
        modal.classList.remove("show");
      });
  }
});

/* =====================================
   اجرای اولیه
===================================== */

renderPlayerFields();
updateFormOptions();
renderAll();
