// Detecção dos selos no navegador: o mesmo best.pt do app Streamlit, exportado para ONNX (320px).
/* global ort */
import { CLASSES_MODELO } from './selos.js';

const VERSAO_ORT = '1.20.1';
const CAMINHO_MODELO = 'models/best_320.onnx';
const TAMANHO = 320;
export const CONF_MINIMA = 0.6; // mesmo limiar do src/vision.py
const CONF_EXIBICAO = 0.3;      // abaixo do limiar ainda mostramos "parece..." para orientar o jogador

ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${VERSAO_ORT}/dist/`;

async function baixarComProgresso(url, aoProgredir) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Não consegui baixar o modelo (${resposta.status})`);
  const total = Number(resposta.headers.get('content-length')) || 0;
  const leitor = resposta.body.getReader();
  const partes = [];
  let recebido = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    partes.push(value);
    recebido += value.length;
    if (total) aoProgredir(recebido / total);
  }
  const bytes = new Uint8Array(recebido);
  let pos = 0;
  for (const p of partes) { bytes.set(p, pos); pos += p.length; }
  return bytes;
}

export class Detector {
  constructor() {
    this.sessao = null;
    this.backend = null;
    this.entrada = document.createElement('canvas');
    this.entrada.width = TAMANHO;
    this.entrada.height = TAMANHO;
    this.ctxEntrada = this.entrada.getContext('2d', { willReadFrequently: true });
    this.dados = new Float32Array(3 * TAMANHO * TAMANHO);
  }

  async carregar(aoProgredir = () => {}) {
    if (this.sessao) return;
    const bytes = await baixarComProgresso(CAMINHO_MODELO, aoProgredir);
    // WebGPU é cerca de 4x mais rápido; WASM fica de reserva para navegadores sem GPU
    const backends = navigator.gpu ? ['webgpu', 'wasm'] : ['wasm'];
    let ultimoErro;
    for (const backend of backends) {
      try {
        this.sessao = await ort.InferenceSession.create(bytes, { executionProviders: [backend] });
        this.backend = backend;
        return;
      } catch (erro) {
        ultimoErro = erro;
      }
    }
    throw ultimoErro;
  }

  // Letterbox igual ao Ultralytics (cinza 114), RGB normalizado 0-1, formato CHW
  preparar(fonte, largura, altura) {
    const escala = Math.min(TAMANHO / largura, TAMANHO / altura);
    const nl = Math.round(largura * escala);
    const na = Math.round(altura * escala);
    const dx = (TAMANHO - nl) / 2;
    const dy = (TAMANHO - na) / 2;
    const c = this.ctxEntrada;
    c.fillStyle = 'rgb(114,114,114)';
    c.fillRect(0, 0, TAMANHO, TAMANHO);
    c.drawImage(fonte, 0, 0, largura, altura, dx, dy, nl, na);

    const pixels = c.getImageData(0, 0, TAMANHO, TAMANHO).data;
    const area = TAMANHO * TAMANHO;
    const d = this.dados;
    for (let i = 0; i < area; i++) {
      d[i] = pixels[i * 4] / 255;
      d[area + i] = pixels[i * 4 + 1] / 255;
      d[2 * area + i] = pixels[i * 4 + 2] / 255;
    }
    return { tensor: new ort.Tensor('float32', d, [1, 3, TAMANHO, TAMANHO]), escala, dx, dy };
  }

  // Saída [1, 16, N]: caixa (cx, cy, w, h) + 12 classes. Como no app Python, só a detecção mais confiante importa.
  async detectar(fonte, largura, altura) {
    const prep = this.preparar(fonte, largura, altura);
    const { output0: saida } = await this.sessao.run({ images: prep.tensor });
    const [, canais, n] = saida.dims;
    const v = saida.data;
    let melhor = -1;
    let melhorConf = CONF_EXIBICAO;
    let melhorClasse = -1;
    for (let c = 4; c < canais; c++) {
      const base = c * n;
      for (let i = 0; i < n; i++) {
        if (v[base + i] > melhorConf) { melhorConf = v[base + i]; melhor = i; melhorClasse = c - 4; }
      }
    }
    if (melhor < 0) return null;
    const { escala, dx, dy } = prep;
    const w = v[2 * n + melhor] / escala;
    const h = v[3 * n + melhor] / escala;
    return {
      selo: CLASSES_MODELO[melhorClasse],
      conf: melhorConf,
      valido: melhorConf >= CONF_MINIMA,
      caixa: { x: (v[melhor] - dx) / escala - w / 2, y: (v[n + melhor] - dy) / escala - h / 2, w, h },
    };
  }
}

export class ErroCamera extends Error {
  constructor(tipo, mensagem) { super(mensagem); this.tipo = tipo; }
}

export async function abrirCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new ErroCamera('sem-suporte', 'Este navegador não dá acesso à câmera. Use Chrome, Edge ou Firefox atualizados.');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    return video;
  } catch (erro) {
    if (erro.name === 'NotAllowedError') throw new ErroCamera('negada', 'O navegador bloqueou a câmera.');
    if (erro.name === 'NotFoundError' || erro.name === 'OverconstrainedError') throw new ErroCamera('ausente', 'Nenhuma câmera foi encontrada.');
    if (erro.name === 'NotReadableError') throw new ErroCamera('ocupada', 'A câmera está sendo usada por outro programa.');
    throw new ErroCamera('desconhecido', erro.message);
  }
}

// Roda a detecção em paralelo com o desenho: a tela anima a 60 fps mesmo com o modelo a ~15 fps
export class MotorVisao {
  constructor(detector) {
    this.detector = detector;
    this.video = null;
    this.quadro = document.createElement('canvas');
    this.ctxQuadro = this.quadro.getContext('2d', { willReadFrequently: true });
    this.deteccao = null;
    this.fps = 0;
    this.msInferencia = 0;
    this.ativo = false;
    this.aoDetectar = () => {};
  }

  usarVideo(video) {
    this.video = video;
    this.quadro.width = video.videoWidth;
    this.quadro.height = video.videoHeight;
  }

  // Quadro espelhado, como no cv2.flip(frame, 1) do Python: é o que o jogador vê e o que o modelo recebe
  capturar() {
    const c = this.ctxQuadro;
    c.save();
    c.scale(-1, 1);
    c.drawImage(this.video, -this.quadro.width, 0, this.quadro.width, this.quadro.height);
    c.restore();
  }

  async iniciar() {
    if (this.ativo || !this.video) return;
    this.ativo = true;
    let quadros = 0;
    let janela = performance.now();
    while (this.ativo) {
      this.capturar();
      const t0 = performance.now();
      this.deteccao = await this.detector.detectar(this.quadro, this.quadro.width, this.quadro.height);
      const agora = performance.now();
      this.msInferencia = this.msInferencia * 0.9 + (agora - t0) * 0.1;
      this.aoDetectar(this.deteccao, agora);
      quadros++;
      if (agora - janela >= 1000) {
        this.fps = (quadros * 1000) / (agora - janela);
        quadros = 0;
        janela = agora;
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  parar() { this.ativo = false; }

  desligarCamera() {
    this.parar();
    this.video?.srcObject?.getTracks().forEach((t) => t.stop());
    this.video = null;
  }
}
