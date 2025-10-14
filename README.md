# 🔧 Aza Connect Backend - PostgreSQL v3.0

Backend do sistema de gestão de manutenção industrial Aza Connect, desenvolvido com Node.js, Express e PostgreSQL.

## 🚀 Tecnologias

- **Node.js** 18+
- **Express** 4.18
- **PostgreSQL** 16
- **pg** (PostgreSQL client)
- **CORS** habilitado

## 📊 Estrutura do Banco de Dados

O sistema utiliza 10 tabelas principais:

- **users** - Usuários do sistema
- **sectors** - Setores da empresa
- **assets** - Equipamentos e ativos
- **requests** - Solicitações de manutenção
- **agulhas** - Controle de consumo de agulhas
- **pdfs** - Documentos por setor
- **parts_requests** - Solicitações de peças
- **notifications** - Notificações do sistema
- **permissions** - Permissões por role
- **system_data** - Dados em JSONB (backup)

## 🔌 API Endpoints

### Autenticação
- `POST /api/login` - Login de usuário

### Usuários (CRUD completo)
- `GET /api/users` - Listar todos
- `POST /api/users` - Criar novo
- `PUT /api/users/:id` - Atualizar
- `DELETE /api/users/:id` - Deletar

### Setores (CRUD completo)
- `GET /api/sectors` - Listar todos
- `POST /api/sectors` - Criar novo
- `PUT /api/sectors/:id` - Atualizar
- `DELETE /api/sectors/:id` - Deletar

### Equipamentos (CRUD completo)
- `GET /api/assets` - Listar todos
- `POST /api/assets` - Criar novo
- `PUT /api/assets/:id` - Atualizar
- `DELETE /api/assets/:id` - Deletar

### Solicitações (CRUD completo)
- `GET /api/requests` - Listar todas
- `POST /api/requests` - Criar nova
- `PUT /api/requests/:id` - Atualizar
- `DELETE /api/requests/:id` - Deletar

### Agulhas
- `GET /api/agulhas` - Listar todos
- `POST /api/agulhas` - Criar novo
- `DELETE /api/agulhas/:id` - Deletar

### PDFs
- `GET /api/pdfs` - Listar todos
- `POST /api/pdfs` - Criar novo
- `DELETE /api/pdfs/:id` - Deletar

### Solicitações de Peças (CRUD completo)
- `GET /api/parts-requests` - Listar todas
- `POST /api/parts-requests` - Criar nova
- `PUT /api/parts-requests/:id` - Atualizar
- `DELETE /api/parts-requests/:id` - Deletar

### Notificações
- `GET /api/notifications/:userId` - Listar do usuário
- `POST /api/notifications` - Criar nova
- `PUT /api/notifications/:id/read` - Marcar como lida

### Permissões
- `GET /api/permissions` - Listar todas

### Health Check
- `GET /api/health` - Status do sistema

## 🛠️ Instalação Local

### Pré-requisitos
- Node.js 18+
- PostgreSQL 12+

### Passos

1. Clone o repositório:
```bash
git clone https://github.com/fkobayashijunior-hue/manutencao-backend.git
cd manutencao-backend
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env`:
```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/aza_connect
NODE_ENV=development
PORT=10000
```

4. Inicie o servidor:
```bash
npm start
```

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

5. Acesse: `http://localhost:10000`

## 🚀 Deploy no Render

### Guia Rápido

Ver arquivo **DEPLOY.md** para comandos rápidos ou **GUIA-DEPLOY-RENDER.md** (na raiz do projeto) para guia completo.

### Resumo

1. **Push para GitHub:**
```bash
git push origin main
```

2. **Criar PostgreSQL no Render:**
   - New + → PostgreSQL
   - Name: `aza-connect-db`
   - Plan: Free

3. **Criar Web Service:**
   - New + → Web Service
   - Connect: `manutencao-backend`
   - Build: `npm install`
   - Start: `npm start`
   - Env: `DATABASE_URL`, `NODE_ENV=production`

4. **Testar:**
```
https://aza-connect-backend.onrender.com
```

## 📝 Estrutura de Arquivos

```
manutencao-backend/
├── server.js           # Servidor Express e rotas
├── database.js         # Configuração PostgreSQL
├── init-database.js    # Inicialização do banco
├── schema.sql          # Schema completo do banco
├── package.json        # Dependências
├── .env.example        # Exemplo de variáveis
├── DEPLOY.md           # Guia rápido de deploy
└── README.md           # Este arquivo
```

## 🔄 Atualizações

Para fazer deploy de novas versões:

```bash
git add .
git commit -m "Descrição da mudança"
git push origin main
```

O Render fará deploy automático.

## 📊 Monitoramento

- **Logs:** Disponíveis no painel do Render
- **Métricas:** CPU, Memory, Bandwidth
- **Health Check:** `GET /api/health`

## 🐛 Troubleshooting

### Erro de Conexão com Banco
Verifique:
1. `DATABASE_URL` está correta
2. Banco de dados está "Available"
3. SSL está configurado

### Build Failed
Verifique:
1. `package.json` está correto
2. Dependências estão listadas
3. Node.js version >= 18

### Service Sleeping
Plano Free coloca em sleep após 15 min de inatividade. Primeiro acesso pode levar 30-60s.

## 📚 Documentação

- [Guia Completo de Deploy](../GUIA-DEPLOY-RENDER.md)
- [Guia Rápido](DEPLOY.md)
- [Schema SQL](schema.sql)

## 📄 Licença

MIT License

---

**Desenvolvido por:** Manus AI  
**Para:** Aza Têxtil | Zen Confecções  
**Versão:** 3.0.0  
**Data:** Outubro 2025

