/* No fetch, modules, libraries, or server: also works directly from file://. */
'use strict';
(() => {
  const lessons = CourseBook.getLessons();
  const main = document.getElementById('main');
  const audio = document.getElementById('audio');
  const speed = document.getElementById('speed');
  const seek = document.getElementById('seek');
  const toggle = document.getElementById('player-toggle');
  const stop = document.getElementById('player-stop');
  const storageKey = 'tingjian-zhongwen-v1';
  const cheers = ['よく聞き取れました！','その調子です！','正解です。自信を持って！','しっかり理解できていますね！','いいですね。次の問題にも挑戦！','着実に力がついています！'];
  let state = { answers: {}, visibility: { zh: true, pinyin: false, ja: true }, fontSize: '16' };
  let current = null, playback = 'idle', playRequest = 0, route = null;
  let storageAvailable = true, lastCheer = '';
  let groupOrder = [];
  const qIndex = new Map();
  lessons.forEach(l => l.parts.forEach(p => p.groups.forEach(g => g.questions.forEach(q => {
    qIndex.set(q.id, { lesson: l, part: p, group: g, question: q });
  }))));
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function storageNotice() {
    storageAvailable = false;
    const note = document.getElementById('storage-notice');
    note.textContent = 'このブラウザーでは進度を保存できません。この画面では学習できますが、閉じると記録が消えます。通常の閲覧モードで開いてください。';
    note.hidden = false;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      if (saved.answers && typeof saved.answers === 'object' && !Array.isArray(saved.answers)) state.answers = saved.answers;
      ['zh', 'pinyin', 'ja'].forEach(k => { if (saved.visibility && typeof saved.visibility[k] === 'boolean') state.visibility[k] = saved.visibility[k]; });
      if (['16', '18', '20'].includes(saved.fontSize)) state.fontSize = saved.fontSize;
    }
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (_) { storageNotice(); }
  function save() { if (storageAvailable) { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (_) { storageNotice(); } } }
  function signature(item) {
    // A changed question invalidates only that question's old progress.
    const q = item.question;
    const text = JSON.stringify([q.prompt, q.answer, options(item), item.group.transcript, item.group.audio]);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return 'v1-' + (hash >>> 0).toString(16);
  }
  function record(qid) {
    const item = qIndex.get(qid), r = state.answers[qid];
    if (!item || !r || typeof r !== 'object' || r.signature !== signature(item)) return null;
    return options(item).some(o => o.id === r.choice) ? r : null;
  }
  function options(item) { return item.question.options || item.lesson.choiceSets[item.question.choiceSet]; }
  function progress(lesson, part) {
    let total = 0, answered = 0, correct = 0;
    (part ? [part] : lesson.parts).forEach(p => p.groups.forEach(g => g.questions.forEach(q => {
      total++; const r = record(q.id); if (r) { answered++; if (r.choice === q.answer) correct++; }
    })));
    return { total, answered, correct };
  }
  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
    return result;
  }
  function cheer() {
    const pool = cheers.filter(s => s !== lastCheer);
    lastCheer = pool[Math.floor(Math.random() * pool.length)]; return lastCheer;
  }
  function applyFont() { document.documentElement.style.setProperty('--base-size', state.fontSize + 'px'); document.getElementById('font-size').value = state.fontSize; }
  applyFont();
  document.getElementById('font-size').addEventListener('change', e => { state.fontSize = e.target.value; applyFont(); save(); });
  function drawNav() {
    document.getElementById('home-link').classList.toggle('active', !route || !route.lesson);
    document.getElementById('home-link').setAttribute('aria-current', !route || !route.lesson ? 'page' : 'false');
    document.getElementById('lesson-nav').innerHTML = lessons.map(l => {
      const p = progress(l), active = route && route.lesson && route.lesson.id === l.id;
      return `<a class="lesson-link${active ? ' active' : ''}" href="#${l.id}/expressions"${active ? ' aria-current="page"' : ''}><span class="lesson-no">${String(l.number).padStart(2, '0')}</span><span><b>${esc(l.title)}</b><small>解答 ${p.answered}/${p.total} · 正解 ${p.correct}</small><span class="mini-progress"><i style="width:${p.answered / p.total * 100}%"></i></span></span></a>`;
    }).join('');
  }
  function showHome() {
    document.title = '听见中文 | 中国語リスニング教材';
    main.replaceChildren(document.getElementById('home-template').content.cloneNode(true));
    document.getElementById('home-lessons').innerHTML = lessons.map(l => {
      const p = progress(l);
      return `<a class="home-lesson" href="#${l.id}/expressions"><span class="number">${String(l.number).padStart(2, '0')}</span><div><h3>${esc(l.title)}</h3><p>${l.expressions.length}表現 · ${l.words.length}単語 · ${p.total}問</p><small>解答済み ${p.answered}/${p.total} · 正解 ${p.correct}</small></div></a>`;
    }).join('');
  }
  function lessonHeader(l, view) {
    const p = progress(l);
    return `<header class="lesson-header"><div class="eyebrow">LESSON ${String(l.number).padStart(2, '0')} / 第${l.number}課</div><div class="lesson-title-row"><h1>${esc(l.title)}</h1><span class="lesson-count">解答 ${p.answered}/${p.total} · 正解 ${p.correct}</span></div><p class="lesson-goal">${esc(l.goal)}</p></header><nav class="lesson-tabs" aria-label="学習内容"><a href="#${l.id}/expressions" class="${view === 'expressions' ? 'active' : ''}"${view === 'expressions' ? ' aria-current="page"' : ''}>表現<span>${l.expressions.length}</span></a><a href="#${l.id}/words" class="${view === 'words' ? 'active' : ''}"${view === 'words' ? ' aria-current="page"' : ''}>単語<span>${l.words.length}</span></a><a href="#${l.id}/practice/1" class="${view === 'practice' ? 'active' : ''}"${view === 'practice' ? ' aria-current="page"' : ''}>聞き取り<span>${p.total}</span></a></nav>`;
  }
  function card(w, index) {
    return `<button type="button" class="audio-card" data-audio-id="${esc(w.id)}" data-audio-src="${esc(w.audio)}" data-audio-label="${esc(w.zh)}" aria-label="${esc(w.zh)}を再生" aria-pressed="false"><span class="card-meta"><span>${String(index + 1).padStart(2, '0')}</span><span class="listen-indicator"><b class="audio-symbol" aria-hidden="true">▶</b><span class="audio-hint">聞く</span></span></span><span class="zh" lang="zh-Hans">${esc(w.zh)}</span><span class="pinyin" lang="zh-Latn">${esc(w.pinyin)}</span><span class="ja" lang="ja">${esc(w.ja)}</span>${w.example ? `<span class="example" lang="zh-Hans">例：${esc(w.example)}</span>` : ''}${w.usage ? `<span class="usage">${esc(w.usage)}</span>` : ''}</button>`;
  }
  function visibilityClass() { return ['zh', 'pinyin', 'ja'].filter(k => !state.visibility[k]).map(k => 'hide-' + k).join(' '); }
  function showCards(l, view) {
    const words = view === 'words', list = words ? l.words : l.expressions;
    main.innerHTML = lessonHeader(l, view) + `<section aria-label="${words ? '単語' : '表現'}"><div class="learning-head"><div><h2>${words ? '単語を聞いて覚える' : '会話の表現を身につける'}</h2><p>カード全体を押すと再生。もう一度押すと一時停止・再開できます。</p></div></div>${words ? `<div class="visibility-controls" role="group" aria-label="単語の表示設定"><span class="control-label">表示する内容</span>${[['zh', '中国語'], ['pinyin', 'ピンイン'], ['ja', '日本語']].map(([k, label]) => `<label><input type="checkbox" data-visibility="${k}"${state.visibility[k] ? ' checked' : ''}>${label}</label>`).join('')}</div>` : ''}<div id="learning-cards" class="card-grid${words ? ' word-grid ' + visibilityClass() : ''}">${list.map(card).join('')}</div><div class="page-next"><a href="#${l.id}/${words ? 'practice/1' : 'words'}">${words ? '聞き取り練習へ' : '単語の学習へ'}</a></div></section>`;
    updatePlayback();
  }
  function answerText(item) {
    const o = options(item).find(x => x.id === item.question.answer);
    if (o.image) return o.id + ' の絵';
    return (['true', 'false'].includes(o.id) ? '' : o.id + '：') + o.text;
  }
  function questionHtml(item) {
    const { question: q, group: g } = item, r = record(q.id);
    const correct = r && r.choice === q.answer;
    const choices = options(item), pictures = !!q.choiceSet, boolean = q.answer === 'true' || q.answer === 'false';
    const label = `原教材の第${q.sourceNumber}問`;
    return `<div class="question" id="${q.id}" data-question-id="${q.id}"><h3 class="question-prompt${pictures ? ' ja-prompt' : ''}" lang="${pictures ? 'ja' : 'zh-Hans'}">${esc(q.prompt)}</h3><div class="option-grid${pictures ? ' pictures' : boolean ? ' boolean' : ''}" role="group" aria-label="${label}の選択肢">${choices.map(o => {
      const isCorrect = r && o.id === q.answer, isWrong = r && o.id === r.choice && !correct;
      const marker = isCorrect ? '正解' : isWrong ? '選択' : '';
      return `<button type="button" class="option${isCorrect ? ' is-correct' : isWrong ? ' is-wrong' : r ? ' is-dim' : ''}" data-answer="${esc(o.id)}" data-qid="${q.id}"${r ? ' disabled' : ''} aria-label="${esc(pictures ? o.alt : (boolean ? o.text : o.id + ' ' + o.text))}${marker ? '：' + marker : ''}">${pictures ? `<span class="picture-letter">${o.id}${marker ? `<span class="option-state">${marker}</span>` : ''}</span><img src="${esc(o.image)}" alt="${esc(o.alt)}" loading="lazy" width="180" height="120">` : `<span class="option-letter" aria-hidden="true">${boolean ? (o.id === 'true' ? '〇' : '×') : o.id}</span><span class="option-text" lang="zh-Hans">${esc(boolean ? o.text.replace(/^[〇×]\s*/, '') : o.text)}${marker ? `<span class="option-state">（${marker}）</span>` : ''}</span>`}</button>`;
    }).join('')}</div>${r ? `<div class="feedback ${correct ? 'correct' : 'wrong'}" role="status"><div class="feedback-title">${correct ? '✓ ' + esc(cheers.includes(r.cheer) ? r.cheer : cheers[0]) : 'もう一度、聞き直してみましょう。'}</div><p class="correct-answer">正解：${esc(answerText(item))}</p><details class="transcript"${!correct ? ' open' : ''}><summary>原文を見る</summary><p class="transcript-text" lang="zh-Hans">${esc(g.transcript)}${q.sourceNumber > 20 ? '\n问：' + esc(q.recordedPrompt || q.prompt) : ''}</p>${q.note ? `<p class="question-note">${esc(q.note)}</p>` : ''}</details><button class="retry-question" data-retry="${q.id}">この問題をもう一度</button></div>` : ''}</div>`;
  }
  function showPractice(l, part) {
    const p = progress(l, part);
    main.innerHTML = lessonHeader(l, 'practice') + `<section aria-label="聞き取り練習"><div class="part-tabs" role="group" aria-label="練習の部分">${l.parts.map((pt, i) => `<button data-part="${i + 1}" class="${pt.id === part.id ? 'active' : ''}" aria-pressed="${pt.id === part.id}"><strong>${i + 1}. ${esc(pt.title)}</strong><small>解答 ${progress(l, pt).answered}/${progress(l, pt).total}</small></button>`).join('')}</div><div class="practice-top"><h2>${esc(part.title)}</h2><button class="reset-part" id="reset-part">この部分をやり直す</button></div><p class="part-instruction">${esc(part.instruction)} 順番は開くたびに変わります。</p><div class="progress-row"><div class="progress-bar" role="progressbar" aria-label="この部分の解答進度" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.answered}"><i style="width:${p.answered / p.total * 100}%"></i></div><span class="progress-label">解答済み <b>${p.answered}/${p.total}</b> · 正解 <b>${p.correct}</b></span></div><div class="practice-list">${groupOrder.map((g, i) => `<article class="question-group" data-group-id="${g.id}"><div class="group-top"><div class="group-label"><span>問題 ${g.questions.length > 1 ? (i + 1) + '（' + g.questions.length + '問）' : i + 1}</span><small>原教材 ${g.questions.map(q => q.sourceNumber).join('・')}${g.questions[0].sourcePart >= 3 ? (g.questions[0].sourcePart === 3 ? ' · 短い会話' : ' · 長い会話') : ''}</small></div><button class="audio-card" data-audio-id="${g.id}" data-audio-src="${esc(g.audio)}" data-audio-label="第${l.number}課・原教材 ${g.questions.map(q => q.sourceNumber).join('・')}問" aria-label="第${g.questions[0].sourceNumber}問の音声を再生" aria-pressed="false"><span class="audio-symbol" aria-hidden="true">▶</span><span class="audio-hint">音声を聞く</span></button></div>${g.questions.map(q => questionHtml(qIndex.get(q.id))).join('')}</article>`).join('')}</div><div id="part-complete"${p.answered !== p.total ? ' hidden' : ''} class="complete-message">この部分は全問解答しました。原文を確認して、聞き取れなかったところを復習しましょう。</div></section>`;
    updatePlayback();
  }
  function readRoute() {
    const [id, rawView, rawPart] = location.hash.slice(1).split('/');
    const lesson = CourseBook.getLesson(id);
    if (!lesson) return { lesson: null, view: 'home' };
    const view = ['expressions', 'words', 'practice'].includes(rawView) ? rawView : 'expressions';
    const partNumber = ['1', '2', '3'].includes(rawPart) ? Number(rawPart) : 1;
    return { lesson, view, part: lesson.parts[partNumber - 1], partNumber };
  }
  function renderRoute() {
    route = readRoute();
    drawNav();
    if (!route.lesson) showHome();
    else {
      document.title = `第${route.lesson.number}課 ${route.lesson.title} | 听见中文`;
      if (route.view === 'practice') { groupOrder = shuffle(route.part.groups); showPractice(route.lesson, route.part); }
      else showCards(route.lesson, route.view);
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', renderRoute);
  main.addEventListener('change', e => {
    const key = e.target.dataset.visibility;
    if (key && Object.prototype.hasOwnProperty.call(state.visibility, key)) {
      state.visibility[key] = e.target.checked;
      const grid = document.getElementById('learning-cards');
      grid.classList.toggle('hide-' + key, !state.visibility[key]); save();
    }
  });
  function updateProgressUi() {
    if (!route.lesson) return;
    drawNav();
    const lp = progress(route.lesson);
    document.querySelector('.lesson-count').textContent = `解答 ${lp.answered}/${lp.total} · 正解 ${lp.correct}`;
    if (route.view !== 'practice') return;
    const pp = progress(route.lesson, route.part);
    const bar = document.querySelector('.progress-bar');
    bar.setAttribute('aria-valuenow', pp.answered); bar.firstElementChild.style.width = pp.answered / pp.total * 100 + '%';
    document.querySelector('.progress-label').innerHTML = `解答済み <b>${pp.answered}/${pp.total}</b> · 正解 <b>${pp.correct}</b>`;
    document.querySelectorAll('[data-part]').forEach(btn => { const pt = route.lesson.parts[Number(btn.dataset.part) - 1], p = progress(route.lesson, pt); btn.querySelector('small').textContent = `解答 ${p.answered}/${p.total}`; });
    document.getElementById('part-complete').hidden = pp.answered !== pp.total;
  }
  main.addEventListener('click', e => {
    const play = e.target.closest('[data-audio-id]');
    if (play) { playCard(play); return; }
    const answer = e.target.closest('[data-answer]');
    if (answer && !answer.disabled) {
      const item = qIndex.get(answer.dataset.qid);
      if (record(item.question.id)) return;
      const chosen = answer.dataset.answer;
      state.answers[item.question.id] = { choice: chosen, cheer: chosen === item.question.answer ? cheer() : '', signature: signature(item) };
      save();
      document.getElementById(item.question.id).outerHTML = questionHtml(item);
      updateProgressUi();
      const feedback = document.getElementById(item.question.id).querySelector('.feedback');
      feedback.setAttribute('tabindex', '-1'); feedback.focus({ preventScroll: true });
      return;
    }
    const retry = e.target.closest('[data-retry]');
    if (retry) {
      const item = qIndex.get(retry.dataset.retry); delete state.answers[item.question.id]; save();
      document.getElementById(item.question.id).outerHTML = questionHtml(item); updateProgressUi();
      document.getElementById(item.question.id).querySelector('.option').focus({ preventScroll: true }); return;
    }
    const partBtn = e.target.closest('[data-part]');
    if (partBtn) {
      const target = `#${route.lesson.id}/practice/${partBtn.dataset.part}`;
      if (location.hash === target) { groupOrder = shuffle(route.part.groups); showPractice(route.lesson, route.part); }
      else location.hash = target;
      return;
    }
    if (e.target.closest('#reset-part')) {
      route.part.groups.forEach(g => g.questions.forEach(q => delete state.answers[q.id])); save();
      groupOrder = shuffle(route.part.groups); showPractice(route.lesson, route.part); drawNav();
      document.getElementById('reset-part').focus({ preventScroll: true });
    }
  });
  function clock(seconds) { if (!Number.isFinite(seconds)) return '0:00'; const s = Math.max(0, Math.floor(seconds)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function updateTime() {
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    document.getElementById('elapsed').textContent = clock(audio.currentTime);
    document.getElementById('duration').textContent = clock(duration);
    seek.disabled = !duration; seek.value = duration ? Math.min(100, audio.currentTime / duration * 100) : 0;
    seek.setAttribute('aria-valuetext', clock(audio.currentTime) + ' / ' + clock(duration));
  }
  function updatePlayback() {
    const texts = { idle: '待機中', loading: '読み込み中…', playing: '再生中', paused: '一時停止中', stopped: '停止中', ended: '再生終了', error: '再生できません。音声ファイルを確認してください。' };
    const s = document.getElementById('player-status'); s.textContent = texts[playback]; s.className = playback;
    document.getElementById('track-name').textContent = current ? current.label : 'カードを押して音声を再生';
    toggle.disabled = !current; stop.disabled = !current;
    const playing = playback === 'playing' || playback === 'loading';
    toggle.textContent = playing ? 'Ⅱ' : '▶'; toggle.setAttribute('aria-label', playing ? '音声を一時停止' : '音声を再生');
    document.querySelectorAll('[data-audio-id]').forEach(btn => {
      const active = current && btn.dataset.audioId === current.key;
      const cardPlaying = active && playing, cardPaused = active && playback === 'paused';
      btn.classList.toggle('is-playing', cardPlaying); btn.classList.toggle('is-paused', cardPaused);
      btn.setAttribute('aria-pressed', cardPlaying ? 'true' : 'false');
      btn.querySelector('.audio-symbol').textContent = cardPlaying ? 'Ⅱ' : '▶';
      btn.querySelector('.audio-hint').textContent = cardPlaying ? '一時停止' : cardPaused ? '再開' : btn.classList.contains('word-grid') ? '聞く' : (btn.querySelector('.card-meta') ? '聞く' : '音声を聞く');
      btn.setAttribute('aria-label', btn.dataset.audioLabel + (cardPlaying ? 'を一時停止' : cardPaused ? 'を再開' : 'を再生'));
    });
    updateTime();
  }
  async function startPlay() {
    if (!current) return;
    const request = ++playRequest;
    if (playback === 'ended') audio.currentTime = 0;
    playback = 'loading'; updatePlayback();
    try {
      audio.playbackRate = Number(speed.value);
      await audio.play();
      if (request === playRequest) { playback = 'playing'; updatePlayback(); }
    } catch (error) {
      if (request === playRequest && error.name !== 'AbortError') { playback = 'error'; updatePlayback(); }
    }
  }
  function pausePlay() { ++playRequest; audio.pause(); playback = 'paused'; updatePlayback(); }
  function playCard(btn) {
    const key = btn.dataset.audioId;
    if (current && current.key === key) {
      if (playback === 'playing' || playback === 'loading') pausePlay(); else startPlay();
    } else {
      ++playRequest; audio.pause(); current = { key, src: btn.dataset.audioSrc, label: btn.dataset.audioLabel };
      audio.src = current.src; audio.playbackRate = Number(speed.value); playback = 'stopped'; startPlay();
    }
  }
  toggle.addEventListener('click', () => { if (playback === 'playing' || playback === 'loading') pausePlay(); else startPlay(); });
  stop.addEventListener('click', () => { ++playRequest; audio.pause(); if (Number.isFinite(audio.duration)) audio.currentTime = 0; playback = 'stopped'; updatePlayback(); });
  speed.addEventListener('change', () => { audio.playbackRate = Number(speed.value); });
  seek.addEventListener('input', () => { if (Number.isFinite(audio.duration)) { audio.currentTime = Number(seek.value) / 100 * audio.duration; if (playback === 'ended') playback = 'paused'; updatePlayback(); } });
  audio.addEventListener('playing', () => { if (!audio.paused && current) { playback = 'playing'; updatePlayback(); } });
  audio.addEventListener('pause', () => { if (audio.paused && playback === 'playing' && !audio.ended) { playback = 'paused'; updatePlayback(); } });
  audio.addEventListener('ended', () => { ++playRequest; playback = 'ended'; updatePlayback(); });
  audio.addEventListener('error', () => { if (current) { ++playRequest; playback = 'error'; updatePlayback(); } });
  audio.addEventListener('loadedmetadata', updateTime);
  audio.addEventListener('durationchange', updateTime);
  audio.addEventListener('timeupdate', updateTime);
  // External browser play/pause controls are reflected in the fixed player.
  audio.addEventListener('waiting', () => { if (!audio.paused && current) { playback = 'loading'; updatePlayback(); } });
  renderRoute(); updatePlayback();
})();
