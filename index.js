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

// ---------------- MODULES ----------------
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
db.run(`
CREATE TABLE IF NOT EXISTS gaming (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  game TEXT,
  startTime INTEGER,
  endTime INTEGER,
  duration INTEGER DEFAULT 0
)
`);

// ---------------- SESSIONS ----------------
const sessions = {};

// ---------------- PRESENCE TRACKER ----------------
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
    .setTitle("🎛 CONTROL PANEL V12")
    .setDescription(
`🏈 NFL Dashboard
🎮 Gaming Tracker
📺 YouTube Dashboard
🔔 Notifications`
    )
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
    return m.reply({
      embeds: [panel()],
      components: [buttons()]
    });
  }
});

// ---------------- INTERACTIONS (FIXED SAFE FLOW) ----------------
client.on("interactionCreate", async (i) => {
  try {

    // IMPORTANT: ONLY HANDLE BUTTONS
    if (!i.isButton()) return;

    // ACK FIRST (prevents interaction failure)
    await i.deferReply({ ephemeral: true });

    // 🔥 YOUTUBE HANDLER FIRST (SAFE)
    const handled = await youtube.handleInteraction(i, db);
    if (handled) return;

    // HOME
    if (i.customId === "home") {
      return i.editReply({
        embeds: [panel()],
        components: [buttons()]
      });
    }

    // NFL
    if (i.customId === "nfl") {
      return i.editReply(
`🏈 NFL DASHBOARD

⭐ Favorite: Eagles

📅 https://www.espn.com/nfl/team/schedule/_/name/phi/philadelphia-eagles`
      );
    }

    // GAMING
    if (i.customId === "gaming") {
      return i.editReply(
`🎮 GAMING TRACKER

✔ Auto detects Discord activity
✔ Saves playtime`
      );
    }

    // NOTIF
    if (i.customId === "notif") {
      return i.editReply(
`🔔 NOTIFICATIONS

Coming soon`
      );
    }

  } catch (err) {
    console.log("interaction error:", err);

    try {
      if (i.deferred) {
        return i.editReply("⚠️ Error occurred");
      }
    } catch {}

    try {
      return i.reply({ content: "⚠️ Failed", ephemeral: true });
    } catch {}
  }
});

// ---------------- START ----------------
client.once("ready", () => {
  console.log(`✅ ONLINE: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
