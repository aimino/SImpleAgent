# AI Agent Chat System

Claude APIとカスタムエージェントロジックを使用したAIエージェントとチャットできるWebシステムです。自律的に複数ステップを実行し、目標達成まで動作するエージェント機能を搭載しています。

## 機能

- **自律エージェント**: カスタム実装されたReActパターンによる複数ステップの自動実行
- **タスク分解機能**: 複雑なタスクを自動的にサブタスクに分解してTODOリスト作成
- **TODOリスト管理**: 各サブタスクの進捗状況をリアルタイムで可視化
- **リアルタイムUI**: Server-Sent Events (SSE) によるリアルタイム思考プロセス表示
- **ツール統合**: 計算機、テキスト分析、メッセージ作成、タスク計画、TODO管理ツール
- **思考プロセス可視化**: エージェントの思考、アクション、ツール実行をリアルタイムで表示
- **履歴管理**: 会話履歴の保存と管理

## 技術スタック

### バックエンド
- Node.js + Express
- @langchain/anthropic (Claude API通信のみ)
- Claude API (Anthropic)
- Server-Sent Events (SSE) によるリアルタイム通信
- CORS、ヘルメット、レート制限などのセキュリティ対策

### フロントエンド
- React 18 + TypeScript
- Vite (開発サーバー)
- Tailwind CSS (スタイリング)
- Fetch API + SSE (リアルタイム通信)

## セットアップ手順

### 前提条件
- Node.js 18以上
- npm または yarn
- Anthropic APIキー

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd SimpleAgent
```

### 2. バックエンドのセットアップ
```bash
cd backend
npm install
```

環境変数を設定:
```bash
cp .env.example .env
```

`.env`ファイルを編集してAPIキーを設定:
```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
PORT=3001
NODE_ENV=development
```

### 3. フロントエンドのセットアップ
```bash
cd ../frontend
npm install
```

## 起動方法

### 開発環境での起動

1. バックエンドサーバーを起動:
```bash
cd backend
npm run dev
```

2. 別のターミナルでフロントエンドを起動:
```bash
cd frontend
npm run dev
```

3. ブラウザで `http://localhost:3000` にアクセス

### 本番環境での起動

1. フロントエンドをビルド:
```bash
cd frontend
npm run build
```

2. バックエンドを起動:
```bash
cd backend
npm start
```

## API エンドポイント

### エージェント関連
- `POST /api/agent/execute` - エージェント実行（Server-Sent Events）
- `GET /api/history` - 履歴取得
- `DELETE /api/history` - 履歴削除
- `GET /api/health` - ヘルスチェック

### リクエスト例

#### エージェント実行（SSE）
```json
{
  "task": "10 + 5 * 2を計算して、その結果を使って挨拶文を作ってください",
  "sessionId": "optional-session-id"
}
```

**レスポンス（Server-Sent Events）**:
```
data: {"type":"start","message":"エージェント実行開始","timestamp":"..."}

data: {"type":"log","logType":"text","message":"🤖 エージェント開始: ...","timestamp":"..."}

data: {"type":"log","logType":"thought","message":"思考: 計算が必要","timestamp":"..."}

data: {"type":"log","logType":"action","message":"アクション: calculator","timestamp":"..."}

data: {"type":"log","logType":"tool","message":"ツール結果: 計算結果: 10 + 5 * 2 = 20","timestamp":"..."}

data: {"type":"complete","response":"最終回答","timestamp":"..."}
```

## エージェント機能

### 利用可能なツール

1. **calculator** - 数学計算
   - 入力例: `"10 + 5 * 2"`
   - 出力例: `"計算結果: 10 + 5 * 2 = 20"`

2. **text_analyzer** - テキスト分析
   - 入力例: `"Hello World"`
   - 出力例: `"テキスト分析結果: \"Hello World\" - 2語, 11文字"`

3. **message_creator** - メッセージ作成
   - 入力例: `"20"`
   - 出力例: `"作成したメッセージ: 20という情報を使って、こんにちは！..."`

4. **task_planner** - タスク分解とTODOリスト作成
   - 入力例: `"分析レポートを作成する"`
   - 出力例: `"TODOリスト作成完了: 1. データ収集... 2. 分析実行..."`

