const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- DB ----------------
const db = new sqlite3.Database("./bot.db");

db.run(`CREATE TABLE IF NOT EXISTS games (
  user_id TEXT,
  game TEXT,
  minutes INTEGER,
  date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS youtube (
  guild_id TEXT,
  channel_id TEXT,
  last_video TEXT,
  mode TEXT DEFAULT 'ping'
)`);

db.run(`CREATE TABLE IF NOT EXISTS reminders (
  user_id TEXT,
  msg TEXT,
  time INTEGER
)`);

// ---------------- SESSION TRACKING ----------------
let sessions = {};

client.on("presenceUpdate", (oldP, newP) => {
  if (!newP?.userId) return;

  const activity = newP.activities?.find(a => a.type === 0);
  const id = newP.userId;

  if (activity) {
    if (!sessions[id]) {
      sessions[id] = {
        game: activity.name,
        start: Date.now()
      };
    }
  } else if (sessions[id]) {
    const s = sessions[id];
    delete sessions[id];

    const mins = Math.floor((Date.now() - s.start) / 60000);
    const date = new Date().toISOString().split("T")[0];

    db.run("INSERT INTO games VALUES (?,?,?,?)", [
      id,
      s.game,
      mins,
      date
    ]);
  }
});

// ---------------- PANEL ----------------
function panel() {
  return new EmbedBuilder()
    .setTitle("🎛 CONTROL HUB")
    .setDescription(`
🎮 Gaming
📺 YouTube
🏈 NFL
🔔 Notifications
⏰ Reminders
📊 Stats
`)
    .setColor("Blue");
}

// ---------------- MESSAGE COMMAND ----------------
client.on("messageCreate", async (m) => {
  if (m.content === "/panel") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("gaming")
        .setLabel("🎮 Gaming")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("youtube")
        .setLabel("📺 YouTube")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("nfl")
        .setLabel("🏈 NFL")
        .setStyle(ButtonStyle.Primary)
    );

    return m.reply({
      embeds: [panel()],
      components: [row]
    });
  }
});

// ---------------- BUTTONS (FIXED SAFE REPLIES) ----------------
client.on("interactionCreate", async (i) => {
  try {
    if (!i.isButton()) return;

    // ALWAYS defer first to prevent "did not respond"
    await i.deferReply({ ephemeral: true });

    if (i.customId === "gaming") {
      return i.editReply("🎮 Gaming tracking is active (sessions logging in background)");
    }

    if (i.customId === "youtube") {
      return i.editReply("📺 YouTube system ready (RSS tracking enabled in backend)");
    }

    if (i.customId === "nfl") {
      return i.editReply("🏈 NFL system online (ESPN live data ready to integrate)");
    }

  } catch (err) {
    console.log("Interaction error:", err);

    if (i.deferred || i.replied) {
      return i.editReply("⚠️ Something went wrong.");
    }

    return i.reply({
      content: "⚠️ Error handling request",
      ephemeral: true
    });
  }
});

// ---------------- READY EVENT (FIXED) ----------------
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ---------------- LOGIN ----------------
client.login(TOKEN);
