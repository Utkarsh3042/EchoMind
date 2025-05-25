import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
from twilio.rest import Client
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("notifications.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def format_phone_number(phone_number):
    """Format a phone number to E.164 format for Twilio"""
    if not phone_number:
        return None
    
    # Remove all non-digit characters except +
    clean_number = ''.join(c for c in phone_number if c.isdigit() or c == '+')
    
    # If no country code, add default (change +91 to your country code if needed)
    if not clean_number.startswith('+'):
        if len(clean_number) == 10:  # Assuming 10-digit number without country code
            clean_number = '+91' + clean_number
        else:
            clean_number = '+' + clean_number
    
    logger.info(f"Formatted phone number: {clean_number}")
    return clean_number

def send_sms(recipient_phone, subject, body):
    """Send SMS using Twilio"""
    try:
        logger.info(f"Attempting to send SMS to {recipient_phone}")
        
        # Load Twilio credentials
        account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        twilio_phone = os.getenv('TWILIO_PHONE_NUMBER')
        
        logger.info(f"Twilio Account SID: {account_sid[:8]}... (truncated)")
        logger.info(f"Twilio Phone: {twilio_phone}")
        
        # Validate credentials
        if not account_sid:
            logger.error("TWILIO_ACCOUNT_SID not found in environment variables")
            return False
        if not auth_token:
            logger.error("TWILIO_AUTH_TOKEN not found in environment variables")
            return False
        if not twilio_phone:
            logger.error("TWILIO_PHONE_NUMBER not found in environment variables")
            return False
        if not recipient_phone:
            logger.error("Recipient phone number is empty")
            return False
        
        # Format phone numbers
        formatted_recipient = format_phone_number(recipient_phone)
        formatted_twilio = format_phone_number(twilio_phone)
        
        if not formatted_recipient:
            logger.error("Failed to format recipient phone number")
            return False
        if not formatted_twilio:
            logger.error("Failed to format Twilio phone number")
            return False
        
        # Format message (combine subject and body)
        message_text = f"{subject}\n\n{body}"
        
        # Truncate message if too long (SMS limit is 1600 characters)
        if len(message_text) > 1600:
            message_text = message_text[:1590] + "... [truncated]"
        
        logger.info(f"Sending SMS from {formatted_twilio} to {formatted_recipient}")
        logger.info(f"Message length: {len(message_text)} characters")
        
        # Create client and send message
        client = Client(account_sid, auth_token)
        message_obj = client.messages.create(
            body=message_text,
            from_=formatted_twilio,
            to=formatted_recipient
        )
        
        logger.info(f"SMS sent successfully with SID: {message_obj.sid}")
        logger.info(f"Message status: {message_obj.status}")
        return True
        
    except Exception as e:
        logger.error(f"Error sending SMS: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        return False

def send_sos_email(recipient_name, recipient_email, user_name, location, timestamp):
    """
    Sends an SOS email and SMS to an emergency contact with the user's location information.
    """
    # Get email credentials from environment variables
    sender_email = os.getenv("SENDER_EMAIL", "echomind.reminder@gmail.com")
    app_password = os.getenv("APP_PASSWORD", "amhd krsr pmnh cybq")
    
    # Create message
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = recipient_email
    msg['Subject'] = f"URGENT: SOS Alert from {user_name}"
    
    # Create email body
    body = f"""
    <html>
    <body>
        <h2>EMERGENCY SOS ALERT</h2>
        <p><strong>{user_name}</strong> has triggered an SOS alert at <strong>{timestamp}</strong>.</p>
        
        <h3>Current Location:</h3>
        <p>Address: {location['address']}</p>
        <p>Coordinates: {location['latitude']}, {location['longitude']}</p>
        
        <p><a href="{location['maps_url']}" style="background-color:#FF0000; color:white; padding:10px; border-radius:5px; text-decoration:none;">VIEW ON MAP</a></p>
        
        <p>Please take immediate action to ensure their safety.</p>
        
        <p>This is an automated alert from the EchoMind SOS System.</p>
    </body>
    </html>
    """
    
    # Attach HTML content
    msg.attach(MIMEText(body, 'html'))
    
    success_email = False
    success_sms = False
    
    try:
        # Send email
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, app_password)
        text = msg.as_string()
        server.sendmail(sender_email, recipient_email, text)
        server.quit()
        logger.info(f"SOS email sent successfully to {recipient_name} <{recipient_email}>")
        success_email = True
        
        # Send SMS - Get phone number from environment
        recipient_phone = os.getenv('RECIPIENT_PHONE_NUMBER')
        if recipient_phone:
            sms_subject = f"URGENT SOS ALERT from {user_name}"
            sms_body = f"{user_name} has triggered an SOS alert at {timestamp}.\nLocation: {location['address']}\nCoordinates: {location['latitude']}, {location['longitude']}\nView map: {location['maps_url']}\nPlease take immediate action to ensure their safety."
            success_sms = send_sms(recipient_phone, sms_subject, sms_body)
        else:
            logger.error("RECIPIENT_PHONE_NUMBER not found in environment variables")
            success_sms = False
        
    except Exception as e:
        logger.error(f"Failed to send notifications to {recipient_email}: {str(e)}")
        raise
    
    return success_email and success_sms

def send_email(to_email, subject, body):
    """Send both email and SMS notifications"""
    try:
        # Send email
        email_address = os.getenv("EMAIL_ADDRESS") or "echomind.reminder@gmail.com"
        email_password = os.getenv("EMAIL_PASSWORD") or "amhd krsr pmnh cybq"

        msg = MIMEMultipart()
        msg['From'] = email_address
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_address, email_password)
            server.send_message(msg)
        logger.info(f"Email sent to {to_email}")
        
        # Send SMS - Get phone number from environment
        recipient_phone = os.getenv('RECIPIENT_PHONE_NUMBER')
        if recipient_phone:
            sms_success = send_sms(recipient_phone, subject, body)
            if sms_success:
                logger.info(f"SMS sent successfully to {recipient_phone}")
            else:
                logger.error(f"Failed to send SMS to {recipient_phone}")
        else:
            logger.warning("No phone number configured for SMS notifications (RECIPIENT_PHONE_NUMBER not set)")

    except Exception as e:
        logger.error(f"Error in send_email: {str(e)}")
        raise