---
name: git-commit
description: Git Commit 流程：執行 lint、型別檢查與測試預檢，生成繁體中文 Angular 規範的 commit 訊息並提交，有 upstream 時推送並追蹤 CI。使用時機：/git-commit，或使用者說「幫我 commit」「提交變更」「push」「推上去」。
---

# Git Commit

## 安全規則

- 預檢失敗就停止，回報錯誤，不要 commit。
- 不使用 `--no-verify`，也不跳過 hooks。
- 只在目前分支已設定 upstream 時 push（見步驟 6）；不使用 `--force` / `--force-with-lease`，不刪除遠端分支。
- 不把 `.env*`、金鑰、`*.db`、`dist/`、`node_modules/` 加進 commit。發現這類檔案時先警告使用者。

## 步驟

### 1. 檢查狀態

1. 執行 `git status` 與 `git branch --show-current`。
2. 本專案為個人專案：直接 commit 在目前分支，不詢問、不開新分支。

### 2. 預檢

依序執行存在的 script，任一步失敗就停止：

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

只改了文件（`docs/`、`*.md`）或 `.claude/` 設定時，可以跳過預檢，並在回報中說明。只改單一 workspace 時，可以只跑該 workspace 的關卡（`-w <workspace>`），但改到 `packages/shared` 時必須跑全部。

### 3. 暫存變更

檢查暫存區。沒有已暫存的變更時，列出變更檔案，詢問使用者要暫存全部還是特定檔案。暫存時列出具體檔名，不要盲目 `git add .`。

### 4. 生成 commit 訊息

讀取 `git diff --staged`，撰寫符合 Angular 規範的繁體中文訊息：

- type：`feat`、`fix`、`refactor`、`perf`、`style`、`test`、`docs`、`build`、`ci`、`chore`
- scope：優先使用 PRD slug（例如 `history-query`），跨功能時用 workspace 名稱（`web`、`api`、`shared`、`simulator`）或 `skills`、`docs`
- 標題不超過 50 字，不加句號
- 內文說明「為什麼」改，不只是「改了什麼」；效能相關變更附前後數據

格式：

```text
<type>(<scope>): <功能說明>

摘要：
<一到兩句說明這次變更的目的>

主要變更內容：
- <變更 1>
- <變更 2>

影響範圍：
- <受影響的 workspace、頁面或 API>
```

小變更只寫標題即可。依系統指示附上 `Co-Authored-By` trailer。

### 5. 提交

用 heredoc 傳入訊息：

```bash
git commit -F - <<'EOF'
<訊息>
EOF
```

提交後執行 `git log --oneline -1`，確認 commit hash 與標題。

### 6. 推送

1. 只有在目前分支已設定 upstream（`git rev-parse --abbrev-ref @{u}` 成功）時才執行 `git push`。
2. 在 `.claude/worktrees/` 下的 worktree 任務分支上**不 push**：回報分支名稱、commit 摘要，以及在主工作目錄執行的合併指令 `git merge <分支>`。
3. 沒有 upstream 時不 push，回報後提示使用者：第一次推送執行 `! git push -u origin <分支>`；還沒有 `origin` 時先自行建立 GitHub repo 並 `! git remote add origin <repo URL>`。
4. 目前分支是 `main` 且會觸發部署時，push 前先跑 `/deploy-check` 的部署設定檢查（步驟 3、4）。
5. push 被拒（non-fast-forward、保護分支、驗證失敗）時回報錯誤原文；遠端有本機沒有的 commit 時建議 `git pull --rebase` 由使用者決定，不自行 rebase、不 force。
6. 有 `.github/workflows/` 時：`gh run list --branch <分支> --limit 1` 取得 run id，`gh run watch <id>` 追到結束；失敗時用 `gh run view <id> --log-failed` 回報原因，不自動修改或重跑。

回報：commit hash 與標題、是否已推送、CI 結果。
