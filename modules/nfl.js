// modules/nfl.js
// Minimal NFL module: pick favorite team + view schedule (uses ESPN public endpoints)

const https = require("https");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

// short map for quick name -> abbreviation resolution
const TEAM_MAP = {
  eagles: "PHI", philly: "PHI",
  chiefs: "KC",
  cowboys: "DAL",
  giants: "NYG",
  commanders: "WAS", redskins: "WAS",
  bills: "BUF",
  dolphins: "MIA",
  jets: "NYJ",
  patriots: "NE",
  ravens: "BAL",
  steelers: "PIT",
  browns: "CLE",
  bengals: "CIN",
  colts: "IND",
  texans: "HOU",
  jaguars: "JAX",
  titans: "TEN",
  bears: "CHI",
  packers: "GB",
  lions: "DET",
  vikings: "MIN",
  saints: "NO",
  buccaneers: "TB",
  bucs: "TB",
  falcons: "ATL",
  panthers: "CAR",
  "49ers": "SF", niners: "SF",
  seahawks: "SEA",
  rams: "LAR",
  cardinals: "ARI"
};

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
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
  if (i.replied || i.deferred) {
    await replyEphemeral(i, { content: 'Unable to open modal: interaction already replied. Please try again.' });
    return false;
  }
  try {
    await i.showModal(modal);
    return true;
  } catch (e) {
    console.error('showModal error', e);
    await replyEphemeral(i, { content: 'Failed to open modal. Try again.' });
    return false;
  }
}

function resolveTeamQuick(input) {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return TEAM_MAP[key] || null;
}

function fetchJson(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode}`));
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error("timeout")));
  });
}

// Try to find a team via ESPN teams API and return normalized { abbrev, slug, displayName }
async function findTeamViaEspn(input) {
  try {
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
    const key = input.trim().toLowerCase();

    // first try quick map
    const quick = resolveTeamQuick(input);
    if (quick) {
      const match = teams.find(t => (t.team?.abbreviation || "").toLowerCase() === quick.toLowerCase());
      if (match) return { abbrev: match.team.abbreviation, slug: match.team.slug, displayName: match.team.displayName };
    }

    // try matching by abbreviation or displayName or shortName
    let match = teams.find(t => (t.team?.abbreviation || "").toLowerCase() === key);
    if (!match) {
      match = teams.find(t => (t.team?.displayName || "").toLowerCase().includes(key) || (t.team?.shortDisplayName || "").toLowerCase().includes(key));
    }
    if (!match) return null;
    return { abbrev: match.team.abbreviation, slug: match.team.slug, displayName: match.team.displayName };
  } catch (e) {
    console.error('findTeamViaEspn error', e);
    return null;
  }
}

// Try to fetch schedule for an ESPN team abbreviation via public API.
// Returns a short text summary or null on failure (caller will fall back to link).
async function getTeamScheduleText(abbrev) {
  if (!abbrev) return null;
  // ESPN has team schedule endpoints, but they vary — attempt a best-effort call
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${abbrev}/schedule`;
  try {
    const data = await fetchJson(url).catch(() => null);
    if (!data || !data.events) return null;

    // Build up to next ~10 schedule lines (date + opponent + location + result/score)
    const lines = data.events.slice(0, 10).map(ev => {
      const comp = ev.competitions?.[0];
      if (!comp) return null;
      const home = comp.competitors?.find(c => c.homeAway === "home");
      const away = comp.competitors?.find(c => c.homeAway === "away");
      const date = new Date(ev.date).toLocaleString();
      const status = comp.status?.type?.shortDetail || comp.status?.type?.description || "";
      const homeAbbr = home?.team?.abbreviation || "";
      const awayAbbr = away?.team?.abbreviation || "";
      const scorePart = (home?.score !== undefined && away?.score !== undefined) ? ` — ${home.score}-${away.score}` : "";
      return `${date} • ${awayAbbr} @ ${homeAbbr} ${scorePart} ${status}`.trim();
    }).filter(Boolean);

    return lines.length ? lines.join("\n") : null;
  } catch (e) {
    console.error('getTeamScheduleText error', e);
    return null;
  }
}

