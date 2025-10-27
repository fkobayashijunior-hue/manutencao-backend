const nodemailer = require('nodemailer');

// Configuração do transportador de e-mail
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: true, // true para porta 465, false para outras portas
  auth: {
    user: process.env.EMAIL_USER || 'sistema@azaconnect.com.br',
    pass: process.env.EMAIL_PASS || 'Fkob*jr14'
  }
});

// Verificar conexão
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Erro ao conectar ao serviço de e-mail:', error);
  } else {
    console.log('✅ Serviço de e-mail pronto para enviar mensagens');
  }
});

/**
 * Enviar e-mail de nova solicitação de manutenção para mecânicos
 */
const sendNewRequestEmail = async (request, mechanics) => {
  try {
    const mechanicEmails = mechanics
      .filter(m => m.email && m.email.includes('@'))
      .map(m => m.email);

    if (mechanicEmails.length === 0) {
      console.log('⚠️ Nenhum mecânico com e-mail cadastrado');
      return;
    }

    const mailOptions = {
      from: {
        name: 'Aza Connect - Sistema de Manutenção',
        address: process.env.EMAIL_FROM || 'sistema@azaconnect.com.br'
      },
      to: mechanicEmails.join(', '),
      subject: `🔧 Nova Solicitação de Manutenção - ${request.urgency || 'Normal'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 15px 0; border-left: 4px solid #667eea; border-radius: 5px; }
            .urgency { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
            .urgency-high { background: #fee; color: #c00; }
            .urgency-medium { background: #ffa; color: #a60; }
            .urgency-low { background: #efe; color: #060; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔧 Nova Solicitação de Manutenção</h1>
            </div>
            <div class="content">
              <p>Olá, mecânico!</p>
              <p>Uma nova solicitação de manutenção foi registrada no sistema:</p>
              
              <div class="info-box">
                <h3>📋 Detalhes da Solicitação</h3>
                <p><strong>Equipamento:</strong> ${request.equipment || 'Não especificado'}</p>
                <p><strong>Descrição:</strong> ${request.description || 'Sem descrição'}</p>
                <p><strong>Setor:</strong> ${request.sector || 'Não especificado'}</p>
                <p><strong>Solicitante:</strong> ${request.requested_by || 'Não especificado'}</p>
                <p><strong>Data:</strong> ${new Date(request.created_at).toLocaleString('pt-BR')}</p>
                <p>
                  <span class="urgency ${
                    request.urgency === 'Parou a Produção' ? 'urgency-high' :
                    request.urgency === 'Urgente' ? 'urgency-medium' :
                    'urgency-low'
                  }">
                    ${request.urgency || 'Normal'}
                  </span>
                </p>
              </div>

              <p style="text-align: center;">
                <a href="https://azaconnect-ktjugg.manus.space" class="button">
                  Acessar Sistema
                </a>
              </p>

              <p style="color: #666; font-size: 14px;">
                ⚠️ Esta é uma mensagem automática. Por favor, acesse o sistema para mais detalhes e para assumir a solicitação.
              </p>
            </div>
            <div class="footer">
              <p>Aza Connect - Sistema de Manutenção</p>
              <p>Aza Têxtil | Zen Confecções</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-mail de nova solicitação enviado:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail de nova solicitação:', error);
    throw error;
  }
};

/**
 * Enviar e-mail de solicitação concluída para o solicitante
 */
const sendCompletedRequestEmail = async (request, user) => {
  try {
    if (!user.email || !user.email.includes('@')) {
      console.log('⚠️ Usuário sem e-mail cadastrado');
      return;
    }

    const mailOptions = {
      from: {
        name: 'Aza Connect - Sistema de Manutenção',
        address: process.env.EMAIL_FROM || 'sistema@azaconnect.com.br'
      },
      to: user.email,
      subject: `✅ Solicitação de Manutenção Concluída - ${request.equipment}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 15px 0; border-left: 4px solid #11998e; border-radius: 5px; }
            .button { display: inline-block; padding: 12px 30px; background: #11998e; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Solicitação Concluída</h1>
            </div>
            <div class="content">
              <p>Olá, ${user.name}!</p>
              <p>Sua solicitação de manutenção foi concluída com sucesso:</p>
              
              <div class="info-box">
                <h3>📋 Detalhes da Solicitação</h3>
                <p><strong>Equipamento:</strong> ${request.equipment || 'Não especificado'}</p>
                <p><strong>Descrição:</strong> ${request.description || 'Sem descrição'}</p>
                <p><strong>Mecânico:</strong> ${request.assigned_to || 'Não especificado'}</p>
                <p><strong>Serviço Executado:</strong> ${request.service_executed || 'Não especificado'}</p>
                <p><strong>Data de Conclusão:</strong> ${new Date(request.updated_at || request.created_at).toLocaleString('pt-BR')}</p>
              </div>

              <p style="text-align: center;">
                <a href="https://azaconnect-ktjugg.manus.space" class="button">
                  Ver Detalhes no Sistema
                </a>
              </p>

              <p style="color: #666; font-size: 14px;">
                ℹ️ Caso tenha alguma dúvida ou o problema persista, por favor abra uma nova solicitação.
              </p>
            </div>
            <div class="footer">
              <p>Aza Connect - Sistema de Manutenção</p>
              <p>Aza Têxtil | Zen Confecções</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-mail de conclusão enviado:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail de conclusão:', error);
    throw error;
  }
};

/**
 * Enviar e-mail de nova solicitação de peça para gerente
 */
const sendNewPartsRequestEmail = async (partsRequest, managers) => {
  try {
    const managerEmails = managers
      .filter(m => m.email && m.email.includes('@'))
      .map(m => m.email);

    if (managerEmails.length === 0) {
      console.log('⚠️ Nenhum gerente com e-mail cadastrado');
      return;
    }

    const mailOptions = {
      from: {
        name: 'Aza Connect - Sistema de Manutenção',
        address: process.env.EMAIL_FROM || 'sistema@azaconnect.com.br'
      },
      to: managerEmails.join(', '),
      subject: `📦 Nova Solicitação de Peça - ${partsRequest.part_name || 'Peça'}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 15px 0; border-left: 4px solid #f093fb; border-radius: 5px; }
            .button { display: inline-block; padding: 12px 30px; background: #f093fb; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📦 Nova Solicitação de Peça</h1>
            </div>
            <div class="content">
              <p>Olá, gerente!</p>
              <p>Uma nova solicitação de peça foi registrada no sistema:</p>
              
              <div class="info-box">
                <h3>📋 Detalhes da Solicitação</h3>
                <p><strong>Peça:</strong> ${partsRequest.part_name || 'Não especificado'}</p>
                <p><strong>Quantidade:</strong> ${partsRequest.quantity || 'Não especificado'}</p>
                <p><strong>Equipamento:</strong> ${partsRequest.equipment || 'Não especificado'}</p>
                <p><strong>Solicitante:</strong> ${partsRequest.requested_by || 'Não especificado'}</p>
                <p><strong>Observações:</strong> ${partsRequest.notes || 'Sem observações'}</p>
                <p><strong>Data:</strong> ${new Date(partsRequest.created_at).toLocaleString('pt-BR')}</p>
              </div>

              <p style="text-align: center;">
                <a href="https://azaconnect-ktjugg.manus.space" class="button">
                  Acessar Sistema
                </a>
              </p>

              <p style="color: #666; font-size: 14px;">
                ⚠️ Esta é uma mensagem automática. Por favor, acesse o sistema para aprovar ou recusar a solicitação.
              </p>
            </div>
            <div class="footer">
              <p>Aza Connect - Sistema de Manutenção</p>
              <p>Aza Têxtil | Zen Confecções</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ E-mail de nova solicitação de peça enviado:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail de solicitação de peça:', error);
    throw error;
  }
};

module.exports = {
  sendNewRequestEmail,
  sendCompletedRequestEmail,
  sendNewPartsRequestEmail
};



/**
 * Enviar e-mail de notificação genérica
 */
const sendNotificationEmail = async (email, title, message, type = 'info') => {
  try {
    if (!email || !email.includes('@')) {
      console.log('⚠️ E-mail inválido');
      return;
    }

    const typeColors = {
      info: { gradient: '#667eea, #764ba2', icon: 'ℹ️' },
      success: { gradient: '#11998e, #38ef7d', icon: '✅' },
      warning: { gradient: '#f093fb, #f5576c', icon: '⚠️' },
      error: { gradient: '#eb3349, #f45c43', icon: '❌' }
    };

    const colorConfig = typeColors[type] || typeColors.info;

    const mailOptions = {
      from: {
        name: 'Aza Connect - Sistema de Manutenção',
        address: process.env.EMAIL_FROM || 'sistema@azaconnect.com.br'
      },
      to: email,
      subject: `${colorConfig.icon} ${title}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, ${colorConfig.gradient}); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .message-box { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; }
            .button { display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, ${colorConfig.gradient}); color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${colorConfig.icon} ${title}</h1>
            </div>
            <div class="content">
              <div class="message-box">
                <p>${message}</p>
              </div>

              <p style="text-align: center;">
                <a href="https://azaconnect.com.br/dist/" class="button">
                  Acessar Sistema
                </a>
              </p>
            </div>
            <div class="footer">
              <p>Aza Connect - Sistema de Manutenção</p>
              <p>Aza Têxtil | Zen Confecções</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ E-mail de notificação enviado para ${email}:`, info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail de notificação:', error);
    throw error;
  }
};

module.exports = {
  sendNewRequestEmail,
  sendCompletedRequestEmail,
  sendNewPartsRequestEmail,
  sendNotificationEmail
};

