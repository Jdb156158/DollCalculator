import { Backdrop } from './backdrop.js';

const $ = (selector) => document.querySelector(selector);
const game = $('#game');
const backdrop = new Backdrop($('#backdropCanvas'));
const card = $('#questionCard');
const plush = $('#plushGroup');
const feedback = $('#feedback');
const answerSlots = $('#answerSlots');
const dots = $('#progressDots');
const soundButton = $('#soundButton');
const settingsOverlay = $('#settingsOverlay');
const canvas = $('#confettiCanvas');
const paint = canvas.getContext('2d');
const armLayer = $('#armLayer');
const arms = [...armLayer.querySelectorAll('.arm')].map((element, i) => ({ element, side: i ? 1 : -1, x: null, y: null, digit: '' }));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const dotColors = ['#4874ff', '#5d8bff', '#b992ff', '#83dfd0', '#ffe27b', '#ff8ebb', '#777bff', '#8fd8ee', '#ffe27b', '#ff8ebb'];

let questions = [];
let index = 0;
let correct = 0;
let misses = 0;
let combo = 0;
let joy = 0;
let goodDigits = '';
let wrongDigit = '';
let locked = false;
let gameVersion = 0;
let startedAt = null;
let elapsed = 0;
let audioContext;
let musicLoop;
let beat = 0;
let soundOn = true;
let particles = [];
let rings = [];
let particleFrame = 0;
const savedAge = localStorage.getItem('dollCalculatorAge');
let selectedAge = ['4-5', '6-7', '8+'].includes(savedAge) ? savedAge : '6-7';
const dollNames = { rabbit: '棉棉兔', bear: '布丁熊', cat: '泡泡猫' };
const savedDoll = localStorage.getItem('dollCalculatorDoll');
let selectedDoll = dollNames[savedDoll] ? savedDoll : 'rabbit';

function makeQuestions() {
  const first = selectedAge === '4-5' ? { a: 5, b: 2, sign: '−', answer: 3 }
    : selectedAge === '8+' ? { a: 42, b: 17, sign: '−', answer: 25 }
      : { a: 14, b: 5, sign: '−', answer: 9 };
  const list = [first];
  while (list.length < 10) {
    const subtract = Math.random() < .52;
    let a;
    let b;
    if (selectedAge === '4-5') {
      a = subtract ? 2 + Math.floor(Math.random() * 9) : 1 + Math.floor(Math.random() * 8);
      b = subtract ? 1 + Math.floor(Math.random() * (a - 1)) : 1 + Math.floor(Math.random() * (10 - a));
    } else if (selectedAge === '8+') {
      a = subtract ? 30 + Math.floor(Math.random() * 70) : 12 + Math.floor(Math.random() * 68);
      b = subtract ? 10 + Math.floor(Math.random() * (a - 19)) : 10 + Math.floor(Math.random() * (90 - a));
    } else if (subtract) {
      a = 10 + Math.floor(Math.random() * 11);
      b = 2 + Math.floor(Math.random() * 8);
    } else {
      a = 3 + Math.floor(Math.random() * 13);
      b = 2 + Math.floor(Math.random() * (Math.min(9, 20 - a) - 1));
    }
    const answer = subtract ? a - b : a + b;
    if (list.some((q) => q.a === a && q.b === b && q.sign === (subtract ? '−' : '+'))) continue;
    list.push({ a, b, sign: subtract ? '−' : '+', answer });
  }
  return list;
}

