Full Analysis: Pixel Dungeon Source → JavaScript

Critical Constants First

From Level.java:

```
WIDTH  = 32
HEIGHT = 32
```

Everything is a 2D array, accessed as G.grid[y][x].

---

1. How Patch.java Generates Organic Shapes (Cellular Automaton)

This is a classic Conway's Game of Life variant run for a fixed number of generations. It's not used for room shapes directly — it's used for water and grass overlays in paintWater() and paintGrass(). But the algorithm is what produces organic, blob-like irregular shapes.

Step by step:

```
INIT: For every cell in the 32x32 grid, set it TRUE with probability = seed
      (seed is a float — e.g. 0.5 means 50% of cells start alive)

EACH GENERATION (run nGen times):
  For every non-border cell (x: 1 to 30, y: 1 to 30):
    Count all 8 Moore neighbors that are TRUE

    Rule A: if cell is FALSE and neighbors >= 5  → becomes TRUE
    Rule B: if cell is TRUE  and neighbors >= 4  → stays TRUE
    Rule C: otherwise                            → becomes/stays FALSE

  Swap buffers (double buffering — cur and off arrays)

OUTPUT: The final boolean[][] array
```

The numbers that matter:

· Threshold for dead→alive: 5 out of 8 neighbors
· Threshold for alive→stay: 4 out of 8 neighbors
· Border cells (row 0, row 31, col 0, col 31) are never updated — they stay whatever they were initialized as
· Higher seed value = denser starting fill = larger blobs
· Higher nGen = more smoothing passes = rounder, more consolidated shapes

JavaScript equivalent:

```javascript
function generatePatch(seed, nGen) {
  const W = 32, H = 32;
  let off = [];
  let cur = [];

  // Initialize 2D arrays
  for (let y = 0; y < H; y++) {
    off[y] = [];
    cur[y] = [];
    for (let x = 0; x < W; x++) {
      off[y][x] = Math.random() < seed;
      cur[y][x] = false;
    }
  }

  for (let g = 0; g < nGen; g++) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const count = [
          off[y-1][x-1], off[y-1][x], off[y-1][x+1],
          off[y][x-1],                 off[y][x+1],
          off[y+1][x-1], off[y+1][x], off[y+1][x+1]
        ].filter(Boolean).length;

        cur[y][x] = (!off[y][x] && count >= 5) || (off[y][x] && count >= 4);
      }
    }
    // swap buffers
    let temp = off;
    off = cur;
    cur = temp;
  }
  return off;
}
```

---

2. How the Painter Classes Handle Walls and Autotiling

Important clarification: These source files contain no bitmasking logic. The Painter sets tile type values (WALL vs EMPTY) in the map array. The visual autotiling (which specific wall graphic to draw) happens at render time in the game engine separately. What these files give you is the logical map data.

StandardPainter.paint() — the core room painting sequence:

```
Step 1: fill entire room bounding rect with WALL
        → fill(level, room, Terrain.WALL)
        → This writes WALL to every cell from (left,top) to (right,bottom) inclusive

Step 2: Roll chance (20% = 1 in 5) for a special room variant:
        - Graveyard  (needs min side >= 4, max side >= 6)
        - Burned     (depth > 1)
        - Striped    (max side >= 4)
        - Study      (both sides >= 6)
        - Bridge     (exactly 2 doors, both sides >= 4)
        - Fissure    (both sides >= 5)

Step 3 (default path): fill interior with EMPTY, margin = 1
        → fill(level, room, 1, Terrain.EMPTY)
        → Writes EMPTY to cells from (left+1, top+1) to (right-1, bottom-1)
        → The 1-tile perimeter stays WALL
```

What this means for your autotiler:

The map array after painting has:

· WALL at every cell that is on a room perimeter or is uncarved space
· EMPTY (floor) at every cell that is the interior of an active room
· Doors are single WALL tiles that get overwritten with a DOOR tile

Your autotiler at render time needs to look at each WALL tile's 8 neighbors and decide which wall sprite to draw. The rule in Shattered PD is:

