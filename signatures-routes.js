const express = require('express');
const router = express.Router();
const crypto = require('crypto');

module.exports = (db) => {
  // Assinar Manual do Colaborador
  router.post('/manual/sign', async (req, res) => {
    try {
      const { userId, userName, userCpf, userRole, documentVersion, ipAddress, userAgent } = req.body;

      if (!userId || !userName) {
        return res.status(400).json({ error: 'Dados obrigatórios faltando' });
      }

      // Verificar se já assinou esta versão
      const [existing] = await db.query(
        'SELECT id FROM manual_signatures WHERE user_id = ? AND document_version = ?',
        [userId, documentVersion || '1.0']
      );

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Você já assinou esta versão do manual' });
      }

      // Gerar hash da assinatura
      const signatureData = `${userId}-${userName}-${documentVersion}-${Date.now()}`;
      const signatureHash = crypto.createHash('sha256').update(signatureData).digest('hex');

      // Inserir assinatura
      const [result] = await db.query(
        `INSERT INTO manual_signatures 
        (user_id, user_name, user_cpf, user_role, document_version, ip_address, user_agent, signature_hash) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, userName, userCpf, userRole, documentVersion || '1.0', ipAddress, userAgent, signatureHash]
      );

      res.json({
        success: true,
        signatureId: result.insertId,
        signatureHash,
        message: 'Manual assinado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao assinar manual:', error);
      res.status(500).json({ error: 'Erro ao registrar assinatura' });
    }
  });

  // Verificar se usuário já assinou
  router.get('/manual/check/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const { version } = req.query;

      const [signatures] = await db.query(
        'SELECT * FROM manual_signatures WHERE user_id = ? AND document_version = ? ORDER BY signed_at DESC LIMIT 1',
        [userId, version || '1.0']
      );

      res.json({
        signed: signatures.length > 0,
        signature: signatures[0] || null
      });
    } catch (error) {
      console.error('Erro ao verificar assinatura:', error);
      res.status(500).json({ error: 'Erro ao verificar assinatura' });
    }
  });

  // Listar todas as assinaturas (para Ariele)
  router.get('/manual/signatures', async (req, res) => {
    try {
      const { version, startDate, endDate } = req.query;
      
      let query = 'SELECT * FROM manual_signatures WHERE 1=1';
      const params = [];

      if (version) {
        query += ' AND document_version = ?';
        params.push(version);
      }

      if (startDate) {
        query += ' AND signed_at >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND signed_at <= ?';
        params.push(endDate);
      }

      query += ' ORDER BY signed_at DESC';

      const [signatures] = await db.query(query, params);
      res.json(signatures);
    } catch (error) {
      console.error('Erro ao listar assinaturas:', error);
      res.status(500).json({ error: 'Erro ao listar assinaturas' });
    }
  });

  // Listar usuários que NÃO assinaram
  router.get('/manual/pending', async (req, res) => {
    try {
      const { version } = req.query;

      const [pending] = await db.query(
        `SELECT u.id, u.name, u.email, u.role 
        FROM users u 
        WHERE u.id NOT IN (
          SELECT user_id FROM manual_signatures WHERE document_version = ?
        )
        ORDER BY u.name`,
        [version || '1.0']
      );

      res.json(pending);
    } catch (error) {
      console.error('Erro ao listar pendentes:', error);
      res.status(500).json({ error: 'Erro ao listar pendentes' });
    }
  });

  // Confirmar leitura de recado do mural
  router.post('/bulletin/confirm', async (req, res) => {
    try {
      const { bulletinId, userId, userName, ipAddress } = req.body;

      if (!bulletinId || !userId || !userName) {
        return res.status(400).json({ error: 'Dados obrigatórios faltando' });
      }

      // Verificar se já confirmou
      const [existing] = await db.query(
        'SELECT id FROM bulletin_confirmations WHERE bulletin_id = ? AND user_id = ?',
        [bulletinId, userId]
      );

      if (existing.length > 0) {
        return res.status(400).json({ error: 'Você já confirmou a leitura deste recado' });
      }

      // Inserir confirmação
      const [result] = await db.query(
        'INSERT INTO bulletin_confirmations (bulletin_id, user_id, user_name, ip_address) VALUES (?, ?, ?, ?)',
        [bulletinId, userId, userName, ipAddress]
      );

      res.json({
        success: true,
        confirmationId: result.insertId,
        message: 'Leitura confirmada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao confirmar leitura:', error);
      res.status(500).json({ error: 'Erro ao confirmar leitura' });
    }
  });

  // Verificar se usuário confirmou leitura
  router.get('/bulletin/check/:bulletinId/:userId', async (req, res) => {
    try {
      const { bulletinId, userId } = req.params;

      const [confirmations] = await db.query(
        'SELECT * FROM bulletin_confirmations WHERE bulletin_id = ? AND user_id = ?',
        [bulletinId, userId]
      );

      res.json({
        confirmed: confirmations.length > 0,
        confirmation: confirmations[0] || null
      });
    } catch (error) {
      console.error('Erro ao verificar confirmação:', error);
      res.status(500).json({ error: 'Erro ao verificar confirmação' });
    }
  });

  // Listar confirmações de um recado
  router.get('/bulletin/:bulletinId/confirmations', async (req, res) => {
    try {
      const { bulletinId } = req.params;

      const [confirmations] = await db.query(
        'SELECT * FROM bulletin_confirmations WHERE bulletin_id = ? ORDER BY confirmed_at DESC',
        [bulletinId]
      );

      res.json(confirmations);
    } catch (error) {
      console.error('Erro ao listar confirmações:', error);
      res.status(500).json({ error: 'Erro ao listar confirmações' });
    }
  });

  // Listar usuários que NÃO confirmaram leitura de um recado
  router.get('/bulletin/:bulletinId/pending', async (req, res) => {
    try {
      const { bulletinId } = req.params;

      const [pending] = await db.query(
        `SELECT u.id, u.name, u.email, u.role 
        FROM users u 
        WHERE u.id NOT IN (
          SELECT user_id FROM bulletin_confirmations WHERE bulletin_id = ?
        )
        ORDER BY u.name`,
        [bulletinId]
      );

      res.json(pending);
    } catch (error) {
      console.error('Erro ao listar pendentes:', error);
      res.status(500).json({ error: 'Erro ao listar pendentes' });
    }
  });

  // Estatísticas gerais (para Ariele)
  router.get('/stats', async (req, res) => {
    try {
      // Total de assinaturas do manual
      const [manualStats] = await db.query(
        'SELECT COUNT(*) as total, document_version FROM manual_signatures GROUP BY document_version'
      );

      // Total de usuários
      const [totalUsers] = await db.query('SELECT COUNT(*) as total FROM users');

      // Total de confirmações de recados
      const [bulletinStats] = await db.query(
        'SELECT COUNT(DISTINCT user_id) as users_confirmed, COUNT(*) as total_confirmations FROM bulletin_confirmations'
      );

      res.json({
        manual: {
          signatures: manualStats,
          totalUsers: totalUsers[0].total
        },
        bulletin: bulletinStats[0]
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  });

  return router;
};
