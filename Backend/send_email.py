import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def send_sos_email(recipient_name, recipient_email, user_name, location, timestamp):
    """
    Sends an SOS email to an emergency contact with the user's location information.
    
    Args:
        recipient_name (str): Name of the emergency contact
        recipient_email (str): Email address of the emergency contact
        user_name (str): Name of the user who triggered the SOS
        location (dict): Dictionary containing location details
        timestamp (str): Timestamp when SOS was triggered
    """
    # Get email credentials from environment variables
    sender_email = os.getenv("SENDER_EMAIL", "echomind.reminder@gmail.com")
    app_password = os.getenv("APP_PASSWORD", "rvzr alaj bwlc jtca")
    
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
    
    try:
        # If app password is not set, print a warning message instead of sending email
        if app_password == "your-app-password" or not app_password:
            print(f"[DEMO MODE] Would send email to {recipient_name} <{recipient_email}>")
            print(f"Subject: {msg['Subject']}")
            print("Email not actually sent: No valid app password configured.")
            return
        
        # Set up server and send email
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, app_password)
        text = msg.as_string()
        server.sendmail(sender_email, recipient_email, text)
        server.quit()
        print(f"SOS email sent successfully to {recipient_name} <{recipient_email}>")
    
    except Exception as e:
        print(f"Failed to send email to {recipient_email}: {str(e)}")
        raise

def send_email(to_email, subject, body):
    """Send both email and SMS notifications"""
    try:
        # Original email sending code
        email_address = os.getenv("EMAIL_ADDRESS") or "echomind.reminder@gmail.com"
        email_password = os.getenv("EMAIL_PASSWORD") or "amhd krsr pmnh cybq"

        print(f"Using email address: {email_address}")
        print("Connecting to SMTP server...")

        msg = MIMEMultipart()
        msg['From'] = email_address
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_address, email_password)
            server.send_message(msg)
        print(f"Email sent to {to_email}")

        # Add SMS sending
        # Get phone number from environment or patient record
        recipient_phone = os.getenv('RECIPIENT_PHONE_NUMBER')
        if recipient_phone:
            send_notification_sms(recipient_phone, subject, body)
        else:
            print("No phone number configured for SMS notifications")

    except Exception as e:
        print(f"Error in send_email: {str(e)}")
        raise