import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-your-default-secret-key-change-this')

DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '.railway.app', '.up.railway.app', 'api.vectoranalysis.app']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'rest_framework',
    'rest_framework.authtoken',
    'dj_rest_auth',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'allauth.socialaccount.providers.microsoft',
    'dj_rest_auth.registration',
    'corsheaders',
    'stocks',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'stock_backend.urls'

# Django sites framework (required by allauth)
SITE_ID = 1

# REST Framework configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# Simple JWT configuration
from datetime import timedelta

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_COOKIE': 'access_token',
    'AUTH_COOKIE_REFRESH': 'refresh_token',
    'AUTH_COOKIE_SECURE': False,  # Set True in production with HTTPS
    'AUTH_COOKIE_HTTP_ONLY': True,
    'AUTH_COOKIE_SAMESITE': 'Lax',
}

# Django-allauth configuration
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = 'optional'
ACCOUNT_AUTHENTICATION_METHOD = 'email'
ACCOUNT_USERNAME_REQUIRED = False

# Social account providers configuration
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
        'APP': {
            'client_id': os.getenv('GOOGLE_CLIENT_ID'),
            'secret': os.getenv('GOOGLE_CLIENT_SECRET'),
        }
    },
    'microsoft': {
        'SCOPE': ['User.Read'],
        'APP': {
            'client_id': os.getenv('MICROSOFT_CLIENT_ID'),
            'secret': os.getenv('MICROSOFT_CLIENT_SECRET'),
        }
    }
}

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'stock_backend.wsgi.application'

# Database configuration - use DATABASE_URL if available (Railway), otherwise use local config
DATABASE_URL = os.getenv('DATABASE_URL')

if DATABASE_URL:
    # Production: Use single database from Railway
    DATABASES = {
        'default': dj_database_url.config(default=DATABASE_URL, conn_max_age=600),
    }
    # Point all database aliases to the same database in production
    DATABASES['adjusted'] = DATABASES['default']
    DATABASES['daily'] = DATABASES['default']
    DATABASES['intraday'] = DATABASES['default']
else:
    # Local development: Use multiple PostgreSQL databases
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('RAW_DB_NAME', 'stocks_raw'),
            'USER': os.getenv('RAW_DB_USER', 'stocks_user'),
            'PASSWORD': os.getenv('RAW_DB_PASSWORD', 'your_password_here'),
            'HOST': os.getenv('RAW_DB_HOST', 'localhost'),
            'PORT': os.getenv('RAW_DB_PORT', '5432'),
        },
        'adjusted': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('ADJUSTED_DB_NAME', 'stocks_adjusted'),
            'USER': os.getenv('ADJUSTED_DB_USER', 'stocks_user'),
            'PASSWORD': os.getenv('ADJUSTED_DB_PASSWORD', 'your_password_here'),
            'HOST': os.getenv('ADJUSTED_DB_HOST', 'localhost'),
            'PORT': os.getenv('ADJUSTED_DB_PORT', '5432'),
        },
        'daily': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('DAILY_DB_NAME', 'stocks_daily'),
            'USER': os.getenv('DAILY_DB_USER', 'stocks_user'),
            'PASSWORD': os.getenv('DAILY_DB_PASSWORD', 'your_password_here'),
            'HOST': os.getenv('DAILY_DB_HOST', 'localhost'),
            'PORT': os.getenv('DAILY_DB_PORT', '5432'),
        },
        'intraday': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.getenv('INTRADAY_DB_NAME', 'stocks_intraday'),
            'USER': os.getenv('INTRADAY_DB_USER', 'stocks_user'),
            'PASSWORD': os.getenv('INTRADAY_DB_PASSWORD', 'your_password_here'),
            'HOST': os.getenv('INTRADAY_DB_HOST', 'localhost'),
            'PORT': os.getenv('INTRADAY_DB_PORT', '5432'),
        }
    }

# Database router to separate raw and adjusted data (only used locally with multiple DBs)
if not DATABASE_URL:
    DATABASE_ROUTERS = ['stocks.db_router.StockRouter']

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://vectoranalysis.app",
    "https://www.vectoranalysis.app",
]
CORS_ALLOW_CREDENTIALS = True

# CSRF Settings for production
CSRF_TRUSTED_ORIGINS = [
    "https://vectoranalysis.app",
    "https://www.vectoranalysis.app",
    "https://*.railway.app",
]

# Cache settings
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'unique-snowflake',
    }
}
