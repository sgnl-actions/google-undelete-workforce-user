import { JWT } from 'google-auth-library';

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

async function undeleteWorkforceUser(workforcePoolId, subjectId, serviceAccountKey) {
  const keyData = JSON.parse(serviceAccountKey);
  
  const authClient = new JWT({
    email: keyData.client_email,
    key: keyData.private_key,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const url = `https://iam.googleapis.com/v1/locations/global/workforcePools/${workforcePoolId}/subjects/${subjectId}:undelete`;
  
  console.log(`Undeleting workforce user: ${subjectId} from pool: ${workforcePoolId}`);
  
  const response = await authClient.request({
    url,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  console.log(`Successfully undeleted workforce user: ${subjectId}`);
  return response.data;
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
  invoke: async (params, context) => {
    console.log('Starting Google Undelete Workforce User action');
    
    try {
      validateInputs(params);
      
      const { workforcePoolId, subjectId } = params;
      
      console.log(`Processing workforce pool: ${workforcePoolId}`);
      console.log(`Undeleting subject: ${subjectId}`);
      
      if (!context.secrets?.GOOGLE_SERVICE_ACCOUNT_KEY) {
        throw new FatalError('Missing required secret: GOOGLE_SERVICE_ACCOUNT_KEY');
      }
      
      try {
        await undeleteWorkforceUser(workforcePoolId, subjectId, context.secrets.GOOGLE_SERVICE_ACCOUNT_KEY);
        
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