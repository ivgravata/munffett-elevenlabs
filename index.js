import express from 'express';
import fetch from 'node-fetch';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';

// --- CONFIGURAÇÃO ---
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
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
wss.on('connection', async (clientWs) => {
  console.log('[INFO] Cliente WebSocket (Recall.ai Bot) conectado.');
  let openaiWs;

  try {
    // 1. Conectar-se à API de tempo real da OpenAI
    const headers = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    };
    openaiWs = new WebSocket(OPENAI_WS_URL, { headers });

    openaiWs.onopen = () => {
      console.log('[INFO] Conexão com a OpenAI estabelecida com sucesso.');
      // 2. Configurar o agente na OpenAI (instruções, voz, etc.)
      const configMessage = {
        type: 'session_config',
        session_config: {
          // Estas são as instruções para o seu agente de IA
          instructions: `You are Munffett, a senior investor with a lifetime of experience. Your philosophy is a blend of the long-term, business-focused principles of your mentors, Warren Buffett and Charlie Munger. Stay in character at all times.`,
          voice_id: 'shimmer', // Voz da OpenAI (pode ser alterada)
          output_format: {
            encoding: 'pcm_16000_16', // Formato de áudio esperado pelo Recall.ai
            container: 'none'
          }
        }
      };
      openaiWs.send(JSON.stringify(configMessage));
    };

    // 3. Retransmitir mensagens do Bot (Recall) para a OpenAI
    clientWs.on('message', (message) => {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(message);
      }
    });

    // 4. Retransmitir mensagens da OpenAI para o Bot (Recall)
    openaiWs.onmessage = (event) => {
      if (clientWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(event.data);
      }
    };

    openaiWs.onerror = (error) => {
      console.error('[ERRO] Erro no WebSocket da OpenAI:', error.message);
    };

    clientWs.onclose = () => {
      console.log('[INFO] Cliente WebSocket (Recall.ai Bot) desconectado.');
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
    const { meeting_url, agent_id } = req.body;
    if (!meeting_url) {
      return res.status(400).json({ error: "Campo obrigatório em falta: meeting_url" });
    }

    // A URL pública do seu serviço na Railway
    const PUBLIC_URL = `https://${req.get('host')}`;
    const WEBSOCKET_URL = PUBLIC_URL.replace('https://', 'wss://');

    console.log(`[INFO] URL do WebSocket para o bot: ${WEBSOCKET_URL}`);

    const response = await fetch(RECALL_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Token ${RECALL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_url: meeting_url,
        bot_name: "Munffett AI",
        // Diz ao bot para se conectar ao nosso servidor via WebSocket
        realtime_media_target: {
          kind: 'websocket',
          config: { url: WEBSOCKET_URL }
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

