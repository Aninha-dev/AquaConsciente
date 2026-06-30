import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Droplet, Droplets, Home as HomeIcon, TrendingUp, Settings as SettingsIcon,
  ChevronLeft, ChevronRight, Plus, Minus, Check, X, Trash2, Edit3,
  ShowerHead, Car, Shirt, Flower2, Footprints, Waves, ChevronDown,
  AlertTriangle, Sparkles, Receipt, ArrowRight, Info, User, CreditCard, ClipboardList,
  Gauge, CalendarDays
} from "lucide-react";

/* ============================================================================
   AquaConsciente — design tokens
   Cor: Azul principal #2D9CDB · Azul claro #56CCF2 · Verde #27AE60
        Fundo #F8FAFC · Texto #16324A · Alerta #EB5757
   Tipografia: display arredondada para números-hero, corpo neutro para texto
   Assinatura: "medidor-gota" — a meta vira uma gota que se enche
============================================================================ */

const COLORS = {
  blue: "#1A6FB0",
  blueLight: "#5BC8EF",
  green: "#1E8449",
  bg: "#EFF6FB",
  ink: "#0F2A42",
  inkSoft: "#52708A",
  alert: "#EB5757",
  card: "#FFFFFF",
  line: "#D9E8F2",
};

const FONT_DISPLAY = "'Fredoka', 'Quicksand', system-ui, sans-serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";

// ── Tipografia padronizada ────────────────────────────────────────────────────
// Todos os títulos de tela usam exatamente este objeto de estilo.
const TITLE_STYLE = {
  fontFamily: FONT_DISPLAY,
  fontSize: 20,
  fontWeight: 700,
  color: "#0F2A42", // COLORS.ink — inline pois COLORS ainda não foi declarado
  lineHeight: 1.4,
  letterSpacing: 0.3, // leve abertura entre letras para melhorar a legibilidade
  margin: "0 0 8px",
  textAlign: "left",
};
// Subtítulo padrão (descrição curta abaixo do título)
const SUBTITLE_STYLE = {
  fontFamily: FONT_BODY,
  fontSize: 13.5,
  fontWeight: 400,
  color: "#52708A", // COLORS.inkSoft
  lineHeight: 1.6,
  margin: "0 0 20px",
};
// Label de seção (ALL CAPS pequeno, acima de cards)
const SECTION_LABEL_STYLE = {
  fontFamily: FONT_BODY,
  fontWeight: 700,
  fontSize: 11.5,
  color: "#52708A",
  textTransform: "uppercase",
  letterSpacing: 0.8,
  margin: "14px 0 8px",
};
// Texto informativo dentro de cards
const CARD_INFO_STYLE = {
  fontFamily: FONT_BODY,
  fontSize: 13,
  fontWeight: 400,
  color: "#52708A",
  lineHeight: 1.6,
  margin: 0,
};

/* ---------------------------------------------------------------------------
   Constantes de cálculo (consumo médio por pessoa, taxas de atividades)
--------------------------------------------------------------------------- */
/* Consumo diário monitorável por pessoa: representa exclusivamente as atividades
   que o app consegue registrar (banho ~72L + roupa ~17L + carro/calçada ~3L ≈ 92L).
   NÃO inclui vaso sanitário, cozinha ou lavatório — esses não são registráveis.
   Valor 90 L/dia torna a META comparável ao CONSUMO que o usuário vai inserir.
   Fonte: ANA (PNCDA), SABESP — taxas de uso por atividade doméstica. */
const CONSUMO_PESSOA_DIA_L = 90; // L/dia por pessoa (atividades rastreáveis pelo app)
const CONSUMO_PESSOA_MES_L = CONSUMO_PESSOA_DIA_L * 30; // 2700 L/mês por pessoa

/* Jardim: 3 regas/semana × 10 min × 10 L/min × ~5 semanas = 1500 L/mês.
   Fonte: ANA — mangueira doméstica 10-15 L/min; frequência observada em clima tropical. */
const AJUSTE_JARDIM_L = 1500; // L/mês adicionais se houver jardim

/* Piscina: 10% da capacidade/mês (evaporação + reposição).
   Fonte: ANA/CAESB — evaporação residencial em clima tropical: 5-10 %/mês do volume. */
const AJUSTE_PISCINA_FATOR = 0.10;

/* Apartamentos consomem ~12 % menos que casas (sem área externa, menor uso de mangueira).
   Fonte: SNIS 2022 — diferencial de consumo per capita entre tipologias residenciais. */
const FATOR_APARTAMENTO = 0.88; // apartamento reduz 12% do consumo base
const TARIFA_PADRAO = 8.5; // R$ por m³

/* Calcula a meta mensal (consumo rastreável estimado) em litros:
   consumo_base = moradores × 2700 L/mês  (atividades mensuráveis pelo app)
   ajuste_tipo  = consumo_base × 0.88     (somente apartamento — SNIS 2022)
   ajuste_jardim= 1500 L/mês fixo         (ANA: 3 regas/semana × 10 min × 10 L/min)
   ajuste_piscina = capacidade × 10 %    (ANA/CAESB: evaporação + reposição mensal)
   Proteção: moradores mínimo 1 para evitar meta zero. */
function calcularMetaMensalL(residencia) {
  const moradores = Math.max(1, residencia.moradores || 1);
  let consumoBase = moradores * CONSUMO_PESSOA_MES_L;
  if (residencia.tipo === "apartamento") {
    consumoBase = consumoBase * FATOR_APARTAMENTO;
  }
  const ajusteJardim = residencia.jardim ? AJUSTE_JARDIM_L : 0;
  const ajustePiscina = residencia.piscina
    ? Math.round((residencia.capacidadePiscina || 5000) * AJUSTE_PISCINA_FATOR)
    : 0;
  return Math.round(consumoBase + ajusteJardim + ajustePiscina);
}

const TAXAS = {
  banho: 9,   // L/min — chuveiro elétrico doméstico (PNCDA/ANA: 6-9 L/min)
  carro: 10,  // L/balde — balde doméstico padrão (ANA)
  roupa: 130, // L/ciclo — máquina top-loading (INMETRO 2019: 130-180 L/ciclo)
  jardim: 10, // L/min — mangueira com regulagem moderada (ANA: 10-15 L/min)
  calcada: 15, // L/min — mangueira com pressão (ANA: 12-20 L/min)
};

const ATIVIDADES = [
  {
    id: "banho",
    nome: "Banho",
    unidade: "minutos",
    icon: ShowerHead,
    info: "Usamos uma média de 9 litros por minuto para chuveiros comuns.",
    dica: "Banhos mais curtos podem reduzir bastante o consumo de água.",
    campo: "Tempo de banho",
    sufixoUnidade: "min",
    min: 1,
    max: 60,
    passo: 1,
    valorInicial: 8,
  },
  {
    id: "carro",
    nome: "Lavagem do carro",
    unidade: "baldes",
    icon: Car,
    info: "Usamos uma média de 10 litros por balde.",
    dica: "Utilizar baldes em vez de mangueira pode reduzir o consumo de água.",
    campo: "Quantos baldes foram utilizados?",
    sufixoUnidade: "baldes",
    min: 1,
    max: 20,
    passo: 1,
    valorInicial: 2,
  },
  {
    id: "roupa",
    nome: "Lavar roupa",
    unidade: "ciclos",
    icon: Shirt,
    info: "Usamos uma média de 130 litros por ciclo em máquinas de lavar comuns (top-loading).",
    dica: "Acumule mais roupas e use a máquina sempre com a capacidade máxima.",
    campo: "Ciclos realizados",
    sufixoUnidade: "ciclos",
    min: 1,
    max: 10,
    passo: 1,
    valorInicial: 1,
  },
  {
    id: "jardim",
    nome: "Regar jardim",
    unidade: "minutos",
    icon: Flower2,
    info: "Usamos uma média de 10 litros por minuto ao regar o jardim com mangueira.",
    dica: "Regue as plantas no início da manhã ou no fim da tarde para evitar evaporação.",
    campo: "Tempo de rega",
    sufixoUnidade: "min",
    min: 1,
    max: 60,
    passo: 1,
    valorInicial: 10,
  },
  {
    id: "calcada",
    nome: "Lavar calçada",
    unidade: "minutos",
    icon: Footprints,
    info: "Usamos uma média de 15 litros por minuto ao lavar a calçada com mangueira.",
    dica: "Use a vassoura para remover a sujeira antes de usar água. Assim você economiza muito.",
    campo: "Tempo de lavagem",
    sufixoUnidade: "min",
    min: 1,
    max: 60,
    passo: 1,
    valorInicial: 10,
  },
  {
    id: "piscina",
    nome: "Encher piscina",
    unidade: "percentual",
    icon: Waves,
    info: "Usamos o volume informado da piscina para estimar o consumo.",
    dica: "Cubra a piscina quando não estiver usando para reduzir a evaporação da água.",
    campo: "Percentual preenchido",
    sufixoUnidade: "%",
    min: 25,
    max: 100,
    passo: 25,
    valorInicial: 100,
  },
];

function calcularLitros(atividadeId, valor, capacidadePiscina) {
  switch (atividadeId) {
    case "banho": return Math.max(0, Math.round(valor * TAXAS.banho));
    case "carro": return Math.max(0, Math.round(valor * TAXAS.carro));
    case "roupa": return Math.max(0, Math.round(valor * TAXAS.roupa));
    case "jardim": return Math.max(0, Math.round(valor * TAXAS.jardim));
    case "calcada": return Math.max(0, Math.round(valor * TAXAS.calcada));
    case "piscina": {
      const cap = Math.max(1, capacidadePiscina || 5000);
      const pct = clamp(valor, 0, 100);
      return Math.round(cap * (pct / 100));
    }
    default: return 0;
  }
}

function formatoEquacao(atividadeId, valor, capacidadePiscina) {
  switch (atividadeId) {
    case "banho": return `${valor} min × ${TAXAS.banho} L/min`;
    case "carro": return `${valor} baldes × ${TAXAS.carro} L/balde`;
    case "roupa": return `${valor} ciclo${valor > 1 ? "s" : ""} × ${TAXAS.roupa} L/ciclo`;
    case "jardim": return `${valor} min × ${TAXAS.jardim} L/min`;
    case "calcada": return `${valor} min × ${TAXAS.calcada} L/min`;
    case "piscina": return `${valor}% de ${(capacidadePiscina || 5000).toLocaleString("pt-BR")} L`;
    default: return "";
  }
}

/* ---------------------------------------------------------------------------
   Geração de semanas do mês atual (vazias) — identifica a semana corrente
   automaticamente a partir da data de hoje, dividindo o mês em blocos de 7 dias.
--------------------------------------------------------------------------- */
const NOMES_MES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function pad2(n) { return String(n).padStart(2, "0"); }

/* Retorna a segunda-feira da semana que contém a data informada.
   getDay(): 0=domingo, 1=segunda, ..., 6=sábado. */
function segundaFeiraDaSemana(data) {
  const d = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  const diaSemana = d.getDay();
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana; // domingo volta 6 dias
  d.setDate(d.getDate() + deslocamento);
  return d;
}

function formatarDataCurta(data) {
  return `${pad2(data.getDate())}/${pad2(data.getMonth() + 1)}`;
}

/* Formata uma Date como "YYYY-MM-DD" usando o calendário LOCAL (evita o bug de
   toISOString(), que converte para UTC e pode "voltar" um dia em fusos negativos
   como o do Brasil). */
function formatarISOLocal(data) {
  return `${data.getFullYear()}-${pad2(data.getMonth() + 1)}-${pad2(data.getDate())}`;
}

/* Gera as semanas de calendário (segunda–domingo) que cobrem o mês de referência.
   A Semana 1 pode começar ainda no mês anterior (se 4+ dos seus 7 dias caem
   neste mês). Sempre são geradas exatamente 4 semanas — a 4ª absorve todos os
   dias finais que sobrarem (por isso pode ficar maior que 7 dias, ex: 12 dias
   quando o mês termina numa sexta). Cada semana carrega seu número real de
   dias (`dias`), usado para calcular uma meta proporcional — assim uma semana
   maior tem uma meta maior, e a comparação visual continua justa. */
function gerarSemanasDoMes(dataRef = new Date()) {
  const ano = dataRef.getFullYear();
  const mes = dataRef.getMonth(); // 0-indexado
  const primeiroDiaMes = new Date(ano, mes, 1);
  const ultimoDiaMes = new Date(ano, mes + 1, 0);

  const semanas = [];
  let cursor = segundaFeiraDaSemana(primeiroDiaMes);
  let numero = 1;

  while (cursor <= ultimoDiaMes && numero <= 4) {
    const inicioSemana = new Date(cursor);
    const fimSemana = new Date(cursor);
    fimSemana.setDate(fimSemana.getDate() + 6);

    const inicioNoMes = inicioSemana < primeiroDiaMes ? primeiroDiaMes : inicioSemana;
    const fimNoMes = fimSemana > ultimoDiaMes ? ultimoDiaMes : fimSemana;
    const diasNoMes = Math.round((fimNoMes - inicioNoMes) / 86400000) + 1;

    // Essa semana não pertence majoritariamente a este mês (4+ dos 7 dias).
    // Se ainda não começamos (é a primeira tentativa, ex: semana de virada de
    // ano com só 3 dias no mês novo), pulamos para a próxima semana em vez de
    // abortar — assim o mês sempre acaba ganhando suas 4 semanas.
    if (diasNoMes < 4) {
      if (semanas.length === 0) {
        cursor.setDate(cursor.getDate() + 7);
        continue;
      }
      break;
    }

    const ehUltima = numero === 4;
    semanas.push({
      numero,
      inicioSemana,
      // a 4ª semana sempre se estende até o último dia do mês, absorvendo
      // qualquer dia final que sobrar (mesmo que fique com mais de 7 dias)
      fimSemana: ehUltima ? new Date(ultimoDiaMes) : fimSemana,
      status: "naoiniciada",
      consumoL: 0,
      atividades: [],
    });
    numero += 1;
    cursor.setDate(cursor.getDate() + 7);
  }

  return {
    semanas: semanas.map((s) => ({
      numero: s.numero,
      periodo: `${formatarDataCurta(s.inicioSemana)}–${formatarDataCurta(s.fimSemana)}`,
      dataInicio: formatarISOLocal(s.inicioSemana),
      dataFim: formatarISOLocal(s.fimSemana),
      dias: Math.round((s.fimSemana - s.inicioSemana) / 86400000) + 1,
      status: s.status,
      consumoL: s.consumoL,
      atividades: s.atividades,
    })),
    nomeMes: NOMES_MES[mes],
    ano,
  };
}

