// SGNL Job Script - Auto-generated bundle
'use strict';

/**
 * SGNL Actions - Authentication Utilities
 *
 * Shared authentication utilities for SGNL actions.
 * Supports: Bearer Token, Basic Auth, OAuth2 Client Credentials, OAuth2 Authorization Code
 */

/**
 * User-Agent header value for all SGNL CAEP Hub requests.
 */
const SGNL_USER_AGENT = 'SGNL-CAEP-Hub/2.0';

/**
 * Get OAuth2 access token using client credentials flow
 * @param {Object} config - OAuth2 configuration
 * @param {string} config.tokenUrl - Token endpoint URL
 * @param {string} config.clientId - Client ID
 * @param {string} config.clientSecret - Client secret
 * @param {string} [config.scope] - OAuth2 scope
 * @param {string} [config.audience] - OAuth2 audience
 * @param {string} [config.authStyle] - Auth style: 'InParams' or 'InHeader' (default)
 * @returns {Promise<string>} Access token
 */
async function getClientCredentialsToken(config) {
  const { tokenUrl, clientId, clientSecret, scope, audience, authStyle } = config;

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error('OAuth2 Client Credentials flow requires tokenUrl, clientId, and clientSecret');
  }

  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');

  if (scope) {
    params.append('scope', scope);
  }

  if (audience) {
    params.append('audience', audience);
  }

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
    'User-Agent': SGNL_USER_AGENT
  };

  if (authStyle === 'InParams') {
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
  } else {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    headers['Authorization'] = `Basic ${credentials}`;
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: params.toString()
  });

  if (!response.ok) {
    let errorText;
    try {
      const errorData = await response.json();
      errorText = JSON.stringify(errorData);
    } catch {
      errorText = await response.text();
    }
    throw new Error(
      `OAuth2 token request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('No access_token in OAuth2 response');
  }

  return data.access_token;
}

/**
 * Get the Authorization header value from context using available auth method.
 * Supports: Bearer Token, Basic Auth, OAuth2 Authorization Code, OAuth2 Client Credentials
 *
 * @param {Object} context - Execution context with environment and secrets
 * @param {Object} context.environment - Environment variables
 * @param {Object} context.secrets - Secret values
 * @returns {Promise<string>} Authorization header value (e.g., "Bearer xxx" or "Basic xxx")
 */
async function getAuthorizationHeader(context) {
  const env = context.environment || {};
  const secrets = context.secrets || {};

  // Method 1: Simple Bearer Token
  if (secrets.BEARER_AUTH_TOKEN) {
    const token = secrets.BEARER_AUTH_TOKEN;
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  // Method 2: Basic Auth (username + password)
  if (secrets.BASIC_PASSWORD && secrets.BASIC_USERNAME) {
    const credentials = btoa(`${secrets.BASIC_USERNAME}:${secrets.BASIC_PASSWORD}`);
    return `Basic ${credentials}`;
  }

  // Method 3: OAuth2 Authorization Code - use pre-existing access token
  if (secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN) {
    const token = secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN;
    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  }

  // Method 4: OAuth2 Client Credentials - fetch new token
  if (secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET) {
    const tokenUrl = env.OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL;
    const clientId = env.OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID;
    const clientSecret = secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET;

    if (!tokenUrl || !clientId) {
      throw new Error('OAuth2 Client Credentials flow requires TOKEN_URL and CLIENT_ID in env');
    }

    const token = await getClientCredentialsToken({
      tokenUrl,
      clientId,
      clientSecret,
      scope: env.OAUTH2_CLIENT_CREDENTIALS_SCOPE,
      audience: env.OAUTH2_CLIENT_CREDENTIALS_AUDIENCE,
      authStyle: env.OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE
    });

    return `Bearer ${token}`;
  }

  throw new Error(
    'No authentication configured. Provide one of: ' +
    'BEARER_AUTH_TOKEN, BASIC_USERNAME/BASIC_PASSWORD, ' +
    'OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN, or OAUTH2_CLIENT_CREDENTIALS_*'
  );
}

/**
 * Get the base URL/address for API calls
 * @param {Object} params - Request parameters
 * @param {string} [params.address] - Address from params
 * @param {Object} context - Execution context
 * @returns {string} Base URL
 */
function getBaseURL(params, context) {
  const env = context.environment || {};
  const address = params?.address || env.ADDRESS;

  if (!address) {
    throw new Error('No URL specified. Provide address parameter or ADDRESS environment variable');
  }

  // Remove trailing slash if present
  return address.endsWith('/') ? address.slice(0, -1) : address;
}

/**
 * Create full headers object with Authorization and common headers
 * @param {Object} context - Execution context with env and secrets
 * @returns {Promise<Object>} Headers object with Authorization, Accept, Content-Type
 */
async function createAuthHeaders(context) {
  const authHeader = await getAuthorizationHeader(context);
  return {
    'Authorization': authHeader,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': SGNL_USER_AGENT
  };
}

/**
 * Google Undelete Workforce User Action
 *
 * Undeletes a user from Google Cloud Workforce Identity Federation using
 * the Google Cloud IAM API.
 */


/**
 * Helper function to undelete a workforce user
 * @private
 */
async function undeleteWorkforceUser(workforcePoolId, subjectId, baseUrl, headers) {
  // Construct the API URL
  const url = `${baseUrl}/v1/locations/global/workforcePools/${workforcePoolId}/subjects/${subjectId}:undelete`;

  // Make the POST request with authentication
  const response = await fetch(url, {
    method: 'POST',
    headers
  });

  // Read response body if available
  let responseData = null;
  try {
    const text = await response.text();
    if (text) {
      responseData = JSON.parse(text);
    }
  } catch {
    // Response might not be JSON or empty
  }

  return {
    success: response.ok,
    status: response.status,
    data: responseData
  };
}

var script = {
  /**
   * Main execution handler - undeletes a workforce user
   * @param {Object} params - Job input parameters
   * @param {string} params.subjectId - The subject/user ID to undelete
   * @param {string} params.workforcePoolId - The workforce pool ID
   * @param {string} params.address - Full URL to Google IAM API (defaults to https://iam.googleapis.com)
   *
   * @param {Object} context - Execution context with secrets and environment
   * @param {string} context.environment.ADDRESS - Default Google IAM API base URL
   *
   * The configured auth type will determine which of the following environment variables and secrets are available
   * @param {string} context.secrets.BEARER_AUTH_TOKEN
   *
   * @param {string} context.secrets.BASIC_USERNAME
   * @param {string} context.secrets.BASIC_PASSWORD
   *
   * @param {string} context.secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUDIENCE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_SCOPE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL
   *
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN
   *
   * @returns {Object} Job results
   */
  invoke: async (params, context) => {

    const { subjectId, workforcePoolId } = params;

    console.log(`Starting Google Workforce user undeletion for subject ${subjectId} in pool ${workforcePoolId}`);

    // Validate inputs - subjectId first to match parameter order
    if (!subjectId || typeof subjectId !== 'string') {
      throw new Error('Invalid or missing subjectId parameter');
    }
    if (!workforcePoolId || typeof workforcePoolId !== 'string') {
      throw new Error('Invalid or missing workforcePoolId parameter');
    }

    // Get base URL using utils (with default for Google IAM API)
    let baseUrl;
    try {
      baseUrl = getBaseURL(params, context);
    } catch (error) {
      // Default to standard Google IAM API URL if not provided
      baseUrl = 'https://iam.googleapis.com';
    }

    // Get authorization header using utils
    const headers = await createAuthHeaders(context);

    // Make the API request to undelete the user
    const result = await undeleteWorkforceUser(
      workforcePoolId,
      subjectId,
      baseUrl,
      headers
    );

    // Handle the response
    if (result.success) {
      console.log(`Successfully undeleted workforce user ${subjectId}`);

      return {
        subjectId: subjectId,
        workforcePoolId: workforcePoolId,
        undeleted: true,
        undeletedAt: new Date().toISOString()
      };
    }

    // Handle specific error cases
    const statusCode = result.status;

    // 400 might mean user is already active (not deleted)
    if (statusCode === 400) {
      const errorMessage = result.data?.error?.message || '';
      if (errorMessage.includes('not deleted') || errorMessage.includes('already active')) {
        console.log(`Workforce user ${subjectId} is already active`);
        return {
          subjectId: subjectId,
          workforcePoolId: workforcePoolId,
          undeleted: false,
          alreadyActive: true,
          undeletedAt: new Date().toISOString()
        };
      }
    }

    // Handle other errors
    let errorMessage = `Failed to undelete workforce user: ${statusCode}`;
    if (result.data?.error?.message) {
      errorMessage = `Failed to undelete workforce user: ${result.data.error.message}`;
    } else if (typeof result.data === 'string') {
      errorMessage = `Failed to undelete workforce user: ${result.data}`;
    }

    console.error('Google API error:', result.data);

    const error = new Error(errorMessage);
    error.statusCode = statusCode;
    throw error;
  },

  /**
   * Error recovery handler - framework handles retries by default
   *
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   *
   * @returns {Object} Recovery results
   */
  error: async (params, _context) => {
    const { error, subjectId, workforcePoolId } = params;
    console.error(`Workforce user undeletion failed for ${subjectId} in pool ${workforcePoolId}: ${error.message}`);

    // Framework handles retries for transient errors (429, 502, 503, 504)
    // Just re-throw the error to let the framework handle it
    throw error;
  },

  /**
   * Graceful shutdown handler - cleanup when job is halted
   *
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   *
   * @returns {Object} Cleanup results
   */
  halt: async (params, _context) => {
    const { reason, subjectId, workforcePoolId } = params;
    console.log(`Workforce user undeletion job is being halted (${reason}) for ${subjectId} in pool ${workforcePoolId}`);

    // No cleanup needed for this simple operation
    // The POST request either completed or didn't

    return {
      subjectId: subjectId || 'unknown',
      workforcePoolId: workforcePoolId || 'unknown',
      reason: reason,
      haltedAt: new Date().toISOString(),
      cleanupCompleted: true
    };
  }
};

module.exports = script;
