
const STORAGE_KEY = "kickoff_tournaments_v2";
const CHAMPIONS_KEY = "kickoff_champions";

const app = document.getElementById("app");
let activeId = null;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
const fa = n => Number(n).toLocaleString("fa-IR");

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
function champions() {
  try { return JSON.parse(localStorage.getItem(CHAMPIONS_KEY)) || []; }
  catch { return []; }
}
function saveChampions(data) {
  localStorage.setItem(CHAMPIONS_KEY, JSON.stringify(data));
}
function getTournament(id) {
  return load().find(t => t.id === id);
}
function updateTournament(id, fn) {
  const all = load();
  const index = all.findIndex(t => t.id === id);
  if (index < 0) return;
  fn(all[index]);
  save(all);
  render();
}

function button(text, action, cls = "btn") {
  return `<button class="${cls}" data-action="${action}">${text}</button>`;
}

/* ---------- CREATE FORM ---------- */

function createForm() {
  app.innerHTML = `
    <section class="hero">
      <span class="kicker">KICKOFF TOURNAMENT SYSTEM</span>
      <h1>ساخت مسابقه جدید</h1>
      <p>بازیکن‌ها و تیم‌ها رو وارد کن؛ گروه‌ها و مسابقات به‌صورت خودکار ساخته می‌شن.</p>
    </section>

    <form id="createForm" class="panel">
      <div class="form-grid">
        <div class="field">
          <label>نام تورنمنت</label>
          <input name="name" required placeholder="مثلاً جام دوستان">
        </div>
        <div class="field">
          <label>تعداد بازیکنان</label>
          <input name="playerCount" id="playerCountInput" type="number" min="2" value="4" required>
        </div>
        <div class="field">
          <label>تعداد تیم هر بازیکن</label>
          <input name="teamsPerPlayer" id="teamsPerPlayerInput" type="number" min="1" value="4" required>
        </div>
        <div class="field">
          <label>تعداد تیم صعودکننده از هر گروه</label>
          <input name="qualifiers" type="number" min="1" value="2" required>
        </div>
      </div>

      <div class="notice">
        تعداد گروه‌ها برابر تعداد تیم هر بازیکن خواهد بود.
        در هر گروه دقیقاً یک تیم از هر بازیکن قرار می‌گیرد.
        تعداد تیم‌های تمام بازیکنان باید برابر باشد.
      </div>

      <div id="playerFields"></div>

      <div class="actions">
        <button class="btn primary" type="submit">ساخت تورنمنت و گروه‌ها ⚽</button>
        <button class="btn" type="button" data-action="home">بازگشت</button>
      </div>
    </form>
  `;

  updatePlayerFields();
}

function updatePlayerFields() {
  const count = Math.max(2, Math.min(100, Number(document.getElementById("playerCountInput")?.value) || 2));
  const teamCount = Math.max(1, Number(document.getElementById("teamsPerPlayerInput")?.value) || 1);
  const container = document.getElementById("playerFields");
  if (!container) return;

  container.innerHTML = Array.from({length:count}, (_,i) => `
    <div class="player-entry">
      <h3>بازیکن ${fa(i+1)}</h3>
      <div class="field">
        <label>نام بازیکن</label>
        <input name="playerName${i}" required placeholder="نام بازیکن ${i+1}">
      </div>
      <div class="field" style="margin-top:10px">
        <label>نام ${fa(teamCount)} تیم این بازیکن</label>
        <textarea name="playerTeams${i}" required placeholder="نام تیم‌ها را وارد کن؛ هر تیم در یک خط یا با کاما جدا شود"></textarea>
      </div>
    </div>
  `).join("");
}

