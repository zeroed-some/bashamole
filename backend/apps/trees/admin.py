# apps/trees/admin.py
from django.contrib import admin
from .models import FileSystemTree, DirectoryNode, GameSession


class DirectoryNodeInline(admin.TabularInline):
    model = DirectoryNode
    extra = 0
    fields = ['name', 'path', 'is_fhs_standard', 'parent']
    readonly_fields = ['path']
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(FileSystemTree)
class FileSystemTreeAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at', 'is_completed', 'mole_location', 'player_location']
    list_filter = ['is_completed', 'created_at']
    readonly_fields = ['created_at', 'completed_at', 'tree_data', 'seed']
    
    fieldsets = (
        ('Basic Info', {
            'fields': ('name', 'seed', 'created_at')
        }),
        ('Game State', {
            'fields': ('player_location', 'mole_location', 'is_completed', 'completed_at')
        }),
        ('Tree Data', {
            'fields': ('tree_data',),
            'classes': ('collapse',)
        })
    )
    
    actions = ['regenerate_trees']
    
    def regenerate_trees(self, request, queryset):
        for tree in queryset:
            tree.generate_tree()
        self.message_user(request, f"Regenerated {queryset.count()} trees")
    regenerate_trees.short_description = "Regenerate selected trees"


@admin.register(DirectoryNode)
class DirectoryNodeAdmin(admin.ModelAdmin):
    list_display = ['path', 'name', 'tree', 'is_fhs_standard', 'parent']
    list_filter = ['is_fhs_standard', 'tree']
    search_fields = ['path', 'name']
    raw_id_fields = ['tree', 'parent']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('tree', 'parent')


@admin.register(GameSession)
class GameSessionAdmin(admin.ModelAdmin):
    list_display = ['player_name', 'tree', 'started_at', 'completed_at', 'commands_used', 'time_taken']
    list_filter = ['completed_at', 'started_at']
    readonly_fields = ['started_at', 'completed_at', 'time_taken', 'command_history']
    
    fieldsets = (
        ('Player Info', {
            'fields': ('player_name', 'tree')
        }),
        ('Game Stats', {
            'fields': ('started_at', 'completed_at', 'time_taken', 'commands_used', 'directories_visited')
        }),
        ('Command History', {
            'fields': ('command_history',),
            'classes': ('collapse',)
        })
    )