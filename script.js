/**
 * 九九乘法大亂鬥 - 遊戲核心邏輯
 */

// 1. 全域狀態管理
const gameState = {
  started: false,
  ended: false,
  difficulty: 'easy',       // easy (1-5), medium (1-9), hard (交換題)
  displayMode: 'normal',     // normal, tablet
  soundEnabled: true,
  p1: {
    hp: 7,
    maxHp: 7,
    question: null,
    options: [],
    correctAnswer: 0,
    isLocked: false,
    spiritStyle: null
  },
  p2: {
    hp: 7,
    maxHp: 7,
    question: null,
    options: [],
    correctAnswer: 0,
    isLocked: false,
    spiritStyle: null
  }
};

// 顏色清單與表情池
const COLOR_PALETTES = [
  { body: '#ff5964', text: '#fff' },
  { body: '#ff924c', text: '#222' },
  { body: '#ffca3a', text: '#222' },
  { body: '#8ac926', text: '#222' },
  { body: '#1982c4', text: '#fff' },
  { body: '#6a4c93', text: '#fff' },
  { body: '#06d6a0', text: '#111' },
  { body: '#f72585', text: '#fff' },
  { body: '#4cc9f0', text: '#111' }
];

const SPIRIT_FACES = [
  { eyes: '◕ ◕', mouth: '▽' },
  { eyes: '✧ ✧', mouth: 'ω' },
  { eyes: '≧ ≦', mouth: '▽' },
  { eyes: '•̀ •́', mouth: 'و' },
  { eyes: '^ ^', mouth: '▽' },
  { eyes: '◉ ◉', mouth: 'o' },
  { eyes: '• ‿ •', mouth: '‿' }
];

// 2. Web Audio API 音效引擎
class SoundEngine {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCorrect() {
    if (!gameState.soundEnabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    // 雙和弦清脆高音
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.15, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.26);
    });
  }

  playWrong() {
    if (!gameState.soundEnabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playLaser() {
    if (!gameState.soundEnabled || !this.ctx) return;
    this.init();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.18);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playWin() {
    if (!gameState.soundEnabled || !this.ctx) return;
    this.init();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const now = this.ctx.currentTime;
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      gain.gain.setValueAtTime(0.12, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.36);
    });
  }
}

const audio = new SoundEngine();

// 3. 亂數與乘法題庫生成
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateQuestion(difficulty) {
  let a, b;
  if (difficulty === 'easy') {
    a = getRandomInt(1, 5);
    b = getRandomInt(1, 5);
  } else if (difficulty === 'medium') {
    a = getRandomInt(1, 9);
    b = getRandomInt(1, 9);
  } else {
    // 困難：全部九九乘法，高機率出現乘數交換
    a = getRandomInt(2, 9);
    b = getRandomInt(2, 9);
  }

  const correct = a * b;
  const options = generateOptions(correct, difficulty);

  return {
    a,
    b,
    correctAnswer: correct,
    options: options,
    latex: `\\( ${a} \\times ${b} = ? \\)`
  };
}

function generateOptions(correctAnswer, difficulty) {
  const optionsSet = new Set([correctAnswer]);
  const maxRange = difficulty === 'easy' ? 25 : 81;

  // 鄰近混淆項 (±1, ±2, ±10, 或相似數字)
  const candidateDeltas = [-2, -1, 1, 2, -10, 10, -5, 5];

  for (let delta of candidateDeltas) {
    if (optionsSet.size >= 4) break;
    const fake = correctAnswer + delta;
    if (fake >= 1 && fake <= maxRange && fake !== correctAnswer) {
      optionsSet.add(fake);
    }
  }

  // 若不足 4 個，產生合理乘法數值補齊
  while (optionsSet.size < 4) {
    let randA = getRandomInt(1, difficulty === 'easy' ? 5 : 9);
    let randB = getRandomInt(1, difficulty === 'easy' ? 5 : 9);
    let val = randA * randB;
    if (val >= 1 && val <= maxRange) {
      optionsSet.add(val);
    }
  }

  return shuffleArray(Array.from(optionsSet));
}

// 4. 動態小精靈外觀生成
function createRandomSpiritStyle(excludeColor = null) {
  let availableColors = COLOR_PALETTES;
  if (excludeColor) {
    availableColors = COLOR_PALETTES.filter(c => c.body !== excludeColor);
  }
  const color = availableColors[getRandomInt(0, availableColors.length - 1)];
  const face = SPIRIT_FACES[getRandomInt(0, SPIRIT_FACES.length - 1)];
  return { color, face };
}

