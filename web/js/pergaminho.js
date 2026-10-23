// Pergaminho: o sumário de todos os jutsus e selos, com a receita, a história e um atalho para treinar.
import { estado } from './progresso.js';
import { SELOS, ORDEM_DOJO, iconeSelo, nomeSelo } from './selos.js';
import { falarJutsu } from './som.js';

const ELEMENTOS = {
  fogo: 'Fogo (Katon)', agua: 'Água (Suiton)', raio: 'Raio (Raiton)', terra: 'Terra (Doton)', vento: 'Vento (Fuuton)',
  clone: 'Clones', fumaca: 'Substituição', invocacao: 'Invocação', transformacao: 'Transformação',
};
const ORIGENS = {
  canone: 'Sequência confirmada em fontes da obra.',
  fas: 'Sequência popular entre fãs, sem confirmação oficial.',
  adaptado: 'Sequência adaptada para os selos que o modelo reconhece.',
};

let aba = 'jutsus';
let filtro = 'todos';

export function renderizarPergaminho(raiz, { jutsus, corDoElemento }) {
  const desenhar = () => {
    const elementos = [...new Set(jutsus.map((j) => j.elemento))];
    const lista = filtro === 'todos' ? jutsus : jutsus.filter((j) => j.elemento === filtro);

    raiz.innerHTML = `
      <div class="pergaminho-topo">
        <div>
          <h1>Pergaminho</h1>
          <p>${jutsus.length} jutsus e 12 selos. ${jutsus.filter((j) => estado.jutsusFeitos[j.id]).length} jutsus aprendidos até agora.</p>
        </div>
        <div class="abas" role="tablist">
          <button class="botao botao-pequeno" role="tab" data-aba="jutsus" aria-selected="${aba === 'jutsus'}">Jutsus</button>
          <button class="botao botao-pequeno" role="tab" data-aba="selos" aria-selected="${aba === 'selos'}">Selos</button>
        </div>
      </div>
      ${aba === 'jutsus' ? `
        <div class="filtros" aria-label="Filtrar por elemento">
          <button class="botao" data-filtro="todos" aria-pressed="${filtro === 'todos'}">Todos</button>
          ${elementos.map((e) => `<button class="botao" data-filtro="${e}" aria-pressed="${filtro === e}">${ELEMENTOS[e] ?? e}</button>`).join('')}
        </div>
        <div class="cartoes-jutsu">${lista.map((j) => cartaoJutsu(j, corDoElemento(j.elemento))).join('')}</div>`
      : `<div class="cartoes-selo">${ORDEM_DOJO.map((id) => cartaoSelo(id, jutsus)).join('')}</div>`}`;

    raiz.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => { aba = b.dataset.aba; desenhar(); }));
    raiz.querySelectorAll('[data-filtro]').forEach((b) => b.addEventListener('click', () => { filtro = b.dataset.filtro; desenhar(); }));
    raiz.querySelectorAll('[data-ouvir]').forEach((b) => b.addEventListener('click', () => {
      falarJutsu(jutsus.find((j) => j.id === b.dataset.ouvir), { forcar: true });
    }));
  };
  desenhar();
}

function cartaoJutsu(j, cor) {
  const feitos = estado.jutsusFeitos[j.id] ?? 0;
  const estrelas = estado.estrelas[j.id] ?? 0;
  return `
    <article class="cartao-jutsu" style="--cor:${cor}">
      <header>
        <div>
          <div class="kanji-grande">${j.kanji}</div>
          <h2>${j.nome}</h2>
          <div class="traducao">${[j.traducao, ELEMENTOS[j.elemento]].filter((x, i, l) => x && l.indexOf(x) === i).join(' · ')}</div>
        </div>
        <div class="rank" title="Classificação do jutsu na obra"><b>${j.rank}</b><small>${j.rank === 'Proibido' ? 'kinjutsu' : 'rank'}</small></div>
      </header>
      <p>${j.descricao}</p>
      <div class="receita">${j.selos.map((s) => `<div class="passo"><img src="${iconeSelo(s)}" alt="" loading="lazy">${nomeSelo(s)}</div>`).join('')}</div>
      <div class="meta">Usado por: <b>${j.usuarios}</b></div>
      <div class="meta">${ORIGENS[j.origem] ?? ''}${j.nota ? ` ${j.nota}` : ''}</div>
      <div class="meta">${feitos ? `Você já fez ${feitos}x · ${'★'.repeat(estrelas)}${'☆'.repeat(3 - estrelas)}` : 'Você ainda não fez este jutsu.'}</div>
      <div class="acoes">
        <a class="botao botao-principal botao-pequeno" href="#/treino?jutsu=${j.id}">Treinar</a>
        <button type="button" class="botao botao-pequeno" data-ouvir="${j.id}">🔊 Ouvir o nome</button>
      </div>
    </article>`;
}

function cartaoSelo(id, jutsus) {
  const s = SELOS[id];
  const usadoEm = jutsus.filter((j) => j.selos.includes(id)).map((j) => j.nome);
  const dominado = estado.selosDominados.includes(id);
  return `
    <article class="cartao-selo">
      <img src="${iconeSelo(id)}" alt="Referência do selo ${s.nome}" loading="lazy">
      <div>
        <h2>${s.nome} <small><span class="kanji">${s.kanji}</span> ${s.jp}${dominado ? ' · ✓ dominado' : ''}</small></h2>
        <p>${s.dica}</p>
        <p class="usado">Usado em: <b>${usadoEm.length ? usadoEm.join(', ') : 'nenhum jutsu do jogo ainda'}</b></p>
      </div>
    </article>`;
}
