// src/lib/api.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

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
}

export interface CommandResponse {
  command: string;
  success: boolean;
  output: string;
  current_path: string;
  game_won?: boolean;
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
};