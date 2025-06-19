import { ChatAnthropic } from '@langchain/anthropic';

export class AIAgent {
  constructor(apiKey) {
    this.llm = new ChatAnthropic({
      model: 'claude-3-5-sonnet-20241022',
      temperature: 0.7,
      anthropicApiKey: apiKey,
    });
    
    this.tools = this.createTools();
    this.memory = [];
  }

  createTools() {
    return {
      calculator: {
        name: 'calculator',
        description: 'すべての数学計算に使用してください。入力は "10 + 5 * 2" のような数式です',
        func: async (input) => {
          try {
            console.log(`🔧 Calculator tool executing: ${input}`);
            const result = eval(input.trim());
            const response = `計算結果: ${input} = ${result}`;
            console.log(`✅ Calculator result: ${response}`);
            return response;
          } catch (error) {
            const errorMsg = `計算エラー: ${error.message}`;
            console.log(`❌ Calculator error: ${errorMsg}`);
            return errorMsg;
          }
        }
      },
      text_analyzer: {
        name: 'text_analyzer',
        description: 'テキストを分析して単語数や文字数を提供します。入力は分析するテキストです',
        func: async (text) => {
          try {
            console.log(`🔧 Text analyzer tool executing for: "${text}"`);
            const wordCount = text.trim().split(/\s+/).length;
            const charCount = text.length;
            const response = `テキスト分析結果: "${text}" - ${wordCount}語, ${charCount}文字`;
            console.log(`✅ Text analyzer result: ${response}`);
            return response;
          } catch (error) {
            const errorMsg = `分析エラー: ${error.message}`;
            console.log(`❌ Text analyzer error: ${errorMsg}`);
            return errorMsg;
          }
        }
      },
      message_creator: {
        name: 'message_creator',
        description: 'メッセージや挨拶文を作成します。入力はメッセージに含める情報です',
        func: async (info) => {
          try {
            console.log(`🔧 Message creator tool executing with: ${info}`);
            const message = `作成したメッセージ: ${info}という情報を使って、こんにちは！素晴らしい結果をお知らせします: ${info}。今日も良い一日をお過ごしください！`;
            console.log(`✅ Message creator result: ${message}`);
            return message;
          } catch (error) {
            const errorMsg = `メッセージ作成エラー: ${error.message}`;
            console.log(`❌ Message creator error: ${errorMsg}`);
            return errorMsg;
          }
        }
      }
    };
  }

