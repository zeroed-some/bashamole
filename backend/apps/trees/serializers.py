# apps/trees/serializers.py
from rest_framework import serializers
from .models import FileSystemTree, DirectoryNode, GameSession


class DirectoryNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = DirectoryNode
        fields = ['id', 'name', 'path', 'is_fhs_standard', 'description', 'depth']
        read_only_fields = ['depth']


class FileSystemTreeSerializer(serializers.ModelSerializer):
    total_directories = serializers.SerializerMethodField()
    
    class Meta:
        model = FileSystemTree
        fields = [
            'id', 'name', 'created_at', 'seed', 
            'player_location', 'is_completed', 'completed_at',
            'tree_data', 'total_directories', 'moles_killed',
            'total_commands', 'total_directories_visited'
        ]
        read_only_fields = ['created_at', 'tree_data', 'total_directories', 'moles_killed']
    
    def get_total_directories(self, obj):
        return obj.nodes.count()


class GameSessionSerializer(serializers.ModelSerializer):
    tree_name = serializers.CharField(source='tree.name', read_only=True)
    score = serializers.SerializerMethodField()
    
    class Meta:
        model = GameSession
        fields = [
            'id', 'tree', 'tree_name', 'player_name',
            'started_at', 'completed_at', 'commands_used',
            'directories_visited', 'time_taken', 'command_history',
            'moles_killed', 'mole_stats', 'score'
        ]
        read_only_fields = [
            'started_at', 'completed_at', 'time_taken', 'command_history',
            'mole_stats', 'score'
        ]
    
    def get_score(self, obj):
        return obj.calculate_score()


class GameCommandSerializer(serializers.Serializer):
    """Serializer for game commands"""
    command = serializers.CharField(max_length=200)
    session_id = serializers.IntegerField(required=False)