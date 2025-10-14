# 🚀 Deploy Rápido - Comandos

## 📤 Push para GitHub

```bash
cd /home/ubuntu/manutencao-backend
git push origin main
```

**Se pedir senha:** Use um Personal Access Token do GitHub  
**Criar token:** https://github.com/settings/tokens

---

## 🗄️ Render - PostgreSQL

1. Acesse: https://render.com
2. New + → PostgreSQL
3. Name: `aza-connect-db`
4. Database: `aza_connect`
5. Plan: **Free**
6. Create Database
7. **Copie a External Database URL**

---

## 🚀 Render - Web Service

1. New + → Web Service
2. Connect GitHub → `manutencao-backend`
3. Name: `aza-connect-backend`
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Plan: **Free**

**Environment Variables:**
```
DATABASE_URL = (cole a URL do PostgreSQL)
NODE_ENV = production
PORT = 10000
```

7. Create Web Service
8. Aguarde 3-5 minutos

---

## ✅ Testar

Acesse no navegador:
```
https://aza-connect-backend.onrender.com
```

Deve retornar:
```json
{
  "message": "API Aza Connect v3.0 - PostgreSQL",
  "status": "online"
}
```

---

## 🔄 Atualizar Frontend

Edite: `/home/ubuntu/aza-connect-v2/src/lib/api.js`

```javascript
const API_BASE_URL = 'https://aza-connect-backend.onrender.com';
```

Build e deploy:
```bash
cd /home/ubuntu/aza-connect-v2
npm run build
# Depois use o deploy do Manus Space
```

---

## 📝 Endpoints Principais

- `GET /` - Status da API
- `GET /api/health` - Health check
- `POST /api/login` - Login
- `GET /api/users` - Listar usuários
- `GET /api/requests` - Listar solicitações
- `GET /api/assets` - Listar equipamentos
- `GET /api/agulhas` - Listar agulhas

---

**Guia Completo:** Ver arquivo `GUIA-DEPLOY-RENDER.md`

