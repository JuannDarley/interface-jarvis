(() => {
  const openButton = document.getElementById("open-globe");
  const view = document.getElementById("globe-view");
  const title = document.getElementById("globe-title");
  const container = document.getElementById("globe-map");
  const status = document.getElementById("globe-status");
  const resetButton = document.getElementById("reset-globe");
  const mapLibreUrl = "https://unpkg.com/maplibre-gl@5.6.2/dist";
  const initialView = { center: [-51, -16], zoom: 1.25, pitch: 0, bearing: 0 };
  let map;

  function loadAsset(element, url) {
    return new Promise((resolve, reject) => {
      const asset = document.createElement(element);
      if (element === "link") {
        asset.rel = "stylesheet";
        asset.href = url;
      } else {
        asset.src = url;
      }
      asset.onload = resolve;
      asset.onerror = () => {
        asset.remove();
        reject(new Error("Falha ao carregar MapLibre."));
      };
      document.head.append(asset);
    });
  }

  let library;
  function loadLibrary() {
    library ??= Promise.all([
      loadAsset("link", mapLibreUrl + "/maplibre-gl.css"),
      loadAsset("script", mapLibreUrl + "/maplibre-gl.js"),
    ]).catch(error => {
      library = undefined;
      throw error;
    });
    return library;
  }

  async function loadDarkStyle() {
    const response = await fetch("https://tiles.openfreemap.org/styles/liberty");
    if (!response.ok) throw new Error("Mapa-base indisponível.");
    const base = await response.json();
    const visibleLayers = new Set([
      "background", "water", "waterway_river", "boundary_3", "boundary_2",
      "label_state", "label_town", "label_city", "label_city_capital",
      "label_country_3", "label_country_2", "label_country_1",
    ]);
    const colors = {
      background: { "background-color": "#221a30" },
      fill: { "fill-color": "#0a080f" },
      line: { "line-color": "#645078" },
      symbol: { "text-color": "#d0bce9", "text-halo-color": "#14101c" },
    };

    const layers = base.layers.filter(layer => visibleLayers.has(layer.id));
    for (const layer of layers) {
      layer.paint = { ...layer.paint, ...colors[layer.type] };
      if (layer.type === "symbol") {
        layer.layout["text-field"] = ["coalesce", ["get", "name:pt"], ["get", "name"], ["get", "name_en"]];
      }
    }
    return {
      version: 8,
      projection: { type: "globe" },
      glyphs: base.glyphs,
      sources: { openmaptiles: base.sources.openmaptiles },
      layers,
    };
  }

  let navigation = 0;
  async function showCurrentView() {
    const run = ++navigation;
    const showMap = location.hash === "#mapa";
    const wasOpen = !view.hidden;
    document.body.classList.toggle("globe-active", showMap);
    view.hidden = !showMap;

    if (!showMap) {
      document.dispatchEvent(new Event("jarvis:map-close"));
      map?.remove();
      map = undefined;
      resetButton.disabled = true;
      if (wasOpen) openButton.focus();
      return;
    }

    title.focus();
    if (map) return;
    status.hidden = false;
    status.textContent = "Carregando globo…";

    try {
      const [, style] = await Promise.all([loadLibrary(), loadDarkStyle()]);
      if (run !== navigation) return;
      const engine = window.maplibregl;
      const globe = new engine.Map({
        container,
        style,
        ...initialView,
        minZoom: 0.75,
        maxZoom: 18,
        maxPitch: 0,
        locale: {
          "Map.Title": "Globo terrestre",
          "NavigationControl.ZoomIn": "Aproximar",
          "NavigationControl.ZoomOut": "Afastar",
        },
      });
      map = globe;
      globe.addControl(new engine.NavigationControl({ showCompass: false }), "top-right");
      globe.once("load", () => {
        if (map !== globe) return;
        status.hidden = true;
        resetButton.disabled = false;
        document.dispatchEvent(new CustomEvent("jarvis:map-ready", { detail: globe }));
      });
      globe.on("error", () => {
        if (map === globe && resetButton.disabled) {
          status.hidden = false;
          status.textContent = "O mapa não carregou. Confira a conexão e volte a abrir o mapa.";
        }
      });
    } catch {
      if (run === navigation) {
        status.textContent = "Não foi possível abrir o globo. Confira a conexão e o suporte a WebGL.";
      }
    }
  }

  resetButton.addEventListener("click", () => map?.jumpTo(initialView));
  view.addEventListener("keydown", event => event.stopPropagation());
  window.addEventListener("hashchange", showCurrentView);
  showCurrentView();
})();
