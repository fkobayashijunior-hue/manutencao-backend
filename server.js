const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('./database');
const initDatabase = require('./init-database');
const emailService = require('./emailService');
const cloudinary = require('cloudinary').v2;

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djob7pxme',
  api_key: process.env.CLOUDINARY_API_KEY || '327264618148747',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'YVfR9FK2J8XcFhGPxc4wZX_4ZvY'
});

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors({
  origin: ['https://azaconnect.com.br', 'http://azaconnect.com.br', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
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

// Upload em memória para Cloudinary (melhor para Render)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
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
    const users = result.map(user => {
      let formattedBirthdate = null;
      if (user.birthdate) {
        try {
          const date = new Date(user.birthdate);
          if (!isNaN(date.getTime())) {
            formattedBirthdate = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn(`⚠️ Birthdate inválido para usuário ${user.id}:`, user.birthdate);
        }
      }
      return {
        ...user,
        birthdate: formattedBirthdate
      };
    });
    res.json(users);
  } catch (error) {
    console.error('❌ Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro ao listar usuários', message: error.message });
  }
});

// POST - Criar novo usuário
app.post('/api/users', async (req, res) => {
  try {
    const { name, username, password, role, sector, birthdate, email, phone, cpf, admission_date } = req.body;
    
    // Verificar se username já existe
    const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Erro ao criar usuário', message: 'Nome de usuário já existe' });
    }
    
    const [result] = await pool.query(
      'INSERT INTO users (name, username, password, role, sector, birthdate, email, phone, cpf, admission_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, username, password, role, sector, birthdate, email || null, phone || null, cpf || null, admission_date || null]
    );
    // Buscar registro inserido
    const [inserted] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    // Se for erro de chave duplicada, retornar mensagem amigável
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Erro ao criar usuário', message: 'Nome de usuário já existe' });
    }
    res.status(500).json({ error: 'Erro ao criar usuário', message: error.message });
  }
});

// PUT - Atualizar usuário
app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, username, password, role, sector, birthdate, email, phone, cpf, admission_date } = req.body;
    await pool.query(
      'UPDATE users SET name = ?, username = ?, password = ?, role = ?, sector = ?, birthdate = ?, email = ?, phone = ?, cpf = ?, admission_date = ? WHERE id = ?',
      [name, username, password, role, sector, birthdate, email || null, phone || null, cpf || null, admission_date || null, id]
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
    
    // Parse photos JSON para array
    const assetsWithPhotos = result.map(asset => ({
      ...asset,
      photos: asset.photos ? JSON.parse(asset.photos) : []
    }));
    
    res.json(assetsWithPhotos);
  } catch (error) {
    console.error('❌ Erro ao listar equipamentos:', error);
    res.status(500).json({ error: 'Erro ao listar equipamentos', message: error.message });
  }
});

// POST - Criar novo equipamento
app.post('/api/assets', async (req, res) => {
  try {
    const { name, type, number, model, serial_number, sector, status, brand, year, photos } = req.body;
    
    // Converter photos array para JSON string
    const photosJson = photos ? JSON.stringify(photos) : null;
    
    const [result] = await pool.query(
      'INSERT INTO assets (name, type, number, model, serial_number, sector, status, brand, year, photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, type, number, model, serial_number, sector, status || 'Ativo', brand, year, photosJson]
    );
    const [inserted] = await pool.query('SELECT * FROM assets WHERE id = ?', [result.insertId]);
    const asset = inserted[0];
    
    // Parse photos JSON para array
    if (asset.photos) {
      asset.photos = JSON.parse(asset.photos);
    }
    
    res.status(201).json(asset);
  } catch (error) {
    console.error('❌ Erro ao criar equipamento:', error);
    res.status(500).json({ error: 'Erro ao criar equipamento', message: error.message });
  }
});

// PUT - Atualizar equipamento
app.put('/api/assets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, number, model, serial_number, sector, status, brand, year, photos } = req.body;
    
    // Converter photos array para JSON string
    const photosJson = photos ? JSON.stringify(photos) : null;
    
    await pool.query(
      'UPDATE assets SET name = ?, type = ?, number = ?, model = ?, serial_number = ?, sector = ?, status = ?, brand = ?, year = ?, photos = ? WHERE id = ?',
      [name, type, number, model, serial_number, sector, status, brand, year, photosJson, id]
    );
    const [updated] = await pool.query('SELECT * FROM assets WHERE id = ?', [id]);
    const asset = updated[0];
    
    // Parse photos JSON para array
    if (asset.photos) {
      asset.photos = JSON.parse(asset.photos);
    }
    
    res.json(asset);
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
    const { equipment, sector, description, urgency, status, requested_by, assigned_to, service_executed, preventive_maintenance, images } = req.body;
    const imagesJson = images ? JSON.stringify(images) : null;
    const [result] = await pool.query(
      'INSERT INTO requests (equipment, sector, description, urgency, status, requested_by, assigned_to, service_executed, preventive_maintenance, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [equipment, sector, description, urgency, status || 'Pendente', requested_by, assigned_to, service_executed, preventive_maintenance, imagesJson]
    );
    
    // Buscar registro inserido
    const [inserted] = await pool.query('SELECT * FROM requests WHERE id = ?', [result.insertId]);
    
    // Enviar e-mail para mecânicos
    try {
      const [mechanics] = await pool.query(
        "SELECT * FROM users WHERE role IN ('Mecânico', 'Mecânico Encarregado')"
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
    const { equipment, sector, description, urgency, status, requested_by, assigned_to, service_executed, preventive_maintenance, images } = req.body;
    const imagesJson = images ? JSON.stringify(images) : null;
    await pool.query(
      'UPDATE requests SET equipment = ?, sector = ?, description = ?, urgency = ?, status = ?, requested_by = ?, assigned_to = ?, service_executed = ?, preventive_maintenance = ?, images = ? WHERE id = ?',
      [equipment, sector, description, urgency, status, requested_by, assigned_to, service_executed, preventive_maintenance, imagesJson, id]
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
    
    // Formatar data para YYYY-MM-DD antes de retornar
    const agulha = inserted[0];
    if (agulha.date) {
      const d = new Date(agulha.date);
      agulha.date = d.toISOString().split('T')[0];
    }
    
    res.status(201).json(agulha);
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

// ==================== POPS ====================

// GET - Listar todos os POPs
app.get('/api/pops', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM pops ORDER BY created_at DESC');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar POPs:', error);
    res.status(500).json({ error: 'Erro ao listar POPs', message: error.message });
  }
});

// POST - Criar novo POP
app.post('/api/pops', async (req, res) => {
  try {
    const { title, description, sector, scope, file_url, file_name, uploaded_by } = req.body;
    const [result] = await pool.query(
      'INSERT INTO pops (title, description, sector, scope, file_url, file_name, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [title, description, sector, scope, file_url, file_name, uploaded_by]
    );
    const [inserted] = await pool.query('SELECT * FROM pops WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar POP:', error);
    res.status(500).json({ error: 'Erro ao criar POP', message: error.message });
  }
});

// DELETE - Deletar POP
app.delete('/api/pops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM pops WHERE id = ?', [id]);
    res.json({ message: 'POP deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar POP:', error);
    res.status(500).json({ error: 'Erro ao deletar POP', message: error.message });
  }
});

// ==================== PARTS REQUESTS ====================

// GET - Listar todas as solicitações de peças
app.get('/api/parts-requests', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM parts_requests ORDER BY created_at DESC');
    
    // Parsear imagens de JSON string para array
    const parsedResult = result.map(item => ({
      ...item,
      images: item.images ? (typeof item.images === 'string' ? JSON.parse(item.images) : item.images) : []
    }));
    
    res.json(parsedResult);
  } catch (error) {
    console.error('❌ Erro ao listar solicitações de peças:', error);
    res.status(500).json({ error: 'Erro ao listar solicitações de peças', message: error.message });
  }
});