function createTournament(form) {
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const playerCount = Number(data.get("playerCount"));
  const teamsPerPlayer = Number(data.get("teamsPerPlayer"));
  const qualifiers = Number(data.get("qualifiers"));

  if (!name || playerCount < 2 || teamsPerPlayer < 1 ||
      qualifiers < 1 || qualifiers > playerCount) {
    alert("اطلاعات تورنمنت صحیح نیست.");
    return;
  }

  const players = [];
  const allTeamNames = [];

  for (let i=0; i<playerCount; i++) {
    const playerName = String(data.get("playerName"+i) || "").trim();
    const teams = String(data.get("playerTeams"+i) || "")
      .split(/[\n,،]+/)
      .map(x => x.trim())
      .filter(Boolean);

    if (!playerName) {
      alert(`نام بازیکن ${i+1} وارد نشده است.`);
      return;
    }
    if (teams.length !== teamsPerPlayer) {
      alert(`${playerName} باید دقیقاً ${teamsPerPlayer} تیم وارد کند. تعداد فعلی: ${teams.length}`);
      return;
    }

    players.push({
      id:uid(),
      name:playerName,
      teams:teams.map((team,index) => ({
        id:uid(),
        name:team,
        ownerId:null,
        owner:playerName,
        seed:index+1
      }))
    });

    allTeamNames.push(...teams.map(x => x.toLowerCase()));
  }

  if (new Set(players.map(p => p.name.toLowerCase())).size !== players.length) {
    alert("نام بازیکنان نباید تکراری باشد.");
    return;
  }
  if (new Set(allTeamNames).size !== allTeamNames.length) {
    alert("نام تیم‌ها تکراری است. لطفاً نام تیم‌ها را یکتا وارد کن.");
    return;
  }

  players.forEach(player => player.teams.forEach(team => team.ownerId = player.id));

  const groups = Array.from({length:teamsPerPlayer}, (_,i) => ({
    id:uid(),
    name:"گروه " + String.fromCharCode(65+i),
    teams:players.map(p => ({...p.teams[i]}))
  }));

  const matches = [];
  groups.forEach(group => {
    for (let i=0; i<group.teams.length; i++) {
      for (let j=i+1; j<group.teams.length; j++) {
        matches.push({
          id:uid(),
          groupId:group.id,
          home:group.teams[i],
          away:group.teams[j],
          homeGoals:null,
          awayGoals:null,
          played:false
        });
      }
    }
  });

  const tournament = {
    id:uid(),
    name,
    players,
    groups,
    matches,
    qualifiers,
    points:{win:3,draw:1,loss:0},
    knockoutRounds:[],
    champion:null,
    createdAt:new Date().toISOString()
  };

  const all = load();
  all.unshift(tournament);
  save(all);
  activeId = tournament.id;
  render();
}

/* ---------- STANDINGS ---------- */

function standings(tournament, group) {
  const rows = group.teams.map(team => ({
    ...team, played:0, wins:0, draws:0, losses:0,
    gf:0, ga:0, gd:0, points:0
  }));

  tournament.matches
    .filter(m => m.groupId === group.id && m.played)
    .forEach(m => {
      const h = rows.find(t => t.id === m.home.id);
      const a = rows.find(t => t.id === m.away.id);
      if (!h || !a) return;

      h.played++; a.played++;
      h.gf += m.homeGoals; h.ga += m.awayGoals;
      a.gf += m.awayGoals; a.ga += m.homeGoals;

      if (m.homeGoals > m.awayGoals) {
        h.wins++; a.losses++;
        h.points += tournament.points.win;
        a.points += tournament.points.loss;
      } else if (m.homeGoals < m.awayGoals) {
        a.wins++; h.losses++;
        a.points += tournament.points.win;
        h.points += tournament.points.loss;
      } else {
        h.draws++; a.draws++;
        h.points += tournament.points.draw;
        a.points += tournament.points.draw;
      }
    });

  rows.forEach(t => t.gd = t.gf-t.ga);

  return rows.sort((a,b) =>
    b.points-a.points ||
    b.gd-a.gd ||
    b.gf-a.gf ||
    a.name.localeCompare(b.name)
  );
}

