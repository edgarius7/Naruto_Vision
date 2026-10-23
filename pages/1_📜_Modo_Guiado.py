import streamlit as st
import sys
import os
import json
import time
import base64
import threading
import av
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, WebRtcMode

# Permite importar o nosso motor de visão e estilos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.vision import DetectorJutsu
from src.jutsu_logic import FiltroSelo, TreinoGuiado
from src.recursos import carregar_modelo_yolo, obter_rtc_config
from src.utils import aplicar_estilo_ninja  # Atualizado para bater com o nome da função do ui_utils


if getattr(st, "experimental_rerun", None) is None:
    st.experimental_rerun = st.rerun
st.set_page_config(page_title="Academia Ninja - Modo Guiado", page_icon="📜", layout="wide")

# Aplica nosso design visual
aplicar_estilo_ninja("itachi.jpg")

# --- 1. CARREGANDO OS DADOS ---
@st.cache_data
def carregar_jutsus():
    caminho_json = os.path.join(os.path.dirname(__file__), '..', 'configs', 'jutsus.json')
    with open(caminho_json, 'r', encoding='utf-8') as f:
        return json.load(f)

JUTSUS = carregar_jutsus()

# --- 2. MAPEAMENTO DOS SEUS ASSETS ---
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

# --- 3. INTERFACE PRINCIPAL ---
st.title("📜 Academia Ninja (Modo Guiado)")
st.markdown("Escolha um Jutsu, copie os selos na tela e complete o treinamento no tempo certo!")

with st.expander("ℹ️ Regras do Treinamento Ninja"):
    st.markdown("""
    * **Tempo de Reação:** Você tem no máximo **4 segundos** para avançar de um selo para o próximo.
    * **Clareza:** Mantenha as mãos na altura do peito, bem visíveis para a câmera.
    * **Punição:** Se você demorar muito, seu chakra oscila e a sequência é **resetada**!
    """)

# Caixinha de seleção do Jutsu
jutsu_escolhido = st.selectbox(
    "Selecione o Jutsu para treinar:", 
    list(JUTSUS.keys())
)
sequencia_alvo = JUTSUS[jutsu_escolhido]

st.markdown("---")
st.markdown(f"### Alvo: **{jutsu_escolhido}**")

# --- GRID FIXO DE SELOS ---
# Jutsus longos (ex: Suiryuudan com 8 selos) ganham mais colunas
colunas_icones = st.columns(max(6, len(sequencia_alvo)))

for i, selo in enumerate(sequencia_alvo):
    with colunas_icones[i]: 
        caminho_icone = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons', f"{selo.lower()}.png")
        if os.path.exists(caminho_icone):
            with open(caminho_icone, "rb") as f:
                img_b64 = base64.b64encode(f.read()).decode()
            html_img = f"""
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="data:image/png;base64,{img_b64}" style="width: 100%; height: 240px; object-fit: contain;">
                    <p style="color: #ffffff; font-size: 1.0rem; margin-top: 10px; font-weight: 600;">{selo}</p>
                </div>
            """
            st.markdown(html_img, unsafe_allow_html=True)
        else:
            st.warning(selo)
st.markdown("---")

col_video, col_status = st.columns([2, 1])

# ==========================================
# O MOTOR DO WEBRTC (Câmera do Cliente)
# ==========================================


RTC_CONFIG = obter_rtc_config()
MODELO_YOLO, LOCK_MODELO = carregar_modelo_yolo()

class TreinoProcessor(VideoProcessorBase):
    def __init__(self, modelo, lock_modelo):
        # Cada sessão tem o próprio detector (e Juiz); só o YOLO é compartilhado
        self.detector = DetectorJutsu(modelo=modelo, lock_modelo=lock_modelo)
        self.filtro = FiltroSelo()
        # recv() roda na thread do WebRTC e a página lê o selo na thread do script
        self.lock = threading.Lock()
        self._selo_confirmado = None

    def recv(self, frame: av.VideoFrame) -> av.VideoFrame:
        img = frame.to_ndarray(format="bgr24")
        
        # Ignoramos o combo do Modo Livre, queremos só o selo isolado que a IA viu agora
        frame_anotado, _, selo_visto, _ = self.detector.processar_frame(img)
        selo_confirmado = self.filtro.atualizar(selo_visto)

        with self.lock:
            self._selo_confirmado = selo_confirmado
            
        return av.VideoFrame.from_ndarray(frame_anotado, format="bgr24")

    def selo_confirmado(self):
        with self.lock:
            return self._selo_confirmado

with col_video:
    st.markdown("### 🟢 Câmera de Treino")
    ctx = webrtc_streamer(
        key="modo_guiado",
        mode=WebRtcMode.SENDRECV,
        rtc_configuration=RTC_CONFIG,
        video_processor_factory=lambda: TreinoProcessor(MODELO_YOLO, LOCK_MODELO),
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True,
    )

with col_status:
    st.markdown("### 📊 Status do Treinamento")
    painel_status = st.empty()
    barra_progresso = st.empty()
    painel_gif = st.empty()
    painel_audio = st.empty()

def mostrar_vitoria():
    painel_status.success(f"🎉 JUTSU CONCLUÍDO: {jutsu_escolhido}!")

    # Dispara o GIF e o Áudio
    assets = MAPA_ASSETS.get(jutsu_escolhido, {})
    if "audio" in assets:
        caminho_audio = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audios', assets['audio'])
        if os.path.exists(caminho_audio):
            with open(caminho_audio, "rb") as f:
                html_audio = f'<audio autoplay id="audio_{time.time()}"><source src="data:audio/mp3;base64,{base64.b64encode(f.read()).decode()}" type="audio/mp3"></audio>'
                painel_audio.markdown(html_audio, unsafe_allow_html=True)

    if "gif" in assets:
        caminho_gif = os.path.join(os.path.dirname(__file__), '..', 'assets', 'gifs', assets['gif'])
        if os.path.exists(caminho_gif):
            painel_gif.image(caminho_gif, width="stretch")

# ==========================================
# LÓGICA DO TREINAMENTO (O Loop Principal)
# ==========================================
if ctx.state.playing:
    treino = TreinoGuiado(sequencia_alvo)
    fase_anterior = None
    alvo_anterior = None

    # Não existe mais 'sleep' longo aqui dentro: toda volta escreve na barra de progresso,
    # e é nessa chamada que o Streamlit encerra o loop quando a câmera desliga ou a página recarrega.
    while True:
        processador = ctx.video_processor
        if processador is None:
            painel_status.info("📷 Conectando à câmera...")
            barra_progresso.progress(0, text="Aguardando a câmera")
            time.sleep(0.1)
            continue

        evento = treino.atualizar(processador.selo_confirmado())

        if evento == "vitoria":
            mostrar_vitoria()
        elif evento == "punicao":
            painel_status.error("⏳ Você demorou muito! A sequência foi resetada.")

        if treino.fase == "jogando":
            # Saindo da comemoração: limpa o GIF e o áudio
            if fase_anterior == "vitoria":
                painel_gif.empty()
                painel_audio.empty()
            if treino.fase != fase_anterior or treino.alvo != alvo_anterior:
                painel_status.info(f"👉 Faça o selo: **{treino.alvo}**")
                alvo_anterior = treino.alvo

        if treino.fase == "vitoria":
            barra_progresso.progress(100, text="Dominado!")
        else:
            progresso_porcentagem = int((treino.indice / len(sequencia_alvo)) * 100)
            barra_progresso.progress(progresso_porcentagem, text=f"Progresso: {treino.indice}/{len(sequencia_alvo)}")

        fase_anterior = treino.fase
        time.sleep(0.1)
