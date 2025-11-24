class RetryableError extends Error {
  constructor(message) {
    super(message);
    this.retryable = true;
  }
}

class FatalError extends Error {
  constructor(message) {
    super(message);
    this.retryable = false;
  }
}

async function undeleteWorkforceUser(workforcePoolId, subjectId) {
  const url = `https://iam.googleapis.com/v1/locations/global/workforcePools/${workforcePoolId}/subjects/${subjectId}:undelete`;

  console.log(`Undeleting workforce user: ${subjectId} from pool: ${workforcePoolId}`);

  // Make the POST request - authentication is handled externally
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    // Handle error response
    let errorData = null;
    try {
      errorData = await response.json();
    } catch {
      // Response might not be JSON
    }

    const error = new Error(errorData?.error?.message || `HTTP ${response.status}`);
    error.response = {
      status: response.status,
      data: errorData
    };
    throw error;
  }

  console.log(`Successfully undeleted workforce user: ${subjectId}`);

  // Parse response data if available
  let data = null;
  try {
    const text = await response.text();
    if (text) {
      data = JSON.parse(text);
    }
  } catch {
    // Response might not be JSON or empty
  }

  return data;
}

function validateInputs(params) {
  if (!params.workforcePoolId || typeof params.workforcePoolId !== 'string' || params.workforcePoolId.trim() === '') {
    throw new FatalError('Invalid or missing workforcePoolId parameter');
  }

  if (!params.subjectId || typeof params.subjectId !== 'string' || params.subjectId.trim() === '') {
    throw new FatalError('Invalid or missing subjectId parameter');
  }
}

export default {
  /**
   * Main execution handler - undeletes a workforce user
   * @param {Object} params - Job input parameters
   * @param {string} params.workforcePoolId - The workforce pool ID
   * @param {string} params.subjectId - The subject/user ID to undelete
   *
   * @param {Object} context - Execution context with secrets and environment
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
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_AUTHORIZATION_CODE
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_CLIENT_SECRET
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_REFRESH_TOKEN
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_AUTH_STYLE
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_AUTH_URL
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_CLIENT_ID
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_LAST_TOKEN_ROTATION_TIMESTAMP
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_REDIRECT_URI
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_SCOPE
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_TOKEN_LIFETIME_FREQUENCY
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_TOKEN_ROTATION_FREQUENCY
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_TOKEN_ROTATION_INTERVAL
   * @param {string} context.environment.OAUTH2_AUTHORIZATION_CODE_TOKEN_URL
   *
   * @returns {Object} Job results
   */
  invoke: async (params, context) => {
    console.log('Starting Google Undelete Workforce User action');

    try {
      validateInputs(params);

      const { workforcePoolId, subjectId } = params;

      console.log(`Processing workforce pool: ${workforcePoolId}`);
      console.log(`Undeleting subject: ${subjectId}`);

      // Authentication is handled by the external system
      try {
        await undeleteWorkforceUser(workforcePoolId, subjectId);

        const result = {
          workforcePoolId,
          subjectId,
          undeleted: true,
          alreadyActive: false,
          undeletedAt: new Date().toISOString()
        };

        console.log('Workforce user undeletion completed successfully');
        return result;

      } catch (error) {
        if (error.response?.status === 404) {
          throw new FatalError(`Workforce user ${subjectId} not found in pool ${workforcePoolId}`);
        }

        if (error.response?.status === 400) {
          const errorMessage = error.response?.data?.error?.message || error.message;
          if (errorMessage.includes('not deleted') || errorMessage.includes('already active')) {
            console.log(`Workforce user ${subjectId} is already active`);
            return {
              workforcePoolId,
              subjectId,
              undeleted: false,
              alreadyActive: true,
              undeletedAt: new Date().toISOString()
            };
          }
          throw new FatalError(`Bad request: ${errorMessage}`);
        }

        if (error.response?.status === 429 || (error.response?.status >= 500 && error.response?.status < 600)) {
          throw new RetryableError(`Google Cloud API error (${error.response?.status}): ${error.message}`);
        }

        throw new FatalError(`Failed to undelete workforce user: ${error.message}`);
      }

    } catch (error) {
      console.error(`Error undeleting workforce user: ${error.message}`);

      if (error instanceof RetryableError || error instanceof FatalError) {
        throw error;
      }

      throw new FatalError(`Unexpected error: ${error.message}`);
    }
  },

  error: async (params, _context) => {
    const { error } = params;
    console.error(`Error handler invoked: ${error?.message}`);

    throw error;
  },

  halt: async (params, _context) => {
    const { reason, workforcePoolId, subjectId } = params;
    console.log(`Job is being halted (${reason})`);

    return {
      workforcePoolId: workforcePoolId || 'unknown',
      subjectId: subjectId || 'unknown',
      reason: reason || 'unknown',
      haltedAt: new Date().toISOString(),
      cleanupCompleted: true
    };
  }
};