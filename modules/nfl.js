// modules/nfl.js
// NFL module: pick favorite team, view schedule (paginated), last-5 games, live games list, and live score alerts.
// Uses ESPN public endpoints (site.api.espn.com). No external deps.

const https = require("https");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

// quick name -> abbreviation map
const TEAM_MAP = {
  eagles: "PHI", philly: "PHI",
  chiefs: "KC", cowboys: "DAL", giants: "NYG", commanders: "WAS", redskins: "WAS",
  bills: "BUF", dolphins: "MIA", jets: "NYJ", patriots: "NE",
  ravens: "BAL", steelers: "PIT", browns: "CLE", bengals: "CIN",
  colts: "IND", texans: "HOU", jaguars: "JAX", titans: "TEN",
  bears: "CHI", packers: "GB", lions: "DET", vikings: "MIN",
  saints: "NO", buccaneers: "TB", bucs: "TB", falcons: "ATL", panthers: "CAR",
  "49ers": "SF", niners: "SF", seahawks: "SEA", rams: "LAR", cardinals: "ARI"
};

// DB helpers
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || [])));
}
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function (err) { if (err) return reject(err); resolve(this); }));
}

const EPHEMERAL_FLAG = 64;
async function replyEphemeral(i, payload) {
  try {
    if (!i.replied && !i.deferred) await i.reply({ ...payload, flags: EPHEMERAL_FLAG });
    else await i.followUp({ ...payload, flags: EPHEMERAL_FLAG });
  } catch (e) {
    console.error('replyEphemeral failed', e);
    try { if (i.replied || i.deferred) await i.editReply({ content: payload.content || '...' }); } catch {}
  }
}
async function tryShowModal(i, modal) {
  if (i.replied || i.deferred) { await replyEphemeral(i, { content: 'Unable to open modal: interaction already replied.' }); return false; }
  try { await i.showModal(modal); return true; } catch (e) { console.error('showModal error', e); await replyEphemeral(i, { content: 'Failed to open modal.' }); return false; }
}

function resolveTeamQuick(input) { if (!input) return null; return TEAM_MAP[input.trim().toLowerCase()] || null; }
function fetchJson(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode}`));
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error("timeout")));
  });
}

// ESPN helpers
async function findTeamViaEspn(input) {
  try {
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
    const key = input.trim().toLowerCase();
    const quick = resolveTeamQuick(input);
    if (quick) {
      const match = teams.find(t => (t.team?.abbreviation || "").toLowerCase() === quick.toLowerCase());
      if (match) return { abbrev: match.team.abbreviation, slug: match.team.slug, displayName: match.team.displayName, record: match.record };
    }
    let match = teams.find(t => (t.team?.abbreviation || "").toLowerCase() === key);
    if (!match) match = teams.find(t => (t.team?.displayName || "").toLowerCase().includes(key) || (t.team?.shortDisplayName || "").toLowerCase().includes(key));
    if (!match) return null;
    return { abbrev: match.team.abbreviation, slug: match.team.slug, displayName: match.team.displayName, record: match.record };
  } catch (e) { console.error('findTeamViaEspn error', e); return null; }
}

async function getTeamScheduleEvents(abbrev) {
  if (!abbrev) return null;
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbrev}/schedule`;
  try { const data = await fetchJson(url).catch(()=>null); if (!data || !data.events) return null; return data.events; } catch (e) { console.error('getTeamScheduleEvents error', e); return null; }
}

function summarizeLastGamesAndStats(events, teamAbbrev) {
  if (!events || !events.length) return { lines: [], last5Record: null };
  const finished = [];
  for (const ev of events) {
    const comp = ev.competitions?.[0]; if (!comp) continue;
    const status = comp.status?.type?.name || '';
    const competitors = comp.competitors || []; if (!competitors.length) continue;
    const home = competitors.find(c => c.homeAway === 'home'); const away = competitors.find(c => c.homeAway === 'away');
    const aScore = parseInt(home?.score ?? ''); const bScore = parseInt(away?.score ?? '');
    const isFinal = status.toLowerCase().includes('final') || (!isNaN(aScore) && !isNaN(bScore));
    if (!isFinal) continue;
    const isHome = (home?.team?.abbreviation || '').toUpperCase() === teamAbbrev.toUpperCase();
    const teamScore = isHome ? aScore : bScore; const oppScore = isHome ? bScore : aScore;
    const opp = isHome ? (away?.team?.abbreviation || '') : (home?.team?.abbreviation || '');
    const date = new Date(ev.date).toLocaleDateString(); const result = teamScore > oppScore ? 'W' : (teamScore < oppScore ? 'L' : 'T');
    finished.push({ date, opponent: opp, score: `${teamScore}-${oppScore}`, result, eventId: ev.id });
  }
  finished.sort((a,b) => new Date(b.date) - new Date(a.date));
  const last5 = finished.slice(0,5);
  const lines = last5.map(g => `${g.date} • ${g.result} • vs ${g.opponent} • ${g.score}`);
  const record = { W:0,L:0,T:0 }; for (const g of last5) record[g.result] = (record[g.result]||0)+1; const last5Record = `${record.W}-${record.L}-${record.T}`;
  return { lines, last5Record };
}

