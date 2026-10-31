// =============================================================================
// HYDRA-UMC-DASHBOARD-AI - Texts of the remaining-useful-life card in eight languages: i18n.ts
// Copyright (C) 2026 JuanenRac (Electro Hobby 3D) <electrohobby3d@gmail.com>
// GPL-3.0-or-later - see LICENSE
// =============================================================================
// en, es, de, fr, it, ja, zh and pt (European Portuguese). The language is the one of the browser; an unknown one is English.

export const LANGUAGES = ['en', 'es', 'de', 'fr', 'it', 'ja', 'zh', 'pt'] as const
export type Lang = (typeof LANGUAGES)[number]

export const RUL_KEYS = [
  'title', 'subtitle', 'source', 'kind', 'field', 'limit', 'refresh', 'loading', 'estimate', 'range', 'rangeOpen',
  'slope', 'current', 'samples', 'chart', 'disclaimer', 'statusInsufficient', 'statusNotRising', 'statusLimitReached',
  'warning', 'critical', 'noSamples', 'errTimeout', 'errUnreachable', 'errDisabled', 'errAuth', 'errHttp', 'errInvalid', 'errInput',
] as const
export type RulKey = (typeof RUL_KEYS)[number]
type Dict = Record<RulKey, string>

const en: Dict = {
  title: 'Remaining useful life',
  subtitle: "Days until the trend of one source's anomaly scores reaches the limit, as estimated by HYDRA-UMC-ANOMALY-DETECTOR.",
  source: 'Source ID', kind: 'Kind', field: 'Field', limit: 'Limit (score)',
  refresh: 'Estimate', loading: 'Estimating…',
  estimate: 'About {days} days left',
  range: 'Likely between {low} and {high} days',
  rangeOpen: 'At the earliest in {low} days; the gentlest plausible trend does not rise',
  slope: 'Trend: {slope} per day', current: 'Current value of the trend: {value}', samples: '{n} score samples used',
  chart: 'Anomaly score', disclaimer: 'An estimate of a trend, not a promise.',
  statusInsufficient: 'Not enough data yet to estimate ({n} samples).',
  statusNotRising: 'The trend does not rise: no limit is approaching.',
  statusLimitReached: 'The trend has already reached the limit.',
  warning: 'Warning: the limit may be reached within {days} days.',
  critical: 'Critical: the limit may be reached within {days} days.',
  noSamples: 'The data lake holds no score samples for this source.',
  errTimeout: 'The detector did not answer in time.',
  errUnreachable: 'The detector or the data lake cannot be reached.',
  errDisabled: 'The detector has the remaining-useful-life route switched off (--rul).',
  errAuth: 'The session was refused. Sign in again in STUDIO.',
  errHttp: 'The service answered with an error: {detail}',
  errInvalid: 'The detector sent an answer that cannot be used.',
  errInput: 'The configuration of this card is not valid: {detail}',
}

const es: Dict = {
  title: 'Vida útil restante',
  subtitle: 'Días hasta que la tendencia de las puntuaciones de anomalía de una fuente alcance el límite, según HYDRA-UMC-ANOMALY-DETECTOR.',
  source: 'ID de fuente', kind: 'Tipo', field: 'Campo', limit: 'Límite (puntuación)',
  refresh: 'Estimar', loading: 'Estimando…',
  estimate: 'Quedan unos {days} días',
  range: 'Probablemente entre {low} y {high} días',
  rangeOpen: 'Como pronto en {low} días; la tendencia plausible más suave no sube',
  slope: 'Tendencia: {slope} por día', current: 'Valor actual de la tendencia: {value}', samples: '{n} muestras de puntuación usadas',
  chart: 'Puntuación de anomalía', disclaimer: 'Una estimación de una tendencia, no una promesa.',
  statusInsufficient: 'Aún no hay datos suficientes para estimar ({n} muestras).',
  statusNotRising: 'La tendencia no sube: no se acerca ningún límite.',
  statusLimitReached: 'La tendencia ya ha alcanzado el límite.',
  warning: 'Aviso: el límite podría alcanzarse en {days} días.',
  critical: 'Crítico: el límite podría alcanzarse en {days} días.',
  noSamples: 'El data lake no tiene muestras de puntuación de esta fuente.',
  errTimeout: 'El detector no respondió a tiempo.',
  errUnreachable: 'No se puede contactar con el detector o con el data lake.',
  errDisabled: 'El detector tiene desactivada la ruta de vida útil restante (--rul).',
  errAuth: 'Se rechazó la sesión. Vuelve a iniciar sesión en STUDIO.',
  errHttp: 'El servicio respondió con un error: {detail}',
  errInvalid: 'El detector envió una respuesta que no se puede usar.',
  errInput: 'La configuración de esta tarjeta no es válida: {detail}',
}