function applySpiritStyle(playerKey, style) {
  const spiritEl = document.getElementById(`${playerKey}-spirit`);
  const eyesEl = document.getElementById(`${playerKey}-spirit-eyes`);
  const mouthEl = document.getElementById(`${playerKey}-spirit-mouth`);

  if (spiritEl && eyesEl && mouthEl) {
    spiritEl.style.backgroundColor = style.color.body;
    eyesEl.textContent = style.face.eyes;
    mouthEl.textContent = style.face.mouth;
  }
}

// 5. 渲染生命值與題目
function renderHealth(playerKey) {
  const hp = gameState[playerKey].hp;
  const maxHp = gameState[playerKey].maxHp;
  const bar = document.getElementById(`${playerKey}-health`);
  bar.innerHTML = '';

  for (let i = 0; i < maxHp; i++) {
    const heart = document.createElement('span');
    heart.className = `heart-icon ${i >= hp ? 'lost' : ''}`;
    heart.textContent = '❤️';
    bar.appendChild(heart);
  }
}

function renderQuestion(playerKey) {
  const player = gameState[playerKey];
  const qData = generateQuestion(gameState.difficulty);

  player.question = qData;
  player.correctAnswer = qData.correctAnswer;
  player.options = qData.options;
  player.isLocked = false;

  const qEl = document.getElementById(`${playerKey}-question`);
  qEl.innerHTML = qData.latex;

  // MathJax 排版
  if (window.MathJax && window.MathJax.typesetPromise) {
    try {
      MathJax.typesetClear([qEl]);
      MathJax.typesetPromise([qEl]).catch((err) => {
        // 安全降級：直接以文字呈現
        qEl.innerText = `${qData.a} × ${qData.b} = ?`;
      });
    } catch (e) {
      qEl.innerText = `${qData.a} × ${qData.b} = ?`;
    }
  } else {
    qEl.innerText = `${qData.a} × ${qData.b} = ?`;
  }

  // 渲染四個按鈕
  const btnGroup = document.querySelectorAll(`#${playerKey}-options .btn-option`);
  btnGroup.forEach((btn, idx) => {
    btn.textContent = player.options[idx];
    btn.className = 'btn-option';
    btn.disabled = false;
  });

  // 清除提示回饋
  const feedbackEl = document.getElementById(`${playerKey}-feedback`);
  feedbackEl.textContent = '';
  feedbackEl.className = 'feedback-text';
}

// 6. 答題回饋處理 (答對 / 答錯)
function handleAnswer(playerKey, chosenIndex) {
  if (gameState.ended || !gameState.started) return;
  const player = gameState[playerKey];
  if (player.isLocked) return;

  player.isLocked = true;
  const opponentKey = playerKey === 'p1' ? 'p2' : 'p1';
  const chosenValue = player.options[chosenIndex];
  const isCorrect = (chosenValue === player.correctAnswer);

  const btns = document.querySelectorAll(`#${playerKey}-options .btn-option`);
  btns.forEach(b => b.disabled = true);

  const feedbackEl = document.getElementById(`${playerKey}-feedback`);
  const mySpirit = document.getElementById(`${playerKey}-spirit`);
  const opponentSpirit = document.getElementById(`${opponentKey}-spirit`);

  if (isCorrect) {
    // 答對邏輯
    btns[chosenIndex].classList.add('correct-btn');
    feedbackEl.textContent = '太棒了！答對了！🌟';
    feedbackEl.classList.add('correct');

    audio.playCorrect();
    audio.playLaser();

    // 自身小精靈跳動
    mySpirit.classList.remove('idle');
    mySpirit.classList.add('correct-jump');
    setTimeout(() => {
      mySpirit.classList.remove('correct-jump');
      mySpirit.classList.add('idle');
    }, 450);

    // 扣除對手 1 點生命值
    gameState[opponentKey].hp = Math.max(0, gameState[opponentKey].hp - 1);
    renderHealth(opponentKey);

    // 特效：雷射、全螢幕閃爍、答對半邊花瓣雨
    triggerLaser(playerKey, opponentKey);
    triggerFlash();
    triggerPetals(playerKey);

    // 對手受擊晃動
    setTimeout(() => {
      opponentSpirit.classList.remove('idle');
      opponentSpirit.classList.add('hit-shake');
      setTimeout(() => {
        opponentSpirit.classList.remove('hit-shake');
        opponentSpirit.classList.add('idle');
      }, 400);
    }, 180);

  } else {
    // 答錯邏輯：自己扣 1 點血，不發動攻擊
    btns[chosenIndex].classList.add('wrong-btn');
    feedbackEl.textContent = `答錯囉！正確答案是 ${player.correctAnswer}`;
    feedbackEl.classList.add('wrong');

    audio.playWrong();

    // 扣除自己 1 點生命值
    player.hp = Math.max(0, player.hp - 1);
    renderHealth(playerKey);

    // 自己小精靈難過震動
    mySpirit.classList.remove('idle');
    mySpirit.classList.add('hit-shake');
    setTimeout(() => {
      mySpirit.classList.remove('hit-shake');
      mySpirit.classList.add('idle');
    }, 400);
  }

  // 判定是否結束
  if (gameState.p1.hp <= 0 || gameState.p2.hp <= 0) {
    setTimeout(() => {
      checkGameOver();
    }, 500);
    return;
  }

  // 0.85 秒後更新為新題目
  setTimeout(() => {
    if (!gameState.ended) {
      renderQuestion(playerKey);
    }
  }, 850);
}