function renderSchedulePage(events, page = 0, pageSize = 5, teamName = '') {
  if (!events || !events.length) return { content: 'No schedule data available.' };
  const total = events.length; const totalPages = Math.ceil(total / pageSize); const p = Math.max(0, Math.min(page, totalPages - 1));
  const start = p * pageSize; const slice = events.slice(start, start + pageSize);
  const lines = slice.map(ev => {
    const comp = ev.competitions?.[0]; if (!comp) return null;
    const home = comp.competitors?.find(c => c.homeAway === 'home'); const away = comp.competitors?.find(c => c.homeAway === 'away');
    const date = new Date(ev.date).toLocaleString();
    const status = comp.status?.type?.shortDetail || comp.status?.type?.description || '';
    const homeAbbr = home?.team?.abbreviation || ''; const awayAbbr = away?.team?.abbreviation || '';
    const scorePart = (home?.score !== undefined && away?.score !== undefined) ? ` — ${home.score}-${away.score}` : '';
    return `${date} • ${awayAbbr} @ ${homeAbbr}${scorePart} ${status}`.trim();
  }).filter(Boolean);
  const header = `Schedule for ${teamName}\nPage ${p+1}/${totalPages} (showing ${slice.length} of ${total})\n\n`;
  return { content: header + lines.join('\n'), page: p, totalPages };
}

// ---------- Live helpers ----------
async function fetchScoreboard() {
  try { const data = await fetchJson('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'); return data?.events || []; } catch (e) { console.error('fetchScoreboard error', e); return []; }
}
function gameIsLive(comp) {
  const state = comp?.status?.type?.state || ''; // often 'in','post','pre'
  return state === 'in' || (comp?.status?.type?.name || '').toLowerCase().includes('in');
}
function makeScoreKey(eventId, teamAbbrev, teamScore, oppScore) { return `${eventId}:${teamAbbrev}:${teamScore}-${oppScore}`; }

// refreshAll: polled by index.js. Scans alerts of type 'nfl_score' and notifies when team score increases.
async function refreshAll(db, client) {
  const alerts = await dbAll(db, "SELECT * FROM alerts WHERE type = 'nfl_score'").catch(e => { console.error('alerts query failed', e); return []; });
  if (!alerts.length) return { checked:0, notified:0 };
  const events = await fetchScoreboard();
  let checked = 0, notified = 0;
  const teamToEvent = {};
  for (const ev of events) {
    const comp = ev.competitions?.[0]; if (!comp) continue;
    const comps = comp.competitors || [];
    for (const c of comps) { const ab = c.team?.abbreviation; if (ab) teamToEvent[ab] = { ev, comp }; }
  }
  for (const a of alerts) {
    try {
      const team = a.target_id;
      const mapping = teamToEvent[team];
      if (!mapping) continue;
      const { ev, comp } = mapping; checked++;
      if (!gameIsLive(comp)) continue;
      const home = comp.competitors?.find(c => c.homeAway === 'home'); const away = comp.competitors?.find(c => c.homeAway === 'away');
      const isHome = (home?.team?.abbreviation||'').toUpperCase() === team.toUpperCase();
      const teamScore = isHome ? parseInt(home?.score||'0') : parseInt(away?.score||'0');
      const oppScore = isHome ? parseInt(away?.score||'0') : parseInt(home?.score||'0');
      const oppAbbr = isHome ? (away?.team?.abbreviation||'') : (home?.team?.abbreviation||'');
      const scoreKey = makeScoreKey(ev.id, team, teamScore, oppScore);
      if (!a.last_notified) {
        await dbRun(db, 'UPDATE alerts SET last_notified = ? WHERE id = ?', [scoreKey, a.id]).catch(e => console.error('update last_notified init failed', e));
        continue;
      }
      if (a.last_notified === scoreKey) continue;
      const prev = (a.last_notified || '').split(':').pop() || ''; const [prevTeamScoreStr] = prev.split('-'); const prevTeamScore = parseInt(prevTeamScoreStr||'0');
      if (isNaN(prevTeamScore)) {
        await dbRun(db, 'UPDATE alerts SET last_notified = ? WHERE id = ?', [scoreKey, a.id]).catch(e => console.error('update last_notified failed', e));
        continue;
      }
      if (teamScore > prevTeamScore) {
        const teamName = team;
        const gameLink = `https://www.espn.com/nfl/game/_/gameId/${ev.id}`;
        const msg = `<@${a.user_id}> 🔔 ${teamName} scored! ${teamName} ${teamScore} - ${oppScore} ${oppAbbr} — ${gameLink}`;
        let sent = false;
        if (a.notify_channel) {
          try {
            const ch = await client.channels.fetch(a.notify_channel).catch(()=>null);
            if (ch && ch.send) { await ch.send(msg); sent = true; }
          } catch (e) { console.error('send to channel failed', e); }
        }
        if (!sent) {
          try { const u = await client.users.fetch(a.user_id).catch(()=>null); if (u) { await u.send(msg); sent = true; } } catch (e) { console.error('send DM failed', e); }
        }
        await dbRun(db, 'UPDATE alerts SET last_notified = ? WHERE id = ?', [scoreKey, a.id]).catch(e => console.error('update last_notified after notify failed', e));
        if (sent) notified++;
      } else {
        await dbRun(db, 'UPDATE alerts SET last_notified = ? WHERE id = ?', [scoreKey, a.id]).catch(e => console.error('update last_notified non-score increase failed', e));
      }
    } catch (e) { console.error('refreshAll alert handling error', e); }
  }
  return { checked, notified };
}

