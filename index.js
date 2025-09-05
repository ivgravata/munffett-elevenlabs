import express from 'express';
import fetch from 'node-fetch';

// Initialize Express app
const app = express();
app.use(express.json());

// --- CONFIGURATION ---
// Store your secrets as environment variables in your deployment platform (Railway, Vercel, etc.)
const RECALL_API_KEY = process.env.RECALL_API_KEY;

// NOTE: The ELEVENLABS_API_KEY is not directly used in this API call.
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY; 

const RECALL_API_URL = 'https://api.recall.ai/api/v1/bot/';

async function createBot(meetingUrl, agentId) {
  // 1. Validate that the required API key is available
  if (!RECALL_API_KEY) {
    console.error("FATAL: RECALL_API_KEY environment variable is not set.");
    throw new Error("API key for Recall.ai is not configured on the server.");
  }

  console.log(`[INFO] Attempting to send bot to meeting: ${meetingUrl}`);
  console.log(`[INFO] Associated ElevenLabs Agent ID: ${agentId}`);

  const BOT_NAME = "Munffett AI";

  // 2. Make the API call to Recall.ai with the added 'variant' parameter
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
      // --- CORREÇÃO ADICIONADA A PARTIR DO SEU CÓDIGO ANTIGO ---
      // This key specifies how Recall.ai should join the Zoom call.
      variant: {
        zoom: "web_4_core"
      }
    })
  });

  // 3. Handle the response from Recall.ai
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[ERROR] Failed to create bot. Status: ${response.status}`);
    console.error(`[ERROR] Recall.ai Response Body: ${errorBody}`);
    throw new Error(`Recall.ai API returned an error. Status: ${response.status}`);
  }

  return await response.json();
}


// --- API ENDPOINT ---
app.post('/api/recall/create', async (req, res) => {
  console.log('[INFO] Received request on /api/recall/create');
  
  try {
    const { meeting_url, agent_id } = req.body;

    if (!meeting_url || !agent_id) {
      console.error("[VALIDATION_ERROR] Request is missing 'meeting_url' or 'agent_id'.");
      return res.status(400).json({ error: 'Missing required fields: meeting_url and agent_id' });
    }

    const botData = await createBot(meeting_url, agent_id);

    console.log('[SUCCESS] Successfully dispatched bot. Details:', botData);
    res.status(200).json({
      message: 'Bot is being dispatched to the meeting.',
      details: botData
    });

  } catch (error) {
    console.error(`[ENDPOINT_ERROR] An error occurred in /api/recall/create: ${error.message}`);
    res.status(500).json({ error: 'An internal server error occurred while processing the request.' });
  }
});


// --- SERVER STARTUP ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

