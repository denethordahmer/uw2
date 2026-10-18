═══════════════════════════════════════
WARD 5 — THE ASHEN FORGE
═══════════════════════════════════════

WARD NUMBER & NAME
Ward 5 — The Ashen Forge. Floors 41-50. Boss on floor 50.

THEME
A massive subterranean foundry that has been burning for centuries. 
The air shimmers with heat, and rivers of molten metal flow through 
carved channels in the obsidian stone. It is loud, suffocating, and 
aggressively bright. The walls look like heavy industrial machinery 
fused with volcanic rock. A massive temperature shift from the cold 
bone and ice of previous wards.

PALETTE
  wall:      #2a2a2e    (dark obsidian/charcoal)
  wallEdge:  #ff4a3d    (hot ember highlight)
  wallBrick: #1a1a1c    (deep black stone)
  mortar:    #0a0a0c    (pure black shadow)
  floor:     #3a3a3e    (dark ash/grey)
  floor2:    #2e2e32    (slightly darker ash)
  moss:      #7a3a1a    (rust/slag growth)
  water:     #ff6a00    (molten lava/metal)
  torch:     #ffb347    (bright fire)
  light:     rgba(255, 100, 0, 0.08)  (warm fiery wash)

Accent for boss intro card and arena furniture: #ff6a00 (molten magma).

ENEMY ROSTER
  Name                 | HP | HP/lvl | ATK | ATK/lvl | XP | Gold | Shards | Speed | Status
  ---------------------|----|--------|-----|---------|----|----- |--------|-------|--------
  Ash Tick             | 14 | 1.8    | 4   | 0.50    | 4  | 4    | 2      | 1.40  | —
  Slag Hound           | 16 | 2.2    | 5   | 0.60    | 4  | 4    | 2      | 1.35  | bleed
  Cinder Wretch        | 28 | 3.0    | 7   | 0.75    | 7  | 7    | 3      | 1.20  | bleed
  Furnace Guard        | 42 | 4.2    | 9   | 0.90    | 8  | 8    | 3      | 0.80  | weaken
  Emberfiend           | 34 | 3.8    | 8   | 0.85    | 8  | 8    | 3      | 1.10  | poison
  Molten Brute         | 55 | 5.0    | 12  | 1.10    | 9  | 9    | 4      | 0.65  | —
  Smog Stalker         | 44 | 4.5    | 13  | 1.00    | 9  | 9    | 4      | 1.00  | poison
  The Reforged         | 32 | 3.6    | 9   | 0.80    | 9  | 9    | 4      | 1.00  | —

The Reforged is the gimmick enemy. When it drops to 50% HP, it splits 
into two smaller versions of itself (each with 25% of the original max 
HP and ATK). You have to kill both halves. 

BANDS
  floors 41-42: { ash_tick: 40, slag_hound: 35, cinder_wretch: 15, 
                  furnace_guard: 10 }
  floors 43-45: { ash_tick: 20, slag_hound: 20, cinder_wretch: 20,
                  furnace_guard: 15, emberfiend: 15, molten_brute: 10 }
  floors 46-49: { ash_tick: 10, slag_hound: 10, cinder_wretch: 15,
                  furnace_guard: 20, emberfiend: 15, molten_brute: 15, 
                  smog_stalker: 15 }
  floor 50 (boss): 4 x Molten Brute (guards)
  floors 51+:   same as floors 46-49 (default fallback)

BOSS
  Name:      The Forge Titan
  Title:     Master of the Molten Core
  Flavour:   "The fire has burned for a thousand years. It will not stop for you."
  Sprite:    boss_titan
  Accent:    #ff6a00
  Concept:   A massive, armor-plated giant powered by a core of pure 
             magma. Built of iron and heat. It moves slowly but hits 
             like a falling anvil.
  HP:        340
  ATK:       26
  Speed:     0.65
  Chain:     every 3 swings
  Trick:     Every 3rd swing is a heavy double-slam. Also, whenever 
             the Titan takes a large amount of damage in one hit, it 
             vents a burst of fire, dealing small unavoidable damage 
             to the player.
  Shard:     30 × ward number = 150 for ward 5.

SPECIAL FLOORS
  Clustered loot floors — 2-3 per run, floors 42-49. 4-5 guards around 
  a high-value chest, using the Ashen Forge roster.

  The Slag Pit — this ward's unique floor. The floor is heavily 
  broken up by pools of molten lava and unstable slag heaps. Pathing 
  requires moving around the glowing, impassable lava tiles. The 
  player must navigate a maze-like room to reach the stairs and chests. 
  (Note: If making lava tiles impassable is too complex for the engine 
  right now, use a standard Swarm Floor instead, but heavily populated 
  with Molten Brutes).

  Swarm floors do not appear in this ward.

STATUS EFFECTS
  No new status. Reuses bleed, poison, and weaken. Poison is themed 
  as toxic smog, bleed as deep burns, weaken as exhaustion from the heat.

SPRITES REQUIRED
  New sprites for all eight enemies (idle, attack, dying, elite). 
  The Forge Titan needs idle, attack, and death frames.
  
  Ground cover: Cooling Lava Veins. Jagged, glowing orange cracks in 
  the dark floor that pulse with heat, surrounded by dark, cooling rock.
  (Will be built in the next phase using the shared shape library).

  Arena dressing: New DRESSING entry for ward 5. Giant chains, massive 
  iron gears, glowing furnace vents, and piles of smoldering slag.

DATA LOCATIONS
  con-monsters.js    — 8 roster rows, bands, boss def, xp entries
  con-biomes.js      — ward 5 entry, Ashen Forge palette, DRESSING 
                        entry, special floor config
  sprites.js         — 8 enemy sprite builders plus variants
  con-bosssprites.js — boss_titan sprite builder
  levels.js          — Slag Pit logic (if built)
  test.html          — new section checks (roster, sprites, boss)