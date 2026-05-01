const STORAGE_KEY = "dreamPiggy.pigs";
const MAX_ACTIVE_PIGS = 5;
const milestoneMessages = {
  created: "從今天起，我會幫你守著這個夢想。",
  25: "你真的開始了。很多人有夢，但你開始存了。",
  50: "我們已經走一半了。原來堅持，真的會累積成改變。",
  75: "我已經能看見那個夢想了。再一下下，我們就到了。",
  100: "你做到了。這不是運氣，是你一次一次堅持的結果。",
  unlocked: "去吧。去把存下來的夢，活成回憶。"
};

const state = {
  data: {
    pigs: [],
    achievements: []
  },
  pigTypes: [],
  currentView: "home",
  currentIndex: 0,
  selectedPigTypeId: "",
  feedPigId: null,
  confirmAction: null
};

const elements = {
  homeView: document.getElementById("home-view"),
  achievementsView: document.getElementById("achievements-view"),
  activeCount: document.getElementById("active-count"),
  totalSaved: document.getElementById("total-saved"),
  carouselArea: document.getElementById("carousel-area"),
  achievementCount: document.getElementById("achievement-count"),
  achievementTotal: document.getElementById("achievement-total"),
  achievementsList: document.getElementById("achievements-list"),
  menuToggle: document.getElementById("menu-toggle"),
  menuPanel: document.getElementById("menu-panel"),
  navButtons: Array.from(document.querySelectorAll(".nav-button")),
  openCreateModal: document.getElementById("open-create-modal"),
  createModal: document.getElementById("create-modal"),
  createForm: document.getElementById("create-form"),
  dreamName: document.getElementById("dream-name"),
  targetAmount: document.getElementById("target-amount"),
  pigTypeOptions: document.getElementById("pig-type-options"),
  feedModal: document.getElementById("feed-modal"),
  feedForm: document.getElementById("feed-form"),
  feedAmount: document.getElementById("feed-amount"),
  feedModalTitle: document.getElementById("feed-modal-title"),
  confirmModal: document.getElementById("confirm-modal"),
  confirmTitle: document.getElementById("confirm-title"),
  confirmMessage: document.getElementById("confirm-message"),
  confirmAccept: document.getElementById("confirm-accept"),
  confirmCancel: document.getElementById("confirm-cancel"),
  dialogBubble: document.getElementById("dialog-bubble"),
  importFileInput: document.getElementById("import-file-input")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  state.data = loadData();
  state.pigTypes = await loadPigTypes();
  state.selectedPigTypeId = state.pigTypes[0]?.id || "";
  bindEvents();
  renderPigTypeOptions();
  renderApp();
}

