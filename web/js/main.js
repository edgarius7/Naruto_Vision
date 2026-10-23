// Núcleo do app: rotas, câmera, laço de desenho e avisos. As regras de cada modo ficam em modos.js.
import { MotorVisao, abrirCamera } from './visao.js';
import { FiltroSelo } from './jogo.js';
import { Efeitos } from './efeitos.js';
import { som, destravarSom, configurarSom, falarJutsu } from './som.js';
import { estado, registrar as registrarProgresso, rankAtual } from './progresso.js';
import { SELOS, nomeSelo } from './selos.js';
import { criarModos } from './modos.js';
import { renderizarPerfil } from './perfil.js';
import { renderizarPergaminho } from './pergaminho.js';
import { aplicarFundo, abrirSeletorFundo } from './fundos.js';

const $ = (sel) => document.querySelector(sel);

const CORES_ELEMENTO = {
  fogo: '#ff7a1a', raio: '#7ee0ff', agua: '#4aa8ff', terra: '#c08a4a', vento: '#c8ffe8',
  clone: '#ffd54a', fumaca: '#cfd3dc', invocacao: '#ff3b4e', transformacao: '#ff8ad8',
};

// Teclas para simular selos sem câmera (acessibilidade e testes): letras parecidas com o nome
const TECLAS = { x: 'clone', t: 'tigre', o: 'cobra', n: 'carneiro', b: 'boi', h: 'cachorro', j: 'javali', m: 'macaco', c: 'coelho', v: 'cavalo', p: 'passaro', d: 'dragao' };

const motor = new MotorVisao();
const efeitos = new Efeitos();
const filtro = new FiltroSelo({ msSegurar: estado.config.msSegurar });
const canvas = $('#tela');
const ctx = canvas.getContext('2d');
const espelho = document.createElement('canvas');
const ctxEspelho = espelho.getContext('2d');

let jutsus = [];
let modos = {};
let modoAtual = null;
let telaJogoAtiva = false;
let teclaSegurada = null;
let carregandoModelo = null;
let ultimoQuadro = performance.now();
let ultimoEstadoFiltro = { confirmado: null, candidato: null, progresso: 0 };
let semCamera = false; // "Jogar sem câmera" vale só para esta visita; o ajuste no perfil fica salvo

const tecladoAtivo = () => semCamera || estado.config.teclado;

const prefereMenosMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function aplicarConfig() {
  const c = estado.config;
  filtro.msSegurar = c.msSegurar;
  configurarSom(c.som, c.voz);
  aplicarFundo(rotaAtual());
  efeitos.configurar({ leve: c.efeitos === 'leve' || prefereMenosMovimento });
  $('#teclado-legenda').hidden = !tecladoAtivo();
  for (const modo of Object.values(modos)) modo.aoMudarConfig?.(c);
}

// ---------------------------------------------------------------- avisos e faixa

function avisar(titulo, texto = '', cor = 'var(--amarelo)') {
  const el = document.createElement('div');
  el.className = 'aviso';
  el.style.borderLeftColor = cor;
  el.innerHTML = `<b>${titulo}</b>${texto ? `<small>${texto}</small>` : ''}`;
  $('#avisos').append(el);
  setTimeout(() => el.remove(), 4600);
}

let temporizadorFaixa;
function faixa(texto, sub = '', cor = 'var(--laranja)') {
  const el = $('#faixa');
  el.style.setProperty('--cor-faixa', cor);
  el.innerHTML = `${texto}${sub ? `<small>${sub}</small>` : ''}`;
  el.classList.remove('mostrar');
  void el.offsetWidth; // reinicia a animação
  el.classList.add('mostrar');
  clearTimeout(temporizadorFaixa);
  temporizadorFaixa = setTimeout(() => el.classList.remove('mostrar'), 2500);
}

function atualizarTopo() {
  const rank = rankAtual();
  $('#topo-rank').textContent = rank.nome;
  $('#topo-xp-barra').style.width = `${Math.round(rank.progresso * 100)}%`;
}

function registrar(opcoes) {
  const r = registrarProgresso(jutsus, opcoes);
  if (r.subiuPara) {
    som.conquista();
    avisar(`Novo rank: ${r.subiuPara.nome}!`, 'O seu chakra está ficando mais forte.', 'var(--laranja)');
  }
  for (const c of r.novasConquistas) {
    som.conquista();
    avisar(`🏆 ${c.nome}`, c.descricao);
  }
  atualizarTopo();
  return r;
}

// ---------------------------------------------------------------- câmera e modelo

function carregarModelo() {
  carregandoModelo ??= motor.carregar((p) => { $('#modelo-barra').style.width = `${Math.round(p * 100)}%`; })
    .then(() => {
      $('#modelo-barra').style.width = '100%';
      $('#modelo-status span').textContent = `Inteligência artificial pronta (${motor.backend === 'webgpu' ? 'placa de vídeo' : 'processador'}).`;
    })
    .catch((erro) => {
      $('#modelo-status span').textContent = `Não consegui carregar o modelo: ${erro.message}`;
      carregandoModelo = null;
      throw erro;
    });
  return carregandoModelo;
}

