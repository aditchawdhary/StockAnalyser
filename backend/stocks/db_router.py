class StockRouter:
    """
    Route stock models to 'adjusted' database,
    all other models (including auth) to 'default' database.
    """

    def db_for_read(self, model, **hints):
        """Direct read operations to the appropriate database."""
        if model._meta.app_label == 'stocks':
            return 'adjusted'
        return 'default'

    def db_for_write(self, model, **hints):
        """Direct write operations to the appropriate database."""
        if model._meta.app_label == 'stocks':
            return 'adjusted'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        """Allow relations if both models are in the same database."""
        db_set = {'default', 'adjusted'}
        if obj1._state.db in db_set and obj2._state.db in db_set:
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """Ensure migrations run on the correct database."""
        if app_label == 'stocks':
            return db == 'adjusted'
        return db == 'default'
