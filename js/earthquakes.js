(() => {
  const toggle = document.getElementById("earthquakes-toggle");
  const refresh = document.getElementById("earthquakes-refresh");
  const status = document.getElementById("earthquakes-status");
  let map;
  let request;
  let popup;

  function clear() {
    request?.abort();
    request = undefined;
    popup?.remove();
    map?.getSource("earthquakes")?.setData({ type: "FeatureCollection", features: [] });
  }

  async function load() {
    if (!map || !toggle.checked) return;
    clear();
    const current = map;
    const controller = new AbortController();
    request = controller;
    refresh.disabled = true;
    status.textContent = "Consultando USGS…";

    try {
      const response = await fetch(window.JARVIS_API_BASE_URL + "/api/map/earthquakes",
        { signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Consulta indisponível.");
      const features = result.features.filter(feature => {
        const coordinates = feature.geometry?.coordinates;
        return feature.geometry?.type === "Point" && Array.isArray(coordinates)
          && Number.isFinite(coordinates[0]) && Number.isFinite(coordinates[1])
          && feature.properties?.type === "earthquake"
          && Number.isFinite(feature.properties?.time);
      }).map(feature => ({
        ...feature,
        properties: { ...feature.properties, depth: feature.geometry.coordinates[2] },
      }));

      if (request !== controller || map !== current) return;
      map.getSource("earthquakes").setData({ type: "FeatureCollection", features });
      status.textContent = features.length + " terremotos nas últimas 24 h · USGS · " +
        new Date(result.metadata.generated).toLocaleTimeString("pt-BR");
    } catch (error) {
      if (!controller.signal.aborted) status.textContent = error.message;
    } finally {
      if (request === controller) refresh.disabled = !toggle.checked;
    }
  }

  document.addEventListener("jarvis:map-ready", event => {
    map = event.detail;
    map.addSource("earthquakes", {
      type: "geojson", data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "earthquakes", type: "circle", source: "earthquakes",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "mag"], 0],
          0, 4, 4, 7, 7, 12],
        "circle-color": "#e6a4ce",
        "circle-opacity": 0.65,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#f4d6f2",
      },
    });
    map.on("mouseenter", "earthquakes", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "earthquakes", () => { map.getCanvas().style.cursor = ""; });
    map.on("click", "earthquakes", event => {
      const feature = event.features[0];
      const properties = feature.properties;
      const detail = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = properties.place || "Local não informado";
      const magnitude = Number.isFinite(properties.mag) ? properties.mag : "indisponível";
      const depth = Number.isFinite(properties.depth) ? properties.depth.toFixed(1) + " km" : "indisponível";
      const description = document.createElement("p");
      description.textContent = "Magnitude " + magnitude + " · Profundidade " + depth;
      const time = document.createElement("p");
      time.textContent = new Date(properties.time).toLocaleString("pt-BR") + " · USGS";
      detail.append(heading, description, time);

      // Only links to the provider's own event pages are accepted.
      if (typeof properties.url === "string" && properties.url.startsWith("https://earthquake.usgs.gov/")) {
        const link = document.createElement("a");
        link.href = properties.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Detalhes no USGS";
        detail.append(link);
      }
      popup?.remove();
      popup = new window.maplibregl.Popup().setLngLat(feature.geometry.coordinates)
        .setDOMContent(detail).addTo(map);
    });
    toggle.disabled = false;
  });

  document.addEventListener("jarvis:map-close", () => {
    clear();
    map = undefined;
    toggle.checked = false;
    toggle.disabled = true;
    refresh.disabled = true;
    status.textContent = "";
  });

  toggle.addEventListener("change", () => {
    refresh.disabled = !toggle.checked;
    if (toggle.checked) load();
    else { clear(); status.textContent = ""; }
  });
  refresh.addEventListener("click", load);
})();
