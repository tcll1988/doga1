'use strict';
(() => {
  const output = document.getElementById('result'), button = document.getElementById('check-assets');
  let report;
  try { report = checkCourseContent(CourseBook.getLessons()); } catch (e) { output.textContent = '课程加载失败：' + e.message; button.disabled = true; return; }
  const summary = `结构检查：${report.errors.length ? '未通过' : '通过'}\n${report.counts.lessons}课，${report.counts.expressions}个表达，${report.counts.words}个单词，${report.counts.questions}道题。\n${report.counts.audio}个不同录音路径，${report.counts.images}张图片。\n` + report.errors.concat(report.warnings).join('\n');
  output.textContent = summary;
  function load(path) {
    return new Promise(resolve => {
      const a = path.endsWith('.mp3') ? new Audio() : new Image();
      let finished = false;
      const timer = setTimeout(() => done(false), 12000);
      function done(ok) { if (finished) return; finished = true; clearTimeout(timer); a.onload = a.onerror = a.onloadedmetadata = null; if (a instanceof HTMLAudioElement) { a.removeAttribute('src'); a.load(); } resolve(ok ? null : path); }
      a.onerror = () => done(false);
      if (a instanceof HTMLAudioElement) { a.preload = 'metadata'; a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0); }
      else a.onload = () => done(a.naturalWidth > 0);
      a.src = '../' + path;
    });
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    const failures = [], list = report.paths;
    for (let i = 0; i < list.length; i += 6) {
      const results = await Promise.all(list.slice(i, i + 6).map(load)); results.filter(Boolean).forEach(x => failures.push(x));
      output.textContent = summary + `\n资源检查中：${Math.min(i + 6, list.length)}/${list.length}…`;
    }
    output.textContent = summary + `\n资源检查：${failures.length ? '未通过' : '通过'}\n已检查 ${list.length} 个资源。` + (failures.length ? '\n无法加载：\n' + failures.join('\n') : '\n所有录音与图片均可加载。');
    button.disabled = false;
  });
})();
