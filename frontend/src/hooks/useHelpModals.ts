import { useState, useCallback } from 'react';
import { gameApi, FHSDirectory, CommandReferenceResponse } from '@/lib/api';

export const useHelpModals = (gameTreeId: number | null) => {
  const [showHints, setShowHints] = useState(false);
  const [hints, setHints] = useState<string[]>([]);
  
  const [showFHS, setShowFHS] = useState(false);
  const [fhsDirs, setFhsDirs] = useState<FHSDirectory[]>([]);
  
  const [showCommands, setShowCommands] = useState(false);
  const [commandRef, setCommandRef] = useState<CommandReferenceResponse | null>(null);

  const getHints = useCallback(async () => {
    if (!gameTreeId) return;
    
    try {
      const response = await gameApi.getHint(gameTreeId);
      setHints(response.hints);
      setShowHints(true);
    } catch (error) {
      console.error('Failed to get hints:', error);
    }
  }, [gameTreeId]);

  const getFHSReference = useCallback(async () => {
    try {
      const response = await gameApi.getFHSReference();
      setFhsDirs(response.directories);
      setShowFHS(true);
    } catch (error) {
      console.error('Failed to get FHS reference:', error);
    }
  }, []);

  const getCommandReference = useCallback(async () => {
    try {
      if (!commandRef) {
        const response = await gameApi.getCommandReference();
        setCommandRef(response);
      }
      setShowCommands(true);
    } catch (error) {
      console.error('Failed to get command reference:', error);
    }
  }, [commandRef]);

  return {
    // Hints
    showHints,
    setShowHints,
    hints,
    getHints,
    
    // FHS
    showFHS,
    setShowFHS,
    fhsDirs,
    getFHSReference,
    
    // Commands
    showCommands,
    setShowCommands,
    commandRef,
    getCommandReference,
  };
};