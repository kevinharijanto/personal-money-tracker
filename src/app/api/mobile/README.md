# Mobile Authentication API

This directory contains dedicated authentication endpoints for mobile applications (Android/iOS). These endpoints use JWT tokens instead of NextAuth sessions, making them ideal for mobile client integration.

## Authentication Endpoints

### 1. Standard Email/Password Login
**Endpoint:** `POST /api/mobile/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

### 2. PIN Quick Login
**Endpoint:** `POST /api/mobile/login/pin`

**Request Body:**
```json
{
  "email": "user@example.com",
  "pin": "1234"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

### 3. Biometric Quick Login
**Endpoint:** `POST /api/mobile/login/biometric`

**Request Body:**
```json
{
  "email": "user@example.com",
  "assertion": "biometric_assertion_data"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_id",
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

## Using the JWT Token

After successful authentication, include the JWT token in the Authorization header for all subsequent API requests:

```
Authorization: Bearer <jwt_token>
```

## Example Protected Endpoint

**Endpoint:** `GET /api/mobile/profile`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "emailVerified": "2023-01-01T00:00:00.000Z",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

## Android Implementation Example

### Retrofit Service Interface

```kotlin
interface MobileAuthService {
    @POST("/api/mobile/login")
    suspend fun login(
        @Body request: EmailLoginRequest
    ): Response<MobileLoginResponse>
    
    @POST("/api/mobile/login/pin")
    suspend fun loginWithPin(
        @Body request: PinLoginRequest
    ): Response<MobileLoginResponse>
    
    @POST("/api/mobile/login/biometric")
    suspend fun loginWithBiometric(
        @Body request: BiometricLoginRequest
    ): Response<MobileLoginResponse>
    
    @GET("/api/mobile/profile")
    suspend fun getProfile(
        @Header("Authorization") authorization: String
    ): Response<ProfileResponse>
}

// Request/Response Data Classes
data class EmailLoginRequest(
    val email: String,
    val password: String
)

data class PinLoginRequest(
    val email: String,
    val pin: String
)

data class BiometricLoginRequest(
    val email: String,
    val assertion: String
)

data class MobileLoginResponse(
    val token: String,
    val user: User
)

data class User(
    val id: String,
    val name: String?,
    val email: String
)

data class ProfileResponse(
    val success: Boolean,
    val profile: UserProfile
)

data class UserProfile(
    val id: String,
    val email: String,
    val name: String?,
    val emailVerified: String?,
    val createdAt: String,
    val updatedAt: String
)
```

### Authentication Flow in Android

```kotlin
class AuthRepository(private val authService: MobileAuthService) {
    
    // Store token securely (e.g., using EncryptedSharedPreferences)
    private var authToken: String? = null
    
    suspend fun login(email: String, password: String): Result<User> {
        return try {
            val response = authService.login(EmailLoginRequest(email, password))
            if (response.isSuccessful && response.body() != null) {
                val loginResponse = response.body()!!
                authToken = loginResponse.token
                Result.success(loginResponse.user)
            } else {
                Result.failure(Exception("Login failed: ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun loginWithPin(email: String, pin: String): Result<User> {
        return try {
            val response = authService.loginWithPin(PinLoginRequest(email, pin))
            if (response.isSuccessful && response.body() != null) {
                val loginResponse = response.body()!!
                authToken = loginResponse.token
                Result.success(loginResponse.user)
            } else {
                Result.failure(Exception("PIN login failed: ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    suspend fun getProfile(): Result<UserProfile> {
        val token = authToken ?: return Result.failure(Exception("Not authenticated"))
        
        return try {
            val response = authService.getProfile("Bearer $token")
            if (response.isSuccessful && response.body() != null) {
                val profileResponse = response.body()!!
                Result.success(profileResponse.profile)
            } else {
                Result.failure(Exception("Failed to get profile: ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun getAuthToken(): String? = authToken
    
    fun logout() {
        authToken = null
        // Clear stored token
    }
}
```

## Security Notes

1. **Token Storage**: Store JWT tokens securely on the device using Android's EncryptedSharedPreferences or KeyStore.

2. **Token Expiration**: Tokens expire after 7 days. Implement token refresh logic if needed.

3. **PIN Security**: PINs must be exactly 4 digits and are stored with additional security measures (pepper hashing).

4. **Biometric Authentication**: The current implementation is a placeholder. For production, implement proper WebAuthn verification.

5. **HTTPS**: Always use HTTPS in production to protect tokens in transit.

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (missing required fields)
- `401` - Unauthorized (invalid credentials or token)
- `404` - Not Found (user not found)
- `500` - Internal Server Error

Error responses follow this format:
```json
{
  "error": "Error message description"
}