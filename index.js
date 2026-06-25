const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./bot.db", (err) => {
  if (err) console.error('Failed to open database', err);
});

// modules
const youtube = require("./modules/youtube");
let nfl;
try {
  nfl = require("./modules/nfl");
} catch (e) {
  console.warn('NFL module not available:', e && e.message ? e.message : e);
  nfl = null;
}

// ---------------- CLIENT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers
  ]
});

// ---------------- MIGRATIONS / TABLES ----------------
db.run(
  `CREATE TABLE IF NOT EXISTS gaming (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    game TEXT,
    startTime INTEGER,
    endTime INTEGER,
    duration INTEGER DEFAULT 0
  )`,
  (e) => { if (e) console.error('Failed to create gaming table', e); }
);

db.run(
  `CREATE TABLE IF NOT EXISTS youtube (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT UNIQUE,
    channel_name TEXT,
    owner_ids TEXT,
    notify_channel TEXT,
    last_video TEXT
  )`,
  (e) => { if (e) console.error('Failed to create youtube table', e); }
);

db.run(
  `CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    condition TEXT NOT NULL,
    notify_channel TEXT,
    last_notified TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`,
  (e) => { if (e) console.error('Failed to create alerts table', e); }
);

// NFL favorites table
db.run(
  `CREATE TABLE IF NOT EXISTS nfl_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT UNIQUE,
    team_id TEXT,
    team_name TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`,
  (e) => { if (e) console.error('Failed to create nfl_favorites table', e); }
);

// ---------------- SESSIONS ----------------
const sessions = {};

// global error handlers
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

// ---------------- PRESENCE TRACKER ----------------
client.on("presenceUpdate", (oldPresence, newPresence) => {
  try {
    const userId = newPresence?.userId || newPresence?.user?.id;
    if (!userId) return;

    const activity = newPresence?.activities?.find(a => a.type === ActivityType.Playing);
    const oldActivity = oldPresence?.activities?.find(a => a.type === ActivityType.Playing);

    if (activity && !oldActivity) {
      sessions[userId] = { game: activity.name, start: Date.now() };
    }

    if (!activity && oldActivity && sessions[userId]) {
      const s = sessions[userId];
      delete sessions[userId];

      const duration = Math.floor((Date.now() - s.start) / 60000);

      db.run(
        "INSERT INTO gaming (userId, game, startTime, endTime, duration) VALUES (?,?,?,?,?)",
        [userId, s.game, s.start, Date.now(), duration],
        (err) => { if (err) console.error('DB insert gaming error', err); }
      );
    }

    if (activity && oldActivity && activity.name !== oldActivity.name) {
      const s = sessions[userId];

      if (s) {
        const duration = Math.floor((Date.now() - s.start) / 60000);

        db.run(
          "INSERT INTO gaming (userId, game, startTime, endTime, duration) VALUES (?,?,?,?,?)",
          [userId, s.game, s.start, Date.now(), duration],
          (err) => { if (err) console.error('DB insert gaming error', err); }
        );
      }

      sessions[userId] = { game: activity.name, start: Date.now() };
    }
  } catch (e) {
    console.log("presence error", e);
  }
});

// ---------------- PANEL ----------------
function panel() {
  const nflAvailable = !!nfl;
  return new EmbedBuilder()
    .setTitle("🎛 CONTROL PANEL V14")
    .setDescription(
`🎮 Gaming System
📺 YouTube Dashboard
🏈 NFL ${nflAvailable ? "" : "(unavailable)"}
🔔 Alerts`
    )
    .setColor("Blue");
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("home").setLabel("🏠 Home").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("gaming").setLabel("🎮 Gaming").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("youtube").setLabel("📺 YouTube").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("nfl").setLabel("🏈 NFL").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("notif").setLabel("🔔 Alerts").setStyle(ButtonStyle.Primary)
  );
}

// ---------------- INTERACTION HELPERS ----------------
const EPHEMERAL_FLAG = 64;

async function replyEphemeral(i, payload) {
  // payload: { content, components, embeds, etc. }
  try {
    if (!i.replied && !i.deferred) {
      await i.reply({ ...payload, flags: EPHEMERAL_FLAG });
    } else {
      await i.followUp({ ...payload, flags: EPHEMERAL_FLAG });
    }
  } catch (e) {
    console.error('replyEphemeral failed', e);
    try {
      if (i.replied || i.deferred) await i.editReply({ content: payload.content || '...' });
    } catch (err) { /* ignore */ }
  }
}

