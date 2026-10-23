// Os quatro modos de jogo. Cada um desenha o painel lateral e reage aos selos confirmados.
import { Combo, Treino, Desafio } from './jogo.js';
import { estado } from './progresso.js';
import { SELOS, ORDEM_DOJO, iconeSelo, nomeSelo } from './selos.js';

const MS_DOMINAR = 1000; // no Dojo, quanto tempo segurar o selo para dominá-lo

const ETIQUETAS = {
  canone: '<span class="etiqueta canone" title="Sequência confirmada em fontes da obra">cânone</span>',
  fas: '<span class="etiqueta" title="Sequência popular entre fãs, sem confirmação oficial">fãs</span>',
  adaptado: '<span class="etiqueta adaptado" title="Sequência adaptada para os selos que o modelo reconhece">adaptado</span>',
};

const segundos = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
const estrelasTexto = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function receitaHTML(jutsu, indice = 0, concluido = false) {
  return `<div class="receita">${jutsu.selos.map((s, i) => {
    const classe = concluido || i < indice ? 'feito' : i === indice ? 'atual' : '';
    return `<div class="passo ${classe}"><img src="${iconeSelo(s)}" alt="" loading="lazy">${nomeSelo(s)}</div>`;
  }).join('')}</div>`;
}

function seloAlvoHTML(id) {
  const s = SELOS[id];
  return `<div class="selo-alvo">
    <img src="${iconeSelo(id)}" alt="Referência do selo ${s.nome}">
    <div class="nome"><b>${s.nome}</b><span><span class="kanji">${s.kanji}</span> ${s.jp}</span></div>
    <p>${s.dica}</p>
  </div>`;
}

