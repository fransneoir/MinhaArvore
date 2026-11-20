/**
 * ============================================================================
 * RAÍZES & LAÇOS — MOTOR DE ÁRVORE GENEALÓGICA INTERATIVA
 * ============================================================================
 */

const STORAGE_KEY = 'raizes_lacos_tree_v1';
const WORLD_CENTER_X = 2000;
const WORLD_CENTER_Y = 2000;
const CARD_WIDTH = 220;
const CARD_HEIGHT = 148;
const GEN_VERTICAL_GAP = 250;
const SIBLING_HORIZONTAL_GAP = 270;
const SPOUSE_HORIZONTAL_GAP = 245;

// Avatares SVG embutidos em Data URI (sem dependências externas quebráveis)
function createIllustratedAvatar(bgColor, hairColor, skinColor, style = 'woman') {
  const hairPath = style === 'woman'
    ? `<path d="M24 52c0-20 12-32 26-32s26 12 26 32v18H24V52z" fill="${hairColor}"/>`
    : style === 'elder'
    ? `<path d="M26 44c0-15 10-24 24-24s24 9 24 24c0 4-2 6-4 6H30c-2 0-4-2-4-6z" fill="${hairColor}"/>`
    : `<path d="M26 42c0-14 10-23 24-23s24 9 24 23c0 3-1 5-3 5H29c-2 0-3-2-3-5z" fill="${hairColor}"/>`;

  const glasses = style === 'elder'
    ? `<circle cx="42" cy="48" r="5" fill="none" stroke="#444" stroke-width="1.5"/><circle cx="58" cy="48" r="5" fill="none" stroke="#444" stroke-width="1.5"/><line x1="47" y1="48" x2="53" y2="48" stroke="#444" stroke-width="1.5"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${bgColor}"/>
    ${hairPath}
    <path d="M22 96c2-18 14-26 28-26s26 8 28 26" fill="#4c8062"/>
    <circle cx="50" cy="48" r="17" fill="${skinColor}"/>
    <circle cx="43" cy="47" r="2" fill="#2d2a26"/>
    <circle cx="57" cy="47" r="2" fill="#2d2a26"/>
    <path d="M45 55q5 4 10 0" fill="none" stroke="#8c4a3c" stroke-width="2" stroke-linecap="round"/>
    ${glasses}
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const PRESET_AVATARS = [
  { label: 'Mulher 1', url: createIllustratedAvatar('#dce8df', '#3b281e', '#f2c6a0', 'woman') },
  { label: 'Homem 1', url: createIllustratedAvatar('#e6dfd5', '#2c221e', '#eab88f', 'man') },
  { label: 'Mulher 2', url: createIllustratedAvatar('#f0e2d6', '#6e3b24', '#d99b6c', 'woman') },
  { label: 'Homem 2', url: createIllustratedAvatar('#d8e4e8', '#1f1d1c', '#8d5524', 'man') },
  { label: 'Senhora', url: createIllustratedAvatar('#eae3d5', '#d6d3d1', '#f0c4a0', 'elder') },
  { label: 'Senhor', url: createIllustratedAvatar('#dfe6dc', '#e5e7eb', '#e0ac82', 'elder') },
];

// Estado Principal da Aplicação
let appState = {
  visualStyle: 'organic', // 'organic' | 'classic'
  rootId: 'person_center',
  people: {},
  positions: {}
};

// Estado de Pan & Zoom
let viewTransform = {
  x: 0,
  y: 0,
  scale: 1
};

let isPanning = false;
let panStart = { x: 0, y: 0 };
let editingPersonId = null;
let pendingRelationContext = null;
let modalRelationMode = 'new'; // 'new' | 'existing'
let selectedExistingPersonId = null;
let toastTimer = null;

// ============================================================================
// UTILITÁRIOS DE SEGURANÇA E INTERFACE
// ============================================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message) {
  const toastEl = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  if (!toastEl || !msgEl) return;

  msgEl.textContent = message;
  toastEl.classList.remove('opacity-0', '-translate-y-2');
  toastEl.classList.add('opacity-100', 'translate-y-0');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('opacity-100', 'translate-y-0');
    toastEl.classList.add('opacity-0', '-translate-y-2');
  }, 2800);
}

// ============================================================================
// CONTROLE DE ESTILO VISUAL (ORGÂNICO VS CLÁSSICO) E TEMA
// ============================================================================
function setVisualStyle(style, shouldRender = true) {
  appState.visualStyle = style === 'classic' ? 'classic' : 'organic';

  const btnOrganic = document.getElementById('btn-style-organic');
  const btnClassic = document.getElementById('btn-style-classic');

  const activeClasses = ['bg-folha-700', 'text-white', 'shadow-sm'];
  const inactiveClasses = ['text-stone-600', 'dark:text-stone-300', 'hover:text-stone-900'];

  if (btnOrganic && btnClassic) {
    if (appState.visualStyle === 'organic') {
      btnOrganic.classList.add(...activeClasses);
      btnOrganic.classList.remove(...inactiveClasses);
      btnClassic.classList.remove(...activeClasses);
      btnClassic.classList.add(...inactiveClasses);
    } else {
      btnClassic.classList.add(...activeClasses);
      btnClassic.classList.remove(...inactiveClasses);
      btnOrganic.classList.remove(...activeClasses);
      btnOrganic.classList.add(...inactiveClasses);
    }
  }

  if (shouldRender) {
    saveToStorage();
    renderTree();
  }
}

function toggleDarkMode() {
  const htmlEl = document.documentElement;
  const isDark = htmlEl.classList.toggle('dark');
  const moonIcon = document.getElementById('icon-moon');
  const sunIcon = document.getElementById('icon-sun');

  if (moonIcon && sunIcon) {
    if (isDark) {
      moonIcon.classList.add('hidden');
      sunIcon.classList.remove('hidden');
    } else {
      moonIcon.classList.remove('hidden');
      sunIcon.classList.add('hidden');
    }
  }
  renderTree();
}

// ============================================================================
// INICIALIZAÇÃO E PERSISTÊNCIA
// ============================================================================
function initApp() {
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.body.classList.add('touch-device');
  }

  renderAvatarPresets();

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.people && Object.keys(parsed.people).length > 0) {
        appState = parsed;
      } else {
        createInitialCenterPerson();
      }
    } catch (e) {
      createInitialCenterPerson();
    }
  } else {
    createInitialCenterPerson();
  }

  setVisualStyle(appState.visualStyle || 'organic', false);
  renderTree();
  centerTree(false);
  setupPanAndZoom();
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.warn('Não foi possível salvar no localStorage:', e);
  }
}

function createInitialCenterPerson() {
  const centerId = 'person_center';
  appState = {
    visualStyle: appState.visualStyle || 'organic',
    rootId: centerId,
    people: {
      [centerId]: {
        id: centerId,
        name: 'Você (Pessoa Principal)',
        role: 'Raiz Central',
        gender: '',
        birth: '1995',
        death: '',
        notes: 'Clique em "Editar" para personalizar sua foto e história, ou use os botões "+" ao redor para adicionar seus familiares.',
        photo: PRESET_AVATARS[0].url,
        accent: 'folha',
        generation: 0,
        parents: [],
        spouses: [],
        children: [],
        siblings: []
      }
    },
    positions: {}
  };
  saveToStorage();
}

function openResetConfirm() {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-title').textContent = 'Começar do Zero?';
  document.getElementById('confirm-message').textContent = 'Isso removerá todos os familiares atuais e deixará apenas o quadro central para você iniciar uma nova árvore.';

  const actionBtn = document.getElementById('confirm-action-btn');
  actionBtn.onclick = () => {
    createInitialCenterPerson();
    renderTree();
    centerTree(true);
    closeConfirmModal();
    showToast('Nova árvore iniciada!');
  };

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

// ============================================================================
// EXPORTAR E IMPORTAR JSON
// ============================================================================
function exportJSON() {
  try {
    const dataStr = JSON.stringify(appState, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arvore_genealogica_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Arquivo JSON exportado!');
  } catch (err) {
    showToast('Erro ao exportar arquivo.');
  }
}

function importJSON(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed && parsed.people && Object.keys(parsed.people).length > 0) {
        appState = parsed;
        if (!appState.rootId || !appState.people[appState.rootId]) {
          appState.rootId = Object.keys(appState.people)[0];
        }
        setVisualStyle(appState.visualStyle || 'organic', false);
        saveToStorage();
        renderTree();
        centerTree(true);
        showToast('Árvore importada com sucesso!');
      } else {
        showToast('Arquivo JSON inválido ou vazio.');
      }
    } catch (err) {
      showToast('Não foi possível ler o arquivo JSON.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ============================================================================
// EXEMPLO DE FAMÍLIA COM VÁRIAS GERAÇÕES
// ============================================================================
function loadSampleFamily() {
  appState.rootId = 'p_ana';
  appState.people = {
    'p_avo_m': {
      id: 'p_avo_m',
      name: 'Antônio Almeida',
      role: 'Avô Materno',
      gender: '',
      birth: '1940',
      death: '2018',
      notes: 'Fundador da fazenda da família em Minas Gerais.',
      photo: PRESET_AVATARS[5].url,
      accent: 'madeira',
      generation: -2,
      parents: [],
      spouses: ['p_avo_f'],
      children: ['p_mae'],
      siblings: []
    },
    'p_avo_f': {
      id: 'p_avo_f',
      name: 'Helena Almeida',
      role: 'Avó Materna',
      gender: '',
      birth: '1943',
      death: '',
      notes: 'Professora aposentada e guardiã das receitas de família.',
      photo: PRESET_AVATARS[4].url,
      accent: 'dourado',
      generation: -2,
      parents: [],
      spouses: ['p_avo_m'],
      children: ['p_mae'],
      siblings: []
    },
    'p_pai': {
      id: 'p_pai',
      name: 'Roberto Silva',
      role: 'Pai',
      gender: '',
      birth: '1968',
      death: '',
      notes: 'Engenheiro civil e amante de música brasileira.',
      photo: PRESET_AVATARS[3].url,
      accent: 'celeste',
      generation: -1,
      parents: [],
      spouses: ['p_mae'],
      children: ['p_ana', 'p_irmao'],
      siblings: []
    },
    'p_mae': {
      id: 'p_mae',
      name: 'Clara Almeida Silva',
      role: 'Mãe',
      gender: '',
      birth: '1970',
      death: '',
      notes: 'Botânica e apaixonada por trilhas ecológicas.',
      photo: PRESET_AVATARS[2].url,
      accent: 'folha',
      generation: -1,
      parents: ['p_avo_m', 'p_avo_f'],
      spouses: ['p_pai'],
      children: ['p_ana', 'p_irmao'],
      siblings: []
    },
    'p_irmao': {
      id: 'p_irmao',
      name: 'Lucas Silva',
      role: 'Irmão',
      gender: '',
      birth: '1998',
      death: '',
      notes: 'Arquiteto e fotógrafo nas horas vagas.',
      photo: PRESET_AVATARS[1].url,
      accent: 'celeste',
      generation: 0,
      parents: ['p_pai', 'p_mae'],
      spouses: [],
      children: [],
      siblings: ['p_ana']
    },
    'p_ana': {
      id: 'p_ana',
      name: 'Ana Beatriz Silva',
      role: 'Você (Pessoa Principal)',
      gender: '',
      birth: '1994',
      death: '',
      notes: 'Organizando as memórias e histórias da nossa família.',
      photo: PRESET_AVATARS[0].url,
      accent: 'folha',
      generation: 0,
      parents: ['p_pai', 'p_mae'],
      spouses: ['p_conjuge'],
      children: ['p_filha', 'p_filho'],
      siblings: ['p_irmao']
    },
    'p_conjuge': {
      id: 'p_conjuge',
      name: 'Rafael Mendes',
      role: 'Cônjuge',
      gender: '',
      birth: '1993',
      death: '',
      notes: 'Chef de cozinha e companheiro de viagens.',
      photo: PRESET_AVATARS[1].url,
      accent: 'madeira',
      generation: 0,
      parents: [],
      spouses: ['p_ana'],
      children: ['p_filha', 'p_filho'],
      siblings: []
    },
    'p_filha': {
      id: 'p_filha',
      name: 'Sofia Mendes Silva',
      role: 'Filha',
      gender: '',
      birth: '2021',
      death: '',
      notes: 'Adora pintar e ouvir histórias antes de dormir.',
      photo: PRESET_AVATARS[2].url,
      accent: 'rosa',
      generation: 1,
      parents: ['p_ana', 'p_conjuge'],
      spouses: [],
      children: [],
      siblings: ['p_filho']
    },
    'p_filho': {
      id: 'p_filho',
      name: 'Gabriel Mendes Silva',
      role: 'Filho',
      gender: '',
      birth: '2024',
      death: '',
      notes: 'O caçula cheio de energia da família.',
      photo: PRESET_AVATARS[3].url,
      accent: 'dourado',
      generation: 1,
      parents: ['p_ana', 'p_conjuge'],
      spouses: [],
      children: [],
      siblings: ['p_filha']
    }
  };

  saveToStorage();
  renderTree();
  centerTree(true);
  showToast('Família de exemplo carregada com 4 gerações!');
}

// ============================================================================
// ALGORITMO DE POSICIONAMENTO (LAYOUT POR GERAÇÕES E NÚCLEOS FAMILIARES)
// ============================================================================
function computeTreeLayout() {
  const peopleList = Object.values(appState.people);
  if (peopleList.length === 0) return;

  const generationsMap = {};
  peopleList.forEach(p => {
    const gen = typeof p.generation === 'number' ? p.generation : 0;
    if (!generationsMap[gen]) generationsMap[gen] = [];
    generationsMap[gen].push(p);
  });

  const sortedGens = Object.keys(generationsMap).map(Number).sort((a, b) => a - b);
  const positions = {};

  const rootPerson = appState.people[appState.rootId] || peopleList[0];
  const rootGen = rootPerson.generation || 0;

  sortedGens.forEach(gen => {
    const genPeople = generationsMap[gen];
    const y = WORLD_CENTER_Y + (gen - rootGen) * GEN_VERTICAL_GAP;

    const visited = new Set();
    const units = [];

    genPeople.sort((a, b) => {
      if (a.id === appState.rootId) return -1;
      if (b.id === appState.rootId) return 1;
      return 0;
    });

    genPeople.forEach(person => {
      if (visited.has(person.id)) return;
      visited.add(person.id);

      const unit = [person];
      (person.spouses || []).forEach(spouseId => {
        const spouse = appState.people[spouseId];
        if (spouse && !visited.has(spouse.id) && (spouse.generation || 0) === gen) {
          visited.add(spouse.id);
          unit.push(spouse);
        }
      });

      units.push(unit);
    });

    let totalRowWidth = 0;
    const unitWidths = units.map(unit => {
      const w = unit.length * CARD_WIDTH + (unit.length - 1) * (SPOUSE_HORIZONTAL_GAP - CARD_WIDTH);
      totalRowWidth += w;
      return w;
    });
    totalRowWidth += Math.max(0, units.length - 1) * (SIBLING_HORIZONTAL_GAP - CARD_WIDTH);

    let currentX = WORLD_CENTER_X - totalRowWidth / 2;

    let rootOffset = 0;
    let tempX = currentX;
    units.forEach((unit, idx) => {
      unit.forEach((member, mIdx) => {
        const memberCenterX = tempX + mIdx * SPOUSE_HORIZONTAL_GAP + CARD_WIDTH / 2;
        if (member.id === appState.rootId) {
          rootOffset = WORLD_CENTER_X - memberCenterX;
        }
      });
      tempX += unitWidths[idx] + (SIBLING_HORIZONTAL_GAP - CARD_WIDTH);
    });

    currentX += rootOffset;

    units.forEach((unit, idx) => {
      unit.forEach((member, mIdx) => {
        positions[member.id] = {
          x: currentX + mIdx * SPOUSE_HORIZONTAL_GAP,
          y: y
        };
      });
      currentX += unitWidths[idx] + (SIBLING_HORIZONTAL_GAP - CARD_WIDTH);
    });
  });

  appState.positions = positions;
}

// ============================================================================
// RENDERIZAÇÃO VISUAL (TRONCO, GALHOS ORGÂNICOS, FOLHAS E CARTÕES)
// ============================================================================
function renderTree() {
  computeTreeLayout();

  const backdropLayer = document.getElementById('organic-backdrop-layer');
  const connectionsLayer = document.getElementById('connections-layer');
  const leavesLayer = document.getElementById('leaves-layer');
  const cardsLayer = document.getElementById('cards-layer');

  backdropLayer.innerHTML = '';
  connectionsLayer.innerHTML = '';
  leavesLayer.innerHTML = '';
  cardsLayer.innerHTML = '';

  const isOrganic = appState.visualStyle === 'organic';
  const isDark = document.documentElement.classList.contains('dark');
  const positions = appState.positions;
  const people = Object.values(appState.people);

  if (people.length === 0) return;

  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;

  Object.values(positions).forEach(pos => {
    if (pos.y < minY) minY = pos.y;
    if (pos.y > maxY) maxY = pos.y;
    if (pos.x < minX) minX = pos.x;
    if (pos.x > maxX) maxX = pos.x;
  });

  const trunkCenterX = WORLD_CENTER_X;
  const trunkBaseY = maxY + CARD_HEIGHT + 130;
  const trunkTopY = minY - 60;

  if (isOrganic) {
    const canopyRadiusX = Math.max(480, (maxX - minX) * 0.75 + 260);
    const canopyRadiusY = Math.max(380, (maxY - minY) * 0.7 + 260);
    const canopyCenterY = (minY + maxY + CARD_HEIGHT) / 2;

    const canopyEl = createSvgElement('ellipse', {
      cx: trunkCenterX,
      cy: canopyCenterY,
      rx: canopyRadiusX,
      ry: canopyRadiusY,
      fill: 'url(#canopyGlow)'
    });
    backdropLayer.appendChild(canopyEl);

    const trunkPathData = `
      M ${trunkCenterX - 95} ${trunkBaseY + 35}
      Q ${trunkCenterX - 36} ${trunkBaseY - 25}, ${trunkCenterX - 24} ${trunkBaseY - 120}
      L ${trunkCenterX - 10} ${trunkTopY + 80}
      Q ${trunkCenterX} ${trunkTopY + 50}, ${trunkCenterX + 10} ${trunkTopY + 80}
      L ${trunkCenterX + 24} ${trunkBaseY - 120}
      Q ${trunkCenterX + 36} ${trunkBaseY - 25}, ${trunkCenterX + 95} ${trunkBaseY + 35}
      Q ${trunkCenterX + 30} ${trunkBaseY + 12}, ${trunkCenterX} ${trunkBaseY + 22}
      Q ${trunkCenterX - 30} ${trunkBaseY + 12}, ${trunkCenterX - 95} ${trunkBaseY + 35}
      Z
    `;

    const trunkEl = createSvgElement('path', {
      d: trunkPathData,
      fill: isDark ? 'url(#woodGradientDark)' : 'url(#woodGradient)',
      opacity: isDark ? '0.32' : '0.24'
    });
    backdropLayer.appendChild(trunkEl);

    const barkLine1 = createSvgElement('path', {
      d: `M ${trunkCenterX - 6} ${trunkBaseY} Q ${trunkCenterX - 12} ${(trunkBaseY + trunkTopY) / 2}, ${trunkCenterX - 3} ${trunkTopY + 100}`,
      fill: 'none',
      stroke: isDark ? '#8c6239' : '#5c3a21',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      opacity: '0.22'
    });
    const barkLine2 = createSvgElement('path', {
      d: `M ${trunkCenterX + 8} ${trunkBaseY - 10} Q ${trunkCenterX + 14} ${(trunkBaseY + trunkTopY) / 2 + 40}, ${trunkCenterX + 4} ${trunkTopY + 130}`,
      fill: 'none',
      stroke: isDark ? '#8c6239' : '#5c3a21',
      'stroke-width': '1.5',
      'stroke-linecap': 'round',
      opacity: '0.18'
    });
    backdropLayer.appendChild(barkLine1);
    backdropLayer.appendChild(barkLine2);
  }

  const drawnPairs = new Set();

  people.forEach(person => {
    const posA = positions[person.id];
    if (!posA) return;

    const centerA = {
      x: posA.x + CARD_WIDTH / 2,
      y: posA.y + CARD_HEIGHT / 2,
      top: posA.y,
      bottom: posA.y + CARD_HEIGHT,
      left: posA.x,
      right: posA.x + CARD_WIDTH
    };

    // A) Conexões com Cônjuges
    (person.spouses || []).forEach(spouseId => {
      const pairKey = [person.id, spouseId].sort().join('--spouse--');
      if (drawnPairs.has(pairKey)) return;
      drawnPairs.add(pairKey);

      const posB = positions[spouseId];
      if (!posB) return;

      const isALeft = posA.x < posB.x;
      const x1 = isALeft ? posA.x + CARD_WIDTH : posA.x;
      const y1 = posA.y + CARD_HEIGHT / 2;
      const x2 = isALeft ? posB.x : posB.x + CARD_WIDTH;
      const y2 = posB.y + CARD_HEIGHT / 2;

      if (isOrganic) {
        const midX = (x1 + x2) / 2;
        const path = createSvgElement('path', {
          d: `M ${x1} ${y1} Q ${midX} ${y1 - 14}, ${x2} ${y2}`,
          fill: 'none',
          stroke: isDark ? '#d97757' : '#b85d43',
          'stroke-width': '3.5',
          'stroke-dasharray': '6 4',
          'stroke-linecap': 'round'
        });
        connectionsLayer.appendChild(path);

        const heartBadge = createSvgElement('circle', {
          cx: midX,
          cy: y1 - 7,
          r: '7',
          fill: isDark ? '#7c2d12' : '#fce7f3',
          stroke: isDark ? '#f472b6' : '#db2777',
          'stroke-width': '1.5'
        });
        connectionsLayer.appendChild(heartBadge);
      } else {
        const path = createSvgElement('line', {
          x1, y1, x2, y2,
          stroke: isDark ? '#78716c' : '#a8a29e',
          'stroke-width': '2.5',
          'stroke-dasharray': '5 4'
        });
        connectionsLayer.appendChild(path);
      }
    });

    // B) Conexões com Filhos
    (person.children || []).forEach(childId => {
      const child = appState.people[childId];
      const posChild = positions[childId];
      if (!child || !posChild) return;

      let originX = centerA.x;
      let originY = centerA.bottom;

      const coParentId = (child.parents || []).find(pid => pid !== person.id && (person.spouses || []).includes(pid));
      if (coParentId && positions[coParentId]) {
        const pairKey = [person.id, coParentId, childId].sort().join('--couple-child--');
        if (drawnPairs.has(pairKey)) return;
        drawnPairs.add(pairKey);

        const posCoParent = positions[coParentId];
        originX = (posA.x + CARD_WIDTH / 2 + posCoParent.x + CARD_WIDTH / 2) / 2;
        originY = posA.y + CARD_HEIGHT / 2;
      } else {
        const pairKey = `${person.id}--child--${childId}`;
        if (drawnPairs.has(pairKey)) return;
        drawnPairs.add(pairKey);
      }

      const targetX = posChild.x + CARD_WIDTH / 2;
      const targetY = posChild.y;

      drawBranchConnection(connectionsLayer, leavesLayer, originX, originY, targetX, targetY, isOrganic, isDark);
    });

    // C) Conexões com Pais
    (person.parents || []).forEach(parentId => {
      const parent = appState.people[parentId];
      const posParent = positions[parentId];
      if (!parent || !posParent) return;
      if ((parent.children || []).includes(person.id)) return;

      const pairKey = `${parentId}--child--${person.id}`;
      if (drawnPairs.has(pairKey)) return;
      drawnPairs.add(pairKey);

      drawBranchConnection(
        connectionsLayer,
        leavesLayer,
        posParent.x + CARD_WIDTH / 2,
        posParent.y + CARD_HEIGHT,
        centerA.x,
        centerA.top,
        isOrganic,
        isDark
      );
    });

    // D) Conexões com Irmãos (incluindo meio-irmãos com mães/pais diferentes)
    (person.siblings || []).forEach(sibId => {
      const sib = appState.people[sibId];
      const posSib = positions[sibId];
      if (!sib || !posSib) return;

      const pairKey = [person.id, sibId].sort().join('--sibling--');
      if (drawnPairs.has(pairKey)) return;
      drawnPairs.add(pairKey);

      const shareParent = (person.parents || []).some(pid => (sib.parents || []).includes(pid));
      const x1 = posA.x + CARD_WIDTH / 2;
      const y1 = posA.y;
      const x2 = posSib.x + CARD_WIDTH / 2;
      const y2 = posSib.y;
      const archY = Math.min(y1, y2) - (shareParent ? 28 : 42);

      // Se já compartilham pai/mãe, os galhos parentais já os conectam;
      // caso contrário (meio-irmãos sem pais em comum cadastrados ou pais diferentes), desenha o arco fraterno
      if (!shareParent) {
        const path = createSvgElement('path', {
          d: `M ${x1} ${y1} C ${x1} ${archY}, ${x2} ${archY}, ${x2} ${y2}`,
          fill: 'none',
          stroke: isOrganic ? (isDark ? '#6e9e81' : '#5c8a6e') : (isDark ? '#78716c' : '#a8a29e'),
          'stroke-width': isOrganic ? '3' : '2',
          'stroke-dasharray': '5 3',
          'stroke-linecap': 'round'
        });
        connectionsLayer.appendChild(path);

        if (isOrganic) {
          addDecorativeLeaf(leavesLayer, (x1 + x2) / 2, archY + 10, 15, isDark);
        }
      }
    });
  });

  // Renderizar Cartões
  people.forEach(person => {
    const pos = positions[person.id];
    if (!pos) return;
    const cardEl = createPersonCardElement(person, pos);
    cardsLayer.appendChild(cardEl);
  });
}

function drawBranchConnection(connectionsLayer, leavesLayer, x1, y1, x2, y2, isOrganic, isDark) {
  if (isOrganic) {
    const midY = (y1 + y2) / 2;
    const d = `M ${x1} ${y1} C ${x1} ${midY + 15}, ${x2} ${midY - 15}, ${x2} ${y2}`;

    const branchShadow = createSvgElement('path', {
      d,
      fill: 'none',
      stroke: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(92, 58, 33, 0.14)',
      'stroke-width': '8',
      'stroke-linecap': 'round'
    });
    connectionsLayer.appendChild(branchShadow);

    const branch = createSvgElement('path', {
      d,
      fill: 'none',
      stroke: isDark ? '#855834' : '#7a4e2d',
      'stroke-width': '5',
      'stroke-linecap': 'round'
    });
    connectionsLayer.appendChild(branch);

    const leaf1X = x1 + (x2 - x1) * 0.32;
    const leaf1Y = y1 + (y2 - y1) * 0.38;
    const leaf2X = x1 + (x2 - x1) * 0.68;
    const leaf2Y = y1 + (y2 - y1) * 0.64;

    addDecorativeLeaf(leavesLayer, leaf1X, leaf1Y, -28, isDark);
    addDecorativeLeaf(leavesLayer, leaf2X, leaf2Y, 32, isDark);
  } else {
    const midY = (y1 + y2) / 2;
    const d = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`;
    const line = createSvgElement('path', {
      d,
      fill: 'none',
      stroke: isDark ? '#64748b' : '#94a3b8',
      'stroke-width': '2.2',
      'stroke-linejoin': 'round'
    });
    connectionsLayer.appendChild(line);
  }
}

