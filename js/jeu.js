// Mini-jeu « Tire au but ! »
(() => {
  const pitch = document.getElementById('pitch');
  if (!pitch) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (id) => document.getElementById(id);
  const ball = $('ball');
  const ballSpin = ball.querySelector('.spin');
  const aim = $('aim');
  const stick = $('stick');
  const keeper = $('keeper');
  const goal = $('goal');
  const pop = $('pitch-pop');
  const msg = $('play-msg');
  const shootBtn = $('shoot');
  const scoreYou = $('score-you');
  const scoreKeeper = $('score-keeper');

  // Terrain (unités du viewBox 800 × 360)
  const START = { x: 160, y: 178 };
  const KEEPER_X = 722;       // centre de la gardienne
  const KEEPER_REACH = 38;    // demi-hauteur couverte par la gardienne
  const GOAL = { x: 774, top: 106, bottom: 254 };
  const MAX_AIM = 11 * Math.PI / 180;
  const SPEED = 900;          // vitesse de la balle en unités par seconde

  const messages = {
    goal: ['But ! Quelle frappe !', 'But ! La gardienne n\'a rien vu.', 'But ! Direction la lucarne.', 'But ! Tu es prêt pour l\'équipe 1.'],
    save: ['Arrêt de la gardienne ! Retente ta chance.', 'Parade ! Elle avait deviné.', 'Bloqué par les jambières !'],
    miss: ['À côté ! Vise entre les poteaux.', 'Juste à côté du poteau !', 'Trop large, recommence.'],
  };
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  let state = 'aim';          // aim → shot → result → aim
  let you = 0, keeperScore = 0;
  let t = 0, last = performance.now();
  let angle = 0, keeperY = 180;
  let bx = START.x, by = START.y, vx = 0, vy = 0, spin = 0;
  let checkedKeeper = false;
  let running = false;

  function draw() {
    ball.setAttribute('transform', `translate(${bx} ${by})`);
    ballSpin.setAttribute('transform', `rotate(${spin})`);
    aim.setAttribute('transform', `translate(${START.x} ${START.y}) rotate(${angle * 180 / Math.PI})`);
    keeper.setAttribute('transform', `translate(0 ${keeperY})`);
  }

  function say(text) { msg.textContent = text; }

  function bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  function confetti() {
    if (reduceMotion) return;
    const colors = ['#F5B315', '#0B416F', '#FFFFFF', '#FCE7AE'];
    for (let i = 0; i < 36; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.style.background = colors[i % colors.length];
      c.style.setProperty('--cx', `${(Math.random() - 0.75) * 700}px`);
      c.style.setProperty('--cy', `${(Math.random() - 0.6) * 380}px`);
      c.style.setProperty('--cr', `${(Math.random() - 0.5) * 900}deg`);
      c.style.animationDelay = `${Math.random() * 0.12}s`;
      pitch.appendChild(c);
      setTimeout(() => c.remove(), 1500);
    }
  }

  function shoot() {
    if (state !== 'aim') return;
    state = 'windup';
    aim.classList.add('is-hidden');
    stick.classList.remove('swing');
    void stick.getBoundingClientRect();
    stick.classList.add('swing');
    // la balle part au moment où la crosse la frappe
    setTimeout(() => {
      vx = Math.cos(angle) * SPEED;
      vy = Math.sin(angle) * SPEED;
      checkedKeeper = false;
      state = 'shot';
    }, 250);
  }

  function end(result) {
    state = 'result';
    if (result === 'goal') {
      you++;
      scoreYou.textContent = you;
      bump(scoreYou);
      goal.classList.remove('shake'); void goal.getBoundingClientRect(); goal.classList.add('shake');
      pop.classList.remove('show'); void pop.offsetWidth; pop.classList.add('show');
      confetti();
    } else {
      keeperScore++;
      scoreKeeper.textContent = keeperScore;
      bump(scoreKeeper);
    }
    say(pick(messages[result]));
    setTimeout(reset, result === 'goal' ? 1500 : 1100);
  }

  function reset() {
    bx = START.x; by = START.y; vx = 0; vy = 0;
    aim.classList.remove('is-hidden');
    state = 'aim';
  }

  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;

    // La gardienne accélère à chaque but marqué
    const keeperSpeed = (reduceMotion ? 0.9 : 1.2) + you * 0.15;
    keeperY = 180 + Math.sin(t * keeperSpeed) * 80;

    if (state === 'aim') {
      angle = Math.sin(t * (reduceMotion ? 1.2 : 2.2)) * MAX_AIM;
    }

    if (state === 'shot' || state === 'result') {
      bx += vx * dt;
      by += vy * dt;
      spin += vx * dt * 2;

      if (state === 'shot') {
        // la gardienne est-elle sur la trajectoire ?
        if (!checkedKeeper && bx >= KEEPER_X - 36) {
          checkedKeeper = true;
          if (Math.abs(by - keeperY) < KEEPER_REACH) {
            vx = -vx * 0.35; vy = (by - keeperY) * 3;
            keeper.classList.add('dive');
            setTimeout(() => keeper.classList.remove('dive'), 400);
            end('save');
          }
        }
        if (state === 'shot' && bx >= GOAL.x) {
          if (by > GOAL.top && by < GOAL.bottom) {
            bx = GOAL.x + 8; vx = 0; vy = 0;
            end('goal');
          } else {
            end('miss');
          }
        }
      } else {
        // la balle ralentit après un arrêt ou un tir à côté
        vx *= 0.96; vy *= 0.96;
      }
    }

    draw();
    if (running) requestAnimationFrame(step);
  }

  // Le jeu ne tourne que lorsqu'il est visible
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(step);
    } else if (!entry.isIntersecting) {
      running = false;
    }
  }).observe(pitch);

  pitch.addEventListener('pointerdown', (e) => { e.preventDefault(); shoot(); });
  shootBtn.addEventListener('click', shoot);

  draw();
})();
