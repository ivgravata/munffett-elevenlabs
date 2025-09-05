import express from 'express';
import fetch from 'node-fetch';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';

// --- CONFIGURAÇÃO ---
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// A ELEVENLABS_API_KEY não é usada diretamente aqui, mas mantemo-la para o futuro
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY; 
const PORT = process.env.PORT || 3000;

if (!RECALL_API_KEY || !OPENAI_API_KEY) {
  throw new Error("As variáveis de ambiente RECALL_API_KEY e OPENAI_API_KEY são obrigatórias.");
}

const app = express();
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1/bot';
const OPENAI_WS_URL = "wss://api.openai.com/v1/realtime/ws";

// --- LÓGICA DO AGENTE DE VOZ (WEBSOCKET) ---
// Esta secção funciona como um "relé" entre o bot (na página web) e a OpenAI
wss.on('connection', async (clientWs) => {
  console.log('[INFO] Cliente WebSocket (página web do bot) conectado.');
  let openaiWs;

  try {
    const headers = { 'Authorization': `Bearer ${OPENAI_API_KEY}` };
    openaiWs = new WebSocket(OPENAI_WS_URL, { headers });

    openaiWs.onopen = () => {
      console.log('[INFO] Conexão com a OpenAI estabelecida com sucesso.');
      // A página web do bot irá enviar a configuração da sessão
    };

    clientWs.on('message', (message) => {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        // Simplesmente retransmite a mensagem
        openaiWs.send(message);
      }
    });

    openaiWs.onmessage = (event) => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        // Simplesmente retransmite a mensagem de volta
        clientWs.send(event.data);
      }
    };

    openaiWs.onerror = (error) => console.error('[ERRO] Erro no WebSocket da OpenAI:', error.message);
    clientWs.onclose = () => {
      console.log('[INFO] Cliente WebSocket (página web do bot) desconectado.');
      if (openaiWs) openaiWs.close();
    };

  } catch (error) {
    console.error('[ERRO] Falha ao configurar o proxy WebSocket:', error.message);
    clientWs.close();
  }
});

// --- ENDPOINT DA API PARA CRIAR O BOT ---
app.post('/api/recall/create', async (req, res) => {
  console.log('[INFO] Pedido recebido em /api/recall/create');
  
  try {
    const { meeting_url } = req.body;
    if (!meeting_url) {
      return res.status(400).json({ error: "Campo obrigatório em falta: meeting_url" });
    }

    const BACKEND_URL = `https://${req.get('host')}`;
    const WEBSOCKET_URL = BACKEND_URL.replace('https://', 'wss://');
    
    // Usamos a página de demonstração, passando o nosso servidor WebSocket como parâmetro
    const FRONTEND_URL = `https://recallai-demo.netlify.app?wss=${WEBSOCKET_URL}`;

    console.log(`[INFO] URL da página web do bot: ${FRONTEND_URL}`);

    const response = await fetch(RECALL_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Token ${RECALL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_url: meeting_url,
        bot_name: "Munffett AI",
        // --- A ARQUITETURA CORRETA, INSPIRADA NO SEU PROJETO ---
        output_media: {
          camera: {
            kind: "webpage",
            config: {
              url: FRONTEND_URL
            }
          }
        },
        variant: { zoom: "web_4_core" }
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[ERRO] Falha ao criar o bot na Recall.ai. Status: ${response.status}`, errorBody);
      throw new Error(`A API do Recall.ai retornou um erro.`);
    }

    const botData = await response.json();
    console.log('[SUCESSO] Bot enviado com sucesso.', botData);
    res.status(200).json({ message: 'O bot está a ser enviado para a reunião.', details: botData });

  } catch (error) {
    console.error(`[ERRO_ENDPOINT] /api/recall/create: ${error.message}`);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor.' });
  }
});

// --- INICIAR O SERVIDOR ---
server.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});

