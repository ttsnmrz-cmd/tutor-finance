export function signInReturnError(params:URLSearchParams){
 const code=(params.get('error_code')||params.get('error')||'').toLowerCase();
 const description=(params.get('error_description')||'').toLowerCase();
 if(code==='signup_disabled'||description.includes('signups not allowed')||description.includes('signup is disabled'))return 'This account has not been added to Classroom yet. Ask the administrator to invite it. Your existing ProfiProfit account is separate.';
 if(code==='otp_expired')return 'This email sign-in link has expired. Please request a new one.';
 if(code==='access_denied')return 'Google sign-in was not completed. Access may have been cancelled or this account may not be invited to Classroom. Please contact the administrator.';
 return 'Sign-in could not be completed. Please try again or contact the administrator.';
}
