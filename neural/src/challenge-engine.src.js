function ngMatches(definition, beat, props) {
  if (!beat) return false;
  const events = [definition.event, ...(definition.aliases || [])];
  if (!events.includes(beat)) return false;
  return !definition.when || definition.when(props || {});
}

function ngProgressEntry(entry, definition) {
  const done = !!(entry && entry.done);
  const raw = Number(entry && entry.progress);
  return {
    progress: done
      ? definition.target
      : Math.max(
          0,
          Math.min(
            definition.target,
            Number.isFinite(raw) ? raw : 0,
          ),
        ),
    done,
    t: Number(entry && entry.t) || 0,
  };
}

function ngAdvanceChallenges(state, beat, props, snapshot, now) {
  const current = state || {};
  let next = current;
  let changed = false;
  const completed = [];
  for (const definition of NG_ALL_CHALLENGES) {
    const before = ngProgressEntry(current[definition.id], definition);
    let progress = before.progress;
    if (definition.snapshot && snapshot) {
      const measured = Number(snapshot[definition.snapshot]);
      if (Number.isFinite(measured)) progress = Math.max(progress, measured);
    }
    if (ngMatches(definition, beat, props)) progress += 1;
    progress = Math.min(definition.target, progress);
    const done = before.done || progress >= definition.target;
    if (progress === before.progress && done === before.done) continue;
    if (!changed) next = { ...current };
    changed = true;
    next[definition.id] = {
      progress,
      done,
      t: done && !before.done ? now : before.t || now,
    };
    if (done && !before.done) completed.push(definition.id);
  }
  return { state: next, changed, completed };
}

function ngTrackSummary(state, trackId) {
  const definitions = NG_CHALLENGES.filter((item) => item.track === trackId);
  let done = 0;
  for (const definition of definitions) {
    if (ngProgressEntry((state || {})[definition.id], definition).done) {
      done += 1;
    }
  }
  return {
    done,
    total: definitions.length,
    complete: definitions.length > 0 && done === definitions.length,
  };
}

function ngRewardChanges(
  state,
  badges,
  coins,
  runtime,
  completed,
  beat,
  props,
  now,
) {
  let nextBadges = badges || {};
  let nextCoins = coins || {};
  const nextRuntime = {
    afterLoss: false,
    sheetsSinceLand: 0,
    ...(runtime || {}),
  };
  const newBadges = [];
  const newCoins = [];
  const clearedTracks = [];
  const completedSet = new Set(completed || []);

  for (const patch of NG_BADGE_DEFINITIONS) {
    if (nextBadges[patch.id]) continue;
    const earned =
      (patch.sourceTrack && ngTrackSummary(state, patch.sourceTrack).complete) ||
      (patch.sourceChallenge &&
        !!(state[patch.sourceChallenge] && state[patch.sourceChallenge].done)) ||
      (patch.event &&
        patch.event === beat &&
        (!patch.when || patch.when(props || {})));
    if (!earned) continue;
    if (nextBadges === badges) nextBadges = { ...(badges || {}) };
    nextBadges[patch.id] = { t: now };
    newBadges.push(patch.id);
    if (patch.sourceTrack) clearedTracks.push(patch.sourceTrack);
  }

  const candidates = new Set();
  for (const coin of NG_MAT_COINS) {
    if (
      coin.sourceChallenge &&
      state[coin.sourceChallenge] &&
      state[coin.sourceChallenge].done
    ) {
      candidates.add(coin.id);
    }
    if (
      coin.event &&
      coin.event === beat &&
      (!coin.when || coin.when(props || {}))
    ) {
      candidates.add(coin.id);
    }
  }
  if (beat === "roll_end") {
    nextRuntime.afterLoss = props && props.outcome === "lose";
  }
  if (beat === "roll_staged" && nextRuntime.afterLoss) {
    candidates.add("tap-and-carry-on");
    nextRuntime.afterLoss = false;
  }
  if (beat === "land" || beat === "roll_end") {
    nextRuntime.sheetsSinceLand = 0;
  }
  if (beat === "sheet_opened") nextRuntime.sheetsSinceLand += 1;
  if (beat === "commit") {
    if (nextRuntime.sheetsSinceLand >= 3) {
      candidates.add("research-position");
    }
    nextRuntime.sheetsSinceLand = 0;
  }
  for (const id of candidates) {
    if (nextCoins[id]) continue;
    if (nextCoins === coins) nextCoins = { ...(coins || {}) };
    const context = props && (props.technique || props.via);
    nextCoins[id] = context
      ? { t: now, context: String(context) }
      : { t: now };
    newCoins.push(id);
  }
  return {
    badges: nextBadges,
    coins: nextCoins,
    runtime: nextRuntime,
    newBadges,
    newCoins,
    clearedTracks,
    changed:
      newBadges.length > 0 ||
      newCoins.length > 0 ||
      completedSet.size > 0,
  };
}

function ngMergeChallengeMaps(local, cloud) {
  const out = {};
  const ids = new Set([
    ...Object.keys(local || {}),
    ...Object.keys(cloud || {}),
  ]);
  for (const id of ids) {
    const definition =
      NG_CHALLENGE_BY_ID[id] || { target: Number.MAX_SAFE_INTEGER };
    const left = ngProgressEntry((local || {})[id], definition);
    const right = ngProgressEntry((cloud || {})[id], definition);
    const progress = Math.max(left.progress, right.progress);
    const done = left.done || right.done;
    const times = [left.t, right.t].filter((value) => value > 0);
    out[id] = {
      progress: done
        ? Math.max(progress, definition.target || progress)
        : progress,
      done,
      t: times.length
        ? done
          ? Math.min(...times)
          : Math.max(...times)
        : 0,
    };
  }
  return out;
}

function ngMergeCollectibles(local, cloud) {
  const out = {};
  const ids = new Set([
    ...Object.keys(local || {}),
    ...Object.keys(cloud || {}),
  ]);
  for (const id of ids) {
    const left = (local || {})[id];
    const right = (cloud || {})[id];
    const times = [Number(left && left.t), Number(right && right.t)].filter(
      (value) => value > 0,
    );
    const context = (left && left.context) || (right && right.context);
    out[id] = context
      ? { t: times.length ? Math.min(...times) : 0, context }
      : { t: times.length ? Math.min(...times) : 0 };
  }
  return out;
}

function ngMigrateWhiteChallenges(challenges, tut, timestamp) {
  let nextChallenges = challenges || {};
  const nextDone = { ...((tut && tut.done) || {}) };
  let changed = false;
  for (const definition of NG_WHITE_CHALLENGES) {
    const entry = ngProgressEntry(
      nextChallenges[definition.id],
      definition,
    );
    if (nextDone[definition.legacyId] && !entry.done) {
      if (nextChallenges === challenges) {
        nextChallenges = { ...(challenges || {}) };
      }
      nextChallenges[definition.id] = {
        progress: definition.target,
        done: true,
        t: entry.t || timestamp || 0,
      };
      changed = true;
    } else if (entry.done && !nextDone[definition.legacyId]) {
      nextDone[definition.legacyId] = 1;
      changed = true;
    }
  }
  return {
    challenges: nextChallenges,
    tut: { ...(tut || {}), done: nextDone },
    changed,
  };
}

function ngResetWhiteChallenges(challenges) {
  const next = { ...(challenges || {}) };
  for (const definition of NG_WHITE_CHALLENGES) {
    delete next[definition.id];
  }
  return next;
}
