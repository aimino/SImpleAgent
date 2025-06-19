import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { AIAgent } from './agent.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:5173']
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Initialize AI Agent
let aiAgent;
try {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }
  aiAgent = new AIAgent(process.env.ANTHROPIC_API_KEY);
  console.log('AI Agent initialized successfully');
} catch (error) {
  console.error('Failed to initialize AI Agent:', error.message);
  process.exit(1);
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Agent execution endpoint - Server-Sent Events for real-time updates
app.post('/api/agent/execute', async (req, res) => {
  try {
    const { task, sessionId } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: 'Task is required' });
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    });

    // Send initial message
    res.write(`data: ${JSON.stringify({
      type: 'start',
      message: 'エージェント実行開始',
      timestamp: new Date().toISOString()
    })}\n\n`);

    // Create a real-time logger
    const sendLog = (type, message, data = null) => {
      const logEntry = {
        type: 'log',
        logType: type,
        message,
        data,
        timestamp: new Date().toISOString()
      };
      
      console.log(`${type === 'thought' ? '💭' : type === 'action' ? '🎯' : type === 'tool' ? '🔧' : '📝'} ${message}`);
      
      res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
    };

    try {
      const result = await aiAgent.executeTaskStreaming(task, sessionId, sendLog);
      
      // Send final result
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        response: result,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
    } catch (agentError) {
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: agentError.message,
        timestamp: new Date().toISOString()
      })}\n\n`);
    }

    res.end();
    
  } catch (error) {
    console.error('Agent execution error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation history
app.get('/api/history', (req, res) => {
  try {
    const { limit } = req.query;
    const history = aiAgent.getMemory(limit ? parseInt(limit) : 20);
    
    res.json({
      success: true,
      history,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear conversation history
app.delete('/api/history', (req, res) => {
  try {
    aiAgent.clearMemory();
    res.json({ 
      success: true, 
      message: 'History cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});