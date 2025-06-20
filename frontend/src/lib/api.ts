// src/lib/api.ts
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface TreeNode {
  name: string;
  path: string;
  is_fhs: boolean;
  description: string;
  has_mole: boolean;
  children: TreeNode[];
}

export interface FileSystemTree {
  id: number;
  name: string;
  created_at: string;
  seed: number;
  player_location: string;
  is_completed: boolean;
  completed_at: string | null;
  tree_data: TreeNode;
  total_directories: number;
  moles_killed?: number;
  total_commands?: number;
  total_directories_visited?: number;
}

export interface MoleDirection {
  direction: string;
  angle: number;
}

export interface CommandResponse {
  command: string;
  success: boolean;
  output: string;
  current_path: string;
  game_won?: boolean;
  mole_spawned?: boolean;
  mole_direction?: MoleDirection | null;
  score?: number;
  moles_killed?: number;
  new_mole_location?: string;
}

export interface GameCreationResponse {
  tree: FileSystemTree;
  session_id: number;
  mole_hint: string;
  home_directory: string;
}

export interface HintResponse {
  hints: string[];
}

export interface FHSDirectory {
  path: string;
  name: string;
  desc: string;
}

export interface FHSReferenceResponse {
  directories: FHSDirectory[];
}

export interface CommandCategory {
  command: string;
  description: string;
  examples: string[];
  options?: Record<string, string>;
  variables?: Record<string, string>;
}

export interface SpecialPath {
  path: string;
  description: string;
  examples: string[];
}

export interface CommandReferenceResponse {
  navigation: CommandCategory[];
  exploration: CommandCategory[];
  utility: CommandCategory[];
  game: CommandCategory[];
  special_paths: SpecialPath[];
}

export interface TimerWarning {
  level: string;
  message: string;
}

export interface CommandResponse {
  command: string;
  success: boolean;
  output: string;
  current_path: string;
  game_won?: boolean;
  mole_spawned?: boolean;
  mole_direction?: MoleDirection | null;
  score?: number;
  moles_killed?: number;
  new_mole_location?: string;
  timer_remaining?: number;
  timer_warnings?: TimerWarning[];
  new_timer?: number;
  timer_reason?: string;
  timer_distance?: number;
}

export interface TimerStatusResponse {
  remaining: number;
  total: number;
  percentage: number;
  warning_level: string | null;
  expired: boolean;
  paused: boolean;
}

export interface EscapeData {
  escaped: boolean;
  old_location: string;
  new_location: string;
  total_escapes: number;
  new_timer: number;
  timer_reason: string;
  distance: number;
  mole_direction?: MoleDirection | null;
}

export interface CheckTimerResponse {
  timer_remaining: number;
  timer_expired: boolean;
  mole_location: string;
  timer_paused: boolean;
  mole_escaped?: boolean;
  escape_data?: EscapeData;
  message?: string;
}

export interface GameCreationResponse {
  tree: FileSystemTree;
  session_id: number;
  mole_hint: string;
  home_directory: string;
  initial_timer?: number;
  timer_reason?: string;
  timer_distance?: number;
}

export const gameApi = {
  createGame: async (playerName: string = 'Anonymous'): Promise<GameCreationResponse> => {
    const response = await api.post('/trees/filesystem-trees/create_game/', {
      player_name: playerName,
      max_depth: 4,
      dirs_per_level: 3,
    });
    return response.data;
  },

  executeCommand: async (
    treeId: number,
    command: string,
    sessionId?: number
  ): Promise<CommandResponse> => {
    const response = await api.post(`/trees/filesystem-trees/${treeId}/execute_command/`, {
      command,
      session_id: sessionId,
    });
    return response.data;
  },

  getHint: async (treeId: number): Promise<HintResponse> => {
    const response = await api.get(`/trees/filesystem-trees/${treeId}/hint/`);
    return response.data;
  },

  getCurrentDirectory: async (treeId: number) => {
    const response = await api.get(`/trees/filesystem-trees/${treeId}/current_directory/`);
    return response.data;
  },

  getFHSReference: async (): Promise<FHSReferenceResponse> => {
    const response = await api.get('/trees/filesystem-trees/fhs_reference/');
    return response.data;
  },

  getCommandReference: async (): Promise<CommandReferenceResponse> => {
    const response = await api.get('/trees/filesystem-trees/command_reference/');
    return response.data;
  },

    getTimerStatus: async (treeId: number): Promise<TimerStatusResponse> => {
    const response = await api.get(`/trees/filesystem-trees/${treeId}/timer_status/`);
    return response.data;
  },

  checkTimer: async (treeId: number, sessionId?: number): Promise<CheckTimerResponse> => {
    const url = `/trees/filesystem-trees/${treeId}/check_timer/`;
    const params = sessionId ? `?session_id=${sessionId}` : '';
    const response = await api.get(url + params);
    return response.data;
  },
};