// 7. 特效實作：雷射、全螢幕閃光、專屬花瓣雨
function triggerFlash() {
  const flash = document.getElementById('flash-overlay');
  flash.classList.remove('active');
  // 強制重繪觸發動畫
  void flash.offsetWidth;
  flash.classList.add('active');
  setTimeout(() => {
    flash.classList.remove('active');
  }, 500);
}

function triggerLaser(fromKey, toKey) {
  const fromEl = document.getElementById(`${fromKey}-spirit`);
  const toEl = document.getElementById(`${toKey}-spirit`);
  const layer = document.getElementById('laser-layer');
  if (!fromEl || !toEl || !layer) return;

  const rectFrom = fromEl.getBoundingClientRect();
  const rectTo = toEl.getBoundingClientRect();

  const startX = rectFrom.left + rectFrom.width / 2;
  const startY = rectFrom.top + rectFrom.height / 2;
  const endX = rectTo.left + rectTo.width / 2;
  const endY = rectTo.top + rectTo.height / 2;

  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const distance = Math.hypot(deltaX, deltaY);
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

  const beam = document.createElement('div');
  beam.className = 'laser-beam';
  beam.style.left = `${startX}px`;
  beam.style.top = `${startY}px`;
  beam.style.width = '0px';
  beam.style.transform = `rotate(${angle}deg)`;

  layer.appendChild(beam);

  // 動態推進光束
  requestAnimationFrame(() => {
    beam.style.transition = 'width 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.15s ease-out 0.15s';
    beam.style.width = `${distance}px`;
  });

  setTimeout(() => {
    beam.style.opacity = '0';
    setTimeout(() => {
      beam.remove();
    }, 150);
  }, 220);
}

function triggerPetals(playerKey) {
  const box = document.getElementById(`${playerKey}-petal-box`);
  if (!box) return;

  const petalColors = ['#ff99c8', '#fcf6bd', '#d0f4de', '#a9def9', '#e4c1f9'];
  const count = 16; // 柔和適量，避免低階裝置掉幀

  for (let i = 0; i < count; i++) {
    const petal = document.createElement('div');
    petal.className = 'petal';
    const size = getRandomInt(10, 18);
    petal.style.width = `${size}px`;
    petal.style.height = `${size * 1.3}px`;
    petal.style.left = `${getRandomInt(5, 95)}%`;
    petal.style.backgroundColor = petalColors[getRandomInt(0, petalColors.length - 1)];
    const duration = (getRandomInt(12, 22) / 10);
    const delay = (getRandomInt(0, 6) / 10);
    petal.style.animationDuration = `${duration}s`;
    petal.style.animationDelay = `${delay}s`;

    box.appendChild(petal);

    setTimeout(() => {
      petal.remove();
    }, (duration + delay) * 1000 + 100);
  }
}

// 8. 勝負判定與遊戲結算
function checkGameOver() {
  if (gameState.ended) return;

  if (gameState.p1.hp <= 0 || gameState.p2.hp <= 0) {
    gameState.ended = true;
    let winnerName = '';
    let winnerStyle = null;

    if (gameState.p1.hp <= 0 && gameState.p2.hp <= 0) {
      winnerName = '雙方平手！';
    } else if (gameState.p1.hp <= 0) {
      winnerName = '🎉 玩家 2 獲勝！ 🎉';
      winnerStyle = gameState.p2.spiritStyle;
    } else {
      winnerName = '🎉 玩家 1 獲勝！ 🎉';
      winnerStyle = gameState.p1.spiritStyle;
    }

    audio.playWin();

    // 禁用所有按鈕
    document.querySelectorAll('.btn-option').forEach(b => b.disabled = true);

    // 呈現勝利彈窗
    const modal = document.getElementById('game-over-modal');
    const winnerTitle = document.getElementById('winner-title');
    const slot = document.getElementById('winner-celebration');

    winnerTitle.textContent = winnerName;
    slot.innerHTML = '';

    if (winnerStyle) {
      const clone = document.createElement('div');
      clone.className = 'spirit idle';
      clone.style.backgroundColor = winnerStyle.color.body;
      clone.innerHTML = `
        <div class="spirit-face">
          <div class="spirit-eyes">${winnerStyle.face.eyes}</div>
          <div class="spirit-mouth">▽</div>
        </div>
      `;
      slot.appendChild(clone);
    }

    modal.classList.remove('hidden');
  }
}