· WALL tile with EMPTY below it = front wall face (the visible brick face with depth)
· WALL tile with only WALL neighbors = deep wall / void / cap tile
· The direction of the EMPTY neighbor tells you which face orientation

---

3. The Mathematical Rules: Spacing, Corridors, Room Prevention

The Core Algorithm: Binary Space Partitioning (BSP)

From RegularLevel.java, minRoomSize = 7, maxRoomSize = 9

split(rect) is called recursively starting from Rect(0, 0, 31, 31):

```
INPUT: a rectangle (left, top, right, bottom)
COMPUTE: w = right - left,  h = bottom - top

CASE 1: w > 9 AND h < 7
  → Force a vertical split
  → Split x chosen randomly from [left+3 ... right-3]
  → Recurse both halves

CASE 2: h > 9 AND w < 7
  → Force a horizontal split
  → Split y chosen randomly from [top+3 ... bottom-3]
  → Recurse both halves

CASE 3: random() <= (7*7 / rect.area) AND w <= 9 AND h <= 9
  → Create a room here (stop recursing)
  → Probability to stop = 49 / (w × h)
  → A 7×7 room (area=49) always stops. A 9×9 (area=81) stops ~60% of the time.

CASE 4: w < 7 OR h < 7
  → Create a room here (too small to split further)

DEFAULT: Split in a direction weighted by aspect ratio
  → P(vertical split) = (w - 2) / (w + h - 4)
  → Wider rects split vertically more often, taller rects split horizontally
  → Split point: random in [left+3 ... right-3] or [top+3 ... bottom-3]
```

Why rooms never overlap or directly merge: BSP partitions the space. When a rect splits at x=15, the left child owns columns 0–15 and right child owns columns 15–32. They SHARE the boundary column. Each room fills its entire rect with WALL, so the shared column is a wall on both sides — that's the automatic separation. There is no explicit gap rule in the source. The separation comes from both rooms' WALL perimeters occupying the split line.

The minimum gap your user described (1 tile between rooms) is effectively enforced by the split offset of +3: Random.Int(left+3, right-3) means the split is never placed fewer than 3 tiles from either edge, guaranteeing each resulting child rect has enough room for wall perimeter tiles.

The Neighbor Detection Rule

```javascript
// Two rooms are neighbors if their bounding rects intersect in a line
// (not a point) of at least 3 tiles long:

function addNeighbour(roomA, roomB) {
  const i = intersect(roomA, roomB);
  // i is the overlapping rectangle
  if ((i.width === 0 && i.height >= 3) ||   // shared vertical wall, 3+ tall
      (i.height === 0 && i.width >= 3)) {    // shared horizontal wall, 3+ wide
    roomA.neighbours.add(roomB);
    roomB.neighbours.add(roomA);
  }
}
```

Rooms with only a corner touch (1 tile intersection) are not considered neighbors and can never get a connecting door.

The Connection / Corridor System

```
1. Pick entrance room:  random room where width >= 4 AND height >= 4
2. Pick exit room:      different room, also width >= 4 AND height >= 4
                        AND graph distance >= sqrt(total room count)
   (retry up to 10 times or declare generation failed)

3. Build shortest path entrance→exit via neighbor graph → connect all rooms along it
4. Re-price that path, find SECOND shortest path → connect those rooms too
   (creates redundant loops so the dungeon isn't purely linear)

5. Randomly expand connected set until 50%–70% of rooms are connected:
   while (connected.size < rooms.size * Random(0.5, 0.7)):
     pick random room from connected set
     pick random unconnected neighbour
     connect them

6. Remaining unconnected rooms get type NULL → stay solid wall (they become the "void")
```

Door Placement (how corridors connect rooms)

Doors are NOT drawn as corridor tiles — they're single tiles at the point where two room walls meet:

```
For two connected rooms A and B:
  intersectionRect = A.intersect(B)

  If intersection is a vertical line (width == 0):
    doorX = intersectionRect.left
    doorY = random in [intersectionRect.top + 1 ... intersectionRect.bottom - 1]

  If intersection is a horizontal line (height == 0):
    doorX = random in [intersectionRect.left + 1 ... intersectionRect.right - 1]
    doorY = intersectionRect.top

  Place door tile at (doorX, doorY) — overwrites the WALL tile there
```

