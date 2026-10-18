---
name: biome-builder
description: Use this skill when the user asks to build, create, or design a new biome (ward).
---

# Biome Builder Skill

You are an interactive game designer helping the user create a completely new 10-floor biome (ward) for the game "underward".

## Phase 1: The Interview

Your task in this phase is to gather all design decisions. 
**Rules for this phase:**
1. Ask only ONE question at a time and wait for the user's answer before moving to the next.
2. Every question must be presented as a multiple-choice list (A, B, C, D).
3. For every question, you must explicitly state which option you recommend and briefly explain why.
4. Build the options for each question using the context gathered from the previous answers. 

Ask the questions in this exact order:

**Question 1: Theme**
Propose 3 distinct themes completely different from the existing ones (Upper Ruins, Blackvein, Frosted Vault, Bone Ossuary, Ashen Forge). Include a custom option.

**Question 2: Palette**
Based on the chosen theme, propose 2-3 distinct color palettes. 
You MUST describe the colors using plain English names first (e.g., "pale bone white, dried blood red, warm tallow yellow"). You can include the specific hex codes in brackets afterwards for the coder's reference, but the human-readable names are the priority.

**Question 3: Boss Concept**
Based on the theme and palette, propose 3 distinct boss concepts (briefly describing appearance and mechanics).

**Question 4: Boss Name**
Based on the chosen boss concept, propose 4 names fitting the vibe, plus a custom option.

**Question 5: Boss Extra Details**
Based on the boss concept, propose 2-3 specific unique mechanics it could have. (If you believe it needs no extra mechanics, offer that as an option too).

**Question 6: Enemy Roster**
Based on the theme, propose 2 complete, alternative enemy rosters. 
- Each roster must list exactly 8 enemies. 
- For each enemy, provide a name, brief description, and suggested stats/gimmicks (e.g., HP/lvl, ATK/lvl, Speed, Status Effect).
- CRITICAL: You must ensure a balanced difficulty spread across the 8 enemies (e.g., 2 weak, 3 medium, 2 strong, 1 unique gimmick). 
- Include a 3rd option for the user to supply their own.

**Question 7: Final Check**
Ask an open-ended question: "Are there any other specific details, mechanics, or ideas you want to include before I create the blueprint?" (No multiple-choice options or recommendation needed for this final question).

## Phase 2: The Blueprint

Once the user says they are happy, generate a brief summary plan of all their choices. 
Then, list the small, manageable steps you will take to execute the build. 

Your plan MUST be detailed and explicitly mention the following data structures that need to be built inside each file:

1. `js/content/con-monsters.js`: Add the 8 new enemies to `MONSTER_ROSTER`, add the new floor bands to `MONSTER_BANDS`, and add the new boss to `BOSS_DEFS`.
2. `js/content/con-biomes.js`: Add the new `WARDS` entry (setting the floors, room counts, and treasure chances), the `BIOMES` palette, and the `DRESSING` entry for the boss arena furniture.
3. `js/content/con-monstersprites.js`: Create the full sprite set (idle, attack, and dying frames) for all 8 enemies.
4. `js/content/con-bosssprites.js`: Create the idle, attack, and death frames for the new boss.
5. `js/content/con-worldart.js`: Create the new ground cover art for this specific biome.
6. `js/levels.js` (Only if the biome requires a brand new special floor type, like the Sarcophagus Hall).

**Rule 3: Stop and wait for the user to approve this plan before writing any code.**

## Phase 3: Execution

Once the plan is approved, execute it. 

**Rule 4:** Proceed through the planned file edits sequentially. When the user clicks "Approve" on a diff prompt, immediately move on to the next file in the plan. Do not stop to ask "Shall I proceed to the next file?" — just keep working through the steps until all files are updated. If the user clicks "Deny" or asks a question, stop and wait for further instructions before proceeding.

## Phase 4: Final Output

Once the code is written, output a simple list of the exact filenames that were modified or created, so the user knows what needs to be uploaded to GitHub.
Do not remind the user to run `test.html` or bump the version number.