/* Identifica automaticamente em qual semana a data de hoje cai,
   comparando com o intervalo real (dataInicio–dataFim) de cada semana. */
function semanaAtualPorData(semanas, dataRef = new Date()) {
  const hojeISO = formatarISOLocal(dataRef);
  const idx = semanas.findIndex((s) => hojeISO >= s.dataInicio && hojeISO <= s.dataFim);
  return idx === -1 ? semanas.length - 1 : idx;
}

/* ---------------------------------------------------------------------------
   Dados simulados — histórico de meses anteriores
--------------------------------------------------------------------------- */
const HISTORICO_INICIAL = [];

/* ---------------------------------------------------------------------------
   Utilidades
--------------------------------------------------------------------------- */
const fmtL = (n) => `${Math.round(n).toLocaleString("pt-BR")} L`;
const fmtM3 = (litros, dec = 1) => `${(litros / 1000).toFixed(dec)} m³`;
const fmtR = (n) => `R$ ${n.toFixed(2).replace(".", ",")}`;
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/* Meta semanal proporcional: cada semana recebe uma fração da meta mensal
   de acordo com quantos dias ela tem, em vez de uma divisão fixa por 4.
   Assim, quando a última semana absorve dias extras (ex: 12 dias em vez de 7),
   sua meta também cresce proporcionalmente — a comparação visual continua justa.
   Proteção: totalDiasMes mínimo 1 para evitar divisão por zero. */
function calcularMetaSemanal(metaMensalL, semana, totalDiasMes) {
  return Math.round(metaMensalL * (semana.dias / Math.max(1, totalDiasMes)));
}

/* ============================================================================
   App raiz
============================================================================ */
export default function App() {
  const [fase, setFase] = useState("onboarding"); // onboarding -> cadastro -> app
  const [onboardStep, setOnboardStep] = useState(0);

  const [residencia, setResidencia] = useState({
    tipo: null,
    moradores: 3,
    jardim: null,
    piscina: null,
    capacidadePiscina: 0,
  });

  const [metaPercentual, setMetaPercentual] = useState(15);
  const [tarifa, setTarifa] = useState(TARIFA_PADRAO);

  // Lê o mês ativo do localStorage (gravado ao finalizar um mês).
  // Se não houver registro, usa o mês atual do dispositivo.
  const [mesInfo, setMesInfo] = useState(() => {
    try {
      const salvo = localStorage.getItem("aqua_mesAtivo");
      if (salvo) {
        const { nomeMes, ano } = JSON.parse(salvo);
        const mesIdx = NOMES_MES.indexOf(nomeMes);
        if (mesIdx !== -1 && ano) return gerarSemanasDoMes(new Date(ano, mesIdx, 1));
      }
    } catch (_) {}
    return gerarSemanasDoMes(new Date());
  });

  // Lê as semanas do localStorage — só válidas se o mês ativo também estiver salvo.
  const [semanas, setSemanas] = useState(() => {
    try {
      const salvoMes = localStorage.getItem("aqua_mesAtivo");
      const salvoSemanas = localStorage.getItem("aqua_semanas");
      if (salvoMes && salvoSemanas) return JSON.parse(salvoSemanas);
    } catch (_) {}
    return gerarSemanasDoMes(new Date()).semanas;
  });

  // Histórico persiste entre sessões.
  const [historico, setHistorico] = useState(() => {
    try {
      const salvo = localStorage.getItem("aqua_historico");
      if (salvo) return JSON.parse(salvo);
    } catch (_) {}
    return HISTORICO_INICIAL;
  });

  const [contaMesAnterior, setContaMesAnterior] = useState(null);
  const [dataEncerramentoMes, setDataEncerramentoMes] = useState(() => {
    const salvo = localStorage.getItem("aqua_dataEncerramentoMes");
    return salvo ? new Date(salvo) : null;
  });

  // true se há um mês ativo salvo manualmente — impede o sync automático
  // de reverter o mês para o calendário do dispositivo.
  const [mesFinalizadoManualmente, setMesFinalizadoManualmente] = useState(
    () => !!localStorage.getItem("aqua_mesAtivo")
  );

  const [tab, setTab] = useState("inicio");
  const [tela, setTela] = useState(null); // overlay de tela (registro semanal, add consumo, etc.)
  const [semanaAtivaIdx, setSemanaAtivaIdx] = useState(() => {
    const hoje = new Date();
    return semanaAtualPorData(gerarSemanasDoMes(hoje).semanas, hoje);
  });
  const [atividadeSelecionada, setAtividadeSelecionada] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmarFinalizarMes, setConfirmarFinalizarMes] = useState(false);
  const [confirmarFinalizarSemanaIdx, setConfirmarFinalizarSemanaIdx] = useState(null);

  const [toastUndo, setToastUndo] = useState(null); // { msg, onUndo }

  const showToast = useCallback((msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 2400);
  }, []);

  // Persiste as semanas no localStorage sempre que mudarem (quando há mês ativo salvo).
  useEffect(() => {
    if (mesFinalizadoManualmente) {
      localStorage.setItem("aqua_semanas", JSON.stringify(semanas));
    }
  }, [semanas, mesFinalizadoManualmente]);

  // Persiste o histórico no localStorage sempre que mudar.
  useEffect(() => {
    localStorage.setItem("aqua_historico", JSON.stringify(historico));
  }, [historico]);

  /* ---- sincronização automática com a data do dispositivo ----
     Só atualiza o mês se o usuário nunca finalizou um mês manualmente
     (mesFinalizadoManualmente=false). Nesse caso, se o calendário do
     dispositivo avançou naturalmente (ex: virada de mês real), a tela
     é atualizada automaticamente. Quando há um mês ativo salvo manualmente,
     a sincronização é ignorada — o ciclo é controlado pelo usuário. */
  useEffect(() => {
    function sincronizarMes() {
      if (mesFinalizadoManualmente) return;
      const hoje = new Date();
      const mesAtual = hoje.getMonth();
      const anoAtual = hoje.getFullYear();
      const mesExibido = NOMES_MES.indexOf(mesInfo.nomeMes);
      const anoExibido = mesInfo.ano;
      if (mesAtual !== mesExibido || anoAtual !== anoExibido) {
        const novoMesInfo = gerarSemanasDoMes(hoje);
        setMesInfo(novoMesInfo);
        setSemanas(novoMesInfo.semanas);
        setSemanaAtivaIdx(semanaAtualPorData(novoMesInfo.semanas, hoje));
      }
    }
    sincronizarMes();
    const intervalo = setInterval(sincronizarMes, 60000);
    return () => clearInterval(intervalo);
  }, [mesInfo.nomeMes, mesInfo.ano, mesFinalizadoManualmente]);

  /* ---- cálculos derivados ---- */
  // META mensal (consumo ideal) calculada a partir do perfil da residência —
  // já fica disponível assim que o cadastro é concluído.
  const metaOperacionalL = useMemo(
    () => Math.round(calcularMetaMensalL(residencia) * (1 - metaPercentual / 100)),
    [residencia, metaPercentual]
  );
  const consumoBaseM3 = +(metaOperacionalL / 1000).toFixed(1);
  const consumoBaseL = metaOperacionalL;

  const consumoTotalMesL = useMemo(
    () => semanas.reduce((acc, s) => acc + s.consumoL, 0),
    [semanas]
  );

  const restamL = Math.max(metaOperacionalL - consumoTotalMesL, 0);
  const percentualMeta = clamp(metaOperacionalL > 0 ? Math.round((consumoTotalMesL / metaOperacionalL) * 100) : 0, 0, 999);
  const dentroDaMeta = consumoTotalMesL <= metaOperacionalL;

  // dias_passados = até o fim da última semana já iniciada/concluída, limitado
  // ao último dia do mês de referência (mín. 1)
  const mesRefIdx = NOMES_MES.indexOf(mesInfo.nomeMes);
  const ultimoDiaDoMes = new Date(mesInfo.ano, mesRefIdx + 1, 0).getDate();
  const parseDataLocal = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const diasPassadosMes = Math.max(
    1,
    semanas.reduce((max, s) => {
      if (s.status === "naoiniciada") return max;
      const fimData = parseDataLocal(s.dataFim);
      // se a semana terminar no mês seguinte, já passamos o mês inteiro
      const diaReal = fimData.getMonth() === mesRefIdx ? fimData.getDate() : ultimoDiaDoMes;
      return Math.max(max, diaReal);
    }, 0)
  );
  const mediaDiariaPessoa = Math.round(consumoTotalMesL / Math.max(1, residencia.moradores) / diasPassadosMes);
  const valorEstimado = +(consumoTotalMesL / 1000 * tarifa).toFixed(2);

  /* ---- handlers de fluxo ---- */
  const finalizarCadastro = () => {
    setFase("app");
    showToast("Residência cadastrada com sucesso!");
  };

  const adicionarConsumo = (atividadeId, valor) => {
    const litros = calcularLitros(atividadeId, valor, residencia.capacidadePiscina);
    const agora = new Date();
    const novaEntrada = {
      id: Date.now(),
      atividadeId,
      valor,
      litros,
      data: "Hoje",
      hora: agora.toTimeString().slice(0, 5),
    };
    setSemanas((prev) => {
      const copia = [...prev];
      const idx = clamp(semanaAtivaIdx, 0, copia.length - 1);
      copia[idx] = {
        ...copia[idx],
        status: copia[idx].status === "naoiniciada" ? "andamento" : copia[idx].status,
        consumoL: copia[idx].consumoL + litros,
        atividades: [novaEntrada, ...copia[idx].atividades],
      };
      return copia;
    });
    showToast(`${fmtL(litros)} registrados!`);
  };

  const excluirAtividade = (semanaIdx, atividadeRegistroId) => {
    let semanadAntes;
    setSemanas((prev) => {
      const copia = [...prev];
      const semana = copia[semanaIdx];
      semanadAntes = semana;
      const removida = semana.atividades.find((a) => a.id === atividadeRegistroId);
      copia[semanaIdx] = {
        ...semana,
        consumoL: Math.max(0, semana.consumoL - (removida ? removida.litros : 0)),
        atividades: semana.atividades.filter((a) => a.id !== atividadeRegistroId),
      };
      return copia;
    });
    const timer = setTimeout(() => setToastUndo(null), 3500);
    setToastUndo({
      msg: "Registro removido.",
      onUndo: () => {
        clearTimeout(timer);
        setToastUndo(null);
        setSemanas((prev) => {
          const copia = [...prev];
          copia[semanaIdx] = semanadAntes;
          return copia;
        });
      },
    });
  };

  const finalizarSemana = (idx) => {
    setConfirmarFinalizarSemanaIdx(idx);
  };

  const concluirSemanaAgora = (idx) => {
    setConfirmarFinalizarSemanaIdx(null);
    setSemanas((prev) => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], status: "concluida" };
      const proximaIdx = idx + 1;
      if (proximaIdx < copia.length && copia[proximaIdx].status === "naoiniciada") {
        copia[proximaIdx] = { ...copia[proximaIdx], status: "andamento" };
      }
      return copia;
    });
    showToast(`Semana ${semanas[idx].numero} finalizada!`);
    setTela(null);
    setTab("inicio");
  };

  const semanasFaltando = semanas.filter((s) => s.status !== "concluida");

  const finalizarMes = () => {
    setConfirmarFinalizarMes(true);
  };

  const encerrarMesAgora = () => {
    setConfirmarFinalizarMes(false);

    // Congela os valores ANTES de qualquer setState
    const mesFinalizado = mesInfo.nomeMes;
    const anoFinalizado = mesInfo.ano;
    const metaCongelada = metaOperacionalL;
    const consumoCongelado = consumoTotalMesL;
    const baseCongelada = consumoBaseL;
    const valorPrevistoCongelado = +(metaCongelada / 1000 * tarifa).toFixed(2);

    // Adiciona ao histórico apenas se ainda não existir entrada pendente para este mês
    const jaPendente = historico.some(
      (h) => h.mes === mesFinalizado && h.ano === anoFinalizado && !h.contaRegistrada
    );
    if (!jaPendente) {
      setHistorico((prev) => {
        const novoHistorico = [
          ...prev,
          {
            mes: mesFinalizado,
            ano: anoFinalizado,
            previstoL: metaCongelada,
            realL: consumoCongelado,
            valorPrevisto: valorPrevistoCongelado,
            valorReal: null,
            baseL: baseCongelada,
            contaRegistrada: false,
          },
        ];
        // Persiste imediatamente
        localStorage.setItem("aqua_historico", JSON.stringify(novoHistorico));
        return novoHistorico;
      });
    }

    // Avança SEMPRE sequencialmente a partir do mês encerrado —
    // nunca usa a data do dispositivo para calcular o próximo mês.
    // Isso garante: Junho→Julho→Agosto→... independente do calendário real.
    const mesEncerradoIdx = NOMES_MES.indexOf(mesFinalizado);
    const proxMesIdx = (mesEncerradoIdx + 1) % 12;
    const proxAno = mesEncerradoIdx === 11 ? anoFinalizado + 1 : anoFinalizado;

    const dataProxMes = new Date(proxAno, proxMesIdx, 1);
    const novoMesInfo = gerarSemanasDoMes(dataProxMes);

    // Persiste o novo mês ativo e zera as semanas
    localStorage.setItem("aqua_mesAtivo", JSON.stringify({ nomeMes: novoMesInfo.nomeMes, ano: novoMesInfo.ano }));
    localStorage.setItem("aqua_semanas", JSON.stringify(novoMesInfo.semanas));
    localStorage.setItem("aqua_dataEncerramentoMes", new Date().toISOString());

    setDataEncerramentoMes(new Date());
    setMesFinalizadoManualmente(true);
    setMesInfo(novoMesInfo);
    setSemanas(novoMesInfo.semanas);
    setSemanaAtivaIdx(0);

    showToast("Mês finalizado! Novo mês iniciado.");
  };

  const salvarContaReal = ({ valorPago, mes }) => {
    const anoAtual = new Date().getFullYear();
    setContaMesAnterior({ valorPago, mes });
    setDataEncerramentoMes(null);
    localStorage.removeItem("aqua_dataEncerramentoMes");
    setHistorico((prev) => {
      const idx = prev.findIndex((h) => h.mes === mes && !h.contaRegistrada);
      let novoHistorico;
      if (idx !== -1) {
        novoHistorico = [...prev];
        novoHistorico[idx] = { ...novoHistorico[idx], valorReal: valorPago, contaRegistrada: true };
      } else {
        novoHistorico = [
          ...prev,
          {
            mes,
            ano: anoAtual,
            previstoL: metaOperacionalL,
            realL: consumoTotalMesL,
            valorPrevisto: +(metaOperacionalL / 1000 * tarifa).toFixed(2),
            valorReal: valorPago,
            baseL: consumoBaseL,
            contaRegistrada: true,
          },
        ];
      }
      localStorage.setItem("aqua_historico", JSON.stringify(novoHistorico));
      return novoHistorico;
    });
    setTela(null);
    setTab("relatorios");
    showToast("Conta registrada! Veja a comparação no histórico.");
  };

  /* ============================== RENDER =============================== */
  return (
    <div style={styles.viewport}>
      <GlobalStyle />
      <div style={styles.phone}>
        {fase === "onboarding" && (
          <Onboarding
            step={onboardStep}
            setStep={setOnboardStep}
            onFinish={() => setFase("cadastro")}
          />
        )}

        {fase === "cadastro" && (
          <CadastroResidencia
            residencia={residencia}
            setResidencia={setResidencia}
            consumoBaseM3={consumoBaseM3}
            onSalvar={finalizarCadastro}
            onVoltar={() => setFase("onboarding")}
          />
        )}

        {fase === "app" && (
          <>
            <div style={styles.screenArea}>
              {tab === "inicio" && !tela && (
                <Dashboard
                  residencia={residencia}
                  nomeMes={mesInfo.nomeMes}
                  ano={mesInfo.ano}
                  consumoTotalMesL={consumoTotalMesL}
                  metaOperacionalL={metaOperacionalL}
                  restamL={restamL}
                  percentualMeta={percentualMeta}
                  dentroDaMeta={dentroDaMeta}
                  mediaDiariaPessoa={mediaDiariaPessoa}
                  valorEstimado={valorEstimado}
                  historico={historico}
                  mesPendente={historico.find((h) => !h.contaRegistrada) ?? null}
                  semanas={semanas}
                  metaPercentual={metaPercentual}
                  onIrAjustes={() => { setTab("ajustes"); setTela(null); }}
                  onAbrirSemana={(idx) => {
                    setSemanaAtivaIdx(idx);
                    setTela("semana");
                  }}
                  onAdicionar={() => setTela("escolher-atividade")}
                  onFinalizarMes={finalizarMes}
                  onRegistrarConta={() => { setTab("registrar"); setTela(null); }}
                />
              )}

              {tab === "registrar" && !tela && (
                <RegistrarConta
                  onVoltar={() => setTab("relatorios")}
                  onSalvar={salvarContaReal}
                  previstoM3={+(metaOperacionalL / 1000).toFixed(1)}
                  mesesRegistrados={historico.filter((h) => h.contaRegistrada).map((h) => h.mes)}
                  mesPendente={historico.find((h) => !h.contaRegistrada) ?? null}
                />
              )}

              {tab === "relatorios" && !tela && (
                <Relatorios
                  historico={historico}
                  tarifa={tarifa}
                  onRegistrarConta={() => { setTab("registrar"); setTela(null); }}
                />
              )}

              {tab === "ajustes" && !tela && (
                <Ajustes
                  residencia={residencia}
                  setResidencia={setResidencia}
                  metaPercentual={metaPercentual}
                  setMetaPercentual={setMetaPercentual}
                  tarifa={tarifa}
                  setTarifa={setTarifa}
                  consumoBaseM3={consumoBaseM3}
                  showToast={showToast}
                  onLimparDados={() => {
                    const hoje = new Date();
                    const novoMesInfo = gerarSemanasDoMes(hoje);
                    const novasSemanas = novoMesInfo.semanas;
                    setSemanas(novasSemanas);
                    setMesInfo(novoMesInfo);
                    setSemanaAtivaIdx(0);
                    setHistorico([]);
                    setMesFinalizadoManualmente(false);
                    localStorage.removeItem("aqua_mesAtivo");
                    localStorage.removeItem("aqua_semanas");
                    localStorage.removeItem("aqua_historico");
                    localStorage.removeItem("aqua_dataEncerramentoMes");
                    showToast("Dados limpos.", "info");
                  }}
                />
              )}

              {/* ---- Overlays / telas modais ---- */}
              {tela === "semana" && (
                <TelaSemana
                  semana={semanas[semanaAtivaIdx]}
                  semanaIdx={semanaAtivaIdx}
                  metaOperacionalL={metaOperacionalL}
                  totalDiasMes={ultimoDiaDoMes}
                  onVoltar={() => setTela(null)}
                  onAdicionar={() => setTela("escolher-atividade")}
                  onExcluir={excluirAtividade}
                  onFinalizarSemana={() => finalizarSemana(semanaAtivaIdx)}
                />
              )}

              {tela === "escolher-atividade" && (
                <EscolherAtividade
                  onVoltar={() => setTela("semana")}
                  onEscolher={(a) => {
                    setAtividadeSelecionada(a);
                    setTela("form-atividade");
                  }}
                  residencia={residencia}
                />
              )}

              {tela === "form-atividade" && atividadeSelecionada && (
                <FormAtividade
                  atividade={atividadeSelecionada}
                  capacidadePiscina={residencia.capacidadePiscina}
                  onVoltar={() => setTela("escolher-atividade")}
                  onSalvar={(valor) => {
                    adicionarConsumo(atividadeSelecionada.id, valor);
                    setTela("semana");
                  }}
                />
              )}

            </div>

            {!tela && (
              <BottomNav tab={tab} setTab={(t) => { setTab(t); setTela(null); }} />
            )}
          </>
        )}

        {toast && <Toast msg={toast.msg} tipo={toast.tipo} />}
        {toastUndo && <ToastUndo msg={toastUndo.msg} onUndo={toastUndo.onUndo} />}

        {confirmarFinalizarMes && (
          <ConfirmarFinalizarMes
            semanasFaltando={semanasFaltando}
            onVoltar={() => setConfirmarFinalizarMes(false)}
            onConfirmar={encerrarMesAgora}
          />
        )}

        {confirmarFinalizarSemanaIdx !== null && (
          <ConfirmarFinalizarSemana
            semana={semanas[confirmarFinalizarSemanaIdx]}
            onVoltar={() => setConfirmarFinalizarSemanaIdx(null)}
            onConfirmar={() => concluirSemanaAgora(confirmarFinalizarSemanaIdx)}
          />
        )}
      </div>
    </div>
  );
}