const de: Dict = {
  title: 'Restnutzungsdauer',
  subtitle: 'Tage, bis der Trend der Anomalie-Werte einer Quelle den Grenzwert erreicht, geschätzt von HYDRA-UMC-ANOMALY-DETECTOR.',
  source: 'Quellen-ID', kind: 'Art', field: 'Feld', limit: 'Grenzwert (Score)',
  refresh: 'Schätzen', loading: 'Schätze…',
  estimate: 'Noch etwa {days} Tage',
  range: 'Wahrscheinlich zwischen {low} und {high} Tagen',
  rangeOpen: 'Frühestens in {low} Tagen; der mildeste plausible Trend steigt nicht',
  slope: 'Trend: {slope} pro Tag', current: 'Aktueller Wert des Trends: {value}', samples: '{n} Score-Proben verwendet',
  chart: 'Anomalie-Score', disclaimer: 'Eine Schätzung eines Trends, kein Versprechen.',
  statusInsufficient: 'Noch zu wenige Daten für eine Schätzung ({n} Proben).',
  statusNotRising: 'Der Trend steigt nicht: Kein Grenzwert rückt näher.',
  statusLimitReached: 'Der Trend hat den Grenzwert bereits erreicht.',
  warning: 'Warnung: Der Grenzwert könnte innerhalb von {days} Tagen erreicht werden.',
  critical: 'Kritisch: Der Grenzwert könnte innerhalb von {days} Tagen erreicht werden.',
  noSamples: 'Der Data Lake enthält keine Score-Proben für diese Quelle.',
  errTimeout: 'Der Detektor hat nicht rechtzeitig geantwortet.',
  errUnreachable: 'Der Detektor oder der Data Lake ist nicht erreichbar.',
  errDisabled: 'Beim Detektor ist die Route für die Restnutzungsdauer ausgeschaltet (--rul).',
  errAuth: 'Die Sitzung wurde abgelehnt. Melden Sie sich in STUDIO erneut an.',
  errHttp: 'Der Dienst hat mit einem Fehler geantwortet: {detail}',
  errInvalid: 'Der Detektor hat eine unbrauchbare Antwort gesendet.',
  errInput: 'Die Konfiguration dieser Karte ist ungültig: {detail}',
}

const fr: Dict = {
  title: 'Durée de vie restante',
  subtitle: "Jours avant que la tendance des scores d'anomalie d'une source atteigne la limite, estimés par HYDRA-UMC-ANOMALY-DETECTOR.",
  source: 'ID de source', kind: 'Type', field: 'Champ', limit: 'Limite (score)',
  refresh: 'Estimer', loading: 'Estimation…',
  estimate: 'Environ {days} jours restants',
  range: 'Probablement entre {low} et {high} jours',
  rangeOpen: 'Au plus tôt dans {low} jours ; la tendance plausible la plus douce ne monte pas',
  slope: 'Tendance : {slope} par jour', current: 'Valeur actuelle de la tendance : {value}', samples: '{n} échantillons de score utilisés',
  chart: "Score d'anomalie", disclaimer: "Une estimation d'une tendance, pas une promesse.",
  statusInsufficient: 'Pas encore assez de données pour estimer ({n} échantillons).',
  statusNotRising: "La tendance ne monte pas : aucune limite ne s'approche.",
  statusLimitReached: 'La tendance a déjà atteint la limite.',
  warning: "Avertissement : la limite pourrait être atteinte d'ici {days} jours.",
  critical: "Critique : la limite pourrait être atteinte d'ici {days} jours.",
  noSamples: 'Le data lake ne contient aucun échantillon de score pour cette source.',
  errTimeout: "Le détecteur n'a pas répondu à temps.",
  errUnreachable: 'Le détecteur ou le data lake est injoignable.',
  errDisabled: 'Le détecteur a désactivé la route de durée de vie restante (--rul).',
  errAuth: 'La session a été refusée. Reconnectez-vous dans STUDIO.',
  errHttp: 'Le service a répondu par une erreur : {detail}',
  errInvalid: 'Le détecteur a envoyé une réponse inutilisable.',
  errInput: "La configuration de cette carte n'est pas valide : {detail}",
}