function allGroupMatchesPlayed(t) {
  return t.matches.length > 0 && t.matches.every(m => m.played);
}

/* ---------- KNOCKOUT ---------- */

function pairTeams(teams) {
  const pool = [...teams];
  const pairs = [];

  while (pool.length > 1) {
    const first = pool.shift();
    let index = pool.findIndex(t => t.ownerId !== first.ownerId);
    if (index < 0) index = 0;
    const second = pool.splice(index,1)[0];
    pairs.push([first,second]);
  }

  return {pairs, bye:pool[0] || null};
}

function startKnockout(tournament) {
  const qualified = [];

  tournament.groups.forEach(group => {
    const table = standings(tournament,group);
    qualified.push(...table.slice(0,tournament.qualifiers));
  });

  if (qualified.length < 2) {
    alert("برای ساخت حذفی حداقل دو تیم باید صعود کنند.");
    return;
  }

  const {pairs,bye} = pairTeams(qualified);
  const matches = pairs.map(([home,away]) => ({
    id:uid(),home,away,homeGoals:null,awayGoals:null,winner:null
  }));

  if (bye) {
    matches.push({
      id:uid(),home:bye,away:null,
      homeGoals:null,awayGoals:null,winner:bye,
      bye:true
    });
  }

  tournament.knockoutRounds = [{
    name:"مرحله اول حذفی",
    matches
  }];

  advanceKnockout(tournament);
}

function advanceKnockout(t) {
  const rounds = t.knockoutRounds;
  if (!rounds.length) return;

  const current = rounds[rounds.length-1];
  if (!current.matches.every(m => m.winner)) return;

  const winners = current.matches.map(m => m.winner).filter(Boolean);

  if (winners.length === 1) {
    if (!t.champion) {
      t.champion = winners[0];
      t.finishedAt = new Date().toISOString();

      const history = champions();
      history.unshift({
        tournament:t.name,
        player:t.champion.owner,
        team:t.champion.name,
        date:t.finishedAt
      });
      saveChampions(history);
    }
    return;
  }

  if (rounds.length > 1 && rounds[rounds.length-2].matches === current.matches) return;

  const {pairs,bye} = pairTeams(winners);
  const nextMatches = pairs.map(([home,away]) => ({
    id:uid(),home,away,homeGoals:null,awayGoals:null,winner:null
  }));

  if (bye) {
    nextMatches.push({
      id:uid(),home:bye,away:null,
      homeGoals:null,awayGoals:null,winner:bye,bye:true
    });
  }

  const labels = {
    2:"فینال",
    4:"نیمه‌نهایی",
    8:"یک‌چهارم نهایی",
    16:"یک‌هشتم نهایی"
  };

  rounds.push({
    name:labels[winners.length] || `مرحله ${fa(rounds.length+1)} حذفی`,
    matches:nextMatches
  });

  if (nextMatches.every(m => m.winner)) advanceKnockout(t);
}

/* ---------- RENDER COMPONENTS ---------- */

