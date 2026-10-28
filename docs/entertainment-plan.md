# Entertainment plan — what is left

**Status:** items **8 (ambushes)**, **13 (heirloom)** and **15 (floor events)** are
built and green. Everything below is *not* built. Numbers in brackets are the original
option numbers, kept so you can just say "do 28 and 4".

> **Partly superseded — read `docs/next-session.md` first.** Latest owner direction:
> **no manual-input combat** (no combo, timed strike, dodge window or wind-up). Combat
> stays automatic; the decision is made before engaging. Monsters moving on sight is
> deferred to the very last polish pass. Current priorities are **drops → music →
> seamless floor/wall for biomes 3–4**. Section 2 below is therefore dropped.

**What the three additions changed**
- A floor now has one decision on it (about 45% of non-boss floors).
- Resting and chests carry a small, capped risk (ambushes).
- Dying has a silver lining (keep one item).
- None of that touches the fight itself, which is still automatic and short. That is the
  remaining gap.

---

## 1. Pacing and feel (cheapest, most certain)

| # | Idea | Size | Why it matters |
|---|------|------|----------------|
| 28 | **Fewer, tougher enemies.** Counts run 10–18 per floor. Try 8–12 and pay the same total XP/gold per kill. | S | A floor is currently mostly walking plus 1–2 second fights. This fixes the walking-to-fighting ratio with two data files. |
| 29 | **Smaller maps.** 26–28 tiles down to 22–24. | S | Same reason; less empty corridor. |
| 30 | **Haptics on crit and kill.** The setting already exists and is never used for this. | S | Free impact on a phone. |
| 4 | **Combo counter.** Each hit landed without being hit raises damage; being hit resets it. | S–M | Turns a fight into something you are *doing* rather than watching. |
| 22 | **Boss kill: pick 1 of 3 rewards** instead of one random drop. | S | Makes the reward a moment. |
| 26 | **Build banner.** Flash the tag name when a 3- or 6-rank set bonus triggers. | S | The passive system already has bonuses nobody notices. |

## 2. Make fights need your thumbs — DROPPED (owner decision)

*Kept only as a record. Do not build these: combat is deliberately automatic.*

| # | Idea | Size | Notes |
|---|------|------|-------|
| 1 | **Enemy wind-up.** Big hits flash and pause; move or cast in that beat to avoid it. | M | The single biggest change left. Build after 3/4 so the timing already feels familiar. |
| 3 | **Clean-escape dodge.** A well-timed move-away avoids the flee hit and grants a counter. | S | Makes fleeing a skill, not a tax. |
| 5 | **Ability pairings.** Burn + Cinderbolt bursts; Bleed + Rupture already exists — surface it and add three more. | S–M | Cheap depth in a 16-ability pool. |
| 9 | **Two new enemy behaviours:** a spitter (attacks at range) and a charger (crosses the room). | M | Applies to monsters that already exist. |
| 6 | **Hunters.** 2–3 types follow you across the floor. | M | The one change that makes the floor itself dangerous; needs a small monster-move step. |
| 10 | **Traps**, revealed by Deep Sight. | S–M | Gives an unused passive a job. |
| 2 | **Timed strike bonus.** Tap as the swing lands for extra damage. | M | Test 4 first — phone touch latency may make this feel unfair. |

## 3. More choices (now very cheap)

The event framework exists, so **new event kinds are the cheapest content in the game** —
one data entry each, no engine work:

- **Caged merchant** — pay to free him; he opens a one-item shop, or thanks you with gold.
- **Mirror** — swap one of your passives for a random other line at the same rank.
- **Hungry shrine** — feed it an item for a large shard payout.
- **Ossuary dice** — a second wager with worse odds and a better prize.

Larger structural choices:

| # | Idea | Size | Notes |
|---|------|------|-------|
| 16 | **Two staircases:** one safe, one "deeper and deadlier, better loot". | M | Natural follow-on to events: the risk decision moves to the whole floor. |
| 19 | **Marked elite** that drops a guaranteed special item if killed before you descend. | S | Gives a floor a target. |
| 18 | **Key + locked vault**, one per floor. | S–M | A reason to clear rather than rush. |
| 17 | **Pay-in-blood vendor.** | S | Simple, thematic, no new screen. |

## 4. Loot that shouts

| # | Idea | Size | Notes |
|---|------|------|-------|
| 20 | **Legendaries with real effects.** Today exactly one item (Gravemaker) does anything special; the rest are numbers. | M | Best long-term fix for "loot is boring". |
| 21 | **Set items** with 2- and 4-piece bonuses. | M | Pairs with the run-passive sets. |
| 23 | **Cursed items** — strong, with a drawback, identified at the shop. | M | Adds decisions to pickup, not just stats. |

## 5. Atmosphere

| # | Idea | Size | Notes |
|---|------|------|-------|
| 27 | **Music / ambience per ward.** The music slider currently controls nothing — the hooks are empty stubs. | M | A constant presence for the whole session; likely the biggest mood-per-hour change left. |

## 6. Reasons to come back

Unlockable starting weapons/classes (L) · daily or seeded challenge run (M) ·
goals/achievements paying shards (M) · a bestiary that fills in as you kill (S–M).

---

# Recommended next steps

**1. Pacing bundle — 28 + 29 + 30.** *(Do this first.)*
Data and settings only, no new systems, and it makes every later idea land better. Bring
the counts down, keep total XP/gold per floor roughly the same, trim the map a little, and
wire the haptics the setting already promises. **Watch:** the floor-clear bonus triggers
when the last enemy dies, so it will fire sooner; ambushes add enemies back, so do not
over-cut the count.

**2. Combo meter (4) + clean-escape dodge (3).** *(Warm-up for the real fight change.)*
Two small systems that give a fight a rhythm and a skill, without touching the swing loop.
They also establish the timing vocabulary the wind-up will use.

**3. Enemy wind-up (1).** *(The big one.)*
A visible charge before heavy hits, with a real window to move or cast. This is what turns
combat from a spectator sport into a fight. It needs a careful pass on timings against the
existing swing speeds (dagger 1.40 to hammer 0.70) so fast weapons do not become strictly
better at dodging.

**Then, by what you feel is missing:**
- Still quiet → **music (27)**.
- Still safe → **hunters (6)**.
- Loot still flat → **legendaries with effects (20)**.
- Want more floor variety for almost no work → **new event kinds** (section 3).

# Deliberately not now

- **Death penalty (11, 14).** The heirloom already gives death a cost and a consolation.
  Adding a penalty on top would double-punish, and the run-banking rule is a deliberate
  owner decision.
- **Ability ranks (24).** With 16 uncapped abilities the bar is already the widest it has
  ever been. Ranks would make it wider before it is deeper.
- **Timed strike (2)** before the combo meter exists. If tapping in time feels bad on the
  phone, the combo meter will tell you so more cheaply.

# Files each step touches (for planning only)

- **28/29:** `js/content/con-monsters.js` (counts), `js/content/con-biomes.js` (map size),
  `js/rewards.js` (per-kill payout if you keep totals equal).
- **30:** `js/combat.js` / `js/render.js` at the crit/kill points; `sfx.js` already owns
  the haptics setting.
- **4/3:** `js/combat.js` only — the swing and flee paths.
- **1:** `js/combat.js` (timers) and `js/render.js` (the charge flash).
- **27:** `js/sfx.js` stubs (`sfxStartAmbience` / `sfxStopAmbience` / `sfxSetWard`).