const it: Dict = {
  title: 'Vita utile residua',
  subtitle: 'Giorni prima che la tendenza dei punteggi di anomalia di una sorgente raggiunga il limite, stimati da HYDRA-UMC-ANOMALY-DETECTOR.',
  source: 'ID sorgente', kind: 'Tipo', field: 'Campo', limit: 'Limite (punteggio)',
  refresh: 'Stima', loading: 'Stima in corso…',
  estimate: 'Restano circa {days} giorni',
  range: 'Probabilmente tra {low} e {high} giorni',
  rangeOpen: 'Al più presto tra {low} giorni; la tendenza plausibile più lieve non sale',
  slope: 'Tendenza: {slope} al giorno', current: 'Valore attuale della tendenza: {value}', samples: '{n} campioni di punteggio usati',
  chart: 'Punteggio di anomalia', disclaimer: 'Una stima di una tendenza, non una promessa.',
  statusInsufficient: 'Dati ancora insufficienti per stimare ({n} campioni).',
  statusNotRising: 'La tendenza non sale: nessun limite si avvicina.',
  statusLimitReached: 'La tendenza ha già raggiunto il limite.',
  warning: 'Avviso: il limite potrebbe essere raggiunto entro {days} giorni.',
  critical: 'Critico: il limite potrebbe essere raggiunto entro {days} giorni.',
  noSamples: 'Il data lake non contiene campioni di punteggio per questa sorgente.',
  errTimeout: 'Il rilevatore non ha risposto in tempo.',
  errUnreachable: 'Il rilevatore o il data lake non è raggiungibile.',
  errDisabled: 'Il rilevatore ha disattivato la rotta della vita utile residua (--rul).',
  errAuth: 'La sessione è stata rifiutata. Accedi di nuovo in STUDIO.',
  errHttp: 'Il servizio ha risposto con un errore: {detail}',
  errInvalid: 'Il rilevatore ha inviato una risposta inutilizzabile.',
  errInput: 'La configurazione di questa scheda non è valida: {detail}',
}

const ja: Dict = {
  title: '残存耐用期間',
  subtitle: 'あるソースの異常スコアの傾向が限界値に達するまでの日数を、HYDRA-UMC-ANOMALY-DETECTOR が推定します。',
  source: 'ソース ID', kind: '種類', field: 'フィールド', limit: '限界値（スコア）',
  refresh: '推定する', loading: '推定中…',
  estimate: '残りおよそ {days} 日',
  range: '{low} 日から {high} 日の間と見込まれます',
  rangeOpen: '早くても {low} 日後。最も緩やかな妥当な傾向は上昇しません',
  slope: '傾向: 1 日あたり {slope}', current: '傾向の現在値: {value}', samples: '使用したスコアのサンプル数: {n}',
  chart: '異常スコア', disclaimer: 'これは傾向の推定であり、保証ではありません。',
  statusInsufficient: '推定するにはまだデータが足りません（{n} サンプル）。',
  statusNotRising: '傾向は上昇していません。限界に近づいていません。',
  statusLimitReached: '傾向はすでに限界値に達しています。',
  warning: '警告: {days} 日以内に限界に達する可能性があります。',
  critical: '重大: {days} 日以内に限界に達する可能性があります。',
  noSamples: 'このソースのスコアのサンプルがデータレイクにありません。',
  errTimeout: '検出器が時間内に応答しませんでした。',
  errUnreachable: '検出器またはデータレイクに接続できません。',
  errDisabled: '検出器の残存耐用期間のルートがオフです（--rul）。',
  errAuth: 'セッションが拒否されました。STUDIO にもう一度サインインしてください。',
  errHttp: 'サービスがエラーを返しました: {detail}',
  errInvalid: '検出器から使用できない応答が返りました。',
  errInput: 'このカードの設定が正しくありません: {detail}',
}

