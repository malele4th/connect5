# 这是一个完全由 cursor auto模式的agent开发的五子棋游戏

部署后请用完整路径访问：**`http://<服务器IP>/web/connect5/`**（根路径 `/` 不再自动跳转到五子棋，便于同机部署其他站点）。开发：`npm run dev` 后打开 **`http://localhost:8686/web/connect5/`**。

---

# 查看服务状态
systemctl status connect5-ws 

# 找出相关进程
ps aux | grep -E 'tsx|connect5|server/index' | grep -v grep 

# 查看进程
top -p $(pgrep -f 'server/index.ts' | tr '\n' ',' | sed 's/,$//')