function addDecorativeLeaf(layer, x, y, angleDeg, isDark) {
  const g = createSvgElement('g', {
    transform: `translate(${x}, ${y}) rotate(${angleDeg})`
  });

  const leafFill = isDark ? '#4c8062' : '#6e9e81';
  const leafStroke = isDark ? '#6e9e81' : '#39654c';

  const leafPath = createSvgElement('path', {
    d: 'M 0 0 C 8 -10, 22 -8, 26 0 C 22 8, 8 10, 0 0 Z',
    fill: leafFill,
    stroke: leafStroke,
    'stroke-width': '1',
    opacity: '0.88'
  });

  const veinPath = createSvgElement('path', {
    d: 'M 2 0 L 21 0',
    stroke: leafStroke,
    'stroke-width': '0.9',
    opacity: '0.7'
  });

  g.appendChild(leafPath);
  g.appendChild(veinPath);
  layer.appendChild(g);
}

function createSvgElement(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

// ============================================================================
// CONSTRUÇÃO DO CARTÃO HTML DE CADA FAMILIAR
// ============================================================================
function getAccentClasses(accent, isRoot) {
  const map = {
    folha: {
      border: isRoot ? 'border-folha-600 dark:border-folha-400 ring-4 ring-folha-500/20' : 'border-folha-300 dark:border-folha-700',
      badge: 'bg-folha-100 text-folha-800 dark:bg-folha-900/70 dark:text-folha-200',
      ring: 'border-folha-500'
    },
    madeira: {
      border: isRoot ? 'border-madeira-600 dark:border-madeira-400 ring-4 ring-madeira-500/20' : 'border-madeira-300 dark:border-madeira-700',
      badge: 'bg-madeira-100 text-madeira-800 dark:bg-madeira-900/70 dark:text-madeira-200',
      ring: 'border-madeira-500'
    },
    dourado: {
      border: isRoot ? 'border-amber-500 ring-4 ring-amber-500/20' : 'border-amber-300 dark:border-amber-700',
      badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
      ring: 'border-amber-500'
    },
    celeste: {
      border: isRoot ? 'border-sky-500 ring-4 ring-sky-500/20' : 'border-sky-300 dark:border-sky-700',
      badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200',
      ring: 'border-sky-500'
    },
    rosa: {
      border: isRoot ? 'border-rose-500 ring-4 ring-rose-500/20' : 'border-rose-300 dark:border-rose-700',
      badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
      ring: 'border-rose-500'
    }
  };
  return map[accent] || map.folha;
}

function createPersonCardElement(person, pos) {
  const isRoot = person.id === appState.rootId;
  const styles = getAccentClasses(person.accent, isRoot);

  const card = document.createElement('div');
  card.style.left = `${pos.x}px`;
  card.style.top = `${pos.y}px`;
  card.style.width = `${CARD_WIDTH}px`;
  card.style.minHeight = `${CARD_HEIGHT}px`;
  card.className = `node-card pointer-events-auto absolute bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl border-2 ${styles.border} shadow-lg hover:shadow-xl p-3.5 flex flex-col justify-between select-none`;

  const dateStr = person.birth
    ? (person.death ? `${person.birth} – ${person.death}` : `Nasc. ${person.birth}`)
    : (person.death ? `† ${person.death}` : '');

  card.innerHTML = `
    <!-- Botão Rápido: Adicionar Pai / Mãe (Topo) -->
    <button type="button" onclick="openAddRelativeModal('${person.id}', 'parent')" title="Adicionar Pai ou Mãe (Geração acima)"
      class="quick-add-btn absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-folha-700 hover:bg-folha-800 text-white text-[10px] font-semibold shadow-md flex items-center gap-0.5 whitespace-nowrap border border-white dark:border-stone-800">
      <span>+ Pai/Mãe</span>
    </button>

    <!-- Botão Rápido: Adicionar Irmão(ã) (Esquerda) -->
    <button type="button" onclick="openAddRelativeModal('${person.id}', 'sibling')" title="Adicionar Irmão ou Irmã"
      class="quick-add-btn absolute top-1/2 -left-3.5 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md flex items-center justify-center border border-white dark:border-stone-800">
      +I
    </button>

    <!-- Botão Rápido: Adicionar Cônjuge (Direita) -->
    <button type="button" onclick="openAddRelativeModal('${person.id}', 'spouse')" title="Adicionar Cônjuge / Parceiro(a)"
      class="quick-add-btn absolute top-1/2 -right-3.5 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md flex items-center justify-center border border-white dark:border-stone-800">
      ♥+
    </button>

    <!-- Botão Rápido: Adicionar Filho(a) (Base) -->
    <button type="button" onclick="openAddRelativeModal('${person.id}', 'child')" title="Adicionar Filho ou Filha (Geração abaixo)"
      class="quick-add-btn absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 px-2 py-0.5 rounded-full bg-madeira-600 hover:bg-madeira-700 text-white text-[10px] font-semibold shadow-md flex items-center gap-0.5 whitespace-nowrap border border-white dark:border-stone-800">
      <span>+ Filho(a)</span>
    </button>

    <!-- Conteúdo Principal do Cartão -->
    <div class="flex items-start gap-3">
      <div onclick="openEditPersonModal('${person.id}')" title="Clique para editar foto e dados" class="relative group cursor-pointer shrink-0">
        <img src="${person.photo || PRESET_AVATARS[0].url}" alt="${escapeHtml(person.name)}"
          onerror="this.src='${PRESET_AVATARS[0].url}'"
          class="w-14 h-14 rounded-full object-cover border-2 ${styles.ring} shadow-sm bg-stone-100" />
        <div class="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-1 mb-1">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold truncate max-w-full ${styles.badge}">
            ${escapeHtml(person.role || 'Familiar')}
          </span>
          ${person.gender ? `
            <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium truncate max-w-full bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300 border border-stone-200/70 dark:border-stone-700">
              ${escapeHtml(person.gender)}
            </span>
          ` : ''}
        </div>
        <h3 class="font-serif font-bold text-sm text-stone-900 dark:text-stone-100 leading-snug truncate" title="${escapeHtml(person.name)}">
          ${escapeHtml(person.name)}
        </h3>
        ${dateStr ? `<p class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">${escapeHtml(dateStr)}</p>` : ''}
      </div>
    </div>

    ${person.notes ? `
      <p class="text-[11px] text-stone-600 dark:text-stone-400 line-clamp-2 mt-2 leading-relaxed border-t border-stone-100 dark:border-stone-800 pt-1.5">
        ${escapeHtml(person.notes)}
      </p>
    ` : ''}

    <div class="mt-2 pt-1.5 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between">
      <button type="button" onclick="openEditPersonModal('${person.id}')" class="text-[11px] font-semibold text-folha-700 hover:text-folha-900 dark:text-folha-400 dark:hover:text-folha-200 flex items-center gap-1 transition">
        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Editar
      </button>

      <div class="flex items-center gap-1">
        <button type="button" onclick="openAddRelativeModal('${person.id}', 'parent')" title="Adicionar Pai/Mãe" class="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-folha-100 dark:bg-stone-800 dark:hover:bg-folha-900/50 text-[10px] font-medium text-stone-600 dark:text-stone-300">+Pai</button>
        <button type="button" onclick="openAddRelativeModal('${person.id}', 'child')" title="Adicionar Filho(a)" class="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-madeira-100 dark:bg-stone-800 dark:hover:bg-madeira-900/50 text-[10px] font-medium text-stone-600 dark:text-stone-300">+Filho</button>
      </div>
    </div>
  `;

  return card;
}

// ============================================================================
// MODAL: EDITAR OU ADICIONAR PARENTE (NOVO OU EXISTENTE)
// ============================================================================
function renderAvatarPresets() {
  const container = document.getElementById('avatar-presets');
  container.innerHTML = '';
  PRESET_AVATARS.forEach(av => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = av.label;
    btn.className = 'w-8 h-8 rounded-full overflow-hidden border-2 border-stone-200 dark:border-stone-700 hover:border-folha-500 transition shrink-0';
    btn.innerHTML = `<img src="${av.url}" alt="${av.label}" class="w-full h-full object-cover" />`;
    btn.onclick = () => {
      document.getElementById('edit-photo-preview').src = av.url;
      document.getElementById('edit-photo-url').value = '';
    };
    container.appendChild(btn);
  });
}

function handlePhotoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 256;
      let w = img.width;
      let h = img.height;

      if (w > h) {
        if (w > maxSize) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        }
      } else {
        if (h > maxSize) {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      document.getElementById('edit-photo-preview').src = resizedDataUrl;
      document.getElementById('edit-photo-url').value = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  event.target.value = '';
}

function updatePhotoPreviewFromUrl(url) {
  const trimmed = url.trim();
  if (trimmed) {
    document.getElementById('edit-photo-preview').src = trimmed;
  }
}

function showPersonModal() {
  const modal = document.getElementById('person-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    const nameInput = document.getElementById('edit-name');
    if (nameInput && modalRelationMode === 'new') nameInput.focus();
  }, 50);
}

function closePersonModal() {
  const modal = document.getElementById('person-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  editingPersonId = null;
  pendingRelationContext = null;
  modalRelationMode = 'new';
  selectedExistingPersonId = null;
}

function switchModalMode(mode) {
  modalRelationMode = mode === 'existing' ? 'existing' : 'new';

  const tabNew = document.getElementById('tab-mode-new');
  const tabExisting = document.getElementById('tab-mode-existing');
  const newPanel = document.getElementById('new-person-panel');
  const existingPanel = document.getElementById('existing-person-panel');
  const saveBtn = document.querySelector('#person-modal button[onclick="savePersonModal()"]');

  const activeCls = ['bg-white', 'dark:bg-stone-900', 'text-folha-800', 'dark:text-folha-200', 'shadow-sm'];
  const inactiveCls = ['text-stone-600', 'dark:text-stone-400', 'hover:text-stone-900'];

  if (modalRelationMode === 'new') {
    tabNew.classList.add(...activeCls);
    tabNew.classList.remove(...inactiveCls);
    tabExisting.classList.remove(...activeCls);
    tabExisting.classList.add(...inactiveCls);

    newPanel.classList.remove('hidden');
    existingPanel.classList.add('hidden');
    if (saveBtn) saveBtn.textContent = 'Salvar Alterações';
  } else {
    tabExisting.classList.add(...activeCls);
    tabExisting.classList.remove(...inactiveCls);
    tabNew.classList.remove(...activeCls);
    tabNew.classList.add(...inactiveCls);

    newPanel.classList.add('hidden');
    existingPanel.classList.remove('hidden');
    if (saveBtn) saveBtn.textContent = 'Vincular Familiar';
    renderExistingPeopleList();
  }
}

function populateSiblingParentOptions(sourcePerson) {
  const box = document.getElementById('sibling-parents-box');
  const select = document.getElementById('sibling-parent-share');
  const sourceNameSpan = document.getElementById('sibling-source-name');

  if (!box || !select) return;

  sourceNameSpan.textContent = sourcePerson.name;
  select.innerHTML = '';

  const parents = (sourcePerson.parents || [])
    .map(pid => appState.people[pid])
    .filter(Boolean);

  if (parents.length === 0) {
    select.innerHTML = `
      <option value="none">Nenhum pai/mãe cadastrado ainda (criar apenas vínculo de irmãos)</option>
    `;
  } else if (parents.length === 1) {
    const p1 = parents[0];
    select.innerHTML = `
      <option value="parent_${p1.id}">Compartilhar ${escapeHtml(p1.name)} (${escapeHtml(p1.role || 'Pai/Mãe')}) — permite adicionar outra mãe/pai depois</option>
      <option value="none">Pais diferentes (apenas vínculo de irmãos)</option>
    `;
  } else {
    const p1 = parents[0];
    const p2 = parents[1];
    select.innerHTML = `
      <option value="both">Ambos: ${escapeHtml(p1.name)} e ${escapeHtml(p2.name)} (Irmãos completos)</option>
      <option value="parent_${p1.id}">Apenas ${escapeHtml(p1.name)} (Meio-irmão — outra mãe/pai)</option>
      <option value="parent_${p2.id}">Apenas ${escapeHtml(p2.name)} (Meio-irmão — outro pai/mãe)</option>
      <option value="none">Nenhum deles (Pais totalmente diferentes)</option>
    `;
  }

  box.classList.remove('hidden');
}

function renderExistingPeopleList(filterText = '') {
  const listEl = document.getElementById('existing-people-list');
  if (!listEl || !pendingRelationContext) return;

  const { sourceId, relationType } = pendingRelationContext;
  const source = appState.people[sourceId];
  const query = filterText.trim().toLowerCase();

  const alreadyLinked = new Set([
    sourceId,
    ...(relationType === 'parent' ? (source.parents || []) : []),
    ...(relationType === 'spouse' ? (source.spouses || []) : []),
    ...(relationType === 'child' ? (source.children || []) : []),
    ...(relationType === 'sibling' ? (source.siblings || []) : [])
  ]);

  const candidates = Object.values(appState.people).filter(p => {
    if (alreadyLinked.has(p.id)) return false;
    if (!query) return true;
    return (p.name || '').toLowerCase().includes(query) ||
           (p.role || '').toLowerCase().includes(query);
  });

  if (candidates.length === 0) {
    listEl.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl border border-dashed border-stone-200 dark:border-stone-700 text-xs text-stone-500 dark:text-stone-400">
        Nenhuma outra pessoa disponível para vincular com esse filtro. Use a aba <strong>"+ Criar Nova Pessoa"</strong>.
      </div>
    `;
    selectedExistingPersonId = null;
    return;
  }

  if (!selectedExistingPersonId || !candidates.some(c => c.id === selectedExistingPersonId)) {
    selectedExistingPersonId = candidates[0].id;
  }

  listEl.innerHTML = candidates.map(person => {
    const isSelected = person.id === selectedExistingPersonId;
    return `
      <button type="button" onclick="selectExistingPerson('${person.id}')"
        class="w-full text-left flex items-center gap-3 p-2.5 rounded-2xl border-2 transition ${
          isSelected
            ? 'border-folha-600 bg-folha-50/70 dark:bg-folha-950/40 dark:border-folha-500'
            : 'border-stone-200/80 dark:border-stone-700/80 hover:border-folha-300 bg-white dark:bg-stone-900'
        }">
        <img src="${person.photo || PRESET_AVATARS[0].url}" alt="${escapeHtml(person.name)}"
          class="w-10 h-10 rounded-full object-cover border border-stone-300 dark:border-stone-600 shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">${escapeHtml(person.name)}</p>
          <p class="text-[11px] text-stone-500 dark:text-stone-400 truncate">
            ${escapeHtml(person.role || 'Familiar')} ${person.birth ? `• ${escapeHtml(person.birth)}` : ''}
          </p>
        </div>
        <span class="w-5 h-5 rounded-full flex items-center justify-center border ${
          isSelected
            ? 'border-folha-600 bg-folha-600 text-white'
            : 'border-stone-300 dark:border-stone-600'
        }">
          ${isSelected ? '✓' : ''}
        </span>
      </button>
    `;
  }).join('');
}

