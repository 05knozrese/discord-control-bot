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

// ---------------- INTENTS ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMembers
  ]
});

// ---------------- DB ----------------
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

// ---------------- ACTIVE SESSIONS ----------------
const sessions = {};

// ---------------- AUTO PRESENCE TRACKER ----------------
client.on("presenceUpdate", (oldP, newP) => {
  try {
    const userId = newP.userId;
    if (!userId) return;

    const activity = newP.activities?.find(a => a.type === 0);
    const oldActivity = oldP?.activities?.find(a => a.type === 0);

    // START GAME
    if (activity && !oldActivity) {
      sessions[userId] = {
        game: activity.name,
        start: Date.now()
      };
    }

    // STOP GAME
    if (!activity && oldActivity && sessions[userId]) {
      const s = sessions[userId];
      delete sessions[userId];

      const duration = Math.floor((Date.now() - s.start) / 60000);

      db.run(
        "INSERT INTO gaming (userId, game, startTime, endTime, duration) VALUES (?,?,?,?,?)",
        [userId, s.game, s.start, Date.now(), duration]
      );
    }

    // SWITCH GAME
    if (activity && oldActivity && activity.name !== oldActivity.name) {
      const s = sessions[userId];

      if (s) {
        const duration = Math.floor((Date.now() - s.start) / 60000);

        db.run(
          "INSERT INTO gaming (userId, game, startTime, endTime, duration) VALUES (?,?,?,?,?)",
          [userId, s.game, s.start, Date.now(), duration]
        );
      }

      sessions[userId] = {
        game: activity.name,
        start: Date.now()
      };
    }
  } catch (err) {
    console.log("Presence error:", err);
  }
});

// ---------------- PANEL ----------------
function panel() {
  return new EmbedBuilder()
    .setTitle("🎛 CONTROL PANEL V11")
    .setDescription(
`🏈 NFL Dashboard
🎮 Auto Gaming Tracker
📺 YouTube Center
🔔 Notifications`
    )
    .setColor("Blue");
}

function buttons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("home")
      .setLabel("🏠 Home")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("nfl")
      .setLabel("🏈 NFL")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId("gaming")
      .setLabel("🎮 Gaming")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId("youtube")
      .setLabel("📺 YouTube")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId("notif")
      .setLabel("🔔 Alerts")
      .setStyle(ButtonStyle.Primary)
  );
}

// ---------------- MESSAGE COMMANDS ----------------
client.on("messageCreate", async (m) => {
  if (m.content === "!panel") {
    return m.reply({
      embeds: [panel()],
      components: [buttons()]
    });
  }

  // GAMING STATS
  if (m.content === "!gaming stats") {
    db.all(
      "SELECT * FROM gaming WHERE userId=? ORDER BY id DESC LIMIT 10",
      [m.author.id],
      (err, rows) => {
        let total = 0;

        const list = (rows || []).map(r => {
          total += r.duration || 0;
          return `🎮 ${r.game} — ${r.duration || 0} min`;
        });

        return m.reply(
`🎮 AUTO GAMING STATS

⏱ Total: ${total} min

📊 Recent:
${list.join("\n") || "No activity yet"}`
        );
      }
    );
  }
});

// ---------------- BUTTON HANDLER ----------------
client.on("interactionCreate", async (i) => {
  try {
    if (!i.isButton()) return;

    await i.deferReply({ ephemeral: true });

    // HOME
    if (i.customId === "home") {
      return i.editReply({
        embeds: [panel()],
        components: [buttons()]
      });
    }

    // NFL (KEEP SIMPLE LIKE YOU WANTED)
    if (i.customId === "nfl") {
      return i.editReply(
`🏈 NFL DASHBOARD

⭐ Favorite: Eagles

📅 Schedule:
https://www.espn.com/nfl/team/schedule/_/name/phi/philadelphia-eagles

📊 Last games: coming soon`
      );
    }

    // GAMING (AUTO SYSTEM)
    if (i.customId === "gaming") {
      return i.editReply(
`🎮 AUTO GAMING TRACKER

✔ Automatically detects what you play in Discord

📊 Features:
- Session tracking
- Playtime logging
- History saved

⚠️ Requires Presence Intent enabled`
      );
    }

    // YOUTUBE (SAFE)
    if (i.customId === "youtube") {
      return i.editReply(
`📺 YOUTUBE CENTER

⚠️ Not active yet

Next:
- Channel tracking
- Upload alerts
- No duplicate pings`
      );
    }

    // NOTIFICATIONS
    if (i.customId === "notif") {
      return i.editReply(
`🔔 NOTIFICATION CENTER

Coming soon:
- NFL score alerts
- YouTube uploads
- Custom pings`
      );
    }

  } catch (err) {
    console.log(err);

    if (i.deferred || i.replied) {
      return i.editReply("⚠️ Error occurred");
    }

    return i.reply({
      content: "⚠️ Interaction failed",
      ephemeral: true
    });
  }
});

// ---------------- START ----------------
client.once("ready", () => {
  console.log(`✅ ONLINE: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