5. **todo_manager** - TODOリスト管理
   - 入力例: `"list"`, `"complete 1"`, `"current"`
   - 出力例: `"現在のTODOリスト: 1. データ収集 [pending]..."`

### ReActパターンの実装

エージェントは以下のパターンで動作します:

1. **タスク分解**: 複雑なタスクをtask_plannerで細分化
2. **TODO管理**: todo_managerで進捗追跡
3. **THOUGHT**: タスクを分析し、必要なアクションを決定
4. **TOOL**: 適切なツールを選択
5. **INPUT**: ツールに渡す入力を決定
6. **実行**: ツールを実行して結果を取得
7. **繰り返し**: 必要に応じて上記を繰り返し
8. **FINAL**: 最終回答を生成

新しいツールを追加するには、`backend/src/agent.js`の`createTools()`メソッドを編集してください。

## 使用例

### 基本的な計算タスク
```
入力: "10 + 5 * 2を計算してください"

エージェントの動作:
1. 思考: 数学計算が必要
2. アクション: calculator (入力: 10 + 5 * 2)
3. ツール結果: 計算結果: 10 + 5 * 2 = 20
4. 完了: 計算結果は20です
```

### 複合タスク
```
入力: "10 + 5 * 2を計算して、その結果を使って挨拶文を作ってください"

エージェントの動作:
1. タスク分解: task_planner でサブタスクを作成
2. TODOリスト: [計算実行, メッセージ作成]を生成
3. 思考: まず計算が必要
4. アクション: calculator (入力: 10 + 5 * 2)
5. ツール結果: 計算結果: 10 + 5 * 2 = 20
6. TODO更新: 計算タスクを完了
7. 思考: 次にメッセージ作成が必要
8. アクション: message_creator (入力: 20)
9. ツール結果: 作成したメッセージ: ...
10. TODO更新: メッセージ作成タスクを完了
11. 完了: すべてのタスクが完了しました
```

## カスタマイズ

### 新しいツールの追加
`backend/src/agent.js`の`createTools()`メソッドでツールを定義:

```javascript
new_tool: {
  name: 'new_tool',
  description: 'ツールの説明（エージェントがいつ使うかを明確に記述）',
  func: async (input) => {
    try {
      // ツールの実装
      const result = processInput(input);
      return `ツールの結果: ${result}`;
    } catch (error) {
      return `エラー: ${error.message}`;
    }
  }
}
```

### UIのカスタマイズ
- `frontend/src/App.tsx` - メインUIコンポーネント
- `frontend/src/index.css` - カスタムスタイル
- `frontend/tailwind.config.js` - Tailwind設定

### エージェントロジックのカスタマイズ
- `backend/src/agent.js` - `runAgent()`メソッドでエージェントのメインロジック
- プロンプトの調整、ステップ数の変更、パース処理の改善など

## セキュリティ

- CORS設定
- レート制限 (15分間に100リクエスト)
- Helmet.jsによるセキュリティヘッダー
- 入力検証

## ライセンス

MIT License

## アーキテクチャ

### システム構成
```
Frontend (React + SSE) ←→ Backend (Express + SSE) ←→ Claude API
                ↓                      ↓
         リアルタイム表示        カスタムエージェント
         思考プロセス可視化      + ツール管理
```

### カスタムエージェントの特徴
- **LangChainフレームワークを使わない**: 軽量で制御しやすい実装
- **強制的なツール使用**: エージェントが必ずツールを使って問題を解決
- **リアルタイム通信**: Server-Sent Eventsで思考プロセスを即座に表示
- **ReActパターン**: Reasoning（思考）とActing（行動）を交互に実行

## トラブルシューティング

### よくある問題

1. **APIキーエラー**: `.env`ファイルにAnthropic APIキーが正しく設定されているか確認
2. **ポート競合**: デフォルトポート(3000, 3001)が使用中の場合は、設定を変更
3. **依存関係エラー**: `npm install`を再実行
4. **SSE接続エラー**: ブラウザのコンソールでネットワークエラーを確認

### ログの確認
- **バックエンド**: 標準出力にエージェントの思考とツール実行ログが表示
- **フロントエンド**: ブラウザのコンソールでSSE受信ログを確認
- **詳細デバッグ**: `NODE_ENV=development`を設定