function filterExistingPeopleList(val) {
  renderExistingPeopleList(val);
}

function selectExistingPerson(personId) {
  selectedExistingPersonId = personId;
  const searchVal = document.getElementById('existing-person-search')?.value || '';
  renderExistingPeopleList(searchVal);
}

function openEditPersonModal(personId) {
  const person = appState.people[personId];
  if (!person) return;

  editingPersonId = personId;
  pendingRelationContext = null;

  document.getElementById('modal-mode-tabs').classList.add('hidden');
  document.getElementById('modal-mode-tabs').classList.remove('grid');
  document.getElementById('sibling-parents-box').classList.add('hidden');
  switchModalMode('new');

  document.getElementById('modal-title').textContent = 'Editar Familiar';
  document.getElementById('modal-subtitle').textContent = 'Atualize a foto, datas ou notas deste membro da família';

  document.getElementById('edit-name').value = person.name || '';
  document.getElementById('edit-role').value = person.role || '';
  document.getElementById('edit-gender').value = person.gender || '';
  document.getElementById('edit-birth').value = person.birth || '';
  document.getElementById('edit-death').value = person.death || '';
  document.getElementById('edit-notes').value = person.notes || '';
  document.getElementById('edit-photo-preview').src = person.photo || PRESET_AVATARS[0].url;
  document.getElementById('edit-photo-url').value = person.photo && !person.photo.startsWith('data:') ? person.photo : '';
  document.getElementById('person-modal').dataset.pendingAccent = person.accent || 'folha';

  const deleteBtn = document.getElementById('btn-delete-person');
  if (personId === appState.rootId && Object.keys(appState.people).length === 1) {
    deleteBtn.classList.add('hidden');
  } else {
    deleteBtn.classList.remove('hidden');
  }

  showPersonModal();
}

