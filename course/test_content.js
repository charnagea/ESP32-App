// Structural test of the course: every question is answerable, every lab's
// reference solution passes its own checks, and starters do not.
// Run: node course/test_content.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = path.join(__dirname, 'src');
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of fs.readdirSync(src).filter(f => f.startsWith('content_')).sort()) {
  vm.runInContext(fs.readFileSync(path.join(src, f), 'utf8'), ctx, { filename: f });
}
const C = ctx.window.COURSE;
const strip = code => code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
let errors = 0, lessons = 0, items = 0, labs = 0;
const ids = new Set();
const err = (where, msg) => { errors++; console.log('✗', where, '—', msg); };
for (const m of C.modules) {
  for (const l of m.lessons) {
    lessons++;
    if (ids.has(l.id)) err(l.id, 'duplicate lesson id'); ids.add(l.id);
    l.blocks.forEach((b, i) => {
      const w = `${l.id}[${i}] ${b.t}`;
      if (['mcq', 'multi', 'fill', 'order', 'bug', 'num', 'lab'].includes(b.t)) items++;
      if (b.t === 'mcq' && !(b.a >= 0 && b.a < b.opts.length)) err(w, 'answer index out of range');
      if (b.t === 'multi' && !b.a.every(a => a >= 0 && a < b.opts.length)) err(w, 'answer out of range');
      if (b.t === 'bug') { const n = b.code.split('\n').length; if (!(b.a >= 0 && b.a < n)) err(w, 'bug line out of range'); }
      if (b.t === 'order' && b.items.length < 3) err(w, 'too few items');
      if (b.t === 'fill' && !/\{\{.+?\}\}/.test(b.code)) err(w, 'no blanks');
      if (b.t === 'num' && typeof b.a !== 'number') err(w, 'no numeric answer');
      if (b.t === 'widget' && b.name === 'pinmap' && !C.pinmaps[b.board]) err(w, 'unknown board');
      if (b.t === 'lab') {
        labs++;
        const sol = strip(b.solution), st = strip(b.starter || '');
        let startPass = 0;
        b.checks.forEach(c => {
          let re; try { re = new RegExp(c.re, c.f || 'm'); } catch (e) { err(w, 'bad regex ' + c.re); return; }
          const okSol = c.not ? !re.test(sol) : re.test(sol);
          if (!okSol) err(`${w} ${b.id}`, 'solution fails check: ' + c.msg);
          if (c.not ? !re.test(st) : re.test(st)) startPass++;
        });
        if (startPass === b.checks.length) err(`${w} ${b.id}`, 'starter already passes every check');
      }
    });
  }
}
console.log(`${C.modules.length} modules, ${lessons} lessons, ${items} graded items, ${labs} labs, ${errors} errors`);
process.exit(errors ? 1 : 0);
