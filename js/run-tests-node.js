// uso: node js/run-tests-node.js
const GA = require('./ga.js');
const { runValidationTests } = require('./tests.js');
const r = runValidationTests(GA);
for (const s of r.sections) {
  console.log(`\n=== ${s.id} ${s.title} ${s.ok ? '(passou)' : '(FALHOU)'} ===`);
  s.lines.forEach(l => console.log(l));
}
console.log(`\nSeções aprovadas: ${r.passed}/${r.total}`);
