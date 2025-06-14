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
            'mole_hint': f"The mole is hiding somewhere in the filesystem!"
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
                response_data['output'] = "cd: missing operand"
            else:
                target = parts[1]
                success, message = tree.move_player(target)
                response_data['success'] = success
                response_data['output'] = message
                response_data['current_path'] = tree.player_location
                
                if success and session:
                    session.directories_visited += 1
                    session.save()
        
        elif cmd == 'ls':
            try:
                current_dir = DirectoryNode.objects.get(
                    tree=tree, 
                    path=tree.player_location
                )
                contents = current_dir.get_contents()
                if contents:
                    response_data['output'] = '\n'.join([d.name for d in contents])
                else:
                    response_data['output'] = ''
                response_data['success'] = True
            except DirectoryNode.DoesNotExist:
                response_data['output'] = "ls: cannot access directory"
        
        elif cmd == 'pwd':
            response_data['output'] = tree.player_location
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
cd <directory>  - Change directory
ls              - List directory contents
pwd             - Print working directory
killall moles   - Eliminate moles (when in the same directory)
help            - Show this help message"""
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