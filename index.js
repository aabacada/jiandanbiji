addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

const INDEX_KEY = "__index__";
const PASSWORD_KEY = "password";
const SESSION_KEY = "__session__";

// 默认密码
const DEFAULT_PASSWORD = "admin";

// 生成随机会话ID
function generateSessionId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 验证会话是否有效
async function isValidSession(sessionId) {
  try {
    const sessionData = await NOTES_KV.get(SESSION_KEY);
    if (!sessionData) return false;
    
    const sessions = JSON.parse(sessionData);
    const session = sessions[sessionId];
    
    if (!session) return false;
    
    // 检查会话是否过期（24小时）
    const now = new Date();
    const sessionTime = new Date(session.created_at);
    const hoursDiff = (now - sessionTime) / (1000 * 60 * 60);
    
    return hoursDiff < 24;
  } catch (e) {
    console.error("验证会话失败:", e);
    return false;
  }
}

// 创建新会话
async function createSession() {
  try {
    const sessionId = generateSessionId();
    const now = new Date().toISOString();
    
    let sessionData = await NOTES_KV.get(SESSION_KEY);
    let sessions = sessionData ? JSON.parse(sessionData) : {};
    
    // 清理过期会话
    const nowTime = new Date();
    Object.keys(sessions).forEach(key => {
      const sessionTime = new Date(sessions[key].created_at);
      const hoursDiff = (nowTime - sessionTime) / (1000 * 60 * 60);
      if (hoursDiff >= 24) {
        delete sessions[key];
      }
    });
    
    // 添加新会话
    sessions[sessionId] = {
      created_at: now
    };
    
    await NOTES_KV.put(SESSION_KEY, JSON.stringify(sessions));
    return sessionId;
  } catch (e) {
    console.error("创建会话失败:", e);
    return null;
  }
}

// 验证密码
async function verifyPassword(password) {
  try {
    let storedPassword = await NOTES_KV.get(PASSWORD_KEY);
    
    // 如果没有设置密码，使用默认密码
    if (!storedPassword) {
      storedPassword = DEFAULT_PASSWORD;
    }
    
    return password === storedPassword;
  } catch (e) {
    console.error("验证密码失败:", e);
    return false;
  }
}

// 更新密码
async function updatePassword(newPassword) {
  try {
    await NOTES_KV.put(PASSWORD_KEY, newPassword);
    return true;
  } catch (e) {
    console.error("更新密码失败:", e);
    return false;
  }
}

// 登录页面HTML
function getLoginPage(error = "") {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📒 笔记应用 - 登录</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #333;
    }
    .login-container {
      background-color: rgba(255, 255, 255, 0.95);
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-sizing: border-box;
    }
    .login-header {
      text-align: center;
      margin-bottom: 30px;
    }
    .login-header h1 {
      font-size: 28px;
      margin: 0;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .form-group input {
      width: 100%;
      padding: 12px 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 16px;
      box-sizing: border-box;
    }
    .form-group input:focus {
      outline: none;
      border-color: #2575fc;
      box-shadow: 0 0 0 2px rgba(37, 117, 252, 0.2);
    }
    .login-btn {
      width: 100%;
      padding: 12px;
      background-color: #2575fc;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    .login-btn:hover {
      background-color: #1a5ad4;
    }
    .error-message {
      color: #e74c3c;
      margin-top: 15px;
      text-align: center;
      font-size: 14px;
    }
    .default-password {
      margin-top: 20px;
      padding: 10px;
      background-color: #f8f9fa;
      border-radius: 5px;
      font-size: 14px;
      text-align: center;
      color: #6c757d;
    }
    /* 深色模式支持 */
    @media (prefers-color-scheme: dark) {
      body {
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      }
      .login-container {
        background-color: rgba(52, 73, 94, 0.95);
        color: #f0f0f0;
      }
      .login-header h1 {
        color: #f0f0f0;
      }
      .form-group input {
        background-color: #34495e;
        border-color: #4a5f7a;
        color: #f0f0f0;
      }
      .default-password {
        background-color: #34495e;
        color: #aaa;
      }
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-header">
      <h1>📒 笔记应用</h1>
    </div>
    <form id="loginForm">
      <div class="form-group">
        <label for="password">密码</label>
        <input type="password" id="password" name="password" required autofocus>
      </div>
      <button type="submit" class="login-btn">登录</button>
      ${error ? `<div class="error-message">${error}</div>` : ''}
    </form>
  </div>

  <script>
    document.getElementById('loginForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const password = document.getElementById('password').value;
      
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // 设置会话cookie
          document.cookie = \`session_id=\${result.sessionId}; path=/; max-age=\${24 * 60 * 60}\`;
          // 重定向到原请求的页面或首页
          const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/';
          window.location.href = redirectUrl;
        } else {
          // 显示错误信息
          const errorDiv = document.querySelector('.error-message') || document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.textContent = '密码错误，请重试';
          
          if (!document.querySelector('.error-message')) {
            document.getElementById('loginForm').appendChild(errorDiv);
          }
        }
      } catch (error) {
        console.error('登录请求失败:', error);
        const errorDiv = document.querySelector('.error-message') || document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = '登录请求失败，请重试';
        
        if (!document.querySelector('.error-message')) {
          document.getElementById('loginForm').appendChild(errorDiv);
        }
      }
    });
  </script>
</body>
</html>`;
}

// 密码修改页面HTML
function getChangePasswordPage(error = "", success = "") {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>📒 笔记应用 - 修改密码</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #333;
    }
    .change-password-container {
      background-color: rgba(255, 255, 255, 0.95);
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      padding: 40px;
      width: 100%;
      max-width: 400px;
      box-sizing: border-box;
    }
    .change-password-header {
      text-align: center;
      margin-bottom: 30px;
    }
    .change-password-header h1 {
      font-size: 28px;
      margin: 0;
      color: #333;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .form-group input {
      width: 100%;
      padding: 12px 15px;
      border: 1px solid #ddd;
      border-radius: 5px;
      font-size: 16px;
      box-sizing: border-box;
    }
    .form-group input:focus {
      outline: none;
      border-color: #2575fc;
      box-shadow: 0 0 0 2px rgba(37, 117, 252, 0.2);
    }
    .change-password-btn {
      width: 100%;
      padding: 12px;
      background-color: #2575fc;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    .change-password-btn:hover {
      background-color: #1a5ad4;
    }
    .back-btn {
      width: 100%;
      padding: 12px;
      background-color: #6c757d;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.3s;
      margin-top: 10px;
    }
    .back-btn:hover {
      background-color: #5a6268;
    }
    .error-message {
      color: #e74c3c;
      margin-top: 15px;
      text-align: center;
      font-size: 14px;
    }
    .success-message {
      color: #28a745;
      margin-top: 15px;
      text-align: center;
      font-size: 14px;
    }
    /* 深色模式支持 */
    @media (prefers-color-scheme: dark) {
      body {
        background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
      }
      .change-password-container {
        background-color: rgba(52, 73, 94, 0.95);
        color: #f0f0f0;
      }
      .change-password-header h1 {
        color: #f0f0f0;
      }
      .form-group input {
        background-color: #34495e;
        border-color: #4a5f7a;
        color: #f0f0f0;
      }
    }
  </style>
</head>
<body>
  <div class="change-password-container">
    <div class="change-password-header">
      <h1>📒 修改密码</h1>
    </div>
    <form id="changePasswordForm">
      <div class="form-group">
        <label for="currentPassword">当前密码</label>
        <input type="password" id="currentPassword" name="currentPassword" required>
      </div>
      <div class="form-group">
        <label for="newPassword">新密码</label>
        <input type="password" id="newPassword" name="newPassword" required>
      </div>
      <div class="form-group">
        <label for="confirmPassword">确认新密码</label>
        <input type="password" id="confirmPassword" name="confirmPassword" required>
      </div>
      <button type="submit" class="change-password-btn">修改密码</button>
      <button type="button" class="back-btn" onclick="window.location.href='/'">返回首页</button>
      ${error ? `<div class="error-message">${error}</div>` : ''}
      ${success ? `<div class="success-message">${success}</div>` : ''}
    </form>
  </div>

  <script>
    document.getElementById('changePasswordForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // 验证新密码和确认密码是否一致
      if (newPassword !== confirmPassword) {
        const errorDiv = document.querySelector('.error-message') || document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = '新密码和确认密码不一致';
        
        if (!document.querySelector('.error-message')) {
          document.getElementById('changePasswordForm').appendChild(errorDiv);
        }
        
        // 清除成功消息
        const successDiv = document.querySelector('.success-message');
        if (successDiv) {
          successDiv.remove();
        }
        
        return;
      }
      
      try {
        const response = await fetch('/change-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ currentPassword, newPassword })
        });
        
        const result = await response.json();
        
        if (result.success) {
          // 显示成功消息
          const successDiv = document.querySelector('.success-message') || document.createElement('div');
          successDiv.className = 'success-message';
          successDiv.textContent = result.message || '密码修改成功';
          
          if (!document.querySelector('.success-message')) {
            document.getElementById('changePasswordForm').appendChild(successDiv);
          }
          
          // 清除错误消息
          const errorDiv = document.querySelector('.error-message');
          if (errorDiv) {
            errorDiv.remove();
          }
          
          // 清空表单
          document.getElementById('changePasswordForm').reset();
        } else {
          // 显示错误信息
          const errorDiv = document.querySelector('.error-message') || document.createElement('div');
          errorDiv.className = 'error-message';
          errorDiv.textContent = result.error || '密码修改失败';
          
          if (!document.querySelector('.error-message')) {
            document.getElementById('changePasswordForm').appendChild(errorDiv);
          }
          
          // 清除成功消息
          const successDiv = document.querySelector('.success-message');
          if (successDiv) {
            successDiv.remove();
          }
        }
      } catch (error) {
        console.error('密码修改请求失败:', error);
        const errorDiv = document.querySelector('.error-message') || document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = '密码修改请求失败，请重试';
        
        if (!document.querySelector('.error-message')) {
          document.getElementById('changePasswordForm').appendChild(errorDiv);
        }
      }
    });
  </script>
