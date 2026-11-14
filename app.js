"use strict";

const STORAGE_KEY = "kickoff_tournaments_v3";
const CHAMPIONS_KEY = "kickoff_champions";
const app = document.getElementById("app");

let activeId = null;
let activeTab = "overview";

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function tournaments() {
  return read(STORAGE_KEY);
}

function champions() {
  return read(CHAMPIONS_KEY);
}

function getTournament(id = activeId) {
  return tournaments().find(t => t.id === id);
}

function saveTournament(tournament) {
  const all = tournaments();
  const index = all.findIndex(t => t.id === tournament.id);
  if (index < 0) all.unshift(tournament);
  else all[index] = tournament;
  write(STORAGE_KEY, all);
}

function home() {
  activeId = null;
  activeTab = "overview";
  render();
}

function createTournament() {
  const name = prompt("نام تورنمنت را وارد کن:");
  if (name === null) return;
  if (!name.trim()) return alert("نام تورنمنت خالی است.");

  const count = Number(prompt("تعداد بازیکنان را وارد کن:", "4"));
  if (!Number.isInteger(count) || count < 2 || count > 16) {
    return alert("تعداد بازیکنان باید بین ۲ تا ۱۶ باشد.");
  }

  const players = [];
  let teamsPerPlayer = null;

  for (let i = 0; i < count; i++) {
    const playerName = prompt(`نام بازیکن ${i + 1}:`);
    if (playerName === null) return;
    if (!playerName.trim()) return alert("نام بازیکن نمی‌تواند خالی باشد.");

    const raw = prompt(
      `تیم‌های ${playerName} را با کاما جدا کن:\nمثال:\nReal Madrid, Barcelona, Bayern`
    );
    if (raw === null) return;

    const teams = raw.split(",").map(x => x.trim()).filter(Boolean);

    if (!teams.length) return alert("هر بازیکن باید حداقل یک تیم داشته باشد.");

    if (teamsPerPlayer === null) teamsPerPlayer = teams.length;

    if (teams.length !== teamsPerPlayer) {
      return alert(
        `تعداد تیم‌های همه بازیکنان باید برابر باشد.\nتعداد مورد انتظار: ${teamsPerPlayer}`
      );
    }

    players.push({
      id: uid(),
      name: playerName.trim(),
      teams: teams.map(team => ({
        id: uid(),
        name: team
      }))
    });
  }

  const normalized = players.map(p => p.name.toLowerCase());
  if (new Set(normalized).size !== normalized.length) {
    return alert("نام بازیکنان نباید تکراری باشد.");
  }

  const tournament = {
    id: uid(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    players,
    teamsPerPlayer,
    groups: [],
    knockout: [],
    champion: null,
    status: "created",
    points: { win: 3, draw: 1, loss: 0 },
    qualifiers: 2
  };

  saveTournament(tournament);
  activeId = tournament.id;
  activeTab = "overview";
  render();
}

function allTeams(t) {
  return t.players.flatMap(player =>
    player.teams.map(team => ({
      id: team.id,
      name: team.name,
      ownerId: player.id,
      ownerName: player.name
    }))
  );
}

function createGroups(t) {
  if (t.groups.length) {
    return alert("گروه‌ها قبلاً ساخته شده‌اند.");
  }

  const teams = allTeams(t);
  const groupCount = t.teamsPerPlayer;
  const groups = [];

  for (let i = 0; i < groupCount; i++) {
    const groupTeams = t.players.map(player => ({
      id: player.teams[i].id,
      name: player.teams[i].name,
      ownerId: player.id,
      ownerName: player.name
    }));

    const matches = [];
    for (let a = 0; a < groupTeams.length; a++) {
      for (let b = a + 1; b < groupTeams.length; b++) {
        matches.push({
          id: uid(),
          home: groupTeams[a],
          away: groupTeams[b],
          homeScore: null,
          awayScore: null,
          played: false
        });
      }
    }

    groups.push({
      name: `گروه ${String.fromCharCode(65 + i)}`,
      teams: groupTeams,
      matches
    });
  }

  t.groups = groups;
  t.status = "groups";
  saveTournament(t);
  render();
}

function standings(group, t) {
  const rows = group.teams.map(team => ({
    ...team,
    played: 0,
    win: 0,
    draw: 0,
    loss: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    pts: 0
  }));

  group.matches.forEach(match => {
    if (!match.played) return;

    const home = rows.find(x => x.id === match.home.id);
    const away = rows.find(x => x.id === match.away.id);
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
      home.pts += t.points.win;
      away.pts += t.points.loss;
    } else if (hs < as) {
      away.win++;
      home.loss++;
      away.pts += t.points.win;
      home.pts += t.points.loss;
    } else {
      home.draw++;
      away.draw++;
      home.pts += t.points.draw;
      away.pts += t.points.draw;
    }
  });

  rows.forEach(row => row.gd = row.gf - row.ga);

  return rows.sort((a, b) =>
    b.pts - a.pts ||
    b.gd - a.gd ||
    b.gf - a.gf ||
    a.name.localeCompare(b.name)
  );
}

