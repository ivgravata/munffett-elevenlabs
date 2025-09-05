import express from 'express';
import fetch from 'node-fetch';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';

// --- CONFIGURAÇÃO ---
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PORT = process.env.PORT || 3000;

if (!RECALL_API_KEY || !ELEVENLABS_API_KEY) {
  throw new Error("As variáveis de ambiente RECALL_API_KEY e ELEVENLABS_API_KEY são obrigatórias.");
}

const app = express();
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1/bot';
const ELEVENLABS_AGENT_ID = 'agent_7101k4b4ha5hf7wve22fvv7kqk0v';
const ELEVENLABS_WS_URL = `wss://api.elevenlabs.io/v1/real-time-voice-cloning/ws?agent_id=${ELEVENLABS_AGENT_ID}`;

// --- LÓGICA DO AGENTE DE VOZ (WEBSOCKET) ---
wss.on('connection', async (clientWs) => {
  console.log('[INFO] Cliente WebSocket (página web do bot) conectado.');
  let elevenlabsWs;

  try {
    const headers = { 'xi-api-key': ELEVENLABS_API_KEY };
    elevenlabsWs = new WebSocket(ELEVENLABS_WS_URL, { headers });

    elevenlabsWs.onopen = () => {
      console.log('[INFO] Conexão com a ElevenLabs estabelecida com sucesso.');
    };

    clientWs.on('message', (message) => {
      if (elevenlabsWs && elevenlabsWs.readyState === WebSocket.OPEN) {
        elevenlabsWs.send(message);
      }
    });

    elevenlabsWs.onmessage = (event) => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(event.data);
      }
    };

    elevenlabsWs.onerror = (error) => console.error('[ERRO] Erro no WebSocket da ElevenLabs:', error.message);
    clientWs.onclose = () => {
      console.log('[INFO] Cliente WebSocket (página web do bot) desconectado.');
      if (elevenlabsWs) elevenlabsWs.close();
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
    const FRONTEND_URL = `https://recallai-demo.netlify.app?wss=${WEBSOCKET_URL}`;

    console.log(`[INFO] URL da página web do bot: ${FRONTEND_URL}`);

    const response = await fetch(RECALL_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Token ${RECALL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_url: meeting_url,
        bot_name: "Munffett AI",
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

