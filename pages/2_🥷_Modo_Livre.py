import streamlit as st
import sys
import os
import time
import base64
import threading
import av
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, WebRtcMode

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.vision import DetectorJutsu
from src.recursos import carregar_modelo_yolo, obter_rtc_config
from src.utils import aplicar_estilo_ninja

if getattr(st, "experimental_rerun", None) is None:
    st.experimental_rerun = st.rerun
st.set_page_config(page_title="Modo Livre - Naruto Vision", page_icon="🥷", layout="wide")

# Aplica nosso design visual
aplicar_estilo_ninja("fundo.jpg") 

# MAPA DOS SEUS ARQUIVOS
MAPA_ASSETS = {
    "Katon: Bola de Fogo": {"gif": "bola_de_fogo.gif", "audio": "Voicy_Fireball jutsu sound effect.mp3"},
    "Chidori": {"gif": "chidori.gif", "audio": "Voicy_Chidori 1.mp3"},
    "Kage Bunshin no Jutsu": {"gif": "clone.gif", "audio": "Voicy_Jutsu - Naruto.mp3"},
    "Harem no Jutsu": {"gif": "jutsu-sexy.gif", "audio": "Voicy_Jutsu - Naruto.mp3"},
    "Kawarimi no Jutsu": {"gif": "substituição.gif", "audio": "Voicy_Jutsu - Naruto.mp3"},
    "Kuchiyose no Jutsu": {"gif": "invocação.gif", "audio": "Voicy_Jutsu - Naruto.mp3"},
    "Edo Tensei": {"gif": "edo-tensei.gif", "audio": "Voicy_Jutsu - Naruto.mp3"},
    "Suiton: Barreira de Agua": {"gif": "suiton.gif", "audio": "Voicy_Jutsu - Naruto.mp3"}
}

# --- ESTILOS CINEMATICOS ---
st.markdown("""
    <style>
    p, h1, h2, h3, h4, h5, h6, span, label, .stMarkdown {
        text-shadow: 2px 2px 5px rgba(0,0,0,0.9), 0px 0px 15px rgba(0,0,0,0.8) !important;
        color: #ffffff !important;
    }
    .status-painel {
        border-left: 4px solid #ff1744;
        padding-left: 15px;
        background: linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
        margin-bottom: 20px;
    }
    </style>
""", unsafe_allow_html=True)

st.markdown("""
    <div>
        <h1 style="color: #ff1744;">🥷 Modo Livre (Exame Chunin)</h1>
        <p>A câmera está lendo seus movimentos em tempo real. Solte os combos sem dicas!</p>
    </div>
    <hr style="border-color: rgba(255,255,255,0.2);">
""", unsafe_allow_html=True)

col_video, col_status = st.columns([2, 1])

RTC_CONFIG = obter_rtc_config()
MODELO_YOLO, LOCK_MODELO = carregar_modelo_yolo()

class JutsuProcessor(VideoProcessorBase):
    def __init__(self, modelo, lock_modelo):
        # Cada sessão tem o próprio detector (e Juiz); só o YOLO é compartilhado
        self.detector = DetectorJutsu(modelo=modelo, lock_modelo=lock_modelo)
        # recv() roda na thread do WebRTC e a página lê o estado na thread do script
        self.lock = threading.Lock()
        self._combo = []
        self._jutsu_pendente = None

    # Essa função roda a cada frame que chega do celular do seu amigo
    def recv(self, frame: av.VideoFrame) -> av.VideoFrame:
        img = frame.to_ndarray(format="bgr24")
        
        # Passa a imagem na Inteligência Artificial
        frame_anotado, jutsu, _, combo = self.detector.processar_frame(img)
        
        # Salva o status atual para a tela ler depois
        with self.lock:
            self._combo = combo
            if jutsu:
                self._jutsu_pendente = jutsu
            
        return av.VideoFrame.from_ndarray(frame_anotado, format="bgr24")

    def ler_estado(self):
        """Devolve o combo e o jutsu invocado, consumindo o jutsu para o som não tocar em loop."""
        with self.lock:
            jutsu = self._jutsu_pendente
            self._jutsu_pendente = None
            return list(self._combo), jutsu

with col_video:
    # Este é o novo "Ligar Câmera". Ele abre o player no navegador do cliente!
    ctx = webrtc_streamer(
        key="modo_livre",
        mode=WebRtcMode.SENDRECV,
        rtc_configuration=RTC_CONFIG,
        video_processor_factory=lambda: JutsuProcessor(MODELO_YOLO, LOCK_MODELO),
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True,
    )

with col_status:
    st.markdown('<div class="status-painel"><h3>📜 Status do Combate</h3></div>', unsafe_allow_html=True)
    caixa_combo = st.empty()
    caixa_jutsu = st.empty()
    caixa_gif = st.empty()
    caixa_audio = st.empty()

def mostrar_jutsu(jutsu_lido):
    caixa_jutsu.success(f"### 🔥 {jutsu_lido} INVOCADO! 🔥")

    assets = MAPA_ASSETS.get(jutsu_lido, {})
    # Toca o Áudio
    if "audio" in assets:
        caminho_audio = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audios', assets['audio'])
        if os.path.exists(caminho_audio):
            with open(caminho_audio, "rb") as f:
                b64_audio = base64.b64encode(f.read()).decode()
                html_audio = f'<audio autoplay id="audio_{time.time()}"><source src="data:audio/mp3;base64,{b64_audio}" type="audio/mp3"></audio>'
                caixa_audio.empty()
                caixa_audio.markdown(html_audio, unsafe_allow_html=True)

    # O GIF é enviado uma vez só e fica no placeholder até a animação acabar
    if "gif" in assets:
        caminho_gif = os.path.join(os.path.dirname(__file__), '..', 'assets', 'gifs', assets['gif'])
        if os.path.exists(caminho_gif):
            caixa_gif.image(caminho_gif, width="stretch")

# ==========================================
# LÓGICA DE TELA (Enquanto a câmera estiver ligada)
# ==========================================
if ctx.state.playing:
    fim_animacao = None

    # Toda volta escreve na caixa de combo, e é nessa chamada que o Streamlit
    # encerra o loop quando a câmera desliga ou a página recarrega.
    while True:
        processador = ctx.video_processor
        if processador is None:
            caixa_combo.write("📷 Conectando à câmera...")
        else:
            # 1. Checa o Combo e se algum Jutsu foi invocado no processador
            combo, jutsu_lido = processador.ler_estado()
            if combo:
                combo_formatado = [s.capitalize() for s in combo]
                caixa_combo.info(f"**Combo:** {' ➡️ '.join(combo_formatado)}")
            else:
                caixa_combo.write("Aguardando selos...")

            if jutsu_lido:
                mostrar_jutsu(jutsu_lido)
                fim_animacao = time.time() + 4.0

        # 2. Mantém o GIF na tela por 4 segundos
        if fim_animacao is not None and time.time() >= fim_animacao:
            caixa_gif.empty()
            caixa_jutsu.empty()
            caixa_audio.empty()
            fim_animacao = None

        # Dá uma mini pausa pro seu computador não explodir processando a tela
        time.sleep(0.1)
