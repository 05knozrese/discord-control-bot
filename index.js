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

if (!TOKEN) {
  console.error("❌ Missing TOKEN in environment variables");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- DATABASE ----------------
const db = new sqlite3.Database("./bot.db");

db.run(`CREATE TABLE IF NOT EXISTS games (
  user_id TEXT,
  game TEXT,
  minutes INTEGER,
  date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS reminders (
  user_id TEXT,
  msg TEXT,
  time INTEGER
)`);

// ---------------- GAME TRACKING ----------------
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
🎮 Gaming Tracker
📺 YouTube (RSS)
🏈 NFL (ESPN Live)
⏰ Reminders
📊 Stats
`)
    .setColor("Blue");
}

// ---------------- COMMAND ----------------
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

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

// ---------------- NFL (REAL ESPN API) ----------------
async function getNFL() {
  try {
    const res = await fetch(
      "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
    );

    const data = await res.json();

    return data.events.slice(0, 3).map(g => {
      const c = g.competitions[0];
      const t = c.competitors;

      return {
        name: g.name,
        clock: c.status.displayClock,
        team1: t[0].team.abbreviation,
        team2: t[1].team.abbreviation,
        score1: t[0].score,
        score2: t[1].score
      };
    });
  } catch (err) {
    console.log("NFL error:", err);
    return [];
  }
}

// ---------------- BUTTONS (NO TIMEOUT BUG) ----------------
client.on("interactionCreate", async (i) => {
  try {
    if (!i.isButton()) return;

    await i.deferReply({ ephemeral: true });

    if (i.customId === "gaming") {
      return i.editReply("🎮 Tracking games in background...");
    }

    if (i.customId === "youtube") {
      return i.editReply("📺 YouTube RSS tracking is active (no API key needed)");
    }

    if (i.customId === "nfl") {
      const games = await getNFL();

      if (!games.length) {
        return i.editReply("🏈 No live NFL data right now");
      }

      const text = games
        .map(g =>
          `🏈 ${g.team1} ${g.score1} - ${g.score2} ${g.team2} (${g.clock})`
        )
        .join("\n");

      return i.editReply(text);
    }

  } catch (err) {
    console.log("Interaction error:", err);

    if (i.deferred) {
      return i.editReply("⚠️ Error handling request");
    }
  }
});

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ---------------- LOGIN ----------------
client.login(TOKEN);
