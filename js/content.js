import { round, score } from "./score.js";

/**
 * Use relative paths so GitHub Pages project sites work:
 * https://username.github.io/repo/
 */
const dir = "data";
const levelsDir = `${dir}/levels`;

export async function fetchList() {
  // Prefer list.json, but keep backwards-compat with _list.json
  const listUrls = [`${dir}/list.json`, `${dir}/_list.json`];

  let list = null;
  let lastErr = null;

  for (const url of listUrls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${url} -> ${res.status}`);
      const data = await res.json();

      // Support BOTH formats:
      // 1) { "levels": [ { "file": "name" }, ... ] }   (recommended)
      // 2) [ "name1", "name2" ]                         (legacy)
      if (Array.isArray(data)) {
        list = data.map((name) => ({ file: name }));
      } else if (data && Array.isArray(data.levels)) {
        list = data.levels;
      } else {
        throw new Error(`Invalid list format in ${url}`);
      }

      break; // success
    } catch (e) {
      lastErr = e;
    }
  }

  if (!list) {
    console.error("Failed to load list.", lastErr);
    return null;
  }

  return await Promise.all(
    list.map(async (entry, rank) => {
      const path = typeof entry === "string" ? entry : entry.file;
      if (!path) return [null, "missing-file"];

      // Try both locations for compatibility:
      // - data/levels/<path>.json (recommended)
      // - data/<path>.json        (legacy)
      const levelUrls = [
        `${levelsDir}/${path}.json`,
        `${dir}/${path}.json`,
      ];

      for (const url of levelUrls) {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(`${url} -> ${res.status}`);
          const level = await res.json();

          return [
            {
              ...level,
              path,
              records: (level.records ?? []).slice().sort((a, b) => b.percent - a.percent),
            },
            null,
          ];
        } catch (e) {
          // try next url
        }
      }

      console.error(`Failed to load level #${rank + 1} ${path}.`);
      return [null, path];
    })
  );
}

export async function fetchEditors() {
  // Prefer editors.json, fallback to _editors.json
  const urls = [`${dir}/editors.json`, `${dir}/_editors.json`];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`${url} -> ${res.status}`);
      return await res.json();
    } catch {
      // try next
    }
  }

  return null;
}

export async function fetchLeaderboard() {
  const list = await fetchList();
  if (!list) return [[], ["list"]];

  const scoreMap = {};
  const errs = [];

  list.forEach(([level, err], rank) => {
    if (err || !level) {
      errs.push(err);
      return;
    }

    // Verification
    const verifier =
      Object.keys(scoreMap).find((u) => u.toLowerCase() === level.verifier.toLowerCase()) ||
      level.verifier;

    scoreMap[verifier] ??= { verified: [], completed: [], progressed: [] };

    scoreMap[verifier].verified.push({
      rank: rank + 1,
      level: level.name,
      score: score(rank + 1, 100, level.percentToQualify),
      link: level.verification,
    });

    // Records
    (level.records ?? []).forEach((record) => {
      const user =
        Object.keys(scoreMap).find((u) => u.toLowerCase() === record.user.toLowerCase()) ||
        record.user;

      scoreMap[user] ??= { verified: [], completed: [], progressed: [] };

      if (record.percent === 100) {
        scoreMap[user].completed.push({
          rank: rank + 1,
          level: level.name,
          score: score(rank + 1, 100, level.percentToQualify),
          link: record.link,
        });
      } else {
        scoreMap[user].progressed.push({
          rank: rank + 1,
          level: level.name,
          percent: record.percent,
          score: score(rank + 1, record.percent, level.percentToQualify),
          link: record.link,
        });
      }
    });
  });

  const res = Object.entries(scoreMap).map(([user, scores]) => {
    const total = [scores.verified, scores.completed, scores.progressed]
      .flat()
      .reduce((prev, cur) => prev + cur.score, 0);

    return { user, total: round(total), ...scores };
  });

  return [res.sort((a, b) => b.total - a.total), errs];
}
