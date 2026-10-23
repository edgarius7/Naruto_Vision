// Os selos que o modelo reconhece. A ordem de CLASSES_MODELO é a mesma do best.pt (model.names).
export const CLASSES_MODELO = ['boi', 'cachorro', 'carneiro', 'cavalo', 'clone', 'coelho', 'dragao', 'javali', 'macaco', 'passaro', 'tigre', 'cobra'];

// Descrições resumidas das notas de pesquisa (research_notes/.../selos_de_mao.md)
export const SELOS = {
  boi:      { nome: 'Boi',      jp: 'Ushi',    kanji: '丑', dica: 'Dedos estendidos e cruzados, polegares de fora, formando "chifres".' },
  tigre:    { nome: 'Tigre',    jp: 'Tora',    kanji: '寅', dica: 'Mãos entrelaçadas com indicadores e médios erguidos e juntos.' },
  coelho:   { nome: 'Coelho',   jp: 'U',       kanji: '卯', dica: 'Mão esquerda em "arminha" apoiada na direita, mínimo estendido.' },
  dragao:   { nome: 'Dragão',   jp: 'Tatsu',   kanji: '辰', dica: 'Dedos entrelaçados, mínimos para baixo e polegares cruzados por cima.' },
  cobra:    { nome: 'Cobra',    jp: 'Mi',      kanji: '巳', dica: 'Mãos entrelaçadas em prece. É o Tigre sem os dedos erguidos.' },
  cavalo:   { nome: 'Cavalo',   jp: 'Uma',     kanji: '午', dica: 'Indicadores se tocam formando um triângulo para cima.' },
  carneiro: { nome: 'Carneiro', jp: 'Hitsuji', kanji: '未', dica: 'Indicadores e médios juntos para cima, mão direita um pouco mais baixa.' },
  macaco:   { nome: 'Macaco',   jp: 'Saru',    kanji: '申', dica: 'Palmas juntas na horizontal, uma deslizando sobre a outra.' },
  passaro:  { nome: 'Pássaro',  jp: 'Tori',    kanji: '酉', dica: 'Polegares juntos formando um triângulo, dedos cruzados.' },
  cachorro: { nome: 'Cachorro', jp: 'Inu',     kanji: '戌', dica: 'Palma esquerda aberta apoiada sobre o punho direito.' },
  javali:   { nome: 'Javali',   jp: 'I',       kanji: '亥', dica: 'Punhos fechados encostados, apontando para baixo.' },
  clone:    { nome: 'Clone',    jp: 'Jūji',    kanji: '十', dica: 'Indicador e médio das duas mãos cruzados em "+". Selo do Kage Bunshin.' },
};

// Ordem de ensino no Dojo: dos mais fáceis de reconhecer para os parecidos entre si
export const ORDEM_DOJO = ['clone', 'tigre', 'cobra', 'carneiro', 'boi', 'cachorro', 'javali', 'macaco', 'coelho', 'cavalo', 'passaro', 'dragao'];

export const iconeSelo = (id) => `img/selos/${id}.png`;
export const nomeSelo = (id) => SELOS[id]?.nome ?? id;
