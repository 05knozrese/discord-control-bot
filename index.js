const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID; // optional (NOT required)

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ---------------- READY ----------------
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  if (CLIENT_ID) {
    console.log("ℹ️ CLIENT_ID detected (slash commands could be added later)");
  }
});

// ---------------- PANEL ----------------
client.on("messageCreate", async (m) => {
  if (m.author.bot) return;

  if (m.content === "!panel") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("gaming")
        .setLabel("🎮 Gaming")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("nfl")
        .setLabel("🏈 NFL")
        .setStyle(ButtonStyle.Primary)
    );

    return m.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle("🎛 Control Hub")
          .setDescription("Gaming • NFL • YouTube • Stats")
          .setColor("Blue")
      ],
      components: [row]
    });
  }
});

// ---------------- BUTTONS ----------------
client.on("interactionCreate", async (i) => {
  if (!i.isButton()) return;

  await i.deferReply({ ephemeral: true });

  if (i.customId === "gaming") {
    return i.editReply("🎮 Gaming tracking active");
  }

  if (i.customId === "nfl") {
    return i.editReply("🏈 NFL system online (ESPN API ready)");
  }
});

// ---------------- LOGIN ----------------
client.login(TOKEN);
