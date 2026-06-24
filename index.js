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

// ---------------- GAMING TABLE ----------------
db.run(`
CREATE TABLE IF NOT EXISTS gaming (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  game TEXT,
  startTime INTEGER,
  duration INTEGER DEFAULT 0
)
`);

// ---------------- CLIENT ----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- PANEL UI ----------------
function panel() {
  return new EmbedBuilder()
    .setTitle("🎛 CONTROL PANEL")
    .setDescription(
`🏈 NFL Dashboard
🎮 Gaming Center
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

  // ---------------- GAMING COMMANDS ----------------

  if (m.content.startsWith("!play start")) {
    const game = m.content.split(" ").slice(2).join(" ");
    if (!game) return m.reply("❌ Enter a game name");

    db.run(
      "INSERT INTO gaming (userId, game, startTime) VALUES (?,?,?)",
      [m.author.id, game, Date.now()]
    );

    return m.reply(`🎮 Started tracking: **${game}**`);
  }

  if (m.content === "!play stop") {
    db.get(
      "SELECT * FROM gaming WHERE userId=? ORDER BY id DESC LIMIT 1",
      [m.author.id],
      (err, row) => {
        if (!row) return m.reply("❌ No active session");

        const mins = Math.floor((Date.now() - row.startTime) / 60000);

        db.run(
          "UPDATE gaming SET duration=? WHERE id=?",
          [mins, row.id]
        );

        return m.reply(`⏹ Session saved: **${row.game}** (${mins} min)`);
      }
    );
  }

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
`🎮 GAMING STATS

⏱ Total Time: ${total} min

📊 Recent Sessions:
${list.join("\n") || "No sessions yet"}`
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

📊 Last games + stats coming soon`
      );
    }

    // GAMING TAB
    if (i.customId === "gaming") {
      return i.editReply(
`🎮 GAMING CENTER

Commands:
!play start <game>
!play stop
!gaming stats`
      );
    }

    // YOUTUBE TAB (SAFE PLACEHOLDER)
    if (i.customId === "youtube") {
      return i.editReply(
`📺 YOUTUBE CENTER

⚠️ Feature coming next update

Commands:
!yt add <channel>
!yt list
!yt remove`
      );
    }

    // NOTIFICATIONS TAB
    if (i.customId === "notif") {
      return i.editReply(
`🔔 NOTIFICATION CENTER

⚠️ Coming soon:

- YouTube uploads
- NFL score pings
- Custom alerts`
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
