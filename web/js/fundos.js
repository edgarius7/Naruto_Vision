// Planos de fundo do site: os wallpapers do projeto original, um modo que muda por tela e a imagem do próprio jogador.
import { estado, salvar } from './progresso.js';

export const FUNDOS = [
  { id: 'auto', nome: 'Muda por tela' },
  { id: 'konoha', nome: 'Konoha à noite' },
  { id: 'naruto', nome: 'Naruto' },
  { id: 'itachi', nome: 'Itachi na chuva' },
  { id: 'akatsuki', nome: 'Akatsuki' },
  { id: 'time7', nome: 'Time 7' },
  { id: 'nenhum', nome: 'Sem imagem' },
  { id: 'meu', nome: 'Minha imagem' },
];

// Como no app Streamlit: cada tela com o seu wallpaper
const POR_TELA = { inicio: 'naruto', camera: 'konoha', dojo: 'itachi', treino: 'itachi', combate: 'time7', desafio: 'akatsuki', perfil: 'konoha', pergaminho: 'konoha' };

const CHAVE_IMAGEM = 'naruto-vision:fundo-proprio';

export const miniatura = (id) => {
  if (id === 'meu') return lerImagemPropria();
  if (id === 'auto') return 'img/fundos/naruto-mini.jpg';
  if (id === 'nenhum') return null;
  return `img/fundos/${id}-mini.jpg`;
};

function lerImagemPropria() {
  try { return localStorage.getItem(CHAVE_IMAGEM); } catch { return null; }
}

export function aplicarFundo(tela) {
  let id = estado.config.fundo;
  if (id === 'auto') id = POR_TELA[tela] ?? 'konoha';
  let url = null;
  if (id === 'meu') url = lerImagemPropria();
  // endereço completo: dentro de uma variável CSS, um caminho relativo seria lido a partir de css/
  else if (id !== 'nenhum') url = new URL(`img/fundos/${id}.jpg`, document.baseURI).href;
  const raiz = document.documentElement.style;
  raiz.setProperty('--fundo-imagem', url ? `url("${url}")` : 'none');
  raiz.setProperty('--fundo-escurecer', String(estado.config.escurecer));
}

/** Reduz a imagem escolhida para caber no armazenamento do navegador (alguns MB no máximo). */
export async function salvarImagemPropria(arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * escala);
  c.height = Math.round(bitmap.height * escala);
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  const dados = c.toDataURL('image/jpeg', 0.8);
  try {
    localStorage.setItem(CHAVE_IMAGEM, dados);
  } catch {
    throw new Error('Não deu para salvar a imagem neste navegador (sem espaço ou em modo anônimo).');
  }
  estado.config.fundo = 'meu';
  salvar();
}

/** Janela para escolher o plano de fundo, aberta pelo botão 🖼 do topo */
export function abrirSeletorFundo({ aoMudar }) {
  let painel = document.querySelector('.seletor-fundo');
  if (painel) { painel.remove(); return; }
  painel = document.createElement('div');
  painel.className = 'seletor-fundo';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-label', 'Escolher plano de fundo');

  const desenhar = () => {
    painel.innerHTML = `
      <h2>Plano de fundo</h2>
      <div class="grade-fundos">${FUNDOS.map((f) => {
        const mini = miniatura(f.id);
        return `<button type="button" data-fundo="${f.id}" aria-pressed="${estado.config.fundo === f.id}"
          style="${mini ? `background-image:url('${mini}')` : ''}"><span>${f.nome}${f.id === 'meu' && !mini ? ' (enviar)' : ''}</span></button>`;
      }).join('')}</div>
      <div class="ajuste">
        <label for="fundo-escurecer"><span>Escurecer o fundo</span><b>${Math.round(estado.config.escurecer * 100)}%</b></label>
        <input type="range" id="fundo-escurecer" min="0.3" max="0.95" step="0.05" value="${estado.config.escurecer}">
      </div>
      <div class="acoes" style="margin-top:12px">
        <label class="botao botao-pequeno" style="cursor:pointer">Enviar imagem<input type="file" accept="image/*" hidden id="fundo-arquivo"></label>
        <button type="button" class="botao botao-pequeno" id="fundo-fechar">Fechar</button>
      </div>
      <p id="fundo-erro" style="color:var(--vermelho);margin:8px 0 0;font-size:14px"></p>`;

    painel.querySelectorAll('[data-fundo]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.fundo === 'meu' && !lerImagemPropria()) { painel.querySelector('#fundo-arquivo').click(); return; }
      estado.config.fundo = b.dataset.fundo;
      salvar();
      aoMudar();
      desenhar();
    }));
    painel.querySelector('#fundo-escurecer').addEventListener('input', (e) => {
      estado.config.escurecer = Number(e.target.value);
      e.target.previousElementSibling.querySelector('b').textContent = `${Math.round(estado.config.escurecer * 100)}%`;
      salvar();
      aoMudar();
    });
    painel.querySelector('#fundo-arquivo').addEventListener('change', async (e) => {
      const arquivo = e.target.files[0];
      if (!arquivo) return;
      try {
        await salvarImagemPropria(arquivo);
        aoMudar();
        desenhar();
      } catch (erro) {
        painel.querySelector('#fundo-erro').textContent = erro.message;
      }
    });
    painel.querySelector('#fundo-fechar').addEventListener('click', () => painel.remove());
  };

  desenhar();
  document.body.append(painel);
  painel.querySelector('button')?.focus();
}
