import React, { useState, useEffect } from 'react';
import { GameStats, LeaderboardEntry, gameApi } from '@/lib/api';

interface GameOverModalProps {
  isOpen: boolean;
  gameStats: GameStats | null;
  sessionId: number | null;
  onClose: () => void;
  onNewGame: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  gameStats,
  sessionId,
  onClose,
  onNewGame,
}) => {
  const [playerName, setPlayerName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardPosition, setLeaderboardPosition] = useState<number | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && !submitted) {
      // Load leaderboard when modal opens
      loadLeaderboard();
    }
  }, [isOpen, submitted]);

  const loadLeaderboard = async () => {
    try {
      const response = await gameApi.getLeaderboard();
      setLeaderboard(response.leaderboard);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!sessionId || submitted) return;

    setLoading(true);
    try {
      const response = await gameApi.savePlayerName(
        sessionId,
        playerName.trim() || 'Anonymous'
      );
      setLeaderboardPosition(response.leaderboard_position);
      setSubmitted(true);
      await loadLeaderboard();
      setShowLeaderboard(true);
    } catch (error) {
      console.error('Failed to save score:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !gameStats) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-green-500 rounded-lg p-8 max-w-2xl w-full mx-4 shadow-2xl">
        {/* Header */}
        <h2 className="text-3xl font-bold text-green-400 mb-6 text-center font-terminal">
          GAME OVER
        </h2>

        {/* Score Display */}
        {!showLeaderboard && (
          <>
            <div className="bg-black/50 border border-green-500/50 rounded-lg p-6 mb-6">
              <div className="grid grid-cols-2 gap-4 text-green-300 font-terminal">
                <div>
                  <span className="text-gray-500">Final Score:</span>
                  <div className="text-2xl font-bold text-green-400">{gameStats.score}</div>
                </div>
                <div>
                  <span className="text-gray-500">Moles Killed:</span>
                  <div className="text-2xl font-bold">{gameStats.moles_killed}</div>
                </div>
                <div>
                  <span className="text-gray-500">Moles Escaped:</span>
                  <div className="text-xl text-red-400">{gameStats.moles_escaped}</div>
                </div>
                <div>
                  <span className="text-gray-500">Commands Used:</span>
                  <div className="text-xl">{gameStats.commands_used}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">Time Played:</span>
                  <div className="text-xl">{gameStats.time_taken}</div>
                </div>
              </div>
            </div>

            {/* Name Input */}
            {!submitted ? (
              <div className="mb-6">
                <label className="block text-green-400 mb-2 font-terminal">
                  Enter your name for the leaderboard:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Anonymous"
                    maxLength={20}
                    className="flex-1 bg-black border border-green-500 text-green-300 px-4 py-2 rounded font-terminal focus:outline-none focus:border-green-400"
                    autoFocus
                    disabled={loading}
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-terminal transition disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Submit'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center mb-6">
                <p className="text-green-400 font-terminal text-lg">
                  Score saved! You ranked #{leaderboardPosition}
                </p>
                <button
                  onClick={() => setShowLeaderboard(true)}
                  className="mt-2 text-green-300 hover:text-green-200 underline font-terminal"
                >
                  View Leaderboard
                </button>
              </div>
            )}
          </>
        )}

        {/* Leaderboard */}
        {showLeaderboard && (
          <div className="bg-black/50 border border-green-500/50 rounded-lg p-4 mb-6 max-h-96 overflow-y-auto">
            <h3 className="text-xl font-bold text-green-400 mb-4 font-terminal">Top Scores</h3>
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={`${entry.player_name}-${entry.completed_at}`}
                  className={`flex justify-between items-center p-2 rounded ${
                    entry.score === gameStats.score && submitted
                      ? 'bg-green-900/50 border border-green-500'
                      : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-4 font-terminal">
                    <span className="text-green-500 font-bold w-8">#{entry.rank}</span>
                    <span className="text-green-300">{entry.player_name}</span>
                  </div>
                  <div className="flex items-center gap-6 text-sm font-terminal">
                    <span className="text-green-400">{entry.score} pts</span>
                    <span className="text-gray-500">{entry.moles_killed} moles</span>
                    <span className="text-gray-600">{entry.commands_used} cmds</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={onNewGame}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-terminal transition transform hover:scale-105"
          >
            New Game
          </button>
          {!showLeaderboard && submitted && (
            <button
              onClick={() => setShowLeaderboard(true)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-terminal transition"
            >
              View Leaderboard
            </button>
          )}
          {showLeaderboard && (
            <button
              onClick={() => setShowLeaderboard(false)}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-terminal transition"
            >
              Back to Score
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameOverModal;