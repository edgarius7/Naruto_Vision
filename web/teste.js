// Teste de viabilidade: o mesmo modelo YOLOv8 do app Streamlit rodando no navegador com ONNX Runtime Web.
/* global ort */

const NOMES = ['Boi', 'Cachorro', 'Carneiro', 'Cavalo', 'Clone', 'Coelho', 'Dragao', 'Javali', 'Macaco', 'Passaro', 'Tigre', 'cobra'];
const CONF_MINIMA = 0.6; // mesmo limiar do src/vision.py

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';

const el = (id) => document.getElementById(id);
const tela = el('tela');
const ctx = tela.getContext('2d', { willReadFrequently: true });
const log = (msg) => { el('log').textContent += msg + '\n'; el('log').scrollTop = 1e9; };

let sessao = null;
let tamanho = 640;
let rodandoCamera = false;

// Canvas auxiliar onde a imagem é "letterboxada" no tamanho de entrada do modelo
const entrada = document.createElement('canvas');
const ctxEntrada = entrada.getContext('2d', { willReadFrequently: true });

const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

async function carregarModelo() {
  const backend = el('backend').value;
  tamanho = Number(el('tamanho').value);
  el('carregar').disabled = true;
  log(`Carregando best_${tamanho}.onnx com ${backend}...`);
  try {
    const t0 = performance.now();
    sessao = await ort.InferenceSession.create(`models/best_${tamanho}.onnx`, { executionProviders: [backend] });
    log(`Modelo pronto em ${(performance.now() - t0).toFixed(0)} ms`);
    el('m-backend').textContent = `${backend} · ${tamanho}px`;
    el('camera').disabled = false;
    el('bench').disabled = false;
  } catch (erro) {
    log(`Falhou com ${backend}: ${erro.message}`);
    if (backend === 'webgpu') log('Dica: este navegador pode não ter WebGPU. Tente WASM.');
  } finally {
    el('carregar').disabled = false;
  }
}

// Mesmo pré-processamento do Ultralytics: letterbox com cinza 114, RGB, 0-1, formato CHW
function preparar(fonte, largura, altura) {
  const escala = Math.min(tamanho / largura, tamanho / altura);
  const nl = Math.round(largura * escala);
  const na = Math.round(altura * escala);
  const dx = (tamanho - nl) / 2;
  const dy = (tamanho - na) / 2;

  entrada.width = tamanho;
  entrada.height = tamanho;
  ctxEntrada.fillStyle = 'rgb(114,114,114)';
  ctxEntrada.fillRect(0, 0, tamanho, tamanho);
  ctxEntrada.drawImage(fonte, 0, 0, largura, altura, dx, dy, nl, na);

  const pixels = ctxEntrada.getImageData(0, 0, tamanho, tamanho).data;
  const area = tamanho * tamanho;
  const dados = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    dados[i] = pixels[i * 4] / 255;
    dados[area + i] = pixels[i * 4 + 1] / 255;
    dados[2 * area + i] = pixels[i * 4 + 2] / 255;
  }
  return { tensor: new ort.Tensor('float32', dados, [1, 3, tamanho, tamanho]), escala, dx, dy };
}

// Saída [1, 16, N]: 4 valores da caixa (cx, cy, w, h) + 12 classes. O app só usa a detecção mais confiante.
function melhorDeteccao(saida, { escala, dx, dy }) {
  const [, canais, n] = saida.dims;
  const d = saida.data;
  let melhor = null;
  for (let i = 0; i < n; i++) {
    for (let c = 4; c < canais; c++) {
      const conf = d[c * n + i];
      if (conf >= CONF_MINIMA && (!melhor || conf > melhor.conf)) melhor = { i, classe: c - 4, conf };
    }
  }
  if (!melhor) return null;
  const { i } = melhor;
  const cx = (d[i] - dx) / escala;
  const cy = (d[n + i] - dy) / escala;
  const w = d[2 * n + i] / escala;
  const h = d[3 * n + i] / escala;
  return { selo: NOMES[melhor.classe], conf: melhor.conf, x: cx - w / 2, y: cy - h / 2, w, h };
}

async function detectar(fonte, largura, altura) {
  const prep = preparar(fonte, largura, altura);
  const t0 = performance.now();
  const resultado = await sessao.run({ images: prep.tensor });
  const ms = performance.now() - t0;
  return { deteccao: melhorDeteccao(resultado.output0, prep), ms };
}

