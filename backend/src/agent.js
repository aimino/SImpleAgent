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
    this.currentTodos = [];
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
      },
      task_planner: {
        name: 'task_planner',
        description: 'タスクを細かいサブタスクに分解してTODOリストを作成します。入力は分解したいメインタスクです',
        func: async (mainTask) => {
          try {
            console.log(`🔧 Task planner tool executing for: ${mainTask}`);
            
            // LLMを使ってタスクを分解
            const planResponse = await this.llm.invoke([
              { role: 'system', content: 'あなたはタスクを効率的なサブタスクに分解する専門家です。必ず日本語で応答してください。' },
              { role: 'user', content: `以下のタスクを3-5個の具体的なサブタスクに分解してください。各サブタスクは以下の形式で出力してください：

タスク: ${mainTask}

出力形式：
1. [サブタスク1の説明]
2. [サブタスク2の説明]
3. [サブタスク3の説明]
...

条件：
- 各サブタスクは具体的で実行可能である
- 利用可能なツール（calculator, text_analyzer, message_creator）を考慮する
- 論理的な順序で並べる` }
            ]);
            
            const planContent = planResponse.content.trim();
            console.log(`📋 Task breakdown: ${planContent}`);
            
            // サブタスクを抽出してTODOリストを作成
            const subtasks = planContent.split('\n')
              .filter(line => line.match(/^\d+\./))
              .map((line, index) => ({
                id: `subtask_${Date.now()}_${index}`,
                title: line.replace(/^\d+\.\s*/, '').trim(),
                status: 'pending',
                priority: index === 0 ? 'high' : 'medium'
              }));
            
            this.currentTodos = subtasks;
            
            const result = `TODOリスト作成完了:\n${subtasks.map((task, i) => `${i+1}. ${task.title} (${task.status})`).join('\n')}`;
            console.log(`✅ Task planner result: ${result}`);
            return result;
          } catch (error) {
            const errorMsg = `タスク計画エラー: ${error.message}`;
            console.log(`❌ Task planner error: ${errorMsg}`);
            return errorMsg;
          }
        }
      },
      todo_manager: {
        name: 'todo_manager',
        description: 'TODOリストを管理します。アクション（list, complete, current）と対象のタスクIDまたは番号を指定',
        func: async (input) => {
          try {
            console.log(`🔧 TODO manager tool executing with: ${input}`);
            
            const [action, ...params] = input.split(' ');
            
            switch (action.toLowerCase()) {
              case 'list':
                const listResult = this.currentTodos.length > 0 
                  ? `現在のTODOリスト:\n${this.currentTodos.map((task, i) => `${i+1}. ${task.title} [${task.status}]`).join('\n')}`
                  : 'TODOリストは空です';
                console.log(`✅ TODO list: ${listResult}`);
                return listResult;
                
              case 'complete':
                const taskIndex = parseInt(params[0]) - 1;
                if (taskIndex >= 0 && taskIndex < this.currentTodos.length) {
                  this.currentTodos[taskIndex].status = 'completed';
                  const completeResult = `タスク${taskIndex + 1}「${this.currentTodos[taskIndex].title}」を完了としました`;
                  console.log(`✅ Task completed: ${completeResult}`);
                  return completeResult;
                } else {
                  return `無効なタスク番号: ${params[0]}`;
                }
                
              case 'current':
                const currentTask = this.currentTodos.find(task => task.status === 'pending');
                const currentResult = currentTask 
                  ? `現在のタスク: ${currentTask.title}`
                  : '完了していないタスクはありません';
                console.log(`✅ Current task: ${currentResult}`);
                return currentResult;
                
              default:
                return `不明なアクション: ${action}。使用可能なアクション: list, complete, current`;
            }
          } catch (error) {
            const errorMsg = `TODO管理エラー: ${error.message}`;
            console.log(`❌ TODO manager error: ${errorMsg}`);
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

WORKFLOW:
1. First, analyze if this is a new task that needs to be broken down
2. If it's a complex task, use task_planner to create a TODO list
3. Use todo_manager to track progress and get current tasks
4. Execute individual tasks using appropriate tools
5. Mark tasks as complete using todo_manager
6. Provide final summary when all tasks are done

Available tools:
${toolsDescription}

Task: ${input}
Previous context: ${context}

You must respond with EXACTLY one of these formats (no additional text):

Format 1 - For continuing work:
THOUGHT: [あなたの次に何をすべきかの推論を日本語で]
TOOL: [tool name: task_planner, todo_manager, calculator, text_analyzer, or message_creator]
INPUT: [input for the tool]

Format 2 - For completion:
FINAL: [すべてのタスク完了後の最終回答を日本語で]

CRITICAL RULES:
- For complex tasks, ALWAYS start with task_planner
- Use todo_manager to track progress: "list", "current", "complete [number]"
- You MUST use tools. You cannot calculate, analyze, or create messages directly.
- ALL text output including THOUGHT and FINAL must be in Japanese.
- Response must be EXACTLY in the format shown above (3 lines for Format 1, 1 line for Format 2)
- No extra explanation or text outside the format.`;

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
        
        // Parse response - more flexible parsing
        const lines = content.split('\n').filter(line => line.trim());
        
        console.log('Parsing content:', content);
        console.log('Lines:', lines);
        
        let thought = '';
        let toolName = '';
        let toolInput = '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('THOUGHT:')) {
            thought = trimmedLine.replace('THOUGHT:', '').trim();
          } else if (trimmedLine.startsWith('TOOL:')) {
            toolName = trimmedLine.replace('TOOL:', '').trim();
          } else if (trimmedLine.startsWith('INPUT:')) {
            toolInput = trimmedLine.replace('INPUT:', '').trim();
          }
        }
        
        console.log('Parsed - Thought:', thought, 'Tool:', toolName, 'Input:', toolInput);
        
        if (thought) {
          addLog('thought', `思考: ${thought}`);
          context += ` Thought: ${thought}`;
        }
        
        if (toolName && toolInput) {
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
        } else if (thought && !toolName) {
          // Only thought provided, continue to next iteration
          continue;
        } else {
          addLog('text', `フォーマットエラー: THOUGHT/TOOL/INPUT または FINAL が必要です。受信内容: ${content}`);
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