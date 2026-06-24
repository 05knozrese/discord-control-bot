const https = require("https");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

// helpers for sqlite callbacks
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}
function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

const EPHEMERAL_FLAG = 64;
async function replyEphemeral(i, payload) {
  try {
    if (!i.replied && !i.deferred) await i.reply({ ...payload, flags: EPHEMERAL_FLAG });
    else await i.followUp({ ...payload, flags: EPHEMERAL_FLAG });
  } catch (e) {
    console.error('replyEphemeral failed', e);
    try { if (i.replied || i.deferred) await i.editReply({ content: payload.content || '...' }); } catch {}
  }
}

async function tryShowModal(i, modal) {
  if (i.replied || i.deferred) {
    await replyEphemeral(i, { content: 'Unable to open modal: interaction already replied. Please try again.' });
    return false;
  }
  try {
    await i.showModal(modal);
    return true;
  } catch (e) {
    console.error('showModal error', e);
    await replyEphemeral(i, { content: 'Failed to open modal. Try again.' });
    return false;
  }
}

// Minimal NFL module: pick favorite team and manage it.
// This is intentionally minimal — further features (live games, stats) can be added later.
async function handle(i, db, client) {
  if (i.customId === "nfl") {
    const components = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("home").setLabel("🏠 Home").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("nfl_pick").setLabel("Pick Team").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("nfl_manage").setLabel("My Team").setStyle(ButtonStyle.Primary)
      )
    ];
    const content = "🏈 NFL DASHBOARD\n\nPick a favorite team to track. (Basic flow)";
    try {
      if (i.update && !i.replied && !i.deferred) await i.update({ content, components });
      else await replyEphemeral(i, { content, components });
    } catch (e) {
      console.error('nfl dashboard error', e);
      await replyEphemeral(i, { content: 'Error opening NFL dashboard' });
    }
    return true;
  }

  if (i.customId === "nfl_pick") {
    const modal = new ModalBuilder().setCustomId('modal_nfl_pick').setTitle('Pick Favorite NFL Team')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('team').setLabel('Team name or abbreviation (e.g., NE, Patriots)').setStyle(TextInputStyle.Short).setRequired(true)
        )
      );
    await tryShowModal(i, modal);
    return true;
  }

  if (i.customId === "nfl_manage") {
    try {
      const rows = await dbAll(db, "SELECT * FROM nfl_favorites WHERE user_id = ?", [i.user.id]);
      if (!rows.length) return await replyEphemeral(i, { content: 'You have no favorite team set. Use Pick Team to choose one.' });
      const fav = rows[0];
      const components = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nfl_remove').setLabel('Remove Favorite').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('nfl_refresh_team').setLabel('Refresh Team Info').setStyle(ButtonStyle.Secondary)
      )];
      await replyEphemeral(i, { content: `Your favorite team: ${fav.team_name} (${fav.team_id})`, components });
    } catch (e) {
      console.error('nfl manage error', e);
      await replyEphemeral(i, { content: 'Failed to load your favorite team' });
    }
    return true;
  }

  if (i.customId === 'nfl_remove') {
    try {
      await dbRun(db, "DELETE FROM nfl_favorites WHERE user_id = ?", [i.user.id]);
      await replyEphemeral(i, { content: 'Favorite team removed' });
    } catch (e) {
      console.error('nfl remove failed', e);
      await replyEphemeral(i, { content: 'Failed to remove favorite' });
    }
    return true;
  }

  if (i.customId === 'nfl_refresh_team') {
    try {
      const rows = await dbAll(db, "SELECT * FROM nfl_favorites WHERE user_id = ?", [i.user.id]);
      if (!rows.length) return await replyEphemeral(i, { content: 'No favorite set' });
      const fav = rows[0];
      await replyEphemeral(i, { content: `Team ${fav.team_name} (${fav.team_id}) — (stats not yet implemented)` });
    } catch (e) {
      console.error('nfl refresh failed', e);
      await replyEphemeral(i, { content: 'Failed to refresh team info' });
    }
    return true;
  }

  return false;
}

async function handleModal(i, db, client) {
  if (i.customId === 'modal_nfl_pick') {
    const team = i.fields.getTextInputValue('team').trim();
    try {
      const existing = await dbAll(db, "SELECT * FROM nfl_favorites WHERE user_id = ?", [i.user.id]);
      if (existing.length) {
        await dbRun(db, "UPDATE nfl_favorites SET team_id = ?, team_name = ? WHERE user_id = ?", [team, team, i.user.id]);
      } else {
        await dbRun(db, "INSERT INTO nfl_favorites (user_id, team_id, team_name) VALUES (?,?,?)", [i.user.id, team, team]);
      }
      await replyEphemeral(i, { content: `✅ Saved favorite team: ${team}` });
    } catch (e) {
      console.error('nfl modal save failed', e);
      await replyEphemeral(i, { content: 'Failed to save favorite team' });
    }
    return;
  }

  await replyEphemeral(i, { content: 'Unknown modal' });
}

module.exports = { handle, handleModal };
