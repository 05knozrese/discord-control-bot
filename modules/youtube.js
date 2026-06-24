const https = require("https");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

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
          new ButtonBuilder().setCustomId("yt_remove").setLabel("Remove All").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId("yt_refresh").setLabel("Refresh").setStyle(ButtonStyle.Secondary)
        )
      ];

      await i.editReply({ content: `📺 YOUTUBE DASHBOARD\n\n${list}`, components });
    } catch (e) {
      console.error('youtube dashboard error', e);
      await i.editReply({ content: 'Error loading YouTube dashboard' });
    }
    return true;
  }

  // Add channel
  if (i.customId === "yt_add") {
    await i.followUp({ content: "Send Channel ID (UC...) in this channel within 60s", ephemeral: true });
    const channel = i.channel;
    if (!channel || !channel.awaitMessages) {
      await i.followUp({ content: "I can't read messages in this channel.", ephemeral: true });
      return true;
    }

    const collected = await channel.awaitMessages({ filter: m => m.author.id === i.user.id, max: 1, time: 60000 }).catch(() => null);
    if (!collected || !collected.size) { await i.followUp({ content: "Timed out", ephemeral: true }); return true; }
    const id = collected.first().content.trim();

    let feed;
    try { feed = await getFeed(id); } catch (e) { await i.followUp({ content: "Failed to fetch feed — ensure ID is correct", ephemeral: true }); return true; }

    const name = feed.match(/<name>(.*?)<\/name>/)?.[1] || "Unknown";
    const video = feed.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] || "";

    try {
      const existing = await dbAll(db, "SELECT * FROM youtube WHERE channel_id = ?", [id]);
      if (existing.length) {
        // add owner to owner_ids
        const ex = existing[0];
        const owners = ex.owner_ids ? ex.owner_ids.split(",") : [];
        if (!owners.includes(i.user.id)) owners.push(i.user.id);
        await dbRun(db, "UPDATE youtube SET owner_ids = ?, notify_channel = COALESCE(notify_channel, ?) WHERE channel_id = ?", [owners.join(","), i.channel?.id || null, id]);
      } else {
        await dbRun(db, "INSERT INTO youtube (channel_id, channel_name, owner_ids, notify_channel, last_video) VALUES (?,?,?,?,?)", [id, name, i.user.id, i.channel?.id || null, video]);
      }
      await i.followUp({ content: `✅ Added ${name}`, ephemeral: true });
    } catch (e) {
      console.error('DB error', e);
      await i.followUp({ content: 'DB error saving channel', ephemeral: true });
    }

    return true;
  }

  // Subscribe to alerts (user-level)
  if (i.customId === "yt_subscribe") {
    await i.followUp({ content: "Send Channel ID (UC...) you want to subscribe to (or 'list')", ephemeral: true });
    const channel = i.channel;
    if (!channel || !channel.awaitMessages) { await i.followUp({ content: "I can't read messages in this channel.", ephemeral: true }); return true; }

    const collected = await channel.awaitMessages({ filter: m => m.author.id === i.user.id, max: 1, time: 60000 }).catch(() => null);
    if (!collected || !collected.size) { await i.followUp({ content: "Timed out", ephemeral: true }); return true; }
    const val = collected.first().content.trim();
    let targetId = val;
    if (val.toLowerCase() === 'list') {
      const rows = await dbAll(db, "SELECT * FROM youtube");
      if (!rows.length) { await i.followUp({ content: 'No channels tracked', ephemeral: true }); return true; }
      const pickList = rows.map(r => `${r.channel_id} — ${r.channel_name}`).join('\n');
      await i.followUp({ content: `Tracked channels:\n${pickList}\nSend channel ID to subscribe`, ephemeral: true });
      const pick = await channel.awaitMessages({ filter: m => m.author.id === i.user.id, max: 1, time: 60000 }).catch(() => null);
      if (!pick || !pick.size) { await i.followUp({ content: "Timed out", ephemeral: true }); return true; }
      targetId = pick.first().content.trim();
    }

    // ensure channel exists
    const rows = await dbAll(db, "SELECT * FROM youtube WHERE channel_id = ?", [targetId]);
    if (!rows.length) { await i.followUp({ content: 'Channel not tracked. Add it first using Add.', ephemeral: true }); return true; }

    try {
      await dbRun(db, "INSERT INTO alerts (user_id, type, target_id, condition, notify_channel) VALUES (?,?,?,?,?)", [i.user.id, 'youtube', targetId, 'new_video', i.channel?.id || null]);
      await i.followUp({ content: `🔔 Subscribed to ${rows[0].channel_name} new-video alerts`, ephemeral: true });
    } catch (e) {
      console.error('Failed to create alert', e);
      await i.followUp({ content: 'Failed to create subscription', ephemeral: true });
    }

    return true;
  }

  // Remove all tracked channels
  if (i.customId === "yt_remove") {
    try { await dbRun(db, "DELETE FROM youtube"); await i.followUp({ content: "🗑 All channels removed", ephemeral: true }); } catch (e) { console.error('Failed to remove youtube channels', e); await i.followUp({ content: "Failed to remove channels", ephemeral: true }); }
    return true;
  }

  // Refresh (manual)
  if (i.customId === "yt_refresh") {
    try {
      await i.followUp({ content: "Refreshing feeds...", ephemeral: true });
      const summary = await refreshAll(db, client);
      await i.followUp({ content: `✅ Refresh complete — checked ${summary.checked} feeds, sent ${summary.notified} notifications${summary.errors.length ? `. Errors: ${summary.errors.join(',')}` : ''}`, ephemeral: true });
    } catch (e) { console.error('yt_refresh handler error', e); await i.followUp({ content: "Failed to refresh feeds", ephemeral: true }); }
    return true;
  }

  return false;
}

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

module.exports = { handle, refreshAll };