</body>
</html>`;
}

async function handleRequest(event) {
  const request = event.request;
  let url;
  try { url = new URL(request.url); } catch(e){ return new Response("Invalid URL", {status:400}); }

  // 处理登录请求
  if (url.pathname === "/login" && request.method === "POST") {
    try {
      const { password } = await request.json();
      const isValid = await verifyPassword(password);
      
      if (isValid) {
        const sessionId = await createSession();
        if (sessionId) {
          return new Response(JSON.stringify({ 
            success: true, 
            sessionId: sessionId 
          }), { 
            headers: { "Content-Type": "application/json" } 
          });
        } else {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "创建会话失败" 
          }), { 
            status: 500,
            headers: { "Content-Type": "application/json" } 
          });
        }
      } else {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "密码错误" 
        }), { 
          status: 401,
          headers: { "Content-Type": "application/json" } 
        });
      }
    } catch (e) {
      console.error("处理登录请求失败:", e);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "请求处理失败" 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      });
    }
  }

  // 处理密码修改请求
  if (url.pathname === "/change-password" && request.method === "POST") {
    // 先验证会话
    const sessionId = getSessionIdFromRequest(request);
    const validSession = sessionId ? await isValidSession(sessionId) : false;
    
    if (!validSession) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "未授权访问" 
      }), { 
        status: 401,
        headers: { "Content-Type": "application/json" } 
      });
    }
    
    try {
      const { currentPassword, newPassword } = await request.json();
      
      // 验证当前密码
      const isValid = await verifyPassword(currentPassword);
      
      if (!isValid) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "当前密码错误" 
        }), { 
          status: 401,
          headers: { "Content-Type": "application/json" } 
        });
      }
      
      // 更新密码
      const updateSuccess = await updatePassword(newPassword);
      
      if (updateSuccess) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: "密码已更新" 
        }), { 
          headers: { "Content-Type": "application/json" } 
        });
      } else {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "密码更新失败" 
        }), { 
          status: 500,
          headers: { "Content-Type": "application/json" } 
        });
      }
    } catch (e) {
      console.error("处理密码修改请求失败:", e);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "请求处理失败" 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      });
    }
  }

  // 从请求中获取会话ID
  function getSessionIdFromRequest(req) {
    // 尝试从Cookie中获取
    const cookieHeader = req.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      
      if (cookies.session_id) {
        return cookies.session_id;
      }
    }
    
    // 尝试从查询参数中获取
    const sessionId = url.searchParams.get('session_id');
    if (sessionId) {
      return sessionId;
    }
    
    return null;
  }

  // 检查是否需要密码验证
  const sessionId = getSessionIdFromRequest(request);
  const validSession = sessionId ? await isValidSession(sessionId) : false;
  
  // 如果会话无效且不是登录页面或密码修改页面，则重定向到登录页面
  if (!validSession && url.pathname !== "/login" && url.pathname !== "/change-password-page") {
    // 构建登录URL，包含重定向参数
    const loginUrl = `${url.origin}/login?redirect=${encodeURIComponent(url.pathname + url.search)}`;
    return new Response(getLoginPage(), {
      status: 200,
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }

  // 处理密码修改页面请求
  if (url.pathname === "/change-password-page") {
    return new Response(getChangePasswordPage(), {
      status: 200,
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }

  let noteName;
  try { noteName = decodeURIComponent(url.pathname.slice(1)) || generateRandomNote(); } catch(e){ noteName = generateRandomNote(); }

  function isValidNoteName(name){
    if(!name || name.length > 50) return false;
  // 排除控制字符和路径符号
  if(/[\u0000-\u001F\u007F\/\\]/.test(name)) return false;
    return true;
  }

  // 非法笔记名直接提示
  if(!isValidNoteName(noteName) && url.pathname !== "/"){
    return new Response(`<script>alert("笔记名非法");history.back();</script>`, 
      { headers:{ "Content-Type":"text/html;charset=UTF-8" } });
  }
  
  const method = request.method;
  const isRaw = url.searchParams.has("raw");

  // POST 保存逻辑
  if(method === "POST"){
    let body = await request.text();
    let title = "";
    let content = body;
    
    // 尝试解析JSON格式的请求体（包含标题和内容）
    try {
      const data = JSON.parse(body);
      title = data.title || "";
      content = data.content || "";
    } catch(e) {
      // 如果不是JSON格式，则整个body作为内容
      content = body;
    }

    // 处理新建笔记请求（空内容）
    if(content.trim() === "" && !await NOTES_KV.get(noteName)){
      const now = new Date().toISOString();
      const noteData = {
        title: title,
        content: "",
        created_at: now,
        updated_at: now
      };
      
      try {
        await NOTES_KV.put(noteName, JSON.stringify(noteData));
        await updateIndex(noteName, { title, created_at: now, updated_at: now });
        return new Response(JSON.stringify({ created_at: now, updated_at: now }), 
          { headers:{ "Content-Type":"application/json" } });
      } catch(e){ 
        console.error("创建笔记失败:", e); 
        return new Response("创建笔记失败",{status:500}); 
      }
    }

    // 删除空文件（只有当内容和标题都为空时才删除）
    if(!content.trim() && !title.trim()){
      try { await NOTES_KV.delete(noteName); } catch(e){ console.error("删除 KV 失败:", e); }
      await updateIndex(noteName, null);
      return new Response(JSON.stringify({ deleted:true }), { headers:{ "Content-Type":"application/json" } });
    }

    let existingObj;
    try {
      const existingNote = await NOTES_KV.get(noteName);
      existingObj = existingNote ? JSON.parse(existingNote) : null;
    } catch(e){ existingObj=null; }

    const createdAt = existingObj?.created_at || new Date().toISOString();
    const updatedAt = new Date().toISOString();

    try {
      await NOTES_KV.put(noteName, JSON.stringify({ title, content, created_at:createdAt, updated_at:updatedAt }));
      await updateIndex(noteName, { title, created_at: createdAt, updated_at: updatedAt });
    } catch(e){ console.error("保存 KV 失败:", e); return new Response("KV 保存失败",{status:500}); }

    return new Response(JSON.stringify({ created_at:createdAt, updated_at:updatedAt }),
      { headers:{ "Content-Type":"application/json" } });
  }

  // 处理笔记删除的DELETE请求
  if(method === "DELETE"){
    try{
      await NOTES_KV.delete(noteName);
      await updateIndex(noteName, null);
      return new Response(JSON.stringify({success:true}), 
        { headers:{ "Content-Type":"application/json" } });
    } catch(e){
      console.error("删除笔记失败", e);
      return new Response("删除失败",{status:500});
    }
  }

  // RAW 请求
  if(isRaw){
    try{
      let note = await NOTES_KV.get(noteName);
      if(note){
        try { note = JSON.parse(note).content; } catch(e) {}
        return new Response(note,{ headers:{ "Content-Type":"text/plain;charset=UTF-8" } });
      }
      else return new Response("Not found",{status:404});
    } catch(e){ return new Response("KV 获取失败",{status:500}); }
  }

  // 目录 JSON（用于 AJAX 刷新）
  if(url.pathname === "/" && url.searchParams.get("list") === "1"){
    try {
      let indexData = await NOTES_KV.get(INDEX_KEY);
      let arr = indexData ? JSON.parse(indexData) : [];
      
      // 如果请求包含内容搜索，则获取每个笔记的内容
      const includeContent = url.searchParams.get("includeContent") === "1";
      if (includeContent) {
        // 为每个笔记添加内容信息
        for (let i = 0; i < arr.length; i++) {
          try {
            const noteData = await NOTES_KV.get(arr[i].name);
            if (noteData) {
              const noteObj = JSON.parse(noteData);
              arr[i].content = noteObj.content || "";
            } else {
              arr[i].content = "";
            }
          } catch (e) {
            console.error("获取笔记内容失败:", e);
            arr[i].content = "";
          }
        }
      }
      
      // 按序号排序（数字序号优先，非数字序号按字母顺序）
      arr.sort((a,b)=>{
        const aId = parseInt(a.name);
        const bId = parseInt(b.name);
        
        // 如果都是数字，按数字大小从大到小排序
        if (!isNaN(aId) && !isNaN(bId)) {
          return bId - aId;
        }
        
        // 如果只有一个是数字，数字排在前面
        if (!isNaN(aId)) return -1;
        if (!isNaN(bId)) return 1;
        
        // 如果都不是数字，按字母顺序排序
        return a.name.localeCompare(b.name);
      });
      return new Response(JSON.stringify(arr), { headers:{ "Content-Type":"application/json" } });
    } catch(e){
      return new Response("索引读取失败",{status:500});
    }
  }

  // 获取下一个可用序号
  if(url.pathname === "/next-id"){
    try {
      let indexData = await NOTES_KV.get(INDEX_KEY);
      let arr = indexData ? JSON.parse(indexData) : [];
      let maxId = 0;
      
      // 查找当前最大的数字ID
      arr.forEach(item => {
        const id = parseInt(item.name);
        if (!isNaN(id) && id > maxId) {
          maxId = id;
        }
      });
      
      // 返回下一个可用ID
      return new Response(JSON.stringify({ nextId: maxId + 1 }), 
        { headers:{ "Content-Type":"application/json" } });
    } catch(e){
      return new Response("获取序号失败",{status:500});
    }
  }

  // 后台管理页面
  if(url.pathname === "/admin"){
    let html = `<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📒 后台管理</title>
<style>
/* iOS 26 风格变量 */
:root {
  /* iOS 26 色彩系统 */
  --ios-blue: #007AFF;
  --ios-blue-light: #5AC8FA;
  --ios-green: #34C759;
  --ios-orange: #FF9500;
  --ios-red: #FF3B30;
  --ios-purple: #AF52DE;
  --ios-pink: #FF2D92;
  --ios-indigo: #5856D6;
  --ios-teal: #5AC8FA;
  --ios-yellow: #FFCC00;
  
  /* 中性色调 */
  --ios-gray: #8E8E93;
  --ios-gray-light: #C7C7CC;
  --ios-gray-ultralight: #F2F2F7;
  --ios-gray-dark: #636366;
  --ios-gray-background: #000000;
  --ios-gray-card: #1C1C1E;
  --ios-gray-secondary: #48484A;
  --ios-gray-tertiary: #3A3A3C;
  
  /* 系统背景色 */
  --system-background: #FFFFFF;
  --system-secondary-background: #F2F2F7;
  --system-tertiary-background: #FFFFFF;
  --system-grouped-background: #F2F2F7;
  
  /* 文本颜色 */
  --label-color: #000000;
  --secondary-label-color: #3C3C43;
  --tertiary-label-color: #3C3C433D;
  --quaternary-label-color: #3C3C432E;
  
  /* 阴影和模糊 */
  --small-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --medium-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.06);
  --large-shadow: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  --card-shadow: 0 8px 16px rgba(0, 0, 0, 0.1), 0 3px 6px rgba(0, 0, 0, 0.05);
  
  /* 圆角 */
  --small-radius: 8px;
  --medium-radius: 12px;
  --large-radius: 16px;
  --xlarge-radius: 20px;
  
  /* 模糊效果 */
  --frosted-glass: blur(20px);
  --light-frosted-glass: blur(10px);
}