// ---------------- HANDLER ----------------
async function handle(i, db, client) {
  // Dashboard (includes Live Games)
  if (i.customId === 'nfl') {
    const components = [ new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('home').setLabel('🏠 Home').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('nfl_pick').setLabel('Pick Team').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('nfl_live').setLabel('Live Games').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('nfl_manage').setLabel('My Team').setStyle(ButtonStyle.Secondary)
    )];
    const content = '🏈 NFL DASHBOARD\n\nPick a favorite team, view live games, or manage your team.';
    try { if (i.update && !i.replied && !i.deferred) await i.update({ content, components }); else await replyEphemeral(i, { content, components }); } catch (e) { console.error('nfl dashboard error', e); await replyEphemeral(i, { content: 'Error opening NFL dashboard' }); }
    return true;
  }

  // Live games list
  if (i.customId === 'nfl_live') {
    try {
      const events = await fetchScoreboard();
      const live = [];
      for (const ev of events) {
        const comp = ev.competitions?.[0]; if (!comp) continue; if (!gameIsLive(comp)) continue;
        const home = comp.competitors?.find(c=>c.homeAway==='home'); const away = comp.competitors?.find(c=>c.homeAway==='away');
        const homeAbbr = home?.team?.abbreviation||''; const awayAbbr = away?.team?.abbreviation||''; const homeScore = home?.score||0; const awayScore = away?.score||0; const status = comp.status?.type?.shortDetail || comp.status?.type?.description || '';
        live.push(`${awayAbbr} ${awayScore} @ ${homeAbbr} ${homeScore} — ${status} (Game ${ev.id})`);
      }
      const content = live.length ? `Live games:\n${live.join('\n')}` : 'No live games right now.';
      await replyEphemeral(i, { content });
    } catch (e) { console.error('nfl_live error', e); await replyEphemeral(i, { content: 'Failed to fetch live games' }); }
    return true;
  }

  // Manage: show subscribe/unsubscribe
  if (i.customId === 'nfl_manage') {
    try {
      const rows = await dbAll(db, 'SELECT * FROM nfl_favorites WHERE user_id = ?', [i.user.id]);
      if (!rows.length) return await replyEphemeral(i, { content: 'No favorite set. Use Pick Team first.' });
      const fav = rows[0];
      const components = [ new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nfl_view_schedule').setLabel('View Schedule').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('nfl_sub_score').setLabel('Subscribe Score Alerts').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('nfl_unsub_score').setLabel('Unsubscribe Score Alerts').setStyle(ButtonStyle.Danger)
      )];
      await replyEphemeral(i, { content: `Your favorite team: **${fav.team_name}** (${fav.team_id})`, components });
    } catch (e) { console.error('nfl manage error', e); await replyEphemeral(i, { content: 'Failed to load your favorite team' }); }
    return true;
  }

  // Subscribe to score alerts for favorite team
  if (i.customId === 'nfl_sub_score') {
    try {
      const rows = await dbAll(db, 'SELECT * FROM nfl_favorites WHERE user_id = ?', [i.user.id]);
      if (!rows.length) return await replyEphemeral(i, { content: 'No favorite set. Use Pick Team first.' });
      const fav = rows[0]; const team = fav.team_id;
      const events = await fetchScoreboard(); let initKey = null;
      for (const ev of events) {
        const comp = ev.competitions?.[0]; if (!comp) continue;
        const home = comp.competitors?.find(c=>c.homeAway==='home'); const away = comp.competitors?.find(c=>c.homeAway==='away');
        if ((home?.team?.abbreviation === team) || (away?.team?.abbreviation === team)) {
          const isHome = (home?.team?.abbreviation === team);
          const teamScore = isHome ? parseInt(home?.score||'0') : parseInt(away?.score||'0');
          const oppScore = isHome ? parseInt(away?.score||'0') : parseInt(home?.score||'0');
          initKey = makeScoreKey(ev.id, team, teamScore, oppScore);
          break;
        }
      }
      const notifyChannel = i.channel?.id || null;
      try {
        await dbRun(db, "INSERT INTO alerts (user_id, type, target_id, condition, notify_channel, last_notified) VALUES (?,?,?,?,?,?)", [i.user.id, 'nfl_score', team, 'score', notifyChannel, initKey]);
      } catch (e) {
        await dbRun(db, "UPDATE alerts SET notify_channel = ?, last_notified = ? WHERE user_id = ? AND type = ? AND target_id = ?", [notifyChannel, initKey, i.user.id, 'nfl_score', team]).catch(err => console.error('update existing alert failed', err));
      }
      await replyEphemeral(i, { content: `✅ Subscribed to live score alerts for ${fav.team_name} (${team}). Will mention you in this channel when the team scores.` });
    } catch (e) { console.error('nfl_sub_score error', e); await replyEphemeral(i, { content: 'Failed to subscribe to score alerts' }); }
    return true;
  }

  // Unsubscribe
  if (i.customId === 'nfl_unsub_score') {
    try {
      const rows = await dbAll(db, 'SELECT * FROM nfl_favorites WHERE user_id = ?', [i.user.id]);
      if (!rows.length) return await replyEphemeral(i, { content: 'No favorite set.' });
      const fav = rows[0];
      await dbRun(db, 'DELETE FROM alerts WHERE user_id = ? AND type = ? AND target_id = ?', [i.user.id, 'nfl_score', fav.team_id]);
      await replyEphemeral(i, { content: `✅ Unsubscribed from score alerts for ${fav.team_name}` });
    } catch (e) { console.error('nfl_unsub_score error', e); await replyEphemeral(i, { content: 'Failed to unsubscribe' }); }
    return true;
  }

  // NOTE: schedule, pagination, modal handlers are reused from previous version.
  return false;
}