const INSTRUCOES_ERRO = {
  negada: `<h2>A câmera foi bloqueada</h2>
    <ol>
      <li>Clique no ícone de cadeado (ou de câmera) à esquerda do endereço do site.</li>
      <li>Mude <b>Câmera</b> para <b>Permitir</b> ou clique em <b>Redefinir permissões</b>.</li>
      <li>Recarregue a página e clique em <b>Ativar câmera</b> de novo.</li>
    </ol>`,
  ausente: '<h2>Nenhuma câmera encontrada</h2><p>Conecte uma webcam ou use o modo teclado.</p>',
  ocupada: '<h2>A câmera está ocupada</h2><p>Feche outros programas que usam a webcam (Zoom, Teams, Meet, outro navegador) e tente de novo.</p>',
  'sem-suporte': '<h2>Navegador sem suporte</h2><p>Use uma versão recente do Chrome, Edge ou Firefox.</p>',
};

function destinoDepoisDaCamera() {
  return new URLSearchParams(location.hash.split('?')[1]).get('depois') || 'dojo';
}

async function ativarCamera() {
  destravarSom();
  const botao = $('#btn-ativar');
  const caixaErro = $('#erro-camera');
  botao.disabled = true;
  botao.textContent = 'Aguardando permissão…';
  caixaErro.hidden = true;
  try {
    const video = await abrirCamera();
    botao.textContent = 'Carregando a IA…';
    await carregarModelo();
    motor.usarVideo(video);
    semCamera = false;
    aplicarConfig();
    location.hash = `#/${destinoDepoisDaCamera()}`;
  } catch (erro) {
    caixaErro.hidden = false;
    caixaErro.innerHTML = INSTRUCOES_ERRO[erro.tipo] ?? `<h2>Algo deu errado</h2><p>${erro.message}</p>`;
  } finally {
    botao.disabled = false;
    botao.textContent = 'Ativar câmera';
  }
}

function jogarComTeclado() {
  destravarSom();
  semCamera = true;
  aplicarConfig();
  location.hash = `#/${destinoDepoisDaCamera()}`;
}

const prontoParaJogar = () => Boolean(motor.video) || tecladoAtivo();

// ---------------------------------------------------------------- laço do palco

function deteccaoAtual() {
  if (teclaSegurada) {
    const w = canvas.width;
    const h = canvas.height;
    return { selo: teclaSegurada, conf: 0.95, valido: true, caixa: { x: w * 0.38, y: h * 0.45, w: w * 0.24, h: h * 0.3 } };
  }
  return motor.video ? motor.deteccao : null;
}

function origemDoEfeito() {
  const det = deteccaoAtual();
  if (det) return { x: det.caixa.x + det.caixa.w / 2, y: det.caixa.y + det.caixa.h / 2 };
  return { x: canvas.width / 2, y: canvas.height * 0.6 };
}

function desenharAnel(det) {
  const { confirmado, candidato, progresso } = ultimoEstadoFiltro;
  if (!det && !candidato) return;
  const caixa = det?.caixa;
  const x = caixa ? caixa.x + caixa.w / 2 : canvas.width / 2;
  const y = caixa ? caixa.y + caixa.h / 2 : canvas.height / 2;
  const r = caixa ? Math.max(caixa.w, caixa.h) * 0.62 : 90;

  if (estado.config.mostrarCaixa && caixa) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(caixa.x, caixa.y, caixa.w, caixa.h);
  }

  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(126,224,255,0.15)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();

  const segurado = candidato ? progresso : (confirmado && det?.valido ? 1 : 0);
  if (segurado > 0) {
    ctx.save();
    ctx.shadowColor = '#7ee0ff';
    ctx.shadowBlur = segurado >= 1 ? 22 : 10;
    ctx.strokeStyle = segurado >= 1 ? '#bff3ff' : '#7ee0ff';
    ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * segurado); ctx.stroke();
    ctx.restore();
  }
}

function atualizarVendo(det) {
  const el = $('#vendo');
  const palco = $('#palco');
  palco.classList.toggle('com-maos', Boolean(det));
  if (!det) { el.textContent = motor.video || teclaSegurada ? '' : 'Modo teclado: segure uma tecla'; el.className = 'vendo fraco'; return; }
  const pct = Math.round(det.conf * 100);
  el.className = `vendo ${det.valido ? 'valido' : 'fraco'}`;
  el.textContent = det.valido ? `Vendo: ${nomeSelo(det.selo)} ${pct}%` : `Parece ${nomeSelo(det.selo)}… ${pct}%`;
}