// POST - Criar nova solicitação de peça
app.post('/api/parts-requests', async (req, res) => {
  try {
    const { part_name, quantity, equipment, sector, requested_by, status, notes, images } = req.body;
    
    // Processar imagens: se for array vazio ou null, salva como null; senão, salva como JSON
    let imagesToSave = null;
    if (images && Array.isArray(images) && images.length > 0) {
      imagesToSave = JSON.stringify(images);
    }
    
    const [result] = await pool.query(
      'INSERT INTO parts_requests (part_name, quantity, equipment, sector, requested_by, status, notes, images) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [part_name, quantity || 1, equipment, sector, requested_by, status || 'Pendente', notes, imagesToSave]
    );
    
    // Buscar o registro inserido
    const [inserted] = await pool.query(
      'SELECT * FROM parts_requests WHERE id = ?',
      [result.insertId]
    );
    
    // Parsear imagens no resultado
    const parsedInserted = {
      ...inserted[0],
      images: inserted[0].images ? (typeof inserted[0].images === 'string' ? JSON.parse(inserted[0].images) : inserted[0].images) : []
    };
    
    // Enviar e-mail para gerentes
    try {
      const [managers] = await pool.query(
        "SELECT * FROM users WHERE role = 'Gerente' AND active = true"
      );
      if (managers.length > 0) {
        await emailService.sendNewPartsRequestEmail(parsedInserted, managers);
      }
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar e-mail:', emailError);
    }
    
    // Enviar e-mail específico para Cláudia
    try {
      // Buscar e-mail da Cláudia do banco de dados
      const [claudia] = await pool.query(
        "SELECT email FROM users WHERE name LIKE '%Cláudia%' OR name LIKE '%Claudia%' LIMIT 1"
      );
      
      if (claudia.length > 0 && claudia[0].email) {
        const { sendPartsOrderEmail } = require('./emailService-accessory');
        const orderData = {
          order_number: `PEC-${result.insertId}`,
          sector_name: sector,
          created_at: new Date(),
          observations: notes
        };
        const items = [{
          code: '-',
          description: part_name,
          quantity: quantity || 1,
          unit: 'UN'
        }];
        await sendPartsOrderEmail(orderData, items, requested_by, claudia[0].email);
      } else {
        console.warn('⚠️ Cláudia não encontrada ou sem e-mail cadastrado');
      }
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar e-mail para Cláudia (pedido criado com sucesso):', emailError);
    }
    
    res.status(201).json(parsedInserted);
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
    
    // Processar imagens se estiver sendo atualizado
    if (updates.images !== undefined) {
      if (Array.isArray(updates.images) && updates.images.length > 0) {
        updates.images = JSON.stringify(updates.images);
      } else {
        updates.images = null;
      }
    }
    
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
    
    // Parsear imagens no resultado
    const parsedUpdated = {
      ...updated[0],
      images: updated[0].images ? (typeof updated[0].images === 'string' ? JSON.parse(updated[0].images) : updated[0].images) : []
    };
    
    res.json(parsedUpdated);
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

// ==================== PEDIDOS - COMENTÁRIOS ====================

// GET - Listar comentários de um pedido de manutenção
app.get('/api/parts-requests/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const [comments] = await pool.query(
      'SELECT * FROM parts_request_comments WHERE request_id = ? ORDER BY created_at ASC',
      [id]
    );
    res.json(comments);
  } catch (error) {
    console.error('❌ Erro ao listar comentários:', error);
    res.status(500).json({ error: 'Erro ao listar comentários', message: error.message });
  }
});

// POST - Adicionar comentário em um pedido de manutenção
app.post('/api/parts-requests/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, user_name, comment } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO parts_request_comments (request_id, user_id, user_name, comment) VALUES (?, ?, ?, ?)',
      [id, user_id, user_name, comment]
    );
    
    // Buscar comentário inserido
    const [inserted] = await pool.query(
      'SELECT * FROM parts_request_comments WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao adicionar comentário:', error);
    res.status(500).json({ error: 'Erro ao adicionar comentário', message: error.message });
  }
});

// ==================== PERMISSIONS ====================

// GET - Listar todas as permissões
app.get('/api/permissions', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT * FROM permissions ORDER BY user_id');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar permissões:', error);
    res.status(500).json({ error: 'Erro ao listar permissões', message: error.message });
  }
});

// GET - Buscar permissões de um usuário específico
app.get('/api/permissions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [result] = await pool.query('SELECT * FROM permissions WHERE user_id = ?', [userId]);
    
    if (result.length === 0) {
      return res.json({ user_id: userId, permissions: null });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('❌ Erro ao buscar permissões do usuário:', error);
    res.status(500).json({ error: 'Erro ao buscar permissões', message: error.message });
  }
});

// PUT - Atualizar permissões de um usuário
app.put('/api/permissions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    
    if (!permissions) {
      return res.status(400).json({ error: 'Permissões não fornecidas' });
    }
    
    // Verificar se já existe registro de permissões para este usuário
    const [existing] = await pool.query('SELECT * FROM permissions WHERE user_id = ?', [userId]);
    
    if (existing.length > 0) {
      // Atualizar permissões existentes
      await pool.query(
        'UPDATE permissions SET permissions = ?, updated_at = NOW() WHERE user_id = ?',
        [JSON.stringify(permissions), userId]
      );
    } else {
      // Criar novo registro de permissões
      await pool.query(
        'INSERT INTO permissions (user_id, permissions, updated_at) VALUES (?, ?, NOW())',
        [userId, JSON.stringify(permissions)]
      );
    }
    
    // Buscar e retornar permissões atualizadas
    const [updated] = await pool.query('SELECT * FROM permissions WHERE user_id = ?', [userId]);
    
    res.json({ 
      success: true, 
      message: 'Permissões atualizadas com sucesso!',
      permissions: updated[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar permissões:', error);
    res.status(500).json({ error: 'Erro ao atualizar permissões', message: error.message });
  }
});

// DELETE - Resetar permissões de um usuário (volta para padrão do perfil)
app.delete('/api/permissions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await pool.query('DELETE FROM permissions WHERE user_id = ?', [userId]);
    
    res.json({ 
      success: true, 
      message: 'Permissões resetadas para o padrão do perfil!'
    });
  } catch (error) {
    console.error('❌ Erro ao resetar permissões:', error);
    res.status(500).json({ error: 'Erro ao resetar permissões', message: error.message });
  }
});

// ==================== NOTIFICATIONS (DEPRECATED) ====================
// NOTA: Rotas antigas comentadas - usar as rotas novas na linha ~2139

// GET - Listar notificações de um usuário (DEPRECATED - usar /api/notifications com query params)
// app.get('/api/notifications/:userId', async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const [result] = await pool.query(
//       'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
//       [userId]
//     );
//     res.json(result);
//   } catch (error) {
//     console.error('❌ Erro ao listar notificações:', error);
//     res.status(500).json({ error: 'Erro ao listar notificações', message: error.message });
//   }
// });

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
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?',
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
// Rota de upload para Cloudinary (usando memória)
app.post('/api/upload', uploadMemory.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    // Upload para Cloudinary usando buffer (sem salvar em disco)
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'aza-connect/requests',
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          console.error('❌ Erro ao fazer upload no Cloudinary:', error);
          return res.status(500).json({ error: 'Erro ao fazer upload', message: error.message });
        }
        
        res.status(201).json({
          success: true,
          url: result.secure_url,
          file: {
            filename: req.file.originalname,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            url: result.secure_url
          }
        });
      }
    );

    // Enviar buffer para o stream
    uploadStream.end(req.file.buffer);
    
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

