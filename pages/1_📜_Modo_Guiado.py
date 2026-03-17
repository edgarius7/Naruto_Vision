import streamlit as st
import sys
import os
import json
import time
import base64
import av
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase, WebRtcMode, RTCConfiguration

# Permite importar o nosso motor de visão e estilos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.vision import DetectorJutsu
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
colunas_icones = st.columns(6) 

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
RTC_CONFIG = RTCConfiguration({"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]})

def carregar_modelo_visao():
    caminho_modelo = os.path.join(os.path.dirname(__file__), '..', 'models', 'best.pt')
    return DetectorJutsu(caminho_modelo)
ia_pronta = carregar_modelo_visao()

class TreinoProcessor(VideoProcessorBase):
    def __init__(self):
        self.detector = ia_pronta
        self.combo_atual = []
        self.selo_atual_lido = ""

    def recv(self, frame: av.VideoFrame) -> av.VideoFrame:
        img = frame.to_ndarray(format="bgr24")
        
        # Ignoramos o combo do Modo Livre, queremos só o selo isolado que a IA viu agora
        frame_anotado, _, selo_visto, _ = self.detector.processar_frame(img)
        
        if selo_visto:
            self.selo_atual_lido = selo_visto
            
        return av.VideoFrame.from_ndarray(frame_anotado, format="bgr24")

with col_video:
    st.markdown("### 🟢 Câmera de Treino")
    ctx = webrtc_streamer(
        key="modo_guiado",
        mode=WebRtcMode.SENDRECV,
        rtc_configuration=RTC_CONFIG,
        video_processor_factory=TreinoProcessor,
        media_stream_constraints={"video": True, "audio": False},
        async_processing=True,
    )

with col_status:
    st.markdown("### 📊 Status do Treinamento")
    painel_status = st.empty()
    barra_progresso = st.empty()
    painel_gif = st.empty()
    painel_audio = st.empty()

# ==========================================
# LÓGICA DO TREINAMENTO (O Loop Principal)
# ==========================================
if ctx.state.playing:
    indice_atual = 0
    ultimo_selo_lido = ""
    tempo_ultimo_acerto = time.time()
    vitoria_recente = False
    
    while True:
        if ctx.video_processor:
            # 1. Qual é o alvo e o que a IA está vendo?
            alvo_atual = sequencia_alvo[indice_atual]
            selo_visto_min = ctx.video_processor.selo_atual_lido.lower()
            ultimo_selo_min = ultimo_selo_lido.lower()
            alvo_min = alvo_atual.lower()

            if not vitoria_recente:
                painel_status.info(f"👉 Faça o selo: **{alvo_atual}**")
                progresso_porcentagem = int((indice_atual / len(sequencia_alvo)) * 100)
                barra_progresso.progress(progresso_porcentagem, text=f"Progresso: {indice_atual}/{len(sequencia_alvo)}")

            # 2. Lógica de Acerto
            if selo_visto_min == alvo_min and selo_visto_min != ultimo_selo_min:
                indice_atual += 1
                ultimo_selo_lido = ctx.video_processor.selo_atual_lido
                tempo_ultimo_acerto = time.time()
                
                # Se completou o Jutsu!
                if indice_atual >= len(sequencia_alvo):
                    vitoria_recente = True
                    painel_status.success(f"🎉 JUTSU CONCLUÍDO: {jutsu_escolhido}!")
                    barra_progresso.progress(100, text="Dominado!")
                    
                    # Dispara o GIF e o Áudio
                    assets = MAPA_ASSETS.get(jutsu_escolhido, {})
                    if "audio" in assets:
                        caminho_audio = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audios', assets['audio'])
                        if os.path.exists(caminho_audio):
                            with open(caminho_audio, "rb") as f:
                                html_audio = f'<audio autoplay><source src="data:audio/mp3;base64,{base64.b64encode(f.read()).decode()}" type="audio/mp3"></audio>'
                                painel_audio.markdown(html_audio, unsafe_allow_html=True)
                    
                    if "gif" in assets:
                        caminho_gif = os.path.join(os.path.dirname(__file__), '..', 'assets', 'gifs', assets['gif'])
                        if os.path.exists(caminho_gif):
                            painel_gif.image(caminho_gif, use_container_width=True)
                    
                    # Congela por 4 segundos para o cara curtir a vitória
                    time.sleep(4)
                    
                    # Reseta o jogo
                    indice_atual = 0
                    ultimo_selo_lido = ""
                    painel_gif.empty()
                    painel_audio.empty()
                    vitoria_recente = False

            # 3. Regra da Punição (Se demorar mais de 4 segundos)
            elif indice_atual > 0 and (time.time() - tempo_ultimo_acerto) > 4.0 and not vitoria_recente:
                indice_atual = 0
                ultimo_selo_lido = ""
                painel_status.error("⏳ Você demorou muito! A sequência foi resetada.")
                time.sleep(1.5)
                tempo_ultimo_acerto = time.time() # Reinicia o relógio
                ctx.video_processor.selo_atual_lido = "" # Limpa a memória da câmera
                
        time.sleep(0.1)