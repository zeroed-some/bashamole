import React, { useRef, useEffect } from 'react';

interface CommandHistoryEntry {
  command: string;
  output: string;
  success: boolean;
}

interface TerminalProps {
  commandHistory: CommandHistoryEntry[];
  command: string;
  setCommand: (cmd: string) => void;
  executeCommand: (cmd: string) => void;
  executing: boolean;
  currentPath: string;
  terminalMinimized: boolean;
  setTerminalMinimized: (val: boolean) => void;
  onGetCommandReference: () => void;
  onGetHints: () => void;
  onGetFHSReference: () => void;
}

const Terminal: React.FC<TerminalProps> = ({
  commandHistory,
  command,
  setCommand,
  executeCommand,
  executing,
  currentPath,
  terminalMinimized,
  setTerminalMinimized,
  onGetCommandReference,
  onGetHints,
  onGetFHSReference,
}) => {
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

  // Terminal color scheme - always dark mode
  const terminalColors = {
    frame: 'bg-stone-200 border-stone-300',
    header: 'bg-stone-300 border-stone-400',
    headerText: 'text-stone-900',
    content: 'bg-black',
    closeButton: 'text-stone-700 hover:text-stone-900'
  };

  return (
    <div className={`absolute top-4 left-4 ${terminalColors.frame} rounded-lg shadow-2xl border transition-all duration-300 z-30 ${
      terminalMinimized ? 'w-80' : 'w-[700px]'
    }`}>
      {/* Terminal Header */}
      <div className={`flex items-center justify-between ${terminalColors.header} px-4 py-2 rounded-t-lg border-b`}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <button
              onClick={onGetCommandReference}
              className="w-3.5 h-3.5 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition-colors relative"
              title="Command Reference"
            >
              <span className="text-[8px] font-bold text-gray-900 absolute">×</span>
            </button>
            <button
              onClick={onGetHints}
              className="w-3.5 h-3.5 bg-yellow-500 hover:bg-yellow-400 rounded-full flex items-center justify-center transition-colors relative"
              title="Get Hint"
            >
              <span className="text-[9px] font-bold text-gray-900 absolute">?</span>
            </button>
            <button
              onClick={onGetFHSReference}
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
                <span className="text-blue-400">{entry.command.startsWith('Hunt started!') ? '~' : currentPath}</span>
                <span className="text-gray-400 ml-1">$</span>
                <span className={`ml-2 ${entry.command.startsWith('Hunt started!') ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {entry.command.startsWith('Hunt started!') ? '' : entry.command}
                </span>
              </div>
              {entry.output && (
                <div className={`${entry.success ? 'text-gray-300' : 'text-red-400'} ml-0 mt-1 font-terminal whitespace-pre-wrap`}>
                  {entry.output.split('\n').map((line, i) => {
                    // Special coloring for mole detection messages
                    let lineClass = '';
                    if (line.includes('New mole detected')) {
                      lineClass = 'text-yellow-400';
                    } else if (line.includes('⚠️')) {
                      // Timer warnings
                      if (line.includes('CRITICAL')) {
                        lineClass = 'text-red-500';
                      } else if (line.includes('ALERT')) {
                        lineClass = 'text-orange-400';
                      } else if (line.includes('WARNING')) {
                        lineClass = 'text-yellow-400';
                      }
                    }
                    
                    return (
                      <div key={i} className={lineClass || ''}>
                        {line}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          
          {/* Current input line */}
          <div className="flex items-start font-terminal">
            <span className="text-green-400">groundskeeper@molehill</span>
            <span className="text-gray-400 mx-1">::</span>
            <span className="text-blue-400">{currentPath}</span>
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
                  disabled={executing}
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
  );
};

export default Terminal;