function openAddRelativeModal(sourceId, relationType) {
  const sourcePerson = appState.people[sourceId];
  if (!sourcePerson) return;

  editingPersonId = null;
  pendingRelationContext = { sourceId, relationType };
  selectedExistingPersonId = null;

  const modeTabs = document.getElementById('modal-mode-tabs');
  if (Object.keys(appState.people).length > 1) {
    modeTabs.classList.remove('hidden');
    modeTabs.classList.add('grid');
  } else {
    modeTabs.classList.add('hidden');
    modeTabs.classList.remove('grid');
  }

  document.getElementById('existing-person-search').value = '';
  switchModalMode('new');

  const siblingBox = document.getElementById('sibling-parents-box');
  if (relationType === 'sibling') {
    populateSiblingParentOptions(sourcePerson);
  } else {
    siblingBox.classList.add('hidden');
  }

  const labels = {
    parent: { title: `Adicionar Pai ou Mãe de ${sourcePerson.name}`, defaultRole: 'Pai / Mãe', accent: 'madeira', avatar: PRESET_AVATARS[4].url },
    spouse: { title: `Adicionar Cônjuge de ${sourcePerson.name}`, defaultRole: 'Cônjuge', accent: 'rosa', avatar: PRESET_AVATARS[1].url },
    child: { title: `Adicionar Filho(a) de ${sourcePerson.name}`, defaultRole: 'Filho(a)', accent: 'folha', avatar: PRESET_AVATARS[2].url },
    sibling: { title: `Adicionar Irmão/Irmã de ${sourcePerson.name}`, defaultRole: 'Irmão / Irmã', accent: 'celeste', avatar: PRESET_AVATARS[3].url }
  };

  const info = labels[relationType];
  document.getElementById('modal-title').textContent = info.title;
  document.getElementById('modal-subtitle').textContent = 'Crie um novo familiar ou vincule alguém que já está na árvore';

  document.getElementById('edit-name').value = '';
  document.getElementById('edit-role').value = info.defaultRole;
  document.getElementById('edit-gender').value = '';
  document.getElementById('edit-birth').value = '';
  document.getElementById('edit-death').value = '';
  document.getElementById('edit-notes').value = '';
  document.getElementById('edit-photo-preview').src = info.avatar;
  document.getElementById('edit-photo-url').value = '';
  document.getElementById('person-modal').dataset.pendingAccent = info.accent;

  document.getElementById('btn-delete-person').classList.add('hidden');
  showPersonModal();
}

