# 这是一个完全由 cursor auto模式的agent开发的五子棋游戏

部署后请用完整路径访问：**`http://<服务器IP>/web/connect5/`**。若同机已用 **my_web** 的 [`deploy/install-server.sh`](../my_web/deploy/install-server.sh) 合并 80 端口配置，根路径 **`/`** 为个人站，五子棋仍在 **`/web/connect5/`**；此时请 **勿** 再启用独立的 `sites-enabled/connect5`（`connect5/deploy/install-server.sh` 会自动跳过 Nginx 站点）。开发：`npm run dev` 后打开 **`http://localhost:8686/web/connect5/`**。

---

# 查看服务状态
systemctl status connect5-ws 

# 找出相关进程
ps aux | grep -E 'tsx|connect5|server/index' | grep -v grep 

# 查看进程
top -p $(pgrep -f 'server/index.ts' | tr '\n' ',' | sed 's/,$//')