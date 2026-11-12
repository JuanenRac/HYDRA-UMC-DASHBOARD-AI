// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Texts of the Fleet card and of the language-model label in eight languages: aiTexts.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// en, es, de, fr, it, ja, zh and pt (European Portuguese). Same language choice as i18n.ts.

import type { Lang } from './i18n'

export const AI_KEYS = [
  'fleetTitle', 'fleetSubtitle', 'fleetRefresh', 'fleetLoading', 'fleetEmpty', 'colSeries', 'colScore', 'colDrift', 'colState', 'colUpdated',
  'stateNormal', 'stateAnomalous', 'stateDrifted', 'stateSustained', 'stateNoData', 'proposalSent', 'driftLimit', 'proposeNote', 'skippedRows',
  'fleetErrOff', 'fleetErrAuth', 'fleetErrTimeout', 'fleetErrUnreachable', 'fleetErrHttp', 'fleetErrInvalid',
  'badgeAi', 'badgeFallback', 'reasonUnavailable', 'reasonUnverified',
  'forecastLine', 'forecastNone',
] as const
export type AiKey = (typeof AI_KEYS)[number]
type Dict = Record<AiKey, string>

const en: Dict = {
  fleetTitle: 'Fleet', fleetSubtitle: 'The last anomaly score and the drift of every series the detector follows.',
  fleetRefresh: 'Refresh', fleetLoading: 'Loading…', fleetEmpty: 'The detector follows no series.',
  colSeries: 'Series', colScore: 'Last score', colDrift: 'Drift', colState: 'State', colUpdated: 'Updated',
  stateNormal: 'Normal', stateAnomalous: 'Anomalous', stateDrifted: 'Drifting', stateSustained: 'Sustained drift', stateNoData: 'No data yet',
  proposalSent: 'Maintenance proposed ({n})', driftLimit: 'Drift counts from {ratio} times the healthy reference.',
  proposeNote: 'A sustained drift only proposes a maintenance order; a person approves it.',
  skippedRows: '{n} rows of the answer could not be read.',
  fleetErrOff: 'The detector has the fleet view switched off.', fleetErrAuth: 'The session was refused. Sign in again in STUDIO.',
  fleetErrTimeout: 'The detector did not answer in time.', fleetErrUnreachable: 'The detector cannot be reached.',
  fleetErrHttp: 'The detector answered with an error ({status}).', fleetErrInvalid: 'The detector sent an answer that cannot be used.',
  badgeAi: 'AI, numbers checked', badgeFallback: 'Statistical fallback',
  reasonUnavailable: 'The language model did not answer: this is the statistical sentence.',
  reasonUnverified: 'The language model wrote a number that is not in the summary: this is the statistical sentence.',
  forecastLine: 'Forecast in {minutes} min: {value} (range {low} to {high}, from {n} samples).',
  forecastNone: 'Not enough steady data in this window to forecast.',
}

const es: Dict = {
  fleetTitle: 'Flota', fleetSubtitle: 'La última puntuación de anomalía y la deriva de cada serie que sigue el detector.',
  fleetRefresh: 'Actualizar', fleetLoading: 'Cargando…', fleetEmpty: 'El detector no sigue ninguna serie.',
  colSeries: 'Serie', colScore: 'Última puntuación', colDrift: 'Deriva', colState: 'Estado', colUpdated: 'Actualizado',
  stateNormal: 'Normal', stateAnomalous: 'Anómala', stateDrifted: 'Con deriva', stateSustained: 'Deriva sostenida', stateNoData: 'Aún sin datos',
  proposalSent: 'Mantenimiento propuesto ({n})', driftLimit: 'Se considera deriva desde {ratio} veces la referencia sana.',
  proposeNote: 'Una deriva sostenida solo propone una orden de mantenimiento; la aprueba una persona.',
  skippedRows: 'No se pudieron leer {n} filas de la respuesta.',
  fleetErrOff: 'El detector tiene la vista de flota desactivada.', fleetErrAuth: 'Se rechazó la sesión. Inicia sesión de nuevo en STUDIO.',
  fleetErrTimeout: 'El detector no respondió a tiempo.', fleetErrUnreachable: 'No se puede contactar con el detector.',
  fleetErrHttp: 'El detector respondió con un error ({status}).', fleetErrInvalid: 'El detector envió una respuesta que no se puede usar.',
  badgeAi: 'IA, números comprobados', badgeFallback: 'Alternativa estadística',
  reasonUnavailable: 'El modelo de lenguaje no respondió: esta es la frase estadística.',
  reasonUnverified: 'El modelo de lenguaje escribió un número que no está en el resumen: esta es la frase estadística.',
  forecastLine: 'Previsión a {minutes} min: {value} (rango de {low} a {high}, con {n} muestras).',
  forecastNone: 'No hay datos estables suficientes en esta ventana para prever.',
}

