const https = require("https");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
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

function getFeed(id, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode}`));
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => resolve(d));
    });

    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error("Feed timeout")));
  });
}

// interaction helpers
const EPHEMERAL_FLAG = 64;

async function replyEphemeral(i, payload) {
  try {
    if (!i.replied && !i.deferred) {
      await i.reply({ ...payload, flags: EPHEMERAL_FLAG });
    } else {
      await i.followUp({ ...payload, flags: EPHEMERAL_FLAG });
    }
  } catch (e) {
    console.error('replyEphemeral failed', e);
    try {
      if (i.replied || i.deferred) await i.editReply({ content: payload.content || '...' });
    } catch (err) { /* ignore */ }
  }
}

// safe showModal helper: only call showModal if interaction hasn't been replied/deferred
async function tryShowModal(i, modal) {
  if (i.replied || i.deferred) {
    await replyEphemeral(i, { content: 'Unable to open modal: interaction already replied. Please try again.' });
    return false;
  }
  try {
    await i.showModal(modal);
    return true;
  } catch (e) {
    console.error('show modal error', e);
    await replyEphemeral(i, { content: 'Failed to open modal (interaction state). Please try again.' });
    return false;
  }
}

// ---------------- HANDLER ----------------
async function handle(i, db, client) {
  // Dashboard
  if (i.customId === "youtube") {
    try {
      const rows = await dbAll(db, "SELECT * FROM youtube");
      const list = rows.length ? rows.map(r => `📺 ${r.channel_name} — ${r.channel_id}`).join("\n\n") : "No channels added";

      const components = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("yt_add").setLabel("Add").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId("yt_subscribe").setLabel("Subscribe").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId("yt_manage").setLabel("Manage Alerts").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId("yt_remove").setLabel("Remove All").setStyle(ButtonStyle.Danger)
        )
      ];

      // Prefer update on component interactions when possible
      try {
        if (i.update && !i.replied && !i.deferred) await i.update({ content: `📺 YOUTUBE DASHBOARD\n\n${list}`, components });
        else await replyEphemeral(i, { content: `📺 YOUTUBE DASHBOARD\n\n${list}`, components });
      } catch (e) {
        console.error('dashboard respond error', e);
        await replyEphemeral(i, { content: `📺 YOUTUBE DASHBOARD\n\n${list}`, components });
      }
    } catch (e) {
      console.error('youtube dashboard error', e);
      await replyEphemeral(i, { content: 'Error loading YouTube dashboard' });
    }
    return true;
  }

  // Show modal to add channel
  if (i.customId === "yt_add") {
    try {
      const modal = new ModalBuilder().setCustomId('modal_yt_add').setTitle('Add YouTube Channel')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('channel_id').setLabel('Channel ID (UC...)').setStyle(TextInputStyle.Short).setRequired(true)
          )
        );

      // must not have replied/deferred prior to showModal
      await tryShowModal(i, modal);
    } catch (e) {
      console.error('show modal error', e);
      await replyEphemeral(i, { content: 'Failed to open modal' });
    }

    return true;
  }

  // Show modal to subscribe
  if (i.customId === "yt_subscribe") {
    try {
      const modal = new ModalBuilder().setCustomId('modal_yt_sub').setTitle('Subscribe to YouTube Channel')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('channel_id').setLabel('Channel ID (UC...) or type "list"').setStyle(TextInputStyle.Short).setRequired(true)
          )
        );

      await tryShowModal(i, modal);
    } catch (e) {
      console.error('show modal error', e);
      await replyEphemeral(i, { content: 'Failed to open modal' });
    }

    return true;
  }

  // Manage alerts
  if (i.customId === 'yt_manage') {
    try {
      const alerts = await dbAll(db, "SELECT a.id, a.target_id, a.condition, y.channel_name FROM alerts a LEFT JOIN youtube y ON y.channel_id = a.target_id WHERE a.user_id = ? AND a.type = ?", [i.user.id, 'youtube']);
      if (!alerts.length) return await replyEphemeral(i, { content: 'You have no YouTube alerts.' });

      const lines = alerts.map(a => `ID:${a.id} — ${a.channel_name || a.target_id} — ${a.condition}`);
      // Create buttons for up to 5 alerts
      const components = [];
      for (const a of alerts.slice(0, 5)) {
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`yt_alert_test_${a.id}`).setLabel(`Test ${a.id}`).setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`yt_alert_del_${a.id}`).setLabel(`Delete ${a.id}`).setStyle(ButtonStyle.Danger)
        ));
      }

      await replyEphemeral(i, { content: `Your alerts:\n${lines.join('\n')}`, components });
    } catch (e) {
      console.error('manage alerts error', e);
      await replyEphemeral(i, { content: 'Failed to load your alerts' });
    }
    return true;
  }

  // Delete or test alert buttons
  if (i.customId.startsWith('yt_alert_del_')) {
    const id = i.customId.replace('yt_alert_del_', '');
    try {
      await dbRun(db, 'DELETE FROM alerts WHERE id = ?', [id]);
      await replyEphemeral(i, { content: `Deleted alert ${id}` });
    } catch (e) {
      console.error('delete alert failed', e);
      await replyEphemeral(i, { content: 'Failed to delete alert' });
    }
    return true;
  }

  if (i.customId.startsWith('yt_alert_test_')) {
    const id = i.customId.replace('yt_alert_test_', '');
    try {
      const rows = await dbAll(db, 'SELECT * FROM alerts WHERE id = ?', [id]);
      if (!rows.length) return await replyEphemeral(i, { content: 'Alert not found' });
      const a = rows[0];
      try {
        const user = await client.users.fetch(a.user_id).catch(() => null);
        if (user) { await user.send(`🔔 Test alert for ${a.type} ${a.target_id}`); await replyEphemeral(i, { content: 'Test sent via DM' }); }
        else if (a.notify_channel) { const ch = await client.channels.fetch(a.notify_channel).catch(()=>null); if (ch && ch.send) { await ch.send(`🔔 Test alert for ${a.type} ${a.target_id}`); await replyEphemeral(i, { content: 'Test sent to fallback channel' }); } else await replyEphemeral(i, { content: 'No delivery path available' }); }
      } catch (e) { console.error('sending test failed', e); await replyEphemeral(i, { content: 'Failed to send test' }); }
    } catch (e) { console.error('alert test error', e); await replyEphemeral(i, { content: 'Failed to load alert' }); }
    return true;
  }

  // Remove all tracked channels
  if (i.customId === "yt_remove") {
    try { await dbRun(db, "DELETE FROM youtube"); await replyEphemeral(i, { content: "🗑 All channels removed" }); } catch (e) { console.error('Failed to remove youtube channels', e); await replyEphemeral(i, { content: "Failed to remove channels" }); }
    return true;
  }

  return false;
}

// ---------------- MODAL SUBMIT HANDLERS ----------------
async function handleModal(i, db, client) {
  if (i.customId === 'modal_yt_add') {
    const id = i.fields.getTextInputValue('channel_id').trim();
    let feed;
    try { feed = await getFeed(id); } catch (e) { console.error('Failed to fetch feed for modal add', e); return await replyEphemeral(i, { content: 'Failed to fetch feed — ensure ID is correct' }); }
    const name = feed.match(/<name>(.*?)<\/name>/)?.[1] || 'Unknown';
    const video = feed.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || '';

    try {
      const existing = await dbAll(db, 'SELECT * FROM youtube WHERE channel_id = ?', [id]);
      if (existing.length) {
        const ex = existing[0];
        const owners = ex.owner_ids ? ex.owner_ids.split(',') : [];
        if (!owners.includes(i.user.id)) owners.push(i.user.id);
        await dbRun(db, 'UPDATE youtube SET owner_ids = ?, notify_channel = COALESCE(notify_channel, ?) WHERE channel_id = ?', [owners.join(','), i.channel?.id || null, id]);
      } else {
        await dbRun(db, 'INSERT INTO youtube (channel_id, channel_name, owner_ids, notify_channel, last_video) VALUES (?,?,?,?,?)', [id, name, i.user.id, i.channel?.id || null, video]);
      }
      await replyEphemeral(i, { content: `✅ Added ${name}` });
    } catch (e) {
      console.error('DB error modal add', e);
      await replyEphemeral(i, { content: 'DB error saving channel' });
    }
    return;
  }

  if (i.customId === 'modal_yt_sub') {
    const val = i.fields.getTextInputValue('channel_id').trim();
    let targetId = val;

    if (val.toLowerCase() === 'list') {
      const rows = await dbAll(db, 'SELECT * FROM youtube');
      if (!rows.length) return await replyEphemeral(i, { content: 'No channels tracked. Add some first.' });
      const pickList = rows.map(r => `${r.channel_id} — ${r.channel_name}`).join('\n');
      return await replyEphemeral(i, { content: `Tracked channels:\n${pickList}\nTo subscribe, use the Subscribe button again and paste a channel ID from the list.` });
    }

    const rows = await dbAll(db, 'SELECT * FROM youtube WHERE channel_id = ?', [targetId]);
    if (!rows.length) return await replyEphemeral(i, { content: 'Channel not tracked. Add it first using Add.' });

    try {
      await dbRun(db, 'INSERT INTO alerts (user_id, type, target_id, condition, notify_channel) VALUES (?,?,?,?,?)', [i.user.id, 'youtube', targetId, 'new_video', i.channel?.id || null]);
      await replyEphemeral(i, { content: `🔔 Subscribed to ${rows[0].channel_name} new-video alerts` });
    } catch (e) {
      console.error('Failed to create alert modal', e);
      await replyEphemeral(i, { content: 'Failed to create subscription' });
    }
    return;
  }

  // unknown modal
  await replyEphemeral(i, { content: 'Unknown modal submission' });
}

// ---------------- REFRESH LOGIC (background poller) ----------------
async function refreshAll(db, client) {
  const rows = await dbAll(db, "SELECT * FROM youtube");
  let checked = 0, notified = 0, errors = [];

  for (const r of rows) {
    checked++;
    try {
      const feed = await getFeed(r.channel_id).catch(e => { throw e; });
      const video = feed.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || null;
      if (!video) continue;

      if (r.last_video !== video) {
        // update last_video
        await dbRun(db, "UPDATE youtube SET last_video = ? WHERE channel_id = ?", [video, r.channel_id]).catch(e => console.error('Failed to update last_video', e));

        // notify owners
        const owners = r.owner_ids ? r.owner_ids.split(',') : [];
        for (const ownerId of owners) {
          try {
            const user = await client.users.fetch(ownerId).catch(() => null);
            if (user) { await user.send(`📢 ${r.channel_name} posted a new video: https://youtu.be/${video}`); notified++; }
            else if (r.notify_channel) { const ch = await client.channels.fetch(r.notify_channel).catch(()=>null); if (ch && ch.send) { await ch.send(`📢 ${r.channel_name} posted a new video: https://youtu.be/${video}`); notified++; } }
          } catch (e) { console.error('Failed to notify owner', ownerId, e); }
        }

        // notify alert subscribers
        const subs = await dbAll(db, "SELECT * FROM alerts WHERE type = ? AND target_id = ?", ['youtube', r.channel_id]).catch(e => { console.error('Alert query failed', e); return []; });
        for (const s of subs) {
          if (s.last_notified === video) continue;
          try {
            const user = await client.users.fetch(s.user_id).catch(() => null);
            if (user) { await user.send(`📢 ${r.channel_name} posted a new video: https://youtu.be/${video}`); notified++; }
            else if (s.notify_channel) { const ch = await client.channels.fetch(s.notify_channel).catch(()=>null); if (ch && ch.send) { await ch.send(`📢 ${r.channel_name} posted a new video: https://youtu.be/${video}`); notified++; } }

            await dbRun(db, "UPDATE alerts SET last_notified = ? WHERE id = ?", [video, s.id]).catch(e => console.error('Failed to update alert last_notified', e));
          } catch (e) { console.error('Failed to notify subscriber', s.user_id, e); }
        }
      }
    } catch (e) {
      console.error('Error refreshing', r.channel_id, e);
      errors.push(r.channel_id);
    }
  }

  return { checked, notified, errors };
}

module.exports = { handle, handleModal, refreshAll };
