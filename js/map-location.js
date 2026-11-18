(() => {
  const button = document.getElementById("map-location-button");
  const status = document.getElementById("map-location-status");
  let map;
  let generation = 0;

  function accuracyArea(latitude, longitude, meters) {
    const phi = latitude * Math.PI / 180;
    const lambda = longitude * Math.PI / 180;
    const angle = Math.min(meters, 20000000) / 6371008.8;
    const ring = [];
    for (let i = 0; i < 64; i++) {
      const bearing = i * Math.PI / 32;
      const lat = Math.asin(Math.sin(phi) * Math.cos(angle)
        + Math.cos(phi) * Math.sin(angle) * Math.cos(bearing));
      const lon = lambda + Math.atan2(Math.sin(bearing) * Math.sin(angle) * Math.cos(phi),
        Math.cos(angle) - Math.sin(phi) * Math.sin(lat));
      // Preserve continuous longitudes for circles crossing the antimeridian.
      ring.push([lon * 180 / Math.PI, lat * 180 / Math.PI]);
    }
    ring.push(ring[0]);
    return {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: {},
    };
  }

  async function position() {
    let timeout;
    try {
      return await new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject({ code: 3 }), 32000);
        if (window.JarvisDesktop?.getCurrentPosition) {
          window.JarvisDesktop.getCurrentPosition().then(result => {
            if (result.error) reject(result.error);
            else resolve(result);
          }, () => reject({ code: 2 }));
        } else if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 20000, maximumAge: 0,
          });
        } else {
          reject({ code: 2 });
        }
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function locate() {
    if (!map) return;
    const current = map;
    const run = ++generation;
    button.disabled = true;
    status.textContent = window.JarvisDesktop?.getCurrentPosition
      ? "Obtendo localização. Autorize o JARVIS nos Serviços de Localização do macOS."
      : "Obtendo localização. Autorize o acesso no navegador.";
    try {
      const result = await position();
      if (run !== generation || map !== current) return;
      const { latitude, longitude, accuracy } = result.coords;
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
          !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
        throw { code: 2 };
      }
      const features = [{
        type: "Feature",
        geometry: { type: "Point", coordinates: [longitude, latitude] },
        properties: {},
      }];
      const hasAccuracy = Number.isFinite(accuracy) && accuracy >= 0;
      if (hasAccuracy) features.unshift(accuracyArea(latitude, longitude, accuracy));
      map.getSource("my-location").setData({ type: "FeatureCollection", features });
      const zoom = hasAccuracy
        ? Math.max(3, Math.min(16, 16 - Math.log2(Math.max(accuracy, 10) / 10)))
        : 13;
      map.jumpTo({ center: [longitude, latitude], zoom, pitch: 0, bearing: 0 });
      button.textContent = "Atualizar minha localização";
      const precision = hasAccuracy
        ? "Precisão estimada: " + Math.ceil(accuracy).toLocaleString("pt-BR") + " m."
        : "Precisão não informada pelo dispositivo.";
      status.textContent = "Você está no marcador lilás. " + precision;
    } catch (error) {
      if (run !== generation || map !== current) return;
      const messages = {
        1: "Localização negada. Libere o acesso à localização e tente novamente.",
        2: "Localização indisponível. Confira os Serviços de Localização do dispositivo.",
        3: "Não foi possível localizar a tempo. Tente novamente.",
      };
      status.textContent = messages[error.code] || messages[2];
    } finally {
      if (run === generation && map === current) button.disabled = false;
    }
  }

  document.addEventListener("jarvis:map-ready", event => {
    map = event.detail;
    map.addSource("my-location", {
      type: "geojson", data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "my-location-accuracy", type: "fill", source: "my-location",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": "#c59aff", "fill-opacity": 0.16, "fill-outline-color": "#b98de8" },
    });
    map.addLayer({
      id: "my-location-point", type: "circle", source: "my-location",
      filter: ["==", ["geometry-type"], "Point"],
      paint: { "circle-radius": 7, "circle-color": "#d2a4ff",
        "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
    });
    map.addLayer({
      id: "my-location-label", type: "symbol", source: "my-location",
      filter: ["==", ["geometry-type"], "Point"],
      layout: { "text-field": "Você", "text-font": ["Noto Sans Regular"],
        "text-size": 13, "text-offset": [0, 1.5], "text-allow-overlap": true },
      paint: { "text-color": "#eee4ff", "text-halo-color": "#140c20", "text-halo-width": 2 },
    });
    button.disabled = false;
  });

  document.addEventListener("jarvis:map-close", () => {
    generation++;
    map = undefined;
    button.disabled = true;
    button.textContent = "Minha localização";
    status.textContent = "";
  });
  button.addEventListener("click", locate);
})();
