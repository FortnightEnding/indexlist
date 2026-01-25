import { round, score } from "./score.js";

/**
 * IMPORTANT:
 * - NO leading slash
 * - Relative paths so GitHub Pages project sites work
 *   https://fortnightending.github.io/indexlist/
 */
const dir = "data";
const levelsDir = `${dir}/levels`;

export async function fetchList() {
    try {
        // Load list
        const listRes = await fetch(`${dir}/_list.json`, { cache: "no-store" });
        if (!listRes.ok) throw new Error("list fetch failed");

        const list = await listRes.json();

        // Expecting: ["samplelevel1", "samplelevel2", ...]
        if (!Array.isArray(list)) throw new Error("list is not an array");

        return await Promise.all(
            list.map(async (path, rank) => {
                try {
                    const levelRes = await fetch(
                        `${levelsDir}/${path}.json`,
                        { cache: "no-store" }
                    );
                    if (!levelRes.ok) throw new Error("level fetch failed");

                    const level = await levelRes.json();

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
                } catch (e) {
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
        const res = await fetch(`${dir}/_editors.json`, { cache: "no-store" });
        if (!res.ok) throw new Error("editors fetch failed");
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

        // Verification
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

        // Records
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
                    li
                    
