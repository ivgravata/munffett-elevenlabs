import express from 'express';
import fetch from 'node-fetch';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';

// --- CONFIGURAÇÃO ---
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PORT = process.env.PORT || 3000;

if (!RECALL_API_KEY || !OPENAI_API_KEY || !ELEVENLABS_API_KEY) {
  throw new Error("As variáveis de ambiente RECALL_API_KEY, OPENAI_API_KEY, e ELEVENLABS_API_KEY são obrigatórias.");
}

const app = express();
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1/bot';

// --- LÓGICA DO AGENTE DE VOZ (WEBSOCKET) ---
wss.on('connection', async (clientWs) => {
  console.log('[INFO] Cliente WebSocket (Recall.ai Bot) conectado.');

  // Esta parte agora irá gerir o fluxo completo
  clientWs.on('message', async (message) => {
    const data = JSON.parse(message);

    // Exemplo de como processar o áudio recebido
    if (data.type === 'audio' && data.payload) {
      // 1. Enviar áudio para Speech-to-Text (ex: Deepgram, Google Speech, etc.)
      // Esta parte é complexa e requer um provedor de STT.
      // Por agora, vamos simular uma resposta para testar o fluxo de TTS.

      // 2. Obter resposta de um LLM (ex: OpenAI)
      const textResponse = "Olá, eu sou o Munffett. Como posso ajudar?"; // Resposta simulada

      // 3. Gerar áudio com ElevenLabs usando o seu agent_id
      const ELEVENLABS_AGENT_ID = 'agent_7101k4b4ha5hf7wve22fvv7kqk0v';
      const elevenlabsUrl = `https://api.elevenlabs.io/v1/synthesize/${ELEVENLABS_AGENT_ID}`;

      try {
        const elevenlabsResponse = await fetch(elevenlabsUrl, {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: textResponse
          })
        });

        if (elevenlabsResponse.ok) {
          const audioBuffer = await elevenlabsResponse.arrayBuffer();
          // 4. Enviar o áudio de volta para o bot do Recall.ai
          clientWs.send(Buffer.from(audioBuffer));
          console.log('[INFO] Áudio da ElevenLabs enviado para o bot.');
        } else {
          console.error('[ERRO] Falha ao gerar áudio na ElevenLabs:', await elevenlabsResponse.text());
        }
      } catch (error) {
        console.error('[ERRO] Erro ao contactar a API da ElevenLabs:', error.message);
      }
    }
  });

  clientWs.onclose = () => {
    console.log('[INFO] Cliente WebSocket (Recall.ai Bot) desconectado.');
  };
});

// --- ENDPOINT DA API PARA CRIAR O BOT ---
app.post('/api/recall/create', async (req, res) => {
  console.log('[INFO] Pedido recebido em /api/recall/create');
  
  try {
    const { meeting_url } = req.body;
    if (!meeting_url) {
      return res.status(400).json({ error: "Campo obrigatório em falta: meeting_url" });
    }

    const PUBLIC_URL = `https://${req.get('host')}`;
    const WEBSOCKET_URL = PUBLIC_URL.replace('https://', 'wss://');

    console.log(`[INFO] URL do WebSocket para o bot: ${WEBSOCKET_URL}`);

    const response = await fetch(RECALL_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Token ${RECALL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meeting_url: meeting_url,
        bot_name: "Munffett AI",
        recording_enabled: false,
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

