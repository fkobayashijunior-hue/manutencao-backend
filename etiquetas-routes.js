// ==================== ROTAS DE ETIQUETAS ZEBRA ====================
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);

// Configuração do multer para upload temporário
const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.txt' || ext === '.pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .txt e .pdf são permitidos'));
    }
  }
});

// Criar diretório temp se não existir
const tempDir = path.join(__dirname, 'uploads', 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ==================== FUNÇÕES AUXILIARES ====================

/**
 * Parser de arquivo TXT
 * Formato: Posições fixas
 */
function parseTXT(content) {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const etiquetas = [];
  
  let sequencia = 1;
  for (const line of lines) {
    if (line.length < 50) continue; // Linha muito curta, pular
    
    try {
      // Extrair campos do TXT (posições fixas)
      // Baseado no exemplo: D07557890000000000000  000  000000010010000150A312060330000150
      
      const pedido = line.substring(2, 8).trim(); // Posição 2-8: pedido
      const sequenciaStr = line.substring(40, 44).trim(); // Sequência
      const codigoBarras = line.substring(44, 60).trim(); // Código de barras
      
      etiquetas.push({
        sequencia: sequencia++,
        pedido: pedido || '000000',
        volume: '1/1', // Padrão
        codigo_barras: codigoBarras || '',
        // Campos que serão preenchidos manualmente:
        empresa: '',
        razao_social: '',
        cor: '',
        unico: '',
        composicao: '',
        quantidade: '',
        pack: '',
        tipo: ''
      });
    } catch (error) {
      console.error('Erro ao parsear linha TXT:', error);
    }
  }
  
  return etiquetas;
}

/**
 * Parser de arquivo PDF
 * Usa pdf-parse para extrair texto
 */
async function parsePDF(filePath) {
  try {
    // Importar pdf-parse dinamicamente
    const pdfParse = require('pdf-parse');
    const dataBuffer = await readFileAsync(filePath);
    const data = await pdfParse(dataBuffer);
    
    const text = data.text;
    const etiquetas = [];
    
    // Dividir por blocos (etiquetas separadas por linhas em branco)
    const blocos = text.split(/\n\s*\n/).filter(b => b.trim().length > 0);
    
    let sequencia = 1;
    for (const bloco of blocos) {
      try {
        const lines = bloco.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        
        if (lines.length < 5) continue; // Bloco muito pequeno
        
        // Extrair campos do PDF
        const empresa = lines[0] || '';
        const razaoSocial = lines[1] || '';
        
        // Pedido e Volume (linha: "Pedido - 755788        Vol. ped.1/1")
        const pedidoLine = lines.find(l => l.includes('Pedido'));
        const pedidoMatch = pedidoLine ? pedidoLine.match(/Pedido\s*-\s*(\d+)/) : null;
        const volumeMatch = pedidoLine ? pedidoLine.match(/Vol\.\s*ped\.([0-9\/]+)/) : null;
        
        // Cor e Único
        const corLine = lines.find(l => l.includes('UNICO') || l.includes('ÚNICO'));
        const cor = corLine ? corLine.split(/\s{2,}/)[0] : '';
        const unico = corLine ? corLine.match(/(\d+)$/)?.[1] || '' : '';
        
        // Composição e Quantidade
        const compLine = lines.find(l => l.includes('Qtd'));
        const composicao = compLine ? compLine.split(/\s{2,}/)[0] : '';
        const qtdMatch = compLine ? compLine.match(/Qtd\.(\d+)/) : null;
        
        // Pack e Tipo
        const packLine = lines.find(l => l.includes('Pack'));
        const packMatch = packLine ? packLine.match(/Pack\s*-\s*([A-Z])/) : null;
        const tipo = packLine ? packLine.split(/\s{2,}/)[1] || '' : '';
        
        // Código de barras (última linha com apenas letras e números)
        const codigoBarras = lines[lines.length - 1].match(/^[A-Z0-9]+$/) ? lines[lines.length - 1] : '';
        
        etiquetas.push({
          sequencia: sequencia++,
          empresa: empresa,
          razao_social: razaoSocial,
          pedido: pedidoMatch ? pedidoMatch[1] : '',
          volume: volumeMatch ? volumeMatch[1] : '1/1',
          cor: cor,
          unico: unico,
          composicao: composicao,
          quantidade: qtdMatch ? qtdMatch[1] : '',
          pack: packMatch ? packMatch[1] : '',
          tipo: tipo,
          codigo_barras: codigoBarras
        });
      } catch (error) {
        console.error('Erro ao parsear bloco PDF:', error);
      }
    }
    
    return etiquetas;
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    throw error;
  }
}

/**
 * Gerar código ZPL para uma etiqueta
 */
function gerarZPL(etiqueta) {
  return `^XA
^FO50,30^A0N,25,25^FD${etiqueta.empresa || ''}^FS
^FO50,60^A0N,25,25^FD${etiqueta.razao_social || ''}^FS

^FO50,100^A0N,30,30^FDPedido - ${etiqueta.pedido || ''}^FS
^FO400,100^A0N,30,30^FDVol. ped.${etiqueta.volume || ''}^FS

^FO50,150^A0N,35,35^FD${etiqueta.cor || ''}^FS
^FO400,140^A0N,25,25^FDUNICO^FS
^FO400,165^A0N,30,30^FD${etiqueta.unico || ''}^FS

^FO50,200^A0N,30,30^FD${etiqueta.composicao || ''}^FS
^FO400,200^A0N,30,30^FDQtd.${etiqueta.quantidade || ''}^FS

^FO50,240^A0N,30,30^FDPack - ${etiqueta.pack || ''}^FS
^FO400,240^A0N,30,30^FD${etiqueta.tipo || ''}^FS

^FO150,300^BY3^BCN,100,Y,N,N
^FD${etiqueta.codigo_barras || ''}^FS

^XZ`;
}

/**
 * Gerar arquivo CSV compatível com Zebra Designer
 */
function gerarCSV(etiquetas) {
  // CSV com BOM UTF-8
  let csv = '\uFEFF'; // BOM
  csv += 'Sequencia,Empresa,Razao Social,Pedido,Volume,Cor,Unico,Composicao,Quantidade,Pack,Tipo,Codigo Barras\n';
  
  for (const etiqueta of etiquetas) {
    csv += `${etiqueta.sequencia},`;
    csv += `"${etiqueta.empresa || ''}",`;
    csv += `"${etiqueta.razao_social || ''}",`;
    csv += `"${etiqueta.pedido || ''}",`;
    csv += `"${etiqueta.volume || ''}",`;
    csv += `"${etiqueta.cor || ''}",`;
    csv += `"${etiqueta.unico || ''}",`;
    csv += `"${etiqueta.composicao || ''}",`;
    csv += `"${etiqueta.quantidade || ''}",`;
    csv += `"${etiqueta.pack || ''}",`;
    csv += `"${etiqueta.tipo || ''}",`;
    csv += `"${etiqueta.codigo_barras || ''}"\n`;
  }
  
  return csv;
}

// ==================== ROTAS ====================

/**
 * POST /api/etiquetas/upload
 * Upload e processamento de arquivo TXT ou PDF
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }
    
    const ext = path.extname(req.file.originalname).toLowerCase();
    const filePath = req.file.path;
    
    let etiquetas = [];
    let tipo = '';
    
    if (ext === '.txt') {
      tipo = 'txt';
      const content = await readFileAsync(filePath, 'utf-8');
      etiquetas = parseTXT(content);
    } else if (ext === '.pdf') {
      tipo = 'pdf';
      etiquetas = await parsePDF(filePath);
    }
    
    // Deletar arquivo temporário
    await unlinkAsync(filePath);
    
    res.json({
      tipo,
      total: etiquetas.length,
      etiquetas
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar arquivo:', error);
    
    // Tentar deletar arquivo temporário
    if (req.file && req.file.path) {
      try {
        await unlinkAsync(req.file.path);
      } catch (e) {
        console.error('Erro ao deletar arquivo temporário:', e);
      }
    }
    
    res.status(500).json({ 
      error: 'Erro ao processar arquivo', 
      message: error.message 
    });
  }
});

/**
 * POST /api/etiquetas/configurar
 * Aplicar configuração manual aos campos (para TXT)
 */
router.post('/configurar', async (req, res) => {
  try {
    const { configuracao, etiquetas } = req.body;
    
    if (!configuracao || !etiquetas) {
      return res.status(400).json({ error: 'Configuração e etiquetas são obrigatórios' });
    }
    
    // Aplicar configuração a todas as etiquetas
    const etiquetasConfiguradas = etiquetas.map(etiqueta => ({
      ...etiqueta,
      empresa: configuracao.empresa || etiqueta.empresa,
      razao_social: configuracao.razao_social || etiqueta.razao_social,
      cor: configuracao.cor || etiqueta.cor,
      unico: configuracao.unico || etiqueta.unico,
      composicao: configuracao.composicao || etiqueta.composicao,
      quantidade: configuracao.quantidade || etiqueta.quantidade,
      pack: configuracao.pack || etiqueta.pack,
      tipo: configuracao.tipo || etiqueta.tipo
    }));
    
    res.json({ etiquetas: etiquetasConfiguradas });
    
  } catch (error) {
    console.error('❌ Erro ao configurar etiquetas:', error);
    res.status(500).json({ 
      error: 'Erro ao configurar etiquetas', 
      message: error.message 
    });
  }
});

/**
 * POST /api/etiquetas/exportar
 * Exportar etiquetas em formato ZPL, CSV ou ZIP
 */
router.post('/exportar', async (req, res) => {
  try {
    const { formato, etiquetas } = req.body;
    
    if (!formato || !etiquetas) {
      return res.status(400).json({ error: 'Formato e etiquetas são obrigatórios' });
    }
    
    if (formato === 'zpl') {
      // ZPL único com todas as etiquetas
      let zplContent = '';
      for (const etiqueta of etiquetas) {
        zplContent += gerarZPL(etiqueta) + '\n\n';
      }
      
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="etiquetas.zpl"');
      res.send(zplContent);
      
    } else if (formato === 'csv') {
      // CSV compatível com Zebra Designer
      const csvContent = gerarCSV(etiquetas);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="etiquetas.csv"');
      res.send(csvContent);
      
    } else if (formato === 'individual') {
      // ZIP com arquivos ZPL individuais
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="etiquetas.zip"');
      
      archive.pipe(res);
      
      for (const etiqueta of etiquetas) {
        const zplContent = gerarZPL(etiqueta);
        const filename = `etiqueta_${String(etiqueta.sequencia).padStart(4, '0')}.zpl`;
        archive.append(zplContent, { name: filename });
      }
      
      await archive.finalize();
      
    } else {
      res.status(400).json({ error: 'Formato inválido. Use: zpl, csv ou individual' });
    }
    
  } catch (error) {
    console.error('❌ Erro ao exportar etiquetas:', error);
    res.status(500).json({ 
      error: 'Erro ao exportar etiquetas', 
      message: error.message 
    });
  }
});

module.exports = router;

