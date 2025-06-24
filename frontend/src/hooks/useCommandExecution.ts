// src/hooks/useCommandExecution.ts
import { useState, useCallback } from 'react';
import { gameApi, CommandResponse, TreeNode, GameStats } from '@/lib/api';

interface CommandHistoryEntry {
  command: string;
  output: string;
  success: boolean;
}

export const useCommandExecution = (
  treeId: number | null,
  sessionId: number | null,
  onLocationChange: (newLocation: string) => void,
  onMoleKilled: (response: CommandResponse) => void,
  onTreeUpdate: (updater: (tree: TreeNode) => TreeNode) => void,
  onGameComplete?: (stats: GameStats) => void
) => {
  const [executing, setExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<CommandHistoryEntry[]>([]);

  const addToHistory = useCallback((entry: CommandHistoryEntry) => {
    setCommandHistory(prev => [...prev, entry]);
  }, []);

  const clearHistory = useCallback(() => {
    setCommandHistory([]);
  }, []);

  const executeCommand = useCallback(async (cmd: string) => {
    if (!treeId || !cmd.trim() || executing) return;

    setExecuting(true);
    try {
      const response = await gameApi.executeCommand(treeId, cmd, sessionId || undefined);
      
      // Build output with timer warnings
      let output = response.output;
      if (response.timer_warnings && response.timer_warnings.length > 0) {
        const warnings = response.timer_warnings.map(w => `⚠️ ${w.level}: ${w.message}`).join('\n');
        output = warnings + (output ? '\n' + output : '');
      }
      
      addToHistory({
        command: cmd,
        output,
        success: response.success,
      });

      // Update player location if it changed
      if (response.current_path) {
        onLocationChange(response.current_path);
      }

      // Handle mole killed
      if (response.mole_spawned) {
        onMoleKilled(response);
      }

      // Handle game completion
      if (response.game_completed && response.final_stats && onGameComplete) {
        onGameComplete(response.final_stats);
      }

      // Handle mole location updates in tree
      if (response.new_mole_location) {
        onTreeUpdate((tree) => {
          const updateMoleInTree = (node: TreeNode, molePath: string): TreeNode => {
            return {
              ...node,
              has_mole: node.path === molePath,
              children: node.children.map(child => updateMoleInTree(child, molePath))
            };
          };
          return updateMoleInTree(tree, response.new_mole_location!);
        });
      }
    } catch (error) {
      console.error('Command execution failed:', error);
      addToHistory({
        command: cmd,
        output: 'Error: Failed to execute command',
        success: false,
      });
    } finally {
      setExecuting(false);
    }
  }, [treeId, sessionId, executing, onLocationChange, onMoleKilled, onTreeUpdate, onGameComplete, addToHistory]);

  return {
    executing,
    commandHistory,
    executeCommand,
    addToHistory,
    clearHistory,
  };
};