function timeText(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderDots() {
  dots.innerHTML = '';
  for (let i = 0; i < 10; i++) {
    const dot = document.createElement('span');
    dot.className = `progress-dot${i < correct ? ' done' : ''}${i === index && !locked ? ' current' : ''}`;
    dot.style.setProperty('--dot-color', dotColors[i]);
    dots.append(dot);
  }
  dots.setAttribute('aria-label', `已完成 ${correct} 题，共 10 题`);
}

function renderAnswer() {
  const expected = String(questions[index].answer);
  answerSlots.innerHTML = '';
  for (let i = 0; i < expected.length; i++) {
    const slot = document.createElement('span');
    slot.className = 'answer-slot';
    if (i < goodDigits.length) {
      slot.textContent = goodDigits[i];
      slot.classList.add('filled');
    } else if (i === goodDigits.length) {
      slot.classList.add(wrongDigit ? 'bad' : 'active');
      if (wrongDigit) slot.textContent = wrongDigit;
    }
    answerSlots.append(slot);
  }
}

function renderQuestion() {
  const q = questions[index];
  $('#category').textContent = q.sign === '−' ? '减法小练习' : '加法小练习';
  $('#questionNumber').textContent = `第 ${index + 1} 题`;
  $('#leftNumber').textContent = q.a;
  $('#rightNumber').textContent = q.b;
  $('#operator').textContent = q.sign;
  $('#equation').setAttribute('aria-label', `${q.a}${q.sign === '−' ? '减' : '加'}${q.b}等于多少`);
  goodDigits = '';
  wrongDigit = '';
  setFeedback(`点按数字，帮${dollNames[selectedDoll]}找答案`);
  $('#successStamp').classList.remove('show');
  renderAnswer();
  renderDots();
  updateLevel();
}

function setFeedback(text, style = '') {
  feedback.textContent = text;
  feedback.className = `feedback${style ? ` ${style}` : ''}`;
}

function flash(element, className, duration = 650) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), duration);
}

function updateLevel() {
  game.dataset.level = correct >= 7 ? '3' : correct >= 4 ? '2' : '1';
  game.style.setProperty('--energy', (correct / 10).toFixed(2));
  game.style.setProperty('--spin-time', `${Math.max(12, 48 - correct * 4)}s`);
  backdrop.targetEnergy = .08 + .92 * (Math.min(correct, 9) / 9) ** 1.3;
}

function drawBackdrop(time) {
  const state = backdrop.state;
  state.E += (backdrop.targetEnergy - state.E) * .045;
  state.kick = reducedMotion.matches ? 0 : Math.max(0, Math.sin(time * .0131)) ** 8;
  state.flash *= .91;
  state.reach += ((plush.classList.contains('reaching') ? 1 : 0) - state.reach) * .12;
  state.hue = reducedMotion.matches ? 0 : time * .00003;
  state.cx = game.clientWidth / 2;
  state.cy = $('#stage').offsetTop + $('#stage').clientHeight * .55;
  backdrop.render(reducedMotion.matches ? 0 : time);
  requestAnimationFrame(drawBackdrop);
}

function updateStats() {
  $('#correctCount').textContent = correct;
  $('#missCount').textContent = misses;
  $('#joyCount').textContent = joy;
  $('#comboCount').textContent = combo;
  $('#comboPill').hidden = combo < 2;
  flash($('.joy-pill'), 'pop', 390);
  renderDots();
}

function startAudio() {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    if (!musicLoop) musicLoop = window.setInterval(playBeat, 480);
  } catch { /* Sound is optional when Web Audio is unavailable. */ }
}

function tone(frequency, duration = .12, kind = 'sine', volume = .06, delay = 0) {
  if (!soundOn || !audioContext) return;
  const at = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = kind;
  oscillator.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + .02);
}

function playBeat() {
  if (!soundOn || !audioContext || $('#resultOverlay').hidden === false) return;
  const melody = [523, 659, 784, 659, 587, 698, 880, 698];
  const level = Number(game.dataset.level || 1);
  if (beat % 2 === 0 || level >= 2) tone(melody[beat % melody.length], .15, 'triangle', .013);
  if (level >= 2 && beat % 2 === 0) tone(melody[beat % melody.length] / 2, .2, 'sine', .018);
  if (level >= 3 && beat % 4 === 0) tone(melody[beat % melody.length] * 1.5, .24, 'sine', .01);
  beat++;
}

function playCorrect() {
  const pitch = Math.min(combo, 8) * 30;
  tone(590 + pitch, .13, 'triangle', .065);
  tone(790 + pitch, .15, 'triangle', .06, .1);
  tone(1020 + pitch, .23, 'sine', .05, .2);
}

function playWrong() {
  tone(320, .1, 'triangle', .04);
  tone(240, .19, 'triangle', .035, .1);
}

function centerOf(element) {
  const rect = element.getBoundingClientRect();
  const bounds = game.getBoundingClientRect();
  return { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2 };
}

function plushPoint(x, y) {
  const rect = $('.plush').getBoundingClientRect();
  const bounds = game.getBoundingClientRect();
  return { x: rect.left - bounds.left + x / 240 * rect.width, y: rect.top - bounds.top + y / 228 * rect.height };
}

