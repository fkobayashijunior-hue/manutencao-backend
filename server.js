const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('./database');
const initDatabase = require('./init-database');
const emailService = require('./emailService');

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir arquivos estáticos da pasta uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Configuração do Multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, name + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens (JPEG, JPG, PNG, GIF) e PDFs são permitidos!'));
    }
  }
});

// Log de requisições
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Inicializar banco de dados ao iniciar servidor
initDatabase().catch(err => {
  console.error('❌ Falha ao inicializar banco de dados:', err);
});

// ==================== ROTAS ====================

// Rota raiz - Status da API
app.get('/', (req, res) => {
  res.json({ 
    message: 'API Aza Connect v3.0 - MySQL',
    status: 'online',
    database: 'MySQL',
    timestamp: new Date().toISOString()
  });
});

// ==================== USERS ====================

// GET - Listar todos os usuários
app.get('/api/users', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM users ORDER BY id');
    // Formatar birthdate para YYYY-MM-DD (sem timezone)
    const users = result.map(user => ({
      ...user,
      birthdate: user.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : null
    }));
    res.json(users);
  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários', message: error.message });
  }
});

// POST - Criar novo usuário
app.post('/api/users', async (req, res) => {
  try {
    const { name, username, password, role, sector, birthdate, email, phone } = req.body;
    const [result] = await pool.query(
      'INSERT INTO users (name, username, password, role, sector, birthdate, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, username, password, role, sector, birthdate, email || null, phone || null]
    );
    // Buscar registro inserido
    const [inserted] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário', message: error.message });
  }
});

// PUT - Atualizar usuário
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, role, sector, birthdate, email, phone } = req.body;
    await pool.query(
      'UPDATE users SET name = ?, username = ?, password = ?, role = ?, sector = ?, birthdate = ?, email = ?, phone = ? WHERE id = ?',
      [name, username, password, role, sector, birthdate, email || null, phone || null, id]
    );
    // Buscar registro atualizado
    const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário', message: error.message });
  }
});

// DELETE - Deletar usuário
app.delete('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro ao deletar usuário', message: error.message });
  }
});

// POST - Login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, password]
    );
    
    if (result.length > 0) {
      res.json({ success: true, user: result[0] });
    } else {
      res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
  } catch (error) {
    console.error('❌ Erro ao fazer login:', error);
    res.status(500).json({ error: 'Erro ao fazer login', message: error.message });
  }
});

// ==================== SECTORS ====================

// GET - Listar todos os setores
app.get('/api/sectors', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM sectors ORDER BY id');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar setores:', error);
    res.status(500).json({ error: 'Erro ao listar setores', message: error.message });
  }
});

// POST - Criar novo setor
app.post('/api/sectors', async (req, res) => {
  try {
    const { nome, descricao, ativo } = req.body;
    const [result] = await pool.query(
      'INSERT INTO sectors (nome, descricao, ativo) VALUES (?, ?, ?)',
      [nome, descricao, ativo !== undefined ? ativo : true]
    );
    const [inserted] = await pool.query('SELECT * FROM sectors WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar setor:', error);
    res.status(500).json({ error: 'Erro ao criar setor', message: error.message });
  }
});

// PUT - Atualizar setor
app.put('/api/sectors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, descricao, ativo } = req.body;
    await pool.query(
      'UPDATE sectors SET nome = ?, descricao = ?, ativo = ? WHERE id = ?',
      [nome, descricao, ativo, id]
    );
    const [updated] = await pool.query('SELECT * FROM sectors WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar setor:', error);
    res.status(500).json({ error: 'Erro ao atualizar setor', message: error.message });
  }
});

// DELETE - Deletar setor
app.delete('/api/sectors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM sectors WHERE id = ?', [id]);
    res.json({ message: 'Setor deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar setor:', error);
    res.status(500).json({ error: 'Erro ao deletar setor', message: error.message });
  }
});

// ==================== ASSETS ====================

// GET - Listar todos os equipamentos
app.get('/api/assets', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM assets ORDER BY id');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar equipamentos:', error);
    res.status(500).json({ error: 'Erro ao listar equipamentos', message: error.message });
  }
});

// POST - Criar novo equipamento
app.post('/api/assets', async (req, res) => {
  try {
    const { name, type, number, model, serial_number, sector, status } = req.body;
    const [result] = await pool.query(
      'INSERT INTO assets (name, type, number, model, serial_number, sector, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, type, number, model, serial_number, sector, status || 'Ativo']
    );
    const [inserted] = await pool.query('SELECT * FROM assets WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar equipamento:', error);
    res.status(500).json({ error: 'Erro ao criar equipamento', message: error.message });
  }
});