function linkRelativeToSource(source, targetPerson, relationType) {
  const sourceId = source.id;
  const targetId = targetPerson.id;

  // Liga APENAS a pessoa selecionada (source) ao familiar (targetPerson),
  // sem criar vínculos automáticos com outros cônjuges ou pais.
  if (relationType === 'parent') {
    targetPerson.children = targetPerson.children || [];
    if (!targetPerson.children.includes(sourceId)) targetPerson.children.push(sourceId);

    source.parents = source.parents || [];
    if (!source.parents.includes(targetId)) source.parents.push(targetId);
  } else if (relationType === 'spouse') {
    targetPerson.spouses = targetPerson.spouses || [];
    if (!targetPerson.spouses.includes(sourceId)) targetPerson.spouses.push(sourceId);

    source.spouses = source.spouses || [];
    if (!source.spouses.includes(targetId)) source.spouses.push(targetId);
  } else if (relationType === 'child') {
    targetPerson.parents = targetPerson.parents || [];
    if (!targetPerson.parents.includes(sourceId)) targetPerson.parents.push(sourceId);

    source.children = source.children || [];
    if (!source.children.includes(targetId)) source.children.push(targetId);
  } else if (relationType === 'sibling') {
    targetPerson.siblings = targetPerson.siblings || [];
    if (!targetPerson.siblings.includes(sourceId)) targetPerson.siblings.push(sourceId);

    source.siblings = source.siblings || [];
    if (!source.siblings.includes(targetId)) source.siblings.push(targetId);
  }
}