export function criarModos(app) {
  const { painel, efeitos, som } = app;
  const $p = (sel) => painel.querySelector(sel);

  // ============================================================ DOJO
  const dojo = {
    alvo: null,
    desde: null,
    dominando: false,

    entrar() {
      this.alvo = ORDEM_DOJO.find((id) => !estado.selosDominados.includes(id)) ?? ORDEM_DOJO[0];
      this.render();
    },

    render() {
      const feitos = estado.selosDominados.length;
      painel.innerHTML = `
        <div><h1>Dojo</h1><p>${feitos} de 12 selos dominados. Segure o selo até o anel brilhar por 1 segundo.</p></div>
        ${seloAlvoHTML(this.alvo)}
        <div class="tempo" aria-hidden="true"><div id="dojo-barra" style="width:0"></div></div>
        <p id="dojo-status" aria-live="polite">Faça o selo ${nomeSelo(this.alvo)} na frente da câmera.</p>
        <div class="grade-selos">${ORDEM_DOJO.map((id) => `
          <button type="button" data-selo="${id}" aria-pressed="${id === this.alvo}" class="${estado.selosDominados.includes(id) ? 'dominado' : ''}">
            <img src="${iconeSelo(id)}" alt="">${nomeSelo(id)}
          </button>`).join('')}
        </div>`;
      painel.querySelectorAll('[data-selo]').forEach((b) => b.addEventListener('click', () => {
        this.alvo = b.dataset.selo;
        this.desde = null;
        this.render();
      }));
    },

    selo(id) {
      if (id !== this.alvo) {
        $p('#dojo-status').textContent = `Esse é o ${nomeSelo(id)}. O alvo é o ${nomeSelo(this.alvo)}.`;
        som.erro();
      } else {
        som.selo(0);
        efeitos.selo(app.origem());
      }
    },

    tick(agora, filtro) {
      if (this.dominando) return;
      const segurando = filtro.confirmado === this.alvo && !filtro.candidato;
      if (!segurando) { this.desde = null; $p('#dojo-barra').style.width = '0'; return; }
      this.desde ??= agora;
      const p = Math.min(1, (agora - this.desde) / MS_DOMINAR);
      $p('#dojo-barra').style.width = `${p * 100}%`;
      if (p < 1) { $p('#dojo-status').textContent = 'Isso! Continue segurando…'; return; }

      this.dominando = true;
      const novo = !estado.selosDominados.includes(this.alvo);
      efeitos.jutsu('fumaca', app.origem(), app.tamanho().w, app.tamanho().h);
      som.conquista();
      app.faixa(`${nomeSelo(this.alvo)} dominado`, novo ? '+10 XP' : 'Mais uma vez, perfeito', 'var(--verde)');
      if (novo) app.registrar({ xp: 10, mudar: (e) => e.selosDominados.push(this.alvo) });
      setTimeout(() => {
        this.dominando = false;
        this.desde = null;
        const atual = ORDEM_DOJO.indexOf(this.alvo);
        this.alvo = ORDEM_DOJO.find((id, i) => i > atual && !estado.selosDominados.includes(id))
          ?? ORDEM_DOJO.find((id) => !estado.selosDominados.includes(id))
          ?? ORDEM_DOJO[(atual + 1) % 12];
        this.render();
      }, 1600);
    },
  };

  // ============================================================ TREINO
  const treino = {
    jutsu: null,
    sessao: null,

    entrar() {
      this.jutsu ??= app.jutsus.find((j) => !estado.jutsusFeitos[j.id]) ?? app.jutsus[0];
      this.novaSessao();
    },

    novaSessao() {
      this.sessao = new Treino(this.jutsu, { msLimite: estado.config.msLimite });
      this.bateuRecorde = false;
      this.render();
    },

    aoMudarConfig(c) { if (this.sessao) this.sessao.msLimite = c.msLimite; },

    render(mensagem = 'Faça o primeiro selo para começar.') {
      const j = this.jutsu;
      const s = this.sessao;
      const recorde = estado.melhoresTempos[j.id];
      const resultado = s.concluido ? `
        <div class="resultado" aria-live="polite">
          <div class="grande" aria-label="${s.estrelas()} de 3 estrelas">${estrelasTexto(s.estrelas())}</div>
          <div>Tempo: <b>${segundos(s.tempoTotal)}</b> · Erros: <b>${s.erros}</b></div>
          ${this.bateuRecorde ? '<div class="recorde">Novo recorde!</div>' : recorde ? `<div>Recorde: ${segundos(recorde)}</div>` : ''}
          <div class="acoes" style="justify-content:center">
            <button class="botao botao-principal botao-pequeno" id="treino-denovo">De novo</button>
            <button class="botao botao-pequeno" id="treino-proximo">Próximo jutsu</button>
          </div>
        </div>` : `
        <div class="tempo" aria-hidden="true"><div id="treino-tempo"></div></div>
        <p id="treino-status" aria-live="polite">${mensagem}</p>`;

      painel.innerHTML = `
        <div>
          <h1>${j.nome}${ETIQUETAS[j.origem] ?? ''}</h1>
          <p>${j.traducao} · ${j.selos.length} selo${j.selos.length > 1 ? 's' : ''}${j.nota ? ` · <i>${j.nota}</i>` : ''}</p>
        </div>
        ${receitaHTML(j, s.indice, s.concluido)}
        ${resultado}
        <h2>Pergaminho de jutsus</h2>
        <div class="lista-jutsus">${app.jutsus.map((x) => `
          <button type="button" class="jutsu-item" data-jutsu="${x.id}" aria-pressed="${x.id === j.id}">
            <b>${x.nome}</b>
            <small>${x.selos.length} selos${estado.melhoresTempos[x.id] ? ` · recorde ${segundos(estado.melhoresTempos[x.id])}` : ''}</small>
            <span class="estrelas" aria-label="${estado.estrelas[x.id] ?? 0} estrelas">${estrelasTexto(estado.estrelas[x.id] ?? 0)}</span>
          </button>`).join('')}
        </div>`;

      painel.querySelectorAll('[data-jutsu]').forEach((b) => b.addEventListener('click', () => {
        this.jutsu = app.jutsus.find((x) => x.id === b.dataset.jutsu);
        this.novaSessao();
      }));
      $p('#treino-denovo')?.addEventListener('click', () => this.novaSessao());
      $p('#treino-proximo')?.addEventListener('click', () => {
        const i = app.jutsus.indexOf(j);
        this.jutsu = app.jutsus[(i + 1) % app.jutsus.length];
        this.novaSessao();
      });
    },

    selo(id, agora) {
      const s = this.sessao;
      const r = s.selo(id, agora);
      if (r === 'acerto') {
        som.selo(s.indice);
        efeitos.selo(app.origem());
        this.render(`Boa! Agora: ${nomeSelo(s.alvo)}.`);
      } else if (r === 'erro') {
        som.erro();
        efeitos.erro(app.origem());
        $p('#treino-status').textContent = `Esse é o ${nomeSelo(id)}. Faça o ${nomeSelo(s.alvo)}.`;
      } else if (r === 'vitoria') {
        const estrelas = s.estrelas();
        const j = this.jutsu;
        this.bateuRecorde = estado.melhoresTempos[j.id] !== undefined && s.tempoTotal < estado.melhoresTempos[j.id];
        const xp = j.selos.length * 5 * estrelas;
        app.soltarJutsu(j, `${estrelasTexto(estrelas)} · +${xp} XP`);
        app.registrar({
          xp,
          mudar: (e) => {
            e.jutsusFeitos[j.id] = (e.jutsusFeitos[j.id] ?? 0) + 1;
            e.estrelas[j.id] = Math.max(e.estrelas[j.id] ?? 0, estrelas);
            e.melhoresTempos[j.id] = Math.min(e.melhoresTempos[j.id] ?? Infinity, s.tempoTotal);
          },
        });
        this.render();
      }
    },

    tick(agora) {
      const s = this.sessao;
      if (s.concluido) return;
      if (s.expirar(agora)) {
        som.quebra();
        efeitos.erro(app.origem());
        this.render('⏳ O chakra se dissipou! Comece de novo pelo primeiro selo.');
        return;
      }
      const barra = $p('#treino-tempo');
      if (barra) {
        const resta = s.tempoRestante(agora);
        barra.style.width = `${resta * 100}%`;
        barra.style.backgroundPosition = `${(1 - resta) * 100}% 0`;
      }
    },
  };

  // ============================================================ COMBATE
  const combate = {
    combo: null,
    historico: [],

    entrar() {
      this.combo = new Combo(app.jutsus, { msLimite: estado.config.msCombo });
      this.render();
    },

    aoMudarConfig(c) { if (this.combo) this.combo.msLimite = c.msCombo; },

    render() {
      const seq = this.combo.sequencia;
      const pistas = this.combo.pistas().slice(0, 3);
      painel.innerHTML = `
        <div><h1>Combate</h1><p>Sem receita na tela. Faça os selos de cabeça e o jutsu dispara sozinho.</p></div>
        <div>
          <h2>Sequência</h2>
          <div class="chips" aria-live="polite">${seq.length ? seq.map((s, i) => `<span class="chip ${i === seq.length - 1 ? 'novo' : ''}">${nomeSelo(s)}</span>`).join('') : '<span style="color:var(--texto-2)">Aguardando selos…</span>'}</div>
        </div>
        <div class="tempo" aria-hidden="true"><div id="combate-tempo" style="width:0"></div></div>
        <div class="pistas">${pistas.length ? '<h2>Você pode estar fazendo</h2>' : ''}${pistas.map(({ jutsu, feitos }) => `
          <div class="pista"><span>${jutsu.nome} · ${feitos}/${jutsu.selos.length}</span>
          <div class="barra"><div style="width:${(feitos / jutsu.selos.length) * 100}%"></div></div></div>`).join('')}
        </div>
        ${this.historico.length ? `<div><h2>Jutsus desta luta</h2><div class="historico">${this.historico.map((h) => `<div><span>${h.nome}</span><span>${h.hora}</span></div>`).join('')}</div></div>` : ''}
        <details class="cola"><summary>Ver todas as receitas (cola)</summary>
          <ul>${app.jutsus.map((j) => `<li><b>${j.nome}</b>: ${j.selos.map(nomeSelo).join(' → ')}</li>`).join('')}</ul>
        </details>`;
    },

    selo(id, agora) {
      const jutsu = this.combo.adicionar(id, agora);
      if (jutsu) {
        const xp = jutsu.selos.length * 5;
        app.soltarJutsu(jutsu, `+${xp} XP`);
        this.historico.unshift({ nome: jutsu.nome, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) });
        this.historico = this.historico.slice(0, 8);
        app.registrar({ xp, mudar: (e) => { e.jutsusFeitos[jutsu.id] = (e.jutsusFeitos[jutsu.id] ?? 0) + 1; } });
      } else {
        som.selo(this.combo.sequencia.length - 1);
        efeitos.selo(app.origem());
      }
      this.render();
    },

    tick(agora) {
      if (this.combo.expirar(agora)) {
        som.quebra();
        this.render();
        return;
      }
      const barra = $p('#combate-tempo');
      if (barra) barra.style.width = `${this.combo.tempoRestante(agora) * 100}%`;
    },
  };

  // ============================================================ DESAFIO
  const desafio = {
    partida: null,
    contagem: null,
    relogio: null,

    entrar() { this.partida = null; this.renderInicio(); },

    sair() { clearTimeout(this.contagem); },

    renderInicio() {
      const recorde = estado.recordeDesafio;
      painel.innerHTML = `
        <div><h1>Desafio</h1><p>5 jutsus sorteados, um atrás do outro. O relógio começa no seu primeiro selo e só para no último.</p></div>
        <div class="resultado"><div>Seu recorde</div><div class="grande">${recorde ? segundos(recorde) : '—'}</div></div>
        <button class="botao botao-principal" id="desafio-comecar">Começar desafio</button>`;
      $p('#desafio-comecar').addEventListener('click', () => this.comecar());
    },

    comecar() {
      // Jutsus de 3 a 6 selos: o Kage Bunshin é curto demais e o Suiryuudan longo demais para uma rodada
      const candidatos = app.jutsus.filter((j) => j.selos.length >= 3 && j.selos.length <= 6);
      this.partida = new Desafio(candidatos, { rodadas: 5 });
      let n = 3;
      const passo = () => {
        if (n > 0) { app.faixa(String(n), 'Prepare as mãos', 'var(--vermelho)'); som.selo(n); n--; this.contagem = setTimeout(passo, 900); }
        else { app.faixa('Vai!', '', 'var(--verde)'); this.liberado = true; this.render(); }
      };
      this.liberado = false;
      this.render();
      passo();
    },

    render() {
      const p = this.partida;
      if (p.terminado) {
        const tempo = p.tempo();
        const recorde = this.recordeNovo;
        painel.innerHTML = `
          <div><h1>Desafio concluído</h1><p>5 jutsus, ${p.fila.reduce((a, j) => a + j.selos.length, 0)} selos.</p></div>
          <div class="resultado">
            <div class="grande">${segundos(tempo)}</div>
            ${recorde ? '<div class="recorde">Novo recorde!</div>' : `<div>Recorde: ${segundos(estado.recordeDesafio)}</div>`}
          </div>
          <button class="botao botao-principal" id="desafio-denovo">Jogar de novo</button>`;
        $p('#desafio-denovo').addEventListener('click', () => this.comecar());
        return;
      }
      const j = p.treino.jutsu;
      painel.innerHTML = `
        <div><h2>Rodada ${p.rodada + 1} de ${p.fila.length}</h2><div class="relogio" id="desafio-relogio">${segundos(p.tempo(performance.now()))}</div></div>
        <div><h1>${j.nome}</h1><p>${j.traducao}</p></div>
        ${receitaHTML(j, p.treino.indice)}
        <p id="desafio-status">${this.liberado ? 'Vai, vai, vai!' : 'Prepare-se…'}</p>`;
    },

    selo(id, agora) {
      const p = this.partida;
      if (!p || !this.liberado || p.terminado) return;
      const jutsuDaRodada = p.treino.jutsu;
      const r = p.selo(id, agora);
      if (r === 'acerto') { som.selo(p.treino.indice); efeitos.selo(app.origem()); this.render(); }
      else if (r === 'erro') { som.erro(); }
      else if (r === 'proximo') { app.soltarJutsu(jutsuDaRodada, `Próximo: ${p.treino.jutsu.nome}`); this.render(); }
      else if (r === 'fim') {
        const tempo = p.tempo(agora);
        this.recordeNovo = estado.recordeDesafio === null || tempo < estado.recordeDesafio;
        app.soltarJutsu(jutsuDaRodada, this.recordeNovo ? 'Novo recorde!' : segundos(tempo));
        app.registrar({ xp: 50, mudar: (e) => { e.recordeDesafio = Math.min(e.recordeDesafio ?? Infinity, tempo); } });
        this.render();
      }
    },

    tick(agora) {
      const el = $p('#desafio-relogio');
      if (el && this.partida) el.textContent = segundos(this.partida.tempo(agora));
    },
  };

  return { dojo, treino, combate, desafio };
}
