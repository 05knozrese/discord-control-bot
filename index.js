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

// ---------------- GAMING TABLE ----------------
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

// ---------------- YOUTUBE TABLE ----------------
db.run(
  `CREATE TABLE IF NOT EXISTS youtube (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT UNIQUE,
    channel_name TEXT,
    notify_channel TEXT,
    last_video TEXT
  )`,
  (e) => { if (e) console.error('Failed to create youtube table', e); }
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
  return new EmbedBuilder()
    .setTitle("🎛 CONTROL PANEL V14")
    .setDescription(
`🎮 Gaming System
📺 YouTube Dashboard
🔔 Notifications`
    )
    .setColor("Blue");
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("home").setLabel("🏠 Home").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("gaming").setLabel("🎮 Gaming").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("youtube").setLabel("📺 YouTube").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("notif").setLabel("🔔 Alerts").setStyle(ButtonStyle.Primary)
  );
}

// ---------------- MESSAGES ----------------
client.on("messageCreate", async (m) => {
  // ignore other bots
  if (m.author?.bot) return;

  if (m.content === "!panel") {
    return m.reply({ embeds: [panel()], components: [buttons()] });
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
});

// ---------------- INTERACTIONS ----------------
client.on("interactionCreate", async (i) => {
  try {
    if (!i.isButton()) return;

    // For component interactions we can defer the update or the reply.
    // DeferReply is fine if we plan to use editReply/followUp.
    await i.deferReply({ ephemeral: true });

    const handled = await youtube.handle(i, db);
    if (handled) return;

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
    console.log(e);
    try { await i.editReply("⚠️ Error"); } catch {}
  }
});

// ---------------- START ----------------
client.once("ready", () => {
  console.log(`ONLINE ${client.user.tag}`);
});

client.login(process.env.TOKEN).catch(e => {
  console.error('Failed to login - check TOKEN env var', e);
});
