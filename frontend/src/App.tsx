import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface TodoItem {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

interface Message {
  id: string;
  content: string;
  type: 'user' | 'agent' | 'system';
  timestamp: string;
  isThinking?: boolean;
  steps?: any[];
  executionLogs?: ExecutionLog[];
  todos?: TodoItem[];
}

interface ChatResponse {
  success: boolean;
  response?: string;
  error?: string;
  steps?: any[];
  executionLogs?: ExecutionLog[];
  todos?: TodoItem[];
  type?: string;
}

interface ExecutionLog {
  type: 'thought' | 'action' | 'tool' | 'text' | 'completion';
  message: string;
  data?: any;
  timestamp: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (content: string, type: 'user' | 'agent' | 'system', steps?: any[], executionLogs?: ExecutionLog[], todos?: TodoItem[]) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      type,
      timestamp: new Date().toISOString(),
      steps,
      executionLogs,
      todos
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = inputValue.trim();
    console.log('Sending message:', userMessage);
    
    // Clear input immediately and freeze it during execution
    setInputValue('');
    console.log('Input cleared');
    
    addMessage(userMessage, 'user');

    // Add thinking message that will be updated in real-time
    const agentMessageId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const agentMessage: Message = {
      id: agentMessageId,
      content: 'AIエージェントが実行中...',
      type: 'agent',
      timestamp: new Date().toISOString(),
      executionLogs: []
    };
    setMessages(prev => [...prev, agentMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task: userMessage })
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ') && line.slice(6).trim()) {
              try {
                const jsonStr = line.slice(6);
                console.log('Received SSE data:', jsonStr);
                const data = JSON.parse(jsonStr);
                
                if (data.type === 'log') {
                  // Update the agent message with new logs in real-time
                  setMessages(prev => {
                    return prev.map(msg => {
                      if (msg.id === agentMessageId) {
                        const newLog: ExecutionLog = {
                          type: data.logType,
                          message: data.message,
                          data: data.data,
                          timestamp: data.timestamp
                        };
                        return {
                          ...msg,
                          executionLogs: [...(msg.executionLogs || []), newLog]
                        };
                      }
                      return msg;
                    });
                  });
                } else if (data.type === 'complete') {
                  // Update final response
                  setMessages(prev => {
                    return prev.map(msg => {
                      if (msg.id === agentMessageId) {
                        return {
                          ...msg,
                          content: data.response,
                          todos: data.todos
                        };
                      }
                      return msg;
                    });
                  });
                } else if (data.type === 'error') {
                  setMessages(prev => {
                    return prev.map(msg => {
                      if (msg.id === agentMessageId) {
                        return {
                          ...msg,
                          content: `エラー: ${data.error}`,
                          type: 'system'
                        };
                      }
                      return msg;
                    });
                  });
                }
              } catch (parseError) {
                console.error('Failed to parse SSE data:', parseError, 'Line:', line);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === agentMessageId) {
            return {
              ...msg,
              content: `エラー: ${error instanceof Error ? error.message : 'サーバーに接続できませんでした'}`,
              type: 'system'
            };
          }
          return msg;
        });
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await axios.delete('/api/history');
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">AI Agent Chat</h1>
          <div className="flex items-center space-x-4">
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg text-sm font-medium">
              自律AIエージェント
            </div>
            <button
              onClick={clearHistory}
              className="px-4 py-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
            >
              履歴クリア
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          タスク分解機能付き自律エージェントモード（TODOリスト管理・複数ステップ実行）
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">AIエージェントとチャットを始めましょう</h3>
            <p className="text-gray-500">
              タスクを入力してください。エージェントが自動的にサブタスクに分解してTODOリストを作成し、順次実行します。
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xl px-4 py-3 rounded-lg ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.type === 'system'
                  ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                  : 'bg-white text-gray-800 shadow-sm border'
              }`}
            >
              <div className={`message-content whitespace-pre-wrap ${message.isThinking ? 'thinking-animation' : ''}`}>
                {message.content}
              </div>
              
              {message.todos && message.todos.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-2">📋 TODOリスト:</p>
                  <div className="space-y-1">
                    {message.todos.map((todo, index) => (
                      <div key={todo.id} className={`text-sm p-2 rounded flex items-center space-x-2 ${
                        todo.status === 'completed' ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-800'
                      }`}>
                        <span className="text-base">
                          {todo.status === 'completed' ? '✅' : '⏳'}
                        </span>
                        <span className={`flex-1 ${todo.status === 'completed' ? 'line-through' : ''}`}>
                          {index + 1}. {todo.title}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          todo.priority === 'high' ? 'bg-red-100 text-red-700' :
                          todo.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {todo.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {message.executionLogs && message.executionLogs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-2">🤖 エージェントの思考プロセス:</p>
                  <div className="space-y-2">
                    {message.executionLogs.map((log, index) => (
                      <div key={index} className={`text-sm p-2 rounded ${
                        log.type === 'thought' ? 'bg-blue-50 border-l-4 border-blue-300' :
                        log.type === 'action' ? 'bg-green-50 border-l-4 border-green-300' :
                        log.type === 'tool' ? 'bg-yellow-50 border-l-4 border-yellow-300' :
                        log.type === 'completion' ? 'bg-purple-50 border-l-4 border-purple-300' :
                        'bg-gray-50'
                      }`}>
                        <div className="flex items-start space-x-2">
                          <span className="text-lg">
                            {log.type === 'thought' ? '💭' :
                             log.type === 'action' ? '🎯' :
                             log.type === 'tool' ? '🔧' :
                             log.type === 'completion' ? '✅' : '📝'}
                          </span>
                          <div className="flex-1">
                            <div className="font-medium text-gray-800 whitespace-pre-wrap">{log.message}</div>
                            {log.data && (
                              <div className="text-xs text-gray-500 mt-1">
                                {JSON.stringify(log.data, null, 2)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {message.steps && message.steps.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-2">実行ステップ:</p>
                  <div className="space-y-2">
                    {message.steps.map((step, index) => (
                      <div key={index} className="text-sm bg-gray-50 p-2 rounded">
                        <div className="font-medium">{step.action || 'アクション'}</div>
                        <div className="text-gray-600">{step.input || step.observation}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-xs opacity-70 mt-2">
                {new Date(message.timestamp).toLocaleTimeString('ja-JP')}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-6 py-4">
        <div className="flex space-x-3">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="タスクを入力してください（例：「分析レポートを作成して」「複数の計算を実行して結果をまとめて」）..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>送信中...</span>
              </div>
            ) : (
              '送信'
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Enter で送信、Shift + Enter で改行
        </p>
      </div>
    </div>
  );
}

export default App;