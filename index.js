import express from 'express';
import fetch from 'node-fetch';

// Initialize Express app
const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const RECALL_API_KEY = process.env.RECALL_API_KEY;
// O URL da API foi corrigido para a sua região específica.
const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1/bot';

async function createBot(meetingUrl, agentId) {
  if (!RECALL_API_KEY) {
    console.error("FATAL: A variável de ambiente RECALL_API_KEY não está definida.");
    throw new Error("A chave da API do Recall.ai não está configurada no servidor.");
  }

  console.log(`[INFO] A tentar enviar o bot para a reunião: ${meetingUrl}`);
  console.log(`[INFO] A usar o endpoint da API: ${RECALL_API_URL}`);

  const BOT_NAME = "Munffett AI";

  const response = await fetch(RECALL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${RECALL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: BOT_NAME,
      // --- CORREÇÃO: O campo "transcription_options" foi REMOVIDO ---
      // A API do Recall.ai indicou que este campo não é permitido neste tipo de pedido.
      variant: {
        zoom: "web_4_core"
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[ERRO] Falha ao criar o bot. Status: ${response.status}`);
    console.error(`[ERRO] Resposta da API do Recall.ai: ${errorBody}`);
    throw new Error(`A API do Recall.ai retornou um erro. Status: ${response.status}`);
  }

  return await response.json();
}

// --- API ENDPOINT ---
app.post('/api/recall/create', async (req, res) => {
  console.log('[INFO] Pedido recebido em /api/recall/create');
  
  try {
    const { meeting_url, agent_id } = req.body;

    if (!meeting_url || !agent_id) {
      console.error("[ERRO_VALIDACAO] O pedido não contém 'meeting_url' ou 'agent_id'.");
      return res.status(400).json({ error: "Campos obrigatórios em falta: meeting_url e agent_id" });
    }

    const botData = await createBot(meeting_url, agent_id);

    console.log('[SUCESSO] Bot enviado com sucesso. Detalhes:', botData);
    res.status(200).json({
      message: 'O bot está a ser enviado para a reunião.',
      details: botData
    });

  } catch (error) {
    console.error(`[ERRO_ENDPOINT] Ocorreu um erro em /api/recall/create: ${error.message}`);
    res.status(500).json({ error: 'Ocorreu um erro interno no servidor ao processar o pedido.' });
  }
});

// --- SERVER STARTUP ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});

