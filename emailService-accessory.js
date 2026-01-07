const nodemailer = require('nodemailer');

// Configuração do transportador de e-mail
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || 'sistema@azaconnect.com.br',
    pass: process.env.EMAIL_PASS || 'Fkob*jr14'
  }
});

/**
 * Enviar e-mail de novo pedido de acessórios para Cláudia
 */
const sendAccessoryOrderEmail = async (order, items, requesterName) => {
  try {
    // E-mail da Cláudia (gerente)
    const claudiaEmail = 'claudia@azatextil.com.br'; // AJUSTAR COM E-MAIL CORRETO

    // Montar lista de itens
    const itemsList = items.map(item => `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.code || '-'}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.description || '-'}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.unit || '-'}</td>
      </tr>
    `).join('');

    const mailOptions = {
      from: {
        name: 'Aza Connect - Sistema de Manutenção',
        address: process.env.EMAIL_FROM || 'sistema@azaconnect.com.br'
      },
      to: claudiaEmail,
      subject: `📦 Novo Pedido de Acessórios - ${order.order_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #FF6B35 0%, #F7931E 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #FF6B35; border-radius: 5px; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #FF6B35; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
            th { background: #FF6B35; color: white; padding: 12px; text-align: left; }
            td { padding: 10px; border: 1px solid #ddd; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 12px 30px; background: #FF6B35; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">📦 Novo Pedido de Acessórios</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">${order.order_number}</p>
            </div>
            
            <div class="content">
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Solicitante:</span> ${requesterName}
                </div>
                <div class="info-row">
                  <span class="label">Setor:</span> ${order.sector_name || 'Não informado'}
                </div>
                <div class="info-row">
                  <span class="label">Data do Pedido:</span> ${new Date(order.created_at).toLocaleString('pt-BR')}
                </div>
                ${order.observations ? `
                <div class="info-row">
                  <span class="label">Observações:</span><br>
                  ${order.observations}
                </div>
                ` : ''}
              </div>

              <h3 style="color: #FF6B35; margin-top: 30px;">Itens Solicitados:</h3>
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th style="text-align: center;">Quantidade</th>
                    <th>Unidade</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
              </table>

              <div style="text-align: center;">
                <a href="https://azaconnect.com.br" class="button">Acessar Sistema</a>
              </div>
            </div>

            <div class="footer">
              <p><strong>Aza Connect</strong> - Sistema de Controle de Manutenção</p>
              <p>Aza Têxtil | Zen Confecções</p>
              <p style="font-size: 10px; color: #999;">Este é um e-mail automático, não responda.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ E-mail de pedido de acessórios enviado para Cláudia');
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail de pedido de acessórios:', error);
    throw error;
  }
};

/**
 * Enviar e-mail de novo pedido de peças para Cláudia
 */
const sendPartsOrderEmail = async (order, items, requesterName) => {
  try {
    // E-mail da Cláudia (gerente)
    const claudiaEmail = 'claudia@azatextil.com.br'; // AJUSTAR COM E-MAIL CORRETO

    // Montar lista de itens
    const itemsList = items.map(item => `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.code || '-'}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.description || '-'}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${item.unit || '-'}</td>
      </tr>
    `).join('');

    const mailOptions = {
      from: {
        name: 'Aza Connect - Sistema de Manutenção',
        address: process.env.EMAIL_FROM || 'sistema@azaconnect.com.br'
      },
      to: claudiaEmail,
      subject: `🔩 Novo Pedido de Peças - ${order.order_number}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #4A90E2 0%, #357ABD 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4A90E2; border-radius: 5px; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; color: #4A90E2; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; }
            th { background: #4A90E2; color: white; padding: 12px; text-align: left; }
            td { padding: 10px; border: 1px solid #ddd; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 12px 30px; background: #4A90E2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0;">🔩 Novo Pedido de Peças</h1>
              <p style="margin: 10px 0 0 0; font-size: 18px;">${order.order_number}</p>
            </div>
            
            <div class="content">
              <div class="info-box">
                <div class="info-row">
                  <span class="label">Solicitante:</span> ${requesterName}
                </div>
                <div class="info-row">
                  <span class="label">Setor:</span> ${order.sector_name || 'Não informado'}
                </div>
                <div class="info-row">
                  <span class="label">Data do Pedido:</span> ${new Date(order.created_at).toLocaleString('pt-BR')}
                </div>
                ${order.observations ? `
                <div class="info-row">
                  <span class="label">Observações:</span><br>
                  ${order.observations}
                </div>
                ` : ''}
              </div>

              <h3 style="color: #4A90E2; margin-top: 30px;">Peças Solicitadas:</h3>
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descrição</th>
                    <th style="text-align: center;">Quantidade</th>
                    <th>Unidade</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                </tbody>
              </table>

              <div style="text-align: center;">
                <a href="https://azaconnect.com.br" class="button">Acessar Sistema</a>
              </div>
            </div>

            <div class="footer">
              <p><strong>Aza Connect</strong> - Sistema de Controle de Manutenção</p>
              <p>Aza Têxtil | Zen Confecções</p>
              <p style="font-size: 10px; color: #999;">Este é um e-mail automático, não responda.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ E-mail de pedido de peças enviado para Cláudia');
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail de pedido de peças:', error);
    throw error;
  }
};

module.exports = {
  sendAccessoryOrderEmail,
  sendPartsOrderEmail
};
