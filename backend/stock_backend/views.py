"""
Custom authentication views for social login.
"""
import requests
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from allauth.socialaccount.models import SocialAccount

User = get_user_model()


def get_tokens_for_user(user):
    """Generate JWT tokens for a user."""
    refresh = RefreshToken.for_user(user)
    return {
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
    }


def verify_google_token(access_token):
    """Verify Google OAuth token and get user info."""
    try:
        response = requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Google token verification error: {e}")
        return None


def verify_microsoft_token(access_token):
    """Verify Microsoft OAuth token and get user info."""
    try:
        response = requests.get(
            'https://graph.microsoft.com/v1.0/me',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            # Normalize to match Google's format
            return {
                'sub': data.get('id'),
                'email': data.get('mail') or data.get('userPrincipalName'),
                'name': data.get('displayName'),
                'given_name': data.get('givenName'),
                'family_name': data.get('surname'),
            }
        return None
    except Exception as e:
        print(f"Microsoft token verification error: {e}")
        return None


@api_view(['POST'])
@permission_classes([AllowAny])
def social_login(request):
    """
    Exchange OAuth access token for Django JWT tokens.

    Request body:
    {
        "access_token": "oauth_access_token_from_provider",
        "provider": "google" | "microsoft"
    }

    Response:
    {
        "access_token": "jwt_access_token",
        "refresh_token": "jwt_refresh_token",
        "user": {
            "id": 1,
            "email": "user@example.com",
            "name": "User Name"
        }
    }
    """
    access_token = request.data.get('access_token')
    provider = request.data.get('provider')

    if not access_token:
        return Response(
            {'error': 'access_token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if provider not in ['google', 'microsoft']:
        return Response(
            {'error': 'Invalid provider. Must be "google" or "microsoft"'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Verify token with provider
    if provider == 'google':
        user_info = verify_google_token(access_token)
    else:
        user_info = verify_microsoft_token(access_token)

    if not user_info:
        return Response(
            {'error': 'Invalid or expired access token'},
            status=status.HTTP_401_UNAUTHORIZED
        )

    email = user_info.get('email')
    if not email:
        return Response(
            {'error': 'Email not provided by OAuth provider'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Get or create user
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        # Create new user
        user = User.objects.create_user(
            username=email,
            email=email,
            first_name=user_info.get('given_name', ''),
            last_name=user_info.get('family_name', ''),
        )
        user.set_unusable_password()  # Social login users don't need password
        user.save()

    # Create or update social account link
    uid = user_info.get('sub') or user_info.get('id')
    SocialAccount.objects.update_or_create(
        user=user,
        provider=provider,
        defaults={'uid': uid, 'extra_data': user_info}
    )

    # Generate JWT tokens
    tokens = get_tokens_for_user(user)

    return Response({
        **tokens,
        'user': {
            'id': user.id,
            'email': user.email,
            'name': f"{user.first_name} {user.last_name}".strip() or user.email,
        }
    })
