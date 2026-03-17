import json
import os
import time

def carregar_jutsus():
    """
    Carrega o dicionário de Jutsus a partir do arquivo JSON na pasta 'configs'.
    """
    caminho_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_json = os.path.join(caminho_atual, '..', 'configs', 'jutsus.json')
    
    try:
        with open(caminho_json, 'r', encoding='utf-8') as arquivo:
            dicionario = json.load(arquivo)
            print(f"✅ {len(dicionario)} Jutsus carregados do JSON com sucesso!")
            return dicionario
    except FileNotFoundError:
        print(f"❌ Erro Crítico: Arquivo não encontrado em {caminho_json}")
        return {}

DICIONARIO_JUTSUS = carregar_jutsus()


class GerenciadorDeJutsus:
    def __init__(self, tempo_limite=2.5, frames_confirmacao=4):
        self.jutsus = DICIONARIO_JUTSUS
        self.sequencia_atual = []
        self.ultimo_tempo = time.time()
        self.tempo_limite = tempo_limite 
        
        self.frames_confirmacao = frames_confirmacao
        self.buffer_selo = None
        self.contagem_buffer = 0

    def adicionar_selo(self, selo_detectado):
        tempo_agora = time.time()

        # 1. Checa o Cooldown (Quebra de Combo)
        # Se passou de X segundos desde o último selo CONCLUÍDO, apaga a lista
        if tempo_agora - self.ultimo_tempo > self.tempo_limite:
            if len(self.sequencia_atual) > 0:
                self.sequencia_atual = []
                print("⏳ Tempo esgotado! Combo resetado.")
            # para que ele pare de ficar apagando o buffer em loop infinito
            self.ultimo_tempo = tempo_agora 

        # Se não tem mão na tela, apenas vai checar se formou jutsu e sai
        if not selo_detectado:
            return self.verificar_jutsu()
            
        # Padroniza para minúsculo para não bugar
        selo_detectado = selo_detectado.lower()
            
        # 2. O Filtro de Ruído (Paciência)
        if selo_detectado == self.buffer_selo:
            self.contagem_buffer += 1
        else:
            self.buffer_selo = selo_detectado
            self.contagem_buffer = 1
            
        # 3. Confirmou o selo após X frames seguidos!
        if self.contagem_buffer >= self.frames_confirmacao:
            # Só adiciona se for diferente do último que já está no combo
            if not self.sequencia_atual or self.sequencia_atual[-1] != selo_detectado:
                self.sequencia_atual.append(selo_detectado)
                # Agora sim o último tempo de acerto foi agora!
                self.ultimo_tempo = tempo_agora 
                print(f"👉 Combo Atual: {self.sequencia_atual}")
            
            # Reseta o buffer para a IA procurar o PRÓXIMO selo limpo
            self.contagem_buffer = 0 
            
        return self.verificar_jutsu()

    def verificar_jutsu(self):
        # Mapeia as receitas e valida o Jutsu
        for nome_jutsu, selos_necessarios in self.jutsus.items():
            receita_min = [s.lower() for s in selos_necessarios]
            tamanho_jutsu = len(receita_min)
            
            if len(self.sequencia_atual) >= tamanho_jutsu:
                # Olha sempre para os últimos X selos do combo
                if self.sequencia_atual[-tamanho_jutsu:] == receita_min:
                    print(f"🔥 JUTSU INVOCADO: {nome_jutsu}!!! 🔥")
                    self.sequencia_atual = [] # Limpa a lista após estourar a magia
                    return nome_jutsu
                    
        return None