// 9. 遊戲啟動與重設
function startGame() {
  audio.init();
  gameState.started = true;
  gameState.ended = false;

  // 重設血量
  gameState.p1.hp = 7;
  gameState.p2.hp = 7;

  // 隨機生成兩隻不同風格的小精靈
  gameState.p1.spiritStyle = createRandomSpiritStyle();
  gameState.p2.spiritStyle = createRandomSpiritStyle(gameState.p1.spiritStyle.color.body);

  applySpiritStyle('p1', gameState.p1.spiritStyle);
  applySpiritStyle('p2', gameState.p2.spiritStyle);

  renderHealth('p1');
  renderHealth('p2');

  // 切換版面排版
  const arena = document.getElementById('players-arena');
  if (gameState.displayMode === 'tablet') {
    arena.classList.add('tablet-layout');
    arena.classList.remove('normal-layout');
  } else {
    arena.classList.add('normal-layout');
    arena.classList.remove('tablet-layout');
  }

  // 隱藏選單，顯示戰鬥
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('game-over-modal').classList.add('hidden');
  document.getElementById('battle-screen').classList.remove('hidden');

  // 渲染第一道題目
  renderQuestion('p1');
  renderQuestion('p2');
}

function returnToHome() {
  gameState.started = false;
  gameState.ended = true;
  document.getElementById('battle-screen').classList.add('hidden');
  document.getElementById('game-over-modal').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
}

// 10. 事件監聽綁定
document.addEventListener('DOMContentLoaded', () => {
  // 難度選擇
  const diffBtns = document.querySelectorAll('#difficulty-select .btn-select');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      diffBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      gameState.difficulty = btn.dataset.val;
    });
  });

  // 模式選擇
  const modeBtns = document.querySelectorAll('#mode-select .btn-select');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      gameState.displayMode = btn.dataset.val;
    });
  });

  // 音效開關
  const soundToggle = document.getElementById('sound-toggle');
  soundToggle.addEventListener('change', (e) => {
    gameState.soundEnabled = e.target.checked;
    updateInGameSoundBtn();
  });

  const inSoundBtn = document.getElementById('btn-in-sound');
  function updateInGameSoundBtn() {
    inSoundBtn.textContent = gameState.soundEnabled ? '🔊 音效' : '🔇 靜音';
  }
  inSoundBtn.addEventListener('click', () => {
    gameState.soundEnabled = !gameState.soundEnabled;
    soundToggle.checked = gameState.soundEnabled;
    updateInGameSoundBtn();
  });

  // 開始遊戲與規則說明
  document.getElementById('btn-start').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-back-home').addEventListener('click', returnToHome);
  document.getElementById('btn-return-home').addEventListener('click', returnToHome);

  const rulesModal = document.getElementById('rules-modal');
  document.getElementById('btn-rules').addEventListener('click', () => {
    rulesModal.classList.remove('hidden');
  });
  document.getElementById('btn-close-rules').addEventListener('click', () => {
    rulesModal.classList.add('hidden');
  });

  // 雙方四個選項事件委派
  ['p1', 'p2'].forEach(playerKey => {
    const opts = document.querySelectorAll(`#${playerKey}-options .btn-option`);
    opts.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleAnswer(playerKey, index);
      });
    });
  });

  // 鍵盤無障礙支援 (玩家1: 數字鍵 1~4，玩家2: 鍵盤 7,8,9,0)
  window.addEventListener('keydown', (e) => {
    if (!gameState.started || gameState.ended) return;
    const keyMapP1 = { '1': 0, '2': 1, '3': 2, '4': 3 };
    const keyMapP2 = { '7': 0, '8': 1, '9': 2, '0': 3 };

    if (keyMapP1[e.key] !== undefined) {
      handleAnswer('p1', keyMapP1[e.key]);
    } else if (keyMapP2[e.key] !== undefined) {
      handleAnswer('p2', keyMapP2[e.key]);
    }
  });
});