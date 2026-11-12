/* Localização sob permissão explícita e consulta de temperatura atual. */
(() => {
  const temperatureNode = document.getElementById("weather-temperature");
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

  async function fetchCurrentWeather() {
    if (!coordinates) throw new Error("location-required");
    const query = new URLSearchParams({
      latitude: String(coordinates.latitude),
      longitude: String(coordinates.longitude)
    });
    const response = await fetch(`${window.JARVIS_API_BASE_URL}/api/weather/current?${query}`, {
      method: "GET",
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "weather-unavailable");

    const temperature = Number(data.temperatureC);
    const apparent = Number(data.apparentTemperatureC);
    const code = Number(data.weatherCode);
    if (!Number.isFinite(temperature)) throw new Error("weather-unavailable");

    temperatureNode.textContent = `${temperature.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}°C`;
    setStatus("LOCALIZAÇÃO AUTORIZADA", describeWeatherCode(code));
    locationButton.textContent = "ATUALIZAR CLIMA";
    return { temperature, apparent, description: describeWeatherCode(code) };
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setStatus("LOCALIZAÇÃO INDISPONÍVEL", "Este navegador não oferece geolocalização");
      return;
    }

    locationButton.disabled = true;
    locationButton.textContent = "LOCALIZANDO...";
    setStatus("AGUARDANDO PERMISSÃO", "Permita o acesso à localização no navegador");
    navigator.geolocation.getCurrentPosition(async position => {
      coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      try {
        await fetchCurrentWeather();
      } catch (error) {
        console.error("Falha ao consultar clima:", error);
        setStatus("CLIMA INDISPONÍVEL", "Não foi possível consultar a temperatura agora");
        locationButton.textContent = "TENTAR NOVAMENTE";
      } finally {
        locationButton.disabled = false;
      }
    }, error => {
      const message = error.code === 1
        ? "A localização foi negada; libere a permissão no navegador"
        : error.code === 3
          ? "A localização demorou demais; tente novamente"
          : "Não foi possível obter sua localização";
      setStatus("LOCALIZAÇÃO NÃO OBTIDA", message);
      locationButton.disabled = false;
      locationButton.textContent = "PERMITIR LOCALIZAÇÃO";
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
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