function ConfirmarFinalizarMes({ semanasFaltando, onVoltar, onConfirmar }) {
  const tudoConcluido = semanasFaltando.length === 0;
  const listaSemanas = semanasFaltando.map((s) => `Semana ${s.numero}`);
  const fraseSemanas = listaSemanas.length <= 1
    ? listaSemanas.join("")
    : `${listaSemanas.slice(0, -1).join(", ")} e ${listaSemanas[listaSemanas.length - 1]}`;

  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(22,50,74,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, zIndex: 60,
    }}>
      <div style={{
        background: "#fff", borderRadius: 22, padding: "20px 20px",
        maxWidth: 340, width: "100%", boxShadow: "0 20px 50px -10px rgba(22,50,74,0.35)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: tudoConcluido ? "#EAF8EF" : "#FDEDED",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
        }}>
          {tudoConcluido
            ? <Check size={22} color={COLORS.green} />
            : <AlertTriangle size={22} color={COLORS.alert} />}
        </div>

        {tudoConcluido ? (
          <>
            <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>
              Finalizar este mês?
            </p>
            <p style={{ margin: "0 0 18px", fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 1.5 }}>
              Todas as semanas já foram concluídas. Ao confirmar, um novo mês será iniciado.
            </p>
          </>
        ) : (
          <>
            <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>
              Você ainda não concluiu todas as semanas deste mês.
            </p>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 1.5 }}>
              Encerrar agora pode gerar estimativas menos precisas.
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: COLORS.ink, lineHeight: 1.5 }}>
              <strong>Semanas faltando:</strong> {fraseSemanas}.
            </p>
            <p style={{ margin: "0 0 18px", fontSize: 13.5, fontWeight: 600, color: COLORS.ink }}>
              Deseja continuar?
            </p>
          </>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={onConfirmar}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 18, border: "none",
              background: tudoConcluido ? COLORS.green : COLORS.alert,
              color: "#fff", fontWeight: 700, fontSize: 15, minHeight: 48,
            }}
          >
            {tudoConcluido ? "Confirmar e finalizar" : "Encerrar mesmo assim"}
          </button>
          <SecondaryButton onClick={onVoltar} style={{ fontSize: 15, minHeight: 48 }}>Voltar</SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function ConfirmarFinalizarSemana({ semana, onVoltar, onConfirmar }) {
  const semanaVazia = semana.atividades.length === 0;
  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(22,50,74,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, zIndex: 60,
    }}>
      <div style={{
        background: "#fff", borderRadius: 22, padding: "20px 20px",
        maxWidth: 340, width: "100%", boxShadow: "0 20px 50px -10px rgba(22,50,74,0.35)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", background: "#FDEDED",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
        }}>
          <AlertTriangle size={22} color={COLORS.alert} />
        </div>
        <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 16, color: COLORS.ink }}>
          {semanaVazia
            ? `A Semana ${semana.numero} ainda não tem nenhuma atividade registrada.`
            : `Deseja mesmo finalizar a Semana ${semana.numero}?`}
        </p>
        <p style={{ margin: "0 0 18px", fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 1.5 }}>
          {semanaVazia
            ? "Finalizar agora vai marcar esta semana como concluída com 0 L de consumo. Depois de concluída, não será mais possível adicionar ou editar registros nela."
            : "Depois de concluída, não será mais possível adicionar, editar ou excluir nenhum registro desta semana. Essa ação não pode ser desfeita."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={onConfirmar}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 18, border: "none",
              background: COLORS.alert, color: "#fff", fontWeight: 700, fontSize: 15, minHeight: 48,
            }}
          >
            {semanaVazia ? "Finalizar mesmo assim" : "Sim, finalizar semana"}
          </button>
          <SecondaryButton onClick={onVoltar} style={{ fontSize: 15, minHeight: 48 }}>Voltar</SecondaryButton>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   Estilo global e wrapper de "celular"
