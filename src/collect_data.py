import cv2
import os
import time

print("=== ACADEMIA NINJA: MODO VISÃO COMPUTACIONAL (YOLO) ===")
label_atual = input("Qual selo vamos fotografar agora? (Ex: Tigre, Cobra): ").strip().lower()

# Cria a estrutura de pastas para as imagens
PASTA_DATA = f'data/images/{label_atual}'
if not os.path.exists(PASTA_DATA):
    os.makedirs(PASTA_DATA)

cap = cv2.VideoCapture(0)

gravando = False
tempo_inicio = 0
tempo_espera = 3 # 3 segundos para montar o selo
frames_salvos = 0
TOTAL_FRAMES = 60

print(f"\n📸 Câmera ligada! Pressione 'r' para iniciar a sessão de fotos para [{label_atual.upper()}].")

while cap.isOpened():
    sucesso, frame = cap.read()
    if not sucesso:
        continue

    frame = cv2.flip(frame, 1)
    frame_copia = frame.copy() # Usamos uma cópia limpa para salvar a foto sem os textos da tela

    if gravando:
        tempo_atual = time.time()
        tempo_passado = tempo_atual - tempo_inicio
        
        if tempo_passado < tempo_espera:
            segundos = int(tempo_espera - tempo_passado) + 1
            cv2.putText(frame, f"PREPARE-SE: {segundos}s", (150, 200), cv2.FONT_HERSHEY_DUPLEX, 2, (0, 165, 255), 3)
        else:
            # Fase de tirar as fotos!
            cv2.putText(frame, f"FOTOGRAFANDO {label_atual.upper()}...", (150, 200), cv2.FONT_HERSHEY_DUPLEX, 1.5, (0, 0, 255), 3)
            
            # Salva a imagem limpa na pasta
            nome_arquivo = os.path.join(PASTA_DATA, f"{label_atual}_{int(time.time()*1000)}.jpg")
            cv2.imwrite(nome_arquivo, frame_copia)
            frames_salvos += 1
            
            # Pequeno delay para você ter tempo de mexer a mão e gerar imagens diferentes
            time.sleep(0.1) 
            
            if frames_salvos >= TOTAL_FRAMES:
                print(f"✅ Sucesso! {TOTAL_FRAMES} fotos salvas em {PASTA_DATA}")
                break

    cv2.putText(frame, f"Fotos Salvas: {frames_salvos}/{TOTAL_FRAMES}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
    cv2.imshow('Coleta de Imagens - YOLO', frame)

    tecla = cv2.waitKey(1) & 0xFF
    if tecla == ord('r') and not gravando:
        gravando = True
        tempo_inicio = time.time()
        print("⏳ Contagem iniciada! Faça o selo...")
    elif tecla == ord('q'):
        break 

cap.release()
cv2.destroyAllWindows()