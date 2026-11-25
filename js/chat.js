/* Entrada de texto, chamadas à API de conversa e histórico da sessão. */

/* ==========================================================================
       CÉREBRO — BACKEND /api/chat
       ==========================================================================
       A chave da Groq permanece exclusivamente no backend Java.
       O frontend não envia Authorization nem acessa a GROQ_API_KEY.
       ========================================================================== */
    async function processUserCommand(commandText) {
      isBusy = true;
      setOrbState("thinking");
      setHudStatus("PROCESSANDO...", "#eab308");

      // Registra mensagem do usuário no histórico da sessão
      sessionHistory.push({ role: "user", content: commandText });

      try {
        const weatherReply = window.JarvisWeather
          ? await window.JarvisWeather.answerIfRequested(commandText)
          : null;
        if (weatherReply) {
          sessionHistory.push({ role: "assistant", content: weatherReply });
          window.JarvisAccount?.recordTurn(commandText, weatherReply);
          setDialogueText(null, weatherReply);
          setHudStatus("ONLINE", "#10b981");
          setOrbState("speaking");
          speakText(weatherReply, () => {
            if (isSystemActive) {
              setOrbState("idle");
              setHudStatus("OCIOSO", "#c084fc");
            }
          });
          return;
        }

        const memoryGeneration=window.JarvisMemory.version();
        const response = await fetch(`${window.JARVIS_API_BASE_URL}/api/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...window.JarvisMemory?.headers()
          },
          body: JSON.stringify({
            message: commandText,
            history: sessionHistory.slice(0, -1).slice(-10),
            ...(await window.JarvisMemory.payload())
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          console.error("Erro no backend /api/chat:", response.status);
          const errorSpeech = data.error
            ? `Aviso: ${data.error} ${CONFIG.address}.`
            : `Aviso: Falha na comunicação com o servidor do JARVIS, ${CONFIG.address}.`;
          window.JarvisAccount?.recordTurn(commandText, errorSpeech);
          setDialogueText(null, errorSpeech);
          speakText(errorSpeech);
          return;
        }

        window.JarvisMemory?.used(data.sources);
        const rawReply = data.response || "";

        if (!rawReply) {
          const emptySpeech = `Compreendido, ${CONFIG.address}. Nenhuma informação textual foi retornada pelo servidor.`;
          window.JarvisAccount?.recordTurn(commandText, emptySpeech);
          setDialogueText(null, emptySpeech);
          speakText(emptySpeech);
          return;
        }

        // PROTOCOLO DE MEMÓRIA VIVA: detecta [[SAVE:area|titulo|texto]]
        const saveRegex = /\[\[SAVE:([a-z_]+)\|([^|]+)\|([\s\S]+?)\]\]/;
        const saveMatch = rawReply.match(saveRegex);

        let cleanReply = rawReply;

        if (saveMatch) {
          const [, area, title, body] = saveMatch;
          window.JarvisMemory?.suggest(area, title, body);
          cleanReply = rawReply.replace(saveRegex, "").trim();
        }

        if(memoryGeneration===window.JarvisMemory.version())sessionHistory.push({ role: "assistant", content: cleanReply });
        window.JarvisAccount?.recordTurn(commandText, cleanReply);

        setDialogueText(null, cleanReply);
        setHudStatus("ONLINE", "#10b981");
        setOrbState("speaking");

        speakText(cleanReply, () => {
          if (isSystemActive) {
            setOrbState("idle");
            setHudStatus("OCIOSO", "#c084fc");
          }
        });

      } catch (err) {
        console.error("Falha de rede ao comunicar com /api/chat:", err);
        const netErrSpeech = `Não foi possível estabelecer conexão com o servidor do JARVIS, ${CONFIG.address}. Verifique se o backend Java está em execução.`;
        window.JarvisAccount?.recordTurn(commandText, netErrSpeech);
        setDialogueText(null, netErrSpeech);
        speakText(netErrSpeech);
      } finally {
        isBusy = false;
        if (!speechJarvisText.textContent) {
          setOrbState("idle");
          setHudStatus("OCIOSO", "#c084fc");
        }
      }
    }
