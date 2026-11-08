/* Síntese, reconhecimento de voz, escuta manual e wake word. */

    let currentAudio = null;
    let currentAudioUrl = null;

    async function speakText(text, onComplete) {
      if (!text || !text.trim()) {
        if (onComplete) onComplete();
        return;
      }

      // A chave da Fish Audio fica no server.py, nunca no navegador.
      // O navegador chama apenas o endpoint local do nosso servidor.
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }

      isBusy = true;
      setOrbState("speaking");
      setHudStatus("FALANDO...", "#ec4899");

      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: text.trim()
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Servidor TTS HTTP ${response.status}: ${errorText}`);
        }

        const audioBlob = await response.blob();
        currentAudioUrl = URL.createObjectURL(audioBlob);
        currentAudio = new Audio(currentAudioUrl);
        currentAudio.preload = "auto";

        const finishSpeech = () => {
          if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
            currentAudioUrl = null;
          }
          currentAudio = null;
          isBusy = false;
          setOrbState("listening");
          setHudStatus("ESCUTANDO...", "#22d3ee");
          if (onComplete) onComplete();
          restartListeningSafely();
        };

        currentAudio.onended = finishSpeech;
        currentAudio.onerror = () => {
          console.error("Jarvis: erro ao reproduzir o áudio recebido do servidor.");
          finishSpeech();
        };

        await currentAudio.play();
      } catch (error) {
        console.error("Erro no servidor TTS do Jarvis:", error);
        isBusy = false;
        setOrbState("idle");
        setHudStatus("OCIOSO", "#c084fc");
        showToast(`Erro na voz do Jarvis: ${error.message}`);
        if (onComplete) onComplete();
        restartListeningSafely();
      }
    }

    function stopSpeaking() {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
      }
      isBusy = false;
      setOrbState("idle");
      setHudStatus("OCIOSO", "#c084fc");
      showToast("Fala interrompida.");
      restartListeningSafely();
    }

    if (btnStopSpeech) btnStopSpeech.addEventListener("click", stopSpeaking);

    function initSpeechRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setHudStatus("SEM SUPORTE A VOZ", "#ef4444");
        showToast("Seu navegador não possui suporte à Web Speech API. Use o campo de texto.");
        return;
      }

      recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        if (!isBusy) {
          setOrbState("listening");
          setHudStatus("ESCUTANDO...", "#22d3ee");
        }
      };

      recognition.onresult = (event) => {
        // ENQUANTO O TTS FALA OU O JARVIS PENSA, IGNORE O RECONHECIMENTO
        if (isBusy) return;

        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript.trim();
        if (!transcript) return;

        handleIncomingVoice(transcript);
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setHudStatus("MIC BLOQUEADO", "#ef4444");
          showToast("Permissão de microfone negada. Habilite no navegador.");
        }
      };

      recognition.onend = () => {
        // Reinicie no onend, mas SÓ quando não estiver ocupado
        if (!isBusy && isSystemActive) {
          restartListeningSafely();
        }
      };
    }

    function startListening() {
      if (!recognition) return;
      try {
        recognition.start();
      } catch (e) {
        // Ignora caso já esteja rodando ("already started")
      }
    }

    function restartListeningSafely() {
      if (!recognition || !isSystemActive || isBusy) return;
      try {
        recognition.start();
      } catch (e) {
        // Já iniciado
      }
    }

    // Clique no Orbe ou no botão de Microfone alterna a escuta manual
    reactorOrb.addEventListener("click", () => {
      triggerManualListening();
    });

    btnToggleMic.addEventListener("click", () => {
      triggerManualListening();
    });

    function triggerManualListening() {
      if (isBusy) {
        stopSpeaking();
        return;
      }
      isUserListeningToggled = true;
      setOrbState("listening");
      setHudStatus("ESCUTANDO...", "#22d3ee");
      startListening();
      showToast("Escuta ativa. Fale agora...");
    }

    /* ==========================================================================
       TRATAMENTO DE ENTRADA DE VOZ (WAKE WORD & COMANDOS)
       ========================================================================== */
    function normalizeStr(text) {
      return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }

    function handleIncomingVoice(rawTranscript) {
      const normalized = normalizeStr(rawTranscript);
      const wake = CONFIG.wakeWord; // "ola jarvis"

      // Atualiza visualmente o que o usuário disse
      speechUserText.textContent = `"${rawTranscript}"`;
      speechUserText.classList.remove("empty");

      // Verifica Wake Word ou se o usuário acionou o microfone manualmente
      const hasWakeWord = normalized.includes(wake) || normalized.includes("jarvis");

      if (hasWakeWord) {
        // Extrai o comando se a frase contiver a wake word seguida do pedido
        let command = rawTranscript;
        const regexWake = new RegExp(`(olá jarvis|ola jarvis|ei jarvis|jarvis)`, 'gi');
        command = command.replace(regexWake, '').replace(/^[,.\s]+/, '').trim();

        if (command.length > 2) {
          processUserCommand(command);
        } else {
          // Apenas chamou a wake word
          const ack = `Às suas ordens, ${CONFIG.address}. Em que posso servi-lo?`;
          setDialogueText(null, ack);
          speakText(ack);
        }
      } else if (isUserListeningToggled) {
        // Se ativado manualmente pelo clique, consome o comando direto
        isUserListeningToggled = false;
        processUserCommand(rawTranscript);
      }
    }

    // Entrada via campo de texto
    textCommandInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const command = textCommandInput.value.trim();
        if (!command) return;
        textCommandInput.value = "";
        speechUserText.textContent = `"${command}"`;
        speechUserText.classList.remove("empty");
        processUserCommand(command);
      }
    });
