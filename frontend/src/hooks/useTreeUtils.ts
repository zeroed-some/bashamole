import { useCallback } from 'react';
import { TreeNode } from '@/lib/api';

export const useTreeUtils = () => {
  const updateTreeDataToShowMole = useCallback((treeData: TreeNode, molePath: string): TreeNode => {
    if (treeData.path === molePath) {
      return { ...treeData, has_mole: true };
    }
    if (treeData.children) {
      return {
        ...treeData,
        children: treeData.children.map((child) => 
          updateTreeDataToShowMole(child, molePath)
        ),
      };
    }
    return treeData;
  }, []);

  const removeMoleFromTree = useCallback((treeData: TreeNode): TreeNode => {
    return {
      ...treeData,
      has_mole: false,
      children: treeData.children ? treeData.children.map((child) => removeMoleFromTree(child)) : [],
    };
  }, []);

  return {
    updateTreeDataToShowMole,
    removeMoleFromTree,
  };
};