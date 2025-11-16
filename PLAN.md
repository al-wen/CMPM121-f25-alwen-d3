# D3: {game title goes here}

## Game Design Vision

{a few-sentence description of the game mechanics}

## Technologies

- TypeScript for most game code, little to no explicit HTML, and all CSS collected in common `style.css` file
- Deno and Vite for building
- GitHub Actions + GitHub Pages for deployment automation

## Assignments

## D3.a: Core mechanics (token collection and crafting)

Key technical challenge: Can you assemble a map-based user interface using the Leaflet mapping framework?
Key gameplay challenge: Can players collect and craft tokens from nearby locations to finally make one of sufficiently high value?

### Steps for D3.a

- [x] copy main.ts to reference.ts for future reference
- [x] delete everything in main.ts
- [x] put a basic leaflet map on the screen
- [x] draw the player's location on the map
- [x] draw a rectangle representing one cell on the map
- [x] use loops to draw a whole grid of cells on the map
- [x] give cells properties
- [x] limit player interaction distance
- [x] allow player to collect token
- [x] allow player to place token
- [x] allow player to craft (combine) tolen

## D3.b: Globe-spanning Gameplay

### Steps for D3.b

- [x] simulate local player movement
- [x] anchor grid at null island (0,0)
- [x] cells continue to be visible all the way out to the edge of the map as player moves
- [x] cells forget their state when they are no longer visible on the screen
- [x] only the cells near to their current location are available for interaction as player moves
- [x] game now requires that threshold to be reached for victory to be declared

## D3.b: [insert header]

### Steps for D3.c

- [x] cells should use Flyweight pattern or something similar so cells not visible on the map do not require memory for storage if not modified
- [x] use the Memento pattern or something similar strategy to preserve the state of modified cells
