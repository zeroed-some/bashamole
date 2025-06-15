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
  const [terminalMinimized, setTerminalMinimized] = useState(true);
  const [hasPlayedIntro, setHasPlayedIntro] = useState(false);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commandHistory]);

  // Auto-focus input after command execution
  useEffect(() => {
    if (!executing && inputRef.current && !terminalMinimized) {
      inputRef.current.focus();
    }
  }, [executing, terminalMinimized]);

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
        command: 'Hunt started!',
        output: response.mole_hint + '\nType "help" for available commands.',
        success: true,
      }]);
      setHints([]);
      setShowHints(false);
      setTerminalMinimized(true); // Keep terminal minimized on new game
      setHasPlayedIntro(false); // Reset intro for new game
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
      // Focus will be restored by useEffect
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

  // Mark intro as played after first render
  useEffect(() => {
    if (gameState.tree && !hasPlayedIntro) {
      // Set timeout to mark intro as played after animation completes
      const timer = setTimeout(() => {
        setHasPlayedIntro(true);
      }, 6500); // Total intro duration
      return () => clearTimeout(timer);
    }
  }, [gameState.tree, hasPlayedIntro]);

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
          <h1 className="text-4xl font-bold mb-4">Bashamole</h1>
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
          playIntro={!hasPlayedIntro}
        />
      </div>

      {/* Floating Terminal - Top Left */}
      <div className={`absolute top-4 left-4 bg-gray-900 rounded-lg shadow-2xl border border-gray-800 transition-all duration-300 z-30 ${
        terminalMinimized ? 'w-80' : 'w-[700px]'
      }`}>
        {/* Terminal Header */}
        <div className="flex items-center justify-between bg-gray-800 px-4 py-2 rounded-t-lg border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <h3 className="text-sm font-medium text-gray-300 ml-2">bash</h3>
          </div>
          <button
            onClick={() => setTerminalMinimized(!terminalMinimized)}
            className="text-gray-400 hover:text-white transition"
          >
            {terminalMinimized ? '▼' : '▲'}
          </button>
        </div>

        {/* Terminal Content */}
        {!terminalMinimized && (
          <div 
            ref={terminalRef}
            className="bg-black p-4 font-mono text-base h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700"
            onClick={() => inputRef.current?.focus()}
          >
            {commandHistory.map((entry, index) => (
              <div key={index} className="mb-1">
                <div className="flex items-start">
                  <span className="text-green-400">groundskeeper@molehill</span>
                  <span className="text-gray-400 mx-1">::</span>
                  <span className="text-blue-400">{entry.command.startsWith('Hunt started!') ? '~' : gameState.tree?.player_location || '~'}</span>
                  <span className="text-gray-400 ml-1">$</span>
                  <span className={`ml-2 ${entry.command.startsWith('Hunt started!') ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {entry.command.startsWith('Hunt started!') ? '' : entry.command}
                  </span>
                </div>
                {entry.output && (
                  <div className={`${entry.success ? 'text-gray-300' : 'text-red-400'} ml-0 mt-1`}>
                    {entry.output.split('\n').map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Current input line */}
            <div className="flex items-start">
              <span className="text-green-400">groundskeeper@molehill</span>
              <span className="text-gray-400 mx-1">::</span>
              <span className="text-blue-400">{gameState.tree?.player_location || '~'}</span>
              <span className="text-gray-400 ml-1">$</span>
              <form onSubmit={handleSubmit} className="flex-1 ml-2">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    disabled={executing || gameState.tree?.is_completed}
                    className="w-full bg-transparent text-gray-300 outline-none caret-transparent"
                    placeholder=""
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                  {/* Blinking cursor */}
                  <span 
                    className="absolute text-gray-300 pointer-events-none"
                    style={{ 
                      left: `${command.length * 0.6}em`,
                      animation: 'blink 1s step-end infinite'
                    }}
                  >
                    _
                  </span>
                </div>
              </form>
            </div>
          </div>
        )}
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
          <h3 className="text-yellow-400 font-bold mb-2">Hints:</h3>
          {hints.map((hint, index) => (
            <p key={index} className="text-yellow-200 text-sm">{hint}</p>
          ))}
        </div>
      )}

      {/* Bottom Game Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700 p-4 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Bashamole</h1>
            <div className="text-sm text-gray-400">
              Location: <span className="font-mono text-blue-400">{gameState.tree.player_location}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {gameState.tree.is_completed ? (
              <div className="text-green-400 font-bold animate-pulse">
                You found the mole!
              </div>
            ) : (
              <>
                <button
                  onClick={getHints}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 transition"
                >
                  Get Hint
                </button>
                <div className="text-xs text-gray-500">
                  Click nodes or use terminal
                </div>
              </>
            )}
            <button
              onClick={startNewGame}
              className="px-3 py-1.5 bg-gray-700 text-white text-sm rounded hover:bg-gray-600 transition"
            >
              New Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;