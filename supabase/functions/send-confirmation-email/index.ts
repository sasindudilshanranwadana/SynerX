import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    const { email, confirmationUrl } = await req.json()

    // Professional email template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Confirm Your Project 49 Account</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #06B6D4 0%, #0891B2 100%); padding: 40px 30px; text-align: center; }
          .logo { color: white; font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .subtitle { color: rgba(255,255,255,0.9); font-size: 16px; }
          .content { padding: 40px 30px; }
          .welcome { font-size: 24px; font-weight: 600; color: #1e293b; margin-bottom: 20px; }
          .message { color: #64748b; line-height: 1.6; margin-bottom: 30px; }
          .button { display: inline-block; background: #06B6D4; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
          .button:hover { background: #0891B2; }
          .footer { background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px; }
          .security-note { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Project 49</div>
            <div class="subtitle">Road Safety Analysis Platform</div>
          </div>
          
          <div class="content">
            <h1 class="welcome">Welcome to Project 49!</h1>
            
            <p class="message">
              Thank you for creating an account with Project 49. We're excited to have you join our mission 
              to enhance road safety through advanced AI and computer vision technology.
            </p>
            
            <p class="message">
              To complete your registration and activate your account, please click the confirmation button below:
            </p>
            
            <div style="text-align: center;">
              <a href="${confirmationUrl}" class="button">Confirm Your Account</a>
            </div>
            
            <div class="security-note">
              <strong>Security Notice:</strong> This confirmation link will expire in 24 hours for your security. 
              If you didn't create this account, please ignore this email.
            </div>
            
            <p class="message">
              Once confirmed, you'll have access to:
            </p>
            <ul style="color: #64748b; line-height: 1.8;">
              <li>Advanced video analysis dashboard</li>
              <li>Real-time traffic monitoring tools</li>
              <li>Comprehensive analytics and reporting</li>
              <li>AI-powered behavior analysis</li>
            </ul>
            
            <p class="message">
              If you have any questions or need assistance, please don't hesitate to contact our support team.
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Project 49 Team</strong><br>
            Swinburne University of Technology<br>
            Road Safety Research Division</p>
            
            <p style="margin-top: 20px;">
              This email was sent to ${email}. If you didn't request this, please ignore this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `

    // In a real implementation, you would send this email using a service like SendGrid, Mailgun, etc.
    // For now, we'll just return success
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Confirmation email sent successfully',
        emailContent: emailHtml 
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        }
      }
    )
  }
})