function drawArms() {
  const bounds = game.getBoundingClientRect();
  armLayer.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
  for (const arm of arms) {
    const shoulder = plushPoint(arm.side < 0 ? 71 : 169, 165);
    const rest = plushPoint(arm.side < 0 ? 61 : 179, 180);
    const hand = arm.x === null ? rest : { x: arm.x, y: arm.y };
    const midX = (shoulder.x + hand.x) / 2 + arm.side * (arm.x === null ? 6 : 34);
    const midY = (shoulder.y + hand.y) / 2 + (arm.x === null ? 12 : Math.min(34, Math.abs(hand.y - shoulder.y) * .09));
    const path = `M${shoulder.x} ${shoulder.y} Q${midX} ${midY} ${hand.x} ${hand.y}`;
    arm.element.querySelector('.arm-outline').setAttribute('d', path);
    arm.element.querySelector('.arm-fill').setAttribute('d', path);
    arm.element.querySelector('.arm-hand').setAttribute('cx', hand.x);
    arm.element.querySelector('.arm-hand').setAttribute('cy', hand.y);
    const token = arm.element.querySelector('.held-token');
    token.setAttribute('visibility', arm.digit ? 'visible' : 'hidden');
    if (arm.digit) {
      token.setAttribute('transform', `translate(${hand.x} ${hand.y - 23})`);
      token.querySelector('text').textContent = arm.digit;
    }
  }
  requestAnimationFrame(drawArms);
}

