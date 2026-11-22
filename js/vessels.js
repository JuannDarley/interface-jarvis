(() => {
  const toggle = document.getElementById("vessels-toggle");
  const refresh = document.getElementById("vessels-refresh");
  const santos = document.getElementById("vessels-santos");
  const status = document.getElementById("vessels-status");
  let map;
  let request;
  let popup;

  function clear() {
    request?.abort();
    request = undefined;
    popup?.remove();
    map?.getSource("vessels")?.setData({ type: "FeatureCollection", features: [] });
  }

  async function load() {
    if (!map || !toggle.checked) return;
    request?.abort();
    popup?.remove();
    const current = map;
    const controller = new AbortController();
    request = controller;
    refresh.disabled = true;
    santos.disabled = true;
    status.textContent = "Aguardando sinais AIS da região (até 30 s)…";
    try {
      const center = map.getCenter();
      const longitude = ((center.lng + 180) % 360 + 360) % 360 - 180;
      const query = new URLSearchParams({
        latitude: Math.max(-85, Math.min(85, center.lat)).toFixed(2),
        longitude: longitude.toFixed(2),
      });
      const response = await fetch(window.JARVIS_API_BASE_URL + "/api/map/vessels?" + query,
        { signal: controller.signal });
      const result = await response.json().catch(() => {
        throw new Error("A API de navios não respondeu corretamente. Reinicie o Jarvis e tente novamente.");
      });
      if (!response.ok) throw new Error(result.error || "Consulta marítima indisponível.");
      if (request !== controller || map !== current) return;
      map.getSource("vessels").setData(result);
      const count = result.features.length;
      status.textContent = count
        ? count + " navios · AISStream · amostra de 12 s · " +
          new Date(result.observedAt).toLocaleTimeString("pt-BR")
        : "Nenhum sinal AIS recebido nesta amostra. Atualize ou consulte outra região.";
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = error.message;
    } finally {
      if (request === controller) {
        refresh.disabled = !toggle.checked;
        santos.disabled = false;
      }
    }
  }

  function addShipIcon(globe) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d");

    // Bow points north. The map rotates the hull to the reported course.
    context.beginPath();
    context.moveTo(32, 3);
    context.bezierCurveTo(23, 10, 19, 20, 19, 30);
    context.lineTo(19, 53);
    context.quadraticCurveTo(19, 59, 25, 59);
    context.lineTo(39, 59);
    context.quadraticCurveTo(45, 59, 45, 53);
    context.lineTo(45, 30);
    context.bezierCurveTo(45, 20, 41, 10, 32, 3);
    context.closePath();
    context.fillStyle = "#b9a1ef";
    context.strokeStyle = "#eee4ff";
    context.lineWidth = 2;
    context.fill();
    context.stroke();

    context.fillStyle = "#4a3267";
    context.fillRect(25, 22, 14, 9);
    context.fillRect(25, 34, 14, 9);
    context.fillStyle = "#eee4ff";
    context.fillRect(24, 47, 16, 5);
    globe.addImage("ship-silhouette", context.getImageData(0, 0, 64, 64));
  }

  document.addEventListener("jarvis:map-ready", event => {
    map = event.detail;
    addShipIcon(map);
    map.addSource("vessels", {
      type: "geojson", data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "vessels", type: "symbol", source: "vessels",
      layout: {
        "icon-image": "ship-silhouette",
        "icon-size": ["interpolate", ["linear"], ["zoom"], 2, 0.32, 8, 0.48, 14, 0.65],
        "icon-rotate": ["coalesce", ["get", "course"], 0],
        "icon-rotation-alignment": "map",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    });
    map.on("mouseenter", "vessels", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "vessels", () => { map.getCanvas().style.cursor = ""; });
    map.on("click", "vessels", event => {
      const feature = event.features[0];
      const p = feature.properties;
      const detail = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = p.name || "Embarcação";
      const identity = document.createElement("p");
      identity.textContent = "MMSI " + p.mmsi;
      const movement = document.createElement("p");
      movement.textContent = "Velocidade " +
        (Number.isFinite(p.speed) ? p.speed.toFixed(1) + " nós" : "indisponível") +
        " · Rumo " + (Number.isFinite(p.course) ? p.course.toFixed(0) + "°" : "indisponível");
      const time = document.createElement("p");
      time.textContent = "Recebido em " + new Date(p.receivedAt).toLocaleString("pt-BR") + " · AISStream";
      detail.append(heading, identity, movement, time);
      popup?.remove();
      popup = new window.maplibregl.Popup().setLngLat(feature.geometry.coordinates)
        .setDOMContent(detail).addTo(map);
    });
    toggle.disabled = false;
    santos.disabled = false;
  });

  document.addEventListener("jarvis:map-close", () => {
    clear();
    map = undefined;
    toggle.checked = false;
    toggle.disabled = true;
    refresh.disabled = true;
    santos.disabled = true;
    status.textContent = "";
  });
  toggle.addEventListener("change", () => {
    refresh.disabled = !toggle.checked;
    if (toggle.checked) load();
    else {
      clear();
      santos.disabled = false;
      status.textContent = "";
    }
  });
  santos.addEventListener("click", () => {
    map.jumpTo({ center: [-46.3, -24], zoom: 7 });
    toggle.checked = true;
    load();
  });
  refresh.addEventListener("click", load);
})();
