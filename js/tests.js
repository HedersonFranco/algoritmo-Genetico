// Testes da seção 6 do enunciado (usados pelo botão da página e pelo run-tests-node.js)
(function (global) {
  'use strict';

  const EXAMPLE_PROJECTS = [
    { name: 'Melhoria da iluminação', cost: 4000, benefit: 7 },
    { name: 'Instalação de bicicletários', cost: 3000, benefit: 5 },
    { name: 'Aquisição de bancos', cost: 2000, benefit: 3 },
    { name: 'Reforma de espaço de convivência', cost: 5000, benefit: 8 }
  ];
  const BASE_PARAMS = {
    popSize: 20, generations: 50, crossoverRate: 0.8, mutationRate: 0.05,
    tournamentSize: 2, eliteCount: 1, seed: 42
  };

  function runValidationTests(GA) {
    const S = GA.chromToStr, C = GA.strToChrom, M = GA.formatMoney, P = GA.formatPoints, L = GA.geneLabel;
    const inst = GA.makeInstance(EXAMPLE_PROJECTS, 7000);
    const sections = [];
    const section = (id, title) => { const s = { id, title, lines: [], ok: true }; sections.push(s); return s; };
    const check = (s, cond, msg) => { s.lines.push(`${cond ? '[OK]  ' : '[FALHA]'} ${msg}`); if (!cond) s.ok = false; };
    const names = ev => ev.selected.map(i => L(i)).join(' e ') || 'nenhum';

    // 6.2
    {
      const s = section('6.2', 'Avaliação de uma solução');
      const ev = GA.evaluate(C('1100'), inst);
      const rep = GA.repair(C('1100'), inst);
      s.lines.push(`Entrada: 1100; orçamento ${M(inst.budget)}.`);
      s.lines.push(`Saída: projetos ${names(ev)}; custo ${M(ev.cost)}; benefício ${P(ev.benefit)}; saldo ${M(ev.balance)}; ${ev.feasible ? 'viável' : 'inviável'}; aptidão ${P(rep.eval.benefit)}.`);
      check(s, ev.cost === 700000 && ev.benefit === 1200 && ev.balance === 0 && ev.feasible && rep.eval.benefit === 1200,
        'Projetos A e B, custo R$ 7.000, benefício 12, saldo R$ 0, viável, aptidão 12.');
      const expected = { '0000': [0, 0], '1000': [4000, 7], '0100': [3000, 5], '0010': [2000, 3], '0001': [5000, 8],
                         '1100': [7000, 12], '1010': [6000, 10], '0110': [5000, 8], '0011': [7000, 11] };
      const feasible = [];
      let allMatch = true;
      for (let m = 0; m < 16; m++) {
        const str = m.toString(2).padStart(4, '0');
        const e = GA.evaluate(C(str), inst);
        if (e.feasible) {
          feasible.push(str);
          const exp = expected[str];
          if (!exp || e.cost !== exp[0] * 100 || e.benefit !== exp[1] * 100) allMatch = false;
          s.lines.push(`  ${str} → custo ${M(e.cost)}; benefício ${P(e.benefit)}.`);
        }
      }
      check(s, allMatch && feasible.length === 9, `Enumeração das 16 combinações: exatamente as 9 soluções viáveis da tabela, com custos e benefícios corretos.`);
      let best = null;
      for (const f of feasible) { const e = GA.evaluate(C(f), inst); if (!best || e.benefit > best[1]) best = [f, e.benefit]; }
      check(s, best[0] === '1100' && best[1] === 1200, `Ótimo global por enumeração: ${best[0]} com benefício ${P(best[1])}.`);
    }

    // 6.3
    {
      const s = section('6.3', 'Reparação de uma solução inviável');
      const ev0 = GA.evaluate(C('1111'), inst);
      const rep = GA.repair(C('1111'), inst);
      s.lines.push(`Entrada: 1111; orçamento ${M(inst.budget)}.`);
      s.lines.push(`1111 → custo ${M(ev0.cost)}; benefício ${P(ev0.benefit)}.`);
      for (const st of rep.steps) {
        s.lines.push(`Remover ${L(st.removed)} (menor razão benefício/custo). ${S(st.after)} → custo ${M(st.costAfter)}; benefício ${P(st.benefitAfter)}.`);
      }
      s.lines.push(`Resultado: ${S(rep.chrom)}; ${rep.eval.feasible ? 'solução viável' : 'inviável'}.`);
      check(s, rep.steps.length === 2 && rep.steps[0].removed === 2 && S(rep.steps[0].after) === '1101' &&
               rep.steps[0].costAfter === 1200000 && rep.steps[0].benefitAfter === 2000 &&
               rep.steps[1].removed === 3 && S(rep.chrom) === '1100' && rep.eval.cost === 700000 && rep.eval.benefit === 1200,
        'Sequência exata 1111 → 1101 (remove C) → 1100 (remove D), custo R$ 7.000, benefício 12.');
    }

    // 6.4
    {
      const s = section('6.4', 'Cruzamento e mutação com escolhas controladas');
      const p1 = C('1100'), p2 = C('0011');
      const [f1, f2] = GA.onePointCrossover(p1, p2, 2);
      s.lines.push(`Cruzamento: 11|00 + 00|11 → filho 1 = ${S(f1)}; filho 2 = ${S(f2)}.`);
      check(s, S(f1) === '1111' && S(f2) === '0000', 'Cruzamento forçado com corte após o 2º gene.');
      const m1 = GA.flipGenes(f1, [0]), m2 = GA.flipGenes(f2, []);
      s.lines.push(`Mutação: filho 1 = ${S(m1)}; filho 2 = ${S(m2)}.`);
      check(s, S(m1) === '0111' && S(m2) === '0000', 'Mutação apenas do 1º gene do filho 1.');
      const r1 = GA.repair(m1, inst), r2 = GA.repair(m2, inst);
      const chain = r => [S(r.steps.length ? r.steps[0].before : r.chrom)].concat(r.steps.map(x => S(x.after))).join(' → ');
      s.lines.push(`Reparação do filho 1: ${chain(r1)} (removendo ${r1.steps.map(x => L(x.removed)).join(' e depois ')}).`);
      s.lines.push(`Reparação do filho 2: ${r2.steps.length ? chain(r2) : 'permanece ' + S(r2.chrom)}.`);
      s.lines.push(`Avaliação final: filho 1 = ${S(r1.chrom)}, custo ${M(r1.eval.cost)}, aptidão ${P(r1.eval.benefit)}; filho 2 = ${S(r2.chrom)}, custo ${M(r2.eval.cost)}, aptidão ${P(r2.eval.benefit)}.`);
      check(s, chain(r1) === '0111 → 0101 → 0100' && r1.eval.cost === 300000 && r1.eval.benefit === 500 &&
               r2.steps.length === 0 && S(r2.chrom) === '0000' && r2.eval.benefit === 0,
        'Reparação e avaliação idênticas às de referência.');

      // taxas 0% e 100%
      const rng = GA.createRng(7);
      let ok0 = true, ok100 = true, okCx0 = true, okCx100 = true;
      for (let t = 0; t < 200; t++) {
        const c = Array.from({ length: 4 }, () => (rng() < 0.5 ? 1 : 0));
        const m0 = GA.mutationStep(c, 0, rng);
        if (m0.flipped.length !== 0 || S(m0.chrom) !== S(c)) ok0 = false;
        const mAll = GA.mutationStep(c, 1, rng);
        if (mAll.flipped.length !== 4 || S(mAll.chrom) !== S(c.map(b => 1 - b))) ok100 = false;
        const cx0 = GA.crossoverStep(p1, p2, 0, rng);
        if (cx0.occurred || S(cx0.children[0]) !== '1100' || S(cx0.children[1]) !== '0011') okCx0 = false;
        const cx1 = GA.crossoverStep(p1, p2, 1, rng);
        if (!cx1.occurred || cx1.cut < 1 || cx1.cut > 3) okCx100 = false;
      }
      check(s, ok0, 'Mutação 0% (200 cromossomos): nenhum gene invertido.');
      check(s, ok100, 'Mutação 100% (200 cromossomos): todos os genes invertidos antes da reparação.');
      check(s, okCx0, 'Cruzamento 0% (200 pares): filhos copiam os pais antes da mutação.');
      check(s, okCx100, 'Cruzamento 100% (200 pares): sempre ocorre, com corte entre o 1º e o penúltimo gene (1 a 3).');

      // torneio
      const fit = [700, 1100, 1200]; // 1000, 0011, 1100
      const w = GA.pickTournamentWinner([0, 1, 2], fit);
      s.lines.push(`Torneio: 1000 (apt. 7), 0011 (apt. 11), 1100 (apt. 12) → vencedor ${['1000', '0011', '1100'][w]}.`);
      check(s, w === 2, 'Vence o candidato de maior aptidão (1100).');
      const tieFit = [800, 800, 700]; // #1 0110 (8), #2 0001 (8), #3 1000 (7)
      const wTie = GA.pickTournamentWinner([1, 0, 2], tieFit);
      const wTie2 = GA.pickTournamentWinner([2, 1], [0, 800, 800]);
      s.lines.push(`Empate: #1 0110 (apt. 8) e #2 0001 (apt. 8), sorteados na ordem #2, #1 → vencedor #${wTie + 1}; #2 e #3 com apt. 8 → vencedor #${wTie2 + 1}.`);
      check(s, wTie === 0 && wTie2 === 1, 'Em empate vence o menor índice da população, independentemente da ordem do sorteio.');
      const trng = GA.createRng(3);
      let distinct = true;
      for (let t = 0; t < 500; t++) {
        const r = GA.tournament(new Array(5).fill(0), 5, trng);
        if (new Set(r.candidates).size !== 5) distinct = false;
      }
      check(s, distinct, 'Candidatos de cada torneio são distintos (500 torneios com k = tamanho da população).');
    }

    // 6.5
    let engine;
    {
      const s = section('6.5', 'Execução completa e análise');
      engine = new GA.GAEngine(inst, BASE_PARAMS);
      while (!engine.isFinished()) engine.step();
      const h = engine.history, bo = engine.bestOverall, ev = GA.evaluate(bo.chrom, inst);
      s.lines.push(`Parâmetros: população 20; 50 gerações; cruzamento 80%; mutação 5% por gene; torneio 2; elite 1; semente 42.`);
      s.lines.push(`Melhor solução: ${S(bo.chrom)}; projetos ${names(ev)}; custo ${M(ev.cost)}; benefício ${P(ev.benefit)}; saldo ${M(ev.balance)}; encontrada na geração ${bo.gen}.`);
      s.lines.push(`Gerações 0, 1, 5, 10, 25, 50 (melhor / média): ` +
        [0, 1, 5, 10, 25, 50].map(g => `${g}: ${P(h[g].bestFitness)} / ${(h[g].avgFitness / 100).toFixed(2).replace('.', ',')}`).join('; ') + '.');
      check(s, h.length === 51, `Histórico com ${h.length} registros (geração 0 + 50).`);
      check(s, ev.feasible && ev.cost <= 700000 && ev.benefit <= 1200 && ev.benefit === bo.fitness && ev.cost === bo.cost,
        'Solução final viável e totais compatíveis com o cromossomo.');
      let monoOverall = true, monoPop = true;
      for (let g = 1; g < h.length; g++) {
        if (h[g].bestOverall.fitness < h[g - 1].bestOverall.fitness) monoOverall = false;
        if (h[g].bestFitness < h[g - 1].bestFitness) monoPop = false;
      }
      check(s, monoOverall, 'Melhor benefício acumulado nunca diminui.');
      check(s, monoPop, 'Com 1 indivíduo de elite, a melhor aptidão da população nunca diminui.');
      check(s, h.every(r => r.population.length === 20), 'Tamanho da população constante (20) em todas as gerações.');
      const again = new GA.GAEngine(inst, BASE_PARAMS);
      while (!again.isFinished()) again.step();
      check(s, again.history.every((r, g) => r.population.map(p => S(p.chrom)).join() === h[g].population.map(p => S(p.chrom)).join()),
        'Reprodutibilidade: mesma semente e parâmetros → execução idêntica.');

      // mutação 1% x 20%
      s.lines.push('Efeito da taxa de mutação (demais parâmetros iguais; sementes 1 a 5):');
      const summary = {};
      for (const rate of [0.01, 0.20]) {
        const res = [];
        for (const seed of [1, 2, 3, 4, 5]) {
          const e = new GA.GAEngine(inst, Object.assign({}, BASE_PARAMS, { mutationRate: rate, seed }));
          while (!e.isFinished()) e.step();
          const last = e.history.slice(-10);
          const avgLast = last.reduce((a, r) => a + r.avgFitness, 0) / last.length / 100;
          res.push({ seed, fit: e.bestOverall.fitness, chrom: S(e.bestOverall.chrom), gen: e.bestOverall.gen, avgLast });
        }
        const mean = res.reduce((a, r) => a + r.fit, 0) / res.length / 100;
        const hits = res.filter(r => r.fit === 1200).length;
        const meanAvg = res.reduce((a, r) => a + r.avgLast, 0) / res.length;
        summary[rate] = { res, mean, hits, meanAvg };
        s.lines.push(`  Mutação ${rate * 100}%: ` + res.map(r => `semente ${r.seed} → ${r.chrom} (benefício ${P(r.fit)}, geração ${r.gen})`).join('; ') +
          `. Média do melhor benefício final: ${mean.toFixed(2).replace('.', ',')}; execuções que atingiram 12: ${hits}/5; aptidão média da população nas 10 últimas gerações: ${meanAvg.toFixed(2).replace('.', ',')}.`);
      }
      s.mutationSummary = summary;
    }

    // 6.6
    {
      const s = section('6.6', 'Limites de orçamento');
      const inst0 = GA.makeInstance(EXAMPLE_PROJECTS, 0);
      const e0 = new GA.GAEngine(inst0, BASE_PARAMS);
      const gen0All = e0.history[0].population.every(p => S(p.chrom) === '0000' && p.fitness === 0 && p.cost === 0);
      while (!e0.isFinished()) e0.step();
      const allGens = e0.history.every(r => r.population.every(p => S(p.chrom) === '0000' && p.fitness === 0));
      const ev0 = GA.evaluate(C('0000'), inst0);
      s.lines.push(`Orçamento R$ 0: população inicial após reparação = ${e0.history[0].population.map(p => S(p.chrom))[0]} (todos os 20); melhor final ${S(e0.bestOverall.chrom)}, custo ${M(ev0.cost)}, benefício ${P(ev0.benefit)}, aptidão ${P(e0.bestOverall.fitness)}.`);
      check(s, gen0All, 'Orçamento R$ 0: toda a população inicial reparada é 0000, com custo, benefício e aptidão zero.');
      check(s, allGens, 'Orçamento R$ 0: todas as 51 gerações contêm apenas 0000.');
      const inst14 = GA.makeInstance(EXAMPLE_PROJECTS, 14000);
      const ev14 = GA.evaluate(C('1111'), inst14);
      const rep14 = GA.repair(C('1111'), inst14);
      s.lines.push(`Orçamento R$ 14.000: 1111 → custo ${M(ev14.cost)}; benefício ${P(ev14.benefit)}; saldo ${M(ev14.balance)}; ${ev14.feasible ? 'viável' : 'inviável'}; reparações: ${rep14.steps.length}.`);
      check(s, ev14.feasible && ev14.cost === 1400000 && ev14.benefit === 2300 && ev14.balance === 0 && rep14.steps.length === 0,
        'Orçamento R$ 14.000: 1111 viável, custo R$ 14.000, benefício 23, saldo R$ 0.');
      const e14 = new GA.GAEngine(inst14, BASE_PARAMS);
      while (!e14.isFinished()) e14.step();
      s.lines.push(`Execução completa com R$ 14.000 (semente 42): melhor ${S(e14.bestOverall.chrom)}, benefício ${P(e14.bestOverall.fitness)}, geração ${e14.bestOverall.gen}.`);
    }

    const passed = sections.filter(s => s.ok).length;
    return { sections, passed, total: sections.length };
  }

  const Tests = { runValidationTests, EXAMPLE_PROJECTS, BASE_PARAMS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Tests;
  else global.GATests = Tests;
})(typeof window !== 'undefined' ? window : globalThis);
