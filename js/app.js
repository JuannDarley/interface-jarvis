    const CONFIG = {
      address: "senhor",
      wakeWord: "ola jarvis"
    };

    const AREA = {
      metas: { label: "Metas", color: "#fbbf24" },
      trabalho: { label: "Carreira", color: "#ff5547" },
      projetos: { label: "Projetos", color: "#8b7cff" },
      financas: { label: "Finanças", color: "#f7931a" },
      aprendizado: { label: "Aprendizado", color: "#2dd4ff" },
      saude: { label: "Saúde", color: "#10b981" },
      relacoes: { label: "Relações", color: "#ec4899" },
      meta: { label: "Perfil", color: "#8a90a6" }
    };

    const INITIAL_NOTES = [
      {
        id: "perfil",
        area: "meta",
        title: "Perfil",
        body: "27 anos (nascido em 31/03/1999 em Pariquera-Açu/SP), reside no Alto Boqueirão em Curitiba/PR. Formado em Técnico em Mecatrônica pelo SENAI e acadêmico no 1º período de Ciência da Computação. Gosta de jogos com amigos, músicas, filmes de terror/ação e séries. Reservado e sociável."
      },
      {
        id: "metas_curto",
        area: "metas",
        title: "Metas Rápidas",
        body: "Curto prazo (3-6 meses): Ingressar no mercado de programação, vender o apartamento, se organizar financeiramente e aprimorar o desempenho geral."
      },
      {
        id: "metas_longo",
        area: "metas",
        title: "Rumo a Lisboa",
        body: "Longo prazo (1-3 anos): Morar em Lisboa (Portugal) com a namorada Ana, atuar profissionalmente na área de programação, empreender e desenvolver aplicativos próprios."
      },
      {
        id: "carreira",
        area: "trabalho",
        title: "Carreira Dev",
        body: "Atualmente desempregado em busca ativa e focada de oportunidades na área de programação e desenvolvimento de software."
      },
      {
        id: "proj_jarvis",
        area: "projetos",
        title: "Jarvis",
        body: "Desenvolvimento do assistente pessoal inteligente com Second Brain, integração à API da Groq (Groq) e interface de voz contínua."
      },
      {
        id: "proj_resenha",
        area: "projetos",
        title: "Resenha App",
        body: "Projeto e aplicativo voltado para o agendamento, gestão e organização de eventos e partidas esportivas."
      },
      {
        id: "financas",
        area: "financas",
        title: "Finanças",
        body: "Possui pequena reserva de auxílio financeiro; prioridade em quitar dívidas pendentes e, a longo prazo, investir para obter renda extra e liberdade criativa."
      },
      {
        id: "aprend_java",
        area: "aprendizado",
        title: "Java e Spring",
        body: "Foco no desenvolvimento avançado em Java e Spring Boot para atender às demandas de mercado e conquistar vaga sólida em tecnologia."
      },
      {
        id: "aprend_cc",
        area: "aprendizado",
        title: "Ciência da Comp",
        body: "Cursando 1º período de Ciência da Computação; meta de retomar a leitura dos livros de Arquitetura Limpa e fundamentos da computação."
      },
      {
        id: "saude",
        area: "saude",
        title: "Saúde e Rotina",
        body: "Tenta dormir 8 horas diárias; necessita aprimorar a alimentação por ficar em casa e voltar a praticar exercícios físicos regulares."
      },
      {
        id: "rel_ana",
        area: "relacoes",
        title: "Namorada Ana",
        body: "Namorada que mora em Portugal; a quem o Jarvis também prestará reverência e assistência no futuro após a mudança para Lisboa."
      },
      {
        id: "rel_familia",
        area: "relacoes",
        title: "Família",
        body: "Mora em Curitiba com o pai, a madrasta (segunda mãe) e dois irmãos; irmão mais velho reside em Itajaí/SC; mãe reside em São José dos Pinhais/PR."
      }
    ];

    const REL = [
      ["metas_curto", "carreira"],
      ["metas_curto", "financas"],
      ["metas_curto", "perfil"],
      ["metas_curto", "aprend_java"],
      ["metas_longo", "rel_ana"],
      ["metas_longo", "metas_curto"],
      ["metas_longo", "carreira"],
      ["metas_longo", "proj_resenha"],
      ["metas_longo", "proj_jarvis"],
      ["carreira", "aprend_java"],
      ["carreira", "aprend_cc"],
      ["carreira", "proj_jarvis"],
      ["carreira", "proj_resenha"],
      ["proj_jarvis", "proj_resenha"],
      ["proj_jarvis", "aprend_cc"],
      ["proj_resenha", "aprend_java"],
      ["financas", "carreira"],
      ["saude", "perfil"],
      ["rel_familia", "perfil"],
      ["rel_ana", "perfil"],
      ["aprend_cc", "aprend_java"]
    ];

    /* ==========================================================================
       ESTADO GLOBAL DA APLICAÇÃO
       ========================================================================== */
    let currentNotes = [];
    let sessionHistory = [];
    let recognition = null;
    let isSystemActive = false;
    let isBusy = false; // Flag para impedir que o assistente se ouça
    let isUserListeningToggled = false;
    let currentVoice = null;
    let synapseAnimationId = null;

    // Elementos DOM
    const screenBoot = document.getElementById("screen-boot");
    const screenActivation = document.getElementById("screen-activation");
    const btnActivateSystem = document.getElementById("btn-activate-system");
    const appContainer = document.getElementById("app-container");
    const hudStatus = document.getElementById("hud-status");
    const hudStatusText = document.getElementById("hud-status-text");
    const hudStatusIndicator = document.getElementById("hud-status-indicator");
    const reactorOrb = document.getElementById("reactor-orb");
    const speechUserText = document.getElementById("speech-user-text");
    const speechJarvisText = document.getElementById("speech-jarvis-text");
    const textCommandInput = document.getElementById("text-command-input");
    const btnToggleMic = document.getElementById("btn-toggle-mic");
    const btnStopSpeech = document.getElementById("btn-stop-speech");
    const graphContainer = document.getElementById("graph-container");
    const brainCounterBadge = document.getElementById("brain-counter-badge");
    const legendChipsContainer = document.getElementById("legend-chips-container");
    const btnAddNote = document.getElementById("btn-add-note");
    const btnResetBrain = document.getElementById("btn-reset-brain");
    const toastMsg = document.getElementById("toast-msg");
    const contextConsent = document.getElementById("context-consent");

    graphContainer.addEventListener("click", (event) => {
      const node = event.target.closest("[data-note-id]");
      if (node) window.openNoteEditor(node.dataset.noteId);
    });

    // Modal DOM
    const modalNote = document.getElementById("modal-note");
    const modalHeading = document.getElementById("modal-heading");
    const modalNoteId = document.getElementById("modal-note-id");
    const modalInputTitle = document.getElementById("modal-input-title");
    const modalSelectArea = document.getElementById("modal-select-area");
    const modalTextareaBody = document.getElementById("modal-textarea-body");
    const btnCloseModal = document.getElementById("btn-close-modal");
    const btnSaveCurrentNote = document.getElementById("btn-save-current-note");
    const btnDeleteCurrentNote = document.getElementById("btn-delete-current-note");

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
        const response = await fetch("/health");
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
      const greeting = `Sistemas online. Estou ouvindo, ${CONFIG.address}.`;
      setDialogueText(null, greeting);
      speakText(greeting, () => {
        startListening();
      });

      renderGraph();
    });

    /* ==========================================================================
       NOTAS & PERSISTÊNCIA (SECOND BRAIN)
       ========================================================================== */
    function loadNotes() {
      const stored = localStorage.getItem("jarvis_notes");
      if (stored) {
        try {
          currentNotes = JSON.parse(stored);
        } catch (e) {
          currentNotes = [...INITIAL_NOTES];
        }
      } else {
        currentNotes = [...INITIAL_NOTES];
        saveNotesToStorage();
      }
    }

    function saveNotesToStorage() {
      localStorage.setItem("jarvis_notes", JSON.stringify(currentNotes));
      updateBrainStats();
    }

    btnResetBrain.addEventListener("click", () => {
      if (confirm("Deseja restaurar as notas iniciais do Second Brain?")) {
        currentNotes = JSON.parse(JSON.stringify(INITIAL_NOTES));
        saveNotesToStorage();
        renderGraph();
        showToast("Second Brain restaurado aos valores padrão.");
      }
    });

    function updateBrainStats() {
      const totalNotes = currentNotes.length;
      const uniqueAreas = new Set(currentNotes.map(n => n.area)).size;
      brainCounterBadge.textContent = `${totalNotes} notas · ${uniqueAreas} áreas`;

      // Atualiza legenda
      legendChipsContainer.innerHTML = "";
      const presentAreas = Array.from(new Set(currentNotes.map(n => n.area)));
      presentAreas.forEach(areaKey => {
        const meta = AREA[areaKey] || { label: areaKey, color: "#8a90a6" };
        const chip = document.createElement("div");
        const dot = document.createElement("span");
        const label = document.createElement("span");
        chip.className = "legend-chip";
        dot.className = "legend-dot";
        dot.style.backgroundColor = meta.color;
        dot.style.boxShadow = `0 0 8px ${meta.color}`;
        label.textContent = meta.label;
        chip.append(dot, label);
        legendChipsContainer.appendChild(chip);
      });
    }

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

    /* ==========================================================================
       CÉREBRO — BACKEND /api/chat
       ==========================================================================
       A chave da Groq permanece exclusivamente no server.py.
       O frontend não envia Authorization nem acessa a GROQ_API_KEY.
       ========================================================================== */
    async function processUserCommand(commandText) {
      isBusy = true;
      setOrbState("thinking");
      setHudStatus("PROCESSANDO...", "#eab308");

      // Registra mensagem do usuário no histórico da sessão
      sessionHistory.push({ role: "user", content: commandText });

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            message: commandText,
            history: sessionHistory.slice(0, -1).slice(-10),
            context: contextConsent && contextConsent.checked ? buildBrainContext() : ""
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          console.error("Erro no backend /api/chat:", response.status, data);
          const errorSpeech = data.error
            ? `Aviso: ${data.error} ${CONFIG.address}.`
            : `Aviso: Falha na comunicação com o servidor do JARVIS, ${CONFIG.address}.`;
          setDialogueText(null, errorSpeech);
          speakText(errorSpeech);
          return;
        }

        const rawReply = data.response || "";

        if (!rawReply) {
          const emptySpeech = `Compreendido, ${CONFIG.address}. Nenhuma informação textual foi retornada pelo servidor.`;
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
          saveNoteFromAI(area, title, body);
          cleanReply = rawReply.replace(saveRegex, "").trim();
        }

        sessionHistory.push({ role: "assistant", content: cleanReply });

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
        const netErrSpeech = `Não foi possível estabelecer conexão com o servidor do JARVIS, ${CONFIG.address}. Verifique se o server.py está em execução.`;
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

    function buildBrainContext() {
      // Agrupa todas as notas do estado atual por área
      const grouped = {};
      currentNotes.forEach(n => {
        if (!grouped[n.area]) grouped[n.area] = [];
        grouped[n.area].push(`• [${n.title}]: ${n.body}`);
      });

      let brainKnowledge = "";
      for (const [areaKey, noteItems] of Object.entries(grouped)) {
        const areaLabel = AREA[areaKey] ? AREA[areaKey].label.toUpperCase() : areaKey.toUpperCase();
        brainKnowledge += `\n--- ÁREA: ${areaLabel} ---\n` + noteItems.join("\n");
      }

      return brainKnowledge;
    }

    /* ==========================================================================
       MEMÓRIA VIVA: GRAVAÇÃO E ATUALIZAÇÃO AUTOMÁTICA DE NOTAS
       ========================================================================== */
    function applyLivingMemory(area, title, body) {
      const validArea = AREA[area] ? area : "meta";
      const existingIndex = currentNotes.findIndex(n => normalizeStr(n.title) === normalizeStr(title));

      let targetId = "";
      if (existingIndex >= 0) {
        currentNotes[existingIndex].area = validArea;
        currentNotes[existingIndex].body = body;
        targetId = currentNotes[existingIndex].id;
        showToast(`Memória atualizada: "${title}"`);
      } else {
        targetId = "note_" + Date.now();
        currentNotes.push({
          id: targetId,
          area: validArea,
          title: title,
          body: body
        });
        showToast(`Nova memória gravada: "${title}"`);
      }

      saveNotesToStorage();
      renderGraph();
      return targetId;
    }

    /* ==========================================================================
       SECOND BRAIN — RENDERIZAÇÃO DO GRAFO NEURAL SVG
       COMPATIBILIDADE: Injeção da string <svg> via innerHTML do DIV container
       ========================================================================== */
    let synapsePulses = [];

    function renderGraph() {
      updateBrainStats();
      if (synapseAnimationId) {
        cancelAnimationFrame(synapseAnimationId);
      }

      const width = 1000;
      const height = 540;
      const centerX = width / 2;
      const centerY = height / 2;
      const radiusX = 370;
      const radiusY = 195;
      const total = currentNotes.length;

      // Mapeia posições em elipse ao redor do núcleo
      const nodePositions = {};
      const nodeDegrees = {};

      currentNotes.forEach(n => {
        nodeDegrees[n.id] = 0;
      });

      // Calcula conexões
      const activeEdges = [];
      REL.forEach(([idA, idB]) => {
        const hasA = currentNotes.some(n => n.id === idA);
        const hasB = currentNotes.some(n => n.id === idB);
        if (hasA && hasB) {
          activeEdges.push([idA, idB]);
          nodeDegrees[idA] = (nodeDegrees[idA] || 0) + 1;
          nodeDegrees[idB] = (nodeDegrees[idB] || 0) + 1;
        }
      });

      // Se houver notas sem conexões da lista predefinida, conecta suavemente ao núcleo/vizinhos
      currentNotes.forEach((note, index) => {
        const angle = (2 * Math.PI * index / Math.max(total, 1)) - (Math.PI / 2);
        const x = centerX + radiusX * Math.cos(angle);
        const y = centerY + radiusY * Math.sin(angle);
        nodePositions[note.id] = { x, y, angle };
      });

      // Monta as arestas com curvas de Bézier quadráticas puxadas 35% em direção ao centro
      let edgesSvg = "";
      const edgeCurvesData = [];

      activeEdges.forEach(([idA, idB], idx) => {
        const posA = nodePositions[idA];
        const posB = nodePositions[idB];
        if (!posA || !posB) return;

        const midX = (posA.x + posB.x) / 2;
        const midY = (posA.y + posB.y) / 2;
        // Ponto de controle puxado ~35% para o centro (500, 270)
        const ctrlX = midX + (centerX - midX) * 0.35;
        const ctrlY = midY + (centerY - midY) * 0.35;

        edgeCurvesData.push({
          p0: posA,
          pc: { x: ctrlX, y: ctrlY },
          p1: posB
        });

        edgesSvg += `
          <path class="neural-edge" 
                d="M ${posA.x.toFixed(1)} ${posA.y.toFixed(1)} Q ${ctrlX.toFixed(1)} ${ctrlY.toFixed(1)} ${posB.x.toFixed(1)} ${posB.y.toFixed(1)}" 
                stroke="url(#edgeGrad)" 
                stroke-width="1.3" 
                stroke-opacity="0.45" 
                fill="none" />
        `;
      });

      // Raios finos do núcleo até cada nó
      let coreRaysSvg = "";
      currentNotes.forEach(note => {
        const pos = nodePositions[note.id];
        if (!pos) return;
        const color = (AREA[note.area] && AREA[note.area].color) || "#a855f7";
        coreRaysSvg += `
          <line x1="${centerX}" y1="${centerY}" x2="${pos.x.toFixed(1)}" y2="${pos.y.toFixed(1)}" 
                stroke="${color}" stroke-opacity="0.18" stroke-width="1" stroke-dasharray="3,3" />
        `;
      });

      // Nós
      let nodesSvg = "";
      currentNotes.forEach(note => {
        const pos = nodePositions[note.id];
        if (!pos) return;
        const areaData = AREA[note.area] || { label: note.area, color: "#a855f7" };
        const degree = nodeDegrees[note.id] || 0;
        // Tamanho do nó cresce com o número de conexões (hubs maiores)
        const baseRadius = 15 + Math.min(degree * 2.2, 14);

        nodesSvg += `
          <g class="node-group" id="node-elm-${escapeXml(note.id)}" data-note-id="${escapeXml(note.id)}" transform="translate(0,0)">
            <!-- Anel de Respiração Exterior -->
            <circle class="breathing-ring" cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${(baseRadius + 6).toFixed(1)}" 
                    stroke="${areaData.color}" stroke-width="1.5" stroke-opacity="0.5" fill="none" />
            
            <!-- Nó Principal com Glow -->
            <circle class="node-circle" id="node-circle-${escapeXml(note.id)}" cx="${pos.x.toFixed(1)}" cy="${pos.y.toFixed(1)}" r="${baseRadius.toFixed(1)}" 
                    fill="${areaData.color}" fill-opacity="0.88" stroke="#ffffff" stroke-width="1.8" 
                    filter="url(#nodeGlow)" />
            
            <!-- Rótulo / Título Embaixo -->
            <text x="${pos.x.toFixed(1)}" y="${(pos.y + baseRadius + 14).toFixed(1)}" 
                  text-anchor="middle" fill="#f8fafc" font-family="var(--font-mono)" font-size="11" font-weight="700" letter-spacing="0.04em">
              ${escapeXml(note.title)}
            </text>
            <text x="${pos.x.toFixed(1)}" y="${(pos.y + baseRadius + 26).toFixed(1)}" 
                  text-anchor="middle" fill="${areaData.color}" font-family="var(--font-sans)" font-size="9" opacity="0.85">
              ${escapeXml(areaData.label)}
            </text>
          </g>
        `;
      });

      // SVG de Pulso de Sinapses (~12 pontos viajando pelas curvas)
      let synapsesSvg = "";
      for (let i = 0; i < 12; i++) {
        synapsesSvg += `<circle id="synapse-dot-${i}" r="3" fill="#ffffff" filter="url(#synapseGlow)" opacity="0" />`;
      }

      // String completa do SVG com namespace
      const svgFullMarkup = `
        <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <!-- Filtro de Glow dos Nós -->
            <filter id="nodeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <!-- Filtro de Glow do Núcleo -->
            <filter id="coreGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur1" />
              <feGaussianBlur stdDeviation="16" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <!-- Filtro de Glow das Sinapses -->
            <filter id="synapseGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <!-- Gradiente Roxo -> Ciano para Arestas -->
            <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#a855f7" stop-opacity="0.8" />
              <stop offset="50%" stop-color="#818cf8" stop-opacity="0.4" />
              <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.8" />
            </linearGradient>

            <!-- Gradiente do Núcleo -->
            <radialGradient id="coreGrad" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stop-color="#f5d0fe" />
              <stop offset="35%" stop-color="#c084fc" />
              <stop offset="70%" stop-color="#7e22ce" />
              <stop offset="100%" stop-color="#3b0764" />
            </radialGradient>
          </defs>

          <!-- Fundo Sutil de Grade Circular -->
          <circle cx="${centerX}" cy="${centerY}" r="140" stroke="rgba(168,85,247,0.08)" stroke-width="1" fill="none" />
          <circle cx="${centerX}" cy="${centerY}" r="260" stroke="rgba(168,85,247,0.06)" stroke-width="1" fill="none" />
          <circle cx="${centerX}" cy="${centerY}" r="380" stroke="rgba(168,85,247,0.04)" stroke-width="1" fill="none" />

          <!-- Raios do Núcleo até os Nós -->
          <g id="core-rays-layer">${coreRaysSvg}</g>

          <!-- Arestas (Teia Densa em Curvas Bézier) -->
          <g id="edges-layer">${edgesSvg}</g>

          <!-- Pontos de Sinapse Móveis -->
          <g id="synapses-layer">${synapsesSvg}</g>

          <!-- Núcleo Central Pulsante com 🧠 -->
          <g id="core-center-group">
            <!-- Anel de Respiração do Núcleo -->
            <circle class="breathing-ring" cx="${centerX}" cy="${centerY}" r="46" stroke="#c084fc" stroke-width="2" stroke-opacity="0.4" fill="none" />
            <!-- Círculo do Núcleo -->
            <circle cx="${centerX}" cy="${centerY}" r="36" fill="url(#coreGrad)" stroke="#f3e8ff" stroke-width="1.8" filter="url(#coreGlow)" />
            <!-- Ícone/Emoji no Centro -->
            <text class="brain-center-label" x="${centerX}" y="${centerY + 7}" text-anchor="middle" font-size="20">🧠</text>
          </g>

          <!-- Nós das Notas -->
          <g id="nodes-layer">${nodesSvg}</g>
        </svg>
      `;

      // REGRA CRÍTICA DE COMPATIBILIDADE: injeta na DIV contêiner
      graphContainer.innerHTML = svgFullMarkup;

      // Inicia Animação de Sinapses via requestAnimationFrame
      if (edgeCurvesData.length > 0) {
        initSynapsePulses(edgeCurvesData);
      }
    }

    function initSynapsePulses(curves) {
      synapsePulses = [];
      const numPulses = 12;

      for (let i = 0; i < numPulses; i++) {
        synapsePulses.push({
          curveIndex: Math.floor(Math.random() * curves.length),
          t: Math.random(), // Inicia em pontos diferentes
          speed: 0.0035 + Math.random() * 0.0045
        });
      }

      function stepSynapses() {
        synapsePulses.forEach((pulse, idx) => {
          pulse.t += pulse.speed;
          if (pulse.t >= 1) {
            pulse.t = 0;
            pulse.curveIndex = Math.floor(Math.random() * curves.length);
          }

          const curve = curves[pulse.curveIndex];
          if (!curve) return;

          // Fórmula de Bézier Quadrática: (1-t)²·P0 + 2(1-t)t·Pc + t²·P1
          const t = pulse.t;
          const invT = 1 - t;
          const x = (invT * invT * curve.p0.x) + (2 * invT * t * curve.pc.x) + (t * t * curve.p1.x);
          const y = (invT * invT * curve.p0.y) + (2 * invT * t * curve.pc.y) + (t * t * curve.p1.y);

          // Opacidade em sino: sin(pi * t)
          const opacity = Math.sin(Math.PI * t) * 0.95;

          const dotElm = document.getElementById(`synapse-dot-${idx}`);
          if (dotElm) {
            dotElm.setAttribute("cx", x.toFixed(1));
            dotElm.setAttribute("cy", y.toFixed(1));
            dotElm.setAttribute("opacity", opacity.toFixed(2));
          }
        });

        synapseAnimationId = requestAnimationFrame(stepSynapses);
      }

      stepSynapses();
    }

    function flashNodeInGraph(nodeId) {
      const circleElm = document.getElementById(`node-circle-${nodeId}`);
      if (circleElm) {
        circleElm.classList.remove("node-flash");
        void circleElm.offsetWidth; // Trigger reflow
        circleElm.classList.add("node-flash");
      }
    }

    function escapeXml(unsafe) {
      return (unsafe || "").replace(/[<>&'"]/g, (c) => {
        switch (c) {
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '&': return '&amp;';
          case '\'': return '&apos;';
          case '"': return '&quot;';
        }
      });
    }

    /* ==========================================================================
       MODAL DE EDIÇÃO / CRIAÇÃO DE NOTAS
       ========================================================================== */
    window.openNoteEditor = function(noteId) {
      const note = currentNotes.find(n => n.id === noteId);
      if (!note) return;

      modalHeading.textContent = "EDITAR NOTA NEURAL";
      modalNoteId.value = note.id;
      modalInputTitle.value = note.title;
      modalSelectArea.value = note.area;
      modalTextareaBody.value = note.body;
      btnDeleteCurrentNote.style.display = "inline-block";

      modalNote.classList.add("open");
    };

    btnAddNote.addEventListener("click", () => {
      modalHeading.textContent = "NOVA NOTA NEURAL";
      modalNoteId.value = "";
      modalInputTitle.value = "";
      modalSelectArea.value = "metas";
      modalTextareaBody.value = "";
      btnDeleteCurrentNote.style.display = "none";

      modalNote.classList.add("open");
    });

    btnCloseModal.addEventListener("click", () => {
      modalNote.classList.remove("open");
    });

    modalNote.addEventListener("click", (e) => {
      if (e.target === modalNote) {
        modalNote.classList.remove("open");
      }
    });

    btnSaveCurrentNote.addEventListener("click", () => {
      const id = modalNoteId.value;
      const title = modalInputTitle.value.trim();
      const area = modalSelectArea.value;
      const body = modalTextareaBody.value.trim();

      if (!title || !body) {
        showToast("Preencha o título e o conteúdo da nota.");
        return;
      }

      if (id) {
        // Atualizar nota existente
        const note = currentNotes.find(n => n.id === id);
        if (note) {
          note.title = title;
          note.area = area;
          note.body = body;
          showToast(`Nota "${title}" atualizada.`);
        }
      } else {
        // Criar nova nota
        const newId = "note_" + Date.now();
        currentNotes.push({ id: newId, title, area, body });
        showToast(`Nota "${title}" criada.`);
      }

      saveNotesToStorage();
      modalNote.classList.remove("open");
      renderGraph();
    });

    btnDeleteCurrentNote.addEventListener("click", () => {
      const id = modalNoteId.value;
      if (!id) return;

      if (confirm("Tem certeza que deseja excluir esta nota do Second Brain?")) {
        currentNotes = currentNotes.filter(n => n.id !== id);
        saveNotesToStorage();
        modalNote.classList.remove("open");
        renderGraph();
        showToast("Nota removida.");
      }
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