/* 深色模式变量 */
@media (prefers-color-scheme: dark) {
  :root {
    /* 系统背景色 */
    --system-background: #000000;
    --system-secondary-background: #1C1C1E;
    --system-tertiary-background: #2C2C2E;
    --system-grouped-background: #000000;
    
    /* 文本颜色 */
    --label-color: #FFFFFF;
    --secondary-label-color: #EBEBF5;
    --tertiary-label-color: #EBEBF54D;
    --quaternary-label-color: #EBEBF53D;
    
    /* 阴影和模糊 */
    --small-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    --medium-shadow: 0 4px 6px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15);
    --large-shadow: 0 10px 15px rgba(0, 0, 0, 0.25), 0 4px 6px rgba(0, 0, 0, 0.15);
    --card-shadow: 0 8px 16px rgba(0, 0, 0, 0.3), 0 3px 6px rgba(0, 0, 0, 0.2);
  }
}

/* 基础样式 */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body { 
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  background: #f5f7fa;
  color: var(--label-color);
  line-height: 1.5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

/* iOS 26 磨砂玻璃背景 */
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80') center/cover no-repeat;
  filter: brightness(0.7) saturate(1.2);
  z-index: -2;
}

body::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  z-index: -1;
}

/* 深色模式背景调整 */
@media (prefers-color-scheme: dark) {
  body {
    background: #2c3e50;
  }
  
  body::after {
    background: rgba(28, 28, 30, 0.85);
  }
}

/* 主容器 */
.container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

/* 顶部区域 */
.header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 20px 30px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

/* 移除header悬浮效果 */

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--label-color);
  user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;
}

.title::before {
  content: "📒";
  font-size: 1.8rem;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* 批量操作区域 */
.batch-actions {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 20px 30px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 15px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.batch-actions:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15), 0 5px 8px rgba(0, 0, 0, 0.08);
}

.batch-actions > div:first-child {
  display: flex;
  gap: 10px;
  align-items: center;
}

/* 笔记列表区域 */
.notes-section {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 20px 30px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  flex: 1;
}

.notes-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15), 0 5px 8px rgba(0, 0, 0, 0.08);
}

ul { 
  list-style:none; 
  padding:0;
  margin: 0;
}

li { 
  margin:10px 0; 
  background: rgba(255, 255, 255, 0.9);
  padding: 15px;
  border-radius: var(--large-radius);
  box-shadow: var(--small-shadow);
  display: flex;
  align-items: center;
  gap: 15px;
  transition: all 0.3s ease;
}

li:hover {
  transform: translateY(-2px);
  box-shadow: var(--medium-shadow);
}

a { 
  text-decoration:none; 
  color: var(--label-color);
  font-size:1.1em;
  flex-grow: 1;
  font-weight: 600;
}

a:hover { 
  text-decoration:none;
  color: var(--ios-blue);
}

/* iOS 26 按钮样式 */
.btn {
  padding: 10px 16px;
  border-radius: var(--medium-radius);
  font-weight: 600;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: var(--small-shadow);
  position: relative;
  overflow: hidden;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--medium-shadow);
}

.btn:active {
  transform: translateY(0);
  box-shadow: var(--small-shadow);
}

.btn.primary {
  background: linear-gradient(135deg, var(--ios-blue) 0%, var(--ios-blue-light) 100%);
  color: white;
}

.btn.success {
  background: linear-gradient(135deg, var(--ios-green) 0%, #30D158 100%);
  color: white;
}

.btn.danger {
  background: #FF3B30;
  color: white;
}

.btn.secondary {
  background: linear-gradient(135deg, var(--ios-gray) 0%, #8E8E93 100%);
  color: white;
}

/* 复选框样式 */
.checkbox-container {
  display: flex;
  align-items: center;
  margin-right: 10px;
}

.checkbox-container input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin-right: 5px;
  accent-color: var(--ios-blue);
}

/* 时间信息 */
.time-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem; 
  color: var(--secondary-label-color);
  margin-top: 5px;
  white-space: nowrap;
}

/* 提示消息 */
.message {
  padding: 15px 20px;
  border-radius: var(--large-radius);
  margin-bottom: 20px;
  display: none;
  font-weight: 500;
  backdrop-filter: var(--light-frosted-glass);
  -webkit-backdrop-filter: var(--light-frosted-glass);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.message.success {
  background-color: rgba(52, 199, 89, 0.2);
  color: white;
  border-color: rgba(52, 199, 89, 0.3);
}

.message.error {
  background-color: rgba(255, 59, 48, 0.2);
  color: var(--ios-red);
  border-color: rgba(255, 59, 48, 0.3);
}

.message.info {
  background-color: rgba(0, 122, 255, 0.2);
  color: var(--ios-blue);
  border-color: rgba(0, 122, 255, 0.3);
}

/* 模态框 */
.modal {
  display: none;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.5);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
}

