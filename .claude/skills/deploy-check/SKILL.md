---
name: deploy-check
description: push 到 main 之前的上線檢查：執行與 CI 相同的關卡、確認 web 的 base 路徑與 hash 路由、mock fallback、API 環境變數與 CORS，push 後追蹤 GitHub Actions 結果。使用時機：/deploy-check，或使用者說「可以上線嗎」「幫我部署」「push 之前檢查」。
---

# 上線檢查

推送由 `/git-commit` 完成；本 skill 是 push `main`（會觸發部署）前的完整上線檢查。

部署方式以 `docs/PRD-deploy.md` 為準；該 PRD 尚未完成時，先告知使用者並只執行本機關卡。

## 步驟

1. **狀態**：`git status`、`git log origin/main..HEAD --oneline`，列出將上線的 commit。有未 commit 的變更時停止並詢問。
2. **本機關卡**（與 CI 相同順序，任一失敗就停止）：
   1. `npm run lint`
   2. `npm run typecheck`
   3. `npm test`
   4. `npm run build`
   5. `npm run test:e2e`（本機沒有瀏覽器時註明由 CI 執行）
3. **web 設定**：
   - `apps/web` 的 `base` 與 `.github/workflows/ci.yml` 的部署資料夾一致。
   - 使用 hash 路由；`dist/index.html` 引用的資源都帶正確 base。
   - 正式版 `VITE_API_BASE` 指向線上 API；API 無回應時會 fallback mock（用 `npm run preview -w apps/web` 並關閉 API 驗證一次）。
4. **API 設定**：
   - CORS 只允許正式網域與 localhost。
   - 資料庫路徑、保留期、模擬器開關由環境變數設定，沒有寫死的本機路徑。
   - 改了資料表結構時，說明遷移方式（啟動時自動 migration 或重建），提醒使用者自行在主機上確認，不代為操作。
5. **確認**：列出上線內容與風險，請使用者明確同意後才 `git push origin main`。
6. **追蹤**：
   - `gh run list --limit 1` 取得 run id，`gh run watch <id>` 追到結束。
   - 失敗時用 `gh run view <id> --log-failed` 取出失敗步驟，回報原因，不自動重試或修改。
   - 成功後提示使用者開啟線上網址確認 http 與 mock 兩種模式。

## 原則

- 不使用 `--no-verify`、不 force push。
- 不代為操作雲端主機或修改 GitHub Secrets。