function moveHand(arm, from, to, duration, control) {
  return new Promise((resolve) => {
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const k = t * t * (3 - 2 * t);
      if (control) {
        arm.x = (1 - k) ** 2 * from.x + 2 * (1 - k) * k * control.x + k ** 2 * to.x;
        arm.y = (1 - k) ** 2 * from.y + 2 * (1 - k) * k * control.y + k ** 2 * to.y;
      } else {
        arm.x = from.x + (to.x - from.x) * k;
        arm.y = from.y + (to.y - from.y) * k;
      }
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

async function carryDigit(digit, button, slot, isCorrect) {
  if (reducedMotion.matches || document.hidden || !button) return;
  const from = centerOf(button);
  const to = centerOf(slot);
  const arm = arms[from.x < game.clientWidth / 2 ? 0 : 1];
  const rest = plushPoint(arm.side < 0 ? 61 : 179, 180);
  arm.x = rest.x;
  arm.y = rest.y;
  plush.classList.add('reaching');
  await moveHand(arm, rest, from, 130);
  arm.digit = digit;
  button.classList.add('picked');
  tone(870, .07, 'sine', .035);
  const control = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 45 };
  await moveHand(arm, from, to, 280, control);
  arm.digit = '';
  button.classList.remove('picked');
  slot.textContent = digit;
  slot.classList.remove('active');
  slot.classList.add(isCorrect ? 'filled' : 'bad');
  tone(620, .09, 'triangle', .035);
  const home = plushPoint(arm.side < 0 ? 61 : 179, 180);
  await moveHand(arm, to, home, 140);
  arm.x = null;
  arm.y = null;
  plush.classList.remove('reaching');
}

async function receiveDigit(digit, button) {
  if (locked || !$('#resultOverlay').hidden) return;
  const version = gameVersion;
  locked = true;
  startedAt ||= Date.now();
  startAudio();
  if (button) flash(button, 'pressed', 120);
  const expected = String(questions[index].answer);
  const next = expected[goodDigits.length];
  await carryDigit(digit, button, answerSlots.children[goodDigits.length], digit === next);
  if (version !== gameVersion) return;

  if (digit !== next) {
    wrongDigit = digit;
    misses++;
    combo = 0;
    renderAnswer();
    updateStats();
    setFeedback('再试一次，你快找到答案啦', 'error');
    flash(card, 'wrong', 400);
    flash(plush, 'oops', 470);
    playWrong();
    locked = false;
    return;
  }

  wrongDigit = '';
  goodDigits += digit;
  combo++;
  joy += 2 + Math.min(5, combo);
  renderAnswer();
  updateStats();
  tone(510 + combo * 35, .08, 'sine', .04);
  setFeedback(goodDigits.length < expected.length ? '很好！再填一个数字' : '答对啦！', 'win');

  if (goodDigits.length < expected.length) { locked = false; return; }
  correct++;
  updateStats();
  updateLevel();
  flash(card, 'correct', 700);
  flash(plush, 'happy', 700);
  $('#successStamp').classList.add('show');
  playCorrect();
  backdrop.state.flash = reducedMotion.matches ? 0 : .75;
  flash(game, 'impact', 560);
  burst(correct === 10 ? 90 : 20 + correct * 5);
  if (correct >= 6) {
    const side = correct % 2 ? .18 : .82;
    burst(12 + correct * 2, { x: game.clientWidth * side, y: game.clientHeight * .22 });
  }
  window.setTimeout(() => {
    if (version !== gameVersion) return;
    if (correct === 10) showResult();
    else { index++; locked = false; renderQuestion(); }
  }, correct === 10 ? 1450 : 1150);
}

function deleteWrong() {
  if (locked || !$('#resultOverlay').hidden) return;
  if (wrongDigit) {
    wrongDigit = '';
    renderAnswer();
    setFeedback('再选一个数字吧');
    tone(410, .08, 'sine', .03);
  }
}

function resizeCanvas() {
  const rect = game.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  paint.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function burst(count, origin) {
  if (reducedMotion.matches) return;
  const from = plush.getBoundingClientRect();
  const bounds = game.getBoundingClientRect();
  const centerX = origin?.x ?? from.left - bounds.left + from.width / 2;
  const centerY = origin?.y ?? from.top - bounds.top + from.height * .48;
  const colors = ['#ff72ac', '#ffe17a', '#5e86ff', '#84dec6', '#b994ff', '#ffffff'];
  rings.push({ x: centerX, y: centerY, age: 0, color: correct >= 6 ? '#fff5a9' : '#ffffff' });
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * (correct > 6 ? 8 : 6);
    particles.push({ x: centerX, y: centerY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
      life: 55 + Math.random() * 35, age: 0, size: 3 + Math.random() * 5, rotation: Math.random() * 6,
      spin: (Math.random() - .5) * .22, color: colors[Math.floor(Math.random() * colors.length)],
      star: Math.random() < .22 });
  }
  if (correct >= 7 && !origin) {
    for (let i = 0; i < 10 + correct * 2; i++) {
      particles.push({ x: Math.random() * bounds.width, y: -20 - Math.random() * 80,
        vx: (Math.random() - .5) * 2, vy: 2 + Math.random() * 2, life: 120, age: 0,
        size: 3 + Math.random() * 5, rotation: Math.random() * 6, spin: (Math.random() - .5) * .2,
        color: colors[Math.floor(Math.random() * colors.length)], star: Math.random() < .18 });
    }
  }
  if (!particleFrame) particleFrame = requestAnimationFrame(drawParticles);
}

function drawParticles() {
  const { width, height } = game.getBoundingClientRect();
  paint.clearRect(0, 0, width, height);
  rings = rings.filter((ring) => ring.age < 30);
  for (const ring of rings) {
    ring.age++;
    paint.beginPath();
    paint.arc(ring.x, ring.y, 10 + ring.age * 7, 0, Math.PI * 2);
    paint.strokeStyle = ring.color;
    paint.globalAlpha = (1 - ring.age / 30) * .75;
    paint.lineWidth = 3 + correct / 3;
    paint.stroke();
  }
  paint.globalAlpha = 1;
  particles = particles.filter((p) => p.age < p.life && p.y < height + 20);
  for (const p of particles) {
    p.age++;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += .16;
    p.vx *= .994;
    p.rotation += p.spin;
    paint.save();
    paint.translate(p.x, p.y);
    paint.rotate(p.rotation);
    paint.globalAlpha = Math.min(1, (p.life - p.age) / 18);
    paint.fillStyle = p.color;
    paint.strokeStyle = '#1b2048';
    paint.lineWidth = 1.2;
    if (p.star) {
      paint.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? p.size * .45 : p.size;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        if (i === 0) paint.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else paint.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      paint.closePath();
    } else {
      paint.beginPath();
      paint.rect(-p.size / 2, -p.size / 2, p.size, p.size * .75);
    }
    paint.fill();
    paint.stroke();
    paint.restore();
  }
  particleFrame = particles.length || rings.length ? requestAnimationFrame(drawParticles) : 0;
}

function showResult() {
  locked = true;
  elapsed = Math.floor((Date.now() - startedAt) / 1000);
  $('#finalJoy').textContent = joy;
  $('#finalCorrect').textContent = correct;
  $('#finalMiss').textContent = misses;
  $('#finalTime').textContent = timeText(elapsed);
  $('#resultOverlay').hidden = false;
  $('#replayButton').focus();
  tone(784, .18, 'triangle', .07);
  tone(988, .22, 'triangle', .07, .13);
  tone(1175, .4, 'triangle', .07, .27);
  backdrop.state.flash = reducedMotion.matches ? 0 : 1;
  burst(100);
}

function reset() {
  gameVersion++;
  questions = makeQuestions();
  index = 0;
  correct = 0;
  misses = 0;
  combo = 0;
  joy = 0;
  locked = false;
  startedAt = null;
  elapsed = 0;
  $('#timer').textContent = '0:00';
  $('#resultOverlay').hidden = true;
  updateStats();
  renderQuestion();
}

function renderAgeSettings() {
  document.querySelectorAll('.age-option').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.age === selectedAge));
  });
  $('#settingsNote').textContent = '切换年龄会重新开始十题；玩偶立即切换';
  $('#settingsButton').setAttribute('aria-label', `打开设置，当前 ${selectedAge === '8+' ? '8 岁以上' : `${selectedAge} 岁`}`);
}

