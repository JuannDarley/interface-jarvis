/* Inicialização do painel, estado visual e telemetria de serviços. */

/* ==========================================================================
       INICIALIZAÇÃO & FLUXO DE TELAS (BOOT -> ATIVAÇÃO -> APP)
       ========================================================================== */
    window.addEventListener("DOMContentLoaded", () => {
      // O boot visual não depende de API, microfone ou TTS.
      // Assim, uma falha de inicialização não prende a interface no boot.
      try { loadNotes(); } catch (e) { console.error("JARVIS boot: notas:", e); }
      try { initSpeechRecognition(); } catch (e) { console.error("JARVIS boot: STT:", e); }
      updateServiceStatus();

      // Suporte a abertura direta do dashboard se ?dashboard=1
      if (new URLSearchParams(window.location.search).get("dashboard") === "1") {
        screenBoot.classList.add("hidden");
        screenActivation.classList.add("hidden");
        appContainer.classList.add("visible");
        isSystemActive = true;
        renderGraph();
      } else {
        // Transição automática: Tela 1 (Boot) para Tela 2 (Ativação) após ~2.2s
        setTimeout(() => {
          screenBoot.classList.add("hidden");
          screenActivation.classList.remove("hidden");
        }, 2200);
      }
    });

    async function updateServiceStatus() {
      try {
        const response = await fetch(`${window.JARVIS_API_BASE_URL}/health`);
        const status = await response.json();
        const groqStatus = document.getElementById("service-groq-status");
        const ttsStatus = document.getElementById("service-tts-status");
        const groqDot = document.getElementById("service-groq-dot");
        const ttsDot = document.getElementById("service-tts-dot");
        const modelLabel = document.getElementById("service-model-name");
        const sttStatus = document.getElementById("service-stt-status");
        const sttDot = document.getElementById("service-stt-dot");
        if (groqStatus) groqStatus.textContent = status.groq_configured ? "CONFIGURADO" : "SEM CHAVE";
        if (ttsStatus) ttsStatus.textContent = status.fish_configured ? "CONFIGURADO" : "SEM CHAVE";
        if (groqDot) groqDot.classList.toggle("dot-online", Boolean(status.groq_configured));
        if (ttsDot) ttsDot.classList.toggle("dot-online", Boolean(status.fish_configured));
        if (modelLabel) modelLabel.textContent = `MODELO: ${status.groq_model || "Groq"}`;
        const supportsSpeech = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
        if (sttStatus) sttStatus.textContent = supportsSpeech ? "DISPONÍVEL" : "NÃO SUPORTADO";
        if (sttDot) sttDot.classList.toggle("dot-online", supportsSpeech);
      } catch (error) {
        for (const id of ["service-groq-status", "service-tts-status", "service-stt-status"]) {
          const item = document.getElementById(id);
          if (item) item.textContent = "INDISPONÍVEL";
        }
      }
    }

    // Failsafe visual do boot: nunca deixe o usuário preso em "SINCRONIZANDO DADOS".
    setTimeout(() => {
      if (screenBoot && !screenBoot.classList.contains("hidden")) {
        screenBoot.classList.add("hidden");
        if (screenActivation) screenActivation.classList.remove("hidden");
      }
    }, 2600);

    // Clique em ► ATIVAR SISTEMA (Gesto de desbloqueio para Áudio + Mic)
    btnActivateSystem.addEventListener("click", () => {
      screenActivation.classList.add("hidden");
      appContainer.classList.add("visible");
      isSystemActive = true;

      // Saudação em voz alta e início de escuta imediata
      const greeting = `Sistemas online. Toque no microfone para falar, ${CONFIG.address}.`;
      setDialogueText(null, greeting);
      speakText(greeting);

      renderGraph();
    });

    /* ==========================================================================
       HELPERS DE INTERFACE & STATUS
       ========================================================================== */
    function setOrbState(state) {
      // state: 'idle' | 'listening' | 'thinking' | 'speaking'
      reactorOrb.className = `orb-wrapper state-${state}`;
    }

    function setHudStatus(text, color) {
      hudStatusText.textContent = text;
      hudStatusIndicator.style.background = color;
      hudStatusIndicator.style.boxShadow = `0 0 10px ${color}`;
      hudStatus.style.borderColor = color;
    }

    function setDialogueText(userMsg, jarvisMsg) {
      if (userMsg !== null && userMsg !== undefined) {
        speechUserText.textContent = userMsg ? `"${userMsg}"` : "Aguardando comando...";
        speechUserText.classList.toggle("empty", !userMsg);
      }
      if (jarvisMsg !== null && jarvisMsg !== undefined) {
        speechJarvisText.textContent = jarvisMsg;
      }
    }

    function showToast(message) {
      toastMsg.textContent = message;
      toastMsg.classList.add("show");
      setTimeout(() => {
        toastMsg.classList.remove("show");
      }, 3400);
    }
