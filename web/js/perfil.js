// Tela de perfil: rank, estatísticas, conquistas e ajustes de jogo.
import { estado, salvar, rankAtual, CONQUISTAS, RANKS, zerarProgresso } from './progresso.js';

const segundos = (ms) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

const AJUSTES = [
  { chave: 'msSegurar', rotulo: 'Tempo para segurar cada selo', min: 150, max: 1000, passo: 50, formato: (v) => `${v} ms` },
  { chave: 'msLimite', rotulo: 'Tempo entre selos no Treino', min: 2000, max: 10000, passo: 500, formato: segundos },
  { chave: 'msCombo', rotulo: 'Tempo entre selos no Combate', min: 1500, max: 6000, passo: 250, formato: segundos },
];

const OPCOES = [
  { chave: 'som', rotulo: 'Efeitos sonoros' },
  { chave: 'efeitosLeves', rotulo: 'Efeitos visuais leves (menos partículas, sem tremer a tela)' },
  { chave: 'mostrarCaixa', rotulo: 'Mostrar a caixa de detecção em volta das mãos' },
  { chave: 'teclado', rotulo: 'Simular selos pelo teclado (sem câmera)' },
];

export function renderizarPerfil(raiz, { jutsus, aoMudarConfig, aoZerar }) {
  const rank = rankAtual();
  const c = estado.config;
  const totalJutsus = Object.values(estado.jutsusFeitos).reduce((a, b) => a + b, 0);
  const diferentes = jutsus.filter((j) => estado.jutsusFeitos[j.id]).length;

  raiz.innerHTML = `
    <div class="cartao">
      <h2>Seu caminho ninja</h2>
      <div class="rank-grande">${rank.nome}</div>
      <p style="color:var(--texto-2)">${estado.xp} XP${rank.proximo ? ` · faltam ${rank.proximo.xp - estado.xp} XP para ${rank.proximo.nome}` : ' · rank máximo!'}</p>
      <div class="barra" style="margin:10px 0 18px"><div style="width:${rank.progresso * 100}%"></div></div>
      <div class="estatisticas">
        <div><b>${estado.selosDominados.length}/12</b><small>selos dominados</small></div>
        <div><b>${diferentes}/${jutsus.length}</b><small>jutsus aprendidos</small></div>
        <div><b>${totalJutsus}</b><small>jutsus lançados</small></div>
      </div>
      <p style="color:var(--texto-2);margin-top:14px">Recorde no Desafio: <b style="color:var(--texto)">${estado.recordeDesafio ? segundos(estado.recordeDesafio) : '—'}</b></p>
      <p style="color:var(--texto-2);font-size:14px">Ranks: ${RANKS.map((r) => `${r.nome} (${r.xp})`).join(' → ')}</p>
    </div>

    <div class="cartao">
      <h2>Conquistas ${estado.conquistas.length}/${CONQUISTAS.length}</h2>
      <div class="conquistas">${CONQUISTAS.map((q) => `
        <div class="conquista ${estado.conquistas.includes(q.id) ? 'ganha' : ''}">
          <span class="icone" aria-hidden="true">${estado.conquistas.includes(q.id) ? '🏆' : '🔒'}</span>
          <div><b>${q.nome}</b><small>${q.descricao}</small></div>
        </div>`).join('')}
      </div>
    </div>

    <div class="cartao">
      <h2>Ajustes</h2>
      ${AJUSTES.map((a) => `
        <div class="ajuste">
          <label for="aj-${a.chave}"><span>${a.rotulo}</span><b id="aj-${a.chave}-valor">${a.formato(c[a.chave])}</b></label>
          <input type="range" id="aj-${a.chave}" min="${a.min}" max="${a.max}" step="${a.passo}" value="${c[a.chave]}">
        </div>`).join('')}
      ${OPCOES.map((o) => `
        <label class="ajuste-check"><input type="checkbox" id="op-${o.chave}" ${valorOpcao(o.chave) ? 'checked' : ''}> ${o.rotulo}</label>`).join('')}
      <p style="color:var(--texto-2);font-size:14px">No modo teclado, segure uma tecla para fazer o selo: X Clone, T Tigre, O Cobra, N Carneiro, B Boi, H Cachorro, J Javali, M Macaco, C Coelho, V Cavalo, P Pássaro, D Dragão.</p>
      <button class="botao botao-pequeno" id="zerar">Apagar meu progresso</button>
    </div>`;

  for (const a of AJUSTES) {
    const input = raiz.querySelector(`#aj-${a.chave}`);
    input.addEventListener('input', () => {
      c[a.chave] = Number(input.value);
      raiz.querySelector(`#aj-${a.chave}-valor`).textContent = a.formato(c[a.chave]);
      salvar();
      aoMudarConfig();
    });
  }
  for (const o of OPCOES) {
    raiz.querySelector(`#op-${o.chave}`).addEventListener('change', (e) => {
      if (o.chave === 'efeitosLeves') c.efeitos = e.target.checked ? 'leve' : 'completo';
      else c[o.chave] = e.target.checked;
      salvar();
      aoMudarConfig();
    });
  }
  raiz.querySelector('#zerar').addEventListener('click', () => {
    if (!confirm('Apagar XP, selos dominados, recordes e conquistas? Os ajustes continuam.')) return;
    zerarProgresso();
    aoZerar();
    renderizarPerfil(raiz, { jutsus, aoMudarConfig, aoZerar });
  });
}

function valorOpcao(chave) {
  return chave === 'efeitosLeves' ? estado.config.efeitos === 'leve' : estado.config[chave];
}
