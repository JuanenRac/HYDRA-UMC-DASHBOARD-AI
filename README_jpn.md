<p align="center">
  <img src="images/HYDRA_UMC_BANNER.svg" alt="HYDRA-UMC-DASHBOARD-AI banner" width="100%">
</p>

# 🧠 HYDRA-UMC-DASHBOARD-AI

<p align="center"><a href="README.md">🇺🇸 English</a> | <a href="README_spa.md">🇪🇸 Español</a> | <a href="README_fra.md">🇫🇷 Français</a> | <a href="README_ita.md">🇮🇹 Italiano</a> | <a href="README_deu.md">🇩🇪 Deutsch</a> | <a href="README_zho.md">🇨🇳 简体中文</a> | 🇯🇵 <b>日本語</b> | <a href="README_por.md">🇵🇹 Português</a></p>

### 📈 STUDIO Web ダッシュボード向けの統計サマリーと異常ハイライト(言語モデルなし)

<p align="center">
  <img src="https://img.shields.io/badge/Licencia-GPL%203.0--or--later-blue.svg" alt="GPL 3.0 or later">
  <img src="https://img.shields.io/badge/Stack-React%20%2F%20Vite%20%2F%20TypeScript-61DAFB.svg" alt="React/Vite/TS">
  <img src="https://img.shields.io/badge/Feature-AI%20Insights-blueviolet.svg" alt="Insights">
</p>

---

> **誠実性チェック - 今日実際に動くもの:** トレンド要約統計（`lib/summary.ts`）、AI プロバイダーゲートとその誠実な統計フォールバック（`lib/aiProvider.ts`）、外部契約ガード、本物の HTTP クライアント（`api/datalakeClient.ts`、`api/anomalyClient.ts`）、およびパネル単位のレンダリング失敗の分離（`components/ErrorBoundary.tsx` - 1つのパネルのレンダリングでのクラッシュは、アプリ全体をアンマウントすることなく、そのパネル自身のカード内に封じ込められる）は本物であり、70件の通過する Vitest テストで検証されている（`npm test` - `summary.test.ts`、`aiProvider.test.ts`、`anomalyClient.test.ts`、`datalakeClient.test.ts`、`TrendSummaryPanel.test.tsx`、`ErrorBoundary.test.tsx`）。CM5 向けの静的ファイルサーバー（`scripts/serve_static.py`）には独自の11件の通過する `unittest` テスト（ディレクトリ一覧なし、堅牢化ヘッダー、アイドル接続のタイムアウト、パストラバーサルなし）がある。本リポジトリのどこにも本物の LLM ベースの AI プロバイダーは存在しない - `aiProvider.ts` のゲート自体は本物だが、今日表示されるすべてのナラティブは `NO_PROVIDER_CONFIGURED` の統計フォールバックであり、そのように明確にラベル付けされている。トレンド予測(本物の予測モデル)と最適化のヒントはどちらも完全に構想段階であり、どちらのコードもまだ存在しない。異常ハイライト機能は HYDRA-UMC-ANOMALY-DETECTOR 自身の既に適合済みのベースラインを確認するだけであり、自らベースラインを適合させることは一切ない。これまでに実際に出荷された内容は `CHANGELOG.md` を参照。

---

