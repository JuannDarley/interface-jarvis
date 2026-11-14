/* Localização sob permissão explícita e consulta de temperatura atual. */
(() => {
  const temperatureNode = document.getElementById("weather-temperature");
  const cityNode = document.getElementById("weather-city");
  const descriptionNode = document.getElementById("weather-description");
  const statusNode = document.getElementById("weather-status");
  const locationButton = document.getElementById("weather-location-button");
  let coordinates = null;

  function setStatus(status, description) {
    statusNode.textContent = status;
    if (description) descriptionNode.textContent = description;
  }

  function describeWeatherCode(code) {
    if (code === 0) return "Céu limpo";
    if ([1, 2].includes(code)) return "Parcialmente nublado";
    if (code === 3) return "Nublado";
    if ([45, 48].includes(code)) return "Neblina";
    if ([51, 53, 55, 56, 57].includes(code)) return "Garoa";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Chuva";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "Neve";
    if ([95, 96, 99].includes(code)) return "Trovoadas";
    return "Condição atual";
  }

  async function fetchCity(location) {
    const query = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      localityLanguage: "pt"
    });
    let city = "Cidade indisponível";
    try {
      const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`, {
        signal: AbortSignal.timeout(5000),
        credentials: "omit"
      });
      if (!response.ok) throw new Error("city-unavailable");
      const data = await response.json();
      const administrative = Array.isArray(data.localityInfo?.administrative)
        ? data.localityInfo.administrative : [];
      const municipality = administrative.find(place => place.adminLevel === 8);
      const name = [municipality?.name, data.city, data.locality]
        .find(value => typeof value === "string" && value.trim());
      if (name) city = name.trim();
    } catch (_) {
      // A falha na identificação da cidade não impede a consulta da temperatura.
    }
    if (coordinates !== location) return;
    cityNode.textContent = city;
    cityNode.hidden = false;
  }

  async function fetchCurrentWeather() {
    if (!coordinates) throw new Error("location-required");
    const location = coordinates;
    const query = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude)
    });
    const response = await fetch(`${window.JARVIS_API_BASE_URL}/api/weather/current?${query}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(12000)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "weather-unavailable");

    const temperature = Number(data.temperatureC);
    const apparent = Number(data.apparentTemperatureC);
    const code = Number(data.weatherCode);
    if (!Number.isFinite(temperature)) throw new Error("weather-unavailable");

    if (coordinates === location) {
      temperatureNode.textContent = `${temperature.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}°C`;
      setStatus("LOCALIZAÇÃO AUTORIZADA", describeWeatherCode(code));
      locationButton.textContent = "ATUALIZAR CLIMA";
    }
    return { temperature, apparent, description: describeWeatherCode(code) };
  }

  async function getCoordinates() {
    let timeout;
    try {
      return await new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject({ code: 3 }), 32000);
        if (window.JarvisDesktop?.getCurrentPosition) {
          window.JarvisDesktop.getCurrentPosition().then(result => {
            if (result.error) reject(result.error);
            else resolve(result);
          }, () => reject({ code: 2 }));
        } else {
          navigator.geolocation.getCurrentPosition(resolve, reject,
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
        }
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function requestLocation() {
    if (!window.JarvisDesktop?.getCurrentPosition && !navigator.geolocation) {
      setStatus("LOCALIZAÇÃO INDISPONÍVEL", "Este navegador não oferece geolocalização");
      return;
    }

    coordinates = null;
    cityNode.textContent = "";
    cityNode.hidden = true;
    temperatureNode.textContent = "--°C";
    locationButton.disabled = true;
    locationButton.textContent = "LOCALIZANDO...";
    setStatus("OBTENDO LOCALIZAÇÃO", window.JarvisDesktop
      ? "Autorize JARVIS Localização nos Serviços de Localização do macOS"
      : "Permita o acesso à localização no navegador");
    try {
      const position = await getCoordinates();
      coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      setStatus("CONSULTANDO CLIMA", "Buscando a cidade e a temperatura...");
      locationButton.textContent = "CONSULTANDO...";
      await Promise.all([fetchCurrentWeather(), fetchCity(coordinates)]);
    } catch (error) {
      if (error.code !== undefined) {
        const message = error.message || (error.code === 1
          ? "A localização foi negada; libere a permissão de localização"
          : error.code === 3
            ? "A localização demorou demais; verifique os Serviços de Localização e tente novamente"
            : "Não foi possível obter sua localização");
        setStatus("LOCALIZAÇÃO NÃO OBTIDA", message);
      } else {
        console.error("Falha ao consultar clima:", error);
        setStatus("CLIMA INDISPONÍVEL", "Não foi possível consultar a temperatura agora");
      }
      locationButton.textContent = "TENTAR NOVAMENTE";
    } finally {
      locationButton.disabled = false;
    }
  }

  locationButton.addEventListener("click", requestLocation);

  window.JarvisWeather = {
    async answerIfRequested(message) {
      const normalized = String(message || "")
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const asksWeather = /\b(grau|graus|temperatura|clima)\b/.test(normalized)
        || /\btempo\b/.test(normalized) && /\b(agora|hoje|temperatura|fazendo)\b/.test(normalized);
      if (!asksWeather) return null;
      if (!coordinates) {
        return "Para consultar o clima da sua localização, primeiro autorize o acesso no cartão Clima da tela.";
      }

      try {
        const weather = await fetchCurrentWeather();
        const degrees = Math.round(weather.temperature);
        const feelsLike = Number.isFinite(weather.apparent) ? Math.round(weather.apparent) : degrees;
        return `Na sua localização, agora está ${degrees} graus Celsius, com ${weather.description.toLocaleLowerCase("pt-BR")}. A sensação térmica é de ${feelsLike} graus.`;
      } catch (error) {
        console.error("Falha ao responder consulta de clima:", error);
        return "Não consegui consultar o clima agora. Verifique sua conexão e tente novamente.";
      }
    }
  };
})();