  async runAgent(input, addLog) {
    const maxSteps = 10;
    let currentStep = 0;
    let context = '';
    
    addLog('text', `🤖 エージェント開始: ${input}`);
    
    while (currentStep < maxSteps) {
      currentStep++;
      addLog('text', `ステップ ${currentStep}`);
      
      const toolsDescription = Object.values(this.tools)
        .map(tool => `- ${tool.name}: ${tool.description}`)
        .join('\n');
      
      const prompt = `You are an AI agent that MUST use tools to solve tasks step by step. You MUST respond in Japanese.

Available tools:
${toolsDescription}

Task: ${input}
Previous context: ${context}

You must respond with EXACTLY one of these formats:

THOUGHT: [あなたの次に何をすべきかの推論を日本語で]
TOOL: [tool name: calculator, text_analyzer, or message_creator]
INPUT: [input for the tool]

OR if you have completed the task:
FINAL: [ツール実行結果に基づく最終回答を日本語で]

CRITICAL RULES:
- You MUST use tools. You cannot calculate, analyze, or create messages directly.
- ALL text output including THOUGHT and FINAL must be in Japanese.
- Always explain your reasoning in Japanese.`;

      try {
        const response = await this.llm.invoke([
          { role: 'system', content: 'あなたは日本語で応答する必要があります。すべての出力は日本語でなければなりません。' },
          { role: 'user', content: prompt }
        ]);
        
        const content = response.content.trim();
        console.log(`📝 Agent response: ${content}`);
        
        if (content.startsWith('FINAL:')) {
          const finalAnswer = content.replace('FINAL:', '').trim();
          addLog('completion', `完了: ${finalAnswer}`);
          return finalAnswer;
        }
        
        // Parse response
        const thoughtMatch = content.match(/THOUGHT:\s*([\s\S]*?)(?=\nTOOL:|$)/);
        const toolMatch = content.match(/TOOL:\s*(.*?)(?=\n|$)/);
        const inputMatch = content.match(/INPUT:\s*(.*?)(?=\n|$)/);
        
        console.log('Parsing content:', content);
        console.log('Thought match:', thoughtMatch);
        console.log('Tool match:', toolMatch);
        console.log('Input match:', inputMatch);
        
        if (thoughtMatch) {
          const thought = thoughtMatch[1].trim();
          addLog('thought', `思考: ${thought}`);
          context += ` Thought: ${thought}`;
        }
        
        if (toolMatch && inputMatch) {
          const toolName = toolMatch[1].trim();
          const toolInput = inputMatch[1].trim();
          
          addLog('action', `アクション: ${toolName} (入力: ${toolInput})`);
          
          const tool = this.tools[toolName];
          if (tool) {
            try {
              const result = await tool.func(toolInput);
              addLog('tool', `ツール結果: ${result}`);
              context += ` Used ${toolName} with input "${toolInput}" and got result: ${result}`;
            } catch (error) {
              addLog('tool', `ツールエラー: ${error.message}`);
              context += ` Tool ${toolName} failed: ${error.message}`;
            }
          } else {
            addLog('tool', `未知のツール: ${toolName}`);
            context += ` Unknown tool: ${toolName}`;
          }
        } else {
          addLog('text', 'フォーマットエラー: THOUGHT/TOOL/INPUT または FINAL が必要です');
          break;
        }
        
      } catch (error) {
        addLog('text', `LLMエラー: ${error.message}`);
        break;
      }
    }
    
    return context || '処理が完了しませんでした';
  }

  async executeTaskStreaming(input, sessionId = 'default', sendLog) {
    try {
      console.log(`\n🤖 [${sessionId}] Starting agent task: "${input}"`);
      
      const response = await this.runAgent(input, sendLog);

      console.log(`✨ [${sessionId}] Task completed successfully\n`);

      // Store in memory
      this.memory.push({
        type: 'human',
        content: input,
        timestamp: new Date().toISOString()
      });
      
      this.memory.push({
        type: 'ai',
        content: response,
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error) {
      console.error(`❌ [${sessionId}] Agent execution error:`, error);
      throw error;
    }
  }

  async executeTask(input, sessionId = 'default') {
    try {
      console.log(`\n🤖 [${sessionId}] Starting agent task: "${input}"`);
      
      const executionLogs = [];
      const addLog = (type, message, data = null) => {
        const logEntry = {
          type,
          message,
          data,
          timestamp: new Date().toISOString()
        };
        executionLogs.push(logEntry);
        console.log(`${type === 'thought' ? '💭' : type === 'action' ? '🎯' : type === 'tool' ? '🔧' : '📝'} ${message}`);
      };

      const response = await this.runAgent(input, addLog);

      console.log(`✨ [${sessionId}] Task completed successfully\n`);

      // Store in memory
      this.memory.push({
        type: 'human',
        content: input,
        timestamp: new Date().toISOString()
      });
      
      this.memory.push({
        type: 'ai',
        content: response,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        response: response,
        steps: [],
        executionLogs: executionLogs,
        sessionId
      };
    } catch (error) {
      console.error(`❌ [${sessionId}] Agent execution error:`, error);
      return {
        success: false,
        error: error.message,
        sessionId
      };
    }
  }


  getMemory(limit = 20) {
    return this.memory.slice(-limit);
  }

  clearMemory() {
    this.memory = [];
  }
}