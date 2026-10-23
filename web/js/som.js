// Efeitos sonoros sintetizados na hora com Web Audio: nada de áudio do anime, nada para baixar.
let ctx = null;
let ligado = true;

export function configurarSom(ativo) { ligado = ativo; }

// O navegador só libera áudio depois de um clique; chamamos isto no primeiro botão
export function destravarSom() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) ctx = new Ctx();
  }
  if (ctx?.state === 'suspended') ctx.resume();
}

function tom(freq, { inicio = 0, duracao = 0.12, tipo = 'sine', volume = 0.15, ate = null } = {}) {
  const t = ctx.currentTime + inicio;
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freq, t);
  if (ate) osc.frequency.exponentialRampToValueAtTime(ate, t + duracao);
  ganho.gain.setValueAtTime(volume, t);
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  osc.connect(ganho).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duracao + 0.02);
}

function ruido({ inicio = 0, duracao = 0.6, volume = 0.25, filtro = 'lowpass', de = 2000, ate = 200 } = {}) {
  const t = ctx.currentTime + inicio;
  const amostras = Math.floor(ctx.sampleRate * duracao);
  const buffer = ctx.createBuffer(1, amostras, ctx.sampleRate);
  const canal = buffer.getChannelData(0);
  for (let i = 0; i < amostras; i++) canal[i] = Math.random() * 2 - 1;
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  const f = ctx.createBiquadFilter();
  f.type = filtro;
  f.frequency.setValueAtTime(de, t);
  f.frequency.exponentialRampToValueAtTime(ate, t + duracao);
  const ganho = ctx.createGain();
  ganho.gain.setValueAtTime(volume, t);
  ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  fonte.connect(f).connect(ganho).connect(ctx.destination);
  fonte.start(t);
}

const pronto = () => ligado && ctx && ctx.state === 'running';

export const som = {
  selo(indice = 0) {
    if (!pronto()) return;
    // sobe meio tom a cada selo da sequência: dá para "ouvir" o progresso
    tom(523 * 2 ** (indice / 12), { duracao: 0.1, tipo: 'triangle', volume: 0.12 });
  },
  erro() {
    if (!pronto()) return;
    tom(180, { duracao: 0.18, tipo: 'square', volume: 0.05 });
  },
  quebra() {
    if (!pronto()) return;
    tom(440, { duracao: 0.35, tipo: 'sawtooth', volume: 0.05, ate: 110 });
  },
  jutsu(elemento) {
    if (!pronto()) return;
    const perfis = {
      fogo: () => ruido({ duracao: 1.1, volume: 0.35, de: 900, ate: 120 }),
      raio: () => { for (let i = 0; i < 10; i++) tom(1200 + Math.random() * 2400, { inicio: i * 0.05, duracao: 0.04, tipo: 'square', volume: 0.04 }); ruido({ duracao: 0.6, filtro: 'highpass', de: 3000, ate: 6000, volume: 0.12 }); },
      agua: () => ruido({ duracao: 1.2, volume: 0.25, filtro: 'bandpass', de: 400, ate: 1600 }),
      terra: () => { tom(70, { duracao: 0.8, tipo: 'sine', volume: 0.4, ate: 40 }); ruido({ duracao: 0.7, volume: 0.2, de: 400, ate: 60 }); },
      vento: () => ruido({ duracao: 1.3, volume: 0.25, filtro: 'bandpass', de: 300, ate: 2500 }),
      clone: () => { [0, 0.12, 0.24].forEach((i) => ruido({ inicio: i, duracao: 0.25, volume: 0.25, de: 1500, ate: 200 })); },
      fumaca: () => ruido({ duracao: 0.5, volume: 0.3, de: 1500, ate: 150 }),
      invocacao: () => { ruido({ duracao: 0.6, volume: 0.3, de: 1200, ate: 100 }); tom(98, { inicio: 0.1, duracao: 1, tipo: 'triangle', volume: 0.25 }); },
      transformacao: () => { ruido({ duracao: 0.4, volume: 0.3, de: 1500, ate: 200 }); tom(784, { inicio: 0.15, duracao: 0.3, tipo: 'triangle', volume: 0.1 }); },
    };
    (perfis[elemento] ?? perfis.fumaca)();
  },
  conquista() {
    if (!pronto()) return;
    [523, 659, 784, 1047].forEach((f, i) => tom(f, { inicio: i * 0.09, duracao: 0.2, tipo: 'triangle', volume: 0.1 }));
  },
};
