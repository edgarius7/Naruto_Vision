// Roda o modelo fora da thread da página: a câmera continua fluida mesmo quando a detecção é lenta (celulares sem GPU).
import { Detector, temWebGPU } from './detector.js';

const CDN_ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';

let detector = null;

async function carregar(pastaModelos, forcarProcessador) {
  // Sem WebGPU, o pacote só-WASM é 1,7 MB menor para baixar
  const gpu = !forcarProcessador && (await temWebGPU());
  const ort = await import(`${CDN_ORT}${gpu ? 'ort.webgpu.min.mjs' : 'ort.min.mjs'}`);
  ort.env.wasm.wasmPaths = CDN_ORT;
  detector = new Detector(ort, (w, h) => new OffscreenCanvas(w, h));
  await detector.carregar(pastaModelos, (p) => postMessage({ tipo: 'progresso', p }), { forcarProcessador });
  postMessage({ tipo: 'pronto', backend: detector.backend });
}

self.onmessage = async ({ data }) => {
  if (data.tipo === 'carregar') {
    try { await carregar(data.pastaModelos, data.forcarProcessador); } catch (erro) { postMessage({ tipo: 'erro', mensagem: erro.message }); }
    return;
  }
  if (data.tipo === 'quadro') {
    const { bitmap } = data;
    try {
      const t0 = performance.now();
      const deteccao = await detector.detectar(bitmap, bitmap.width, bitmap.height, { espelhar: true });
      postMessage({ tipo: 'deteccao', deteccao, ms: performance.now() - t0 });
    } catch (erro) {
      postMessage({ tipo: 'deteccao', deteccao: null, ms: 0, erro: erro.message });
    } finally {
      bitmap.close();
    }
  }
};
