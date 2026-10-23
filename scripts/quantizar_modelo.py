"""
Gera o modelo INT8 usado pelo app web quando o navegador não tem placa de vídeo (WebGPU),
e compara com o FP32 em todas as imagens do dataset.

Precisa do pacote `onnx` além do onnxruntime. Uso, a partir da raiz do projeto:
    python scripts/quantizar_modelo.py web/models/best_320.onnx web/models/best_320_int8.onnx
"""
import glob
import random
import sys
import tempfile
import time
import unicodedata

import cv2
import numpy as np
import onnx
import onnxruntime as ort
from onnxruntime.quantization import CalibrationDataReader, QuantFormat, QuantType, quantize_static
from onnxruntime.quantization.shape_inference import quant_pre_process

TAMANHO = 320
CONF_MINIMA = 0.6
NOMES = ['boi', 'cachorro', 'carneiro', 'cavalo', 'clone', 'coelho', 'dragao', 'javali', 'macaco', 'passaro', 'tigre', 'cobra']


def normalizar(texto):
    return unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode().lower()


def preparar(caminho):
    """Mesmo letterbox do app web: cinza 114, RGB, 0-1, CHW."""
    img = cv2.cvtColor(cv2.imread(caminho), cv2.COLOR_BGR2RGB)
    h, w = img.shape[:2]
    escala = min(TAMANHO / w, TAMANHO / h)
    nw, nh = round(w * escala), round(h * escala)
    tela = np.full((TAMANHO, TAMANHO, 3), 114, np.uint8)
    dx, dy = (TAMANHO - nw) // 2, (TAMANHO - nh) // 2
    tela[dy:dy + nh, dx:dx + nw] = cv2.resize(img, (nw, nh), interpolation=cv2.INTER_LINEAR)
    return tela.transpose(2, 0, 1)[None].astype(np.float32) / 255


class LeitorCalibracao(CalibrationDataReader):
    def __init__(self, imagens):
        self.imagens = iter(imagens)

    def get_next(self):
        caminho = next(self.imagens, None)
        return None if caminho is None else {'images': preparar(caminho)}


def avaliar(modelo, imagens):
    opcoes = ort.SessionOptions()
    opcoes.intra_op_num_threads = 1
    sessao = ort.InferenceSession(modelo, opcoes, providers=['CPUExecutionProvider'])
    previsoes, tempo = [], 0.0
    for caminho in imagens:
        x = preparar(caminho)
        t0 = time.perf_counter()
        saida = sessao.run(None, {'images': x})[0][0]
        tempo += time.perf_counter() - t0
        classes = saida[4:]
        i = classes.max(0).argmax()
        c = classes[:, i].argmax()
        previsoes.append(NOMES[c] if classes[c, i] >= CONF_MINIMA else None)
    acertos = sum(p == normalizar(c.split('/')[-2]) for p, c in zip(previsoes, imagens))
    return acertos, previsoes, tempo / len(imagens) * 1000


def main(origem, destino):
    imagens = sorted(glob.glob('data/images/*/*.jpg'))
    random.seed(1)
    calibracao = random.sample(imagens, 120)

    # A cabeça de classificação (model.22/cv3) fica em FP32: quantizá-la custava ~17 acertos em 720
    excluir = [n.name for n in onnx.load(origem).graph.node
               if '/model.22/cv3' in n.name or ('/model.22/' in n.name and 'cv2' not in n.name)]

    with tempfile.NamedTemporaryFile(suffix='.onnx') as pre:
        quant_pre_process(origem, pre.name)
        quantize_static(pre.name, destino, LeitorCalibracao(calibracao), quant_format=QuantFormat.QDQ,
                        activation_type=QuantType.QUInt8, weight_type=QuantType.QInt8, per_channel=True,
                        nodes_to_exclude=excluir)

    a32, p32, t32 = avaliar(origem, imagens)
    a8, p8, t8 = avaliar(destino, imagens)
    iguais = sum(x == y for x, y in zip(p32, p8))
    print(f'FP32: {a32}/{len(imagens)} acertos, {t32:.1f} ms por quadro (1 thread)')
    print(f'INT8: {a8}/{len(imagens)} acertos, {t8:.1f} ms por quadro (1 thread), igual ao FP32 em {iguais}/{len(imagens)}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