// PUT - Atualizar equipamento
app.put('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, number, model, serial_number, sector, status } = req.body;
    await pool.query(
      'UPDATE assets SET name = ?, type = ?, number = ?, model = ?, serial_number = ?, sector = ?, status = ? WHERE id = ?',
      [name, type, number, model, serial_number, sector, status, id]
    );
    const [updated] = await pool.query('SELECT * FROM assets WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar equipamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar equipamento', message: error.message });
  }
});

// DELETE - Deletar equipamento
app.delete('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM assets WHERE id = ?', [id]);
    res.json({ message: 'Equipamento deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar equipamento:', error);
    res.status(500).json({ error: 'Erro ao deletar equipamento', message: error.message });
  }
});

// ==================== REQUESTS ====================

// GET - Listar todas as solicitações
app.get('/api/requests', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM requests ORDER BY created_at DESC');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar solicitações:', error);
    res.status(500).json({ error: 'Erro ao listar solicitações', message: error.message });
  }
});

// POST - Criar nova solicitação
app.post('/api/requests', async (req, res) => {
  try {
    const { equipment, sector, description, urgency, status, requested_by, assigned_to, service_executed, preventive_maintenance } = req.body;
    const [result] = await pool.query(
      'INSERT INTO requests (equipment, sector, description, urgency, status, requested_by, assigned_to, service_executed, preventive_maintenance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [equipment, sector, description, urgency, status || 'Pendente', requested_by, assigned_to, service_executed, preventive_maintenance]
    );
    
    // Buscar registro inserido
    const [inserted] = await pool.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    
    // Enviar e-mail para mecânicos
    try {
      const [mechanics] = await pool.query(
        "SELECT * FROM users WHERE role IN ('Mecânico', 'Mecânico Encarregado') AND active = true"
      );
      if (mechanics.length > 0) {
        await emailService.sendNewRequestEmail(inserted[0], mechanics);
      }
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar e-mail:', emailError);
      // Não bloqueia a criação da solicitação
    }
    
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar solicitação:', error);
    res.status(500).json({ error: 'Erro ao criar solicitação', message: error.message });
  }
});

// PUT - Atualizar solicitação
app.put('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { equipment, sector, description, urgency, status, requested_by, assigned_to, service_executed, preventive_maintenance } = req.body;
    await pool.query(
      'UPDATE requests SET equipment = ?, sector = ?, description = ?, urgency = ?, status = ?, requested_by = ?, assigned_to = ?, service_executed = ?, preventive_maintenance = ? WHERE id = ?',
      [equipment, sector, description, urgency, status, requested_by, assigned_to, service_executed, preventive_maintenance, id]
    );
    
    // Buscar registro atualizado
    const [updated] = await pool.query('SELECT * FROM requests WHERE id = ?', [id]);
    
    // Enviar e-mail se foi concluído
    if (status === 'Concluído' && requested_by) {
      try {
        const [user] = await pool.query(
          'SELECT * FROM users WHERE name = ? OR id = ?',
          [requested_by, requested_by]
        );
        if (user.length > 0) {
          await emailService.sendCompletedRequestEmail(updated[0], user[0]);
        }
      } catch (emailError) {
        console.error('⚠️ Erro ao enviar e-mail:', emailError);
      }
    }
    
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar solicitação:', error);
    res.status(500).json({ error: 'Erro ao atualizar solicitação', message: error.message });
  }
});

// DELETE - Deletar solicitação
app.delete('/api/requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM requests WHERE id = ?', [id]);
    res.json({ message: 'Solicitação deletada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar solicitação:', error);
    res.status(500).json({ error: 'Erro ao deletar solicitação', message: error.message });
  }
});

// ==================== AGULHAS ====================

// GET - Listar todos os registros de agulhas
app.get('/api/agulhas', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM agulhas ORDER BY date DESC, created_at DESC');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar agulhas:', error);
    res.status(500).json({ error: 'Erro ao listar agulhas', message: error.message });
  }
});

// POST - Criar novo registro de agulha
app.post('/api/agulhas', async (req, res) => {
  try {
    const { tear, size, quantity, employee, date } = req.body;
    const [result] = await pool.query(
      'INSERT INTO agulhas (tear, size, quantity, employee, date) VALUES (?, ?, ?, ?, ?)',
      [tear, size, quantity || 1, employee, date]
    );
    const [inserted] = await pool.query('SELECT * FROM agulhas WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar registro de agulha:', error);
    res.status(500).json({ error: 'Erro ao criar registro de agulha', message: error.message });
  }
});

