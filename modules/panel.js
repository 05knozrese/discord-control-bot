const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function commands(client, m) {
  if (m.content !== "!panel") return;

  const embed = new EmbedBuilder()
    .setTitle("🎛 CONTROL PANEL V7")
    .setDescription("Live system control hub")
    .setColor("Blue");

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("nfl").setLabel("🏈 NFL").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("yt").setLabel("📺 YouTube").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("settings").setLabel("⚙️ Settings").setStyle(ButtonStyle.Secondary)
  );

  m.reply({ embeds: [embed], components: [row] });
}

module.exports = { commands };
