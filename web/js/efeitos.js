// Efeitos dos jutsus desenhados em canvas, por cima do vídeo. Tudo procedural: sem GIFs do anime.
const aleat = (a, b) => a + Math.random() * (b - a);

export class Efeitos {
  constructor() {
    this.particulas = [];
    this.ativos = []; // efeitos com duração própria (raios, clones, muralha...)
    this.tremor = 0;
    this.leve = false;
  }

  configurar({ leve }) { this.leve = leve; }

  qtd(n) { return this.leve ? Math.ceil(n / 4) : n; }

  emitir(n, criar) { for (let i = 0; i < this.qtd(n); i++) this.particulas.push(criar()); }

  /** Pequena explosão de chakra quando um selo é confirmado */
  selo({ x, y }, cor = '#7ee0ff') {
    this.emitir(18, () => {
      const ang = aleat(0, Math.PI * 2);
      const vel = aleat(80, 220);
      return { x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: 0, max: aleat(0.3, 0.6), tam: aleat(2, 5), cor, arrasto: 3, brilho: true };
    });
  }

  erro({ x, y }) {
    this.emitir(10, () => ({ x, y, vx: aleat(-60, 60), vy: aleat(20, 120), vida: 0, max: 0.5, tam: aleat(2, 4), cor: '#ff5a5a', gravidade: 300 }));
  }

  /** Dispara o efeito do elemento do jutsu a partir das mãos do jogador */
  jutsu(elemento, origem, largura, altura) {
    if (!this.leve) this.tremor = elemento === 'terra' ? 18 : 10;
    const fn = this[`_${elemento}`] ?? this._fumaca;
    fn.call(this, origem, largura, altura);
  }

  _fogo({ x, y }, w) {
    this.ativos.push({ tipo: 'bola', x, y, alvoX: x, alvoY: y - 40, t: 0, dur: 1.6, raio: w * 0.28 });
    this.emitir(160, () => {
      const ang = aleat(-Math.PI * 0.95, -Math.PI * 0.05);
      const vel = aleat(150, 520);
      return { x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: 0, max: aleat(0.6, 1.4), tam: aleat(10, 28), cor: 'fogo', arrasto: 1.4, gravidade: -120, brilho: true, cresce: 1.8 };
    });
  }

  _raio({ x, y }, w, h) {
    this.ativos.push({ tipo: 'raio', x, y, t: 0, dur: 1.4, w, h, prox: 0, galhos: [] });
    this.emitir(80, () => {
      const ang = aleat(0, Math.PI * 2);
      const vel = aleat(200, 600);
      return { x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: 0, max: aleat(0.2, 0.6), tam: aleat(1.5, 3.5), cor: '#cfefff', arrasto: 4, brilho: true };
    });
  }

  _agua({ x, y }, w, h) {
    this.ativos.push({ tipo: 'onda', x, y, t: 0, dur: 1.2, raio: Math.max(w, h) });
    this.emitir(140, () => {
      const ang = aleat(-Math.PI, 0);
      const vel = aleat(200, 650);
      return { x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, vida: 0, max: aleat(0.8, 1.6), tam: aleat(3, 9), cor: `hsla(${aleat(190, 215)},90%,${aleat(55, 75)}%,1)`, gravidade: 700, arrasto: 0.3 };
    });
  }

  _terra(_o, w, h) {
    this.ativos.push({ tipo: 'muralha', t: 0, dur: 2.2, w, h, pedras: Array.from({ length: 14 }, (_, i) => ({ x: (i / 14) * w, larg: w / 14 + aleat(2, 10), alt: aleat(0.45, 0.7) * h, tom: aleat(22, 36) })) });
    this.emitir(90, () => ({ x: aleat(0, w), y: h, vx: aleat(-80, 80), vy: aleat(-500, -200), vida: 0, max: aleat(0.6, 1.2), tam: aleat(3, 8), cor: `hsl(30,35%,${aleat(25, 45)}%)`, gravidade: 900 }));
  }