// DELETE - Deletar registro de agulha
app.delete('/api/agulhas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM agulhas WHERE id = ?', [id]);
    res.json({ message: 'Registro de agulha deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar registro de agulha:', error);
    res.status(500).json({ error: 'Erro ao deletar registro de agulha', message: error.message });
  }
});

// ==================== PDFS ====================

// GET - Listar todos os PDFs
app.get('/api/pdfs', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM pdfs ORDER BY created_at DESC');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar PDFs:', error);
    res.status(500).json({ error: 'Erro ao listar PDFs', message: error.message });
  }
});

// POST - Criar novo PDF
app.post('/api/pdfs', async (req, res) => {
  try {
    const { title, sector, file_url, file_name, uploaded_by } = req.body;
    const [result] = await pool.query(
      'INSERT INTO pdfs (title, sector, file_url, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?)',
      [title, sector, file_url, file_name, uploaded_by]
    );
    const [inserted] = await pool.query('SELECT * FROM pdfs WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar PDF:', error);
    res.status(500).json({ error: 'Erro ao criar PDF', message: error.message });
  }
});

// DELETE - Deletar PDF
app.delete('/api/pdfs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM pdfs WHERE id = ?', [id]);
    res.json({ message: 'PDF deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar PDF:', error);
    res.status(500).json({ error: 'Erro ao deletar PDF', message: error.message });
  }
});

// ==================== PARTS REQUESTS ====================

// GET - Listar todas as solicitações de peças
app.get('/api/parts-requests', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM parts_requests ORDER BY created_at DESC');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar solicitações de peças:', error);
    res.status(500).json({ error: 'Erro ao listar solicitações de peças', message: error.message });
  }
});

// POST - Criar nova solicitação de peça
app.post('/api/parts-requests', async (req, res) => {
  try {
    const { part_name, quantity, equipment, sector, requested_by, status, notes, images } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO parts_requests (part_name, quantity, equipment, sector, requested_by, status, notes, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [part_name, quantity || 1, equipment, sector, requested_by, status || 'Pendente', notes, images ? JSON.stringify(images) : null]
    );
    
    // Buscar o registro inserido
    const [inserted] = await pool.query(
      'SELECT * FROM parts_requests WHERE id = ?',
      [result.insertId]
    );
    
    // Enviar e-mail para gerentes
    try {
      const [managers] = await pool.query(
        "SELECT * FROM users WHERE role = 'Gerente' AND active = true"
      );
      if (managers.length > 0) {
        await emailService.sendNewPartsRequestEmail(inserted[0], managers);
      }
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar e-mail:', emailError);
    }
    
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar solicitação de peça:', error);
    res.status(500).json({ error: 'Erro ao criar solicitação de peça', message: error.message });
  }
});

// PUT - Atualizar solicitação de peça
app.put('/api/parts-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Construir query dinâmica apenas com campos enviados
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const query = `UPDATE parts_requests SET ${setClause} WHERE id = ?`;
    
    await pool.query(query, [...values, id]);
    const [updated] = await pool.query('SELECT * FROM parts_requests WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar solicitação de peça:', error);
    res.status(500).json({ error: 'Erro ao atualizar solicitação de peça', message: error.message });
  }
});

// DELETE - Deletar solicitação de peça
app.delete('/api/parts-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM parts_requests WHERE id = ?', [id]);
    res.json({ message: 'Solicitação de peça deletada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar solicitação de peça:', error);
    res.status(500).json({ error: 'Erro ao deletar solicitação de peça', message: error.message });
  }
});

// ==================== PERMISSIONS ====================

// GET - Listar todas as permissões
app.get('/api/permissions', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM permissions ORDER BY role');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar permissões:', error);
    res.status(500).json({ error: 'Erro ao listar permissões', message: error.message });
  }
});

// ==================== NOTIFICATIONS ====================

// GET - Listar notificações de um usuário
app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [result] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar notificações:', error);
    res.status(500).json({ error: 'Erro ao listar notificações', message: error.message });
  }
});

// POST - Criar nova notificação
app.post('/api/notifications', async (req, res) => {
  try {
    const { user_id, title, message, type } = req.body;
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
      [user_id, title, message, type || 'info']
    );
    const [inserted] = await pool.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar notificação:', error);
    res.status(500).json({ error: 'Erro ao criar notificação', message: error.message });
  }
});