function saveGroupResult(t, groupIndex, matchId) {
  const group = t.groups[groupIndex];
  const match = group.matches.find(m => m.id === matchId);
  if (!match) return;

  const homeScore = document.getElementById(`h-${matchId}`).value;
  const awayScore = document.getElementById(`a-${matchId}`).value;

  if (homeScore === "" || awayScore === "") {
    return alert("نتیجه هر دو تیم را وارد کن.");
  }

  const hs = Number(homeScore);
  const as = Number(awayScore);

  if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
    return alert("نتیجه باید عدد صحیح و غیرمنفی باشد.");
  }

  match.homeScore = hs;
  match.awayScore = as;
  match.played = true;
  saveTournament(t);
  render();
}

function groupsComplete(t) {
  return t.groups.length > 0 &&
    t.groups.every(g => g.matches.every(m => m.played));
}

function startKnockout(t) {
  if (!t.groups.length) return alert("ابتدا گروه‌ها را بساز.");
  if (!groupsComplete(t)) return alert("ابتدا تمام بازی‌های گروهی را ثبت کن.");
  if (t.knockout.length) return alert("مرحله حذفی قبلاً ساخته شده است.");

  const qualifiers = Math.max(1, Math.min(8, Number(t.qualifiers) || 2));
  let qualified = [];

  t.groups.forEach(group => {
    qualified.push(...standings(group, t).slice(0, qualifiers));
  });

  if (qualified.length < 2) {
    return alert("برای مرحله حذفی حداقل دو تیم لازم است.");
  }

  // مرتب‌سازی اولیه بر اساس امتیاز و تفاضل گل
  qualified.sort((a, b) =>
    b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
  );

  const size = Math.pow(2, Math.ceil(Math.log2(qualified.length)));
  const byes = size - qualified.length;
  const seeded = [...qualified];

  const firstRound = [];
  const used = new Set();

  // تیم‌های دارای BYE
  for (let i = 0; i < byes; i++) {
    const team = seeded[i];
    used.add(team.id);
    firstRound.push({
      id: uid(),
      home: team,
      away: null,
      homeScore: null,
      awayScore: null,
      winner: team,
      played: true,
      bye: true
    });
  }

  const remaining = seeded.filter(team => !used.has(team.id));

  while (remaining.length >= 2) {
    const home = remaining.shift();
    let index = remaining.findIndex(team => team.ownerId !== home.ownerId);
    if (index < 0) index = 0;
    const away = remaining.splice(index, 1)[0];

    firstRound.push({
      id: uid(),
      home,
      away,
      homeScore: null,
      awayScore: null,
      winner: null,
      played: false,
      bye: false
    });
  }

  t.knockout = [firstRound];
  t.status = "knockout";
  saveTournament(t);
  render();
}

function saveKnockoutResult(t, roundIndex, matchId) {
  const round = t.knockout[roundIndex];
  const match = round.find(m => m.id === matchId);
  if (!match || !match.away) return;

  const hs = Number(document.getElementById(`kh-${matchId}`).value);
  const as = Number(document.getElementById(`ka-${matchId}`).value);

  if (!Number.isInteger(hs) || !Number.isInteger(as) || hs < 0 || as < 0) {
    return alert("نتیجه معتبر وارد کن.");
  }

  match.homeScore = hs;
  match.awayScore = as;

  if (hs === as) {
    const choice = prompt(
      `بازی مساوی شده است.\nبرنده را انتخاب کن:\n1 = ${match.home.name}\n2 = ${match.away.name}`
    );
    if (choice !== "1" && choice !== "2") return;
    match.winner = choice === "1" ? match.home : match.away;
  } else {
    match.winner = hs > as ? match.home : match.away;
  }

  match.played = true;

  // دورهای بعدی باید دوباره ساخته شوند
  t.knockout = t.knockout.slice(0, roundIndex + 1);
  saveTournament(t);
  render();
}

