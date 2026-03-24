import cv2
from ultralytics import YOLO
import sys
import os

os.environ["QT_QPA_PLATFORM"] = "offscreen"

# Esse truque garante que o Python ache os arquivos dentro da pasta src sem dar erro
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.jutsu_logic import GerenciadorDeJutsus

class DetectorJutsu:
    def __init__(self, caminho_modelo='models/best.pt'):
        print("🧠 Carregando o Cérebro YOLO...")
        self.model = YOLO(caminho_modelo)
        
        print("⏱️ Chamando o Juiz do Exame Chunin...")
        # Instancia o nosso gerenciador com 2 segundos de limite entre um selo e outro
        self.gerenciador = GerenciadorDeJutsus(tempo_limite=2.0)

    def processar_frame(self, frame):
        """
        Recebe um frame da câmera, passa na IA, checa os combos e devolve o frame desenhado.
        """
        # 1. Espelha a imagem para você não ficar confuso na tela
        frame = cv2.flip(frame, 1)

        # 2. A IA faz a previsão (conf=0.6 significa 60% de certeza mínima para evitar erros)
        resultados = self.model(frame, conf=0.6, verbose=False)
        frame_anotado = resultados[0].plot()

        jutsu_detectado = None
        selo_atual = None

        # 3. Verifica se a IA encontrou alguma mão na tela
        if len(resultados[0].boxes) > 0:
            # Pega o ID da classe que a IA teve mais certeza
            id_classe = int(resultados[0].boxes.cls[0].item())
            selo_atual = self.model.names[id_classe]

            # 4. Manda o selo pro nosso Juiz avaliar (A Mágica acontece aqui!)
            jutsu_detectado = self.gerenciador.adicionar_selo(selo_atual)

        # 5. Desenhando a Interface (HUD) direto no vídeo
        # Desenha a lista de combos atual (Ex: Cobra -> Carneiro -> Macaco)
        texto_combo = " -> ".join(self.gerenciador.sequencia_atual)
        if texto_combo:
            cv2.putText(frame_anotado, f"Combo: {texto_combo}", (20, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)

        # Se o Juiz gritou um Jutsu, desenha ele GIGANTE na tela
        if jutsu_detectado:
            cv2.putText(frame_anotado, f"🔥 JUTSU: {jutsu_detectado}! 🔥", (20, 90), 
                        cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 3)

        # Retorna o pacote completo para quem chamou (Terminal ou Streamlit)
        return frame_anotado, jutsu_detectado, selo_atual, self.gerenciador.sequencia_atual


# =====================================================================
# ÁREA DE TESTE ISOLADO (O "Modo Treino" antes de ir pro site)
# =====================================================================
if __name__ == "__main__":
    print("=== TESTE DO MOTOR DE VISÃO NO TERMINAL ===")
    # Como estamos rodando de dentro da pasta src, voltamos uma pasta para achar o modelo
    caminho_modelo_teste = os.path.join(os.path.dirname(__file__), '..', 'models', 'best.pt')
    
    detector = DetectorJutsu(caminho_modelo=caminho_modelo_teste)
    cap = cv2.VideoCapture(0)

    print("📸 Câmera ligada! Tente fazer a sequência da Bola de Fogo ou Kawarimi. Pressione 'q' para sair.")

    while cap.isOpened():
        sucesso, frame = cap.read()
        if not sucesso:
            continue

        # Chama a nossa função mágica
        frame_anotado, jutsu, selo, combo = detector.processar_frame(frame)

        # Mostra o resultado na tela
        cv2.imshow('Naruto Vision - Motor Base', frame_anotado)

        # Aperte 'q' para fechar
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()