============================================================================ */
function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
      body { margin: 0; }
      .scrollnobar::-webkit-scrollbar { display: none; }
      .scrollnobar { scrollbar-width: none; }
      button { font-family: ${FONT_BODY}; cursor: pointer; }
      input, textarea { font-family: ${FONT_BODY}; color: ${COLORS.ink}; }
      input::placeholder, textarea::placeholder { color: ${COLORS.inkSoft}; opacity: 0.7; }
      select { font-family: ${FONT_BODY}; color: ${COLORS.ink}; }
      @keyframes fadeUp { from { opacity:0; transform: translateY(8px);} to {opacity:1; transform:translateY(0);} }
      @keyframes popIn { from { opacity:0; transform: scale(0.92);} to {opacity:1; transform:scale(1);} }
      @keyframes fillWave { from { transform: translateY(8px);} to { transform: translateY(0);} }
      @keyframes toastIn { from { opacity:0; transform: translate(-50%, 10px);} to {opacity:1; transform:translate(-50%, 0);} }
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      input[type=number] { -moz-appearance: textfield; }
      :focus-visible { outline: 3px solid #1A6FB0; outline-offset: 2px; border-radius: 8px; }
    `}</style>
  );
}

const styles = {
  viewport: {
    minHeight: "100vh",
    width: "100%",
    background: "linear-gradient(180deg, #E0F0FA 0%, #CCE7F5 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px 0",
    fontFamily: FONT_BODY,
  },
  phone: {
    width: 390,
    maxWidth: "100%",
    height: 844,
    maxHeight: "calc(100vh - 40px)",
    background: COLORS.bg,
    borderRadius: 36,
    boxShadow: "0 30px 60px -15px rgba(22,50,74,0.35), 0 0 0 10px #0A2438",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    color: COLORS.ink,
  },
  screenArea: {
    flex: 1,
    overflowY: "auto",
    position: "relative",
  },
};

/* ============================================================================
   Componentes de UI reutilizáveis
============================================================================ */
function Toast({ msg, tipo }) {
  const bg = tipo === "info" ? "#1E4258" : COLORS.green;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "absolute", bottom: 96, left: "50%", transform: "translateX(-50%)",
        background: bg, color: "#fff", padding: "12px 18px",
        borderRadius: 14, fontSize: 14, fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
        animation: "toastIn 0.25s ease-out",
        display: "flex", alignItems: "center", gap: 8,
        width: "calc(100% - 40px)", maxWidth: 360, textAlign: "center", justifyContent: "center",
      }}>
      {tipo === "info" ? <Info size={16} style={{ flexShrink: 0 }} /> : <Check size={16} style={{ flexShrink: 0 }} />}
      <span>{msg}</span>
    </div>
  );
}

function ToastUndo({ msg, onUndo }) {
  return (
    <div
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        position: "absolute", bottom: 96, left: "50%", transform: "translateX(-50%)",
        background: "#1E4258", color: "#fff", padding: "10px 14px",
        borderRadius: 14, fontSize: 14, fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)", zIndex: 50,
        animation: "toastIn 0.25s ease-out",
        display: "flex", alignItems: "center", gap: 12,
        maxWidth: "calc(100% - 40px)",
      }}>
      <Info size={16} />
      <span>{msg}</span>
      <button
        onClick={onUndo}
        aria-label="Desfazer exclusão"
        style={{
          background: "#fff", color: "#1E4258", border: "none",
          borderRadius: 8, padding: "5px 10px", fontWeight: 700,
          fontSize: 13, cursor: "pointer", flexShrink: 0,
        }}
      >
        Desfazer
      </button>
    </div>
  );
}

function ScreenHeader({ title, onBack, right }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "20px 20px 12px", position: "sticky", top: 0,
      background: COLORS.bg, zIndex: 10,
    }}>
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Voltar"
          style={{
            width: 40, height: 40, borderRadius: 12, border: "none",
            background: "#fff", display: "flex", alignItems: "center",
            justifyContent: "center", boxShadow: "0 2px 8px rgba(22,50,74,0.08)",
          }}
        >
          <ChevronLeft size={22} color={COLORS.ink} />
        </button>
      )}
      <h1 style={{
        ...TITLE_STYLE,
        margin: 0, flex: 1,
      }}>
        {title}
      </h1>
      {right}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, style, icon }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: "16px 20px", borderRadius: 18,
        border: "none", background: disabled ? "#A9C7DC" : COLORS.blue,
        color: "#fff", fontWeight: 700, fontSize: 16, fontFamily: FONT_BODY,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        boxShadow: disabled ? "none" : "0 8px 20px -6px rgba(45,156,219,0.55)",
        transition: "transform 0.15s, box-shadow 0.15s",
        minHeight: 44,
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      {children} {icon}
    </button>
  );
}

function SecondaryButton({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", padding: "14px 20px", borderRadius: 18,
        border: `1.5px solid ${COLORS.line}`, background: "#fff",
        color: COLORS.ink, fontWeight: 600, fontSize: 15,
        minHeight: 44,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, style, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.card, borderRadius: 20, padding: 18,
        boxShadow: "0 4px 18px -6px rgba(22,50,74,0.08)",
        border: `1px solid ${COLORS.line}`,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Toggle({ value, onChange, labelOn = "Sim", labelOff = "Não" }) {
  return (
    <div style={{ display: "flex", gap: 8 }} role="group">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          style={{
            flex: 1, padding: "12px 0", borderRadius: 14, minHeight: 44,
            border: value === v ? `2px solid ${COLORS.blue}` : `1.5px solid ${COLORS.line}`,
            background: value === v ? "#E4F2FB" : "#fff",
            color: value === v ? COLORS.blue : COLORS.inkSoft,
            fontWeight: 700, fontSize: 15,
          }}
        >
          {v ? labelOn : labelOff}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon = Droplets, title, subtitle }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", padding: "30px 24px", color: COLORS.inkSoft,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: "50%", background: "#E4F2FB",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
      }}>
        <Icon size={28} color={COLORS.blue} />
      </div>
      <p style={{ fontWeight: 700, color: COLORS.ink, margin: "0 0 4px", fontSize: 15 }}>{title}</p>
      <p style={{ fontSize: 13.5, margin: 0, lineHeight: 1.5 }}>{subtitle}</p>
    </div>
  );
}

/* ============================================================================
   1. Onboarding (Página Inicial)
============================================================================ */
const SLIDES = [
  {
    icon: TrendingUp,
    title: "Entenda seu consumo",
    text: "Descubra como os hábitos da sua residência influenciam o consumo de água e o valor da sua conta.",
  },
  {
    icon: Droplet,
    title: "Registre suas atividades",
    text: "Informe atividades como lavar roupa, lavar o carro, regar o jardim e tomar banhos para estimar o consumo da residência.",
  },
  {
    icon: Sparkles,
    title: "Acompanhe sua economia",
    text: "Compare o consumo estimado com a sua conta real, acompanhe sua evolução e receba sugestões para economizar.",
  },
];

function Onboarding({ step, setStep, onFinish }) {
  if (step === 0) {
    return (
      <div style={{
        height: "100%", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "40px 32px",
        background: `radial-gradient(120% 100% at 50% 0%, #E4F2FB 0%, ${COLORS.bg} 60%)`,
      }}>
        <div style={{
          width: 110, height: 110, borderRadius: "50%",
          background: `linear-gradient(160deg, ${COLORS.blueLight}, ${COLORS.blue})`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 28, boxShadow: "0 16px 32px -10px rgba(45,156,219,0.5)",
        }}>
          <Droplet size={52} color="#fff" fill="#fff" />
        </div>
        <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 30, color: COLORS.ink, margin: "0 0 10px", textAlign: "center" }}>
          AquaConsciente
        </h1>
        <p style={{ color: COLORS.inkSoft, textAlign: "center", fontSize: 16, lineHeight: 1.5, margin: "0 0 40px", maxWidth: 280 }}>
          Entenda e controle o consumo de água da sua família. Simples, visual e gratuito.
        </p>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <PrimaryButton onClick={onFinish}>Começar agora <ArrowRight size={18} /></PrimaryButton>
          <SecondaryButton onClick={() => setStep(1)}>Saiba mais</SecondaryButton>
        </div>
      </div>
    );
  }

  const s = SLIDES[step - 1];
  const Icon = s.icon;
  const isLast = step === SLIDES.length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "24px 28px 36px" }}>
      <div style={{ display: "flex", justifyContent: "flex-end", minHeight: 36 }}>
        {!isLast && (
          <button onClick={onFinish} style={{ background: "none", border: "none", color: COLORS.inkSoft, fontWeight: 600, fontSize: 14, padding: 8, minHeight: 44 }}>
            Pular
          </button>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{
          width: 120, height: 120, borderRadius: "50%", background: "#E4F2FB",
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32,
          animation: "popIn 0.35s ease-out",
        }}>
          <Icon size={52} color={COLORS.blue} strokeWidth={1.6} />
        </div>
        <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 22, color: COLORS.ink, margin: "0 0 10px", lineHeight: 1.3 }}>{s.title}</h2>
        <p style={{ color: COLORS.inkSoft, fontSize: 15.5, lineHeight: 1.6, margin: 0, maxWidth: 280 }}>{s.text}</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
        {SLIDES.map((_, i) => (
          <div key={i} style={{
            width: i === step - 1 ? 22 : 8, height: 8, borderRadius: 4,
            background: i === step - 1 ? COLORS.blue : COLORS.line,
            transition: "all 0.25s",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => (isLast ? onFinish() : setStep(step + 1))}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "14px 22px",
            borderRadius: 18, border: "none", background: COLORS.blue, color: "#fff",
            fontWeight: 700, fontSize: 15, fontFamily: FONT_BODY, minHeight: 44,
            boxShadow: "0 8px 20px -6px rgba(45,156,219,0.55)",
          }}
        >
          {isLast ? "Começar agora" : "Continuar"} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   2. Cadastro da Residência
============================================================================ */
function CadastroResidencia({ residencia, setResidencia, consumoBaseM3, onSalvar, onVoltar }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ScreenHeader title="Sobre sua residência" onBack={onVoltar} />
      <div className="scrollnobar" style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
        <p style={SUBTITLE_STYLE}>
          Essas informações nos ajudam a calcular uma estimativa inicial de consumo ideal para sua família.
        </p>

        <Field label="Qual é o tipo da sua residência?">
          <div style={{ display: "flex", gap: 10 }}>
            {["casa", "apartamento"].map((t) => (
              <button
                key={t}
                onClick={() => setResidencia((r) => ({ ...r, tipo: t }))}
                style={{
                  flex: 1, padding: "14px 0", borderRadius: 14, minHeight: 44, textTransform: "capitalize",
                  border: residencia.tipo === t ? `2px solid ${COLORS.blue}` : `1.5px solid ${COLORS.line}`,
                  background: residencia.tipo === t ? "#E4F2FB" : "#fff",
                  color: residencia.tipo === t ? COLORS.blue : COLORS.inkSoft, fontWeight: 700, fontSize: 15,
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Quantidade de moradores">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 16, padding: "8px 8px" }}>
            <Stepper onClick={() => setResidencia((r) => ({ ...r, moradores: Math.max(1, r.moradores - 1) }))} icon={Minus} label="Diminuir moradores" />
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700 }}>{residencia.moradores}</span>
            <Stepper onClick={() => setResidencia((r) => ({ ...r, moradores: Math.min(12, r.moradores + 1) }))} icon={Plus} label="Aumentar moradores" />
          </div>
        </Field>

        <Field label="Possui jardim?">
          <Toggle value={residencia.jardim} onChange={(v) => setResidencia((r) => ({ ...r, jardim: v }))} />
        </Field>

        <Field label="Possui piscina?">
          <Toggle value={residencia.piscina} onChange={(v) => setResidencia((r) => ({ ...r, piscina: v }))} />
        </Field>

        {residencia.piscina && (
          <Field label="Qual a capacidade da piscina?" style={{ animation: "fadeUp 0.25s ease-out" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input
                type="number"
                min={100}
                max={500000}
                value={residencia.capacidadePiscina || ""}
                placeholder="Ex: 5000"
                onChange={(e) => {
                  const v = +e.target.value || 0;
                  setResidencia((r) => ({ ...r, capacidadePiscina: Math.max(0, v) }));
                }}
                style={{
                  flex: 1, padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${COLORS.line}`,
                  fontSize: 16, fontWeight: 600, color: COLORS.ink, minHeight: 44, background: "#fff",
                }}
              />
              <span style={{ color: COLORS.inkSoft, fontWeight: 600, fontSize: 15 }}>litros</span>
            </div>
            {residencia.capacidadePiscina > 0 && residencia.capacidadePiscina < 100 && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.alert }}>
                Valor muito baixo. Uma piscina comum tem pelo menos 100 litros.
              </p>
            )}
            {residencia.capacidadePiscina > 200000 && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.alert }}>
                Valor muito alto. Verifique a capacidade informada.
              </p>
            )}
          </Field>
        )}

        {residencia.tipo !== null && residencia.jardim !== null && residencia.piscina !== null && (
          <PreviewMetaCadastro residencia={residencia} />
        )}
      </div>
      <div style={{ padding: "16px 20px 24px", background: COLORS.bg }}>
        <PrimaryButton
          onClick={onSalvar}
          disabled={
            !residencia.tipo ||
            residencia.jardim === null ||
            residencia.piscina === null ||
            (residencia.piscina && !(residencia.capacidadePiscina >= 100))
          }
        >Salvar e continuar <ArrowRight size={18} /></PrimaryButton>
      </div>
    </div>
  );
}

/* Mostra, já durante o cadastro, a meta mensal, a média por pessoa e o valor
   estimado da conta calculados a partir do perfil informado até aqui. */
function PreviewMetaCadastro({ residencia }) {
  const metaL = calcularMetaMensalL(residencia);
  const valorEstimado = +(metaL / 1000 * TARIFA_PADRAO).toFixed(2);

  return (
    <Card style={{ marginTop: 4, background: "#E4F2FB", border: "none" }}>
      <p style={{ margin: "0 0 14px", fontWeight: 700, fontSize: 13, color: "#0F2A42", lineHeight: 1.4 }}>
        Estimativa para sua residência
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#0F2A42", fontWeight: 600, lineHeight: 1.4 }}>Meta mensal</p>
          <p style={{ margin: "2px 0 0", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: COLORS.ink }}>{fmtL(metaL)}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#0F2A42", fontWeight: 600, lineHeight: 1.4 }}>Média por pessoa</p>
          <p style={{ margin: "2px 0 0", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: COLORS.ink }}>{CONSUMO_PESSOA_DIA_L} L/dia</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#0F2A42", fontWeight: 600, lineHeight: 1.4 }}>Valor estimado da conta</p>
          <p style={{ margin: "2px 0 0", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 15, color: COLORS.ink }}>{fmtR(valorEstimado)}</p>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children, style }) {
  return (
    <div style={{ marginBottom: 20, ...style }}>
      <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 8, lineHeight: 1.4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Stepper({ onClick, icon: Icon, label = "ajustar" }) {
  return (
    <button onClick={onClick} aria-label={label} style={{
      width: 44, height: 44, borderRadius: 12, border: "none",
      background: "#E4F2FB", display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon size={20} color={COLORS.blue} />
    </button>
  );
}

/* ============================================================================
   3. Bottom Navigation
============================================================================ */
function BottomNav({ tab, setTab }) {
  const items = [
    { id: "inicio", label: "Início", icon: HomeIcon },
    { id: "registrar", label: "Registrar", icon: ClipboardList },
    { id: "relatorios", label: "Relatórios", icon: TrendingUp },
    { id: "ajustes", label: "Ajustes", icon: SettingsIcon },
  ];
  return (
    <nav style={{
      display: "flex", borderTop: `1px solid ${COLORS.line}`, background: "#fff",
      padding: "8px 6px calc(8px + env(safe-area-inset-bottom, 0px))",
    }}>
      {items.map((it) => {
        const active = tab === it.id;
        const Icon = it.icon;
        return (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            aria-label={it.label}
            aria-current={active ? "page" : undefined}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: "none", border: "none", padding: "6px 0", minHeight: 44,
              color: active ? COLORS.blue : COLORS.inkSoft,
            }}
          >
            <Icon size={22} fill="none" strokeWidth={active ? 2.4 : 2} />
            <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 600 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* ============================================================================
   4. Dashboard
============================================================================ */
function Dashboard({
  residencia, nomeMes, ano, consumoTotalMesL, metaOperacionalL, restamL, percentualMeta,
  dentroDaMeta, mediaDiariaPessoa, valorEstimado, historico, mesPendente, semanas,
  onAbrirSemana, onAdicionar, onFinalizarMes, onRegistrarConta, metaPercentual, onIrAjustes,
}) {
  const extras = [];
  if (residencia.jardim) extras.push("jardim");
  if (residencia.piscina) extras.push("piscina");
  const subtitulo = `${residencia.tipo === "casa" ? "Casa" : residencia.tipo === "apartamento" ? "Apartamento" : "Residência"}${extras.length ? ` c/ ${extras.join(" e ")}` : ""},`;

  // Exibe o card de conta pendente sempre que houver um mês finalizado
  // sem conta registrada — o mais antigo é mostrado primeiro.
  const mostrarBannerConta = mesPendente != null;

  return (
    <div style={{ padding: "20px 20px 28px" }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: 18, minWidth: 0 }}>
        <h1 style={{ ...TITLE_STYLE, wordBreak: "break-word" }}>
          {subtitulo} {residencia.moradores} {residencia.moradores === 1 ? "morador" : "moradores"}
        </h1>
      </div>

      {/* Card principal — consumo do mês + meta */}
      <Card style={{ padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Droplet size={15} color={COLORS.blue} fill={COLORS.blue} />
            <span style={{ fontSize: 12.5, color: COLORS.inkSoft, fontWeight: 600, lineHeight: 1.4 }}>Consumo deste mês</span>
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 30, margin: "0 0 10px", color: COLORS.ink, fontWeight: 700 }}>
            {fmtL(consumoTotalMesL)}
          </p>
          <ProgressBar pct={percentualMeta} />
          <p style={{ margin: "10px 0 0", fontSize: 13, color: COLORS.inkSoft }}>
            de <strong style={{ color: COLORS.ink }}>{fmtL(metaOperacionalL)}</strong> (meta do mês)
          </p>
          <span style={{
            marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4,
            background: "#E4F2FB", borderRadius: 8, padding: "3px 9px",
          }}>
            <Sparkles size={11} color={COLORS.blue} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.blue }}>
              {metaPercentual}% de economia aplicado
            </span>
          </span>
        </div>
        <DropGaugeCircle percentual={percentualMeta} size={86} />
      </Card>

      <div style={{
        marginTop: 12, padding: "14px 16px", borderRadius: 18,
        background: dentroDaMeta ? "#EAF8EF" : "#FDEDED",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: dentroDaMeta ? "#1E8449" : "#C0392B" }}>
            {dentroDaMeta ? "Você está dentro da meta!" : "Você passou da meta mensal."}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: dentroDaMeta ? "#1E8449" : "#C0392B" }}>
            {dentroDaMeta
              ? "Continue assim e economize água."
              : `${fmtL(consumoTotalMesL - metaOperacionalL)} acima do esperado.`}
          </p>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: dentroDaMeta ? "#BEE6CC" : "#F6C6C6", flexShrink: 0 }} />
        <div style={{ flexShrink: 0, textAlign: "center", minWidth: 90 }}>
          <p style={{ margin: 0, fontSize: 11.5, fontWeight: 600, color: COLORS.inkSoft }}>
            Restam
          </p>
          <p style={{ margin: "2px 0", fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: COLORS.ink, lineHeight: 1.2 }}>
            {fmtL(restamL)}
          </p>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: COLORS.inkSoft }}>
            para sua meta
          </p>
        </div>
      </div>

      {/* Grid de métricas secundárias com separação visual */}
      <div style={{ height: 1, background: COLORS.line, margin: "14px 0 12px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <MetricCardIcon icon={User} label="Consumo por pessoa hoje" value={`${mediaDiariaPessoa} L/dia`} />
        <MetricCardIcon icon={CreditCard} label="Conta estimada até agora" value={fmtR(valorEstimado)} />
      </div>

      {/* Acompanhamento semanal */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "18px 0 10px" }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14.5, color: COLORS.ink }}>Acompanhamento semanal</p>
        <div style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.inkSoft, fontSize: 12.5, fontWeight: 600 }}>
          <CalendarIcon />
          {nomeMes} de {ano}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {semanas.map((s, idx) => (
          <SemanaRow key={s.numero} semana={s} onClick={() => onAbrirSemana(idx)} />
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={onFinalizarMes}
          style={{
            width: "100%", textAlign: "left", border: `1.5px solid #BEE6CC`,
            background: "#EAF8EF", borderRadius: 18, padding: "16px 18px",
            display: "flex", gap: 12, alignItems: "flex-start", minHeight: 44,
            boxShadow: "0 10px 24px -10px rgba(39,174,96,0.35)",
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: COLORS.green,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
          }}>
            <Check size={18} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15.5, color: "#1E8449" }}>Finalizar mês</p>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#1E8449", lineHeight: 1.45 }}>
              A conta real pode ser adicionada em Registros quando estiver disponível.
            </p>
          </div>
          <ChevronRight size={18} color="#1E8449" style={{ marginTop: 8, flexShrink: 0 }} />
        </button>
      </div>

      {/* Card de conta pendente — aparece apenas quando há mês finalizado sem conta registrada */}
      {mostrarBannerConta && (
        <div style={{
          marginTop: 14, padding: "16px 18px", borderRadius: 18,
          border: `1.5px solid #F6D89A`, background: "#FFFBF0",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: "#FEF3CD",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
          }}>
            <Receipt size={18} color="#B7791F" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: "0 0 2px", fontWeight: 700, fontSize: 13.5, color: "#92600A" }}>
              Conta pendente — {mesPendente.mes}/{mesPendente.ano}
            </p>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "#B7791F", lineHeight: 1.5 }}>
              O mês foi finalizado. Quando receber sua conta de água, registre o valor para comparar com a estimativa do aplicativo.
            </p>
            <button
              onClick={onRegistrarConta}
              style={{
                padding: "8px 14px", borderRadius: 10, border: "1.5px solid #F6D89A",
                background: "#FEF3CD", color: "#92600A", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
                alignSelf: "flex-start",
              }}
            >
              Registrar conta
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={COLORS.inkSoft} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

/* Círculo de meta que se "fecha" conforme a porcentagem aumenta (igual ao card principal da referência) */
function DropGaugeCircle({ percentual, size = 86 }) {
  const pct = clamp(percentual, 0, 100);
  const cor = pct >= 100 ? COLORS.alert : COLORS.ink;
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (pct / 100) * circumference;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS.line} strokeWidth="5" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={cor} strokeWidth="5"
          strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: size * 0.24, fontWeight: 700, color: COLORS.ink }}>{pct}%</span>
        <span style={{ fontSize: size * 0.1, color: COLORS.inkSoft, fontWeight: 600, marginTop: -2 }}>da meta</span>
      </div>
    </div>
  );
}

function MetricCardIcon({ icon: Icon, label, value, nota }) {
  return (
    <Card style={{ padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%", background: "#E4F2FB",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={18} color={COLORS.blue} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 600, lineHeight: 1.35 }}>{label}</p>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 16, margin: "3px 0 0", color: COLORS.ink, fontWeight: 700 }}>{value}</p>
        {nota && <p style={{ margin: "2px 0 0", fontSize: 10, color: COLORS.inkSoft }}>* {nota}</p>}
      </div>
    </Card>
  );
}

function BarChart({ data, formatY, formatLabel, labelPrevisto = "Previsto", labelReal = "Real" }) {
  const allValues = data.flatMap((d) => [d.previsto, d.real]).filter((v) => v != null && !isNaN(v));
  const max = Math.max(...allValues, 1);

  // Nice Y axis: 4 ticks from 0 to rounded max
  const niceMax = Math.ceil(max * 1.15);
  const step = Math.ceil(niceMax / 4);
  const ticks = [0, step, step * 2, step * 3, step * 4];

  const chartH = 130;

  return (
    <div style={{ width: "100%", maxWidth: "100%", overflowX: "hidden", overflowY: "visible", boxSizing: "border-box", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 0, width: "100%", maxWidth: "100%" }}>
        {/* Y axis labels */}
        <div style={{ display: "flex", flexDirection: "column-reverse", justifyContent: "space-between", height: chartH, paddingRight: 6, flexShrink: 0 }}>
          {ticks.map((t) => (
            <span key={t} style={{ fontSize: 10, color: COLORS.inkSoft, lineHeight: 1, textAlign: "right", whiteSpace: "nowrap" }}>{formatY(t)}</span>
          ))}
        </div>

        {/* Chart area */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ position: "relative", width: "100%", height: chartH, boxSizing: "border-box" }}>
            {/* Grid lines */}
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column-reverse", justifyContent: "space-between", pointerEvents: "none" }}>
              {ticks.map((t) => (
                <div key={t} style={{ width: "100%", height: 1, background: COLORS.line }} />
              ))}
            </div>

            {/* Bars */}
            <div style={{ display: "flex", alignItems: "flex-end", height: chartH, gap: 14, padding: "0 2px", position: "relative", width: "100%", boxSizing: "border-box" }}>
              {data.map((d, i) => {
                const maxTick = ticks[ticks.length - 1];
                const hPrev = Math.max((d.previsto / maxTick) * chartH, 4);
                const hReal = d.real != null ? Math.max((d.real / maxTick) * chartH, 4) : 0;
                return (
                  <div key={i} style={{ flex: 1, minWidth: 0, maxWidth: 64, display: "flex", alignItems: "flex-end", gap: 6, justifyContent: "center", height: chartH }}>
                    {/* Previsto bar */}
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", width: "40%", minWidth: 16, maxWidth: 26, height: "100%" }}>
                      <span style={{
                        position: "absolute", bottom: hPrev + 3, left: "50%", transform: "translateX(-50%)",
                        fontSize: 8.5, fontWeight: 700, color: COLORS.inkSoft, whiteSpace: "nowrap", zIndex: 1,
                      }}>{formatLabel(d.previsto)}</span>
                      <div style={{ width: "100%", height: hPrev, background: COLORS.blueLight, borderRadius: "3px 3px 0 0" }} />
                    </div>
                    {/* Real bar */}
                    {d.real != null && (
                      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", width: "40%", minWidth: 16, maxWidth: 26, height: "100%" }}>
                        <span style={{
                          position: "absolute", bottom: hReal + 3, left: "50%", transform: "translateX(-50%)",
                          fontSize: 8.5, fontWeight: 700, color: COLORS.inkSoft, whiteSpace: "nowrap", zIndex: 1,
                        }}>{formatLabel(d.real)}</span>
                        <div style={{ width: "100%", height: hReal, background: COLORS.blue, borderRadius: "3px 3px 0 0" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rótulo do mês — sempre abaixo da linha do 0 */}
          <div style={{ display: "flex", gap: 14, padding: "6px 2px 0", width: "100%", boxSizing: "border-box" }}>
            {data.map((d, i) => (
              <div key={i} style={{ flex: 1, minWidth: 0, maxWidth: 64, textAlign: "center" }}>
                <span style={{ fontSize: 11, color: COLORS.inkSoft, fontWeight: 600, whiteSpace: "nowrap" }}>{d.mes.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.blueLight }} />
          <span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>{labelPrevisto}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS.blue }} />
          <span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>{labelReal}</span>
        </div>
      </div>
    </div>
  );
}

function SemanaRow({ semana, onClick }) {
  const statusInfo = {
    concluida: { label: "Concluído", color: COLORS.green, bg: "#EAF8EF" },
    andamento: { label: "Em andamento", color: COLORS.blue, bg: "#E4F2FB" },
    naoiniciada: { label: "Não iniciada", color: COLORS.inkSoft, bg: "#E9F1F7" },
  };
  const s = statusInfo[semana.status] || statusInfo.naoiniciada;
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14,
      background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 16,
      padding: "12px 14px", textAlign: "left", minHeight: 44, width: "100%",
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: "50%", border: `2px solid ${COLORS.ink}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{semana.numero}</span>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: COLORS.ink }}>Semana {semana.numero}</p>
        <p style={{ margin: "1px 0 5px", fontSize: 12, color: COLORS.inkSoft }}>{semana.periodo}</p>
        <span style={{
          fontSize: 11, fontWeight: 700, color: s.color, background: s.bg,
          padding: "3px 9px", borderRadius: 20, display: "inline-block",
        }}>
          {s.label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{fmtL(semana.consumoL)}</span>
        <ChevronRight size={18} color={COLORS.inkSoft} />
      </div>
    </button>
  );
}

/* ============================================================================
   5. Registro Semanal (tab "Registrar")
============================================================================ */

function TelaSemana({ semana, semanaIdx, metaOperacionalL, totalDiasMes, onVoltar, onAdicionar, onExcluir, onFinalizarSemana }) {
  const metaSemanal = calcularMetaSemanal(metaOperacionalL, semana, totalDiasMes);
  const pctSemana = clamp(metaSemanal > 0 ? Math.round((semana.consumoL / metaSemanal) * 100) : 0, 0, 999);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ScreenHeader title={`Semana ${semana.numero}`} onBack={onVoltar} />
      <div className="scrollnobar" style={{ flex: 1, overflowY: "auto" }}>
        <TelaSemanaConteudo
          semana={semana} semanaIdx={semanaIdx} metaSemanal={metaSemanal} pctSemana={pctSemana}
          onAdicionar={onAdicionar} onExcluir={onExcluir} onFinalizarSemana={onFinalizarSemana} embutido
        />
      </div>
    </div>
  );
}

function TelaSemanaConteudo({
  semana, semanaIdx, semanas, setSemanaAtivaIdx, metaSemanal, pctSemana,
  onAdicionar, onExcluir, onFinalizarMes, onFinalizarSemana, mostrarSeletor, embutido,
}) {
  const restamSemana = Math.max(metaSemanal - semana.consumoL, 0);
  const dentro = semana.consumoL <= metaSemanal;

  return (
    <div style={{ padding: embutido ? "0 20px 100px" : "20px 20px 28px" }}>
      {mostrarSeletor && (
        <>
          <h1 style={TITLE_STYLE}>Semana atual</h1>
          <div style={{ display: "flex", gap: 8, marginBottom: 18, overflowX: "auto" }} className="scrollnobar">
            {semanas.map((s, i) => (
              <button
                key={s.numero}
                onClick={() => setSemanaAtivaIdx(i)}
                style={{
                  padding: "8px 14px", borderRadius: 12, whiteSpace: "nowrap", minHeight: 44,
                  border: i === semanaIdx ? `2px solid ${COLORS.blue}` : `1.5px solid ${COLORS.line}`,
                  background: i === semanaIdx ? "#E4F2FB" : "#fff",
                  color: i === semanaIdx ? COLORS.blue : COLORS.inkSoft, fontWeight: 700, fontSize: 13,
                }}
              >
                Semana {s.numero}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Card principal — igual ao da página inicial, com gráfico circular */}
      <Card style={{ padding: 20, display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Droplet size={15} color={COLORS.blue} fill={COLORS.blue} />
            <span style={{ fontSize: 12.5, color: COLORS.inkSoft, fontWeight: 600, lineHeight: 1.4 }}>Resumo da semana</span>
          </div>
          <p style={{ fontFamily: FONT_DISPLAY, fontSize: 30, margin: "0 0 10px", color: COLORS.ink, fontWeight: 700 }}>
            {fmtL(semana.consumoL)}
          </p>
          <ProgressBar pct={pctSemana} />
          <p style={{ margin: "8px 0 0", fontSize: 12.5, color: COLORS.inkSoft }}>
            de <strong style={{ color: COLORS.ink }}>{fmtL(metaSemanal)}</strong> (meta da semana)
          </p>
        </div>
        <DropGaugeCircle percentual={pctSemana} size={86} />
      </Card>

      {/* Mensagem de status — mesmo padrão do card da página inicial */}
      <div style={{
        marginBottom: 20, padding: "16px 18px", borderRadius: 18,
        background: dentro ? "#EAF8EF" : "#FDEDED",
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: dentro ? "#1E8449" : "#C0392B" }}>
          {dentro ? "Você está dentro da meta semanal!" : "Você passou da meta semanal."}
        </p>
        <div style={{ width: 1, alignSelf: "stretch", background: dentro ? "#BEE6CC" : "#F6C6C6" }} />
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: COLORS.ink, whiteSpace: "nowrap" }}>
            Restam {fmtL(restamSemana)}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, fontWeight: 600, color: COLORS.inkSoft, whiteSpace: "nowrap" }}>
            para sua meta
          </p>
        </div>
      </div>

      <p style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink, margin: "0 0 8px", letterSpacing: 0.1 }}>Atividades registradas</p>

      {semana.atividades.length === 0 ? (
        <EmptyState
          icon={Droplets}
          title="Nenhuma atividade registrada"
          subtitle={
            semana.status === "concluida"
              ? "Esta semana foi concluída sem nenhum registro de consumo."
              : "Toque em “Adicionar consumo” para registrar seu primeiro uso de água nesta semana."
          }
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {semana.atividades.map((a) => {
            const def = ATIVIDADES.find((x) => x.id === a.atividadeId);
            const Icon = def?.icon || Droplet;
            return (
              <div key={a.id} style={{
                display: "flex", alignItems: "center", gap: 12, background: "#fff",
                border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: "11px 14px",
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 12, background: "#E4F2FB",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={18} color={COLORS.blue} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: COLORS.ink }}>{def?.nome}</p>
                  <p style={{ margin: "1px 0 0", fontSize: 12, color: COLORS.inkSoft }}>{a.data} · {a.hora}</p>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink, flexShrink: 0 }}>{fmtL(a.litros)}</span>
                {semana.status !== "concluida" && (
                  <button
                    onClick={() => onExcluir(semanaIdx, a.id)}
                    aria-label="Excluir registro"
                    style={{
                      width: 32, height: 32, borderRadius: 10, border: "none", background: "#FDEDED",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <Trash2 size={15} color={COLORS.alert} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Área de adicionar consumo — pontilhada, com ícone de gota, igual ao mock.
          Some quando a semana já foi concluída, já que não é mais editável. */}
      {semana.status === "concluida" ? (
        <div style={{
          border: `1.5px solid ${COLORS.line}`, borderRadius: 20, padding: "18px 18px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          marginBottom: 16, background: "#F4F8FB",
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10,
            border: `1.5px solid ${COLORS.line}`,
          }}>
            <Check size={20} color={COLORS.inkSoft} />
          </div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: COLORS.ink }}>
            Semana {semana.numero} concluída
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.5 }}>
            Esta semana já foi finalizada e não pode mais ser editada.
          </p>
        </div>
      ) : (
        <div style={{
          border: `1.5px dashed ${COLORS.blue}55`, borderRadius: 20, padding: "20px 18px",
          display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
          marginBottom: 16, background: "#fff",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%", background: "#E4F2FB",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, position: "relative",
          }}>
            <Droplet size={24} color={COLORS.blue} fill={COLORS.blue} />
            <div style={{
              position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: "50%",
              background: COLORS.blue, border: "2px solid #fff",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Plus size={12} color="#fff" strokeWidth={3} />
            </div>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: COLORS.inkSoft, lineHeight: 1.5 }}>
            Registre um novo uso de água, nesta semana.
          </p>
          <PrimaryButton onClick={onAdicionar} style={{ width: "auto", padding: "12px 22px" }}>
            <Plus size={18} /> Adicionar consumo
          </PrimaryButton>
        </div>
      )}

      {onFinalizarSemana && semana.status !== "concluida" && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={onFinalizarSemana}
            style={{
              width: "100%", textAlign: "left", border: `1.5px solid #BEE6CC`,
              background: "#EAF8EF", borderRadius: 18, padding: "16px 18px",
              display: "flex", gap: 12, alignItems: "flex-start", minHeight: 44,
              boxShadow: "0 10px 24px -10px rgba(39,174,96,0.35)",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: "50%", background: COLORS.green,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
            }}>
              <Check size={18} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15.5, color: "#1E8449" }}>Finalizar semana</p>
              <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#1E8449", lineHeight: 1.45 }}>
                Marca a Semana {semana.numero} como concluída.
              </p>
            </div>
            <ChevronRight size={18} color="#1E8449" style={{ marginTop: 8, flexShrink: 0 }} />
          </button>
        </div>
      )}

      {onFinalizarMes && semanas?.every?.((s) => s.status === "concluida" || s.numero === 4) && semana.numero === 4 && semana.atividades.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <SecondaryButton onClick={onFinalizarMes} style={{ borderColor: COLORS.green, color: COLORS.green }}>
            <Check size={16} style={{ marginRight: 6, verticalAlign: -2 }} /> Finalizar mês
          </SecondaryButton>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ pct, color }) {
  const p = clamp(pct, 0, 100);
  const cor = color || (pct >= 100 ? COLORS.alert : pct >= 80 ? "#F2994A" : COLORS.blue);
  return (
    <div style={{ height: 10, borderRadius: 6, background: "#E9F1F7", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${p}%`, background: cor, borderRadius: 6, transition: "width 0.4s ease" }} />
    </div>
  );
}

/* ============================================================================
   6. Escolher atividade (modal "Adicionar consumo")
============================================================================ */
function EscolherAtividade({ onVoltar, onEscolher, residencia }) {
  const atividadesFiltradas = ATIVIDADES.filter((a) => {
    if (a.id === "jardim" && !residencia.jardim) return false;
    if (a.id === "piscina" && !residencia.piscina) return false;
    return true;
  });
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ScreenHeader title="Adicionar consumo" onBack={onVoltar} />
      <div className="scrollnobar" style={{ flex: 1, overflowY: "auto", padding: "0 20px 24px" }}>
        <p style={{ margin: "0 0 12px", color: COLORS.inkSoft, fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          Escolha a atividade
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {atividadesFiltradas.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.id}
                onClick={() => onEscolher(a)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  background: "#fff",
                  border: `1.5px solid ${COLORS.line}`,
                  borderRadius: 16,
                  padding: "12px 16px",
                  minHeight: 64,
                  textAlign: "left",
                  width: "100%",
                  boxShadow: "0 2px 8px rgba(22,50,74,0.06)",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.blue + "66";
                  e.currentTarget.style.boxShadow = "0 4px 14px rgba(45,156,219,0.14)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = COLORS.line;
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(22,50,74,0.06)";
                }}
              >
                {/* Ícone */}
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  border: `1.5px solid ${COLORS.line}`,
                  background: "#F8FAFC",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <Icon size={26} color={COLORS.ink} strokeWidth={1.6} />
                </div>

                {/* Texto */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15.5, color: COLORS.ink, lineHeight: 1.2 }}>
                    {a.nome}
                  </p>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: COLORS.inkSoft, fontWeight: 500 }}>
                    Registrar por {a.unidade}
                  </p>
                </div>

                {/* Seta */}
                <ChevronRight size={20} color={COLORS.inkSoft} style={{ flexShrink: 0 }} />
              </button>
            );
          })}
        </div>

        {/* Card de dica — igual ao sketch */}
        <div style={{
          marginTop: 16,
          border: `1.5px solid ${COLORS.line}`,
          borderRadius: 18,
          padding: "14px 16px",
          background: "#fff",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          boxShadow: "0 2px 8px rgba(22,50,74,0.06)",
        }}>
          <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>💡</span>
          <div>
            <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 13, color: COLORS.ink }}>Dica</p>
            <p style={{ margin: 0, fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.5 }}>
              Quanto mais precisas forem as informações, mais precisa será sua estimativa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   7. Formulário de atividade
============================================================================ */
function FormAtividade({ atividade, capacidadePiscina, onVoltar, onSalvar }) {
  const [valor, setValor] = useState(atividade.valorInicial);
  const litros = calcularLitros(atividade.id, valor, capacidadePiscina);
  const isPiscina = atividade.id === "piscina";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ScreenHeader title={atividade.nome} onBack={onVoltar} />

      <div className="scrollnobar" style={{ flex: 1, overflowY: "auto", padding: "4px 20px 24px" }}>

        {/* Texto informativo */}
        <p style={{ ...SUBTITLE_STYLE, margin: "0 0 18px" }}>
          {atividade.info}
        </p>

        {/* Piscina: botões de percentual em vez do stepper */}
        {isPiscina ? (
          <>
            <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 14, color: COLORS.ink }}>
              {atividade.campo}
            </p>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  onClick={() => setValor(p)}
                  aria-label={`Preencher ${p}% da piscina`}
                  aria-pressed={valor === p}
                  style={{
                    flex: 1, padding: "14px 0", borderRadius: 14, fontWeight: 700, fontSize: 14,
                    border: valor === p ? `2px solid ${COLORS.ink}` : `1.5px solid ${COLORS.line}`,
                    background: valor === p ? COLORS.ink : "#fff",
                    color: valor === p ? "#fff" : COLORS.inkSoft,
                    transition: "all 0.15s",
                  }}
                >
                  {p}%
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Label do campo */}
            <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14, color: COLORS.ink }}>
              {atividade.campo}
            </p>

            {/* Stepper — mesmo padrão do campo de moradores */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#fff", border: `1.5px solid ${COLORS.line}`,
              borderRadius: 16, padding: "8px 8px", marginBottom: 20,
            }}>
              <button
                onClick={() => setValor((v) => clamp(v - atividade.passo, atividade.min, atividade.max))}
                aria-label="diminuir"
                style={{
                  width: 44, height: 44, borderRadius: 10, border: "none",
                  background: "#E4F2FB", display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", flexShrink: 0,
                }}
              >
                <Minus size={20} color={COLORS.blue} />
              </button>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: COLORS.ink }}>
                  {valor}
                </div>
                <div style={{ fontSize: 13, color: COLORS.inkSoft, fontWeight: 600, marginTop: 2 }}>
                  {atividade.sufixoUnidade}
                </div>
              </div>

              <button
                onClick={() => setValor((v) => clamp(v + atividade.passo, atividade.min, atividade.max))}
                aria-label="aumentar"
                style={{
                  width: 44, height: 44, borderRadius: 10, border: "none",
                  background: "#E4F2FB", display: "flex", alignItems: "center",
                  justifyContent: "center", cursor: "pointer", flexShrink: 0,
                }}
              >
                <Plus size={20} color={COLORS.blue} />
              </button>
            </div>
          </>
        )}

        {/* Card consumo estimado — com ícone de gota à esquerda */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          border: `1.5px solid ${COLORS.line}`, borderRadius: 16,
          background: "#fff", padding: "14px 16px", marginBottom: 10,
          boxShadow: "0 2px 8px rgba(22,50,74,0.06)",
        }}>
          {/* Ícone gota */}
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: `1.5px solid ${COLORS.line}`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Droplet size={26} color={COLORS.blue} fill={COLORS.blue} />
          </div>
          <div>
            <p style={{ margin: "0 0 2px", fontSize: 12.5, color: COLORS.inkSoft, fontWeight: 600 }}>
              Consumo estimado
            </p>
            <p style={{ margin: "0 0 3px", fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 700, color: COLORS.ink, lineHeight: 1.1 }}>
              {fmtL(litros)}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.inkSoft }}>
              {formatoEquacao(atividade.id, valor, capacidadePiscina)}
            </p>
          </div>
        </div>

        {/* Card dica */}
        <div style={{
          border: `1.5px solid ${COLORS.line}`, borderRadius: 18,
          background: "#fff", padding: "14px 16px", marginBottom: 8,
          boxShadow: "0 2px 8px rgba(22,50,74,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>💡</span>
            <div>
              <p style={{ margin: "0 0 3px", fontWeight: 700, fontSize: 13, color: COLORS.ink }}>
                Dica para economizar
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.5 }}>
                {atividade.dica}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Botão salvar — fixo na base */}
      <div style={{ padding: "12px 20px 28px" }}>
        <button
          onClick={() => onSalvar(valor)}
          aria-label={`Salvar ${fmtL(litros)} de consumo`}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 18,
            border: "none", background: COLORS.blue,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontWeight: 700, fontSize: 15, color: "#fff",
            boxShadow: "0 8px 20px -6px rgba(45,156,219,0.55)", cursor: "pointer",
            minHeight: 48,
          }}
        >
          <Check size={18} color="#fff" strokeWidth={2.5} />
          Salvar consumo
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   8. Registrar Conta Real
============================================================================ */
function RegistrarConta({ onVoltar, onSalvar, previstoM3, mesesRegistrados = [], mesPendente = null }) {
  const [valorPago, setValorPago] = useState("");
  const [mes, setMes] = useState(() => {
    // Prioridade: mês pendente → mês do dispositivo → primeiro disponível
    if (mesPendente) return mesPendente.mes;
    const todos = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
      "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const mesDispositivo = todos[new Date().getMonth()];
    if (!mesesRegistrados.includes(mesDispositivo)) return mesDispositivo;
    return todos.find((m) => !mesesRegistrados.includes(m)) || mesDispositivo;
  });

  const erroValor = valorPago !== "" && (+valorPago <= 0 || +valorPago > 99999);
  const mesDuplicado = mesesRegistrados.includes(mes);
  const podeSalvar = valorPago !== "" && +valorPago > 0 && !erroValor && !mesDuplicado;

  const inputStyle = {
    width: "100%", padding: "16px 16px", borderRadius: 14,
    border: `1.5px solid ${COLORS.line}`, fontSize: 15,
    fontFamily: FONT_BODY, color: COLORS.ink, background: "#fff",
    outline: "none", boxSizing: "border-box",
  };

  const labelStyle = {
    display: "flex", alignItems: "center", gap: 7,
    fontSize: 14, fontWeight: 700, color: COLORS.ink, marginBottom: 10,
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <ScreenHeader title="Registrar Conta Real" />

      <div className="scrollnobar" style={{ flex: 1, overflowY: "auto", padding: "4px 20px 24px" }}>
        <p style={SUBTITLE_STYLE}>
          Insira os dados da sua conta de água para tornar as estimativas mais precisas.
        </p>

        {/* Valor pago */}
        <div style={{ marginBottom: 24 }}>
          <p style={labelStyle}>
            <span style={{ fontSize: 16 }}>$</span> Valor Pago (R$)
          </p>
          <input
            type="number" inputMode="decimal" placeholder="Ex: 110,50"
            value={valorPago} onChange={(e) => setValorPago(e.target.value)}
            style={{ ...inputStyle, borderColor: erroValor ? COLORS.alert : COLORS.line }}
          />
          {erroValor && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.alert }}>
              Informe um valor válido (entre R$ 0,01 e R$ 99.999).
            </p>
          )}
        </div>

        {/* Mês de referência */}
        <div style={{ marginBottom: 8 }}>
          <p style={labelStyle}>
            <CalendarDays size={16} color={COLORS.ink} /> Mês de Referência
          </p>
          <div style={{ position: "relative" }}>
            <select
              value={mes} onChange={(e) => setMes(e.target.value)}
              style={{ ...inputStyle, appearance: "none", paddingRight: 40, cursor: "pointer" }}
            >
              {["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
                "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
                .map((m) => (
                  <option key={m} value={m} disabled={mesesRegistrados.includes(m)}>
                    {m}{mesesRegistrados.includes(m) ? " (já registrado)" : ""}
                  </option>
                ))}
            </select>
            <ChevronDown size={18} color={COLORS.ink} style={{
              position: "absolute", right: 14, top: "50%",
              transform: "translateY(-50%)", pointerEvents: "none",
            }} />
          </div>
          {mesDuplicado && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.alert }}>
              Este mês já foi registrado. Escolha outro mês.
            </p>
          )}
        </div>

        {previstoM3 > 0 && (
          <p style={{ fontSize: 12.5, color: COLORS.inkSoft, margin: "16px 0 0" }}>
            O consumo do mês é calculado automaticamente com base nas atividades registradas. Basta informar o valor pago na conta de água para comparar com a estimativa do aplicativo.
          </p>
        )}
      </div>

      {/* Botão salvar — estilo sketch: borda, fundo branco */}
      <div style={{ padding: "12px 20px 28px" }}>
        <button
          disabled={!podeSalvar}
          onClick={() => onSalvar({ valorPago: +String(valorPago).replace(",", "."), mes })}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 18,
            border: `1.5px solid ${podeSalvar ? COLORS.blue : COLORS.line}`,
            background: podeSalvar ? COLORS.blue : "#E9F1F7",
            fontFamily: FONT_BODY, fontSize: 16, fontWeight: 700,
            color: podeSalvar ? "#fff" : COLORS.inkSoft,
            cursor: podeSalvar ? "pointer" : "default",
            transition: "all 0.15s",
          }}
        >
          Salvar conta
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   10. Histórico e Relatórios
============================================================================ */
function Relatorios({ historico, tarifa, onRegistrarConta }) {
  const historicoSeguro = Array.isArray(historico) ? historico : [];
  const [mesAberto, setMesAberto] = useState(historicoSeguro.length > 0 ? historicoSeguro.length - 1 : -1);

  if (historicoSeguro.length === 0) {
    return (
      <div style={{ padding: "20px 20px 28px" }}>
        <h1 style={TITLE_STYLE}>Histórico e Relatórios</h1>
        <p style={SUBTITLE_STYLE}>
          Acompanhe seu histórico de consumo comparando previsões, metas e faturas reais cadastradas.
        </p>
        <EmptyState
          icon={Receipt}
          title="Nenhuma conta registrada ainda"
          subtitle="Finalize um mês e registre sua conta real para começar a comparar previsões com a realidade."
        />
        <PrimaryButton onClick={onRegistrarConta}>
          <Receipt size={18} /> Registrar conta de água
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 20px 28px" }}>
      <div style={{ marginBottom: 4 }}>
        <h1 style={TITLE_STYLE}>Histórico e Relatórios</h1>
      </div>
      <p style={SUBTITLE_STYLE}>
        Acompanhe seu histórico de consumo comparando previsões, metas e faturas reais cadastradas.
      </p>

      <Card style={{ marginBottom: 12 }}>
        <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 13.5, color: COLORS.ink, lineHeight: 1.4 }}>Consumo Mensal (Meta vs Consumido)</p>
        <BarChart
          data={historicoSeguro.map((h) => ({ mes: h?.mes ?? "—", previsto: h?.previstoL ?? 0, real: h?.realL ?? 0 }))}
          formatY={(v) => Math.round(v ?? 0) + "L"}
          formatLabel={(v) => Math.round(v ?? 0).toLocaleString("pt-BR") + " L"}
          labelPrevisto="Meta"
          labelReal="Consumido"
        />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: "0 0 12px", fontWeight: 700, fontSize: 13.5, color: COLORS.ink, lineHeight: 1.4 }}>Valor da Conta (Estimado vs Pago)</p>
        <BarChart
          data={historicoSeguro.map((h) => ({ mes: h?.mes ?? "—", previsto: h?.valorPrevisto ?? 0, real: h?.valorReal ?? null }))}
          formatY={(v) => "R$" + (v != null ? Number(v).toFixed(0) : "0")}
          formatLabel={(v) => v != null ? fmtR(Number(v)) : "—"}
          labelPrevisto="Estimado"
          labelReal="Pago"
        />
      </Card>
      <p style={{ fontWeight: 700, fontSize: 14, color: COLORS.ink, margin: "0 0 8px", letterSpacing: 0.1, textAlign: "left" }}>Linha do tempo mensal</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {historicoSeguro.map((h, i) => {
          if (!h) return null;
          const aberto = mesAberto === i;

          const previstoL = h.previstoL ?? 0;
          const realL = h.realL ?? 0;
          const valorPrevisto = h.valorPrevisto ?? 0;
          const valorReal = h.valorReal ?? null;
          const mesNome = h.mes ?? "—";
          const anoNum = h.ano ?? "";

          // Diferença percentual entre o consumo real e o previsto
          const diffPct = previstoL > 0 ? ((realL - previstoL) / previstoL) * 100 : 0;
          let status;
          if (diffPct < 0) {
            status = {
              cor: COLORS.green, bg: "#EAF8EF", emoji: "🟢",
              tituloMsg: "Você consumiu menos do que o previsto.",
              detalheMsg: "Você consumiu menos do que o previsto.",
            };
          } else if (diffPct <= 5) {
            status = {
              cor: COLORS.green, bg: "#EAF8EF", emoji: "🟢",
              tituloMsg: "Sua previsão ficou próxima da conta real.",
              detalheMsg: "Sua previsão ficou próxima da conta real.",
            };
          } else {
            status = {
              cor: COLORS.alert, bg: "#FDEBEB", emoji: "🔴",
              tituloMsg: "Seu consumo ficou acima do previsto.",
              detalheMsg: "Seu consumo ficou acima do previsto.",
            };
          }

          return (
            <div key={i} style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 18, overflow: "hidden" }}>
              <button
                onClick={() => setMesAberto(aberto ? -1 : i)}
                style={{ width: "100%", padding: "16px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", minHeight: 44 }}
              >
                <div style={{ textAlign: "left", display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: COLORS.ink, display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: status.cor, flexShrink: 0 }} />
                      {mesNome}{anoNum ? ` de ${anoNum}` : ""}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12.5, color: status.cor, fontWeight: 600 }}>
                      {h.contaRegistrada === false ? "Aguardando conta real" : status.tituloMsg}
                    </p>
                  </div>
                </div>
                <ChevronDown size={18} color={COLORS.inkSoft} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {aberto && (
                <div style={{ padding: "0 16px 18px", animation: "fadeUp 0.2s ease-out" }}>
                  <div style={{ height: 1, background: COLORS.line, marginBottom: 16 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 600, lineHeight: 1.4 }}>Meta Mensal</p>
                      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{fmtL(previstoL)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 600, lineHeight: 1.4 }}>Consumo Registrado</p>
                      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{fmtL(realL)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 600, lineHeight: 1.4 }}>Valor Estimado</p>
                      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{fmtR(valorPrevisto)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 600, lineHeight: 1.4 }}>Valor Pago</p>
                      <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 700, color: COLORS.blue }}>
                        {valorReal != null ? fmtR(valorReal) : "—"}
                      </p>
                    </div>
                  </div>
                  <div style={{ height: 1, background: COLORS.line, margin: "14px 0 12px" }} />
                  {h.contaRegistrada === false ? (
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.inkSoft }}>
                      Conta real ainda não registrada para este mês.
                    </p>
                  ) : (() => {
                    const diffL = realL - previstoL;
                    const economizou = diffL <= 0;
                    const cor = economizou ? COLORS.green : COLORS.alert;
                    const msg = economizou
                      ? `Você economizou ${fmtL(Math.abs(diffL))} neste mês.`
                      : `Você gastou ${fmtL(diffL)} a mais do que o previsto.`;
                    return (
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: COLORS.inkSoft }}>{msg}</p>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================================
   11. Configurações
============================================================================ */
function Ajustes({
  residencia, setResidencia, metaPercentual, setMetaPercentual, tarifa, setTarifa,
  consumoBaseM3, onLimparDados, showToast,
}) {
  const [editando, setEditando] = useState(false);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);

  // Rascunho local — só é aplicado de fato quando o usuário confirma o salvamento
  const [metaDraft, setMetaDraft] = useState(metaPercentual);
  const [tarifaDraft, setTarifaDraft] = useState(tarifa);
  const [tarifaTexto, setTarifaTexto] = useState(String(tarifa));
  const [residenciaDraft, setResidenciaDraft] = useState(residencia);

  const houveAlteracao = metaDraft !== metaPercentual || tarifaDraft !== tarifa;
  const houveAlteracaoResidencia =
    residenciaDraft.moradores !== residencia.moradores ||
    residenciaDraft.jardim !== residencia.jardim ||
    residenciaDraft.piscina !== residencia.piscina ||
    (residenciaDraft.piscina && residenciaDraft.capacidadePiscina !== residencia.capacidadePiscina);
  const novoConsumoAlvoL = Math.round(consumoBaseM3 * 1000 * (1 - metaDraft / 100));
  const economiaPrevistaL = Math.round(consumoBaseM3 * 1000) - novoConsumoAlvoL;

  function salvarAlteracoes() {
    setMetaPercentual(metaDraft);
    setTarifa(tarifaDraft);
    showToast && showToast("Alterações salvas com sucesso!");
  }

  function descartarAlteracoes() {
    setMetaDraft(metaPercentual);
    setTarifaDraft(tarifa);
    setTarifaTexto(String(tarifa));
  }

  function salvarResidencia() {
    setResidencia(residenciaDraft);
    showToast && showToast("Dados da residência atualizados!");
  }

  function descartarResidencia() {
    setResidenciaDraft(residencia);
  }

  return (
    <div style={{ padding: "20px 20px 28px" }}>
      <h1 style={TITLE_STYLE}>Configurações e ajustes</h1>
      <p style={SUBTITLE_STYLE}>Ajuste suas metas, tarifa e dados da residência.</p>

      <SectionTitle>Metas de economia</SectionTitle>
      <Card style={{ marginBottom: 14 }}>
        <p id="meta-economia-label" style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14, color: COLORS.ink }}>Quanto você quer economizar?</p>
        <p id="meta-economia-desc" style={{ margin: "0 0 14px", fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.6 }}>
          Defina quanto deseja reduzir do seu consumo mensal em relação ao consumo estimado da sua residência, isso não altera o consumo da casa, apenas a meta que o app usa para acompanhar seu progresso.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <input
            type="range" min={5} max={30} step={1} value={metaDraft}
            onChange={(e) => setMetaDraft(+e.target.value)}
            aria-labelledby="meta-economia-label"
            aria-describedby="meta-economia-desc"
            aria-valuetext={`${metaDraft}% de economia`}
            aria-valuenow={metaDraft}
            aria-valuemin={5}
            aria-valuemax={30}
            style={{ flex: 1, height: 44, accentColor: COLORS.blue }}
          />
          <span aria-hidden="true" style={{ fontWeight: 700, fontSize: 16, color: COLORS.blue, minWidth: 44, textAlign: "right" }}>{metaDraft}%</span>
        </div>

        <div style={{ padding: "14px 16px", background: "#E4F2FB", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 700 }}>META MENSAL</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "2px 0 0", color: COLORS.green, fontWeight: 700 }}>{fmtL(novoConsumoAlvoL)}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11.5, color: COLORS.inkSoft, fontWeight: 700 }}>ECONOMIA PREVISTA</p>
            <p style={{ fontFamily: FONT_DISPLAY, fontSize: 22, margin: "2px 0 0", color: COLORS.blue, fontWeight: 700 }}>{fmtL(economiaPrevistaL)} ({metaDraft}%)</p>
          </div>
        </div>
      </Card>

      <SectionTitle>Tarifa da água</SectionTitle>
      <Card style={{ marginBottom: houveAlteracao ? 12 : 18 }}>
        <p id="tarifa-label" style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 14, color: COLORS.ink }}>Tarifa da água</p>
        <p id="tarifa-desc" style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.6 }}>
          Informe o valor cobrado pela concessionária por metro cúbico (m³). Essa informação pode ser encontrada na sua conta de água e será utilizada para estimar o valor da fatura.
        </p>
        <label htmlFor="tarifa-input" style={{ display: "none" }}>Tarifa da água por metro cúbico, em reais</label>
        <div style={{ display: "flex", alignItems: "center", background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 14, overflow: "hidden" }}>
          <span aria-hidden="true" style={{ padding: "0 14px", fontWeight: 700, fontSize: 15, color: COLORS.inkSoft, borderRight: `1.5px solid ${COLORS.line}`, alignSelf: "stretch", display: "flex", alignItems: "center" }}>R$</span>
          <input
            id="tarifa-input"
            type="number" step="0.01" inputMode="decimal" placeholder="Ex.: 8,50"
            value={tarifaTexto}
            aria-label="Tarifa da água por metro cúbico, em reais"
            aria-describedby="tarifa-desc"
            onChange={(e) => {
              const texto = e.target.value;
              setTarifaTexto(texto);
              setTarifaDraft(texto === "" ? 0 : (+texto || 0));
            }}
            style={{ flex: 1, padding: "14px 14px", border: "none", outline: "none", fontSize: 16, fontWeight: 700, minHeight: 44, background: "transparent", color: COLORS.ink }}
          />
        </div>
      </Card>

      {houveAlteracao && (
        <div
          role="status" aria-live="polite"
          style={{
          marginBottom: 18, padding: "16px 18px", borderRadius: 18,
          background: "#FFF8E6", border: "1.5px solid #F5E0A3",
          display: "flex", flexDirection: "column", gap: 14,
          animation: "fadeUp 0.2s ease-out",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>Deseja salvar as alterações?</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: COLORS.inkSoft }}>Você modificou a meta de economia ou a tarifa.</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <button
              onClick={descartarAlteracoes}
              aria-label="Descartar alterações da meta e tarifa"
              style={{
                padding: "10px 16px", borderRadius: 12, border: `1.5px solid ${COLORS.line}`,
                background: "#fff", color: COLORS.inkSoft, fontWeight: 700, fontSize: 13.5, minHeight: 40,
              }}
            >
              Não
            </button>
            <button
              onClick={salvarAlteracoes}
              aria-label="Salvar alterações da meta e tarifa"
              style={{
                padding: "10px 16px", borderRadius: 12, border: "none",
                background: COLORS.green, color: "#fff", fontWeight: 700, fontSize: 13.5, minHeight: 40,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Check size={15} /> Sim, salvar
            </button>
          </div>
        </div>
      )}

      <SectionTitle>Dados da residência</SectionTitle>
      <Card style={{ marginBottom: houveAlteracaoResidencia ? 12 : 18 }}>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.55 }}>Modifique os dados do seu cadastro inicial.</p>
        <button
          onClick={() => setEditando((v) => !v)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%",
            background: "none", border: "none", padding: "8px 0", minHeight: 44,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 14, color: COLORS.blue, display: "flex", alignItems: "center", gap: 6 }}>
            <Edit3 size={15} /> Editar dados da residência
          </span>
          <ChevronDown size={18} color={COLORS.blue} style={{ transform: editando ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>

        {editando && (
          <div style={{ marginTop: 16, animation: "fadeUp 0.2s ease-out" }}>
            <Field label="Quantidade de moradores">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1.5px solid ${COLORS.line}`, borderRadius: 16, padding: "8px 8px" }}>
                <Stepper onClick={() => setResidenciaDraft((r) => ({ ...r, moradores: Math.max(1, r.moradores - 1) }))} icon={Minus} label="Diminuir moradores" />
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 20, fontWeight: 700 }}>{residenciaDraft.moradores}</span>
                <Stepper onClick={() => setResidenciaDraft((r) => ({ ...r, moradores: Math.min(12, r.moradores + 1) }))} icon={Plus} label="Aumentar moradores" />
              </div>
            </Field>
            <Field label="Possui jardim?">
              <Toggle value={residenciaDraft.jardim} onChange={(v) => setResidenciaDraft((r) => ({ ...r, jardim: v }))} />
            </Field>
            <Field label="Possui piscina?" style={{ marginBottom: residenciaDraft.piscina ? 24 : 0 }}>
              <Toggle value={residenciaDraft.piscina} onChange={(v) => setResidenciaDraft((r) => ({ ...r, piscina: v }))} />
            </Field>

            {residenciaDraft.piscina && (
              <Field label="Qual a capacidade da piscina?" style={{ marginBottom: 0, animation: "fadeUp 0.25s ease-out" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number"
                    min={100}
                    max={500000}
                    value={residenciaDraft.capacidadePiscina || ""}
                    placeholder="Ex: 5000"
                    onChange={(e) => {
                      const v = +e.target.value || 0;
                      setResidenciaDraft((r) => ({ ...r, capacidadePiscina: Math.max(0, v) }));
                    }}
                    style={{
                      flex: 1, padding: "14px 16px", borderRadius: 14, border: `1.5px solid ${COLORS.line}`,
                      fontSize: 16, fontWeight: 600, color: COLORS.ink, minHeight: 44, background: "#fff",
                    }}
                  />
                  <span style={{ color: COLORS.inkSoft, fontWeight: 600, fontSize: 15 }}>litros</span>
                </div>
                {residenciaDraft.capacidadePiscina > 0 && residenciaDraft.capacidadePiscina < 100 && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.alert }}>
                    Valor muito baixo. Uma piscina comum tem pelo menos 100 litros.
                  </p>
                )}
                {residenciaDraft.capacidadePiscina > 200000 && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.alert }}>
                    Valor muito alto. Verifique a capacidade informada.
                  </p>
                )}
              </Field>
            )}
          </div>
        )}
      </Card>

      {houveAlteracaoResidencia && (
        <div style={{
          marginBottom: 18, padding: "16px 18px", borderRadius: 18,
          background: "#FFF8E6", border: "1.5px solid #F5E0A3",
          display: "flex", flexDirection: "column", gap: 14,
          animation: "fadeUp 0.2s ease-out",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: COLORS.ink }}>Deseja alterar os dados da residência?</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: COLORS.inkSoft }}>Isso vai atualizar suas metas e atividades disponíveis.</p>
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
            <button
              onClick={descartarResidencia}
              style={{
                padding: "10px 16px", borderRadius: 12, border: `1.5px solid ${COLORS.line}`,
                background: "#fff", color: COLORS.inkSoft, fontWeight: 700, fontSize: 13.5, minHeight: 40,
              }}
            >
              Não
            </button>
            <button
              onClick={salvarResidencia}
              style={{
                padding: "10px 16px", borderRadius: 12, border: "none",
                background: COLORS.green, color: "#fff", fontWeight: 700, fontSize: 13.5, minHeight: 40,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <Check size={15} /> Sim, salvar
            </button>
          </div>
        </div>
      )}

      <SectionTitle>Gerenciar dados</SectionTitle>
      <Card style={{ borderColor: "#FBD7D7" }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14, color: COLORS.ink, lineHeight: 1.4 }}>Deseja limpar todos os dados?</p>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: COLORS.inkSoft, lineHeight: 1.6 }}>
          Isso apagará permanentemente todo o histórico e dados locais cadastrados.
        </p>

        {!confirmarLimpeza ? (
          <SecondaryButton
            onClick={() => setConfirmarLimpeza(true)}
            style={{
              color: COLORS.alert, borderColor: "#FBD7D7",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <Trash2 size={15} /> Limpar todos os dados
          </SecondaryButton>
        ) : (
          <div style={{
            padding: "14px 16px", borderRadius: 14,
            background: "#FDECEC", border: "1.5px solid #FBD7D7",
            animation: "fadeUp 0.2s ease-out",
          }}>
            <p style={{ margin: "0 0 10px", fontSize: 13.5, fontWeight: 700, color: COLORS.ink, lineHeight: 1.4 }}>
              Tem certeza? Essa ação não pode ser desfeita.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setConfirmarLimpeza(false)}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 12, border: `1.5px solid ${COLORS.line}`,
                  background: "#fff", color: COLORS.inkSoft, fontWeight: 700, fontSize: 13.5, minHeight: 44,
                }}
              >
                Não
              </button>
              <button
                onClick={() => { onLimparDados(); setConfirmarLimpeza(false); }}
                style={{
                  flex: 1, padding: "12px 0", borderRadius: 12, border: "none",
                  background: COLORS.alert, color: "#fff", fontWeight: 700, fontSize: 13.5, minHeight: 44,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                <Trash2 size={15} /> Sim, limpar
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={SECTION_LABEL_STYLE}>
      {children}
    </p>
  );
}