// DELETE - Excluir agendamento de manutenção preventiva
app.delete('/api/preventive-maintenance/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se o agendamento existe
    const [schedule] = await pool.query(
      'SELECT * FROM preventive_maintenance_schedule WHERE id = ?',
      [id]
    );
    
    if (schedule.length === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    
    // Excluir itens do checklist relacionados
    await pool.query(
      'DELETE FROM preventive_maintenance_checklist WHERE maintenance_id = ?',
      [id]
    );
    
    // Excluir agendamento
    await pool.query(
      'DELETE FROM preventive_maintenance_schedule WHERE id = ?',
      [id]
    );
    
    res.json({ message: 'Agendamento excluído com sucesso', id });
  } catch (error) {
    console.error('❌ Erro ao excluir agendamento:', error);
    res.status(500).json({ error: 'Erro ao excluir agendamento', message: error.message });
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


// ==================== ACCESSORY ORDERS (PEDIDO DE ACESSÓRIOS) ====================
// Rotas para o módulo de Pedido de Acessórios v7.2
// Desenvolvido por: Kobayashi & Pyotec
// Cliente: Aza Têxtil | Zen Confecções

// ========== ACCESSORIES (Cadastro de Acessórios) ==========

// GET - Listar todos os acessórios
app.get('/api/accessories', async (req, res) => {
  try {
    const { status, category, sector_id } = req.query;
    
    let query = `
      SELECT a.*, u.name as created_by_name
      FROM accessories a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    
    if (category) {
      query += ' AND a.category = ?';
      params.push(category);
    }
    
    if (sector_id) {
      query += ' AND a.sector_id = ?';
      params.push(sector_id);
    }
    
    query += ' ORDER BY a.description';
    
    const [result] = await pool.query(query, params);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar acessórios:', error);
    res.status(500).json({ error: 'Erro ao listar acessórios', message: error.message });
  }
});

// GET - Buscar acessório por ID
app.get('/api/accessories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(`
      SELECT a.*, u.name as created_by_name
      FROM accessories a
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.id = ?
    `, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Acessório não encontrado' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('❌ Erro ao buscar acessório:', error);
    res.status(500).json({ error: 'Erro ao buscar acessório', message: error.message });
  }
});

// POST - Criar novo acessório
app.post('/api/accessories', async (req, res) => {
  try {
    const { code, description, image_url, sector_id, category, unit, status, created_by } = req.body;
    
    // Validações
    if (!code || !description) {
      return res.status(400).json({ error: 'Código e descrição são obrigatórios' });
    }
    
    // Verificar se código já existe
    const [existing] = await pool.query('SELECT id FROM accessories WHERE code = ?', [code]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Código já cadastrado' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO accessories (code, description, image_url, sector_id, category, unit, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, description, image_url || null, sector_id || null, category || 'Outros', unit || 'Peça', status || 'Ativo', created_by || null]
    );
    
    // Buscar o acessório criado
    const [newAccessory] = await pool.query('SELECT * FROM accessories WHERE id = ?', [result.insertId]);
    
    console.log('✅ Acessório criado:', newAccessory[0]);
    res.status(201).json(newAccessory[0]);
  } catch (error) {
    console.error('❌ Erro ao criar acessório:', error);
    res.status(500).json({ error: 'Erro ao criar acessório', message: error.message });
  }
});

// PUT - Atualizar acessório
app.put('/api/accessories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, description, image_url, sector_id, category, unit, status } = req.body;
    
    // Verificar se acessório existe
    const [existing] = await pool.query('SELECT id FROM accessories WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Acessório não encontrado' });
    }
    
    // Verificar se código já existe em outro acessório
    if (code) {
      const [duplicate] = await pool.query('SELECT id FROM accessories WHERE code = ? AND id != ?', [code, id]);
      if (duplicate.length > 0) {
        return res.status(400).json({ error: 'Código já cadastrado em outro acessório' });
      }
    }
    
    await pool.query(
      `UPDATE accessories 
       SET code = ?, description = ?, image_url = ?, sector_id = ?, category = ?, unit = ?, status = ?
       WHERE id = ?`,
      [code, description, image_url || null, sector_id || null, category, unit, status, id]
    );
    
    // Buscar o acessório atualizado
    const [updated] = await pool.query('SELECT * FROM accessories WHERE id = ?', [id]);
    
    console.log('✅ Acessório atualizado:', updated[0]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar acessório:', error);
    res.status(500).json({ error: 'Erro ao atualizar acessório', message: error.message });
  }
});

// DELETE - Excluir acessório
app.delete('/api/accessories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🗑️ Tentando excluir acessório ID:', id);
    
    // Verificar se acessório existe
    const [existing] = await pool.query('SELECT * FROM accessories WHERE id = ?', [id]);
    if (existing.length === 0) {
      console.log('❌ Acessório não encontrado:', id);
      return res.status(404).json({ error: 'Acessório não encontrado' });
    }
    console.log('✅ Acessório encontrado:', existing[0]);
    
    // Verificar pedidos que usam este acessório
    const [orders] = await pool.query('SELECT * FROM accessory_order_items WHERE accessory_id = ?', [id]);
    console.log('📦 Pedidos encontrados:', orders.length);
    
    // Atualizar pedidos que usam este acessório (setar accessory_id como NULL)
    if (orders.length > 0) {
      console.log('🔄 Atualizando', orders.length, 'pedidos...');
      const result = await pool.query('UPDATE accessory_order_items SET accessory_id = NULL WHERE accessory_id = ?', [id]);
      console.log('✅ Pedidos atualizados:', result[0].affectedRows);
    }
    
    // Excluir acessório
    console.log('🗑️ Excluindo acessório...');
    const deleteResult = await pool.query('DELETE FROM accessories WHERE id = ?', [id]);
    console.log('✅ Acessório excluído:', deleteResult[0].affectedRows, 'linha(s)');
    
    res.json({ message: 'Acessório excluído com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao excluir acessório:', error);
    console.error('❌ Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Erro ao excluir acessório', 
      message: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage 
    });
  }
});

// ========== ACCESSORY ORDERS (Pedidos) ==========

// GET - Listar todos os pedidos
app.get('/api/accessory-orders', async (req, res) => {
  try {
    const { status, requester_id, sector_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        ao.*,
        u.name as requester_name,
        COUNT(aoi.id) as total_items,
        SUM(CASE WHEN aoi.status = 'Pendente' THEN 1 ELSE 0 END) as pending_items,
        SUM(CASE WHEN aoi.status = 'Aprovado' THEN 1 ELSE 0 END) as approved_items,
        SUM(CASE WHEN aoi.status = 'Comprado' THEN 1 ELSE 0 END) as purchased_items,
        SUM(CASE WHEN aoi.status = 'Recebido' THEN 1 ELSE 0 END) as received_items
      FROM accessory_orders ao
      LEFT JOIN users u ON ao.requester_id = u.id
      LEFT JOIN accessory_order_items aoi ON ao.id = aoi.order_id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND ao.status = ?';
      params.push(status);
    }
    
    if (requester_id) {
      query += ' AND ao.requester_id = ?';
      params.push(requester_id);
    }
    
    if (sector_id) {
      query += ' AND ao.sector_id = ?';
      params.push(sector_id);
    }
    
    if (start_date) {
      query += ' AND DATE(ao.created_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND DATE(ao.created_at) <= ?';
      params.push(end_date);
    }
    
    query += ' GROUP BY ao.id ORDER BY ao.created_at DESC';
    
    const [result] = await pool.query(query, params);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar pedidos:', error);
    res.status(500).json({ error: 'Erro ao listar pedidos', message: error.message });
  }
});

// GET - Buscar pedido por ID (com itens)
app.get('/api/accessory-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Buscar pedido
    const [orders] = await pool.query(`
      SELECT ao.*, u.name as requester_name
      FROM accessory_orders ao
      LEFT JOIN users u ON ao.requester_id = u.id
      WHERE ao.id = ?
    `, [id]);
    
    if (orders.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    const order = orders[0];
    
    // Buscar itens do pedido
    const [items] = await pool.query(`
      SELECT 
        aoi.*,
        a.code as accessory_code,
        a.description as accessory_description,
        a.image_url as accessory_image,
        a.unit as accessory_unit,
        a.category as accessory_category,
        u1.name as approved_by_name,
        u2.name as purchased_by_name,
        u3.name as received_by_name
      FROM accessory_order_items aoi
      LEFT JOIN accessories a ON aoi.accessory_id = a.id
      LEFT JOIN users u1 ON aoi.approved_by = u1.id
      LEFT JOIN users u2 ON aoi.purchased_by = u2.id
      LEFT JOIN users u3 ON aoi.received_by = u3.id
      WHERE aoi.order_id = ?
      ORDER BY aoi.id
    `, [id]);
    
    order.items = items;
    
    res.json(order);
  } catch (error) {
    console.error('❌ Erro ao buscar pedido:', error);
    res.status(500).json({ error: 'Erro ao buscar pedido', message: error.message });
  }
});

// POST - Criar novo pedido
app.post('/api/accessory-orders', async (req, res) => {
  try {
    const { requester_id, sector_id, observations, items } = req.body;
    
    // Validações
    if (!requester_id) {
      return res.status(400).json({ error: 'Solicitante é obrigatório' });
    }
    
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'O pedido deve ter pelo menos um item' });
    }
    
    // Gerar número do pedido (formato: ACC-YYYY-NNN)
    const year = new Date().getFullYear();
    const [lastOrder] = await pool.query(
      'SELECT order_number FROM accessory_orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1',
      [`ACC-${year}-%`]
    );
    
    let orderNumber;
    if (lastOrder.length > 0) {
      const lastNumber = parseInt(lastOrder[0].order_number.split('-')[2]);
      orderNumber = `ACC-${year}-${String(lastNumber + 1).padStart(3, '0')}`;
    } else {
      orderNumber = `ACC-${year}-001`;
    }
    
    // Criar pedido
    const [orderResult] = await pool.query(
      `INSERT INTO accessory_orders (order_number, requester_id, sector_id, observations, status)
       VALUES (?, ?, ?, ?, 'Pendente')`,
      [orderNumber, requester_id, sector_id || null, observations || null]
    );
    
    const orderId = orderResult.insertId;
    
    // Inserir itens do pedido
    for (const item of items) {
      await pool.query(
        `INSERT INTO accessory_order_items (order_id, accessory_id, quantity, status)
         VALUES (?, ?, ?, 'Pendente')`,
        [orderId, item.accessory_id, item.quantity]
      );
    }
    
    // Buscar pedido completo criado
    const [newOrder] = await pool.query(`
      SELECT ao.*, u.name as requester_name
      FROM accessory_orders ao
      LEFT JOIN users u ON ao.requester_id = u.id
      WHERE ao.id = ?
    `, [orderId]);
    
    // Buscar itens
    const [orderItems] = await pool.query(`
      SELECT aoi.*, a.code, a.description, a.image_url, a.unit
      FROM accessory_order_items aoi
      LEFT JOIN accessories a ON aoi.accessory_id = a.id
      WHERE aoi.order_id = ?
    `, [orderId]);
    
    newOrder[0].items = orderItems;
    
    // Enviar e-mail para Cláudia (gerente)
    try {
      // Buscar e-mail da Cláudia do banco de dados
      const [claudia] = await pool.query(
        "SELECT email FROM users WHERE name LIKE '%Cláudia%' OR name LIKE '%Claudia%' LIMIT 1"
      );
      
      if (claudia.length > 0 && claudia[0].email) {
        const { sendAccessoryOrderEmail } = require('./emailService-accessory');
        await sendAccessoryOrderEmail(newOrder[0], orderItems, requesterName || 'Usuário', claudia[0].email);
      } else {
        console.warn('⚠️ Cláudia não encontrada ou sem e-mail cadastrado');
      }
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar e-mail (pedido criado com sucesso):', emailError);
    }
    
    console.log('✅ Pedido criado:', orderNumber);
    res.status(201).json(newOrder[0]);
  } catch (error) {
    console.error('❌ Erro ao criar pedido:', error);
    res.status(500).json({ error: 'Erro ao criar pedido', message: error.message });
  }
});

// PUT - Atualizar status do pedido
app.put('/api/accessory-orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Verificar se pedido existe
    const [existing] = await pool.query('SELECT id FROM accessory_orders WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    await pool.query('UPDATE accessory_orders SET status = ? WHERE id = ?', [status, id]);
    
    // Buscar pedido atualizado
    const [updated] = await pool.query('SELECT * FROM accessory_orders WHERE id = ?', [id]);
    
    console.log('✅ Status do pedido atualizado:', id, status);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar status do pedido:', error);
    res.status(500).json({ error: 'Erro ao atualizar status do pedido', message: error.message });
  }
});

// DELETE - Cancelar pedido
app.delete('/api/accessory-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se pedido existe
    const [existing] = await pool.query('SELECT id, status FROM accessory_orders WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }
    
    // Verificar se pode ser cancelado
    if (['Recebido', 'Cancelado'].includes(existing[0].status)) {
      return res.status(400).json({ error: 'Não é possível cancelar pedido com este status' });
    }
    
    // Atualizar status para Cancelado
    await pool.query('UPDATE accessory_orders SET status = ? WHERE id = ?', ['Cancelado', id]);
    await pool.query('UPDATE accessory_order_items SET status = ? WHERE order_id = ?', ['Cancelado', id]);
    
    console.log('✅ Pedido cancelado:', id);
    res.json({ message: 'Pedido cancelado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao cancelar pedido:', error);
    res.status(500).json({ error: 'Erro ao cancelar pedido', message: error.message });
  }
});

// ========== ACCESSORY ORDER COMMENTS (Comentários do Pedido) ==========

// GET - Listar comentários de um pedido de acessório
app.get('/api/accessory-orders/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const [comments] = await pool.query(
      'SELECT * FROM accessory_order_comments WHERE order_id = ? ORDER BY created_at ASC',
      [id]
    );
    res.json(comments);
  } catch (error) {
    console.error('❌ Erro ao listar comentários:', error);
    res.status(500).json({ error: 'Erro ao listar comentários', message: error.message });
  }
});

// POST - Adicionar comentário em um pedido de acessório
app.post('/api/accessory-orders/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, user_name, comment } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO accessory_order_comments (order_id, user_id, user_name, comment) VALUES (?, ?, ?, ?)',
      [id, user_id, user_name, comment]
    );
    
    // Buscar comentário inserido
    const [inserted] = await pool.query(
      'SELECT * FROM accessory_order_comments WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao adicionar comentário:', error);
    res.status(500).json({ error: 'Erro ao adicionar comentário', message: error.message });
  }
});

// ========== ACCESSORY ORDER ITEMS (Itens do Pedido) ==========

// Função auxiliar para atualizar status do pedido baseado nos itens
async function updateAccessoryOrderStatus(orderId) {
  try {
    const [items] = await pool.query(
      'SELECT status FROM accessory_order_items WHERE order_id = ?',
      [orderId]
    );
    
    if (items.length === 0) return;
    
    const statuses = items.map(item => item.status);
    const allPending = statuses.every(s => s === 'Pendente');
    const allRejected = statuses.every(s => s === 'Rejeitado');
    const allCanceled = statuses.every(s => s === 'Cancelado');
    const allReceived = statuses.every(s => s === 'Recebido' || s === 'Rejeitado' || s === 'Cancelado');
    const allPurchased = statuses.every(s => ['Comprado', 'Recebido', 'Rejeitado', 'Cancelado'].includes(s));
    const allApproved = statuses.every(s => ['Aprovado', 'Comprado', 'Recebido', 'Rejeitado', 'Cancelado'].includes(s));
    
    const hasReceived = statuses.some(s => s === 'Recebido');
    const hasPurchased = statuses.some(s => s === 'Comprado');
    const hasApproved = statuses.some(s => s === 'Aprovado');
    
    let newStatus;
    
    if (allCanceled) {
      newStatus = 'Cancelado';
    } else if (allRejected) {
      newStatus = 'Rejeitado';
    } else if (allReceived) {
      newStatus = 'Recebido';
    } else if (hasReceived) {
      newStatus = 'Parcialmente Recebido';
    } else if (allPurchased) {
      newStatus = 'Comprado';
    } else if (hasPurchased) {
      newStatus = 'Parcialmente Comprado';
    } else if (allApproved) {
      newStatus = 'Aprovado';
    } else if (hasApproved) {
      newStatus = 'Parcialmente Aprovado';
    } else if (allPending) {
      newStatus = 'Pendente';
    } else {
      newStatus = 'Em Análise';
    }
    
    await pool.query('UPDATE accessory_orders SET status = ? WHERE id = ?', [newStatus, orderId]);
    
    console.log('✅ Status do pedido atualizado automaticamente:', orderId, newStatus);
  } catch (error) {
    console.error('❌ Erro ao atualizar status do pedido:', error);
  }
}

// PUT - Aprovar/Rejeitar item
app.put('/api/accessory-order-items/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, approved_quantity, approval_notes, approved_by } = req.body;
    
    // Verificar se item existe
    const [existing] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    
    const newStatus = approved ? 'Aprovado' : 'Rejeitado';
    
    await pool.query(
      `UPDATE accessory_order_items 
       SET status = ?, approved_quantity = ?, approval_notes = ?, approved_at = NOW(), approved_by = ?
       WHERE id = ?`,
      [newStatus, approved_quantity || null, approval_notes || null, approved_by || null, id]
    );
    
    // Atualizar status do pedido baseado nos itens
    await updateAccessoryOrderStatus(existing[0].order_id);
    
    // Buscar item atualizado
    const [updated] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    
    console.log('✅ Item', approved ? 'aprovado' : 'rejeitado', ':', id);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao aprovar/rejeitar item:', error);
    res.status(500).json({ error: 'Erro ao aprovar/rejeitar item', message: error.message });
  }
});

// PUT - Registrar compra do item
app.put('/api/accessory-order-items/:id/purchase', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      supplier, 
      purchase_date, 
      unit_price, 
      total_price, 
      expected_arrival_date, 
      invoice_number, 
      purchase_notes, 
      purchased_by 
    } = req.body;
    
    // Verificar se item existe e está aprovado
    const [existing] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    
    if (existing[0].status !== 'Aprovado') {
      return res.status(400).json({ error: 'Item deve estar aprovado para registrar compra' });
    }
    
    await pool.query(
      `UPDATE accessory_order_items 
       SET status = 'Comprado', 
           supplier = ?, 
           purchase_date = ?, 
           unit_price = ?, 
           total_price = ?, 
           expected_arrival_date = ?, 
           invoice_number = ?, 
           purchase_notes = ?, 
           purchased_at = NOW(), 
           purchased_by = ?
       WHERE id = ?`,
      [
        supplier, 
        purchase_date || null, 
        unit_price || null, 
        total_price || null, 
        expected_arrival_date || null, 
        invoice_number || null, 
        purchase_notes || null, 
        purchased_by || null, 
        id
      ]
    );
    
    // Atualizar status do pedido
    await updateAccessoryOrderStatus(existing[0].order_id);
    
    // Buscar item atualizado
    const [updated] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    
    console.log('✅ Compra registrada para item:', id);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao registrar compra:', error);
    res.status(500).json({ error: 'Erro ao registrar compra', message: error.message });
  }
});

// PUT - Registrar recebimento do item (parcial ou total)
app.put('/api/accessory-order-items/:id/receive', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      received_date, 
      received_quantity, 
      reception_status, 
      reception_notes, 
      received_by 
    } = req.body;
    
    // Validações
    if (!received_quantity || received_quantity <= 0) {
      return res.status(400).json({ error: 'Quantidade recebida deve ser maior que zero' });
    }
    
    // Verificar se item existe e está comprado ou em recebimento parcial
    const [existing] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    
    const item = existing[0];
    
    // Verificar se pode receber
    if (item.status !== 'Comprado' && item.status !== 'Recebimento Parcial') {
      return res.status(400).json({ 
        error: 'Item deve estar comprado ou em recebimento parcial para registrar recebimento' 
      });
    }
    
    // Calcular quantidade total recebida
    const currentReceived = item.quantity_received || 0;
    const newTotalReceived = currentReceived + received_quantity;
    
    // Verificar se não excede a quantidade pedida
    if (newTotalReceived > item.quantity) {
      return res.status(400).json({ 
        error: `Quantidade recebida (${newTotalReceived}) excede quantidade pedida (${item.quantity})` 
      });
    }
    
    // Determinar novo status
    let newStatus;
    if (newTotalReceived === item.quantity) {
      // Recebeu tudo
      newStatus = reception_status === 'Com Problemas' ? 'Recebido com Problemas' : 'Recebido';
    } else {
      // Recebeu parcial
      newStatus = 'Recebimento Parcial';
    }
    
    // Registrar no histórico
    await pool.query(
      `INSERT INTO accessory_receive_history 
       (order_item_id, quantity_received, receive_date, receive_status, notes, received_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        received_quantity,
        received_date || new Date(),
        reception_status || 'OK',
        reception_notes || null,
        received_by || null
      ]
    );
    
    // Atualizar item
    await pool.query(
      `UPDATE accessory_order_items 
       SET status = ?, 
           quantity_received = ?,
           received_date = ?,
           reception_status = ?,
           reception_notes = ?,
           received_at = NOW(),
           received_by = ?
       WHERE id = ?`,
      [
        newStatus,
        newTotalReceived,
        received_date || null,
        reception_status || 'OK',
        reception_notes || null,
        received_by || null,
        id
      ]
    );
    
    // Atualizar status do pedido
    await updateAccessoryOrderStatus(item.order_id);
    
    // Buscar item atualizado com histórico
    const [updated] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    const [history] = await pool.query(
      `SELECT h.*, u.name as received_by_name 
       FROM accessory_receive_history h
       LEFT JOIN users u ON h.received_by = u.id
       WHERE h.order_item_id = ?
       ORDER BY h.receive_date DESC`,
      [id]
    );
    
    const result = {
      ...updated[0],
      receive_history: history
    };
    
    console.log(`✅ Recebimento registrado: ${received_quantity}/${item.quantity} - Status: ${newStatus}`);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao registrar recebimento:', error);
    res.status(500).json({ error: 'Erro ao registrar recebimento', message: error.message });
  }
});

// PUT - Editar quantidade aprovada
app.put('/api/accessory-order-items/:id/edit-quantity', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_quantity } = req.body;
    
    // Validações
    if (!approved_quantity || approved_quantity <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
    }
    
    // Verificar se item existe
    const [existing] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    
    const item = existing[0];
    
    // Verificar se pode editar (apenas Aprovado ou Comprado)
    if (item.status !== 'Aprovado' && item.status !== 'Comprado') {
      return res.status(400).json({ 
        error: 'Apenas itens "Aprovados" ou "Comprados" podem ter a quantidade editada' 
      });
    }
    
    // Verificar se não excede quantidade solicitada
    if (approved_quantity > item.quantity) {
      return res.status(400).json({ 
        error: `Quantidade aprovada (${approved_quantity}) não pode exceder quantidade solicitada (${item.quantity})` 
      });
    }
    
    // Atualizar quantidade aprovada
    await pool.query(
      'UPDATE accessory_order_items SET approved_quantity = ? WHERE id = ?',
      [approved_quantity, id]
    );
    
    // Buscar item atualizado
    const [updated] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    
    console.log(`✅ Quantidade editada: Item ${id} - Nova quantidade: ${approved_quantity}`);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao editar quantidade:', error);
    res.status(500).json({ error: 'Erro ao editar quantidade', message: error.message });
  }
});