.modal-content {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  margin: 15% auto;
  padding: 25px;
  border-radius: var(--xlarge-radius);
  width: 80%;
  max-width: 500px;
  box-shadow: var(--large-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--label-color);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.close {
  color: var(--ios-gray);
  font-size: 28px;
  font-weight: bold;
  cursor: pointer;
  transition: color 0.2s;
}

.close:hover {
  color: var(--ios-gray-dark);
}

/* 深色模式调整 */
@media (prefers-color-scheme: dark) {
  .header, .batch-actions, .notes-section, .modal-content {
    background: rgba(28, 28, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  li {
    background: rgba(44, 44, 46, 0.9);
  }
  
  .time-info {
    color: var(--secondary-label-color);
  }
  
  .message {
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .modal-header {
    color: var(--label-color);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  body {
    padding: 15px;
  }
  
  .container {
    padding: 0 10px;
  }
  
  .header, .batch-actions, .notes-section {
    padding: 15px 20px;
    border-radius: var(--large-radius);
  }
  
  .title {
    font-size: 1.2rem;
  }
  
  .actions {
    flex-direction: column;
    width: 100%;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .header, .batch-actions, .notes-section {
    padding: 12px 15px;
  }
  
  .title {
    font-size: 1rem;
  }
  
  li {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  
  .checkbox-container {
    align-self: flex-end;
  }
}
</style>
</head>
<body>
<div class="container">
  <header class="header">
    <div class="title">
      后台管理
    </div>
    <div class="actions">
      <a href="/" class="btn secondary">← 返回首页</a>
      <a href="/change-password-page" class="btn secondary">🔐 修改密码</a>
      <button id="selectAllBtn" class="btn secondary">全选</button>
      <button id="deselectAllBtn" class="btn secondary">取消全选</button>
      <button id="batchDeleteBtn" class="btn danger">批量删除</button>
      <button id="exportAllBtn" class="btn success">导出全部</button>
    </div>
  </header>

  <div id="message" class="message"></div>

  <div class="batch-actions">
    <div>
      <button id="importBtn" class="btn primary">📥 导入笔记</button>
      <button id="exportBtn" class="btn success">📤 导出选中</button>
    </div>
    <div>
      <span id="selectedCount">已选择 0 项</span>
    </div>
  </div>

  <div class="notes-section">
    <ul id="notesList"></ul>
  </div>
</div>

<input type="file" id="fileInput" accept=".txt,.md,.json" multiple style="display: none;">

<!-- 确认删除模态框 -->
<div id="deleteModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3>确认删除</h3>
      <span class="close" id="closeModal">&times;</span>
    </div>
    <div class="modal-body">
      <p id="deleteMessage">确定要删除选中的笔记吗？此操作不可撤销。</p>
    </div>
    <div class="modal-footer">
      <button id="cancelDelete" class="btn secondary">取消</button>
      <button id="confirmDelete" class="btn danger">确认删除</button>
    </div>
  </div>
</div>

<script>
// 全局变量
let notes = [];
let selectedNotes = new Set();

// DOM 元素
const notesList = document.getElementById("notesList");
const messageDiv = document.getElementById("message");
const selectedCountSpan = document.getElementById("selectedCount");
const fileInput = document.getElementById("fileInput");
const deleteModal = document.getElementById("deleteModal");
const deleteMessage = document.getElementById("deleteMessage");
const closeModal = document.getElementById("closeModal");
const cancelDelete = document.getElementById("cancelDelete");
const confirmDelete = document.getElementById("confirmDelete");

// 显示消息
function showMessage(text, type = 'info') {
  messageDiv.textContent = text;
  messageDiv.className = \`message \${type}\`;
  messageDiv.style.display = 'block';
  
  setTimeout(() => {
    messageDiv.style.display = 'none';
  }, 5000);
}

// 格式化时间
function displayTime(t) {
  return t ? new Date(t).toLocaleString(undefined, {hour12:false}) : "未知";
}

// 加载笔记列表
async function loadList() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const resp = await fetch("/?list=1", { 
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      throw new Error("HTTP error! status: " + resp.status);
    }
    
    notes = await resp.json();
    renderNotesList();
  } catch(e) {
    console.error("加载目录失败", e);
    showMessage("加载笔记列表失败，请刷新页面重试", "error");
  }
}

// 渲染笔记列表
function renderNotesList() {
  notesList.innerHTML = "";
  
  notes.forEach(item => {
    const li = document.createElement("li");
    
    // 复选框
    const checkboxContainer = document.createElement("div");
    checkboxContainer.className = "checkbox-container";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.noteName = item.name;
    checkbox.checked = selectedNotes.has(item.name);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        selectedNotes.add(item.name);
      } else {
        selectedNotes.delete(item.name);
      }
      updateSelectedCount();
    });
    
    checkboxContainer.appendChild(checkbox);
    
    // 笔记链接
    const titleDisplay = item.title ? " - " + item.title : "";
    const link = document.createElement("a");
    link.href = "/" + encodeURIComponent(item.name);
    link.textContent = item.name + titleDisplay;
    
    // 时间信息
    const timeInfo = document.createElement("div");
    timeInfo.className = "time-info";
    timeInfo.innerHTML = \`创建: \${displayTime(item.created_at)} | 更新: \${displayTime(item.updated_at)}\`;
    
    // 组装元素
    li.appendChild(checkboxContainer);
    li.appendChild(link);
    li.appendChild(timeInfo);
    
    notesList.appendChild(li);
  });
  
  updateSelectedCount();
}

// 更新选中计数
function updateSelectedCount() {
  selectedCountSpan.textContent = \`已选择 \${selectedNotes.size} 项\`;
}

// 全选
function selectAll() {
  notes.forEach(item => selectedNotes.add(item.name));
  renderNotesList();
}

// 取消全选
function deselectAll() {
  selectedNotes.clear();
  renderNotesList();
}

// 批量删除
function batchDelete() {
  if (selectedNotes.size === 0) {
    showMessage("请先选择要删除的笔记", "error");
    return;
  }
  
  deleteMessage.textContent = \`确定要删除选中的 \${selectedNotes.size} 条笔记吗？此操作不可撤销。\`;
  deleteModal.style.display = "block";
}

// 导出选中的笔记
async function exportSelected() {
  if (selectedNotes.size === 0) {
    showMessage("请先选择要导出的笔记", "error");
    return;
  }
  
  try {
    const exportData = [];
    
    for (const noteName of selectedNotes) {
      try {
        const resp = await fetch("/" + encodeURIComponent(noteName) + "?raw=1");
        if (resp.ok) {
          const content = await resp.text();
          const note = notes.find(n => n.name === noteName);
          exportData.push({
            name: noteName,
            title: note?.title || "",
            content: content,
            created_at: note?.created_at || "",
            updated_at: note?.updated_at || ""
          });
        }
      } catch (e) {
        console.error(\`导出笔记 \${noteName} 失败\`, e);
      }
    }
    
    // 创建下载链接
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = \`notes_export_\${new Date().toISOString().slice(0, 10)}.json\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage(\`成功导出 \${exportData.length} 条笔记\`, "success");
  } catch (e) {
    console.error("导出失败", e);
    showMessage("导出失败: " + e.message, "error");
  }
}

// 导出全部笔记
async function exportAll() {
  try {
    const exportData = [];
    
    for (const note of notes) {
      try {
        const resp = await fetch("/" + encodeURIComponent(note.name) + "?raw=1");
        if (resp.ok) {
          const content = await resp.text();
          exportData.push({
            name: note.name,
            title: note.title || "",
            content: content,
            created_at: note.created_at || "",
            updated_at: note.updated_at || ""
          });
        }
      } catch (e) {
        console.error(\`导出笔记 \${note.name} 失败\`, e);
      }
    }
    
    // 创建下载链接
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = \`notes_all_export_\${new Date().toISOString().slice(0, 10)}.json\`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showMessage(\`成功导出全部 \${exportData.length} 条笔记\`, "success");
  } catch (e) {
    console.error("导出全部失败", e);
    showMessage("导出全部失败: " + e.message, "error");
  }
}

// 导入笔记
async function importNotes(files) {
  if (!files || files.length === 0) return;
  
  let successCount = 0;
  let failCount = 0;
  
  for (const file of files) {
    try {
      const text = await file.text();
      let notesToImport = [];
      
      if (file.name.endsWith('.json')) {
        // JSON 格式导入
        try {
          notesToImport = JSON.parse(text);
          if (!Array.isArray(notesToImport)) {
            throw new Error("JSON 格式错误：应为数组");
          }
        } catch (e) {
          console.error(\`解析JSON文件 \${file.name} 失败\`, e);
          failCount++;
          continue;
        }
      } else {
        // TXT 或 MD 格式导入，每个文件作为一个笔记
        const fileName = file.name.replace(/\.(txt|md)$/i, "");
        notesToImport = [{
          name: fileName,
          title: fileName,
          content: text,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }];
      }
      
      // 导入每个笔记
      for (const note of notesToImport) {
        try {
          const noteName = note.name || note.title || \`imported_\${Date.now()}\`;
          const title = note.title || "";
          const content = note.content || "";
          
          const resp = await fetch("/" + encodeURIComponent(noteName), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content })
          });
          
          if (resp.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (e) {
          console.error(\`导入笔记 \${note.name} 失败\`, e);
          failCount++;
        }
      }
    } catch (e) {
      console.error(\`处理文件 \${file.name} 失败\`, e);
      failCount++;
    }
  }
  
  showMessage(\`导入完成：成功 \${successCount} 条，失败 \${failCount} 条\`, 
    failCount > 0 ? "error" : "success");
  
  // 重新加载列表
  loadList();
}

// 确认删除选中的笔记
async function confirmDeleteSelected() {
  deleteModal.style.display = "none";
  
  let successCount = 0;
  let failCount = 0;
  
  for (const noteName of selectedNotes) {
    try {
      const resp = await fetch("/" + encodeURIComponent(noteName), {
        method: "DELETE"
      });
      
      if (resp.ok) {
        successCount++;
      } else {
        failCount++;
      }
    } catch (e) {
      console.error(\`删除笔记 \${noteName} 失败\`, e);
      failCount++;
    }
  }
  
  showMessage(\`删除完成：成功 \${successCount} 条，失败 \${failCount} 条\`, 
    failCount > 0 ? "error" : "success");
  
  // 清空选择并重新加载列表
  selectedNotes.clear();
  loadList();
}

// 事件监听器
document.getElementById('selectAllBtn').addEventListener('click', selectAll);
document.getElementById('deselectAllBtn').addEventListener('click', deselectAll);
document.getElementById('batchDeleteBtn').addEventListener('click', batchDelete);
document.getElementById('exportBtn').addEventListener('click', exportSelected);
document.getElementById('exportAllBtn').addEventListener('click', exportAll);

// 文件上传相关
document.getElementById('importBtn').addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  importNotes(fileInput.files);
  fileInput.value = ''; // 清空文件输入，允许重复选择同一文件
});

// 模态框事件
closeModal.addEventListener('click', () => {
  deleteModal.style.display = "none";
});

cancelDelete.addEventListener('click', () => {
  deleteModal.style.display = "none";
});

confirmDelete.addEventListener('click', confirmDeleteSelected);

// 点击模态框外部关闭
window.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.style.display = "none";
  }
});

// 初始化
loadList();
</script>
</body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }

  // 检查是否需要创建默认笔记
  if(url.pathname === "/"){
    try {
      // 获取笔记索引
      let indexData = await NOTES_KV.get(INDEX_KEY);
      let notesList = indexData ? JSON.parse(indexData) : [];
      
      // 如果没有笔记，创建默认的Markdown示例笔记
      if (notesList.length === 0) {
        const defaultNoteName = "1";
        const defaultTitle = "笔记支持Markdown";
        const defaultContent = `# 欢迎使用 Markdown

## 功能特点

- **实时预览**: 支持实时Markdown预览
- **语法高亮**: 完整的语法高亮支持
- **多种导出**: 支持HTML等格式导出
- **响应式设计**: 完美适配各种设备
- **多语言支持**: 中英文界面切换

## 快速开始

开始编写您的Markdown文档吧！

\`\`\`javascript
console.log("Hello MarkdownPro!");
\`\`\`

> 这是一个引用示例

### 列表示例

1. 有序列表项1
2. 有序列表项2
3. 有序列表项3

- 无序列表项A
- 无序列表项B
- 无序列表项C

### 表格示例

| 功能 | 状态 | 说明 |
|------|------|------|
| 实时预览 | ✅ | 已完成 |
| 语法高亮 | ✅ | 已完成 |
| 导出功能 | ✅ | 已完成 |

**祝您使用愉快！`;
        const now = new Date().toISOString();
        
        // 创建默认笔记
        const noteData = {
          title: defaultTitle,
          content: defaultContent,
          created_at: now,
          updated_at: now
        };
        
        await NOTES_KV.put(defaultNoteName, JSON.stringify(noteData));
        await updateIndex(defaultNoteName, { 
          title: defaultTitle, 
          created_at: now, 
          updated_at: now 
        });
      }
    } catch(e) {
      console.error("创建默认笔记失败:", e);
    }
  }

  // 目录页
  if(url.pathname === "/"){
    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📒 Notes</title>
<style>
/* iOS 26 风格变量 */
:root {
  /* iOS 26 色彩系统 */
  --ios-blue: #007AFF;
  --ios-blue-light: #5AC8FA;
  --ios-green: #34C759;
  --ios-orange: #FF9500;
  --ios-red: #FF3B30;
  --ios-purple: #AF52DE;
  --ios-pink: #FF2D92;
  --ios-indigo: #5856D6;
  --ios-teal: #5AC8FA;
  --ios-yellow: #FFCC00;
  
  /* 中性色调 */
  --ios-gray: #8E8E93;
  --ios-gray-light: #C7C7CC;
  --ios-gray-ultralight: #F2F2F7;
  --ios-gray-dark: #636366;
  --ios-gray-background: #000000;
  --ios-gray-card: #1C1C1E;
  --ios-gray-secondary: #48484A;
  --ios-gray-tertiary: #3A3A3C;
  
  /* 系统背景色 */
  --system-background: #FFFFFF;
  --system-secondary-background: #F2F2F7;
  --system-tertiary-background: #FFFFFF;
  --system-grouped-background: #F2F2F7;
  
  /* 文本颜色 */
  --label-color: #000000;
  --secondary-label-color: #3C3C43;
  --tertiary-label-color: #3C3C433D;
  --quaternary-label-color: #3C3C432E;
  
  /* 阴影和模糊 */
  --small-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --medium-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.06);
  --large-shadow: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  --card-shadow: 0 8px 16px rgba(0, 0, 0, 0.1), 0 3px 6px rgba(0, 0, 0, 0.05);
  
  /* 圆角 */
  --small-radius: 8px;
  --medium-radius: 12px;
  --large-radius: 16px;
  --xlarge-radius: 20px;
  
  /* 模糊效果 */
  --frosted-glass: blur(20px);
  --light-frosted-glass: blur(10px);
}

/* 深色模式变量 */
@media (prefers-color-scheme: dark) {
  :root {
    /* 系统背景色 */
    --system-background: #000000;
    --system-secondary-background: #1C1C1E;
    --system-tertiary-background: #2C2C2E;
    --system-grouped-background: #000000;
    
    /* 文本颜色 */
    --label-color: #FFFFFF;
    --secondary-label-color: #EBEBF5;
    --tertiary-label-color: #EBEBF54D;
    --quaternary-label-color: #EBEBF53D;
    
    /* 阴影和模糊 */
    --small-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    --medium-shadow: 0 4px 6px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15);
    --large-shadow: 0 10px 15px rgba(0, 0, 0, 0.25), 0 4px 6px rgba(0, 0, 0, 0.15);
    --card-shadow: 0 8px 16px rgba(0, 0, 0, 0.3), 0 3px 6px rgba(0, 0, 0, 0.2);
  }
}

/* 基础样式 */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  background: #f5f7fa;
  color: var(--label-color);
  line-height: 1.5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

/* iOS 26 磨砂玻璃背景 */
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80') center/cover no-repeat;
  filter: brightness(0.7) saturate(1.2);
  z-index: -2;
}

body::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  z-index: -1;
}

/* 深色模式背景调整 */
@media (prefers-color-scheme: dark) {
  body {
    background: #2c3e50;
  }
  
  body::after {
    background: rgba(28, 28, 30, 0.85);
  }
}

/* 主容器 */
.container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
}

/* 头部区域 */
.header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 30px;
  margin-bottom: 25px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  gap: 25px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.header:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15), 0 5px 8px rgba(0, 0, 0, 0.08);
}

