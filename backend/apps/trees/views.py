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
            'home_directory': tree.home_directory
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
        
        # Get session if provided
        session = None
        if session_id:
            try:
                session = GameSession.objects.get(id=session_id, tree=tree)
                session.add_command(command)
            except GameSession.DoesNotExist:
                pass
        
        # Parse and execute command
        parts = command.split()
        cmd = parts[0] if parts else ""
        
        response_data = {
            'command': command,
            'success': False,
            'output': '',
            'current_path': tree.player_location
        }
        
        if cmd == 'cd':
            if len(parts) < 2:
                # cd with no args goes to home directory
                success, message = tree.move_player("~")
                response_data['success'] = success
                response_data['output'] = message if not success else ""
                response_data['current_path'] = tree.player_location
            else:
                target = parts[1]
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
                target = parts[1]
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
        
        elif cmd == 'killall' and len(parts) > 1 and parts[1] == 'moles':
            if tree.check_win_condition():
                tree.is_completed = True
                tree.completed_at = timezone.now()
                tree.save()
                
                if session:
                    session.completed_at = timezone.now()
                    session.time_taken = session.completed_at - session.started_at
                    session.save()
                
                response_data['output'] = "🎉 Congratulations! You found and eliminated the mole!"
                response_data['success'] = True
                response_data['game_won'] = True
            else:
                response_data['output'] = "No moles found in this directory."
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
killall moles     - Eliminate moles (when in the same directory)
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