function savePersonModal() {
  // Caso 1: Editando pessoa existente
  if (editingPersonId && appState.people[editingPersonId]) {
    const nameInput = document.getElementById('edit-name').value.trim();
    const p = appState.people[editingPersonId];
    p.name = nameInput || 'Familiar sem nome';
    p.role = document.getElementById('edit-role').value.trim() || 'Familiar';
    p.gender = document.getElementById('edit-gender').value.trim();
    p.birth = document.getElementById('edit-birth').value.trim();
    p.death = document.getElementById('edit-death').value.trim();
    p.notes = document.getElementById('edit-notes').value.trim();
    p.accent = document.getElementById('person-modal').dataset.pendingAccent || 'folha';
    p.photo = document.getElementById('edit-photo-preview').src;

    saveToStorage();
    closePersonModal();
    renderTree();
    showToast('Dados atualizados com sucesso!');
    return;
  }

  // Caso 2: Adicionando parente a uma pessoa existente
  if (pendingRelationContext) {
    const { sourceId, relationType } = pendingRelationContext;
    const source = appState.people[sourceId];
    if (!source) return;

    // Subcaso 2A: Vincular uma pessoa JÁ EXISTENTE na árvore
    if (modalRelationMode === 'existing') {
      if (!selectedExistingPersonId || !appState.people[selectedExistingPersonId]) {
        showToast('Selecione uma pessoa existente na lista.');
        return;
      }

      const existingTarget = appState.people[selectedExistingPersonId];
      if (relationType === 'parent') existingTarget.generation = (source.generation || 0) - 1;
      if (relationType === 'child') existingTarget.generation = (source.generation || 0) + 1;
      if (relationType === 'sibling' || relationType === 'spouse') {
        existingTarget.generation = source.generation || 0;
      }

      linkRelativeToSource(source, existingTarget, relationType);

      saveToStorage();
      closePersonModal();
      renderTree();
      showToast(`${existingTarget.name} vinculado(a) com sucesso!`);
      return;
    }

    // Subcaso 2B: Criar uma NOVA pessoa e vincular
    const nameInput = document.getElementById('edit-name').value.trim();
    const name = nameInput || 'Familiar sem nome';
    const role = document.getElementById('edit-role').value.trim() || 'Familiar';
    const gender = document.getElementById('edit-gender').value.trim();
    const birth = document.getElementById('edit-birth').value.trim();
    const death = document.getElementById('edit-death').value.trim();
    const notes = document.getElementById('edit-notes').value.trim();
    const accent = document.getElementById('person-modal').dataset.pendingAccent || 'folha';
    const photo = document.getElementById('edit-photo-preview').src;

    const newId = 'person_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    let newGen = source.generation || 0;

    if (relationType === 'parent') newGen -= 1;
    if (relationType === 'child') newGen += 1;

    const newPerson = {
      id: newId,
      name,
      role,
      gender,
      birth,
      death,
      notes,
      photo,
      accent,
      generation: newGen,
      parents: [],
      spouses: [],
      children: [],
      siblings: []
    };

    appState.people[newId] = newPerson;
    linkRelativeToSource(source, newPerson, relationType);

    saveToStorage();
    closePersonModal();
    renderTree();
    showToast(`${name} adicionado(a) à árvore!`);
  }
}