// PUT - Marcar notificação como lida
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE notifications SET read = true WHERE id = ?',
      [id]
    );
    const [updated] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao marcar notificação como lida:', error);
    res.status(500).json({ error: 'Erro ao marcar notificação como lida', message: error.message });
  }
});

// ==================== UPLOAD DE ARQUIVOS ====================

// POST - Upload de arquivo único
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.status(201).json({
      success: true,
      file: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl
      }
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload:', error);
    res.status(500).json({ error: 'Erro ao fazer upload', message: error.message });
  }
});

// POST - Upload de múltiplos arquivos
app.post('/api/upload/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const files = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `${baseUrl}/uploads/${file.filename}`
    }));
    
    res.status(201).json({
      success: true,
      files: files,
      count: files.length
    });
  } catch (error) {
    console.error('❌ Erro ao fazer upload múltiplo:', error);
    res.status(500).json({ error: 'Erro ao fazer upload', message: error.message });
  }
});

// DELETE - Deletar arquivo
app.delete('/api/upload/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Arquivo deletado com sucesso' });
    } else {
      res.status(404).json({ error: 'Arquivo não encontrado' });
    }
  } catch (error) {
    console.error('❌ Erro ao deletar arquivo:', error);
    res.status(500).json({ error: 'Erro ao deletar arquivo', message: error.message });
  }
});

// ==================== PREVENTIVE MAINTENANCE ====================

// GET - Listar template do checklist
app.get('/api/preventive-maintenance/checklist-template', async (req, res) => {
  try {
    const [template] = await pool.query(
      'SELECT * FROM checklist_template WHERE is_active = true ORDER BY item_order'
    );
    res.json(template);
  } catch (error) {
    console.error('❌ Erro ao listar template do checklist:', error);
    res.status(500).json({ error: 'Erro ao listar template', message: error.message });
  }
});

// GET - Listar agendamentos de manutenção preventiva
app.get('/api/preventive-maintenance/schedule', async (req, res) => {
  try {
    const [schedules] = await pool.query(
      'SELECT * FROM preventive_maintenance_schedule ORDER BY scheduled_date ASC'
    );
    res.json(schedules);
  } catch (error) {
    console.error('❌ Erro ao listar agendamentos:', error);
    res.status(500).json({ error: 'Erro ao listar agendamentos', message: error.message });
  }
});

// GET - Buscar agendamento por ID com checklist
app.get('/api/preventive-maintenance/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [schedule] = await pool.query(
      'SELECT * FROM preventive_maintenance_schedule WHERE id = ?',
      [id]
    );
    
    if (schedule.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    const [checklist] = await pool.query(
      'SELECT * FROM preventive_maintenance_checklist WHERE maintenance_id = ? ORDER BY item_order',
      [id]
    );
    
    res.json({ ...schedule[0], checklist });
  } catch (error) {
    console.error('❌ Erro ao buscar agendamento:', error);
    res.status(500).json({ error: 'Erro ao buscar agendamento', message: error.message });
  }
});

// POST - Criar agendamento de manutenção preventiva
app.post('/api/preventive-maintenance/schedule', async (req, res) => {
  try {
    const { equipment_id, equipment_name, sector, scheduled_date, frequency_days, created_by, notes } = req.body;
    
    // Criar agendamento
    const [result] = await pool.query(
      'INSERT INTO preventive_maintenance_schedule (equipment_id, equipment_name, sector, scheduled_date, frequency_days, created_by, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [equipment_id, equipment_name, sector, scheduled_date, frequency_days || 90, created_by, notes]
    );
    
    const maintenanceId = result.insertId;
    
    // Buscar template do checklist
    const [template] = await pool.query(
      'SELECT * FROM checklist_template WHERE is_active = true ORDER BY item_order'
    );
    
    // Criar itens do checklist para esta manutenção
    for (const item of template) {
      await pool.query(
        'INSERT INTO preventive_maintenance_checklist (maintenance_id, item_name, item_order) VALUES (?, ?, ?)',
        [maintenanceId, item.item_name, item.item_order]
      );
    }
    
    // Buscar o registro completo
    const [inserted] = await pool.query(
      'SELECT * FROM preventive_maintenance_schedule WHERE id = ?',
      [maintenanceId]
    );
    
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar agendamento:', error);
    res.status(500).json({ error: 'Erro ao criar agendamento', message: error.message });
  }
});

