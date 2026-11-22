(() => {
  const toggle = document.getElementById("webcams-toggle");
  const refresh = document.getElementById("webcams-refresh");
  const status = document.getElementById("webcams-status");
  let map;
  let request;
  let popup;
  let hoverPopup;
  let hoverTimer;
  let hoverId;
  let closeTimer;
  let cameras = new Map();
  let selectedCamera;
  let timer;
  let moveTimer;
  let lastRequest = 0;
  let lastRegion;
  let lastResult = "Ainda sem consulta concluída.";

  function windyUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" &&
        (url.hostname === "windy.com" || url.hostname.endsWith(".windy.com")) ? url.href : null;
    } catch {
      return null;
    }
  }

  function embedUrl(camera) {
    const url = windyUrl(camera.player?.day);
    if (!url) return null;
    const parsed = new URL(url);
    return parsed.hostname === "webcams.windy.com" &&
      /^\/webcams\/public\/embed\/player\/\d+\/day$/.test(parsed.pathname) ? url : null;
  }

  function stopHover() {
    clearTimeout(hoverTimer);
    clearTimeout(closeTimer);
    hoverPopup?.remove();
    hoverPopup = undefined;
    hoverId = undefined;
  }

  function player(camera) {
    const wrapper = document.createElement("div");
    wrapper.className = "webcam-player";
    const url = embedUrl(camera);
    const label = document.createElement("p");
    label.textContent = url ? "TIMELAPSE · últimas 24 horas · não é vídeo ao vivo" : "Sem player incorporável nesta câmera";
    wrapper.append(label);
    if (url) {
      const frame = document.createElement("iframe");
      frame.src = url;
      frame.title = "Timelapse da câmera: " + (camera.title || camera.webcamId);
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
      frame.allow = "fullscreen";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "no-referrer";
      wrapper.append(frame);
      const hint = document.createElement("small");
      hint.textContent = "Use ▶ no player para reproduzir. Se não carregar, consulte o link da fonte.";
      wrapper.append(hint);
    }
    return wrapper;
  }

  function preview(event) {
    clearTimeout(closeTimer);
    const id = String(event.features[0].properties.id);
    if (hoverId === id) return;
    stopHover();
    hoverId = id;
    const currentMap = map;
    hoverTimer = setTimeout(() => {
      const camera = cameras.get(id);
      if (!camera || map !== currentMap || !toggle.checked || document.hidden) return;
      const content = document.createElement("div");
      content.className = "webcam-hover";
      const heading = document.createElement("strong");
      heading.textContent = camera.title || "Câmera pública";
      const credit = document.createElement("a");
      credit.href = "https://www.windy.com/";
      credit.target = "_blank";
      credit.rel = "noopener noreferrer";
      credit.textContent = "Webcams provided by Windy.com";
      content.append(heading, player(camera), credit);
      content.addEventListener("mouseenter", () => clearTimeout(closeTimer));
      content.addEventListener("mouseleave", () => { closeTimer = setTimeout(stopHover, 300); });
      hoverPopup = new window.maplibregl.Popup({ maxWidth:"360px", closeButton:true,
        closeOnClick:false, focusAfterOpen:false, offset:20 })
        .setLngLat(event.features[0].geometry.coordinates).setDOMContent(content).addTo(map);
      hoverPopup.on("close", () => { hoverId = undefined; });
    }, 400);
  }

  function clear() {
    stopHover();
    clearTimeout(timer);
    clearTimeout(moveTimer);
    selectedCamera = undefined;
    request?.abort();
    request = undefined;
    popup?.remove();
    cameras.clear();
    map?.getSource("webcams-area")?.setData({ type: "FeatureCollection", features: [] });
    map?.getSource("webcams")?.setData({ type: "FeatureCollection", features: [] });
  }

  function details(event) {
    const camera = cameras.get(String(event.features[0].properties.id));
    if (!camera) return;
    stopHover();
    selectedCamera = String(camera.webcamId);
    const content = document.createElement("div");
    content.className = "webcam-details";
    const title = document.createElement("strong");
    title.textContent = camera.title || "Câmera pública";
    content.append(title);
    const place = document.createElement("p");
    place.textContent = [camera.location.city, camera.location.region, camera.location.country]
      .filter(Boolean).join(" · ");
    content.append(place);

    const detail = windyUrl(camera.urls?.detail);
    const live = windyUrl(camera.player?.live);
    const day = windyUrl(camera.player?.day);
    const target = live || detail || day;
    const preview = camera.images?.current?.preview || camera.images?.current?.thumbnail;
    if (target && typeof preview === "string") {
      try {
        const imageUrl = new URL(preview);
        if (imageUrl.protocol === "https:") {
          const link = document.createElement("a");
          link.href = target;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          const image = document.createElement("img");
          image.src = imageUrl.href;
          image.alt = camera.title || "Prévia da câmera";
          image.referrerPolicy = "no-referrer";
          image.addEventListener("error", () => {
            link.remove();
            const note = document.createElement("p");
            note.textContent = "Prévia indisponível ou expirada. Atualize as câmeras.";
            content.append(note);
          }, { once: true });
          link.append(image);
          content.append(link);
        }
      } catch {
        // Camera details and the source link remain usable without a preview.
      }
    }
    content.append(player(camera));
    const updated = document.createElement("p");
    const date = new Date(camera.lastUpdatedOn);
    updated.textContent = Number.isFinite(date.getTime())
      ? "Última imagem: " + date.toLocaleString("pt-BR") : "Horário da imagem indisponível";
    content.append(updated);
    if (target) {
      const link = document.createElement("a");
      link.href = target;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = live ? "Consultar fonte da transmissão" : "Abrir fonte na Windy";
      content.append(link);
    }
    const courtesy = document.createElement("p");
    const credit = document.createElement("a");
    credit.href = "https://www.windy.com/";
    credit.target = "_blank";
    credit.rel = "noopener noreferrer";
    credit.textContent = "Webcams provided by Windy.com";
    courtesy.append(credit);
    content.append(courtesy);
    if (popup?.isOpen()) {
      // Keep an already-playing iframe when the snapshot refreshes.
      const existing = popup.getElement().querySelector(".webcam-player");
      const replacement = content.querySelector(".webcam-player");
      if (existing?.querySelector("iframe")?.src === replacement?.querySelector("iframe")?.src) replacement?.replaceWith(existing);
      popup.setDOMContent(content);
    } else {
      popup = new window.maplibregl.Popup({ maxWidth: "420px", focusAfterOpen: false })
        .setLngLat(event.features[0].geometry.coordinates).setDOMContent(content).addTo(map);
      popup.on("close", () => { selectedCamera = undefined; });
    }
  }

  async function load() {
    if (!map || !toggle.checked || document.hidden) return;
    clearTimeout(timer);
    const center = map.getCenter();
    const longitude = ((center.lng + 180) % 360 + 360) % 360 - 180;
    const latitude = Math.max(-85, Math.min(85, center.lat));
    const region = latitude.toFixed(1) + ',' + longitude.toFixed(1);
    const wait = (lastRegion === region ? 60000 : 5000) - (Date.now() - lastRequest);
    if (wait > 0) {
      timer = setTimeout(load, wait);
      status.textContent = lastResult + " Próxima consulta em até " + Math.ceil(wait / 1000) + " s.";
      return;
    }
    lastRequest = Date.now();
    lastRegion = region;
    request?.abort();
    const current = map;
    const controller = new AbortController();
    request = controller;
    refresh.disabled = true;
    status.textContent = "Buscando câmeras públicas…";
    try {
      const ring = [];
      const phi = latitude * Math.PI / 180;
      const lambda = longitude * Math.PI / 180;
      const angle = 100 / 6371;
      for (let i=0; i<=64; i++) {
        const bearing = i * Math.PI / 32;
        const lat = Math.asin(Math.sin(phi)*Math.cos(angle)+Math.cos(phi)*Math.sin(angle)*Math.cos(bearing));
        const lon = lambda + Math.atan2(Math.sin(bearing)*Math.sin(angle)*Math.cos(phi), Math.cos(angle)-Math.sin(phi)*Math.sin(lat));
        ring.push([lon*180/Math.PI, lat*180/Math.PI]);
      }
      map.getSource("webcams-area").setData({ type:"Feature", properties:{}, geometry:{ type:"Polygon", coordinates:[ring] } });
      const query = new URLSearchParams({
        latitude: Math.max(-85, Math.min(85, center.lat)).toFixed(2),
        longitude: longitude.toFixed(2),
      });
      const response = await fetch(window.JARVIS_API_BASE_URL + "/api/map/webcams?" + query,
        { signal: controller.signal });
      const result = await response.json().catch(() => {
        throw new Error("O serviço de câmeras não respondeu corretamente. Reinicie o Jarvis.");
      });
      if (!response.ok) throw new Error(result.error || "Consulta de câmeras indisponível.");
      if (request !== controller || map !== current) return;
      const features = [];
      const nextCameras = new Map();
      for (const camera of result.webcams) {
        if (camera.status !== "active" || !Number.isFinite(camera.location?.latitude) ||
            !Number.isFinite(camera.location?.longitude)) continue;
        const id = String(camera.webcamId);
        nextCameras.set(id, camera);
        features.push({
          type: "Feature", properties: { id },
          geometry: { type: "Point", coordinates: [camera.location.longitude, camera.location.latitude] },
        });
      }
      cameras = nextCameras;
      if (selectedCamera && cameras.has(selectedCamera)) {
        const camera = cameras.get(selectedCamera);
        details({ features: [{ properties: { id: selectedCamera }, geometry: {
          coordinates: [camera.location.longitude, camera.location.latitude] } }] });
      } else popup?.remove();
      map.getSource("webcams").setData({ type: "FeatureCollection", features });
      status.textContent = features.length
        ? features.length + " câmeras · até 100 km · consulta a cada 60 s · Windy.com"
        : "0 câmeras em até 100 km do centro. Mova o mapa ou escolha São Paulo.";
      lastResult = status.textContent;
    } catch (error) {
      if (!controller.signal.aborted) {
        lastResult = error.message + (cameras.size ? " · mantendo últimas câmeras" : "");
        status.textContent = lastResult;
      }
    } finally {
      if (request === controller) {
        refresh.disabled = !toggle.checked;
        if (map && toggle.checked && !document.hidden) timer = setTimeout(load, 60000);
      }
    }
  }

  document.addEventListener("jarvis:map-ready", event => {
    map = event.detail;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 48;
    const context = canvas.getContext("2d");
    context.fillStyle = "#c6aceb";
    context.fillRect(7, 14, 28, 23);
    context.fillRect(13, 10, 14, 6);
    context.beginPath();
    context.arc(21, 25, 7, 0, Math.PI * 2);
    context.fillStyle = "#291a3b";
    context.fill();
    map.addImage("webcam-icon", context.getImageData(0, 0, 48, 48));
    map.addSource("webcams", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addSource("webcams-area", { type:"geojson", data:{type:"FeatureCollection", features:[]} });
    map.addLayer({ id:"webcams-area-fill", type:"fill", source:"webcams-area", paint:{"fill-color":"#ca87ef","fill-opacity":0.06} });
    map.addLayer({ id:"webcams-area-line", type:"line", source:"webcams-area", paint:{"line-color":"#ca87ef","line-width":1.5,"line-dasharray":[3,3]} });
    map.addLayer({ id:"webcams-halo", type:"circle", source:"webcams", paint:{"circle-radius":13,"circle-color":"#22142f","circle-stroke-color":"#dd9fff","circle-stroke-width":1.5} });
    map.addLayer({
      id: "webcams", type: "symbol", source: "webcams",
      layout: { "icon-image": "webcam-icon", "icon-size": 0.85, "icon-allow-overlap": true },
    });
    map.on("mouseenter", "webcams", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mousemove", "webcams", preview);
    map.on("mouseleave", "webcams", () => {
      map.getCanvas().style.cursor = "";
      clearTimeout(hoverTimer);
      closeTimer = setTimeout(stopHover, 350);
    });
    map.on("movestart", stopHover);
    map.on("click", "webcams", details);
    map.on("moveend", () => {
      clearTimeout(moveTimer);
      if (toggle.checked) moveTimer = setTimeout(load, 1200);
    });
    toggle.disabled = false;
    document.getElementById("webcams-sao-paulo").disabled = false;
  });
  document.addEventListener("jarvis:map-close", () => {
    clear();
    map = undefined;
    toggle.checked = false;
    toggle.disabled = true;
    document.getElementById("webcams-sao-paulo").disabled = true;
    refresh.disabled = true;
    status.textContent = "";
  });
  toggle.addEventListener("change", () => {
    refresh.disabled = !toggle.checked;
    if (toggle.checked) load();
    else { clear(); status.textContent = ""; }
  });
  document.getElementById("webcams-sao-paulo")?.addEventListener("click", () => {
    if (!map) return;
    map.jumpTo({center:[-46.6333,-23.5505], zoom:7});
    toggle.checked = true;
    refresh.disabled = false;
    load();
  });
  refresh.addEventListener("click", load);
  document.addEventListener("visibilitychange", () => {
    clearTimeout(timer);
    clearTimeout(moveTimer);
    if (document.hidden) { stopHover(); popup?.remove(); }
    else load();
  });
})();
