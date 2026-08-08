/* ============================================================
   V-SHAPE 90 — charts.js
   Gráficos simples em <canvas>, sem dependências externas
   (necessário para funcionamento 100% offline como PWA)
   ============================================================ */

const Charts = {

  /* Desenha um gráfico de linha simples.
     canvas: elemento <canvas>
     points: [{label, value}]
     opts: { color, fillColor, unit } */
  lineChart(canvas, points, opts = {}) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 320;
    const cssH = canvas.clientHeight || 160;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    if (!points || points.length === 0) {
      ctx.fillStyle = 'rgba(241,245,236,0.3)';
      ctx.font = '12.5px -apple-system, system-ui, sans-serif';
      ctx.fillText('Sem dados ainda', 12, cssH / 2);
      return;
    }

    const padL = 34, padR = 12, padT = 14, padB = 22;
    const w = cssW - padL - padR;
    const h = cssH - padT - padB;

    const values = points.map(p => p.value);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1;
    min -= pad; max += pad;

    const color = opts.color || '#C6FA3E';
    const fill = opts.fillColor || 'rgba(198,250,62,0.14)';

    const xFor = i => padL + (points.length === 1 ? w / 2 : (w * i) / (points.length - 1));
    const yFor = v => padT + h - ((v - min) / (max - min)) * h;

    // grade horizontal
    ctx.strokeStyle = 'rgba(241,245,236,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padT + (h * i) / 3;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + w, y);
      ctx.stroke();
    }

    // área preenchida
    ctx.beginPath();
    ctx.moveTo(xFor(0), yFor(points[0].value));
    points.forEach((p, i) => ctx.lineTo(xFor(i), yFor(p.value)));
    ctx.lineTo(xFor(points.length - 1), padT + h);
    ctx.lineTo(xFor(0), padT + h);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // linha
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xFor(i), y = yFor(p.value);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // pontos
    points.forEach((p, i) => {
      const x = xFor(i), y = yFor(p.value);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // labels eixo Y (min/max)
    ctx.fillStyle = 'rgba(155,171,152,0.9)';
    ctx.font = '10px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(max.toFixed(1), padL - 6, padT + 4);
    ctx.fillText(min.toFixed(1), padL - 6, padT + h);

    // labels eixo X (primeiro / último)
    ctx.textAlign = 'left';
    ctx.fillText(points[0].label, padL, cssH - 6);
    ctx.textAlign = 'right';
    ctx.fillText(points[points.length - 1].label, padL + w, cssH - 6);
  },

  /* Barra de progresso simples estilo "taper" (V-shape) */
  taperBar(container, pct, opts = {}) {
    if (!container) return;
    const clamped = Math.max(0, Math.min(100, pct));
    container.innerHTML = `
      <div class="taper-track">
        <div class="taper-fill" style="width:${clamped}%; background:${opts.color || 'var(--accent)'}"></div>
      </div>
    `;
  }
};

if (typeof window !== 'undefined') { window.Charts = Charts; }
