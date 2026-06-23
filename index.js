const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const sqlite3 = require("sqlite3").verbose();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

// ---------------- DB ----------------
const db = new sqlite3.Database("./bot.db");

db.run(`CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  game TEXT,
  minutes INTEGER,
  date TEXT
)`);

db.run(`CREATE TABLE IF NOT EXISTS youtube (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT,
  channel TEXT
)`);

// ---------------- TRACKING FIXED ----------------
let sessions = {};

client.on("presenceUpdate", (oldP, newP) => {
  if (!newP?.userId) return;

  const activity = newP.activities?.find(a => a.type === 0);
  const userId = newP.userId;

  if (activity) {
    if (!sessions[userId] || sessions[userId].game !== activity.name) {
      sessions[userId] = {
        game: activity.name,
        start: Date.now()
      };
    }
  } else if (sessions[userId]) {
    const s = sessions[userId];
    delete sessions[userId];

    const mins = Math.floor((Date.now() - s.start) / 60000);
    const date = new Date().toISOString().split("T")[0];

    db.run(
      "INSERT INTO games (user_id, game, minutes, date) VALUES (?, ?, ?, ?)",
      [userId, s.game, mins, date]
    );
  }
});

// ---------------- SLASH COMMANDS ----------------
const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Control panel"),

  new SlashCommandBuilder().setName("stats").setDescription("Weekly stats"),

  new SlashCommandBuilder().setName("leaderboard").setDescription("Top players"),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("View user profile")
    .addUserOption(o => o.setName("user").setDescription("User")),

  new SlashCommandBuilder()
    .setName("ytadd")
    .setDescription("Add YouTube channel")
    .addStringOption(o =>
      o.setName("channel").setDescription("@handle or URL").setRequired(true)
    ),

  new SlashCommandBuilder().setName("ytlist").setDescription("List YouTube channels")
];

// Register commands
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function register() {
  await rest.put(
    Routes.applicationCommands(CLIENT_ID),
    { body: commands }
  );
  console.log("Slash commands loaded");
}

// ---------------- COMMANDS ----------------
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === "panel") {
    const embed = new EmbedBuilder()
      .setTitle("🎛 V5 CONTROL PANEL")
      .setDescription("Everything is inside Discord now")
      .setColor("Blue");

    return interaction.reply({ embeds: [embed] });
  }

  if (commandName === "ytadd") {
    const channel = interaction.options.getString("channel");

    db.run(
      "INSERT INTO youtube (guild_id, channel) VALUES (?, ?)",
      [interaction.guild.id, channel]
    );

    return interaction.reply("📺 YouTube channel added!");
  }

  if (commandName === "ytlist") {
    db.all(
      "SELECT channel FROM youtube WHERE guild_id = ?",
      [interaction.guild.id],
      (err, rows) => {
        let text = rows.length
          ? rows.map(r => `• ${r.channel}`).join("\n")
          : "No channels.";

        interaction.reply(text);
      }
    );
  }

  if (commandName === "stats") {
    db.all(
      `SELECT game, SUM(minutes) as total
       FROM games
       WHERE date >= date('now','-7 day')
       GROUP BY game
       ORDER BY total DESC`,
      [],
      (err, rows) => {
        let text = rows.map(r => `🎮 ${r.game}: ${r.total} min`).join("\n");
        interaction.reply(text || "No data.");
      }
    );
  }

  if (commandName === "leaderboard") {
    db.all(
      `SELECT user_id, SUM(minutes) as total
       FROM games
       WHERE date >= date('now','-7 day')
       GROUP BY user_id
       ORDER BY total DESC
       LIMIT 10`,
      [],
      (err, rows) => {
        let text = rows
          .map((r, i) => `${i + 1}. <@${r.user_id}> - ${r.total} min`)
          .join("\n");

        interaction.reply(text || "No data.");
      }
    );
  }

  if (commandName === "profile") {
    const user = interaction.options.getUser("user") || interaction.user;

    db.get(
      "SELECT SUM(minutes) as total FROM games WHERE user_id = ?",
      [user.id],
      (err, row) => {
        interaction.reply(
          `👤 ${user.username}\n🎮 Total: ${row?.total || 0} min`
        );
      }
    );
  }
});

// ---------------- START ----------------
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await register();
});

client.login(TOKEN);