function quadro(t) {
  if (!telaJogoAtiva) return;
  requestAnimationFrame(quadro);
  const dt = Math.min(0.05, (t - ultimoQuadro) / 1000);
  ultimoQuadro = t;
  const agora = performance.now();

  const det = deteccaoAtual();
  const r = filtro.atualizar(det?.valido ? det.selo : null, agora);
  ultimoEstadoFiltro = r;
  if (r.novo) modoAtual?.selo(r.novo, agora);
  modoAtual?.tick?.(agora, r);

  const video = motor.video;
  if (video && (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight)) {
    canvas.width = espelho.width = video.videoWidth;
    canvas.height = espelho.height = video.videoHeight;
  }
  let fonte = null;
  if (video) {
    ctxEspelho.save();
    ctxEspelho.scale(-1, 1);
    ctxEspelho.drawImage(video, -espelho.width, 0, espelho.width, espelho.height);
    ctxEspelho.restore();
    fonte = espelho;
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, '#141a26');
    g.addColorStop(1, '#07090d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  efeitos.desenhar(ctx, fonte, dt);
  desenharAnel(det);
  atualizarVendo(det);

  $('#desempenho').textContent = video ? `IA ${motor.fps.toFixed(0)} fps · ${motor.backend ?? '…'}` : 'sem câmera';
}

function entrarNoJogo(nomeModo) {
  const modo = modos[nomeModo];
  if (modoAtual !== modo) {
    modoAtual?.sair?.();
    modoAtual = modo;
    filtro.zerar();
    modo.entrar();
  }
  if (!telaJogoAtiva) {
    telaJogoAtiva = true;
    if (motor.video) motor.iniciar();
    ultimoQuadro = performance.now();
    requestAnimationFrame(quadro);
  }
}

function sairDoJogo() {
  modoAtual?.sair?.();
  modoAtual = null;
  telaJogoAtiva = false;
  motor.parar();
}

// ---------------------------------------------------------------- rotas

const TELAS_JOGO = ['dojo', 'treino', 'combate', 'desafio'];

const rotaAtual = () => (location.hash.replace(/^#\/?/, '').split('?')[0]) || 'inicio';
const parametro = (nome) => new URLSearchParams(location.hash.split('?')[1]).get(nome);

function rotear() {
  const rota = rotaAtual();
  // vem do Pergaminho: guarda o jutsu escolhido mesmo se ainda for preciso passar pela câmera
  if (rota === 'treino' && parametro('jutsu')) modos.treino.escolher(parametro('jutsu'));
  if (TELAS_JOGO.includes(rota) && !prontoParaJogar()) {
    location.replace(`#/camera?depois=${rota}`);
    return;
  }
  const tela = TELAS_JOGO.includes(rota) ? 'jogo' : rota;
  document.querySelectorAll('.tela').forEach((el) => el.classList.toggle('ativa', el.dataset.tela === tela));
  document.querySelectorAll('.menu a').forEach((a) => {
    if (a.getAttribute('href') === `#/${rota}`) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });

  aplicarFundo(rota);
  if (TELAS_JOGO.includes(rota)) entrarNoJogo(rota);
  else sairDoJogo();

  if (rota === 'camera') carregarModelo().catch(() => {});
  if (rota === 'perfil') renderizarPerfil($('#perfil'), { jutsus, aoMudarConfig: aplicarConfig, aoZerar: atualizarTopo });
  if (rota === 'pergaminho') renderizarPergaminho($('#pergaminho'), { jutsus, corDoElemento: app.corDoElemento });
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- início

document.addEventListener('keydown', (e) => {
  if (!tecladoAtivo() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
  const selo = TECLAS[e.key.toLowerCase()];
  if (selo) { teclaSegurada = selo; e.preventDefault(); }
});
document.addEventListener('keyup', (e) => {
  if (TECLAS[e.key.toLowerCase()] === teclaSegurada) teclaSegurada = null;
});
window.addEventListener('blur', () => { teclaSegurada = null; });

$('#teclado-legenda').innerHTML = Object.entries(TECLAS)
  .map(([tecla, selo]) => `<span><kbd>${tecla.toUpperCase()}</kbd> ${SELOS[selo].nome}</span>`).join('');
$('#btn-ativar').addEventListener('click', ativarCamera);
$('#btn-teclado').addEventListener('click', jogarComTeclado);
$('#btn-fundo').addEventListener('click', () => abrirSeletorFundo({ aoMudar: aplicarConfig }));
document.addEventListener('click', destravarSom, { once: true });

const app = {
  get jutsus() { return jutsus; },
  painel: $('#painel'),
  efeitos,
  som,
  faixa,
  avisar,
  registrar,
  origem: origemDoEfeito,
  tamanho: () => ({ w: canvas.width, h: canvas.height }),
  corDoElemento: (elemento) => CORES_ELEMENTO[elemento] ?? 'var(--laranja)',
  /** Efeito completo de jutsu: partículas, som e faixa com o nome */
  soltarJutsu(jutsu, sub = '') {
    const { w, h } = app.tamanho();
    efeitos.jutsu(jutsu.elemento, origemDoEfeito(), w, h);
    som.jutsu(jutsu);
    falarJutsu(jutsu);
    faixa(`<span class="faixa-kanji">${jutsu.kanji}</span>${jutsu.nome}`, sub, app.corDoElemento(jutsu.elemento));
  },
};

(async function iniciar() {
  jutsus = await (await fetch('data/jutsus.json')).json();
  modos = criarModos(app);
  aplicarConfig();
  atualizarTopo();
  window.addEventListener('hashchange', rotear);
  rotear();
})();
