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

class FiltroSelo:
    """
    Estabiliza a leitura da IA: o selo confirmado só muda quando um novo valor
    (inclusive "nenhum selo") aparece por X frames seguidos.
    """
    def __init__(self, frames_confirmacao=4):
        self.frames_confirmacao = frames_confirmacao
        self.confirmado = None
        self.candidato = None
        self.contagem = 0

    def atualizar(self, selo_detectado):
        selo = selo_detectado.lower() if selo_detectado else None

        if selo == self.confirmado:
            self.candidato = None
            self.contagem = 0
            return self.confirmado

        if selo == self.candidato:
            self.contagem += 1
        else:
            self.candidato = selo
            self.contagem = 1

        if self.contagem >= self.frames_confirmacao:
            self.confirmado = selo
            self.candidato = None
            self.contagem = 0

        return self.confirmado


class TreinoGuiado:
    """
    Regras do Modo Guiado sem nenhum 'sleep': as pausas de vitória e de punição
    são marcadas com horário de término e o loop da página só consulta o estado.
    """
    def __init__(self, sequencia, tempo_limite=4.0, tempo_vitoria=4.0, tempo_punicao=1.5):
        self.sequencia = sequencia
        self.tempo_limite = tempo_limite
        self.tempo_vitoria = tempo_vitoria
        self.tempo_punicao = tempo_punicao

        self.indice = 0
        self.fase = "jogando"  # "jogando", "vitoria" ou "punicao"
        self.fim_da_fase = 0.0
        self.tempo_ultimo_acerto = time.time()
        # Selo que acabou de ser aceito: só vale de novo depois que o ninja desfizer a pose.
        # É isso que impede a auto-vitória (ex: Kage Bunshin em loop com a mão parada).
        self.selo_bloqueado = None

    @property
    def alvo(self):
        return self.sequencia[self.indice]

    def atualizar(self, selo_confirmado, agora=None):
        """Recebe o selo estável da câmera e devolve 'acerto', 'vitoria', 'punicao' ou None."""
        agora = time.time() if agora is None else agora
        selo = selo_confirmado.lower() if selo_confirmado else None

        if self.selo_bloqueado is not None and selo != self.selo_bloqueado:
            self.selo_bloqueado = None

        if self.fase != "jogando":
            if agora < self.fim_da_fase:
                return None
            self.fase = "jogando"
            self.tempo_ultimo_acerto = agora

        # Regra da Punição: demorou demais entre um selo e outro
        if self.indice > 0 and agora - self.tempo_ultimo_acerto > self.tempo_limite:
            self.indice = 0
            self.fase = "punicao"
            self.fim_da_fase = agora + self.tempo_punicao
            return "punicao"

        if selo is None or selo != self.alvo.lower() or self.selo_bloqueado is not None:
            return None

        self.indice += 1
        self.selo_bloqueado = selo
        self.tempo_ultimo_acerto = agora

        if self.indice >= len(self.sequencia):
            self.indice = 0
            self.fase = "vitoria"
            self.fim_da_fase = agora + self.tempo_vitoria
            return "vitoria"
        return "acerto"
