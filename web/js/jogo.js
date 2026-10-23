// Regras do jogo, sem nada de tela: dá para testar tudo com tempos simulados.
// Versões em JavaScript do src/jutsu_logic.py (FiltroSelo, GerenciadorDeJutsus e TreinoGuiado).

/**
 * Estabiliza a leitura do modelo por tempo, não por número de quadros (o FPS varia de máquina para máquina).
 * Um selo só é confirmado depois de segurado por `msSegurar`, e só pode ser confirmado de novo
 * depois que a pose for desfeita. Por isso não existe "auto-vitória" com a mão parada.
 */
export class FiltroSelo {
  constructor({ msSegurar = 350, msSoltar = 250 } = {}) {
    this.msSegurar = msSegurar;
    this.msSoltar = msSoltar;
    this.confirmado = null;
    // undefined = nenhum candidato; null é um candidato válido ("soltou as mãos")
    this.candidato = undefined;
    this.desde = 0;
  }

  /** @returns {{confirmado: string|null, candidato: string|null, progresso: number, novo: string|null}} */
  atualizar(selo, agora) {
    let novo = null;
    if (selo === this.confirmado) {
      this.candidato = undefined;
    } else {
      if (selo !== this.candidato) {
        this.candidato = selo;
        this.desde = agora;
      }
      const espera = selo === null ? this.msSoltar : this.msSegurar;
      if (agora - this.desde >= espera) {
        this.confirmado = selo;
        this.candidato = undefined;
        novo = selo;
      }
    }
    const progresso = this.candidato
      ? Math.min(1, (agora - this.desde) / this.msSegurar)
      : (this.confirmado ? 1 : 0);
    return { confirmado: this.confirmado, candidato: this.candidato, progresso, novo };
  }

  zerar() { this.confirmado = null; this.candidato = undefined; }
}

/** Modo Livre: junta os selos em sequência e procura um jutsu que termine com ela. */
export class Combo {
  constructor(jutsus, { msLimite = 2500 } = {}) {
    this.jutsus = jutsus;
    this.msLimite = msLimite;
    this.sequencia = [];
    this.ultimo = 0;
  }

  /** @returns o jutsu completado, se houver */
  adicionar(selo, agora) {
    this.expirar(agora);
    if (this.sequencia.at(-1) !== selo) this.sequencia.push(selo);
    this.ultimo = agora;
    for (const jutsu of this.jutsus) {
      const n = jutsu.selos.length;
      if (this.sequencia.length >= n && jutsu.selos.every((s, i) => s === this.sequencia[this.sequencia.length - n + i])) {
        this.sequencia = [];
        return jutsu;
      }
    }
    return null;
  }

  /** @returns true se o combo acabou de quebrar por demora */
  expirar(agora) {
    if (this.sequencia.length && agora - this.ultimo > this.msLimite) {
      this.sequencia = [];
      return true;
    }
    return false;
  }

  tempoRestante(agora) {
    return this.sequencia.length ? Math.max(0, 1 - (agora - this.ultimo) / this.msLimite) : 0;
  }

  /** Jutsus que a sequência atual está começando, do mais avançado para o menos. */
  pistas() {
    const s = this.sequencia;
    const lista = [];
    for (const jutsu of this.jutsus) {
      // maior k tal que os últimos k selos da sequência são o começo da receita
      for (let k = Math.min(s.length, jutsu.selos.length - 1); k > 0; k--) {
        if (jutsu.selos.slice(0, k).every((x, i) => x === s[s.length - k + i])) {
          lista.push({ jutsu, feitos: k });
          break;
        }
      }
    }
    return lista.sort((a, b) => b.feitos / b.jutsu.selos.length - a.feitos / a.jutsu.selos.length);
  }
}

/** Modo Treino: uma receita na tela, tempo máximo entre um selo e o próximo. */
export class Treino {
  constructor(jutsu, { msLimite = 4000 } = {}) {
    this.jutsu = jutsu;
    this.msLimite = msLimite;
    this.zerar();
  }

  zerar() {
    this.indice = 0;
    this.erros = 0;
    this.inicio = null;
    this.ultimoAcerto = 0;
    this.concluido = false;
  }

  get alvo() { return this.jutsu.selos[this.indice]; }

  /** @returns 'acerto' | 'erro' | 'vitoria' | null */
  selo(selo, agora) {
    if (this.concluido) return null;
    if (selo !== this.alvo) {
      // Selo de transição: só conta como erro se não for o que acabou de ser aceito
      if (this.indice > 0 && selo === this.jutsu.selos[this.indice - 1]) return null;
      this.erros++;
      return 'erro';
    }
    if (this.inicio === null) this.inicio = agora;
    this.indice++;
    this.ultimoAcerto = agora;
    if (this.indice >= this.jutsu.selos.length) {
      this.concluido = true;
      this.tempoTotal = agora - this.inicio;
      return 'vitoria';
    }
    return 'acerto';
  }

  /** @returns true se a sequência acabou de ser perdida por demora */
  expirar(agora) {
    if (!this.concluido && this.indice > 0 && agora - this.ultimoAcerto > this.msLimite) {
      this.indice = 0;
      this.inicio = null;
      return true;
    }
    return false;
  }

  tempoRestante(agora) {
    if (this.concluido || this.indice === 0) return 1;
    return Math.max(0, 1 - (agora - this.ultimoAcerto) / this.msLimite);
  }

  estrelas() {
    if (!this.concluido) return 0;
    const porSelo = this.tempoTotal / Math.max(1, this.jutsu.selos.length - 1);
    if (this.erros === 0 && porSelo <= 1500) return 3;
    if (this.erros <= 2 && porSelo <= 2500) return 2;
    return 1;
  }
}

/** Contra o relógio: vários jutsus seguidos, sem limite por selo, valendo o tempo total. */
export class Desafio {
  constructor(jutsus, { rodadas = 5, aleatorio = Math.random } = {}) {
    const embaralhados = [...jutsus].sort(() => aleatorio() - 0.5);
    this.fila = embaralhados.slice(0, rodadas);
    this.rodada = 0;
    this.inicio = null;
    this.fim = null;
    this.treino = new Treino(this.fila[0], { msLimite: Infinity });
  }

  get terminado() { return this.fim !== null; }

  selo(selo, agora) {
    if (this.terminado) return null;
    if (this.inicio === null) this.inicio = agora;
    const r = this.treino.selo(selo, agora);
    if (r === 'vitoria') {
      this.rodada++;
      if (this.rodada >= this.fila.length) {
        this.fim = agora;
        return 'fim';
      }
      this.treino = new Treino(this.fila[this.rodada], { msLimite: Infinity });
      return 'proximo';
    }
    return r;
  }

  tempo(agora) {
    if (this.inicio === null) return 0;
    return (this.fim ?? agora) - this.inicio;
  }
}