/* 标题区域 */
.title-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 15px;
}

.title {
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--label-color);
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  letter-spacing: -0.5px;
}

.title-icon {
  font-size: 2.5rem;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.version {
  font-size: 1.2rem;
  font-weight: 500;
  color: #666;
  margin-left: 1px;
  opacity: 0.8;
  position: relative;
  top: 5px;
}

/* GitHub链接样式 */
.github-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0px rgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12);
  transition: all 0.3s ease;
}

.github-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 4px -2px rgba(0,0,0,0.2),0px 4px 5px 0px rgba(0,0,0,0.14),0px 2px 10px 0px rgba(0,0,0,0.12);
  background: rgba(255, 255, 255, 1);
}

.github-icon {
  width: 24px;
  height: 24px;
  fill: #333;
  transition: fill 0.3s ease;
}

.github-link:hover .github-icon {
  fill: #007AFF;
}

/* 按钮组 */
.actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* iOS 26 按钮样式 */
.btn {
  padding: 12px 20px;
  border-radius: var(--medium-radius);
  font-weight: 600;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: var(--small-shadow);
  position: relative;
  overflow: hidden;
}

/* 移除涟漪动画效果 */

.btn-primary {
  background: linear-gradient(135deg, var(--ios-blue) 0%, var(--ios-blue-light) 100%);
  color: white;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.8);
  color: var(--ios-blue);
  border: 1px solid rgba(0, 122, 255, 0.2);
}

.btn-accent {
  background: linear-gradient(135deg, var(--ios-purple) 0%, var(--ios-pink) 100%);
  color: white;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--medium-shadow);
}

.btn:active {
  transform: translateY(0);
  box-shadow: var(--small-shadow);
}

/* 搜索区域 */
.search-section {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.search-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15), 0 5px 8px rgba(0, 0, 0, 0.08);
}

.search-container {
  position: relative;
  margin-bottom: 15px;
}

.search-input {
  width: 100%;
  padding: 16px 50px 16px 20px;
  border-radius: var(--large-radius);
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.9);
  font-size: 1rem;
  font-weight: 500;
  color: var(--label-color);
  transition: all 0.3s ease;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
}

.search-input:focus {
  outline: none;
  border-color: var(--ios-blue);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1), inset 0 1px 3px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.search-clear {
  position: absolute;
  right: 15px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--ios-gray);
  cursor: pointer;
  font-size: 1.2rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.search-clear:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--ios-gray-dark);
}

.search-clear:active {
  transform: translateY(-50%) scale(0.9);
}

.search-results-info {
  font-size: 0.9rem;
  color: var(--secondary-label-color);
  font-weight: 500;
  padding: 0 5px;
}

.no-results {
  color: var(--ios-red);
  font-style: italic;
}

/* 笔记列表区域 */
.notes-section {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 25px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  min-height: 300px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.notes-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15), 0 5px 8px rgba(0, 0, 0, 0.08);
}

#notesList {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

#notesList li {
  background: rgba(255, 255, 255, 0.9);
  border-radius: var(--large-radius);
  padding: 20px;
  box-shadow: var(--medium-shadow);
  transition: box-shadow 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.5);
  position: relative;
  overflow: hidden;
}

/* 移除左侧彩色边框 */
#notesList li::before {
  display: none;
}

/* 移除悬停效果 */

#notesList a {
  color: var(--label-color);
  text-decoration: none;
  font-weight: 600;
  font-size: 1.1rem;
  display: block;
  margin-bottom: 10px;
  transition: color 0.2s ease;
}

#notesList a:hover {
  color: var(--ios-blue);
}

