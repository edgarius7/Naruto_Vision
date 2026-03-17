import streamlit as st
import base64
import os
from src.utils import aplicar_estilo_ninja
import sys 
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))
if getattr(st, "experimental_rerun", None) is None:
    st.experimental_rerun = st.rerun
# Configuração da página (deve ser sempre o primeiro comando)

st.set_page_config(
    page_title="Naruto Vision - Início", 
    page_icon="🍃", 
    layout="wide",
    initial_sidebar_state="expanded"
)

aplicar_estilo_ninja("naruto.jpg")

# --- OCULTANDO ELEMENTOS DO STREAMLIT ---
esconder_botoes_estilos = """
    <style>
    #MainMenu {visibility: hidden;}
    header {visibility: hidden;}
    footer {visibility: hidden;}
    .stDeployButton {display:none;}
    </style>
"""
st.markdown(esconder_botoes_estilos, unsafe_allow_html=True)


# --- CABEÇALHO / HERO BANNER ---
st.markdown("""
    <div style="text-align: center; padding: 2rem 0;">
        <h1 style="color: #ff4b4b; font-size: 3.5rem;">🔥 NARUTO VISION 🔥</h1>
        <h3 style="color: #a9a9a9; font-weight: 300;">O Primeiro Simulador de Jutsus com Inteligência Artificial</h3>
    </div>
""", unsafe_allow_html=True)

st.divider()

# --- INTRODUÇÃO ---
st.markdown("""
    ### ⛩️ Bem-vindo à Academia Ninja!
    Este sistema utiliza uma **Rede Neural YOLOv8** treinada com visão computacional para reconhecer os 12 selos de mão de Naruto em tempo real. 
    Ligue sua webcam, posicione suas mãos e prove que você está pronto para se tornar um Chunin.
""")

st.write("") # Espaço em branco
st.write("")

# --- COLUNAS COM OS MODOS DE JOGO (Efeito Vidro Fumê) ---
col1, col2 = st.columns(2)

with col1:
    # A mágica do Glassmorphism está no 'rgba' e no 'backdrop-filter: blur'
    st.markdown("""
        <div style="background: rgba(30, 30, 46, 0.6); backdrop-filter: blur(8px); padding: 25px; border-radius: 15px; border-left: 5px solid #00c853; border-top: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5); height: 220px;">
            <h3 style="color: #00c853; margin-top: 0;">📜 Modo Guiado</h3>
            <p style="font-size: 0.9rem; color: #a9a9a9; margin-bottom: 10px;"><strong>Nível: Genin (Iniciante)</strong></p>
            <p style="font-size: 0.95rem;">O sistema desenhará a "receita" de selos na sua tela. O simulador só avança quando você acerta o selo atual. Tente completar antes do tempo acabar!</p>
        </div>
        <br>
    """, unsafe_allow_html=True)
    
    # Botão mágico que leva direto para a página! 
    # (Atenção: o caminho aqui tem que ter o nome exato do seu arquivo dentro da pasta pages)
    st.page_link("pages/1_📜_Modo_Guiado.py", label="**INICIAR TREINAMENTO**", icon="🟢")

with col2:
    st.markdown("""
        <div style="background: rgba(30, 30, 46, 0.6); backdrop-filter: blur(8px); padding: 25px; border-radius: 15px; border-left: 5px solid #ff1744; border-top: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5); height: 220px;">
            <h3 style="color: #ff1744; margin-top: 0;">🥷 Modo Livre</h3>
            <p style="font-size: 0.9rem; color: #a9a9a9; margin-bottom: 10px;"><strong>Nível: Exame Chunin (Avançado)</strong></p>
            <p style="font-size: 0.95rem;">Sem cola, sem dicas. A câmera ficará rastreando todos os seus movimentos em tempo real. Faça as combinações de cabeça e o sistema reconhecerá seus jutsus.</p>
        </div>
        <br>
    """, unsafe_allow_html=True)
    
    # Botão mágico do Modo Livre
    st.page_link("pages/2_🥷_Modo_Livre.py", label="**ENTRAR EM COMBATE**", icon="🔴")

st.divider()

# --- RODAPÉ ---
st.markdown("""
    <div style="text-align: center; color: rgba(255,255,255,0.5); font-size: 0.8rem;">
        Desenvolvido com Python, OpenCV, Ultralytics YOLO e Streamlit. <br>
        <i>"Eu não vou fugir, eu não volto atrás na minha palavra!"</i>
    </div>
""", unsafe_allow_html=True)