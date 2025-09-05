import express from 'express';
import fetch from 'node-fetch';

// Inicializa a aplicação Express
const app = express();
app.use(express.json());

// --- CONFIGURAÇÃO ---
// As suas chaves secretas devem ser guardadas como variáveis de ambiente na sua plataforma de alojamento (Railway, Vercel, etc.)
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY; 

// --- CORREÇÃO CRÍTICA ---
// O URL da API foi alterado para a região correta (us-west-2), conforme indicado pelos logs de erro.
// O seu script Python anterior também usava esta região.
const RECALL_API_URL = 'https://us-west-2.recall.ai/api/v1/bot';

/**
 * Função para criar e configurar o bot na chamada.
 * @param {string} meetingUrl - O URL completo da reunião Zoom.
 * @param {string} agentId - O ID do seu agente ElevenLabs.
 * @returns {Promise<object>} - Os dados do bot criado.
 */
async function createBot(meetingUrl, agentId) {
  // 1. Valida se a chave da API do Recall.ai está configurada no servidor.
  if (!RECALL_API_KEY) {
    console.error("FATAL: A variável de ambiente RECALL_API_KEY não está definida.");
    throw new Error("A chave da API para o Recall.ai não está configurada no servidor.");
  }

  console.log(`[INFO] A tentar enviar o bot para a reunião: ${meetingUrl}`);
  console.log(`[INFO] A usar o endpoint da API: ${RECALL_API_URL}`);
  
  const BOT_NAME = "Munffett AI";

  // 2. Faz a chamada à API do Recall.ai com todos os parâmetros necessários.
  const response = await fetch(RECALL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${RECALL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: BOT_NAME,
      transcription_options: {
        provider: 'gladia'
      },
      // Parâmetro adicionado a partir do seu código Python para garantir a compatibilidade com o Zoom.
      variant: {
        zoom: "web_4_core"
      }
    })
  });

  // 3. Trata a resposta da API.
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[ERRO] Falha ao criar o bot. Status: ${response.status}`);
    console.error(`[ERRO] Resposta da API do Recall.ai: ${errorBody}`);
    throw new Error(`A API do Recall.ai retornou um erro. Status: ${response.status}`);
  }

  // Se a chamada for bem-sucedida, retorna os dados em formato JSON.
  return await response.json();
}


// --- ENDPOINT DA API ---
// Este é o endpoint que o seu workflow do n8n irá chamar.
app.post('/api/recall/create', async (req, res) => {
  console.log('[INFO] Pedido recebido em /api/recall/create');
  
  try {
    const { meeting_url, agent_id } = req.body;

    // Valida se os campos necessários foram enviados no pedido.
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


// --- INICIALIZAÇÃO DO SERVIDOR ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});

