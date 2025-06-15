# apps/trees/models.py
from django.db import models
from django.utils import timezone
import json
import random
import string

class FileSystemTree(models.Model):
    """A complete filesystem tree for a game session"""
    name = models.CharField(max_length=100, default="FHS Tree")
    created_at = models.DateTimeField(auto_now_add=True)
    seed = models.IntegerField(default=0)
    
    # Game state
    mole_location = models.CharField(max_length=500, blank=True)  # Path to mole
    player_location = models.CharField(max_length=500, default="/home")
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Cached tree structure
    tree_data = models.JSONField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.name} - {'Completed' if self.is_completed else 'Active'}"
    
    def generate_tree(self, max_depth=5, directories_per_level=3):
        """Generate a procedural Unix filesystem tree"""
        if self.seed == 0:
            self.seed = random.randint(1, 1000000)
        
        random.seed(self.seed)
        
        # Clear existing nodes
        self.nodes.all().delete()
        
        # Create root
        root = DirectoryNode.objects.create(
            tree=self,
            name="",
            path="/",
            parent=None,
            is_fhs_standard=True,
            description="Root directory"
        )
        
        # Create standard FHS directories
        self._create_fhs_structure(root)
        
        # Add procedural directories to some locations
        self._add_procedural_directories(max_depth, directories_per_level)
        
        # Place the mole in a random directory (not in standard FHS locations)
        self._place_mole()
        
        # Set random starting position for player
        self._set_random_start_position()
        
        # Cache the tree structure
        self.cache_tree()
        self.save()
    
    def _create_fhs_structure(self, root):
        """Create standard FHS directory structure"""
        fhs_dirs = [
            {"name": "bin", "desc": "Essential command binaries"},
            {"name": "boot", "desc": "Static files of the boot loader"},
            {"name": "dev", "desc": "Device files"},
            {"name": "etc", "desc": "Host-specific system configuration"},
            {"name": "home", "desc": "User home directories"},
            {"name": "lib", "desc": "Essential shared libraries and kernel modules"},
            {"name": "media", "desc": "Mount points for removable media"},
            {"name": "mnt", "desc": "Mount point for temporarily mounted filesystems"},
            {"name": "opt", "desc": "Add-on application software packages"},
            {"name": "proc", "desc": "Virtual filesystem for process information"},
            {"name": "root", "desc": "Home directory for the root user"},
            {"name": "run", "desc": "Data relevant to running processes"},
            {"name": "sbin", "desc": "Essential system binaries"},
            {"name": "srv", "desc": "Data for services provided by this system"},
            {"name": "sys", "desc": "Virtual filesystem for system information"},
            {"name": "tmp", "desc": "Temporary files"},
            {"name": "usr", "desc": "Secondary hierarchy"},
            {"name": "var", "desc": "Variable data"},
        ]
        
        for dir_info in fhs_dirs:
            DirectoryNode.objects.create(
                tree=self,
                name=dir_info["name"],
                path=f"/{dir_info['name']}",
                parent=root,
                is_fhs_standard=True,
                description=dir_info["desc"]
            )
        
        # Create some standard subdirectories
        usr = DirectoryNode.objects.get(tree=self, path="/usr")
        for subdir in ["bin", "lib", "local", "share", "src"]:
            DirectoryNode.objects.create(
                tree=self,
                name=subdir,
                path=f"/usr/{subdir}",
                parent=usr,
                is_fhs_standard=True,
                description=f"User {subdir} directory"
            )
        
        # Create user directories
        home = DirectoryNode.objects.get(tree=self, path="/home")
        for username in ["alice", "bob", "charlie"]:
            user_home = DirectoryNode.objects.create(
                tree=self,
                name=username,
                path=f"/home/{username}",
                parent=home,
                is_fhs_standard=False,
                description=f"Home directory for {username}"
            )
            
            # Add some standard user directories
            for userdir in ["Documents", "Downloads", "Desktop", "Pictures"]:
                DirectoryNode.objects.create(
                    tree=self,
                    name=userdir,
                    path=f"/home/{username}/{userdir}",
                    parent=user_home,
                    is_fhs_standard=False,
                    description=f"{username}'s {userdir}"
                )
    
    def _add_procedural_directories(self, max_depth, dirs_per_level):
        """Add procedurally generated directories to make the tree interesting"""
        # Common directory names for procedural generation
        dir_names = [
            "projects", "workspace", "temp", "backup", "archive", "data",
            "config", "logs", "cache", "build", "dist", "assets",
            "scripts", "tools", "utils", "resources", "public", "private",
            "old", "new", "test", "prod", "dev", "staging",
            "alpha", "beta", "gamma", "delta", "epsilon", "zeta",
            "red", "blue", "green", "yellow", "purple", "orange",
            "cat", "dog", "fish", "bird", "mouse", "rabbit"
        ]
        
        # Add procedural dirs to certain locations
        base_paths = [
            "/home/alice", "/home/bob", "/home/charlie",
            "/opt", "/var", "/usr/local"
        ]
        
        for base_path in base_paths:
            try:
                base_node = DirectoryNode.objects.get(tree=self, path=base_path)
                self._generate_subtree(base_node, max_depth-2, dirs_per_level, dir_names)
            except DirectoryNode.DoesNotExist:
                continue
    
    def _generate_subtree(self, parent, depth, dirs_per_level, name_pool):
        """Recursively generate random subdirectories"""
        if depth <= 0:
            return
        
        # Random number of directories at this level
        num_dirs = random.randint(1, dirs_per_level)
        used_names = set()
        
        for _ in range(num_dirs):
            # Pick a unique name for this level
            name = random.choice(name_pool)
            while name in used_names:
                name = random.choice(name_pool)
            used_names.add(name)
            
            # Create the directory
            path = f"{parent.path}/{name}" if parent.path != "/" else f"/{name}"
            new_dir = DirectoryNode.objects.create(
                tree=self,
                name=name,
                path=path,
                parent=parent,
                is_fhs_standard=False,
                description=f"Procedurally generated directory"
            )
            
            # Randomly decide whether to create subdirectories
            if random.random() > 0.3:  # 70% chance of subdirectories
                self._generate_subtree(new_dir, depth-1, dirs_per_level, name_pool)
    
    def _place_mole(self):
        """Place the mole in a random non-FHS directory"""
        candidates = DirectoryNode.objects.filter(
            tree=self,
            is_fhs_standard=False
        ).exclude(path__in=[
            "/home", "/home/alice", "/home/bob", "/home/charlie"
        ])
        
        if candidates.exists():
            mole_dir = random.choice(candidates)
            self.mole_location = mole_dir.path
    
    def _set_random_start_position(self):
        """Set a random starting position for the player"""
        # Get all directories that could be valid starting positions
        # Exclude root and very deep directories (depth > 3)
        candidates = DirectoryNode.objects.filter(
            tree=self
        ).exclude(
            path="/"  # Don't start at root
        )
        
        # Filter to reasonable starting positions
        valid_starts = []
        for node in candidates:
            depth = node.path.count('/')
            # Prefer directories at depth 1-3
            if 1 <= depth <= 3:
                # Don't start at the mole location
                if node.path != self.mole_location:
                    valid_starts.append(node)
        
        if valid_starts:
            # Weight selection towards common starting areas but allow anywhere
            weights = []
            for node in valid_starts:
                if node.path.startswith('/home'):
                    weights.append(3)  # Higher weight for home directories
                elif node.path.startswith('/usr'):
                    weights.append(2)  # Medium weight for usr directories
                else:
                    weights.append(1)  # Lower weight for other directories
            
            # Select random starting position with weights
            start_node = random.choices(valid_starts, weights=weights, k=1)[0]
            self.player_location = start_node.path
        else:
            # Fallback to /home if no valid candidates
            self.player_location = "/home"
    
    def cache_tree(self):
        """Cache the tree structure for efficient retrieval"""
        def build_tree_dict(node):
            children = DirectoryNode.objects.filter(parent=node)
            return {
                "name": node.name,
                "path": node.path,
                "is_fhs": node.is_fhs_standard,
                "description": node.description,
                "has_mole": node.path == self.mole_location,
                "children": [build_tree_dict(child) for child in children]
            }
        
        root = DirectoryNode.objects.get(tree=self, path="/")
        self.tree_data = build_tree_dict(root)
    
    def move_player(self, target_path):
        """Move player to a new location if valid"""
        # Normalize path
        if not target_path.startswith('/'):
            # Relative path
            if target_path == "..":
                # Go up one directory
                if self.player_location == "/":
                    return False, "Already at root directory"
                self.player_location = "/".join(self.player_location.split("/")[:-1]) or "/"
            else:
                # Go to subdirectory
                new_path = f"{self.player_location}/{target_path}" if self.player_location != "/" else f"/{target_path}"
                if DirectoryNode.objects.filter(tree=self, path=new_path).exists():
                    self.player_location = new_path
                else:
                    return False, f"Directory not found: {target_path}"
        else:
            # Absolute path
            if DirectoryNode.objects.filter(tree=self, path=target_path).exists():
                self.player_location = target_path
            else:
                return False, f"Directory not found: {target_path}"
        
        self.save()
        return True, f"Moved to {self.player_location}"
    
    def check_win_condition(self):
        """Check if player is in the same directory as the mole"""
        return self.player_location == self.mole_location


