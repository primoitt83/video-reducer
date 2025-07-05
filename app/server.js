const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const port = 3030;

// Configurar pastas
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}.mp4`),
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));
app.use('/outputs', express.static(outputDir));
app.use(express.json());

// Rota para upload de vídeo
app.post('/upload', upload.single('video'), (req, res) => {
  res.json({ filename: req.file.filename, path: `/uploads/${req.file.filename}` });
});

// Rota para listar vídeos já enviados
app.get('/list-uploads', (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao listar arquivos' });
    }
    const videoFiles = files.filter(file => file.endsWith('.mp4'));
    res.json({ files: videoFiles });
  });
});

// Rota para processar vídeo (low res)
app.post('/process-video/low-res', (req, res) => {
    const { filename, resolution, customWidth, customHeight, customBitrate, compressAudio, removeAfterProcessing } = req.body;
    const inputPath = path.join(uploadDir, filename);
    const outputFilename = `${Date.now()}_${resolution === 'custom' ? 'custom' : 'lowres'}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // Configurações
    let config;
    if (resolution === 'custom') {
        config = {
            width: parseInt(customWidth),
            height: parseInt(customHeight),
            videoBitrate: customBitrate,
            bufferSize: `${Math.floor(parseInt(customBitrate) * 2.2)}k`,
            custom: true
        };
    } else {
        config = resolutions[resolution] || resolutions['180p'];
        config.custom = false;
    }

    const command = ffmpeg(inputPath)
        .inputOptions([
            '-hwaccel rkmpp',
            '-hwaccel_output_format drm_prime',
            '-afbc rga'
        ])
        .videoFilter(`scale_rkrga=w=${config.width}:h=${config.height}:format=nv12`) // Aplica scaling sempre
        .outputOptions([
            '-c:v h264_rkmpp',
            '-rc_mode VBR',
            `-b:v ${config.videoBitrate}`,
            `-maxrate ${config.videoBitrate}`,
            `-bufsize ${config.bufferSize}`,
            '-f mp4',
            '-y'
        ]);
   
    // Configuração de áudio
    if (compressAudio) {
        command.outputOptions([
            '-c:a aac',
            '-b:a 32k',
            '-ar 22050',
            '-ac 1'
        ]);
    } else {
        command.outputOptions(['-c:a copy']);
    }

    // Timeout para evitar processos travados
    const timeout = setTimeout(() => command.kill('SIGTERM'), 300000);

    command
        .output(outputPath)
        .on('start', (commandLine) => {
            console.log('Comando Low-Res:', commandLine);
        })
        .on('end', () => {
            clearTimeout(timeout);
            if (removeAfterProcessing) {
                fs.unlinkSync(inputPath);
            }
            res.json({ 
                success: true,
                url: `/outputs/${outputFilename}`,
                resolution: `${config.width}x${config.height}`,
                audio: compressAudio ? '32k mono' : 'original'
            });
        })
        .on('error', (err) => {
            clearTimeout(timeout);
            console.error('Erro no processamento Low-Res:', err);
            res.status(500).json({ 
                error: 'Falha na redução de qualidade',
                details: err.message
            });
        })
        .run();
});

// Rota para baixar o vídeo processado
app.get('/download-processed', (req, res) => {
  const { filename, removeAfterDownload } = req.query;
  const filePath = path.join(outputDir, filename);

  // Verifica se o arquivo existe
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Arquivo não encontrado' });
  }

  // Envia o arquivo para o cliente
  res.download(filePath, (err) => {
    if (err) {
      console.error('Erro ao enviar o arquivo:', err.message);
      return res.status(500).json({ error: 'Erro ao enviar o arquivo' });
    }

    // Remove o vídeo processado após o download, se a opção estiver marcada
    if (removeAfterDownload === 'true') {
      fs.unlinkSync(filePath);
    }
  });
});

// Servir o index.html na raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});