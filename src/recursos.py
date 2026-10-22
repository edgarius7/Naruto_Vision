import os
import threading

import streamlit as st
from streamlit_webrtc import RTCConfiguration
from twilio.rest import Client
from ultralytics import YOLO

CAMINHO_MODELO = os.path.join(os.path.dirname(__file__), '..', 'models', 'best.pt')
SERVIDORES_STUN = [{"urls": ["stun:stun.l.google.com:19302"]}]


@st.cache_resource
def carregar_modelo_yolo():
    """
    Carrega o YOLO uma única vez por servidor (antes ele era recarregado a cada rerun).
    O lock acompanha o modelo porque a mesma instância atende as threads de vídeo de todas as sessões.
    """
    return YOLO(CAMINHO_MODELO), threading.Lock()


# --- JUTSU SUPREMO DE REDES (Servidor TURN) ---
# As credenciais do Twilio expiram em 24 h, então o cache é renovado a cada hora.
# Se o Twilio falhar, a exceção não fica no cache e a próxima sessão tenta de novo.
@st.cache_resource(ttl=3600)
def _buscar_servidores_turn():
    cliente = Client(st.secrets["TWILIO_ACCOUNT_SID"], st.secrets["TWILIO_AUTH_TOKEN"])
    return cliente.tokens.create().ice_servers


def obter_rtc_config():
    try:
        servidores = _buscar_servidores_turn()
    except Exception:
        # Ex: rodando local sem o cofre de segredos -> volta pro STUN do Google
        st.warning("Aviso: Rodando sem servidor TURN. A câmera pode falhar em redes bloqueadas.")
        servidores = SERVIDORES_STUN
    return RTCConfiguration({"iceServers": servidores})
