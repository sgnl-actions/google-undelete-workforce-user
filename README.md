# Google Undelete Workforce User Action

Restore a deleted workforce user from Google Cloud IAM Workforce Identity Federation. This action is commonly used for restoring accidentally deleted users or recovering user access.

## Overview

This SGNL action integrates with Google Cloud IAM API to undelete workforce users from Workforce Identity Federation pools. When executed, a previously deleted user will be restored to active status in the specified workforce pool.

## Prerequisites

- Google Cloud IAM API access
- Appropriate authentication credentials (Bearer token, Basic auth, OAuth2, etc.)
- Workforce pool ID where the deleted user exists
- Subject ID of the workforce user to undelete

## Configuration

### Required Secrets

The configured auth type will determine which secrets are needed:

- **Bearer Authentication**: `BEARER_AUTH_TOKEN`
- **Basic Authentication**: `BASIC_USERNAME` and `BASIC_PASSWORD`
- **OAuth2 Client Credentials**: `OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET`
- **OAuth2 Authorization Code**: `OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN`

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADDRESS` | `https://iam.googleapis.com` | Google IAM API base URL (can also be provided via `address` parameter) |
| `OAUTH2_CLIENT_CREDENTIALS_AUDIENCE` | - | OAuth2 audience for client credentials flow |
| `OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE` | - | OAuth2 auth style (InParams or InHeader) |
| `OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID` | - | OAuth2 client ID |
| `OAUTH2_CLIENT_CREDENTIALS_SCOPE` | - | OAuth2 scope |
| `OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL` | - | OAuth2 token endpoint URL |

### Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `subjectId` | string | Yes | The subject/user ID of the workforce user to undelete | `user@example.com` |
| `workforcePoolId` | string | Yes | The ID of the workforce pool containing the user | `my-workforce-pool` |
| `address` | string | No | Google IAM API base URL (defaults to `https://iam.googleapis.com`) | `https://iam.googleapis.com` |

### Output Structure

| Field | Type | Description |
|-------|------|-------------|
| `subjectId` | string | The subject ID that was undeleted |
| `workforcePoolId` | string | The workforce pool ID that was processed |
| `undeleted` | boolean | Whether the user was successfully undeleted |
| `alreadyActive` | boolean | Whether the user was already active (not deleted) |
| `undeletedAt` | datetime | When the undeletion completed (ISO 8601) |

## Usage Example

### Job Request

```json
{
  "id": "undelete-workforce-user-001",
  "type": "nodejs-22",
  "script": {
    "repository": "github.com/sgnl-actions/google-undelete-workforce-user",
    "version": "v1.0.0",
    "type": "nodejs"
  },
  "script_inputs": {
    "subjectId": "user@example.com",
    "workforcePoolId": "my-workforce-pool",
    "address": "https://iam.googleapis.com"
  },
  "environment": {
    "LOG_LEVEL": "info"
  }
}
```

### Successful Response

```json
{
  "subjectId": "user@example.com",
  "workforcePoolId": "my-workforce-pool",
  "undeleted": true,
  "undeletedAt": "2024-01-15T10:30:00Z"
}
```

### Idempotent Behavior (User Already Active)

```json
{
  "subjectId": "user@example.com",
  "workforcePoolId": "my-workforce-pool",
  "undeleted": false,
  "alreadyActive": true,
  "undeletedAt": "2024-01-15T10:30:00Z"
}
```

## Authentication Methods

This action supports multiple authentication methods via the `@sgnl-actions/utils` package:

### 1. Bearer Token
Simple bearer token authentication:
```json
"secrets": {
  "BEARER_AUTH_TOKEN": "your-bearer-token"
}
```

### 2. Basic Authentication
Username and password authentication:
```json
"secrets": {
  "BASIC_USERNAME": "your-username",
  "BASIC_PASSWORD": "your-password"
}
```

### 3. OAuth2 Client Credentials
Machine-to-machine OAuth2 flow (fetches token dynamically):
```json
"secrets": {
  "OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET": "your-client-secret"
},
"environment": {
  "OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID": "your-client-id",
  "OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL": "https://oauth2.googleapis.com/token",
  "OAUTH2_CLIENT_CREDENTIALS_SCOPE": "https://www.googleapis.com/auth/cloud-platform"
}
```

### 4. OAuth2 Authorization Code
Uses pre-existing access token (no refresh, uses as-is):
```json
"secrets": {
  "OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN": "your-access-token"
}
```

## Error Handling

The action includes comprehensive error handling:

### Successful Cases
- **200 OK**: User successfully undeleted
- **400 Bad Request** (user already active): Treated as success - idempotent operation

### Error Cases
- **401 Unauthorized**: Invalid or expired authentication credentials
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: User not found in the workforce pool
- **Other errors**: Thrown with detailed error messages

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test locally with mock data
npm run dev

# Build for production
npm run build
```

### Running Tests

The action includes comprehensive unit tests covering:
- Input validation (subjectId, workforcePoolId)
- Successful undeletion
- Address parameter handling (default, parameter, environment variable)
- Error handling

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage
```

## Security Considerations

- **Token Protection**: Never log or expose authentication tokens
- **Audit Logging**: All undeletions are logged with timestamps
- **Idempotent Operations**: Safe to retry - already active users are handled gracefully
- **Input Validation**: Subject ID and workforce pool ID are validated

## Google Cloud IAM API Reference

This action uses the following Google Cloud IAM API endpoint:
- [Undelete Workforce Pool Subject](https://cloud.google.com/iam/docs/reference/rest/v1/locations.workforcePools.subjects/undelete)

## Troubleshooting

### Common Issues

1. **"Invalid or missing subjectId parameter"**
   - Ensure the `subjectId` parameter is provided and is a non-empty string

2. **"Invalid or missing workforcePoolId parameter"**
   - Ensure the `workforcePoolId` parameter is provided and is a non-empty string

3. **Authentication Errors (401)**
   - Verify your authentication credentials are valid and haven't expired
   - For OAuth2, ensure the access token has the correct scopes

4. **Permission Errors (403)**
   - Ensure your credentials have the `iam.workforcePoolSubjects.undelete` permission
   - Verify the service account has access to the workforce pool

5. **User Not Found (404)**
   - Verify the user exists (even if deleted) in the specified workforce pool
   - Check that both the subjectId and workforcePoolId are correct

6. **User Already Active (400)**
   - This is treated as a success case - the user is already in an active state
   - No action is needed, the operation is idempotent

## Version History

### v1.0.0
- Initial release
- Support for workforce user undeletion via Google Cloud IAM API
- Multiple authentication methods (Bearer, Basic, OAuth2 Client Credentials, OAuth2 Authorization Code)
- Integration with @sgnl-actions/utils package
- Idempotent operation support

## License

MIT

## Support

For issues or questions, please contact SGNL Engineering or create an issue in this repository.