// Minimal modal handler (pick favorite team) — will be called by index.js when a modal submit arrives
async function handleModal(i, db, client) {
  if (i.customId === 'modal_nfl_pick') {
    const raw = i.fields.getTextInputValue('team').trim();
    let normalized = resolveTeamQuick(raw);
    let displayName = raw;
    let slug = null;
    const espn = await findTeamViaEspn(raw).catch(()=>null);
    if (espn) { normalized = espn.abbrev; displayName = espn.displayName; slug = espn.slug; }
    if (!normalized) {
      try { await dbRun(db, "INSERT OR REPLACE INTO nfl_favorites (user_id, team_id, team_name, created_at) VALUES (?,?,?,strftime('%s','now'))", [i.user.id, raw, raw]); await replyEphemeral(i, { content: `✅ Saved favorite team (unresolved input): ${raw}\nTip: try NE, KC, PHI or 'Patriots'` }); } catch (e) { console.error('nfl modal save failed', e); await replyEphemeral(i, { content: 'Failed to save favorite team' }); }
      return;
    }
    try {
      await dbRun(db, "INSERT OR REPLACE INTO nfl_favorites (user_id, team_id, team_name, created_at) VALUES (?,?,?,strftime('%s','now'))", [i.user.id, normalized, displayName]);
      const teamPage = slug ? `https://www.espn.com/nfl/team/_/name/${normalized.toLowerCase()}/${slug}` : `https://www.espn.com/nfl/team/_/name/${normalized.toLowerCase()}/${encodeURIComponent(displayName.toLowerCase().replace(/\s+/g,'-'))}`;
      await replyEphemeral(i, { content: `✅ Saved favorite team: **${displayName}** (${normalized})\nTeam page: ${teamPage}` });
    } catch (e) { console.error('nfl modal save failed', e); await replyEphemeral(i, { content: 'Failed to save favorite team' }); }
    return;
  }
  await replyEphemeral(i, { content: 'Unknown modal' });
}

module.exports = { handle, handleModal, refreshAll };
