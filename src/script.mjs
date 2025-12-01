/**
 * Google Undelete Workforce User Action
 *
 * Undeletes a user from Google Cloud Workforce Identity Federation using
 * the Google Cloud IAM API.
 */

import { getAuthorizationHeader, getBaseUrl } from '@sgnl-actions/utils';

/**
 * Helper function to undelete a workforce user
 * @private
 */
async function undeleteWorkforceUser(workforcePoolId, subjectId, baseUrl, authHeader) {
  // Construct the API URL
  const url = `${baseUrl}/v1/locations/global/workforcePools/${workforcePoolId}/subjects/${subjectId}:undelete`;

  // Make the POST request with authentication
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
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

export default {
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
      baseUrl = getBaseUrl(params, context);
    } catch (error) {
      // Default to standard Google IAM API URL if not provided
      baseUrl = 'https://iam.googleapis.com';
    }

    // Get authorization header using utils
    const authHeader = await getAuthorizationHeader(context);

    // Make the API request to undelete the user
    const result = await undeleteWorkforceUser(
      workforcePoolId,
      subjectId,
      baseUrl,
      authHeader
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
