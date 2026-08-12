(function (root) {
  'use strict';
  const jokes = [
    'Головний талант архівного PDF — пам’ятати все й нічого не домислювати 🙂',
    'Сьогодні Excel працює, а ми лише чемно переносимо його факти у PDF.',
    'Колонки дисциплін шикуються рівно. Жодної самодіяльності з оцінками.',
    'Теми можуть переноситися на новий рядок, але не в нову реальність.',
    'PDF готується до архіву: серйозно, локально й без пліток про студентів.',
  ];
  let timer = null;
  function setProgress(percent, message, item) {
    const value = Math.max(0, Math.min(100, Number(percent) || 0));
    const bar = document.getElementById('progressBar');
    const label = document.getElementById('progressText');
    const current = document.getElementById('currentItem');
    if (bar) { bar.value = value; bar.setAttribute('aria-valuenow', String(value)); }
    if (label) label.textContent = message || `${Math.round(value)}%`;
    if (current) current.textContent = item || '';
    document.body.classList.toggle('busy', value > 0 && value < 100);
  }
  function startJokes(enabled) {
    stopJokes();
    if (!enabled) return;
    const el = document.getElementById('waitingJoke');
    let idx = Math.floor(Math.random() * jokes.length);
    const show = () => { if (el) el.textContent = jokes[idx++ % jokes.length]; };
    show(); timer = setInterval(show, 6000);
  }
  function stopJokes() { if (timer) clearInterval(timer); timer = null; }
  root.JournalProgress = { setProgress, startJokes, stopJokes };
})(globalThis);
