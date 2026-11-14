
/* =====================================
   KICKOFF - MAIN APPLICATION
===================================== */

const STORAGE_KEY = "kickoff_tournaments";
const CHAMPIONS_KEY = "kickoff_champions";

// دریافت اطلاعات ذخیره‌شده
function getTournaments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function getChampions() {
  try {
    return JSON.parse(localStorage.getItem(CHAMPIONS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTournaments(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function saveChampions(data) {
  localStorage.setItem(CHAMPIONS_KEY, JSON.stringify(data));
}

// جلوگیری از ورود کد HTML به اطلاعات نمایشی
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

/* =====================================
   DESIGN ADDITIONS
===================================== */

const extraStyles = document.createElement("style");

extraStyles.textContent = `
.tournament-list {
  display: grid;
  gap: 12px;
}

.tournament-card {
  background: linear-gradient(120deg,#19283a,#111b2b);
  border: 1px solid rgba(163,255,79,.17);
  border-radius: 16px;
  padding: 17px;
  animation: fadeUp .45s ease both;
  transition: .25s;
}

.tournament-card:hover {
  transform: translateY(-3px);
  border-color: rgba(163,255,79,.45);
}

.tournament-card h3 {
  font-size: 15px;
  margin-bottom: 8px;
}

.tournament-card p {
  font-size: 11px;
  color: #8b9bb0;
  line-height: 2;
}

.tournament-tag {
  display: inline-block;
  color: #a3ff4f;
  background: rgba(163,255,79,.1);
  padding: 5px 10px;
  border-radius: 20px;
  font-size: 10px;
  margin-bottom: 10px;
}

.tournament-card .team-preview {
  margin-top: 9px;
  color: #a3ff4f;
  font-size: 11px;
}

`;
document.head.appendChild(extraStyles);

/* =====================================
   CREATE TOURNAMENT
===================================== */

function createTournament() {

  const tournamentName = prompt("نام تورنمنت رو وارد کن:");

  if (tournamentName === null) return;

  if (!tournamentName.trim()) {
    alert("لطفاً نام تورنمنت رو وارد کن.");
    return;
  }

  const playerCount = Number(
    prompt("تعداد بازیکنان رو وارد کن:")
  );

  if (!Number.isInteger(playerCount) || playerCount < 2) {
    alert("تعداد بازیکنان باید حداقل ۲ نفر باشه.");
    return;
  }

  const players = [];
  let expectedTeamCount = null;

  for (let i = 0; i < playerCount; i++) {

    const playerName = prompt(
      `نام بازیکن شماره ${i + 1} رو وارد کن:`
    );

    if (playerName === null) return;

    if (!playerName.trim()) {
      alert("نام بازیکن نمی‌تونه خالی باشه.");
      return;
    }

    const teamInput = prompt(
      `تیم‌های متعلق به ${playerName} رو وارد کن.\n` +
      "نام تیم‌ها رو با کاما جدا کن.\n\n" +
      "مثال: Real Madrid, Barcelona, Bayern"
    );

    if (teamInput === null) return;

    const teams = teamInput
      .split(",")
      .map(team => team.trim())
      .filter(Boolean);

    if (teams.length === 0) {
      alert("هر بازیکن باید حداقل یک تیم داشته باشه.");
      return;
    }

    if (expectedTeamCount === null) {
      expectedTeamCount = teams.length;
    }

    if (teams.length !== expectedTeamCount) {
      alert(
        `تعداد تیم‌های همه بازیکنان باید برابر باشه!\n\n` +
        `تعداد مورد انتظار: ${expectedTeamCount}\n` +
        `تعداد واردشده برای ${playerName}: ${teams.length}`
      );
      return;
    }

    players.push({
      id: crypto.randomUUID(),
      name: playerName.trim(),
      teams: teams
    });
  }

  // جلوگیری از نام تکراری بازیکنان
  const names = players.map(p => p.name.toLowerCase());

  if (new Set(names).size !== names.length) {
    alert("نام بازیکنان نباید تکراری باشه.");
    return;
  }

  const tournament = {
    id: crypto.randomUUID(),
    name: tournamentName.trim(),
    players: players,
    teamsPerPlayer: expectedTeamCount,
    totalTeams: playerCount * expectedTeamCount,
    status: "created",
    createdAt: new Date().toISOString(),
    matches: [],
    groups: [],
    champion: null
  };

  const tournaments = getTournaments();

  tournaments.unshift(tournament);

  saveTournaments(tournaments);

  renderApp();

  alert("تورنمنت با موفقیت ساخته شد! ⚽");
}

/* =====================================
   RENDER TOURNAMENTS
===================================== */

function renderTournaments() {

  const tournaments = getTournaments();

  const list = document.getElementById("tournamentList");
  const emptyState = document.getElementById("emptyState");

  if (!list || !emptyState) return;

  emptyState.style.display =
    tournaments.length === 0 ? "block" : "none";

  list.innerHTML = tournaments.map(tournament => {

    const playerNames = tournament.players
      .map(player => escapeHTML(player.name))
      .join("، ");

    return `
      <article class="tournament-card">

        <span class="tournament-tag">⚽ تورنمنت</span>

        <h3>${escapeHTML(tournament.name)}</h3>

        <p>
          👥 ${tournament.players.length} بازیکن
          <br>
          🏟️ ${tournament.totalTeams} تیم
          <br>
          📋 ${tournament.teamsPerPlayer} تیم برای هر بازیکن
        </p>

        <p class="team-preview">
          بازیکنان: ${playerNames}
        </p>

      </article>
    `;

  }).join("");
}

/* =====================================
   RENDER CHAMPIONS
===================================== */

function renderChampions() {

  const champions = getChampions();

  const list = document.getElementById("championList");

  if (!list) return;

  document.getElementById("editionCount").textContent =
    toPersian(champions.length);

  document.getElementById("championCount").textContent =
    toPersian(champions.length);

  if (champions.length === 0) {

    list.innerHTML = `
      <div class="hall-empty">
        <div class="hall-trophy">🏆</div>
        <h3>هنوز قهرمانی ثبت نشده!</h3>
        <p>
          بعد از پایان اولین تورنمنت،
          نام قهرمان اینجا ثبت می‌شه.
        </p>
      </div>
    `;

  } else {

    list.innerHTML = champions.map(champion => `
      <article class="champion-card">

        <div class="champion-medal">🏆</div>

        <div class="champion-info">
          <h3>${escapeHTML(champion.player)}</h3>

          <p>
            تیم قهرمان:
            ${escapeHTML(champion.team)}
          </p>

          <div class="champion-edition">
            ${escapeHTML(champion.edition)}
          </div>
        </div>

      </article>
    `).join("");
  }

  // محاسبه بیشترین قهرمانی
  const counts = {};

  champions.forEach(champion => {
    counts[champion.player] =
      (counts[champion.player] || 0) + 1;
  });

  const topChampion = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0];

  document.getElementById("topChampion").textContent =
    topChampion
      ? `${topChampion[0]} (${toPersian(topChampion[1])})`
      : "—";
}

/* =====================================
   DASHBOARD STATISTICS
===================================== */

function toPersian(number) {
  return Number(number).toLocaleString("fa-IR");
}

function renderStatistics() {

  const tournaments = getTournaments();

  const playerNames = new Set();

  let matches = 0;

  tournaments.forEach(tournament => {

    tournament.players.forEach(player => {
      playerNames.add(player.name);
    });

    matches += tournament.matches?.length || 0;

  });

  document.getElementById("tournamentCount").textContent =
    toPersian(tournaments.length);

  document.getElementById("playerCount").textContent =
    toPersian(playerNames.size);

  document.getElementById("matchCount").textContent =
    toPersian(matches);

  document.getElementById("topPlayer").textContent =
    playerNames.size
      ? toPersian(playerNames.size) + " بازیکن"
      : "—";
}

/* =====================================
   MAIN RENDER
===================================== */

function renderApp() {
  renderTournaments();
  renderChampions();
  renderStatistics();
}

/* =====================================
   BUTTON EVENTS
===================================== */

document
  .getElementById("createTournament")
  .addEventListener("click", createTournament);

document
  .getElementById("emptyCreate")
  .addEventListener("click", createTournament);

/* =====================================
   INITIALIZE
===================================== */

document.addEventListener("DOMContentLoaded", renderApp);

renderApp();