function renderDoll() {
  const name = dollNames[selectedDoll];
  game.dataset.doll = selectedDoll;
  $('.plush').setAttribute('aria-label', `原创玩偶${name}`);
  $('#stage').setAttribute('aria-label', `${name}和星星玩偶`);
  $('.settings-eyebrow').textContent = `和${name}一起玩`;
  $('#resultTitle').textContent = `你和${name}太棒啦！`;
  document.title = `玩偶计算器 · ${name}`;
  document.querySelectorAll('.doll-option').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.doll === selectedDoll));
  });
  if (feedback.textContent.startsWith('点按数字')) setFeedback(`点按数字，帮${name}找答案`);
}

function closeSettings() {
  settingsOverlay.hidden = true;
  $('#settingsButton').focus();
}

$('#settingsButton').addEventListener('click', () => {
  if (!$('#resultOverlay').hidden) return;
  renderAgeSettings();
  settingsOverlay.hidden = false;
  $('#settingsClose').focus();
});
$('#settingsClose').addEventListener('click', closeSettings);
$('#settingsDone').addEventListener('click', closeSettings);
settingsOverlay.addEventListener('click', (event) => {
  if (event.target === settingsOverlay) closeSettings();
});
$('.age-options').addEventListener('click', (event) => {
  const button = event.target.closest('.age-option');
  if (!button || button.dataset.age === selectedAge) return;
  selectedAge = button.dataset.age;
  localStorage.setItem('dollCalculatorAge', selectedAge);
  reset();
  renderAgeSettings();
});
$('.doll-options').addEventListener('click', (event) => {
  const button = event.target.closest('.doll-option');
  if (!button) return;
  selectedDoll = button.dataset.doll;
  localStorage.setItem('dollCalculatorDoll', selectedDoll);
  renderDoll();
});

$('#keypad').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'delete') deleteWrong();
  else receiveDigit(button.dataset.digit, button);
});

document.addEventListener('keydown', (event) => {
  if (!settingsOverlay.hidden) {
    if (event.key === 'Escape') closeSettings();
    if (event.key === 'Tab') {
      const buttons = [...settingsOverlay.querySelectorAll('button')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    return;
  }
  if (!$('#resultOverlay').hidden) {
    if (event.key === 'Enter') $('#replayButton').click();
    return;
  }
  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault();
    receiveDigit(event.key, $(`[data-digit="${event.key}"]`));
  } else if (event.key === 'Backspace' || event.key === 'Delete') {
    event.preventDefault();
    deleteWrong();
  }
});

soundButton.addEventListener('click', () => {
  soundOn = !soundOn;
  soundButton.setAttribute('aria-pressed', String(soundOn));
  soundButton.setAttribute('aria-label', soundOn ? '关闭音效' : '开启音效');
  soundButton.textContent = soundOn ? '♫' : '♪';
  if (soundOn) { startAudio(); tone(660, .12, 'triangle', .05); }
});

$('#replayButton').addEventListener('click', reset);
window.setInterval(() => {
  if ($('#resultOverlay').hidden && startedAt) {
    elapsed = Math.floor((Date.now() - startedAt) / 1000);
    $('#timer').textContent = timeText(elapsed);
  }
}, 250);
new ResizeObserver(resizeCanvas).observe(game);
renderDoll();
reset();
renderAgeSettings();
requestAnimationFrame(drawArms);
requestAnimationFrame(drawBackdrop);
