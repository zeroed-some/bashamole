# apps/trees/management/commands/populate_trees.py
from django.core.management.base import BaseCommand
from apps.trees.models import FileSystemTree


class Command(BaseCommand):
    help = 'Create sample filesystem trees for testing'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=3,
            help='Number of trees to create'
        )
    
    def handle(self, *args, **options):
        count = options['count']
        
        self.stdout.write('Creating sample filesystem trees...')
        
        difficulties = [
            {'name': 'Beginner Tree', 'max_depth': 3, 'dirs_per_level': 2},
            {'name': 'Intermediate Tree', 'max_depth': 4, 'dirs_per_level': 3},
            {'name': 'Advanced Tree', 'max_depth': 5, 'dirs_per_level': 4},
            {'name': 'Expert Tree', 'max_depth': 6, 'dirs_per_level': 5},
        ]
        
        created_count = 0
        for i in range(count):
            difficulty = difficulties[i % len(difficulties)]
            
            tree = FileSystemTree.objects.create(
                name=f"{difficulty['name']} #{i+1}"
            )
            tree.generate_tree(
                max_depth=difficulty['max_depth'],
                directories_per_level=difficulty['dirs_per_level']
            )
            
            created_count += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created tree: {tree.name} with {tree.nodes.count()} directories"
                )
            )
            self.stdout.write(f"  Mole hidden at: {tree.mole_location}")
        
        self.stdout.write(
            self.style.SUCCESS(f'Successfully created {created_count} filesystem trees')
        )