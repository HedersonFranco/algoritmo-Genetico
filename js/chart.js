// Gráfico da evolução em canvas
(function (global) {
  'use strict';

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function drawChart(canvas, history, totalGens) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600, h = 240;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 44, r: 14, t: 12, b: 30 };
    const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
    const maxX = Math.max(1, totalGens);
    let maxY = 1;
    for (const r of history) maxY = Math.max(maxY, r.bestOverall.fitness / 100, r.bestFitness / 100);
    maxY = niceCeil(maxY * 1.1);
    const X = g => pad.l + (g / maxX) * pw;
    const Y = v => pad.t + ph - (v / maxY) * ph;

    const ink = cssVar('--muted'), line = cssVar('--line');
    ctx.font = '11px Archivo, system-ui, sans-serif';
    ctx.fillStyle = ink; ctx.strokeStyle = line; ctx.lineWidth = 1;

    const ticks = 5;
    for (let i = 0; i <= ticks; i++) {
      const v = (maxY / ticks) * i, y = Y(v);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(v), pad.l - 6, y);
    }
    const xt = Math.min(10, maxX);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i <= xt; i++) {
      const g = Math.round((maxX / xt) * i);
      ctx.fillText(String(g), X(g), h - pad.b + 8);
    }

    const series = [
      { key: r => r.avgFitness / 100, color: cssVar('--chart-avg'), dash: [] },
      { key: r => r.bestFitness / 100, color: cssVar('--chart-best'), dash: [] },
      { key: r => r.bestOverall.fitness / 100, color: cssVar('--chart-overall'), dash: [6, 4] }
    ];
    for (const s of series) {
      if (!history.length) continue;
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.setLineDash(s.dash);
      ctx.beginPath();
      history.forEach((r, i) => { const x = X(r.gen), y = Y(s.key(r)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
      if (history.length === 1) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(0), Y(s.key(history[0])), 3, 0, 7); ctx.fill(); }
    }
    ctx.setLineDash([]);
  }

  function niceCeil(v) {
    if (v <= 1) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  function fmt(v) { return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }); }

  global.GAChart = { drawChart };
})(window);