function bindEvents() {
  elements.menuToggle.addEventListener("click", toggleMenu);
  document.addEventListener("click", handleDocumentClick);
  elements.openCreateModal.addEventListener("click", handleOpenCreate);
  elements.createForm.addEventListener("submit", createPig);
  elements.feedForm.addEventListener("submit", submitFeedPig);
  elements.confirmAccept.addEventListener("click", handleConfirmAccept);
  elements.confirmCancel.addEventListener("click", () => closeModal("confirm"));
  elements.importFileInput.addEventListener("change", importBackup);

  elements.navButtons.forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.closeModal));
  });

  elements.menuPanel.addEventListener("click", handleMenuAction);
}

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return { pigs: [], achievements: [] };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      pigs: Array.isArray(parsed.pigs) ? parsed.pigs : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : []
    };
  } catch (error) {
    return { pigs: [], achievements: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

async function loadPigTypes() {
  try {
    const response = await fetch("data/pigs.json");
    if (!response.ok) {
      throw new Error("Failed to load pig types");
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function renderApp() {
  normalizeCurrentIndex();
  renderHome();
  renderAchievements();
  updateView();
}

function renderHome() {
  const activePigs = getActivePigs();
  const totalSavedAmount = state.data.pigs.reduce((sum, pig) => sum + pig.currentAmount, 0);

  elements.activeCount.textContent = String(activePigs.length);
  elements.totalSaved.textContent = formatCurrency(totalSavedAmount);

  if (!activePigs.length) {
    elements.carouselArea.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>還沒有夢想豬</strong>
          <p>還沒有夢想豬，建立第一個夢想吧。</p>
        </div>
      </div>
    `;
    return;
  }

  const currentPig = activePigs[state.currentIndex];
  const pigType = getPigType(currentPig.pigType);
  const progress = getProgress(currentPig);

  elements.carouselArea.innerHTML = `
    <article class="carousel-card" data-pig-id="${currentPig.id}">
      <div class="pig-stage ${progress >= 100 ? "completed" : ""} ${getGrowthClass(progress)}" style="background-color: ${hexToRgba(pigType.themeColor, 0.28)};">
        <div class="pig-figure" style="background-color: ${hexToRgba(pigType.themeColor, 0.82)};">
          <img class="pig-image" src="${getPigImage(pigType, progress)}" alt="${pigType.name}">
        </div>
        <div class="coin-layer" aria-hidden="true"></div>
        <div class="sparkle-layer" aria-hidden="true"></div>
        <div class="amount-float" aria-hidden="true"></div>
        <div class="unlock-overlay" aria-hidden="true">
          <div class="confetti"></div>
        </div>
      </div>

      <div class="pig-meta">
        <div class="pig-title-row">
          <div>
            <h3>${escapeHtml(currentPig.name)}</h3>
            <p>${escapeHtml(pigType.name)}</p>
          </div>
          <span class="pig-type-chip">${escapeHtml(pigType.name)}</span>
        </div>

        <div class="money-line">
          ${formatCurrency(currentPig.currentAmount)} / ${formatCurrency(currentPig.targetAmount)}
        </div>

        <div class="progress-row">
          <div class="progress-track">
            <div class="progress-bar" style="width: ${progress}%;"></div>
          </div>
          <strong>${progress}%</strong>
        </div>

        <div class="action-row">
          <button class="secondary-button" type="button" data-feed-id="${currentPig.id}">
            餵豬
          </button>
          ${
            progress >= 100
              ? `<button class="primary-button" type="button" data-unlock-id="${currentPig.id}">解封</button>`
              : ""
          }
        </div>
      </div>

      <div class="carousel-controls">
        <button class="secondary-button" type="button" data-shift="-1">上一隻</button>
        <button class="secondary-button" type="button" data-shift="1">下一隻</button>
      </div>

      <div class="dots">
        ${activePigs
          .map(
            (pig, index) =>
              `<button class="dot ${index === state.currentIndex ? "active" : ""}" type="button" data-go-to="${index}" aria-label="切換到 ${escapeHtml(pig.name)}"></button>`
          )
          .join("")}
      </div>
    </article>
  `;

  bindCarouselEvents();
}

function bindCarouselEvents() {
  const card = elements.carouselArea.querySelector(".carousel-card");
  if (!card) {
    return;
  }

  card.querySelectorAll("[data-shift]").forEach((button) => {
    button.addEventListener("click", () => shiftCarousel(Number(button.dataset.shift)));
  });

  card.querySelectorAll("[data-go-to]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentIndex = Number(button.dataset.goTo);
      renderHome();
    });
  });

  const feedButton = card.querySelector("[data-feed-id]");
  if (feedButton) {
    feedButton.addEventListener("click", () => openFeedModal(feedButton.dataset.feedId));
  }

  const unlockButton = card.querySelector("[data-unlock-id]");
  if (unlockButton) {
    unlockButton.addEventListener("click", () => promptUnlockPig(unlockButton.dataset.unlockId));
  }
}

function renderAchievements() {
  const achievements = [...state.data.achievements].sort(
    (a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime()
  );
  const completedTotal = achievements.reduce((sum, pig) => sum + pig.targetAmount, 0);

  elements.achievementCount.textContent = String(achievements.length);
  elements.achievementTotal.textContent = formatCurrency(completedTotal);

  if (!achievements.length) {
    elements.achievementsList.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>還沒有完成夢想</strong>
          <p>完成的夢想，會收藏在這裡。</p>
        </div>
      </div>
    `;
    return;
  }

  elements.achievementsList.innerHTML = achievements
    .map((pig) => {
      const pigType = getPigType(pig.pigType);
      const days = getDaysSpent(pig.createdAt, pig.unlockedAt);

      return `
        <article class="achievement-card">
          <div class="achievement-visual" style="background-color: ${hexToRgba(pigType.themeColor, 0.58)};">
          <img
            class="pig-image achievement-image"
            src="${getPigImage(pigType, 100)}"
            alt="${pigType.name}"
          >
          </div>
          <p>${escapeHtml(pigType.name)}</p>
          <h3>${escapeHtml(pig.name)}</h3>
          <div class="achievement-meta">
            <span>${formatDate(pig.unlockedAt)} 完成</span>
            <span class="days-chip">${days} 天</span>
          </div>
          <div class="achievement-meta">
            <span>達標金額</span>
            <strong>${formatCurrency(pig.targetAmount)}</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPigTypeOptions() {
  elements.pigTypeOptions.innerHTML = state.pigTypes
    .map(
      (pigType) => `
        <button
          class="pig-type-card ${pigType.id === state.selectedPigTypeId ? "selected" : ""}"
          type="button"
          data-pig-type="${pigType.id}"
          style="background-color: ${hexToRgba(pigType.themeColor, 0.24)};"
        >
          <img class="pig-image" src="${getPigImage(pigType, 100)}" alt="${pigType.name}">
          <span class="pig-type-name">${escapeHtml(pigType.name)}</span>
          <span class="pig-type-description">${escapeHtml(pigType.description)}</span>
        </button>
      `
    )
    .join("");

  elements.pigTypeOptions.querySelectorAll("[data-pig-type]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedPigTypeId = button.dataset.pigType;
      renderPigTypeOptions();
    });
  });
}

function createPig(event) {
  event.preventDefault();

  const name = elements.dreamName.value.trim();
  const targetAmount = Number(elements.targetAmount.value);
  const activePigs = getActivePigs();

  if (activePigs.length >= MAX_ACTIVE_PIGS) {
    showDialog("最多只能建立 5 隻夢想豬。");
    return;
  }

  if (!name) {
    showDialog("請輸入夢想名稱。");
    return;
  }

  if (!Number.isInteger(targetAmount) || targetAmount <= 0) {
    showDialog("目標金額必須是大於 0 的正整數。");
    return;
  }

  if (!state.selectedPigTypeId) {
    showDialog("請先選擇一種豬款。");
    return;
  }

  const now = new Date().toISOString();
  const pig = {
    id: createId(),
    name,
    pigType: state.selectedPigTypeId,
    targetAmount,
    currentAmount: 0,
    createdAt: now,
    unlockedAt: null,
    status: "active",
    triggeredMilestones: ["created"]
  };

  state.data.pigs.push(pig);
  saveData();
  closeModal("create");
  elements.createForm.reset();
  state.selectedPigTypeId = state.pigTypes[0]?.id || "";
  renderPigTypeOptions();
  state.currentIndex = getActivePigs().length - 1;
  renderApp();
  showDialog(milestoneMessages.created);
}

function openFeedModal(pigId) {
  const pig = state.data.pigs.find((item) => item.id === pigId && item.status === "active");
  if (!pig) {
    return;
  }

  state.feedPigId = pigId;
  elements.feedForm.reset();
  elements.feedModalTitle.textContent = "要餵多少給夢想呢？";
  openModal("feed");
}

function submitFeedPig(event) {
  event.preventDefault();

  const amount = Number(elements.feedAmount.value);
  const pig = state.data.pigs.find((item) => item.id === state.feedPigId);

  if (!pig || pig.status !== "active") {
    closeModal("feed");
    return;
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    showDialog("餵豬金額必須是正整數。");
    return;
  }

  pig.currentAmount = Math.min(pig.targetAmount, pig.currentAmount + amount);
  saveData();
  closeModal("feed");
  renderApp();
  playFeedAnimation(pig.id, amount);
  checkMilestones(pig);
}

function checkMilestones(pig) {
  const progress = getProgress(pig);
  const milestoneOrder = [25, 50, 75, 100];
  const reachedMilestones = milestoneOrder.filter(
    (value) => progress >= value && !pig.triggeredMilestones.includes(value)
  );

  if (!reachedMilestones.length) {
    saveData();
    return;
  }

  reachedMilestones.forEach((milestone) => pig.triggeredMilestones.push(milestone));
  saveData();
  showDialog(milestoneMessages[reachedMilestones[reachedMilestones.length - 1]]);
}

function promptUnlockPig(pigId) {
  const pig = state.data.pigs.find((item) => item.id === pigId && item.status === "active");
  if (!pig || pig.currentAmount < pig.targetAmount) {
    return;
  }

  state.confirmAction = () => unlockPig(pigId);
  elements.confirmTitle.textContent = "確認解封";
  elements.confirmMessage.textContent = "解封後，這隻夢想豬會移到成就館，並釋出新的空位。";
  openModal("confirm");
}

function unlockPig(pigId) {
  const pig = state.data.pigs.find(
    (item) => item.id === pigId && item.status === "active"
  );

  if (!pig || pig.currentAmount < pig.targetAmount) {
    return;
  }

  const card = document.querySelector(
    `.carousel-card[data-pig-id="${pigId}"]`
  );

  // 先在原地播放儀式
  if (card) {
    card.classList.add("is-glowing", "is-bouncing");

    const overlay = card.querySelector(".unlock-overlay");

    if (overlay) {
      overlay.classList.add("active");

      overlay.innerHTML = `
        <div class="confetti">
          ${Array.from({ length: 20 }, (_, index) => {
            const colors = ["#f3c9cf", "#efd488", "#f6c8a5", "#fff1bd"];
            const left = 5 + (index % 10) * 9;
            const color = colors[index % colors.length];
            const delay = (index % 6) * 0.05;

            return `
              <span
                style="
                  left:${left}%;
                  background:${color};
                  animation-delay:${delay}s;
                "
              ></span>
            `;
          }).join("")}
        </div>
      `;
    }
  }

  // 先說話
  showDialog(milestoneMessages.unlocked);

  // 延遲完成解封
  setTimeout(() => {
    pig.status = "completed";
    pig.unlockedAt = new Date().toISOString();

    if (!pig.triggeredMilestones.includes("unlocked")) {
      pig.triggeredMilestones.push("unlocked");
    }

    state.data.achievements.push({ ...pig });

    saveData();
    renderApp();
    playUnlockAnimation(pigId);
  }, 1800);
}

function handleMenuAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  toggleMenu(false);

  if (action === "export") {
    exportBackup();
  }

  if (action === "import") {
    promptImportBackup();
  }

  if (action === "clear") {
    promptClearData();
  }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "dream-piggy-backup.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function promptImportBackup() {
  state.confirmAction = () => elements.importFileInput.click();
  elements.confirmTitle.textContent = "匯入備份";
  elements.confirmMessage.textContent = "匯入後會覆蓋目前資料，是否繼續？";
  openModal("confirm");
}

function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const nextData = {
        pigs: Array.isArray(parsed.pigs) ? parsed.pigs : [],
        achievements: Array.isArray(parsed.achievements) ? parsed.achievements : []
      };
      state.data = nextData;
      saveData();
      normalizeCurrentIndex();
      renderApp();
      showDialog("備份已匯入。");
    } catch (error) {
      showDialog("匯入失敗，請確認 JSON 格式。");
    } finally {
      elements.importFileInput.value = "";
    }
  };
  reader.readAsText(file);
}

function promptClearData() {
  state.confirmAction = clearData;
  elements.confirmTitle.textContent = "清除全部資料";
  elements.confirmMessage.textContent = "這會清除所有夢想豬與成就館資料，且無法復原。";
  openModal("confirm");
}

function clearData() {
  state.data = { pigs: [], achievements: [] };
  saveData();
  state.currentIndex = 0;
  renderApp();
  showDialog("資料已清除。");
}

function shiftCarousel(direction) {
  const activePigs = getActivePigs();
  if (!activePigs.length) {
    return;
  }

  state.currentIndex = (state.currentIndex + direction + activePigs.length) % activePigs.length;
  renderHome();
}

function switchView(view) {
  state.currentView = view;
  updateView();
}

function updateView() {
  elements.homeView.classList.toggle("active", state.currentView === "home");
  elements.achievementsView.classList.toggle("active", state.currentView === "achievements");

  elements.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === state.currentView);
  });
}

function toggleMenu(force) {
  const shouldOpen =
    typeof force === "boolean" ? force : elements.menuPanel.classList.contains("hidden");

  elements.menuPanel.classList.toggle("hidden", !shouldOpen);
  elements.menuToggle.setAttribute("aria-expanded", String(shouldOpen));
}

function handleDocumentClick(event) {
  if (
    !elements.menuPanel.contains(event.target) &&
    !elements.menuToggle.contains(event.target)
  ) {
    toggleMenu(false);
  }
}

function handleOpenCreate() {
  if (getActivePigs().length >= MAX_ACTIVE_PIGS) {
    showDialog("最多只能建立 5 隻夢想豬。");
    return;
  }

  if (!state.selectedPigTypeId) {
    state.selectedPigTypeId = state.pigTypes[0]?.id || "";
    renderPigTypeOptions();
  }

  elements.createForm.reset();
  openModal("create");
}

function openModal(name) {
  const modal = getModalElement(name);
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal(name) {
  const modal = getModalElement(name);
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  if (name === "feed") {
    state.feedPigId = null;
  }

  if (name === "confirm") {
    state.confirmAction = null;
  }
}

function getModalElement(name) {
  if (name === "create") {
    return elements.createModal;
  }
  if (name === "feed") {
    return elements.feedModal;
  }
  return elements.confirmModal;
}

function handleConfirmAccept() {
  const action = state.confirmAction;
  closeModal("confirm");
  if (typeof action === "function") {
    action();
  }
}

function getActivePigs() {
  return state.data.pigs.filter((pig) => pig.status === "active");
}

function normalizeCurrentIndex() {
  const activeCount = getActivePigs().length;
  if (!activeCount) {
    state.currentIndex = 0;
    return;
  }

  state.currentIndex = Math.min(state.currentIndex, activeCount - 1);
}

function playFeedAnimation(pigId, amount) {
  const card = document.querySelector(`.carousel-card[data-pig-id="${pigId}"]`);
  if (!card) {
    return;
  }

  card.classList.add("is-glowing", "is-bouncing");
  setTimeout(() => card.classList.remove("is-glowing", "is-bouncing"), 820);

  const coinLayer = card.querySelector(".coin-layer");
  const sparkleLayer = card.querySelector(".sparkle-layer");
  const amountFloat = card.querySelector(".amount-float");

  coinLayer.innerHTML = Array.from({ length: 6 }, (_, index) => {
    const left = 18 + index * 12;
    return `<span class="coin" style="left: ${left}%; animation-delay: ${index * 0.08}s;"></span>`;
  }).join("");

  sparkleLayer.classList.add("show");
  sparkleLayer.innerHTML = Array.from({ length: 6 }, (_, index) => {
    const positions = [
      [18, 70],
      [30, 32],
      [48, 62],
      [66, 34],
      [80, 68],
      [56, 18]
    ][index];
    return `<span style="left: ${positions[0]}%; top: ${positions[1]}%; animation-delay: ${index * 0.07}s;"></span>`;
  }).join("");

  amountFloat.textContent = `+${formatCurrency(amount)}`;
  amountFloat.classList.add("show");

  setTimeout(() => {
    coinLayer.innerHTML = "";
    sparkleLayer.innerHTML = "";
    sparkleLayer.classList.remove("show");
    amountFloat.classList.remove("show");
  }, 1200);
}

function playUnlockAnimation(pigId) {
  switchView("achievements");

  const latestCard = elements.achievementsList.querySelector(".achievement-card");
  if (!latestCard) {
    return;
  }

  const visual = latestCard.querySelector(".achievement-visual");
  const confettiHolder = document.createElement("div");
  confettiHolder.className = "unlock-overlay active";
  confettiHolder.innerHTML = `<div class="confetti">${Array.from({ length: 14 }, (_, index) => {
    const colors = ["#f3c9cf", "#efd488", "#f6c8a5", "#fff1bd"];
    const left = 6 + (index % 7) * 13;
    const color = colors[index % colors.length];
    const delay = (index % 5) * 0.06;
    return `<span style="left:${left}%; background:${color}; animation-delay:${delay}s;"></span>`;
  }).join("")}</div>`;

  latestCard.style.position = "relative";
  latestCard.appendChild(confettiHolder);
  visual.style.boxShadow = "0 0 0 10px rgba(255, 236, 181, 0.24)";

  setTimeout(() => {
    confettiHolder.remove();
    visual.style.boxShadow = "";
  }, 1600);
}

function showDialog(message) {
  elements.dialogBubble.textContent = message;
  elements.dialogBubble.classList.remove("hidden", "show");
  void elements.dialogBubble.offsetWidth;
  elements.dialogBubble.classList.add("show");

  clearTimeout(showDialog.timer);
  showDialog.timer = setTimeout(() => {
    elements.dialogBubble.classList.add("hidden");
    elements.dialogBubble.classList.remove("show");
  }, 3600);
}

function getPigType(id) {
    return (
    state.pigTypes.find((pigType) => pigType.id === id) || {
        id: "fallback",
        name: "夢想豬",
        images: {
        "0": "assets/pigs/0/dream.webp",
        "25": "assets/pigs/25/dream.webp",
        "50": "assets/pigs/50/dream.webp",
        "75": "assets/pigs/75/dream.webp",
        "100": "assets/pigs/100/dream.webp"
        },
        themeColor: "#f6c8a5",
        description: ""
    }
    );
}

function getProgress(pig) {
  if (!pig.targetAmount) {
    return 0;
  }
  return Math.min(100, Math.floor((pig.currentAmount / pig.targetAmount) * 100));
}

function getGrowthClass(progress) {
  if (progress >= 100) return "growth-100";
  if (progress >= 75) return "growth-75";
  if (progress >= 50) return "growth-50";
  if (progress >= 25) return "growth-25";
  return "growth-0";
}

function getGrowthStage(progress) {
  if (progress >= 100) return "100";
  if (progress >= 75) return "75";
  if (progress >= 50) return "50";
  if (progress >= 25) return "25";
  return "0";
}

function getPigImage(pigType, progress) {
  const stage = getGrowthStage(progress);
  return pigType.images?.[stage] || pigType.image || "assets/pigs/100/dream.webp";
}


function getDaysSpent(createdAt, unlockedAt) {
  const start = new Date(createdAt).getTime();
  const end = new Date(unlockedAt).getTime();
  const diff = Math.max(0, end - start);
  return Math.max(1, Math.ceil(diff / 86400000));
}

function formatCurrency(value) {
  return `NT$ ${new Intl.NumberFormat("zh-TW").format(value)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function hexToRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((char) => char + char).join("") : value;
  const number = parseInt(normalized, 16);
  const r = (number >> 16) & 255;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `pig-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}
