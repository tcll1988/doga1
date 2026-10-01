/* Every lesson registers once. Duplicates fail; data is never overwritten. */
'use strict';
window.CourseBook = (() => {
  const lessons = new Map();
  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  return Object.freeze({
    addLesson(lesson) {
      if (!lesson || !lesson.id || lessons.has(lesson.id)) throw new Error('Invalid or duplicate lesson: ' + (lesson && lesson.id));
      lessons.set(lesson.id, freeze(lesson));
    },
    getLesson(id) { return lessons.get(id); },
    getLessons() { return Object.freeze(Array.from(lessons.values()).sort((a, b) => a.number - b.number)); }
  });
})();
