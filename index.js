import express from 'express';
import fetch from 'node-fetch';

// Initialize Express app
const app = express();
app.use(express.json());

// --- CONFIGURATION ---
// Store your secrets as environment variables in your deployment platform (Railway, Vercel, etc.)
const RECALL_API_KEY = process.env.RECALL_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const RECALL_API_URL = 'https://api.recall.ai/api/v1/bot/';

// This is a conceptual function. The actual implementation depends heavily on
// how Recall.ai's API allows for real-time transcription and custom audio output.
// This example shows a plausible structure where you might configure the bot's behavior.
async function createAndConfigureBot(meetingUrl, agentId) {
  if (!RECALL_API_KEY || !ELEVENLABS_API_KEY) {
    throw new Error("API keys for Recall.ai or ElevenLabs are not set in environment variables.");
  }

  console.log(`Attempting to send bot to: ${meetingUrl}`);
  console.log(`Using ElevenLabs Agent ID: ${agentId}`);

  // The bot's name as it will appear in the Zoom call
  const BOT_NAME = "Munffett AI";

  // In a real-world scenario, you would configure transcription options
  // and a webhook where Recall.ai sends you the live transcript.
  const transcriptionOptions = {
    provider: 'gladia', // or any other provider supported by Recall
  };

  // The destination for the real-time audio/video stream from the meeting.
  // For a voice agent, you might point this to another service you control
  // that handles the interaction logic.
  const realtimeMediaDestination = {
    // This would be an endpoint you create to receive the meeting audio,
    // process it, send text to an LLM, get a response, generate audio with ElevenLabs,
    // and stream it back. This is a highly advanced step.
    // For now, we are just telling the bot to join.
    type: 'webhook',
    url: 'https://your-service.com/api/handle-audio-stream'
  };

  const response = await fetch(RECALL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${RECALL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: BOT_NAME,
      // This is where the integration would happen.
      // You would tell Recall.ai how you want to receive the audio
      // and potentially where it should expect to receive audio back from.
      // The API structure below is for ILLUSTRATIVE purposes.
      // Please consult the actual Recall.ai documentation.
      voice_agent_config: {
        platform: 'elevenlabs',
        agent_id: agentId,
        api_key: ELEVENLABS_API_KEY
      },
      transcription_options: transcriptionOptions
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to create bot. Status: ${response.status}. Body: ${errorBody}`);
  }

  return await response.json();
}


// --- API ENDPOINT ---
// This is the endpoint that your n8n workflow will call.
app.post('/api/recall/create', async (req, res) => {
  try {
    const { meeting_url, agent_id } = req.body;

    if (!meeting_url || !agent_id) {
      return res.status(400).json({ error: 'Missing required fields: meeting_url and agent_id' });
    }

    console.log('Received request to create bot.');
    const botData = await createAndConfigureBot(meeting_url, agent_id);

    console.log('Successfully created bot:', botData);
    res.status(200).json({
      message: 'Bot is being dispatched to the meeting.',
      details: botData
    });

  } catch (error) {
    console.error('Error in /api/recall/create:', error.message);
    res.status(500).json({ error: 'An internal server error occurred.' });
  }
});


// --- SERVER STARTUP ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
