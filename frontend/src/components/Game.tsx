'use client';

// src/components/Game.tsx
import React, { useState, useEffect, useRef } from 'react';
import TreeVisualizer from './TreeVisualizer';
import { gameApi, FileSystemTree } from '@/lib/api';

interface CommandHistoryEntry {
  command: string;
  output: string;
  success: boolean;
}

const Game: React.FC = () => {
  const [gameState, setGameState] = useState<{
    tree: FileSystemTree | null;
    sessionId: number | null;
    loading: boolean;
    error: string | null;
  }>({
    tree: null,
    sessionId: null,
    loading: false,
    error: null,
  });

  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);
  const [executing, setExecuting] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  const [terminalMinimized, setTerminalMinimized] = useState(false);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commandHistory]);

  // Start a new game
  const startNewGame = async () => {
    try {
      setGameState({ ...gameState, loading: true, error: null });
      const response = await gameApi.createGame('Player1');
      setGameState({
        tree: response.tree,
        sessionId: response.session_id,
        loading: false,
        error: null,
      });
      setCommandHistory([{
        command: '🎮 Game started!',
        output: response.mole_hint + '\nType "help" for available commands.',
        success: true,
      }]);
      setHints([]);
      setShowHints(false);
      setTerminalMinimized(false);
    } catch (error) {
      setGameState({
        ...gameState,
        loading: false,
        error: 'Failed to start game. Is the backend running on http://localhost:8000?',
      });
    }
  };

  // Get hints
  const getHints = async () => {
    if (!gameState.tree) return;
    
    try {
      const response = await gameApi.getHint(gameState.tree.id);
      setHints(response.hints);
      setShowHints(true);
    } catch (error) {
      console.error('Failed to get hints', error);
    }
  };

  // Execute a command
  const executeCommand = async (cmd: string) => {
    if (!gameState.tree || !cmd.trim() || executing) return;

    setExecuting(true);
    try {
      const response = await gameApi.executeCommand(
        gameState.tree.id,
        cmd,
        gameState.sessionId || undefined
      );

      // Update command history
      setCommandHistory(prev => [...prev, {
        command: cmd,
        output: response.output,
        success: response.success,
      }]);

      // Update player location if moved
      if (response.current_path !== gameState.tree.player_location) {
        setGameState(prev => ({
          ...prev,
          tree: prev.tree ? {
            ...prev.tree,
            player_location: response.current_path,
          } : null,
        }));
      }

      // Check if game won
      if (response.game_won) {
        setGameState(prev => ({
          ...prev,
          tree: prev.tree ? {
            ...prev.tree,
            is_completed: true,
            tree_data: updateTreeDataToShowMole(prev.tree!.tree_data, prev.tree!.player_location),
          } : null,
        }));
      }

      setCommand('');
    } catch (error) {
      setCommandHistory(prev => [...prev, {
        command: cmd,
        output: 'Error: Failed to execute command. Check your connection.',
        success: false,
      }]);
    } finally {
      setExecuting(false);
      inputRef.current?.focus();
    }
  };

  // Update tree data to show mole when game is won
  const updateTreeDataToShowMole = (treeData: any, molePath: string): any => {
    if (treeData.path === molePath) {
      return { ...treeData, has_mole: true };
    }
    if (treeData.children) {
      return {
        ...treeData,
        children: treeData.children.map((child: any) => 
          updateTreeDataToShowMole(child, molePath)
        ),
      };
    }
    return treeData;
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCommand(command);
  };

  // Handle node click in visualizer
  const handleNodeClick = (path: string) => {
    executeCommand(`cd ${path}`);
  };

  // Start game on mount
  useEffect(() => {
    startNewGame();
  }, []);

  if (gameState.loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-2xl mb-4">Loading Bashamole...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    );
  }

  if (gameState.error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-red-400 mb-4">{gameState.error}</div>
          <button
            onClick={startNewGame}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!gameState.tree) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">🐭 Bashamole</h1>
          <p className="text-gray-400 mb-8">Hunt the mole in the Unix filesystem!</p>
          <button
            onClick={startNewGame}
            className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xl transition transform hover:scale-105"
          >
            Start New Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-900 text-white overflow-hidden">
      {/* Tree Canvas - Full Screen Background */}
      <div className="absolute inset-0 bg-gray-900">
        <TreeVisualizer
          treeData={gameState.tree.tree_data}
          playerLocation={gameState.tree.player_location}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Top Header Bar */}
      <div className="absolute top-0 left-0 right-0 bg-gray-900/90 backdrop-blur-sm border-b border-gray-700 p-4 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">🐭 Bashamole</h1>
            <div className="text-sm text-gray-400">
              Location: <span className="font-mono text-blue-400">{gameState.tree.player_location}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {gameState.tree.is_completed ? (
              <div className="text-green-400 font-bold animate-pulse">
                🎉 You found the mole!
              </div>
            ) : (
              <>
                <button
                  onClick={getHints}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition"
                >
                  Get Hint 💡
                </button>
                <button
                  onClick={startNewGame}
                  className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition"
                >
                  New Game
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Hints Popup */}
      {showHints && hints.length > 0 && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-yellow-900/95 backdrop-blur-sm border border-yellow-600 rounded-lg p-4 max-w-md z-30 shadow-2xl">
          <button
            onClick={() => setShowHints(false)}
            className="absolute top-2 right-2 text-yellow-400 hover:text-yellow-300"
          >
            ✕
          </button>
          <h3 className="text-yellow-400 font-bold mb-2">💡 Hints:</h3>
          {hints.map((hint, index) => (
            <p key={index} className="text-yellow-200 text-sm">{hint}</p>
          ))}
        </div>
      )}

      {/* Floating Terminal */}
      <div className={`absolute bottom-4 left-4 bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-2xl border border-gray-700 transition-all duration-300 z-30 ${
        terminalMinimized ? 'w-80' : 'w-[500px]'
      }`}>
        {/* Terminal Header */}
        <div className="flex items-center justify-between bg-gray-700 px-4 py-2 rounded-t-lg">
          <h3 className="text-sm font-semibold text-gray-300">Terminal</h3>
          <button
            onClick={() => setTerminalMinimized(!terminalMinimized)}
            className="text-gray-400 hover:text-white transition"
          >
            {terminalMinimized ? '▲' : '▼'}
          </button>
        </div>

        {/* Terminal Content */}
        {!terminalMinimized && (
          <>
            <div 
              ref={terminalRef}
              className="bg-black text-green-400 p-3 font-mono text-xs h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700"
            >
              {commandHistory.map((entry, index) => (
                <div key={index} className="mb-2">
                  <div className="text-gray-400">
                    {entry.command.startsWith('🎮') ? (
                      <span className="text-yellow-400">{entry.command}</span>
                    ) : (
                      <>$ {entry.command}</>
                    )}
                  </div>
                  <div className={entry.success ? 'text-green-400' : 'text-red-400'}>
                    {entry.output.split('\n').map((line, i) => (
                      <div key={i} className="ml-2">{line}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <form onSubmit={handleSubmit} className="border-t border-gray-700">
              <div className="flex bg-gray-900">
                <span className="bg-gray-800 px-3 py-2 text-green-400 font-mono text-sm">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  disabled={executing || gameState.tree.is_completed}
                  className="flex-1 px-3 py-2 bg-gray-900 text-green-400 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono placeholder-gray-600"
                  placeholder="cd, ls, pwd, help, killall moles"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={executing || gameState.tree.is_completed}
                  className="px-4 py-2 bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 transition"
                >
                  {executing ? '...' : 'Run'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* Instructions - Bottom Right */}
      <div className="absolute bottom-4 right-4 bg-gray-800/80 backdrop-blur-sm rounded-lg p-3 text-xs text-gray-400 max-w-xs z-20">
        <div className="font-semibold text-gray-300 mb-1">Controls:</div>
        <div>• Click nodes to navigate</div>
        <div>• Scroll to zoom, drag to pan</div>
        <div>• Type commands in terminal</div>
        <div className="mt-1 text-gray-500">Find and eliminate the mole!</div>
      </div>
    </div>
  );
};

export default Game;