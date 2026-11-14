// Interface (o algoritmo está em ga.js)
(function () {
  'use strict';
  const GA = window.GA;
  const $ = id => document.getElementById(id);

  const MIN_PROJECTS = 4, MAX_PROJECTS = 15;

  const EXAMPLE = () => window.GATests.EXAMPLE_PROJECTS.map(p => ({
    name: p.name, cost: toBR(p.cost), benefit: String(p.benefit)
  }));
  function toBR(n) { return n.toFixed(2).replace('.', ','); }

  const S = {
    projects: EXAMPLE(),
    engine: null, inst: null, values: null,
    running: false, dirty: false, valid: true, runToken: 0,
    selectedGen: 0, renderedHistory: 0
  };
  const animator = new window.GAAnimator($('stage'));

  const RE_MONEY = /^\d+([.,]\d{1,2})?$/;
  const RE_INT = /^\d+$/;
  const RE_SINT = /^-?\d+$/;
  const RE_PCT = /^\d+([.,]\d+)?$/;
  const num = s => Number(String(s).replace(',', '.'));
  const PARAM_IDS = ['budget', 'popSize', 'generations', 'crossoverRate', 'mutationRate', 'tournamentSize', 'eliteCount', 'seed'];

  function validate() {
    const errors = {}, projectErrors = [];
    const v = {};
    const raw = id => $(id).value.trim();

    const projects = [];
    S.projects.forEach((p, i) => {
      const e = [];
      const name = p.name.trim();
      if (!name) e.push('nome não pode ser vazio');
      const c = p.cost.trim(), b = p.benefit.trim();
      if (c === '') e.push('informe o custo');
      else if (!RE_MONEY.test(c) || num(c) <= 0 || num(c) > 1e12) e.push('custo deve ser positivo, com até duas casas decimais');
      if (b === '') e.push('informe o benefício');
      else if (!RE_MONEY.test(b) || num(b) > 1e9) e.push('benefício deve ser um número não negativo, com até duas casas decimais');
      projectErrors.push(e);
      projects.push({ name, cost: num(c), benefit: num(b) });
    });
    let projectsMsg = '';
    if (S.projects.length < MIN_PROJECTS || S.projects.length > MAX_PROJECTS) projectsMsg = `Use entre ${MIN_PROJECTS} e ${MAX_PROJECTS} projetos.`;
    v.projects = projects;

    const b = raw('budget');
    if (b === '') errors.budget = 'Informe o orçamento.';
    else if (!RE_MONEY.test(b) || num(b) > 1e13) errors.budget = 'Valor finito, não negativo, com até duas casas decimais (ex.: 7000,00).';
    else v.budget = num(b);

    const intField = (id, min, max, label) => {
      const s = raw(id);
      if (s === '') { errors[id] = `Informe ${label}.`; return; }
      if (!RE_INT.test(s) || !Number.isSafeInteger(Number(s))) { errors[id] = 'Use um número inteiro.'; return; }
      const n = Number(s);
      if (n < min) { errors[id] = `Mínimo ${min}.`; return; }
      if (max !== null && n > max) { errors[id] = `Máximo ${max}.`; return; }
      v[id] = n;
    };
    intField('popSize', 2, null, 'o tamanho da população');
    intField('generations', 1, null, 'o número de gerações');

    for (const id of ['crossoverRate', 'mutationRate']) {
      const s = raw(id);
      if (s === '') errors[id] = 'Informe a taxa.';
      else if (!RE_PCT.test(s) || num(s) > 100) errors[id] = 'Percentual entre 0 e 100.';
      else v[id] = num(s);
    }

    const pop = v.popSize;
    if (pop !== undefined) {
      intField('tournamentSize', 2, pop, 'o tamanho do torneio');
      intField('eliteCount', 0, pop - 1, 'a quantidade de elite');
    } else {
      if (raw('tournamentSize') === '') errors.tournamentSize = 'Informe o tamanho do torneio.';
      else errors.tournamentSize = 'Depende de um tamanho de população válido.';
      if (raw('eliteCount') === '') errors.eliteCount = 'Informe a quantidade de elite.';
      else errors.eliteCount = 'Depende de um tamanho de população válido.';
    }

    const sd = raw('seed');
    if (sd === '') errors.seed = 'Informe a semente.';
    else if (!RE_SINT.test(sd) || !Number.isSafeInteger(Number(sd))) errors.seed = 'Use um número inteiro.';
    else v.seed = Number(sd);

    const ok = !projectsMsg && projectErrors.every(e => !e.length) && Object.keys(errors).length === 0;
    return { ok, errors, projectErrors, projectsMsg, values: v };
  }

  function showValidation(res) {
    for (const id of PARAM_IDS) {
      const msg = res.errors[id] || '';
      $(id).setAttribute('aria-invalid', msg ? 'true' : 'false');
      document.querySelector(`.field-error[data-for="${id}"]`).textContent = msg;
    }
    const rows = $('projectsBody').querySelectorAll('tr.prow');
    rows.forEach((tr, i) => {
      const errs = res.projectErrors[i] || [];
      const [name, cost, ben] = tr.querySelectorAll('input');
      name.setAttribute('aria-invalid', errs.some(e => e.includes('nome')) ? 'true' : 'false');
      cost.setAttribute('aria-invalid', errs.some(e => e.includes('custo')) ? 'true' : 'false');
      ben.setAttribute('aria-invalid', errs.some(e => e.includes('benefício')) ? 'true' : 'false');
      const er = tr.nextElementSibling;
      er.style.display = errs.length ? '' : 'none';
      er.firstElementChild.textContent = errs.length ? `Projeto ${GA.geneLabel(i)}: ${errs.join('; ')}.` : '';
    });
    $('projectsError').textContent = res.projectsMsg;
  }

  function renderProjects() {
    const tb = $('projectsBody');
    tb.innerHTML = '';
    S.projects.forEach((p, i) => {
      const tr = document.createElement('tr');
      tr.className = 'prow';
      tr.innerHTML = `<td>${GA.geneLabel(i)}</td>
        <td><input aria-label="Nome do projeto ${GA.geneLabel(i)}" autocomplete="off"></td>
        <td class="c-cost"><input aria-label="Custo do projeto ${GA.geneLabel(i)} em reais" inputmode="decimal" autocomplete="off"></td>
        <td class="c-ben"><input aria-label="Benefício do projeto ${GA.geneLabel(i)}" inputmode="decimal" autocomplete="off"></td>
        <td><button type="button" class="btn-remove" title="Remover projeto" aria-label="Remover projeto ${GA.geneLabel(i)}">×</button></td>`;
      const [name, cost, ben] = tr.querySelectorAll('input');
      name.value = p.name; cost.value = p.cost; ben.value = p.benefit;
      name.addEventListener('input', () => { p.name = name.value; onDataChanged(); });
      cost.addEventListener('input', () => { p.cost = cost.value; onDataChanged(); });
      ben.addEventListener('input', () => { p.benefit = ben.value; onDataChanged(); });
      const rm = tr.querySelector('.btn-remove');
      rm.disabled = S.projects.length <= MIN_PROJECTS;
      rm.addEventListener('click', () => {
        if (S.projects.length <= MIN_PROJECTS) return;
        S.projects.splice(i, 1);
        renderProjects(); onDataChanged();
      });
      tb.appendChild(tr);
      const er = document.createElement('tr');
      er.className = 'row-error';
      er.innerHTML = '<td colspan="5"></td>';
      er.style.display = 'none';
      tb.appendChild(er);
    });
    $('btnAddProject').disabled = S.projects.length >= MAX_PROJECTS;
    $('projectCount').textContent = `${S.projects.length} projetos (de ${MIN_PROJECTS} a ${MAX_PROJECTS})`;
  }

  function onDataChanged() {
    const res = validate();
    showValidation(res);
    S.valid = res.ok;
    S.dirty = true;
    if (S.running) pause();
    updateControls();
  }

  function finished() { return S.engine && S.engine.isFinished(); }

  function updateControls() {
    const canGo = S.engine && S.valid && !S.dirty && !finished();
    $('btnRun').disabled = S.running || !canGo;
    $('btnPause').disabled = !S.running;
    $('btnStep').disabled = S.running || !canGo;
    $('btnReset').disabled = !S.valid;

    const st = $('status');
    st.className = 'status';
    if (!S.valid) { st.textContent = 'Há campos inválidos. Corrija os campos destacados para poder reiniciar.'; st.classList.add('err'); }
    else if (S.dirty) { st.textContent = 'Dados ou parâmetros alterados. Clique em Reiniciar para aplicá-los (o histórico atual será descartado).'; st.classList.add('warn'); }
    else if (finished()) { st.textContent = `Execução encerrada: limite de ${S.values.generations} gerações atingido. Resultado final exibido abaixo.`; st.classList.add('done'); }
    else if (S.running) st.textContent = `Executando… geração ${S.engine.generation} de ${S.values.generations}.`;
    else if (S.engine.generation === 0) st.textContent = `Pronto. Geração 0 criada com a semente ${S.values.seed}. Use Executar ou Avançar uma geração.`;
    else st.textContent = `Pausado na geração ${S.engine.generation} de ${S.values.generations}. Executar retoma a partir daqui.`;
  }

  function reset() {
    const res = validate();
    showValidation(res);
    S.valid = res.ok;
    if (!res.ok) { updateControls(); return; }
    S.running = false;
    S.runToken++;
    animator.cancel();
    const v = res.values;
    S.values = v;
    S.inst = GA.makeInstance(v.projects, v.budget);
    S.engine = new GA.GAEngine(S.inst, {
      popSize: v.popSize, generations: v.generations,
      crossoverRate: v.crossoverRate / 100, mutationRate: v.mutationRate / 100,
      tournamentSize: v.tournamentSize, eliteCount: v.eliteCount, seed: v.seed
    });
    S.dirty = false;
    S.selectedGen = 0;
    S.renderedHistory = 0;
    $('historyTable').querySelector('tbody').innerHTML = '';
    $('animGen').innerHTML = ''; $('logGen').innerHTML = '';
    $('stage').innerHTML = '<p class="empty">Use “Avançar uma geração” ou escolha uma geração e clique em “Animar geração”.</p>';
    renderAll();
    updateControls();
  }

  async function run() {
    if (S.running || S.dirty || !S.valid || finished()) return;
    S.running = true;
    const tok = ++S.runToken;
    updateControls();
    while (S.running && tok === S.runToken && !finished()) {
      const rec = S.engine.step();
      S.selectedGen = rec.gen;
      renderAll();
      updateControls();
      if ($('animOnRun').checked) await animator.play(rec, S.inst);
      else await sleep(Number($('runDelay').value));
    }
    if (tok === S.runToken) { S.running = false; updateControls(); }
  }

  function pause() {
    S.running = false;
    S.runToken++;
    updateControls();
  }

  function stepOnce() {
    if (S.running || S.dirty || !S.valid || finished()) return;
    const rec = S.engine.step();
    S.selectedGen = rec.gen;
    renderAll();
    updateControls();
    if ($('animOnStep').checked) animator.play(rec, S.inst);
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const pts = c => GA.formatPoints(c);
  const avgTxt = a => (a / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function renderAll() {
    renderMetrics();
    renderSolution();
    renderHistory();
    renderPopulation();
    renderChart();
    syncGenSelects();
    renderLog(S.selectedGen);
  }

  function renderMetrics() {
    const h = S.engine.history, last = h[h.length - 1];
    $('mGen').textContent = `${S.engine.generation} / ${S.values.generations}`;
    $('mBest').textContent = pts(last.bestFitness);
    $('mAvg').textContent = avgTxt(last.avgFitness);
    $('mOverall').textContent = pts(S.engine.bestOverall.fitness);
  }

  function renderSolution() {
    const bo = S.engine.bestOverall;
    const ev = GA.evaluate(bo.chrom, S.inst);
    const fin = finished();
    $('solutionPanel').classList.toggle('final', fin);
    $('solutionTitle').textContent = fin
      ? 'Resultado final: melhor solução de toda a execução'
      : 'Melhor solução encontrada até agora';
    const body = $('solutionBody');
    body.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'sol-grid';
    const c = document.createElement('div');
    c.className = 'sol-chrom';
    c.appendChild(window.GAChromEl(bo.chrom));
    grid.appendChild(c);
    const names = ev.selected.map(i => `${GA.geneLabel(i)}. ${S.inst.projects[i].name}`).join('; ') || 'nenhum (seleção vazia)';
    const dl = document.createElement('dl');
    const rows = [
      ['Cromossomo', GA.chromToStr(bo.chrom)],
      ['Projetos escolhidos', names],
      ['Custo total', GA.formatMoney(ev.cost)],
      ['Benefício total (aptidão)', pts(ev.benefit)],
      ['Saldo do orçamento', GA.formatMoney(ev.balance)],
      ['Encontrada na geração', String(bo.gen)]
    ];
    for (const [k, val] of rows) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = val;
      dl.appendChild(dt); dl.appendChild(dd);
    }
    grid.appendChild(dl);
    body.appendChild(grid);
  }

  function renderHistory() {
    const tb = $('historyTable').querySelector('tbody');
    const h = S.engine.history;
    for (let g = S.renderedHistory; g < h.length; g++) {
      const r = h[g];
      const tr = document.createElement('tr');
      tr.dataset.gen = g;
      tr.innerHTML = `<td>${r.gen}</td><td>${pts(r.bestFitness)}</td><td class="mono">${GA.chromToStr(r.bestChrom)}</td><td>${avgTxt(r.avgFitness)}</td><td>${pts(r.bestOverall.fitness)} <span class="mono">(${GA.chromToStr(r.bestOverall.chrom)})</span></td>`;
      tr.addEventListener('click', () => selectGen(g));
      tb.appendChild(tr);
    }
    S.renderedHistory = h.length;
    tb.querySelectorAll('tr').forEach(tr => tr.classList.toggle('sel', Number(tr.dataset.gen) === S.selectedGen));
    const wrap = tb.closest('.scroll');
    if (S.running) wrap.scrollTop = wrap.scrollHeight;
  }

  function renderPopulation() {
    const tb = $('popTable').querySelector('tbody');
    const rec = S.engine.history[S.engine.history.length - 1];
    const origin = new Array(rec.population.length);
    if (rec.events.type === 'init') origin.fill('<span class="badge init">inicial</span>');
    else {
      rec.events.elite.forEach(e => { origin[e.to] = `<span class="badge elite">elite (era #${e.from + 1})</span>`; });
      rec.events.pairs.forEach((p, k) => p.placed.forEach((pos, c) => { origin[pos] = `<span class="badge child">filho ${c + 1} do par ${k + 1}</span>`; }));
    }
    let html = '';
    rec.population.forEach((ind, i) => {
      const ev = GA.evaluate(ind.chrom, S.inst);
      const best = i === rec.bestIndex ? ' <span class="badge best">melhor</span>' : '';
      html += `<tr><td>${i + 1}</td><td class="mono">${GA.chromToStr(ind.chrom)}</td><td>${ev.selected.map(GA.geneLabel).join(', ') || '–'}</td><td>${GA.formatMoney(ind.cost)}</td><td>${GA.formatMoney(ev.balance)}</td><td>${pts(ind.fitness)}</td><td>${origin[i]}${best}</td></tr>`;
    });
    tb.innerHTML = html;
  }

  function renderChart() {
    window.GAChart.drawChart($('chart'), S.engine.history, S.values.generations);
  }

  function syncGenSelects() {
    for (const id of ['animGen', 'logGen']) {
      const sel = $(id);
      for (let g = sel.options.length; g < S.engine.history.length; g++) {
        const o = document.createElement('option');
        o.value = g; o.textContent = g;
        sel.appendChild(o);
      }
      sel.value = String(S.selectedGen);
    }
  }

  function renderLog(g) {
    const rec = S.engine.history[g];
    $('log').textContent = rec ? GA.formatGenerationLog(rec, S.inst).join('\n') : '';
  }

  function selectGen(g) {
    S.selectedGen = g;
    $('animGen').value = String(g);
    $('logGen').value = String(g);
    renderLog(g);
    $('historyTable').querySelectorAll('tbody tr').forEach(tr => tr.classList.toggle('sel', Number(tr.dataset.gen) === g));
  }

  function runTests() {
    const out = $('testsOut');
    out.innerHTML = '';
    const r = window.GATests.runValidationTests(GA);
    const head = document.createElement('p');
    head.className = 'hint';
    head.textContent = `${r.passed} de ${r.total} seções aprovadas.`;
    out.appendChild(head);
    for (const s of r.sections) {
      const d = document.createElement('div');
      d.className = 'test-sec';
      const h = document.createElement('h3');
      h.textContent = `${s.id} ${s.title}`;
      const res = document.createElement('span');
      res.className = 'res ' + (s.ok ? 'ok' : 'bad');
      res.textContent = s.ok ? 'aprovado' : 'falhou';
      h.appendChild(res);
      const pre = document.createElement('pre');
      pre.textContent = s.lines.join('\n');
      d.appendChild(h); d.appendChild(pre);
      out.appendChild(d);
    }
  }

  function downloadLog() {
    const lines = [];
    const v = S.values;
    lines.push('Simulador de algoritmo genético: seleção de projetos do campus');
    lines.push(`Projetos: ${v.projects.map((p, i) => `${GA.geneLabel(i)}. ${p.name} (custo ${GA.formatMoney(Math.round(p.cost * 100))}, benefício ${p.benefit})`).join('; ')}`);
    lines.push(`Orçamento ${GA.formatMoney(Math.round(v.budget * 100))}; população ${v.popSize}; gerações ${v.generations}; cruzamento ${v.crossoverRate}%; mutação ${v.mutationRate}%; torneio ${v.tournamentSize}; elite ${v.eliteCount}; semente ${v.seed}.`);
    lines.push('');
    for (const rec of S.engine.history) { lines.push(...GA.formatGenerationLog(rec, S.inst)); lines.push(''); }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `log-ag-semente-${v.seed}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $('btnRun').addEventListener('click', run);
  $('btnPause').addEventListener('click', pause);
  $('btnStep').addEventListener('click', stepOnce);
  $('btnReset').addEventListener('click', reset);
  $('btnAddProject').addEventListener('click', () => {
    if (S.projects.length >= MAX_PROJECTS) return;
    S.projects.push({ name: `Novo projeto ${S.projects.length + 1}`, cost: '1000,00', benefit: '1' });
    renderProjects(); onDataChanged();
  });
  $('btnExample').addEventListener('click', () => {
    S.projects = EXAMPLE();
    const defaults = { budget: '7000,00', popSize: '20', generations: '50', crossoverRate: '80', mutationRate: '5', tournamentSize: '2', eliteCount: '1', seed: '42' };
    for (const id of PARAM_IDS) $(id).value = defaults[id];
    renderProjects(); onDataChanged();
  });
  for (const id of PARAM_IDS) $(id).addEventListener('input', onDataChanged);
  $('animSpeed').addEventListener('change', e => animator.setSpeed(Number(e.target.value)));
  $('btnSkip').addEventListener('click', () => animator.skip());
  $('btnReplay').addEventListener('click', () => {
    const g = Number($('animGen').value);
    const rec = S.engine && S.engine.history[g];
    if (!rec) return;
    selectGen(g);
    if (rec.events) animator.play(rec, S.inst);
    else { animator.cancel(); $('stage').innerHTML = '<p class="empty">Os detalhes desta geração não ficaram guardados. Nesta configuração só as gerações mais recentes são mantidas em memória.</p>'; }
  });
  $('animGen').addEventListener('change', e => selectGen(Number(e.target.value)));
  $('logGen').addEventListener('change', e => selectGen(Number(e.target.value)));
  $('btnDownloadLog').addEventListener('click', downloadLog);
  $('btnTests').addEventListener('click', runTests);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => S.engine && renderChart(), 120); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => S.engine && renderChart());

  renderProjects();
  reset();
})();
