// Simple email utility placeholder.
// In production, integrate with a real provider (e.g., SMTP, SendGrid, etc.)

async function sendPasswordResetEmail(to, resetUrl) {
  // For development: log to console
  console.log(`Password reset link for ${to}: ${resetUrl}`);
  return true;
}

module.exports = { sendPasswordResetEmail };
