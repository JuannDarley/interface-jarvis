/* Notas, persistência local, contexto opcional e visualização do Second Brain. */

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
      window.JarvisNotes?.changed();
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

/* Notas, persistência local, contexto opcional e visualização do Second Brain. */

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
    let stopSynapsePulses = () => {};

    function renderGraph() {
      stopSynapsePulses();
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
      for (let i = 0; i < (window.JarvisPerformance?.mobile ? 4 : 12); i++) {
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
      const mobile = Boolean(window.JarvisPerformance?.mobile);
      const numPulses = mobile ? 4 : 12;

      for (let i = 0; i < numPulses; i++) {
        synapsePulses.push({
          curveIndex: Math.floor(Math.random() * curves.length),
          t: Math.random(), // Inicia em pontos diferentes
          speed: 0.0035 + Math.random() * 0.0045
        });
      }

      const dots = synapsePulses.map((_pulse, index) => document.getElementById(`synapse-dot-${index}`));
      let active = !mobile;
      let lastFrame = 0;
      function stepSynapses(timestamp = performance.now()) {
        synapseAnimationId = null;
        if (!active) return;
        if (mobile && lastFrame && timestamp - lastFrame < 50) {
          synapseAnimationId = requestAnimationFrame(stepSynapses);
          return;
        }
        const advance = lastFrame ? Math.min(4, (timestamp - lastFrame) / (1000 / 60)) : 1;
        lastFrame = timestamp;
        synapsePulses.forEach((pulse, idx) => {
          pulse.t += pulse.speed * advance;
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

          const dotElm = dots[idx];
          if (dotElm) {
            dotElm.setAttribute("cx", x.toFixed(1));
            dotElm.setAttribute("cy", y.toFixed(1));
            dotElm.setAttribute("opacity", opacity.toFixed(2));
          }
        });

        synapseAnimationId = requestAnimationFrame(stepSynapses);
      }

      let disconnect = () => {};
      if (mobile) {
        disconnect = window.JarvisPerformance.observeVisibility(graphContainer, visible => {
          active = visible;
          if (active && !synapseAnimationId) {
            lastFrame = 0;
            synapseAnimationId = requestAnimationFrame(stepSynapses);
          } else if (!active && synapseAnimationId) {
            cancelAnimationFrame(synapseAnimationId);
            synapseAnimationId = null;
          }
        });
      } else stepSynapses();
      stopSynapsePulses = () => {
        active = false;
        disconnect();
        if (synapseAnimationId) cancelAnimationFrame(synapseAnimationId);
        synapseAnimationId = null;
      };
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
