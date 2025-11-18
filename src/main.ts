// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css"; // supporting style for Leaflet
import "./style.css"; // student-controlled page style

// Fix missing marker images
import "./_leafletWorkaround.ts"; // fixes for missing Leaflet images

// Import our luck function
import luck from "./_luck.ts";

// Create basic UI elements

const titleDiv = document.createElement("div");
titleDiv.innerHTML = "<h1>D3: World of 128</h1>";

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";

const mapDiv = document.createElement("div");
mapDiv.id = "map";

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";

const coordsDiv = document.createElement("div");
coordsDiv.id = "coordsPanel";
coordsDiv.style.position = "fixed";
coordsDiv.style.bottom = "0";
coordsDiv.style.left = "0";
coordsDiv.style.right = "0";
coordsDiv.style.textAlign = "center";
coordsDiv.style.padding = "6px 0";

document.body.append(titleDiv);
document.body.append(mapDiv);
document.body.append(controlPanelDiv);
document.body.append(statusPanelDiv);
document.body.append(coordsDiv);

// Our classroom location
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const CACHE_SPAWN_PROBABILITY = 0.2;
const INTERACTION_RADIUS = 5;

let heldTokenValue: number | null = null;

let GEOLOCATION_MODE = false;
let geoIntervalId: number | null = null;

// localStorage
interface GameState {
  playerLat: number;
  playerLng: number;
  heldTokenValue: number | null;
  geolocationMode: boolean;
  cellMementos: Array<{
    key: string;
    value: number;
    modified: boolean;
  }>;
}

function loadGameState(): GameState | null {
  const savedState = localStorage.getItem("gameState");
  if (savedState) {
    try {
      return JSON.parse(savedState);
    } catch (e) {
      console.error("Failed to parse saved game state:", e);
      return null;
    }
  }
  return null;
}

let playerLatLng = CLASSROOM_LATLNG;
const initialSavedState = loadGameState();
if (initialSavedState) {
  playerLatLng = leaflet.latLng(
    initialSavedState.playerLat,
    initialSavedState.playerLng,
  );
}

interface CellMemento {
  value: number;
  modified: boolean;
}

const cellMementos = new Map<string, CellMemento>();

if (initialSavedState) {
  for (const memento of initialSavedState.cellMementos) {
    cellMementos.set(memento.key, {
      value: memento.value,
      modified: memento.modified,
    });
  }
  heldTokenValue = initialSavedState.heldTokenValue;
  GEOLOCATION_MODE = initialSavedState.geolocationMode;
}

function saveGameState() {
  const state: GameState = {
    playerLat: playerLatLng.lat,
    playerLng: playerLatLng.lng,
    heldTokenValue: heldTokenValue,
    geolocationMode: GEOLOCATION_MODE,
    cellMementos: Array.from(cellMementos.entries()).map(([key, memento]) => ({
      key,
      value: memento.value,
      modified: memento.modified,
    })),
  };
  localStorage.setItem("gameState", JSON.stringify(state));
}

function updateLocation() {
  if (GEOLOCATION_MODE) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        playerLatLng = leaflet.latLng(
          pos.coords.latitude,
          pos.coords.longitude,
        );
        playerMarker.setLatLng(playerLatLng);
        map.setView(playerMarker.getLatLng());
        refreshCache();
        updateCoordsDisplay();
        updateStatusPanel();
        saveGameState();
      },
      (err) => console.error("Geolocation error:", err),
    );
  }
}

function updateStatusPanel() {
  if (heldTokenValue === null) {
    statusPanelDiv.textContent = "...";
  } else {
    statusPanelDiv.textContent =
      `You are holding a token of value ${heldTokenValue}.`;
  }
  if (checkWin()) {
    statusPanelDiv.innerHTML += "<div>You win!</div>";
  }
}

updateStatusPanel();

