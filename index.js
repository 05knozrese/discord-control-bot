const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./bot.db");

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

// ---------------- DB SAFE INIT ----------------
db.run(`CREATE TABLE IF NOT EXISTS gaming (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  game TEXT,
  startTime INTEGER,
  endTime INTEGER,
  duration INTEGER DEFAULT 0
)`);

// ---------------- SESSION TRACKING ----------------
const sessions = {};

// ---------------- PRESENCE ----------------
client.on("presenceUpdate", (oldP, newP) => {
  try {
    const userId = newP.userId;
    if (!userId) return;

    const activity = newP.activities?.find(a => a.type === 0);
    const oldActivity = oldP?.activities?.find(a => a.type === 0);

    if (activity && !oldActivity) {
      sessions[userId] = { game: activity.name, start: Date.now() };
    }

    if (!activity && oldActivity && sessions[userId]) {
      const s = sessions[userId];
      delete sessions[userId];

      const duration = Math.floor((Date.now() - s.start) / 60000);

      db.run(
        "INSERT INTO gaming (userId, game, startTime, endTime, duration) VALUES (?,?,?,?,?)",
        [userId, s.game, s.start, Date.now(), duration]
      );
    }

    if (activity && oldActivity && activity.name !== oldActivity.name) {
      const s = sessions[userId];

      if (s) {
        const duration = Math.floor((Date.now() - s.start) / 60000);

        db.run(
          "INSERT INTO gaming (userId, game, startTime, endTime, duration) VALUES (?,?,?,?,?)",
          [userId, s.game, s.start, Date.now(), duration]
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
    .setTitle("🎛 CONTROL PANEL V13")
    .setDescription("🏈 NFL | 🎮 Gaming | 📺 YouTube | 🔔 Alerts")
    .setColor("Blue");
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("home").setLabel("🏠 Home").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("nfl").setLabel("🏈 NFL").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("gaming").setLabel("🎮 Gaming").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("youtube").setLabel("📺 YouTube").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("notif").setLabel("🔔 Alerts").setStyle(ButtonStyle.Primary)
  );
}

// ---------------- MESSAGE ----------------
client.on("messageCreate", async (m) => {
  if (m.content === "!panel") {
    return m.reply({ embeds: [panel()], components: [buttons()] });
  }

  if (m.content === "!gaming stats") {
    db.all(
      "SELECT * FROM gaming WHERE userId=? ORDER BY id DESC LIMIT 10",
      [m.author.id],
      (err, rows) => {
        if (err) return m.reply("DB error");

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

    await i.deferReply({ ephemeral: true });

    // FIX: YouTube HANDLER FIRST
    const yt = await youtube.handle(i, db);
    if (yt) return;

    if (i.customId === "home") {
      return i.editReply({ embeds: [panel()], components: [buttons()] });
    }

    if (i.customId === "nfl") {
      return i.editReply("🏈 Eagles Dashboard");
    }

    if (i.customId === "gaming") {
      return i.editReply("🎮 Gaming tracking active");
    }

    if (i.customId === "notif") {
      return i.editReply("🔔 Alerts coming soon");
    }

  } catch (e) {
    console.log("interaction error", e);
    try { await i.editReply("⚠️ Error"); } catch {}
  }
});

client.once("ready", () => {
  console.log(`ONLINE ${client.user.tag}`);
});

client.login(process.env.TOKEN);
