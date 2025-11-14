# Cloudflare Workers Aabacada版-简单笔记

📒 Aabacada版-简单笔记，基于`Cloudflare-notepad`项目的二次开发 https://github.com/linaut/Cloudflare-notepad
一个部署于 **Cloudflare Workers + KV** 搭建的极简记事本应用

---
## ✨ 功能特点（自行研究-简单）

- ⚠️**默认密码**
	-  默认密码：`admin` 进后台管理及时修改
	-  修改后如果忘记了密码，可以进KV空间 →  `notes_kv` → KV对 → 搜索`password`
- 📂 **目录浏览**  
  - 首页自动列出所有笔记，显示文件名、创建时间和更新时间。
  - 目录页显示创建时间与最后更新时间（浏览器本地时间）

- ⏰ **笔记支持导出导入**  
  - 管理后台可以导出笔记到本地备份  

- 📱 **支持Markdown**
	- 支持简单的Markdown可以预览效果
## 🚀 部署方法（文字版）

### 1. 创建 Workers KV
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)  
2. 进入 **存储和数据库 → Workers KV → Create Instance → 创建 KV 命名空间**  
3. 命名为 `NOTES_KV` 

### 2. 创建 Worker
1. 进入 **计算机和Ai → Workers和Pages → Workers → 开始使用 → 填写Worker名称 → 部署**  
2. 绑定刚才创建的`KV空间`
3. 将仓库中的 `index.js` 代码粘贴到编辑器中并部署
4. 添加自定义域名

<details>
<summary><strong>👉 点击查看部署方法（图片版）</strong></summary>

### 1. 创建 Workers KV
![](./doc/kv1.png)
![](./doc/kv2.png)

### 2. 创建 Worker
![](./doc/bs1.png)
![](./doc/bs2.png)
![](./doc/bs3.png)
![](./doc/bs4.png)
![](./doc/bs5.png)
![](./doc/bs6.png)
![](./doc/bs7.png)
![](./doc/bs8.png)
![](./doc/bs9.png)

</details>

## 网站截图示例
![](./doc/notes1.png)
![](./doc/notes2.png)
![](./doc/notes3.png)