  _vento({ x, y }, w, h) {
    this.ativos.push({ tipo: 'vento', t: 0, dur: 1.6, w, h, linhas: Array.from({ length: this.qtd(28) }, () => ({ y: aleat(0, h), vel: aleat(900, 1800), comp: aleat(80, 260), atraso: aleat(0, 0.6) })) });
    this.emitir(60, () => ({ x, y, vx: aleat(300, 900) * (Math.random() < 0.5 ? -1 : 1), vy: aleat(-120, 120), vida: 0, max: aleat(0.5, 1.1), tam: aleat(2, 5), cor: 'rgba(230,245,255,0.9)', arrasto: 1 }));
  }

  _fumaca({ x, y }) {
    this.emitir(45, () => {
      const ang = aleat(0, Math.PI * 2);
      const vel = aleat(40, 220);
      return { x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 40, vida: 0, max: aleat(0.8, 1.6), tam: aleat(20, 50), cor: 'fumaca', arrasto: 2, cresce: 2.2 };
    });
  }

  _clone({ x, y }, w) {
    const posicoes = [-0.3, 0.3, -0.55, 0.55].map((f) => f * w);
    this.ativos.push({ tipo: 'clones', t: 0, dur: 3.2, deslocamentos: posicoes });
    posicoes.forEach((dx) => this._fumaca({ x: x + dx, y }));
  }

  _invocacao({ x, y }, w, h) {
    this.ativos.push({ tipo: 'circulo', x, y: Math.min(h * 0.92, y + h * 0.3), t: 0, dur: 2.4, raio: w * 0.32 });
    this._fumaca({ x, y: y + 40 });
  }

  _transformacao({ x, y }) {
    this._fumaca({ x, y });
    this.emitir(40, () => ({ x: x + aleat(-120, 120), y: y + aleat(-140, 60), vx: 0, vy: aleat(-60, -20), vida: 0, max: aleat(0.6, 1.4), tam: aleat(2, 4), cor: '#ffe37a', brilho: true, estrela: true }));
  }