// PUT - Desfazer recebimento do item (volta para Comprado)
app.put('/api/accessory-order-items/:id/undo-receive', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verificar se item existe e está recebido
    const [existing] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }
    
    const item = existing[0];
    
    // Verificar se pode desfazer
    if (item.status !== 'Recebido' && item.status !== 'Recebido com Problemas') {
      return res.status(400).json({ 
        error: 'Apenas itens com status "Recebido" podem ter o recebimento desfeito' 
      });
    }
    
    // Voltar para status Comprado
    await pool.query(
      `UPDATE accessory_order_items 
       SET status = 'Comprado',
           quantity_received = 0,
           received_date = NULL,
           reception_status = NULL,
           reception_notes = NULL,
           received_at = NULL,
           received_by = NULL
       WHERE id = ?`,
      [id]
    );
    
    // Limpar histórico de recebimentos
    await pool.query('DELETE FROM accessory_receive_history WHERE order_item_id = ?', [id]);
    
    // Atualizar status do pedido
    await updateAccessoryOrderStatus(item.order_id);
    
    // Buscar item atualizado
    const [updated] = await pool.query('SELECT * FROM accessory_order_items WHERE id = ?', [id]);
    
    console.log(`✅ Recebimento desfeito: Item ${id} voltou para Comprado`);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao desfazer recebimento:', error);
    res.status(500).json({ error: 'Erro ao desfazer recebimento', message: error.message });
  }
});

