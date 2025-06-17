const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Test endpoint to verify API keys
app.get('/api/test-keys', (req, res) => {
  res.json({
    message: 'API Keys Status',
    environment: process.env.NODE_ENV,
    keys: {
      googleTranslate: process.env.GOOGLE_TRANSLATE_API_KEY ? 'Configured' : 'Not Configured',
      openAI: process.env.OPENAI_API_KEY ? 'Configured' : 'Not Configured'
    },
    serverTime: new Date().toISOString(),
    serverUrl: req.protocol + '://' + req.get('host')
  });
});

// Add this new endpoint before the error handling middleware
app.get('/api/test-config', (req, res) => {
  const config = {
    serverUrl: process.env.NODE_ENV === 'production' 
      ? 'https://travfood-backend.herokuapp.com'
      : 'http://localhost:3000',
    environment: process.env.NODE_ENV || 'development',
    keys: {
      googleTranslate: process.env.GOOGLE_TRANSLATE_API_KEY ? 'Configured' : 'Not Configured',
      openAI: process.env.OPENAI_API_KEY ? 'Configured' : 'Not Configured'
    },
    envFile: process.env.ENV_FILE || 'Not specified'
  };
  
  console.log('Test config endpoint called:', config);
  res.json(config);
});

// Translation endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    
    const response = await axios.post(
      'https://translation.googleapis.com/language/translate/v2',
      {
        q: text,
        target: targetLanguage
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GOOGLE_TRANSLATE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// AI Assistant endpoint
app.post('/api/ai-assistant', async (req, res) => {
  try {
    const { message, model, messages, temperature, max_tokens } = req.body;
    
    // Log API key usage
    console.log('AI Assistant Request:', {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      openAIKey: process.env.OPENAI_API_KEY ? 'Configured' : 'Not Configured',
      keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
      keyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 4) + '...' : 'None'
    });

    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured');
      return res.status(500).json({ error: 'OpenAI API key is not configured' });
    }

    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: model || 'deepseek-chat',
        messages: messages || [
          {
            role: "system",
            content: "You are a helpful travel and food assistant. Provide concise, accurate information about travel destinations, local cuisine, and cultural experiences. Always prioritize safety and cultural sensitivity in your recommendations."
          },
          {
            role: "user",
            content: message
          }
        ],
        max_tokens: max_tokens || 500,
        temperature: temperature || 0.7,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Log successful response
    console.log('AI Assistant Response:', {
      timestamp: new Date().toISOString(),
      status: 'success',
      tokens: response.data.usage?.total_tokens
    });

    res.json(response.data);
  } catch (error) {
    // Log error with API key info
    console.error('AI Assistant Error:', {
      timestamp: new Date().toISOString(),
      error: error.message,
      environment: process.env.NODE_ENV,
      openAIKey: process.env.OPENAI_API_KEY ? 'Configured' : 'Not Configured',
      keyLength: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0,
      keyPrefix: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 4) + '...' : 'None'
    });
    
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    apiKeys: {
      googleTranslate: process.env.GOOGLE_TRANSLATE_API_KEY ? 'configured' : 'not configured',
      openAI: process.env.OPENAI_API_KEY ? 'configured' : 'not configured'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
}); 