function groupHTML(t,g) {
  const table = standings(t,g);
  const matches = t.matches.filter(m => m.groupId === g.id);

  return `
    <section class="group-card">
      <h3>${esc(g.name)}</h3>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>تیم</th><th>بازی</th><th>برد</th><th>مساوی</th>
            <th>باخت</th><th>گل</th><th>تفاضل</th><th>امتیاز</th>
          </tr></thead>
          <tbody>
            ${table.map((r,i) => `
              <tr class="${i<t.qualifiers?'qualified':''}">
                <td>${esc(r.name)}<br><small>${esc(r.owner)}</small></td>
                <td>${fa(r.played)}</td><td>${fa(r.wins)}</td>
                <td>${fa(r.draws)}</td><td>${fa(r.losses)}</td>
                <td>${fa(r.gf)}:${fa(r.ga)}</td>
                <td>${fa(r.gd)}</td><td><strong>${fa(r.points)}</strong></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="match-list">
        ${matches.map(m => groupMatchHTML(m)).join("")}
      </div>
    </section>
  `;
}

function groupMatchHTML(m) {
  return `
    <form class="match-card group-match-form" data-match="${m.id}">
      <div class="match-line">
        <span class="team-name">${esc(m.home.name)}</span>
        <div class="score-box">
          <input class="score-input" name="homeGoals" type="number" min="0" required value="${m.played?m.homeGoals:""}" aria-label="گل ${esc(m.home.name)}">
          <b>:</b>
          <input class="score-input" name="awayGoals" type="number" min="0" required value="${m.played?m.awayGoals:""}" aria-label="گل ${esc(m.away.name)}">
        </div>
        <span class="team-name">${esc(m.away.name)}</span>
      </div>
      <div class="match-meta">${esc(m.home.owner)} مقابل ${esc(m.away.owner)} · ${m.played?"ثبت شده":"در انتظار نتیجه"}</div>
      <div class="actions">
        <button class="btn small primary" type="submit">ثبت نتیجه</button>
      </div>
    </form>
  `;
}

function knockoutHTML(t) {
  if (!t.knockoutRounds.length) {
    return `
      <div class="panel">
        <h3>مرحله حذفی</h3>
        <p class="hint">بعد از ثبت تمام نتایج گروهی، تیم‌های صعودکننده وارد جدول حذفی می‌شن.</p>
        <div class="actions">
          <button class="btn primary" data-action="start-knockout" ${allGroupMatchesPlayed(t)?"":"disabled"}>
            ساخت جدول حذفی
          </button>
        </div>
        ${!allGroupMatchesPlayed(t)?'<p class="hint">ابتدا تمام بازی‌های گروهی را ثبت کن.</p>':""}
      </div>
    `;
  }

  return `
    ${t.champion?`
      <div class="champion-box">
        <div class="trophy">🏆</div>
        <h2>قهرمان KICKOFF</h2>
        <h3>${esc(t.champion.name)}</h3>
        <p>${esc(t.champion.owner)}</p>
        <p class="hint">${esc(t.name)}</p>
      </div>`:""}
    ${t.knockoutRounds.map((round,ri) => `
      <h3 class="round-title">${esc(round.name)}</h3>
      <div class="match-list">
        ${round.matches.map(m => knockoutMatchHTML(m,ri)).join("")}
      </div>
    `).join("")}
  `;
}

function knockoutMatchHTML(m,ri) {
  if (m.bye) {
    return `<div class="match-card">
      <div class="match-line">
        <span class="team-name">${esc(m.home.name)}</span>
        <span class="tag">استراحت و صعود مستقیم</span>
        <span class="team-name">BYE</span>
      </div>
    </div>`;
  }

  return `
    <form class="match-card knockout-form" data-round="${ri}" data-match="${m.id}">
      <div class="match-line">
        <span class="team-name">${esc(m.home.name)}</span>
        <div class="score-box">
          <input class="score-input" name="homeGoals" type="number" min="0" required value="${m.homeGoals ?? ""}">
          <b>:</b>
          <input class="score-input" name="awayGoals" type="number" min="0" required value="${m.awayGoals ?? ""}">
        </div>
        <span class="team-name">${esc(m.away.name)}</span>
      </div>
      ${m.homeGoals !== null && m.homeGoals === m.awayGoals ? `
        <div class="field" style="margin-top:10px">
          <label>برنده پس از پنالتی</label>
          <select name="winner">
            <option value="">انتخاب برنده</option>
            <option value="home" ${m.winner?.id===m.home.id?"selected":""}>${esc(m.home.name)}</option>
            <option value="away" ${m.winner?.id===m.away.id?"selected":""}>${esc(m.away.name)}</option>
          </select>
        </div>`:""}
      ${m.winner?`<p class="match-meta">برنده: ${esc(m.winner.name)}</p>`:""}
      <div class="actions">
        <button class="btn small gold" type="submit">ثبت نتیجه و صعود</button>
      </div>
    </form>
  `;
}

/* ---------- TOURNAMENT DETAIL ---------- */

function detail(t) {
  app.innerHTML = `
    <div class="section-heading">
      <div>
        <span class="kicker">TOURNAMENT CENTER</span>
        <h2>${esc(t.name)}</h2>
        <p class="hint">${fa(t.players.length)} بازیکن · ${fa(t.players.length*t.groups.length)} تیم · ${fa(t.groups.length)} گروه</p>
      </div>
      <button class="btn" data-action="home">خانه</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card"><span>بازیکنان</span><strong>${fa(t.players.length)}</strong></div>
      <div class="stat-card"><span>تیم‌ها</span><strong>${fa(t.players.length*t.groups.length)}</strong></div>
      <div class="stat-card"><span>بازی‌های ثبت‌شده</span><strong>${fa(t.matches.filter(m=>m.played).length)}</strong></div>
    </div>

    <div class="tabs">
      <button class="btn tab active" data-action="show-groups">مرحله گروهی</button>
      <button class="btn tab" data-action="show-knockout">مرحله حذفی</button>
      <button class="btn tab" data-action="show-teams">تیم‌ها و بازیکنان</button>
    </div>

    <div id="detailContent">
      ${t.groups.map(g => groupHTML(t,g)).join("")}
    </div>

    <div class="actions">
      <button class="btn danger" data-action="delete-tournament">حذف تورنمنت</button>
    </div>
  `;
}

/* ---------- HOME ---------- */

function home() {
  const all = load();
  const totalPlayers = new Set(all.flatMap(t=>t.players.map(p=>p.name))).size;
  const totalMatches = all.reduce((sum,t)=>sum+t.matches.filter(m=>m.played).length,0);
  const history = champions();

  app.innerHTML = `
    <section class="hero">
      <span class="kicker">FOOTBALL TOURNAMENT MANAGER</span>
      <h1>وقتشه رقابت <span class="neon-text">شروع بشه!</span></h1>
      <p>تیم‌ها رو وارد کن، گروه‌ها رو بساز، نتایج رو ثبت کن و قهرمان رو مشخص کن.</p>
      <button class="btn primary" data-action="create">＋ ساخت تورنمنت جدید</button>
    </section>

    <div class="stats-grid">
      <div class="stat-card"><span>تورنمنت‌ها</span><strong>${fa(all.length)}</strong></div>
      <div class="stat-card"><span>بازیکنان</span><strong>${fa(totalPlayers)}</strong></div>
      <div class="stat-card"><span>نتایج ثبت‌شده</span><strong>${fa(totalMatches)}</strong></div>
    </div>

    <div class="section-heading"><h2>تورنمنت‌های من</h2></div>
    <div class="tournament-list">
      ${all.length ? all.map(t=>`
        <article class="tournament-card">
          <div>
            <span class="tag">${t.champion?"پایان‌یافته":"در حال برگزاری"}</span>
            <h3>${esc(t.name)}</h3>
            <p>${fa(t.players.length)} بازیکن · ${fa(t.groups.length)} گروه · ${fa(t.players.length*t.groups.length)} تیم</p>
          </div>
          <button class="btn primary" data-action="open" data-id="${t.id}">مدیریت مسابقات</button>
        </article>
      `).join(""):'<div class="empty">هنوز تورنمنتی نساختی.<br>اولین مسابقه‌ات رو شروع کن!</div>'}
    </div>

    <div class="section-heading"><h2>تالار قهرمانان 👑</h2></div>
    <div class="hall-list">
      ${history.length?history.map(c=>`
        <div class="hall-item">
          🏆 <strong>${esc(c.team)}</strong>
          <p class="hint">بازیکن: ${esc(c.player)} · تورنمنت: ${esc(c.tournament)}</p>
        </div>
      `).join(""):'<div class="empty">هنوز قهرمانی ثبت نشده است.</div>'}
    </div>
  `;
}

/* ---------- MAIN RENDER ---------- */

function render() {
  if (activeId) {
    const t = getTournament(activeId);
    if (t) detail(t);
    else { activeId=null; home(); }
  } else {
    home();
  }
}

/* ---------- EVENTS ---------- */

app.addEventListener("click", event => {
  const btn = event.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  if (action === "create") createForm();
  if (action === "home") { activeId=null; render(); }

  if (action === "open") {
    activeId=btn.dataset.id;
    render();
  }

  if (action === "show-groups") {
    const t=getTournament(activeId);
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("detailContent").innerHTML =
      t.groups.map(g=>groupHTML(t,g)).join("");
  }

  if (action === "show-knockout") {
    const t=getTournament(activeId);
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("detailContent").innerHTML=knockoutHTML(t);
  }

  if (action === "show-teams") {
    const t=getTournament(activeId);
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("detailContent").innerHTML=`
      <div class="panel">
        ${t.players.map(p=>`
          <div class="player-entry">
            <h3>${esc(p.name)}</h3>
            <p>${p.teams.map(team=>esc(team.name)).join("، ")}</p>
          </div>
        `).join("")}
      </div>`;
  }

  if (action === "start-knockout") {
    updateTournament(activeId,t=>startKnockout(t));
  }

  if (action === "delete-tournament") {
    if (!confirm("این تورنمنت و نتایج آن حذف شود؟")) return;
    save(load().filter(t=>t.id!==activeId));
    activeId=null;
    render();
  }
});

app.addEventListener("change", event => {
  if (event.target.id==="playerCountInput" || event.target.id==="teamsPerPlayerInput") {
    updatePlayerFields();
  }
});

app.addEventListener("submit", event => {
  event.preventDefault();
  const form=event.target;

  if (form.id==="createForm") {
    createTournament(form);
    return;
  }

  if (form.classList.contains("group-match-form")) {
    const id=form.dataset.match;
    const fd=new FormData(form);
    const hg=Number(fd.get("homeGoals"));
    const ag=Number(fd.get("awayGoals"));

    if (!Number.isInteger(hg)||!Number.isInteger(ag)||hg<0||ag<0) {
      alert("نتیجه باید عدد صحیح و مثبت باشد.");
      return;
    }

    updateTournament(activeId,t=>{
      const m=t.matches.find(x=>x.id===id);
      if (!m) return;
      m.homeGoals=hg;
      m.awayGoals=ag;
      m.played=true;
    });
    return;
  }

  if (form.classList.contains("knockout-form")) {
    const id=form.dataset.match;
    const roundIndex=Number(form.dataset.round);
    const fd=new FormData(form);
    const hg=Number(fd.get("homeGoals"));
    const ag=Number(fd.get("awayGoals"));

    if (!Number.isInteger(hg)||!Number.isInteger(ag)||hg<0||ag<0) {
      alert("نتیجه صحیح وارد کن.");
      return;
    }

    updateTournament(activeId,t=>{
      const match=t.knockoutRounds[roundIndex]?.matches.find(x=>x.id===id);
      if (!match) return;

      let winner=null;
      if (hg>ag) winner=match.home;
      else if (ag>hg) winner=match.away;
      else {
        const choice=fd.get("winner");
        if (!choice) {
          alert("بازی مساوی شده؛ برنده پنالتی را انتخاب کن.");
          return;
        }
        winner=choice==="home"?match.home:match.away;
      }

      match.homeGoals=hg;
      match.awayGoals=ag;
      match.winner=winner;

      t.knockoutRounds=t.knockoutRounds.slice(0,roundIndex+1);
      t.champion=null;
      advanceKnockout(t);
    });
  }
});

/* ---------- START ---------- */

render();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.error("Service Worker:",error));
  });
}