Room Merging (joinRooms — how open L-shaped spaces appear)

Two adjacent STANDARD rooms can merge their shared wall into open floor if:

```
shared wall length >= 3 tiles
shared wall length < max(roomA.height, roomB.height)  [not a full side]
roomA.width + roomB.width <= 9  (for vertical wall)
OR
roomA.height + roomB.height <= 9  (for horizontal wall)
```

When merged: the wall tiles between them are replaced with EMPTY floor, creating one large irregular-shaped open space with no door — just open passage.

---

4. Step-by-Step JavaScript Implementation Plan for Your Coding AI

Phase 1: Map Initialization

```
- Create G.grid as a 2D array: G.grid[y][x], filled with T.VOID (new tile state)
- Define constants: WIDTH=32, HEIGHT=32
- Define tile values in state.js: T.VOID = 10, T.WALL = 1, T.FLOOR = 2, T.DOOR = 3
```

Phase 2: BSP Room Generation

```
- Implement split(rect) recursively with:
    minRoomSize = 7, maxRoomSize = 9
    stop probability = 49 / rect.area when w<=9 and h<=9
    split offset minimum: +3 from each edge
    direction weighting: P(vertical) = (w-2)/(w+h-4)
- Collect resulting rooms into an array of {left, top, right, bottom}
- Reject the whole generation if rooms.length < 8 (retry)
```

Phase 3: Neighbour Graph

```
- For every pair of rooms (i, j), call intersect(roomI, roomJ)
- If intersection forms a line of length >= 3: add each to the other's neighbours set
```

Phase 4: Connection Routing

```
- Pick entrance and exit (both need inner width/height >= 4, graph distance >= sqrt(roomCount))
- BFS/Dijkstra from exit to build distance map
- Walk shortest path entrance→exit, mark all as connected
- Re-price path edges, run second path, connect those too
- Expand connected set randomly until 50-70% of rooms are connected
- Unconnected rooms → type = NULL (do not paint, leave as wall)
```

Phase 5: Room Type Assignment

```
- Connected rooms with 1 connection and size > 3×3: candidates for special rooms
- Connected rooms with multiple connections: mostly TUNNEL type (no special content)
- Guarantee at least 4 STANDARD rooms (paint open floor)
```

Phase 6: Painting

```
For each non-NULL room:
  1. fill entire room rect with T.WALL
  2. fill interior (margin 1) with T.FLOOR

For each connection between rooms:
  1. Find intersection rect of the two room boundaries
  2. Place T.DOOR at a random point along that intersection (offset +1 from ends)

For joinable STANDARD rooms (optional, creates open merged spaces):
  3. Check merge conditions (wall length >=3, combined size <=9)
  4. If merge: replace shared wall tiles with T.FLOOR
```

Phase 7: Wall Autotiling (Renderer)

```
For each T.WALL cell at (x, y):
  Check the 4 cardinal neighbors
  
  If neighbor below (y+1) is T.FLOOR or T.DOOR:
    → Draw WALL_FRONT sprite (brick face visible, has depth)
  
  Else if any neighbor is T.FLOOR:
    → Draw WALL_SIDE sprite (perpendicular face)
  
  Else:
    → Draw WALL_DEEP or void (fully surrounded by wall — invisible interior)

For rendering: any cell not belonging to any room = render as pure black (#000000)
```

Phase 8: Cellular Automaton Overlays (optional, for water/grass)

```
- Run generatePatch(seed=0.5, nGen=3) to get boolean[][]
- For each T.FLOOR cell where patch[y][x] === true: change to T.WATER or T.GRASS
```

---

One important note for your coding AI: The original source uses rect.width() to mean right - left (not including +1). When filling a rect with Painter.fill(level, rect, value), it adds 1: fill(left, top, width+1, height+1, value). Make sure your JS translation is consistent on whether room dimensions are inclusive or exclusive on the right/bottom edge, or you'll get off-by-one wall gaps — which is likely what caused your corner-cap failure in the last update.