// ---------------- HANDLER ----------------
async function handle(i, db, client) {
  // Dashboard
  if (i.customId === "nfl") {
    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("home").setLabel("🏠 Home").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("nfl_pick").setLabel("Pick Team").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("nfl_manage").setLabel("My Team").setStyle(ButtonStyle.Primary)
      )
    ];
    const content = "🏈 NFL DASHBOARD\n\nPick a favorite team to track; view schedule from ESPN.";
    try {
      if (i.update && !i.replied && !i.deferred) await i.update({ content, components });
      else await replyEphemeral(i, { content, components });
    } catch (e) {
      console.error('nfl dashboard error', e);
      await replyEphemeral(i, { content: 'Error opening NFL dashboard' });
    }
    return true;
  }

  // Open modal to pick a team
  if (i.customId === "nfl_pick") {
    const modal = new ModalBuilder().setCustomId('modal_nfl_pick').setTitle('Pick Favorite NFL Team')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('team').setLabel('Team name or abbreviation (e.g., NE or Patriots)').setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
    await tryShowModal(i, modal);
    return true;
  }

  // Manage view: show saved favorite and allow viewing schedule
  if (i.customId === "nfl_manage") {
    try {
      const rows = await dbAll(db, "SELECT * FROM nfl_favorites WHERE user_id = ?", [i.user.id]);
      if (!rows.length) return await replyEphemeral(i, { content: 'You have no favorite team set. Use Pick Team to choose one.' });
      const fav = rows[0];
      const components = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nfl_view_schedule').setLabel('View Schedule').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('nfl_remove').setLabel('Remove Favorite').setStyle(ButtonStyle.Danger)
      )];
      await replyEphemeral(i, { content: `Your favorite team: **${fav.team_name}** (${fav.team_id})`, components });
    } catch (e) {
      console.error('nfl manage error', e);
      await replyEphemeral(i, { content: 'Failed to load your favorite team' });
    }
    return true;
  }

  // Remove favorite
  if (i.customId === 'nfl_remove') {
    try {
      await dbRun(db, "DELETE FROM nfl_favorites WHERE user_id = ?", [i.user.id]);
      await replyEphemeral(i, { content: 'Favorite team removed' });
    } catch (e) {
      console.error('nfl remove failed', e);
      await replyEphemeral(i, { content: 'Failed to remove favorite' });
    }
    return true;
  }

  // View schedule button
  if (i.customId === 'nfl_view_schedule') {
    try {
      const rows = await dbAll(db, "SELECT * FROM nfl_favorites WHERE user_id = ?", [i.user.id]);
      if (!rows.length) return await replyEphemeral(i, { content: 'No favorite set. Use Pick Team first.' });
      const fav = rows[0];

      // Try to fetch schedule text via ESPN API
      let scheduleText = await getTeamScheduleText(fav.team_id).catch(() => null);
      // If scheduleText is not available, fallback to ESPN team page link
      const teamPage = `https://www.espn.com/nfl/team/_/name/${fav.team_id.toLowerCase()}/${encodeURIComponent(fav.team_name.toLowerCase().replace(/\s+/g, "-"))}`;

      if (scheduleText) {
        await replyEphemeral(i, { content: `🏈 Schedule for ${fav.team_name}:\n\n${scheduleText}\n\nFull page: ${teamPage}` });
      } else {
        await replyEphemeral(i, { content: `Could not fetch schedule; open ESPN team page: ${teamPage}` });
      }
    } catch (e) {
      console.error('nfl view schedule error', e);
      await replyEphemeral(i, { content: 'Failed to load schedule' });
    }
    return true;
  }

  return false;
}

// ---------------- MODAL SUBMIT ----------------
async function handleModal(i, db, client) {
  if (i.customId === 'modal_nfl_pick') {
    const raw = i.fields.getTextInputValue('team').trim();
    // First try quick map or ESPN lookup to normalize
    let normalized = resolveTeamQuick(raw);
    let displayName = raw;
    let slug = null;

    // Try ESPN lookup if quick map failed or to get slug/displayName
    const espn = await findTeamViaEspn(raw).catch(() => null);
    if (espn) {
      normalized = espn.abbrev;
      displayName = espn.displayName;
      slug = espn.slug;
    }

    if (!normalized) {
      // still not resolved — save raw as-is but inform user
      try {
        await dbRun(db, "INSERT OR REPLACE INTO nfl_favorites (user_id, team_id, team_name, created_at) VALUES (?,?,?,strftime('%s','now'))", [i.user.id, raw, raw]);
        await replyEphemeral(i, { content: `✅ Saved favorite team (unresolved input): ${raw}\nTip: try abbreviations like NE, KC, PHI or team names like 'Patriots'` });
      } catch (e) {
        console.error('nfl modal save failed', e);
        await replyEphemeral(i, { content: 'Failed to save favorite team' });
      }
      return;
    }

    // Save normalized abbrev + nice display name
    try {
      await dbRun(db, "INSERT OR REPLACE INTO nfl_favorites (user_id, team_id, team_name, created_at) VALUES (?,?,?,strftime('%s','now'))", [i.user.id, normalized, displayName]);
      const teamPage = slug ? `https://www.espn.com/nfl/team/_/name/${normalized.toLowerCase()}/${slug}` : `https://www.espn.com/nfl/team/_/name/${normalized.toLowerCase()}/${encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"))}`;
      await replyEphemeral(i, { content: `✅ Saved favorite team: **${displayName}** (${normalized})\nTeam page: ${teamPage}` });
    } catch (e) {
      console.error('nfl modal save failed', e);
      await replyEphemeral(i, { content: 'Failed to save favorite team' });
    }
    return;
  }

  await replyEphemeral(i, { content: 'Unknown modal' });
}

// Helper: try ESPN to resolve (reused from above)
async function findTeamViaEspn(input) {
  try {
    const data = await fetchJson("https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams");
    const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
    const key = input.trim().toLowerCase();

    // try quick map first
    const quick = resolveTeamQuick(input);
    if (quick) {
      const match = teams.find(t => (t.team?.abbreviation || "").toLowerCase() === quick.toLowerCase());
      if (match) return { abbrev: match.team.abbreviation, slug: match.team.slug, displayName: match.team.displayName };
    }

    let match = teams.find(t => (t.team?.abbreviation || "").toLowerCase() === key);
    if (!match) {
      match = teams.find(t => (t.team?.displayName || "").toLowerCase().includes(key) || (t.team?.shortDisplayName || "").toLowerCase().includes(key));
    }
    if (!match) return null;
    return { abbrev: match.team.abbreviation, slug: match.team.slug, displayName: match.team.displayName };
  } catch (e) {
    console.error('findTeamViaEspn error', e);
    return null;
  }
}

// fetchJson helper (reused)
function fetchJson(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode}`));
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error("timeout")));
  });
}

module.exports = { handle, handleModal };