// GET - Buscar histórico de recebimentos de um item
app.get('/api/accessory-order-items/:id/receive-history', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [history] = await pool.query(
      `SELECT h.*, u.name as received_by_name 
       FROM accessory_receive_history h
       LEFT JOIN users u ON h.received_by = u.id
       WHERE h.order_item_id = ?
       ORDER BY h.receive_date DESC`,
      [id]
    );
    
    res.json(history);
  } catch (error) {
    console.error('❌ Erro ao buscar histórico de recebimentos:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico', message: error.message });
  }
});




// ==================== ETIQUETAS ZEBRA ====================
const etiquetasRoutes = require('./etiquetas-routes');
app.use('/api/etiquetas', etiquetasRoutes);

// ==================== ASSINATURAS E CONFIRMAÇÕES ====================
const signaturesRoutes = require('./signatures-routes');
app.use('/api/signatures', signaturesRoutes(pool));


// ==================== NOTIFICATIONS ====================

// GET - Listar notificações do usuário
app.get('/api/notifications', async (req, res) => {
  try {
    const { user_id, unread_only } = req.query;
    
    // Validar user_id
    if (!user_id) {
      return res.status(400).json({ error: 'user_id é obrigatório' });
    }
    
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [user_id];
    
    if (unread_only === 'true') {
      query += ' AND is_read = FALSE';
    }
    
    query += ' ORDER BY created_at DESC LIMIT 100';
    
    const [notifications] = await pool.query(query, params);
    res.json(notifications || []);
  } catch (error) {
    console.error('❌ Erro ao buscar notificações:', error);
    // Retornar array vazio em caso de erro para não quebrar frontend
    res.status(500).json({ error: 'Erro ao buscar notificações', message: error.message, notifications: [] });
  }
});

// GET - Contar notificações não lidas
app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    // Validar user_id
    if (!user_id) {
      return res.status(400).json({ error: 'user_id é obrigatório', count: 0 });
    }
    
    // Verificar se tabela existe
    const [tables] = await pool.query("SHOW TABLES LIKE 'notifications'");
    if (tables.length === 0) {
      console.warn('⚠️ Tabela notifications não existe');
      return res.json({ count: 0 });
    }
    
    const [result] = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [user_id]
    );
    
    res.json({ count: result[0]?.count || 0 });
  } catch (error) {
    console.error('❌ Erro ao contar notificações:', error);
    // Retornar 0 em caso de erro para não quebrar frontend (200 OK)
    res.json({ count: 0 });
  }
});

// POST - Criar notificação
app.post('/api/notifications', async (req, res) => {
  try {
    const { user_id, title, message, type, category, related_id } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, category, related_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, title, message, type || 'info', category || 'system', related_id || null]
    );
    
    const [notification] = await pool.query(
      'SELECT * FROM notifications WHERE id = ?',
      [result.insertId]
    );
    
    // Verificar se deve enviar e-mail
    const [settings] = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [user_id]
    );
    
    if (settings.length > 0 && settings[0].email_enabled) {
      const categoryEmailEnabled = settings[0][`email_${category}`];
      if (categoryEmailEnabled) {
        // Buscar e-mail do usuário
        const [user] = await pool.query('SELECT email FROM users WHERE id = ?', [user_id]);
        if (user.length > 0 && user[0].email) {
          try {
            await emailService.sendNotificationEmail(user[0].email, title, message, type);
          } catch (emailError) {
            console.error('❌ Erro ao enviar e-mail de notificação:', emailError);
          }
        }
      }
    }
    
    console.log(`✅ Notificação criada para usuário ${user_id}: ${title}`);
    res.json(notification[0]);
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
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ?',
      [id]
    );
    
    const [notification] = await pool.query('SELECT * FROM notifications WHERE id = ?', [id]);
    res.json(notification[0]);
  } catch (error) {
    console.error('❌ Erro ao marcar notificação como lida:', error);
    res.status(500).json({ error: 'Erro ao marcar notificação', message: error.message });
  }
});

// PUT - Marcar todas as notificações como lidas
app.put('/api/notifications/read-all', async (req, res) => {
  try {
    const { user_id } = req.body;
    
    await pool.query(
      'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
      [user_id]
    );
    
    res.json({ message: 'Todas as notificações foram marcadas como lidas' });
  } catch (error) {
    console.error('❌ Erro ao marcar todas as notificações:', error);
    res.status(500).json({ error: 'Erro ao marcar notificações', message: error.message });
  }
});

// DELETE - Excluir notificação
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query('DELETE FROM notifications WHERE id = ?', [id]);
    res.json({ message: 'Notificação excluída com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao excluir notificação:', error);
    res.status(500).json({ error: 'Erro ao excluir notificação', message: error.message });
  }
});

// GET - Buscar configurações de notificação do usuário
app.get('/api/notification-settings/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    
    let [settings] = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [user_id]
    );
    
    // Se não existir, criar configuração padrão
    if (settings.length === 0) {
      await pool.query(
        'INSERT INTO notification_settings (user_id) VALUES (?)',
        [user_id]
      );
      [settings] = await pool.query(
        'SELECT * FROM notification_settings WHERE user_id = ?',
        [user_id]
      );
    }
    
    res.json(settings[0]);
  } catch (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações', message: error.message });
  }
});

// PUT - Atualizar configurações de notificação
app.put('/api/notification-settings/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;
    const settings = req.body;
    
    const fields = [];
    const values = [];
    
    Object.keys(settings).forEach(key => {
      if (key !== 'id' && key !== 'user_id' && key !== 'created_at' && key !== 'updated_at') {
        fields.push(`${key} = ?`);
        values.push(settings[key]);
      }
    });
    
    values.push(user_id);
    
    await pool.query(
      `UPDATE notification_settings SET ${fields.join(', ')} WHERE user_id = ?`,
      values
    );
    
    const [updated] = await pool.query(
      'SELECT * FROM notification_settings WHERE user_id = ?',
      [user_id]
    );
    
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar configurações:', error);
    res.status(500).json({ error: 'Erro ao atualizar configurações', message: error.message });
  }
});

// ==================== FIM DAS ROTAS ====================
// ==================== ESTOQUE - MATERIAIS ====================

