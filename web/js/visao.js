// Câmera e laço de detecção. O modelo roda num Web Worker (worker-visao.js) para não travar a página;
// sem suporte a worker com OffscreenCanvas, cai para a thread principal.
import { Detector } from './detector.js';

const PASTA_MODELOS = new URL('../models', import.meta.url).href;
const CDN_ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
// ?ia=processador no endereço simula um aparelho sem placa de vídeo
const FORCAR_PROCESSADOR = new URLSearchParams(location.search).get('ia') === 'processador';

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

export class MotorVisao {
  constructor() {
    this.video = null;
    this.backend = null;
    this.deteccao = null;
    this.fps = 0;
    this.msInferencia = 0;
    this.ativo = false;
    this.ocupado = false;
    this.quadros = 0;
    this.janela = performance.now();
    this.carregando = null;
    this.usarWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'createImageBitmap' in window;
  }

  carregar(aoProgredir = () => {}) {
    this.carregando ??= this.usarWorker ? this.carregarWorker(aoProgredir) : this.carregarLocal(aoProgredir);
    this.carregando.catch(() => { this.carregando = null; });
    return this.carregando;
  }

  carregarWorker(aoProgredir) {
    return new Promise((resolver, rejeitar) => {
      this.worker = new Worker(new URL('./worker-visao.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        if (data.tipo === 'progresso') aoProgredir(data.p);
        else if (data.tipo === 'pronto') { this.backend = data.backend; resolver(); }
        else if (data.tipo === 'erro') rejeitar(new Error(data.mensagem));
        else if (data.tipo === 'deteccao') this.receber(data.deteccao, data.ms);
      };
      this.worker.onerror = (e) => rejeitar(new Error(e.message || 'Falha ao iniciar o detector'));
      this.worker.postMessage({ tipo: 'carregar', pastaModelos: PASTA_MODELOS, forcarProcessador: FORCAR_PROCESSADOR });
    });
  }

  async carregarLocal(aoProgredir) {
    const ort = await import(`${CDN_ORT}ort.webgpu.min.mjs`);
    ort.env.wasm.wasmPaths = CDN_ORT;
    this.detector = new Detector(ort, (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }));
    await this.detector.carregar(PASTA_MODELOS, aoProgredir, { forcarProcessador: FORCAR_PROCESSADOR });
    this.backend = this.detector.backend;
  }

  usarVideo(video) { this.video = video; }

  iniciar() {
    if (this.ativo || !this.video) return;
    this.ativo = true;
    this.pedirQuadro();
  }

  // Um quadro por vez: o próximo só é enviado quando o anterior volta, então nada se acumula em celular lento
  async pedirQuadro() {
    if (!this.ativo || this.ocupado || !this.video) return;
    if (this.video.readyState < 2) { setTimeout(() => this.pedirQuadro(), 50); return; }
    this.ocupado = true;
    if (this.usarWorker) {
      const bitmap = await createImageBitmap(this.video);
      this.worker.postMessage({ tipo: 'quadro', bitmap }, [bitmap]);
    } else {
      const t0 = performance.now();
      const v = this.video;
      const deteccao = await this.detector.detectar(v, v.videoWidth, v.videoHeight, { espelhar: true });
      this.receber(deteccao, performance.now() - t0);
    }
  }

  receber(deteccao, ms) {
    this.ocupado = false;
    if (!this.ativo) return;
    this.deteccao = deteccao;
    this.msInferencia = this.msInferencia * 0.9 + ms * 0.1;
    this.quadros++;
    const agora = performance.now();
    if (agora - this.janela >= 1000) {
      this.fps = (this.quadros * 1000) / (agora - this.janela);
      this.quadros = 0;
      this.janela = agora;
    }
    // na thread principal, cede a vez para a página desenhar antes do próximo quadro
    setTimeout(() => this.pedirQuadro(), this.usarWorker ? 0 : 16);
  }

  parar() { this.ativo = false; this.deteccao = null; }

  desligarCamera() {
    this.parar();
    this.video?.srcObject?.getTracks().forEach((t) => t.stop());
    this.video = null;
  }
}
