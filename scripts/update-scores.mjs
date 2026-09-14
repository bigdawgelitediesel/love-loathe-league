// Pulls 2026 NFL regular season results from ESPN and writes scores.json.
// Run by the GitHub Action on a schedule, or by hand: node scripts/update-scores.mjs
import { writeFileSync, readFileSync, existsSync } from "node:fs";

const SEASON = 2026;
const API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch {}
    await new Promise(res => setTimeout(res, 2000));
  }
  throw new Error("Failed to fetch " + url);
}

function simplify(e) {
  const c = e.competitions[0];
  const st = e.status.type;
  return {
    id: e.id,
    date: e.date,
    state: st.state,
    completed: st.completed === true || st.name === "STATUS_FINAL",
    detail: st.shortDetail,
    teams: c.competitors.map(t => ({
      abbr: t.team.abbreviation,
      name: t.team.shortDisplayName,
      displayName: t.team.displayName,
      score: Number(t.score || 0),
      homeAway: t.homeAway,
      winner: !!t.winner,
    })),
  };
}

const now = await getJSON(API);
let currentWeek = 1;
if (now.season?.year === SEASON && now.season?.type === 2) currentWeek = Math.min(18, Math.max(1, now.week?.number || 1));
else if (now.season?.year === SEASON && now.season?.type > 2) currentWeek = 18;
else if (now.season?.year > SEASON) currentWeek = 18;

const weeks = {};
for (let w = 1; w <= 18; w++) {
  const d = await getJSON(`${API}?seasontype=2&week=${w}&dates=${SEASON}`);
  weeks[w] = (d.events || []).map(simplify);
}

const out = { season: SEASON, currentWeek, weeks };
const body = JSON.stringify(out);
const old = existsSync("scores.json") ? JSON.parse(readFileSync("scores.json", "utf8")) : null;
if (old && JSON.stringify({ season: old.season, currentWeek: old.currentWeek, weeks: old.weeks }) === body) {
  console.log("No changes.");
} else {
  writeFileSync("scores.json", JSON.stringify({ updated: new Date().toISOString(), ...out }));
  console.log(`Wrote scores.json, current week ${currentWeek}.`);
}
