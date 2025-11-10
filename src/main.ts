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
const NEIGHBORHOOD_SIZE = 24;
const CACHE_SPAWN_PROBABILITY = 0.1;

const INTERACTION_RADIUS = 5;

let heldTokenValue: number | null = null;

function updateStatusPanel() {
  if (heldTokenValue === null) {
    statusPanelDiv.textContent = "...";
  } else {
    statusPanelDiv.textContent =
      `You are holding a token of value ${heldTokenValue}.`;
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

// Add caches to the map by cell numbers
function spawnCache(x: number, y: number) {
  // Convert cell numbers into lat/lng bounds
  const origin = CLASSROOM_LATLNG;
  const bounds = leaflet.latLngBounds([
    [origin.lat + x * TILE_DEGREES, origin.lng + y * TILE_DEGREES],
    [origin.lat + (x + 1) * TILE_DEGREES, origin.lng + (y + 1) * TILE_DEGREES],
  ]);

  // Add a rectangle to the map to represent the cache
  let rect;
  if (Math.abs(x) <= INTERACTION_RADIUS && Math.abs(y) <= INTERACTION_RADIUS) {
    rect = leaflet.rectangle(bounds);
  } else {
    rect = leaflet.rectangle(bounds, { color: "red" });
  }
  rect.addTo(map);

  let pointValue = 2 +
    2 * Math.floor(luck([x, y, "initialValue"].toString()) * 2);

  // The popup offers a description and button
  const popupDiv = document.createElement("div");
  popupDiv.innerHTML =
    popupDiv.innerHTML =
      `<div>(${x},${y})<br>Value: <span id="value">${pointValue}</span></div>`;

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

      const v = popupDiv.querySelector("#value");
      if (v) v.textContent = "0";

      updateStatusPanel();
    };

    const craft = document.createElement("button");
    craft.id = "craft";
    craft.textContent = "craft";
    craft.onclick = () => {
      if (heldTokenValue !== null && pointValue === heldTokenValue) {
        pointValue = pointValue + heldTokenValue;
        heldTokenValue = null;
        const v = popupDiv.querySelector("#value");
        if (v) v.textContent = String(pointValue);
        updateStatusPanel();
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
        const v = popupDiv.querySelector("#value");
        if (v) v.textContent = String(pointValue);
        updateStatusPanel();
      }
    };
    if (pointValue !== 0 || heldTokenValue === null) {
      place.disabled = true;
    }
    buttons.appendChild(place);

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

  // Handle interactions with the cache
  if (Math.abs(x) <= INTERACTION_RADIUS && Math.abs(y) <= INTERACTION_RADIUS) {
    rect.bindPopup(() => {
      const oldButtons = popupDiv.querySelector("#popupButtons");
      if (oldButtons) {
        oldButtons.remove();
      }

      popupDiv.appendChild(makePopup());
      return popupDiv;
    });
  } else {
    rect.bindTooltip("Too far!");
  }
}

// Look around the player's neighborhood for caches to spawn
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    // If location i,j is lucky enough, spawn a cache!
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
