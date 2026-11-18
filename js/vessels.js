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
    clear();
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
        latitude: Math.max(-85, Math.min(85, center.lat)), longitude,
      });
      const response = await fetch(window.JARVIS_API_BASE_URL + "/api/map/vessels?" + query,
        { signal: controller.signal });
      const result = await response.json();
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

  document.addEventListener("jarvis:map-ready", event => {
    map = event.detail;
    map.addSource("vessels", {
      type: "geojson", data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "vessels", type: "circle", source: "vessels",
      paint: { "circle-radius": 5, "circle-color": "#a89cf0",
        "circle-stroke-color": "#e0d8ff", "circle-stroke-width": 1.5 },
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
