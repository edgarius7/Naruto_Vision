// Progresso do jogador (XP, rank, recordes, conquistas e ajustes), salvo só neste navegador.
const CHAVE = 'naruto-vision:v1';

export const RANKS = [
  { nome: 'Estudante da Academia', xp: 0 },
  { nome: 'Genin', xp: 100 },
  { nome: 'Chunin', xp: 400 },
  { nome: 'Jonin', xp: 1000 },
  { nome: 'ANBU', xp: 1800 },
  { nome: 'Kage', xp: 3000 },
];

export const CONFIG_PADRAO = {
  msSegurar: 350,     // quanto tempo segurar um selo até ele valer
  msLimite: 4000,     // tempo máximo entre selos no Treino
  msCombo: 2500,      // tempo máximo entre selos no Combate
  som: true,
  voz: true,           // narrar o nome do jutsu em japonês
  fundo: 'auto',       // ver fundos.js
  escurecer: 0.78,     // quanto escurecer o plano de fundo para o texto continuar legível
  efeitos: 'completo', // 'completo' | 'leve'
  mostrarCaixa: true,
  teclado: false,      // simular selos pelo teclado (acessibilidade e testes)
};

const novoEstado = () => ({
  xp: 0,
  selosDominados: [],
  jutsusFeitos: {},
  estrelas: {},
  melhoresTempos: {},
  recordeDesafio: null,
  conquistas: [],
  config: { ...CONFIG_PADRAO },
});

export const CONQUISTAS = [
  { id: 'primeiro_selo', nome: 'Primeiro selo', descricao: 'Domine um selo no Dojo.', teste: (e) => e.selosDominados.length >= 1 },
  { id: 'todos_selos', nome: 'Mãos de ninja', descricao: 'Domine os 12 selos no Dojo.', teste: (e) => e.selosDominados.length >= 12 },
  { id: 'primeiro_jutsu', nome: 'Primeiro jutsu', descricao: 'Complete qualquer jutsu.', teste: (e) => total(e.jutsusFeitos) >= 1 },
  { id: 'dez_jutsus', nome: 'Treino pesado', descricao: 'Complete 10 jutsus.', teste: (e) => total(e.jutsusFeitos) >= 10 },
  { id: 'colecionador', nome: 'Pergaminho completo', descricao: 'Complete todos os jutsus pelo menos uma vez.', teste: (e, jutsus) => jutsus.every((j) => e.jutsusFeitos[j.id]) },
  { id: 'tres_estrelas', nome: 'Perfeição', descricao: 'Ganhe 3 estrelas em um jutsu.', teste: (e) => Object.values(e.estrelas).some((n) => n >= 3) },
  { id: 'bola_de_fogo_rapida', nome: 'Uchiha honorário', descricao: 'Faça a Grande Bola de Fogo em menos de 6 segundos.', teste: (e) => (e.melhoresTempos.goukakyuu ?? Infinity) < 6000 },
  { id: 'suiryuudan', nome: 'Dragão d\'água', descricao: 'Complete o Suiryuudan de 8 selos.', teste: (e) => e.jutsusFeitos.suiryuudan >= 1 },
  { id: 'desafio', nome: 'Contra o relógio', descricao: 'Termine um Desafio.', teste: (e) => e.recordeDesafio !== null },
  { id: 'chunin', nome: 'Exame Chunin', descricao: 'Chegue ao rank Chunin.', teste: (e) => e.xp >= 400 },
];

function total(obj) { return Object.values(obj).reduce((a, b) => a + b, 0); }

function ler() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE));
    if (salvo) return { ...novoEstado(), ...salvo, config: { ...CONFIG_PADRAO, ...salvo.config } };
  } catch { /* modo anônimo ou armazenamento bloqueado: segue sem salvar */ }
  return novoEstado();
}

export const estado = ler();

export function salvar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); } catch { /* idem */ }
}

export function rankAtual(xp = estado.xp) {
  let indice = 0;
  RANKS.forEach((r, i) => { if (xp >= r.xp) indice = i; });
  const proximo = RANKS[indice + 1];
  const progresso = proximo ? (xp - RANKS[indice].xp) / (proximo.xp - RANKS[indice].xp) : 1;
  return { ...RANKS[indice], indice, proximo, progresso };
}

/**
 * Aplica uma mudança no estado, soma XP e devolve o que o jogador acabou de ganhar,
 * para a tela mostrar os avisos (subiu de rank, conquista nova).
 */
export function registrar(jutsus, { xp = 0, mudar = () => {} }) {
  const rankAntes = rankAtual().indice;
  mudar(estado);
  estado.xp += xp;
  const novas = CONQUISTAS.filter((c) => !estado.conquistas.includes(c.id) && c.teste(estado, jutsus));
  estado.conquistas.push(...novas.map((c) => c.id));
  salvar();
  const rank = rankAtual();
  return { xp, novasConquistas: novas, subiuPara: rank.indice > rankAntes ? rank : null };
}

export function zerarProgresso() {
  const config = estado.config;
  Object.assign(estado, novoEstado(), { config });
  salvar();
}
