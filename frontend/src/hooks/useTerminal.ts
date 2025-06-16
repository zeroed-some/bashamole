import { useState, useCallback } from 'react';

export const useTerminal = () => {
  const [command, setCommand] = useState('');
  const [terminalMinimized, setTerminalMinimized] = useState(true);

  const clearCommand = useCallback(() => {
    setCommand('');
  }, []);

  const toggleTerminal = useCallback(() => {
    setTerminalMinimized(prev => !prev);
  }, []);

  return {
    command,
    setCommand,
    clearCommand,
    terminalMinimized,
    setTerminalMinimized,
    toggleTerminal,
  };
};