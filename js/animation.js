// Animação de uma geração, feita a partir dos eventos guardados no histórico pelo GAEngine
(function (global) {
  'use strict';
  const GA = global.GA;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function chromEl(chrom, opts) {
    opts = opts || {};
    const d = el('div', 'chrom' + (opts.small ? ' small' : ''));
    d.setAttribute('aria-label', 'cromossomo ' + GA.chromToStr(chrom));
    chrom.forEach((b, i) => {
      const s = el('span', 'bit' + (b ? ' one' : ''), String(b));
      if (!opts.small) s.dataset.gene = GA.geneLabel(i);
      if (opts.each) opts.each(s, i);
      d.appendChild(s);
    });
    return d;
  }

  function setBit(span, v) {
    span.textContent = String(v);
    span.classList.toggle('one', v === 1);
  }

  const pts = c => GA.formatPoints(c);
  const money = c => GA.formatMoney(c);

  class Animator {
    constructor(stage) {
      this.stage = stage;
      this.token = 0;
      this.speed = 1;
      this.instant = false;
      this.playing = false;
    }
    setSpeed(s) { this.speed = s; }
    cancel() { this.token++; this.playing = false; }
    skip() { this.instant = true; this.stage.classList.add('instant'); }

    async wait(ms, tok) {
      if (this.instant || tok !== this.token) return tok === this.token;
      await new Promise(r => setTimeout(r, ms / this.speed));
      return tok === this.token;
    }
    scroll() { this.stage.scrollTop = this.stage.scrollHeight; }
    add(parent, node) { node.classList.add('reveal'); parent.appendChild(node); this.scroll(); return node; }

    op(card, name) {
      const row = el('div', 'op');
      row.appendChild(el('div', 'op-name', name));
      const body = el('div', 'op-body');
      row.appendChild(body);
      this.add(card, row);
      return body;
    }

    async play(rec, inst) {
      const tok = ++this.token;
      this.instant = false;
      this.playing = true;
      this.stage.classList.remove('instant');
      this.stage.innerHTML = '';
      const W = ms => this.wait(ms, tok);

      if (rec.events.type === 'init') await this.playInit(rec, inst, W);
      else {
        if (!(await this.playElite(rec, W))) return;
        for (let k = 0; k < rec.events.pairs.length; k++) {
          if (!(await this.playPair(rec.events.pairs[k], k, inst, W))) return;
        }
      }
      if (tok !== this.token) return;
      const sum = el('div', 'step-card');
      sum.appendChild(el('h3', null, `Resumo da geração ${rec.gen}`));
      const l = el('div', 'line');
      l.appendChild(chromEl(rec.bestChrom));
      l.appendChild(el('span', 'tag', `melhor da geração: #${rec.bestIndex + 1}, aptidão ${pts(rec.bestFitness)}; média ${(rec.avgFitness / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}; melhor acumulado ${pts(rec.bestOverall.fitness)} (geração ${rec.bestOverall.gen})`));
      sum.appendChild(l);
      this.add(this.stage, sum);
      this.playing = false;
    }

    async playInit(rec, inst, W) {
      const card = this.add(this.stage, el('div', 'step-card'));
      card.appendChild(el('h3', null, 'Geração 0: população inicial aleatória, reparada e avaliada'));
      for (const it of rec.events.individuals) {
        const body = this.op(card, `Indivíduo #${it.index + 1}`);
        const l = el('div', 'line');
        const raw = chromEl(it.raw);
        l.appendChild(raw);
        l.appendChild(el('span', 'tag', 'sorteado (cada gene com 50% de chance)'));
        this.add(body, l);
        if (!(await W(250))) return false;
        if (!(await this.playRepair(body, { chrom: it.chrom, steps: it.steps }, inst, W, null))) return false;
        const f = el('div', 'line');
        f.appendChild(el('span', 'tag', `custo ${money(it.cost)}; aptidão ${pts(it.fitness)}`));
        this.add(body, f);
      }
      return true;
    }

    async playElite(rec, W) {
      const card = this.add(this.stage, el('div', 'step-card elite-card'));
      card.appendChild(el('h3', null, `Geração ${rec.gen}: elitismo`));
      const elite = rec.events.elite;
      if (!elite.length) {
        card.appendChild(el('p', 'note', 'Quantidade de elite = 0: nenhum indivíduo é preservado; todas as vagas recebem descendentes.'));
        return W(300);
      }
      const box = el('div', 'cands');
      for (const e of elite) {
        const c = el('div', 'cand');
        c.appendChild(chromEl(e.chrom, { small: true }));
        c.appendChild(el('span', null, `#${e.from + 1}, aptidão ${pts(e.fitness)} → posição #${e.to + 1}`));
        box.appendChild(c);
      }
      this.add(card, box);
      if (!(await W(500))) return false;
      box.querySelectorAll('.cand').forEach(c => c.classList.add('elite'));
      card.appendChild(el('p', 'note', `Copiado(s) sem modificação para a próxima geração (melhores aptidões; empate → menor índice).`));
      return W(600);
    }

    async playPair(p, k, inst, W) {
      const card = this.add(this.stage, el('div', 'step-card'));
      const title = el('h3', null, `Par ${k + 1}`);
      card.appendChild(title);

      // seleção
      const sel = this.op(card, 'Seleção por torneio');
      for (let t = 0; t < 2; t++) {
        const tour = p.tournaments[t];
        const line = el('div', 'line');
        line.appendChild(el('span', 'tag', `Torneio ${t + 1}:`));
        const box = el('div', 'cands');
        const chips = tour.candidates.map(c => {
          const chip = el('div', 'cand');
          chip.appendChild(chromEl(c.chrom, { small: true }));
          chip.appendChild(el('span', null, `#${c.index + 1}, apt. ${pts(c.fitness)}`));
          box.appendChild(chip);
          return { chip, c };
        });
        line.appendChild(box);
        this.add(sel, line);
        if (!(await W(650))) return false;
        chips.forEach(({ chip, c }) => chip.classList.add(c.index === tour.winner ? 'winner' : 'loser'));
        const tie = tour.candidates.filter(c => c.fitness === tour.candidates.find(x => x.index === tour.winner).fitness).length > 1;
        line.appendChild(el('span', 'tag', `vence #${tour.winner + 1}${tie ? ' (empate → menor índice)' : ''}`));
        if (!(await W(450))) return false;
      }

      // cruzamento
      const cxBody = this.op(card, 'Cruzamento');
      const cx = p.crossover;
      const parentRows = [0, 1].map(i => {
        const l = el('div', 'line');
        const ch = chromEl(p.parents[i], { each: s => s.classList.add(i === 0 ? 'from-p1' : 'from-p2', 'tint') });
        l.appendChild(ch);
        l.appendChild(el('span', 'tag', `pai ${i + 1}`));
        this.add(cxBody, l);
        return ch;
      });
      if (!(await W(500))) return false;
      const rate = (cx.rate * 100).toLocaleString('pt-BR') + '%';
      const roll = cx.roll.toFixed(3).replace('.', ',');
      const info = el('p', 'note');
      const childRows = [];
      if (cx.occurred) {
        info.textContent = `Sorteio ${roll} < ${rate}: o cruzamento ocorre. Corte após o ${cx.cut}º gene; os segmentos depois do corte são trocados.`;
        this.add(cxBody, info);
        parentRows.forEach(ch => ch.children[cx.cut - 1].classList.add('cut-after'));
        if (!(await W(700))) return false;
        for (let c = 0; c < 2; c++) {
          const l = el('div', 'line');
          const head = c === 0 ? 'from-p1' : 'from-p2', tail = c === 0 ? 'from-p2' : 'from-p1';
          const ch = chromEl(cx.children[c], {
            each: (s, i) => {
              s.classList.add(i < cx.cut ? head : tail, 'tint');
              if (i === cx.cut - 1) s.classList.add('cut-after');
              if (i >= cx.cut) { s.classList.add('swap-in'); s.style.setProperty('--from-y', c === 0 ? '34px' : '-34px'); }
            }
          });
          l.appendChild(ch);
          l.appendChild(el('span', 'tag', `filho ${c + 1}`));
          this.add(cxBody, l);
          childRows.push(ch);
        }
      } else {
        info.textContent = `Sorteio ${roll} ≥ ${rate}: não há cruzamento; os filhos são cópias dos pais.`;
        this.add(cxBody, info);
        for (let c = 0; c < 2; c++) {
          const l = el('div', 'line');
          l.appendChild(chromEl(cx.children[c], { each: s => s.classList.add(c === 0 ? 'from-p1' : 'from-p2', 'tint') }));
          l.appendChild(el('span', 'tag', `filho ${c + 1}`));
          this.add(cxBody, l);
        }
      }
      if (!(await W(800))) return false;

      // mutação
      const mBody = this.op(card, 'Mutação');
      for (let c = 0; c < 2; c++) {
        const m = p.mutation[c];
        const l = el('div', 'line');
        const origin = (i) => cx.occurred ? ((i < cx.cut) === (c === 0) ? 'from-p1' : 'from-p2') : (c === 0 ? 'from-p1' : 'from-p2');
        const ch = chromEl(m.before, { each: (s, i) => s.classList.add(origin(i), 'tint') });
        l.appendChild(ch);
        const tag = el('span', 'tag', `filho ${c + 1}: sorteio por gene…`);
        l.appendChild(tag);
        this.add(mBody, l);
        if (!(await W(450))) return false;
        if (m.flipped.length) {
          for (const g of m.flipped) {
            const s = ch.children[g];
            s.classList.add('mut', 'pop');
            setBit(s, m.chrom[g]);
          }
          tag.textContent = `filho ${c + 1}: gene(s) ${m.flipped.map(g => GA.geneLabel(g)).join(', ')} invertido(s) → ${GA.chromToStr(m.chrom)}`;
          if (!(await W(650))) return false;
        } else {
          tag.textContent = `filho ${c + 1}: nenhum bit invertido`;
        }
      }

      // reparação
      const rBody = this.op(card, 'Reparação');
      for (let c = 0; c < 2; c++) {
        if (!(await this.playRepair(rBody, p.repair[c], inst, W, `filho ${c + 1}`))) return false;
      }

      // avaliação
      const eBody = this.op(card, 'Avaliação');
      for (let c = 0; c < 2; c++) {
        const child = p.children[c];
        const l = el('div', 'line');
        l.appendChild(chromEl(child.chrom));
        const kept = c < p.placed.length;
        l.appendChild(el('span', 'tag', `filho ${c + 1}: custo ${money(child.cost)}, aptidão ${pts(child.fitness)} → ` +
          (kept ? `posição #${p.placed[c] + 1}` : 'descartado (restava só uma vaga; fica apenas o filho 1)')));
        if (!kept) l.classList.add('discarded');
        this.add(eBody, l);
      }
      title.textContent = `Par ${k + 1} → posição${p.placed.length > 1 ? 'ões' : ''} ${p.placed.map(i => '#' + (i + 1)).join(' e ')}`;
      return W(700);
    }

    async playRepair(body, r, inst, W, who) {
      const prefix = who ? `${who}: ` : '';
      if (!r.steps.length) {
        const ev = GA.evaluate(r.chrom, inst);
        const l = el('div', 'line');
        if (who) l.appendChild(chromEl(r.chrom));
        l.appendChild(el('span', 'tag', `${prefix}custo ${money(ev.cost)} ≤ orçamento ${money(inst.budget)}: viável, sem reparação`));
        this.add(body, l);
        return W(300);
      }
      for (const st of r.steps) {
        const l = el('div', 'line');
        const ch = chromEl(st.before);
        l.appendChild(ch);
        const p = inst.projects[st.removed];
        const ratio = (p.benefit / 100) / (p.cost / 100) * 1000;
        const tag = el('span', 'tag', `${prefix}custo ${money(st.costBefore)} > ${money(inst.budget)}`);
        l.appendChild(tag);
        this.add(body, l);
        if (!(await W(450))) return false;
        ch.children[st.removed].classList.add('removing');
        tag.textContent = `${prefix}remove ${GA.geneLabel(st.removed)} (${p.name}), menor razão benefício/custo entre os selecionados: ${ratio.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} pt por R$ 1.000`;
        if (!(await W(700))) return false;
      }
      const ev = GA.evaluate(r.chrom, inst);
      const l = el('div', 'line');
      l.appendChild(chromEl(r.chrom));
      l.appendChild(el('span', 'tag', `${prefix}reparado: custo ${money(ev.cost)}, benefício ${pts(ev.benefit)}, viável`));
      this.add(body, l);
      return W(400);
    }
  }

  global.GAAnimator = Animator;
  global.GAChromEl = chromEl;
})(window);
