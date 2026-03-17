#!/bin/bash
# A linha acima (shebang) avisa o Linux que este é um script de terminal

echo "🔥 Ativando o Chakra (Ambiente Virtual)..."
source .venv/bin/activate

echo "📷 Abrindo a câmera para coleta de selos..."
python src/collect_data.py