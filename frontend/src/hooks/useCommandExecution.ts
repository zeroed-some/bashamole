import { useState, useCallback } from 'react';
import { gameApi, CommandResponse, TreeNode } from '@/lib/api';

interface CommandExecutionState {
  executing: boolean;
  commandHistory: CommandHistoryEntry[];
}

interface CommandHistoryEntry {
  command: string;
  output: string;
  success: boolean;
}

export const useCommandExecution = (
  gameTreeId: number | null,
  sessionId: number | null,
  onLocationChange?: (newPath: string) => void,
  onMoleKilled?: (response: CommandResponse) => void,
  onTreeUpdate?: (updater: (tree: TreeNode) => TreeNode) => void
) => {
  const [state, setState] = useState<CommandExecutionState>({
    executing: false,
    commandHistory: [],
  });

  const addToHistory = useCallback((entry: CommandHistoryEntry) => {
    setState(prev => ({
      ...prev,
      commandHistory: [...prev.commandHistory, entry],
    }));
  }, []);

  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      commandHistory: [],
    }));
  }, []);

  const executeCommand = useCallback(async (cmd: string) => {
    if (!gameTreeId || !cmd.trim() || state.executing) return;

    setState(prev => ({ ...prev, executing: true }));
    
    try {
      const response = await gameApi.executeCommand(
        gameTreeId,
        cmd,
        sessionId || undefined
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

      // Add to command history
      addToHistory({
        command: cmd,
        output: fullOutput,
        success: response.success,
      });

      // Handle location change
      if (response.current_path && onLocationChange) {
        onLocationChange(response.current_path);
      }

      // Handle mole spawning
      if (response.mole_spawned && onMoleKilled) {
        // Format the output to include timer info on new line
        if (response.timer_reason && !response.output.includes('New mole detected')) {
          response.output += `\nNew mole detected ${response.timer_reason}!`;
        }
        onMoleKilled(response);
      }

      // Legacy: Handle game won
      if (response.game_won && !response.mole_spawned && onTreeUpdate) {
        onTreeUpdate((tree) => ({
          ...tree,
          has_mole: true,
        }));
      }

      return response;
    } catch {
      addToHistory({
        command: cmd,
        output: 'Error: Failed to execute command. Check your connection.',
        success: false,
      });
      return null;
    } finally {
      setState(prev => ({ ...prev, executing: false }));
    }
  }, [gameTreeId, sessionId, state.executing, addToHistory, onLocationChange, onMoleKilled, onTreeUpdate]);

  return {
    executing: state.executing,
    commandHistory: state.commandHistory,
    executeCommand,
    addToHistory,
    clearHistory,
  };
};