// GET - Listar todos os materiais
app.get('/api/materials', async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT 
        m.*,
        CASE 
          WHEN m.current_stock = 0 THEN 'CRITICO'
          WHEN m.current_stock < m.minimum_stock THEN 'BAIXO'
          ELSE 'NORMAL'
        END AS alert_status,
        (m.current_stock * m.average_cost) AS total_value,
        (m.minimum_stock - m.current_stock) AS quantity_to_buy
      FROM materials m
      WHERE m.active = TRUE
      ORDER BY m.category, m.name
    `);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar materiais:', error);
    res.status(500).json({ error: 'Erro ao listar materiais', message: error.message });
  }
});

// GET - Buscar material por ID
app.get('/api/materials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(`
      SELECT 
        m.*,
        CASE 
          WHEN m.current_stock = 0 THEN 'CRITICO'
          WHEN m.current_stock < m.minimum_stock THEN 'BAIXO'
          ELSE 'NORMAL'
        END AS alert_status
      FROM materials m
      WHERE m.id = ?
    `, [id]);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Material não encontrado' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('❌ Erro ao buscar material:', error);
    res.status(500).json({ error: 'Erro ao buscar material', message: error.message });
  }
});

// POST - Criar novo material
app.post('/api/materials', async (req, res) => {
  try {
    const { 
      code, name, description, color, category, sector, batch, unit, 
      minimum_stock, current_stock, average_cost, location, supplier, photo_url 
    } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO materials 
      (code, name, description, color, category, sector, batch, unit, minimum_stock, current_stock, average_cost, location, supplier, photo_url) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, name, description, color, category, sector, batch, unit, minimum_stock || 0, current_stock || 0, average_cost || 0, location, supplier, photo_url]
    );
    
    const [inserted] = await pool.query('SELECT * FROM materials WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar material:', error);
    res.status(500).json({ error: 'Erro ao criar material', message: error.message });
  }
});

// PUT - Atualizar material
app.put('/api/materials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, name, description, color, category, sector, batch, unit, 
      minimum_stock, current_stock, average_cost, location, supplier, photo_url 
    } = req.body;
    
    await pool.query(
      `UPDATE materials SET 
      code = ?, name = ?, description = ?, color = ?, category = ?, sector = ?, batch = ?, unit = ?, 
      minimum_stock = ?, current_stock = ?, average_cost = ?, location = ?, supplier = ?, photo_url = ?
      WHERE id = ?`,
      [code, name, description, color, category, sector, batch, unit, minimum_stock, current_stock, average_cost, location, supplier, photo_url, id]
    );
    
    const [updated] = await pool.query('SELECT * FROM materials WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar material:', error);
    res.status(500).json({ error: 'Erro ao atualizar material', message: error.message });
  }
});

// DELETE - Deletar material (soft delete)
app.delete('/api/materials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE materials SET active = FALSE WHERE id = ?', [id]);
    res.json({ message: 'Material deletado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar material:', error);
    res.status(500).json({ error: 'Erro ao deletar material', message: error.message });
  }
});

// ==================== ESTOQUE - MOVIMENTAÇÕES ====================

// GET - Listar movimentações
app.get('/api/stock-movements', async (req, res) => {
  try {
    const { material_id, type, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        sm.*,
        m.code AS material_code,
        m.name AS material_name,
        m.category AS material_category,
        m.unit AS material_unit
      FROM stock_movements sm
      INNER JOIN materials m ON sm.material_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    if (material_id) {
      query += ' AND sm.material_id = ?';
      params.push(material_id);
    }
    
    if (type) {
      query += ' AND sm.type = ?';
      params.push(type);
    }
    
    if (start_date) {
      query += ' AND sm.date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND sm.date <= ?';
      params.push(end_date);
    }
    
    query += ' ORDER BY sm.date DESC, sm.created_at DESC';
    
    const [result] = await pool.query(query, params);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar movimentações:', error);
    res.status(500).json({ error: 'Erro ao listar movimentações', message: error.message });
  }
});

// POST - Criar movimentação (entrada/saída)
app.post('/api/stock-movements', async (req, res) => {
  try {
    const { material_id, type, quantity, unit_cost, reason, notes, responsible, date, request_id, maintenance_id } = req.body;
    
    // Buscar material atual
    const [material] = await pool.query('SELECT * FROM materials WHERE id = ?', [material_id]);
    if (material.length === 0) {
      return res.status(404).json({ error: 'Material não encontrado' });
    }
    
    const currentStock = parseFloat(material[0].current_stock) || 0;
    const movementQty = parseFloat(quantity) || 0;
    
    // Calcular novo saldo
    let newBalance;
    if (type === 'ENTRADA') {
      newBalance = currentStock + movementQty;
    } else if (type === 'SAIDA') {
      newBalance = currentStock - movementQty;
      if (newBalance < 0) {
        return res.status(400).json({ error: 'Estoque insuficiente para esta saída' });
      }
    } else { // AJUSTE
      newBalance = movementQty;
    }
    
    // Inserir movimentação
    const [result] = await pool.query(
      `INSERT INTO stock_movements 
      (material_id, type, quantity, unit_cost, balance_after, reason, notes, responsible, date, request_id, maintenance_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [material_id, type, movementQty, unit_cost, newBalance, reason, notes, responsible, date, request_id, maintenance_id]
    );
    
    // Atualizar estoque do material
    await pool.query('UPDATE materials SET current_stock = ? WHERE id = ?', [newBalance, material_id]);
    
    // Atualizar custo médio se for entrada com custo
    if (type === 'ENTRADA' && unit_cost) {
      const currentCost = parseFloat(material[0].average_cost) || 0;
      const newAvgCost = ((currentCost * currentStock) + (unit_cost * movementQty)) / newBalance;
      await pool.query('UPDATE materials SET average_cost = ? WHERE id = ?', [newAvgCost, material_id]);
    }
    
    const [inserted] = await pool.query('SELECT * FROM stock_movements WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar movimentação:', error);
    res.status(500).json({ error: 'Erro ao criar movimentação', message: error.message });
  }
});

// ==================== ESTOQUE - SOLICITAÇÕES ====================

// GET - Listar solicitações
app.get('/api/material-requests', async (req, res) => {
  try {
    const { status, requester } = req.query;
    
    let query = `
      SELECT 
        mr.*,
        m.code AS material_code,
        m.name AS material_name,
        m.current_stock AS available_stock,
        m.unit AS material_unit,
        CASE 
          WHEN m.current_stock >= mr.quantity THEN 'DISPONIVEL'
          WHEN m.current_stock > 0 AND m.current_stock < mr.quantity THEN 'PARCIAL'
          ELSE 'INDISPONIVEL'
        END AS availability
      FROM material_requests mr
      INNER JOIN materials m ON mr.material_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      query += ' AND mr.status = ?';
      params.push(status);
    }
    
    if (requester) {
      query += ' AND mr.requester = ?';
      params.push(requester);
    }
    
    query += ' ORDER BY mr.created_at DESC';
    
    const [result] = await pool.query(query, params);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar solicitações:', error);
    res.status(500).json({ error: 'Erro ao listar solicitações', message: error.message });
  }
});

// POST - Criar solicitação
app.post('/api/material-requests', async (req, res) => {
  try {
    const { material_id, requester, requester_sector, quantity, reason, notes } = req.body;
    
    // Verificar se material existe
    const [material] = await pool.query('SELECT * FROM materials WHERE id = ?', [material_id]);
    if (material.length === 0) {
      return res.status(404).json({ error: 'Material não encontrado' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO material_requests 
      (material_id, requester, requester_sector, quantity, reason, notes, status) 
      VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE')`,
      [material_id, requester, requester_sector, quantity, reason, notes]
    );
    
    const [inserted] = await pool.query('SELECT * FROM material_requests WHERE id = ?', [result.insertId]);
    
    // Criar notificação para estoquista/gerente
    await pool.query(
      `INSERT INTO notifications (type, title, message, user_id) 
      SELECT 'material_request', 
        'Nova Solicitação de Material',
        CONCAT(?, ' solicitou ', ?, ' ', (SELECT unit FROM materials WHERE id = ?), ' de ', (SELECT name FROM materials WHERE id = ?)),
        u.id
      FROM users u 
      WHERE u.role IN ('Gestor do Sistema', 'Gerente')`,
      [requester, quantity, material_id, material_id]
    );
    
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar solicitação:', error);
    res.status(500).json({ error: 'Erro ao criar solicitação', message: error.message });
  }
});

