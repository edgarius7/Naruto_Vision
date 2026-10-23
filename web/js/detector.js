// Detecção dos selos com o mesmo best.pt do app Streamlit, exportado para ONNX (320px).
// Não depende da página: roda tanto no worker (worker-visao.js) quanto na thread principal.
import { CLASSES_MODELO } from './selos.js';

const TAMANHO = 320;
export const CONF_MINIMA = 0.6; // mesmo limiar do src/vision.py
const CONF_EXIBICAO = 0.3;      // abaixo do limiar ainda mostramos "parece..." para orientar o jogador

// Com placa de vídeo, o modelo original; sem ela, a versão INT8 (1,7x mais rápida no processador,
// 716 de 720 acertos contra 717 do original; ver scripts/quantizar_modelo.py)
const MODELOS = { webgpu: 'best_320.onnx', wasm: 'best_320_int8.onnx' };

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

export async function temWebGPU() {
  try { return Boolean(await navigator.gpu?.requestAdapter()); } catch { return false; }
}

export class Detector {
  /**
   * @param ort o módulo onnxruntime-web
   * @param criarCanvas (largura, altura) => canvas (OffscreenCanvas no worker)
   */
  constructor(ort, criarCanvas) {
    this.ort = ort;
    this.sessao = null;
    this.backend = null;
    this.entrada = criarCanvas(TAMANHO, TAMANHO);
    this.ctxEntrada = this.entrada.getContext('2d', { willReadFrequently: true });
    this.dados = new Float32Array(3 * TAMANHO * TAMANHO);
  }

  /** @param forcarProcessador usa o caminho sem GPU mesmo quando há WebGPU (para testar como fica no celular) */
  async carregar(pastaModelos, aoProgredir = () => {}, { forcarProcessador = false } = {}) {
    if (this.sessao) return;
    const backends = !forcarProcessador && (await temWebGPU()) ? ['webgpu', 'wasm'] : ['wasm'];
    let ultimoErro;
    for (const backend of backends) {
      try {
        const bytes = await baixarComProgresso(`${pastaModelos}/${MODELOS[backend]}`, aoProgredir);
        this.sessao = await this.ort.InferenceSession.create(bytes, { executionProviders: [backend] });
        this.backend = backend;
        return;
      } catch (erro) {
        ultimoErro = erro;
      }
    }
    throw ultimoErro;
  }

  /**
   * Letterbox igual ao Ultralytics (cinza 114), RGB normalizado 0-1, formato CHW.
   * Com `espelhar`, a imagem é invertida na horizontal, como o cv2.flip(frame, 1) do Python.
   */
  preparar(fonte, largura, altura, espelhar) {
    const escala = Math.min(TAMANHO / largura, TAMANHO / altura);
    const nl = Math.round(largura * escala);
    const na = Math.round(altura * escala);
    const dx = (TAMANHO - nl) / 2;
    const dy = (TAMANHO - na) / 2;
    const c = this.ctxEntrada;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = 'rgb(114,114,114)';
    c.fillRect(0, 0, TAMANHO, TAMANHO);
    // o letterbox é centralizado, então espelhar o canvas inteiro mantém a imagem no mesmo lugar
    if (espelhar) c.setTransform(-1, 0, 0, 1, TAMANHO, 0);
    c.drawImage(fonte, 0, 0, largura, altura, dx, dy, nl, na);

    const pixels = c.getImageData(0, 0, TAMANHO, TAMANHO).data;
    const area = TAMANHO * TAMANHO;
    const d = this.dados;
    for (let i = 0; i < area; i++) {
      d[i] = pixels[i * 4] / 255;
      d[area + i] = pixels[i * 4 + 1] / 255;
      d[2 * area + i] = pixels[i * 4 + 2] / 255;
    }
    return { tensor: new this.ort.Tensor('float32', d, [1, 3, TAMANHO, TAMANHO]), escala, dx, dy };
  }

  // Saída [1, 16, N]: caixa (cx, cy, w, h) + 12 classes. Como no app Python, só a detecção mais confiante importa.
  async detectar(fonte, largura, altura, { espelhar = false } = {}) {
    const prep = this.preparar(fonte, largura, altura, espelhar);
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