class DirectoryNode(models.Model):
    """A directory in the filesystem tree"""
    tree = models.ForeignKey(FileSystemTree, on_delete=models.CASCADE, related_name='nodes')
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    
    name = models.CharField(max_length=100)
    path = models.CharField(max_length=500, db_index=True)
    is_fhs_standard = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    
    class Meta:
        unique_together = ('tree', 'path')
        ordering = ['path']
    
    def __str__(self):
        return f"{self.path} ({'FHS' if self.is_fhs_standard else 'Generated'})"
    
    @property
    def depth(self):
        """Calculate directory depth"""
        return self.path.count('/')
    
    def get_contents(self):
        """Get immediate children of this directory"""
        return DirectoryNode.objects.filter(parent=self).order_by('name')


class GameSession(models.Model):
    """Track game sessions and scores"""
    tree = models.ForeignKey(FileSystemTree, on_delete=models.CASCADE, related_name='sessions')
    player_name = models.CharField(max_length=100, default="Anonymous")
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Game metrics
    commands_used = models.IntegerField(default=0)
    directories_visited = models.IntegerField(default=0)
    time_taken = models.DurationField(null=True, blank=True)
    
    # Command history
    command_history = models.JSONField(default=list)
    
    def __str__(self):
        return f"{self.player_name} - {self.tree.name}"
    
    def add_command(self, command):
        """Add a command to the history"""
        self.command_history.append({
            'command': command,
            'timestamp': str(timezone.now())
        })
        self.commands_used += 1
        self.save()