const de: Dict = {
  fleetTitle: 'Flotte', fleetSubtitle: 'Die letzte Anomalie-Bewertung und die Drift jeder Reihe, die der Detektor verfolgt.',
  fleetRefresh: 'Aktualisieren', fleetLoading: 'Wird geladen…', fleetEmpty: 'Der Detektor verfolgt keine Reihe.',
  colSeries: 'Reihe', colScore: 'Letzte Bewertung', colDrift: 'Drift', colState: 'Zustand', colUpdated: 'Aktualisiert',
  stateNormal: 'Normal', stateAnomalous: 'Auffällig', stateDrifted: 'Driftet', stateSustained: 'Anhaltende Drift', stateNoData: 'Noch keine Daten',
  proposalSent: 'Wartung vorgeschlagen ({n})', driftLimit: 'Als Drift gilt ab dem {ratio}-Fachen der gesunden Referenz.',
  proposeNote: 'Eine anhaltende Drift schlägt nur einen Wartungsauftrag vor; eine Person genehmigt ihn.',
  skippedRows: '{n} Zeilen der Antwort konnten nicht gelesen werden.',
  fleetErrOff: 'Beim Detektor ist die Flottenansicht ausgeschaltet.', fleetErrAuth: 'Die Sitzung wurde abgelehnt. Melden Sie sich in STUDIO erneut an.',
  fleetErrTimeout: 'Der Detektor hat nicht rechtzeitig geantwortet.', fleetErrUnreachable: 'Der Detektor ist nicht erreichbar.',
  fleetErrHttp: 'Der Detektor antwortete mit einem Fehler ({status}).', fleetErrInvalid: 'Der Detektor hat eine unbrauchbare Antwort geschickt.',
  badgeAi: 'KI, Zahlen geprüft', badgeFallback: 'Statistischer Ersatz',
  reasonUnavailable: 'Das Sprachmodell hat nicht geantwortet: Dies ist der statistische Satz.',
  reasonUnverified: 'Das Sprachmodell hat eine Zahl geschrieben, die nicht in der Zusammenfassung steht: Dies ist der statistische Satz.',
  forecastLine: 'Prognose in {minutes} Min.: {value} (Bereich {low} bis {high}, aus {n} Messwerten).',
  forecastNone: 'In diesem Fenster gibt es nicht genug stabile Daten für eine Prognose.',
}

const fr: Dict = {
  fleetTitle: 'Flotte', fleetSubtitle: 'Le dernier score d’anomalie et la dérive de chaque série suivie par le détecteur.',
  fleetRefresh: 'Actualiser', fleetLoading: 'Chargement…', fleetEmpty: 'Le détecteur ne suit aucune série.',
  colSeries: 'Série', colScore: 'Dernier score', colDrift: 'Dérive', colState: 'État', colUpdated: 'Mis à jour',
  stateNormal: 'Normal', stateAnomalous: 'Anormal', stateDrifted: 'En dérive', stateSustained: 'Dérive soutenue', stateNoData: 'Pas encore de données',
  proposalSent: 'Maintenance proposée ({n})', driftLimit: 'On parle de dérive à partir de {ratio} fois la référence saine.',
  proposeNote: 'Une dérive soutenue ne fait que proposer un ordre de maintenance ; une personne l’approuve.',
  skippedRows: '{n} lignes de la réponse n’ont pas pu être lues.',
  fleetErrOff: 'Le détecteur a la vue de flotte désactivée.', fleetErrAuth: 'La session a été refusée. Reconnectez-vous dans STUDIO.',
  fleetErrTimeout: 'Le détecteur n’a pas répondu à temps.', fleetErrUnreachable: 'Le détecteur est injoignable.',
  fleetErrHttp: 'Le détecteur a répondu par une erreur ({status}).', fleetErrInvalid: 'Le détecteur a envoyé une réponse inutilisable.',
  badgeAi: 'IA, chiffres vérifiés', badgeFallback: 'Repli statistique',
  reasonUnavailable: 'Le modèle de langage n’a pas répondu : voici la phrase statistique.',
  reasonUnverified: 'Le modèle de langage a écrit un nombre absent du résumé : voici la phrase statistique.',
  forecastLine: 'Prévision dans {minutes} min : {value} (plage de {low} à {high}, d’après {n} échantillons).',
  forecastNone: 'Pas assez de données stables dans cette fenêtre pour prévoir.',
}