function nextKnockoutRound(t) {
  const current = t.knockout[t.knockout.length - 1];
  if (!current || !current.every(m => m.played && m.winner)) {
    return alert("ابتدا نتیجه تمام بازی‌های این دور را ثبت کن.");
  }

  const winners = current.map(m => m.winner);

  if (winners.length === 1) {
    finishTournament(t, winners[0]);
    return;
  }

  const next = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) {
      next.push({
        id: uid(),
        home: winners[i],
        away: null,
        homeScore: null,
        awayScore: null,
        winner: winners[i],
        played: true,
        bye: true
      });
    } else {
      next.push({
        id: uid(),
        home: winners[i],
        away: winners[i + 1],
        homeScore: null,
        awayScore: null,
        winner: null,
        played: false,
        bye: false
      });
    }
  }

  t.knockout.push(next);
  saveTournament(t);
  render();
}

function finishTournament(t, winner) {
  t.champion = winner;
  t.status = "finished";

  const history = champions();
  if (!history.some(item => item.tournamentId === t.id)) {
    history.unshift({
      id: uid(),
      tournamentId: t.id,
      tournamentName: t.name,
      playerName: winner.ownerName,
      teamName: winner.name,
      date: new Date().toISOString()
    });
    write(CHAMPIONS_KEY, history);
  }

  saveTournament(t);
  render();
}

function deleteTournament(id) {
  if (!confirm("از حذف این تورنمنت مطمئنی؟")) return;
  write(STORAGE_KEY, tournaments().filter(t => t.id !== id));
  if (activeId === id) activeId = null;
  render();
}

function setTab(tab) {
  activeTab = tab;
  render();
}

function tournamentCard(t) {
  const status = {
    created: "آماده شروع",
    groups: "مرحله گروهی",
    knockout: "مرحله حذفی",
    finished: "پایان‌یافته"
  }[t.status] || "در حال اجرا";

  return `
    <article class="tournament-card">
      <span class="tag">${status}</span>
      <h3>${esc(t.name)}</h3>
      <p class="muted">
        ${t.players.length} بازیکن · ${t.players.length * t.teamsPerPlayer} تیم
        · ${t.teamsPerPlayer} تیم برای هر بازیکن
      </p>
      <button class="btn" onclick="openTournament('${t.id}')">ورود به تورنمنت</button>
      <button class="btn danger" onclick="deleteTournament('${t.id}')">حذف</button>
    </article>
  `;
}

function renderHome() {
  const all = tournaments();
  const playerCount = all.reduce((sum, t) => sum + t.players.length, 0);
  const matches = all.reduce((sum, t) =>
    sum + t.groups.reduce((s, g) => s + g.matches.filter(m => m.played).length, 0) +
    t.knockout.reduce((s, r) => s + r.filter(m => m.played && !m.bye).length, 0), 0
  );

  const history = champions();

  return `
    <section class="hero">
      <span class="eyebrow">FOOTBALL TOURNAMENT MANAGER</span>
      <h1>وقتشه رقابت<br><span class="neon-text">شروع بشه!</span></h1>
      <p>تورنمنت خودت رو بساز، تیم‌ها رو مدیریت کن و قهرمان رو مشخص کن.</p>
      <button class="primary-btn" onclick="createTournament()">＋ ساخت تورنمنت جدید</button>
    </section>

    <div class="section-heading"><h2>نمای کلی</h2><span class="section-kicker">OVERVIEW</span></div>
    <section class="stats-grid">
      <div class="stat-card"><span>🏆 تورنمنت‌ها</span><strong>${all.length}</strong></div>
      <div class="stat-card"><span>👥 بازیکنان ثبت‌شده</span><strong>${playerCount}</strong></div>
      <div class="stat-card"><span>⚽ بازی‌های ثبت‌شده</span><strong>${matches}</strong></div>
    </section>

    <div class="section-heading"><h2>تورنمنت‌های من</h2></div>
    ${all.length ? all.map(tournamentCard).join("") : `
      <div class="empty">
        <div style="font-size:38px">🏟️</div>
        <h3>هنوز تورنمنتی نداری!</h3>
        <p class="muted">اولین تورنمنت خودت رو بساز.</p>
        <button class="btn" onclick="createTournament()">ساخت اولین تورنمنت</button>
      </div>
    `}

    <section class="hall-section">
      <div class="section-heading"><h2>👑 تالار قهرمانان</h2></div>
      <div class="panel">
        <p class="muted">قهرمانان دوره‌های مختلف KICKOFF</p>
        ${history.length ? history.map(item => `
          <div class="champion-card">
            <strong>🏆 ${esc(item.playerName)}</strong>
            <p>${esc(item.teamName)} · ${esc(item.tournamentName)}</p>
            <p class="muted">${new Date(item.date).toLocaleDateString("fa-IR")}</p>
          </div>
        `).join("") : `<div class="empty">هنوز قهرمانی ثبت نشده است.</div>`}
      </div>
    </section>
  `;
}

