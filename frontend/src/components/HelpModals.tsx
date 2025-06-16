import React from 'react';
import { FHSDirectory, CommandReferenceResponse } from '@/lib/api';

interface HelpModalsProps {
  // Hints Modal
  showHints: boolean;
  setShowHints: (val: boolean) => void;
  hints: string[];
  
  // FHS Modal
  showFHS: boolean;
  setShowFHS: (val: boolean) => void;
  fhsDirs: FHSDirectory[];
  
  // Commands Modal
  showCommands: boolean;
  setShowCommands: (val: boolean) => void;
  commandRef: CommandReferenceResponse | null;
}

const HelpModals: React.FC<HelpModalsProps> = ({
  showHints,
  setShowHints,
  hints,
  showFHS,
  setShowFHS,
  fhsDirs,
  showCommands,
  setShowCommands,
  commandRef,
}) => {
  return (
    <>
      {/* Hints Popup */}
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
    </>
  );
};

export default HelpModals;