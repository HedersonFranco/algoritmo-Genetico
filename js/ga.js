// Algoritmo genético para a seleção de projetos.
// Custos ficam em centavos e benefícios em centésimos de ponto (inteiros),
// para não ter erro de arredondamento nas somas.
// Ordem dos sorteios em cada par: torneio 1, torneio 2, cruzamento, corte,
// mutação do filho 1, mutação do filho 2.
(function (global) {
  'use strict';

  function createRng(seed) {
    // mulberry32
    let a = ((Number(seed) % 4294967296) + 4294967296) % 4294967296;
    a = a >>> 0;
    return function next() {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // inteiro entre min e max (inclusive)
  function randInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
  }

  function geneLabel(i) { return String.fromCharCode(65 + i); }
  function chromToStr(c) { return c.join(''); }
  function strToChrom(s) { return s.split('').map(Number); }

  function formatMoney(cents) {
    return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function formatPoints(centi) {
    return (centi / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  function makeInstance(projects, budgetReais) {
    return {
      projects: projects.map(p => ({
        name: p.name,
        cost: Math.round(p.cost * 100),
        benefit: Math.round(p.benefit * 100)
      })),
      budget: Math.round(budgetReais * 100)
    };
  }

  function evaluate(chrom, inst) {
    let cost = 0, benefit = 0;
    const selected = [];
    for (let i = 0; i < chrom.length; i++) {
      if (chrom[i] === 1) {
        cost += inst.projects[i].cost;
        benefit += inst.projects[i].benefit;
        selected.push(i);
      }
    }
    return { cost, benefit, selected, feasible: cost <= inst.budget, balance: inst.budget - cost };
  }

  // compara b_i/c_i < b_j/c_j sem divisão
  function ratioLess(inst, i, j) {
    const pi = inst.projects[i], pj = inst.projects[j];
    return pi.benefit * pj.cost < pj.benefit * pi.cost;
  }

  function repair(chrom, inst) {
    const c = chrom.slice();
    const steps = [];
    let ev = evaluate(c, inst);
    while (ev.cost > inst.budget) {
      let worst = -1;
      for (let i = 0; i < c.length; i++) {
        // com < estrito, no empate fica o menor índice
        if (c[i] === 1 && (worst < 0 || ratioLess(inst, i, worst))) worst = i;
      }
      const before = c.slice();
      c[worst] = 0;
      const after = evaluate(c, inst);
      steps.push({
        removed: worst,
        before, after: c.slice(),
        costBefore: ev.cost, benefitBefore: ev.benefit,
        costAfter: after.cost, benefitAfter: after.benefit
      });
      ev = after;
    }
    return { chrom: c, steps, eval: ev };
  }

  function pickTournamentWinner(candidates, fitness) {
    let w = candidates[0];
    for (const c of candidates) {
      if (fitness[c] > fitness[w] || (fitness[c] === fitness[w] && c < w)) w = c;
    }
    return w;
  }

  function tournament(fitness, k, rng) {
    const n = fitness.length;
    const idx = Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < k; i++) { // sorteia k candidatos distintos
      const j = randInt(rng, i, n - 1);
      const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
    }
    const candidates = idx.slice(0, k);
    return { candidates, winner: pickTournamentWinner(candidates, fitness) };
  }

  // corte depois do gene cut
  function onePointCrossover(p1, p2, cut) {
    return [p1.slice(0, cut).concat(p2.slice(cut)), p2.slice(0, cut).concat(p1.slice(cut))];
  }

  function crossoverStep(p1, p2, rate, rng) {
    const roll = rng();
    if (roll < rate) {
      const cut = randInt(rng, 1, p1.length - 1);
      return { occurred: true, roll, cut, children: onePointCrossover(p1, p2, cut) };
    }
    return { occurred: false, roll, cut: null, children: [p1.slice(), p2.slice()] };
  }

  function flipGenes(chrom, positions) {
    const c = chrom.slice();
    for (const p of positions) c[p] = 1 - c[p];
    return c;
  }

  function mutationStep(chrom, rate, rng) {
    const flipped = [];
    for (let i = 0; i < chrom.length; i++) if (rng() < rate) flipped.push(i);
    return { before: chrom.slice(), flipped, chrom: flipGenes(chrom, flipped) };
  }

  class GAEngine {
    // taxas de 0 a 1
    constructor(inst, params) {
      this.inst = inst;
      this.params = Object.assign({}, params);
      this.L = inst.projects.length;
      this.rng = createRng(params.seed);
      this.generation = 0;
      this.history = [];
      this.bestOverall = null;
      this.detailBudget = params.detailBudget || 200000;
      this._initialize();
    }

    _individual(chrom) {
      const ev = evaluate(chrom, this.inst);
      return { chrom: chrom.slice(), fitness: ev.benefit, cost: ev.cost };
    }

    _initialize() {
      const { popSize } = this.params;
      const pop = [], individuals = [];
      for (let i = 0; i < popSize; i++) {
        const raw = [];
        for (let j = 0; j < this.L; j++) raw.push(this.rng() < 0.5 ? 1 : 0);
        const rep = repair(raw, this.inst);
        const ind = this._individual(rep.chrom);
        pop.push(ind);
        individuals.push({ index: i, raw, steps: rep.steps, chrom: rep.chrom, fitness: ind.fitness, cost: ind.cost });
      }
      this.population = pop;
      this._record({ type: 'init', individuals });
    }

    _record(events) {
      const pop = this.population;
      let bestIdx = 0, sum = 0;
      for (let i = 0; i < pop.length; i++) {
        sum += pop[i].fitness;
        if (pop[i].fitness > pop[bestIdx].fitness) bestIdx = i;
      }
      const best = pop[bestIdx];
      if (!this.bestOverall || best.fitness > this.bestOverall.fitness) {
        this.bestOverall = { chrom: best.chrom.slice(), fitness: best.fitness, cost: best.cost,
                             gen: this.generation, index: bestIdx };
      }
      this.history.push({
        gen: this.generation,
        bestIndex: bestIdx,
        bestFitness: best.fitness,
        bestChrom: best.chrom.slice(),
        avgFitness: sum / pop.length,
        bestOverall: Object.assign({}, this.bestOverall, { chrom: this.bestOverall.chrom.slice() }),
        population: pop.map(p => ({ chrom: p.chrom.slice(), fitness: p.fitness, cost: p.cost })),
        events
      });
      // em execuções muito grandes, os detalhes das gerações antigas são descartados
      const keep = Math.max(1, Math.floor(this.detailBudget / this.params.popSize));
      const old = this.history.length - 1 - keep;
      if (old >= 0 && this.history[old].events) {
        this.history[old].events = null;
        this.history[old].population = null;
      }
    }

    isFinished() { return this.generation >= this.params.generations; }

    // gera uma nova geração
    step() {
      if (this.isFinished()) return null;
      const { popSize, eliteCount, tournamentSize, crossoverRate, mutationRate } = this.params;
      const prev = this.population;
      const fit = prev.map(p => p.fitness);
      const next = [];

      // elitismo
      const order = prev.map((_, i) => i).sort((a, b) => fit[b] - fit[a] || a - b);
      const elite = [];
      for (let e = 0; e < eliteCount; e++) {
        const from = order[e];
        elite.push({ from, to: next.length, chrom: prev[from].chrom.slice(), fitness: prev[from].fitness, cost: prev[from].cost });
        next.push({ chrom: prev[from].chrom.slice(), fitness: prev[from].fitness, cost: prev[from].cost });
      }

      // filhos, com pais da população anterior
      const pairs = [];
      while (next.length < popSize) {
        const t1 = tournament(fit, tournamentSize, this.rng);
        const t2 = tournament(fit, tournamentSize, this.rng);
        const p1 = prev[t1.winner].chrom, p2 = prev[t2.winner].chrom;
        const cx = crossoverStep(p1, p2, crossoverRate, this.rng);
        const m1 = mutationStep(cx.children[0], mutationRate, this.rng);
        const m2 = mutationStep(cx.children[1], mutationRate, this.rng);
        const r1 = repair(m1.chrom, this.inst);
        const r2 = repair(m2.chrom, this.inst);
        const c1 = this._individual(r1.chrom), c2 = this._individual(r2.chrom);

        const room = popSize - next.length;
        const placed = [next.length];
        next.push(c1);
        if (room >= 2) { placed.push(next.length); next.push(c2); }

        const cand = t => t.candidates.map(i => ({ index: i, chrom: prev[i].chrom.slice(), fitness: prev[i].fitness }));
        pairs.push({
          tournaments: [
            { candidates: cand(t1), winner: t1.winner },
            { candidates: cand(t2), winner: t2.winner }
          ],
          parents: [p1.slice(), p2.slice()],
          crossover: { occurred: cx.occurred, roll: cx.roll, cut: cx.cut, rate: crossoverRate,
                       children: cx.children.map(c => c.slice()) },
          mutation: [m1, m2],
          repair: [r1, r2],
          children: [c1, c2],
          placed,
          discardedSecond: room < 2
        });
      }

      this.population = next;
      this.generation++;
      this._record({ type: 'gen', elite, pairs });
      return this.history[this.history.length - 1];
    }
  }

  function ordinal(n) { return n + 'º'; }
  function genesText(positions) {
    return positions.map(p => `${p + 1} (${geneLabel(p)})`).join(', ');
  }
  function repairText(r, inst) {
    if (r.steps.length === 0) return `${chromToStr(r.chrom)} já é viável, sem reparação`;
    const chain = [chromToStr(r.steps[0].before)].concat(r.steps.map(s => chromToStr(s.after))).join(' → ');
    const removed = r.steps.map(s => geneLabel(s.removed)).join(', depois ');
    return `${chain} (removido ${removed}, menor razão benefício/custo)`;
  }

  function formatGenerationLog(rec, inst) {
    const lines = [];
    if (!rec.events) {
      return [`Geração ${rec.gen}: detalhes não guardados (só as gerações mais recentes ficam em memória nesta configuração).`];
    }
    const ind = (i, c, f) => `#${i + 1} ${chromToStr(c)} (apt. ${formatPoints(f)})`;
    if (rec.events.type === 'init') {
      lines.push(`Geração 0: população inicial aleatória (cada gene: 50% de chance de 1).`);
      for (const it of rec.events.individuals) {
        const rep = it.steps.length
          ? `reparação: ${repairText({ chrom: it.chrom, steps: it.steps }, inst)}`
          : 'viável, sem reparação';
        lines.push(`  #${it.index + 1}: sorteado ${chromToStr(it.raw)}; ${rep}; custo ${formatMoney(it.cost)}; aptidão ${formatPoints(it.fitness)}.`);
      }
    } else {
      lines.push(`Geração ${rec.gen}`);
      if (rec.events.elite.length === 0) lines.push('  Elitismo: quantidade 0, nenhum indivíduo preservado.');
      for (const e of rec.events.elite) {
        lines.push(`  Elitismo: ${ind(e.from, e.chrom, e.fitness)} copiado sem modificação para a posição #${e.to + 1}.`);
      }
      rec.events.pairs.forEach((p, k) => {
        const tour = p.tournaments.map((t, i) => {
          const wf = t.candidates.find(c => c.index === t.winner).fitness;
          const tie = t.candidates.filter(c => c.fitness === wf).length > 1 ? ' (empate, vence o menor índice)' : '';
          return `torneio ${i + 1}: ${t.candidates.map(c => ind(c.index, c.chrom, c.fitness)).join(', ')} → vence #${t.winner + 1}${tie}`;
        }).join('; ');
        lines.push(`  Par ${k + 1}: ${tour}.`);
        const P1 = chromToStr(p.parents[0]), P2 = chromToStr(p.parents[1]);
        const cx = p.crossover;
        const roll = cx.roll.toFixed(3).replace('.', ',');
        const rate = (cx.rate * 100).toLocaleString('pt-BR') + '%';
        if (cx.occurred) {
          const s = (c) => chromToStr(c).slice(0, cx.cut) + '|' + chromToStr(c).slice(cx.cut);
          lines.push(`    Pais: ${P1} e ${P2}; cruzamento ocorreu (sorteio ${roll} < ${rate}); corte após o ${ordinal(cx.cut)} gene: ${s(p.parents[0])} + ${s(p.parents[1])} → filhos ${chromToStr(cx.children[0])} e ${chromToStr(cx.children[1])}.`);
        } else {
          lines.push(`    Pais: ${P1} e ${P2}; cruzamento não ocorreu (sorteio ${roll} ≥ ${rate}); filhos copiam os pais: ${P1} e ${P2}.`);
        }
        const mut = p.mutation.map((m, i) => m.flipped.length
          ? `filho ${i + 1}: gene(s) ${genesText(m.flipped)} invertido(s), ${chromToStr(m.before)} → ${chromToStr(m.chrom)}`
          : `filho ${i + 1}: sem mutação (${chromToStr(m.chrom)})`).join('; ');
        lines.push(`    Mutação: ${mut}.`);
        lines.push(`    Reparação: filho 1: ${repairText(p.repair[0], inst)}; filho 2: ${repairText(p.repair[1], inst)}.`);
        const ev = p.children.map((c, i) => {
          const where = i < p.placed.length ? `→ posição #${p.placed[i] + 1}` : '→ descartado (restava uma vaga; retido só o filho 1)';
          return `filho ${i + 1} = ${chromToStr(c.chrom)}, custo ${formatMoney(c.cost)}, aptidão ${formatPoints(c.fitness)} ${where}`;
        }).join('; ');
        lines.push(`    Avaliação: ${ev}.`);
      });
    }
    const bo = rec.bestOverall;
    const avg = (rec.avgFitness / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    lines.push(`  Resumo: melhor da geração #${rec.bestIndex + 1} ${chromToStr(rec.bestChrom)} (apt. ${formatPoints(rec.bestFitness)}); média ${avg}; melhor acumulado ${chromToStr(bo.chrom)} (apt. ${formatPoints(bo.fitness)}, geração ${bo.gen}).`);
    return lines;
  }

  const GA = {
    createRng, randInt, geneLabel, chromToStr, strToChrom, formatMoney, formatPoints,
    makeInstance, evaluate, repair, ratioLess, tournament, pickTournamentWinner,
    onePointCrossover, crossoverStep, flipGenes, mutationStep, GAEngine, formatGenerationLog
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GA;
  else global.GA = GA;
})(typeof window !== 'undefined' ? window : globalThis);
