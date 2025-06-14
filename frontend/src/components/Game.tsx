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
            // Update tree_data to show mole
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
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">🐭 Bashamole</h1>
              <p className="text-gray-400">
                Current Location: <span className="font-mono text-blue-400">{gameState.tree.player_location}</span>
              </p>
            </div>
            <div className="text-right">
              {gameState.tree.is_completed ? (
                <div className="text-green-400 font-bold text-xl animate-pulse">
                  🎉 You found the mole!
                </div>
              ) : (
                <div className="space-x-2">
                  <button
                    onClick={getHints}
                    className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition"
                  >
                    Get Hint 💡
                  </button>
                  <button
                    onClick={startNewGame}
                    className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
                  >
                    New Game
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hints */}
        {showHints && hints.length > 0 && (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-4">
            <h3 className="text-yellow-400 font-bold mb-2">💡 Hints:</h3>
            {hints.map((hint, index) => (
              <p key={index} className="text-yellow-200">{hint}</p>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Tree Visualizer */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-4">
            <h2 className="text-xl font-semibold mb-3 text-gray-300">Filesystem Tree</h2>
            <div className="h-[600px] bg-gray-900 rounded-lg p-2">
              <TreeVisualizer
                treeData={gameState.tree.tree_data}
                playerLocation={gameState.tree.player_location}
                onNodeClick={handleNodeClick}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Click nodes to navigate • Scroll to zoom • Drag to pan
            </p>
          </div>

          {/* Terminal */}
          <div className="bg-gray-800 rounded-lg shadow-xl p-4">
            <h2 className="text-xl font-semibold mb-3 text-gray-300">Terminal</h2>
            <div 
              ref={terminalRef}
              className="bg-black text-green-400 p-4 rounded font-mono text-sm h-[550px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700"
            >
              {commandHistory.map((entry, index) => (
                <div key={index} className="mb-3">
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
            
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="flex bg-gray-900 rounded overflow-hidden">
                <span className="bg-gray-800 px-3 py-2 text-green-400 font-mono">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  disabled={executing || gameState.tree.is_completed}
                  className="flex-1 px-3 py-2 bg-gray-900 text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder-gray-600"
                  placeholder="Enter command (cd, ls, pwd, help, killall moles)"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={executing || gameState.tree.is_completed}
                  className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 transition"
                >
                  {executing ? '...' : 'Run'}
                </button>
              </div>
            </form>

            <div className="mt-2 text-xs text-gray-600">
              Pro tip: Type "help" to see all available commands
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;