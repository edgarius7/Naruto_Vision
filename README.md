# 🔥 Naruto Vision

**Faça os selos de mão de Naruto na frente da webcam e solte jutsus de verdade na tela.**

Uma rede neural YOLOv8 treinada do zero reconhece os 12 selos de mão em tempo real, direto no navegador. O vídeo nunca sai do seu computador.

### ▶️ [Jogar agora](https://edgarius7.github.io/Naruto_Vision/)

Funciona no computador e no celular, sem instalar nada e sem criar conta.

---

## O que dá para fazer

| Modo | Como funciona |
|---|---|
| **Dojo** | Aprenda os 12 selos, um por vez, com imagem de referência e dica de posição. Segure o selo por 1 segundo para dominá-lo. |
| **Treino** | Escolha um jutsu e siga a receita de selos antes que o chakra se dissipe. Ganhe de 1 a 3 estrelas pelo tempo e pelos erros. |
| **Combate** | Sem cola: faça qualquer sequência de cabeça e o jogo reconhece o jutsu sozinho. |
| **Desafio** | Cinco jutsus sorteados contra o relógio. Bata o seu recorde. |
| **Pergaminho** | O sumário dos 13 jutsus (kanji, rank, usuários, história e receita) e dos 12 selos. |

E mais:

- **Anel de chakra** que enche em volta das mãos enquanto você segura o selo, com o texto "Vendo: Tigre 87%".
- **Efeitos para cada elemento**, desenhados em tempo real: fogo, raio, água, muralha de terra, vento, clones da própria imagem da câmera, círculo de invocação e fumaça.
- **Voz falando o nome do jutsu** em japonês, junto com os efeitos sonoros.
- **Ranks** de Estudante da Academia até Kage, além de XP, 10 conquistas e recordes. Tudo fica salvo no seu navegador.
- **Plano de fundo escolhível**, com os wallpapers do projeto ou uma imagem sua.
- **Acessibilidade**: tempos ajustáveis, efeitos leves, opção de desligar o som e modo teclado para jogar sem câmera.

## Jutsus

| Jutsu | Selos |
|---|---|
| Kage Bunshin no Jutsu | Clone |
| Henge no Jutsu | Cachorro → Javali → Carneiro |
| Chidori | Boi → Coelho → Macaco |
| Suiton: Barreira de Água | Tigre → Cobra → Tigre |
| Harem no Jutsu | Carneiro → Cobra → Tigre → Carneiro |
| Edo Tensei | Tigre → Cobra → Cachorro → Dragão |
| Doton: Doryuuheki | Tigre → Coelho → Javali → Cachorro |
| Katon: Ryuuka no Jutsu | Cobra → Dragão → Coelho → Tigre |
| Fuuton: Daitoppa | Cavalo → Pássaro → Boi → Cachorro |
| Kawarimi no Jutsu | Carneiro → Javali → Boi → Cachorro → Cobra |
| Kuchiyose no Jutsu | Javali → Cachorro → Pássaro → Macaco → Carneiro |
| Katon: Goukakyuu no Jutsu | Cobra → Carneiro → Macaco → Javali → Cavalo → Tigre |
| Suiton: Suiryuudan (versão curta) | Boi → Macaco → Coelho → Javali → Pássaro → Boi → Cavalo → Pássaro |

Cada jutsu indica a origem da sequência:

- **cânone**: confirmada em fontes da obra;
- **fãs**: popular entre fãs;
- **adaptado**: ajustada aos selos que o modelo reconhece. O selo do Rato ainda não faz parte do modelo.

## Como funciona

```
webcam ──► quadro espelhado ──► Web Worker ──► YOLOv8 (ONNX Runtime Web) ──► selo + confiança
                                                                                 │
             tela a 60 fps ◄── efeitos + HUD ◄── regras do jogo ◄── filtro por tempo
```

- **Modelo:** YOLOv8n treinado com 720 fotos (12 classes, 60 por selo) coletadas com `src/collect_data.py`, depois exportado para ONNX em 320 px.
- **No navegador:** o [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) usa a placa de vídeo (WebGPU) quando ela existe. Sem ela, roda no processador (WASM) com uma versão INT8 do modelo, 1,7x mais rápida. A detecção roda num Web Worker, então o vídeo continua fluido mesmo em celulares lentos.
- **Filtro de selos:** um selo só vale depois de segurado por 350 ms, e só vale de novo depois que a pose é desfeita. Isso evita leituras falsas durante a transição entre selos e impede que uma mão parada repita o mesmo selo.
- **Sem servidor:** o site é estático (HTML, CSS e JavaScript, sem etapa de build) e é publicado no GitHub Pages a cada push na `main`.

| Versão do modelo | Acertos nas 720 fotos do dataset | Tempo por quadro (CPU, 1 thread) | Tamanho |
|---|---|---|---|
| FP32 (com placa de vídeo) | 717 / 720 | 22 ms | 12 MB |
| INT8 (sem placa de vídeo) | 716 / 720 | 12 ms | 4,5 MB |

> Esses números medem o próprio dataset de treino, que tem uma única pessoa. Eles mostram que a conversão para o navegador não perdeu precisão, mas não indicam como o modelo vai se sair com outras pessoas, câmeras e iluminação.

## Rodar localmente

O app web só precisa de um servidor de arquivos estáticos. Na raiz do projeto:

```bash
python3 -m http.server 8600 --bind 127.0.0.1
```

Depois abra http://localhost:8600/web/ no Chrome ou no Edge.

- `?ia=processador` no endereço simula um aparelho sem placa de vídeo.
- `web/teste.html` mede o desempenho do modelo nas imagens do dataset.

### Versão Streamlit (original)

A primeira versão do projeto continua no repositório. Ela roda a detecção no servidor via WebRTC:

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/streamlit run app.py
```

### Coletar dados e gerar o modelo INT8

```bash
./run.sh
python scripts/quantizar_modelo.py web/models/best_320.onnx web/models/best_320_int8.onnx
```

- `./run.sh` abre a câmera para coletar fotos dos selos.
- O script de quantização precisa do pacote `onnx`. Ele gera o INT8 e o compara com o FP32 em todas as fotos do dataset.

## Estrutura

```
web/                  app web publicado no GitHub Pages
  js/detector.js        pré-processamento e leitura da saída do YOLO
  js/worker-visao.js    detecção fora da thread da página
  js/jogo.js            regras: filtro de selos, combo, treino e desafio
  js/modos.js           telas do Dojo, Treino, Combate e Desafio
  js/efeitos.js         partículas e efeitos de cada elemento
  data/jutsus.json      receitas, kanji, rank e história dos jutsus
  models/               best_320.onnx (FP32) e best_320_int8.onnx
app.py, pages/, src/  versão Streamlit
models/best.pt        modelo YOLOv8 treinado
configs/jutsus.json   receitas usadas pela versão Streamlit
scripts/              ferramentas (quantização do modelo)
```

## Feito com

Python, Ultralytics YOLOv8, OpenCV, ONNX Runtime Web, Web Workers, Canvas 2D, Web Audio, Web Speech e Streamlit (na versão original).

## Aviso

Projeto de fã, sem fins lucrativos e sem afiliação com Masashi Kishimoto, Shueisha, TV Tokyo ou Studio Pierrot. Naruto e os nomes, imagens e sons relacionados pertencem aos seus donos.

O modelo foi treinado com o [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics), distribuído sob a licença AGPL-3.0.

> *"Eu não vou fugir, eu não volto atrás na minha palavra!"*