const it: Dict = {
  fleetTitle: 'Flotta', fleetSubtitle: 'L’ultimo punteggio di anomalia e la deriva di ogni serie seguita dal rilevatore.',
  fleetRefresh: 'Aggiorna', fleetLoading: 'Caricamento…', fleetEmpty: 'Il rilevatore non segue nessuna serie.',
  colSeries: 'Serie', colScore: 'Ultimo punteggio', colDrift: 'Deriva', colState: 'Stato', colUpdated: 'Aggiornato',
  stateNormal: 'Normale', stateAnomalous: 'Anomala', stateDrifted: 'In deriva', stateSustained: 'Deriva prolungata', stateNoData: 'Ancora nessun dato',
  proposalSent: 'Manutenzione proposta ({n})', driftLimit: 'Si parla di deriva da {ratio} volte il riferimento sano.',
  proposeNote: 'Una deriva prolungata propone soltanto un ordine di manutenzione; lo approva una persona.',
  skippedRows: 'Non è stato possibile leggere {n} righe della risposta.',
  fleetErrOff: 'Il rilevatore ha la vista della flotta disattivata.', fleetErrAuth: 'La sessione è stata rifiutata. Accedi di nuovo in STUDIO.',
  fleetErrTimeout: 'Il rilevatore non ha risposto in tempo.', fleetErrUnreachable: 'Il rilevatore non è raggiungibile.',
  fleetErrHttp: 'Il rilevatore ha risposto con un errore ({status}).', fleetErrInvalid: 'Il rilevatore ha inviato una risposta inutilizzabile.',
  badgeAi: 'IA, numeri verificati', badgeFallback: 'Ripiego statistico',
  reasonUnavailable: 'Il modello linguistico non ha risposto: questa è la frase statistica.',
  reasonUnverified: 'Il modello linguistico ha scritto un numero che non è nel riepilogo: questa è la frase statistica.',
  forecastLine: 'Previsione tra {minutes} min: {value} (intervallo da {low} a {high}, da {n} campioni).',
  forecastNone: 'In questa finestra non ci sono dati stabili a sufficienza per prevedere.',
}

const ja: Dict = {
  fleetTitle: 'フリート', fleetSubtitle: '検出器が追跡している各系列の最新の異常スコアとドリフト。',
  fleetRefresh: '更新', fleetLoading: '読み込み中…', fleetEmpty: '検出器は系列を追跡していません。',
  colSeries: '系列', colScore: '最新スコア', colDrift: 'ドリフト', colState: '状態', colUpdated: '更新',
  stateNormal: '正常', stateAnomalous: '異常', stateDrifted: 'ドリフト中', stateSustained: '持続的なドリフト', stateNoData: 'まだデータなし',
  proposalSent: '保守を提案済み（{n}）', driftLimit: '正常時の基準の{ratio}倍以上をドリフトとみなします。',
  proposeNote: '持続的なドリフトは保守指示を提案するだけで、承認は人が行います。',
  skippedRows: '応答の{n}行を読み取れませんでした。',
  fleetErrOff: '検出器でフリート表示がオフになっています。', fleetErrAuth: 'セッションが拒否されました。STUDIOで再度サインインしてください。',
  fleetErrTimeout: '検出器が時間内に応答しませんでした。', fleetErrUnreachable: '検出器に接続できません。',
  fleetErrHttp: '検出器がエラーを返しました（{status}）。', fleetErrInvalid: '検出器が使用できない応答を返しました。',
  badgeAi: 'AI・数値確認済み', badgeFallback: '統計による代替',
  reasonUnavailable: '言語モデルが応答しませんでした。統計による文を表示しています。',
  reasonUnverified: '言語モデルが要約にない数値を書きました。統計による文を表示しています。',
  forecastLine: '{minutes}分後の予測：{value}（範囲 {low}～{high}、{n}件のサンプルから）。',
  forecastNone: 'この期間には予測に足りる安定したデータがありません。',
}