const zh: Dict = {
  title: '剩余使用寿命',
  subtitle: '由 HYDRA-UMC-ANOMALY-DETECTOR 估算某个数据源的异常分数趋势到达上限所需的天数。',
  source: '数据源 ID', kind: '类型', field: '字段', limit: '上限（分数）',
  refresh: '估算', loading: '正在估算…',
  estimate: '大约还剩 {days} 天',
  range: '很可能在 {low} 到 {high} 天之间',
  rangeOpen: '最早在 {low} 天后；最平缓的合理趋势不上升',
  slope: '趋势：每天 {slope}', current: '趋势的当前值：{value}', samples: '已使用 {n} 个分数样本',
  chart: '异常分数', disclaimer: '这只是对趋势的估算，不是承诺。',
  statusInsufficient: '数据还不足以估算（{n} 个样本）。',
  statusNotRising: '趋势没有上升：没有接近任何上限。',
  statusLimitReached: '趋势已经达到上限。',
  warning: '警告：上限可能在 {days} 天内到达。',
  critical: '严重：上限可能在 {days} 天内到达。',
  noSamples: '数据湖中没有该数据源的分数样本。',
  errTimeout: '检测器未能及时响应。',
  errUnreachable: '无法连接到检测器或数据湖。',
  errDisabled: '检测器已关闭剩余使用寿命路由（--rul）。',
  errAuth: '会话被拒绝。请在 STUDIO 中重新登录。',
  errHttp: '服务返回了错误：{detail}',
  errInvalid: '检测器返回了无法使用的响应。',
  errInput: '此卡片的配置无效：{detail}',
}

const pt: Dict = {
  title: 'Vida útil restante',
  subtitle: 'Dias até a tendência das pontuações de anomalia de uma fonte atingir o limite, estimados pelo HYDRA-UMC-ANOMALY-DETECTOR.',
  source: 'ID da fonte', kind: 'Tipo', field: 'Campo', limit: 'Limite (pontuação)',
  refresh: 'Estimar', loading: 'A estimar…',
  estimate: 'Faltam cerca de {days} dias',
  range: 'Provavelmente entre {low} e {high} dias',
  rangeOpen: 'No mínimo daqui a {low} dias; a tendência plausível mais suave não sobe',
  slope: 'Tendência: {slope} por dia', current: 'Valor atual da tendência: {value}', samples: '{n} amostras de pontuação usadas',
  chart: 'Pontuação de anomalia', disclaimer: 'Uma estimativa de uma tendência, não uma promessa.',
  statusInsufficient: 'Ainda não há dados suficientes para estimar ({n} amostras).',
  statusNotRising: 'A tendência não sobe: nenhum limite se aproxima.',
  statusLimitReached: 'A tendência já atingiu o limite.',
  warning: 'Aviso: o limite pode ser atingido dentro de {days} dias.',
  critical: 'Crítico: o limite pode ser atingido dentro de {days} dias.',
  noSamples: 'O data lake não tem amostras de pontuação desta fonte.',
  errTimeout: 'O detetor não respondeu a tempo.',
  errUnreachable: 'Não é possível contactar o detetor ou o data lake.',
  errDisabled: 'O detetor tem a rota da vida útil restante desligada (--rul).',
  errAuth: 'A sessão foi recusada. Inicie sessão novamente no STUDIO.',
  errHttp: 'O serviço respondeu com um erro: {detail}',
  errInvalid: 'O detetor enviou uma resposta que não se pode usar.',
  errInput: 'A configuração deste cartão não é válida: {detail}',
}

export const RUL_TEXTS: Record<Lang, Dict> = { en, es, de, fr, it, ja, zh, pt }

/** The language of a browser tag ("pt-PT", "zh-CN", "de"); English when unknown. */
export function pickLang(tag: string | undefined | null): Lang {
  const base = (tag ?? '').toLowerCase().split(/[-_]/)[0]
  return (LANGUAGES as readonly string[]).includes(base) ? (base as Lang) : 'en'
}

export function browserLang(): Lang {
  return pickLang(typeof navigator === 'undefined' ? 'en' : navigator.language)
}

export function tr(lang: Lang, key: RulKey, params: Record<string, string | number> = {}): string {
  return RUL_TEXTS[lang][key].replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m))
}
