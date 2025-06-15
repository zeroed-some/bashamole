'use client';

// src/components/Game.tsx
import React, { useState, useEffect, useRef } from 'react';
import TreeVisualizer from './TreeVisualizer';
import { gameApi, FileSystemTree, FHSDirectory, CommandReferenceResponse } from '@/lib/api';

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
  const [showFHS, setShowFHS] = useState(false);
  const [fhsDirs, setFhsDirs] = useState<FHSDirectory[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const [commandRef, setCommandRef] = useState<CommandReferenceResponse | null>(null);
  const [terminalMinimized, setTerminalMinimized] = useState(true);
  const [hasPlayedIntro, setHasPlayedIntro] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [moleKilled, setMoleKilled] = useState(false);
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect system color scheme preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsDarkMode(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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
      
      // Create a more dynamic starting message based on random location
      const startLocation = response.tree.player_location;
      const homeDir = response.home_directory || '/home';
      let locationContext = '';
      
      if (startLocation.startsWith('/home')) {
        locationContext = "You've been dropped in someone's home directory. ";
      } else if (startLocation.startsWith('/usr')) {
        locationContext = "You're in the system's usr hierarchy. ";
      } else if (startLocation.startsWith('/var')) {
        locationContext = "You're somewhere in the variable data area. ";
      } else if (startLocation.startsWith('/opt')) {
        locationContext = "You're in the optional packages directory. ";
      } else {
        locationContext = "You've been placed somewhere in the filesystem. ";
      }
      
      setCommandHistory([{
        command: 'Hunt started!',
        output: `${response.mole_hint}\n${locationContext}Your home directory is ${homeDir}.\nUse 'pwd' to see where you are, 'cd ~' to go home.\nType "help" for available commands.`,
        success: true,
      }]);
      setHints([]);
      setShowHints(false);
      setTerminalMinimized(true); // Keep terminal minimized on new game
      setHasPlayedIntro(false); // Reset intro for new game
      setMoleKilled(false); // Reset mole killed state
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

  // Get FHS reference
  const getFHSReference = async () => {
    try {
      const response = await gameApi.getFHSReference();
      setFhsDirs(response.directories);
      setShowFHS(true);
    } catch (error) {
      console.error('Failed to get FHS reference', error);
    }
  };

  // Get command reference
  const getCommandReference = async () => {
    try {
      if (!commandRef) {
        const response = await gameApi.getCommandReference();
        setCommandRef(response);
      }
      setShowCommands(true);
    } catch (error) {
      console.error('Failed to get command reference', error);
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
        // First, show the mole
        setGameState(prev => ({
          ...prev,
          tree: prev.tree ? {
            ...prev.tree,
            is_completed: true,
            tree_data: updateTreeDataToShowMole(prev.tree!.tree_data, prev.tree!.player_location),
          } : null,
        }));
        
        // Then trigger the falling animation after a short delay
        setTimeout(() => {
          setMoleKilled(true);
        }, 200);
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

  // Terminal color scheme based on dark/light mode
  const terminalColors = isDarkMode ? {
    frame: 'bg-stone-200 border-stone-300',
    header: 'bg-stone-300 border-stone-400',
    headerText: 'text-stone-900',
    content: 'bg-black',
    closeButton: 'text-stone-700 hover:text-stone-900'
  } : {
    frame: 'bg-blue-900 border-blue-800',
    header: 'bg-blue-800 border-blue-700',
    headerText: 'text-blue-100',
    content: 'bg-black',
    closeButton: 'text-blue-300 hover:text-white'
  };

  // Canvas background color based on dark/light mode
  const canvasBackground = isDarkMode ? 'bg-gray-900' : 'bg-stone-100';

  if (gameState.loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${canvasBackground} text-gray-900 dark:text-white`}>
        <div className="text-center">
          <div className="text-2xl mb-4">Loading Bashamole...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-current mx-auto"></div>
        </div>
      </div>
    );
  }

  if (gameState.error) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${canvasBackground} text-gray-900 dark:text-white`}>
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-4">{gameState.error}</div>
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
      <div className={`flex items-center justify-center min-h-screen ${canvasBackground} text-gray-900 dark:text-white`}>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Bashamole</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">Hunt the mole in the Unix filesystem!</p>
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
    <div className={`relative min-h-screen ${canvasBackground} overflow-hidden`}>
      {/* Tree Canvas - Full Screen Background */}
      <div className={`absolute inset-0 ${canvasBackground}`}>
        <TreeVisualizer
          treeData={gameState.tree.tree_data}
          playerLocation={gameState.tree.player_location}
          onNodeClick={handleNodeClick}
          playIntro={!hasPlayedIntro}
          isDarkMode={isDarkMode}
          moleKilled={moleKilled}
        />
      </div>

      {/* Floating Terminal - Top Left */}
      <div className={`absolute top-4 left-4 ${terminalColors.frame} rounded-lg shadow-2xl border transition-all duration-300 z-30 ${
        terminalMinimized ? 'w-80' : 'w-[700px]'
      }`}>
        {/* Terminal Header */}
        <div className={`flex items-center justify-between ${terminalColors.header} px-4 py-2 rounded-t-lg border-b`}>
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <button
                onClick={getCommandReference}
                className="w-3.5 h-3.5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition-colors relative"
                title="Command Reference"
              >
                <span className="text-[8px] font-bold text-gray-900 absolute">×</span>
              </button>
              {gameState.tree && !gameState.tree.is_completed ? (
                <button
                  onClick={getHints}
                  className="w-3.5 h-3.5 bg-yellow-500 hover:bg-yellow-400 rounded-full flex items-center justify-center transition-colors relative"
                  title="Get Hint"
                >
                  <span className="text-[9px] font-bold text-gray-900 absolute">?</span>
                </button>
              ) : (
                <div className="w-3.5 h-3.5 bg-yellow-500 rounded-full"></div>
              )}
              <button
                onClick={getFHSReference}
                className="w-3.5 h-3.5 bg-green-500 hover:bg-green-400 rounded-full flex items-center justify-center transition-colors relative"
                title="FHS Directory Reference"
              >
                <span className="text-[9px] font-bold text-gray-900 absolute">/</span>
              </button>
            </div>
            <h3 className={`text-sm font-medium ${terminalColors.headerText} ml-2`}>bash</h3>
          </div>
          <button
            onClick={() => setTerminalMinimized(!terminalMinimized)}
            className={`${terminalColors.closeButton} transition`}
          >
            {terminalMinimized ? '▼' : '▲'}
          </button>
        </div>

        {/* Terminal Content */}
        {!terminalMinimized && (
          <div 
            ref={terminalRef}
            className={`${terminalColors.content} p-4 font-terminal text-base h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700`}
            onClick={() => inputRef.current?.focus()}
          >
            {commandHistory.map((entry, index) => (
              <div key={index} className="mb-1">
                <div className="flex items-start font-terminal">
                  <span className="text-green-400">groundskeeper@molehill</span>
                  <span className="text-gray-400 mx-1">::</span>
                  <span className="text-blue-400">{entry.command.startsWith('Hunt started!') ? '~' : gameState.tree?.player_location || '~'}</span>
                  <span className="text-gray-400 ml-1">$</span>
                  <span className={`ml-2 ${entry.command.startsWith('Hunt started!') ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {entry.command.startsWith('Hunt started!') ? '' : entry.command}
                  </span>
                </div>
                {entry.output && (
                  <div className={`${entry.success ? 'text-gray-300' : 'text-red-400'} ml-0 mt-1 font-terminal whitespace-pre-wrap`}>
                    {entry.output.split('\n').map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {/* Current input line */}
            <div className="flex items-start font-terminal">
              <span className="text-green-400">groundskeeper@molehill</span>
              <span className="text-gray-400 mx-1">::</span>
              <span className="text-blue-400">{gameState.tree?.player_location || '~'}</span>
              <span className="text-gray-400 ml-1">$</span>
              <div className="flex-1 ml-2">
                <div className="relative inline-block">
                  <span className="text-gray-300 font-terminal">{command}</span>
                  <span 
                    className="text-gray-300 font-terminal"
                    style={{ 
                      animation: 'blink 1s step-end infinite'
                    }}
                  >
                    _
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        executeCommand(command);
                      }
                    }}
                    disabled={executing || gameState.tree?.is_completed}
                    className="absolute inset-0 w-full bg-transparent text-transparent outline-none caret-transparent font-terminal"
                    placeholder=""
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hints Popup - Now positioned relative to terminal */}
      {showHints && hints.length > 0 && (
        <div className="absolute top-16 left-4 bg-yellow-900/95 backdrop-blur-sm border border-yellow-600 rounded-lg p-4 max-w-md z-40 shadow-2xl">
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

      {/* FHS Reference Modal */}
      {showFHS && (
        <div className="absolute top-16 left-4 bg-green-900/95 backdrop-blur-sm border border-green-600 rounded-lg p-6 max-w-2xl z-40 shadow-2xl">
          <button
            onClick={() => setShowFHS(false)}
            className="absolute top-3 right-3 text-green-400 hover:text-green-300"
          >
            ✕
          </button>
          <h3 className="text-green-400 font-bold mb-4 text-lg">Filesystem Hierarchy Standard (FHS)</h3>
          <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
            {fhsDirs.map((dir, index) => (
              <div key={index} className="flex items-start gap-3">
                <code className="text-green-300 font-terminal text-sm font-bold min-w-[80px]">{dir.path}</code>
                <span className="text-green-200 text-sm">{dir.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command Reference Modal */}
      {showCommands && commandRef && (
        <div className="absolute top-16 left-4 bg-red-900/95 backdrop-blur-sm border border-red-600 rounded-lg p-6 max-w-2xl max-h-[80vh] overflow-y-auto z-40 shadow-2xl">
          <button
            onClick={() => setShowCommands(false)}
            className="absolute top-3 right-3 text-red-400 hover:text-red-300"
          >
            ✕
          </button>
          <h3 className="text-red-400 font-bold mb-4 text-lg">Command Reference</h3>
          
          <div className="space-y-6">
            {/* Navigation Commands */}
            <div>
              <h4 className="text-red-300 font-semibold mb-3">Navigation Commands</h4>
              <div className="space-y-3">
                {commandRef.navigation.map((cmd, index) => (
                  <div key={index} className="border-l-2 border-red-700 pl-3">
                    <div className="flex items-start gap-3">
                      <code className="text-red-200 font-terminal text-sm">{cmd.command}</code>
                      <span className="text-red-100 text-sm">- {cmd.description}</span>
                    </div>
                    {cmd.examples && (
                      <div className="mt-1">
                        <span className="text-red-300 text-xs">Examples: </span>
                        <code className="text-red-200 text-xs">{cmd.examples.join(', ')}</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Exploration Commands */}
            <div>
              <h4 className="text-red-300 font-semibold mb-3">Exploration Commands</h4>
              <div className="space-y-3">
                {commandRef.exploration.map((cmd, index) => (
                  <div key={index} className="border-l-2 border-red-700 pl-3">
                    <div className="flex items-start gap-3">
                      <code className="text-red-200 font-terminal text-sm">{cmd.command}</code>
                      <span className="text-red-100 text-sm">- {cmd.description}</span>
                    </div>
                    {cmd.options && (
                      <div className="mt-1 ml-4">
                        {Object.entries(cmd.options).map(([opt, desc]) => (
                          <div key={opt} className="text-xs">
                            <code className="text-red-300">{opt}</code>
                            <span className="text-red-200 ml-2">{desc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Utility Commands */}
            <div>
              <h4 className="text-red-300 font-semibold mb-3">Utility Commands</h4>
              <div className="space-y-3">
                {commandRef.utility.map((cmd, index) => (
                  <div key={index} className="border-l-2 border-red-700 pl-3">
                    <div className="flex items-start gap-3">
                      <code className="text-red-200 font-terminal text-sm">{cmd.command}</code>
                      <span className="text-red-100 text-sm">- {cmd.description}</span>
                    </div>
                    {cmd.variables && (
                      <div className="mt-1 ml-4">
                        {Object.entries(cmd.variables).map(([variable, desc]) => (
                          <div key={variable} className="text-xs">
                            <code className="text-red-300">{variable}</code>
                            <span className="text-red-200 ml-2">{desc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Game Commands */}
            <div>
              <h4 className="text-red-300 font-semibold mb-3">Game Commands</h4>
              <div className="space-y-3">
                {commandRef.game.map((cmd, index) => (
                  <div key={index} className="border-l-2 border-red-700 pl-3">
                    <div className="flex items-start gap-3">
                      <code className="text-red-200 font-terminal text-sm">{cmd.command}</code>
                      <span className="text-red-100 text-sm">- {cmd.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Special Paths */}
            <div>
              <h4 className="text-red-300 font-semibold mb-3">Special Paths</h4>
              <div className="space-y-3">
                {commandRef.special_paths.map((path, index) => (
                  <div key={index} className="border-l-2 border-red-700 pl-3">
                    <div className="flex items-start gap-3">
                      <code className="text-red-200 font-terminal text-sm">{path.path}</code>
                      <span className="text-red-100 text-sm">- {path.description}</span>
                    </div>
                    <div className="mt-1">
                      <span className="text-red-300 text-xs">Examples: </span>
                      <code className="text-red-200 text-xs">{path.examples.join(', ')}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Game Bar - Updated with blue shade */}
      <div className={`absolute bottom-0 left-0 right-0 ${isDarkMode ? 'bg-slate-800/90' : 'bg-blue-50/90'} backdrop-blur-sm border-t ${isDarkMode ? 'border-slate-700' : 'border-blue-200'} p-3 z-20`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}><span className='font-terminal bg-gray-200 dark:bg-gray-500 text-red-900 dark:text-red-400 px-0.5 py-0 rounded'>bash</span> amole</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {gameState.tree.is_completed ? (
              <div className="text-green-600 dark:text-green-400 font-bold animate-pulse">
                You found a mole!
              </div>
            ) : (
              <div className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-blue-700'}`}>
                click adjacent nodes or use the terminal
              </div>
            )}
            <button
              onClick={startNewGame}
              className={`px-3 py-1.5 ${isDarkMode ? 'bg-slate-700 hover:bg-slate-600' : 'bg-blue-200 hover:bg-blue-300'} ${isDarkMode ? 'text-white' : 'text-blue-900'} text-sm rounded transition`}
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