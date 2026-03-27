import streamlit as st
import sys
import os
import time
import base64
import av
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, WebRtcMode, RTCConfiguration

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.vision import DetectorJutsu
from src.utils import aplicar_estilo_ninja
from twilio.rest import Client
from streamlit_webrtc import RTCConfiguration

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

@st.cache_resource
def obter_servidores_ice():
    try:
        # Tenta pegar as chaves do cofre secreto do Streamlit
        account_sid = st.secrets["TWILIO_ACCOUNT_SID"]
        auth_token = st.secrets["TWILIO_AUTH_TOKEN"]
        
        # Pede para o Twilio um servidor TURN novo e blindado
        cliente = Client(account_sid, auth_token)
        token = cliente.tokens.create()
        return token.ice_servers
    except Exception as e:
        # Se der erro (ex: rodando local sem o cofre), volta pro STUN do Google
        st.warning("Aviso: Rodando sem servidor TURN. A câmera pode falhar em redes bloqueadas.")
        return [{"urls": ["stun:stun.l.google.com:19302"]}]

RTC_CONFIG = RTCConfiguration({"iceServers": obter_servidores_ice()})

def carregar_modelo_visao():
    caminho_modelo = os.path.join(os.path.dirname(__file__), '..', 'models', 'best.pt')
    return DetectorJutsu(caminho_modelo)
ia_pronta = carregar_modelo_visao()

class JutsuProcessor(VideoProcessorBase):
    def __init__(self):
        self.detector = ia_pronta
        self.combo_atual = []
        self.jutsu_detectado = ""

    # Essa função roda a cada frame que chega do celular do seu amigo
    def recv(self, frame: av.VideoFrame) -> av.VideoFrame:
        img = frame.to_ndarray(format="bgr24")
        
        # Passa a imagem na Inteligência Artificial
        frame_anotado, jutsu, _, combo = self.detector.processar_frame(img)
        
        # Salva o status atual para a tela ler depois
        self.combo_atual = combo
        if jutsu:
            self.jutsu_detectado = jutsu
            
        return av.VideoFrame.from_ndarray(frame_anotado, format="bgr24")

with col_video:
    # Este é o novo "Ligar Câmera". Ele abre o player no navegador do cliente!
    ctx = webrtc_streamer(
        key="modo_livre",
        mode=WebRtcMode.SENDRECV,
        rtc_configuration=RTC_CONFIG,
        video_processor_factory=JutsuProcessor,
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True,
    )

with col_status:
    st.markdown('<div class="status-painel"><h3>📜 Status do Combate</h3></div>', unsafe_allow_html=True)
    caixa_combo = st.empty()
    caixa_jutsu = st.empty()
    caixa_gif = st.empty()
    caixa_audio = st.empty()

# ==========================================
# LÓGICA DE TELA (Enquanto a câmera estiver ligada)
# ==========================================
if ctx.state.playing:
    tempo_animacao = 0
    jutsu_em_exibicao = ""

    # Loop infinito que fica "vigiando" o processador de vídeo para atualizar os textos
    while True:
        if ctx.video_processor:
            # 1. Checa o Combo
            combo = ctx.video_processor.combo_atual
            if combo:
                combo_formatado = [s.capitalize() for s in combo]
                caixa_combo.info(f"**Combo:** {' ➡️ '.join(combo_formatado)}")
            else:
                caixa_combo.write("Aguardando selos...")

            # 2. Checa se algum Jutsu foi invocado no processador
            jutsu_lido = ctx.video_processor.jutsu_detectado
            if jutsu_lido:
                jutsu_em_exibicao = jutsu_lido
                tempo_animacao = time.time()
                caixa_jutsu.success(f"### 🔥 {jutsu_lido} INVOCADO! 🔥")
                
                # Toca o Áudio
                assets = MAPA_ASSETS.get(jutsu_lido, {})
                if "audio" in assets:
                    caminho_audio = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audios', assets['audio'])
                    if os.path.exists(caminho_audio):
                        with open(caminho_audio, "rb") as f:
                            b64_audio = base64.b64encode(f.read()).decode()
                            html_audio = f'<audio autoplay id="audio_{time.time()}"><source src="data:audio/mp3;base64,{b64_audio}" type="audio/mp3"></audio>'
                            caixa_audio.empty()
                            caixa_audio.markdown(html_audio, unsafe_allow_html=True)
                
                # "Limpa" o jutsu da memória do processador para ele não tocar o som em loop eterno
                ctx.video_processor.jutsu_detectado = ""

            # 3. Mantém o GIF na tela por 4 segundos
            if time.time() - tempo_animacao < 4.0 and jutsu_em_exibicao != "":
                assets = MAPA_ASSETS.get(jutsu_em_exibicao, {})
                if "gif" in assets:
                    caminho_gif = os.path.join(os.path.dirname(__file__), '..', 'assets', 'gifs', assets['gif'])
                    if os.path.exists(caminho_gif):
                        caixa_gif.image(caminho_gif, width="stretch")
            else:
                caixa_gif.empty()
                caixa_jutsu.empty()
                caixa_audio.empty()

        # Dá uma mini pausa pro seu computador não explodir processando a tela
        time.sleep(0.1)