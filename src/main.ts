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

const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

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
  center: CLASSROOM_LATLNG,
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
const playerMarker = leaflet.marker(CLASSROOM_LATLNG);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

type CustomRect = leaflet.Rectangle & {
  _popupDiv?: HTMLElement;
  _makePopup?: () => HTMLElement;
};

interface CellMemento {
  value: number;
  modified: boolean;
}

const cellMementos = new Map<string, CellMemento>();

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
    if (rect.getTooltip()) {
      rect.unbindTooltip();
    }
    rect.bindTooltip(String(pointValue));
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

        if (rect.getTooltip()) {
          rect.unbindTooltip();
        }
        rect.bindTooltip(String(pointValue));
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
        if (rect.getTooltip()) {
          rect.unbindTooltip();
        }
        rect.bindTooltip(String(pointValue));
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

let playerLatLng = CLASSROOM_LATLNG;

function movePlayer(dx: number, dy: number) {
  playerLatLng = leaflet.latLng(
    playerLatLng.lat + dx * TILE_DEGREES,
    playerLatLng.lng + dy * TILE_DEGREES,
  );

  playerMarker.setLatLng(playerLatLng);
  map.panTo(playerLatLng);

  refreshCache();
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
    btn.textContent = dir.label;
    btn.onclick = () => movePlayer(dir.dx, dir.dy);
    controlPanelDiv.appendChild(btn);
  });

  document.addEventListener("keydown", (event) => {
    const dir = directions.find((d) => d.key === event.key);
    if (dir) {
      movePlayer(dir.dx, dir.dy);
      event.preventDefault();
    }
  });
}

moveButtons();

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

function checkWin() {
  if (heldTokenValue !== null && heldTokenValue >= 16) {
    console.log("win");
    return true;
  }
  return false;
}