.time-info {
  font-size: 0.85rem;
  color: var(--tertiary-label-color);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.time-info span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.time-info span::before {
  content: '•';
  color: var(--ios-gray-light);
  font-size: 0.8rem;
}

/* 深色模式调整 */
@media (prefers-color-scheme: dark) {
  .header, .search-section, .notes-section {
    background: rgba(28, 28, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  #notesList li {
    background: rgba(44, 44, 46, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  
  .search-input {
    background: rgba(44, 44, 46, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--label-color);
  }
  
  .search-clear:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  .github-link {
    background: rgba(44, 44, 46, 0.9);
  }
  
  .github-link svg {
    fill: #f0f0f0;
  }
  
  .github-link:hover svg {
    fill: #5AC8FA;
  }
  
  .version {
    color: #aaa;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  body {
    padding: 15px;
  }
  
  .container {
    padding: 0 10px;
  }
  
  .header, .search-section, .notes-section {
    padding: 20px;
    border-radius: var(--large-radius);
  }
  
  .title {
    font-size: 1.8rem;
  }
  
  .title-section {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .actions {
    width: 100%;
    justify-content: space-between;
  }
  
  .btn {
    padding: 10px 15px;
    font-size: 0.85rem;
  }
  
  #notesList {
    grid-template-columns: 1fr;
  }
  
  .version {
    top: 0px;
  }
  
  .github-link {
    position: absolute;
    top: 15px;
    right: 15px;
  }
}

@media (max-width: 480px) {
  .header, .search-section, .notes-section {
    padding: 15px;
  }
  
  .title {
    font-size: 1.5rem;
  }
  
  .actions {
    flex-direction: column;
    width: 100%;
  }
  
  .btn {
    width: 100%;
    justify-content: center;
  }
}

/* 移除动画效果 */

/* 加载状态 */
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(0, 122, 255, 0.2);
  border-radius: 50%;
  border-top-color: var(--ios-blue);
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="title-section">
      <h1 class="title">
        <span class="title-icon">📒</span>
        <span>Notes</span>
        <span class="version">v1.0</span>
      </h1>
      <a href="https://github.com/aabacada/jiandanbiji" target="_blank" rel="noopener noreferrer" class="github-link">
        <svg class="github-icon" viewBox="0 0 24 24">
          <path d="M12 1.27a11 11 0 00-3.48 21.46c.55.09.73-.28.73-.55v-1.84c-3.03.64-3.67-1.46-3.67-1.46-.55-1.29-1.28-1.65-1.28-1.65-.92-.65.1-.65.1-.65 1.1 0 1.73 1.1 1.73 1.1.92 1.65 2.57 1.2 3.21.92a2 2 0 01.64-1.47c-2.47-.27-5.04-1.19-5.04-5.5 0-1.1.46-2.1 1.2-2.84a3.76 3.76 0 010-2.93s.91-.28 3.11 1.1c1.8-.49 3.7-.49 5.5 0 2.1-1.38 3.02-1.1 3.02-1.1a3.76 3.76 0 010 2.93c.83.74 1.2 1.74 1.2 2.94 0 4.21-2.57 5.13-5.04 5.4.45.37.82.92.82 2.02v3.03c0 .27.1.64.73.55A11 11 0 0012 1.27"></path>
        </svg>
      </a>
    </div>
    <div class="actions">
      <button id="newNoteBtn" class="btn btn-primary">➕ 新建笔记</button>
      <button id="adminBtn" class="btn btn-secondary">⚙️ 后台管理</button>
    </div>
  </div>
  
  <div class="search-section">
    <div class="search-container">
      <input type="text" id="searchInput" class="search-input" placeholder="搜索笔记名称、标题或内容...">
      <button id="searchClear" class="search-clear">✕</button>
    </div>
    <div id="searchResultsInfo" class="search-results-info"></div>
  </div>
  
  <div class="notes-section">
    <ul id="notesList"></ul>
  </div>
</div>
<script>
function displayTime(t){return t?new Date(t).toLocaleString(undefined,{hour12:false}):"未知";}

// 存储所有笔记数据
let allNotes = [];

async function loadList(includeContent = false){
  try{
    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // 根据是否需要内容构建URL
    const url = includeContent ? "/?list=1&includeContent=1" : "/?list=1";
    
    const resp = await fetch(url, { 
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    clearTimeout(timeoutId);
    
    if (!resp.ok) {
      throw new Error("HTTP error! status: " + resp.status);
    }
    
    const arr = await resp.json();
    // 存储所有笔记数据
    allNotes = arr;
    
    // 应用当前的搜索过滤
    applySearchFilter();
  }catch(e){
    console.error("加载目录失败",e);
    const ul = document.getElementById("notesList");
    if (ul.innerHTML === "") {
      const li=document.createElement("li");
      li.style.color = "red";
      li.textContent = "加载笔记列表失败，请刷新页面重试";
      ul.appendChild(li);
    }
  }
}

// 搜索功能
async function applySearchFilter() {
  const searchInput = document.getElementById('searchInput').value.trim().toLowerCase();
  const searchClear = document.getElementById('searchClear');
  const searchResultsInfo = document.getElementById('searchResultsInfo');
  const ul = document.getElementById("notesList");
  
  // 显示或隐藏清除按钮
  if (searchInput) {
    searchClear.style.display = 'block';
    
    // 如果有搜索输入且笔记数据中没有内容，则重新加载包含内容的笔记数据
    if (allNotes.length > 0 && !allNotes[0].hasOwnProperty('content')) {
      await loadList(true);
      return; // 重新加载后会再次调用此函数，所以这里直接返回
    }
  } else {
    searchClear.style.display = 'none';
  }
  
  // 过滤笔记
  let filteredNotes = allNotes;
  if (searchInput) {
    filteredNotes = allNotes.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(searchInput);
      const titleMatch = item.title && item.title.toLowerCase().includes(searchInput);
      const contentMatch = item.content && item.content.toLowerCase().includes(searchInput);
      return nameMatch || titleMatch || contentMatch;
    });
  }
  
  // 显示搜索结果信息
  if (searchInput) {
    if (filteredNotes.length === 0) {
      searchResultsInfo.innerHTML = '<span class="no-results">未找到匹配的笔记</span>';
    } else {
      searchResultsInfo.textContent = '找到 ' + filteredNotes.length + ' 条匹配的笔记';
    }
  } else {
    searchResultsInfo.textContent = '';
  }
  
  // 渲染笔记列表
  ul.innerHTML="";
  filteredNotes.forEach(item=>{
    const li=document.createElement("li");
    const titleDisplay = item.title ? " - " + item.title : "";
    li.innerHTML = '<a href="/'+encodeURIComponent(item.name)+'">'+item.name+titleDisplay+'</a>'
                 + '<div class="time-info">创建: '+displayTime(item.created_at)+' | 更新: '+displayTime(item.updated_at)+'</div>';
    ul.appendChild(li);
  });
}

// 清除搜索
function clearSearch() {
  document.getElementById('searchInput').value = '';
  applySearchFilter();
}

// 新建记事本功能
async function createNewNote() {
  try {
    const btn = document.getElementById('newNoteBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '创建中...';
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const idResponse = await fetch('/next-id', { 
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    clearTimeout(timeoutId);
    
    if (!idResponse.ok) {
      throw new Error("获取序号失败: " + idResponse.status);
    }
    
    const idData = await idResponse.json();
    const noteName = idData.nextId.toString();
    
    const createController = new AbortController();
    const createTimeoutId = setTimeout(() => createController.abort(), 5000);
    
    const response = await fetch('/' + noteName, {
      method: 'POST',
      body: '',
      signal: createController.signal
    });
    
    clearTimeout(createTimeoutId);
    
    if (response.ok) {
      window.location.href = '/' + noteName;
    } else {
      throw new Error("创建笔记失败: " + response.status);
    }
  } catch (error) {
    console.error('创建笔记时出错:', error);
    
    const btn = document.getElementById('newNoteBtn');
    btn.disabled = false;
    btn.textContent = '➕ 新建记事本';
    
    if (error.name === 'AbortError') {
      alert('请求超时，请检查网络连接后重试');
    } else {
      alert('创建笔记失败: ' + error.message);
    }
  }
}

// 绑定事件监听器
document.addEventListener('DOMContentLoaded', function() {
  // 搜索输入框事件
  document.getElementById('searchInput').addEventListener('input', function() {
    applySearchFilter();
  });
  
  // 清除按钮事件
  document.getElementById('searchClear').addEventListener('click', clearSearch);
  
  // 按钮点击事件
  document.getElementById('newNoteBtn').addEventListener('click', createNewNote);
  document.getElementById('adminBtn').addEventListener('click', () => {
    window.location.href = '/admin';
  });
});

loadList();
setInterval(loadList,1000);
</script>
</body></html>`;
    return new Response(html,{ headers:{ "Content-Type":"text/html;charset=UTF-8" } });
  }

  // 编辑页
  let note;
  try { note = await NOTES_KV.get(noteName); } catch(e){ note=null; }
  let noteObj;
  if(note){
    try { noteObj = JSON.parse(note); } 
    catch(e){ noteObj={ content: note, created_at:null, updated_at:null }; }
  } else noteObj={ content:"", created_at:null, updated_at:null };

  const content = noteObj.content || "";
  const title = noteObj.title || "";
  const createdAtISO = noteObj.created_at || "";
  const updatedAtISO = noteObj.updated_at || "";

  return new Response(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>📒 ${noteName}</title>
<style>
/* iOS 26 风格变量 */
:root {
  /* iOS 26 色彩系统 */
  --ios-blue: #007AFF;
  --ios-blue-light: #5AC8FA;
  --ios-green: #34C759;
  --ios-orange: #FF9500;
  --ios-red: #FF3B30;
  --ios-purple: #AF52DE;
  --ios-pink: #FF2D92;
  --ios-indigo: #5856D6;
  --ios-teal: #5AC8FA;
  --ios-yellow: #FFCC00;
  
  /* 中性色调 */
  --ios-gray: #8E8E93;
  --ios-gray-light: #C7C7CC;
  --ios-gray-ultralight: #F2F2F7;
  --ios-gray-dark: #636366;
  --ios-gray-background: #000000;
  --ios-gray-card: #1C1C1E;
  --ios-gray-secondary: #48484A;
  --ios-gray-tertiary: #3A3A3C;
  
  /* 系统背景色 */
  --system-background: #FFFFFF;
  --system-secondary-background: #F2F2F7;
  --system-tertiary-background: #FFFFFF;
  --system-grouped-background: #F2F2F7;
  
  /* 文本颜色 */
  --label-color: #000000;
  --secondary-label-color: #3C3C43;
  --tertiary-label-color: #3C3C433D;
  --quaternary-label-color: #3C3C432E;
  
  /* 阴影和模糊 */
  --small-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --medium-shadow: 0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.06);
  --large-shadow: 0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05);
  --card-shadow: 0 8px 16px rgba(0, 0, 0, 0.1), 0 3px 6px rgba(0, 0, 0, 0.05);
  
  /* 圆角 */
  --small-radius: 8px;
  --medium-radius: 12px;
  --large-radius: 16px;
  --xlarge-radius: 20px;
  
  /* 模糊效果 */
  --frosted-glass: blur(20px);
  --light-frosted-glass: blur(10px);
}

/* 深色模式变量 */
@media (prefers-color-scheme: dark) {
  :root {
    /* 系统背景色 */
    --system-background: #000000;
    --system-secondary-background: #1C1C1E;
    --system-tertiary-background: #2C2C2E;
    --system-grouped-background: #000000;
    
    /* 文本颜色 */
    --label-color: #FFFFFF;
    --secondary-label-color: #EBEBF5;
    --tertiary-label-color: #EBEBF54D;
    --quaternary-label-color: #EBEBF53D;
    
    /* 阴影和模糊 */
    --small-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    --medium-shadow: 0 4px 6px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.15);
    --large-shadow: 0 10px 15px rgba(0, 0, 0, 0.25), 0 4px 6px rgba(0, 0, 0, 0.15);
    --card-shadow: 0 8px 16px rgba(0, 0, 0, 0.3), 0 3px 6px rgba(0, 0, 0, 0.2);
  }
}

/* 基础样式 */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif;
  background: #f5f7fa;
  color: var(--label-color);
  line-height: 1.5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}

/* iOS 26 磨砂玻璃背景 */
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: url('https://images.unsplash.com/photo-1557683316-973673baf926?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80') center/cover no-repeat;
  filter: brightness(0.7) saturate(1.2);
  z-index: -2;
}

body::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  z-index: -1;
}

/* 深色模式背景调整 */
@media (prefers-color-scheme: dark) {
  body {
    background: #2c3e50;
  }
  
  body::after {
    background: rgba(28, 28, 30, 0.85);
  }
}

/* 主容器 */
.container {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
}

/* 顶部菜单栏 */
.header {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 20px 30px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.header:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 20px rgba(0, 0, 0, 0.15), 0 5px 8px rgba(0, 0, 0, 0.08);
}

.note-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--label-color);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;
}

.note-title::before {
  content: "📒";
  font-size: 1.8rem;
}

.menu-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* iOS 26 按钮样式 */
.menu-btn {
  padding: 10px 16px;
  border-radius: var(--medium-radius);
  font-weight: 600;
  font-size: 0.9rem;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  transition: all 0.2s ease;
  box-shadow: var(--small-shadow);
  position: relative;
  overflow: hidden;
}

.menu-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--medium-shadow);
}

.menu-btn:active {
  transform: translateY(0);
  box-shadow: var(--small-shadow);
}

.menu-btn.primary {
  background: linear-gradient(135deg, var(--ios-blue) 0%, var(--ios-blue-light) 100%);
  color: white;
}

.menu-btn.save-btn {
  background: linear-gradient(135deg, var(--ios-green) 0%, #30D158 100%);
  color: white;
}

.menu-btn.edit-btn {
    background: #417bde;
    color: white;
  }
  
  .menu-btn.danger {
  background: #FF3B30;
  background: linear-gradient(135deg, #FF3B30 0%, #FF2D20 100%);
  color: white;
}

/* 标题栏 */
.title-bar {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 20px 30px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

/* 移除title-bar悬浮效果 */

.title-input {
  font-size: 1.5rem;
  font-weight: 600;
  border: 1px solid rgba(0, 0, 0, 0.1);
  outline: none;
  padding: 16px 20px;
  border-radius: var(--large-radius);
  color: var(--label-color);
  background-color: rgba(255, 255, 255, 0.9);
  width: 100%;
  transition: all 0.3s ease;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
  user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;
}

.title-input:focus {
  outline: none;
  border-color: var(--ios-blue);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1), inset 0 1px 3px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.title-input::placeholder {
  color: var(--tertiary-label-color);
  font-weight: 400;
}

/* 编辑器标签页 */
.editor-tabs {
  display: flex;
  margin-bottom: 15px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.tab-btn {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  color: var(--secondary-label-color);
  transition: all 0.2s ease;
}

.tab-btn.active {
  color: var(--ios-blue);
  border-bottom-color: var(--ios-blue);
}

.tab-btn:hover {
  color: var(--ios-blue);
}

/* 编辑器和预览容器 */
.editor-container, .preview-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 300px;
  height: auto;
  overflow: hidden;
}

/* Markdown预览样式 */
.markdown-preview {
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--large-radius);
  background-color: rgba(255, 255, 255, 0.9);
  color: var(--label-color);
  font-size: 1rem;
  line-height: 1.6;
  overflow: hidden;
  min-height: 300px;
  height: auto;
  flex: 1;
  width: 100%;
  box-sizing: border-box;
}

.markdown-preview h1, .markdown-preview h2, .markdown-preview h3, 
.markdown-preview h4, .markdown-preview h5, .markdown-preview h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-preview h1 {
  font-size: 2em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 10px;
}

.markdown-preview h2 {
  font-size: 1.5em;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 8px;
}

.markdown-preview h3 {
  font-size: 1.25em;
}

.markdown-preview p {
  margin-bottom: 16px;
}

.markdown-preview ul, .markdown-preview ol {
  margin-bottom: 16px;
  padding-left: 2em;
}

.markdown-preview li {
  margin-bottom: 4px;
}

.markdown-preview blockquote {
  margin: 16px 0;
  padding: 0 16px;
  color: var(--secondary-label-color);
  border-left: 4px solid var(--ios-blue);
  background-color: rgba(0, 122, 255, 0.05);
}

.markdown-preview code {
  padding: 2px 4px;
  margin: 0;
  font-size: 85%;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.markdown-preview pre {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: var(--medium-radius);
  margin-bottom: 16px;
}

.markdown-preview pre code {
  padding: 0;
  margin: 0;
  font-size: 100%;
  background-color: transparent;
}

.markdown-preview table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 16px;
}

.markdown-preview th, .markdown-preview td {
  padding: 8px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  text-align: left;
}

.markdown-preview th {
  background-color: rgba(0, 0, 0, 0.05);
  font-weight: 600;
}

.markdown-preview img {
  max-width: 100%;
  height: auto;
  border-radius: var(--medium-radius);
  margin: 16px 0;
}

.markdown-preview hr {
  height: 1px;
  border: none;
  background-color: rgba(0, 0, 0, 0.1);
  margin: 24px 0;
}

.markdown-preview a {
  color: var(--ios-blue);
  text-decoration: none;
}

.markdown-preview a:hover {
  text-decoration: underline;
}

/* 深色模式下的Markdown预览样式 */
@media (prefers-color-scheme: dark) {
  .markdown-preview {
    background-color: rgba(44, 44, 46, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .markdown-preview blockquote {
    background-color: rgba(0, 122, 255, 0.1);
  }
  
  .markdown-preview code, .markdown-preview pre {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .markdown-preview th {
    background-color: rgba(255, 255, 255, 0.1);
  }
  
  .markdown-preview th, .markdown-preview td {
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .markdown-preview hr {
    background-color: rgba(255, 255, 255, 0.1);
  }
}

/* 内容区域 */
.content-container {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 25px 30px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  min-height: 300px;
  height: auto;
}

/* 移除content-container悬浮效果 */

#content {
  flex: 1;
  padding: 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--large-radius);
  outline: none;
  font-size: 1rem;
  line-height: 1.5;
  resize: none;
  font-family: inherit;
  background-color: rgba(255, 255, 255, 0.9);
  color: var(--label-color);
  user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;
  transition: all 0.3s ease;
  overflow: hidden;
  min-height: 300px;
  height: auto;
}

#content:focus {
  border-color: var(--ios-blue);
  box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
}

/* 底部状态栏 */
.footer {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border-radius: var(--xlarge-radius);
  padding: 15px 30px;
  box-shadow: var(--card-shadow);
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: var(--secondary-label-color);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

/* 移除footer悬浮效果 */

.time-info {
  display: flex;
  gap: 15px;
}

#status {
  font-weight: 500;
  color: var(--ios-blue);
}

/* 预览模式样式 */
.preview-mode .title-input {
  border: none;
  background-color: transparent;
  color: var(--label-color);
  cursor: default;
  border-radius: var(--large-radius);
  user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;
}

.preview-mode #content {
  border: none;
  background-color: transparent;
  color: var(--label-color);
  cursor: default;
  resize: none;
  user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;
}

.preview-mode .menu-btn.edit-btn {
  display: inline-flex;
}

.preview-mode .menu-btn.save-btn,
.preview-mode .menu-btn.cancel-btn {
  display: none;
}

/* 编辑模式样式 */
.edit-mode .title-input {
  border: 1px solid rgba(0, 0, 0, 0.1);
  background-color: rgba(255, 255, 255, 0.9);
  color: var(--label-color);
  cursor: text;
  pointer-events: auto;
  border-radius: var(--large-radius);
  user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;
}

.edit-mode #content {
  border: 1px solid rgba(0, 0, 0, 0.1);
  background-color: rgba(255, 255, 255, 0.9);
  color: var(--label-color);
  cursor: text;
  pointer-events: auto;
  resize: vertical;
  user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;
}

.edit-mode .menu-btn.edit-btn {
  display: none;
}

.edit-mode .menu-btn.save-btn,
.edit-mode .menu-btn.cancel-btn {
  display: inline-flex;
}

/* 模式指示器 */
.mode-indicator {
  font-size: 0.75rem;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.preview-indicator {
  background-color: var(--system-secondary-background);
  color: var(--secondary-label-color);
}

.edit-indicator {
  background-color: rgba(52, 199, 89, 0.2);
  color: var(--ios-green);
}

/* 保存成功提示框 */
.toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.8);
  background-color: rgba(255, 255, 255, 0.95);
  color: var(--label-color);
  padding: 16px 24px;
  border-radius: var(--large-radius);
  box-shadow: var(--large-shadow);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1rem;
  font-weight: 500;
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  backdrop-filter: var(--frosted-glass);
  -webkit-backdrop-filter: var(--frosted-glass);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.toast.show {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}

.toast.success {
  background-color: rgba(52, 199, 89, 0.95);
  color: white;
}

.toast-icon {
  font-size: 1.25rem;
}

.toast-message {
  flex: 1;
}

/* 删除确认模态框 */
.modal {
  display: none;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  overflow: auto;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.modal-content {
  background-color: var(--system-background);
  margin: 15% auto;
  padding: 0;
  border: none;
  width: 90%;
  max-width: 500px;
  border-radius: var(--large-radius);
  box-shadow: var(--large-shadow);
  animation: modalSlideIn 0.3s ease-out;
}

@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: translateY(-50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--ios-gray-light);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--label-color);
}

.close {
  color: var(--ios-gray);
  font-size: 1.5rem;
  font-weight: bold;
  cursor: pointer;
  line-height: 1;
  transition: color 0.2s;
}

.close:hover,
.close:focus {
  color: var(--ios-gray-dark);
}

.modal-body {
  padding: 20px 24px;
}

.modal-body p {
  margin: 0;
  color: var(--secondary-label-color);
  line-height: 1.5;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--ios-gray-light);
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: var(--medium-radius);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: all 0.2s;
  min-width: 80px;
}

.btn.secondary {
  background-color: var(--system-secondary-background);
  color: var(--label-color);
}

.btn.secondary:hover {
  background-color: var(--ios-gray-light);
}

.btn.danger {
  background-color: var(--ios-red);
  color: white;
}

.btn.danger:hover {
  background-color: #d70015;
}

/* 深色模式调整 */
@media (prefers-color-scheme: dark) {
  .header, .title-bar, .content-container, .footer {
    background: rgba(28, 28, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .preview-mode .title-input {
    color: var(--label-color);
  }
  
  .preview-mode #content {
    color: var(--label-color);
  }
  
  .edit-mode .title-input {
    background-color: rgba(44, 44, 46, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--label-color);
  }
  
  .edit-mode #content {
    background-color: rgba(44, 44, 46, 0.9);
    border-color: rgba(255, 255, 255, 0.1);
    color: var(--label-color);
  }
  
  .preview-indicator {
    background-color: var(--system-secondary-background);
    color: var(--secondary-label-color);
  }
  
  .edit-indicator {
    background-color: rgba(52, 199, 89, 0.2);
    color: var(--ios-green);
  }
  
  #content {
    background-color: rgba(44, 44, 46, 0.9);
    color: var(--label-color);
  }
  
  #content:focus {
    border-color: var(--ios-blue);
    box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.2);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  body {
    padding: 15px;
  }
  
  .container {
    padding: 0 10px;
  }
  
  .header, .title-bar, .content-container, .footer {
    padding: 15px 20px;
    border-radius: var(--large-radius);
  }
  
  .note-title {
    font-size: 1.2rem;
  }
  
  .title-input {
    font-size: 1.2rem;
  }
  
  .menu-buttons {
    gap: 6px;
  }
  
  .menu-btn {
    padding: 8px 12px;
    font-size: 0.8rem;
  }
}

@media (max-width: 480px) {
  .header, .title-bar, .content-container, .footer {
    padding: 12px 15px;
  }
  
  .note-title {
    font-size: 1rem;
  }
  
  .title-input {
    font-size: 1rem;
  }
  
  .menu-buttons {
    flex-direction: column;
    width: 100%;
  }
  
  .menu-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
</head>
<body class="preview-mode">
<div class="container">
  <header class="header">
    <h1 class="note-title">
      ${noteName}
      <span id="modeIndicator" class="mode-indicator preview-indicator">预览</span>
    </h1>
    <div class="menu-buttons">
      <button id="homeBtn" class="menu-btn" style="color: white; background: #8E8E93;">🏠 返回首页</button>
      <button id="saveBtn" class="menu-btn save-btn" style="display:none;">💾 保存</button>
      <button id="editBtn" class="menu-btn edit-btn">✏️ 编辑</button>
      <button id="cancelBtn" class="menu-btn cancel-btn" style="display:none;">❌ 取消</button>
      <button id="deleteBtn" class="menu-btn danger">🗑️ 删除</button>
    </div>
  </header>

  <div class="title-bar">
    <input type="text" id="titleInput" class="title-input" placeholder="输入标题..." value="${title}">
  </div>

  <div class="content-container">
    <div class="editor-tabs">
      <button id="previewTab" class="tab-btn active">预览</button>
      <button id="editTab" class="tab-btn">Markdown</button>
    </div>
    <div id="previewContainer" class="preview-container">
      <div id="markdownPreview" class="markdown-preview"></div>
    </div>
    <div id="editorContainer" class="editor-container" style="display: none;">
      <textarea id="content">${content}</textarea>
    </div>
  </div>

  <footer class="footer">
    <div class="time-info">
      <span>创建: <span class="created" data-time="${createdAtISO}"></span></span>
      <span>更新: <span class="updated" data-time="${updatedAtISO}"></span></span>
    </div>
    <div id="status"></div>
  </footer>
</div>

<!-- 保存成功提示框 -->
<div id="saveToast" class="toast success">
  <span class="toast-icon">✅</span>
  <span class="toast-message">保存成功</span>
</div>

<!-- 删除确认模态框 -->
<div id="deleteModal" class="modal">
  <div class="modal-content">
    <div class="modal-header">
      <h3>确认删除</h3>
      <span class="close" id="closeModal">&times;</span>
    </div>
    <div class="modal-body">
      <p id="deleteMessage">确定要删除这个笔记吗？此操作不可撤销。</p>
    </div>
    <div class="modal-footer">
      <button id="cancelDelete" class="btn secondary">取消</button>
      <button id="confirmDelete" class="btn danger">确认删除</button>
    </div>
  </div>
</div>

<!-- 引入Markdown解析库 -->
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script>
const textarea=document.getElementById('content');
const titleInput=document.getElementById('titleInput');
const saveBtn=document.getElementById('saveBtn');
const deleteBtn=document.getElementById('deleteBtn');
const homeBtn=document.getElementById('homeBtn');
const editBtn=document.getElementById('editBtn');
const cancelBtn=document.getElementById('cancelBtn');
const modeIndicator=document.getElementById('modeIndicator');
const status=document.getElementById('status');
const saveToast=document.getElementById('saveToast');
const body=document.body;

// 删除模态框相关元素
const deleteModal=document.getElementById('deleteModal');
const deleteMessage=document.getElementById('deleteMessage');
const closeModal=document.getElementById('closeModal');
const cancelDelete=document.getElementById('cancelDelete');
const confirmDelete=document.getElementById('confirmDelete');

// Markdown预览相关元素
const editTab = document.getElementById('editTab');
const previewTab = document.getElementById('previewTab');
const editorContainer = document.getElementById('editorContainer');
const previewContainer = document.getElementById('previewContainer');
const markdownPreview = document.getElementById('markdownPreview');

let previousContent=textarea.value;
let previousTitle=titleInput.value;
let isEditMode=false;

// Markdown预览功能
function updateMarkdownPreview() {
  const markdownText = textarea.value;
  const htmlContent = marked.parse(markdownText);
  markdownPreview.innerHTML = htmlContent;
  
  // 调整预览容器和content-container的高度
  setTimeout(() => {
    // 获取markdownPreview的实际高度
    const previewHeight = markdownPreview.scrollHeight;
    
    // 调整markdownPreview的高度
    markdownPreview.style.height = 'auto';
    markdownPreview.style.height = previewHeight + 'px';
    
    // 调整previewContainer的高度
    previewContainer.style.height = 'auto';
    previewContainer.style.height = previewHeight + 'px';
    
    // 调整content-container的高度以适应预览内容
    const contentContainer = document.querySelector('.content-container');
    if (contentContainer) {
      contentContainer.style.height = 'auto';
      // 确保容器至少有最小高度（标签页高度 + 预览内容高度 + padding）
      const containerMinHeight = 50 + previewHeight + 50; // 标签页 + 预览内容 + padding
      contentContainer.style.height = Math.max(350, containerMinHeight) + 'px';
    }
  }, 100); // 延迟执行以确保DOM更新完成
}

// 切换到编辑标签页
function switchToEditTab() {
  editTab.classList.add('active');
  previewTab.classList.remove('active');
  editorContainer.style.display = 'flex';
  previewContainer.style.display = 'none';
  
  // 切换到编辑模式时，调整textarea和容器高度
  setTimeout(() => {
    adjustTextareaHeight();
  }, 100);
}

// 切换到预览标签页
function switchToPreviewTab() {
  editTab.classList.remove('active');
  previewTab.classList.add('active');
  editorContainer.style.display = 'none';
  previewContainer.style.display = 'flex';
  updateMarkdownPreview();
}

// 绑定标签页切换事件
editTab.addEventListener('click', switchToEditTab);
previewTab.addEventListener('click', switchToPreviewTab);

// 自动调整textarea高度的函数
function adjustTextareaHeight() {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
  
  // 调整content-container的高度以适应内容
  const contentContainer = document.querySelector('.content-container');
  if (contentContainer) {
    contentContainer.style.height = 'auto';
    // 确保容器至少有最小高度（标签页高度 + textarea高度 + padding）
    const containerMinHeight = 50 + textarea.scrollHeight + 50; // 标签页 + textarea + padding
    contentContainer.style.height = Math.max(350, containerMinHeight) + 'px';
  }
  
  // 调整editorContainer的高度
  const editorContainer = document.getElementById('editorContainer');
  if (editorContainer) {
    editorContainer.style.height = 'auto';
    editorContainer.style.height = textarea.scrollHeight + 'px';
  }
}

// 初始化时调整高度
// 根据当前活动标签页调整初始高度
if (editTab.classList.contains('active')) {
  adjustTextareaHeight();
} else {
  updateMarkdownPreview();
}

// 监听内容变化，自动调整高度
textarea.addEventListener('input', adjustTextareaHeight);

// 监听窗口大小变化，重新调整高度
window.addEventListener('resize', () => {
  if (editTab.classList.contains('active')) {
    // 如果在编辑模式，调整textarea高度
    setTimeout(adjustTextareaHeight, 100);
  } else {
    // 如果在预览模式，更新预览并调整高度
    setTimeout(updateMarkdownPreview, 100);
  }
});

// 显示保存成功提示框
function showSaveToast() {
  saveToast.classList.add('show');
  setTimeout(() => {
    saveToast.classList.remove('show');
  }, 2000);
}

function displayTime(t){return t?new Date(t).toLocaleString(undefined,{hour12:false}):"未知";}
function updateTimeDisplays(){
  document.querySelectorAll('.created').forEach(el=>el.textContent=displayTime(el.dataset.time));
  document.querySelectorAll('.updated').forEach(el=>el.textContent=displayTime(el.dataset.time));
}
updateTimeDisplays();

// 切换到编辑模式
function enterEditMode() {
  isEditMode = true;
  body.classList.remove('preview-mode');
  body.classList.add('edit-mode');
  modeIndicator.textContent = '编辑';
  modeIndicator.classList.remove('preview-indicator');
  modeIndicator.classList.add('edit-indicator');
  status.textContent = '编辑模式';
  setTimeout(() => status.textContent = '', 2000);
  
  // 显示保存和取消按钮，隐藏编辑按钮
  editBtn.style.display = 'none';
  saveBtn.style.display = 'inline-block';
  cancelBtn.style.display = 'inline-block';
}

// 切换到预览模式
function enterPreviewMode() {
  isEditMode = false;
  body.classList.remove('edit-mode');
  body.classList.add('preview-mode');
  modeIndicator.textContent = '预览';
  modeIndicator.classList.remove('edit-indicator');
  modeIndicator.classList.add('preview-indicator');
  status.textContent = '预览模式';
  setTimeout(() => status.textContent = '', 2000);
  
  // 显示编辑按钮，隐藏保存和取消按钮
  editBtn.style.display = 'inline-block';
  saveBtn.style.display = 'none';
  cancelBtn.style.display = 'none';
}

// 编辑按钮点击事件
editBtn.addEventListener('click', () => {
  enterEditMode();
  // 切换到编辑标签页
  switchToEditTab();
  // 聚焦到textarea
  textarea.focus();
});

// 取消按钮点击事件
cancelBtn.addEventListener('click', () => {
  // 恢复原始内容
  textarea.value = previousContent;
  titleInput.value = previousTitle;
  enterPreviewMode();
});

// 返回首页功能
homeBtn.addEventListener('click', () => {
  window.location.href = '/';
});

// 删除笔记功能
deleteBtn.addEventListener('click', () => {
  deleteMessage.textContent = '确定要删除这个笔记吗？此操作不可撤销。';
  deleteModal.style.display = 'block';
});

// 确认删除笔记
async function confirmDeleteNote() {
  deleteModal.style.display = 'none';
  
  try {
    const resp = await fetch(window.location.href, { method: 'DELETE' });
    if (resp.ok) {
      status.textContent = '笔记已删除';
      setTimeout(() => {
        window.location.href = '/';
      }, 1000);
    } else {
      status.textContent = '删除失败，请重试';
      setTimeout(() => status.textContent = '', 3000);
    }
  } catch (e) {
    console.error("删除请求失败", e);
    status.textContent = '删除失败，请重试';
    setTimeout(() => status.textContent = '', 3000);
  }
}

// 确保标题输入框的值在页面加载后正确设置
window.addEventListener('load', () => {
  // 初始化previousTitle变量为当前输入框的值
  previousTitle = titleInput.value;
  
  // 检查是否为新建的记事本（内容为空且创建时间和更新时间相同）
  const isNewNote = !textarea.value.trim() && 
                    document.querySelector('.created').dataset.time === 
                    document.querySelector('.updated').dataset.time &&
                    document.querySelector('.created').dataset.time !== '';
  
  // 如果是新建的记事本，默认进入编辑模式
  if (isNewNote) {
    enterEditMode();
    // 切换到Markdown编辑标签页
    switchToEditTab();
    status.textContent = '新建记事本 - 编辑模式';
    setTimeout(() => status.textContent = '', 3000);
    // 初始化编辑模式下的高度
    setTimeout(adjustTextareaHeight, 100);
  } else {
    // 否则进入预览模式
    enterPreviewMode();
    // 初始化预览模式下的高度
    setTimeout(updateMarkdownPreview, 100);
  }
});

// 监听标题输入框的变化
titleInput.addEventListener('input', () => {
  // 标题变化时不需要特殊处理，由手动保存按钮处理
});

async function save(){
  // 检查内容或标题是否有变化
  const currentContent = textarea.value;
  const currentTitle = titleInput.value;
  
  if(previousContent !== currentContent || previousTitle !== currentTitle){
    const tempContent = currentContent;
    const tempTitle = currentTitle;
    try{
      const data = {
        content: tempContent,
        title: tempTitle
      };
      const resp = await fetch(window.location.href,{method:'POST',body:JSON.stringify(data)});
      const result = await resp.json();
      
      // 只有在请求成功后才更新previous变量，确保数据一致性
      previousContent = tempContent;
      previousTitle = tempTitle;
      
      if(result.deleted){
        textarea.value = "";
        titleInput.value = "";
        status.textContent = '笔记已删除';
        setTimeout(() => status.textContent = '', 3000);
        document.querySelector('.created').dataset.time = "";
        document.querySelector('.updated').dataset.time = "";
        updateTimeDisplays();
      } else {
        // 显示保存成功提示框
        showSaveToast();
        // 更新状态栏
        status.textContent = '已保存: ' + new Date().toLocaleString(undefined,{hour12:false});
        setTimeout(() => {
          status.textContent = '';
          // 保存成功后切换回预览模式
          enterPreviewMode();
        }, 2000);
        if(result.updated_at){
          document.querySelector('.updated').dataset.time = result.updated_at;
        }
        if(result.created_at && !document.querySelector('.created').dataset.time){
          document.querySelector('.created').dataset.time = result.created_at;
        }
        updateTimeDisplays();
      }
    } catch(e){ 
      console.error("保存请求失败", e);
      status.textContent = '保存失败，请重试';
      setTimeout(() => status.textContent = '', 3000);
      // 保存失败时不更新previous变量，保持原有状态
    }
  } else {
    status.textContent = '没有内容变化';
    setTimeout(() => {
      status.textContent = '';
      // 没有变化时也切换回预览模式
      enterPreviewMode();
    }, 2000);
  }
}

saveBtn.addEventListener('click', save);

// 模态框事件监听器
closeModal.addEventListener('click', () => {
  deleteModal.style.display = 'none';
});

cancelDelete.addEventListener('click', () => {
  deleteModal.style.display = 'none';
});

confirmDelete.addEventListener('click', confirmDeleteNote);

// 点击模态框外部关闭
window.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.style.display = 'none';
  }
});
</script>
</body>
</html>`,{ headers:{ "Content-Type":"text/html;charset=UTF-8" } });
}

// 更新索引函数
async function updateIndex(name, timesObj){
  let indexData = await NOTES_KV.get(INDEX_KEY);
  let arr = indexData ? JSON.parse(indexData) : [];
  arr = arr.filter(item=>item.name!==name);
  if(timesObj){
    arr.push({ name, title: timesObj.title || "", created_at: timesObj.created_at, updated_at: timesObj.updated_at });
  }
  await NOTES_KV.put(INDEX_KEY, JSON.stringify(arr));
}

function generateRandomNote(){
  const chars='234579abcdefghjkmnpqrstwxyz';
  return Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}
