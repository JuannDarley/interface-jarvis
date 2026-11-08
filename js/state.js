/* Estado compartilhado da aplicação e referências aos elementos da página. */
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
