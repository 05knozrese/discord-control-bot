const db = require("./db");

async function fetchGames(team) {
  const res = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  const data = await res.json();

  return data.events
    .filter(g =>
      g.competitions[0].competitors.some(t => t.team.abbreviation === team)
    )
    .slice(0, 5)
    .map(g => {
      const c = g.competitions[0].competitors;
      return `🏈 ${c[0].team.abbreviation} ${c[0].score} - ${c[1].score} ${c[1].team.abbreviation}`;
    })
    .join("\n");
}

function commands(client, m) {
  const args = m.content.split(" ");

  if (args[0] === "!team" && args[1] === "set") {
    db.run("INSERT OR REPLACE INTO nfl VALUES (?,?)", [
      m.author.id,
      args[2]
    ]);

    return m.reply("🏈 Team saved");
  }

  if (args[0] === "!team" && args[1] === "last") {
    db.get("SELECT team FROM nfl WHERE user_id=?", [m.author.id], async (err, row) => {
      if (!row) return m.reply("No team set");

      const games = await fetchGames(row.team);
      m.reply(`🏈 Last 5 games:\n${games}`);
    });
  }
}

function init() {}

module.exports = { init, commands };
