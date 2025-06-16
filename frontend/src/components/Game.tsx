"use client";

import React, { useState, useEffect } from 'react';
import TreeVisualizer from './TreeVisualizer';
import Terminal from './Terminal';
import HelpModals from './HelpModals';
import GameStatus from './GameStatus';
import { gameApi, FileSystemTree, FHSDirectory, CommandReferenceResponse, MoleDirection, TreeNode } from '@/lib/api';

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
  const [isDarkMode] = useState(true); // Always dark mode, but keep as state to avoid re-renders
  const [moleKilled, setMoleKilled] = useState(false);
  const [moleDirection, setMoleDirection] = useState<MoleDirection | null>(null);
  const [score, setScore] = useState(0);
  const [molesKilled, setMolesKilled] = useState(0);

  // Canvas background color - always dark mode
  const canvasBackground = 'bg-gray-900';

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
      
      // Reset game state
      setScore(0);
      setMolesKilled(0);
      setMoleDirection(null);
      
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
      
      // Add timer info to starting message
      let timerInfo = '';
      if (response.initial_timer && response.timer_reason) {
        timerInfo = `\nTimer: ${response.initial_timer}s (mole is ${response.timer_reason})`;
      }
      
      setCommandHistory([{
        command: 'Hunt started!',
        output: `${response.mole_hint}\n${locationContext}Your home directory is ${homeDir}.\nUse 'pwd' to see where you are, 'cd ~' to go home.${timerInfo}\nType "help" for available commands.`,
        success: true,
      }]);
      setHints([]);
      setShowHints(false);
      setTerminalMinimized(true); // Keep terminal minimized on new game
      setHasPlayedIntro(false); // Reset intro for new game
      setMoleKilled(false); // Reset mole killed state
    } catch {
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
    } catch {
      console.error('Failed to get hints');
    }
  };

  // Get FHS reference
  const getFHSReference = async () => {
    try {
      const response = await gameApi.getFHSReference();
      setFhsDirs(response.directories);
      setShowFHS(true);
    } catch {
      console.error('Failed to get FHS reference');
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
    } catch {
      console.error('Failed to get command reference');
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

      // Build output with timer warnings
      let fullOutput = response.output;
      
      // Add timer warnings if present
      if (response.timer_warnings && response.timer_warnings.length > 0) {
        const warnings = response.timer_warnings.map(w => 
          `⚠️ ${w.level}: ${w.message}`
        ).join('\n');
        fullOutput = warnings + (fullOutput ? '\n' + fullOutput : '');
      }

      // Update command history
      setCommandHistory(prev => [...prev, {
        command: cmd,
        output: fullOutput,
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

      // Check if a new mole was spawned
      if (response.mole_spawned) {
        // First, show the killed mole briefly
        setGameState(prev => ({
          ...prev,
          tree: prev.tree ? {
            ...prev.tree,
            tree_data: updateTreeDataToShowMole(prev.tree!.tree_data, prev.tree!.player_location),
          } : null,
        }));
        
        // Trigger falling animation
        setMoleKilled(true);
        
        // After animation, update tree with new mole location
        setTimeout(() => {
          setMoleKilled(false);
          
          // Update tree to show new mole location
          if (response.new_mole_location && gameState.tree) {
            const treeWithNewMole = updateTreeDataToShowMole(
              removeMoleFromTree(gameState.tree.tree_data),
              response.new_mole_location
            );
            
            setGameState(prev => ({
              ...prev,
              tree: prev.tree ? {
                ...prev.tree,
                tree_data: treeWithNewMole,
              } : null,
            }));
          }
          
          // Set new mole direction
          if (response.mole_direction) {
            setMoleDirection(response.mole_direction);
            // Hide direction indicator after 5 seconds
            setTimeout(() => {
              setMoleDirection(null);
            }, 5000);
          }
        }, 1500); // Wait for falling animation
        
        // Update score and moles killed
        if (response.score !== undefined) setScore(response.score);
        if (response.moles_killed !== undefined) setMolesKilled(response.moles_killed);
        
        // Format the output to include timer info on new line
        if (response.timer_reason && !response.output.includes('New mole detected')) {
          response.output += `\nNew mole detected ${response.timer_reason}!`;
        }
      }

      // Legacy: Check if game won (for old backend compatibility)
      if (response.game_won && !response.mole_spawned) {
        setGameState(prev => ({
          ...prev,
          tree: prev.tree ? {
            ...prev.tree,
            is_completed: true,
            tree_data: updateTreeDataToShowMole(prev.tree!.tree_data, prev.tree!.player_location),
          } : null,
        }));
        
        setTimeout(() => {
          setMoleKilled(true);
        }, 200);
      }

      setCommand('');
    } catch {
      setCommandHistory(prev => [...prev, {
        command: cmd,
        output: 'Error: Failed to execute command. Check your connection.',
        success: false,
      }]);
    } finally {
      setExecuting(false);
    }
  };

  // Update tree data to show mole when found
  const updateTreeDataToShowMole = (treeData: TreeNode, molePath: string): TreeNode => {
    if (treeData.path === molePath) {
      return { ...treeData, has_mole: true };
    }
    if (treeData.children) {
      return {
        ...treeData,
        children: treeData.children.map((child) => 
          updateTreeDataToShowMole(child, molePath)
        ),
      };
    }
    return treeData;
  };

  // Remove mole from tree data
  const removeMoleFromTree = (treeData: TreeNode): TreeNode => {
    return {
      ...treeData,
      has_mole: false,
      children: treeData.children ? treeData.children.map((child) => removeMoleFromTree(child)) : []
    };
  };

  // Handle node click in visualizer
  const handleNodeClick = (path: string) => {
    executeCommand(`cd ${path}`);
  };

  // Handle timer expiration
  const handleTimerExpire = async () => {
    if (gameState.tree) {
      try {
        const response = await gameApi.checkTimer(gameState.tree.id, gameState.sessionId || undefined);
        if (response.mole_escaped) {
          // Build the escape message
          let escapeMessage = response.message || 'The mole escaped!';
          
          // Add distance info for new mole if available
          if (response.escape_data?.timer_reason) {
            escapeMessage += `\nNew mole detected ${response.escape_data.timer_reason}!`;
          }
          
          // Update command history with escape message
          setCommandHistory(prev => [...prev, {
            command: 'Mole escaped!',
            output: escapeMessage,
            success: false,
          }]);
          
          // Update mole direction if provided
          if (response.escape_data?.new_location) {
            // Update tree to show new mole location
            const treeWithNewMole = updateTreeDataToShowMole(
              removeMoleFromTree(gameState.tree.tree_data),
              response.escape_data.new_location
            );
            
            setGameState(prev => ({
              ...prev,
              tree: prev.tree ? {
                ...prev.tree,
                tree_data: treeWithNewMole,
              } : null,
            }));
            
            // Show mole direction indicator if provided
            if (response.escape_data?.mole_direction) {
              setMoleDirection(response.escape_data.mole_direction);
              // Hide direction indicator after 5 seconds
              setTimeout(() => {
                setMoleDirection(null);
              }, 5000);
            }
          }
        }
      } catch (error) {
        console.error('Failed to check timer:', error);
      }
    }
  };

  // Start game on mount
  useEffect(() => {
    startNewGame();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark intro as played after first render
  useEffect(() => {
    if (gameState.tree && !hasPlayedIntro) {
      const timer = setTimeout(() => {
        setHasPlayedIntro(true);
      }, 10000); // Add a buffer to ensure animation completes (9.3s + buffer)
      return () => clearTimeout(timer);
    }
  }, [gameState.tree, hasPlayedIntro]);

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

      {/* Game Status (Timer, Score, Direction Indicator) */}
      <GameStatus
        gameTreeId={gameState.tree?.id || null}
        sessionId={gameState.sessionId}
        onTimerExpire={handleTimerExpire}
        score={score}
        molesKilled={molesKilled}
        moleDirection={moleDirection}
      />

      {/* Terminal */}
      <Terminal
        commandHistory={commandHistory}
        command={command}
        setCommand={setCommand}
        executeCommand={executeCommand}
        executing={executing}
        currentPath={gameState.tree?.player_location || '~'}
        terminalMinimized={terminalMinimized}
        setTerminalMinimized={setTerminalMinimized}
        onGetCommandReference={getCommandReference}
        onGetHints={getHints}
        onGetFHSReference={getFHSReference}
      />

      {/* Help Modals */}
      <HelpModals
        showHints={showHints}
        setShowHints={setShowHints}
        hints={hints}
        showFHS={showFHS}
        setShowFHS={setShowFHS}
        fhsDirs={fhsDirs}
        showCommands={showCommands}
        setShowCommands={setShowCommands}
        commandRef={commandRef}
      />

      {/* Bottom Game Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm border-t border-slate-700 p-3 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white"><span className='font-terminal bg-gray-200 dark:bg-gray-500 text-red-900 dark:text-red-400 px-0.5 py-0 rounded'>bash</span> amole</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">
              click adjacent nodes or use the terminal
            </div>
            <button
              onClick={startNewGame}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition"
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