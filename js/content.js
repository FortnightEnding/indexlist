import { round, score } from "./score.js";

/**
 * GitHub Pages–safe paths
 * (NO leading slash)
 */
const dir = "data";

export async function fetchList() {
    try {
        const listResult = await fetch(`${dir}/list.json`, { cache: "no-store" });
        if (!listResult.ok) throw new Error("list.json not found");

        const list = await listResult.json();

        // Expected format:
        // ["samplelevel1", "samplelevel2"]
        if (!Array.isArray(list)) throw new Error("Invalid list format");

        return await Promise.all(
            list.map(async (path, rank) => {
                try {
                    const levelResult = await fetch(
                        `${dir}/${path}.json`,
                        { cache: "no-store" }
                    );
                    if (!levelResult.ok) throw new Error("level not found");

                    const level = await levelResult.json();

                    return [
                        {
                            ...level,
                            path,
                            records: (level.records ?? [])
                                .slice()
                                .sort((a, b) => b.percent - a.percent),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1}: ${path}`);
                    return [null, path];
                }
            })
        );
    } catch (e) {
        console.error("Failed to load list.", e);
        return null;
    }
}

export async function fetchEditors() {
    try {
        const res = await fetch(`${dir}/editors.json`, { cache: "no-store" });
        if (!res.ok) throw new Error("editors.json not found");
        return await res.json();
    } catch {
        return null;
    }
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

        const verifier =
            Object.keys(scoreMap).find(
                (u) => u.toLowerCase() === level.verifier.toLowerCase()
            ) || level.verifier;

        scoreMap[verifier] ??= {
            verified: [],
            completed: [],
            progressed: [],
        };

        scoreMap[verifier].verified.push({
            rank: rank + 1,
            level: level.name,
            score: score(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });

        (level.records ?? []).forEach((record) => {
            const user =
                Object.keys(scoreMap).find(
                    (u) => u.toLowerCase() === record.user.toLowerCase()
                ) || record.user;

            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
            };

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
                    score: score(
                        rank + 1,
                        record.percent,
                        level.percentToQualify
                    ),
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