> **安全性とセキュリティの現状:** このエコシステムは認証された安全システムではありません。ハードウェアの E-STOP 経路、ファームウェアが強制する制限やインターロック、検証済みの動作コマンドはまだありません。ファームウェアイメージは CRC32 と共有鍵の HMAC-SHA256 で検査しており、非対称署名ではありません。TLS と相互 TLS は任意で、既定では無効です。独自基板はまだ実装も試験もされていません。ここに書かれた内容を人の安全のために頼る前に、[セキュリティベースライン](https://github.com/JuanenRac/HYDRA-UMC-DOCS/blob/main/docs/SECURITY_BASELINE.md)と[脅威モデル](https://github.com/JuanenRac/HYDRA-UMC-DOCS/blob/main/docs/THREAT_MODEL.md)をお読みください。

## 📋 ひと目で

| | |
|---|---|
| バージョン | `0.1.6` |
| 成熟度 | 機能する |
| テスト | 70 (`npm test`) |
| 技術 | TypeScript/React / Vite |
| 対象 | HYDRA-UMC セルの Raspberry Pi CM5 |
| 実機での確認 | まだです：このバージョンについて実機での動作記録はありません |

## 1. 🛠️ 技術概要

**HYDRA-UMC-DASHBOARD-AI** は STUDIO の Web インターフェース向けの分析プラグインです。保存された履歴から計算したサマリー(最小値、最大値、平均、最新値、トレンドの方向)と、異常検知器の統計に基づく異常のハイライトを追加します。言語モデルも予測もまだ使っていません。

生のテレメトリを、スウォームの性能やエネルギー消費パターンの実用的なサマリーに変えてブラウザー内に直接表示することを目指しています(計画中:予知保全アラートと AI 生成のインサイト)。新しいスタックを導入せず HYDRA-UMC-STUDIO 自身のスタック(React 19 + Vite + TypeScript)を再利用するため、いずれ STUDIO 自体にパネルとして組み込めます。

### 主な機能：
* 🧠 **スマートサマリー（v0）** — HYDRA-UMC-DATALAKE の実際の履歴データから計算された、実際の最小値/最大値/平均値/最新値/傾向の統計。最小値/最大値/最新値はそれぞれ、それを生み出した実際の観測タイムスタンプにひも付けられている。*（実際の統計値として実装済み、AI 生成のサマリーはまだ——下記の「ビルドと実行」を参照）*
* 🔒 **AI プロバイダーゲート（v0）** — 将来の LLM ベースのナラティブに向けた実際の入力/出力スキーマ検証と、AI プロバイダーが設定されていない、またはプロバイダーが失敗/非構造化出力を返した場合に常に使われる、実際の、正直にラベル付けされた統計的フォールバック。*（今日実装済みでトレンドサマリーパネルに組み込まれています。実際の LLM ベースのプロバイダー自体は計画中です）*
* 🛡️ **外部契約ガード（v0）** — パネルが計算または表示する前に、Datalake と異常サービスの各レスポンスを検証します。不正な数値・フラグ・過大な識別子・安全でない制御文字は拒否されます。*（実装済み。[`docs/SECURITY.md`](docs/SECURITY.md) を参照）*
* 📈 **トレンド予測** — v0 の実際だが単純な方向インジケーターを超える、実際の予測モデル。*（計画中）*
* 🚨 **異常ハイライト（v0）：** 最新の実際のサンプルを、HYDRA-UMC-ANOMALY-DETECTOR の実際に適合済みのベースラインと照合します。*（実際のテキストパネルとして実装済み。STUDIO 自身の 3D ビューへの重ね合わせは計画中）*
* 🛠️ **最適化のヒント：** サイクルタイムやモーター寿命を改善するパラメーター変更を提案します。*（計画中）*
* ✅ **ツールチェーンの足場** — `tsc --noEmit` で問題なくビルドでき、Vite で提供される実際の React/Vite/TypeScript アプリ。*（実装済み——下記の「ビルドと実行」を参照）*
* 🧯 **パネル単位のレンダリング失敗の分離** — 各パネルは独自の `ErrorBoundary` でラップされており、あるパネルのレンダリング時に例外が発生しても、ダッシュボード全体をアンマウントすることなく、そのパネル内に収まったフォールバックカードが表示される。*（実装済み——`components/ErrorBoundary.tsx` を参照）*

---

## 2. 🔄 Dashboard AI フロー

```mermaid
flowchart LR
    STUDIO["HYDRA-UMC-STUDIO"] --> DASH_AI["DASHBOARD-AI (Plugin)"]
    LAKE["HYDRA-UMC-DATALAKE"] --> ANALY["AI Analysis Engine"]
    ANALY --> DASH_AI
    DASH_AI --> INSIGHTS["Smart Widgets & Alerts"]
    INSIGHTS --> OPERATOR["Web Browser View"]
```

---

## 3. 🧱 アーキテクチャと設計上の決定

* **他の AI 関連プロジェクトのような Python ではなく、Node/TS プロジェクトである理由。** これは独立した AI サービスではなく、HYDRA-UMC-STUDIO 自身の React/Vite フロントエンドの直接的な拡張です——STUDIO 自身の技術スタックに合わせる（HYDRA-UMC-COGNITIVE-NODE の Python スタックではなく）ことが、後にユーザーが切り替える必要のある別アプリとしてではなく、実際の STUDIO パネルとしてマウントできることを可能にします。
* **STUDIO の内部のフォルダではなく、STUDIO の兄弟プロジェクトである理由。** これを独自のリポジトリ/ビルドとして保つことで、AI ダッシュボード層が STUDIO 自身のロボット制御リリースのペースとは独立してバージョン管理・出荷できるようになります。これは、そもそも HYDRA-UMC-SERVER を STUDIO から分離した理由と同じです。
* **エントリポイントが今日は身元/バージョン/役割のみを表示する理由。** 足場（アンダミアヘ、スキャフォールディング）段階にあります：本パッケージが問題なくビルドされることを証明することが、実際のダッシュボードパネルに先立ちます。
* **エコシステムの他の部分との関係。** HYDRA-UMC-STUDIO を統計サマリーと異常ハイライトで拡張します。HYDRA-UMC-COGNITIVE-NODE による言語モデルのバックエンドは計画中で、現時点では接続されていません。
* **異常チェックパネルが、何かをスコアリングする前に `/stats` を確認する理由。** HYDRA-UMC-ANOMALY-DETECTOR 自身の検出器は、メモリ上で適合された単一の共有ベースラインです（そのプロジェクト自身の `api.py` を参照）——このダッシュボードは意図的にその適合処理を管理しません（読み取り志向のダッシュボードから共有の検出器状態を変更することは、本当に望ましくない結合になります）。実際の「まだ適合されていない」状態は、汎用的なエラーに丸め込まれることなく、まさにその状態として表示されます。
* **トレンドサマリーが予測ではなく「方向」を報告する理由。** 実際の初期値から最新値への差分の符号（フラットな信号が「上昇」/「下降」の間でちらつかないよう、小さな相対ノイズ閾値付き）は、v0 が実際に計算している内容について正直です——実際の予測モデルは独立した、本物の将来の作業であり、「予測」を装った線形外挿でごまかすようなものではありません。
* **`safeGenerateNarrative()` がリクエストを検証しつつ、悪いレスポンスに対して決してエラーを投げない理由。** 不正なリクエストはこのコード内の本物の配線バグです——正直に頼れるサマリーが存在しないため、エラーを投げることが許されています。プロバイダーからの*不正な/非構造化な*レスポンスは、実際の外部 API では避けられない現実です——そのパスは常に、パネルをクラッシュさせる代わりに実際の統計的フォールバックに降格します。呼び出し側はすでに真実を語るために必要なすべて(実際のサマリー)を持っているからです。
* **`NO_PROVIDER_CONFIGURED` が独立したフォールバック実装ではなく `summary.ts` を再利用する理由。** 独立した第二の「フォールバックナラティブ」の計算式は、パネルがすでに信頼し、すでに数値で表示している実際の統計から乖離してしまいます——同じ `TrendSummary` の値を再利用することで、フォールバックナラティブがすぐ隣にある数値と証明可能な形で一致し続けます。

---

## 📂 リポジトリ構成

純粋なソフトウェアの Web アプリであり、独自のハードウェア、ファームウェア、
OS はありません。これらのディレクトリはリポジトリ構造ポリシーに従って省略
されています。

```text
HYDRA-UMC-DASHBOARD-AI/
├── src/
│   ├── api/                 # 実際の HTTP クライアント：datalakeClient.ts、anomalyClient.ts
│   ├── lib/
│   │   ├── summary.ts        # 実際のトレンドサマリー統計
│   │   └── aiProvider.ts     # 実際の AI プロバイダーゲート：スキーマ検証 + 正直なフォールバック
│   ├── components/
│   │   ├── TrendSummaryPanel.tsx
│   │   └── AnomalyCheckPanel.tsx
│   ├── main.tsx              # アプリケーションエントリポイント
│   ├── App.tsx                # ルートコンポーネント——両方の実際のパネルをマウント
│   ├── index.css              # ベーススタイルシート
│   └── vite-env.d.ts          # VITE_DATALAKE_URL / VITE_ANOMALY_URL の型定義
├── tests/                   # 実際のテスト：HTTP ラウンドトリップ + コンポーネントテスト
├── scripts/
│   ├── bump-version.mjs    # オドメーター式バージョンインクリメント（ビルドが実行）
│   ├── serve_static.py     # ビルド済みdist/ SPA向けの実際の静的ファイルサーバー(実運用で発見されたCM5デプロイの穴)
│   └── test_serve_static.py # serve_static.pyの実際のテスト
├── systemd/
│   └── hydra-umc-dashboard-ai.service # ローカルCM5静的配信サービスのsystemdユニット
├── tools/
│   ├── build_test.py       # バージョンを増やさないビルドチェック
│   └── ci_validate.py      # CI が使用するマニフェスト/CHANGELOG/ドキュメント検証
├── docs/
│   └── SECURITY.md          # 外部コンテンツと配備の公開安全契約
├── build/                  # リリース成果物用に予約（dist/ 自体は gitignore 対象）
├── images/                 # メディアと図表
├── index.html              # Vite エントリ HTML
├── vite.config.ts          # Vite バンドラー + Vitest 設定
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── bump_manifest_version.py # hydra-umc.project.json のバージョンを package.json と同期(--sync)
├── dev.sh / dev.bat        # 実際の開発サーバー：依存関係のインストール + vite
├── build.sh / build.bat    # 実際のビルド：依存関係のインストール + 実際のテストスイート + バージョンインクリメント + tsc + vite build
└── package.json
```

---

## 4. ⚙️ ビルドと実行

Node.js >= 20 が必要です。

```bash
# Linux/macOS
./dev.sh      # 依存関係をインストールし、:5174 で Vite 開発サーバーを起動します
./build.sh    # 依存関係をインストールし、実際のテストスイートを実行し、バージョンを増加させ、型チェックを行い、dist/ をビルドします

# Windows
dev.bat
build.bat
```

`npm run build` は `node scripts/bump-version.mjs && tsc --noEmit &&
vite build` を連鎖的に実行します——バージョンのインクリメントは、厳格な
TypeScript チェックが既に通過した後にのみ発生するため、壊れたビルドが
増加したバージョン番号を出荷することは決してありません。`npm run dev`
はポート `5174` で Vite を起動します（HYDRA-UMC-STUDIO 自身の `5173`
とは別のポートのため、両方を同時に並行して実行できます）。`npm test`
は実際の Vitest スイートを直接実行します。

デフォルトでは、2つの実際のパネルは同一オリジンのパス `/api/datalake` と
`/api/anomaly` を呼び出します。`scripts/serve_static.py`（および Vite 開発
サーバー）がこれらを `127.0.0.1:8095` の HYDRA-UMC-DATALAKE と
`127.0.0.1:8097` の HYDRA-UMC-ANOMALY-DETECTOR に転送します（どちらの
サービスも CORS ヘッダーを送らないため、ブラウザから直接は呼び出せません）
——`VITE_DATALAKE_URL`/
`VITE_ANOMALY_URL`（`vite build`/`vite dev` の前に設定、Vite がビルド時
にインライン化します）で上書きして、別のデプロイ先を指すことができます。

これらのブラウザから見える URL を設定する前、または実際の AI プロバイダーを
接続する前に、[`docs/SECURITY.md`](docs/SECURITY.md) を読んでください。レスポンス
検証、コンテンツ安全性、失敗時の動作、および秘密情報を含めないルールを定義しています。

すべての実際のトレンドサマリーの取得は、実際の AI プロバイダーゲートも
実行します。実際のプロバイダーが設定されていない場合(v0 の正直な
デフォルト)、パネルは実際の統計的フォールバックを、はっきりとラベル
付けして表示します：

```ts
import { safeGenerateNarrative, NO_PROVIDER_CONFIGURED } from './lib/aiProvider'

const narrative = await safeGenerateNarrative(NO_PROVIDER_CONFIGURED, { sourceId, kind, field, summary })
// { narrative: "robot-1/motor_temp/value: 4 sample(s), ranging 10.00 to 50.00,
//    averaging 29.00, latest 36.00 (rising).", generatedBy: 'statistical-fallback' }
```

エラーを投げる、または `narrative` が欠落/不正なレスポンスを返す
プロバイダーは、パネルをクラッシュさせたり何も表示しなかったりする
代わりに、まさにこの実際のフォールバックに降格します。

---

## 🔗 関連プロジェクト

本プロジェクトは、同じ作者(JuanenRac / Electro Hobby 3D)による HYDRA-UMC ロボティクスエコシステムの一部です。リクエストが実はこの中のどれかについてのものである可能性があるため、知っておく価値があります。

**直接関連**
- **[HYDRA-UMC-STUDIO](https://github.com/JuanenRac/HYDRA-UMC-STUDIO)** — リアルタイムのマルチロボット 3D 可視化を備えたウェブ制御ダッシュボード ——本プロジェクトが直接拡張するダッシュボード。
- **[HYDRA-UMC-COGNITIVE-NODE](https://github.com/JuanenRac/HYDRA-UMC-COGNITIVE-NODE)** — Hailo-10 コグニティブパイプライン(LLM/VLA/音声オーケストレーション)の統合ハブ ——本ダッシュボードにデータを供給する AI バックエンド。
- **[HYDRA-UMC-DATALAKE](https://github.com/JuanenRac/HYDRA-UMC-DATALAKE)** — 実際の取り込み/クエリ HTTP API を備えた、実際の sqlite3 ベースの時系列ストア ——スマートサマリーパネルが統計を算出する元となる実際の履歴。
- **[HYDRA-UMC-ANOMALY-DETECTOR](https://github.com/JuanenRac/HYDRA-UMC-ANOMALY-DETECTOR)** — ドリフト監視を備えた、実際の FFT + 統計ベースラインによる異常検知器 ——異常ハイライトパネルが直近のサンプルを評価する基準となる、フィッティング済みのベースライン。

**エコシステムの他のプロジェクト**

*コアハードウェア&プラットフォーム*
- **[HYDRA-UMC](https://github.com/JuanenRac/HYDRA-UMC)** — ロボットアームのマザーボードの設計——CM5 ホスト + デュアルコア STM32H745、CAN-OTA/SPI-OTA 経由で最大 8 本のツールアームを統括することを目指す(ファームウェアは初期段階で、実装済みの基板はまだない)。
- **[HYDRA-UMC-OS](https://github.com/JuanenRac/HYDRA-UMC-OS)** — CM5 向けの再現可能な Raspberry Pi OS プロダクト層——読み取り専用エージェント、検証済み設定/プロファイル、WiFi 初回接続プロビジョニング。
- **[HYDRA-UMC-SDK](https://github.com/JuanenRac/HYDRA-UMC-SDK)** — すべてのブリッジが自身のコマンドを検証する共有 JSON-Schema 契約とソフトウェアのジョブゲート境界(認証済みの安全機能ではない)。
- **[HYDRA-UMC-CONNECTOR-HUB](https://github.com/JuanenRac/HYDRA-UMC-CONNECTOR-HUB)** — 外部マシン用コネクタのための宣言的アダプターマニフェストのレジストリとバリデーター。SDK 自身の契約という発想を外部マシンにまで拡張し、産業用ゲートウェイ系のプロジェクトを置き換えることはありません。

*コアバックエンド&クライアント*
- **[HYDRA-UMC-SERVER](https://github.com/JuanenRac/HYDRA-UMC-SERVER)** — すべての制御クライアントが実際に通信する、本物のヘッドレスバックエンド(REST/WebSocket)。
- **[HYDRA-UMC-SUITE](https://github.com/JuanenRac/HYDRA-UMC-SUITE)** — 複数のサーバーを同時に扱えるデスクトップ(PySide6)スウォームコマンドセンター、スタンドアロン実行ファイルとしてパッケージ化。
- **[HYDRA-UMC-ANDROID-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-ANDROID-CONTROL)** — 生体認証ログインとペアリングされた Wear OS コンパニオンを備えたネイティブ Android 制御アプリ。
- **[HYDRA-UMC-IOS-CONTROL](https://github.com/JuanenRac/HYDRA-UMC-IOS-CONTROL)** — リアルタイム WebSocket 同期を備えた iOS/iPadOS 制御アプリ(Flutter)。
- **[HYDRA-UMC-DSI](https://github.com/JuanenRac/HYDRA-UMC-DSI)** — 本体搭載の 7 インチ DSI タッチスクリーン向けネイティブタッチ UI、CM5 自体に組み込み。
- **[HYDRA-UMC-EDITOR-URDF](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-URDF)** — 完成したモデルを STUDIO 自身のカタログへ送信するデスクトップ用グラフィカル URDF 作成/編集ツール。
- **[HYDRA-UMC-EDITOR-STL](https://github.com/JuanenRac/HYDRA-UMC-EDITOR-STL)** — HYDRA-UMC-EDITOR-URDF も編集する同じモデルカタログ内で、実在するパーツを変換/置換/削除/追加するデスクトップ STL モデルエディタ。
- **[HYDRA-UMC-BRIDGE-AMR](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-AMR)** — VDA 5050 MQTT パブリッシャーによる AGV/AMR フリートの調整境界(エミュレートしたフリートに対してのみテスト済み)。
- **[HYDRA-UMC-BRIDGE-CNC](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-CNC)** — GRBL ステータス/制御バイトへのアクセスを持つ、CNC セルの高レベルコーディネーター(エミュレーターに対してのみテスト済み)。
- **[HYDRA-UMC-BRIDGE-DROIDS](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-DROIDS)** — Boston Dynamics Spot コマンド送信機能を持つ、脚型/ヒューマノイドドロイドの調整境界(エミュレーターに対してのみテスト済み)。
- **[HYDRA-UMC-BRIDGE-LASER](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-LASER)** — キー/筐体/インターロックの GPIO 信号 3 系統を読み取るレーザーセルのコーディネーター(模擬チップに対してのみテスト済み。レーザーの武装や発射はできない)。
- **[HYDRA-UMC-BRIDGE-OPENPNP](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-OPENPNP)** — OpenPnP ピックアンドプレースの基板フローを安全に統括する高レベルコーディネーター。
- **[HYDRA-UMC-BRIDGE-PRINTER3D](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-PRINTER3D)** — 実際にゲート制御されたジョブコマンドを持つ、Moonraker/Klipper 3D プリンター向けの安全な調整境界。
- **[HYDRA-UMC-BRIDGE-ROS2](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-ROS2)** — 遅延インポートの rclpy ROS 2 トランスポートを持つコーディネーター(ROS 2 環境ではまだ実行していない)。
- **[HYDRA-UMC-BRIDGE-UAV](https://github.com/JuanenRac/HYDRA-UMC-BRIDGE-UAV)** — MAVLink コマンド送信機能を持つ、カメラ搭載 UAV の調整境界(エミュレーターに対してのみテスト済み)。

*URTC ツールプラットフォーム*
- **[URTC](https://github.com/JuanenRac/URTC)** — 物理的な Universal Robot Tool Controller 基板向けファームウェア、CAN バス経由の 25 以上のツールプロファイル。
- **[URTC-FLASHER](https://github.com/JuanenRac/URTC-FLASHER)** — URTC 基板用のデスクトップ GUI 書き込みツール、CAN-OTA およびフルチップ SWD/JTAG。
- **[URTC-TESTER](https://github.com/JuanenRac/URTC-TESTER)** — URTC 基板向けのデスクトップ CAN バスライブ診断ツール、ツールプロファイルごとに 1 パネル。
- **[URTC-WEB-STUDIO](https://github.com/JuanenRac/URTC-WEB-STUDIO)** — Web Serial API を使ったブラウザベースの URTC-TESTER の代替、ローカルインストール不要。

*ビジョン AI ノード(Hailo-8)*
- **[HYDRA-UMC-VISION-NODE](https://github.com/JuanenRac/HYDRA-UMC-VISION-NODE)** — Hailo-8 ビジョンパイプラインの統合ハブ、段階ごとの実際のハードウェア準備状況チェック付き。
- **[HYDRA-UMC-DETECTION-HEF](https://github.com/JuanenRac/HYDRA-UMC-DETECTION-HEF)** — Hailo アーキテクチャ/チェックサムによる安全読み込み検証を備えた、実際のコンパイル済みモデルレジストリ。
- **[HYDRA-UMC-VISION-STREAMER](https://github.com/JuanenRac/HYDRA-UMC-VISION-STREAMER)** — 実際の HailoRT 統合境界を持つ、実際の GStreamer パイプライン + MediaMTX 設定生成器。
- **[HYDRA-UMC-VISUAL-SERVOING-API](https://github.com/JuanenRac/HYDRA-UMC-VISUAL-SERVOING-API)** — ゾーン状態を条件に承認する Position-Based Visual Servoing 補正則。カメラによる姿勢推定はまだない。
- **[HYDRA-UMC-SAFETY-ZONES](https://github.com/JuanenRac/HYDRA-UMC-SAFETY-ZONES)** — ファイルから物体位置を受け取る、ゾーン侵入・キャリブレーション鮮度・E-STOP 要求の v0 ロジック。検出器は接続されておらず、物理 E-STOP もまだ配線されていない。

*コグニティブ AI ノード(Hailo-10)*
- **[HYDRA-UMC-VLA-ENGINE](https://github.com/JuanenRac/HYDRA-UMC-VLA-ENGINE)** — Vision-Language-Action モデル向けの、実際のアクショントークンのエンコード/デコードと軌道生成。
- **[HYDRA-UMC-VOICE-UI](https://github.com/JuanenRac/HYDRA-UMC-VOICE-UI)** — 確認ゲート付きの限定的な Watch リレーを備えた、実際の音声フロントエンド(VAD + 意図解析)。
- **[HYDRA-UMC-SEMANTIC-PLANNER](https://github.com/JuanenRac/HYDRA-UMC-SEMANTIC-PLANNER)** — MCU エラーコードに対する、実際のルールベースのタスク分解と意味的エラー復旧。
- **[HYDRA-UMC-DOCS-QA](https://github.com/JuanenRac/HYDRA-UMC-DOCS-QA)** — このエコシステム自身の Markdown ドキュメントに対する、標準ライブラリのみの実際の TF-IDF 文書検索。
- **[HYDRA-UMC-LOCAL-TECHNICIAN](https://github.com/JuanenRac/HYDRA-UMC-LOCAL-TECHNICIAN)** — エコシステム自身のための、ローカルでポリシーゲート付きのAIメンテナンス技術者 — 観察、診断し、修正を提案する;最上位の2つのリスクレベルは意図的にまだ実装されていない。

*オーケストレーション&スウォーム*
- **[HYDRA-UMC-ORCHESTRATOR](https://github.com/JuanenRac/HYDRA-UMC-ORCHESTRATOR)** — 実際の gRPC/Protobuf ヘルスレポート契約とミッションステートマシンを持つ統合ハブ。
- **[HYDRA-UMC-JOB-DISPATCHER](https://github.com/JuanenRac/HYDRA-UMC-JOB-DISPATCHER)** — 実際の HTTP API 上に構築された、優先度ベースの実際のジョブキュー(重複排除付き)。
- **[HYDRA-UMC-NODE-HEALING](https://github.com/JuanenRac/HYDRA-UMC-NODE-HEALING)** — リトライ/バックオフとアイデンティティ不一致検出を備えた、実際の gRPC ベースのフリートヘルスウォッチドッグ。
- **[HYDRA-UMC-PATH-PLANNER-3D](https://github.com/JuanenRac/HYDRA-UMC-PATH-PLANNER-3D)** — 実際の障害物/ワークスペース衝突検証を備えた、実際の RRT ベースの 3D 経路プランナー。
- **[HYDRA-UMC-SWARM-SYNC](https://github.com/JuanenRac/HYDRA-UMC-SWARM-SYNC)** — 複数セルの収束についてプロパティテストされた、実際の CRDT LWW-Element-Map 状態同期。

*デジタルツイン&シミュレーション*
- **[HYDRA-UMC-TWIN](https://github.com/JuanenRac/HYDRA-UMC-TWIN)** — 実際のバージョン互換性同期契約を持つ、デジタルツインエンジンの統合ハブ。
- **[HYDRA-UMC-HIL-BRIDGE](https://github.com/JuanenRac/HYDRA-UMC-HIL-BRIDGE)** — シミュレーションと実機の間にソフトウェアの衝突インターロックを備えたハードウェア・イン・ザ・ループのルーター(実機なしでテスト済み)。
- **[HYDRA-UMC-PHYSICS-REPLICA](https://github.com/JuanenRac/HYDRA-UMC-PHYSICS-REPLICA)** — 実際の URDF サブセットに対する、実際の順運動学と関節限界検証。
- **[HYDRA-UMC-SYNTHETIC-DATA-GEN](https://github.com/JuanenRac/HYDRA-UMC-SYNTHETIC-DATA-GEN)** — YOLO/COCO アノテーションのエクスポート機能を持つ、実際のプロシージャル 2D シーンジェネレーター。

*データ&分析*
- **[HYDRA-UMC-PRODUCTION-REPORTS](https://github.com/JuanenRac/HYDRA-UMC-PRODUCTION-REPORTS)** — DATALAKE の履歴に対する実際の OEE/稼働率計算、再現可能な CSV エクスポート付き。
- **[HYDRA-UMC-TELEMETRY-COLLECTOR](https://github.com/JuanenRac/HYDRA-UMC-TELEMETRY-COLLECTOR)** — シーケンス重複排除機能を備えた、DATALAKE への実際の CAN/WebSocket 取り込みパイプライン。

*産業用ゲートウェイ*
- **[HYDRA-UMC-GATEWAY-INDUSTRIAL](https://github.com/JuanenRac/HYDRA-UMC-GATEWAY-INDUSTRIAL)** — 実際のコマンド許可リスト/バックプレッシャー層を持つ、産業用プロトコルへ中継する統合ハブ。
- **[HYDRA-UMC-OPCUA-SERVER](https://github.com/JuanenRac/HYDRA-UMC-OPCUA-SERVER)** — 実際のバイナリプロトコルクライアントセッションで検証された、実際の OPC-UA アドレス空間。
- **[HYDRA-UMC-MQTT-BROKER](https://github.com/JuanenRac/HYDRA-UMC-MQTT-BROKER)** — クライアント単位のオプション認証とトピック ACL を備えた、実際の MQTT ブローカー。
- **[HYDRA-UMC-MTCONNECT-ADAPTER](https://github.com/JuanenRac/HYDRA-UMC-MTCONNECT-ADAPTER)** — 縮退モード出力を備えた、実際の MTConnect `/probe` および `/current` XML エンドポイント。

*補完ツール&エコシステム運用*
- **[HYDRA-UMC-TOOL-CLI](https://github.com/JuanenRac/HYDRA-UMC-TOOL-CLI)** — 実際の安定した終了コード契約を持つフリート CLI、HYDRA-UMC-SERVER 自身の API の本物のライブクライアント。
- **[HYDRA-UMC-WATCH](https://github.com/JuanenRac/HYDRA-UMC-WATCH)** — 触覚アラートのパターンとペアリング済みスマートフォンへの音声リレーを備えた WearOS コンパニオンアプリ(物理的なウォッチではまだ実行していない)。
- **[URTC-SMART-RACK](https://github.com/JuanenRac/URTC-SMART-RACK)** — 実際の工具 ID デコードと Smart Idle 予熱ロジックを備えた、基板搭載ラック用ファームウェア。
- **[URTC-VISION-TOOL](https://github.com/JuanenRac/URTC-VISION-TOOL)** — サーマル/RGB 検査ツールヘッド向けの、ファームウェアと実際の Python ビジョンコンパニオン。
- **[HYDRA-UMC-UPDATER](https://github.com/JuanenRac/HYDRA-UMC-UPDATER)** — このエコシステム内のすべてのリポジトリを検出・クローン・更新する、管理用デスクトップツール。
- **[HYDRA-UMC-OS-REBUILDER](https://github.com/JuanenRac/HYDRA-UMC-OS-REBUILDER)** — エコシステムの最新バージョンをプリロードした、書き込み可能なCM5イメージを構築するWindows/Linuxデスクトップツール。Raspberry Pi Imager方式の初回起動Wi-Fi/ユーザー/SSH設定を備える。
- **[HYDRA-UMC-OPS-AGENT](https://github.com/JuanenRac/HYDRA-UMC-OPS-AGENT)** — 保守インシデントコーディネーター: 低権限のエッジ役割がサニタイズされたインベントリ/ヘルスのスナップショットを収集し、コントロールプレーン役割がそれを読み取り専用でレンダリングして AI プロバイダーに診断の提案を依頼します - パッチを適用することも、何かをデプロイすることも決してありません。
- **[HYDRA-UMC-DEV-SERVER](https://github.com/JuanenRac/HYDRA-UMC-DEV-SERVER)** — 再現可能な開発ホスト（Raspberry Pi 5 / CM5）。エコシステムのソースコードを保管し、永続キューのもとで境界の明確なビルド/テストタスクを実行する。運用中の CM5 とは明確に異なる、開発専用の役割。


---

## 📚 ドキュメント & コミュニティ

- **[CONTRIBUTING.md](CONTRIBUTING.md)** —— プルリクエストのための技術スタックとコーディング指針。
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** —— このコミュニティで期待される行動規範。
- **[SECURITY.md](SECURITY.md)** —— 脆弱性の報告方法。本プロジェクト自身の外部コンテンツ・デプロイ安全契約については代わりに [`docs/SECURITY.md`](docs/SECURITY.md) を参照。
- **[SUPPORT.md](SUPPORT.md)** —— 質問の投稿先とバグの報告先。
- **[LICENSE.md](LICENSE.md)** —— このプロジェクト自身のライセンス。

## 👤 作者
**JuanenRac** (Electro Hobby 3D)
📧 electrohobby3d@gmail.com
📺 [youtube.com/@electrohobby3d](https://youtube.com/@electrohobby3d)

## 📜 ライセンス
GPL-3.0-or-later —— 詳細は LICENSE を参照してください。
