# apps/trees/models.py
from django.db import models
from django.utils import timezone
import json
import random
import string
import math

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
    
    # Navigation state
    previous_location = models.CharField(max_length=500, default="")  # For cd -
    directory_stack = models.JSONField(default=list)  # For pushd/popd
    home_directory = models.CharField(max_length=500, default="/home")  # Player's home
    
    # Game statistics
    moles_killed = models.IntegerField(default=0)
    total_commands = models.IntegerField(default=0)
    total_directories_visited = models.IntegerField(default=0)
    
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
        for username in ["sarah", "josh", "jules"]:
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
            "/home/sarah", "/home/josh", "/home/jules",
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
            "/home", "/home/sarah", "/home/josh", "/home/jules"
        ])
        
        if candidates.exists():
            mole_dir = random.choice(candidates)
            self.mole_location = mole_dir.path
    
    def spawn_new_mole(self):
        """Spawn a new mole after the current one is killed"""
        # Get all possible spawn locations (any directory)
        all_directories = DirectoryNode.objects.filter(tree=self).exclude(path="/")
        
        if all_directories.exists():
            # Randomly select a new location
            new_mole_dir = random.choice(all_directories)
            self.mole_location = new_mole_dir.path
            
            # Update the cached tree data
            self.cache_tree()
            self.save()
            
            return True
        return False
    
    def get_mole_direction(self):
        """Get the relative direction from player to mole in the tree structure"""
        if not self.mole_location or not self.player_location:
            return None
        
        # Build paths to compare
        player_parts = self.player_location.split('/')
        mole_parts = self.mole_location.split('/')
        
        # Remove empty strings from split
        player_parts = [p for p in player_parts if p]
        mole_parts = [p for p in mole_parts if p]
        
        # If player is at root, special handling
        if not player_parts:
            player_parts = ['']
        
        # Find common ancestor
        common_depth = 0
        for i in range(min(len(player_parts), len(mole_parts))):
            if player_parts[i] == mole_parts[i]:
                common_depth += 1
            else:
                break
        
        # Determine relative position
        player_depth = len(player_parts)
        mole_depth = len(mole_parts)
        
        # Calculate tree-based direction
        if self.mole_location == self.player_location:
            return {"direction": "here", "angle": 0}
        
        # Mole is in a parent directory (need to go up)
        if common_depth == mole_depth and mole_depth < player_depth:
            return {"direction": "up", "angle": 270}  # Up in tree
        
        # Mole is in a child directory (need to go down) 
        if common_depth == player_depth and mole_depth > player_depth:
            # It's directly below us
            return {"direction": "down", "angle": 90}  # Down in tree
        
        # Mole is in a sibling or cousin branch
        if common_depth < player_depth:
            # Need to go up first, then sideways
            # Determine left or right based on alphabetical order of diverging paths
            if common_depth < len(mole_parts) and common_depth < len(player_parts):
                if mole_parts[common_depth] < player_parts[common_depth]:
                    return {"direction": "up-left", "angle": 225}
                else:
                    return {"direction": "up-right", "angle": 315}
            return {"direction": "up", "angle": 270}
        else:
            # At same level or need to go down and sideways
            if common_depth < len(mole_parts):
                # Determine left or right based on tree structure
                # This is a simplification - in reality we'd need to check the actual tree layout
                if mole_parts[common_depth] < (player_parts[common_depth] if common_depth < len(player_parts) else 'z'):
                    return {"direction": "left", "angle": 180}
                else:
                    return {"direction": "right", "angle": 0}
            return {"direction": "down", "angle": 90}
    
    def calculate_path_distance(self, from_path, to_path):
        """Calculate the minimum number of cd commands needed to go from one path to another"""
        if from_path == to_path:
            return 0
        
        from_parts = from_path.split('/')
        to_parts = to_path.split('/')
        
        # Remove empty strings
        from_parts = [p for p in from_parts if p]
        to_parts = [p for p in to_parts if p]
        
        # Find common ancestor depth
        common_depth = 0
        for i in range(min(len(from_parts), len(to_parts))):
            if from_parts[i] == to_parts[i]:
                common_depth += 1
            else:
                break
        
        # Calculate moves needed
        moves_up = len(from_parts) - common_depth
        moves_down = len(to_parts) - common_depth
        
        return moves_up + moves_down
    
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
            
            # Set home directory based on starting location
            if start_node.path.startswith('/home/'):
                # Extract the user's home directory
                parts = start_node.path.split('/')
                if len(parts) >= 3:
                    self.home_directory = f"/home/{parts[2]}"
                else:
                    self.home_directory = "/home"
            else:
                # Default home directory
                self.home_directory = "/home"
        else:
            # Fallback to /home if no valid candidates
            self.player_location = "/home"
            self.home_directory = "/home"
    
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
    
    def resolve_path(self, path):
        """Resolve a path that may contain ~ or be relative"""
        if path == "~":
            return self.home_directory
        elif path.startswith("~/"):
            return self.home_directory + path[1:]
        elif path == "-":
            return self.previous_location if self.previous_location else self.player_location
        elif not path.startswith('/'):
            # Relative path
            if self.player_location == "/":
                return "/" + path
            else:
                return self.player_location + "/" + path
        else:
            # Absolute path
            return path
    
    def normalize_path(self, path):
        """Normalize a path by resolving .. and . components"""
        parts = path.split('/')
        resolved = []
        
        for part in parts:
            if part == '' and len(resolved) == 0:
                # Leading slash
                resolved.append('')
            elif part == '..':
                if len(resolved) > 1:
                    resolved.pop()
            elif part != '.' and part != '':
                resolved.append(part)
        
        if len(resolved) == 1 and resolved[0] == '':
            return '/'
        return '/'.join(resolved)
    
    def move_player(self, target_path):
        """Move player to a new location if valid"""
        # Resolve special path symbols
        resolved_path = self.resolve_path(target_path)
        
        # Handle ".." in the path
        if ".." in resolved_path or resolved_path == "..":
            if resolved_path == "..":
                # Go up one directory from current location
                if self.player_location == "/":
                    return False, "Already at root directory"
                new_path = "/".join(self.player_location.split("/")[:-1]) or "/"
            else:
                # Normalize the path to handle .. components
                new_path = self.normalize_path(resolved_path)
        else:
            new_path = resolved_path
        
        # Check if the directory exists
        if DirectoryNode.objects.filter(tree=self, path=new_path).exists():
            # Save previous location before moving
            self.previous_location = self.player_location
            self.player_location = new_path
            self.total_directories_visited += 1
            self.save()
            return True, f"Moved to {self.player_location}"
        else:
            return False, f"Directory not found: {target_path}"
    
    def push_directory(self, target_path=None):
        """Push current directory onto stack and optionally change to new directory"""
        # Add current directory to stack
        if not isinstance(self.directory_stack, list):
            self.directory_stack = []
        
        self.directory_stack.append(self.player_location)
        
        # If target path provided, change to it
        if target_path:
            success, message = self.move_player(target_path)
            if success:
                self.save()
                return True, f"Pushed {self.directory_stack[-1]} and moved to {self.player_location}"
            else:
                # Remove from stack if move failed
                self.directory_stack.pop()
                return False, message
        else:
            self.save()
            return True, f"Pushed {self.player_location} onto directory stack"
    
    def pop_directory(self):
        """Pop directory from stack and change to it"""
        if not self.directory_stack:
            return False, "Directory stack is empty"
        
        # Get directory from stack
        target_dir = self.directory_stack.pop()
        
        # Save current location as previous (for cd -)
        self.previous_location = self.player_location
        self.player_location = target_dir
        self.total_directories_visited += 1
        self.save()
        
        return True, f"Popped and moved to {self.player_location}"
    
    def get_directory_stack(self):
        """Get the current directory stack for display"""
        if not self.directory_stack:
            return []
        return list(self.directory_stack) + [self.player_location]
    
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
    moles_killed = models.IntegerField(default=0)
    
    # Per-mole tracking
    mole_stats = models.JSONField(default=list)  # List of {mole_number, location, commands, time, distance}
    
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
    
    def record_mole_kill(self, mole_location, commands_for_mole, time_for_mole, distance_traveled):
        """Record statistics for a mole kill"""
        self.moles_killed += 1
        self.mole_stats.append({
            'mole_number': self.moles_killed,
            'location': mole_location,
            'commands': commands_for_mole,
            'time': str(time_for_mole),
            'distance': distance_traveled
        })
        self.save()
    
    def calculate_score(self):
        """Calculate a score based on performance"""
        if self.moles_killed == 0:
            return 0
        
        # Base score per mole
        base_score = 1000
        
        # Calculate average performance
        total_commands = sum(stat['commands'] for stat in self.mole_stats)
        avg_commands = total_commands / self.moles_killed if self.moles_killed > 0 else 0
        
        # Score formula (rough draft)
        # More moles = better
        # Fewer commands = better
        # Less time = better (when we implement timing)
        score = self.moles_killed * base_score
        
        # Efficiency bonus (fewer commands is better)
        if avg_commands > 0:
            efficiency_multiplier = max(0.5, min(2.0, 10 / avg_commands))
            score *= efficiency_multiplier
        
        return int(score)