function deleteCurrentPerson() {
  if (!editingPersonId || !appState.people[editingPersonId]) return;
  const targetId = editingPersonId;

  if (Object.keys(appState.people).length <= 1) {
    showToast('Não é possível remover a última pessoa da árvore.');
    return;
  }

  Object.values(appState.people).forEach(p => {
    p.parents = (p.parents || []).filter(id => id !== targetId);
    p.spouses = (p.spouses || []).filter(id => id !== targetId);
    p.children = (p.children || []).filter(id => id !== targetId);
    p.siblings = (p.siblings || []).filter(id => id !== targetId);
  });

  delete appState.people[targetId];

  if (appState.rootId === targetId) {
    appState.rootId = Object.keys(appState.people)[0];
  }

  saveToStorage();
  closePersonModal();
  renderTree();
  showToast('Familiar removido da árvore.');
}

// ============================================================================
// NAVEGAÇÃO (PAN, ZOOM E CENTRALIZAÇÃO)
// ============================================================================
function applyTransform(animate = false) {
  const world = document.getElementById('tree-world');
  if (!world) return;

  world.style.transition = animate ? 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
  world.style.transform = `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`;

  const zoomLabel = document.getElementById('zoom-label');
  if (zoomLabel) {
    zoomLabel.textContent = `${Math.round(viewTransform.scale * 100)}%`;
  }
}

