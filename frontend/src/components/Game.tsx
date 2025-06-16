"use client";

import React, { useEffect, useCallback } from 'react';
import TreeVisualizer from './TreeVisualizer';
import Terminal from './Terminal';
import HelpModals from './HelpModals';
import GameStatus from './GameStatus';
import { gameApi, CommandResponse } from '@/lib/api';

// Import our custom hooks
import { useGameState } from '@/hooks/useGameState';
import { useCommandExecution } from '@/hooks/useCommandExecution';
import { useTerminal } from '@/hooks/useTerminal';
import { useHelpModals } from '@/hooks/useHelpModals';
import { useTreeUtils } from '@/hooks/useTreeUtils';

const Game: React.FC = () => {
  // Canvas background color - always dark mode
  const canvasBackground = 'bg-gray-900';
  const isDarkMode = true;

  // Use our custom hooks
  const {
    gameState,
    gameStats,
    hasPlayedIntro,
    startNewGame,
    updatePlayerLocation,
    updateTreeData,
    setMoleDirection,
    setMoleKilled,
    updateScore,
    setHasPlayedIntro,
  } = useGameState();

  const {
    command,
    setCommand,
    clearCommand,
    terminalMinimized,
    setTerminalMinimized,
  } = useTerminal();

  const helpModals = useHelpModals(gameState.tree?.id || null);

  const { updateTreeDataToShowMole, removeMoleFromTree } = useTreeUtils();

  // Handle mole kill animation and updates
  const handleMoleKilled = useCallback((response: CommandResponse) => {
    if (!gameState.tree) return;

    // First, show the killed mole briefly
    updateTreeData((tree) => 
      updateTreeDataToShowMole(tree, gameState.tree!.player_location)
    );
    
    // Trigger falling animation
    setMoleKilled(true);
    
    // After animation, update tree with new mole location
    setTimeout(() => {
      setMoleKilled(false);
      
      // Update tree to show new mole location
      if (response.new_mole_location) {
        updateTreeData((tree) => {
          const cleanTree = removeMoleFromTree(tree);
          return updateTreeDataToShowMole(cleanTree, response.new_mole_location!);
        });
      }
      
      // Set new mole direction
      if (response.mole_direction) {
        setMoleDirection(response.mole_direction);
      }
    }, 1500); // Wait for falling animation
    
    // Update score and moles killed
    if (response.score !== undefined && response.moles_killed !== undefined) {
      updateScore(response.score, response.moles_killed);
    }
  }, [gameState.tree, updateTreeData, setMoleKilled, setMoleDirection, updateScore, updateTreeDataToShowMole, removeMoleFromTree]);

  const {
    executing,
    commandHistory,
    executeCommand: executeCommandBase,
    addToHistory,
    clearHistory,
  } = useCommandExecution(
    gameState.tree?.id || null,
    gameState.sessionId,
    updatePlayerLocation,
    handleMoleKilled,
    updateTreeData
  );

  // Wrap executeCommand to clear the command input
  const executeCommand = useCallback(async (cmd: string) => {
    await executeCommandBase(cmd);
    clearCommand();
  }, [executeCommandBase, clearCommand]);

  // Initialize game with welcome message
  const initializeGame = useCallback(async () => {
    const response = await startNewGame();
    if (!response) return;

    // Clear history for new game
    clearHistory();

    // Create a dynamic starting message
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
    
    addToHistory({
      command: 'Hunt started!',
      output: `${response.mole_hint}\n${locationContext}Your home directory is ${homeDir}.\nUse 'pwd' to see where you are, 'cd ~' to go home.${timerInfo}\nType "help" for available commands.`,
      success: true,
    });
  }, [startNewGame, addToHistory, clearHistory]);

  // Handle timer expiration
  const handleTimerExpire = useCallback(async () => {
    if (!gameState.tree) return;

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
        addToHistory({
          command: 'Mole escaped!',
          output: escapeMessage,
          success: false,
        });
        
        // Update mole direction if provided
        if (response.escape_data?.new_location) {
          // Update tree to show new mole location
          updateTreeData((tree) => {
            const cleanTree = removeMoleFromTree(tree);
            return updateTreeDataToShowMole(cleanTree, response.escape_data!.new_location);
          });
          
          // Show mole direction indicator if provided
          if (response.escape_data?.mole_direction) {
            setMoleDirection(response.escape_data.mole_direction);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check timer:', error);
    }
  }, [gameState.tree, gameState.sessionId, addToHistory, updateTreeData, setMoleDirection, removeMoleFromTree, updateTreeDataToShowMole]);

  // Handle node click in visualizer
  const handleNodeClick = useCallback((path: string) => {
    executeCommand(`cd ${path}`);
  }, [executeCommand]);

  // Start game on mount
  useEffect(() => {
    initializeGame();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark intro as played after delay
  useEffect(() => {
    if (gameState.tree && !hasPlayedIntro) {
      const timer = setTimeout(() => {
        setHasPlayedIntro(true);
      }, 10000); // Add a buffer to ensure animation completes
      return () => clearTimeout(timer);
    }
  }, [gameState.tree, hasPlayedIntro, setHasPlayedIntro]);

  // Loading state
  if (gameState.loading) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${canvasBackground} text-white`}>
        <div className="text-center">
          <div className="text-2xl mb-4">Loading Bashamole...</div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-current mx-auto"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (gameState.error) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${canvasBackground} text-white`}>
        <div className="text-center">
          <div className="text-red-400 mb-4">{gameState.error}</div>
          <button
            onClick={initializeGame}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Initial state
  if (!gameState.tree) {
    return (
      <div className={`flex items-center justify-center min-h-screen ${canvasBackground} text-white`}>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Bashamole</h1>
          <p className="text-gray-400 mb-8">Hunt the mole in the Unix filesystem!</p>
          <button
            onClick={initializeGame}
            className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xl transition transform hover:scale-105"
          >
            Start New Game
          </button>
        </div>
      </div>
    );
  }

  // Main game UI
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
          moleKilled={gameStats.moleKilled}
        />
      </div>

      {/* Game Status (Timer, Score, Direction Indicator) */}
      <GameStatus
        gameTreeId={gameState.tree.id}
        sessionId={gameState.sessionId}
        onTimerExpire={handleTimerExpire}
        score={gameStats.score}
        molesKilled={gameStats.molesKilled}
        moleDirection={gameStats.moleDirection}
      />

      {/* Terminal */}
      <Terminal
        commandHistory={commandHistory}
        command={command}
        setCommand={setCommand}
        executeCommand={executeCommand}
        executing={executing}
        currentPath={gameState.tree.player_location}
        terminalMinimized={terminalMinimized}
        setTerminalMinimized={setTerminalMinimized}
        onGetCommandReference={helpModals.getCommandReference}
        onGetHints={helpModals.getHints}
        onGetFHSReference={helpModals.getFHSReference}
      />

      {/* Help Modals */}
      <HelpModals {...helpModals} />

      {/* Bottom Game Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-sm border-t border-slate-700 p-3 z-20">
        <div className="max-w-7xl mx-auto flex justify-between items-center px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">
              <span className='font-terminal bg-gray-500 text-red-400 px-0.5 py-0 rounded'>bash</span>
              amole
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">
              click adjacent nodes or use the terminal
            </div>
            <button
              onClick={initializeGame}
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