function openTournament(id) {
  activeId = id;
  activeTab = "overview";
  render();
}

function renderOverview(t) {
  return `
    <div class="panel">
      <h3>اطلاعات تورنمنت</h3>
      <p class="muted">نام: ${esc(t.name)}</p>
      <p class="muted">تعداد بازیکنان: ${t.players.length}</p>
      <p class="muted">تعداد کل تیم‌ها: ${t.players.length * t.teamsPerPlayer}</p>
      <p class="muted">تعداد گروه‌ها: ${t.teamsPerPlayer}</p>
      <p class="muted">تیم‌های هر گروه: ${t.players.length}</p>
    </div>

    <div class="panel">
      <h3>بازیکنان و تیم‌ها</h3>
      ${t.players.map(p => `
        <div class="player-form">
          <h4>${esc(p.name)}</h4>
          <p class="muted">${p.teams.map(team => esc(team.name)).join("، ")}</p>
        </div>
      `).join("")}
    </div>

    ${!t.groups.length ? `
      <div class="panel">
        <h3>ساخت مرحله گروهی</h3>
        <p class="muted">سیستم به‌صورت خودکار گروه‌ها را می‌سازد؛ از هر بازیکن دقیقاً یک تیم در هر گروه قرار می‌گیرد.</p>
        <button class="btn" onclick="createGroups(getTournament())">ساخت گروه‌ها</button>
      </div>
    ` : `
      <div class="panel">
        <h3>تنظیمات صعود</h3>
        <div class="field">
          <label>تعداد تیم صعودکننده از هر گروه</label>
          <select id="qualifiers" onchange="changeQualifiers()">
            ${[1,2,3,4].map(n => `<option value="${n}" ${t.qualifiers === n ? "selected" : ""}>${n} تیم</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label>امتیاز برد</label>
          <input id="winPoints" type="number" min="0" value="${t.points.win}">
        </div>
        <div class="field">
          <label>امتیاز مساوی</label>
          <input id="drawPoints" type="number" min="0" value="${t.points.draw}">
        </div>
        <div class="field">
          <label>امتیاز باخت</label>
          <input id="lossPoints" type="number" min="0" value="${t.points.loss}">
        </div>
        <button class="btn secondary" onclick="saveSettings()">ذخیره تنظیمات</button>
      </div>
    `}
    ${t.champion ? `
      <div class="champion-box">
        <div class="trophy">🏆</div>
        <h2>قهرمان تورنمنت</h2>
        <h3>${esc(t.champion.name)}</h3>
        <p>${esc(t.champion.ownerName)}</p>
      </div>
    ` : ""}
  `;
}

function changeQualifiers() {
  const t = getTournament();
  t.qualifiers = Number(document.getElementById("qualifiers").value);
  saveTournament(t);
}

function saveSettings() {
  const t = getTournament();
  t.points.win = Number(document.getElementById("winPoints").value);
  t.points.draw = Number(document.getElementById("drawPoints").value);
  t.points.loss = Number(document.getElementById("lossPoints").value);

  if (![t.points.win, t.points.draw, t.points.loss].every(n => Number.isFinite(n) && n >= 0)) {
    return alert("امتیازها باید عدد غیرمنفی باشند.");
  }

  saveTournament(t);
  alert("تنظیمات ذخیره شد.");
  render();
}

function renderGroups(t) {
  if (!t.groups.length) {
    return `<div class="empty">هنوز گروهی ساخته نشده است.</div>`;
  }

  return t.groups.map((group, index) => {
    const table = standings(group, t);

    return `
      <section class="panel">
        <h3>${esc(group.name)}</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>رتبه</th><th>تیم</th><th>بازیکن</th>
                <th>بازی</th><th>برد</th><th>مساوی</th><th>باخت</th>
                <th>تفاضل</th><th>امتیاز</th>
              </tr>
            </thead>
            <tbody>
              ${table.map((row, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>${esc(row.name)}</td>
                  <td>${esc(row.ownerName)}</td>
                  <td>${row.played}</td><td>${row.win}</td>
                  <td>${row.draw}</td><td>${row.loss}</td>
                  <td>${row.gd}</td><td><strong>${row.pts}</strong></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <h3 style="margin-top:20px">برنامه و نتایج بازی‌ها</h3>
        ${group.matches.map(match => `
          <div class="match-card">
            <div class="match-team">${esc(match.home.name)}</div>
            <div class="score-area">
              <input class="score-input" id="h-${match.id}" type="number" min="0"
                value="${match.played ? match.homeScore : ""}" placeholder="۰">
              <span>:</span>
              <input class="score-input" id="a-${match.id}" type="number" min="0"
                value="${match.played ? match.awayScore : ""}" placeholder="۰">
            </div>
            <div class="match-team">${esc(match.away.name)}</div>
            <div class="match-actions">
              <button class="btn secondary" onclick="saveGroupResult(getTournament(),${index},'${match.id}')">ثبت نتیجه</button>
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }).join("") + `
    <div class="panel">
      <h3>پایان مرحله گروهی</h3>
      <p class="muted">پس از ثبت تمام نتایج، مرحله حذفی را شروع کن.</p>
      <button class="btn gold" onclick="startKnockout(getTournament())">ساخت مرحله حذفی</button>
    </div>
  `;
}

function renderKnockout(t) {
  if (!t.knockout.length) {
    return `<div class="empty">مرحله حذفی هنوز شروع نشده است.</div>`;
  }

  let html = "";

  t.knockout.forEach((round, roundIndex) => {
    html += `<section class="panel"><h3>دور ${roundIndex + 1}</h3>`;

    round.forEach(match => {
      html += `
        <div class="match-card">
          <div class="match-team">${esc(match.home.name)}</div>
          <div class="score-area">
            ${match.bye ? `<span class="tag">استراحت / صعود مستقیم</span>` : `
              <input class="score-input" id="kh-${match.id}" type="number" min="0"
                value="${match.played ? match.homeScore : ""}" placeholder="۰">
              <span>:</span>
              <input class="score-input" id="ka-${match.id}" type="number" min="0"
                value="${match.played ? match.awayScore : ""}" placeholder="۰">
            `}
          </div>
          <div class="match-team">${match.away ? esc(match.away.name) : "—"}</div>
          <div class="match-actions">
            ${match.bye ? `<span class="muted">صعود مستقیم: ${esc(match.home.name)}</span>` : `
              <button class="btn secondary" onclick="saveKnockoutResult(getTournament(),${roundIndex},'${match.id}')">ثبت نتیجه</button>
            `}
            ${match.winner ? `<p class="muted">برنده: ${esc(match.winner.name)}</p>` : ""}
          </div>
        </div>
      `;
    });

    html += `</section>`;
  });

  if (t.champion) {
    html += `
      <div class="champion-box">
        <div class="trophy">🏆</div>
        <h2>قهرمان نهایی KICKOFF</h2>
        <h3>${esc(t.champion.name)}</h3>
        <p>${esc(t.champion.ownerName)}</p>
      </div>
    `;
  } else {
    html += `
      <div class="panel">
        <button class="btn gold" onclick="nextKnockoutRound(getTournament())">تکمیل این دور و رفتن به دور بعد</button>
      </div>
    `;
  }

  return html;
}

function render() {
  if (!app) return;

  const t = getTournament();

  if (!t) {
    app.innerHTML = renderHome();
    return;
  }

  const tabs = [
    ["overview", "نمای کلی"],
    ["groups", "گروه‌ها و جدول"],
    ["knockout", "مرحله حذفی"]
  ];

  app.innerHTML = `
    <div class="section-heading">
      <div>
        <span class="section-kicker">KICKOFF TOURNAMENT</span>
        <h2>${esc(t.name)}</h2>
      </div>
      <button class="btn secondary" onclick="home()">بازگشت</button>
    </div>

    <div class="tabs">
      ${tabs.map(([key, label]) => `
        <button class="tab ${activeTab === key ? "active" : ""}" onclick="setTab('${key}')">${label}</button>
      `).join("")}
    </div>

    ${activeTab === "overview" ? renderOverview(t) : ""}
    ${activeTab === "groups" ? renderGroups(t) : ""}
    ${activeTab === "knockout" ? renderKnockout(t) : ""}

    <div class="panel">
      <button class="btn danger" onclick="deleteTournament('${t.id}')">حذف این تورنمنت</button>
    </div>
  `;
}

// دسترسی توابع موردنیاز دکمه‌های HTML
Object.assign(window, {
  createTournament,
  openTournament,
  deleteTournament,
  home,
  setTab,
  createGroups,
  getTournament,
  saveGroupResult,
  saveKnockoutResult,
  startKnockout,
  nextKnockoutRound,
  changeQualifiers,
  saveSettings
});

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.error("Service Worker:", error);
    });
  });
                   }