// ---------------- MESSAGES ----------------
client.on("messageCreate", async (m) => {
  // ignore other bots
  if (m.author?.bot) return;

  try {
    // QUICK: allow setting favorite team via chat command: !team set <team>
    if (m.content && m.content.toLowerCase().startsWith("!team set ")) {
      const team = m.content.split(" ").slice(2).join(" ").trim();
      if (!team) return m.reply("Usage: !team set <team>");

      // store or replace favorite
      db.run(
        "INSERT OR REPLACE INTO nfl_favorites (user_id, team_id, team_name, created_at) VALUES (?,?,?,strftime('%s','now'))",
        [m.author.id, team, team],
        (err) => {
          if (err) {
            console.error('Failed to save favorite team via chat command', err);
            return m.reply('Failed to set favorite team');
          }
          return m.reply(`🏈 Favorite team set to **${team}**`);
        }
      );
      return;
    }

    if (m.content === "!panel") {
      try {
        await m.reply({ embeds: [panel()], components: [buttons()] });
      } catch (err) {
        console.error('!panel reply failed, falling back to channel.send', err);
        try { await m.channel.send({ embeds: [panel()], components: [buttons()] }); } catch (err2) { console.error('Fallback send failed', err2); }
      }
      return;
    }

    if (m.content === "!gaming stats") {
      db.all(
        "SELECT * FROM gaming WHERE userId=? ORDER BY id DESC LIMIT 10",
        [m.author.id],
        (err, rows) => {
          if (err) {
            console.error('DB error fetching gaming stats', err);
            return m.reply("DB error");
          }

          let total = 0;

          const list = (rows || []).map(r => {
            total += r.duration || 0;
            return `🎮 ${r.game} — ${r.duration || 0} min`;
          });

          m.reply(
`🎮 GAMING STATS

⏱ Total: ${total} min

${list.join("\n") || "No data"}`
          );
        }
      );
    }
  } catch (e) {
    console.error('messageCreate handler error', e);
  }
});

// ---------------- INTERACTIONS ----------------
client.on("interactionCreate", async (i) => {
  try {
    // 1) Modal submits first
    if (i.isModalSubmit && i.isModalSubmit()) {
      if (i.customId && i.customId.startsWith('modal_yt')) {
        await youtube.handleModal(i, db, client);
        return;
      }
      if (nfl && i.customId && i.customId.startsWith('modal_nfl')) {
        await nfl.handleModal(i, db, client);
        return;
      }
    }

    // 2) Only handle button interactions here
    if (!i.isButton || !i.isButton()) return;

    // Let modules handle interactions that may show modals or reply synchronously
    const yHandled = await youtube.handle(i, db, client);
    if (yHandled) return;
    if (nfl) {
      const nHandled = await nfl.handle(i, db, client);
      if (nHandled) return;
    } else if (i.customId === 'nfl') {
      // NFL button pressed but module missing — inform user briefly
      await replyEphemeral(i, { content: "NFL features are currently unavailable. The module failed to load on startup." });
      return;
    }

    // Only defer if interaction still open
    if (!i.replied && !i.deferred) {
      try {
        await i.deferReply({ flags: EPHEMERAL_FLAG });
      } catch (err) {
        // ignore defer errors (interaction may have been replied in-between)
        console.warn('deferReply failed (ignored):', err && err.message ? err.message : err);
      }
    }

    if (i.customId === "home") {
      return i.editReply({ embeds: [panel()], components: [buttons()] });
    }

    if (i.customId === "gaming") {
      return i.editReply("🎮 Gaming tracking active");
    }

    if (i.customId === "notif") {
      return i.editReply("🔔 Alerts coming soon");
    }

  } catch (e) {
    console.log('interactionCreate error', e);
    try {
      if (i.replied || i.deferred) await i.editReply({ content: "⚠️ Error", flags: EPHEMERAL_FLAG });
      else await i.reply({ content: "⚠️ Error", flags: EPHEMERAL_FLAG });
    } catch (err) { /* ignore */ }
  }
});

// ---------------- START ----------------
let isPolling = false;
async function start() {
  // start poller every 1 minute
  setInterval(async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      await youtube.refreshAll(db, client);
      if (nfl && nfl.refreshAll) {
        await nfl.refreshAll(db, client);
      }
    } catch (e) {
      console.error('Background refresh error', e);
    } finally {
      isPolling = false;
    }
  }, 60 * 1000);

  client.once("ready", () => {
    console.log(`ONLINE ${client.user.tag}`);
    if (!nfl) console.warn('NFL module was not loaded; NFL button will show but functionality is disabled until the module is present.');
  });

  client.login(process.env.TOKEN).catch(e => {
    console.error('Failed to login - check TOKEN env var', e);
  });
}

start();
