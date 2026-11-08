(function initFaceMode() {
      // 1. Reparentar para o final do document.body conforme especificação
      const faceMode = document.getElementById("faceMode");
      if (faceMode && faceMode.parentNode !== document.body) {
        document.body.appendChild(faceMode);
      }

      // 2. Injetar botão 🛰 FACE [F] no topo do dashboard
      function injectFaceButton() {
        const hudTopbar = document.querySelector(".hud-topbar");
        if (hudTopbar && !document.getElementById("btn-face-toggle")) {
          const btn = document.createElement("button");
          btn.id = "btn-face-toggle";
          btn.className = "btn-face-trigger";
          const label = document.createElement("span");
          const shortcut = document.createElement("span");
          label.textContent = "🛰 FACE";
          shortcut.className = "btn-face-shortcut";
          shortcut.textContent = "[F]";
          btn.append(label, shortcut);
          btn.title = "Alternar para Cockpit Jarvis HUD (Atalho: tecla F)";
          btn.onclick = () => window.faceModeToggle();

          const keyArea = document.querySelector(".hud-key-area");
          if (keyArea) {
            hudTopbar.insertBefore(btn, keyArea);
          } else {
            hudTopbar.appendChild(btn);
          }
        }
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", injectFaceButton);
      } else {
        injectFaceButton();
      }

      // Elementos do Face Mode
      const faceBtnClose = document.getElementById("face-btn-close");
      const faceClock = document.getElementById("face-clock");
      const faceDate = document.getElementById("face-date");
      const faceStateLabel = document.getElementById("face-state-label");
      const faceStateHeadline = document.getElementById("faceStateHeadline");
      const faceTranscriptLine = document.getElementById("faceTranscriptLine");
      const faceOrbHero = document.getElementById("faceOrbHero");
      const faceOrbCanvas = document.getElementById("faceOrbCanvas");
      const faceFpsVal = document.getElementById("face-fps-val");
      const faceFpsBar = document.getElementById("face-fps-bar");
      const faceHeapVal = document.getElementById("face-heap-val");
      const faceNotesCount = document.getElementById("face-notes-count");
      const faceLogsConsole = document.getElementById("face-logs-console");
      const faceBrainRadar = document.getElementById("face-brain-radar");

      let isFaceOn = false;
      let clockIntervalId = null;
      let telemetryIntervalId = null;
      let rafSphereId = null;
      let fpsCount = 0;
      let lastFpsTime = performance.now();
      let currentCalculatedFps = 60;

      // 3. Função Global de Alternância
      window.faceModeToggle = function(forceState) {
        if (!faceMode) return;
        const targetState = (forceState !== undefined) ? forceState : !faceMode.classList.contains("on");

        if (targetState) {
          faceMode.classList.add("on");
          isFaceOn = true;
          startFaceEngines();
          logFaceEvent("COCKPIT HUD ATIVADO (SISTEMA TOTAL)");
        } else {
          faceMode.classList.remove("on");
          isFaceOn = false;
          stopFaceEngines();
        }
      };

      if (faceBtnClose) {
        faceBtnClose.addEventListener("click", () => window.faceModeToggle(false));
      }

      // 4. Atalhos de Teclado (F para alternar, Esc para fechar)
      window.addEventListener("keydown", (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
        if (activeTag === "input" || activeTag === "textarea") {
          return; // Ignora quando o foco estiver em campos de texto
        }

        if (e.key === "f" || e.key === "F") {
          e.preventDefault();
          window.faceModeToggle();
        } else if (e.key === "Escape" && isFaceOn) {
          e.preventDefault();
          window.faceModeToggle(false);
        }
      });

      // 5. Suporte a parâmetro ?face=1 na URL
      if (new URLSearchParams(window.location.search).get("face") === "1") {
        window.faceModeToggle(true);
      }

      // 6. Clique no Orbe do Cockpit ativa escuta
      if (faceOrbHero) {
        faceOrbHero.addEventListener("click", () => {
          if (typeof triggerManualListening === "function") {
            triggerManualListening();
          } else {
            const orb = document.getElementById("reactor-orb");
            if (orb) orb.click();
          }
        });
      }

      // 7. Relógio Digital Militar em pt-BR
      function updateFaceClock() {
        const now = new Date();
        if (faceClock) {
          const hh = String(now.getHours()).padStart(2, "0");
          const mm = String(now.getMinutes()).padStart(2, "0");
          const ss = String(now.getSeconds()).padStart(2, "0");
          faceClock.textContent = `${hh}:${mm}:${ss}`;
        }
        if (faceDate) {
          const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
          faceDate.textContent = now.toLocaleDateString('pt-BR', options);
        }
      }

      // 8. Logs do Sistema com Timestamps
      function logFaceEvent(msg) {
        if (!faceLogsConsole) return;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
        const div = document.createElement("div");
        const time = document.createElement("span");
        const message = document.createElement("span");
        div.className = "log-line";
        time.className = "log-time";
        time.textContent = `[${timeStr}]`;
        message.className = "log-text";
        message.textContent = String(msg);
        div.append(time, message);
        faceLogsConsole.appendChild(div);
        faceLogsConsole.scrollTop = faceLogsConsole.scrollHeight;

        // Limita a 25 entradas
        while (faceLogsConsole.children.length > 25) {
          faceLogsConsole.removeChild(faceLogsConsole.firstChild);
        }
      }

      // 9. Atualização de Telemetria e Vitals
      function updateFaceTelemetry() {
        // Heap
        if (faceHeapVal) {
          if (performance && performance.memory && performance.memory.usedJSHeapSize) {
            faceHeapVal.textContent = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1) + " MB";
          } else {
            faceHeapVal.textContent = "—";
          }
        }

        // Second Brain Notes Count
        if (faceNotesCount && typeof currentNotes !== "undefined" && Array.isArray(currentNotes)) {
          faceNotesCount.textContent = `${currentNotes.length} NOTAS`;
        }

        // Second Brain Radar Highlights
        if (faceBrainRadar && typeof currentNotes !== "undefined" && Array.isArray(currentNotes)) {
          faceBrainRadar.innerHTML = "";
          const highlights = currentNotes.slice(0, 3);
          highlights.forEach(n => {
            const item = document.createElement("div");
            const heading = document.createElement("div");
            const title = document.createElement("span");
            const area = document.createElement("span");
            const description = document.createElement("div");
            item.className = "radar-item";
            heading.className = "radar-title";
            title.textContent = String(n.title || "");
            area.className = "radar-area";
            area.textContent = String(n.area || "").toUpperCase();
            heading.append(title, area);
            description.className = "radar-desc";
            description.textContent = String(n.body || "");
            item.append(heading, description);
            faceBrainRadar.appendChild(item);
          });
        }
      }

      // 10. Esfera de Fibonacci em 3D no Canvas
      let ctx = null;
      let fibPoints = [];
      const numPoints = 800;
      const phi = Math.PI * (3 - Math.sqrt(5)); // Ângulo áureo
      let sphereRotX = 0;
      let sphereRotY = 0;

      function initFibonacciSphere() {
        if (!faceOrbCanvas) return;
        ctx = faceOrbCanvas.getContext("2d");
        fibPoints = [];

        for (let i = 0; i < numPoints; i++) {
          const y = 1 - (i / (numPoints - 1)) * 2;
          const radius = Math.sqrt(1 - y * y);
          const theta = phi * i;
          const x = Math.cos(theta) * radius;
          const z = Math.sin(theta) * radius;
          fibPoints.push({ x, y, z });
        }
      }

      function drawSphereFrame() {
        if (!isFaceOn || !ctx) return;

        // Medição de FPS
        fpsCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 1000) {
          currentCalculatedFps = Math.round((fpsCount * 1000) / (now - lastFpsTime));
          fpsCount = 0;
          lastFpsTime = now;
          if (faceFpsVal) faceFpsVal.textContent = `${currentCalculatedFps} FPS`;
          if (faceFpsBar) faceFpsBar.style.width = `${Math.min(100, (currentCalculatedFps / 60) * 100)}%`;
        }

        ctx.clearRect(0, 0, faceOrbCanvas.width, faceOrbCanvas.height);
        const w = faceOrbCanvas.width;
        const h = faceOrbCanvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const baseRadius = 145;

        const currentState = faceMode.getAttribute("data-s") || "idle";
        let speedY = 0.007;
        let speedX = 0.003;
        let dynamicRadius = baseRadius;

        if (currentState === "thinking") {
          speedY = 0.024;
          speedX = 0.012;
        } else if (currentState === "listening") {
          speedY = 0.014;
          dynamicRadius = baseRadius + Math.sin(now * 0.006) * 12;
        } else if (currentState === "speaking") {
          speedY = 0.010;
          dynamicRadius = baseRadius + Math.sin(now * 0.004) * 8;
        }

        sphereRotY += speedY;
        sphereRotX += speedX;

        const cosY = Math.cos(sphereRotY);
        const sinY = Math.sin(sphereRotY);
        const cosX = Math.cos(sphereRotX);
        const sinX = Math.sin(sphereRotX);

        for (let i = 0; i < numPoints; i++) {
          const pt = fibPoints[i];

          // Rotação Y
          let x1 = pt.x * cosY + pt.z * sinY;
          let y1 = pt.y;
          let z1 = -pt.x * sinY + pt.z * cosY;

          // Rotação X
          let x2 = x1;
          let y2 = y1 * cosX - z1 * sinX;
          let z2 = y1 * sinX + z1 * cosX;

          // Projeção em perspectiva
          const focal = 320;
          const scale = focal / (focal + z2 * dynamicRadius * 0.6);
          const px = cx + x2 * dynamicRadius * scale;
          const py = cy + y2 * dynamicRadius * scale;

          const depthAlpha = Math.max(0.12, (z2 + 1) / 2);

          // Paleta de partículas: gradiente violeta ciano
          if (currentState === "listening") {
            ctx.fillStyle = `rgba(34, 211, 238, ${depthAlpha.toFixed(2)})`;
          } else if (currentState === "thinking") {
            ctx.fillStyle = `rgba(250, 204, 21, ${depthAlpha.toFixed(2)})`;
          } else if (currentState === "speaking") {
            ctx.fillStyle = `rgba(244, 63, 94, ${depthAlpha.toFixed(2)})`;
          } else {
            const isCyan = i % 4 === 0;
            ctx.fillStyle = isCyan 
              ? `rgba(34, 211, 238, ${depthAlpha.toFixed(2)})` 
              : `rgba(192, 132, 252, ${(depthAlpha * 0.9).toFixed(2)})`;
          }

          const dotSize = Math.max(1, (z2 + 1) * 1.5);
          ctx.beginPath();
          ctx.arc(px, py, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }

        rafSphereId = requestAnimationFrame(drawSphereFrame);
      }

      function startFaceEngines() {
        updateFaceClock();
        updateFaceTelemetry();
        if (!clockIntervalId) clockIntervalId = setInterval(updateFaceClock, 1000);
        if (!telemetryIntervalId) telemetryIntervalId = setInterval(updateFaceTelemetry, 2000);

        initFibonacciSphere();
        if (rafSphereId) cancelAnimationFrame(rafSphereId);
        lastFpsTime = performance.now();
        fpsCount = 0;
        rafSphereId = requestAnimationFrame(drawSphereFrame);
      }

      function stopFaceEngines() {
        if (clockIntervalId) { clearInterval(clockIntervalId); clockIntervalId = null; }
        if (telemetryIntervalId) { clearInterval(telemetryIntervalId); telemetryIntervalId = null; }
        if (rafSphereId) { cancelAnimationFrame(rafSphereId); rafSphereId = null; }
      }

      // 11. Espelhamento de Estado com o Jarvis Principal
      function updateFaceStatusDisplay(state) {
        if (!faceMode) return;
        faceMode.setAttribute("data-s", state);

        const mapState = {
          idle: "ONLINE",
          listening: "OUVINDO",
          thinking: "PROCESSANDO",
          speaking: "FALANDO"
        };
        const label = mapState[state] || "ONLINE";
        if (faceStateLabel) faceStateLabel.textContent = label;
        if (faceStateHeadline) faceStateHeadline.textContent = label;

        logFaceEvent(`ESTADO NEURAL: ${label}`);
      }

      // Hook no setOrbState do app
      const origSetOrb = window.setOrbState;
      window.setOrbState = function(state) {
        if (typeof origSetOrb === "function") {
          origSetOrb(state);
        }
        updateFaceStatusDisplay(state);
      };

      // Hook no setDialogueText do app
      const origSetDiag = window.setDialogueText;
      window.setDialogueText = function(userMsg, jarvisMsg) {
        if (typeof origSetDiag === "function") {
          origSetDiag(userMsg, jarvisMsg);
        }
        if (faceTranscriptLine) {
          if (jarvisMsg) {
            faceTranscriptLine.textContent = `"${jarvisMsg}"`;
          } else if (userMsg) {
            faceTranscriptLine.textContent = `VOCÊ: "${userMsg}"`;
          }
        }
      };

      // Seed inicial de logs
      logFaceEvent("JARVIS MK-V KERNEL INICIALIZADO");
      logFaceEvent("SECOND BRAIN INTEGRADO (12 NÓS CARREGADOS)");
      logFaceEvent("SISTEMA DE VOZ: WEBSPEECH ENGINE PRONTA");
      logFaceEvent("GROQ GROQ: LINK DISPONÍVEL");
    })();
