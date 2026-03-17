import streamlit as st
import base64
import os

# Adicionamos a variável 'nome_imagem' aqui!
def aplicar_estilo_ninja(nome_imagem="fundo.jpg"):
    """
    Esconde os botões padrão do Streamlit e aplica uma imagem de fundo específica.
    """
    # 1. Esconde os rastros do Streamlit
    esconder_botoes = """
        <style>
        #MainMenu {visibility: hidden;}
        header {visibility: hidden;}
        footer {visibility: hidden;}
        .stDeployButton {display:none;}
        </style>
    """
    st.markdown(esconder_botoes, unsafe_allow_html=True)

    # 2. Prepara e aplica a Imagem de Fundo Dinâmica
    # Agora ele procura a imagem com o nome exato que você pedir!
    caminho_imagem = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons', nome_imagem)
    
    if os.path.exists(caminho_imagem):
        with open(caminho_imagem, "rb") as arquivo_imagem:
            imagem_codificada = base64.b64encode(arquivo_imagem.read()).decode()
            
        css_fundo = f"""
        <style>
        [data-testid="stAppViewContainer"] {{
            background-image: linear-gradient(rgba(13, 17, 23, 0.85), rgba(13, 17, 23, 0.85)), url("data:image/jpeg;base64,{imagem_codificada}");
            background-size: cover;
            background-position: center;
            background-attachment: fixed;
        }}
        </style>
        """
        st.markdown(css_fundo, unsafe_allow_html=True)
    else:
        st.error(f"❌ O Tsukuyomi falhou: A imagem '{nome_imagem}' não foi encontrada na pasta assets.")