// PUT - Atualizar status da solicitação
app.put('/api/material-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, approved_by, delivered_by, rejection_reason, expected_delivery_date, notes } = req.body;
    
    const updates = [];
    const params = [];
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
      
      if (status === 'APROVADA') {
        updates.push('approved_by = ?, approved_at = NOW()');
        params.push(approved_by);
      } else if (status === 'ENTREGUE') {
        updates.push('delivered_by = ?, delivered_at = NOW()');
        params.push(delivered_by);
        
        // Criar movimentação de saída
        const [request] = await pool.query('SELECT * FROM material_requests WHERE id = ?', [id]);
        if (request.length > 0) {
          const req_data = request[0];
          await pool.query(
            `INSERT INTO stock_movements 
            (material_id, type, quantity, balance_after, reason, notes, responsible, date, request_id) 
            SELECT 
              ?,
              'SAIDA',
              ?,
              (SELECT current_stock FROM materials WHERE id = ?) - ?,
              'Solicitação atendida',
              ?,
              ?,
              CURDATE(),
              ?
            FROM materials WHERE id = ?`,
            [req_data.material_id, req_data.quantity, req_data.material_id, req_data.quantity, notes, delivered_by, id, req_data.material_id]
          );
          
          // Atualizar estoque
          await pool.query(
            'UPDATE materials SET current_stock = current_stock - ? WHERE id = ?',
            [req_data.quantity, req_data.material_id]
          );
        }
      }
    }
    
    if (rejection_reason) {
      updates.push('rejection_reason = ?');
      params.push(rejection_reason);
    }
    
    if (expected_delivery_date) {
      updates.push('expected_delivery_date = ?');
      params.push(expected_delivery_date);
    }
    
    if (notes) {
      updates.push('notes = ?');
      params.push(notes);
    }
    
    params.push(id);
    
    await pool.query(
      `UPDATE material_requests SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const [updated] = await pool.query('SELECT * FROM material_requests WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao atualizar solicitação:', error);
    res.status(500).json({ error: 'Erro ao atualizar solicitação', message: error.message });
  }
});

// ==================== ESTOQUE - COMENTÁRIOS EM SOLICITAÇÕES ====================

// GET - Listar comentários de uma solicitação
app.get('/api/material-requests/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const [comments] = await pool.query(
      'SELECT * FROM material_request_comments WHERE request_id = ? ORDER BY created_at ASC',
      [id]
    );
    res.json(comments);
  } catch (error) {
    console.error('❌ Erro ao listar comentários:', error);
    res.status(500).json({ error: 'Erro ao listar comentários', message: error.message });
  }
});

// POST - Adicionar comentário em uma solicitação
app.post('/api/material-requests/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, user_name, comment } = req.body;
    
    const [result] = await pool.query(
      'INSERT INTO material_request_comments (request_id, user_id, user_name, comment) VALUES (?, ?, ?, ?)',
      [id, user_id, user_name, comment]
    );
    
    // Buscar comentário inserido
    const [inserted] = await pool.query(
      'SELECT * FROM material_request_comments WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao adicionar comentário:', error);
    res.status(500).json({ error: 'Erro ao adicionar comentário', message: error.message });
  }
});

// ==================== ESTOQUE - ALERTAS ====================

// GET - Listar alertas
app.get('/api/stock-alerts', async (req, res) => {
  try {
    const { resolved } = req.query;
    
    let query = `
      SELECT 
        sa.*,
        m.code AS material_code,
        m.name AS material_name,
        m.current_stock,
        m.minimum_stock
      FROM stock_alerts sa
      INNER JOIN materials m ON sa.material_id = m.id
      WHERE 1=1
    `;
    const params = [];
    
    if (resolved !== undefined) {
      query += ' AND sa.resolved = ?';
      params.push(resolved === 'true' || resolved === '1');
    }
    
    query += ' ORDER BY sa.alert_type DESC, sa.created_at DESC';
    
    const [result] = await pool.query(query, params);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar alertas:', error);
    res.status(500).json({ error: 'Erro ao listar alertas', message: error.message });
  }
});

// PUT - Marcar alerta como resolvido
app.put('/api/stock-alerts/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE stock_alerts SET resolved = TRUE, resolved_at = NOW() WHERE id = ?',
      [id]
    );
    res.json({ message: 'Alerta marcado como resolvido' });
  } catch (error) {
    console.error('❌ Erro ao resolver alerta:', error);
    res.status(500).json({ error: 'Erro ao resolver alerta', message: error.message });
  }
});

// ==================== ESTOQUE - CATEGORIAS ====================

// GET - Listar categorias
app.get('/api/material-categories', async (req, res) => {
  try {
    const [result] = await pool.query(
      'SELECT * FROM material_categories WHERE active = TRUE ORDER BY name'
    );
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao listar categorias:', error);
    res.status(500).json({ error: 'Erro ao listar categorias', message: error.message });
  }
});

// POST - Criar categoria
app.post('/api/material-categories', async (req, res) => {
  try {
    const { name, description, code_prefix } = req.body;
    const [result] = await pool.query(
      'INSERT INTO material_categories (name, description, code_prefix) VALUES (?, ?, ?)',
      [name, description, code_prefix]
    );
    const [inserted] = await pool.query('SELECT * FROM material_categories WHERE id = ?', [result.insertId]);
    res.status(201).json(inserted[0]);
  } catch (error) {
    console.error('❌ Erro ao criar categoria:', error);
    res.status(500).json({ error: 'Erro ao criar categoria', message: error.message });
  }
});

// ==================== ESTOQUE - RELATÓRIOS ====================

// GET - Relatório de materiais em falta
app.get('/api/reports/materials-shortage', async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT 
        m.*,
        (m.minimum_stock - m.current_stock) AS quantity_needed,
        (m.minimum_stock - m.current_stock) * m.average_cost AS estimated_cost
      FROM materials m
      WHERE m.active = TRUE 
        AND m.current_stock < m.minimum_stock
      ORDER BY 
        CASE 
          WHEN m.current_stock = 0 THEN 1
          ELSE 2
        END,
        m.category, m.name
    `);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório', message: error.message });
  }
});

// GET - Relatório de consumo por período
app.get('/api/reports/consumption', async (req, res) => {
  try {
    const { start_date, end_date, material_id } = req.query;
    
    let query = `
      SELECT 
        m.id,
        m.code,
        m.name,
        m.category,
        m.unit,
        SUM(CASE WHEN sm.type = 'SAIDA' THEN sm.quantity ELSE 0 END) AS total_output,
        COUNT(CASE WHEN sm.type = 'SAIDA' THEN 1 END) AS output_count,
        AVG(CASE WHEN sm.type = 'SAIDA' THEN sm.quantity END) AS avg_output
      FROM materials m
      LEFT JOIN stock_movements sm ON m.id = sm.material_id
      WHERE m.active = TRUE
    `;
    const params = [];
    
    if (start_date) {
      query += ' AND sm.date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND sm.date <= ?';
      params.push(end_date);
    }
    
    if (material_id) {
      query += ' AND m.id = ?';
      params.push(material_id);
    }
    
    query += ' GROUP BY m.id, m.code, m.name, m.category, m.unit ORDER BY total_output DESC';
    
    const [result] = await pool.query(query, params);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao gerar relatório de consumo:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório', message: error.message });
  }
});

// GET - Relatório de valor total do estoque
app.get('/api/reports/stock-value', async (req, res) => {
  try {
    const [result] = await pool.query(`
      SELECT 
        m.category,
        COUNT(*) AS material_count,
        SUM(m.current_stock) AS total_quantity,
        SUM(m.current_stock * m.average_cost) AS total_value
      FROM materials m
      WHERE m.active = TRUE
      GROUP BY m.category
      ORDER BY total_value DESC
    `);
    
    const [total] = await pool.query(`
      SELECT 
        COUNT(*) AS total_materials,
        SUM(m.current_stock * m.average_cost) AS grand_total
      FROM materials m
      WHERE m.active = TRUE
    `);
    
    res.json({
      by_category: result,
      summary: total[0]
    });
  } catch (error) {
    console.error('❌ Erro ao gerar relatório de valor:', error);
    res.status(500).json({ error: 'Erro ao gerar relatório', message: error.message });
  }
});





// ============================================
// ROTAS DE SUGESTÕES ANÔNIMAS
// ============================================

// POST - Criar nova sugestão anônima
app.post('/api/suggestions', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Mensagem não pode estar vazia' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO suggestions (message, status) VALUES (?, 'pending')`,
      [message.trim()]
    );
    
    res.status(201).json({ 
      success: true, 
      message: 'Sugestão enviada com sucesso! Obrigado pela sua contribuição.' 
    });
  } catch (error) {
    console.error('❌ Erro ao criar sugestão:', error);
    res.status(500).json({ error: 'Erro ao enviar sugestão', message: error.message });
  }
});

// GET - Listar todas as sugestões (apenas para gerentes)
app.get('/api/suggestions', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = 'SELECT * FROM suggestions';
    const params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const [suggestions] = await pool.query(query, params);
    res.json(suggestions);
  } catch (error) {
    console.error('❌ Erro ao listar sugestões:', error);
    res.status(500).json({ error: 'Erro ao listar sugestões', message: error.message });
  }
});

// PUT - Marcar sugestão como lida
app.put('/api/suggestions/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      `UPDATE suggestions SET status = 'read', read_at = NOW() WHERE id = ?`,
      [id]
    );
    
    const [updated] = await pool.query('SELECT * FROM suggestions WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao marcar sugestão como lida:', error);
    res.status(500).json({ error: 'Erro ao atualizar sugestão', message: error.message });
  }
});

// PUT - Arquivar sugestão
app.put('/api/suggestions/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    
    await pool.query(
      `UPDATE suggestions SET status = 'archived' WHERE id = ?`,
      [id]
    );
    
    const [updated] = await pool.query('SELECT * FROM suggestions WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('❌ Erro ao arquivar sugestão:', error);
    res.status(500).json({ error: 'Erro ao arquivar sugestão', message: error.message });
  }
});

