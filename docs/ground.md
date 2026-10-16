NEW FEATURE — biome ground cover

The concept
Each biome gets its own ground cover — a decorative pattern that gets
dropped sporadically onto the floor during level generation. Two or
three clusters appear on every floor, in random positions, sitting on
top of the existing floor tiles. They don't block movement, can't be
tapped, don't show on the minimap, and don't interact with anything.
They exist purely to give each biome a recognisable look on the ground.

How a cluster works
A cluster is a small set of adjacent floor tiles arranged in a shape.
The game picks a shape from a shared library of ten, places it on a
valid patch of floor, and rotates or mirrors it randomly so the same
shape doesn't always look identical. Each biome supplies its own art
for what those tiles draw as — mushrooms for the ruins, blood moss for
the Blackvein, and so on.

The shape library is shared. The art is per-biome. That means a new
biome only needs new art, not new shapes.

The ten shapes
Coordinates relative to the cluster's origin tile. All shapes are
between 2 and 5 tiles. Some are compact, some are elongated.

  Shape 1:  [(0,0), (1,0), (0,1)]                      small L
  Shape 2:  [(0,0), (1,0), (1,1)]                      opposite L
  Shape 3:  [(0,0), (1,0), (2,0)]                      3 straight
  Shape 4:  [(0,0), (1,0), (2,0), (1,1)]               T with one leg
  Shape 5:  [(0,0), (1,0), (0,1), (1,1)]               2x2 block
  Shape 6:  [(0,0), (1,0), (2,0), (2,1)]               3 then a step
  Shape 7:  [(0,0), (1,0), (1,1), (2,1)]               zigzag
  Shape 8:  [(0,0), (1,0), (0,1), (1,1), (1,2)]        small plus
  Shape 9:  [(0,0), (1,0), (2,0), (0,1)]               3 with one behind
  Shape 10: [(0,0), (1,0), (1,1), (2,1), (2,2)]        long diagonal

Rotation (0/90/180/270) and mirroring (50% chance) are applied at
placement. Ten shapes effectively become forty variations.

Generation rules
- Two or three clusters per floor, on every floor. Not skipped.
- Each cluster picks: a random clear floor tile, a random shape from
  the library, a random rotation, and a coin-flip mirror.
- Every tile of the chosen shape must land on a valid FLOOR tile that
  is clear of: the player spawn, stairs, shop, chests, monsters, other
  clusters.
- If any tile of the shape would be invalid, roll again with a
  different shape or a different position. Cap the retries (10 tries
  per cluster) so generation can't loop forever.
- Store placed clusters on the floor's data so render.js can read them.
  Suggested field: G.groundCover = [{shapeId, x, y, rotation, mirror}]
- Cleared at the start of every floor, same as G.decor.

Rendering rules
- Read G.groundCover after floor tiles and biome clutter, before walls.
- Draw each cluster's tiles in order. Because the shape is drawn by its
  own tiles, each tile only needs to render its own little piece — the
  pieces don't have to connect seamlessly across tile boundaries.
- Clusters are drawn flat on the floor. No shadows, no glow, no
  movement. Just a layer of decoration over the ground.

Sprites required per biome
For each biome, one small sprite per shape tile — a simple self-
contained drawing of that biome's ground cover (a few mushrooms, a
patch of moss, a frozen puddle). Same shape library, different art.
The tile art does not need to visually connect between adjacent tiles;
each tile just needs to look like its own small piece of the same
thing.

BIOME 1 — UPPER RUINS
Ground cover: mushroom rings.
Small clusters of pale grey-white mushrooms sprouting through cracks in
the stone floor. Colour palette: pale off-white caps with darker stems,
faintly glowing, in a stone-grey setting. Reads as "something living
in a dead place." Colour anchor: caps #e8e4d8, stems #7a7058, faint
green-blue glow at the base.

BIOME 2 — THE BLACKVEIN
Ground cover: blood moss.
Spreading patches of dark red moss or fungal growth creeping across the
forest floor. Colour palette: deep blood reds with hints of sickly
yellow at the edges. Reads as the corruption itself reaching out and
touching the ground. Colour anchor: dark red #7a2a24, highlights
#a8353a, sickly yellow tint #c8a838 at the edges.

BIOME 3 — THE FROSTED VAULT
Ground cover: frozen puddles.
Flat sheets of ice with thin frozen veins across their surface. Colour
palette: pale blue-white, with faint reflections of the surrounding
walls. Reads as water that has been frozen so long it will never melt.
Colour anchor: pale ice blue #b8d8e8, deep frozen

BIOME 4 — THE BONE OSSUARY (pending — biome not yet built)
Ground cover: scattered bone fragments.
Small clusters of broken bone — ribs, teeth, shards of skull — half
sunken into the dusty floor. Colour palette: pale bone white against
the dusty brown ground, with darker shadows in the crevices. Reads as
"the walls aren't the only place the dead have been left." Colour
anchor: bone white #d8d0b8, shaded bone #8a7a5a, dust shadow #3a2e22.

This biome does not yet exist. When it is added, this ground cover
should be built alongside it, using the same shape library and
generation rules described above.