function centerTree(animate = true) {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;

  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  const rootPos = appState.positions[appState.rootId] || { x: WORLD_CENTER_X - CARD_WIDTH / 2, y: WORLD_CENTER_Y };

  const targetCenterX = rootPos.x + CARD_WIDTH / 2;
  const targetCenterY = rootPos.y + CARD_HEIGHT / 2;

  viewTransform.scale = vw < 640 ? 0.8 : 1;
  viewTransform.x = vw / 2 - targetCenterX * viewTransform.scale;
  viewTransform.y = vh / 2 - targetCenterY * viewTransform.scale + 20;

  applyTransform(animate);
}

function zoomIn() {
  zoomAtCenter(1.18);
}

function zoomOut() {
  zoomAtCenter(0.85);
}

function zoomAtCenter(factor) {
  const viewport = document.getElementById('viewport');
  const cx = viewport.clientWidth / 2;
  const cy = viewport.clientHeight / 2;
  zoomAtPoint(cx, cy, factor);
}

function zoomAtPoint(clientX, clientY, factor) {
  const newScale = Math.min(2.2, Math.max(0.35, viewTransform.scale * factor));
  const actualFactor = newScale / viewTransform.scale;

  viewTransform.x = clientX - (clientX - viewTransform.x) * actualFactor;
  viewTransform.y = clientY - (clientY - viewTransform.y) * actualFactor;
  viewTransform.scale = newScale;

  applyTransform(false);
}

function setupPanAndZoom() {
  const viewport = document.getElementById('viewport');
  if (!viewport) return;

  viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.node-card')) return;
    isPanning = true;
    panStart = { x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y };
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    viewTransform.x = e.clientX - panStart.x;
    viewTransform.y = e.clientY - panStart.y;
    applyTransform(false);
  });

  window.addEventListener('mouseup', () => {
    isPanning = false;
  });

  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.09 : 0.91;
    zoomAtPoint(e.clientX, e.clientY, factor);
  }, { passive: false });

  let lastTouchDist = null;
  viewport.addEventListener('touchstart', (e) => {
    if (e.target.closest('.node-card')) return;
    if (e.touches.length === 1) {
      isPanning = true;
      panStart = {
        x: e.touches[0].clientX - viewTransform.x,
        y: e.touches[0].clientY - viewTransform.y
      };
    } else if (e.touches.length === 2) {
      isPanning = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.hypot(dx, dy);
    }
  }, { passive: true });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isPanning) {
      viewTransform.x = e.touches[0].clientX - panStart.x;
      viewTransform.y = e.touches[0].clientY - panStart.y;
      applyTransform(false);
    } else if (e.touches.length === 2 && lastTouchDist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomAtPoint(midX, midY, dist / lastTouchDist);
      lastTouchDist = dist;
    }
  }, { passive: true });

  viewport.addEventListener('touchend', () => {
    isPanning = false;
    lastTouchDist = null;
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePersonModal();
      closeConfirmModal();
    }
  });
}

// Iniciar aplicação assim que o DOM estiver pronto
window.addEventListener('DOMContentLoaded', initApp);