  desenhar(ctx, quadro, dt) {
    const { width: w, height: h } = ctx.canvas;
    ctx.save();
    if (this.tremor > 0.3) {
      ctx.translate(aleat(-this.tremor, this.tremor), aleat(-this.tremor, this.tremor));
      this.tremor *= Math.pow(0.02, dt);
    }
    if (quadro) ctx.drawImage(quadro, 0, 0, w, h);

    this.ativos = this.ativos.filter((a) => (a.t += dt) < a.dur);
    for (const a of this.ativos) this.desenharAtivo(ctx, a, quadro, w, h, dt);

    this.particulas = this.particulas.filter((p) => (p.vida += dt) < p.max);
    for (const p of this.particulas) {
      p.vx -= p.vx * (p.arrasto ?? 0) * dt;
      p.vy -= p.vy * (p.arrasto ?? 0) * dt;
      p.vy += (p.gravidade ?? 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.vida / p.max;
      const tam = p.tam * (1 + (p.cresce ?? 0) * k);
      ctx.globalCompositeOperation = p.brilho ? 'lighter' : 'source-over';
      ctx.globalAlpha = 1 - k;
      if (p.cor === 'fogo') ctx.fillStyle = `hsl(${50 - 45 * k},100%,${65 - 25 * k}%)`;
      else if (p.cor === 'fumaca') { ctx.fillStyle = 'rgb(225,225,230)'; ctx.globalAlpha = 0.55 * (1 - k); }
      else ctx.fillStyle = p.cor;
      ctx.beginPath();
      if (p.estrela) { ctx.fillRect(p.x - tam, p.y - 0.5, tam * 2, 1); ctx.fillRect(p.x - 0.5, p.y - tam, 1, tam * 2); }
      else { ctx.arc(p.x, p.y, tam, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }

  desenharAtivo(ctx, a, quadro, w, h, dt) {
    const k = a.t / a.dur;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (a.tipo === 'bola') {
      const r = a.raio * Math.min(1, k * 3) * (1 + 0.08 * Math.sin(a.t * 30));
      const g = ctx.createRadialGradient(a.x, a.y - 40, r * 0.1, a.x, a.y - 40, r);
      g.addColorStop(0, `rgba(255,255,210,${1 - k})`);
      g.addColorStop(0.4, `rgba(255,170,40,${0.9 * (1 - k)})`);
      g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(a.x, a.y - 40, r, 0, Math.PI * 2); ctx.fill();
    } else if (a.tipo === 'raio') {
      if ((a.prox -= dt) <= 0) {
        a.prox = 0.05;
        a.galhos = Array.from({ length: this.leve ? 2 : 5 }, () => {
          const pontos = [[a.x, a.y]];
          let [px, py] = [a.x, a.y];
          const ang = aleat(0, Math.PI * 2);
          const passos = 10;
          const alcance = aleat(0.25, 0.6) * Math.max(a.w, a.h);
          for (let i = 0; i < passos; i++) {
            px += Math.cos(ang) * alcance / passos + aleat(-18, 18);
            py += Math.sin(ang) * alcance / passos + aleat(-18, 18);
            pontos.push([px, py]);
          }
          return pontos;
        });
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const [largura, cor] of [[9, 'rgba(80,150,255,0.35)'], [3, 'rgba(220,240,255,0.95)']]) {
        ctx.strokeStyle = cor;
        ctx.lineWidth = largura;
        for (const g of a.galhos) {
          ctx.beginPath();
          g.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        }
      }
      const brilho = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 120);
      brilho.addColorStop(0, `rgba(200,230,255,${0.9 * (1 - k)})`);
      brilho.addColorStop(1, 'rgba(80,150,255,0)');
      ctx.fillStyle = brilho;
      ctx.beginPath(); ctx.arc(a.x, a.y, 120, 0, Math.PI * 2); ctx.fill();
    } else if (a.tipo === 'onda') {
      ctx.strokeStyle = `rgba(120,200,255,${1 - k})`;
      ctx.lineWidth = 14 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(a.x, a.y, a.raio * k, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(40,120,220,${0.25 * (1 - k)})`;
      ctx.fillRect(0, 0, w, h);
    } else if (a.tipo === 'muralha') {
      const subida = Math.min(1, a.t / 0.5);
      const some = a.t > a.dur - 0.5 ? (a.dur - a.t) / 0.5 : 1;
      for (const p of a.pedras) {
        const alt = p.alt * subida;
        ctx.fillStyle = `hsla(30,30%,${p.tom}%,${some})`;
        ctx.fillRect(p.x, h - alt, p.larg, alt);
        ctx.fillStyle = `hsla(30,30%,${p.tom + 10}%,${some})`;
        ctx.fillRect(p.x, h - alt, p.larg, 6);
      }
    } else if (a.tipo === 'vento') {
      ctx.strokeStyle = 'rgba(235,248,255,0.55)';
      ctx.lineCap = 'round';
      for (const l of a.linhas) {
        const t = a.t - l.atraso;
        if (t < 0) continue;
        const x = -l.comp + t * l.vel;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, l.y + Math.sin(t * 8 + l.y) * 10);
        ctx.lineTo(x + l.comp, l.y + Math.sin(t * 8 + l.y + 1) * 10);
        ctx.stroke();
      }
    } else if (a.tipo === 'clones' && quadro) {
      const entra = Math.min(1, a.t / 0.3);
      const sai = a.t > a.dur - 0.4 ? (a.dur - a.t) / 0.4 : 1;
      a.deslocamentos.forEach((dx, i) => {
        const escala = i < 2 ? 0.85 : 0.7;
        ctx.globalAlpha = 0.75 * entra * sai;
        const cw = w * escala;
        const ch = h * escala;
        ctx.drawImage(quadro, (w - cw) / 2 + dx, h - ch, cw, ch);
      });
      ctx.globalAlpha = 1;
      ctx.drawImage(quadro, 0, 0, w, h); // o original fica na frente
    } else if (a.tipo === 'circulo') {
      const r = a.raio * Math.min(1, k * 2.5);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.scale(1, 0.35); // em perspectiva, como se estivesse no chão
      ctx.rotate(a.t * 0.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,120,90,${1 - k * 0.8})`;
      ctx.lineWidth = 4;
      for (const f of [1, 0.78]) { ctx.beginPath(); ctx.arc(0, 0, r * f, 0, Math.PI * 2); ctx.stroke(); }
      for (let i = 0; i < 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.8, Math.sin(ang) * r * 0.8);
        ctx.lineTo(Math.cos(ang) * r * 1.25, Math.sin(ang) * r * 1.25);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
