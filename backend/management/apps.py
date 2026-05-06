from django.apps import AppConfig

class ManagementConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'management'

    def ready(self):
        # Import signals to ensure they are connected when the app is ready.
        import management.signals
