import { useState, useCallback } from 'react';
import { gameApi, FileSystemTree, TreeNode, MoleDirection } from '@/lib/api';

interface GameState {
  tree: FileSystemTree | null;
  sessionId: number | null;
  loading: boolean;
  error: string | null;
}

interface GameStats {
  score: number;
  molesKilled: number;
  moleDirection: MoleDirection | null;
  moleKilled: boolean;
}

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState>({
    tree: null,
    sessionId: null,
    loading: false,
    error: null,
  });

  const [gameStats, setGameStats] = useState<GameStats>({
    score: 0,
    molesKilled: 0,
    moleDirection: null,
    moleKilled: false,
  });

  const [hasPlayedIntro, setHasPlayedIntro] = useState(false);

  const updatePlayerLocation = useCallback((newPath: string) => {
    setGameState(prev => ({
      ...prev,
      tree: prev.tree ? {
        ...prev.tree,
        player_location: newPath,
      } : null,
    }));
  }, []);

  const updateTreeData = useCallback((updater: (tree: TreeNode) => TreeNode) => {
    setGameState(prev => ({
      ...prev,
      tree: prev.tree ? {
        ...prev.tree,
        tree_data: updater(prev.tree.tree_data),
      } : null,
    }));
  }, []);

  const setMoleDirection = useCallback((direction: MoleDirection | null) => {
    setGameStats(prev => ({ ...prev, moleDirection: direction }));
    
    // Auto-hide after 5 seconds
    if (direction) {
      setTimeout(() => {
        setGameStats(prev => ({ ...prev, moleDirection: null }));
      }, 5000);
    }
  }, []);

  const setMoleKilled = useCallback((killed: boolean) => {
    setGameStats(prev => ({ ...prev, moleKilled: killed }));
  }, []);

  const updateScore = useCallback((score: number, molesKilled: number) => {
    setGameStats(prev => ({
      ...prev,
      score,
      molesKilled,
    }));
  }, []);

  const startNewGame = useCallback(async () => {
    try {
      setGameState(prev => ({ ...prev, loading: true, error: null }));
      const response = await gameApi.createGame('Player1');
      
      setGameState({
        tree: response.tree,
        sessionId: response.session_id,
        loading: false,
        error: null,
      });
      
      // Reset game stats
      setGameStats({
        score: 0,
        molesKilled: 0,
        moleDirection: null,
        moleKilled: false,
      });
      
      setHasPlayedIntro(false);
      
      return response;
    } catch (error) {
      setGameState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to start game. Is the backend running on http://localhost:8000?',
      }));
      return null;
    }
  }, []);

  return {
    // State
    gameState,
    gameStats,
    hasPlayedIntro,
    
    // Actions
    startNewGame,
    updatePlayerLocation,
    updateTreeData,
    setMoleDirection,
    setMoleKilled,
    updateScore,
    setHasPlayedIntro,
  };
};