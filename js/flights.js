(() => {
  const toggle = document.getElementById("flights-toggle");
  const refresh = document.getElementById("flights-refresh");
  const southeast = document.getElementById("flights-southeast");
  const status = document.getElementById("flights-status");
  const panel = document.getElementById("flight-details");
  const content = document.getElementById("flight-details-content");
  const close = document.getElementById("flight-details-close");
  const histories = new Map();
  const preview = document.getElementById("flight-preview");
  const identityCache = new Map();
  let hoverFlight;
  let hoverRequest;
  let hoverTimer;
  let hoverPoint;
  let map;
  let request;
  let detailRequest;
  let timer;
  let moveTimer;
  let selected;
  let aircraft = [];
  let selectedDetails;
  let lastObservedAt;
  const empty = () => ({ type: "FeatureCollection", features: [] });
  const wrap = longitude => ((longitude + 180) % 360 + 360) % 360 - 180;

  function icon(category, model = "") {
    if (category === "A7" || /^(H|R22|R44|R66|EC|AS3|B06)/.test(model)) return "helicopter";
    if (["A5", "A6"].includes(category) || /^(A3[358]|A388|B74|B77|B78|A124)/.test(model)) return "heavy";
    if (category === "A1" || /^(C1|C2|PA|SR2|BE[23])/.test(model)) return "light";
    return "airliner";
  }

  function addIcons(globe) {
    const shapes = {
      airliner: [[30,2],[34,2],[36,25],[58,39],[58,44],[36,36],[35,51],[43,57],[43,61],[32,57],[21,61],[21,57],[29,51],[28,36],[6,44],[6,39],[28,25]],
      heavy: [[29,1],[35,1],[38,24],[62,38],[62,45],[37,35],[36,50],[47,56],[47,62],[32,57],[17,62],[17,56],[28,50],[27,35],[2,45],[2,38],[26,24]],
      light: [[30,6],[34,6],[35,26],[58,27],[58,33],[35,33],[35,49],[44,51],[44,56],[32,54],[20,56],[20,51],[29,49],[29,33],[6,33],[6,27],[29,26]],
      helicopter: [[29,10],[35,10],[39,24],[37,37],[34,40],[34,53],[42,53],[42,57],[22,57],[22,53],[30,53],[30,40],[27,37],[25,24]],
    };
    for (const [name, points] of Object.entries(shapes)) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const context = canvas.getContext("2d");
      context.beginPath();
      points.forEach(([x,y], index) => index ? context.lineTo(x,y) : context.moveTo(x,y));
      context.closePath();
      context.fillStyle = "#7af3ff";
      context.strokeStyle = "#163b43";
      context.lineWidth = 2;
      context.fill();
      context.stroke();
      if (name === "helicopter") {
        context.strokeStyle = "#7af3ff";
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(9,13); context.lineTo(55,35);
        context.moveTo(9,35); context.lineTo(55,13);
        context.stroke();
      }
      globe.addImage("plane-" + name, context.getImageData(0,0,64,64));
    }
  }

  function deselect() {
    detailRequest?.abort();
    detailRequest = undefined;
    selected = undefined;
    selectedDetails = undefined;
    panel.hidden = true;
    map?.getSource("flight-route")?.setData(empty());
    map?.getSource("flight-track")?.setData(empty());
    if (map?.getLayer("flight-selection")) {
      map.setFilter("flight-selection", ["==", ["get", "id"], ""]);
    }
  }

  function stop() {
    hidePreview();
    clearTimeout(timer);
    clearTimeout(moveTimer);
    request?.abort();
    request = undefined;
    deselect();
    aircraft = [];
    map?.getSource("flights")?.setData(empty());
  }

  function row(label, value) {
    const line = document.createElement("p");
    const title = document.createElement("span");
    title.textContent = label + " ";
    const text = document.createElement("strong");
    text.textContent = value || "Indisponível";
    line.append(title, text);
    content.append(line);
  }

  function airport(value) {
    if (!value) return "Indisponível na fonte";
    return [value.iata_code || value.icao_code, value.municipality, value.name].filter(Boolean).join(" · ");
  }

  function lineData(points) {
    const segments = [];
    let segment = [];
    for (const point of points) {
      if (!Array.isArray(point) || !point.every(Number.isFinite)) continue;
      if (segment.length && Math.abs(point[0] - segment.at(-1)[0]) > 180) {
        if (segment.length > 1) segments.push(segment);
        segment = [];
      }
      segment.push(point);
    }
    if (segment.length > 1) segments.push(segment);
    return { type: "FeatureCollection", features: segments.map(coordinates => ({
      type: "Feature", properties: {}, geometry: { type: "LineString", coordinates },
    })) };
  }

  function airportLine(origin, destination) {
    if (![origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude]
      .every(Number.isFinite)) return [];
    // Great-circle interpolation keeps long airport connections correct on the globe.
    const vector = (lat, lon) => {
      const phi = lat * Math.PI / 180, lambda = lon * Math.PI / 180;
      return [Math.cos(phi)*Math.cos(lambda), Math.cos(phi)*Math.sin(lambda), Math.sin(phi)];
    };
    const a = vector(origin.latitude, origin.longitude);
    const b = vector(destination.latitude, destination.longitude);
    const angle = Math.acos(Math.max(-1,Math.min(1,a.reduce((sum,v,i) => sum+v*b[i],0))));
    if (angle < 0.00001 || Math.abs(Math.sin(angle)) < 0.00001) return [];
    return Array.from({length:65}, (_,i) => {
      const t=i/64;
      const v=a.map((value,j) => (value*Math.sin((1-t)*angle)+b[j]*Math.sin(t*angle))/Math.sin(angle));
      return [Math.atan2(v[1],v[0])*180/Math.PI, Math.atan2(v[2],Math.hypot(v[0],v[1]))*180/Math.PI];
    });
  }

  function trackPoints(flight) {
    const remote = selectedDetails?.track;
    const matching = remote?.callsign?.trim() === flight.callsign &&
      Number.isFinite(remote.endTime) && Date.now()/1000 - remote.endTime < 900;
    const points = matching && Array.isArray(remote.path)
      ? remote.path.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
          Number.isFinite(p[2])).map(p => ({time:p[0]*1000, point:[p[2],p[1]]}))
      : [];
    const cutoff = Date.now() - 2*60*60*1000;
    return [...points, ...(histories.get(flight.id) || [])].filter(p => p.time >= cutoff)
      .sort((a,b) => a.time-b.time).map(p => p.point);
  }

  function aircraftVisual(flight, model) {
    const figure = document.createElement("figure");
    figure.className = "flight-aircraft-visual";
    const registration = model?.registration || flight.registration;
    const identity = document.createElement("div");
    identity.className = "flight-aircraft-identity";
    const typeCode = document.createElement("strong");
    typeCode.textContent = model?.icao_type || flight.model || "Aeronave";
    const modelName = document.createElement("span");
    modelName.textContent = [model?.manufacturer, model?.type].filter(Boolean).join(" ")
      || "Modelo completo indisponível";
    const tail = document.createElement("span");
    tail.textContent = registration ? "Matrícula " + registration : "Matrícula indisponível";
    identity.append(typeCode, modelName, tail);
    figure.append(identity);

    const caption = document.createElement("figcaption");
    caption.textContent = "Identificação do cadastro · ICAO " + flight.id.toUpperCase();
    figure.append(caption);
    if (!model) return figure;

    const normalizeRegistration = value => String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
    const matchingHex = String(model.mode_s || "").toLowerCase() === flight.id;
    const matchingRegistration = !flight.registration ||
      normalizeRegistration(flight.registration) === normalizeRegistration(model.registration);
    if (!matchingHex || !matchingRegistration) {
      caption.textContent = "Foto indisponível para a identificação recebida.";
      return figure;
    }

    function photoUrl(value) {
      try {
        const url = new URL(value);
        const allowedHosts = ["image.airport-data.com", "airport-data.com", "www.airport-data.com"];
        return url.protocol === "https:" && allowedHosts.includes(url.hostname) ? url.href : null;
      } catch {
        return null;
      }
    }

    const original = photoUrl(model.url_photo);
    const thumbnail = photoUrl(model.url_photo_thumbnail);
    if (!original && !thumbnail) {
      caption.textContent = "Identificação do cadastro · adsbdb · Foto não disponível.";
      return figure;
    }
    const link = document.createElement("a");
    link.href = original || thumbnail;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "flight-aircraft-photo-link";
    const image = document.createElement("img");
    image.className = "flight-aircraft-photo";
    image.alt = [model.manufacturer, model.type, registration].filter(Boolean).join(" · ");
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    image.hidden = true;
    let thumbnailTried = false;
    image.addEventListener("load", () => {
      if (!figure.isConnected) return;
      identity.hidden = true;
      image.hidden = false;
      caption.textContent = "Foto de cadastro · " + registration + " · Airport-data.com via adsbdb";
    });
    image.addEventListener("error", () => {
      if (!thumbnailTried && thumbnail && thumbnail !== image.src) {
        thumbnailTried = true;
        image.src = thumbnail;
        return;
      }
      link.remove();
      identity.hidden = false;
      caption.textContent = "Identificação do cadastro · A foto não pôde ser carregada.";
    });
    image.src = original || thumbnail;
    link.append(image);
    figure.insertBefore(link, identity);
    return figure;
  }

  function hidePreview() {
    clearTimeout(hoverTimer);
    hoverRequest?.abort();
    hoverRequest = undefined;
    hoverFlight = undefined;
    preview.hidden = true;
  }

  function positionPreview(point) {
    if (!map || !point) return;
    const container = map.getContainer();
    const width = preview.offsetWidth;
    const height = preview.offsetHeight;
    let left = point.x + 20;
    if (left + width > container.clientWidth - 12) left = point.x - width - 20;
    const top = Math.min(point.y + 12, container.clientHeight - height - 12);
    preview.style.left = Math.max(12, left) + "px";
    preview.style.top = Math.max(12, top) + "px";
  }

  function renderPreview(flight, model, loading = false) {
    const p = flight.properties;
    preview.replaceChildren();
    const heading = document.createElement("strong");
    heading.className = "flight-preview-title";
    heading.textContent = p.callsign || p.registration || p.id;
    const visual = aircraftVisual(p, model);
    for (const link of visual.querySelectorAll("a")) link.tabIndex = -1;
    const modelLine = document.createElement("p");
    modelLine.textContent = model
      ? [model.manufacturer, model.type].filter(Boolean).join(" ")
      : p.model || "Modelo indisponível";
    const summary = document.createElement("p");
    summary.textContent = p.altitude + " · " + p.speed;
    const hint = document.createElement("small");
    hint.textContent = loading ? "Carregando foto e modelo…" : "Clique no avião para ver os detalhes";
    preview.append(heading, visual, modelLine, summary, hint);
    preview.hidden = false;
    positionPreview(hoverPoint);
    const image = visual.querySelector("img");
    image?.addEventListener("load", () => {
      if (hoverFlight?.properties.id === p.id) positionPreview(hoverPoint);
    });
    image?.addEventListener("error", () => {
      if (hoverFlight?.properties.id === p.id) positionPreview(hoverPoint);
    });
  }

  function showPreview(event) {
    const flight = event.features?.[0];
    if (!flight || map.isMoving()) return;
    hoverPoint = event.point;
    if (hoverFlight?.properties.id === flight.properties.id) {
      positionPreview(hoverPoint);
      return;
    }
    hidePreview();
    hoverFlight = flight;
    const cached = identityCache.get(flight.properties.id);
    const fresh = cached && cached.expiresAt > Date.now();
    renderPreview(flight, fresh ? cached.model : undefined, !fresh);
    if (fresh) return;

    hoverTimer = setTimeout(async () => {
      const controller = new AbortController();
      hoverRequest = controller;
      try {
        const response = await fetch(window.JARVIS_API_BASE_URL + "/api/map/aircraft/" +
          flight.properties.id + "/identity", { signal: controller.signal });
        if (!response.ok) throw new Error("Identificação indisponível.");
        const data = await response.json();
        if (hoverRequest !== controller || controller.signal.aborted) return;
        const model = data.aircraft;
        if (identityCache.size >= 128) identityCache.delete(identityCache.keys().next().value);
        identityCache.set(flight.properties.id, {
          model, expiresAt: Date.now() + (model ? 3600000 : 60000),
        });
        renderPreview(flight, model);
      } catch (error) {
        if (!controller.signal.aborted && hoverRequest === controller) renderPreview(flight);
      } finally {
        if (hoverRequest === controller) hoverRequest = undefined;
      }
    }, 250);
  }

  function renderDetails() {
    const flight = aircraft.find(item => item.properties.id === selected);
    if (!flight) return;
    const p = flight.properties;
    const model = selectedDetails?.aircraft?.aircraft ||
      identityCache.get(p.id)?.model;
    const route = selectedDetails?.route?.flightroute;
    content.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = p.callsign || p.registration || p.id;
    content.append(heading, aircraftVisual(p, model));
    row("Aeronave", model ? [model.manufacturer, model.type].filter(Boolean).join(" ") : p.model);
    row("Matrícula", model?.registration || p.registration);
    row("Operador", route?.airline?.name || model?.registered_owner);
    row("Origem cadastrada", airport(route?.origin));
    row("Destino cadastrado", airport(route?.destination));
    row("Altitude", p.altitude);
    row("Velocidade", p.speed);
    row("Rumo", Number.isFinite(p.heading) ? Math.round(p.heading) + "°" : "");
    row("Posição", new Date(p.positionTime).toLocaleTimeString("pt-BR"));
    row("Identificador ICAO", p.id);
    const note = document.createElement("p");
    note.className = "flight-note";
    note.textContent = detailRequest ? "Consultando modelo, aeroportos e trajeto…" :
      (selectedDetails?.error || "Rota cadastrada por indicativo · adsbdb. Pode diferir da operação atual.");
    content.append(note);
    const legend = document.createElement("p");
    legend.className = "flight-note";
    legend.textContent = "Linha lilás contínua: trajeto observado nas últimas 2 h. Linha tracejada: ligação entre os aeroportos cadastrados.";
    content.append(legend);
    if (!detailRequest && selectedDetails?.trackError) {
      const message = document.createElement("p");
      message.className = "flight-note";
      message.textContent = selectedDetails.trackError;
      content.append(message);
    }
    map.getSource("flight-route").setData(lineData(airportLine(route?.origin, route?.destination)));
    map.getSource("flight-track").setData(lineData(trackPoints(p)));
    if (model?.icao_type) {
      p.model = model.icao_type;
      p.icon = icon(p.category, p.model);
      map.getSource("flights").setData({type:"FeatureCollection", features:aircraft});
    }
  }

  async function select(flight) {
    hidePreview();
    deselect();
    selected = flight.properties.id;
    document.dispatchEvent(new CustomEvent("jarvis:entity-selected",{detail:{kind:"flight",id:selected,name:flight.properties.callsign||flight.properties.registration||selected,coordinates:flight.geometry.coordinates,observedAt:flight.properties.positionTime}}));
    panel.hidden = false;
    map.setFilter("flight-selection", ["==", ["get","id"], selected]);
    const controller = new AbortController();
    detailRequest = controller;
    renderDetails();
    try {
      const query = new URLSearchParams({ callsign:flight.properties.callsign });
      const response = await fetch(window.JARVIS_API_BASE_URL + "/api/map/aircraft/" +
        selected + "?" + query, {signal:controller.signal});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Detalhes indisponíveis.");
      if (controller !== detailRequest) return;
      selectedDetails = result;
    } catch (error) {
      if (controller.signal.aborted) return;
      selectedDetails = {error:"Não foi possível carregar os detalhes deste voo."};
    } finally {
      if (detailRequest === controller) {
        detailRequest = undefined;
        renderDetails();
      }
    }
  }

  async function load() {
    if (!map || !toggle.checked || document.hidden) return;
    clearTimeout(timer);
    request?.abort();
    const current = map;
    const controller = new AbortController();
    request = controller;
    refresh.disabled = true;
    status.textContent = "Consultando aeronaves da região…";
    let retryDelay = 90000;
    try {
      const center = map.getCenter();
      const query = new URLSearchParams({
        latitude:Math.max(-85,Math.min(85,center.lat)), longitude:wrap(center.lng),
      });
      const response = await fetch(window.JARVIS_API_BASE_URL + "/api/map/aircraft?" + query,
        {signal:controller.signal});
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429) retryDelay = 15000;
        throw new Error(result.error || "Consulta indisponível.");
      }
      if (request !== controller || map !== current) return;
      aircraft = result.aircraft.filter(a => /^[a-f0-9]{6}$/i.test(a.hex || "") &&
        Number.isFinite(a.lat) && Number.isFinite(a.lon) && a.alt_baro !== "ground" &&
        Number.isFinite(a.seen_pos) && a.seen_pos <= 120).map(a => ({
          type:"Feature", geometry:{type:"Point",coordinates:[a.lon,a.lat]},
          properties:{id:a.hex.toLowerCase(), callsign:(a.flight || "").trim(),
            registration:a.r || "", model:a.t || "", category:a.category || "",
            icon:icon(a.category,a.t), heading:Number.isFinite(a.track) ? a.track : 0,
            altitude:Number.isFinite(a.alt_baro) ? Math.round(a.alt_baro*0.3048)+" m" : "Indisponível",
            speed:Number.isFinite(a.gs) ? Math.round(a.gs*1.852)+" km/h" : "Indisponível",
            positionTime:result.observedAt-a.seen_pos*1000},
        }));
      if (hoverFlight && !aircraft.some(item => item.properties.id === hoverFlight.properties.id)) {
        hidePreview();
      }
      lastObservedAt = result.observedAt;
      for (const flight of aircraft) {
        const id=flight.properties.id;
        const history=(histories.get(id) || []).filter(p => Date.now()-p.time < 2*60*60*1000);
        const time=flight.properties.positionTime;
        if (!history.length || time > history.at(-1).time) {
          history.push({time, point:flight.geometry.coordinates});
        }
        histories.set(id, history.slice(-120));
      }
      while (histories.size > 2000) histories.delete(histories.keys().next().value);
      map.getSource("flights").setData({type:"FeatureCollection",features:aircraft});
      document.dispatchEvent(new CustomEvent("jarvis:entities-updated",{detail:{kind:"flight",features:aircraft}}));
      status.textContent = aircraft.length + " aeronaves · até 463 km do centro · ADSB.lol · " +
        new Date(lastObservedAt).toLocaleTimeString("pt-BR");
      if (selected && !aircraft.some(a => a.properties.id === selected)) deselect();
      else if (selected) renderDetails();
    } catch (error) {
      if (!controller.signal.aborted) {
        status.textContent = error.message + (lastObservedAt
          ? " · Última consulta: " + new Date(lastObservedAt).toLocaleTimeString("pt-BR") : "");
      }
    } finally {
      if (request === controller) {
        refresh.disabled = !toggle.checked;
        if (toggle.checked && !viewHidden()) timer=setTimeout(load,retryDelay);
      }
    }
  }

  const viewHidden = () => document.getElementById("globe-view").hidden;
  document.addEventListener("jarvis:map-ready", event => {
    map=event.detail;
    addIcons(map);
    map.addSource("flights",{type:"geojson",data:empty()});
    map.addSource("flight-route",{type:"geojson",data:empty()});
    map.addSource("flight-track",{type:"geojson",data:empty()});
    map.addLayer({id:"flight-route",type:"line",source:"flight-route",
      paint:{"line-color":"#a48abd","line-width":1.5,"line-dasharray":[3,3]}});
    map.addLayer({id:"flight-track",type:"line",source:"flight-track",
      paint:{"line-color":"#60e9f5","line-width":2.5}});
    map.addLayer({id:"flight-selection",type:"circle",source:"flights",
      filter:["==",["get","id"],""],
      paint:{"circle-radius":18,"circle-color":"#bb81ed","circle-opacity":0.25}});
    map.addLayer({id:"flights",type:"symbol",source:"flights",layout:{
      "icon-image":["concat","plane-",["get","icon"]],
      "icon-size":["match",["get","icon"],"heavy",0.53,"light",0.34,"helicopter",0.38,0.43],
      "icon-rotate":["get","heading"],"icon-rotation-alignment":"map",
      "icon-allow-overlap":true,"icon-ignore-placement":true,
    }});
    map.on("mouseenter","flights",() => {map.getCanvas().style.cursor="pointer";});
    map.on("mousemove", "flights", showPreview);
    map.on("mouseleave","flights",() => {
      map.getCanvas().style.cursor="";
      hidePreview();
    });
    map.on("movestart", hidePreview);
    map.on("click","flights",event => select(event.features[0]));
    map.on("moveend",() => {
      clearTimeout(moveTimer);
      if (toggle.checked) moveTimer=setTimeout(load,1200);
    });
    toggle.disabled=false;
    southeast.disabled=false;
    toggle.checked=true;
    load();
  });
  document.addEventListener("jarvis:map-close",() => {
    stop(); map=undefined; toggle.disabled=true; refresh.disabled=true;
    southeast.disabled=true; status.textContent=""; lastObservedAt=undefined;
  });
  toggle.addEventListener("change",() => {
    refresh.disabled=!toggle.checked;
    if (toggle.checked) load();
    else {stop(); status.textContent="";}
  });
  refresh.addEventListener("click",load);
  southeast.addEventListener("click",() => {
    toggle.checked=true;
    map.jumpTo({center:[-46.63,-23.55],zoom:6});
  });
  close.addEventListener("click",deselect);
  document.addEventListener("visibilitychange",() => {
    clearTimeout(timer);
    if (!document.hidden && map && toggle.checked) load();
  });
})();
