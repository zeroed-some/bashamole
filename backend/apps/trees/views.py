# apps/trees/views.py
from django.http import HttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import FileSystemTree, DirectoryNode, GameSession
from .serializers import (
    FileSystemTreeSerializer, DirectoryNodeSerializer, 
    GameSessionSerializer, GameCommandSerializer
)


class FileSystemTreeViewSet(viewsets.ModelViewSet):
    """ViewSet for filesystem trees"""
    queryset = FileSystemTree.objects.all()
    serializer_class = FileSystemTreeSerializer
    
    @action(detail=False, methods=['get'])
    def command_reference(self, request):
        """Get command reference"""
        commands = {
            "navigation": [
                {
                    "command": "cd <directory>",
                    "description": "Change to specified directory",
                    "examples": ["cd projects", "cd /home/sarah", "cd .."]
                },
                {
                    "command": "cd",
                    "description": "Go to home directory",
                    "examples": ["cd"]
                },
                {
                    "command": "pushd <directory>",
                    "description": "Push directory onto stack and change to it",
                    "examples": ["pushd /var/log", "pushd ~/Documents"]
                },
                {
                    "command": "popd",
                    "description": "Pop directory from stack and change to it",
                    "examples": ["popd"]
                }
            ],
            "exploration": [
                {
                    "command": "ls [-la]",
                    "description": "List directory contents",
                    "examples": ["ls", "ls -l", "ls -la"],
                    "options": {
                        "-l": "Long format with details",
                        "-a": "Show hidden entries (. and ..)"
                    }
                },
                {
                    "command": "pwd",
                    "description": "Print current working directory",
                    "examples": ["pwd"]
                },
                {
                    "command": "tree [-L depth]",
                    "description": "Display directory tree ([X] marks mole location)",
                    "examples": ["tree", "tree -L 2", "tree -L 5"],
                    "options": {
                        "-L": "Limit depth (1-5)"
                    }
                },
                {
                    "command": "dirs",
                    "description": "Display directory stack",
                    "examples": ["dirs"]
                }
            ],
            "utility": [
                {
                    "command": "echo <text>",
                    "description": "Display text or variables",
                    "examples": ["echo hello", "echo $HOME", "echo $PWD"],
                    "variables": {
                        "$HOME": "Home directory path",
                        "$PWD": "Current directory path",
                        "$OLDPWD": "Previous directory path"
                    }
                },
                {
                    "command": "help",
                    "description": "Show command help",
                    "examples": ["help"]
                }
            ],
            "game": [
                {
                    "command": "killall moles",
                    "description": "Eliminate moles when in the same directory",
                    "examples": ["killall moles"]
                },
                {
                    "command": "score",
                    "description": "Show current score and moles killed",
                    "examples": ["score"]
                }
            ],
            "special_paths": [
                {
                    "path": "~",
                    "description": "Home directory",
                    "examples": ["cd ~", "cd ~/Documents"]
                },
                {
                    "path": "-",
                    "description": "Previous directory",
                    "examples": ["cd -"]
                },
                {
                    "path": "..",
                    "description": "Parent directory",
                    "examples": ["cd ..", "cd ../projects"]
                }
            ]
        }
        return Response(commands)
    
    @action(detail=False, methods=['get'])
    def fhs_reference(self, request):
        """Get FHS directory reference"""
        fhs_dirs = [
            {"path": "/bin", "name": "bin", "desc": "Essential command binaries"},
            {"path": "/boot", "name": "boot", "desc": "Static files of the boot loader"},
            {"path": "/dev", "name": "dev", "desc": "Device files"},
            {"path": "/etc", "name": "etc", "desc": "Host-specific system configuration"},
            {"path": "/home", "name": "home", "desc": "User home directories"},
            {"path": "/lib", "name": "lib", "desc": "Essential shared libraries and kernel modules"},
            {"path": "/media", "name": "media", "desc": "Mount points for removable media"},
            {"path": "/mnt", "name": "mnt", "desc": "Mount point for temporarily mounted filesystems"},
            {"path": "/opt", "name": "opt", "desc": "Add-on application software packages"},
            {"path": "/proc", "name": "proc", "desc": "Virtual filesystem for process information"},
            {"path": "/root", "name": "root", "desc": "Home directory for the root user"},
            {"path": "/run", "name": "run", "desc": "Data relevant to running processes"},
            {"path": "/sbin", "name": "sbin", "desc": "Essential system binaries"},
            {"path": "/srv", "name": "srv", "desc": "Data for services provided by this system"},
            {"path": "/sys", "name": "sys", "desc": "Virtual filesystem for system information"},
            {"path": "/tmp", "name": "tmp", "desc": "Temporary files"},
            {"path": "/usr", "name": "usr", "desc": "Secondary hierarchy"},
            {"path": "/var", "name": "var", "desc": "Variable data"},
        ]
        return Response({"directories": fhs_dirs})
    
    @action(detail=False, methods=['post'])
    def create_game(self, request):
        """Create a new game with a generated filesystem tree"""
        tree_name = request.data.get('name', 'FHS Game Tree')
        max_depth = request.data.get('max_depth', 5)
        dirs_per_level = request.data.get('dirs_per_level', 3)
        
        # Create and generate tree
        tree = FileSystemTree.objects.create(name=tree_name)
        tree.generate_tree(max_depth=max_depth, directories_per_level=dirs_per_level)
        
        # Get initial timer info
        initial_timer = tree.default_mole_timer
        timer_distance = tree.calculate_path_distance(tree.player_location, tree.mole_location)
        
        # Determine timer reason
        if timer_distance <= 1:
            timer_reason = "nearby"
        elif timer_distance <= 3:
            timer_reason = "close"
        elif timer_distance <= 5:
            timer_reason = "moderate distance"
        else:
            timer_reason = "far away"
        
        # Create game session
        player_name = request.data.get('player_name', 'Anonymous')
        session = GameSession.objects.create(
            tree=tree,
            player_name=player_name
        )
        
        serializer = self.get_serializer(tree)
        return Response({
            'tree': serializer.data,
            'session_id': session.id,
            'mole_hint': f"The mole is hiding somewhere in the filesystem!",
            'home_directory': tree.home_directory,
            'initial_timer': initial_timer,
            'timer_reason': timer_reason,
            'timer_distance': timer_distance
        }, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def current_directory(self, request, pk=None):
        """Get current directory contents and player location"""
        tree = self.get_object()
        
        try:
            current_dir = DirectoryNode.objects.get(
                tree=tree, 
                path=tree.player_location
            )
            contents = current_dir.get_contents()
            
            return Response({
                'path': tree.player_location,
                'contents': DirectoryNodeSerializer(contents, many=True).data,
                'parent': current_dir.parent.path if current_dir.parent else None
            })
        except DirectoryNode.DoesNotExist:
            return Response(
                {'error': 'Current directory not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['get'])
    def check_timer(self, request, pk=None):
        """Check the current mole timer status"""
        tree = self.get_object()
        
        # Check if timer expired
        expired, remaining = tree.check_mole_timer()
        
        response_data = {
            'timer_remaining': remaining,
            'timer_expired': expired,
            'mole_location': tree.mole_location,
            'timer_paused': tree.timer_paused
        }
        
        # Handle escape if timer expired
        if expired:
            escape_data = tree.handle_mole_escape()
            if escape_data:
                
                mole_direction = tree.get_mole_direction()

                escape_data['mole_direction'] = mole_direction

                response_data.update({
                    'mole_escaped': True,
                    'escape_data': escape_data,
                    'mole_direction': mole_direction,  # Add this line
                    'message': f"The mole escaped from {escape_data['old_location']}! A new mole appeared!"
                })

                # Update session stats
                session_id = request.query_params.get('session_id')
                if session_id:
                    try:
                        session = GameSession.objects.get(id=session_id, tree=tree)
                        session.moles_escaped += 1
                        session.save()
                    except GameSession.DoesNotExist:
                        pass
                
                response_data.update({
                    'mole_escaped': True,
                    'escape_data': escape_data,
                    'message': f"The mole escaped from {escape_data['old_location']}! A new mole appeared!"
                })
        
        return Response(response_data)
    
    @action(detail=True, methods=['get'])
    def timer_status(self, request, pk=None):
        """Get detailed timer status for UI updates"""
        tree = self.get_object()
        expired, remaining = tree.check_mole_timer()
        
        # Calculate warning level
        warning_level = None
        if not expired and remaining > 0:
            if remaining <= 5:
                warning_level = 'critical'
            elif remaining <= 15:
                warning_level = 'alert'
            elif remaining <= 30:
                warning_level = 'warning'
        
        return Response({
            'remaining': remaining,
            'total': tree.default_mole_timer,
            'percentage': (remaining / tree.default_mole_timer * 100) if tree.default_mole_timer > 0 else 0,
            'warning_level': warning_level,
            'expired': expired,
            'paused': tree.timer_paused
        })
    
    @action(detail=True, methods=['post'])
    def execute_command(self, request, pk=None):
        """Execute a shell command in the game"""
        tree = self.get_object()
        command = request.data.get('command', '').strip()
        session_id = request.data.get('session_id')
        
        if not command:
            return Response(
                {'error': 'No command provided'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Track commands for tree
        tree.total_commands += 1
        tree.save()
        
        # Get session if provided
        session = None
        commands_before_mole = tree.total_commands  # Track for scoring
        
        if session_id:
            try:
                session = GameSession.objects.get(id=session_id, tree=tree)
                session.add_command(command)
                commands_before_mole = session.commands_used
            except GameSession.DoesNotExist:
                pass
        
        # Check timer before executing command
        expired, remaining = tree.check_mole_timer()
        
        # Parse and execute command
        parts = command.split()
        cmd = parts[0] if parts else ""
        
        response_data = {
            'command': command,
            'success': False,
            'output': '',
            'current_path': tree.player_location,
            'mole_spawned': False,
            'mole_direction': None,
            'score': 0,
            'timer_remaining': remaining,
            'timer_warnings': [],
            'new_timer': None,
            'timer_reason': None,
            'timer_distance': None
        }
        
        # Add timer warnings to output
        if not expired and remaining > 0:
            if remaining <= 5:
                response_data['timer_warnings'].append({
                    'level': 'CRITICAL',
                    'message': f'Mole escaping! ({remaining}s remaining)'
                })
            elif remaining <= 15:
                response_data['timer_warnings'].append({
                    'level': 'ALERT',
                    'message': f'Mole burrowing soon! ({remaining}s remaining)'
                })
            elif remaining <= 30:
                response_data['timer_warnings'].append({
                    'level': 'WARNING',
                    'message': f'Mole detected! ({remaining}s remaining)'
                })
        
        if cmd == 'cd':
            if len(parts) < 2:
                # cd with no args goes to home directory
                success, message = tree.move_player("~")
                response_data['success'] = success
                response_data['output'] = message if not success else ""
                response_data['current_path'] = tree.player_location
            else:
                # Join all parts after 'cd' to handle paths with spaces
                target = ' '.join(parts[1:])
                # Strip trailing slash if present (except for root)
                if target.endswith('/') and target != '/':
                    target = target.rstrip('/')
                
                success, message = tree.move_player(target)
                response_data['success'] = success
                response_data['output'] = message
                response_data['current_path'] = tree.player_location
                
                if success and session:
                    session.directories_visited += 1
                    session.save()
        
        elif cmd == 'pushd':
            if len(parts) < 2:
                # pushd with no args swaps top two directories on stack
                if tree.directory_stack:
                    success, message = tree.push_directory()
                    response_data['success'] = success
                    response_data['output'] = message
                else:
                    response_data['output'] = "pushd: no other directory"
            else:
                target = ' '.join(parts[1:])
                # Strip trailing slash if present (except for root)
                if target.endswith('/') and target != '/':
                    target = target.rstrip('/')
                
                success, message = tree.push_directory(target)
                response_data['success'] = success
                response_data['output'] = message
                response_data['current_path'] = tree.player_location
                
                if success and session:
                    session.directories_visited += 1
                    session.save()
        
        elif cmd == 'popd':
            success, message = tree.pop_directory()
            response_data['success'] = success
            response_data['output'] = message
            response_data['current_path'] = tree.player_location
            
            if success and session:
                session.directories_visited += 1
                session.save()
        
        elif cmd == 'dirs':
            # Show directory stack
            stack = tree.get_directory_stack()
            if stack:
                response_data['output'] = ' '.join(stack)
            else:
                response_data['output'] = tree.player_location
            response_data['success'] = True
        
        elif cmd == 'ls':
            # Handle ls with options
            show_all = '-a' in parts or '-la' in parts or '-al' in parts
            long_format = '-l' in parts or '-la' in parts or '-al' in parts
            
            try:
                current_dir = DirectoryNode.objects.get(
                    tree=tree, 
                    path=tree.player_location
                )
                contents = current_dir.get_contents()
                
                output_lines = []
                
                if show_all:
                    # Add . and .. entries
                    if long_format:
                        output_lines.append("drwxr-xr-x  .  " + current_dir.description)
                        if current_dir.parent:
                            output_lines.append("drwxr-xr-x  ..  " + current_dir.parent.description)
                    else:
                        output_lines.extend(['.', '..'])
                
                if contents:
                    for d in contents:
                        if long_format:
                            output_lines.append(f"drwxr-xr-x  {d.name}  {d.description}")
                        else:
                            output_lines.append(d.name)
                
                if long_format:
                    response_data['output'] = '\n'.join(output_lines)
                else:
                    # Format in columns for regular ls
                    if output_lines:
                        response_data['output'] = '  '.join(output_lines)
                    else:
                        response_data['output'] = ''
                
                response_data['success'] = True
            except DirectoryNode.DoesNotExist:
                response_data['output'] = "ls: cannot access directory"
        
        elif cmd == 'pwd':
            response_data['output'] = tree.player_location
            response_data['success'] = True
        
        elif cmd == 'echo':
            # Simple echo implementation
            if len(parts) > 1:
                # Handle special variables
                echo_text = ' '.join(parts[1:])
                if echo_text == '$HOME':
                    response_data['output'] = tree.home_directory
                elif echo_text == '$PWD':
                    response_data['output'] = tree.player_location
                elif echo_text == '$OLDPWD':
                    response_data['output'] = tree.previous_location or ''
                else:
                    response_data['output'] = echo_text
            else:
                response_data['output'] = ''
            response_data['success'] = True
        
        elif cmd == 'tree':
            # Parse options
            show_all = '-a' in parts
            max_depth = 3  # Default depth
            
            # Check for -L option
            if '-L' in parts:
                try:
                    depth_index = parts.index('-L') + 1
                    if depth_index < len(parts):
                        max_depth = int(parts[depth_index])
                        max_depth = min(max(max_depth, 1), 5)  # Limit between 1-5
                except (ValueError, IndexError):
                    pass
            
            try:
                current_dir = DirectoryNode.objects.get(
                    tree=tree, 
                    path=tree.player_location
                )
                
                # Build tree output
                output_lines = [tree.player_location]
                
                def build_tree_output(node, prefix="", is_last=True, depth=0):
                    if depth >= max_depth:
                        return
                    
                    children = list(node.get_contents().order_by('name'))
                    
                    for i, child in enumerate(children):
                        is_last_child = i == len(children) - 1
                        
                        # Determine if this directory contains the mole
                        has_mole_in_subtree = False
                        if child.path == tree.mole_location:
                            has_mole_in_subtree = True
                        else:
                            # Check if mole is in any subdirectory
                            all_descendants = DirectoryNode.objects.filter(
                                tree=tree,
                                path__startswith=child.path + '/'
                            )
                            if any(d.path == tree.mole_location for d in all_descendants):
                                has_mole_in_subtree = True
                        
                        # Build the tree branch characters
                        connector = "└── " if is_last_child else "├── "
                        
                        # Format the directory name
                        if has_mole_in_subtree:
                            # Use X to indicate mole presence
                            dir_display = f"[X] {child.name}"
                        else:
                            dir_display = child.name
                        
                        output_lines.append(f"{prefix}{connector}{dir_display}")
                        
                        # Recurse into subdirectories
                        if depth + 1 < max_depth:
                            extension = "    " if is_last_child else "│   "
                            build_tree_output(child, prefix + extension, is_last_child, depth + 1)
                
                build_tree_output(current_dir)
                
                # Add directory count at the end
                total_shown = len(output_lines) - 1
                if total_shown == 0:
                    output_lines.append("\n0 directories")
                else:
                    dir_text = "directory" if total_shown == 1 else "directories"
                    output_lines.append(f"\n{total_shown} {dir_text}")
                
                response_data['output'] = '\n'.join(output_lines)
                response_data['success'] = True
                
            except DirectoryNode.DoesNotExist:
                response_data['output'] = "tree: cannot access directory"
        
        elif cmd == 'killall' and len(parts) > 1 and parts[1] == 'moles':
            if tree.check_win_condition():
                # Check if killed before timer expired
                expired, remaining = tree.check_mole_timer()
                
                # Track old mole location for stats
                old_mole_location = tree.mole_location
                
                # Update mole kill count
                tree.moles_killed += 1
                tree.save()
                
                # Record stats for session
                if session:
                    # Calculate commands used for this mole
                    commands_for_mole = session.commands_used - commands_before_mole + 1  # +1 for killall
                    
                    # Calculate time (simplified for now - would need to track per-mole start time)
                    time_for_mole = timezone.now() - session.started_at
                    
                    # Calculate distance traveled (simplified - just the path distance)
                    distance = tree.calculate_path_distance(tree.home_directory, old_mole_location)
                    
                    session.record_mole_kill(
                        old_mole_location,
                        commands_for_mole,
                        time_for_mole,
                        distance
                    )
                    response_data['score'] = session.calculate_score()
                
                # Spawn new mole
                success, new_timer, timer_reason, timer_distance = tree.spawn_new_mole()
                if success:
                    mole_direction = tree.get_mole_direction()
                    
                    # Include timer info in message
                    timer_msg = f"Timer: {new_timer}s (mole is {timer_reason})"
                    
                    if not expired:
                        response_data['output'] = f"🎉 You eliminated the mole with {remaining}s to spare! (Total moles killed: {tree.moles_killed})\n🐭 A new mole has appeared! {timer_msg}"
                    else:
                        response_data['output'] = f"🎉 You eliminated the mole! (Total moles killed: {tree.moles_killed})\n🐭 A new mole has appeared! {timer_msg}"
                    
                    response_data['success'] = True
                    response_data['mole_spawned'] = True
                    response_data['mole_direction'] = mole_direction
                    response_data['moles_killed'] = tree.moles_killed
                    response_data['new_mole_location'] = tree.mole_location
                    response_data['new_timer'] = new_timer
                    response_data['timer_reason'] = timer_reason
                    response_data['timer_distance'] = timer_distance
                else:
                    response_data['output'] = "🎉 You eliminated the mole! Unable to spawn new mole."
                    response_data['success'] = True
            else:
                response_data['output'] = "No moles found in this directory."
                response_data['success'] = True
        
        elif cmd == 'score':
            # New command to check current score
            if session:
                response_data['output'] = f"Score: {session.calculate_score()} | Moles killed: {session.moles_killed}"
                response_data['score'] = session.calculate_score()
            else:
                response_data['output'] = "No active session to score."
            response_data['success'] = True
        
        elif cmd == 'help':
            response_data['output'] = """Available commands:
cd <directory>    - Change directory (supports ~, -, and ..)
cd                - Go to home directory
pushd <directory> - Push directory onto stack and change to it
popd              - Pop directory from stack and change to it
dirs              - Display directory stack
ls [-la]          - List directory contents
pwd               - Print working directory
echo <text>       - Display text (supports $HOME, $PWD, $OLDPWD)
tree [-L depth]   - Display directory tree (use -L to limit depth)
killall moles     - Eliminate moles (when in the same directory)
score             - Show current score and moles killed
help              - Show this help message

Special paths:
~   - Home directory
-   - Previous directory
..  - Parent directory"""
            response_data['success'] = True
        
        else:
            response_data['output'] = f"bash: {cmd}: command not found"
        
        return Response(response_data)
    
    @action(detail=True, methods=['get'])
    def hint(self, request, pk=None):
        """Get a hint about the mole's location"""
        tree = self.get_object()
        
        if not tree.mole_location:
            return Response({'hint': 'No mole in this tree!'})
        
        mole_depth = tree.mole_location.count('/')
        player_depth = tree.player_location.count('/')
        
        hints = []
        if mole_depth > player_depth:
            hints.append("The mole is deeper in the filesystem than you are.")
        elif mole_depth < player_depth:
            hints.append("The mole is in a shallower directory than you are.")
        else:
            hints.append("You're at the same depth as the mole!")
        
        # Give a path hint
        mole_parts = tree.mole_location.split('/')
        player_parts = tree.player_location.split('/')
        
        # Find common path
        common_parts = []
        for i, (m, p) in enumerate(zip(mole_parts, player_parts)):
            if m == p:
                common_parts.append(m)
            else:
                break
        
        if len(common_parts) == len(mole_parts):
            hints.append("You're in the mole's directory! Use 'killall moles'!")
        elif len(common_parts) > 1:
            hints.append(f"You share a common path with the mole: {'/'.join(common_parts) or '/'}")
        
        return Response({'hints': hints})


class DirectoryNodeViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for browsing directory nodes"""
    queryset = DirectoryNode.objects.all()
    serializer_class = DirectoryNodeSerializer
    
    def get_queryset(self):
        queryset = super().get_queryset()
        tree_id = self.request.query_params.get('tree', None)
        if tree_id:
            queryset = queryset.filter(tree_id=tree_id)
        return queryset


class GameSessionViewSet(viewsets.ModelViewSet):
    """ViewSet for game sessions"""
    queryset = GameSession.objects.all()
    serializer_class = GameSessionSerializer
    
    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """Get the leaderboard of fastest completions"""
        completed_sessions = GameSession.objects.filter(
            completed_at__isnull=False
        ).order_by('time_taken', 'commands_used')[:20]
        
        serializer = self.get_serializer(completed_sessions, many=True)
        return Response(serializer.data)