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

    const INITIAL_NOTES = [];

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
