/* Content checks, shared by the offline browser tool and Node. No packages. */
(function (root) {
  'use strict';
  function check(lessons) {
    const errors = [], warnings = [], paths = new Set(), ids = new Set();
    const counts = { lessons: lessons.length, expressions: 0, words: 0, questions: 0, audio: 0, images: 0 };
    function fail(where, msg) { errors.push(where + '：' + msg); }
    function id(value, where) { if (typeof value !== 'string' || !/^[a-z0-9-]+$/.test(value)) fail(where, 'ID 格式错误'); else if (ids.has(value)) fail(where, 'ID 重复 ' + value); else ids.add(value); }
    function required(v, where, key) { if (typeof v !== 'string' || !v.trim()) fail(where, key + ' 不能为空'); }
    function asset(p, where, type) {
      if (typeof p !== 'string' || !p.startsWith('assets/') || /[\\?#]|(?:^|\/)\.\.(?:\/|$)|^\//.test(p)) { fail(where, '资源必须是安全的本地相对路径'); return; }
      if (type === 'audio' && !p.endsWith('.mp3')) fail(where, '录音必须使用 .mp3');
      paths.add(p);
    }
    const numbers = new Set();
    lessons.forEach(l => {
      const where = l.id || '课'; id(l.id, where);
      if (!Number.isInteger(l.number) || l.number < 1 || numbers.has(l.number)) fail(where, '课号无效或重复'); numbers.add(l.number);
      required(l.title, where, 'title'); required(l.goal, where, 'goal');
      ['expressions', 'words'].forEach(field => {
        if (!Array.isArray(l[field])) { fail(where, field + ' 必须是数组'); return; }
        counts[field] += l[field].length;
        l[field].forEach(c => { id(c.id, where); ['zh', 'pinyin', 'ja'].forEach(k => required(c[k], c.id, k)); asset(c.audio, c.id, 'audio'); });
      });
      Object.entries(l.choiceSets || {}).forEach(([key, choices]) => {
        if (!Array.isArray(choices)) { fail(where, key + ' 选项集不是数组'); return; }
        const seen = new Set();
        choices.forEach(o => { required(o.id, where, '选项ID'); if (seen.has(o.id)) fail(where, key + ' 选项ID重复'); seen.add(o.id); if (o.image) { required(o.alt, where, '图片替代文本'); asset(o.image, where, 'image'); } else required(o.text, where, '选项文字'); });
      });
      if (!Array.isArray(l.parts) || l.parts.length !== 3) { fail(where, '必须恰好有三个练习部分'); return; }
      const questionNumbers = new Set();
      l.parts.forEach((p, pi) => {
        if (p.id !== 'part-' + (pi + 1)) fail(where, '部分顺序/ID错误');
        required(p.title, where, '部分标题'); required(p.instruction, where, 'instruction');
        if (!Array.isArray(p.groups) || !p.groups.length) { fail(where, '部分必须有题组'); return; }
        const groupAudio = new Set();
        p.groups.forEach(g => {
          id(g.id, where); asset(g.audio, g.id, 'audio'); required(g.transcript, g.id, '听力原文');
          if (groupAudio.has(g.audio)) fail(g.id, '同一部分共用录音的题目应合并到一个题组'); groupAudio.add(g.audio);
          if (!Array.isArray(g.questions) || !g.questions.length) { fail(g.id, '空题组'); return; }
          g.questions.forEach(q => {
            counts.questions++; id(q.id, g.id); required(q.prompt, q.id, '题目');
            if (!Number.isInteger(q.sourceNumber) || questionNumbers.has(q.sourceNumber)) fail(q.id, '原题号无效或重复'); questionNumbers.add(q.sourceNumber);
            if (![1, 2, 3, 4].includes(q.sourcePart) || (pi === 0 && q.sourcePart !== 1) || (pi === 1 && q.sourcePart !== 2) || (pi === 2 && q.sourcePart < 3)) fail(q.id, '原部分与教材部分不匹配');
            if (!!q.options === !!q.choiceSet) fail(q.id, 'options 与 choiceSet 必须二选一，禁止重复选项数据');
            const choices = q.options || (l.choiceSets || {})[q.choiceSet];
            if (!Array.isArray(choices) || choices.length < 2) { fail(q.id, '选项缺失或不足'); return; }
            const keys = new Set();
            choices.forEach(o => { if (keys.has(o.id)) fail(q.id, '选项ID重复'); keys.add(o.id); if (!q.choiceSet) { required(o.text, q.id, '选项文本'); required(o.id, q.id, '选项ID'); } });
            if (!keys.has(q.answer)) fail(q.id, '正确答案不在选项中');
            if (q.sourcePart >= 3 && !/[？?:：]$/.test(q.prompt.trim())) warnings.push(q.id + '：请人工检查疑问句标点');
          });
        });
      });
      if (questionNumbers.size !== 40 || Array.from({ length: 40 }, (_, i) => i + 1).some(n => !questionNumbers.has(n))) fail(where, '本版本每课原题号应为 1–40，不能漏题');
    });
    Array.from(paths).forEach(p => { if (p.endsWith('.mp3')) counts.audio++; else counts.images++; });
    return { errors, warnings, counts, paths: Array.from(paths).sort() };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = check;
  else root.checkCourseContent = check;
})(typeof window !== 'undefined' ? window : this);

if (typeof module !== 'undefined' && require.main === module) {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const base = path.resolve(__dirname, '..');
  const files = fs.readdirSync(path.join(base, 'content')).filter(f => /^lesson-\d+\.js$/.test(f)).sort();
  const lessons = [], duplicate = new Set();
  let report;
  try {
    const context = vm.createContext({ CourseBook: { addLesson(l) { if (duplicate.has(l.id)) throw new Error('重复课程 ' + l.id); duplicate.add(l.id); lessons.push(l); } } });
    files.forEach(file => {
      const code = fs.readFileSync(path.join(base, 'content', file), 'utf8');
      // Lesson files contain only one JSON object, with an explicit registration wrapper.
      if (!/^CourseBook\.addLesson\([\s\S]*\);\s*$/.test(code)) throw new Error(file + '：课程文件格式错误');
      JSON.parse(code.slice(code.indexOf('(') + 1, code.lastIndexOf(')')));
      vm.runInContext(code, context, { timeout: 1000, filename: file });
    });
    report = module.exports(lessons);
    report.paths.forEach(p => { const f = path.resolve(base, p); if (!f.startsWith(base + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile() || !fs.statSync(f).size) report.errors.push(p + '：资源不存在或为空'); });
    const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8');
    for (const file of files) if (!html.includes('content/' + file)) report.errors.push(file + '：没有在 index.html 中加载');
    const loaded = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g), m => m[1]);
    if (new Set(loaded).size !== loaded.length) report.errors.push('index.html：重复加载脚本');
    for (const p of loaded) if (!fs.existsSync(path.join(base, p))) report.errors.push(p + '：脚本文件不存在');
    if (!html.includes('id="home-template"')) report.errors.push('缺少首页说明模板');
    report.counts.documents = 0;
    for (const tag of html.match(/<a\b[^>]*>/gi) || []) {
      if (!/\bdownload(?:\s*=|\s|>)/i.test(tag)) continue;
      const href = tag.match(/\bhref="([^"]+)"/i);
      const p = href && href[1];
      if (!p || !p.startsWith('assets/') || /[\\?#]|(?:^|\/)\.\.(?:\/|$)|^\//.test(p)) { report.errors.push('下载链接：必须使用安全的本地相对路径'); continue; }
      const f = path.resolve(base, p);
      if (!f.startsWith(base + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile() || !fs.statSync(f).size) { report.errors.push(p + '：下载文件不存在或为空'); continue; }
      if (p.endsWith('.pdf') && fs.readFileSync(f).subarray(0, 5).toString('ascii') !== '%PDF-') report.errors.push(p + '：不是有效的 PDF 文件头');
      report.counts.documents++;
    }
    if (/<(?:script|link)[^>]+(?:src|href)="https?:/i.test(html)) report.errors.push('发现外部运行时依赖');
    console.log('内容检查结果：' + (report.errors.length ? '未通过' : '通过'));
    console.log(JSON.stringify(report.counts, null, 2));
    report.errors.forEach(x => console.error('错误：' + x));
    report.warnings.forEach(x => console.log('提示：' + x));
    if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.errors.length ? 1 : 0;
  } catch (error) { console.error('检查失败：' + error.message); process.exitCode = 1; }
}