function desenharCaixa(det) {
  if (!det) return;
  ctx.strokeStyle = '#3fb950';
  ctx.lineWidth = 3;
  ctx.strokeRect(det.x, det.y, det.w, det.h);
  ctx.fillStyle = '#3fb950';
  ctx.font = 'bold 18px system-ui';
  ctx.fillText(`${det.selo} ${(det.conf * 100).toFixed(0)}%`, det.x + 4, Math.max(20, det.y - 6));
}

function mostrar(det) {
  el('selo').textContent = det ? det.selo : '—';
  el('m-conf').textContent = det ? `${(det.conf * 100).toFixed(1)}%` : '—';
}

async function ligarCamera() {
  if (rodandoCamera) { rodandoCamera = false; return; }
  let video;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
    video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
  } catch (erro) {
    log(`Câmera indisponível: ${erro.message}`);
    return;
  }

  rodandoCamera = true;
  el('camera').textContent = 'Desligar câmera';
  tela.width = video.videoWidth;
  tela.height = video.videoHeight;

  const tempos = [];
  let quadros = 0;
  let inicioJanela = performance.now();

  while (rodandoCamera) {
    // Espelha igual ao cv2.flip(frame, 1) do Python, antes de passar para o modelo
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -tela.width, 0, tela.width, tela.height);
    ctx.restore();

    const { deteccao, ms } = await detectar(tela, tela.width, tela.height);
    desenharCaixa(deteccao);
    mostrar(deteccao);

    tempos.push(ms);
    if (tempos.length > 30) tempos.shift();
    quadros++;
    const agora = performance.now();
    if (agora - inicioJanela >= 1000) {
      el('m-fps').textContent = (quadros * 1000 / (agora - inicioJanela)).toFixed(1);
      el('m-inferencia').textContent = `${(tempos.reduce((a, b) => a + b, 0) / tempos.length).toFixed(1)} ms`;
      quadros = 0;
      inicioJanela = agora;
    }
    await new Promise(requestAnimationFrame);
  }

  video.srcObject.getTracks().forEach((t) => t.stop());
  el('camera').textContent = 'Ligar câmera';
}

const carregarImagem = (src) => new Promise((ok, erro) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => erro(new Error(`não carregou ${src}`));
  img.src = src;
});

// Roda as mesmas 60 imagens que o Python já classificou e compara os resultados
async function testarDataset() {
  el('bench').disabled = true;
  const casos = await (await fetch('bench.json')).json();
  log(`Testando ${casos.length} imagens do dataset (${tamanho}px)...`);
  let acertos = 0;
  let igualPython = 0;
  const tempos = [];

  for (const caso of casos) {
    const img = await carregarImagem(caso.arquivo);
    tela.width = img.width;
    tela.height = img.height;
    ctx.drawImage(img, 0, 0);
    const { deteccao, ms } = await detectar(img, img.width, img.height);
    desenharCaixa(deteccao);
    mostrar(deteccao);
    tempos.push(ms);

    const previsto = deteccao ? deteccao.selo : null;
    if (normalizar(previsto) === normalizar(caso.esperado)) acertos++;
    if (normalizar(previsto) === normalizar(caso[`python_${tamanho}`])) igualPython++;
    else log(`  diferente do Python: ${caso.arquivo} -> ${previsto} (Python: ${caso[`python_${tamanho}`]})`);
  }

  // A primeira inferência inclui o aquecimento do backend, então fica fora da média
  const medios = tempos.slice(1);
  const media = medios.reduce((a, b) => a + b, 0) / medios.length;
  el('m-inferencia').textContent = `${media.toFixed(1)} ms`;
  el('m-fps').textContent = `até ${(1000 / media).toFixed(0)}`;
  log(`Acertos: ${acertos}/${casos.length} · igual ao Python: ${igualPython}/${casos.length}`);
  log(`Inferência média: ${media.toFixed(1)} ms (1ª, com aquecimento: ${tempos[0].toFixed(0)} ms)`);
  window.resultadoBench = { backend: el('backend').value, tamanho, acertos, igualPython, total: casos.length, mediaMs: media };
  el('bench').disabled = false;
}

el('carregar').addEventListener('click', carregarModelo);
el('camera').addEventListener('click', ligarCamera);
el('bench').addEventListener('click', testarDataset);
log(navigator.gpu ? 'WebGPU disponível neste navegador.' : 'WebGPU não disponível: use WASM.');
