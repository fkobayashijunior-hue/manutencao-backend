# 🔧 Backend - Sistema de Manutenção v2.0

Backend do Sistema de Manutenção com PostgreSQL para persistência de dados.

## 🚀 Tecnologias

- **Node.js** 18+
- **Express** 4.x
- **PostgreSQL** (via Render)
- **CORS** habilitado

## 📦 Instalação Local

```bash
# Instalar dependências
npm install

# Configurar variável de ambiente
# Criar arquivo .env com:
DATABASE_URL=sua_url_do_postgresql

# Iniciar servidor
npm start

# Ou em modo desenvolvimento
npm run dev
```

## 🗄️ Banco de Dados

O sistema usa PostgreSQL com uma tabela principal:

### Tabela: `system_data`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | SERIAL | ID auto-incremento |
| data_key | VARCHAR(100) | Chave única (ex: 'allData') |
| data_value | JSONB | Dados em formato JSON |
| updated_at | TIMESTAMP | Data da última atualização |

## 🌐 Rotas da API

### GET /
Status da API

**Resposta:**
```json
{
  "message": "API Sistema de Manutenção v2.0",
  "status": "online",
  "database": "PostgreSQL",
  "timestamp": "2025-10-09T..."
}
```

### GET /api/data
Carregar todos os dados do sistema

**Resposta:**
```json
{
  "users": [...],
  "assets": [...],
  "sectors": [...],
  "requests": [...],
  "agulhas": [...],
  "pdfs": [...],
  "partRequests": [...],
  "notifications": [...],
  "permissions": {...}
}
```

### POST /api/data
Salvar todos os dados do sistema

**Body:**
```json
{
  "users": [...],
  "assets": [...],
  ...
}
```

**Resposta:**
```json
{
  "success": true,
  "message": "Dados salvos com sucesso!",
  "timestamp": "2025-10-09T..."
}
```

### POST /api/users
Salvar usuário individual

**Body:**
```json
{
  "id": 1,
  "name": "João Silva",
  "username": "joao",
  "password": "123",
  "role": "Mecânico",
  "sector": "Manutenção"
}
```

### POST /api/assets
Salvar equipamento individual

**Body:**
```json
{
  "id": 1,
  "idNumber": "Tear 01",
  "name": "Tear Circular",
  "sector": "Tecelagem",
  "brand": "MarcaX",
  "model": "ModeloY"
}
```

### POST /api/requests
Salvar solicitação individual

**Body:**
```json
{
  "id": 1,
  "assetId": 1,
  "requesterId": 2,
  "description": "Problema no tear",
  "status": "Aberto"
}
```

### GET /health
Health check do servidor e banco de dados

**Resposta:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2025-10-09T..."
}
```

## 🔧 Configuração no Render

### 1. Criar PostgreSQL
1. No Render Dashboard, clique em "New +" → "PostgreSQL"
2. Nome: `sistema-manutencao-db`
3. Plan: **Free**
4. Clique em "Create Database"

### 2. Configurar Variável de Ambiente
1. Vá no seu Web Service
2. Clique em "Environment"
3. Adicione:
   - Key: `DATABASE_URL`
   - Value: (copie a Internal Database URL do PostgreSQL)

### 3. Deploy
O Render detecta automaticamente mudanças no GitHub e faz deploy.

## 📊 Logs

O servidor exibe logs detalhados:

```
✅ Conectado ao PostgreSQL com sucesso!
🔧 Inicializando banco de dados...
✅ Tabela system_data criada com sucesso!
🚀 Servidor iniciado com sucesso!
📡 Porta: 10000
```

## 🐛 Troubleshooting

### Erro: "Cannot connect to database"
- Verifique se `DATABASE_URL` está configurada
- Confirme que o PostgreSQL está ativo no Render

### Erro: "Module 'pg' not found"
- Execute `npm install`
- Force redeploy no Render

### Dados não persistem
- Verifique logs do servidor
- Confirme que as rotas POST estão sendo chamadas
- Teste a rota `/health` para verificar conexão com banco

## 📞 Suporte

Em caso de problemas, verifique:
1. Logs do Render (aba "Logs")
2. Status do PostgreSQL (deve estar "Available")
3. Variável DATABASE_URL configurada corretamente

## 📝 Licença

MIT

---

**Desenvolvido por:** fkobayashijunior-hue  
**Versão:** 2.0  
**Data:** Outubro 2025