// PUT - Atualizar status do agendamento
app.put('/api/preventive-maintenance/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, completed_by, notes } = req.body;
    
    const updates = [];
    const values = [];
    
    if (status) {
      updates.push('status = ?');
      values.push(status);
    }
    
    if (completed_by) {
      updates.push('completed_by = ?');
      values.push(completed_by);
    }
    
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    
    if (status === 'Concluída') {
      updates.push('completed_at = NOW()');
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    
    values.push(id);
    
    await pool.query(
      `UPDATE preventive_maintenance_schedule SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const [updated] = await pool.query(
      'SELECT * FROM preventive_maintenance_schedule WHERE id = ?',
      [id]
    );
    
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar agendamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar agendamento', message: error.message });
  }
});

// PUT - Atualizar item do checklist
app.put('/api/preventive-maintenance/checklist/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_completed, observations, completed_by } = req.body;
    
    const updates = [];
    const values = [];
    
    if (is_completed !== undefined) {
      updates.push('is_completed = ?');
      values.push(is_completed);
      
      if (is_completed) {
        updates.push('completed_at = NOW()');
        if (completed_by) {
          updates.push('completed_by = ?');
          values.push(completed_by);
        }
      }
    }
    
    if (observations !== undefined) {
      updates.push('observations = ?');
      values.push(observations);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    
    values.push(id);
    
    await pool.query(
      `UPDATE preventive_maintenance_checklist SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    const [updated] = await pool.query(
      'SELECT * FROM preventive_maintenance_checklist WHERE id = ?',
      [id]
    );
    
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar item do checklist:', error);
    res.status(500).json({ error: 'Erro ao atualizar item', message: error.message });
  }
});

// POST - Finalizar manutenção e salvar no histórico
app.post('/api/preventive-maintenance/complete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by, general_observations, next_maintenance_date } = req.body;
    
    // Buscar agendamento
    const [schedule] = await pool.query(
      'SELECT * FROM preventive_maintenance_schedule WHERE id = ?',
      [id]
    );
    
    if (schedule.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Buscar checklist
    const [checklist] = await pool.query(
      'SELECT * FROM preventive_maintenance_checklist WHERE maintenance_id = ?',
      [id]
    );
    
    // Salvar no histórico
    await pool.query(
      'INSERT INTO preventive_maintenance_history (equipment_id, equipment_name, maintenance_date, performed_by, checklist_summary, general_observations, next_maintenance_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        schedule[0].equipment_id,
        schedule[0].equipment_name,
        new Date(),
        performed_by,
        JSON.stringify(checklist),
        general_observations,
        next_maintenance_date
      ]
    );
    
    // Atualizar status para concluída
    await pool.query(
      'UPDATE preventive_maintenance_schedule SET status = "Concluída", completed_at = NOW(), completed_by = ? WHERE id = ?',
      [performed_by, id]
    );
    
    // Se houver próxima data, criar novo agendamento
    if (next_maintenance_date) {
      await pool.query(
        'INSERT INTO preventive_maintenance_schedule (equipment_id, equipment_name, sector, scheduled_date, frequency_days, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [
          schedule[0].equipment_id,
          schedule[0].equipment_name,
          schedule[0].sector,
          next_maintenance_date,
          schedule[0].frequency_days,
          performed_by
        ]
      );
    }
    
    res.json({ success: true, message: 'Manutenção finalizada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao finalizar manutenção:', error);
    res.status(500).json({ error: 'Erro ao finalizar manutenção', message: error.message });
  }
});

// GET - Buscar histórico de manutenções de um equipamento
app.get('/api/preventive-maintenance/history/:equipment_id', async (req, res) => {
  try {
    const { equipment_id } = req.params;
    const [history] = await pool.query(
      'SELECT * FROM preventive_maintenance_history WHERE equipment_id = ? ORDER BY maintenance_date DESC',
      [equipment_id]
    );
    res.json(history);
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico', message: error.message });
  }
});

// GET - Buscar manutenções vencidas (para criar solicitações automáticas)
app.get('/api/preventive-maintenance/overdue', async (req, res) => {
  try {
    const [overdue] = await pool.query(
      'SELECT * FROM preventive_maintenance_schedule WHERE scheduled_date <= CURDATE() AND status = "Pendente" ORDER BY scheduled_date ASC'
    );
    res.json(overdue);
  } catch (error) {
    console.error('❌ Erro ao buscar manutenções vencidas:', error);
    res.status(500).json({ error: 'Erro ao buscar manutenções vencidas', message: error.message });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT NOW() as now');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: result[0].now 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      database: 'disconnected',
      error: error.message 
    });
  }
});

// ==================== SERVIDOR ====================

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 API disponível em: http://localhost:${PORT}`);
  console.log(`🗄️  Banco de dados: MySQL`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
  console.error('❌ Erro não tratado:', err);
});