// Create the map (element with id "map" is defined in index.html)
const map = leaflet.map(mapDiv, {
  center: playerLatLng,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Add a marker to represent the player
const playerMarker = leaflet.marker(playerLatLng);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

type CustomRect = leaflet.Rectangle & {
  _popupDiv?: HTMLElement;
  _makePopup?: () => HTMLElement;
};

const cellLayers = new Map<string, CustomRect>();

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

function getCellValue(x: number, y: number): number {
  const key = cellKey(x, y);

  if (cellMementos.has(key)) {
    return cellMementos.get(key)!.value;
  }

  const values = [0, 2, 4, 8];
  return values[
    Math.floor(luck([x, y, "initialValue"].toString()) * values.length)
  ];
}

function saveCellMemento(x: number, y: number, value: number) {
  const key = cellKey(x, y);
  cellMementos.set(key, { value, modified: true });
}

function hasSpawnedCell(x: number, y: number): boolean {
  const key = cellKey(x, y);
  return cellMementos.has(key) ||
    luck([x, y].toString()) < CACHE_SPAWN_PROBABILITY;
}

function latToCellX(lat: number) {
  return Math.floor(lat / TILE_DEGREES);
}

function lngToCellY(lng: number) {
  return Math.floor(lng / TILE_DEGREES);
}

function updateCoordsDisplay() {
  if (!playerLatLng) return;
  const cellX = latToCellX(playerLatLng.lat);
  const cellY = lngToCellY(playerLatLng.lng);
  coordsDiv.textContent = `(${cellX},${cellY})`;
}

// HELPERS

function isInRange(distX: number, distY: number) {
  return Math.abs(distX) <= INTERACTION_RADIUS &&
    Math.abs(distY) <= INTERACTION_RADIUS;
}

function bindInteractivePopup(rect: CustomRect, _map: leaflet.Map) {
  const popupDiv = rect._popupDiv;
  const makePopup = rect._makePopup;
  if (!popupDiv || !makePopup) return;

  rect.bindPopup(() => {
    const oldButtons = popupDiv.querySelector("#popupButtons");
    if (oldButtons) oldButtons.remove();
    popupDiv.appendChild(makePopup());
    return popupDiv;
  });
}

function applyProximityStyle(
  rect: CustomRect,
  inRange: boolean,
  map: leaflet.Map,
) {
  if (inRange) {
    rect.setStyle({ color: "blue" });

    if (!rect.getPopup()) {
      bindInteractivePopup(rect, map);
    }
  } else {
    rect.setStyle({ color: "red" });
    if (rect.getPopup()) {
      map.closePopup(rect.getPopup()!);
      rect.unbindPopup();
    }
  }
}

function updateTooltip(rect: leaflet.Rectangle, value: number) {
  rect.unbindTooltip();
  rect.bindTooltip(String(value));
}

// Cache

function spawnCache(x: number, y: number) {
  const key = cellKey(x, y);
  if (cellLayers.has(key)) {
    return;
  }

  // Convert cell numbers into lat/lng bounds
  const bounds = leaflet.latLngBounds([
    [x * TILE_DEGREES, y * TILE_DEGREES],
    [(x + 1) * TILE_DEGREES, (y + 1) * TILE_DEGREES],
  ]);

  const dx = Math.round(playerLatLng.lat / TILE_DEGREES);
  const dy = Math.round(playerLatLng.lng / TILE_DEGREES);

  const distX = x - dx;
  const distY = y - dy;

  let rect: CustomRect;
  if (isInRange(distX, distY)) {
    rect = leaflet.rectangle(bounds, { color: "blue" }) as CustomRect;
  } else {
    rect = leaflet.rectangle(bounds, { color: "red" }) as CustomRect;
  }

  rect.addTo(map);
  cellLayers.set(key, rect);

  let pointValue = getCellValue(x, y);

  rect.bindTooltip(String(pointValue));

  const popupDiv = document.createElement("div");
  popupDiv.innerHTML =
    `<div>(${x},${y})<br>Value: <span id="value">${pointValue}</span></div>`;

  function updateDisplay() {
    const valueElement = popupDiv.querySelector("#value");
    if (valueElement) {
      valueElement.textContent = String(pointValue);
    }
    updateTooltip(rect, pointValue);
  }

  function makePopup() {
    const buttons = document.createElement("div");
    buttons.id = "popupButtons";

    const poke = document.createElement("button");
    poke.id = "poke";
    poke.textContent = "poke";

    poke.onclick = () => {
      if (heldTokenValue !== null) {
        poke.disabled = true;
        return;
      }
      if (pointValue === 0) {
        poke.disabled = true;
        return;
      }
      heldTokenValue = pointValue;
      pointValue = 0;
      saveCellMemento(x, y, pointValue);
      updateDisplay();
      updateStatusPanel();
      saveGameState();
    };

    const craft = document.createElement("button");
    craft.id = "craft";
    craft.textContent = "craft";
    craft.onclick = () => {
      if (heldTokenValue !== null && pointValue === heldTokenValue) {
        pointValue = pointValue + heldTokenValue;
        heldTokenValue = null;

        saveCellMemento(x, y, pointValue);

        updateDisplay();
        updateStatusPanel();

        updateTooltip(rect, pointValue);
        saveGameState();
      }
      if (heldTokenValue === null || pointValue !== heldTokenValue) {
        craft.disabled = true;
      }
    };

    const place = document.createElement("button");
    place.id = "place";
    place.textContent = "place";
    place.onclick = () => {
      if (heldTokenValue !== null && pointValue === 0) {
        pointValue = heldTokenValue;
        heldTokenValue = null;
        saveCellMemento(x, y, pointValue);
        updateDisplay();
        updateStatusPanel();
        updateTooltip(rect, pointValue);
        saveGameState();
      }
    };
    if (pointValue !== 0 || heldTokenValue === null) {
      place.disabled = true;
    }

    buttons.appendChild(poke);
    buttons.appendChild(craft);
    buttons.appendChild(place);

    if (heldTokenValue !== null || pointValue === 0) {
      poke.disabled = true;
    }

    if (heldTokenValue !== pointValue) {
      craft.disabled = true;
    }

    if (heldTokenValue === null || pointValue !== 0) {
      place.disabled = true;
    }

    return buttons;
  }

  rect._popupDiv = popupDiv;
  rect._makePopup = makePopup;

  applyProximityStyle(rect, isInRange(distX, distY), map);
}

// Player Movement

function movePlayer(dx: number, dy: number) {
  playerLatLng = leaflet.latLng(
    playerLatLng.lat + dx * TILE_DEGREES,
    playerLatLng.lng + dy * TILE_DEGREES,
  );

  playerMarker.setLatLng(playerLatLng);
  map.panTo(playerLatLng);
  refreshCache();
  updateCoordsDisplay();
  saveGameState();
}

function moveButtons() {
  const directions: { label: string; dx: number; dy: number; key?: string }[] =
    [
      { label: "Up", dx: 1, dy: 0, key: "ArrowUp" },
      { label: "Down", dx: -1, dy: 0, key: "ArrowDown" },
      { label: "Left", dx: 0, dy: -1, key: "ArrowLeft" },
      { label: "Right", dx: 0, dy: 1, key: "ArrowRight" },
    ];

  directions.forEach((dir) => {
    const btn = document.createElement("button");
    btn.className = "dir-button";
    btn.textContent = dir.label;
    btn.onclick = () => movePlayer(dir.dx, dir.dy);
    controlPanelDiv.appendChild(btn);
  });

  // Geolocation button
  const geoToggleBtn = document.createElement("button");
  function updateGeoBtn() {
    if (GEOLOCATION_MODE) {
      geoToggleBtn.textContent = "Geolocation: On";
    } else {
      geoToggleBtn.textContent = "Geolocation: Off";
    }
  }
  geoToggleBtn.onclick = () => {
    GEOLOCATION_MODE = !GEOLOCATION_MODE;
    updateGeoBtn();
    saveGameState();
    const dirButtons = controlPanelDiv.querySelectorAll("button.dir-button");

    for (let i = 0; i < dirButtons.length; i++) {
      const b = dirButtons[i] as HTMLButtonElement;
      if (GEOLOCATION_MODE) {
        b.disabled = true;
      } else {
        b.disabled = false;
      }
    }
    if (GEOLOCATION_MODE) {
      if (geoIntervalId == null) {
        geoIntervalId = setInterval(updateLocation, 1000);
      }
    } else {
      if (geoIntervalId != null) {
        clearInterval(geoIntervalId);
        geoIntervalId = null;
      }
    }
  };
  updateGeoBtn();
  controlPanelDiv.appendChild(geoToggleBtn);

  // Reset button
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset Game";
  resetBtn.onclick = () => reset();
  controlPanelDiv.appendChild(resetBtn);

  document.addEventListener("keydown", (event) => {
    const dir = directions.find((d) => d.key === event.key);
    if (dir) {
      movePlayer(dir.dx, dir.dy);
      event.preventDefault();
    }
  });
}

moveButtons();

if (GEOLOCATION_MODE) {
  const dirButtons = controlPanelDiv.querySelectorAll("button.dir-button");
  for (let i = 0; i < dirButtons.length; i++) {
    const b = dirButtons[i] as HTMLButtonElement;
    b.disabled = true;
  }
  if (geoIntervalId == null) {
    geoIntervalId = setInterval(updateLocation, 1000);
    updateLocation();
  }
}

function refreshCache() {
  const bounds = map.getBounds();
  const minX = latToCellX(bounds.getSouth());
  const maxX = latToCellX(bounds.getNorth());
  const minY = lngToCellY(bounds.getWest());
  const maxY = lngToCellY(bounds.getEast());

  const keep = new Set<string>();

  const dx = Math.round(playerLatLng.lat / TILE_DEGREES);
  const dy = Math.round(playerLatLng.lng / TILE_DEGREES);

  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const key = cellKey(x, y);

      if (hasSpawnedCell(x, y)) {
        keep.add(key);

        if (!cellLayers.has(key)) {
          spawnCache(x, y);
        } else {
          const distX = x - dx;
          const distY = y - dy;
          const rect = cellLayers.get(key)!;

          applyProximityStyle(rect, isInRange(distX, distY), map);
        }
      }
    }
  }

  for (const [key, layer] of cellLayers.entries()) {
    if (!keep.has(key)) {
      map.removeLayer(layer);
      cellLayers.delete(key);
    }
  }
}

refreshCache();
updateCoordsDisplay();

function checkWin() {
  if (heldTokenValue !== null && heldTokenValue >= 128) {
    return true;
  }
  return false;
}

function reset() {
  localStorage.clear();
  location.reload();
}
