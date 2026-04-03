# 这是一个完全由 cursor auto模式的agent开发的五子棋游戏

部署后访问：**`http://<服务器IP>/web/connect5/`**（根路径 `/` 会 302 到此处）。开发：`npm run dev` 后打开 **`http://localhost:8686/web/connect5/`**。

---

# 查看服务状态
systemctl status connect5-ws 

# 找出相关进程
ps aux | grep -E 'tsx|connect5|server/index' | grep -v grep 

# 查看进程
top -p $(pgrep -f 'server/index.ts' | tr '\n' ',' | sed 's/,$//')