// DELETE - Deletar sugestão
app.delete('/api/suggestions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM suggestions WHERE id = ?', [id]);
    res.json({ message: 'Sugestão deletada com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao deletar sugestão:', error);
    res.status(500).json({ error: 'Erro ao deletar sugestão', message: error.message });
  }
});

// GET - Contar sugestões não lidas
app.get('/api/suggestions/unread-count', async (req, res) => {
  try {
    const [result] = await pool.query(
      `SELECT COUNT(*) as count FROM suggestions WHERE status = 'pending'`
    );
    res.json({ count: result[0].count });
  } catch (error) {
    console.error('❌ Erro ao contar sugestões não lidas:', error);
    res.status(500).json({ error: 'Erro ao contar sugestões', message: error.message });
  }
});




// ============================================
// ROTAS DO MURAL DE RECADOS (BULLETIN BOARD)
// ============================================

// GET - Listar todos os recados ativos (não expirados)
app.get('/api/bulletin-board', async (req, res) => {
  try {
    const [bulletins] = await pool.query(
      `SELECT * FROM bulletin_board 
       WHERE expires_at IS NULL OR expires_at > NOW()
       ORDER BY is_pinned DESC, created_at DESC`
    );
    res.json(bulletins);
  } catch (error) {
    console.error('❌ Erro ao buscar recados:', error);
    res.status(500).json({ error: 'Erro ao buscar recados', message: error.message });
  }
});

// GET - Buscar recado específico
app.get('/api/bulletin-board/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [bulletin] = await pool.query('SELECT * FROM bulletin_board WHERE id = ?', [id]);
    
    if (bulletin.length === 0) {
      return res.status(404).json({ error: 'Recado não encontrado' });
    }
    
    res.json(bulletin[0]);
  } catch (error) {
    console.error('❌ Erro ao buscar recado:', error);
    res.status(500).json({ error: 'Erro ao buscar recado', message: error.message });
  }
});

// POST - Criar novo recado
app.post('/api/bulletin-board', async (req, res) => {
  try {
    const { title, content, category, color, is_pinned, expires_at, created_by, created_by_name } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }
    
    const [result] = await pool.query(
      `INSERT INTO bulletin_board (title, content, category, color, is_pinned, expires_at, created_by, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, content, category || 'Geral', color || 'yellow', is_pinned || false, expires_at || null, created_by, created_by_name]
    );
    
    const [newBulletin] = await pool.query('SELECT * FROM bulletin_board WHERE id = ?', [result.insertId]);
    
    res.status(201).json({ 
      success: true, 
      message: 'Recado criado com sucesso!',
      bulletin: newBulletin[0]
    });
  } catch (error) {
    console.error('❌ Erro ao criar recado:', error);
    res.status(500).json({ error: 'Erro ao criar recado', message: error.message });
  }
});

// PUT - Atualizar recado
app.put('/api/bulletin-board/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, color, is_pinned, expires_at } = req.body;
    
    await pool.query(
      `UPDATE bulletin_board 
       SET title = ?, content = ?, category = ?, color = ?, is_pinned = ?, expires_at = ?
       WHERE id = ?`,
      [title, content, category, color, is_pinned, expires_at, id]
    );
    
    const [updated] = await pool.query('SELECT * FROM bulletin_board WHERE id = ?', [id]);
    
    res.json({ 
      success: true, 
      message: 'Recado atualizado com sucesso!',
      bulletin: updated[0]
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar recado:', error);
    res.status(500).json({ error: 'Erro ao atualizar recado', message: error.message });
  }
});

// DELETE - Deletar recado
app.delete('/api/bulletin-board/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM bulletin_board WHERE id = ?', [id]);
    
    res.json({ 
      success: true, 
      message: 'Recado deletado com sucesso!' 
    });
  } catch (error) {
    console.error('❌ Erro ao deletar recado:', error);
    res.status(500).json({ error: 'Erro ao deletar recado', message: error.message });
  }
});

// PUT - Fixar/Desafixar recado
app.put('/api/bulletin-board/:id/pin', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_pinned } = req.body;
    
    await pool.query(
      `UPDATE bulletin_board SET is_pinned = ? WHERE id = ?`,
      [is_pinned, id]
    );
    
    const [updated] = await pool.query('SELECT * FROM bulletin_board WHERE id = ?', [id]);
    
    res.json({ 
      success: true, 
      message: is_pinned ? 'Recado fixado!' : 'Recado desafixado!',
      bulletin: updated[0]
    });
  } catch (error) {
    console.error('❌ Erro ao fixar/desafixar recado:', error);
    res.status(500).json({ error: 'Erro ao atualizar recado', message: error.message });
  }
});




// ============================================
// ROTAS DE ASSINATURAS DO MANUAL DO COLABORADOR
// ============================================

// POST - Registrar assinatura do manual
app.post('/api/manual-signatures', async (req, res) => {
  try {
    const { user_id, user_name, user_cpf, ip_address, signed_at } = req.body;
    
    // Verificar se já assinou
    const [existing] = await pool.query(
      'SELECT * FROM manual_signatures WHERE user_id = ?',
      [user_id]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ 
        error: 'Usuário já assinou o manual',
        signed_at: existing[0].signed_at
      });
    }
    
    const [result] = await pool.query(
      `INSERT INTO manual_signatures (user_id, user_name, user_cpf, ip_address, signed_at) 
       VALUES (?, ?, ?, ?, ?)`,
      [user_id, user_name, user_cpf, ip_address, signed_at]
    );
    
    res.json({ 
      success: true, 
      message: 'Assinatura registrada com sucesso!',
      signature_id: result.insertId
    });
  } catch (error) {
    console.error('❌ Erro ao registrar assinatura:', error);
    res.status(500).json({ error: 'Erro ao registrar assinatura', message: error.message });
  }
});

// GET - Listar todas as assinaturas
app.get('/api/manual-signatures', async (req, res) => {
  try {
    const [signatures] = await pool.query(
      'SELECT * FROM manual_signatures ORDER BY signed_at DESC'
    );
    res.json(signatures);
  } catch (error) {
    console.error('❌ Erro ao listar assinaturas:', error);
    res.status(500).json({ error: 'Erro ao listar assinaturas', message: error.message });
  }
});

// GET - Verificar se usuário assinou
app.get('/api/manual-signatures/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [signatures] = await pool.query(
      'SELECT * FROM manual_signatures WHERE user_id = ?',
      [userId]
    );
    
    if (signatures.length > 0) {
      res.json({ signed: true, signature: signatures[0] });
    } else {
      res.json({ signed: false });
    }
  } catch (error) {
    console.error('❌ Erro ao verificar assinatura:', error);
    res.status(500).json({ error: 'Erro ao verificar assinatura', message: error.message });
  }
});

// ============================================
// ROTAS DE VISUALIZAÇÕES DO MURAL DE RECADOS
// ============================================

// POST - Registrar visualização do mural
app.post('/api/bulletin-views', async (req, res) => {
  try {
    const { user_id, user_name, user_cpf, bulletin_id, ip_address, viewed_at } = req.body;
    
    // Verificar se já visualizou hoje
    const today = new Date().toISOString().split('T')[0];
    const [existing] = await pool.query(
      `SELECT * FROM bulletin_views 
       WHERE user_id = ? AND DATE(viewed_at) = ?`,
      [user_id, today]
    );
    
    if (existing.length > 0) {
      return res.json({ 
        success: true, 
        message: 'Visualização já registrada hoje',
        view_id: existing[0].id
      });
    }
    
    const [result] = await pool.query(
      `INSERT INTO bulletin_views (user_id, user_name, user_cpf, bulletin_id, ip_address, viewed_at) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, user_name, user_cpf, bulletin_id, ip_address, viewed_at]
    );
    
    res.json({ 
      success: true, 
      message: 'Visualização registrada com sucesso!',
      view_id: result.insertId
    });
  } catch (error) {
    console.error('❌ Erro ao registrar visualização:', error);
    res.status(500).json({ error: 'Erro ao registrar visualização', message: error.message });
  }
});

// GET - Listar todas as visualizações
app.get('/api/bulletin-views', async (req, res) => {
  try {
    const [views] = await pool.query(
      'SELECT * FROM bulletin_views ORDER BY viewed_at DESC'
    );
    res.json(views);
  } catch (error) {
    console.error('❌ Erro ao listar visualizações:', error);
    res.status(500).json({ error: 'Erro ao listar visualizações', message: error.message });
  }
});

// GET - Buscar visualizações de um usuário
app.get('/api/bulletin-views/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const [views] = await pool.query(
      'SELECT * FROM bulletin_views WHERE user_id = ? ORDER BY viewed_at DESC',
      [userId]
    );
    res.json(views);
  } catch (error) {
    console.error('❌ Erro ao buscar visualizações:', error);
    res.status(500).json({ error: 'Erro ao buscar visualizações', message: error.message });
  }
});

// GET - Verificar se usuário visualizou hoje
app.get('/api/bulletin-views/check/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const [views] = await pool.query(
      `SELECT * FROM bulletin_views 
       WHERE user_id = ? AND DATE(viewed_at) = ?`,
      [userId, today]
    );
    
    res.json({ 
      viewed_today: views.length > 0,
      last_view: views.length > 0 ? views[0] : null
    });
  } catch (error) {
    console.error('❌ Erro ao verificar visualização:', error);
    res.status(500).json({ error: 'Erro ao verificar visualização', message: error.message });
  }
});


// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📡 API disponível em: http://localhost:${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});