const zh: Dict = {
  fleetTitle: '机群', fleetSubtitle: '检测器所跟踪的每个序列的最新异常分数和漂移。',
  fleetRefresh: '刷新', fleetLoading: '加载中…', fleetEmpty: '检测器没有跟踪任何序列。',
  colSeries: '序列', colScore: '最新分数', colDrift: '漂移', colState: '状态', colUpdated: '更新时间',
  stateNormal: '正常', stateAnomalous: '异常', stateDrifted: '正在漂移', stateSustained: '持续漂移', stateNoData: '暂无数据',
  proposalSent: '已建议维护（{n}）', driftLimit: '达到健康基准的 {ratio} 倍即视为漂移。',
  proposeNote: '持续漂移只会建议一个维护工单，由人来批准。',
  skippedRows: '响应中有 {n} 行无法读取。',
  fleetErrOff: '检测器已关闭机群视图。', fleetErrAuth: '会话被拒绝，请在 STUDIO 中重新登录。',
  fleetErrTimeout: '检测器未能及时响应。', fleetErrUnreachable: '无法连接到检测器。',
  fleetErrHttp: '检测器返回了错误（{status}）。', fleetErrInvalid: '检测器返回了无法使用的响应。',
  badgeAi: 'AI，数字已核对', badgeFallback: '统计替代',
  reasonUnavailable: '语言模型没有响应：显示的是统计句子。',
  reasonUnverified: '语言模型写出了摘要中没有的数字：显示的是统计句子。',
  forecastLine: '{minutes} 分钟后的预测：{value}（范围 {low} 至 {high}，基于 {n} 个样本）。',
  forecastNone: '此时间窗口内没有足够的稳定数据用于预测。',
}

const pt: Dict = {
  fleetTitle: 'Frota', fleetSubtitle: 'A última pontuação de anomalia e o desvio de cada série que o detetor acompanha.',
  fleetRefresh: 'Atualizar', fleetLoading: 'A carregar…', fleetEmpty: 'O detetor não acompanha nenhuma série.',
  colSeries: 'Série', colScore: 'Última pontuação', colDrift: 'Desvio', colState: 'Estado', colUpdated: 'Atualizado',
  stateNormal: 'Normal', stateAnomalous: 'Anómala', stateDrifted: 'Em desvio', stateSustained: 'Desvio prolongado', stateNoData: 'Ainda sem dados',
  proposalSent: 'Manutenção proposta ({n})', driftLimit: 'Conta como desvio a partir de {ratio} vezes a referência saudável.',
  proposeNote: 'Um desvio prolongado apenas propõe uma ordem de manutenção; uma pessoa aprova-a.',
  skippedRows: 'Não foi possível ler {n} linhas da resposta.',
  fleetErrOff: 'O detetor tem a vista de frota desligada.', fleetErrAuth: 'A sessão foi recusada. Inicie sessão novamente no STUDIO.',
  fleetErrTimeout: 'O detetor não respondeu a tempo.', fleetErrUnreachable: 'Não é possível contactar o detetor.',
  fleetErrHttp: 'O detetor respondeu com um erro ({status}).', fleetErrInvalid: 'O detetor enviou uma resposta que não se pode usar.',
  badgeAi: 'IA, números verificados', badgeFallback: 'Alternativa estatística',
  reasonUnavailable: 'O modelo de linguagem não respondeu: esta é a frase estatística.',
  reasonUnverified: 'O modelo de linguagem escreveu um número que não está no resumo: esta é a frase estatística.',
  forecastLine: 'Previsão daqui a {minutes} min: {value} (intervalo de {low} a {high}, com {n} amostras).',
  forecastNone: 'Não há dados estáveis suficientes nesta janela para prever.',
}

export const AI_TEXTS: Record<Lang, Dict> = { en, es, de, fr, it, ja, zh, pt }

export function at(lang: Lang, key: AiKey, params: Record<string, string | number> = {}): string {
  return AI_TEXTS[lang][key].replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m))
}
