class StockRouter:
    """
    Route stock models to appropriate databases:
    - 'adjusted' database for weekly data
    - 'daily' database for daily data
    - 'intraday' database for intraday data
    - 'default' database for all other models (including auth)
    """

    # Models that belong to the daily database
    daily_models = {'dailystock', 'dailystockprice'}

    # Models that belong to the intraday database
    intraday_models = {'intradaystock', 'intradaystockprice'}

    def db_for_read(self, model, **hints):
        """Direct read operations to the appropriate database."""
        if model._meta.app_label == 'stocks':
            # Check if this is a daily model
            if model._meta.model_name in self.daily_models:
                return 'daily'
            # Check if this is an intraday model
            if model._meta.model_name in self.intraday_models:
                return 'intraday'
            return 'adjusted'
        return 'default'

    def db_for_write(self, model, **hints):
        """Direct write operations to the appropriate database."""
        if model._meta.app_label == 'stocks':
            # Check if this is a daily model
            if model._meta.model_name in self.daily_models:
                return 'daily'
            # Check if this is an intraday model
            if model._meta.model_name in self.intraday_models:
                return 'intraday'
            return 'adjusted'
        return 'default'

    def allow_relation(self, obj1, obj2, **hints):
        """Allow relations if both models are in the same database."""
        db_set = {'default', 'adjusted', 'daily', 'intraday'}
        if obj1._state.db in db_set and obj2._state.db in db_set:
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """Ensure migrations run on the correct database."""
        if app_label == 'stocks':
            # Daily models go to daily database
            if model_name in self.daily_models:
                return db == 'daily'
            # Intraday models go to intraday database
            if model_name in self.intraday_models:
                return db == 'intraday'
            # Other stock models go to adjusted database
            return db == 'adjusted'
        return db == 'default'
